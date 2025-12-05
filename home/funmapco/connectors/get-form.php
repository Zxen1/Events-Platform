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

    $categoryColumns = fetchTableColumns($pdo, 'categories');
    $subcategoryColumns = fetchTableColumns($pdo, 'subcategories');

    if (!$categoryColumns || !$subcategoryColumns) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Categories or subcategories table not available.',
        ]);
        return;
    }

    $categories = fetchCategories($pdo, $categoryColumns);
    $subcategories = fetchSubcategories($pdo, $subcategoryColumns, $categories);

    // Try fieldsets table first, fallback to field_types for backward compatibility
    $fieldsetTableName = 'fieldsets';
    $fieldsetColumns = fetchTableColumns($pdo, 'fieldsets');
    if (!$fieldsetColumns) {
        $fieldsetTableName = 'field_types';
        $fieldsetColumns = fetchTableColumns($pdo, 'field_types');
    }
    $fieldsets = [];
    if ($fieldsetColumns) {
        $fieldsets = fetchFieldsets($pdo, $fieldsetColumns, $fieldsetTableName);
    }

    // Fetch all fields from database
    $allFields = [];
    $currencyOptions = [];
    
    try {
        $fieldColumns = fetchTableColumns($pdo, 'fields');
        if ($fieldColumns) {
            $allFields = fetchAllFields($pdo, $fieldColumns);
            
            // Get currency options from currency field
            $currencyField = array_filter($allFields, function($f) {
                return isset($f['field_key']) && $f['field_key'] === 'currency' && (int)$f['id'] === 13;
            });
            if (!empty($currencyField)) {
                $currencyField = reset($currencyField);
                if (isset($currencyField['options']) && is_string($currencyField['options']) && $currencyField['options'] !== '') {
                    $currencyOptions = array_map('trim', explode(',', $currencyField['options']));
                    $currencyOptions = array_filter($currencyOptions, function($code) {
                        return $code !== '';
                    });
                    $currencyOptions = array_map('strtoupper', $currencyOptions);
                    $currencyOptions = array_values(array_unique($currencyOptions));
                }
            }
        }
    } catch (PDOException $e) {
        // Continue without fields
    }

    // Fetch checkout options from database
    $checkoutOptions = [];
    try {
        $checkoutColumns = fetchTableColumns($pdo, 'checkout_options');
        if ($checkoutColumns) {
            $checkoutOptions = fetchCheckoutOptions($pdo);
        }
    } catch (PDOException $e) {
        // Continue without checkout options
    }

    // Load icon_folder from admin_settings
    $iconFolder = 'assets/icons-30'; // Default fallback
    try {
        $settingStmt = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'icon_folder' LIMIT 1");
        if ($settingRow = $settingStmt->fetch(PDO::FETCH_ASSOC)) {
            if (isset($settingRow['setting_value']) && is_string($settingRow['setting_value']) && trim($settingRow['setting_value']) !== '') {
                $iconFolder = trim($settingRow['setting_value']);
            }
        }
    } catch (PDOException $e) {
        // Use default if query fails
    }

    $snapshot = buildSnapshot($pdo, $categories, $subcategories, $currencyOptions, $allFields, $fieldsets, $iconFolder);
    $snapshot['fieldTypes'] = $fieldsets;
    $snapshot['field_types'] = $fieldsets;
    $snapshot['checkout_options'] = $checkoutOptions;

    // Flush output immediately
    echo json_encode([
        'success' => true,
        'snapshot' => $snapshot,
    ]);
    // Note: fastcgi_finish_request() removed - was causing partial image loading issues
    // The output buffering cleanup (ob_end_clean) is sufficient for performance
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

function fetchTableColumns(PDO $pdo, string $table): array
{
    try {
        $stmt = $pdo->query('DESCRIBE `' . str_replace('`', '``', $table) . '`');
        $columns = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (isset($row['Field'])) {
                $columns[] = $row['Field'];
            }
        }
        return $columns;
    } catch (PDOException $e) {
        return [];
    }
}

function fetchCategories(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    $orderBy = '';

    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasIconPath = in_array('icon_path', $columns, true);
    $hasFieldsetIds = in_array('fieldset_ids', $columns, true) || in_array('field_type_id', $columns, true);
    $hasFieldsetName = in_array('fieldset_name', $columns, true) || in_array('field_type_name', $columns, true);

    if (in_array('id', $columns, true)) {
        $selectColumns[] = '`id`';
    }
    if (in_array('category_name', $columns, true)) {
        $selectColumns[] = '`category_name` AS `name`';
    }
    if ($hasSortOrder) {
        $selectColumns[] = '`sort_order`';
        $orderBy = ' ORDER BY `sort_order` ASC';
    }
    if ($hasIconPath) {
        $selectColumns[] = '`icon_path`';
    }
    if ($hasFieldsetIds) {
        if (in_array('fieldset_ids', $columns, true)) {
            $selectColumns[] = '`fieldset_ids`';
        } elseif (in_array('field_type_id', $columns, true)) {
            $selectColumns[] = '`field_type_id`';
        }
    }
    if ($hasFieldsetName) {
        if (in_array('fieldset_name', $columns, true)) {
            $selectColumns[] = '`fieldset_name`';
        } elseif (in_array('field_type_name', $columns, true)) {
            $selectColumns[] = '`field_type_name`';
        }
    }
    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM categories' . $orderBy;
    $stmt = $pdo->query($sql);

    $categories = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['name'])) {
            continue;
        }

        $fieldsetIds = [];
        if ($hasFieldsetIds && isset($row['fieldset_ids']) && is_string($row['fieldset_ids'])) {
            $fieldsetIds = parseFieldsetIdsCsv($row['fieldset_ids']);
        } elseif ($hasFieldsetIds && isset($row['field_type_id']) && is_string($row['field_type_id'])) {
            $fieldsetIds = parseFieldsetIdsCsv($row['field_type_id']);
        }

        $fieldsetNames = [];
        if ($hasFieldsetName && isset($row['fieldset_name']) && is_string($row['fieldset_name'])) {
            $fieldsetNames = parseFieldsetNameCsv($row['fieldset_name']);
        } elseif ($hasFieldsetName && isset($row['field_type_name']) && is_string($row['field_type_name'])) {
            $fieldsetNames = parseFieldsetNameCsv($row['field_type_name']);
        }

        $categories[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'subs' => [],
            'icon_path' => $hasIconPath && isset($row['icon_path']) && is_string($row['icon_path'])
                ? trim($row['icon_path'])
                : null,
            'fieldset_ids' => $fieldsetIds,
            'fieldset_names' => $fieldsetNames,
        ];
    }

    if (!$categories) {
        return $categories;
    }

    if (!$orderBy) {
        usort($categories, static function (array $a, array $b): int {
            return strcasecmp($a['name'], $b['name']);
        });
    }

    return $categories;
}

