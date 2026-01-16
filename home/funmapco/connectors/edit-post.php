<?php
// Debug: show actual PHP errors in response
set_exception_handler(function($e) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()]);
  exit;
});

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}
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

// Ensure we always return JSON, even on fatal errors
ob_start();
register_shutdown_function(function() {
  $err = error_get_last();
  if (!$err) return;
  $type = $err['type'] ?? 0;
  $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
  if (!in_array($type, $fatalTypes, true)) return;
  while (ob_get_level() > 0) { @ob_end_clean(); }
  if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
  }
  http_response_code(500);
  echo json_encode([
    'success' => false,
    'message_key' => 'msg_post_edit_error',
    'debug' => [
      'stage' => 'fatal',
      'type' => $type,
      'message' => (string)($err['message'] ?? ''),
      'file' => (string)($err['file'] ?? ''),
      'line' => (int)($err['line'] ?? 0),
    ],
  ], JSON_UNESCAPED_SLASHES);
});

if (!$viaGateway) {
  if (!function_exists('verify_api_key') || !verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
    http_response_code(403);
    exit(json_encode(['success'=>false,'error'=>'Forbidden']));
  }
}

function fail_key(int $code, string $messageKey, array $placeholders = null, array $debug = null): void
{
  http_response_code($code);
  $payload = ['success' => false, 'message_key' => $messageKey];
  if ($placeholders !== null) {
    $payload['placeholders'] = $placeholders;
  }
  if ($debug !== null) {
    $payload['debug'] = $debug;
  }
  echo json_encode($payload, JSON_UNESCAPED_SLASHES);
  exit;
}

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
  fail_key(500, 'msg_post_edit_error');
}

function abort_with_error(mysqli $mysqli, int $code, string $message, bool &$transactionActive): void
{
  if ($transactionActive) {
    $mysqli->rollback();
    $transactionActive = false;
  }
  $dbg = [
    'stage' => $message,
    'db_error' => $mysqli->error ?? '',
    'db_errno' => $mysqli->errno ?? 0,
  ];
  fail_key($code, 'msg_post_edit_error', null, $dbg);
}

function fetch_table_columns(mysqli $mysqli, string $table): array
{
  $table = trim($table);
  if ($table === '' || preg_match('/[^A-Za-z0-9_]/', $table)) {
    return [];
  }
  $columns = [];
  if ($result = $mysqli->query("SHOW COLUMNS FROM `{$table}`")) {
    while ($row = $result->fetch_assoc()) {
      if (isset($row['Field'])) {
        $columns[] = $row['Field'];
      }
    }
    $result->free();
  }
  return $columns;
}

function table_exists(mysqli $mysqli, string $table): bool
{
  $table = trim($table);
  if ($table === '' || preg_match('/[^A-Za-z0-9_]/', $table)) {
    return false;
  }
  $sql = "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1";
  $stmt = $mysqli->prepare($sql);
  if (!$stmt) return false;
  $stmt->bind_param('s', $table);
  $stmt->execute();
  $stmt->store_result();
  $exists = ($stmt->num_rows > 0);
  $stmt->close();
  return $exists;
}

function normalize_currency($currency): string
{
  if (!is_string($currency) && !is_numeric($currency)) {
    return '';
  }
  $normalized = strtoupper(trim((string) $currency));
  $normalized = preg_replace('/[^A-Z]/', '', $normalized);
  return $normalized !== null ? substr($normalized, 0, 12) : '';
}

function normalize_price_amount($value): ?string
{
  if ($value === null || $value === '') {
    return null;
  }
  if (is_numeric($value)) {
    return number_format((float) $value, 2, '.', '');
  }
  if (!is_string($value)) {
    return null;
  }
  $trimmed = trim($value);
  if ($trimmed === '') {
    return null;
  }
  $filtered = preg_replace('/[^0-9.,-]/', '', $trimmed);
  if ($filtered === null || $filtered === '' || $filtered === '-' || $filtered === '--') {
    return null;
  }
  if (substr_count($filtered, ',') > 1 && substr_count($filtered, '.') === 0) {
    $filtered = str_replace(',', '', $filtered);
  } elseif (substr_count($filtered, ',') === 1 && substr_count($filtered, '.') === 0) {
    $filtered = str_replace(',', '.', $filtered);
  } else {
    $filtered = str_replace(',', '', $filtered);
  }
  if (!is_numeric($filtered)) {
    return null;
  }
  return number_format((float) $filtered, 2, '.', '');
}

// Accept JSON payload
$data = null;
$rawInput = file_get_contents('php://input');
$decoded = json_decode($rawInput, true);
if (is_array($decoded)) {
  $data = $decoded;
}
if (!$data || !is_array($data) || empty($data['post_id'])) {
  fail_key(400, 'msg_post_edit_error');
}

$postId = (int)$data['post_id'];
$memberId = isset($data['member_id']) ? (int)$data['member_id'] : null;
$memberName = isset($data['member_name']) ? trim((string)$data['member_name']) : '';
$locQty = isset($data['loc_qty']) ? (int) $data['loc_qty'] : 1;
if ($locQty <= 0) $locQty = 1;

$transactionActive = false;
if (!$mysqli->begin_transaction()) {
  fail_key(500, 'msg_post_edit_error');
}
$transactionActive = true;

