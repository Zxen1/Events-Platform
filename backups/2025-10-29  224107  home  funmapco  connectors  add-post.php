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

$authCandidates = [
  __DIR__ . '/../config/config-auth.php',
  dirname(__DIR__) . '/config/config-auth.php',
  dirname(__DIR__, 2) . '/config/config-auth.php',
  dirname(__DIR__, 3) . '/../config/config-auth.php',
  dirname(__DIR__) . '/../config/config-auth.php',
  __DIR__ . '/config-auth.php',
];

$authPath = null;
foreach ($authCandidates as $candidate) {
  if (is_file($candidate)) {
    $authPath = $candidate;
    break;
  }
}

if ($authPath !== null) {
  require_once $authPath;
}

header('Content-Type: application/json');

$viaGateway = defined('FUNMAP_GATEWAY_ACTIVE') && FUNMAP_GATEWAY_ACTIVE === true;

if (!$viaGateway) {
  if (!function_exists('verify_api_key') || !verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
    http_response_code(403);
    exit(json_encode(['success'=>false,'error'=>'Forbidden']));
  }
}

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
  http_response_code(500);
  exit(json_encode(['success'=>false,'error'=>'Database connection unavailable.']));
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!$data || empty($data['title'])) {
  http_response_code(400);
  exit(json_encode(['success'=>false,'error'=>'Invalid data']));
}

$subcategoryId = isset($data['subcategory_id']) ? (int)$data['subcategory_id'] : null;
$subcategoryName = isset($data['subcategory_name']) ? trim((string)$data['subcategory_name']) : '';
$memberId = isset($data['member_id']) ? (int)$data['member_id'] : null;
$memberName = isset($data['member_name']) ? trim((string)$data['member_name']) : '';
$title = trim((string)$data['title']);

if ($subcategoryId <= 0 || $subcategoryName === '' || $memberId <= 0 || $memberName === '' || $title === '') {
  http_response_code(400);
  exit(json_encode(['success'=>false,'error'=>'Missing required listing details.']));
}

$stmt = $mysqli->prepare(
  "INSERT INTO posts (subcategory_id, subcategory_name, member_id, member_name, title, status) VALUES (?, ?, ?, ?, ?, 'active')"
);

if (!$stmt) {
  http_response_code(500);
  exit(json_encode(['success'=>false,'error'=>'Unable to prepare post statement.']));
}

$stmt->bind_param('isiss', $subcategoryId, $subcategoryName, $memberId, $memberName, $title);

if (!$stmt->execute()) {
  http_response_code(500);
  $stmt->close();
  exit(json_encode(['success'=>false,'error'=>'Failed to save post.']));
}

$insertId = $stmt->insert_id;
$stmt->close();

echo json_encode(['success'=>true, 'insert_id'=>$insertId]);

if (!empty($API_KEY)) {
  @file_get_contents('https://funmap.com/connectors/add-log.php', false,
    stream_context_create([
      'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\nX-API-Key: $API_KEY\r\n",
        'content' => json_encode([
          'actor_type' => 'codex',
          'action' => 'add-post',
          'description' => 'Added post ID ' . $insertId
        ])
      ]
    ])
  );
}

?>