function fetchSubcategories(PDO $pdo, array $columns, array $categories): array
{
    $select = ['s.`id`'];

    $nameColumn = null;
    if (in_array('subcategory_name', $columns, true)) {
        $select[] = 's.`subcategory_name` AS `name`';
        $nameColumn = 's.`subcategory_name`';
    } else {
        http_response_code(500);
        throw new RuntimeException('Subcategories table must include `subcategory_name`.');
    }

    $hasCategoryName = in_array('category_name', $columns, true);
    $hasCategoryId = in_array('category_id', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasIconPath = in_array('icon_path', $columns, true);
    $hasSubcategoryKey = in_array('subcategory_key', $columns, true);
    $hasRequired = in_array('required', $columns, true);

    $hasFieldsetIds = in_array('fieldset_ids', $columns, true) || in_array('field_type_id', $columns, true);
    $hasFieldsetName = in_array('fieldset_name', $columns, true) || in_array('field_type_name', $columns, true);

    if ($hasCategoryName) {
        $select[] = 's.`category_name`';
    }
    if ($hasCategoryId) {
        $select[] = 's.`category_id`';
    }
    if ($hasSortOrder) {
        $select[] = 's.`sort_order`';
    }
    if ($hasIconPath) {
        $select[] = 's.`icon_path`';
    }
    if ($hasSubcategoryKey) {
        $select[] = 's.`subcategory_key`';
    }
    if ($hasRequired) {
        $select[] = 's.`required`';
    }

    if ($hasFieldsetIds) {
        if (in_array('fieldset_ids', $columns, true)) {
            $select[] = 's.`fieldset_ids`';
        } elseif (in_array('field_type_id', $columns, true)) {
            $select[] = 's.`field_type_id`';
        }
    }
    if ($hasFieldsetName) {
        if (in_array('fieldset_name', $columns, true)) {
            $select[] = 's.`fieldset_name`';
        } elseif (in_array('field_type_name', $columns, true)) {
            $select[] = 's.`field_type_name`';
        }
    }
    
    $hasEditableFieldsets = in_array('editable_fieldsets', $columns, true) || in_array('editable_field_types', $columns, true);
    if ($hasEditableFieldsets) {
        if (in_array('editable_fieldsets', $columns, true)) {
            $select[] = 's.`editable_fieldsets`';
        } elseif (in_array('editable_field_types', $columns, true)) {
            $select[] = 's.`editable_field_types`';
        }
    }
    
    $hasCheckoutOptionsId = in_array('checkout_options_id', $columns, true);
    if ($hasCheckoutOptionsId) {
        $select[] = 's.`checkout_options_id`';
    }
    
    // Add checkout_surcharge column
    if (in_array('checkout_surcharge', $columns, true)) {
        $select[] = 's.`checkout_surcharge`';
    }
    if (in_array('subcategory_type', $columns, true)) {
        $select[] = 's.`subcategory_type`';
    }

    $order = [];
    if ($hasCategoryId) {
        $order[] = 's.`category_id` ASC';
    }
    if ($hasCategoryName) {
        $order[] = 's.`category_name` ASC';
    }
    if ($hasSortOrder) {
        $order[] = 's.`sort_order` ASC';
    }
    if ($nameColumn !== null) {
        $order[] = $nameColumn . ' ASC';
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM subcategories s';
    if ($order) {
        $sql .= ' ORDER BY ' . implode(', ', $order);
    }

    $stmt = $pdo->query($sql);

    $categoryById = [];
    foreach ($categories as $category) {
        if ($category['id'] !== null) {
            $categoryById[$category['id']] = $category['name'];
        }
    }

    $results = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $categoryName = null;
        if (isset($row['category_name'])) {
            $categoryName = (string) $row['category_name'];
        } elseif ($hasCategoryId && isset($row['category_id'])) {
            $id = (int) $row['category_id'];
            $categoryName = $categoryById[$id] ?? null;
        }
        if (!$categoryName || !isset($row['name'])) {
            continue;
        }
        $fieldsetIds = [];
        if ($hasFieldsetIds && isset($row['fieldset_ids']) && is_string($row['fieldset_ids'])) {
            $fieldsetIds = parseFieldsetIdsCsv($row['fieldset_ids']);
        }

        $fieldsetNames = [];
        if ($hasFieldsetName && isset($row['fieldset_name']) && is_string($row['fieldset_name'])) {
            $fieldsetNames = parseFieldsetNameCsv($row['fieldset_name']);
        }

        $subcategoryKey = '';
        if ($hasSubcategoryKey && isset($row['subcategory_key']) && is_string($row['subcategory_key'])) {
            $subcategoryKey = trim($row['subcategory_key']);
        }

        $required = null;
        if ($hasRequired && isset($row['required']) && is_string($row['required']) && $row['required'] !== '') {
            $required = trim($row['required']);
        }

        $result = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'category' => $categoryName,
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'icon_path' => $hasIconPath && isset($row['icon_path']) && is_string($row['icon_path'])
                ? trim($row['icon_path'])
                : null,
            'subcategory_key' => $subcategoryKey,
            'required' => $required,
            'fieldset_ids' => $fieldsetIds,
            'fieldset_names' => $fieldsetNames,
        ];
        
        // Add checkout_surcharge if it exists in the row
        if (isset($row['checkout_surcharge'])) {
            $result['checkout_surcharge'] = $row['checkout_surcharge'] !== null ? round((float)$row['checkout_surcharge'], 2) : null;
        }
        if (isset($row['subcategory_type'])) {
            $result['subcategory_type'] = $row['subcategory_type'];
        }
        if ($hasEditableFieldsets && isset($row['editable_fieldsets'])) {
            $editsJson = $row['editable_fieldsets'];
            if (is_string($editsJson) && $editsJson !== '') {
                $decoded = json_decode($editsJson, true);
                if (is_array($decoded)) {
                    $result['editable_fieldsets'] = $decoded;
                }
            }
        } elseif ($hasEditableFieldsets && isset($row['editable_field_types'])) {
            $editsJson = $row['editable_field_types'];
            if (is_string($editsJson) && $editsJson !== '') {
                $decoded = json_decode($editsJson, true);
                if (is_array($decoded)) {
                    $result['editable_fieldsets'] = $decoded;
                    $result['editable_field_types'] = $decoded; // Keep for backward compatibility
                }
            }
        }
        if ($hasCheckoutOptionsId && isset($row['checkout_options_id'])) {
            $checkoutIdsCsv = $row['checkout_options_id'];
            if (is_string($checkoutIdsCsv) && $checkoutIdsCsv !== '') {
                $ids = array_filter(array_map('trim', explode(',', $checkoutIdsCsv)), function($id) {
                    return $id !== '' && is_numeric($id);
                });
                $result['checkout_options_id'] = array_values(array_map('intval', $ids));
            }
        }
        
        $results[] = $result;
    }

    return $results;
}

