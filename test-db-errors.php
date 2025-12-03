<?php
/**
 * Quick database error test script
 * Place this in your web root and visit: https://funmap.com/test-db-errors.php
 * This will test the database connections and queries
 */

header('Content-Type: text/plain; charset=utf-8');

echo "=== Database Error Test ===\n\n";

// Test 1: Database connection
echo "1. Testing database connection...\n";
try {
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
        throw new Exception('Database config file not found');
    }
    
    require_once $configPath;
    
    if (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        echo "   ✓ Database connection successful\n\n";
    } else {
        throw new Exception('Database constants not defined');
    }
} catch (Exception $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
    exit;
}

// Test 2: Check subcategories table structure
echo "2. Testing subcategories table...\n";
try {
    $stmt = $pdo->query('DESCRIBE subcategories');
    $columns = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['Field'];
    }
    echo "   ✓ Found " . count($columns) . " columns\n";
    
    // Check for removed columns
    $removedColumns = ['listing_fee', 'renew_fee', 'featured_fee', 'renew_featured_fee', 'listing_days'];
    $foundRemoved = [];
    foreach ($removedColumns as $col) {
        if (in_array($col, $columns)) {
            $foundRemoved[] = $col;
        }
    }
    
    if (!empty($foundRemoved)) {
        echo "   ⚠ WARNING: Found removed columns: " . implode(', ', $foundRemoved) . "\n";
    } else {
        echo "   ✓ No removed columns found (good!)\n";
    }
    
    // Check for new column
    if (in_array('checkout_surcharge', $columns)) {
        echo "   ✓ checkout_surcharge column exists (good!)\n";
    } else {
        echo "   ⚠ WARNING: checkout_surcharge column missing\n";
    }
    echo "\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
}

// Test 3: Test SELECT query on subcategories
echo "3. Testing SELECT query on subcategories...\n";
try {
    $stmt = $pdo->query('SELECT id, subcategory_name, checkout_surcharge FROM subcategories LIMIT 5');
    $count = 0;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $count++;
    }
    echo "   ✓ Query successful, found $count rows\n\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
}

// Test 4: Check checkout_options table
echo "4. Testing checkout_options table...\n";
try {
    $stmt = $pdo->query('DESCRIBE checkout_options');
    $columns = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['Field'];
    }
    echo "   ✓ Found " . count($columns) . " columns\n";
    
    // Check for removed column
    if (in_array('checkout_duration_days', $columns)) {
        echo "   ⚠ WARNING: checkout_duration_days column still exists (should be removed)\n";
    } else {
        echo "   ✓ checkout_duration_days column removed (good!)\n";
    }
    
    // Test SELECT
    $stmt = $pdo->query('SELECT id, checkout_key, checkout_title FROM checkout_options LIMIT 5');
    $count = 0;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $count++;
    }
    echo "   ✓ Query successful, found $count checkout options\n\n";
} catch (PDOException $e) {
    echo "   ✗ ERROR: " . $e->getMessage() . "\n\n";
}

// Test 5: Test the actual API endpoints
echo "5. Testing API endpoints...\n";
echo "   Testing: /gateway.php?action=get-admin-settings\n";
$ch = curl_init('https://funmap.com/gateway.php?action=get-admin-settings');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $data = json_decode($response, true);
    if ($data && isset($data['success'])) {
        if ($data['success']) {
            echo "   ✓ API returned success\n";
        } else {
            echo "   ✗ API returned error: " . ($data['message'] ?? 'Unknown error') . "\n";
        }
    } else {
        echo "   ⚠ API returned invalid JSON\n";
    }
} else {
    echo "   ✗ API returned HTTP $httpCode\n";
}

echo "\n=== Test Complete ===\n";

