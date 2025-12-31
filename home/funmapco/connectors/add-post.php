<?php
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

if (!$viaGateway) {
  if (!function_exists('verify_api_key') || !verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
    http_response_code(403);
    exit(json_encode(['success'=>false,'error'=>'Forbidden']));
  }
}

function fail_key(int $code, string $messageKey, array $placeholders = null): void
{
  http_response_code($code);
  $payload = ['success' => false, 'message_key' => $messageKey];
  if ($placeholders !== null) {
    $payload['placeholders'] = $placeholders;
  }
  echo json_encode($payload, JSON_UNESCAPED_SLASHES);
  exit;
}

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
  fail_key(500, 'msg_post_create_error');
}

function abort_with_error(mysqli $mysqli, int $code, string $message, bool &$transactionActive): void
{
  if ($transactionActive) {
    $mysqli->rollback();
    $transactionActive = false;
  }
  // No hardcoded strings: return a message key for UI.
  fail_key($code, 'msg_post_create_error');
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

function bind_statement_params(mysqli_stmt $stmt, string $types, &...$params): bool
{
  $arguments = [$types];
  foreach ($params as &$param) {
    $arguments[] = &$param;
  }
  return call_user_func_array([$stmt, 'bind_param'], $arguments);
}

// Accept JSON or multipart form-data.
$data = null;
$rawInput = file_get_contents('php://input');
if (!empty($_POST['payload'])) {
  $decoded = json_decode((string) $_POST['payload'], true);
  if (is_array($decoded)) {
    $data = $decoded;
  }
} else {
  $decoded = json_decode($rawInput, true);
  if (is_array($decoded)) {
    $data = $decoded;
  }
}
if (!$data || !is_array($data)) {
  fail_key(400, 'msg_post_create_error');
}

$subcategoryKey = isset($data['subcategory_key']) ? trim((string)$data['subcategory_key']) : '';
$memberId = isset($data['member_id']) ? (int)$data['member_id'] : null;
$memberName = isset($data['member_name']) ? trim((string)$data['member_name']) : '';
$memberType = isset($data['member_type']) ? trim((string)$data['member_type']) : 'member';
$locQty = isset($data['loc_qty']) ? (int) $data['loc_qty'] : 1;
if ($locQty <= 0) $locQty = 1;

// Check if user is admin
$isAdmin = strtolower($memberType) === 'admin' || 
           (isset($data['member']) && is_array($data['member']) && 
            (strtolower($data['member']['type'] ?? '') === 'admin' || 
             !empty($data['member']['isAdmin'])));

// Check if admin requested to skip payment
$skipPayment = $isAdmin && !empty($data['skip_payment']);

// IMPORTANT: posts are keyed by subcategory_key, NOT numeric subcategory_id.
// subcategory_id may exist in the system DB for admin organization, but must NOT be required here.
if ($subcategoryKey === '') {
  fail_key(400, 'msg_post_create_no_category');
}
// member_id is required by the posts schema (NOT NULL).
if ($memberId === null || $memberId <= 0) {
  fail_key(400, 'msg_post_create_error');
}
// member_name is optional (DB allows NULL); do not block post creation on it.

$transactionActive = false;

if (!$mysqli->begin_transaction()) {
  fail_key(500, 'msg_post_create_error');
}

$transactionActive = true;

// Determine payment status - admins can skip payment if requested, others get 'pending'
$paymentStatus = $skipPayment ? 'paid' : 'pending';

// Check if posts table has payment_status column
$postColumns = fetch_table_columns($mysqli, 'posts');
$hasPaymentStatus = in_array('payment_status', $postColumns, true);

if ($hasPaymentStatus) {
  $stmt = $mysqli->prepare(
    "INSERT INTO posts (member_id, member_name, subcategory_key, loc_qty, visibility, payment_status) VALUES (?, ?, ?, ?, 'paused', ?)"
  );
} else {
  $stmt = $mysqli->prepare(
    "INSERT INTO posts (member_id, member_name, subcategory_key, loc_qty, visibility) VALUES (?, ?, ?, ?, 'paused')"
  );
}

if (!$stmt) {
  abort_with_error($mysqli, 500, 'Unable to prepare post statement.', $transactionActive);
}

if ($hasPaymentStatus) {
  if (!bind_statement_params($stmt, 'isiss', $memberId, $memberName, $subcategoryKey, $locQty, $paymentStatus)) {
    $stmt->close();
    abort_with_error($mysqli, 500, 'Failed to bind post parameters.', $transactionActive);
  }
} else {
  if (!bind_statement_params($stmt, 'isis', $memberId, $memberName, $subcategoryKey, $locQty)) {
    $stmt->close();
    abort_with_error($mysqli, 500, 'Failed to bind post parameters.', $transactionActive);
}
}

if (!$stmt->execute()) {
  $stmt->close();
  abort_with_error($mysqli, 500, 'Failed to save post.', $transactionActive);
}

$insertId = $stmt->insert_id;
$stmt->close();

// ---------------------------------------------------------------------------
// Build post_map_cards + post_children + post_revisions + post_media (uploads)
// ---------------------------------------------------------------------------

function load_bunny_settings(mysqli $mysqli): array
{
  $out = [
    'folder_post_images' => '',
    'storage_api_key' => '',
    'storage_zone_name' => '',
  ];
  $res = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('folder_post_images','storage_api_key','storage_zone_name')");
  if ($res) {
    while ($row = $res->fetch_assoc()) {
      $k = $row['setting_key'] ?? '';
      $v = isset($row['setting_value']) ? trim((string)$row['setting_value']) : '';
      if (array_key_exists($k, $out)) $out[$k] = $v;
    }
    $res->free();
  }
  return $out;
}

function bunny_upload_bytes(string $storageApiKey, string $storageZoneName, string $fullPath, string $bytes, int &$httpCodeOut, string &$respOut): bool
{
  $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . ltrim($fullPath, '/');
  $ch = curl_init($apiUrl);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_POSTFIELDS => $bytes,
    CURLOPT_HTTPHEADER => [
      'AccessKey: ' . $storageApiKey,
      'Content-Type: application/octet-stream',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
  ]);
  $resp = curl_exec($ch);
  $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $httpCodeOut = $httpCode;
  $respOut = is_string($resp) ? $resp : '';
  return ($httpCode >= 200 && $httpCode < 300);
}

