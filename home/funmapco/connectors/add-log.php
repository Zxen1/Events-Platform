<?php
$configCandidates = [
  __DIR__ . '/../config/config-db.php',
  dirname(__DIR__) . '/config/config-db.php',
  dirname(__DIR__, 2) . '/config/config-db.php',
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
  throw new RuntimeException('Database configuration file is missing.');
}

require_once $configPath;
require '../config/config-auth.php';
require '../config/config-paths.php';
header('Content-Type: application/json');

// Security
if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403);
  exit(json_encode(['error' => 'Forbidden']));
}

// Input validation
$data = json_decode(file_get_contents('php://input'), true);
if (empty($data['action'])) exit(json_encode(['error' => 'Missing action']));

$actor_type  = $data['actor_type'] ?? 'codex';
$actor_id    = intval($data['actor_id'] ?? 0);
$action      = $data['action'];
$description = $data['description'] ?? '';
$ip          = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

$stmt = $mysqli->prepare("INSERT INTO logs (actor_type, actor_id, action, description, ip_address)
                          VALUES (?, ?, ?, ?, ?)");
$stmt->bind_param('sisss', $actor_type, $actor_id, $action, $description, $ip);
$stmt->execute();

echo json_encode(['success' => true, 'insert_id' => $stmt->insert_id]);

// === Universal internal log callback ===
// This replaces hardcoded URLs with dynamic detection from config-paths.php
$log_url = $BASE_URL . '/connectors/add-log.php';
$context = stream_context_create([
  'http' => [
    'method'  => 'POST',
    'header'  => "Content-Type: application/json\r\nX-API-Key: $API_KEY\r\n",
    'content' => json_encode([
      'actor_type'  => 'codex',
      'action'      => 'add-post',
      'description' => 'Added post ID ' . $stmt->insert_id
    ])
  ]
]);
@file_get_contents($log_url, false, $context);
?>
