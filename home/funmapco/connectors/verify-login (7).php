<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config-db.php';

function json_fail($msg){
  echo json_encode(['success'=>false,'message'=>$msg], JSON_UNESCAPED_SLASHES);
  exit;
}

try {
  $raw = file_get_contents('php://input');
  $input = json_decode($raw, true);
  $username = isset($input['username']) ? trim((string)$input['username']) : '';
  $password = isset($input['password']) ? (string)$input['password'] : '';

  if ($username === '' || $password === '') {
    json_fail('Missing credentials');
  }

  // Attempt login against a table; allow email OR display_name match
  $attempt = function(mysqli $db, string $table, string $user, string $pass){
    $sql = "SELECT id, email, display_name, password_hash FROM {$table} WHERE email = ? OR display_name = ? LIMIT 1";
    if (!($stmt = $db->prepare($sql))) return null;
    $stmt->bind_param('ss', $user, $user);
    if(!$stmt->execute()){ $stmt->close(); return null; }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if(!$row) return null;
    if (!isset($row['password_hash']) || !password_verify($pass, $row['password_hash'])) return null;
    return [
      'success' => true,
      'role'    => $table === 'admins' ? 'admin' : 'member',
      'user'    => [
        'id'    => (int)$row['id'],
        'email' => (string)$row['email'],
        'name'  => (string)$row['display_name']
      ]
    ];
  };

  // Try admins first, then members
  $login = $attempt($mysqli, 'admins', $username, $password);
  if(!$login) $login = $attempt($mysqli, 'members', $username, $password);

  if($login){
    echo json_encode($login, JSON_UNESCAPED_SLASHES);
  } else {
    json_fail('Incorrect email/username or password');
  }
} catch (Throwable $e) {
  json_fail('Server error');
}
?>