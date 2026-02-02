<?php
/**
 * Get Clusters - Lightweight endpoint for map marker clusters
 * Returns aggregated counts by geographic grid, NOT individual posts
 * Designed for fast initial load with hundreds of thousands of posts
 */

declare(strict_types=1);

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

header('Content-Type: application/json');

// Helper function for error responses
function fail(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

try {
    // Database connection (same pattern as get-posts.php)
    $configCandidates = [
        __DIR__ . '/../config/config-db.php',
        dirname(__DIR__) . '/config/config-db.php',
        dirname(__DIR__, 2) . '/config/config-db.php',
        dirname(__DIR__, 3) . '/../config/config-db.php',
        dirname(__DIR__) . '/../config/config-db.php',
        __DIR__ . '/config-db.php',
    ];

    $configPath = null;
    foreach ($configCandidates as $candidate) {
        if (is_file($candidate)) {
            $configPath = $candidate;
            break;
        }
    }

    if ($configPath === null) {
        fail(500, 'Database configuration file is missing.');
    }
    require_once $configPath;

    if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
        fail(500, 'Database connection unavailable.');
    }

    // Get zoom level from request (determines grid size)
    $zoom = isset($_GET['zoom']) ? floatval($_GET['zoom']) : 3;
    
    // Filters (worldwide)
    $keyword = isset($_GET['keyword']) ? trim((string)$_GET['keyword']) : '';
    $minPrice = isset($_GET['min_price']) && $_GET['min_price'] !== '' ? floatval($_GET['min_price']) : null;
    $maxPrice = isset($_GET['max_price']) && $_GET['max_price'] !== '' ? floatval($_GET['max_price']) : null;
    $dateStart = isset($_GET['date_start']) ? trim((string)$_GET['date_start']) : '';
    $dateEnd = isset($_GET['date_end']) ? trim((string)$_GET['date_end']) : '';
    $includeExpired = isset($_GET['expired']) && ((string)$_GET['expired'] === '1' || (string)$_GET['expired'] === 'true');
    $subcategoryKeys = [];
    if (!empty($_GET['subcategory_keys'])) {
        $raw = explode(',', (string)$_GET['subcategory_keys']);
        foreach ($raw as $k) {
            $k = trim($k);
            if ($k !== '') $subcategoryKeys[] = $k;
        }
    }
    
    // Calculate grid size based on zoom (same logic as client-side)
    if ($zoom >= 7.5) {
        $gridSize = 0.5;
    } elseif ($zoom >= 6) {
        $gridSize = 1;
    } elseif ($zoom >= 4) {
        $gridSize = 2.5;
    } elseif ($zoom >= 2) {
        $gridSize = 5;
    } else {
        $gridSize = 10;
    }

    // Query: Group map cards by grid cell, count each bucket
    // Only include visible posts (active visibility, clean/pending moderation, paid payment)
    $where = [];
    $params = [];
    $types = '';
    
    $where[] = "p.deleted_at IS NULL";
    $where[] = "p.payment_status = 'paid'";
    if ($includeExpired) {
        $where[] = "p.visibility IN ('active','expired')";
    } else {
        $where[] = "p.visibility = 'active'";
    }
    $where[] = "p.moderation_status IN ('clean','pending')";
    
    if ($keyword !== '') {
        $kw = '%' . $keyword . '%';
        $where[] = "(pmc.title LIKE ? OR pmc.description LIKE ? OR pmc.venue_name LIKE ? OR pmc.city LIKE ? OR p.checkout_key LIKE ? OR co.checkout_title LIKE ?)";
        $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw;
        $types .= 'ssssss';
    }
    
    if ($dateStart !== '' || $dateEnd !== '') {
        $start = $dateStart !== '' ? $dateStart : $dateEnd;
        $end = $dateEnd !== '' ? $dateEnd : $dateStart;
        if ($start === '' || $end === '') { $start = $start ?: $end; $end = $start; }
        $where[] = "EXISTS (SELECT 1 FROM post_sessions ps WHERE ps.post_map_card_id = pmc.id AND ps.session_date BETWEEN ? AND ?)";
        $params[] = $start; $params[] = $end;
        $types .= 'ss';
    }
    
    if ($minPrice !== null || $maxPrice !== null) {
        if ($minPrice !== null && $maxPrice !== null) {
            $where[] = "(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.post_map_card_id = pmc.id AND tp.price BETWEEN ? AND ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.post_map_card_id = pmc.id AND ip.item_price BETWEEN ? AND ?))";
            $params[] = $minPrice; $params[] = $maxPrice; $params[] = $minPrice; $params[] = $maxPrice;
            $types .= 'dddd';
        } elseif ($minPrice !== null) {
            $where[] = "(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.post_map_card_id = pmc.id AND tp.price >= ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.post_map_card_id = pmc.id AND ip.item_price >= ?))";
            $params[] = $minPrice; $params[] = $minPrice;
            $types .= 'dd';
        } elseif ($maxPrice !== null) {
            $where[] = "(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.post_map_card_id = pmc.id AND tp.price <= ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.post_map_card_id = pmc.id AND ip.item_price <= ?))";
            $params[] = $maxPrice; $params[] = $maxPrice;
            $types .= 'dd';
        }
    }
    
    if (count($subcategoryKeys) > 0) {
        $placeholders = implode(',', array_fill(0, count($subcategoryKeys), '?'));
        $where[] = "pmc.subcategory_key IN ($placeholders)";
        foreach ($subcategoryKeys as $k) {
            $params[] = $k;
            $types .= 's';
        }
    }
    
    $whereSql = implode(' AND ', $where);
    
    $sql = "
        SELECT 
            FLOOR((pmc.longitude + 180) / ?) AS grid_col,
            FLOOR((LEAST(GREATEST(pmc.latitude, -85), 85) + 90) / ?) AS grid_row,
            COUNT(*) AS count,
            AVG(pmc.longitude) AS avg_lng,
            AVG(LEAST(GREATEST(pmc.latitude, -85), 85)) AS avg_lat
        FROM post_map_cards pmc
        INNER JOIN posts p ON pmc.post_id = p.id
        LEFT JOIN checkout_options co ON p.checkout_key = co.checkout_key
        WHERE {$whereSql}
        GROUP BY grid_col, grid_row
        HAVING count > 0
    ";

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        fail(500, 'Query preparation failed: ' . $mysqli->error);
    }

    function bind_params_array(mysqli_stmt $stmt, string $types, array &$params): bool
    {
        $arguments = [$types];
        foreach ($params as $k => $v) {
            $arguments[] = &$params[$k];
        }
        return call_user_func_array([$stmt, 'bind_param'], $arguments);
    }

    // Bind: grid params first, then filter params
    $bindTypes = 'dd' . $types;
    $bindParams = array_merge([$gridSize, $gridSize], $params);
    bind_params_array($stmt, $bindTypes, $bindParams);
    $stmt->execute();
    $result = $stmt->get_result();

    $clusters = [];
    $totalCount = 0;
    while ($row = $result->fetch_assoc()) {
        $count = (int)$row['count'];
        $totalCount += $count;
        
        // Format label (1000 → 1k, 1000000 → 1m)
        if ($count >= 1000000) {
            $value = $count / 1000000;
            $label = ($value >= 10 ? round($value) : round($value * 10) / 10) . 'm';
        } elseif ($count >= 1000) {
            $value = $count / 1000;
            $label = ($value >= 10 ? round($value) : round($value * 10) / 10) . 'k';
        } else {
            $label = (string)$count;
        }

        $clusters[] = [
            'lng' => round((float)$row['avg_lng'], 6),
            'lat' => round((float)$row['avg_lat'], 6),
            'count' => $count,
            'label' => $label
        ];
    }

    $stmt->close();

    echo json_encode([
        'success' => true,
        'clusters' => $clusters,
        'total_count' => $totalCount,
        'grid_size' => $gridSize,
        'zoom' => $zoom
    ]);

} catch (Throwable $e) {
    error_log("[get-clusters.php] Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}