function fetchFieldsets(PDO $pdo, array $columns, string $tableName = 'fieldsets'): array
{
    $selectColumns = [];
    $orderBy = '';

    $hasId = in_array('id', $columns, true);
    $hasKey = in_array('fieldset_key', $columns, true) || in_array('field_type_key', $columns, true);
    $hasName = in_array('fieldset_name', $columns, true) || in_array('field_type_name', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasPlaceholder = in_array('placeholder', $columns, true);
    $hasFormbuilderEditable = in_array('formbuilder_editable', $columns, true);
    $hasFieldsetFields = in_array('fieldset_fields', $columns, true) || in_array('field_type_fields', $columns, true);

    if ($hasId) {
        $selectColumns[] = '`id`';
    }
    if ($hasKey) {
        if (in_array('fieldset_key', $columns, true)) {
            $selectColumns[] = '`fieldset_key`';
        } elseif (in_array('field_type_key', $columns, true)) {
            $selectColumns[] = '`field_type_key`';
        }
    }
    if ($hasName) {
        if (in_array('fieldset_name', $columns, true)) {
            $selectColumns[] = '`fieldset_name`';
        } elseif (in_array('field_type_name', $columns, true)) {
            $selectColumns[] = '`field_type_name`';
        }
    }
    if ($hasPlaceholder) {
        $selectColumns[] = '`placeholder`';
    }
    if ($hasFormbuilderEditable) {
        $selectColumns[] = '`formbuilder_editable`';
    }
    if ($hasFieldsetFields) {
        if (in_array('fieldset_fields', $columns, true)) {
            $selectColumns[] = '`fieldset_fields`';
        } elseif (in_array('field_type_fields', $columns, true)) {
            $selectColumns[] = '`field_type_fields`';
        }
    }
    if ($hasSortOrder) {
        $selectColumns[] = '`sort_order`';
        $orderBy = ' ORDER BY `sort_order` ASC';
    } elseif ($hasName) {
        if (in_array('fieldset_name', $columns, true)) {
            $orderBy = ' ORDER BY `fieldset_name` ASC';
        } elseif (in_array('field_type_name', $columns, true)) {
            $orderBy = ' ORDER BY `field_type_name` ASC';
        }
    } elseif ($hasId) {
        $orderBy = ' ORDER BY `id` ASC';
    }

    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    // Use the table name passed as parameter (fieldsets or field_types)
    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM ' . $tableName . $orderBy;

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return [];
    }

    $fieldsets = [];
    $seen = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!is_array($row)) {
            continue;
        }

        $rawKey = '';
        if ($hasKey && isset($row['fieldset_key'])) {
            $rawKey = trim((string) $row['fieldset_key']);
        } elseif ($hasKey && isset($row['field_type_key'])) {
            $rawKey = trim((string) $row['field_type_key']);
        } elseif (isset($row['fieldset_name'])) {
            $rawKey = slugify_key((string) $row['fieldset_name']);
        } elseif (isset($row['field_type_name'])) {
            $rawKey = slugify_key((string) $row['field_type_name']);
        } elseif ($hasId && isset($row['id'])) {
            $rawKey = (string) $row['id'];
        }

        $rawKey = trim($rawKey);
        if ($rawKey === '') {
            continue;
        }

        $dedupeKey = strtolower($rawKey);
        if (isset($seen[$dedupeKey])) {
            continue;
        }

        $rawName = '';
        if ($hasName && isset($row['fieldset_name'])) {
            $rawName = trim((string) $row['fieldset_name']);
        } elseif ($hasName && isset($row['field_type_name'])) {
            $rawName = trim((string) $row['field_type_name']);
        } elseif ($hasKey && isset($row['fieldset_key'])) {
            $rawName = trim((string) $row['fieldset_key']);
        } elseif ($hasKey && isset($row['field_type_key'])) {
            $rawName = trim((string) $row['field_type_key']);
        } elseif ($hasId && isset($row['id'])) {
            $rawName = (string) $row['id'];
        }

        $rawName = trim($rawName);
        if ($rawName === '') {
            $rawName = $rawKey;
        }

        $entry = [
            'value' => $rawKey,
            'label' => $rawName,
        ];

        if ($hasId && isset($row['id'])) {
            $entry['id'] = (int) $row['id'];
        }
        if ($hasKey && isset($row['fieldset_key'])) {
            $entry['fieldset_key'] = (string) $row['fieldset_key'];
            $entry['key'] = (string) $row['fieldset_key'];
        } elseif ($hasKey && isset($row['field_type_key'])) {
            $entry['fieldset_key'] = (string) $row['field_type_key'];
            $entry['key'] = (string) $row['field_type_key'];
        } else {
            $entry['key'] = $rawKey;
        }
        if ($hasName && isset($row['fieldset_name'])) {
            $entry['fieldset_name'] = (string) $row['fieldset_name'];
            $entry['name'] = (string) $row['fieldset_name'];
        } elseif ($hasName && isset($row['field_type_name'])) {
            $entry['fieldset_name'] = (string) $row['field_type_name'];
            $entry['name'] = (string) $row['field_type_name'];
        } else {
            $entry['name'] = $rawName;
        }
        if ($hasPlaceholder && isset($row['placeholder']) && is_string($row['placeholder'])) {
            $entry['placeholder'] = trim($row['placeholder']);
        }
        if ($hasFormbuilderEditable && isset($row['formbuilder_editable'])) {
            $entry['formbuilder_editable'] = (bool) $row['formbuilder_editable'];
        }
        if ($hasSortOrder && isset($row['sort_order'])) {
            $entry['sort_order'] = is_numeric($row['sort_order'])
                ? (int) $row['sort_order']
                : $row['sort_order'];
        }
        
        // Include fieldset_fields JSON array (fallback to field_type_fields for backward compatibility)
        if ($hasFieldsetFields) {
            $fieldsetFieldsJson = null;
            if (array_key_exists('fieldset_fields', $row)) {
                $fieldsetFieldsJson = $row['fieldset_fields'];
            } elseif (array_key_exists('field_type_fields', $row)) {
                $fieldsetFieldsJson = $row['field_type_fields'];
            } else {
                throw new RuntimeException("fieldset_fields column missing for fieldset id: " . ($entry['id'] ?? 'unknown'));
            }
            if ($fieldsetFieldsJson === null) {
                throw new RuntimeException("fieldset_fields is NULL for fieldset id: " . ($entry['id'] ?? 'unknown') . " - must be a JSON array (use [] for empty)");
            }
            if (is_string($fieldsetFieldsJson)) {
                if ($fieldsetFieldsJson === '') {
                    throw new RuntimeException("fieldset_fields is empty string for fieldset id: " . ($entry['id'] ?? 'unknown') . " - must be a JSON array (use [] for empty)");
                }
                $decoded = json_decode($fieldsetFieldsJson, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new RuntimeException("Invalid JSON in fieldset_fields for fieldset id: " . ($entry['id'] ?? 'unknown') . " - " . json_last_error_msg());
                }
                if (!is_array($decoded)) {
                    throw new RuntimeException("fieldset_fields must be a JSON array for fieldset id: " . ($entry['id'] ?? 'unknown') . " - got: " . gettype($decoded));
                }
                $entry['fieldset_fields'] = $decoded;
            } elseif (is_array($fieldsetFieldsJson)) {
                $entry['fieldset_fields'] = $fieldsetFieldsJson;
            } else {
                throw new RuntimeException("fieldset_fields must be a JSON array or string for fieldset id: " . ($entry['id'] ?? 'unknown') . " - got: " . gettype($fieldsetFieldsJson));
            }
        }

        $fieldsets[] = $entry;
        $seen[$dedupeKey] = true;
    }

    return $fieldsets;
}

