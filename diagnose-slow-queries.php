<?php
/**
 * Diagnostic script to find slow database queries
 * Place in web root and visit: https://funmap.com/diagnose-slow-queries.php
 */

header('Content-Type: text/plain; charset=utf-8');

echo "=== Database Query Performance Diagnostic ===\n\n";

$configCandidates = [
    __DIR__ . '/home/funmapco/config/config-db.php',
    __DIR__ . '/config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
];

$configPath = null;
foreach ($configCandidates as $candidate) {
    if (is_file($candidate)) {
        $configPath = $candidate;
        break;
    }
}

if ($configPath === null) {
    echo "ERROR: Database config not found\n";
    exit;
}

require_once $configPath;

if (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} else {
    echo "ERROR: Database constants not defined\n";
    exit;
}

// Test 1: Basic connection
echo "1. Testing database connection...\n";
$start = microtime(true);
try {
    $pdo->query('SELECT 1');
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✓ Connection successful ({$time}ms)\n\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
    exit;
}

// Test 2: admin_settings query
echo "2. Testing admin_settings query...\n";
$start = microtime(true);
try {
    $stmt = $pdo->query('SELECT `setting_key`, `setting_value`, `setting_type` FROM `admin_settings`');
    $rows = $stmt->fetchAll();
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✓ Query successful ({$time}ms, " . count($rows) . " rows)\n\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
}

// Test 3: checkout_options query
echo "3. Testing checkout_options query...\n";
$start = microtime(true);
try {
    $stmt = $pdo->query('SELECT `id`, `checkout_key`, `checkout_title` FROM `checkout_options` LIMIT 10');
    $rows = $stmt->fetchAll();
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✓ Query successful ({$time}ms, " . count($rows) . " rows)\n\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
}

// Test 4: admin_messages query (the potentially slow one)
echo "4. Testing admin_messages query (with LEFT JOIN)...\n";
$start = microtime(true);
try {
    // Check if layout_containers exists
    $checkStmt = $pdo->query("SHOW TABLES LIKE 'layout_containers'");
    $hasLayoutContainers = ($checkStmt->rowCount() > 0);
    echo "   layout_containers table exists: " . ($hasLayoutContainers ? 'YES' : 'NO') . "\n";
    
    if ($hasLayoutContainers) {
        $sql = "SELECT am.id, am.message_key, lc.container_name
                FROM admin_messages am
                LEFT JOIN layout_containers lc ON am.container_key = lc.container_key
                WHERE am.is_active = 1
                LIMIT 10";
    } else {
        $sql = "SELECT id, message_key FROM admin_messages WHERE is_active = 1 LIMIT 10";
    }
    
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✓ Query successful ({$time}ms, " . count($rows) . " rows)\n\n";
} catch (PDOException $e) {
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✗ ERROR after {$time}ms: " . $e->getMessage() . "\n\n";
}

// Test 5: subcategories query (the one we fixed)
echo "5. Testing subcategories query...\n";
$start = microtime(true);
try {
    $stmt = $pdo->query('SELECT id, subcategory_name, checkout_surcharge FROM subcategories LIMIT 10');
    $rows = $stmt->fetchAll();
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✓ Query successful ({$time}ms, " . count($rows) . " rows)\n\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
}

// Test 6: Full get-admin-settings simulation
echo "6. Simulating full get-admin-settings endpoint...\n";
$start = microtime(true);
try {
    // admin_settings
    $stmt = $pdo->query('SELECT `setting_key`, `setting_value`, `setting_type` FROM `admin_settings`');
    $settings = $stmt->fetchAll();
    
    // general_options
    $stmt = $pdo->query("SHOW TABLES LIKE 'general_options'");
    if ($stmt->rowCount() > 0) {
        $stmt = $pdo->query('SELECT `option_group`, `option_value`, `option_label` FROM `general_options` WHERE `is_active` = 1 LIMIT 10');
        $options = $stmt->fetchAll();
    }
    
    // checkout_options
    $stmt = $pdo->query("SHOW TABLES LIKE 'checkout_options'");
    if ($stmt->rowCount() > 0) {
        $stmt = $pdo->query('SELECT `id`, `checkout_key`, `checkout_title` FROM `checkout_options` LIMIT 10');
        $checkout = $stmt->fetchAll();
    }
    
    // admin_messages (if include_messages)
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_messages'");
    if ($stmt->rowCount() > 0) {
        $checkStmt = $pdo->query("SHOW TABLES LIKE 'layout_containers'");
        $hasLayoutContainers = ($checkStmt->rowCount() > 0);
        
        if ($hasLayoutContainers) {
            $sql = "SELECT am.id, am.message_key FROM admin_messages am LEFT JOIN layout_containers lc ON am.container_key = lc.container_key WHERE am.is_active = 1 LIMIT 10";
        } else {
            $sql = "SELECT id, message_key FROM admin_messages WHERE is_active = 1 LIMIT 10";
        }
        $stmt = $pdo->query($sql);
        $messages = $stmt->fetchAll();
    }
    
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✓ All queries completed ({$time}ms total)\n";
    echo "   - admin_settings: " . count($settings) . " rows\n";
    echo "   - checkout_options: " . (isset($checkout) ? count($checkout) : 0) . " rows\n";
    echo "   - admin_messages: " . (isset($messages) ? count($messages) : 0) . " rows\n\n";
} catch (PDOException $e) {
    $time = round((microtime(true) - $start) * 1000, 2);
    echo "   ✗ ERROR after {$time}ms: " . $e->getMessage() . "\n\n";
}

// Test 7: Check database server status
echo "7. Checking database server status...\n";
try {
    $stmt = $pdo->query('SHOW STATUS LIKE "Threads_connected"');
    $threads = $stmt->fetch();
    echo "   Connected threads: " . ($threads['Value'] ?? 'unknown') . "\n";
    
    $stmt = $pdo->query('SHOW STATUS LIKE "Slow_queries"');
    $slow = $stmt->fetch();
    echo "   Slow queries: " . ($slow['Value'] ?? 'unknown') . "\n";
    
    $stmt = $pdo->query('SHOW VARIABLES LIKE "max_execution_time"');
    $maxExec = $stmt->fetch();
    echo "   Max execution time: " . ($maxExec['Value'] ?? 'not set') . "\n\n";
} catch (PDOException $e) {
    echo "   ⚠ Could not check status: " . $e->getMessage() . "\n\n";
}

echo "=== Diagnostic Complete ===\n";
echo "\nIf any query takes more than 1-2 seconds, that's your bottleneck.\n";

