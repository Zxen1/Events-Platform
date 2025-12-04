<?php
// Quick server status check
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Server Status Check</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: #fff; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ok { background: #2d5a2d; }
        .error { background: #5a2d2d; }
        .info { background: #2d3a5a; }
        pre { background: #000; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Server Status Check</h1>
    
    <?php
    echo '<div class="status info">';
    echo '<strong>PHP Version:</strong> ' . phpversion();
    echo '</div>';
    
    echo '<div class="status info">';
    echo '<strong>Server Software:</strong> ' . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown');
    echo '</div>';
    
    echo '<div class="status info">';
    echo '<strong>Server Hostname:</strong> ' . gethostname();
    echo '</div>';
    
    // Check database connection
    $configCandidates = [
        __DIR__ . '/config/config-db.php',
        dirname(__DIR__) . '/config/config-db.php',
        dirname(__DIR__, 2) . '/config/config-db.php',
    ];
    
    $configPath = null;
    foreach ($configCandidates as $candidate) {
        if (is_file($candidate)) {
            $configPath = $candidate;
            break;
        }
    }
    
    if ($configPath) {
        echo '<div class="status ok">';
        echo '<strong>Database Config Found:</strong> ' . $configPath;
        echo '</div>';
        
        try {
            require_once $configPath;
            
            $pdo = null;
            if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
                $pdo = $GLOBALS['pdo'];
            } elseif (defined('DB_DSN')) {
                $user = defined('DB_USER') ? DB_USER : null;
                $pass = defined('DB_PASS') ? DB_PASS : null;
                $pdo = new PDO(DB_DSN, $user, $pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                ]);
            } elseif (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
                $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
                $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                ]);
            }
            
            if ($pdo) {
                echo '<div class="status ok">';
                echo '<strong>Database Connection:</strong> OK';
                echo '</div>';
                
                // Check if admin_only column exists
                try {
                    $stmt = $pdo->query("SHOW COLUMNS FROM `checkout_options` LIKE 'admin_only'");
                    if ($stmt->rowCount() > 0) {
                        echo '<div class="status ok">';
                        echo '<strong>checkout_options.admin_only column:</strong> EXISTS';
                        echo '</div>';
                    } else {
                        echo '<div class="status error">';
                        echo '<strong>checkout_options.admin_only column:</strong> MISSING - You need to run the ALTER TABLE SQL';
                        echo '</div>';
                    }
                } catch (Exception $e) {
                    echo '<div class="status error">';
                    echo '<strong>Error checking admin_only column:</strong> ' . htmlspecialchars($e->getMessage());
                    echo '</div>';
                }
            } else {
                echo '<div class="status error">';
                echo '<strong>Database Connection:</strong> FAILED - Could not create PDO';
                echo '</div>';
            }
        } catch (Exception $e) {
            echo '<div class="status error">';
            echo '<strong>Database Error:</strong> ' . htmlspecialchars($e->getMessage());
            echo '</div>';
        }
    } else {
        echo '<div class="status error">';
        echo '<strong>Database Config:</strong> NOT FOUND';
        echo '</div>';
    }
    
    // Check PHP errors
    $errorLog = ini_get('error_log');
    if ($errorLog && file_exists($errorLog)) {
        $errors = file_get_contents($errorLog);
        $recentErrors = array_slice(explode("\n", $errors), -10);
        if (!empty(array_filter($recentErrors))) {
            echo '<div class="status error">';
            echo '<strong>Recent PHP Errors:</strong>';
            echo '<pre>' . htmlspecialchars(implode("\n", $recentErrors)) . '</pre>';
            echo '</div>';
        }
    }
    
    // Check if main files exist
    $filesToCheck = [
        'index.html',
        'index.js',
        'home/funmapco/connectors/gateway.php',
        'home/funmapco/connectors/get-admin-settings.php',
        'home/funmapco/connectors/save-admin-settings.php',
    ];
    
    echo '<div class="status info">';
    echo '<strong>File Check:</strong><br>';
    foreach ($filesToCheck as $file) {
        $path = __DIR__ . '/' . $file;
        if (file_exists($path)) {
            echo '✓ ' . $file . '<br>';
        } else {
            echo '✗ ' . $file . ' (MISSING)<br>';
        }
    }
    echo '</div>';
    ?>
    
    <h2>Next Steps</h2>
    <ol>
        <li>If admin_only column is missing, run: <code>ALTER TABLE `checkout_options` ADD COLUMN `admin_only` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`;</code></li>
        <li>Check browser console (F12) for JavaScript errors</li>
        <li>Check server error logs</li>
        <li>Try accessing index.html directly</li>
    </ol>
</body>
</html>

