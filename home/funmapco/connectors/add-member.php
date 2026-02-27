<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}
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

$authCandidates = [
  __DIR__ . '/../config/config-auth.php',
  dirname(__DIR__) . '/config/config-auth.php',
  dirname(__DIR__, 2) . '/config/config-auth.php',
  dirname(__DIR__, 3) . '/../config/config-auth.php',
  dirname(__DIR__) . '/../config/config-auth.php',
  __DIR__ . '/config-auth.php',
];
$authPath = null;
foreach ($authCandidates as $candidate) {
  if (is_file($candidate)) { $authPath = $candidate; break; }
}
if ($authPath) require_once $authPath;

function fail($code, $msg){
  http_response_code($code);
  echo json_encode(['success'=>false,'message'=>$msg,'error'=>$msg], JSON_UNESCAPED_SLASHES);
  exit;
}
function fail_key($code, $messageKey){
  http_response_code($code);
  echo json_encode(['success'=>false,'message_key'=>$messageKey], JSON_UNESCAPED_SLASHES);
  exit;
}
function fail_key_ph($code, $messageKey, $placeholders){
  http_response_code($code);
  echo json_encode(['success'=>false,'message_key'=>$messageKey,'placeholders'=>$placeholders], JSON_UNESCAPED_SLASHES);
  exit;
}
function ok($data=[]){echo json_encode(array_merge(['success'=>true],$data));exit;}

function send_welcome_email($mysqli, $to_email, $to_name, $member_id, $username) {
  global $SMTP_HOST, $SMTP_USERNAME, $SMTP_PASSWORD;
  $msgKey = 'msg_email_welcome';
  $logFailed = function() use ($mysqli, $member_id, $username, $msgKey, $to_email) {
    $l = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status) VALUES (?, ?, ?, ?, ?)');
    if ($l) { $s = 'failed'; $l->bind_param('issss', $member_id, $username, $msgKey, $to_email, $s); $l->execute(); $l->close(); }
  };
  $stmt = $mysqli->prepare(
    "SELECT message_name, message_text, supports_html FROM admin_messages
     WHERE message_key = 'msg_email_welcome' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1"
  );
  if (!$stmt) { $logFailed(); return; }
  $stmt->execute();
  $result = $stmt->get_result();
  $template = $result->fetch_assoc();
  $stmt->close();
  if (!$template) { $logFailed(); return; }
  $sRes = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('support_email','website_name','email_logo','folder_system_images')");
  $siteSettings = [];
  if ($sRes) { while ($r = $sRes->fetch_assoc()) $siteSettings[$r['setting_key']] = $r['setting_value']; $sRes->free(); }
  $fromEmail  = !empty($siteSettings['support_email']) ? $siteSettings['support_email'] : 'support@funmap.com';
  $fromName   = !empty($siteSettings['website_name'])  ? $siteSettings['website_name']  : 'FunMap';
  $logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
  $logoFile   = $siteSettings['email_logo'] ?? '';
  $logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
  $logoHeader = $logoUrl
    ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
    : '';
  $safeName = htmlspecialchars((string)$to_name, ENT_QUOTES, 'UTF-8');
  $subject  = str_replace('{name}', $safeName, $template['message_name']);
  $body     = str_replace('{name}', $safeName, $template['message_text']);
  if (empty($SMTP_HOST) || empty($SMTP_USERNAME) || empty($SMTP_PASSWORD)) { $logFailed(); return; }
  $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
  if (!file_exists($docRoot . '/libs/phpmailer/PHPMailer.php')) { $logFailed(); return; }
  require_once $docRoot . '/libs/phpmailer/Exception.php';
  require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
  require_once $docRoot . '/libs/phpmailer/SMTP.php';
  $mail   = new \PHPMailer\PHPMailer\PHPMailer(true);
  $status = 'failed';
  try {
    $mail->isSMTP();
    $mail->Host       = $SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $SMTP_USERNAME;
    $mail->Password   = $SMTP_PASSWORD;
    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($to_email, $to_name);
    $mail->Subject = $subject;
    if ($template['supports_html']) {
      $mail->isHTML(true);
      $mail->Body    = $logoHeader ? preg_replace('/(<div[^>]*font-family[^>]*>)/i', '$1' . $logoHeader, $body, 1) : $body;
      $mail->AltBody = strip_tags($body);
    } else {
      $mail->isHTML(false);
      $mail->Body = strip_tags($body);
    }
    $mail->send();
    $status = 'sent';
  } catch (\PHPMailer\PHPMailer\Exception $e) {
    $status = 'failed';
  }
  $log = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status) VALUES (?, ?, ?, ?, ?)');
  if ($log) {
    $log->bind_param('issss', $member_id, $username, $msgKey, $to_email, $status);
    $log->execute();
    $log->close();
  }
}

if($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'Method not allowed');

