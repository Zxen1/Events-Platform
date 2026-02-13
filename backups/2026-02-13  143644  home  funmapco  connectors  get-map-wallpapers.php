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

header('Content-Type: application/json');

// ============================================================================
// POST = Self-healing upload (browser captured missing wallpapers, uploading them)
// GET  = Read wallpapers for coordinates
// ============================================================================

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // --- Storage helper functions (same as add-post.php) ---
    function load_storage_settings(mysqli $mysqli): array
    {
        $out = [
            'folder_map_images' => '',
            'storage_api_key' => '',
            'storage_zone_name' => '',
        ];
        $res = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('folder_map_images','storage_api_key','storage_zone_name')");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $k = $row['setting_key'] ?? '';
                $v = isset($row['setting_value']) ? trim((string)$row['setting_value']) : '';
                if (array_key_exists($k, $out)) {
                    $out[$k] = $v;
                }
            }
            $res->free();
        }
        return $out;
    }

    function storage_upload_bytes(string $storageApiKey, string $storageZoneName, string $fullPath, string $bytes, int &$httpCodeOut, string &$respOut): bool
    {
        $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . ltrim($fullPath, '/');
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS => $bytes,
            CURLOPT_HTTPHEADER => [
                'AccessKey: ' . $storageApiKey,
                'Content-Type: application/octet-stream',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
        ]);
        $resp = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $httpCodeOut = $httpCode;
        $respOut = is_string($resp) ? $resp : '';
        return ($httpCode >= 200 && $httpCode < 300);
    }

    // --- Validate request ---
    if (empty($_FILES['map_images']) || !is_array($_FILES['map_images']['name'])) {
        exit(json_encode(['success' => false, 'error' => 'No images provided']));
    }

    $mapMeta = [];
    if (!empty($_POST['map_images_meta'])) {
        $mm = json_decode((string)$_POST['map_images_meta'], true);
        if (is_array($mm)) $mapMeta = $mm;
    }

    // --- Load storage settings from admin_settings ---
    $settings = load_storage_settings($mysqli);
    $mapFolder = rtrim((string)$settings['folder_map_images'], '/');
    if ($mapFolder === '') {
        exit(json_encode(['success' => false, 'error' => 'Map images folder not configured']));
    }

    $mapIsExternal = preg_match('#^https?://#i', $mapFolder);
    if (!$mapIsExternal) {
        exit(json_encode(['success' => false, 'error' => 'Only external storage is supported']));
    }

    $storageApiKey = (string)$settings['storage_api_key'];
    $storageZoneName = (string)$settings['storage_zone_name'];
    if ($storageApiKey === '' || $storageZoneName === '') {
        exit(json_encode(['success' => false, 'error' => 'Storage credentials not configured']));
    }

    $mapCdnPath = preg_replace('#^https?://[^/]+/#', '', $mapFolder);
    $mapCdnPath = rtrim((string)$mapCdnPath, '/');

    $validBearings = [0, 90, 180, 270];
    $mapCount = count($_FILES['map_images']['name']);
    $uploaded = 0;
    $skipped = 0;

    for ($i = 0; $i < $mapCount; $i++) {
        $tmpFile = $_FILES['map_images']['tmp_name'][$i] ?? '';
        if (!$tmpFile || !is_uploaded_file($tmpFile)) continue;

        // Validate metadata
        $lat = isset($mapMeta[$i]['lat']) ? (float)$mapMeta[$i]['lat'] : null;
        $lng = isset($mapMeta[$i]['lng']) ? (float)$mapMeta[$i]['lng'] : null;
        $bearing = isset($mapMeta[$i]['bearing']) ? (int)$mapMeta[$i]['bearing'] : null;

        if ($lat === null || $lng === null || $bearing === null) continue;
        if (!in_array($bearing, $validBearings, true)) continue;

        // Validate file is WebP
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($tmpFile);
        if ($mimeType !== 'image/webp') continue;

        // Only add, never replace — check if this image already exists
        $checkStmt = $mysqli->prepare("SELECT file_url FROM map_images WHERE latitude = ? AND longitude = ? AND bearing = ?");
        if (!$checkStmt) continue;
        $checkStmt->bind_param('ddi', $lat, $lng, $bearing);
        $checkStmt->execute();
        $checkStmt->bind_result($existingUrl);
        $foundExisting = $checkStmt->fetch();
        $checkStmt->close();

        if ($foundExisting && $existingUrl) {
            // Verify file actually exists at the URL
            $ch = curl_init($existingUrl);
            curl_setopt($ch, CURLOPT_NOBODY, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode >= 200 && $httpCode < 400) {
                $skipped++;
                continue; // File exists, skip
            } else {
                // DB record exists but file missing — delete orphan
                $delStmt = $mysqli->prepare("DELETE FROM map_images WHERE latitude = ? AND longitude = ? AND bearing = ?");
                if ($delStmt) {
                    $delStmt->bind_param('ddi', $lat, $lng, $bearing);
                    $delStmt->execute();
                    $delStmt->close();
                }
            }
        }

        // Use client filename if valid, otherwise generate
        $origName = (string)($_FILES['map_images']['name'][$i] ?? '');
        if (preg_match('/^[a-z0-9-]+__-?\d+\.\d+_-?\d+\.\d+__Z\d+-P\d+-[NESW]\.webp$/i', $origName)) {
            $filename = $origName;
        } else {
            $bearingMap = [0 => 'N', 90 => 'E', 180 => 'S', 270 => 'W'];
            $dir = $bearingMap[$bearing] ?? 'N';
            $filename = 'location__' . number_format($lat, 6, '.', '') . '_' . number_format($lng, 6, '.', '') . '__Z18-P75-' . $dir . '.webp';
        }

        $bytes = file_get_contents($tmpFile);
        if ($bytes === false) continue;

        $imageInfo = @getimagesize($tmpFile);
        $width = ($imageInfo && isset($imageInfo[0])) ? (int)$imageInfo[0] : 600;
        $height = ($imageInfo && isset($imageInfo[1])) ? (int)$imageInfo[1] : 2500;

        $fullPath = $mapCdnPath . '/' . $filename;
        $httpCode = 0;
        $resp = '';
        if (storage_upload_bytes($storageApiKey, $storageZoneName, $fullPath, $bytes, $httpCode, $resp)) {
            $publicUrl = $mapFolder . '/' . $filename;
            $fileSize = (int)($_FILES['map_images']['size'][$i] ?? strlen($bytes));
            $locationType = 'post';
            $pitch = 75;
            $zoom = 18;

            $insStmt = $mysqli->prepare("INSERT INTO map_images (latitude, longitude, location_type, bearing, pitch, zoom, width, height, file_size, file_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            if ($insStmt) {
                $insStmt->bind_param('ddsiiiiiis', $lat, $lng, $locationType, $bearing, $pitch, $zoom, $width, $height, $fileSize, $publicUrl);
                $insStmt->execute();
                $insStmt->close();
            }
            $uploaded++;
        }
    }

    echo json_encode(['success' => true, 'uploaded' => $uploaded, 'skipped' => $skipped]);
    exit;
}

// ============================================================================
// GET = Read wallpapers for coordinates
// ============================================================================

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
