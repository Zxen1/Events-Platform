<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
  http_response_code(403);
  exit;
}
// connectors/delete-member.php — Soft delete (schedule for deletion)
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

function fail($code, $msg) {
  http_response_code($code);
  echo json_encode(['success' => false, 'error' => $msg]);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id = isset($input['id']) ? intval($input['id']) : 0;
$email = isset($input['email']) ? trim($input['email']) : '';

if ($id <= 0 || $email === '') {
  fail(400, 'Missing id/email');
}

// Verify email matches id before proceeding
$check = $mysqli->prepare('SELECT email FROM `funmapco_content`.`members` WHERE id = ?');
if (!$check) fail(500, 'Prepare failed');
$check->bind_param('i', $id);
if (!$check->execute()) { $check->close(); fail(500, 'Query failed'); }
$res = $check->get_result();
$row = $res ? $res->fetch_assoc() : null;
$check->close();

if (!$row || strtolower($row['email']) !== strtolower($email)) {
  fail(400, 'Invalid credentials');
}

// Check for active posts first
$postCheck = $mysqli->prepare('
  SELECT COUNT(*) as count 
  FROM `funmapco_content`.`posts` 
  WHERE member_id = ? 
    AND visibility = "active"
    AND (expires_at IS NULL OR expires_at > NOW())
');
if (!$postCheck) fail(500, 'Prepare failed');
$postCheck->bind_param('i', $id);
if (!$postCheck->execute()) { $postCheck->close(); fail(500, 'Query failed'); }
$postRes = $postCheck->get_result();
$postRow = $postRes ? $postRes->fetch_assoc() : null;
$postCheck->close();
$activeCount = $postRow ? intval($postRow['count']) : 0;

if ($activeCount > 0) {
  fail(400, 'Cannot delete account with active posts');
}

// Soft delete: set deleted_at timestamp
$update = $mysqli->prepare('UPDATE `funmapco_content`.`members` SET deleted_at = NOW() WHERE id = ?');
if (!$update) fail(500, 'Prepare failed');
$update->bind_param('i', $id);
if (!$update->execute()) { $update->close(); fail(500, 'Update failed'); }
$affected = $update->affected_rows;
$update->close();

if ($affected > 0) {
  // TODO: Send recovery email here (future enhancement)
  echo json_encode([
    'success' => true,
    'message' => 'Account scheduled for deletion',
    'grace_period_days' => 30
  ]);
} else {
  fail(500, 'Delete failed');
}
