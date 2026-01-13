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
    // Only include visible posts (active visibility, clean moderation, paid payment)
    $sql = "
        SELECT 
            FLOOR((pmc.longitude + 180) / ?) AS grid_col,
            FLOOR((LEAST(GREATEST(pmc.latitude, -85), 85) + 90) / ?) AS grid_row,
            COUNT(*) AS count,
            AVG(pmc.longitude) AS avg_lng,
            AVG(LEAST(GREATEST(pmc.latitude, -85), 85)) AS avg_lat
        FROM post_map_cards pmc
        INNER JOIN posts p ON pmc.post_id = p.id
        WHERE p.visibility = 'active'
          AND p.moderation_status = 'clean'
          AND p.payment_status = 'paid'
        GROUP BY grid_col, grid_row
        HAVING count > 0
    ";

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        fail(500, 'Query preparation failed: ' . $mysqli->error);
    }

    $stmt->bind_param('dd', $gridSize, $gridSize);
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

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Server error']);
}

