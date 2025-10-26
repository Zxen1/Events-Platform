<?php
require '../config/config-db.php';
require '../config/config-auth.php';
require '../config/config-paths.php';
header('Content-Type: application/json');

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403); exit(json_encode(['error'=>'Forbidden']));
}

$id = intval($_GET['id'] ?? 0);
if ($id <= 0) exit(json_encode(['error'=>'Invalid ID']));

$result = $mysqli->query("SELECT file_name FROM media WHERE id=$id");
if ($row = $result->fetch_assoc()) {
  $file = $UPLOAD_DIR . $row['file_name'];
  if (file_exists($file)) unlink($file);
}
$mysqli->query("DELETE FROM media WHERE id=$id");

echo json_encode(['success'=>true]);

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
