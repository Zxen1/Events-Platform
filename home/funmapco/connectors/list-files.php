<?php
declare(strict_types=1);

header('Content-Type: application/json');

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    // Handle sync request (POST)
    if ($method === 'POST') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (!isset($data['filenames']) || !is_array($data['filenames']) || !isset($data['table'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'filenames array and table name are required',
            ]);
            return;
        }

        $tableName = $data['table']; // 'system_images' or 'category_icons'
        if ($tableName !== 'system_images' && $tableName !== 'category_icons') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid table name. Must be system_images or category_icons',
            ]);
            return;
        }

        // Database connection code
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
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database configuration file is missing.',
            ]);
            return;
        }
        require_once $configPath;

        $pdo = null;
        if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
            $pdo = $GLOBALS['pdo'];
        } elseif (defined('DB_DSN')) {
            $user = defined('DB_USER') ? DB_USER : null;
            $pass = defined('DB_PASS') ? DB_PASS : null;
            $pdo = new PDO(DB_DSN, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } elseif (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
            $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
            $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }

        if (!$pdo instanceof PDO) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database connection not configured.',
            ]);
            return;
        }

        $stmt = $pdo->query("SHOW TABLES LIKE '{$tableName}'");
        if ($stmt->rowCount() === 0) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => "{$tableName} table does not exist",
            ]);
            return;
        }

        $apiFilenames = $data['filenames'];
        $changes = [];

        // Get current database filenames
        $stmt = $pdo->query("SELECT `filename` FROM `{$tableName}`");
        $dbRows = $stmt->fetchAll();
        
        $dbFilenames = [];
        foreach ($dbRows as $row) {
            $dbFilenames[$row['filename']] = true;
        }

        $insertStmt = $pdo->prepare("INSERT INTO `{$tableName}` (`filename`) VALUES (:filename)");
        $deleteStmt = $pdo->prepare("DELETE FROM `{$tableName}` WHERE `filename` = :filename");

        // Add new files from API
        foreach ($apiFilenames as $apiFilename) {
            if (!is_string($apiFilename) || trim($apiFilename) === '') {
                continue;
            }
            
            $apiFilename = trim($apiFilename);
            
            if (!isset($dbFilenames[$apiFilename])) {
                try {
                    $insertStmt->execute([':filename' => $apiFilename]);
                    $changes[] = ['action' => 'added', 'filename' => $apiFilename];
                } catch (PDOException $e) {
                    error_log("Failed to add filename '{$apiFilename}' to {$tableName}: " . $e->getMessage());
                }
            }
        }

        // Remove files that no longer exist in API
        foreach ($dbFilenames as $dbFilename => $exists) {
            if (!in_array($dbFilename, $apiFilenames)) {
                try {
                    $deleteStmt->execute([':filename' => $dbFilename]);
                    $changes[] = ['action' => 'removed', 'filename' => $dbFilename];
                } catch (PDOException $e) {
                    error_log("Failed to remove filename '{$dbFilename}' from {$tableName}: " . $e->getMessage());
                }
            }
        }

        echo json_encode([
            'success' => true,
            'changes' => $changes,
            'changes_count' => count($changes),
        ]);
        return;
    }
    
    // Original GET request code for listing files
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed',
        ]);
        return;
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
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database configuration file is missing.',
        ]);
        return;
    }
    require_once $configPath;

    $pdo = null;
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        $pdo = $GLOBALS['pdo'];
    } elseif (defined('DB_DSN')) {
        $user = defined('DB_USER') ? DB_USER : null;
        $pass = defined('DB_PASS') ? DB_PASS : null;
        $pdo = new PDO(DB_DSN, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } elseif (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    if (!$pdo instanceof PDO) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database connection not configured.',
        ]);
        return;
    }

    $folder = isset($_GET['folder']) ? trim((string)$_GET['folder']) : '';
    if ($folder === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Folder parameter is required',
        ]);
        return;
    }

    $icons = [];

    // Check if folder is a URL (online storage)
    $isUrl = strpos($folder, 'http://') === 0 || strpos($folder, 'https://') === 0;

    if ($isUrl) {
        // Online storage - detect service and use appropriate API
        $isBunny = strpos($folder, 'cdn.funmap.com') !== false || strpos($folder, 'storage.bunnycdn.com') !== false;
        
        if ($isBunny) {
            // Bunny CDN - use Storage API
            try {
                $stmt = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'storage_api_key' LIMIT 1");
                $apiKeyRow = $stmt->fetch();
                $storageApiKey = $apiKeyRow && isset($apiKeyRow['setting_value']) ? trim($apiKeyRow['setting_value']) : '';

                $stmt = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'storage_zone_name' LIMIT 1");
                $zoneRow = $stmt->fetch();
                $storageZoneName = $zoneRow && isset($zoneRow['setting_value']) ? trim($zoneRow['setting_value']) : '';

                if ($storageApiKey === '' || $storageZoneName === '') {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Bunny Storage API credentials not configured',
                    ]);
                    return;
                }

                // Extract folder path from CDN URL
                // e.g., https://cdn.funmap.com/category-icons -> category-icons
                $cdnPath = preg_replace('#^https?://[^/]+/#', '', $folder);
                $cdnPath = rtrim($cdnPath, '/');
                
                // Construct Bunny Storage API URL
                $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $cdnPath . '/';

                $ch = curl_init($apiUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'AccessKey: ' . $storageApiKey,
                ]);

                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);

                if ($curlError !== '') {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Bunny Storage API error: ' . $curlError,
                    ]);
                    return;
                }

                if ($httpCode !== 200) {
                    http_response_code($httpCode);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Bunny Storage API returned error code: ' . $httpCode,
                    ]);
                    return;
                }

                $files = json_decode($response, true);
                if (!is_array($files)) {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Invalid response from Bunny Storage API',
                    ]);
                    return;
                }

                // Extract filenames from Bunny API response
                foreach ($files as $file) {
                    if (is_array($file)) {
                        // Skip directories
                        if (isset($file['IsDirectory']) && $file['IsDirectory']) {
                            continue;
                        }
                        
                        // Extract filename from various possible fields
                        $filename = $file['ObjectName'] ?? $file['Name'] ?? $file['FileName'] ?? $file['filename'] ?? null;
                        if ($filename && is_string($filename)) {
                            $icons[] = $filename;
                        }
                    }
                }
            } catch (Throwable $e) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Error fetching from Bunny Storage: ' . $e->getMessage(),
                ]);
                return;
            }
        } else {
            // Other online storage - not supported yet
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Online storage service not supported. Only Bunny CDN is currently supported.',
            ]);
            return;
        }
    } else {
        // Local folder - use file system
        $realPath = realpath($folder);
        if ($realPath === false || !is_dir($realPath)) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Folder not found: ' . $folder,
            ]);
            return;
        }

        // Security check - prevent directory traversal
        $basePath = realpath(__DIR__ . '/../../');
        if ($basePath === false || strpos($realPath, $basePath) !== 0) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied',
            ]);
            return;
        }

        $files = scandir($realPath);
        if ($files === false) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to read directory',
            ]);
            return;
        }

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $filePath = $realPath . DIRECTORY_SEPARATOR . $file;
            if (is_file($filePath)) {
                $icons[] = $file;
            }
        }
    }

    // Sort icons alphabetically
    sort($icons);

    echo json_encode([
        'success' => true,
        'icons' => $icons,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

