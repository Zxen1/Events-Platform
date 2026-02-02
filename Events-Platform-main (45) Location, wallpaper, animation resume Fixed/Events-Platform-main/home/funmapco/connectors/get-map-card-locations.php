<?php
/**
 * get-map-card-locations.php
 * 
 * Returns unique lat/lng/location_type combinations from post_map_cards
 * for bulk wallpaper image generation.
 */

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

header('Content-Type: application/json');

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
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database configuration file is missing.']);
    exit;
}

require_once $configPath;

try {
    // Get unique lat/lng combinations from post_map_cards
    // location_type is read directly from the column
    $sql = "SELECT DISTINCT 
                latitude,
                longitude,
                location_type
            FROM post_map_cards 
            WHERE latitude IS NOT NULL 
              AND longitude IS NOT NULL 
              AND latitude != 0 
              AND longitude != 0
            ORDER BY latitude, longitude";
    
    $result = $mysqli->query($sql);
    
    if (!$result) {
        throw new Exception('Query failed: ' . $mysqli->error);
    }
    
    $locations = [];
    while ($row = $result->fetch_assoc()) {
        $locations[] = [
            'latitude' => (float)$row['latitude'],
            'longitude' => (float)$row['longitude'],
            'location_type' => $row['location_type']
        ];
    }
    $result->free();
    
    echo json_encode([
        'success' => true,
        'count' => count($locations),
        'locations' => $locations
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
