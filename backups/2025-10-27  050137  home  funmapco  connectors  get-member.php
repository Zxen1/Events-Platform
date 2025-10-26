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

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403); exit(json_encode(['error'=>'Forbidden']));
}

$id = intval($_GET['id'] ?? 0);
if ($id <= 0) exit(json_encode(['error'=>'Invalid ID']));

$result = $mysqli->query("SELECT id, email, display_name, avatar_url, theme, language, currency, created_at FROM members WHERE id=$id");
echo json_encode($result->fetch_assoc() ?: []);

file_get_contents('https://funmap.com/connectors/add-log.php', false,
  stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Content-Type: application/json\r\nX-API-Key: $API_KEY\r\n",
      'content' => json_encode([
        'actor_type'=>'codex',
        'action'=>'add-post',
        'description'=>'Added post ID '.$stmt->insert_id
      ])
    ]
  ])
);

?>