function fetchAllFields(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    foreach (['id', 'field_key', 'input_type', 'options'] as $col) {
        if (in_array($col, $columns, true)) {
            $selectColumns[] = "`$col`";
        }
    }
    
    if (empty($selectColumns)) {
        $selectColumns[] = '*';
    }
    
    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM `fields` ORDER BY `id` ASC';
    $stmt = $pdo->query($sql);
    
    $fields = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'])) continue;
        
        $field = [
            'id' => (int) $row['id'],
            'field_key' => isset($row['field_key']) ? trim((string) $row['field_key']) : '',
            'input_type' => isset($row['input_type']) ? trim((string) $row['input_type']) : 'text',
            'options' => isset($row['options']) && is_string($row['options']) ? trim($row['options']) : null,
        ];
        
        $fields[] = $field;
    }
    
    return $fields;
}


function fetchCheckoutOptions(PDO $pdo): array
{
    $checkoutOptions = [];
    
    try {
        $stmt = $pdo->query("SELECT * FROM checkout_options WHERE is_active = 1 ORDER BY sort_order ASC, id ASC");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $option = [
                'id' => isset($row['id']) ? (int)$row['id'] : null,
                'checkout_key' => isset($row['checkout_key']) ? (string)$row['checkout_key'] : '',
                'checkout_title' => isset($row['checkout_title']) ? (string)$row['checkout_title'] : '',
                'checkout_description' => isset($row['checkout_description']) ? (string)$row['checkout_description'] : '',
                'checkout_flagfall_price' => isset($row['checkout_flagfall_price']) ? round((float)$row['checkout_flagfall_price'], 2) : 0,
                'checkout_basic_day_rate' => isset($row['checkout_basic_day_rate']) && $row['checkout_basic_day_rate'] !== null ? round((float)$row['checkout_basic_day_rate'], 2) : null,
                'checkout_discount_day_rate' => isset($row['checkout_discount_day_rate']) && $row['checkout_discount_day_rate'] !== null ? round((float)$row['checkout_discount_day_rate'], 2) : null,
                'checkout_currency' => isset($row['checkout_currency']) ? (string)$row['checkout_currency'] : 'USD',
                'checkout_featured' => isset($row['checkout_featured']) ? (int)$row['checkout_featured'] : 0,
                'checkout_sidebar_ad' => isset($row['checkout_sidebar_ad']) ? (bool)$row['checkout_sidebar_ad'] : false,
                'sort_order' => isset($row['sort_order']) ? (int)$row['sort_order'] : 0,
            ];
            $checkoutOptions[] = $option;
        }
    } catch (PDOException $e) {
        // Return empty array on error
    }
    
    return $checkoutOptions;
}

