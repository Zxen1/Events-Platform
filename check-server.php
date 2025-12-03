<?php
/**
 * Check which server you're on
 * Visit: https://funmap.com/check-server.php
 */

header('Content-Type: text/plain; charset=utf-8');

echo "=== Server Information ===\n\n";

// Method 1: Server hostname
echo "1. Server Hostname:\n";
if (isset($_SERVER['SERVER_NAME'])) {
    echo "   SERVER_NAME: " . $_SERVER['SERVER_NAME'] . "\n";
}
if (isset($_SERVER['HTTP_HOST'])) {
    echo "   HTTP_HOST: " . $_SERVER['HTTP_HOST'] . "\n";
}
if (function_exists('gethostname')) {
    $hostname = gethostname();
    echo "   gethostname(): " . $hostname . "\n";
    
    // Check if it matches affected servers
    if (stripos($hostname, 's01ad.syd4.hostingplatform.net.au') !== false) {
        echo "   ⚠ WARNING: You are on AFFECTED server s01ad.syd4.hostingplatform.net.au\n";
    } elseif (stripos($hostname, 's02ad.syd4.hostingplatform.net.au') !== false) {
        echo "   ⚠ WARNING: You are on AFFECTED server s02ad.syd4.hostingplatform.net.au\n";
    } else {
        echo "   ✓ Not on the affected servers (or hostname doesn't match)\n";
    }
}
echo "\n";

// Method 2: Server IP
echo "2. Server IP Address:\n";
if (isset($_SERVER['SERVER_ADDR'])) {
    echo "   SERVER_ADDR: " . $_SERVER['SERVER_ADDR'] . "\n";
}
if (isset($_SERVER['LOCAL_ADDR'])) {
    echo "   LOCAL_ADDR: " . $_SERVER['LOCAL_ADDR'] . "\n";
}
echo "\n";

// Method 3: Reverse DNS lookup
echo "3. Reverse DNS Lookup:\n";
if (isset($_SERVER['SERVER_ADDR'])) {
    $ip = $_SERVER['SERVER_ADDR'];
    $hostname = gethostbyaddr($ip);
    if ($hostname && $hostname !== $ip) {
        echo "   IP: $ip\n";
        echo "   Hostname: $hostname\n";
        
        // Check if it matches affected servers
        if (stripos($hostname, 's01ad.syd4.hostingplatform.net.au') !== false) {
            echo "   ⚠ WARNING: You are on AFFECTED server s01ad.syd4.hostingplatform.net.au\n";
        } elseif (stripos($hostname, 's02ad.syd4.hostingplatform.net.au') !== false) {
            echo "   ⚠ WARNING: You are on AFFECTED server s02ad.syd4.hostingplatform.net.au\n";
        }
    } else {
        echo "   Could not resolve hostname from IP\n";
    }
}
echo "\n";

// Method 4: Check database host (might show server info)
echo "4. Database Connection Info:\n";
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

if ($configPath && defined('DB_HOST')) {
    echo "   Database Host: " . DB_HOST . "\n";
    if (stripos(DB_HOST, 's01ad.syd4') !== false || stripos(DB_HOST, 's02ad.syd4') !== false) {
        echo "   ⚠ Database might be on affected server\n";
    }
} else {
    echo "   Could not read database config\n";
}
echo "\n";

// Method 5: All SERVER variables (for debugging)
echo "5. Additional Server Info:\n";
echo "   PHP Version: " . PHP_VERSION . "\n";
echo "   Server Software: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'unknown') . "\n";
echo "   Document Root: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'unknown') . "\n";
echo "\n";

echo "=== Summary ===\n";
echo "If any hostname contains 's01ad.syd4.hostingplatform.net.au' or 's02ad.syd4.hostingplatform.net.au',\n";
echo "you are on an affected server and the maintenance is likely causing your slowness.\n";

