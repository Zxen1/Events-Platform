<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
  http_response_code(403);
  exit;
}
// connectors/check-member-posts.php — Check if member has active posts
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
$memberId = isset($input['member_id']) ? intval($input['member_id']) : 0;

if ($memberId <= 0) {
  fail(400, 'Missing member_id');
}

// Count active posts (visibility='active' and not expired)
$stmt = $mysqli->prepare('
  SELECT COUNT(*) as count 
  FROM `posts` 
  WHERE member_id = ? 
    AND visibility = "active"
    AND (expires_at IS NULL OR expires_at > NOW())
');
if (!$stmt) fail(500, 'Prepare failed');
$stmt->bind_param('i', $memberId);
if (!$stmt->execute()) { $stmt->close(); fail(500, 'Query failed'); }
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();

$activeCount = $row ? intval($row['count']) : 0;

echo json_encode([
  'success' => true,
  'active_post_count' => $activeCount,
  'can_delete' => ($activeCount === 0)
]);
