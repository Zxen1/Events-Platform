<?php
require '../config/config-db.php';
require '../config/config-auth.php';
header('Content-Type: application/json');

if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403);
  exit(json_encode(['error'=>'Forbidden']));
}

$result = $mysqli->query("SELECT id, title, member_name, subcategory_name, status, created_at FROM posts ORDER BY id DESC LIMIT 100");
echo json_encode($result->fetch_all(MYSQLI_ASSOC));
?>