function buildSnapshot(PDO $pdo, array $categories, array $subcategories, array $currencyOptions = [], array $allFields = [], array $fieldsets = [], string $iconFolder = 'assets/icons-30'): array
{
    // Index fields by ID and by key for quick lookup
    $fieldsById = [];
    $fieldsByKey = [];
    foreach ($allFields as $field) {
        if (isset($field['id'])) {
            $fieldsById[$field['id']] = $field;
        }
        if (isset($field['field_key']) && is_string($field['field_key']) && $field['field_key'] !== '') {
            $fieldsByKey[$field['field_key']] = $field;
        }
    }
    
    $categoriesMap = [];
    $categoryIcons = [];
    $categoryIconPaths = [];
    $categoryMarkers = [];
    $subcategoryIconPaths = [];
    foreach ($categories as $category) {
        $categoryName = $category['name'];
        $categoriesMap[$categoryName] = [
            'id' => $category['id'] ?? null,
            'name' => $categoryName,
            'subs' => [],
            'subFields' => [],
            'subFieldsets' => [],
            'sort_order' => $category['sort_order'] ?? null,
            'subIds' => [],
            'subFees' => [],
        ];

        $iconHtml = '';
        $iconPath = '';
        if (isset($category['icon_path']) && is_string($category['icon_path'])) {
            $iconPath = trim($category['icon_path']);
            if ($iconPath !== '') {
                $safeIconPath = htmlspecialchars($iconPath, ENT_QUOTES, 'UTF-8');
                $iconHtml = sprintf('<img src="%s" width="20" height="20" alt="">', $safeIconPath);
            }
        }
        if ($iconHtml !== '') {
            $categoryIcons[$categoryName] = $iconHtml;
        }
        if ($iconPath !== '') {
            $categoryIconPaths[$categoryName] = $iconPath;
        }

        $markerPath = '';
        if (isset($category['icon_path']) && is_string($category['icon_path'])) {
            $candidate = trim($category['icon_path']);
            if ($candidate !== '') {
                $markerPath = $candidate;
            }
        }
        if ($markerPath !== '') {
            $categoryMarkers[$categoryName] = $markerPath;
        }
    }

    $subcategoryIcons = [];
    $subcategoryMarkers = [];
    $subcategoryMarkerIds = [];
    $subcategoryFieldsetIds = [];
    $subcategoryFieldsetNames = [];

    foreach ($subcategories as $sub) {
        $categoryName = $sub['category'];
        if (!isset($categoriesMap[$categoryName])) {
            $categoriesMap[$categoryName] = [
                'id' => null,
                'name' => $categoryName,
                'subs' => [],
                'subFields' => [],
                'subFieldsets' => [],
                'sort_order' => null,
                'subIds' => [],
                'subFees' => [],
            ];
        }

        $categoriesMap[$categoryName]['subs'][] = [
            'name' => $sub['name'],
            'sort_order' => $sub['sort_order'],
        ];
        $categoriesMap[$categoryName]['subIds'][$sub['name']] = $sub['id'] ?? null;
        
        // Add fee and type information
        if (!isset($categoriesMap[$categoryName]['subFees'])) {
            $categoriesMap[$categoryName]['subFees'] = [];
        }
        
        $categoriesMap[$categoryName]['subFees'][$sub['name']] = [
            'checkout_surcharge' => isset($sub['checkout_surcharge']) ? (float)$sub['checkout_surcharge'] : null,
            'subcategory_type' => $sub['subcategory_type'] ?? 'Standard',
        ];

        // Get fieldset_ids and required flags from CSV columns
        $fieldsetIds = [];
        if (isset($sub['fieldset_ids']) && is_array($sub['fieldset_ids'])) {
            foreach ($sub['fieldset_ids'] as $value) {
                if (is_int($value)) {
                    $fieldsetIds[] = $value;
                } elseif (is_string($value) && preg_match('/^\d+$/', $value)) {
                    $fieldsetIds[] = (int) $value;
                }
            }
        }
        $fieldsetIds = array_values(array_unique($fieldsetIds));
        
        // Parse required CSV (format: "1,0,1,0,0" aligned with fieldset_ids positions)
        $requiredFlags = [];
        if (isset($sub['required']) && is_string($sub['required']) && $sub['required'] !== '') {
            $requiredParts = preg_split('/\s*,\s*/', trim($sub['required']));
            foreach ($requiredParts as $part) {
                $requiredFlags[] = (trim($part) === '1' || strtolower(trim($part)) === 'true');
            }
        }

        $fieldsetNames = [];
        if (isset($sub['fieldset_names']) && is_array($sub['fieldset_names'])) {
            foreach ($sub['fieldset_names'] as $value) {
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed !== '') {
                        $fieldsetNames[] = $trimmed;
                    }
                }
            }
        }
        $fieldsetNames = array_values(array_unique($fieldsetNames));

        // Load editable_fieldsets JSON if available
        $editableFieldsets = [];
        if (isset($sub['editable_fieldsets']) && is_array($sub['editable_fieldsets'])) {
            $editableFieldsets = $sub['editable_fieldsets'];
        }
        
        // Load checkout_options_id if available (array of checkout option IDs)
        $checkoutOptionsIds = [];
        if (isset($sub['checkout_options_id']) && is_array($sub['checkout_options_id'])) {
            $checkoutOptionsIds = $sub['checkout_options_id'];
        }
        
        // Build field objects by looking up fieldsets and extracting field IDs from ENUMs
        $builtFields = [];
        foreach ($fieldsetIds as $index => $fieldsetId) {
            // Get required flag for this field (default to false if not set)
            $requiredValue = isset($requiredFlags[$index]) ? $requiredFlags[$index] : false;
            
            // Get customizations for this field position if it's editable
            $fieldEdit = isset($editableFieldsets[(string)$index]) ? $editableFieldsets[(string)$index] : null;
            
            // Find the fieldset by ID
            $matchingFieldset = null;
            foreach ($fieldsets as $ft) {
                if (isset($ft['id']) && $ft['id'] === $fieldsetId) {
                    $matchingFieldset = $ft;
                    break;
                }
            }
            
            if (!$matchingFieldset) {
                continue;
            }
            
            // Extract field IDs from fieldset_fields JSON array (fallback to field_type_fields for backward compatibility)
            $itemIds = [];
            $fieldsetFields = $matchingFieldset['fieldset_fields'] ?? $matchingFieldset['field_type_fields'] ?? null;
            if (!isset($fieldsetFields)) {
                throw new RuntimeException("fieldset_fields missing for fieldset id: " . $fieldsetId);
            }
            if (!is_array($fieldsetFields)) {
                throw new RuntimeException("fieldset_fields must be an array for fieldset id: " . $fieldsetId);
            }
            
            // fieldset_fields contains array of field keys like ["title", "description"]
            foreach ($fieldsetFields as $fieldKey) {
                if (!is_string($fieldKey)) {
                    throw new RuntimeException("fieldset_fields must contain string field keys for fieldset id: " . $fieldsetId);
                }
                if (!isset($fieldsByKey[$fieldKey])) {
                    throw new RuntimeException("Field key '{$fieldKey}' not found in fields table (referenced by fieldset id: " . $fieldsetId . ")");
                }
                $field = $fieldsByKey[$fieldKey];
                if (!isset($field['id'])) {
                    throw new RuntimeException("Field '{$fieldKey}' missing id (referenced by fieldset id: " . $fieldsetId . ")");
                }
                $itemIds[] = ['type' => 'field', 'id' => (int)$field['id']];
            }
            
            // If fieldset has only ONE item and it's a field → use fieldset properties
            if (count($itemIds) === 1 && $itemIds[0]['type'] === 'field' && isset($fieldsById[$itemIds[0]['id']])) {
                $field = $fieldsById[$itemIds[0]['id']];
                
                // CRITICAL: Use fieldset_key as the source of truth for the type
                // The fields.input_type column (e.g., "textarea") is just the input type,
                // but the actual field type identifier is fieldset_key (e.g., "description", "text-area")
                $fieldsetKey = isset($matchingFieldset['fieldset_key']) ? trim((string) $matchingFieldset['fieldset_key']) : (isset($matchingFieldset['key']) ? trim((string) $matchingFieldset['key']) : '');
                
                // Always use fieldset_key from database when available (no hardcoded checks)
                if ($fieldsetKey !== '') {
                    $normalizedType = $fieldsetKey;
                } else {
                    // Fallback: normalize from fields.input_type column (for other field types)
                    $rawType = isset($field['input_type']) ? trim((string) $field['input_type']) : '';
                    $normalizedType = $rawType;
                    
                    if ($rawType !== '' && preg_match('/^([^\s\[]+)/', $rawType, $matches)) {
                        $normalizedType = trim($matches[1]);
                    }
                }
                
                // Check if this field type is editable and has customizations
                $isEditable = isset($matchingFieldset['formbuilder_editable']) && $matchingFieldset['formbuilder_editable'] === true;
                $fieldsetKey = isset($matchingFieldset['fieldset_key']) ? trim((string) $matchingFieldset['fieldset_key']) : (isset($matchingFieldset['key']) ? trim((string) $matchingFieldset['key']) : '');
                $isCheckout = ($fieldsetKey === 'checkout');
                
                $customName = null;
                $customOptions = null;
                $customCheckoutOptions = null;
                
                // Load customizations for editable fields
                if ($isEditable && $fieldEdit && is_array($fieldEdit)) {
                    if (isset($fieldEdit['name']) && is_string($fieldEdit['name']) && trim($fieldEdit['name']) !== '') {
                        $customName = trim($fieldEdit['name']);
                    }
                    if (isset($fieldEdit['options']) && is_array($fieldEdit['options'])) {
                        $customOptions = $fieldEdit['options'];
                    }
                }
                
                // For checkout fields, use checkout_options_id column (array of checkout option IDs)
                if ($isCheckout && !empty($checkoutOptionsIds)) {
                    $customCheckoutOptions = $checkoutOptionsIds;
                }
                
                $fieldsetName = isset($matchingFieldset['fieldset_name']) ? $matchingFieldset['fieldset_name'] : (isset($matchingFieldset['name']) ? $matchingFieldset['name'] : '');
                $fieldsetKeyValue = isset($matchingFieldset['fieldset_key']) ? $matchingFieldset['fieldset_key'] : (isset($matchingFieldset['key']) ? $matchingFieldset['key'] : '');
                
                $builtField = [
                    'id' => $matchingFieldset['id'],
                    'key' => $fieldsetKeyValue,
                    'type' => $normalizedType,
                    'name' => $customName !== null ? $customName : $fieldsetName,
                    'placeholder' => $matchingFieldset['placeholder'] ?? '',
                    'required' => $requiredValue,
                    'fieldsetKey' => $fieldsetKeyValue,
                ];
                
                // Use custom options if available, otherwise use field options
                if ($customOptions !== null && is_array($customOptions)) {
                    $builtField['options'] = $customOptions;
                } elseif ($field['options'] !== null && $field['options'] !== '') {
                    $builtField['options'] = $field['options'];
                }
                
                // Add checkout options if available
                if ($customCheckoutOptions !== null && is_array($customCheckoutOptions)) {
                    $builtField['checkoutOptions'] = $customCheckoutOptions;
                }
                
                $builtFields[] = $builtField;
            }
            // Otherwise → create ONE field object using fieldset properties, with all items as children
            else {
                // Check if this field type is editable and has customizations
                $isEditable = isset($matchingFieldset['formbuilder_editable']) && $matchingFieldset['formbuilder_editable'] === true;
                $fieldsetKey = isset($matchingFieldset['fieldset_key']) ? trim((string) $matchingFieldset['fieldset_key']) : (isset($matchingFieldset['key']) ? trim((string) $matchingFieldset['key']) : '');
                $isCheckout = ($fieldsetKey === 'checkout');
                $customName = null;
                $customCheckoutOptions = null;
                if ($isEditable && $fieldEdit && is_array($fieldEdit)) {
                    if (isset($fieldEdit['name']) && is_string($fieldEdit['name']) && trim($fieldEdit['name']) !== '') {
                        $customName = trim($fieldEdit['name']);
                    }
                }
                // For checkout fields, use checkout_options_id column
                if ($isCheckout && !empty($checkoutOptionsIds)) {
                    $customCheckoutOptions = $checkoutOptionsIds;
                }
                
                $fieldsetName = isset($matchingFieldset['fieldset_name']) ? $matchingFieldset['fieldset_name'] : (isset($matchingFieldset['name']) ? $matchingFieldset['name'] : '');
                $fieldsetKeyValue = isset($matchingFieldset['fieldset_key']) ? $matchingFieldset['fieldset_key'] : (isset($matchingFieldset['key']) ? $matchingFieldset['key'] : '');
                
                $builtField = [
                    'id' => $matchingFieldset['id'],
                    'key' => $fieldsetKeyValue,
                    'type' => $fieldsetKeyValue,
                    'name' => $customName !== null ? $customName : $fieldsetName,
                    'placeholder' => $matchingFieldset['placeholder'] ?? '',
                    'required' => $requiredValue,
                    'fieldsetKey' => $fieldsetKeyValue,
                    'fields' => [],
                ];
                
                // Add checkout options if available
                if ($customCheckoutOptions !== null && is_array($customCheckoutOptions)) {
                    $builtField['checkoutOptions'] = $customCheckoutOptions;
                }
                
                // Add all fields as children
                foreach ($itemIds as $item) {
                    if ($item['type'] === 'field' && isset($fieldsById[$item['id']])) {
                        $childField = $fieldsById[$item['id']];
                        $childInputType = isset($childField['input_type']) ? trim((string) $childField['input_type']) : 'text';
                        $builtField['fields'][] = [
                            'id' => $childField['id'],
                            'key' => $childField['field_key'],
                            'type' => $childInputType,
                            'name' => ucwords(str_replace(['_', '-'], ' ', $childField['field_key'])),
                        ];
                    }
                }
                
                $builtFields[] = $builtField;
            }
        }
        
        $categoriesMap[$categoryName]['subFields'][$sub['name']] = $builtFields;
        $categoriesMap[$categoryName]['subFieldsets'][$sub['name']] = $fieldsetIds;

        $subcategoryFieldsetIds[$sub['name']] = $fieldsetIds;
        $subcategoryFieldsetNames[$sub['name']] = $fieldsetNames;

        $iconHtml = '';
        $iconPath = '';
        if (isset($sub['icon_path']) && is_string($sub['icon_path'])) {
            $iconPath = trim($sub['icon_path']);
            if ($iconPath !== '') {
                $safeIconPath = htmlspecialchars($iconPath, ENT_QUOTES, 'UTF-8');
                $iconHtml = sprintf('<img src="%s" width="20" height="20" alt="">', $safeIconPath);
            }
        }
        if ($iconHtml !== '') {
            $subcategoryIcons[$sub['name']] = $iconHtml;
        }
        if ($iconPath !== '') {
            $subcategoryIconPaths[$sub['name']] = $iconPath;
        }

        $markerPath = '';
        if (isset($sub['icon_path']) && is_string($sub['icon_path'])) {
            $candidate = trim($sub['icon_path']);
            if ($candidate !== '') {
                $markerPath = $candidate;
            }
        }
        if ($markerPath !== '') {
            $subcategoryMarkers[$sub['name']] = $markerPath;
        }

        // markerId comes from subcategory_key
        $markerId = '';
        if (isset($sub['subcategory_key']) && is_string($sub['subcategory_key']) && $sub['subcategory_key'] !== '') {
            $markerId = trim($sub['subcategory_key']);
        } else {
            $markerId = slugify_key($sub['name']);
        }
        if ($markerId !== '') {
            $subcategoryMarkerIds[$sub['name']] = $markerId;
        }
    }

    foreach ($categoriesMap as &$category) {
        if (!is_array($category['subs'])) {
            $category['subs'] = [];
        }
        if (!is_array($category['subFields'])) {
            $category['subFields'] = [];
        }
        if (!is_array($category['subFieldsets'])) {
            $category['subFieldsets'] = [];
        }
        $subs = $category['subs'];
        usort($subs, static function (array $a, array $b): int {
            $orderA = $a['sort_order'] ?? null;
            $orderB = $b['sort_order'] ?? null;
            if ($orderA !== null && $orderB !== null && $orderA !== $orderB) {
                return $orderA <=> $orderB;
            }
            if ($orderA !== null && $orderB === null) {
                return -1;
            }
            if ($orderA === null && $orderB !== null) {
                return 1;
            }
            return strcasecmp($a['name'], $b['name']);
        });
        $category['subs'] = array_map(static function (array $entry): string {
            return $entry['name'];
        }, $subs);
        foreach ($category['subs'] as $subName) {
            if (!isset($category['subFields'][$subName]) || !is_array($category['subFields'][$subName])) {
                $category['subFields'][$subName] = [];
            }
            if (!isset($category['subFieldsets'][$subName]) || !is_array($category['subFieldsets'][$subName])) {
                $category['subFieldsets'][$subName] = [];
            }
        }
    }
    unset($category);

    $categoriesList = array_values($categoriesMap);

    usort($categoriesList, static function (array $a, array $b): int {
        $orderA = $a['sort_order'] ?? null;
        $orderB = $b['sort_order'] ?? null;

        if ($orderA !== null && $orderB !== null) {
            if ($orderA === $orderB) {
                return strcasecmp($a['name'], $b['name']);
            }

            return $orderA <=> $orderB;
        }

        return strcasecmp($a['name'], $b['name']);
    });

    // Use currency options from currency field
    $currencies = $currencyOptions;
    sort($currencies);

    $sanitizedCategoryMarkers = sanitizeSubcategoryMarkers($categoryMarkers);
    $sanitizedSubcategoryMarkers = sanitizeSubcategoryMarkers($subcategoryMarkers);

    return [
        'categories' => $categoriesList,
        'categoryIcons' => $categoryIcons,
        'categoryIconPaths' => $categoryIconPaths,
        'categoryMarkers' => $sanitizedCategoryMarkers,
        'subcategoryIcons' => $subcategoryIcons,
        'subcategoryIconPaths' => $subcategoryIconPaths,
        'subcategoryMarkers' => $sanitizedSubcategoryMarkers,
        'subcategoryMarkerIds' => $subcategoryMarkerIds,
        'subcategoryFieldsetIds' => $subcategoryFieldsetIds,
        'subcategoryFieldsetNames' => $subcategoryFieldsetNames,
        'currencies' => $currencies,
    ];
}

