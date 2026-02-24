<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
  http_response_code(403);
  exit;
}
// connectors/moderation-action.php — Handle moderation actions (reactivate, anonymize, etc.)
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
$action = isset($input['action']) ? trim($input['action']) : '';
$memberId = isset($input['member_id']) ? intval($input['member_id']) : 0;
$postId = isset($input['post_id']) ? intval($input['post_id']) : 0;

if (!$action) {
  fail(400, 'Missing action');
}

switch ($action) {
  case 'reactivate_member':
    if ($memberId <= 0) fail(400, 'Missing member_id');
    
    $stmt = $mysqli->prepare('UPDATE `members` SET deleted_at = NULL WHERE id = ?');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('i', $memberId);
    if (!$stmt->execute()) { $stmt->close(); fail(500, 'Update failed'); }
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;
    
  case 'anonymize_member':
    if ($memberId <= 0) fail(400, 'Missing member_id');
    
    // Anonymize: clear personal data but keep the row
    $anonUsername = 'Former Member';
    $anonAccountEmail = 'deleted_' . $memberId . '@anonymized.local';
    
    $stmt = $mysqli->prepare('
      UPDATE `members` 
      SET username = ?, 
          account_email = ?, 
          avatar_file = NULL,
          password_hash = "",
          favorites = NULL,
          recent = NULL,
          country = NULL,
          hidden = 1
      WHERE id = ?
    ');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('ssi', $anonUsername, $anonAccountEmail, $memberId);
    if (!$stmt->execute()) { $stmt->close(); fail(500, 'Update failed'); }
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    // Update posts to show "Former Member" as author
    $stmt2 = $mysqli->prepare('UPDATE `posts` SET member_name = ? WHERE member_id = ?');
    if ($stmt2) {
      $stmt2->bind_param('si', $anonUsername, $memberId);
      $stmt2->execute();
      $stmt2->close();
    }
    
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;
    
  case 'clear_post_flag':
    if ($postId <= 0) fail(400, 'Missing post_id');
    
    $stmt = $mysqli->prepare('UPDATE `posts` SET flag_reason = NULL WHERE id = ?');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('i', $postId);
    if (!$stmt->execute()) { $stmt->close(); fail(500, 'Update failed'); }
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;
    
  case 'hide_post':
    if ($postId <= 0) fail(400, 'Missing post_id');
    
    $stmt = $mysqli->prepare('UPDATE `posts` SET moderation_status = "hidden", flag_reason = NULL WHERE id = ?');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('i', $postId);
    if (!$stmt->execute()) { $stmt->close(); fail(500, 'Update failed'); }
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;
    
  case 'dismiss_missing_map_images':
    // Dismiss by moderation_log id
    $logId = isset($input['log_id']) ? intval($input['log_id']) : 0;
    if ($logId <= 0) fail(400, 'Missing log_id');
    
    $stmt = $mysqli->prepare('DELETE FROM `moderation_log` WHERE id = ? AND action = "missing_map_images"');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('i', $logId);
    if (!$stmt->execute()) { $stmt->close(); fail(500, 'Delete failed'); }
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;
    
  case 'flag_missing_map_images':
    if ($postId <= 0) fail(400, 'Missing post_id');
    $lat = isset($input['lat']) ? floatval($input['lat']) : null;
    $lng = isset($input['lng']) ? floatval($input['lng']) : null;
    
    // Check if already flagged
    $stmt = $mysqli->prepare('SELECT id FROM `moderation_log` WHERE post_id = ? AND action = "missing_map_images" LIMIT 1');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('i', $postId);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->fetch_assoc()) {
      $stmt->close();
      echo json_encode(['success' => true, 'already_flagged' => true]);
      exit;
    }
    $stmt->close();
    
    // Get post title
    $postTitle = null;
    $stmt = $mysqli->prepare('SELECT checkout_title FROM `posts` WHERE id = ? LIMIT 1');
    if ($stmt) {
      $stmt->bind_param('i', $postId);
      $stmt->execute();
      $res = $stmt->get_result();
      if ($row = $res->fetch_assoc()) $postTitle = $row['checkout_title'];
      $stmt->close();
    }
    
    // Insert flag
    $reason = json_encode(['lat' => $lat, 'lng' => $lng, 'flagged_at' => date('Y-m-d H:i:s')]);
    $stmt = $mysqli->prepare('INSERT INTO `moderation_log` (post_id, post_title, action, reason, created_at) VALUES (?, ?, "missing_map_images", ?, NOW())');
    if (!$stmt) fail(500, 'Prepare failed');
    $stmt->bind_param('iss', $postId, $postTitle, $reason);
    if (!$stmt->execute()) { $stmt->close(); fail(500, 'Insert failed'); }
    $stmt->close();
    
    echo json_encode(['success' => true, 'flagged' => true]);
    break;
    
  default:
    fail(400, 'Unknown action');
}

