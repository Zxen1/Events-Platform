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
require '../config/config-paths.php';
header('Content-Type: application/json');

// Allow HttpOnly cookie fallback for connector auth
if (empty($_SERVER['HTTP_X_API_KEY']) && isset($_COOKIE['FUNMAP_TOKEN'])) {
  $_SERVER['HTTP_X_API_KEY'] = (string) $_COOKIE['FUNMAP_TOKEN'];
}

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403); exit(json_encode(['error'=>'Forbidden']));
}

if (empty($_FILES['file']['name'])) exit(json_encode(['error'=>'No file uploaded']));

$member_id = intval($_POST['member_id'] ?? 0);
$post_id   = intval($_POST['post_id'] ?? 0);
$filename  = basename($_FILES['file']['name']);
$target    = $UPLOAD_DIR . $filename;

if (!move_uploaded_file($_FILES['file']['tmp_name'], $target)) {
  exit(json_encode(['error'=>'Upload failed']));
}

$url = $UPLOAD_URL . $filename;
$size = $_FILES['file']['size'];

$stmt = $mysqli->prepare("INSERT INTO media (member_id, post_id, file_name, file_url, file_size)
                          VALUES (?, ?, ?, ?, ?)");
$stmt->bind_param('isssi', $member_id, $post_id, $filename, $url, $size);
$stmt->execute();

echo json_encode(['success'=>true, 'url'=>$url, 'insert_id'=>$stmt->insert_id]);

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
