<?php
declare(strict_types=1);

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

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
                'website_currency' => 'USD',
            ],
        ]);
        return;
    }

    // Fetch all settings
    $stmt = $pdo->query('SELECT `setting_key`, `setting_value`, `setting_type` FROM `admin_settings`');
    $rows = $stmt->fetchAll();

    // Sensitive fields that should NEVER be sent to frontend
    $sensitiveKeys = ['storage_api_key'];

    $settings = [];
    foreach ($rows as $row) {
        $key = $row['setting_key'];
        
        // Skip sensitive keys - never expose API keys to frontend
        if (in_array($key, $sensitiveKeys)) {
            continue;
        }
        
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

    // Build system_images from admin_settings (system image keys)
    // System image keys: small_map_card_pill, big_map_card_pill, multi_post_icon, etc.
    $systemImageKeys = [
        'small_map_card_pill', 'big_map_card_pill', 'multi_post_icon', 'hover_map_card_pill',
        'msg_category_user_icon', 'msg_category_member_icon', 'msg_category_admin_icon', 'msg_category_email_icon',
        'marker_cluster_icon', 'msg_category_fieldset-tooltips_icon', 'msg_category_field-tooltips_icon', 'big_logo', 'small_logo',
        'favicon', 'icon_filter', 'icon_recent', 'icon_posts', 'icon_map',
        'icon_member', 'icon_admin', 'icon_fullscreen', 'icon_fullscreen_exit',
        'icon_geolocate', 'icon_compass',
        'icon_lighting_dawn', 'icon_lighting_day', 'icon_lighting_dusk', 'icon_lighting_night',
        'icon_save', 'icon_discard', 'icon_close', 'icon_clear', 'icon_favourites',
        'icon_add_image',
        'icon_ticket',
        'icon_plus', 'icon_minus',
        'icon_checkmark', 'icon_checkbox', 'icon_radio', 'icon_radio_selected',
        'icon_arrow_down', 'icon_edit', 'icon_info', 'icon_share',
        'icon_drag_handle', 'icon_more_dots', 'icon_search', 'icon_reactivate',
        'icon_trash', 'icon_flag', 'icon_tick', 'icon_hide', 'icon_show',
        // Post/Recents panels (empty-state / reminder illustrations)
        'post_panel_empty_image', 'recent_panel_footer_image',
        // Email
        'email_logo'
    ];
    
    $systemImages = [];
    foreach ($systemImageKeys as $key) {
        if (isset($settings[$key])) {
            $systemImages[$key] = $settings[$key];
        }
    }
    $response['system_images'] = $systemImages;

    // Optionally include admin instructions if requested
    $includeInstructions = isset($_GET['include_instructions']) && $_GET['include_instructions'] === 'true';
    if ($includeInstructions) {
        try {
            $stmt = $pdo->query("SHOW TABLES LIKE 'admin_instructions'");
            if ($stmt->rowCount() > 0) {
                $stmt = $pdo->query('SELECT `id`, `chapter`, `title`, `description` FROM `admin_instructions` ORDER BY `id` ASC');
                $rows = $stmt->fetchAll();
                $instructions = [];
                foreach ($rows as $row) {
                    $instructions[] = [
                        'id'          => (int)$row['id'],
                        'chapter'     => $row['chapter'],
                        'title'       => $row['title'],
                        'description' => $row['description'],
                    ];
                }
                $response['instructions'] = $instructions;
            }
        } catch (Throwable $instructionsError) {
            // If instructions fail, don't break the whole response
        }
    }

    // Lite mode: return only settings + system_images (skip baskets + dropdown_options for faster startup)
    $lite = isset($_GET['lite']) && ($_GET['lite'] === '1' || $_GET['lite'] === 'true' || $_GET['lite'] === 'yes');
    if ($lite) {
        echo json_encode($response);
        return;
    }
    
    // Fetch system-images from system_images table (basket of available filenames)
    try {
        $stmt = $pdo->query("SELECT `option_filename` FROM `list_system_images` WHERE `is_active` = 1 AND `option_filename` IS NOT NULL ORDER BY `option_filename` ASC");
        $systemImageRows = $stmt->fetchAll();
        
        $systemImagesBasket = [];
        foreach ($systemImageRows as $row) {
            if (!empty($row['option_filename'])) {
                $systemImagesBasket[] = $row['option_filename'];
            }
        }
        $response['system_images_basket'] = $systemImagesBasket;
    } catch (Throwable $systemImagesError) {
        // If query fails, don't break the whole response
    }
    
    // Fetch category-icons from category_icons table (basket of available filenames)
    try {
        $stmt = $pdo->query("SELECT `option_filename` FROM `list_category_icons` WHERE `is_active` = 1 AND `option_filename` IS NOT NULL ORDER BY `option_filename` ASC");
        $categoryIconRows = $stmt->fetchAll();
        
        $categoryIconsBasket = [];
        foreach ($categoryIconRows as $row) {
            if (!empty($row['option_filename'])) {
                $categoryIconsBasket[] = $row['option_filename'];
            }
        }
        $response['category_icons_basket'] = $categoryIconsBasket;
    } catch (Throwable $categoryIconsError) {
        // If query fails, don't break the whole response
    }

    // Fetch dropdown options data from multiple tables (currencies, phone prefixes, amenities, etc.)
    // Query each separate table and combine into the same response format
    try {
        $dropdownOptions = [];
        
        // Fetch currencies with formatting properties (symbol, position, decimals, etc.)
        try {
            $stmt = $pdo->query('SELECT `option_value`, `option_label`, `option_filename`, `option_symbol`, `option_symbol_position`, `option_decimal_separator`, `option_decimal_places`, `option_thousands_separator`, `sort_order` FROM `list_currencies` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $currencyRows = $stmt->fetchAll();
            $dropdownOptions['currency'] = [];
            foreach ($currencyRows as $row) {
                // Currency needs filename, value, and label (they need flags and proper data)
                if (empty($row['option_filename']) || empty($row['option_value']) || empty($row['option_label'])) {
                    continue;
                }
                $dropdownOptions['currency'][] = [
                    'value' => $row['option_value'],
                    'label' => $row['option_label'],
                    'filename' => $row['option_filename'] ? $row['option_filename'] : null,
                    'symbol' => $row['option_symbol'] ?? '$',
                    'symbolPosition' => $row['option_symbol_position'] ?? 'left',
                    'decimalSeparator' => $row['option_decimal_separator'] ?? '.',
                    'decimalPlaces' => (int)($row['option_decimal_places'] ?? 2),
                    'thousandsSeparator' => $row['option_thousands_separator'] ?? ',',
                ];
            }
        } catch (Throwable $e) {
            // Table might not exist yet, continue
        }
        
        // Fetch phone-prefixes
        try {
            $stmt = $pdo->query('SELECT `option_value`, `option_label`, `option_filename`, `sort_order` FROM `list_phone_prefixes` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $phoneRows = $stmt->fetchAll();
            $dropdownOptions['phone-prefix'] = [];
            foreach ($phoneRows as $row) {
                // Phone-prefix needs filename, value, and label (they need flags and proper data)
                if (empty($row['option_filename']) || empty($row['option_value']) || empty($row['option_label'])) {
                    continue;
                }
                $dropdownOptions['phone-prefix'][] = [
                    'value' => $row['option_value'],
                    'label' => $row['option_label'],
                    'filename' => $row['option_filename'] ? $row['option_filename'] : null,
                ];
            }
        } catch (Throwable $e) {
            // Table might not exist yet, continue
        }

        // Fetch countries (country code dropdown)
        try {
            $stmt = $pdo->query('SELECT `option_value`, `option_label`, `option_filename`, `sort_order` FROM `list_countries` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $countryRows = $stmt->fetchAll();
            $dropdownOptions['country'] = [];
            foreach ($countryRows as $row) {
                // Country needs filename, value (2-letter code), and label (country name)
                if (empty($row['option_filename']) || empty($row['option_value']) || empty($row['option_label'])) {
                    continue;
                }
                $dropdownOptions['country'][] = [
                    'value' => strtolower((string)$row['option_value']),
                    'label' => $row['option_label'],
                    'filename' => $row['option_filename'] ? $row['option_filename'] : null,
                ];
            }
        } catch (Throwable $e) {
            // Table might not exist yet, continue
        }
        
        // Fetch amenities
        try {
            $stmt = $pdo->query('SELECT `option_value`, `option_label`, `option_filename`, `sort_order` FROM `list_amenities` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $amenityRows = $stmt->fetchAll();
            $dropdownOptions['amenity'] = [];
            foreach ($amenityRows as $row) {
                // Amenities need value and label (filename is optional)
                if (empty($row['option_value']) || empty($row['option_label'])) {
                    continue;
                }
                $dropdownOptions['amenity'][] = [
                    'value' => $row['option_value'],
                    'label' => $row['option_label'],
                    'filename' => $row['option_filename'] ? $row['option_filename'] : null,
                ];
            }
        } catch (Throwable $e) {
            // Table might not exist yet, continue
        }
        
        // Fetch age ratings
        try {
            $stmt = $pdo->query('SELECT `option_value`, `option_label`, `option_filename`, `sort_order` FROM `list_age_ratings` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $ageRatingRows = $stmt->fetchAll();
            $dropdownOptions['age-rating'] = [];
            foreach ($ageRatingRows as $row) {
                if (empty($row['option_value']) || empty($row['option_label'])) {
                    continue;
                }
                $dropdownOptions['age-rating'][] = [
                    'value' => $row['option_value'],
                    'label' => $row['option_label'],
                    'filename' => $row['option_filename'] ? $row['option_filename'] : null,
                ];
            }
        } catch (Throwable $e) {
            // Table might not exist yet, continue
        }

        // Fetch links (for Links fieldset / link logos)
        try {
            $stmt = $pdo->query('SELECT `option_value`, `option_label`, `option_filename`, `sort_order` FROM `list_links` WHERE `is_active` = 1 ORDER BY `sort_order` ASC');
            $linkRows = $stmt->fetchAll();
            $dropdownOptions['link'] = [];
            foreach ($linkRows as $row) {
                if (empty($row['option_value']) || empty($row['option_label'])) {
                    continue;
                }
                $dropdownOptions['link'][] = [
                    'value' => $row['option_value'],
                    'label' => $row['option_label'],
                    'filename' => $row['option_filename'] ? $row['option_filename'] : null,
                ];
            }
        } catch (Throwable $e) {
            // Table might not exist yet, continue
        }
        
        if (!empty($dropdownOptions)) {
            $response['dropdown_options'] = $dropdownOptions;
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
            $stmt = $pdo->query('SELECT `id`, `checkout_key`, `checkout_title`, `checkout_description`, `checkout_flagfall_price`, `checkout_basic_day_rate`, `checkout_discount_day_rate`, `checkout_currency`, `checkout_featured`, `checkout_sidebar_ad`, `sort_order`, `hidden`' . $adminOnlySelect . ' FROM `checkout_options` ORDER BY `sort_order` ASC, `id` ASC');
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
                    'hidden' => (bool)$row['hidden'],
                    'admin_only' => isset($row['admin_only']) ? (bool)$row['admin_only'] : false,
                ];
            }
            $response['checkout_options'] = $checkoutOptions;
        }
    } catch (Throwable $checkoutError) {
        // If checkout options fail, don't break the whole response
    }

    // Fetch checkout_coupons
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'checkout_coupons'");
        if ($stmt->rowCount() > 0) {
            $pdo->exec("UPDATE `checkout_coupons` SET `status` = 'expired' WHERE `status` = 'active' AND `valid_until` IS NOT NULL AND `valid_until` < CURDATE()");
            $stmt = $pdo->query('SELECT `id`, `code`, `description`, `discount_type`, `discount_value`, `valid_from`, `valid_until`, `usage_limit`, `one_per_member`, `usage_count`, `status`, `created_at` FROM `checkout_coupons` ORDER BY `created_at` DESC');
            $couponRows = $stmt->fetchAll();
            $coupons = [];
            foreach ($couponRows as $row) {
                $coupons[] = [
                    'id'             => (int)$row['id'],
                    'code'           => $row['code'],
                    'description'    => $row['description'],
                    'discount_type'  => $row['discount_type'],
                    'discount_value' => (int)$row['discount_value'],
                    'valid_from'     => $row['valid_from'],
                    'valid_until'    => $row['valid_until'],
                    'usage_limit'    => (int)$row['usage_limit'],
                    'one_per_member' => (bool)$row['one_per_member'],
                    'usage_count'    => (int)$row['usage_count'],
                    'status'         => $row['status'],
                    'created_at'     => $row['created_at'],
                ];
            }
            $response['checkout_coupons'] = $coupons;
        }
    } catch (Throwable $couponError) {
        // If coupons fail, don't break the whole response
    }

    // Fetch fieldset icons basket (list of available filenames from list_fieldset_icons)
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'list_fieldset_icons'");
        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->query('SELECT `option_filename` FROM `list_fieldset_icons` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `option_filename` ASC');
            $fieldsetIconRows = $stmt->fetchAll();
            $fieldsetIconsBasket = [];
            foreach ($fieldsetIconRows as $row) {
                if (!empty($row['option_filename'])) {
                    $fieldsetIconsBasket[] = $row['option_filename'];
                }
            }
            $response['fieldset_icons_basket'] = $fieldsetIconsBasket;
        }
    } catch (Throwable $e) {
        // If query fails, don't break the whole response
    }

    // Fetch fieldsets for Site Customisation admin UI
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'fieldsets'");
        if ($stmt->rowCount() > 0) {
            $colCheck = $pdo->query("SHOW COLUMNS FROM `fieldsets` LIKE 'fieldset_icon'");
            $hasFieldsetIcon = $colCheck->rowCount() > 0;
            $iconSelect = $hasFieldsetIcon ? ', `fieldset_icon`' : '';
            $stmt = $pdo->query('SELECT `id`, `fieldset_name`, `fieldset_key`, `fieldset_type`' . $iconSelect . ' FROM `fieldsets` ORDER BY (`sort_order` IS NULL) ASC, `sort_order` ASC, `fieldset_name` ASC');
            $fieldsetRows = $stmt->fetchAll();
            $fieldsets = [];
            foreach ($fieldsetRows as $row) {
                $fieldsets[] = [
                    'id'             => (int)$row['id'],
                    'fieldset_name'  => $row['fieldset_name'],
                    'fieldset_key'   => $row['fieldset_key'],
                    'fieldset_type'  => $row['fieldset_type'],
                    'fieldset_icon'  => $hasFieldsetIcon ? ($row['fieldset_icon'] ?? null) : null,
                ];
            }
            $response['fieldsets'] = $fieldsets;
        }
    } catch (Throwable $e) {
        // If fieldsets fail, don't break the whole response
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

