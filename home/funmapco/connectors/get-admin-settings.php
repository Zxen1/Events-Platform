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

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Check if admin_settings table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_settings'");
    if ($stmt->rowCount() === 0) {
        // Table doesn't exist, return defaults
        echo json_encode([
            'success' => true,
            'settings' => [
                'spin_on_load' => false,
                'spin_load_type' => 'everyone',
                'spin_on_logo' => true,
                'site_currency' => 'USD',
            ],
        ]);
        return;
    }

    // Fetch all settings
    $stmt = $pdo->query('SELECT `setting_key`, `setting_value`, `setting_type` FROM `admin_settings`');
    $rows = $stmt->fetchAll();

    $settings = [];
    foreach ($rows as $row) {
        $key = $row['setting_key'];
        $value = $row['setting_value'];
        $type = $row['setting_type'] ?? 'string';

        // Convert value based on type
        switch ($type) {
            case 'boolean':
                $settings[$key] = ($value === 'true' || $value === '1' || $value === 1);
                break;
            case 'integer':
                $settings[$key] = is_numeric($value) ? (int)$value : 0;
                break;
            case 'decimal':
            case 'number':
                $settings[$key] = is_numeric($value) ? (float)$value : 0;
                break;
            case 'json':
                if ($value === null || $value === '') {
                    $settings[$key] = [];
                } else {
                    $decoded = json_decode($value, true);
                    $settings[$key] = $decoded ?? [];
                }
                break;
            default:
                $settings[$key] = $value;
        }
    }

    $response = [
        'success' => true,
        'settings' => $settings,
    ];

    // Optionally include admin messages if requested
    $includeMessages = isset($_GET['include_messages']) && $_GET['include_messages'] === 'true';
    if ($includeMessages) {
        try {
            // Check if admin_messages table exists
            $stmt = $pdo->query("SHOW TABLES LIKE 'admin_messages'");
            if ($stmt->rowCount() > 0) {
                // Fetch all admin messages grouped by container_key
                $sql = "SELECT 
                            am.id,
                            am.message_name,
                            am.message_key,
                            am.message_type,
                            am.message_category,
                            am.container_key,
                            am.message_text,
                            am.message_description,
                            am.supports_html,
                            am.placeholders,
                            am.is_active,
                            am.is_visible,
                            am.is_deletable,
                            am.display_duration,
                            lc.container_name,
                            lc.icon_path as container_icon
                        FROM admin_messages am
                        LEFT JOIN layout_containers lc ON am.container_key = lc.container_key
                        WHERE am.is_active = 1
                        ORDER BY lc.sort_order ASC, am.id ASC";
                
                $stmt = $pdo->query($sql);
                $messages = $stmt->fetchAll();

                // Group messages by container_key
                $messagesByContainer = [];
                foreach ($messages as $message) {
                    $containerKey = $message['container_key'] ?? 'uncategorized';
                    
                    if (!isset($messagesByContainer[$containerKey])) {
                        $messagesByContainer[$containerKey] = [
                            'container_key' => $containerKey,
                            'container_name' => $message['container_name'] ?? ucfirst(str_replace('_', ' ', $containerKey)),
                            'container_icon' => $message['container_icon'] ?? null,
                            'messages' => []
                        ];
                    }
                    
                    // Parse placeholders JSON if present
                    $placeholders = null;
                    if (!empty($message['placeholders'])) {
                        $decoded = json_decode($message['placeholders'], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $placeholders = $decoded;
                        }
                    }
                    
                    $messagesByContainer[$containerKey]['messages'][] = [
                        'id' => (int)$message['id'],
                        'message_name' => $message['message_name'],
                        'message_key' => $message['message_key'],
                        'message_type' => $message['message_type'],
                        'message_category' => $message['message_category'],
                        'message_text' => $message['message_text'],
                        'message_description' => $message['message_description'],
                        'supports_html' => (bool)$message['supports_html'],
                        'placeholders' => $placeholders,
                        'is_active' => (bool)$message['is_active'],
                        'is_visible' => (bool)$message['is_visible'],
                        'is_deletable' => (bool)$message['is_deletable'],
                        'display_duration' => $message['display_duration'] ? (int)$message['display_duration'] : null
                    ];
                }

                $response['messages'] = array_values($messagesByContainer);
            }
        } catch (Throwable $messageError) {
            // If messages fail, don't break the whole response
            $response['messages_error'] = $messageError->getMessage();
        }
    }

    echo json_encode($response);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

