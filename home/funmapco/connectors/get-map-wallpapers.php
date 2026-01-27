<?php
/**
 * get-map-wallpapers.php
 * Fetches pre-generated map wallpaper URLs by coordinates.
 * Used by LocationWallpaperComponent for form/profile contexts where
 * library_wallpapers aren't passed from the post payload.
 */
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

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
    throw new RuntimeException('Database configuration file is missing.');
}

require_once $configPath;

require '../config/config-auth.php';
header('Content-Type: application/json');

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
    http_response_code(403);
    exit(json_encode(['success' => false, 'error' => 'Forbidden']));
}

// Get lat/lng from query params
$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;

if ($lat === null || $lng === null) {
    exit(json_encode(['success' => false, 'error' => 'Missing lat/lng parameters']));
}

// Query map_images table for wallpapers at this coordinate
$stmt = $mysqli->prepare("SELECT bearing, file_url FROM map_images WHERE latitude = ? AND longitude = ?");
$stmt->bind_param('dd', $lat, $lng);
$stmt->execute();
$result = $stmt->get_result();

$wallpapers = [];
while ($row = $result->fetch_assoc()) {
    $wallpapers[(int)$row['bearing']] = $row['file_url'];
}
$stmt->close();

echo json_encode([
    'success' => true,
    'wallpapers' => $wallpapers
]);
?>
