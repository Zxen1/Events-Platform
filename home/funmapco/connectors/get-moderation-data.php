<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
  http_response_code(403);
  exit;
}
// connectors/get-moderation-data.php — Fetch moderation queue data for admin panel
header('Content-Type: application/json; charset=utf-8');

// Custom error handler to catch all errors and return JSON
set_error_handler(function($errno, $errstr, $errfile, $errline) {
  http_response_code(500);
  echo json_encode(['success'=>false,'error'=>"PHP Error: $errstr in $errfile:$errline"]);
  exit;
});

// Catch fatal errors too
register_shutdown_function(function() {
  $error = error_get_last();
  if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>"Fatal: {$error['message']} in {$error['file']}:{$error['line']}"]);
  }
});

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
  echo json_encode(['success'=>false,'error'=>'Database configuration file is missing.']);
  exit;
}

try {
  require_once $configPath;
} catch (Exception $e) {
  echo json_encode(['success'=>false,'error'=>'Database connection failed: ' . $e->getMessage()]);
  exit;
}

if (!isset($mysqli) || !$mysqli) {
  echo json_encode(['success'=>false,'error'=>'Database not available.']);
  exit;
}

// Check if connection is valid
if ($mysqli->connect_error) {
  echo json_encode(['success'=>false,'error'=>'Database connection error: ' . $mysqli->connect_error]);
  exit;
}

// Get accounts pending deletion (deleted_at is set)
$pendingDeletion = [];
$stmt = $mysqli->prepare('
  SELECT id, username, account_email, avatar_file, deleted_at 
  FROM `members` 
  WHERE deleted_at IS NOT NULL 
  ORDER BY deleted_at ASC
  LIMIT 50
');
if (!$stmt) {
  echo json_encode(['success'=>false,'error'=>'Prepare failed (members): ' . $mysqli->error]);
  exit;
}
if ($stmt->execute()) {
  $res = $stmt->get_result();
  if ($res) {
    while ($row = $res->fetch_assoc()) {
      // Calculate days since deletion
      try {
        $deletedAt = new DateTime($row['deleted_at']);
        $now = new DateTime();
        $daysSince = $now->diff($deletedAt)->days;
        $daysRemaining = max(0, 30 - $daysSince);
      } catch (Exception $e) {
        $daysRemaining = 30;
      }
      
      $pendingDeletion[] = [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'account_email' => $row['account_email'],
        'avatar_file' => $row['avatar_file'],
        'deleted_at' => $row['deleted_at'],
        'days_remaining' => $daysRemaining
      ];
    }
  }
} else {
  $stmt->close();
  echo json_encode(['success'=>false,'error'=>'Execute failed (members): ' . $stmt->error]);
  exit;
}
$stmt->close();

// Get flagged posts (flag_reason is set)
$flaggedPosts = [];
$stmt = $mysqli->prepare('
  SELECT id, post_key, member_id, member_name, checkout_title, flag_reason, moderation_status, created_at
  FROM `posts` 
  WHERE flag_reason IS NOT NULL AND flag_reason != ""
  ORDER BY created_at DESC
  LIMIT 50
');
if (!$stmt) {
  echo json_encode(['success'=>false,'error'=>'Prepare failed (posts): ' . $mysqli->error]);
  exit;
}
if ($stmt->execute()) {
  $res = $stmt->get_result();
  if ($res) {
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
  }
} else {
  $stmt->close();
  echo json_encode(['success'=>false,'error'=>'Execute failed (posts): ' . $stmt->error]);
  exit;
}
$stmt->close();

// Get posts with missing map images
$missingMapImages = [];
$stmt = $mysqli->prepare('
  SELECT id, post_id, post_title, reason, created_at
  FROM `moderation_log` 
  WHERE action = "missing_map_images"
  ORDER BY created_at DESC
  LIMIT 50
');
if ($stmt) {
  if ($stmt->execute()) {
    $res = $stmt->get_result();
    if ($res) {
      while ($row = $res->fetch_assoc()) {
        $reasonData = json_decode($row['reason'], true);
        $missingMapImages[] = [
          'id' => (int)$row['id'],
          'post_id' => (int)$row['post_id'],
          'post_title' => $row['post_title'],
          'lat' => isset($reasonData['lat']) ? $reasonData['lat'] : null,
          'lng' => isset($reasonData['lng']) ? $reasonData['lng'] : null,
          'created_at' => $row['created_at']
        ];
      }
    }
  }
  $stmt->close();
}

echo json_encode([
  'success' => true,
  'pending_deletion' => $pendingDeletion,
  'pending_deletion_count' => count($pendingDeletion),
  'flagged_posts' => $flaggedPosts,
  'flagged_posts_count' => count($flaggedPosts),
  'missing_map_images' => $missingMapImages,
  'missing_map_images_count' => count($missingMapImages)
]);
