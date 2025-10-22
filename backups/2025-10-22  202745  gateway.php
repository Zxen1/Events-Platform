<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$send = function(array $data, int $code = 200){
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_SLASHES);
  exit;
};

function load_db(){
  // Supports either PDO or mysqli as provided by config/config-db.php
  $pdo = null; $mysqli = null;

  $paths = [
    __DIR__ . '/../config/config-db.php',
    __DIR__ . '/config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php'
  ];
  foreach ($paths as $p) { if (is_file($p)) { require_once $p; break; } }

  // Common patterns we’ll accept from config:
  if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) $pdo = $GLOBALS['pdo'];
  if (isset($GLOBALS['db']) && $GLOBALS['db'] instanceof mysqli) $mysqli = $GLOBALS['db'];
  if (function_exists('getDb')) {
    $maybe = getDb();
    if ($maybe instanceof PDO) $pdo = $maybe;
    if ($maybe instanceof mysqli) $mysqli = $maybe;
  }
  if (!$pdo && defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER') && defined('DB_PASS')) {
    try {
      $dsn = 'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4';
      $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      ]);
    } catch(Throwable $e) { /* fall through to mysqli path */ }
  }
  if (!$pdo && !$mysqli && defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER') && defined('DB_PASS')) {
    $mysqli = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($mysqli && $mysqli->connect_errno) $mysqli = null;
    if ($mysqli) $mysqli->set_charset('utf8mb4');
  }
  return [$pdo, $mysqli];
}

function get_json_input(){
  $raw = file_get_contents('php://input') ?: '';
  $in = json_decode($raw, true);
  return is_array($in) ? $in : [];
}

[$pdo, $mysqli] = load_db();
$action = strtolower((string)($_GET['action'] ?? ''));

switch ($action) {
  case 'verify-login': {
    $in = get_json_input();
    $email = trim((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    if ($email === '' || $password === '') $send(['success'=>false,'error'=>'Missing credentials.'], 400);

    try {
      $row = null;

      if ($pdo instanceof PDO) {
        $st = $pdo->prepare('SELECT id, display_name, password_hash FROM members WHERE email = ? LIMIT 1');
        $st->execute([$email]);
        $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
      } elseif ($mysqli instanceof mysqli) {
        $st = $mysqli->prepare('SELECT id, display_name, password_hash FROM members WHERE email = ? LIMIT 1');
        if (!$st) throw new RuntimeException('DB prep failed.');
        $st->bind_param('s', $email);
        $st->execute();
        $res = $st->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $st->close();
      } else {
        $send(['success'=>false,'error'=>'Database unavailable.'], 500);
      }

      if (!$row || !password_verify($password, (string)$row['password_hash'])) {
        $send(['success'=>false], 200);
      }
      $send(['success'=>true,'member_id'=>(int)$row['id'],'display_name'=>(string)$row['display_name']], 200);
    } catch (Throwable $e) {
      error_log('verify-login error: '.$e->getMessage());
      $send(['success'=>false,'error'=>'Login failed.'], 500);
    }
  }

  case 'add-member': {
    // Forward to connector, sharing input + db handles via globals
    $GLOBALS['__FUNMAP_INPUT__'] = get_json_input();
    $GLOBALS['__FUNMAP_PDO__']   = $pdo;
    $GLOBALS['__FUNMAP_MYSQLI__']= $mysqli;

    $candidates = [
      __DIR__ . '/connectors/add-member.php',
      __DIR__ . '/../connectors/add-member.php'
    ];
    foreach ($candidates as $f) {
      if (is_file($f)) { require $f; exit; }
    }
    $send(['success'=>false,'error'=>'Connector not found.'], 404);
  }

  default:
    $send(['success'=>false,'error'=>'Unknown action.'], 400);
}
