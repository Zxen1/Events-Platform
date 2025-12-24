<?php
// connectors/add-member.php — safe version
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

$display = trim($_POST['display_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$pass = $_POST['password'] ?? '';
$conf = $_POST['confirm'] ?? '';
$avatar = trim($_POST['avatar_file'] ?? '');
// Optional uploaded avatar file (cropped client-side); only upload after member is created
$hasAvatarFile = isset($_FILES['avatar_file']) && isset($_FILES['avatar_file']['tmp_name']) && is_uploaded_file($_FILES['avatar_file']['tmp_name']);

if($display===''||$email===''||$pass==='') fail(400,'Missing required fields');
if(!filter_var($email,FILTER_VALIDATE_EMAIL)) fail(400,'Invalid email address');
if($pass!==$conf) fail(400,'Passwords do not match');

$hash = password_hash($pass, PASSWORD_BCRYPT);
if(!$hash) fail(500,'Hash failed');

$stmt = $mysqli->prepare('SELECT id FROM members WHERE email=? LIMIT 1');
if(!$stmt) fail(500,'Prepare failed (check query)');
$stmt->bind_param('s',$email);
$stmt->execute();
$stmt->store_result();
if($stmt->num_rows>0){$stmt->close();fail(409,'Email already registered');}
$stmt->close();

$insert = $mysqli->prepare('INSERT INTO members (email,password_hash,display_name,avatar_file,created_at) VALUES (?,?,?,?,NOW())');
if(!$insert) fail(500,'Insert prepare failed');
$insert->bind_param('ssss',$email,$hash,$display,$avatar);
if(!$insert->execute()){ $insert->close(); fail(500,'Database insert failed'); }
$id = $insert->insert_id;
$insert->close();

// If avatar_file is present, upload to Bunny now (final filename), then update member row
if ($hasAvatarFile) {
  // Get avatar folder and Bunny Storage credentials from admin settings
  $stmt = $mysqli->prepare("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('folder_avatars', 'storage_api_key', 'storage_zone_name')");
  if(!$stmt) { $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1'); fail(500,'Failed to get settings'); }
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

  if (!$storageApiKey || !$storageZoneName) {
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(500, 'Avatar storage not configured. Bunny Storage credentials missing (storage_api_key / storage_zone_name).');
  }

  $originalName = $_FILES['avatar_file']['name'] ?? 'avatar.png';
  $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
  if ($ext === '') $ext = 'png';
  $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if(!in_array($ext, $allowedExts)) {
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(400, 'Invalid avatar file type. Allowed: JPG, PNG, GIF, WebP');
  }

  // Extract folder path from CDN URL
  $cdnPath = preg_replace('#^https?://[^/]+/#', '', $avatarFolder);
  $cdnPath = rtrim($cdnPath, '/');

  $finalFilename = $id . '-avatar.' . $ext;
  $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $cdnPath . '/' . $finalFilename;
  $fileContent = file_get_contents($_FILES['avatar_file']['tmp_name']);

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
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(500, 'Bunny Storage upload error: ' . $curlError);
  }
  if($httpCode !== 201 && $httpCode !== 200) {
    $snippet = is_string($response) ? substr($response, 0, 200) : '';
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(500, 'Bunny Storage returned error code: ' . $httpCode . ($snippet ? (' ' . $snippet) : ''));
  }

  // Store filename only (rules convention)
  $avatarFile = $finalFilename;
  $up = $mysqli->prepare('UPDATE members SET avatar_file=? WHERE id=? LIMIT 1');
  if ($up) {
    $up->bind_param('si', $avatarFile, $id);
    $up->execute();
    $up->close();
  }

  ok(['id'=>$id,'display_name'=>$display,'email'=>$email,'avatar_file'=>$avatarFile]);
}

ok(['id'=>$id,'display_name'=>$display,'email'=>$email,'avatar_file'=>$avatar]);
?>