<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}
// connectors/upload-avatar.php — upload avatar file for member registration
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

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

function fail($code, $msg){http_response_code($code);echo json_encode(['success'=>false,'error'=>$msg]);exit;}
function ok($data=[]){echo json_encode(array_merge(['success'=>true],$data));exit;}

if($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'Method not allowed');

if(empty($_FILES['file']['name'])) fail(400,'No file uploaded');

// Get avatar folder and Bunny Storage credentials from admin settings
$stmt = $mysqli->prepare("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('folder_avatars', 'storage_api_key', 'storage_zone_name')");
if(!$stmt) fail(500,'Failed to get settings');
$stmt->execute();
$result = $stmt->get_result();
$avatarFolder = 'https://cdn.funmap.com/avatars/';
$storageApiKey = '';
$storageZoneName = '';
while($row = $result->fetch_assoc()) {
  if($row['setting_key'] === 'folder_avatars') {
    $avatarFolder = $row['setting_value'];
    if(substr($avatarFolder, -1) !== '/') $avatarFolder .= '/';
  } elseif($row['setting_key'] === 'storage_api_key') {
    $storageApiKey = trim($row['setting_value']);
  } elseif($row['setting_key'] === 'storage_zone_name') {
    $storageZoneName = trim($row['setting_value']);
  }
}
$stmt->close();

// Require final naming (no temp uploads)
$userId = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
if ($userId <= 0) {
  fail(400, 'Missing user_id');
}

$originalName = $_FILES['file']['name'];
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
if(!in_array($ext, $allowedExts)) {
  fail(400, 'Invalid file type. Allowed: JPG, PNG, GIF, WebP');
}

// Stable filename (overwrite on update)
// Naming convention (rules file): {memberId}-avatar.{extension}
$finalFilename = $userId . '-avatar.' . $ext;

// Basic size guard (10MB)
$maxBytes = 10 * 1024 * 1024;
if (isset($_FILES['file']['size']) && (int)$_FILES['file']['size'] > $maxBytes) {
  fail(400, 'File too large. Max 10MB');
}

// Determine storage type: external (http/https) or local
$isExternal = preg_match('#^https?://#i', $avatarFolder);

$fileContent = file_get_contents($_FILES['file']['tmp_name']);
if ($fileContent === false) {
  fail(500, 'Failed to read uploaded file.');
}

if ($isExternal) {
  // External storage (Bunny CDN)
  if (!$storageApiKey || !$storageZoneName) {
    fail(500, 'Storage credentials not configured for external storage (storage_api_key / storage_zone_name).');
  }
  
  // Extract folder path from CDN URL (e.g., https://cdn.funmap.com/avatars -> avatars)
  $cdnPath = preg_replace('#^https?://[^/]+/#', '', $avatarFolder);
  $cdnPath = rtrim($cdnPath, '/');
  
  $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $cdnPath . '/' . $finalFilename;
  
  $ch = curl_init($apiUrl);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
  curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'AccessKey: ' . $storageApiKey
  ]);
  
  $response = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlError = curl_error($ch);
  curl_close($ch);
  
  if($curlError !== '') {
    fail(500, 'Storage upload error: ' . $curlError);
  }
  
  if($httpCode !== 201 && $httpCode !== 200) {
    $snippet = is_string($response) ? substr($response, 0, 200) : '';
    fail(500, 'Storage returned error code: ' . $httpCode . ($snippet ? (' ' . $snippet) : ''));
  }
  
  $avatarUrl = rtrim($avatarFolder, '/') . '/' . $finalFilename;
} else {
  // Local storage
  $localBasePath = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . '/' . ltrim(rtrim($avatarFolder, '/'), '/');
  
  // Create directory if it doesn't exist
  if (!is_dir($localBasePath)) {
    if (!mkdir($localBasePath, 0755, true)) {
      fail(500, 'Failed to create local directory: ' . $localBasePath);
    }
  }
  
  $localPath = $localBasePath . '/' . $finalFilename;
  if (file_put_contents($localPath, $fileContent) === false) {
    fail(500, 'Failed to save file locally.');
  }
  
  $avatarUrl = '/' . ltrim(rtrim($avatarFolder, '/'), '/') . '/' . $finalFilename;
}

ok(['url'=>$avatarUrl,'filename'=>$finalFilename]);
?>

