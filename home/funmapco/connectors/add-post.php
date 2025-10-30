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

function abort_with_error(mysqli $mysqli, int $code, string $message, bool &$transactionActive): void
{
  if ($transactionActive) {
    $mysqli->rollback();
    $transactionActive = false;
  }
  http_response_code($code);
  echo json_encode(['success'=>false,'error'=>$message]);
  exit;
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

$transactionActive = false;

if (!$mysqli->begin_transaction()) {
  http_response_code(500);
  exit(json_encode(['success'=>false,'error'=>'Failed to start database transaction.']));
}

$transactionActive = true;

$stmt = $mysqli->prepare(
  "INSERT INTO posts (subcategory_id, subcategory_name, member_id, member_name, title, status) VALUES (?, ?, ?, ?, ?, 'active')"
);

if (!$stmt) {
  abort_with_error($mysqli, 500, 'Unable to prepare post statement.', $transactionActive);
}

if (!$stmt->bind_param('isiss', $subcategoryId, $subcategoryName, $memberId, $memberName, $title)) {
  $stmt->close();
  abort_with_error($mysqli, 500, 'Failed to bind post parameters.', $transactionActive);
}

if (!$stmt->execute()) {
  $stmt->close();
  abort_with_error($mysqli, 500, 'Failed to save post.', $transactionActive);
}

$insertId = $stmt->insert_id;
$stmt->close();

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

  $fieldLabelRaw = $fieldEntry['label'] ?? $fieldEntry['field_label'] ?? $fieldEntry['name'] ?? '';
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