function extract_icon_src(string $html): string
{
    $trimmed = trim($html);
    if ($trimmed === '') {
        return '';
    }
    if (preg_match('/src\s*=\s*"([^"]+)"/i', $trimmed, $matches)) {
        return trim($matches[1]);
    }
    if (preg_match("/src\s*=\s*'([^']+)'/i", $trimmed, $matches)) {
        return trim($matches[1]);
    }
    return '';
}

function sanitizeSubcategoryMarkers(array $markers): array
{
    $clean = [];

    foreach ($markers as $name => $marker) {
        if (!is_string($marker)) {
            continue;
        }

        $trimmed = trim($marker);
        if ($trimmed === '') {
            continue;
        }

        $slug = slugify_key((string) $name);
        if ($slug === '') {
            continue;
        }

        $clean[$slug] = $trimmed;
    }

    return $clean;
}

function sanitizeSnapshotIconPath(string $value): string
{
    $path = trim($value);
    if ($path === '') {
        return '';
    }

    $normalized = str_replace('\\', '/', $path);
    $normalized = preg_replace('#/+#', '/', $normalized);
    $normalized = ltrim($normalized, '/');

    if ($normalized === '' || strpos($normalized, '..') !== false) {
        return '';
    }

    if (stripos($normalized, 'assets/icons-') !== 0) {
        return '';
    }

    return snapshotSanitizeString($normalized, 255);
}

