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
    // Also select deleted_at to handle soft-deleted accounts (reactivation on login)
    $stmt = null;
    $avatarCol = null;

    // IMPORTANT:
    // - Database schemas evolve; do not select columns that may not exist (mysqli->prepare will fail).
    // - Keep this SELECT limited to columns that exist in current funmapco_db views/tables (see latest dump).
    $sqlWithAvatarFile = "SELECT id, account_email, username, username_key, avatar_file, password_hash, map_lighting, map_style, favorites, recent, country, filters_json, filters_hash, filters_version, filters_updated_at, deleted_at FROM {$table} WHERE account_email = ? OR username = ? LIMIT 1";
    $stmt = $db->prepare($sqlWithAvatarFile);
    if ($stmt) {
      $avatarCol = 'avatar_file';
    } else {
      $sqlWithAvatarUrl = "SELECT id, account_email, username, username_key, avatar_url, password_hash, map_lighting, map_style, favorites, recent, country, filters_json, filters_hash, filters_version, filters_updated_at, deleted_at FROM {$table} WHERE account_email = ? OR username = ? LIMIT 1";
      $stmt = $db->prepare($sqlWithAvatarUrl);
      if ($stmt) {
        $avatarCol = 'avatar_url';
      } else {
        $sqlNoAvatar = "SELECT id, account_email, username, username_key, password_hash, map_lighting, map_style, favorites, recent, country, filters_json, filters_hash, filters_version, filters_updated_at, deleted_at FROM {$table} WHERE account_email = ? OR username = ? LIMIT 1";
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
    
    // Check if account was soft-deleted (scheduled for deletion)
    $reactivated = false;
    if (!empty($row['deleted_at'])) {
      // Clear deleted_at to reactivate the account
      $storageTable = ($table === 'admins') ? 'funmapco_system.admins' : 'funmapco_content.members';
      $reactivateStmt = $db->prepare("UPDATE {$storageTable} SET deleted_at = NULL WHERE id = ?");
      if ($reactivateStmt) {
        $reactivateStmt->bind_param('i', $row['id']);
        $reactivateStmt->execute();
        $reactivateStmt->close();
        $reactivated = true;
      }
    }
    
    return [
      'success' => true,
      'role'    => $table === 'admins' ? 'admin' : 'member',
      'reactivated' => $reactivated,
      'user'    => [
        'id'    => (int)$row['id'],
        'account_email' => isset($row['account_email']) ? (string)$row['account_email'] : '',
        'username'  => (string)$row['username'],
        'username_key' => isset($row['username_key']) ? (string)$row['username_key'] : '',
        'avatar' => ($avatarCol && isset($row[$avatarCol])) ? (string)$row[$avatarCol] : '',
        // Keep response keys stable for frontend, even if some values are not stored on the user row.
        'language' => null,
        'currency' => null,
        'country_code' => isset($row['country']) ? (string)$row['country'] : null,
        'map_lighting' => isset($row['map_lighting']) ? (string)$row['map_lighting'] : null,
        'map_style' => isset($row['map_style']) ? (string)$row['map_style'] : null,
        'timezone' => null,
        'favorites' => isset($row['favorites']) ? (string)$row['favorites'] : null,
        'recent' => isset($row['recent']) ? (string)$row['recent'] : null,
        'filters_json' => isset($row['filters_json']) ? (string)$row['filters_json'] : null,
        'filters_hash' => isset($row['filters_hash']) ? (string)$row['filters_hash'] : null,
        'filters_version' => isset($row['filters_version']) ? (int)$row['filters_version'] : null,
        'filters_updated_at' => isset($row['filters_updated_at']) ? (string)$row['filters_updated_at'] : null
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
