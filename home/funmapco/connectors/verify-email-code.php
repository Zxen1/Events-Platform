<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}

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
if ($configPath === null) throw new RuntimeException('Database configuration file is missing.');
require_once $configPath;

function vec_fail($code, $msg) {
  http_response_code($code);
  echo json_encode(['success' => false, 'message' => $msg]);
  exit;
}
function vec_ok($data = []) {
  echo json_encode(array_merge(['success' => true], $data));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') vec_fail(405, 'Method not allowed');

$email = trim($_POST['email'] ?? '');
$code  = strtoupper(trim($_POST['code'] ?? ''));

if ($email === '') vec_fail(400, 'Email is required');
if ($code === '')  vec_fail(400, 'Code is required');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) vec_fail(400, 'Invalid email address');
if (!preg_match('/^[A-Z0-9]{6}$/', $code)) vec_fail(400, 'Invalid code format');

$stmt = $mysqli->prepare(
  "SELECT id FROM member_tokens
   WHERE email = ? AND token = ? AND token_type = 'email_verification'
     AND used = 0 AND expires_at > NOW()
   LIMIT 1"
);
if (!$stmt) vec_fail(500, 'Prepare failed');
$stmt->bind_param('ss', $email, $code);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
  $stmt->close();
  // Distinguish expired vs wrong code
  $checkStmt = $mysqli->prepare(
    "SELECT id, expires_at FROM member_tokens
     WHERE email = ? AND token = ? AND token_type = 'email_verification' AND used = 0 LIMIT 1"
  );
  if ($checkStmt) {
    $checkStmt->bind_param('ss', $email, $code);
    $checkStmt->execute();
    $checkStmt->store_result();
    $checkStmt->bind_result($tokenId, $expiresAt);
    if ($checkStmt->num_rows > 0) {
      $checkStmt->fetch();
      $checkStmt->close();
      vec_fail(400, 'This code has expired. Please request a new one.');
    }
    $checkStmt->close();
  }
  vec_fail(400, 'Incorrect code. Please try again.');
}

$stmt->bind_result($tokenId);
$stmt->fetch();
$stmt->close();

$updateStmt = $mysqli->prepare('UPDATE member_tokens SET used = 1 WHERE id = ?');
if (!$updateStmt) vec_fail(500, 'Update failed');
$updateStmt->bind_param('i', $tokenId);
$updateStmt->execute();
$updateStmt->close();

vec_ok();
?>