function normalizeSnapshotMarkerIconPath(string $sanitizedPath): string
{
    if ($sanitizedPath === '') {
        return '';
    }

    $markerPath = $sanitizedPath;

    // Normalize any icons-\d+ folder to standard icons folder
    $directoryNormalized = preg_replace('#^assets/icons-\d+/#i', 'assets/icons-30/', $markerPath, 1);
    if (is_string($directoryNormalized) && $directoryNormalized !== '') {
        $markerPath = $directoryNormalized;
    }

    // Normalize size suffix to -30
    $sizeAdjusted = preg_replace('/-(\d{2,3})(\.[a-z0-9]+)$/i', '-30$2', $markerPath, 1);
    if (is_string($sizeAdjusted) && $sizeAdjusted !== '') {
        $markerPath = $sizeAdjusted;
    }

    return snapshotSanitizeString($markerPath, 255);
}

function parseFieldsetIdsCsv(string $value): array
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return [];
    }

    $parts = preg_split('/\s*,\s*/', $trimmed);
    if (!is_array($parts)) {
        $parts = [$trimmed];
    }

    $ids = [];
    foreach ($parts as $part) {
        if (!is_string($part)) {
            continue;
        }
        $candidate = trim($part);
        if ($candidate === '') {
            continue;
        }
        if (preg_match('/^\d+$/', $candidate)) {
            $ids[] = (int) $candidate;
        }
    }

    return array_values(array_unique($ids));
}

