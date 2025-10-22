<?php
// Bridge for frontend -> PHP connectors
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$send = function(array $data, int $code = 200) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_SLASHES);
  exit;
};

$action = isset($_GET['action']) ? strtolower(trim((string)$_GET['action'])) : '';
$raw    = file_get_contents('php://input') ?: '';
$input  = json_decode($raw, true);
if (!is_array($input)) { $input = []; }

// Load DB config and get a PDO handle in a robust way.
$pdo = null;
try {
  $cfgPath = __DIR__ . '/../config/config-db.php';
  if (!is_file($cfgPath)) $cfgPath = __DIR__ . '/config/config-db.php';
  if (is_file($cfgPath)) require_once $cfgPath;

  if ($pdo instanceof PDO) {
    // ok
  } elseif (function_exists('getDb')) {
    $pdo = getDb();
  } elseif (
    defined('DB_HOST') && defined('DB_NAME') &&
    defined('DB_USER') && defined('DB_PASS')
  ) {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
  }
} catch (Throwable $e) {
  // Defer error handling to each action to keep messages consistent
}

// Route
switch ($action) {
  case 'add-member': {
    // Hand off to connectors/add-member.php so logic stays in one place
    $connector = __DIR__ . '/connectors/add-member.php';
    if (!is_file($connector)) $connector = __DIR__ . '/../connectors/add-member.php';
    if (!is_file($connector)) $send(['success'=>false,'error'=>'Connector not found.'], 404);

    // Make common vars available to connector
    $GLOBALS['__FUNMAP_INPUT__'] = $input;
    $GLOBALS['__FUNMAP_PDO__']   = $pdo;
    require $connector;
    // The connector must echo JSON and exit; if it returns, ensure no fall-through
    if (!headers_sent()) $send(['success'=>false,'error'=>'No response from connector.'], 500);
    exit;
  }

  case 'verify-login': {
    if (!$pdo instanceof PDO) {
      $send(['success'=>false,'error'=>'Database unavailable.'], 500);
    }
    $email    = isset($input['username']) ? trim((string)$input['username']) : '';
    $password = isset($input['password']) ? (string)$input['password'] : '';

    if ($email === '' || $password === '') {
      $send(['success'=>false,'error'=>'Missing credentials.'], 400);
    }

    try {
      $stmt = $pdo->prepare('SELECT id, display_name, password_hash FROM members WHERE email = ? LIMIT 1');
      $stmt->execute([$email]);
      $row = $stmt->fetch();
      if (!$row || !password_verify($password, (string)$row['password_hash'])) {
        $send(['success'=>false], 200);
      }
      $send([
        'success' => true,
        'member_id' => (int)$row['id'],
        'display_name' => (string)$row['display_name']
      ], 200);
    } catch (Throwable $e) {
      $send(['success'=>false,'error'=>'Login failed.'], 500);
    }
  }

  default:
    $send(['success'=>false,'error'=>'Unknown action.'], 400);
}
