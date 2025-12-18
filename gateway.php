<?php
// gateway.php — public bridge to backend scripts outside web root
// DO NOT place secrets here.

$action = isset($_GET['action']) ? preg_replace('/[^a-z0-9_\-]/i', '', $_GET['action']) : '';

$baseDir = __DIR__;

$candidateDirs = [
  $baseDir . '/../connectors',
  $baseDir . '/home/funmapco/connectors'
];

$connectorDir = null;
foreach ($candidateDirs as $candidate) {
  $resolved = realpath($candidate);
  if ($resolved && is_dir($resolved)) {
    $connectorDir = $resolved;
    break;
  }
}

if ($connectorDir === null) {
  header('Content-Type: application/json');
  echo json_encode(['success'=>false,'message'=>'Connector directory not found']);
  exit;
}

// Handle get-checkout-options inline - copied from get-admin-settings.php
if ($action === 'get-checkout-options') {
  header('Content-Type: application/json');
  
  // Include database config (same paths as connectors)
  $configCandidates = [
    $connectorDir . '/../config/config-db.php',
    dirname($connectorDir) . '/config/config-db.php',
  ];
  
  $configPath = null;
  foreach ($configCandidates as $candidate) {
    if (is_file($candidate)) {
      $configPath = $candidate;
      break;
    }
  }
  
  if (!$configPath) {
    echo json_encode(['success' => false, 'message' => 'Configuration not found']);
    exit;
  }
  
  require_once $configPath;
  
  try {
    // Use same PDO pattern as connectors
    $pdo = null;
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
      $pdo = $GLOBALS['pdo'];
    } elseif (defined('DB_DSN')) {
      $user = defined('DB_USER') ? DB_USER : null;
      $pass = defined('DB_PASS') ? DB_PASS : null;
      $pdo = new PDO(DB_DSN, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      ]);
    } else {
      throw new Exception('Database not configured');
    }
    
    // Get site currency from admin_settings (copied from get-admin-settings.php)
    $currency = 'USD';
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_settings'");
    if ($stmt->rowCount() > 0) {
      $stmt = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'site_currency' LIMIT 1");
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      if ($row && !empty($row['setting_value'])) {
        $currency = $row['setting_value'];
      }
    }
    
    // Fetch checkout_options (copied from get-admin-settings.php)
    $checkoutOptions = [];
    $stmt = $pdo->query("SHOW TABLES LIKE 'checkout_options'");
    if ($stmt->rowCount() > 0) {
      $stmt = $pdo->query('SELECT `id`, `checkout_key`, `checkout_title`, `checkout_description`, `checkout_flagfall_price`, `checkout_basic_day_rate`, `checkout_discount_day_rate`, `checkout_currency`, `checkout_featured`, `checkout_sidebar_ad`, `sort_order`, `is_active` FROM `checkout_options` ORDER BY `sort_order` ASC, `id` ASC');
      $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
      
      foreach ($rows as $row) {
        $checkoutOptions[] = [
          'id' => (int)$row['id'],
          'checkout_key' => $row['checkout_key'],
          'checkout_title' => $row['checkout_title'],
          'checkout_description' => $row['checkout_description'],
          'checkout_flagfall_price' => $row['checkout_flagfall_price'] !== null ? (float)$row['checkout_flagfall_price'] : 0,
          'checkout_basic_day_rate' => $row['checkout_basic_day_rate'] !== null ? (float)$row['checkout_basic_day_rate'] : null,
          'checkout_discount_day_rate' => $row['checkout_discount_day_rate'] !== null ? (float)$row['checkout_discount_day_rate'] : null,
          'checkout_currency' => $row['checkout_currency'] ?? $currency,
          'checkout_featured' => (bool)$row['checkout_featured'],
          'checkout_sidebar_ad' => (bool)$row['checkout_sidebar_ad'],
          'sort_order' => (int)$row['sort_order'],
          'is_active' => (bool)$row['is_active'],
        ];
      }
    }
    
    echo json_encode([
      'success' => true,
      'checkout_options' => $checkoutOptions,
      'currency' => $currency
    ]);
  } catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
  }
  exit;
}

// Handle list-icons inline (no separate file needed)
if ($action === 'list-icons') {
  header('Content-Type: application/json');
  
  $folder = isset($_GET['folder']) ? $_GET['folder'] : '';
  
  // Security: prevent directory traversal and limit to assets folder
  if (strpos($folder, '..') !== false || strpos($folder, '\\') !== false || stripos($folder, 'assets/') !== 0) {
    echo json_encode(['success' => false, 'icons' => []]);
    exit;
  }
  
  // Ensure folder is relative to base directory
  $fullPath = $baseDir . '/' . ltrim($folder, '/');
  
  $icons = [];
  $allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
  
  if (is_dir($fullPath)) {
    $files = scandir($fullPath);
    foreach ($files as $file) {
      if ($file === '.' || $file === '..') continue;
      $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
      if (in_array($ext, $allowedExtensions)) {
        $icons[] = $file;
      }
    }
  }
  
  echo json_encode(['success' => true, 'icons' => $icons]);
  exit;
}

$map = [
  'verify-login' => $connectorDir . '/verify-login.php',
  'add-member' => $connectorDir . '/add-member.php',
  'save-form' => $connectorDir . '/save-form.php',
  'get-form' => $connectorDir . '/get-form.php',
  'add-post' => $connectorDir . '/add-post.php',
  'upload-media' => $connectorDir . '/upload-media.php',
  'issue-token' => $connectorDir . '/issue-token.php',
  // Backwards-compat routes for rename
  'edit-post' => $connectorDir . '/edit-post.php',
  'edit-member' => $connectorDir . '/edit-member.php',
  'get-admin-settings' => $connectorDir . '/get-admin-settings.php',
  'save-admin-settings' => $connectorDir . '/save-admin-settings.php',
  // add more routes later, e.g. 'register' => $connectorDir . '/register.php',
];

if (!$action || !isset($map[$action])) {
  header('Content-Type: application/json');
  echo json_encode(['success'=>false,'message'=>'Unknown action']);
  exit;
}

$target = $map[$action];

if (!file_exists($target)) {
  header('Content-Type: application/json');
  echo json_encode(['success'=>false,'message'=>'Target not found']);
  exit;
}

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  define('FUNMAP_GATEWAY_ACTIVE', true);
}
$GLOBALS['FUNMAP_GATEWAY_ACTION'] = $action;

require_once $target;
?>
