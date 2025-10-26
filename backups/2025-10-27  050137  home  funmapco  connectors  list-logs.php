<?php
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
  throw new RuntimeException('Database configuration file is missing.');
}

require_once $configPath;

require '../config/config-auth.php';
header('Content-Type: application/json');

// Security
if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403);
  exit(json_encode(['error' => 'Forbidden']));
}

// Optional filters
$actor = $_GET['actor_type'] ?? '';
$where = $actor ? "WHERE actor_type='" . $mysqli->real_escape_string($actor) . "'" : '';

$result = $mysqli->query("SELECT id, actor_type, actor_id, action, description, ip_address, created_at
                          FROM logs $where ORDER BY id DESC LIMIT 200");
echo json_encode($result->fetch_all(MYSQLI_ASSOC));
?>
