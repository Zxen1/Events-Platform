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

// Handle list-icons inline (no separate file needed)
if ($action === 'list-icons') {
  header('Content-Type: application/json');
  
  $folder = isset($_GET['folder']) ? $_GET['folder'] : '';
  
  // Security: prevent directory traversal and limit to assets folder
  if (strpos($folder, '..') !== false || strpos($folder, '\\') !== false || stripos($folder, 'assets/') !== 0) {
    echo json_encode(['success' => false, 'icons' => []]);
    exit;
  }
  
  // Ensure folder is relative to base directory
  $fullPath = $baseDir . '/' . ltrim($folder, '/');
  
  $icons = [];
  $allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  
  if (is_dir($fullPath)) {
    $files = scandir($fullPath);
    foreach ($files as $file) {
      if ($file === '.' || $file === '..') continue;
      $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
      if (in_array($ext, $allowedExtensions)) {
        $icons[] = $file;
      }
    }
  }
  
  echo json_encode(['success' => true, 'icons' => $icons]);
  exit;
}

$map = [
  'verify-login' => $connectorDir . '/verify-login.php',
  'add-member' => $connectorDir . '/add-member.php',
  'save-form' => $connectorDir . '/save-form.php',
  'get-form' => $connectorDir . '/get-form.php',
  'add-post' => $connectorDir . '/add-post.php',
  'upload-media' => $connectorDir . '/upload-media.php',
  'get-admin-settings' => $connectorDir . '/get-admin-settings.php',
  'save-admin-settings' => $connectorDir . '/save-admin-settings.php',
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
