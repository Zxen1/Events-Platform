<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
  http_response_code(403);
  exit;
}
// connectors/get-moderation-data.php — Fetch moderation queue data for admin panel
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

// Get accounts pending deletion (deleted_at is set)
$pendingDeletion = [];
$stmt = $mysqli->prepare('
  SELECT id, username, email, avatar_file, deleted_at 
  FROM `funmapco_content`.`members` 
  WHERE deleted_at IS NOT NULL 
  ORDER BY deleted_at ASC
  LIMIT 50
');
if ($stmt) {
  $stmt->execute();
  $res = $stmt->get_result();
  while ($row = $res->fetch_assoc()) {
    // Calculate days since deletion
    $deletedAt = new DateTime($row['deleted_at']);
    $now = new DateTime();
    $daysSince = $now->diff($deletedAt)->days;
    $daysRemaining = max(0, 30 - $daysSince);
    
    $pendingDeletion[] = [
      'id' => (int)$row['id'],
      'username' => $row['username'],
      'email' => $row['email'],
      'avatar_file' => $row['avatar_file'],
      'deleted_at' => $row['deleted_at'],
      'days_remaining' => $daysRemaining
    ];
  }
  $stmt->close();
}

// Get flagged posts (flag_reason is set)
$flaggedPosts = [];
$stmt = $mysqli->prepare('
  SELECT id, post_key, member_id, member_name, checkout_title, flag_reason, moderation_status, created_at
  FROM `funmapco_content`.`posts` 
  WHERE flag_reason IS NOT NULL AND flag_reason != ""
  ORDER BY created_at DESC
  LIMIT 50
');
if ($stmt) {
  $stmt->execute();
  $res = $stmt->get_result();
  while ($row = $res->fetch_assoc()) {
    $flaggedPosts[] = [
      'id' => (int)$row['id'],
      'post_key' => $row['post_key'],
      'member_id' => (int)$row['member_id'],
      'member_name' => $row['member_name'],
      'title' => $row['checkout_title'],
      'flag_reason' => $row['flag_reason'],
      'moderation_status' => $row['moderation_status'],
      'created_at' => $row['created_at']
    ];
  }
  $stmt->close();
}

echo json_encode([
  'success' => true,
  'pending_deletion' => $pendingDeletion,
  'pending_deletion_count' => count($pendingDeletion),
  'flagged_posts' => $flaggedPosts,
  'flagged_posts_count' => count($flaggedPosts)
]);

