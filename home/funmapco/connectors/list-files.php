<?php
/**
 * LIST FILES CONNECTOR
 * 
 * IMAGE SYNC SYSTEM:
 * This connector handles both listing files (GET) and syncing baskets (POST).
 * 
 * GET: Lists filenames from local folders or Bunny CDN Storage API
 * POST: Syncs separate table basket entries with API results
 * 
 * SYNC PROCESS (POST):
 * This syncs ALL picklist types (system-image, category-icon, currency, phone-prefix, amenity)
 * from their corresponding Bunny CDN folders to their respective separate tables.
 * 
 * Steps:
 * 1. Receives filenames array and option_group (system-image, category-icon, currency, phone-prefix, amenity)
 * 2. Maps option_group to table name (system-image -> system_images, etc.)
 * 3. Detects and removes duplicate option_filename entries (keeps lowest ID)
 * 4. Normalizes API filenames (trims, filters empty, removes duplicates from API list)
 * 5. Adds new files that exist in API but not in database basket
 * 6. Removes files from basket that no longer exist in API
 * 7. Handles renamed files (old removed, new added)
 * 
 * Note: Each folder type has its own table:
 * - system-image -> system_images
 * - category-icon -> category_icons
 * - currency -> currencies
 * - phone-prefix -> phone_prefixes
 * - amenity -> amenities
 * 
 * Returns changes array so frontend can update menu if needed.
 */
declare(strict_types=1);

header('Content-Type: application/json');

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    // Handle sync request (POST)
    if ($method === 'POST') {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (!isset($data['filenames']) || !is_array($data['filenames']) || !isset($data['option_group'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'filenames array and option_group are required',
            ]);
            return;
        }

        $optionGroup = $data['option_group']; // 'system-image', 'category-icon', 'currency', 'phone-prefix', 'amenity'
        $validGroups = ['system-image', 'category-icon', 'currency', 'phone-prefix', 'amenity'];
        if (!in_array($optionGroup, $validGroups)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid option_group. Must be one of: ' . implode(', ', $validGroups),
            ]);
            return;
        }

        // Map option_group to table name
        $tableMap = [
            'system-image' => 'system_images',
            'category-icon' => 'category_icons',
            'currency' => 'currencies',
            'phone-prefix' => 'phone_prefixes',
            'amenity' => 'amenities'
        ];
        $tableName = $tableMap[$optionGroup];

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

        $apiFilenames = $data['filenames'];
        $changes = [];

        // Normalize API filenames (trim and filter empty)
        $normalizedApiFilenames = [];
        foreach ($apiFilenames as $apiFilename) {
            if (is_string($apiFilename) && trim($apiFilename) !== '') {
                $normalizedApiFilenames[] = trim($apiFilename);
            }
        }
        $apiFilenames = array_unique($normalizedApiFilenames); // Remove duplicates from API list

        // Get current database filenames with their IDs from the appropriate table
        $stmt = $pdo->prepare("SELECT `id`, `option_filename` FROM `{$tableName}` ORDER BY `id` ASC");
        $stmt->execute();
        $dbRows = $stmt->fetchAll();
        
        // Track filenames and their first occurrence (lowest ID)
        $dbFilenames = [];
        $duplicateIds = [];
        
        foreach ($dbRows as $row) {
            $filename = $row['option_filename'];
            if (empty($filename)) continue;
            
            if (!isset($dbFilenames[$filename])) {
                // First occurrence - keep this one
                $dbFilenames[$filename] = $row['id'];
            } else {
                // Duplicate - mark for deletion
                $duplicateIds[] = $row['id'];
            }
        }

        // Remove duplicates (keep first occurrence, delete rest)
        if (!empty($duplicateIds)) {
            $placeholders = implode(',', array_fill(0, count($duplicateIds), '?'));
            $deleteDuplicatesStmt = $pdo->prepare("DELETE FROM `{$tableName}` WHERE `id` IN ({$placeholders})");
            try {
                $deleteDuplicatesStmt->execute($duplicateIds);
                foreach ($duplicateIds as $dupId) {
                    $changes[] = ['action' => 'duplicate_removed', 'id' => $dupId];
                }
            } catch (PDOException $e) {
                error_log("Failed to remove duplicates from {$tableName}: " . $e->getMessage());
            }
        }

        $insertStmt = $pdo->prepare("INSERT INTO `{$tableName}` (`option_value`, `option_filename`, `option_label`, `sort_order`, `is_active`) VALUES (:option_value, :option_filename, '', 0, 1)");
        $deleteStmt = $pdo->prepare("DELETE FROM `{$tableName}` WHERE `option_filename` = :option_filename");

        $errors = [];
        $insertedCount = 0;
        $deletedCount = 0;

        // Add new files from API (not in database)
        foreach ($apiFilenames as $apiFilename) {
            if (!isset($dbFilenames[$apiFilename])) {
                try {
                    $insertStmt->execute([
                        ':option_value' => $apiFilename,
                        ':option_filename' => $apiFilename
                    ]);
                    $changes[] = ['action' => 'added', 'filename' => $apiFilename];
                    $insertedCount++;
                } catch (PDOException $e) {
                    $errorMsg = "Failed to add filename '{$apiFilename}' to {$tableName}: " . $e->getMessage();
                    error_log($errorMsg);
                    $errors[] = $errorMsg;
                }
            }
        }

        // Remove files that no longer exist in API
        foreach ($dbFilenames as $dbFilename => $dbId) {
            if (!in_array($dbFilename, $apiFilenames)) {
                try {
                    $deleteStmt->execute([
                        ':option_filename' => $dbFilename
                    ]);
                    $changes[] = ['action' => 'removed', 'filename' => $dbFilename];
                    $deletedCount++;
                } catch (PDOException $e) {
                    $errorMsg = "Failed to remove filename '{$dbFilename}' from {$tableName}: " . $e->getMessage();
                    error_log($errorMsg);
                    $errors[] = $errorMsg;
                }
            }
        }

        echo json_encode([
            'success' => empty($errors),
            'changes' => $changes,
            'changes_count' => count($changes),
            'inserted_count' => $insertedCount,
            'deleted_count' => $deletedCount,
            'errors' => $errors,
            'error_count' => count($errors)
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

