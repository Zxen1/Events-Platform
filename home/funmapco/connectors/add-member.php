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

$username = trim($_POST['username'] ?? '');
$email = trim($_POST['email'] ?? '');
$pass = $_POST['password'] ?? '';
$conf = $_POST['confirm'] ?? '';
$avatar = trim($_POST['avatar_url'] ?? '');
$avatarFile = $_FILES['avatar_file'] ?? null;

if($username===''||$email===''||$pass==='') fail(400,'Missing required fields');
if(!filter_var($email,FILTER_VALIDATE_EMAIL)) fail(400,'Invalid email address');
if($pass!==$conf) fail(400,'Passwords do not match');

$hash = password_hash($pass, PASSWORD_BCRYPT);
if(!$hash) fail(500,'Hash failed');

// Check if email already exists
$stmt = $mysqli->prepare('SELECT id FROM members WHERE email=? LIMIT 1');
if(!$stmt) fail(500,'Prepare failed (check query)');
$stmt->bind_param('s',$email);
$stmt->execute();
$stmt->store_result();
if($stmt->num_rows>0){$stmt->close();fail(409,'Email already registered');}
$stmt->close();

// STEP 1: Insert minimal record to get permanent ID (prevents ID clashes)
$insert = $mysqli->prepare('INSERT INTO members (username,email,password_hash,created_at) VALUES (?,?,?,NOW())');
if(!$insert) fail(500,'Insert prepare failed');
$insert->bind_param('sss',$username,$email,$hash);
if(!$insert->execute()){ $insert->close(); fail(500,'Database insert failed'); }
$id = $insert->insert_id;
$insert->close();

// STEP 2: Upload avatar file directly with correct name (if file uploaded)
$finalAvatarUrl = $avatar;
if($avatarFile && !empty($avatarFile['tmp_name']) && is_uploaded_file($avatarFile['tmp_name'])) {
  // Get avatar folder and Bunny Storage credentials
  $stmt = $mysqli->prepare("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('folder_avatars', 'storage_api_key', 'storage_zone_name')");
  if($stmt) {
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
    
    // Get file extension
    $originalName = $avatarFile['name'];
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if(in_array($ext, $allowedExts)) {
      $filename = $id . '-avatar.' . $ext;
      $avatarUrl = $avatarFolder . $filename;
      
      // Extract folder path from CDN URL
      $cdnPath = preg_replace('#^https?://[^/]+/#', '', $avatarFolder);
      $cdnPath = rtrim($cdnPath, '/');
      
      if($storageApiKey && $storageZoneName) {
        // Read file content
        $fileContent = file_get_contents($avatarFile['tmp_name']);
        
        // Upload directly to Bunny Storage with correct filename
        $uploadUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $cdnPath . '/' . $filename;
        $ch = curl_init($uploadUrl);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
          'AccessKey: ' . $storageApiKey
        ]);
        curl_exec($ch);
        $uploadCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if($uploadCode === 201 || $uploadCode === 200) {
          $finalAvatarUrl = $avatarUrl;
        }
      }
    }
  }
}

// STEP 3: Update member record with final avatar URL
$update = $mysqli->prepare('UPDATE members SET avatar_url=? WHERE id=?');
if($update) {
  $update->bind_param('si', $finalAvatarUrl, $id);
  $update->execute();
  $update->close();
}

ok(['id'=>$id,'username'=>$username,'email'=>$email]);
?>