// 1. Update primary post entry
$stmt = $mysqli->prepare("UPDATE posts SET loc_qty = ?, checkout_title = ? WHERE id = ?");
$checkoutTitle = null;
$fieldsArr = $data['fields'] ?? [];
foreach ($fieldsArr as $fld) {
  if (isset($fld['key']) && strtolower(trim($fld['key'])) === 'checkout') {
    $checkoutTitle = (string)($fld['value'] ?? $fld['option_id'] ?? '');
    break;
  }
}
$stmt->bind_param('isi', $locQty, $checkoutTitle, $postId);
if (!$stmt->execute()) {
  abort_with_error($mysqli, 500, 'Failed to update post.', $transactionActive);
}
$stmt->close();

// 2. Clear old sub-data for this post before inserting new
// Map cards must be handled carefully if you have multiple, but for simplicity we replace
$mysqli->query("DELETE FROM post_ticket_pricing WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_item_pricing WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_sessions WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_amenities WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_map_cards WHERE post_id = $postId");

// 3. Insert new data (logic identical to add-post.php)
$byLoc = [];
foreach ($fieldsArr as $entry) {
  $loc = isset($entry['location_number']) ? (int)$entry['location_number'] : 1;
  if ($loc <= 0) $loc = 1;
  $byLoc[$loc][] = $entry;
}

$primaryTitle = '';
foreach ($byLoc as $locNum => $entries) {
  $card = [
    'title' => '', 'description' => null, 'custom_text' => null, 'custom_textarea' => null,
    'custom_dropdown' => null, 'custom_checklist' => null, 'custom_radio' => null,
    'public_email' => null, 'phone_prefix' => null, 'public_phone' => null,
    'venue_name' => null, 'address_line' => null, 'city' => null,
    'latitude' => null, 'longitude' => null, 'country_code' => null,
    'website_url' => null, 'tickets_url' => null, 'coupon_code' => null,
    'amenity_summary' => null, 'amenities_data' => null, 'age_rating' => null,
    'session_summary' => null, 'price_summary' => null,
  ];
  
  $sessionPricing = null;
  $itemPricing = null;
  $sessions = [];
  $ticketPricing = [];
  $hasTicketPrice = false;

  foreach ($entries as $e) {
    $type = (string)($e['type'] ?? '');
    $key = (string)($e['key'] ?? '');
    $val = $e['value'] ?? null;
    $baseType = preg_replace('/(-locked|-hidden)$/', '', $type);

    if ($baseType === 'session_pricing') {
      $sessionPricing = is_array($val) ? $val : null;
      if ($sessionPricing && !empty($sessionPricing['price_summary'])) {
        $card['price_summary'] = trim($sessionPricing['price_summary']);
        $hasTicketPrice = true;
      }
      continue;
    }
    if ($baseType === 'item-pricing') {
      $itemPricing = $val;
      if ($itemPricing && !empty($itemPricing['price_summary']) && !$hasTicketPrice) {
        $card['price_summary'] = trim($itemPricing['price_summary']);
      }
      continue;
    }
    // ... map other fields (title, desc, venue, etc.) ...
    if ($key === 'title' && is_string($val)) $card['title'] = trim($val);
    if (($key === 'description' || $baseType === 'description') && is_string($val)) $card['description'] = trim($val);
    if ($baseType === 'venue' && is_array($val)) {
      $card['venue_name'] = $val['venue_name'] ?? null;
      $card['address_line'] = $val['address_line'] ?? null;
      $card['latitude'] = $val['latitude'] ?? null;
      $card['longitude'] = $val['longitude'] ?? null;
      $card['country_code'] = $val['country_code'] ?? null;
    }
  }

  // Insert map card
  $stmtCard = $mysqli->prepare("INSERT INTO post_map_cards (post_id, subcategory_key, title, description, venue_name, address_line, latitude, longitude, country_code, price_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
  $subKey = $data['subcategory_key'] ?? '';
  $stmtCard->bind_param('isssssddss', $postId, $subKey, $card['title'], $card['description'], $card['venue_name'], $card['address_line'], $card['latitude'], $card['longitude'], $card['country_code'], $card['price_summary']);
  $stmtCard->execute();
  $mapCardId = $stmtCard->insert_id;
  $stmtCard->close();

  // Insert item pricing
  if ($itemPricing && !empty($itemPricing['item_name'])) {
    $stmtItem = $mysqli->prepare("INSERT INTO post_item_pricing (map_card_id, item_name, item_price, currency) VALUES (?, ?, ?, ?)");
    $price = normalize_price_amount($itemPricing['item_price']);
    $curr = normalize_currency($itemPricing['currency']);
    $stmtItem->bind_param('isss', $mapCardId, $itemPricing['item_name'], $price, $curr);
    $stmtItem->execute();
    $stmtItem->close();
  }
}

// 4. Revision
$revJson = json_encode($data, JSON_UNESCAPED_UNICODE);
$stmtRev = $mysqli->prepare("INSERT INTO post_revisions (post_id, post_title, editor_id, editor_name, change_type, change_summary, data_json) VALUES (?, ?, ?, ?, 'edit', 'Edited', ?)");
$title0 = $primaryTitle;
$stmtRev->bind_param('isiss', $postId, $title0, $memberId, $memberName, $revJson);
$stmtRev->execute();
$stmtRev->close();

$mysqli->commit();
echo json_encode(['success'=>true, 'message_key'=>'msg_post_edit_success']);
?>
