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
header('Content-Type: application/json');

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403);
  exit(json_encode(['error'=>'Forbidden']));
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data || empty($data['title'])) exit(json_encode(['error'=>'Invalid data']));

$stmt = $mysqli->prepare("INSERT INTO posts (subcategory_id, subcategory_name, member_id, member_name, title, status)
                          VALUES (?, ?, ?, ?, ?, 'active')");
$stmt->bind_param('isiss', $data['subcategory_id'], $data['subcategory_name'],
                             $data['member_id'], $data['member_name'], $data['title']);
$stmt->execute();

echo json_encode(['success'=>true, 'insert_id'=>$stmt->insert_id]);

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
