<?php
// connectors/update-admin.php — admin self-update (display name, password)
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
$email = isset($input['email']) ? trim((string)$input['email']) : '';
if ($id <= 0 || $email === '') fail(400,'Missing id/email');

// Load admin by id+email (basic guard)
$stmt = $mysqli->prepare('SELECT id, email, display_name, password_hash FROM admins WHERE id=? AND email=? LIMIT 1');
if (!$stmt) fail(500,'Prepare failed');
$stmt->bind_param('is', $id, $email);
if(!$stmt->execute()){ $stmt->close(); fail(500,'Query failed'); }
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
if (!$row) fail(404,'Admin not found');

$updates = [];
$types = '';
$vals = [];

// Display name
if (isset($input['display_name'])) {
  $display = trim((string)$input['display_name']);
  if ($display === '') fail(400,'Display name cannot be empty');

  // Username duplicates are allowed by design (username_key is the unique identifier)
  $updates[] = 'display_name=?';
  $types .= 's';
  $vals[] = $display;
}

// Avatar filename
if (isset($input['avatar_file'])) {
  $avatar = trim((string)$input['avatar_file']);
  // Allow empty string to clear avatar
  $updates[] = 'avatar_file=?';
  $types .= 's';
  $vals[] = $avatar;
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

// Password change
$newPass = isset($input['password']) ? (string)$input['password'] : '';
$confirm = isset($input['confirm']) ? (string)$input['confirm'] : '';
if ($newPass !== '' || $confirm !== '') {
  if ($newPass === '' || $confirm === '') fail(400,'Password/confirm required');
  if ($newPass !== $confirm) fail(400,'Passwords do not match');
  if (strlen($newPass) < 4) fail(400,'Password too short');
  $hash = password_hash($newPass, PASSWORD_BCRYPT);
  if (!$hash) fail(500,'Hash failed');
  $updates[] = 'password_hash=?';
  $types .= 's';
  $vals[] = $hash;
}

if (count($updates) === 0) {
  ok(['changed' => false]);
}

$sql = 'UPDATE admins SET ' . implode(', ', $updates) . ' WHERE id=? AND email=? LIMIT 1';
$types .= 'is';
$vals[] = $id;
$vals[] = $email;

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


