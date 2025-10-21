<?php
// gateway.php — hardened router
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

$action = $_GET['action'] ?? '';

$pathMap = [
  'add-member' => __DIR__ . '/../connectors/add-member.php',
  'verify-login' => __DIR__ . '/../connectors/verify-login.php'
];

if (!isset($pathMap[$action])) {
  echo json_encode(['success' => false, 'error' => 'Invalid or missing action']);
  exit;
}

$target = $pathMap[$action];
if (!file_exists($target)) {
  echo json_encode(['success' => false, 'error' => 'Target not found: ' . basename($target)]);
  exit;
}

require $target;
?>