function bunny_delete_path(string $storageApiKey, string $storageZoneName, string $fullPath): void
{
  $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . ltrim($fullPath, '/');
  $ch = curl_init($apiUrl);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'DELETE',
    CURLOPT_HTTPHEADER => [
      'AccessKey: ' . $storageApiKey,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
  ]);
  curl_exec($ch);
  curl_close($ch);
}

// Group fields by location_number
$fields = $data['fields'] ?? [];
if (!is_array($fields)) $fields = [];
$byLoc = [];
foreach ($fields as $entry) {
  if (!is_array($entry)) continue;
  $loc = isset($entry['location_number']) ? (int)$entry['location_number'] : 1;
  if ($loc <= 0) $loc = 1;
  if (!isset($byLoc[$loc])) $byLoc[$loc] = [];
  $byLoc[$loc][] = $entry;
}
if (!$byLoc) $byLoc = [1 => []];

// Insert map cards
$mapCardIds = [];
$primaryTitle = '';
foreach ($byLoc as $locNum => $entries) {
  $card = [
    'title' => '',
    'description' => null,
    'email' => null,
    'phone' => null,
    'venue_name' => null,
    'address_line' => null,
    'latitude' => null,
    'longitude' => null,
    'website_url' => null,
    'tickets_url' => null,
    'checkout_title' => null,
    'session_summary' => null,
    'price_summary' => null,
  ];
  $sessions = [];
  $ticketPricing = [];
  $itemPricing = null;
  $checkout = null;

  foreach ($entries as $e) {
    $type = isset($e['type']) ? (string)$e['type'] : '';
    $key = isset($e['key']) ? (string)$e['key'] : '';
    $val = $e['value'] ?? null;

    $baseType = preg_replace('/(-locked|-hidden)$/', '', $type);

    if ($key === 'checkout' || $baseType === 'checkout') {
      $checkout = $val;
      continue;
    }
    if ($baseType === 'sessions') {
      $sessions = is_array($val) ? $val : [];
      continue;
    }
    if ($baseType === 'ticket-pricing') {
      $ticketPricing = is_array($val) ? $val : [];
      continue;
    }
    if ($baseType === 'item-pricing') {
      $itemPricing = $val;
      continue;
    }

    // Map common fieldsets to map card columns.
    if ($key === 'title' && is_string($val)) $card['title'] = trim($val);
    if (($key === 'description' || $baseType === 'description' || $baseType === 'text-area') && is_string($val)) $card['description'] = trim($val);
    if ($baseType === 'email' && is_string($val)) $card['email'] = trim($val);
    if ($baseType === 'phone' && is_string($val)) $card['phone'] = trim($val);
    if (($baseType === 'website-url' || $baseType === 'url') && is_string($val)) $card['website_url'] = trim($val);
    if ($baseType === 'tickets-url' && is_string($val)) $card['tickets_url'] = trim($val);

    if ($baseType === 'venue' && is_array($val)) {
      $card['venue_name'] = isset($val['venue_name']) ? trim((string)$val['venue_name']) : null;
      $card['address_line'] = isset($val['address_line']) ? trim((string)$val['address_line']) : null;
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : null;
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : null;
      continue;
    }
    if (($baseType === 'address' || $baseType === 'city') && is_array($val)) {
      $card['address_line'] = isset($val['address_line']) ? trim((string)$val['address_line']) : $card['address_line'];
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : $card['latitude'];
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : $card['longitude'];
      continue;
    }
  }

  // Require title + lat/lng for a map card.
  if (trim((string)$card['title']) === '') {
    abort_with_error($mysqli, 400, 'Missing title', $transactionActive);
  }
  if ($card['latitude'] === null || $card['longitude'] === null || (float)$card['latitude'] == 0.0 || (float)$card['longitude'] == 0.0) {
    abort_with_error($mysqli, 400, 'Missing coordinates', $transactionActive);
  }

  // checkout_title
  if (is_array($checkout)) {
    if (!empty($checkout['value'])) {
      $card['checkout_title'] = (string)$checkout['value'];
    } elseif (!empty($checkout['option_id'])) {
      $card['checkout_title'] = (string)$checkout['option_id'];
    }
  }

  // session_summary (simple)
  if (is_array($sessions) && count($sessions) > 0) {
    $card['session_summary'] = 'Sessions: ' . count($sessions);
  }

  // price_summary (simple)
  $priceCount = 0;
  if (is_array($ticketPricing)) {
    foreach ($ticketPricing as $seat) {
      if (!is_array($seat)) continue;
      $tiers = $seat['tiers'] ?? [];
      if (is_array($tiers)) $priceCount += count($tiers);
    }
  }
  if (is_array($itemPricing) && isset($itemPricing['variants']) && is_array($itemPricing['variants'])) {
    $priceCount += count($itemPricing['variants']);
  }
  if ($priceCount > 0) $card['price_summary'] = 'Prices: ' . $priceCount;

  $stmtCard = $mysqli->prepare("INSERT INTO post_map_cards (post_id, subcategory_key, title, description, email, phone, venue_name, address_line, latitude, longitude, website_url, tickets_url, checkout_title, session_summary, price_summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
  if (!$stmtCard) abort_with_error($mysqli, 500, 'Prepare map card', $transactionActive);

  $postIdParam = $insertId;
  $subKeyParam = $subcategoryKey;
  $titleParam = $card['title'];
  $descParam = $card['description'];
  $emailParam = $card['email'];
  $phoneParam = $card['phone'];
  $venueNameParam = $card['venue_name'];
  $addrLineParam = $card['address_line'];
  $latParam = (float)$card['latitude'];
  $lngParam = (float)$card['longitude'];
  $websiteParam = $card['website_url'];
  $ticketsParam = $card['tickets_url'];
  $checkoutTitleParam = $card['checkout_title'];
  $sessSumParam = $card['session_summary'];
  $priceSumParam = $card['price_summary'];

  // Bind + insert map card
  $stmtCard->bind_param('issssssssddssss', $postIdParam, $subKeyParam, $titleParam, $descParam, $emailParam, $phoneParam, $venueNameParam, $addrLineParam, $latParam, $lngParam, $websiteParam, $ticketsParam, $checkoutTitleParam, $sessSumParam, $priceSumParam);
  if (!$stmtCard->execute()) { $stmtCard->close(); abort_with_error($mysqli, 500, 'Insert map card', $transactionActive); }
  $mapCardId = $stmtCard->insert_id;
  $stmtCard->close();
  $mapCardIds[$locNum] = $mapCardId;
  if ($primaryTitle === '') {
    $primaryTitle = (string) $titleParam;
  }

  // Insert children: sessions
  if (is_array($sessions)) {
    $stmtChild = $mysqli->prepare("INSERT INTO post_children (map_card_id, session_date, session_time, seating_area, pricing_tier, variant_name, price, currency, created_at, updated_at)
      VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NOW(), NOW())");
    if ($stmtChild) {
      foreach ($sessions as $s) {
        if (!is_array($s)) continue;
        $date = isset($s['date']) ? (string)$s['date'] : '';
        $times = isset($s['times']) && is_array($s['times']) ? $s['times'] : [];
        foreach ($times as $t) {
          $time = is_string($t) ? trim($t) : '';
          if ($date === '' || $time === '') continue;
          $stmtChild->bind_param('iss', $mapCardId, $date, $time);
          if (!$stmtChild->execute()) { $stmtChild->close(); abort_with_error($mysqli, 500, 'Insert child sessions', $transactionActive); }
        }
      }
      $stmtChild->close();
    }
  }

  // Insert children: ticket pricing
  if (is_array($ticketPricing)) {
    $stmtPrice = $mysqli->prepare("INSERT INTO post_children (map_card_id, session_date, session_time, seating_area, pricing_tier, variant_name, price, currency, created_at, updated_at)
      VALUES (?, NULL, NULL, ?, ?, NULL, ?, ?, NOW(), NOW())");
    if ($stmtPrice) {
      foreach ($ticketPricing as $seat) {
        if (!is_array($seat)) continue;
        $seatName = isset($seat['seating_area']) ? (string)$seat['seating_area'] : '';
        $tiers = isset($seat['tiers']) && is_array($seat['tiers']) ? $seat['tiers'] : [];
        foreach ($tiers as $tier) {
          if (!is_array($tier)) continue;
          $tierName = isset($tier['pricing_tier']) ? (string)$tier['pricing_tier'] : '';
          $curr = isset($tier['currency']) ? normalize_currency($tier['currency']) : '';
          $amt = normalize_price_amount($tier['price'] ?? null);
          if ($seatName === '' || $tierName === '' || $curr === '' || $amt === null) continue;
          $stmtPrice->bind_param('issss', $mapCardId, $seatName, $tierName, $amt, $curr);
          if (!$stmtPrice->execute()) { $stmtPrice->close(); abort_with_error($mysqli, 500, 'Insert child pricing', $transactionActive); }
        }
      }
      $stmtPrice->close();
    }
  }

  // Insert children: item pricing
  if (is_array($itemPricing) && isset($itemPricing['variants']) && is_array($itemPricing['variants'])) {
    $stmtItem = $mysqli->prepare("INSERT INTO post_children (map_card_id, session_date, session_time, seating_area, pricing_tier, variant_name, price, currency, created_at, updated_at)
      VALUES (?, NULL, NULL, NULL, NULL, ?, ?, ?, NOW(), NOW())");
    if ($stmtItem) {
      foreach ($itemPricing['variants'] as $v) {
        if (!is_array($v)) continue;
        $vn = isset($v['variant_name']) ? (string)$v['variant_name'] : '';
        $curr = isset($v['currency']) ? normalize_currency($v['currency']) : '';
        $amt = normalize_price_amount($v['price'] ?? null);
        if ($vn === '' || $curr === '' || $amt === null) continue;
        $stmtItem->bind_param('isss', $mapCardId, $vn, $amt, $curr);
        if (!$stmtItem->execute()) { $stmtItem->close(); abort_with_error($mysqli, 500, 'Insert child item pricing', $transactionActive); }
      }
      $stmtItem->close();
    }
  }
}

// Upload media (if any) and insert post_media rows
$uploadedPaths = [];
$mediaIds = [];
if (!empty($_FILES['images']) && is_array($_FILES['images']['name'])) {
  $settings = load_bunny_settings($mysqli);
  $folder = rtrim((string)$settings['folder_post_images'], '/');
  $storageApiKey = (string)$settings['storage_api_key'];
  $storageZoneName = (string)$settings['storage_zone_name'];
  if ($folder === '' || $storageApiKey === '' || $storageZoneName === '') {
    abort_with_error($mysqli, 500, 'Missing storage settings', $transactionActive);
  }
  $cdnPath = preg_replace('#^https?://[^/]+/#', '', $folder);
  $cdnPath = rtrim((string)$cdnPath, '/');

  $utcMinus12 = new DateTimeZone('Etc/GMT+12');
  $now = new DateTime('now', $utcMinus12);
  $monthFolder = $now->format('Y-m');

  $meta = [];
  if (!empty($_POST['images_meta'])) {
    $m = json_decode((string)$_POST['images_meta'], true);
    if (is_array($m)) $meta = $m;
  }

  $count = count($_FILES['images']['name']);
  $stmtMedia = $mysqli->prepare("INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, backup_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())");
  if (!$stmtMedia) abort_with_error($mysqli, 500, 'Prepare media', $transactionActive);

  for ($i = 0; $i < $count; $i++) {
    $tmp = $_FILES['images']['tmp_name'][$i] ?? '';
    if (!$tmp || !is_uploaded_file($tmp)) continue;
    $origName = (string)($_FILES['images']['name'][$i] ?? 'image');
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    if ($ext === '') $ext = 'jpg';
    $hash = substr(md5(uniqid('', true) . random_bytes(8)), 0, 6);
    $finalFilename = $insertId . '-' . $hash . '.' . $ext;
    $fullPath = $cdnPath . '/' . $monthFolder . '/' . $finalFilename;

    $bytes = file_get_contents($tmp);
    if ($bytes === false) abort_with_error($mysqli, 500, 'Read image bytes', $transactionActive);
    $httpCode = 0;
    $resp = '';
    if (!bunny_upload_bytes($storageApiKey, $storageZoneName, $fullPath, $bytes, $httpCode, $resp)) {
      // cleanup uploads done so far
      foreach ($uploadedPaths as $p) { bunny_delete_path($storageApiKey, $storageZoneName, $p); }
      abort_with_error($mysqli, 500, 'Upload failed', $transactionActive);
    }
    $uploadedPaths[] = $fullPath;
    $publicUrl = $folder . '/' . $monthFolder . '/' . $finalFilename;
    $fileSize = (int)($_FILES['images']['size'][$i] ?? 0);
    $backupJson = null;
    if (isset($meta[$i]) && is_array($meta[$i])) {
      $backupJson = json_encode($meta[$i], JSON_UNESCAPED_UNICODE);
    }
    $stmtMedia->bind_param('iissis', $memberId, $insertId, $finalFilename, $publicUrl, $fileSize, $backupJson);
    if (!$stmtMedia->execute()) {
      foreach ($uploadedPaths as $p) { bunny_delete_path($storageApiKey, $storageZoneName, $p); }
      $stmtMedia->close();
      abort_with_error($mysqli, 500, 'Insert media', $transactionActive);
    }
    $mediaIds[] = $stmtMedia->insert_id;
  }
  $stmtMedia->close();
}

// Update map cards with media_ids (same list for now)
if ($mediaIds) {
  $mediaJson = json_encode($mediaIds, JSON_UNESCAPED_UNICODE);
  $stmtUpd = $mysqli->prepare("UPDATE post_map_cards SET media_ids = ? WHERE post_id = ?");
  if ($stmtUpd) {
    $stmtUpd->bind_param('si', $mediaJson, $insertId);
    $stmtUpd->execute();
    $stmtUpd->close();
  }
}

// Insert revision snapshot
$revJson = json_encode($data, JSON_UNESCAPED_UNICODE);
$stmtRev = $mysqli->prepare("INSERT INTO post_revisions (post_id, post_title, editor_id, editor_name, change_type, change_summary, data_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, 'create', 'Created', ?, NOW(), NOW())");
if ($stmtRev) {
  $title0 = $primaryTitle;
  $stmtRev->bind_param('isiss', $insertId, $title0, $memberId, $memberName, $revJson);
  $stmtRev->execute();
  $stmtRev->close();
}

if (!$mysqli->commit()) {
  abort_with_error($mysqli, 500, 'Failed to finalize post.', $transactionActive);
}
$transactionActive = false;

$msgKey = $mediaIds ? 'msg_post_create_with_images' : 'msg_post_create_success';
echo json_encode(['success'=>true, 'insert_id'=>$insertId, 'message_key'=>$msgKey]);
exit;

$fieldsRaw = $data['fields'] ?? [];
if (is_string($fieldsRaw) && $fieldsRaw !== '') {
  $decodedFields = json_decode($fieldsRaw, true);
  if (json_last_error() === JSON_ERROR_NONE && is_array($decodedFields)) {
    $fieldsRaw = $decodedFields;
  } else {
    abort_with_error($mysqli, 400, 'Invalid field payload format.', $transactionActive);
  }
}

if ($fieldsRaw === null) {
  $fieldsRaw = [];
}

if (!is_array($fieldsRaw)) {
  abort_with_error($mysqli, 400, 'Field data must be an array.', $transactionActive);
}

$preparedFields = [];
foreach ($fieldsRaw as $index => $fieldEntry) {
  if (!is_array($fieldEntry)) {
    abort_with_error($mysqli, 400, 'Invalid field entry at position ' . ($index + 1) . '.', $transactionActive);
  }

  $fieldIdRaw = $fieldEntry['field_id'] ?? $fieldEntry['id'] ?? null;
  if (is_int($fieldIdRaw) || is_float($fieldIdRaw)) {
    $fieldId = (string) $fieldIdRaw;
  } elseif (is_string($fieldIdRaw)) {
    $fieldId = trim($fieldIdRaw);
  } else {
    $fieldId = '';
  }

  if ($fieldId === '') {
    abort_with_error($mysqli, 400, 'Missing field identifier at position ' . ($index + 1) . '.', $transactionActive);
  }

  $fieldLabelRaw = $fieldEntry['name'] ?? $fieldEntry['field_label'] ?? '';
  if (is_string($fieldLabelRaw) || is_numeric($fieldLabelRaw)) {
    $fieldLabel = trim((string) $fieldLabelRaw);
  } else {
    $fieldLabel = '';
  }

  if ($fieldLabel === '') {
    abort_with_error($mysqli, 400, 'Missing field label for field ' . $fieldId . '.', $transactionActive);
  }

  if (!array_key_exists('value', $fieldEntry)) {
    abort_with_error($mysqli, 400, 'Missing field value for field ' . $fieldId . '.', $transactionActive);
  }

  $fieldValueRaw = $fieldEntry['value'];
  $isRequired = false;
  if (array_key_exists('required', $fieldEntry)) {
    $isRequired = filter_var($fieldEntry['required'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($isRequired === null) {
      $isRequired = !empty($fieldEntry['required']);
    }
  }

  if (is_array($fieldValueRaw) || is_object($fieldValueRaw)) {
    $encoded = json_encode($fieldValueRaw, JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
      abort_with_error($mysqli, 400, 'Unable to encode field value for field ' . $fieldId . '.', $transactionActive);
    }
    $fieldValue = $encoded;
  } elseif (is_bool($fieldValueRaw)) {
    $fieldValue = $fieldValueRaw ? '1' : '0';
  } elseif ($fieldValueRaw === null) {
    $fieldValue = '';
  } else {
    $fieldValue = trim((string) $fieldValueRaw);
  }

  if ($isRequired && $fieldValue === '') {
    abort_with_error($mysqli, 400, 'Field ' . $fieldLabel . ' is required.', $transactionActive);
  }

  if (!$isRequired && $fieldValue === '') {
    continue;
  }

  $fieldId = substr($fieldId, 0, 128);
  $fieldLabel = substr($fieldLabel, 0, 255);
  if (strlen($fieldValue) > 65535) {
    $fieldValue = substr($fieldValue, 0, 65535);
  }

  $preparedFields[] = [
    'field_id' => $fieldId,
    'label' => $fieldLabel,
    'value' => $fieldValue,
  ];
}

if ($preparedFields) {
  $fieldStmt = $mysqli->prepare(
    'INSERT INTO field_values (post_id, field_id, field_label, value, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())'
  );

  if (!$fieldStmt) {
    abort_with_error($mysqli, 500, 'Unable to prepare field insert.', $transactionActive);
  }

  $postIdParam = $insertId;
  $fieldIdParam = '';
  $fieldLabelParam = '';
  $fieldValueParam = '';

  if (!$fieldStmt->bind_param('isss', $postIdParam, $fieldIdParam, $fieldLabelParam, $fieldValueParam)) {
    $fieldStmt->close();
    abort_with_error($mysqli, 500, 'Failed to bind field parameters.', $transactionActive);
  }

  foreach ($preparedFields as $preparedField) {
    $fieldIdParam = $preparedField['field_id'];
    $fieldLabelParam = $preparedField['label'];
    $fieldValueParam = $preparedField['value'];

    if (!$fieldStmt->execute()) {
      $fieldStmt->close();
      abort_with_error($mysqli, 500, 'Failed to save field values.', $transactionActive);
    }
  }

  $fieldStmt->close();
}

$listingData = $data['listing'] ?? [];
if (is_string($listingData) && $listingData !== '') {
  $decodedListing = json_decode($listingData, true);
  if (json_last_error() === JSON_ERROR_NONE && is_array($decodedListing)) {
    $listingData = $decodedListing;
  } else {
    $listingData = [];
  }
}

if (!is_array($listingData)) {
  $listingData = [];
}

$listingCurrency = normalize_currency($listingData['currency'] ?? '');
$listingAmount = normalize_price_amount($listingData['price'] ?? ($listingData['amount'] ?? null));

if ($listingCurrency !== '' || $listingAmount !== null) {
  $priceStored = false;

  $postColumns = fetch_table_columns($mysqli, 'posts');
  $currencyColumn = null;
  foreach (['price_currency', 'listing_currency', 'currency'] as $candidate) {
    if (in_array($candidate, $postColumns, true)) {
      $currencyColumn = $candidate;
      break;
    }
  }

  $amountColumn = null;
  foreach (['price_amount', 'listing_price', 'listing_amount', 'amount', 'price'] as $candidate) {
    if (in_array($candidate, $postColumns, true)) {
      $amountColumn = $candidate;
      break;
    }
  }

  if ($currencyColumn !== null && $amountColumn !== null) {
    $setParts = [];
    $types = '';

    $currencyParam = $listingCurrency !== '' ? $listingCurrency : null;
    $amountParam = $listingAmount !== null ? $listingAmount : null;

    $setParts[] = "`$currencyColumn` = ?";
    $types .= 's';

    $setParts[] = "`$amountColumn` = ?";
    $types .= 's';

    if (in_array('updated_at', $postColumns, true)) {
      $setParts[] = '`updated_at` = NOW()';
    }

    $sql = 'UPDATE `posts` SET ' . implode(', ', $setParts) . ' WHERE `id` = ?';
    $stmtPrice = $mysqli->prepare($sql);

    if ($stmtPrice) {
      $types .= 'i';
      $postIdParam = $insertId;
      if (bind_statement_params($stmtPrice, $types, $currencyParam, $amountParam, $postIdParam) && $stmtPrice->execute()) {
        $priceStored = true;
      }
      $stmtPrice->close();
    }
  }

  if (!$priceStored) {
    foreach (['post_prices', 'listing_prices'] as $priceTable) {
      $tableColumns = fetch_table_columns($mysqli, $priceTable);
      if (!$tableColumns) {
        continue;
      }

      $tableCurrencyColumn = null;
      foreach (['currency', 'price_currency', 'listing_currency'] as $candidate) {
        if (in_array($candidate, $tableColumns, true)) {
          $tableCurrencyColumn = $candidate;
          break;
        }
      }

      $tableAmountColumn = null;
      foreach (['amount', 'price', 'listing_price', 'price_amount'] as $candidate) {
        if (in_array($candidate, $tableColumns, true)) {
          $tableAmountColumn = $candidate;
          break;
        }
      }

      if ($tableCurrencyColumn === null || $tableAmountColumn === null || !in_array('post_id', $tableColumns, true)) {
        continue;
      }

      $columns = ['post_id', $tableCurrencyColumn, $tableAmountColumn];
      $values = ['?', '?', '?'];
      $types = 'iss';

      $postIdParam = $insertId;
      $currencyParam = $listingCurrency !== '' ? $listingCurrency : null;
      $amountParam = $listingAmount !== null ? $listingAmount : null;

      if (in_array('created_at', $tableColumns, true)) {
        $columns[] = 'created_at';
        $values[] = 'NOW()';
      }
      if (in_array('updated_at', $tableColumns, true)) {
        $columns[] = 'updated_at';
        $values[] = 'NOW()';
      }

      $sql = 'INSERT INTO `' . $priceTable . '` (`' . implode('`,`', $columns) . '`) VALUES (' . implode(', ', $values) . ')';
      $stmtPrice = $mysqli->prepare($sql);
      if (!$stmtPrice) {
        continue;
      }

      if (bind_statement_params($stmtPrice, $types, $postIdParam, $currencyParam, $amountParam) && $stmtPrice->execute()) {
        $priceStored = true;
        $stmtPrice->close();
        break;
      }

      $stmtPrice->close();
    }
  }

  if (!$priceStored) {
    abort_with_error($mysqli, 500, 'Unable to store listing price details.', $transactionActive);
  }
}

if (!$mysqli->commit()) {
  abort_with_error($mysqli, 500, 'Failed to finalize post.', $transactionActive);
}

$transactionActive = false;

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
