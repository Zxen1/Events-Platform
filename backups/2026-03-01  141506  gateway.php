<?php
// gateway.php — public bridge to backend scripts outside web root
// DO NOT place secrets here.

// Check both GET and POST for action parameter
$rawAction = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : '');
$action = preg_replace('/[^a-z0-9_\-]/i', '', $rawAction);

$baseDir = __DIR__;

$candidateDirs = [
  $baseDir . '/home/funmapco/connectors',  // Development location (checked first)
  $baseDir . '/../connectors'              // Production location (fallback)
];

$connectorDir = null;
foreach ($candidateDirs as $candidate) {
  $resolved = realpath($candidate);
  if ($resolved && is_dir($resolved)) {
    $connectorDir = $resolved;
    break;
  }
}

if ($connectorDir === null) {
  header('Content-Type: application/json');
  echo json_encode(['success'=>false,'message'=>'Connector directory not found']);
  exit;
}


$map = [
  'verify' => $connectorDir . '/verify.php',
  'add-member' => $connectorDir . '/add-member.php',
  'save-form' => $connectorDir . '/save-form.php',
  'get-form' => $connectorDir . '/get-form.php',
  'add-post' => $connectorDir . '/add-post.php',
  'get-posts' => $connectorDir . '/get-posts.php',
  'get-clusters' => $connectorDir . '/get-clusters.php',
  'get-filter-counts' => $connectorDir . '/get-filter-counts.php',
  'upload-media' => $connectorDir . '/upload-media.php',
  'issue-token' => $connectorDir . '/issue-token.php',
  // Backwards-compat routes for rename
  'edit-post' => $connectorDir . '/edit-post.php',
  'edit-member' => $connectorDir . '/edit-member.php',
  'edit-admin' => $connectorDir . '/edit-admin.php',
  'delete-member' => $connectorDir . '/delete-member.php',
  'check-member-posts' => $connectorDir . '/check-member-posts.php',
  'get-moderation-data' => $connectorDir . '/get-moderation-data.php',
  'moderation-action' => $connectorDir . '/moderation-action.php',
  'get-admin-settings' => $connectorDir . '/get-admin-settings.php',
  'save-admin-settings' => $connectorDir . '/save-admin-settings.php',
  'upload-avatar' => $connectorDir . '/upload-avatar.php',
  'list-files' => $connectorDir . '/list-files.php',
  'get-map-wallpapers' => $connectorDir . '/get-map-wallpapers.php',
  'get-post-media' => $connectorDir . '/get-post-media.php',
  'restore-post' => $connectorDir . '/restore-post.php',
  'payment-order' => $connectorDir . '/payment-order.php',
  'send-verification-code' => $connectorDir . '/send-verification-code.php',
  'verify-email-code' => $connectorDir . '/verify-email-code.php',
];

if (!$action || !isset($map[$action])) {
  header('Content-Type: application/json');
  echo json_encode(['success'=>false,'message'=>'Unknown action']);
  exit;
}

$target = $map[$action];

if (!file_exists($target)) {
  header('Content-Type: application/json');
  echo json_encode(['success'=>false,'message'=>'Target not found']);
  exit;
}

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  define('FUNMAP_GATEWAY_ACTIVE', true);
}
$GLOBALS['FUNMAP_GATEWAY_ACTION'] = $action;

require_once $target;
?>
