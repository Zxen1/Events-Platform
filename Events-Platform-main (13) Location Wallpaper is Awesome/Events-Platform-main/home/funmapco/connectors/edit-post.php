<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}
// Alias wrapper for update-post to support new action name without breaking callers
require_once __DIR__ . '/update-post.php';
?>

