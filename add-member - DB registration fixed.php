<?php
require '../config/config-db.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');
$display_name = trim($data['display_name'] ?? '');
$password = $data['password'] ?? '';
$confirm = $data['confirm'] ?? $password;
$avatar_url = trim($data['avatar_url'] ?? '');

if (empty($email) || empty($display_name) || empty($password)) {
  echo json_encode(['error' => 'Missing required fields']); exit;
}
if ($password !== $confirm) {
  echo json_encode(['error' => 'Passwords do not match']); exit;
}

$password_hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $mysqli->prepare('INSERT INTO members (email, password_hash, display_name, avatar_url, created_at) VALUES (?, ?, ?, ?, NOW())');
$stmt->bind_param('ssss', $email, $password_hash, $display_name, $avatar_url);
if ($stmt->execute()) {
  echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
} else {
  echo json_encode(['error' => 'Failed to register user']);
}
$stmt->close();
?>