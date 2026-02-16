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

// Increase execution time for potentially slow image uploads
set_time_limit(300);

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

function load_bunny_settings(mysqli $mysqli): array
{
  $out = [
    'folder_post_images' => '',
    'storage_api_key' => '',
    'storage_zone_name' => '',
    'image_min_width' => 1000,
    'image_min_height' => 1000,
    'image_max_size' => 5242880, // 5MB default
  ];
  $res = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('folder_post_images','storage_api_key','storage_zone_name','image_min_width','image_min_height','image_max_size')");
  if ($res) {
    while ($row = $res->fetch_assoc()) {
      $k = $row['setting_key'] ?? '';
      $v = isset($row['setting_value']) ? trim((string)$row['setting_value']) : '';
      if ($k === 'image_min_width' || $k === 'image_min_height' || $k === 'image_max_size') {
        $out[$k] = (int)$v ?: $out[$k];
      } elseif (array_key_exists($k, $out)) {
        $out[$k] = $v;
      }
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

function bind_statement_params(mysqli_stmt $stmt, string $types, ...$params): bool
{
  if ($types === '') return true;
  $arguments = [$types];
  foreach ($params as $k => $v) {
    $arguments[] = &$params[$k];
  }
  return call_user_func_array([$stmt, 'bind_param'], $arguments);
}

// Accept JSON payload (or multipart if images added later)
$data = null;
$rawInput = file_get_contents('php://input');
if (!empty($_POST['payload'])) {
  $decoded = json_decode((string) $_POST['payload'], true);
  if (is_array($decoded)) $data = $decoded;
} else {
  $decoded = json_decode($rawInput, true);
  if (is_array($decoded)) $data = $decoded;
}

if (!$data || !is_array($data) || empty($data['post_id'])) {
  fail_key(400, 'msg_post_edit_error');
}

$postId = (int)$data['post_id'];
$memberId = isset($data['member_id']) ? (int)$data['member_id'] : null;
$memberName = isset($data['member_name']) ? trim((string)$data['member_name']) : '';
$memberType = isset($data['member_type']) ? trim((string)$data['member_type']) : 'member';
$subcategoryKey = isset($data['subcategory_key']) ? trim((string)$data['subcategory_key']) : '';
$locQty = isset($data['loc_qty']) ? (int) $data['loc_qty'] : 1;
if ($locQty <= 0) $locQty = 1;

// Security: Verify post exists and member has permission to edit
$isAdmin = strtolower($memberType) === 'admin';
$stmtCheck = $mysqli->prepare("SELECT member_id, subcategory_key FROM posts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
if (!$stmtCheck) {
  fail_key(500, 'msg_post_edit_error');
}
$stmtCheck->bind_param('i', $postId);
$stmtCheck->execute();
$stmtCheck->bind_result($postOwnerId, $existingSubcategoryKey);
if (!$stmtCheck->fetch()) {
  $stmtCheck->close();
  fail_key(404, 'msg_post_edit_not_found');
}
$stmtCheck->close();

// Verify ownership: member must own the post, or be admin
if (!$isAdmin && (int)$postOwnerId !== $memberId) {
  fail_key(403, 'msg_post_edit_forbidden');
}

// ============================================================================
// LIGHTWEIGHT MANAGE ACTIONS (hide/show, delete, upgrade, etc.)
// If manage_action is present, handle the simple update and exit early.
// ============================================================================
$manageAction = isset($data['manage_action']) ? trim((string)$data['manage_action']) : '';
if ($manageAction !== '') {
  switch ($manageAction) {

    case 'toggle_visibility':
      $newVisibility = isset($data['visibility']) ? trim((string)$data['visibility']) : '';
      $allowed = ['active', 'hidden'];
      if (!in_array($newVisibility, $allowed, true)) {
        fail_key(400, 'msg_post_edit_error');
      }
      $stmt = $mysqli->prepare("UPDATE posts SET visibility = ?, updated_at = NOW() WHERE id = ?");
      if (!$stmt) fail_key(500, 'msg_post_edit_error');
      $stmt->bind_param('si', $newVisibility, $postId);
      if (!$stmt->execute()) { $stmt->close(); fail_key(500, 'msg_post_edit_error'); }
      $stmt->close();
      echo json_encode(['success' => true, 'manage_action' => 'toggle_visibility', 'visibility' => $newVisibility]);
      exit;

    case 'upgrade_checkout':
      // Validate required fields
      $checkoutKey = isset($data['checkout_key']) ? trim((string)$data['checkout_key']) : '';
      $currency    = isset($data['currency']) ? trim((string)$data['currency']) : 'USD';
      $amount      = isset($data['amount']) ? round((float)$data['amount'], 2) : 0.00;
      $lineItems   = isset($data['line_items']) && is_array($data['line_items']) ? $data['line_items'] : [];
      $addDays     = isset($data['add_days']) ? (int)$data['add_days'] : 0;
      $newLocQty   = isset($data['loc_qty']) ? (int)$data['loc_qty'] : 0;

      if ($checkoutKey === '' || $amount <= 0 || empty($lineItems)) {
        fail_key(400, 'msg_post_edit_error');
      }
      if ($addDays < 0) $addDays = 0;
      if ($addDays > 365) $addDays = 365;
      if ($newLocQty < 1) $newLocQty = 1;

      $lineItemsJson = json_encode($lineItems, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

      // Fetch current post state for safe updates
      $stmtPost = $mysqli->prepare("SELECT checkout_key, days_purchased, loc_paid, expires_at FROM posts WHERE id = ? LIMIT 1");
      if (!$stmtPost) fail_key(500, 'msg_post_edit_error');
      $stmtPost->bind_param('i', $postId);
      $stmtPost->execute();
      $stmtPost->bind_result($curCheckoutKey, $curDaysPurchased, $curLocPaid, $curExpiresAt);
      if (!$stmtPost->fetch()) { $stmtPost->close(); fail_key(404, 'msg_post_edit_not_found'); }
      $stmtPost->close();

      // Begin transaction
      if (!$mysqli->begin_transaction()) fail_key(500, 'msg_post_edit_error');
      $upgradeActive = true;

      // 1. Insert transaction record (status pending until payment confirmed)
      $description = 'Post #' . $postId . ' upgrade';
      $stmtTx = $mysqli->prepare(
        "INSERT INTO transactions (member_id, post_id, transaction_type, checkout_key, amount, currency, line_items, description, status, created_at, updated_at)
         VALUES (?, ?, 'edit', ?, ?, ?, ?, ?, 'pending', NOW(), NOW())"
      );
      if (!$stmtTx) { $mysqli->rollback(); fail_key(500, 'msg_post_edit_error'); }
      $stmtTx->bind_param('iisdsss', $memberId, $postId, $checkoutKey, $amount, $currency, $lineItemsJson, $description);
      if (!$stmtTx->execute()) { $stmtTx->close(); $mysqli->rollback(); fail_key(500, 'msg_post_edit_error'); }
      $transactionId = $stmtTx->insert_id;
      $stmtTx->close();

      // 2. Update post: checkout_key, days_purchased, loc_paid, expires_at
      $newDaysPurchased = (int)$curDaysPurchased + $addDays;

      // Calculate new expiry: add days to current expires_at (or from now if expired)
      $newExpiresAt = $curExpiresAt;
      if ($addDays > 0) {
        $now = new DateTime('now', new DateTimeZone('UTC'));
        $expiryBase = ($curExpiresAt !== null) ? new DateTime($curExpiresAt, new DateTimeZone('UTC')) : $now;
        if ($expiryBase < $now) $expiryBase = $now;
        $expiryBase->modify('+' . $addDays . ' days');
        $newExpiresAt = $expiryBase->format('Y-m-d H:i:s');
      }

      // Only update loc_paid if new locations were added (loc_qty > current loc_paid)
      $newLocPaid = max((int)$curLocPaid, $newLocQty);

      $stmtUpdate = $mysqli->prepare(
        "UPDATE posts SET checkout_key = ?, days_purchased = ?, loc_paid = ?, expires_at = ?, updated_at = NOW() WHERE id = ?"
      );
      if (!$stmtUpdate) { $mysqli->rollback(); fail_key(500, 'msg_post_edit_error'); }
      $stmtUpdate->bind_param('siisi', $checkoutKey, $newDaysPurchased, $newLocPaid, $newExpiresAt, $postId);
      if (!$stmtUpdate->execute()) { $stmtUpdate->close(); $mysqli->rollback(); fail_key(500, 'msg_post_edit_error'); }
      $stmtUpdate->close();

      $mysqli->commit();

      echo json_encode([
        'success'        => true,
        'manage_action'  => 'upgrade_checkout',
        'transaction_id' => $transactionId,
        'checkout_key'   => $checkoutKey,
        'days_purchased' => $newDaysPurchased,
        'loc_paid'       => $newLocPaid,
        'expires_at'     => $newExpiresAt,
        'amount'         => $amount
      ]);
      exit;

    default:
      fail_key(400, 'msg_post_edit_error');
  }
}

// Use the existing subcategory_key from database (don't allow changing category during edit)
$subcategoryKey = $existingSubcategoryKey;

$transactionActive = false;
if (!$mysqli->begin_transaction()) {
  fail_key(500, 'msg_post_edit_error');
}
$transactionActive = true;

// 1. Update primary post entry
$fieldsArr = $data['fields'] ?? [];

// IMAGE UPLOAD (identically to add-post.php, but using existing $postId)
$existingMediaIds = [];
$newMediaIds = [];

// Extract existing media IDs from the images fieldset if present
foreach ($fieldsArr as $fld) {
  $fType = preg_replace('/(-locked|-hidden)$/', '', (string)($fld['type'] ?? ''));
  if ($fType === 'images' && is_array($fld['value'])) {
    foreach ($fld['value'] as $img) {
      if (isset($img['id']) && (int)$img['id'] > 0) {
        $existingMediaIds[] = (int)$img['id'];
      }
    }
  }
}

if (!empty($_FILES['images']) && is_array($_FILES['images']['name'])) {
  $settings = load_bunny_settings($mysqli);
  $folder = rtrim((string)$settings['folder_post_images'], '/');
  if ($folder !== '') {
    $isExternal = preg_match('#^https?://#i', $folder);
    if ($isExternal) {
      $storageApiKey = (string)$settings['storage_api_key'];
      $storageZoneName = (string)$settings['storage_zone_name'];
      $cdnPath = preg_replace('#^https?://[^/]+/#', '', $folder);
      $cdnPath = rtrim((string)$cdnPath, '/');
    } else {
      $localBasePath = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . '/' . ltrim($folder, '/');
    }

    $utcMinus12 = new DateTimeZone('Etc/GMT+12');
    $now = new DateTime('now', $utcMinus12);
    $monthFolder = $now->format('Y-m');

    $imgMeta = [];
    if (!empty($_POST['images_meta'])) {
      $m = json_decode((string)$_POST['images_meta'], true);
      if (is_array($m)) $imgMeta = $m;
    }

    $count = count($_FILES['images']['name']);
    $stmtMedia = $mysqli->prepare("INSERT INTO post_media (member_id, post_id, file_name, file_url, file_size, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())");
    if ($stmtMedia) {
      $imageMinWidth = (int)($settings['image_min_width'] ?? 1000);
      $imageMinHeight = (int)($settings['image_min_height'] ?? 1000);
      $imageMaxSize = (int)($settings['image_max_size'] ?? 5242880);

      for ($i = 0; $i < $count; $i++) {
        $tmp = $_FILES['images']['tmp_name'][$i] ?? '';
        if (!$tmp || !is_uploaded_file($tmp)) continue;
        
        $fileSize = (int)($_FILES['images']['size'][$i] ?? 0);
        if ($fileSize > $imageMaxSize) continue;
        
        $imageInfo = @getimagesize($tmp);
        if ($imageInfo === false || $imageInfo[0] < $imageMinWidth || $imageInfo[1] < $imageMinHeight) continue;
        
        $origName = (string)($_FILES['images']['name'][$i] ?? 'image');
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if ($ext === '') $ext = 'jpg';

        // Naming convention: {8-digit-padded-post-id}-{original_filename}.{extension}
        $baseName = pathinfo($origName, PATHINFO_FILENAME);
        $baseName = preg_replace('/\s+/', '_', trim($baseName));
        $baseName = preg_replace('/[\/\\\\:*?"<>|]/', '', $baseName);
        if ($baseName === '') $baseName = 'image';
        $paddedId = str_pad((string)$postId, 8, '0', STR_PAD_LEFT);
        $candidateBase = $paddedId . '-' . $baseName;
        $finalFilename = $candidateBase . '.' . $ext;

        // Duplicate check for this post
        $dupStmt = $mysqli->prepare("SELECT file_name FROM post_media WHERE post_id = ? AND file_name LIKE ? AND deleted_at IS NULL");
        $dupPattern = $candidateBase . '%.' . $ext;
        $dupStmt->bind_param('is', $postId, $dupPattern);
        $dupStmt->execute();
        $dupResult = $dupStmt->get_result();
        $existingNames = [];
        while ($dupRow = $dupResult->fetch_assoc()) { $existingNames[] = $dupRow['file_name']; }
        $dupStmt->close();
        if (in_array($finalFilename, $existingNames)) {
          $suffix = 2;
          while (in_array($candidateBase . '-' . $suffix . '.' . $ext, $existingNames)) { $suffix++; }
          $finalFilename = $candidateBase . '-' . $suffix . '.' . $ext;
        }

        $bytes = file_get_contents($tmp);
        if ($bytes === false) continue;
        
        if ($isExternal) {
          $fullPath = $cdnPath . '/' . $monthFolder . '/' . $finalFilename;
          $hCode = 0; $hResp = '';
          if (bunny_upload_bytes($storageApiKey, $storageZoneName, $fullPath, $bytes, $hCode, $hResp)) {
            $publicUrl = $folder . '/' . $monthFolder . '/' . $finalFilename;
          } else { continue; }
        } else {
          $localDir = $localBasePath . '/' . $monthFolder;
          if (!is_dir($localDir)) { mkdir($localDir, 0755, true); }
          $localPath = $localDir . '/' . $finalFilename;
          if (file_put_contents($localPath, $bytes) !== false) {
            $publicUrl = '/' . ltrim($folder, '/') . '/' . $monthFolder . '/' . $finalFilename;
          } else { continue; }
        }
        
        $settingsJson = null;
        if (isset($imgMeta[$i]) && is_array($imgMeta[$i])) {
          $settingsJson = json_encode($imgMeta[$i], JSON_UNESCAPED_UNICODE);
        }
        $stmtMedia->bind_param('iissis', $memberId, $postId, $finalFilename, $publicUrl, $fileSize, $settingsJson);
        if ($stmtMedia->execute()) {
          $newMediaIds[] = $stmtMedia->insert_id;
        }
      }
      $stmtMedia->close();
    }
  }
}

$allMediaIds = array_merge($existingMediaIds, $newMediaIds);
$mediaString = !empty($allMediaIds) ? implode(',', $allMediaIds) : null;

// Note: checkout_key is NOT updated during edits - the post's plan was set at creation.
// Editing only updates content fields, not the billing/plan information.
// loc_qty = actual current location count (goes up and down)
// loc_paid = highest paid-for location count (only goes up, never down)
$stmt = $mysqli->prepare("UPDATE posts SET loc_qty = ?, loc_paid = GREATEST(loc_paid, ?), updated_at = NOW() WHERE id = ?");
if ($stmt) {
  $stmt->bind_param('iii', $locQty, $locQty, $postId);
  $stmt->execute();
  $stmt->close();
}

// 2. Clear old sub-data for this post
$oldMapCardIds = [];
$mcResult = $mysqli->query("SELECT id FROM post_map_cards WHERE post_id = $postId");
if ($mcResult) {
  while ($mcRow = $mcResult->fetch_assoc()) {
    $oldMapCardIds[] = (int)$mcRow['id'];
  }
  $mcResult->free();
}

// Delete old sub-data
if (!empty($oldMapCardIds)) {
  $mcIdList = implode(',', $oldMapCardIds);
  $mysqli->query("DELETE FROM post_ticket_pricing WHERE post_map_card_id IN ($mcIdList)");
  $mysqli->query("DELETE FROM post_item_pricing WHERE post_map_card_id IN ($mcIdList)");
  $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id IN ($mcIdList)");
  $mysqli->query("DELETE FROM post_amenities WHERE post_map_card_id IN ($mcIdList)");
}
// Now delete the map cards themselves
$mysqli->query("DELETE FROM post_map_cards WHERE post_id = $postId");

// 3. Insert new data (logic identical to add-post.php)
$byLoc = [];
foreach ($fieldsArr as $entry) {
  if (!is_array($entry)) continue;
  $loc = isset($entry['location_number']) ? (int)$entry['location_number'] : 1;
  if ($loc <= 0) $loc = 1;
  if (!isset($byLoc[$loc])) $byLoc[$loc] = [];
  $byLoc[$loc][] = $entry;
}
if (!$byLoc) $byLoc = [1 => []];

// Copy shared/primary fields to all locations
if (count($byLoc) > 1 && isset($byLoc[1])) {
  $sharedFields = [];
  $subcatStmt = $mysqli->prepare("SELECT fieldset_ids, location_specific FROM subcategories WHERE subcategory_key = ? LIMIT 1");
  if ($subcatStmt) {
    $subcatStmt->bind_param('s', $subcategoryKey);
    if ($subcatStmt->execute()) {
      $fieldsetIdsCsv = null; $locationFlagsCsv = null;
      $subcatStmt->bind_result($fieldsetIdsCsv, $locationFlagsCsv);
      if ($subcatStmt->fetch()) {
        $subcatStmt->close(); // Close immediately after fetching into local variables
        $fieldsetIds = ($fieldsetIdsCsv ?? '') !== '' ? explode(',', $fieldsetIdsCsv) : [];
        $locationFlags = ($locationFlagsCsv ?? '') !== '' ? explode(',', $locationFlagsCsv) : [];
        $fieldsetKeyMap = [];
        if (!empty($fieldsetIds)) {
          $idList = implode(',', array_map('intval', $fieldsetIds));
          $fsResult = $mysqli->query("SELECT id, fieldset_key FROM fieldsets WHERE id IN ($idList)");
          if ($fsResult) {
            while ($fsRow = $fsResult->fetch_assoc()) {
              $fieldsetKeyMap[(int)$fsRow['id']] = strtolower(trim($fsRow['fieldset_key']));
            }
            $fsResult->free();
          }
        }
        $sharedKeys = [];
        foreach ($fieldsetIds as $i => $id) {
          $id = (int)trim($id);
          $isLocationSpecific = isset($locationFlags[$i]) && trim($locationFlags[$i]) === '1';
          if (!$isLocationSpecific && isset($fieldsetKeyMap[$id])) {
            $sharedKeys[] = $fieldsetKeyMap[$id];
          }
        }
        foreach ($byLoc[1] as $entry) {
          $key = isset($entry['key']) ? strtolower(trim((string)$entry['key'])) : '';
          if ($key !== '' && in_array($key, $sharedKeys, true)) {
            $sharedFields[] = $entry;
          }
        }
        foreach ($byLoc as $locNum => $entries) {
          if ($locNum === 1) continue;
          foreach ($sharedFields as $shared) {
            $byLoc[$locNum][] = $shared;
          }
        }
      } else {
        $subcatStmt->close();
      }
    }
  }
}

$primaryTitle = '';
$detectedCurrency = null; // Track first currency used for member's preferred_currency
foreach ($byLoc as $locNum => $entries) {
  $card = [
    'title' => '', 'description' => null, 'custom_text' => null, 'custom_textarea' => null,
    'custom_dropdown' => null, 'custom_checklist' => null, 'custom_radio' => null,
    'public_email' => null, 'phone_prefix' => null, 'public_phone' => null,
    'location_type' => 'venue', 'venue_name' => null, 'address_line' => null, 'city' => null,
    'latitude' => null, 'longitude' => null, 'country_code' => null,
    'website_url' => null, 'tickets_url' => null, 'coupon_code' => null,
    'amenity_summary' => null, 'amenities_data' => null, 'age_rating' => null,
    'session_summary' => null, 'price_summary' => null,
  ];
  
  $sessions = [];
  $ticketPricing = [];
  $itemPricing = null;
  $sessionPricing = null;
  $hasTicketPrice = false;

  foreach ($entries as $e) {
    $type = (string)($e['type'] ?? '');
    $key = (string)($e['key'] ?? '');
    $val = $e['value'] ?? null;
    $baseType = preg_replace('/(-locked|-hidden)$/', '', $type);

    if ($baseType === 'session-pricing') {
      $sessionPricing = is_array($val) ? $val : null;
      if ($sessionPricing && !empty($sessionPricing['price_summary'])) {
        $card['price_summary'] = trim($sessionPricing['price_summary']);
        $hasTicketPrice = true;
      }
      if ($sessionPricing && !empty($sessionPricing['session_summary'])) {
        $card['session_summary'] = trim($sessionPricing['session_summary']);
      }
      continue;
    }
    if ($baseType === 'sessions') {
      $sessions = is_array($val) ? $val : [];
      // Extract session_summary early so it's available for map card UPDATE
      if (is_array($sessions) && isset($sessions['session_summary']) && is_string($sessions['session_summary']) && trim($sessions['session_summary']) !== '') {
        $card['session_summary'] = trim($sessions['session_summary']);
      }
      continue;
    }
    if ($baseType === 'ticket-pricing') {
      $ticketPricing = is_array($val) ? $val : [];
      // Extract price_summary early so it's available for map card UPDATE
      if (is_array($ticketPricing) && isset($ticketPricing['price_summary']) && is_string($ticketPricing['price_summary']) && trim($ticketPricing['price_summary']) !== '') {
        $card['price_summary'] = trim($ticketPricing['price_summary']);
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
    
    if ($key === 'title' && is_string($val)) $card['title'] = trim($val);
    if (($key === 'description' || $baseType === 'description') && is_string($val)) $card['description'] = trim($val);
    
    $fieldLabel = isset($e['name']) ? trim((string)$e['name']) : '';
    if ($baseType === 'custom-text' && is_string($val)) $card['custom_text'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    if ($baseType === 'custom-textarea' && is_string($val)) $card['custom_textarea'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    if ($baseType === 'custom-dropdown' && is_string($val)) $card['custom_dropdown'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    if ($baseType === 'custom-checklist' && is_array($val)) {
      $items = [];
      foreach ($val as $v0) {
        $s0 = trim((string)$v0);
        if ($s0 !== '') $items[] = $s0;
      }
      $items = array_values(array_unique($items));
      $joined = implode(', ', $items);
      $card['custom_checklist'] = $fieldLabel !== '' ? $fieldLabel . ': ' . $joined : $joined;
    }
    if ($baseType === 'custom-radio' && is_string($val)) $card['custom_radio'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    
    if ($baseType === 'public-email' && is_string($val)) $card['public_email'] = trim($val);
    if ($baseType === 'public-phone' && is_array($val)) {
      $pfx = isset($val['phone_prefix']) ? trim((string)$val['phone_prefix']) : '';
      $num = isset($val['public_phone']) ? trim((string)$val['public_phone']) : '';
      if ($pfx !== '' && $num !== '') {
        $card['phone_prefix'] = $pfx;
        $card['public_phone'] = $num;
      }
    }
    if (($baseType === 'website-url' || $baseType === 'url') && is_string($val)) $card['website_url'] = trim($val);
    if ($baseType === 'tickets-url' && is_string($val)) $card['tickets_url'] = trim($val);
    if ($baseType === 'coupon' && is_string($val)) $card['coupon_code'] = trim($val);
    if ($baseType === 'amenities' && is_array($val)) {
      $card['amenity_summary'] = json_encode($val, JSON_UNESCAPED_UNICODE);
      $card['amenities_data'] = $val;
      continue;
    }
    if ($baseType === 'age-rating' && is_string($val)) {
      $card['age_rating'] = trim($val);
      continue;
    }
    if ($baseType === 'images' && is_array($val)) {
      // Collect existing media IDs from the fieldset value (sent as array of objects)
      foreach ($val as $img) {
        if (isset($img['id']) && (int)$img['id'] > 0) {
          $existingMediaIds[] = (int)$img['id'];
        }
      }
      continue;
    }
    if ($baseType === 'venue' && is_array($val)) {
      $card['location_type'] = 'venue';
      $card['venue_name'] = isset($val['venue_name']) ? trim((string)$val['venue_name']) : null;
      $card['address_line'] = isset($val['address_line']) ? trim((string)$val['address_line']) : null;
      $card['city'] = isset($val['city']) ? trim((string)$val['city']) : null;
      $card['suburb'] = isset($val['suburb']) ? trim((string)$val['suburb']) : ($card['city'] ?? null);
      $card['state'] = isset($val['state']) ? trim((string)$val['state']) : null;
      $card['postcode'] = isset($val['postcode']) ? trim((string)$val['postcode']) : null;
      $card['country_name'] = isset($val['country_name']) ? trim((string)$val['country_name']) : null;
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : null;
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : null;
      $cc = isset($val['country_code']) ? strtoupper(trim((string)$val['country_code'])) : '';
      $cc = preg_replace('/[^A-Z]/', '', $cc);
      $card['country_code'] = (is_string($cc) && strlen($cc) === 2) ? $cc : null;
      continue;
    }
    if ($baseType === 'address' && is_array($val)) {
      $card['location_type'] = 'address';
      $card['address_line'] = isset($val['address_line']) ? trim((string)$val['address_line']) : $card['address_line'];
      $card['city'] = isset($val['city']) ? trim((string)$val['city']) : $card['city'];
      $card['suburb'] = isset($val['suburb']) ? trim((string)$val['suburb']) : ($card['city'] ?? $card['suburb']);
      $card['state'] = isset($val['state']) ? trim((string)$val['state']) : ($card['state'] ?? null);
      $card['postcode'] = isset($val['postcode']) ? trim((string)$val['postcode']) : ($card['postcode'] ?? null);
      $card['country_name'] = isset($val['country_name']) ? trim((string)$val['country_name']) : ($card['country_name'] ?? null);
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : $card['latitude'];
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : $card['longitude'];
      $cc = isset($val['country_code']) ? strtoupper(trim((string)$val['country_code'])) : '';
      $cc = preg_replace('/[^A-Z]/', '', $cc);
      $card['country_code'] = (is_string($cc) && strlen($cc) === 2) ? $cc : $card['country_code'];
      continue;
    }
    if ($baseType === 'city' && is_array($val)) {
      $card['location_type'] = 'city';
      $card['city'] = isset($val['city']) ? trim((string)$val['city']) : $card['city'];
      $card['suburb'] = isset($val['suburb']) ? trim((string)$val['suburb']) : ($card['city'] ?? $card['suburb']);
      $card['state'] = isset($val['state']) ? trim((string)$val['state']) : ($card['state'] ?? null);
      $card['postcode'] = isset($val['postcode']) ? trim((string)$val['postcode']) : ($card['postcode'] ?? null);
      $card['country_name'] = isset($val['country_name']) ? trim((string)$val['country_name']) : ($card['country_name'] ?? null);
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : $card['latitude'];
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : $card['longitude'];
      $cc = isset($val['country_code']) ? strtoupper(trim((string)$val['country_code'])) : '';
      $cc = preg_replace('/[^A-Z]/', '', $cc);
      $card['country_code'] = (is_string($cc) && strlen($cc) === 2) ? $cc : $card['country_code'];
      continue;
    }
  }

  // No recalculation needed: session_summary and price_summary are now provided by the frontend payload

  // Insert map card
  $stmtCard = $mysqli->prepare("INSERT INTO post_map_cards (post_id, subcategory_key, title, description, media_ids, custom_text, custom_textarea, custom_dropdown, custom_checklist, custom_radio, public_email, phone_prefix, public_phone, location_type, venue_name, address_line, suburb, city, state, postcode, country_name, country_code, latitude, longitude, timezone, age_rating, website_url, tickets_url, coupon_code, session_summary, price_summary, amenity_summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
  
  if ($stmtCard) {
    $lat = (float)($card['latitude'] ?? 0);
    $lng = (float)($card['longitude'] ?? 0);
    $timezone = null;
    
    $stmtCard->bind_param(
      'isssssssssssssssssssssddssssssss',
      $postId, $subcategoryKey, $card['title'], $card['description'], $mediaString,
      $card['custom_text'], $card['custom_textarea'], $card['custom_dropdown'], $card['custom_checklist'], $card['custom_radio'],
      $card['public_email'], $card['phone_prefix'], $card['public_phone'],
      $card['location_type'], $card['venue_name'], $card['address_line'], $card['suburb'], $card['city'],
      $card['state'], $card['postcode'],
      $card['country_name'], $card['country_code'],
      $lat, $lng, $timezone,
      $card['age_rating'], $card['website_url'], $card['tickets_url'], $card['coupon_code'],
      $card['session_summary'], $card['price_summary'], $card['amenity_summary']
    );
    if (!$stmtCard->execute()) { $stmtCard->close(); abort_with_error($mysqli, 500, 'Insert map card', $transactionActive); }
    $mapCardId = $stmtCard->insert_id;
    $stmtCard->close();
    
    if ($primaryTitle === '') $primaryTitle = $card['title'];

    // Amenities
    if (is_array($card['amenities_data']) && count($card['amenities_data']) > 0) {
      $stmtAm = $mysqli->prepare("INSERT INTO post_amenities (post_map_card_id, amenity_key, value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
      if ($stmtAm) {
        foreach ($card['amenities_data'] as $am) {
          if (!is_array($am)) continue;
          $amName = isset($am['amenity']) ? trim((string)$am['amenity']) : '';
          if ($amName === '') continue;
          $amKey = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $amName));
          $amVal = !empty($am['value']) ? 1 : 0;
          $stmtAm->bind_param('isi', $mapCardId, $amKey, $amVal);
          $stmtAm->execute();
        }
        $stmtAm->close();
      }
    }

    // Sessions + Ticket Pricing
    // Supports both:
    // 1. Legacy merged `session_pricing` fieldset (sessions + pricing in one)
    // 2. New split fieldsets: `sessions` (dates/times) + `ticket_pricing` (pricing groups)
    $sessionsToWrite = [];
    $pricingGroupsToWrite = [];
    $ageRatingsToWrite = [];
    $writeSessionPricing = false;

    // Check for legacy session_pricing fieldset
    if (is_array($sessionPricing) && isset($sessionPricing['sessions']) && is_array($sessionPricing['sessions'])) {
      $sessionsToWrite = $sessionPricing['sessions'];
      $pricingGroupsToWrite = $sessionPricing['pricing_groups'] ?? [];
      $ageRatingsToWrite = $sessionPricing['age_ratings'] ?? [];
      $writeSessionPricing = true;
    }

    // Check for new separate sessions fieldset
    if (is_array($sessions) && isset($sessions['sessions']) && is_array($sessions['sessions']) && count($sessions['sessions']) > 0) {
      $sessionsToWrite = $sessions['sessions'];
      $writeSessionPricing = true;
      // Note: session_summary is extracted early in fieldset processing loop
    }

    // Check for new separate ticket_pricing fieldset
    if (is_array($ticketPricing) && isset($ticketPricing['pricing_groups']) && is_array($ticketPricing['pricing_groups']) && count($ticketPricing['pricing_groups']) > 0) {
      $pricingGroupsToWrite = $ticketPricing['pricing_groups'];
      $ageRatingsToWrite = $ticketPricing['age_ratings'] ?? [];
      $writeSessionPricing = true;
      // Note: price_summary is extracted early in fieldset processing loop
    }

    if ($writeSessionPricing) {
      if (is_array($sessionsToWrite)) {
        $stmtSess = $mysqli->prepare("INSERT INTO post_sessions (post_map_card_id, session_date, session_time, ticket_group_key, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
        foreach ($sessionsToWrite as $s) {
          if (!is_array($s)) continue;
          $date = (string)($s['date'] ?? '');
          foreach (($s['times'] ?? []) as $t) {
            if (!is_array($t)) continue;
            $time = trim((string)($t['time'] ?? ''));
            $tgk = trim((string)($t['ticket_group_key'] ?? ''));
            if ($date === '' || $time === '' || $tgk === '') continue;
            $stmtSess->bind_param('isss', $mapCardId, $date, $time, $tgk);
            $stmtSess->execute();
          }
        }
        $stmtSess->close();
      }

      if (is_array($pricingGroupsToWrite)) {
        $stmtPrice = $mysqli->prepare("INSERT INTO post_ticket_pricing (post_map_card_id, ticket_group_key, age_rating, allocated_areas, ticket_area, pricing_tier, price, currency, promo_option, promo_code, promo_type, promo_value, promo_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
        foreach ($pricingGroupsToWrite as $gkRaw => $seats) {
          $gk = trim((string)$gkRaw);
          if ($gk === '' || !is_array($seats)) continue;
          $ageRating = $ageRatingsToWrite[$gk] ?? '';
          foreach ($seats as $seat) {
            if (!is_array($seat)) continue;
            $allocated = (int)($seat['allocated_areas'] ?? 1);
            $ticketArea = (string)($seat['ticket_area'] ?? '');
            foreach (($seat['tiers'] ?? []) as $tier) {
              if (!is_array($tier)) continue;
              $tierName = (string)($tier['pricing_tier'] ?? '');
              $amt = normalize_price_amount($tier['price'] ?? null);
              $curr = normalize_currency($tier['currency'] ?? '');
              if ($tierName === '' || $curr === '' || $amt === null) continue;
              // Track first currency for member's preferred_currency
              if ($detectedCurrency === null && $curr !== '') {
                $detectedCurrency = $curr;
              }
              // Promo fields from tier - only populate if promo is enabled
              $tpPromoOption = isset($tier['promo_option']) ? trim((string)$tier['promo_option']) : 'none';
              $tpPromoCode = null;
              $tpPromoType = null;
              $tpPromoValue = null;
              $tpPromoPrice = null;
              if ($tpPromoOption !== 'none') {
                $tpPromoCode = isset($tier['promo_code']) ? trim((string)$tier['promo_code']) : '';
                $tpPromoType = isset($tier['promo_type']) ? trim((string)$tier['promo_type']) : 'percent';
                $tpPromoValue = isset($tier['promo_value']) ? trim((string)$tier['promo_value']) : '';
                $tpPromoPrice = isset($tier['promo_price']) ? trim((string)$tier['promo_price']) : '';
              }
              
              $stmtPrice->bind_param('isissssssssss', $mapCardId, $gk, $ageRating, $allocated, $ticketArea, $tierName, $amt, $curr, $tpPromoOption, $tpPromoCode, $tpPromoType, $tpPromoValue, $tpPromoPrice);
              $stmtPrice->execute();
            }
          }
        }
        $stmtPrice->close();
      }
    }

    // Item Pricing
    if (is_array($itemPricing) && !empty($itemPricing['item_name'])) {
      $stmtItem = $mysqli->prepare("INSERT INTO post_item_pricing (post_map_card_id, item_name, age_rating, item_variants, item_price, currency, promo_option, promo_code, promo_type, promo_value, promo_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
      if ($stmtItem) {
        $ageRating = isset($itemPricing['age_rating']) ? trim((string)$itemPricing['age_rating']) : '';
        $variants = json_encode($itemPricing['item_variants'] ?? [], JSON_UNESCAPED_UNICODE);
        $price = normalize_price_amount($itemPricing['item_price'] ?? null);
        $curr = normalize_currency($itemPricing['currency'] ?? '');
        // Track first currency for member's preferred_currency
        if ($detectedCurrency === null && $curr !== '') {
          $detectedCurrency = $curr;
        }
        
        // Promo fields - only populate if promo is enabled
        $promoOption = isset($itemPricing['promo_option']) ? trim((string)$itemPricing['promo_option']) : 'none';
        $promoCode = null;
        $promoType = null;
        $promoValue = null;
        $promoPrice = null;
        if ($promoOption !== 'none') {
          $promoCode = isset($itemPricing['promo_code']) ? trim((string)$itemPricing['promo_code']) : '';
          $promoType = isset($itemPricing['promo_type']) ? trim((string)$itemPricing['promo_type']) : 'percent';
          $promoValue = isset($itemPricing['promo_value']) ? trim((string)$itemPricing['promo_value']) : '';
          $promoPrice = isset($itemPricing['promo_price']) ? trim((string)$itemPricing['promo_price']) : '';
        }
        
        $stmtItem->bind_param('issssssssss', $mapCardId, $itemPricing['item_name'], $ageRating, $variants, $price, $curr, $promoOption, $promoCode, $promoType, $promoValue, $promoPrice);
        $stmtItem->execute();
        $stmtItem->close();
      }
    }
  }
}

// 5. Post-save snapshot: capture what was just saved for restoration
$savedSnapshot = [
  'post_map_cards' => [],
  'post_sessions' => [],
  'post_ticket_pricing' => [],
  'post_item_pricing' => [],
  'post_amenities' => []
];
$savedMapCardIds = [];
$smcResult = $mysqli->query("SELECT * FROM post_map_cards WHERE post_id = $postId");
if ($smcResult) {
  while ($sRow = $smcResult->fetch_assoc()) {
    $savedMapCardIds[] = (int)$sRow['id'];
    $savedSnapshot['post_map_cards'][] = $sRow;
  }
  $smcResult->free();
}
if (!empty($savedMapCardIds)) {
  $sIdList = implode(',', $savedMapCardIds);
  $r = $mysqli->query("SELECT * FROM post_sessions WHERE post_map_card_id IN ($sIdList)");
  if ($r) { while ($row = $r->fetch_assoc()) $savedSnapshot['post_sessions'][] = $row; $r->free(); }
  $r = $mysqli->query("SELECT * FROM post_ticket_pricing WHERE post_map_card_id IN ($sIdList)");
  if ($r) { while ($row = $r->fetch_assoc()) $savedSnapshot['post_ticket_pricing'][] = $row; $r->free(); }
  $r = $mysqli->query("SELECT * FROM post_item_pricing WHERE post_map_card_id IN ($sIdList)");
  if ($r) { while ($row = $r->fetch_assoc()) $savedSnapshot['post_item_pricing'][] = $row; $r->free(); }
  $r = $mysqli->query("SELECT * FROM post_amenities WHERE post_map_card_id IN ($sIdList)");
  if ($r) { while ($row = $r->fetch_assoc()) $savedSnapshot['post_amenities'][] = $row; $r->free(); }
}
$savedJson = json_encode($savedSnapshot, JSON_UNESCAPED_UNICODE);
$stmtRev = $mysqli->prepare("INSERT INTO post_revisions (post_id, post_title, editor_id, editor_name, change_type, change_summary, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'edit', 'Edited', ?, NOW(), NOW())");
if ($stmtRev) {
  $stmtRev->bind_param('isiss', $postId, $primaryTitle, $memberId, $memberName, $savedJson);
  $stmtRev->execute();
  $stmtRev->close();
}

// Prune old edit snapshots: keep only the 5 most recent per post (never touch 'create' entries)
$pruneResult = $mysqli->query("SELECT id FROM post_revisions WHERE post_id = $postId AND change_type = 'edit' ORDER BY id DESC LIMIT 5, 999999");
if ($pruneResult && $pruneResult->num_rows > 0) {
  $pruneIds = [];
  while ($pruneRow = $pruneResult->fetch_assoc()) {
    $pruneIds[] = (int)$pruneRow['id'];
  }
  $pruneResult->free();
  if (!empty($pruneIds)) {
    $pruneIdList = implode(',', $pruneIds);
    $mysqli->query("DELETE FROM post_revisions WHERE id IN ($pruneIdList)");
  }
} elseif ($pruneResult) {
  $pruneResult->free();
}

// Update user's preferred_currency if a currency was used in this post
if ($detectedCurrency !== null && $memberId > 0) {
  if ($memberType === 'member') {
    $stmtCurr = $mysqli->prepare("UPDATE members SET preferred_currency = ? WHERE id = ?");
  } elseif ($memberType === 'admin') {
    $stmtCurr = $mysqli->prepare("UPDATE admins SET preferred_currency = ? WHERE id = ?");
  } else {
    $stmtCurr = null;
  }
  if ($stmtCurr) {
    $stmtCurr->bind_param('si', $detectedCurrency, $memberId);
    $stmtCurr->execute();
    $stmtCurr->close();
  }
}

$mysqli->commit();
echo json_encode(['success'=>true, 'message_key'=>'msg_post_edit_success']);
exit;
?>
