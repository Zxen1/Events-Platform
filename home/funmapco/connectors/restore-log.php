<?php
$configCandidates = [
  __DIR__ . '/../config/config-db.php',
  dirname(__DIR__) . '/config/config-db.php',
  dirname(__DIR__, 2) . '/config/config-db.php',
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

// === Security Check ===
if (!verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
  http_response_code(403);
  exit(json_encode(['error' => 'Forbidden']));
}

// === Access Control: Only admin or Codex ===
$actor = $_GET['actor'] ?? 'unknown';
if (!in_array($actor, ['admin', 'codex'])) {
  http_response_code(403);
  exit(json_encode(['error' => 'Access denied']));
}

// === Validate log ID ===
$log_id = intval($_GET['log_id'] ?? 0);
if ($log_id <= 0) exit(json_encode(['error' => 'Missing or invalid log ID']));

// === Step 1: Find the log entry ===
$log = $mysqli->query("SELECT * FROM logs WHERE id=$log_id")->fetch_assoc();
if (!$log) exit(json_encode(['error' => 'Log not found']));

// === Step 2: Extract details ===
$action = $log['action'];
$description = $log['description'];

// === Step 3: Identify target table ===
// Expected formats: "Added post ID 45", "Deleted member ID 12", etc.
if (preg_match('/(post|member|media).*ID\s+(\d+)/i', $description, $m)) {
  $type = strtolower($m[1]);
  $target_id = intval($m[2]);
} else {
  exit(json_encode(['error' => 'Cannot identify target record']));
}

// === Step 4: Get previous backup data ===
$table = $type . 's';
$backup = $mysqli->query("SELECT backup_json FROM $table WHERE id=$target_id")->fetch_assoc();
if (!$backup || !$backup['backup_json']) {
  exit(json_encode(['error' => 'No backup data available for this record']));
}

$data = json_decode($backup['backup_json'], true);
if (!$data) exit(json_encode(['error' => 'Invalid backup format']));

// === Step 5: Restore previous state ===
$columns = array_keys($data);
$placeholders = implode('=?, ', $columns) . '=?';
$types = str_repeat('s', count($columns)); // all strings for simplicity
$values = array_values($data);
$values[] = $target_id;

$stmt = $mysqli->prepare("UPDATE $table SET $placeholders WHERE id=?");
$stmt->bind_param($types . 'i', ...$values);
$stmt->execute();

// === Step 6: Record restoration ===
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$stmt2 = $mysqli->prepare("INSERT INTO logs (actor_type, action, description, ip_address)
                           VALUES ('system', 'restore', ?, ?)");
$desc = "Restored $type ID $target_id from log ID $log_id";
$stmt2->bind_param('ss', $desc, $ip);
$stmt2->execute();

// === Step 7: Universal Log Callback ===
$log_url = $BASE_URL . '/connectors/add-log.php';
$context = stream_context_create([
  'http' => [
    'method'  => 'POST',
    'header'  => "Content-Type: application/json\r\nX-API-Key: $API_KEY\r\n",
    'content' => json_encode([
      'actor_type'  => 'system',
      'action'      => 'restore',
      'description' => $desc
    ])
  ]
]);
@file_get_contents($log_url, false, $context);

// === Final Response ===
echo json_encode(['success' => true, 'restored_id' => $target_id, 'from_log' => $log_id]);
?>
