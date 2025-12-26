<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}
header('Content-Type: application/json');
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
require_once __DIR__ . '/_compat-db-guard.php';
funmap_assert_db_compat();


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

  // Attempt login against a table; allow email OR username match
  $attempt = function(mysqli $db, string $table, string $user, string $pass){
    // avatar_file is preferred (filename-only). Some installs may still be on avatar_url.
    // Try avatar_file first, then avatar_url, then no-avatar.
    $stmt = null;
    $avatarCol = null;

    $sqlWithAvatarFile = "SELECT id, email, username, username_key, avatar_file, password_hash FROM {$table} WHERE email = ? OR username = ? LIMIT 1";
    $stmt = $db->prepare($sqlWithAvatarFile);
    if ($stmt) {
      $avatarCol = 'avatar_file';
    } else {
      $sqlWithAvatarUrl = "SELECT id, email, username, username_key, avatar_url, password_hash FROM {$table} WHERE email = ? OR username = ? LIMIT 1";
      $stmt = $db->prepare($sqlWithAvatarUrl);
      if ($stmt) {
        $avatarCol = 'avatar_url';
      } else {
        $sqlNoAvatar = "SELECT id, email, username, username_key, password_hash FROM {$table} WHERE email = ? OR username = ? LIMIT 1";
        $stmt = $db->prepare($sqlNoAvatar);
        if (!$stmt) return null;
      }
    }
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
        'username'  => (string)$row['username'],
        'username_key' => isset($row['username_key']) ? (string)$row['username_key'] : '',
        'avatar' => ($avatarCol && isset($row[$avatarCol])) ? (string)$row[$avatarCol] : ''
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
