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
$subcategoryKey = isset($data['subcategory_key']) ? trim((string)$data['subcategory_key']) : '';
$locQty = isset($data['loc_qty']) ? (int) $data['loc_qty'] : 1;
if ($locQty <= 0) $locQty = 1;

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
        $hash = substr(md5(uniqid('', true) . random_bytes(8)), 0, 6);
        $finalFilename = $postId . '-' . $hash . '.' . $ext;

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

$checkoutTitle = null;
foreach ($fieldsArr as $fld) {
  if (isset($fld['key']) && strtolower(trim($fld['key'])) === 'checkout') {
    $val = $fld['value'] ?? $fld['option_id'] ?? '';
    if (is_array($val)) {
      $checkoutTitle = isset($val['option_id']) ? (string)$val['option_id'] : (isset($val['checkout_title']) ? (string)$val['checkout_title'] : 'Array');
    } else {
      $checkoutTitle = (string)$val;
    }
    break;
  }
}

$stmt = $mysqli->prepare("UPDATE posts SET loc_qty = ?, checkout_title = ?, updated_at = NOW() WHERE id = ?");
if ($stmt) {
  $stmt->bind_param('isi', $locQty, $checkoutTitle, $postId);
  $stmt->execute();
  $stmt->close();
}

// 2. Clear old sub-data for this post
// IMPORTANT: We clear sub-data because we'll re-insert it from the updated payload.
$mysqli->query("DELETE FROM post_ticket_pricing WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_item_pricing WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_sessions WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
$mysqli->query("DELETE FROM post_amenities WHERE map_card_id IN (SELECT id FROM post_map_cards WHERE post_id = $postId)");
// We DON'T delete map cards yet, we'll replace them or update them.
// For simplicity and matching add-post.php, we delete and re-insert.
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

    if ($baseType === 'session_pricing') {
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
      continue;
    }
    if ($baseType === 'ticket-pricing') {
      $ticketPricing = is_array($val) ? $val : [];
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
    if ($baseType === 'custom_text' && is_string($val)) $card['custom_text'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    if ($baseType === 'custom_textarea' && is_string($val)) $card['custom_textarea'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    if ($baseType === 'custom_dropdown' && is_string($val)) $card['custom_dropdown'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    if ($baseType === 'custom_checklist' && is_array($val)) {
      $items = [];
      foreach ($val as $v0) {
        $s0 = trim((string)$v0);
        if ($s0 !== '') $items[] = $s0;
      }
      $items = array_values(array_unique($items));
      $joined = implode(', ', $items);
      $card['custom_checklist'] = $fieldLabel !== '' ? $fieldLabel . ': ' . $joined : $joined;
    }
    if ($baseType === 'custom_radio' && is_string($val)) $card['custom_radio'] = $fieldLabel !== '' ? $fieldLabel . ': ' . trim($val) : trim($val);
    
    if ($baseType === 'public_email' && is_string($val)) $card['public_email'] = trim($val);
    if ($baseType === 'public_phone' && is_array($val)) {
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
    if ($baseType === 'age_rating' && is_string($val)) {
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
      $card['venue_name'] = isset($val['venue_name']) ? trim((string)$val['venue_name']) : null;
      $card['address_line'] = isset($val['address_line']) ? trim((string)$val['address_line']) : null;
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : null;
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : null;
      $cc = isset($val['country_code']) ? strtoupper(trim((string)$val['country_code'])) : '';
      $cc = preg_replace('/[^A-Z]/', '', $cc);
      $card['country_code'] = (is_string($cc) && strlen($cc) === 2) ? $cc : null;
      continue;
    }
    if (($baseType === 'address' || $baseType === 'city') && is_array($val)) {
      $card['address_line'] = isset($val['address_line']) ? trim((string)$val['address_line']) : $card['address_line'];
      $card['latitude'] = isset($val['latitude']) ? (float)$val['latitude'] : $card['latitude'];
      $card['longitude'] = isset($val['longitude']) ? (float)$val['longitude'] : $card['longitude'];
      $cc = isset($val['country_code']) ? strtoupper(trim((string)$val['country_code'])) : '';
      $cc = preg_replace('/[^A-Z]/', '', $cc);
      $card['country_code'] = (is_string($cc) && strlen($cc) === 2) ? $cc : $card['country_code'];
      if ($baseType === 'city') $card['city'] = $card['address_line'];
      continue;
    }
  }

  // No recalculation needed: session_summary and price_summary are now provided by the frontend payload

  // Insert map card
  $stmtCard = $mysqli->prepare("INSERT INTO post_map_cards (post_id, subcategory_key, title, description, media_ids, custom_text, custom_textarea, custom_dropdown, custom_checklist, custom_radio, public_email, phone_prefix, public_phone, venue_name, address_line, city, latitude, longitude, country_code, timezone, age_rating, website_url, tickets_url, coupon_code, session_summary, price_summary, amenity_summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
  
  if ($stmtCard) {
    $lat = (float)($card['latitude'] ?? 0);
    $lng = (float)($card['longitude'] ?? 0);
    $timezone = null;
    
    $stmtCard->bind_param(
      'issssssssssssssddssssssssss',
      $postId, $subcategoryKey, $card['title'], $card['description'], $mediaString,
      $card['custom_text'], $card['custom_textarea'], $card['custom_dropdown'], $card['custom_checklist'], $card['custom_radio'],
      $card['public_email'], $card['phone_prefix'], $card['public_phone'],
      $card['venue_name'], $card['address_line'], $card['city'],
      $lat, $lng, $card['country_code'], $timezone,
      $card['age_rating'], $card['website_url'], $card['tickets_url'], $card['coupon_code'],
      $card['session_summary'], $card['price_summary'], $card['amenity_summary']
    );
    if (!$stmtCard->execute()) { $stmtCard->close(); abort_with_error($mysqli, 500, 'Insert map card', $transactionActive); }
    $mapCardId = $stmtCard->insert_id;
    $stmtCard->close();
    
    if ($primaryTitle === '') $primaryTitle = $card['title'];

    // Amenities
    if (is_array($card['amenities_data']) && count($card['amenities_data']) > 0) {
      $stmtAm = $mysqli->prepare("INSERT INTO post_amenities (map_card_id, amenity_key, value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
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
    $sessionsToWrite = $sessions;
    $pricingGroupsToWrite = null;
    $ageRatingsToWrite = [];
    $writeSessionPricing = false;
    if (is_array($sessionPricing) && isset($sessionPricing['sessions']) && is_array($sessionPricing['sessions'])) {
      $sessionsToWrite = $sessionPricing['sessions'];
      $pricingGroupsToWrite = $sessionPricing['pricing_groups'] ?? [];
      $ageRatingsToWrite = $sessionPricing['age_ratings'] ?? [];
      $writeSessionPricing = true;
    }

    if ($writeSessionPricing) {
      if (is_array($sessionsToWrite)) {
        $stmtSess = $mysqli->prepare("INSERT INTO post_sessions (map_card_id, session_date, session_time, ticket_group_key, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
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
        $stmtPrice = $mysqli->prepare("INSERT INTO post_ticket_pricing (map_card_id, ticket_group_key, age_rating, seating_area, pricing_tier, price, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
        foreach ($pricingGroupsToWrite as $gkRaw => $seats) {
          $gk = trim((string)$gkRaw);
          if ($gk === '' || !is_array($seats)) continue;
          $ageRating = $ageRatingsToWrite[$gk] ?? '';
          foreach ($seats as $seat) {
            if (!is_array($seat)) continue;
            $seatName = (string)($seat['seating_area'] ?? '');
            foreach (($seat['tiers'] ?? []) as $tier) {
              if (!is_array($tier)) continue;
              $tierName = (string)($tier['pricing_tier'] ?? '');
              $amt = normalize_price_amount($tier['price'] ?? null);
              $curr = normalize_currency($tier['currency'] ?? '');
              if ($seatName === '' || $tierName === '' || $curr === '' || $amt === null) continue;
              $stmtPrice->bind_param('issssss', $mapCardId, $gk, $ageRating, $seatName, $tierName, $amt, $curr);
              $stmtPrice->execute();
            }
          }
        }
        $stmtPrice->close();
      }
    }

    // Item Pricing
    if (is_array($itemPricing) && !empty($itemPricing['item_name'])) {
      $stmtItem = $mysqli->prepare("INSERT INTO post_item_pricing (map_card_id, item_name, item_variants, item_price, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())");
      if ($stmtItem) {
        $variants = json_encode($itemPricing['item_variants'] ?? [], JSON_UNESCAPED_UNICODE);
        $price = normalize_price_amount($itemPricing['item_price'] ?? null);
        $curr = normalize_currency($itemPricing['currency'] ?? '');
        $stmtItem->bind_param('issss', $mapCardId, $itemPricing['item_name'], $variants, $price, $curr);
        $stmtItem->execute();
        $stmtItem->close();
      }
    }
  }
}

// 5. Revision
$revJson = json_encode($data, JSON_UNESCAPED_UNICODE);
$stmtRev = $mysqli->prepare("INSERT INTO post_revisions (post_id, post_title, editor_id, editor_name, change_type, change_summary, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'edit', 'Edited', ?, NOW(), NOW())");
if ($stmtRev) {
  $stmtRev->bind_param('isiss', $postId, $primaryTitle, $memberId, $memberName, $revJson);
  $stmtRev->execute();
  $stmtRev->close();
}

$mysqli->commit();
echo json_encode(['success'=>true, 'message_key'=>'msg_post_edit_success']);
exit;
?>
