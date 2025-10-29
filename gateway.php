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

$map = [
  'verify-login' => $connectorDir . '/verify-login.php',
  'add-member' => $connectorDir . '/add-member.php',
  'save-form' => $connectorDir . '/save-form.php',
  'get-form' => $connectorDir . '/get-form.php',
  'add-post' => $connectorDir . '/add-post.php',
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

if (!defined('FUNMAP_GATEWAY_ENTRY')) {
  define('FUNMAP_GATEWAY_ENTRY', true);
}

require_once $target;
?>
