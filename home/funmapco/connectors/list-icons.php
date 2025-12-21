<?php
declare(strict_types=1);

header('Content-Type: application/json');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed',
        ]);
        return;
    }

    // Get folder parameter
    $folder = $_GET['folder'] ?? '';
    if (empty($folder)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Folder parameter is required',
        ]);
        return;
    }

    // Check if this is a Bunny CDN URL (starts with http:// or https://)
    $isBunnyUrl = (strpos($folder, 'http://') === 0 || strpos($folder, 'https://') === 0);
    
    $icons = [];
    
    if ($isBunnyUrl) {
        // Handle Bunny CDN URL
        // Extract path from CDN URL (e.g., https://cdn.funmap.com/system-images -> system-images)
        $parsedUrl = parse_url($folder);
        $path = isset($parsedUrl['path']) ? trim($parsedUrl['path'], '/') : '';
        
        // If path is empty, we're listing the root of the storage zone
        // Otherwise, we're listing files in the specified folder
        
        // Get storage API key and storage zone name from database
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

        // Get storage API key and storage zone name from admin_settings
        try {
            $stmt = $pdo->query("SELECT `setting_key`, `setting_value` FROM `admin_settings` WHERE `setting_key` IN ('storage_api_key', 'storage_zone_name')");
            $settings = [];
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage(),
            ]);
            return;
        }

        $apiKey = $settings['storage_api_key'] ?? '';
        $storageZoneName = $settings['storage_zone_name'] ?? '';

        if (empty($apiKey)) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Bunny Storage API key not configured. Please set storage_api_key in Admin Settings.',
            ]);
            return;
        }

        if (empty($storageZoneName)) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Bunny Storage zone name not configured. Please set storage_zone_name in Admin Settings.',
            ]);
            return;
        }

        // Call Bunny Storage API to list files
        // API endpoint: GET https://storage.bunnycdn.com/{StorageZoneName}/{Path}
        // Path should be the folder name (e.g., "system-images") without trailing slash
        $apiUrl = 'https://storage.bunnycdn.com/' . urlencode($storageZoneName);
        if (!empty($path)) {
            $apiUrl .= '/' . urlencode($path);
        }
        
        $ch = curl_init($apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'AccessKey: ' . $apiKey,
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to connect to Bunny Storage API: ' . $curlError,
            ]);
            return;
        }

        if ($httpCode !== 200) {
            http_response_code(500);
            $errorBody = $response ? substr($response, 0, 200) : 'No response body';
            echo json_encode([
                'success' => false,
                'message' => 'Bunny Storage API returned error code: ' . $httpCode . '. Response: ' . $errorBody,
            ]);
            return;
        }

        // Parse JSON response from Bunny API
        $files = json_decode($response, true);
        if ($files === null && json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid JSON response from Bunny Storage API: ' . json_last_error_msg() . '. Response: ' . substr($response, 0, 200),
            ]);
            return;
        }
        
        if (!is_array($files)) {
            // Empty response or non-array - return empty list instead of error
            $files = [];
        }

        // Extract just the filenames from the response
        // Bunny API returns array of objects with properties like: ObjectName, IsDirectory, etc.
        // OR it might return an array of strings (filenames) directly
        foreach ($files as $file) {
            // Handle case where API returns array of strings (filenames)
            if (is_string($file)) {
                $filename = basename($file);
                if (!empty($filename) && $filename !== '.' && $filename !== '..') {
                    $icons[] = $filename;
                }
                continue;
            }
            
            // Handle case where API returns array of objects
            if (!is_array($file)) {
                continue;
            }
            
            // Skip directories
            if (isset($file['IsDirectory']) && $file['IsDirectory'] === true) {
                continue;
            }
            
            // Get the object name (full path from storage root)
            // Try different possible property names
            $objectName = $file['ObjectName'] ?? $file['Name'] ?? $file['FileName'] ?? $file['filename'] ?? '';
            if (empty($objectName) || !is_string($objectName)) {
                continue;
            }
            
            // Extract filename (last part of path)
            // ObjectName might be like "system-images/icon.svg" or just "icon.svg"
            $filename = basename($objectName);
            
            // Only add if it's a valid filename (not empty, not a directory marker)
            if (!empty($filename) && $filename !== '.' && $filename !== '..') {
                $icons[] = $filename;
            }
        }

    } else {
        // Handle local folder
        // Remove trailing slash if present
        $localPath = rtrim($folder, '/');
        
        // Security: prevent directory traversal
        if (strpos($localPath, '..') !== false) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid folder path',
            ]);
            return;
        }

        // Convert to absolute path if relative
        if (!is_dir($localPath)) {
            // Try relative to document root
            $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/../../..';
            $localPath = $docRoot . '/' . ltrim($localPath, '/');
        }

        if (!is_dir($localPath)) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Folder not found: ' . $folder,
            ]);
            return;
        }

        // List files in directory
        $files = scandir($localPath);
        if ($files === false) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to read folder',
            ]);
            return;
        }

        // Filter out directories and hidden files
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $filePath = $localPath . '/' . $file;
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

