<?php
/**
 * get-post-media.php - Fetch all media records for a post
 * Used by the images fieldset basket to show available images
 */

error_log('[get-post-media] Endpoint called');

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}

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
  header('Content-Type: application/json');
  echo json_encode(['success' => false, 'message' => 'Config not found']);
  exit;
}

require_once $configPath;

header('Content-Type: application/json');

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
  echo json_encode(['success' => false, 'message' => 'Database connection failed']);
  exit;
}

// Get post_id from request
$postId = isset($_GET['post_id']) ? (int)$_GET['post_id'] : 0;
if (!$postId) {
  $postId = isset($_POST['post_id']) ? (int)$_POST['post_id'] : 0;
}

if (!$postId) {
  echo json_encode(['success' => false, 'message' => 'post_id required']);
  exit;
}

// Fetch all media for this post, ordered by created_at DESC (newest first)
$stmt = $mysqli->prepare("
  SELECT id, file_name, file_url, file_size, settings_json, created_at 
  FROM post_media 
  WHERE post_id = ? AND deleted_at IS NULL 
  ORDER BY created_at DESC
");

if (!$stmt) {
  echo json_encode(['success' => false, 'message' => 'Query preparation failed']);
  exit;
}

$stmt->bind_param('i', $postId);
$stmt->execute();
$result = $stmt->get_result();

$media = [];
while ($row = $result->fetch_assoc()) {
  $media[] = [
    'id' => (int)$row['id'],
    'file_name' => $row['file_name'],
    'file_url' => $row['file_url'],
    'file_size' => (int)$row['file_size'],
    'settings_json' => $row['settings_json'] ? json_decode($row['settings_json'], true) : null,
    'created_at' => $row['created_at']
  ];
}

$stmt->close();

echo json_encode([
  'success' => true,
  'post_id' => $postId,
  'media' => $media
]);
exit;
?>
