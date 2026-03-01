<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}
// connectors/edit-member.php — member self-edit (display name, password, preferences)
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
  if (is_file($candidate)) { $configPath = $candidate; break; }
}
if ($configPath === null) {
  echo json_encode(['success'=>false,'message'=>'Database configuration file is missing.']);
  exit;
}
require_once $configPath;

function fail($code, $msg){ http_response_code($code); echo json_encode(['success'=>false,'message'=>$msg]); exit; }
function ok($data=[]){ echo json_encode(array_merge(['success'=>true], $data)); exit; }
function fail_key($code, $messageKey){ http_response_code($code); echo json_encode(['success'=>false,'message_key'=>$messageKey]); exit; }

if($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'Method not allowed');

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) fail(400,'Invalid JSON');

$id = isset($input['id']) ? (int)$input['id'] : 0;
$accountEmail = isset($input['account-email']) ? trim((string)$input['account-email']) : '';
if ($id <= 0 || $accountEmail === '') fail(400,'Missing id/account-email');

// Load member by id+email (basic guard)
$stmt = $mysqli->prepare('SELECT id, account_email, username, password_hash FROM members WHERE id=? AND account_email=? LIMIT 1');
if (!$stmt) fail(500,'Prepare failed');
$stmt->bind_param('is', $id, $accountEmail);
if(!$stmt->execute()){ $stmt->close(); fail(500,'Query failed'); }
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
if (!$row) fail(404,'Member not found');

$updates = [];
$types = '';
$vals = [];

// Username
if (isset($input['username'])) {
  $u = trim((string)$input['username']);
  if ($u === '') fail(400,'Username cannot be empty');
  $updates[] = 'username=?';
  $types .= 's';
  $vals[] = $u;
}

// Avatar filename
if (isset($input['avatar_file'])) {
  $avatar = trim((string)$input['avatar_file']);
  // Allow empty string to clear avatar
  $updates[] = 'avatar_file=?';
  $types .= 's';
  $vals[] = $avatar;
}

if (isset($input['language'])) {
  $updates[] = 'language=?';
  $types .= 's';
  $vals[] = trim((string)$input['language']);
}
if (isset($input['currency'])) {
  $updates[] = 'currency=?';
  $types .= 's';
  $vals[] = trim((string)$input['currency']);
}
if (isset($input['country_code'])) {
  $updates[] = 'country_code=?';
  $types .= 's';
  $vals[] = trim((string)$input['country_code']);
}

// Map preferences (optional; columns must exist in DB)
if (isset($input['map_lighting'])) {
  $updates[] = 'map_lighting=?';
  $types .= 's';
  $vals[] = (string)$input['map_lighting'];
}
if (isset($input['map_style'])) {
  $updates[] = 'map_style=?';
  $types .= 's';
  $vals[] = (string)$input['map_style'];
}
if (isset($input['animation_preference'])) {
  $updates[] = 'animation_preference=?';
  $types .= 's';
  $vals[] = (string)$input['animation_preference'];
}
if (isset($input['timezone'])) {
  $updates[] = 'timezone=?';
  $types .= 's';
  $vals[] = trim((string)$input['timezone']);
}
if (isset($input['email_notifications'])) {
  $en = (int)$input['email_notifications'];
  $en = ($en === 0) ? 0 : 1;
  $updates[] = 'email_notifications=?';
  $types .= 'i';
  $vals[] = $en;
}

// Favorites persistence (JSON string from localStorage)
if (array_key_exists('favorites', $input)) {
  $favVal = $input['favorites'];
  if ($favVal === null || $favVal === '') {
    $updates[] = 'favorites=NULL';
  } else {
    $favStr = is_string($favVal) ? $favVal : json_encode($favVal, JSON_UNESCAPED_SLASHES);
    $updates[] = 'favorites=?';
    $types .= 's';
    $vals[] = $favStr;
  }
}

// Recent history persistence (JSON string from localStorage)
if (array_key_exists('recent', $input)) {
  $recentVal = $input['recent'];
  if ($recentVal === null || $recentVal === '') {
    $updates[] = 'recent=NULL';
  } else {
    $recentStr = is_string($recentVal) ? $recentVal : json_encode($recentVal, JSON_UNESCAPED_SLASHES);
    $updates[] = 'recent=?';
    $types .= 's';
    $vals[] = $recentStr;
  }
}