$username = trim($_POST['username'] ?? '');
$email = trim($_POST['account-email'] ?? '');
$pass = $_POST['password'] ?? '';
$conf = $_POST['confirm'] ?? '';
$avatar = trim($_POST['avatar_file'] ?? '');
$country = strtolower(trim($_POST['country'] ?? ''));
// Optional uploaded avatar file (cropped client-side); only upload after member is created
$hasAvatarFile = isset($_FILES['avatar_file']) && isset($_FILES['avatar_file']['tmp_name']) && is_uploaded_file($_FILES['avatar_file']['tmp_name']);

// Required fields: reuse existing required-field message with {field}
if($username==='') fail_key_ph(400,'msg_post_validation_required',['field'=>'Username']);
if($email==='') fail_key_ph(400,'msg_post_validation_required',['field'=>'Email']);
if($pass==='') fail_key_ph(400,'msg_post_validation_required',['field'=>'Password']);
if($conf==='') fail_key_ph(400,'msg_post_validation_required',['field'=>'Confirm Password']);
// Avatar is required for registration (either a file upload, or a selected value)
if(!$hasAvatarFile && $avatar==='') fail_key_ph(400,'msg_post_validation_required',['field'=>'Avatar']);
if(!filter_var($email,FILTER_VALIDATE_EMAIL)) fail_key(400,'msg_auth_register_email_invalid');
if($pass!==$conf) fail_key(400,'msg_auth_register_password_mismatch');

// Validate password against member_settings requirements
$pwSettings = [];
$pwStmt = $mysqli->prepare("SELECT member_setting_key, member_setting_value FROM member_settings WHERE member_setting_key LIKE 'password_%'");
if ($pwStmt) {
  $pwStmt->execute();
  $pwResult = $pwStmt->get_result();
  while ($pwRow = $pwResult->fetch_assoc()) {
    $pwSettings[$pwRow['member_setting_key']] = $pwRow['member_setting_value'];
  }
  $pwStmt->close();
}
$pwMinLen = isset($pwSettings['password_min_length']) ? (int)$pwSettings['password_min_length'] : 8;
$pwMaxLen = isset($pwSettings['password_max_length']) ? (int)$pwSettings['password_max_length'] : 128;
$pwReqLower = isset($pwSettings['password_require_lowercase']) && $pwSettings['password_require_lowercase'] === '1';
$pwReqUpper = isset($pwSettings['password_require_uppercase']) && $pwSettings['password_require_uppercase'] === '1';
$pwReqNumber = isset($pwSettings['password_require_number']) && $pwSettings['password_require_number'] === '1';
$pwReqSymbol = isset($pwSettings['password_require_symbol']) && $pwSettings['password_require_symbol'] === '1';

if (strlen($pass) < $pwMinLen) fail_key_ph(400, 'msg_auth_password_too_short', ['min' => $pwMinLen]);
if (strlen($pass) > $pwMaxLen) fail_key_ph(400, 'msg_auth_password_too_long', ['max' => $pwMaxLen]);
if ($pwReqLower && !preg_match('/[a-z]/', $pass)) fail_key(400, 'msg_auth_password_require_lowercase');
if ($pwReqUpper && !preg_match('/[A-Z]/', $pass)) fail_key(400, 'msg_auth_password_require_uppercase');
if ($pwReqNumber && !preg_match('/[0-9]/', $pass)) fail_key(400, 'msg_auth_password_require_number');
if ($pwReqSymbol && !preg_match('/[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?`~]/', $pass)) fail_key(400, 'msg_auth_password_require_symbol');

$country = preg_match('/^[a-z]{2}$/', $country) ? $country : '';
if($country==='') fail_key_ph(400,'msg_post_validation_required',['field'=>'Country']);

$hash = password_hash($pass, PASSWORD_BCRYPT);
if(!$hash) fail(500,'Hash failed');

// Prevent duplicates (account_email only) across BOTH members and admins.
$emailLower = strtolower($email);

// Email duplicate?
$stmt = $mysqli->prepare('SELECT id FROM members WHERE LOWER(account_email)=? LIMIT 1');
if(!$stmt) fail(500,'Prepare failed (check query)');
$stmt->bind_param('s',$emailLower);
$stmt->execute();
$stmt->store_result();
if($stmt->num_rows>0){$stmt->close();fail_key(409,'msg_auth_register_email_taken');}
$stmt->close();

$stmt = $mysqli->prepare('SELECT id FROM admins WHERE LOWER(account_email)=? LIMIT 1');
if(!$stmt) fail(500,'Prepare failed (check query)');
$stmt->bind_param('s',$emailLower);
$stmt->execute();
$stmt->store_result();
if($stmt->num_rows>0){$stmt->close();fail_key(409,'msg_auth_register_email_taken');}
$stmt->close();

// Username duplicates are allowed by design (username_key will be unique).

