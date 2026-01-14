<?php
/**
 * get-posts.php - Fetch posts with map card data for display
 * 
 * Returns paginated posts with their associated map card data.
 * Used by post-new.js to render post cards and map markers.
 * 
 * Query Parameters:
 *   - limit (int): Max posts to return (default 50, max 200)
 *   - offset (int): Pagination offset (default 0)
 *   - bounds (string): "sw_lng,sw_lat,ne_lng,ne_lat" for map viewport filtering
 *   - subcategory_key (string): Filter by single subcategory (legacy)
 *   - subcategory_keys (string): Comma-separated subcategory_key list
 *   - keyword (string): Keyword filter (matches title/description/venue/city/checkout_title)
 *   - min_price (number): Min price filter (ticket/item pricing)
 *   - max_price (number): Max price filter (ticket/item pricing)
 *   - date_start (YYYY-MM-DD): Session date range start
 *   - date_end (YYYY-MM-DD): Session date range end
 *   - expired (0/1): Include expired posts
 *   - visibility (string): Filter by visibility status (default: active)
 * 
 * Response:
 *   {
 *     success: true,
 *     posts: [...],
 *     total: int,
 *     limit: int,
 *     offset: int
 *   }
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

function bind_params_array(mysqli_stmt $stmt, string $types, array &$params): bool
{
    if ($types === '') return true;
    $arguments = [$types];
    foreach ($params as $k => $v) {
        $arguments[] = &$params[$k];
    }
    return call_user_func_array([$stmt, 'bind_param'], $arguments);
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        fail(405, 'Method not allowed');
    }

    // Load database config
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

    // Parse query parameters
    $limit = isset($_GET['limit']) ? min(200, max(1, intval($_GET['limit']))) : 50;
    $offset = isset($_GET['offset']) ? max(0, intval($_GET['offset'])) : 0;
    $subcategoryKey = isset($_GET['subcategory_key']) ? trim($_GET['subcategory_key']) : '';
    $subcategoryKeys = [];
    if (!empty($_GET['subcategory_keys'])) {
        $raw = explode(',', (string)$_GET['subcategory_keys']);
        foreach ($raw as $k) {
            $k = trim($k);
            if ($k !== '') $subcategoryKeys[] = $k;
        }
    }
    $keyword = isset($_GET['keyword']) ? trim((string)$_GET['keyword']) : '';
    $minPrice = isset($_GET['min_price']) && $_GET['min_price'] !== '' ? floatval($_GET['min_price']) : null;
    $maxPrice = isset($_GET['max_price']) && $_GET['max_price'] !== '' ? floatval($_GET['max_price']) : null;
    $dateStart = isset($_GET['date_start']) ? trim((string)$_GET['date_start']) : '';
    $dateEnd = isset($_GET['date_end']) ? trim((string)$_GET['date_end']) : '';
    $includeExpired = isset($_GET['expired']) && ((string)$_GET['expired'] === '1' || (string)$_GET['expired'] === 'true');
    $visibility = isset($_GET['visibility']) ? trim($_GET['visibility']) : 'active';
    $postId = isset($_GET['post_id']) ? intval($_GET['post_id']) : 0;
    $postKey = isset($_GET['post_key']) ? trim((string)$_GET['post_key']) : '';
    
    // Parse bounds for map viewport filtering (sw_lng,sw_lat,ne_lng,ne_lat)
    $bounds = null;
    if (!empty($_GET['bounds'])) {
        $parts = explode(',', $_GET['bounds']);
        if (count($parts) === 4) {
            $bounds = [
                'sw_lng' => floatval($parts[0]),
                'sw_lat' => floatval($parts[1]),
                'ne_lng' => floatval($parts[2]),
                'ne_lat' => floatval($parts[3]),
            ];
        }
    }

    // Build WHERE conditions
    $where = ['p.deleted_at IS NULL'];
    $params = [];
    $types = '';

    // Visibility filter (expired toggle can widen this)
    if ($includeExpired) {
        $where[] = 'p.visibility IN (?, ?)';
        $params[] = 'active';
        $params[] = 'expired';
        $types .= 'ss';
    } elseif ($visibility !== '' && $visibility !== 'all') {
        $where[] = 'p.visibility = ?';
        $params[] = $visibility;
        $types .= 's';
    }

    // Payment status (only show paid posts to public)
    $where[] = 'p.payment_status = ?';
    $params[] = 'paid';
    $types .= 's';

    // Moderation status (only show clean or pending posts)
    $where[] = 'p.moderation_status IN (?, ?)';
    $params[] = 'clean';
    $params[] = 'pending';
    $types .= 'ss';

    // Subcategory filters
    if ($subcategoryKey !== '') {
        $where[] = 'p.subcategory_key = ?';
        $params[] = $subcategoryKey;
        $types .= 's';
    } elseif (!empty($subcategoryKeys)) {
        $placeholders = implode(',', array_fill(0, count($subcategoryKeys), '?'));
        $where[] = "p.subcategory_key IN ($placeholders)";
        foreach ($subcategoryKeys as $k) {
            $params[] = $k;
            $types .= 's';
        }
    }

    // Keyword filter (map card + checkout title)
    if ($keyword !== '') {
        $kw = '%' . $keyword . '%';
        $where[] = '(mc.title LIKE ? OR mc.description LIKE ? OR mc.venue_name LIKE ? OR mc.city LIKE ? OR p.checkout_title LIKE ?)';
        $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw; $params[] = $kw;
        $types .= 'sssss';
    }

    // Date range filter (correct: uses post_sessions)
    if ($dateStart !== '' || $dateEnd !== '') {
        $start = $dateStart !== '' ? $dateStart : $dateEnd;
        $end = $dateEnd !== '' ? $dateEnd : $dateStart;
        if ($start === '' || $end === '') { $start = $start ?: $end; $end = $start; }
        $where[] = 'EXISTS (SELECT 1 FROM post_sessions ps WHERE ps.map_card_id = mc.id AND ps.session_date BETWEEN ? AND ?)';
        $params[] = $start;
        $params[] = $end;
        $types .= 'ss';
    }

    // Price range filter (correct: uses pricing tables)
    if ($minPrice !== null || $maxPrice !== null) {
        if ($minPrice !== null && $maxPrice !== null) {
            $where[] = '(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.map_card_id = mc.id AND tp.price BETWEEN ? AND ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.map_card_id = mc.id AND ip.item_price BETWEEN ? AND ?))';
            $params[] = $minPrice; $params[] = $maxPrice; $params[] = $minPrice; $params[] = $maxPrice;
            $types .= 'dddd';
        } elseif ($minPrice !== null) {
            $where[] = '(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.map_card_id = mc.id AND tp.price >= ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.map_card_id = mc.id AND ip.item_price >= ?))';
            $params[] = $minPrice; $params[] = $minPrice;
            $types .= 'dd';
        } elseif ($maxPrice !== null) {
            $where[] = '(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.map_card_id = mc.id AND tp.price <= ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.map_card_id = mc.id AND ip.item_price <= ?))';
            $params[] = $maxPrice; $params[] = $maxPrice;
            $types .= 'dd';
        }
    }

    // Single post by ID filter
    if ($postId > 0) {
        $where[] = 'p.id = ?';
        $params[] = $postId;
        $types .= 'i';
    }

    // Single post by key filter
    if ($postKey !== '') {
        $where[] = 'p.post_key = ?';
        $params[] = $postKey;
        $types .= 's';
    }

    // Bounds filter (for map viewport)
    if ($bounds !== null) {
        $where[] = 'mc.latitude BETWEEN ? AND ?';
        $where[] = 'mc.longitude BETWEEN ? AND ?';
        $params[] = $bounds['sw_lat'];
        $params[] = $bounds['ne_lat'];
        $params[] = $bounds['sw_lng'];
        $params[] = $bounds['ne_lng'];
        $types .= 'dddd';
    }

    $whereClause = implode(' AND ', $where);

    // Count total matching posts
    $countSql = "
        SELECT COUNT(DISTINCT p.id) as total
        FROM `posts` p
        LEFT JOIN `post_map_cards` mc ON mc.post_id = p.id
        WHERE {$whereClause}
    ";

    $countStmt = $mysqli->prepare($countSql);
    if (!$countStmt) {
        fail(500, 'Failed to prepare count query.');
    }

    if (!empty($params)) {
        $paramsBind = $params;
        bind_params_array($countStmt, $types, $paramsBind);
    }

    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $total = $countResult ? (int)$countResult->fetch_assoc()['total'] : 0;
    $countStmt->close();

    // Fetch folder_category_icons from admin_settings for subcategory icon URLs
    $folderCategoryIcons = '';
    $folderStmt = $mysqli->prepare("SELECT setting_value FROM admin_settings WHERE setting_key = 'folder_category_icons' LIMIT 1");
    if ($folderStmt) {
        $folderStmt->execute();
        $folderResult = $folderStmt->get_result();
        if ($folderRow = $folderResult->fetch_assoc()) {
            $folderCategoryIcons = $folderRow['setting_value'] ?? '';
        }
        $folderStmt->close();
    }

    // Fetch posts with map card data and subcategory icon
    $sql = "
        SELECT 
            p.id,
            p.post_key,
            p.member_id,
            p.member_name,
            a.avatar_file AS admin_avatar_file,
            m.avatar_file AS member_avatar_file,
            p.subcategory_key,
            p.loc_qty,
            p.visibility,
            p.checkout_title,
            p.expires_at,
            p.created_at,
            sc.icon_path AS subcategory_icon_path,
            mc.id AS map_card_id,
            mc.title,
            mc.description,
            mc.media_ids,
            mc.custom_text,
            mc.custom_textarea,
            mc.custom_dropdown,
            mc.custom_checklist,
            mc.custom_radio,
            mc.public_email,
            mc.phone_prefix,
            mc.public_phone,
            mc.venue_name,
            mc.address_line,
            mc.city,
            mc.latitude,
            mc.longitude,
            mc.country_code,
            mc.amenity_summary,
            mc.website_url,
            mc.tickets_url,
            mc.coupon_code,
            mc.session_summary,
            mc.price_summary
        FROM `posts` p
        LEFT JOIN `admins` a ON a.id = p.member_id AND a.username = p.member_name
        LEFT JOIN `members` m ON m.id = p.member_id AND m.username = p.member_name
        LEFT JOIN `subcategories` sc ON sc.subcategory_key = p.subcategory_key
        LEFT JOIN `post_map_cards` mc ON mc.post_id = p.id
        WHERE {$whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    ";

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        fail(500, 'Failed to prepare posts query.');
    }

    // Add limit and offset to params
    $params[] = $limit;
    $params[] = $offset;
    $types .= 'ii';

    $paramsBind2 = $params;
    bind_params_array($stmt, $types, $paramsBind2);
    $stmt->execute();
    $result = $stmt->get_result();

    // Group results by post (a post can have multiple map cards)
    $postsById = [];
    $allMediaIds = []; // Collect all media IDs for batch lookup
    
    while ($row = $result->fetch_assoc()) {
        $postId = (int)$row['id'];
        
        if (!isset($postsById[$postId])) {
            // Build subcategory icon URL from folder + icon_path
            $subcategoryIconUrl = '';
            if (!empty($folderCategoryIcons) && !empty($row['subcategory_icon_path'])) {
                $subcategoryIconUrl = $folderCategoryIcons . '/' . $row['subcategory_icon_path'];
            }
            
            $postsById[$postId] = [
                'id' => $postId,
                'post_key' => $row['post_key'],
                'member_id' => (int)$row['member_id'],
                'member_name' => $row['member_name'],
                // Avatar is stored as filename (preferred) or empty string.
                // Resolve to a URL client-side using folder_avatars / folder_site_avatars.
                'member_avatar' => (string)($row['admin_avatar_file'] ?? $row['member_avatar_file'] ?? ''),
                'subcategory_key' => $row['subcategory_key'],
                'subcategory_icon_url' => $subcategoryIconUrl,
                'loc_qty' => (int)$row['loc_qty'],
                'visibility' => $row['visibility'],
                'checkout_title' => $row['checkout_title'],
                'expires_at' => $row['expires_at'],
                'created_at' => $row['created_at'],
                'map_cards' => [],
            ];
        }

        // Add map card if present
        if ($row['map_card_id'] !== null) {
            $mediaIds = $row['media_ids'];
            
            // Collect media IDs for batch lookup
            if (!empty($mediaIds)) {
                $ids = array_filter(array_map('intval', explode(',', $mediaIds)));
                $allMediaIds = array_merge($allMediaIds, $ids);
            }
            
            $postsById[$postId]['map_cards'][] = [
                'id' => (int)$row['map_card_id'],
                'title' => $row['title'],
                'description' => $row['description'],
                'media_ids' => $mediaIds,
                'custom_text' => $row['custom_text'],
                'custom_textarea' => $row['custom_textarea'],
                'custom_dropdown' => $row['custom_dropdown'],
                'custom_checklist' => $row['custom_checklist'],
                'custom_radio' => $row['custom_radio'],
                'public_email' => $row['public_email'],
                'phone_prefix' => $row['phone_prefix'],
                'public_phone' => $row['public_phone'],
                'venue_name' => $row['venue_name'],
                'address_line' => $row['address_line'],
                'city' => $row['city'],
                'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
                'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
                'country_code' => $row['country_code'],
                'amenities' => $row['amenity_summary'],
                'website_url' => $row['website_url'],
                'tickets_url' => $row['tickets_url'],
                'coupon_code' => $row['coupon_code'],
                'session_summary' => $row['session_summary'],
                'price_summary' => $row['price_summary'],
                'media_urls' => [], // Will be populated below
            ];
        }
    }

    $stmt->close();

    // Batch lookup media URLs with crop settings
    $mediaUrlsById = [];
    if (!empty($allMediaIds)) {
        $allMediaIds = array_unique($allMediaIds);
        $placeholders = implode(',', array_fill(0, count($allMediaIds), '?'));
        $mediaStmt = $mysqli->prepare("SELECT id, file_url, settings_json FROM `post_media` WHERE id IN ($placeholders) AND deleted_at IS NULL");
        if ($mediaStmt) {
            $types = str_repeat('i', count($allMediaIds));
            $mediaBind = $allMediaIds;
            bind_params_array($mediaStmt, $types, $mediaBind);
            $mediaStmt->execute();
            $mediaResult = $mediaStmt->get_result();
            while ($mediaRow = $mediaResult->fetch_assoc()) {
                $url = $mediaRow['file_url'];
                // Append crop parameters if settings_json contains crop data
                if (!empty($mediaRow['settings_json'])) {
                    $settings = json_decode($mediaRow['settings_json'], true);
                    if (is_array($settings) && !empty($settings['crop'])) {
                        $crop = $settings['crop'];
                        if (isset($crop['x1'], $crop['y1'], $crop['x2'], $crop['y2'])) {
                            $cropParam = intval($crop['x1']) . ',' . intval($crop['y1']) . ',' . intval($crop['x2']) . ',' . intval($crop['y2']);
                            $url .= (strpos($url, '?') === false ? '?' : '&') . 'crop=' . $cropParam;
                        }
                    }
                }
                $mediaUrlsById[(int)$mediaRow['id']] = $url;
            }
            $mediaStmt->close();
        }
    }

    // Attach media URLs to map cards
    foreach ($postsById as &$post) {
        foreach ($post['map_cards'] as &$mapCard) {
            if (!empty($mapCard['media_ids'])) {
                $ids = array_filter(array_map('intval', explode(',', $mapCard['media_ids'])));
                $urls = [];
                foreach ($ids as $mediaId) {
                    if (isset($mediaUrlsById[$mediaId])) {
                        $urls[] = $mediaUrlsById[$mediaId];
                    }
                }
                $mapCard['media_urls'] = $urls;
            }
        }
    }
    unset($post, $mapCard);

    // Convert to array
    $posts = array_values($postsById);

    echo json_encode([
        'success' => true,
        'posts' => $posts,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
    ], JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    fail(500, 'Server error.');
}