// Filters persistence (DB-first; localStorage is secondary)
if (array_key_exists('filters_json', $input)) {
  $filtersJson = $input['filters_json'];
  if ($filtersJson === null || $filtersJson === '') {
    $updates[] = 'filters_json=NULL';
    $updates[] = 'filters_hash=NULL';
    $updates[] = 'filters_updated_at=NOW()';
  } else {
    $filtersJsonStr = is_string($filtersJson) ? $filtersJson : json_encode($filtersJson, JSON_UNESCAPED_SLASHES);
    if (!is_string($filtersJsonStr)) fail(400, 'Invalid filters_json');
    $decoded = json_decode($filtersJsonStr, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) fail(400, 'filters_json must be valid JSON');
    $updates[] = 'filters_json=?';
    $types .= 's';
    $vals[] = $filtersJsonStr;
    $updates[] = 'filters_hash=?';
    $types .= 's';
    $vals[] = sha1($filtersJsonStr);
    $updates[] = 'filters_updated_at=NOW()';
  }
}

// Password change
$newPass = isset($input['password']) ? (string)$input['password'] : '';
$confirm = isset($input['confirm']) ? (string)$input['confirm'] : '';
if ($newPass !== '' || $confirm !== '') {
  if ($newPass === '' || $confirm === '') fail(400,'Password/confirm required');
  if ($newPass !== $confirm) fail_key(400,'msg_auth_register_password_mismatch');
  
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

  if (strlen($newPass) < $pwMinLen) fail(400, 'Password must be at least ' . $pwMinLen . ' characters');
  if (strlen($newPass) > $pwMaxLen) fail(400, 'Password must be no more than ' . $pwMaxLen . ' characters');
  if ($pwReqLower && !preg_match('/[a-z]/', $newPass)) fail(400, 'Password must contain a lowercase letter');
  if ($pwReqUpper && !preg_match('/[A-Z]/', $newPass)) fail(400, 'Password must contain an uppercase letter');
  if ($pwReqNumber && !preg_match('/[0-9]/', $newPass)) fail(400, 'Password must contain a number');
  if ($pwReqSymbol && !preg_match('/[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?`~]/', $newPass)) fail(400, 'Password must contain a special character');

  $hash = password_hash($newPass, PASSWORD_BCRYPT);
  if (!$hash) fail(500,'Hash failed');
  $updates[] = 'password_hash=?';
  $types .= 's';
  $vals[] = $hash;
}

// Return preferences only (no updates) when requested
if (!empty($input['return_preferences'])) {
  $prefStmt = $mysqli->prepare('SELECT favorites, recent, filters_json, filters_hash, filters_version, filters_updated_at FROM members WHERE id=? AND account_email=? LIMIT 1');
  if (!$prefStmt) fail(500,'Prepare failed');
  $prefStmt->bind_param('is', $id, $accountEmail);
  if(!$prefStmt->execute()){ $prefStmt->close(); fail(500,'Query failed'); }
  $prefRes = $prefStmt->get_result();
  $prefRow = $prefRes ? $prefRes->fetch_assoc() : null;
  $prefStmt->close();
  ok([
    'favorites' => isset($prefRow['favorites']) ? $prefRow['favorites'] : null,
    'recent' => isset($prefRow['recent']) ? $prefRow['recent'] : null,
    'filters_json' => isset($prefRow['filters_json']) ? $prefRow['filters_json'] : null,
    'filters_hash' => isset($prefRow['filters_hash']) ? $prefRow['filters_hash'] : null,
    'filters_version' => isset($prefRow['filters_version']) ? (int)$prefRow['filters_version'] : null,
    'filters_updated_at' => isset($prefRow['filters_updated_at']) ? $prefRow['filters_updated_at'] : null
  ]);
}

if (count($updates) === 0) {
  ok(['changed' => false]);
}

$sql = 'UPDATE members SET ' . implode(', ', $updates) . ' WHERE id=? AND account_email=? LIMIT 1';
$types .= 'is';
$vals[] = $id;
$vals[] = $accountEmail;

$upd = $mysqli->prepare($sql);
if (!$upd) fail(500,'Update prepare failed');

// bind_param with dynamic args
$bindArgs = [];
$bindArgs[] = $types;
foreach ($vals as $v) { $bindArgs[] = $v; }
$tmp = [];
foreach ($bindArgs as $k => $v) { $tmp[$k] = &$bindArgs[$k]; }
call_user_func_array([$upd, 'bind_param'], $tmp);

if (!$upd->execute()) { $upd->close(); fail(500,'Update failed'); }
$changed = $upd->affected_rows > 0;
$upd->close();

ok(['changed' => $changed]);
?>
