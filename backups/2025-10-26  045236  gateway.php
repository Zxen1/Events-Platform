<?php
// gateway.php — public bridge to backend scripts outside web root
// DO NOT place secrets here.

$action = isset($_GET['action']) ? preg_replace('/[^a-z0-9_\-]/i', '', $_GET['action']) : '';

$map = [
  'verify-login' => '/home/funmapco/config/verify-login.php',
  'add-member' => '/home/funmapco/connectors/add-member.php',
  'save-formbuilder' => '/home/funmapco/connectors/save-formbuilder.php',
  // add more routes later, e.g. 'register' => '/home/funmapco/config/register.php',
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

require_once $target;
?>
