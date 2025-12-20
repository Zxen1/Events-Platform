<?php
declare(strict_types=1);

header('Content-Type: application/json');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'POST') !== 'POST') {
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

    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid request data - not an array',
        ]);
        return;
    }

    // Check if data has any settings (allow empty array if only messages are being sent)
    if (empty($data)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid request data - empty payload',
        ]);
        return;
    }

    // Check if admin_settings table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_settings'");
    if ($stmt->rowCount() === 0) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Admin settings table does not exist. Please run migrations.',
        ]);
        return;
    }

    // Separate messages, fieldset_tooltips, and checkout_options from settings
    $messages = null;
    $fieldsetTooltips = null;
    $checkoutOptions = null;
    $settings = $data;
    if (isset($data['messages']) && is_array($data['messages'])) {
        $messages = $data['messages'];
        unset($settings['messages']);
    }
    if (isset($data['fieldset_tooltips']) && is_array($data['fieldset_tooltips'])) {
        $fieldsetTooltips = $data['fieldset_tooltips'];
        unset($settings['fieldset_tooltips']);
    }
    if (isset($data['checkout_options']) && is_array($data['checkout_options'])) {
        $checkoutOptions = $data['checkout_options'];
        unset($settings['checkout_options']);
    }

    // Save settings
    $settingsSaved = 0;
    // Check if settings array exists and has elements (not just empty check, which fails for 0 values)
    if (is_array($settings) && count($settings) > 0) {
        $stmt = $pdo->prepare('
            INSERT INTO `admin_settings` (`setting_key`, `setting_value`, `setting_type`)
            VALUES (:key, :value, :type)
            ON DUPLICATE KEY UPDATE
                `setting_value` = VALUES(`setting_value`),
                `setting_type` = VALUES(`setting_type`)
        ');

        foreach ($settings as $key => $value) {
            // Determine type - handle null, false, 0, and empty string explicitly
            $type = 'string';
            $stringValue = null;

            // Check for null first
            if ($value === null) {
                $type = 'string';
                $stringValue = '';
            } elseif (is_bool($value)) {
                $type = 'boolean';
                $stringValue = $value ? 'true' : 'false';
            } elseif (is_float($value) || (is_string($value) && is_numeric($value) && strpos($value, '.') !== false)) {
                // Handle float/decimal values, including 0.0
                $type = 'decimal';
                $stringValue = (string)$value;
            } elseif (is_int($value) || (is_string($value) && ctype_digit($value))) {
                $type = 'integer';
                $stringValue = (string)$value;
            } elseif (is_numeric($value)) {
                // Fallback for any numeric value
                $type = 'decimal';
                $stringValue = (string)$value;
            } elseif (is_array($value) || is_object($value)) {
                $type = 'json';
                $stringValue = json_encode($value);
            } else {
                $stringValue = (string)$value;
            }

            try {
                $result = $stmt->execute([
                    ':key' => $key,
                    ':value' => $stringValue,
                    ':type' => $type,
                ]);
                if ($result) {
                    $settingsSaved++;
                }
            } catch (PDOException $e) {
                // Log error for specific setting but continue with others
                error_log("Failed to save setting '{$key}' with value '{$stringValue}' (type: {$type}): " . $e->getMessage());
                // Re-throw to be caught by outer try-catch
                throw $e;
            }
        }
    }

    // Save messages if provided
    $messagesUpdated = 0;
    if ($messages !== null && is_array($messages) && !empty($messages)) {
        // Check if admin_messages table exists
        $stmt = $pdo->query("SHOW TABLES LIKE 'admin_messages'");
        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->prepare('
                UPDATE `admin_messages`
                SET `message_text` = :message_text,
                    `updated_at` = CURRENT_TIMESTAMP
                WHERE `id` = :id
            ');

            foreach ($messages as $message) {
                if (!isset($message['id']) || !isset($message['message_text'])) {
                    continue;
                }
                $stmt->execute([
                    ':id' => (int)$message['id'],
                    ':message_text' => (string)$message['message_text'],
                ]);
                if ($stmt->rowCount() > 0) {
                    $messagesUpdated++;
                }
            }
        }
    }

    // Save fieldset tooltips if provided
    $fieldsetTooltipsUpdated = 0;
    if ($fieldsetTooltips !== null && is_array($fieldsetTooltips) && !empty($fieldsetTooltips)) {
        // Check if fieldsets table exists
        $stmt = $pdo->query("SHOW TABLES LIKE 'fieldsets'");
        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->prepare('
                UPDATE `fieldsets`
                SET `fieldset_tooltip` = :fieldset_tooltip,
                    `updated_at` = CURRENT_TIMESTAMP
                WHERE `id` = :id
            ');

            foreach ($fieldsetTooltips as $tooltip) {
                if (!isset($tooltip['id']) || !isset($tooltip['fieldset_tooltip'])) {
                    continue;
                }
                $stmt->execute([
                    ':id' => (int)$tooltip['id'],
                    ':fieldset_tooltip' => (string)$tooltip['fieldset_tooltip'],
                ]);
                if ($stmt->rowCount() > 0) {
                    $fieldsetTooltipsUpdated++;
                }
            }
        }
    }

    // Save checkout options if provided
    $checkoutUpdated = 0;
    $checkoutInserted = 0;
    $checkoutDeleted = 0;
    if ($checkoutOptions !== null && is_array($checkoutOptions)) {
        // Check if checkout_options table exists
        $stmt = $pdo->query("SHOW TABLES LIKE 'checkout_options'");
        if ($stmt->rowCount() > 0) {
            // Get site currency from admin_settings
            $siteCurrency = 'USD'; // Default
            try {
                $currencyStmt = $pdo->prepare('SELECT `setting_value` FROM `admin_settings` WHERE `setting_key` = ? LIMIT 1');
                $currencyStmt->execute(['site_currency']);
                $currencyRow = $currencyStmt->fetch(PDO::FETCH_ASSOC);
                if ($currencyRow && !empty($currencyRow['setting_value'])) {
                    $siteCurrency = strtoupper(trim($currencyRow['setting_value']));
                }
            } catch (PDOException $e) {
                // Use default if currency lookup fails
            }
            
            // Get existing IDs
            $existingIds = [];
            $stmt = $pdo->query('SELECT id FROM checkout_options');
            while ($row = $stmt->fetch()) {
                $existingIds[] = (int)$row['id'];
            }
            
            // Track IDs from input
            $inputIds = [];
            
            // Prepare statements
            // Check if admin_only column exists
            $hasAdminOnly = false;
            try {
                $colCheck = $pdo->query("SHOW COLUMNS FROM `checkout_options` LIKE 'admin_only'");
                $hasAdminOnly = $colCheck->rowCount() > 0;
            } catch (Exception $e) {
                // Column doesn't exist, continue without it
            }
            
            $adminOnlyUpdate = $hasAdminOnly ? ', `admin_only` = :admin_only' : '';
            $adminOnlyInsert = $hasAdminOnly ? ', `admin_only`' : '';
            $adminOnlyValues = $hasAdminOnly ? ', :admin_only' : '';
            
            $updateStmt = $pdo->prepare('
                UPDATE `checkout_options`
                SET `checkout_key` = :key,
                    `checkout_title` = :title,
                    `checkout_description` = :description,
                    `checkout_flagfall_price` = :flagfall_price,
                    `checkout_basic_day_rate` = :basic_day_rate,
                    `checkout_discount_day_rate` = :discount_day_rate,
                    `checkout_featured` = :featured,
                    `checkout_sidebar_ad` = :sidebar,
                    `hidden` = :hidden' . $adminOnlyUpdate . ',
                    `updated_at` = CURRENT_TIMESTAMP
                WHERE `id` = :id
            ');
            
            $insertStmt = $pdo->prepare('
                INSERT INTO `checkout_options` 
                (`checkout_key`, `checkout_title`, `checkout_description`, `checkout_flagfall_price`, `checkout_basic_day_rate`, `checkout_discount_day_rate`, `checkout_currency`, `checkout_featured`, `checkout_sidebar_ad`, `sort_order`, `hidden`' . $adminOnlyInsert . ')
                VALUES (:key, :title, :description, :flagfall_price, :basic_day_rate, :discount_day_rate, :currency, :featured, :sidebar, :sort_order, :hidden' . $adminOnlyValues . ')
            ');
            
            $sortOrder = 0;
            foreach ($checkoutOptions as $option) {
                $sortOrder++;
                // Handle ID - can be string or number
                $id = $option['id'] ?? null;
                if ($id !== null && $id !== '') {
                    // Convert string numbers to integers
                    if (is_string($id) && is_numeric($id)) {
                        $id = (int)$id;
                    } elseif (!is_numeric($id)) {
                        // For new options with non-numeric IDs (e.g., "new-123"), treat as new
                        $id = null;
                    }
                } else {
                    $id = null;
                }
                
                $title = isset($option['checkout_title']) ? trim((string)$option['checkout_title']) : 'Untitled';
                if (empty($title)) {
                    $title = 'Untitled';
                }
                $description = isset($option['checkout_description']) ? trim((string)$option['checkout_description']) : '';
                // Get checkout_key from input, or generate from title if not provided
                // Generate key: "Free Listing" -> "free-listing" (hyphens, no numbers/timestamps)
                $key = isset($option['checkout_key']) && trim((string)$option['checkout_key']) !== '' 
                    ? trim((string)$option['checkout_key']) 
                    : strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', preg_replace('/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/', '', $title)));
                // Round money values to 2 decimal places
                $flagfallPrice = round((float)($option['checkout_flagfall_price'] ?? 0), 2);
                $basicDayRate = isset($option['checkout_basic_day_rate']) && $option['checkout_basic_day_rate'] !== null && $option['checkout_basic_day_rate'] !== '' ? round((float)$option['checkout_basic_day_rate'], 2) : null;
                $discountDayRate = isset($option['checkout_discount_day_rate']) && $option['checkout_discount_day_rate'] !== null && $option['checkout_discount_day_rate'] !== '' ? round((float)$option['checkout_discount_day_rate'], 2) : null;
                $featured = isset($option['checkout_featured']) ? ((int)$option['checkout_featured'] ? 1 : 0) : 0;
                $sidebar = !empty($option['checkout_sidebar_ad']) ? 1 : 0;
                $hidden = !empty($option['hidden']) ? 1 : 0;
                $adminOnly = !empty($option['admin_only']) ? 1 : 0;
                
                // Check if this is an existing ID or new
                if ($id !== null && is_numeric($id) && in_array((int)$id, $existingIds)) {
                    // Update existing
                    $inputIds[] = (int)$id;
                    $updateParams = [
                        ':id' => (int)$id,
                        ':key' => $key,
                        ':title' => $title,
                        ':description' => $description,
                        ':flagfall_price' => $flagfallPrice,
                        ':basic_day_rate' => $basicDayRate,
                        ':discount_day_rate' => $discountDayRate,
                        ':featured' => $featured,
                        ':sidebar' => $sidebar,
                        ':hidden' => $hidden,
                    ];
                    if ($hasAdminOnly) {
                        $updateParams[':admin_only'] = $adminOnly;
                    }
                    $updateStmt->execute($updateParams);
                    $checkoutUpdated++;
                } else {
                    // Insert new - generate key if not already set above
                    // Generate key: "Free Listing" -> "free-listing" (hyphens, no numbers/timestamps)
                    if (!isset($option['checkout_key']) || trim((string)$option['checkout_key']) === '') {
                        $key = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', preg_replace('/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/', '', $title)));
                    }
                    $insertParams = [
                        ':key' => $key,
                        ':title' => $title,
                        ':description' => $description,
                        ':flagfall_price' => $flagfallPrice,
                        ':basic_day_rate' => $basicDayRate,
                        ':discount_day_rate' => $discountDayRate,
                        ':currency' => $siteCurrency,
                        ':featured' => $featured,
                        ':sidebar' => $sidebar,
                        ':sort_order' => $sortOrder,
                        ':hidden' => $hidden,
                    ];
                    if ($hasAdminOnly) {
                        $insertParams[':admin_only'] = $adminOnly;
                    }
                    $insertStmt->execute($insertParams);
                    $checkoutInserted++;
                }
            }
            
            // Delete removed options
            $idsToDelete = array_diff($existingIds, $inputIds);
            if (!empty($idsToDelete)) {
                $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));
                $deleteStmt = $pdo->prepare("DELETE FROM `checkout_options` WHERE `id` IN ({$placeholders})");
                $deleteStmt->execute(array_values($idsToDelete));
                $checkoutDeleted = count($idsToDelete);
            }
        }
    }

    $response = [
        'success' => true,
        'message' => 'Settings saved successfully',
        'settings_saved' => $settingsSaved,
    ];

    if ($messagesUpdated > 0) {
        $response['messages_updated'] = $messagesUpdated;
    }
    
    if ($fieldsetTooltipsUpdated > 0) {
        $response['fieldset_tooltips_updated'] = $fieldsetTooltipsUpdated;
    }
    if ($checkoutUpdated > 0 || $checkoutInserted > 0 || $checkoutDeleted > 0) {
        $response['checkout_options'] = [
            'updated' => $checkoutUpdated,
            'inserted' => $checkoutInserted,
            'deleted' => $checkoutDeleted,
        ];
    }

    echo json_encode($response);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