// Generate username_key
function slugify($s){
  $s = strtolower(trim((string)$s));
  $s = preg_replace('/[^\p{L}\p{N}]+/u', '-', $s);
  $s = preg_replace('/-+/', '-', $s);
  $s = trim($s, '-');
  return $s !== '' ? $s : 'user';
}
$baseKey = slugify($username);
$candidateKey = $baseKey;
$suffix = 2;
while (true) {
  $stmt = $mysqli->prepare('SELECT id FROM members WHERE username_key=? LIMIT 1');
  if(!$stmt) fail(500,'Prepare failed (check query)');
  $stmt->bind_param('s',$candidateKey);
  $stmt->execute();
  $stmt->store_result();
  $existsMembers = $stmt->num_rows > 0;
  $stmt->close();

  $stmt = $mysqli->prepare('SELECT id FROM admins WHERE username_key=? LIMIT 1');
  if(!$stmt) fail(500,'Prepare failed (check query)');
  $stmt->bind_param('s',$candidateKey);
  $stmt->execute();
  $stmt->store_result();
  $existsAdmins = $stmt->num_rows > 0;
  $stmt->close();

  if (!$existsMembers && !$existsAdmins) break;
  $candidateKey = $baseKey . '-' . $suffix;
  $suffix++;
}

// Store username as the public username, and store username_key
$insert = $mysqli->prepare('INSERT INTO members (account_email,password_hash,username,avatar_file,username_key,country,created_at) VALUES (?,?,?,?,?,?,NOW())');
if(!$insert) fail(500,'Insert prepare failed');
$insert->bind_param('ssssss',$email,$hash,$username,$avatar,$candidateKey,$country);
if(!$insert->execute()){ $insert->close(); fail(500,'Database insert failed'); }
$id = $insert->insert_id;
$insert->close();

$txId = isset($_POST['transaction_id']) ? (int)$_POST['transaction_id'] : 0;
if ($txId > 0) {
  $txUp = $mysqli->prepare('UPDATE transactions SET member_id = ? WHERE id = ? AND member_id IS NULL AND transaction_type = \'donation\' LIMIT 1');
  if ($txUp) { $txUp->bind_param('ii', $id, $txId); $txUp->execute(); $txUp->close(); }
}

send_welcome_email($mysqli, $email, $username, $id, $username);

// If avatar_file is present, upload now (final filename), then update member row
if ($hasAvatarFile) {
  // Get avatar folder and storage credentials from admin settings
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

  // Determine storage type: external (http/https) or local
  $isExternal = preg_match('#^https?://#i', $avatarFolder);

  if ($isExternal && (!$storageApiKey || !$storageZoneName)) {
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(500, 'Storage credentials not configured for external storage (storage_api_key / storage_zone_name).');
  }

  $originalName = $_FILES['avatar_file']['name'] ?? 'avatar.png';
  $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
  if ($ext === '') $ext = 'png';
  $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if(!in_array($ext, $allowedExts)) {
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(400, 'Invalid avatar file type. Allowed: JPG, PNG, GIF, WebP');
  }

  $finalFilename = $id . '-avatar.' . $ext;
  $fileContent = file_get_contents($_FILES['avatar_file']['tmp_name']);
  if ($fileContent === false) {
    $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
    fail(500, 'Failed to read uploaded file.');
  }

  if ($isExternal) {
    // External storage (Bunny CDN)
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
      $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
      fail(500, 'Storage upload error: ' . $curlError);
    }
    if($httpCode !== 201 && $httpCode !== 200) {
      $snippet = is_string($response) ? substr($response, 0, 200) : '';
      $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
      fail(500, 'Storage returned error code: ' . $httpCode . ($snippet ? (' ' . $snippet) : ''));
    }
  } else {
    // Local storage
    $localBasePath = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . '/' . ltrim(rtrim($avatarFolder, '/'), '/');
    
    if (!is_dir($localBasePath)) {
      if (!mkdir($localBasePath, 0755, true)) {
        $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
        fail(500, 'Failed to create local directory: ' . $localBasePath);
      }
    }
    
    $localPath = $localBasePath . '/' . $finalFilename;
    if (file_put_contents($localPath, $fileContent) === false) {
      $mysqli->query('DELETE FROM members WHERE id='.(int)$id.' LIMIT 1');
      fail(500, 'Failed to save file locally.');
    }
  }

  // Store filename only (rules convention)
  $avatarFile = $finalFilename;
  $up = $mysqli->prepare('UPDATE members SET avatar_file=? WHERE id=? LIMIT 1');
  if ($up) {
    $up->bind_param('si', $avatarFile, $id);
    $up->execute();
    $up->close();
  }

  ok(['id'=>$id,'username'=>$username,'account_email'=>$email,'avatar_file'=>$avatarFile,'username_key'=>$candidateKey]);
}

ok(['id'=>$id,'username'=>$username,'account_email'=>$email,'avatar_file'=>$avatar,'username_key'=>$candidateKey]);
?>