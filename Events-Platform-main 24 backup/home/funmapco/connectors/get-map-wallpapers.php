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

    // --- Filename helpers ---
    function slugify_venue(string $text): string {
        $s = mb_strtolower($text, 'UTF-8');
        $s = preg_replace('/[^\p{L}\p{N}]+/u', '-', $s);
        $s = preg_replace('/-+/', '-', $s);
        $s = trim($s, '-');
        return mb_substr($s, 0, 50, 'UTF-8');
    }

    function format_map_coord(float $v): string {
        return rtrim(rtrim(sprintf('%.10f', $v), '0'), '.');
    }

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
            if (remote_file_exists($existingUrl)) {
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

        // location_type is sent by the client (which knows it from the post form DOM)
        // This avoids ambiguity when multiple post_map_cards share the same coordinates
        $locationType = isset($mapMeta[$i]['location_type']) ? (string)$mapMeta[$i]['location_type'] : '';
        if ($locationType === '') {
            $skipped++;
            continue;
        }

        // Build canonical filename from venue name in post_map_cards + exact coordinates
        $vnStmt = $mysqli->prepare("SELECT venue_name, address_line, city, suburb, state, country_name FROM post_map_cards WHERE latitude = ? AND longitude = ? AND location_type = ? LIMIT 1");
        $rawVenueName = '';
        if ($vnStmt) {
            $vnStmt->bind_param('dds', $lat, $lng, $locationType);
            $vnStmt->execute();
            $vnRow = $vnStmt->get_result()->fetch_assoc();
            $vnStmt->close();
            if ($vnRow) {
                $rawVenueName = $vnRow['venue_name']   ?? '';
                if ($rawVenueName === '') $rawVenueName = $vnRow['address_line'] ?? '';
                if ($rawVenueName === '') $rawVenueName = $vnRow['city']         ?? '';
                if ($rawVenueName === '') $rawVenueName = $vnRow['suburb']       ?? '';
                if ($rawVenueName === '') $rawVenueName = $vnRow['state']        ?? '';
                if ($rawVenueName === '') $rawVenueName = $vnRow['country_name'] ?? '';
            }
        }
        if ($rawVenueName === '') {
            $skipped++;
            continue;
        }
        $bearingDirMap = [0 => 'N', 90 => 'E', 180 => 'S', 270 => 'W'];
        $dir = $bearingDirMap[$bearing] ?? 'N';
        $coordKey = format_map_coord($lat) . '_' . format_map_coord($lng);
        $zoom = (strtolower($locationType) === 'city') ? 16 : 18;
        $filename = slugify_venue($rawVenueName) . '__' . $coordKey . '__Z' . $zoom . '-P75-' . $dir . '.webp';

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
            $pitch = 75;

            $insStmt = $mysqli->prepare("INSERT INTO map_images (latitude, longitude, location_type, bearing, pitch, zoom, width, height, file_size, file_name, file_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            if ($insStmt) {
                $insStmt->bind_param('ddsiiiiiiss', $lat, $lng, $locationType, $bearing, $pitch, $zoom, $width, $height, $fileSize, $filename, $publicUrl);
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
// GET = Read wallpapers for coordinates, OR list all locations with missing images
// ============================================================================

// ?missing=1 — return all post_map_cards locations that don't have all 4 map_images
if (!empty($_GET['missing'])) {
    $sql = "
        SELECT DISTINCT
            pmc.latitude,
            pmc.longitude,
            pmc.location_type,
            COALESCE(NULLIF(pmc.venue_name,''), NULLIF(pmc.address_line,''), NULLIF(pmc.city,''), NULLIF(pmc.suburb,''), NULLIF(pmc.state,''), NULLIF(pmc.country_name,'')) AS name
        FROM post_map_cards pmc
        WHERE (
            SELECT COUNT(*)
            FROM map_images mi
            WHERE mi.latitude = pmc.latitude
              AND mi.longitude = pmc.longitude
        ) < 4
        ORDER BY pmc.id ASC
    ";
    $res = $mysqli->query($sql);
    $locations = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $locations[] = [
                'lat'           => (float)$row['latitude'],
                'lng'           => (float)$row['longitude'],
                'location_type' => (string)$row['location_type'],
                'name'          => (string)$row['name'],
            ];
        }
        $res->free();
    }
    exit(json_encode(['success' => true, 'locations' => $locations]));
}

// Get lat/lng from query params
$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;

if ($lat === null || $lng === null) {
    exit(json_encode(['success' => false, 'error' => 'Missing lat/lng parameters']));
}

function remote_file_exists(string $url): bool
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($httpCode >= 200 && $httpCode < 400);
}

// Query map_images table for wallpapers at this coordinate
$stmt = $mysqli->prepare("SELECT id, bearing, file_url FROM map_images WHERE latitude = ? AND longitude = ?");
$stmt->bind_param('dd', $lat, $lng);
$stmt->execute();
$result = $stmt->get_result();

$wallpapers = [];
while ($row = $result->fetch_assoc()) {
    $fileUrl = (string)($row['file_url'] ?? '');
    if ($fileUrl === '') {
        continue;
    }
    $wallpapers[(int)$row['bearing']] = $fileUrl;
}
$stmt->close();

echo json_encode([
    'success' => true,
    'wallpapers' => $wallpapers
]);
?>
