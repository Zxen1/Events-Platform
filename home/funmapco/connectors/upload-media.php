<?php
/**
 * upload-media.php
 * 
 * Uploads post media files to Bunny CDN with automatic monthly folder organization.
 * 
 * TIMEZONE: Uses UTC-12 ("the world's final timezone") to determine the current month.
 * This matches the site-wide policy for event expiry: give users the maximum benefit
 * of the doubt. The month only changes when it's the new month EVERYWHERE on Earth.
 * 
 * NAMING CONVENTION (from agent confessions.md):
 *   Pattern: {postId}-{hash}.{extension}
 *   Example: 123-a7f3b2.jpg
 * 
 * WORKFLOW (single-handling, no renaming):
 *   1. Create post record first (as draft) → get post_id
 *   2. Upload images with that post_id → correct filename from the start
 *   3. Complete form and submit → post becomes active
 * 
 * Monthly folders are created automatically by Bunny CDN when uploading.
 * Full path: folder_post_images/YYYY-MM/{postId}-{hash}.{extension}
 * 
 * POST params:
 *   - file: The uploaded file
 *   - member_id: Member ID
 *   - post_id: Post ID (REQUIRED - create draft post first)
 * 
 * Response:
 *   { success: true, url: "https://cdn.funmap.com/post-images/2025-01/123-a7f3b2.jpg", insert_id: 123 }
 */

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

// Helper function for error responses
function fail($code, $message) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
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
require '../config/config-auth.php';

header('Content-Type: application/json');

// Allow HttpOnly cookie fallback for connector auth
if (empty($_SERVER['HTTP_X_API_KEY']) && isset($_COOKIE['FUNMAP_TOKEN'])) {
    $_SERVER['HTTP_X_API_KEY'] = (string) $_COOKIE['FUNMAP_TOKEN'];
}

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
    fail(403, 'Forbidden');
}

if (empty($_FILES['file']['name'])) {
    fail(400, 'No file uploaded');
}

$member_id = intval($_POST['member_id'] ?? 0);
$post_id = intval($_POST['post_id'] ?? 0);

// Validate file type (images only)
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$mimeType = mime_content_type($_FILES['file']['tmp_name']);
if (!in_array($mimeType, $allowedTypes)) {
    fail(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
}

// Get settings from admin_settings
$settingsQuery = "SELECT setting_key, setting_value FROM admin_settings 
                  WHERE setting_key IN ('folder_post_images', 'storage_api_key', 'storage_zone_name')";
$settingsResult = $mysqli->query($settingsQuery);

$postImagesFolder = '';
$storageApiKey = '';
$storageZoneName = '';

while ($row = $settingsResult->fetch_assoc()) {
    switch ($row['setting_key']) {
        case 'folder_post_images':
            $postImagesFolder = trim($row['setting_value']);
            break;
        case 'storage_api_key':
            $storageApiKey = trim($row['setting_value']);
            break;
        case 'storage_zone_name':
            $storageZoneName = trim($row['setting_value']);
            break;
    }
}

if (empty($postImagesFolder)) {
    fail(500, 'Post images folder not configured in admin settings (folder_post_images).');
}

if (empty($storageApiKey) || empty($storageZoneName)) {
    fail(500, 'Bunny Storage credentials not configured (storage_api_key / storage_zone_name).');
}

// Calculate current month in UTC-12 (Baker Island / Howland Island)
// UTC-12 is the LAST timezone to see a day/month end - "the world's final timezone"
// This gives users the maximum benefit of the doubt:
// - A post uploaded on "December 31st" (anywhere in the world) goes into December folder
// - The month only changes when it's the new month EVERYWHERE on Earth
// This matches the event expiry logic documented in checkout_options
$utcMinus12 = new DateTimeZone('Etc/GMT+12'); // PHP uses inverted sign for Etc zones
$now = new DateTime('now', $utcMinus12);
$monthFolder = $now->format('Y-m'); // e.g., "2025-01"

// Require post_id - the post record must be created FIRST (as draft) before uploading images
// This ensures single-handling: images are named correctly from the start, no renaming needed
if ($post_id <= 0) {
    fail(400, 'post_id is required. Create the post record first (as draft), then upload images.');
}

// Generate filename following naming convention (rules file):
// Pattern: {postId}-{hash}.{extension}
// Example: 123-a7f3b2.jpg
$originalFilename = basename($_FILES['file']['name']);
$extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));

// Generate short hash for uniqueness (6 chars from md5)
$hash = substr(md5(uniqid('', true) . random_bytes(8)), 0, 6);

$finalFilename = $post_id . '-' . $hash . '.' . $extension;

// Extract CDN path from folder URL
// e.g., https://cdn.funmap.com/post-images -> post-images
$cdnPath = preg_replace('#^https?://[^/]+/#', '', $postImagesFolder);
$cdnPath = rtrim($cdnPath, '/');

// Construct full path with month folder
$fullPath = $cdnPath . '/' . $monthFolder . '/' . $finalFilename;

// Construct Bunny Storage API URL
$apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $fullPath;

// Read file content
$fileContent = file_get_contents($_FILES['file']['tmp_name']);
if ($fileContent === false) {
    fail(500, 'Failed to read uploaded file.');
}

// Upload to Bunny Storage
$ch = curl_init($apiUrl);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_POSTFIELDS => $fileContent,
    CURLOPT_HTTPHEADER => [
        'AccessKey: ' . $storageApiKey,
        'Content-Type: application/octet-stream',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    fail(500, 'Bunny Storage upload error: ' . $curlError);
}

if ($httpCode < 200 || $httpCode >= 300) {
    $snippet = substr($response, 0, 200);
    fail(500, 'Bunny Storage returned error code: ' . $httpCode . ($snippet ? (' ' . $snippet) : ''));
}

// Construct the public CDN URL
// Ensure folder URL ends with / and append month folder and filename
$publicUrl = rtrim($postImagesFolder, '/') . '/' . $monthFolder . '/' . $finalFilename;

// Get file size
$fileSize = $_FILES['file']['size'];

// Insert record into post_media table
$stmt = $mysqli->prepare("INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, created_at)
                          VALUES (?, ?, ?, ?, ?, NOW())");
$stmt->bind_param('iissi', $member_id, $post_id, $finalFilename, $publicUrl, $fileSize);

if (!$stmt->execute()) {
    // Upload succeeded but DB insert failed - log this
    error_log('[upload-media] DB insert failed: ' . $stmt->error . ' | URL: ' . $publicUrl);
    fail(500, 'Failed to save media record to database.');
}

$insertId = $stmt->insert_id;
$stmt->close();

// Success response
echo json_encode([
    'success' => true,
    'url' => $publicUrl,
    'filename' => $finalFilename,
    'month_folder' => $monthFolder,
    'insert_id' => $insertId
]);

// Optional: Log the upload
$logApiKey = defined('API_KEY') ? API_KEY : ($storageApiKey ?? '');
if ($logApiKey) {
    @file_get_contents('https://funmap.com/connectors/add-log.php', false,
        stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nX-API-Key: " . $logApiKey . "\r\n",
                'content' => json_encode([
                    'actor_type' => 'member',
                    'actor_id' => $member_id,
                    'action' => 'upload-media',
                    'description' => 'Uploaded media: ' . $publicUrl
                ])
            ]
        ])
    );
}
?>