function parseFieldsetNameCsv(string $value): array
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return [];
    }

    $parts = explode(',', $value);
    $names = [];
    foreach ($parts as $part) {
        if (!is_string($part)) {
            continue;
        }
        $candidate = trim($part);
        if ($candidate === '') {
            continue;
        }
        $names[] = $candidate;
    }

    return array_values(array_unique($names));
}

function slugify_key(string $value): string
{
    $normalized = trim($value);

    if ($normalized === '') {
        return '';
    }

    if (class_exists('Normalizer')) {
        $normalized = \Normalizer::normalize($normalized, \Normalizer::FORM_D);
    }

    $normalized = preg_replace('/\p{Mn}+/u', '', $normalized);

    if (!class_exists('Normalizer')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized);
        if (is_string($ascii) && $ascii !== '') {
            $normalized = $ascii;
        }
    }

    $normalized = strtolower($normalized);
    $normalized = preg_replace('/[^a-z0-9]+/', '-', $normalized);
    $normalized = trim($normalized, '-');

    return $normalized;
}

function snapshotSanitizeString(string $value, int $maxLength = 255): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    if ($maxLength > 0) {
        if (function_exists('mb_strlen')) {
            if (mb_strlen($trimmed) > $maxLength) {
                $trimmed = mb_substr($trimmed, 0, $maxLength);
            }
        } elseif (strlen($trimmed) > $maxLength) {
            $trimmed = substr($trimmed, 0, $maxLength);
        }
    }

    return $trimmed;
}
