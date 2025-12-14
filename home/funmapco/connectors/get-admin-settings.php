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
    // Set PHP execution timeout for this script (30 seconds max)
    set_time_limit(30);
    
    // Set MySQL query timeout (5 seconds per query - prevents hanging)
    try {
        $pdo->exec("SET SESSION max_execution_time = 5000"); // 5 seconds in milliseconds
    } catch (PDOException $e) {
        // Ignore if not supported
    }

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

    // Fetch picklist data for dropdown settings (currencies, phone prefixes, amenities, etc.)
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'picklist'");
        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->query('SELECT `option_group`, `option_value`, `option_label`, `sort_order` FROM `picklist` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $optionRows = $stmt->fetchAll();
            
            $picklist = [];
            foreach ($optionRows as $row) {
                $group = $row['option_group'];
                if (!isset($picklist[$group])) {
                    $picklist[$group] = [];
                }
                $picklist[$group][] = [
                    'value' => $row['option_value'],
                    'label' => $row['option_label'],
                ];
            }
            $response['picklist'] = $picklist;
        }
    } catch (Throwable $optionsError) {
        // If options fail, don't break the whole response
    }

    // Fetch checkout_options
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'checkout_options'");
        if ($stmt->rowCount() > 0) {
            // Check if admin_only column exists, then select accordingly
            $hasAdminOnly = false;
            try {
                $colCheck = $pdo->query("SHOW COLUMNS FROM `checkout_options` LIKE 'admin_only'");
                $hasAdminOnly = $colCheck->rowCount() > 0;
            } catch (Exception $e) {
                // Column doesn't exist, continue without it
            }
            
            $adminOnlySelect = $hasAdminOnly ? ', `admin_only`' : '';
            $stmt = $pdo->query('SELECT `id`, `checkout_key`, `checkout_title`, `checkout_description`, `checkout_flagfall_price`, `checkout_basic_day_rate`, `checkout_discount_day_rate`, `checkout_currency`, `checkout_featured`, `checkout_sidebar_ad`, `sort_order`, `is_active`' . $adminOnlySelect . ' FROM `checkout_options` ORDER BY `sort_order` ASC, `id` ASC');
            $checkoutRows = $stmt->fetchAll();
            
            $checkoutOptions = [];
            foreach ($checkoutRows as $row) {
                $checkoutOptions[] = [
                    'id' => (int)$row['id'],
                    'checkout_key' => $row['checkout_key'],
                    'checkout_title' => $row['checkout_title'],
                    'checkout_description' => $row['checkout_description'],
                    'checkout_flagfall_price' => round((float)$row['checkout_flagfall_price'], 2),
                    'checkout_basic_day_rate' => isset($row['checkout_basic_day_rate']) && $row['checkout_basic_day_rate'] !== null ? round((float)$row['checkout_basic_day_rate'], 2) : null,
                    'checkout_discount_day_rate' => isset($row['checkout_discount_day_rate']) && $row['checkout_discount_day_rate'] !== null ? round((float)$row['checkout_discount_day_rate'], 2) : null,
                    'checkout_currency' => $row['checkout_currency'],
                    'checkout_featured' => isset($row['checkout_featured']) ? (int)$row['checkout_featured'] : 0,
                    'checkout_sidebar_ad' => (bool)$row['checkout_sidebar_ad'],
                    'sort_order' => (int)$row['sort_order'],
                    'is_active' => (bool)$row['is_active'],
                    'admin_only' => isset($row['admin_only']) ? (bool)$row['admin_only'] : false,
                ];
            }
            $response['checkout_options'] = $checkoutOptions;
        }
    } catch (Throwable $checkoutError) {
        // If checkout options fail, don't break the whole response
    }

    // Optionally include admin messages if requested
    $includeMessages = isset($_GET['include_messages']) && $_GET['include_messages'] === 'true';
    if ($includeMessages) {
        try {
            // Check if admin_messages table exists
            $stmt = $pdo->query("SHOW TABLES LIKE 'admin_messages'");
            if ($stmt->rowCount() > 0) {
                // Fetch all admin messages grouped by container_key
                // Use a simpler query first to check if layout_containers exists
                $hasLayoutContainers = false;
                try {
                    $checkStmt = $pdo->query("SHOW TABLES LIKE 'layout_containers'");
                    $hasLayoutContainers = ($checkStmt->rowCount() > 0);
                } catch (PDOException $e) {
                    // Table doesn't exist, skip JOIN
                }
                
                if ($hasLayoutContainers) {
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
                } else {
                    // Fallback if layout_containers doesn't exist
                    $sql = "SELECT 
                                id,
                                message_name,
                                message_key,
                                message_type,
                                message_category,
                                container_key,
                                message_text,
                                message_description,
                                supports_html,
                                placeholders,
                                is_active,
                                is_visible,
                                is_deletable,
                                display_duration,
                                NULL as container_name,
                                NULL as container_icon
                            FROM admin_messages
                            WHERE is_active = 1
                            ORDER BY id ASC";
                }
                
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

    // Flush output immediately
    echo json_encode($response);
    // Note: fastcgi_finish_request() removed - was causing partial image loading issues
    // The output buffering cleanup (ob_end_clean) is sufficient for performance

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

