<?php
// gateway.php — public bridge to backend scripts outside web root
// DO NOT place secrets here.

$action = isset($_GET['action']) ? preg_replace('/[^a-z0-9_\-]/i', '', $_GET['action']) : '';

$baseDir = __DIR__;

$candidateDirs = [
  $baseDir . '/../connectors',
  $baseDir . '/home/funmapco/connectors'
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

$formbuilderRoutes = [
  'get-form' => $connectorDir . DIRECTORY_SEPARATOR . 'get-form.php',
  'save-form' => $connectorDir . DIRECTORY_SEPARATOR . 'save-form.php',
];

$map = $formbuilderRoutes + [
  'verify-login' => $connectorDir . DIRECTORY_SEPARATOR . 'verify-login.php',
  'add-member' => $connectorDir . DIRECTORY_SEPARATOR . 'add-member.php',
  'add-post' => $connectorDir . DIRECTORY_SEPARATOR . 'add-post.php',
  'upload-media' => $connectorDir . DIRECTORY_SEPARATOR . 'upload-media.php',
  // add more routes later, e.g. 'register' => $connectorDir . '/register.php',
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
