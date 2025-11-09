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

    $fieldTypeColumns = fetchTableColumns($pdo, 'field_types');
    $fieldTypes = [];
    if ($fieldTypeColumns) {
        $fieldTypes = fetchFieldTypes($pdo, $fieldTypeColumns);
    }

    // Fetch all fields and fieldsets from database
    $allFields = [];
    $allFieldsets = [];
    $currencyOptions = [];
    
    try {
        $fieldColumns = fetchTableColumns($pdo, 'fields');
        if ($fieldColumns) {
            $allFields = fetchAllFields($pdo, $fieldColumns);
            
            // Get currency options from currency field
            $currencyField = array_filter($allFields, function($f) {
                return isset($f['field_key']) && $f['field_key'] === 'currency' && $f['id'] === 13;
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
    
    try {
        $fieldsetColumns = fetchTableColumns($pdo, 'fieldsets');
        if ($fieldsetColumns) {
            $allFieldsets = fetchAllFieldsets($pdo, $fieldsetColumns);
        }
    } catch (PDOException $e) {
        // Continue without fieldsets
    }

    $snapshot = buildSnapshot($pdo, $categories, $subcategories, $currencyOptions, $allFields, $allFieldsets, $fieldTypes);
    $snapshot['fieldTypes'] = $fieldTypes;
    $snapshot['field_types'] = $fieldTypes;

    echo json_encode([
        'success' => true,
        'snapshot' => $snapshot,
    ]);
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
    $hasMapmarkerPath = in_array('mapmarker_path', $columns, true);
    $hasFieldTypeId = in_array('field_type_id', $columns, true);
    $hasFieldTypeName = in_array('field_type_name', $columns, true);

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
    if ($hasMapmarkerPath) {
        $selectColumns[] = '`mapmarker_path`';
    }
    if ($hasFieldTypeId) {
        $selectColumns[] = '`field_type_id`';
    }
    if ($hasFieldTypeName) {
        $selectColumns[] = '`field_type_name`';
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

        $fieldTypeIds = [];
        if ($hasFieldTypeId && isset($row['field_type_id']) && is_string($row['field_type_id'])) {
            $fieldTypeIds = parseFieldTypeIdCsv($row['field_type_id']);
        }

        $fieldTypeNames = [];
        if ($hasFieldTypeName && isset($row['field_type_name']) && is_string($row['field_type_name'])) {
            $fieldTypeNames = parseFieldTypeNameCsv($row['field_type_name']);
        }

        $categories[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'subs' => [],
            'icon_path' => $hasIconPath && isset($row['icon_path']) && is_string($row['icon_path'])
                ? trim($row['icon_path'])
                : null,
            'mapmarker_path' => $hasMapmarkerPath && isset($row['mapmarker_path']) && is_string($row['mapmarker_path'])
                ? trim($row['mapmarker_path'])
                : null,
            'field_type_ids' => $fieldTypeIds,
            'field_type_names' => $fieldTypeNames,
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
    $hasMapmarkerPath = in_array('mapmarker_path', $columns, true);
    $hasSubcategoryKey = in_array('subcategory_key', $columns, true);
    $hasRequired = in_array('required', $columns, true);

    $hasFieldTypeId = in_array('field_type_id', $columns, true);
    $hasFieldTypeName = in_array('field_type_name', $columns, true);

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
    if ($hasMapmarkerPath) {
        $select[] = 's.`mapmarker_path`';
    }
    if ($hasSubcategoryKey) {
        $select[] = 's.`subcategory_key`';
    }
    if ($hasRequired) {
        $select[] = 's.`required`';
    }

    if ($hasFieldTypeId) {
        $select[] = 's.`field_type_id`';
    }
    if ($hasFieldTypeName) {
        $select[] = 's.`field_type_name`';
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
        $fieldTypeIds = [];
        if ($hasFieldTypeId && isset($row['field_type_id']) && is_string($row['field_type_id'])) {
            $fieldTypeIds = parseFieldTypeIdCsv($row['field_type_id']);
        }

        $fieldTypeNames = [];
        if ($hasFieldTypeName && isset($row['field_type_name']) && is_string($row['field_type_name'])) {
            $fieldTypeNames = parseFieldTypeNameCsv($row['field_type_name']);
        }

        $subcategoryKey = '';
        if ($hasSubcategoryKey && isset($row['subcategory_key']) && is_string($row['subcategory_key'])) {
            $subcategoryKey = trim($row['subcategory_key']);
        }

        $required = null;
        if ($hasRequired && isset($row['required']) && is_string($row['required']) && $row['required'] !== '') {
            $required = trim($row['required']);
        }

        $results[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'category' => $categoryName,
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'icon_path' => $hasIconPath && isset($row['icon_path']) && is_string($row['icon_path'])
                ? trim($row['icon_path'])
                : null,
            'mapmarker_path' => $hasMapmarkerPath && isset($row['mapmarker_path']) && is_string($row['mapmarker_path'])
                ? trim($row['mapmarker_path'])
                : null,
            'subcategory_key' => $subcategoryKey,
            'required' => $required,
            'field_type_ids' => $fieldTypeIds,
            'field_type_names' => $fieldTypeNames,
        ];
    }

    return $results;
}

function fetchFieldTypes(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    $orderBy = '';

    $hasId = in_array('id', $columns, true);
    $hasKey = in_array('field_type_key', $columns, true);
    $hasName = in_array('field_type_name', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasPlaceholder = in_array('placeholder', $columns, true);
    
    // Check for field_type_item columns
    $hasItem1 = in_array('field_type_item_1', $columns, true);
    $hasItem2 = in_array('field_type_item_2', $columns, true);
    $hasItem3 = in_array('field_type_item_3', $columns, true);
    $hasItem4 = in_array('field_type_item_4', $columns, true);
    $hasItem5 = in_array('field_type_item_5', $columns, true);

    if ($hasId) {
        $selectColumns[] = '`id`';
    }
    if ($hasKey) {
        $selectColumns[] = '`field_type_key`';
    }
    if ($hasName) {
        $selectColumns[] = '`field_type_name`';
    }
    if ($hasPlaceholder) {
        $selectColumns[] = '`placeholder`';
    }
    if ($hasSortOrder) {
        $selectColumns[] = '`sort_order`';
        $orderBy = ' ORDER BY `sort_order` ASC';
    } elseif ($hasName) {
        $orderBy = ' ORDER BY `field_type_name` ASC';
    } elseif ($hasId) {
        $orderBy = ' ORDER BY `id` ASC';
    }
    
    // Add field_type_item columns if they exist
    if ($hasItem1) {
        $selectColumns[] = '`field_type_item_1`';
    }
    if ($hasItem2) {
        $selectColumns[] = '`field_type_item_2`';
    }
    if ($hasItem3) {
        $selectColumns[] = '`field_type_item_3`';
    }
    if ($hasItem4) {
        $selectColumns[] = '`field_type_item_4`';
    }
    if ($hasItem5) {
        $selectColumns[] = '`field_type_item_5`';
    }

    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM field_types' . $orderBy;

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return [];
    }

    $fieldTypes = [];
    $seen = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!is_array($row)) {
            continue;
        }

        $rawKey = '';
        if ($hasKey && isset($row['field_type_key'])) {
            $rawKey = trim((string) $row['field_type_key']);
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
        if ($hasName && isset($row['field_type_name'])) {
            $rawName = trim((string) $row['field_type_name']);
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
        if ($hasKey && isset($row['field_type_key'])) {
            $entry['field_type_key'] = (string) $row['field_type_key'];
            $entry['key'] = (string) $row['field_type_key'];
        } else {
            $entry['key'] = $rawKey;
        }
        if ($hasName && isset($row['field_type_name'])) {
            $entry['field_type_name'] = (string) $row['field_type_name'];
            $entry['name'] = (string) $row['field_type_name'];
        } else {
            $entry['name'] = $rawName;
        }
        if ($hasPlaceholder && isset($row['placeholder']) && is_string($row['placeholder'])) {
            $entry['placeholder'] = trim($row['placeholder']);
        }
        if ($hasSortOrder && isset($row['sort_order'])) {
            $entry['sort_order'] = is_numeric($row['sort_order'])
                ? (int) $row['sort_order']
                : $row['sort_order'];
        }
        
        // Include field_type_item columns
        if ($hasItem1 && isset($row['field_type_item_1'])) {
            $entry['field_type_item_1'] = (string) $row['field_type_item_1'];
        }
        if ($hasItem2 && isset($row['field_type_item_2'])) {
            $entry['field_type_item_2'] = (string) $row['field_type_item_2'];
        }
        if ($hasItem3 && isset($row['field_type_item_3'])) {
            $entry['field_type_item_3'] = (string) $row['field_type_item_3'];
        }
        if ($hasItem4 && isset($row['field_type_item_4'])) {
            $entry['field_type_item_4'] = (string) $row['field_type_item_4'];
        }
        if ($hasItem5 && isset($row['field_type_item_5'])) {
            $entry['field_type_item_5'] = (string) $row['field_type_item_5'];
        }

        $fieldTypes[] = $entry;
        $seen[$dedupeKey] = true;
    }

    return $fieldTypes;
}

function fetchAllFields(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    foreach (['id', 'field_key', 'type', 'options'] as $col) {
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
            'type' => isset($row['type']) ? trim((string) $row['type']) : 'text',
            'options' => isset($row['options']) && is_string($row['options']) ? trim($row['options']) : null,
        ];
        
        $fields[] = $field;
    }
    
    return $fields;
}

function fetchAllFieldsets(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    foreach (['id', 'fieldset_key', 'description', 'field_id', 'field_key'] as $col) {
        if (in_array($col, $columns, true)) {
            $selectColumns[] = "`$col`";
        }
    }
    
    if (empty($selectColumns)) {
        $selectColumns[] = '*';
    }
    
    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM `fieldsets` ORDER BY `id` ASC';
    $stmt = $pdo->query($sql);
    
    $fieldsets = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'])) continue;
        
        $fieldIds = [];
        if (isset($row['field_id']) && is_string($row['field_id'])) {
            $fieldIds = array_filter(array_map('trim', explode(',', $row['field_id'])), function($id) {
                return $id !== '';
            });
        }
        
        $fieldKeys = [];
        if (isset($row['field_key']) && is_string($row['field_key'])) {
            $fieldKeys = array_filter(array_map('trim', explode(',', $row['field_key'])), function($key) {
                return $key !== '';
            });
        }
        
        $fieldset = [
            'id' => (int) $row['id'],
            'fieldset_key' => isset($row['fieldset_key']) ? trim((string) $row['fieldset_key']) : '',
            'description' => isset($row['description']) ? trim((string) $row['description']) : '',
            'field_ids' => $fieldIds,
            'field_keys' => $fieldKeys,
        ];
        
        $fieldsets[] = $fieldset;
    }
    
    return $fieldsets;
}

function buildSnapshot(PDO $pdo, array $categories, array $subcategories, array $currencyOptions = [], array $allFields = [], array $allFieldsets = [], array $fieldTypes = []): array
{
    // Index fields and fieldsets by ID for quick lookup
    $fieldsById = [];
    foreach ($allFields as $field) {
        if (isset($field['id'])) {
            $fieldsById[$field['id']] = $field;
        }
    }
    
    $fieldsetsById = [];
    foreach ($allFieldsets as $fieldset) {
        if (isset($fieldset['id'])) {
            $fieldsetsById[$fieldset['id']] = $fieldset;
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
            'subFieldTypes' => [],
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
        if (isset($category['mapmarker_path']) && is_string($category['mapmarker_path'])) {
            $candidate = trim($category['mapmarker_path']);
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
    $subcategoryFieldTypeIds = [];
    $subcategoryFieldTypeNames = [];

    foreach ($subcategories as $sub) {
        $categoryName = $sub['category'];
        if (!isset($categoriesMap[$categoryName])) {
            $categoriesMap[$categoryName] = [
                'id' => null,
                'name' => $categoryName,
                'subs' => [],
                'subFields' => [],
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
            'listing_fee' => isset($sub['listing_fee']) ? (float)$sub['listing_fee'] : null,
            'featured_fee' => isset($sub['featured_fee']) ? (float)$sub['featured_fee'] : null,
            'renew_fee' => isset($sub['renew_fee']) ? (float)$sub['renew_fee'] : null,
            'renew_featured_fee' => isset($sub['renew_featured_fee']) ? (float)$sub['renew_featured_fee'] : null,
            'subcategory_type' => $sub['subcategory_type'] ?? 'Standard',
            'listing_days' => isset($sub['listing_days']) ? (int)$sub['listing_days'] : null,
        ];

        // Get field_type_ids and required flags from CSV columns
        $fieldTypeIds = [];
        if (isset($sub['field_type_ids']) && is_array($sub['field_type_ids'])) {
            foreach ($sub['field_type_ids'] as $value) {
                if (is_int($value)) {
                    $fieldTypeIds[] = $value;
                } elseif (is_string($value) && preg_match('/^\d+$/', $value)) {
                    $fieldTypeIds[] = (int) $value;
                }
            }
        }
        $fieldTypeIds = array_values(array_unique($fieldTypeIds));
        
        // Parse required CSV (format: "1,0,1,0,0" aligned with field_type_id positions)
        $requiredFlags = [];
        if (isset($sub['required']) && is_string($sub['required']) && $sub['required'] !== '') {
            $requiredParts = preg_split('/\s*,\s*/', trim($sub['required']));
            foreach ($requiredParts as $part) {
                $requiredFlags[] = (trim($part) === '1' || strtolower(trim($part)) === 'true');
            }
        }

        $fieldTypeNames = [];
        if (isset($sub['field_type_names']) && is_array($sub['field_type_names'])) {
            foreach ($sub['field_type_names'] as $value) {
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed !== '') {
                        $fieldTypeNames[] = $trimmed;
                    }
                }
            }
        }
        $fieldTypeNames = array_values(array_unique($fieldTypeNames));

        // Build field objects by looking up field_types and extracting field/fieldset IDs from ENUMs
        $builtFields = [];
        foreach ($fieldTypeIds as $index => $fieldTypeId) {
            // Get required flag for this field (default to false if not set)
            $requiredValue = isset($requiredFlags[$index]) ? $requiredFlags[$index] : false;
            
            // Find the field_type by ID
            $matchingFieldType = null;
            foreach ($fieldTypes as $ft) {
                if (isset($ft['id']) && $ft['id'] === $fieldTypeId) {
                    $matchingFieldType = $ft;
                    break;
                }
            }
            
            if (!$matchingFieldType) {
                continue;
            }
            
            // Extract all field/fieldset IDs from field_type_item_* columns
            $itemIds = [];
            for ($i = 1; $i <= 5; $i++) {
                $itemKey = "field_type_item_$i";
                if (isset($matchingFieldType[$itemKey]) && is_string($matchingFieldType[$itemKey]) && $matchingFieldType[$itemKey] !== '') {
                    // Parse "title [field=1]" or "venues [fieldset=1]"
                    if (preg_match('/\[(field|fieldset)=(\d+)\]/', $matchingFieldType[$itemKey], $matches)) {
                        $itemType = $matches[1]; // 'field' or 'fieldset'
                        $itemId = (int) $matches[2];
                        $itemIds[] = ['type' => $itemType, 'id' => $itemId];
                    }
                }
            }
            
            // If field_type has only ONE item and it's a field → use field_type properties
            if (count($itemIds) === 1 && $itemIds[0]['type'] === 'field' && isset($fieldsById[$itemIds[0]['id']])) {
                $field = $fieldsById[$itemIds[0]['id']];
                $builtField = [
                    'id' => $matchingFieldType['id'],
                    'key' => $matchingFieldType['field_type_key'],
                    'type' => $field['type'],
                    'name' => $matchingFieldType['field_type_name'],
                    'placeholder' => $matchingFieldType['placeholder'] ?? '',
                    'required' => $requiredValue,
                    'fieldTypeKey' => $matchingFieldType['field_type_key'],
                ];
                
                if ($field['options'] !== null && $field['options'] !== '') {
                    $builtField['options'] = $field['options'];
                }
                
                $builtFields[] = $builtField;
            }
            // Otherwise → create ONE field object using field_type properties, with all items as children
            else {
                $builtField = [
                    'id' => $matchingFieldType['id'],
                    'key' => $matchingFieldType['field_type_key'],
                    'type' => $matchingFieldType['field_type_key'],
                    'name' => $matchingFieldType['field_type_name'],
                    'placeholder' => $matchingFieldType['placeholder'] ?? '',
                    'required' => $requiredValue,
                    'fieldTypeKey' => $matchingFieldType['field_type_key'],
                    'fields' => [],
                ];
                
                // Add all fieldsets/fields as children
                foreach ($itemIds as $item) {
                    if ($item['type'] === 'fieldset' && isset($fieldsetsById[$item['id']])) {
                        $fieldset = $fieldsetsById[$item['id']];
                        $childFieldset = [
                            'id' => $fieldset['id'],
                            'key' => $fieldset['fieldset_key'],
                            'type' => 'fieldset',
                            'name' => ucwords(str_replace(['_', '-'], ' ', $fieldset['fieldset_key'])),
                            'fields' => [],
                        ];
                        
                        // Add fields within this fieldset
                        foreach ($fieldset['field_ids'] as $childId) {
                            if (isset($fieldsById[(int)$childId])) {
                                $childField = $fieldsById[(int)$childId];
                                $childFieldset['fields'][] = [
                                    'id' => $childField['id'],
                                    'key' => $childField['field_key'],
                                    'type' => $childField['type'],
                                    'name' => ucwords(str_replace(['_', '-'], ' ', $childField['field_key'])),
                                ];
                            }
                        }
                        
                        $builtField['fields'][] = $childFieldset;
                    }
                }
                
                $builtFields[] = $builtField;
            }
        }
        
        $categoriesMap[$categoryName]['subFields'][$sub['name']] = $builtFields;
        $categoriesMap[$categoryName]['subFieldTypes'][$sub['name']] = $fieldTypeIds;

        $subcategoryFieldTypeIds[$sub['name']] = $fieldTypeIds;
        $subcategoryFieldTypeNames[$sub['name']] = $fieldTypeNames;

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
        if (isset($sub['mapmarker_path']) && is_string($sub['mapmarker_path'])) {
            $candidate = trim($sub['mapmarker_path']);
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
        if (!is_array($category['subFieldTypes'])) {
            $category['subFieldTypes'] = [];
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
            if (!isset($category['subFieldTypes'][$subName]) || !is_array($category['subFieldTypes'][$subName])) {
                $category['subFieldTypes'][$subName] = [];
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

    // Use currency options from currency field (or provided currencyOptions)
    $versionPriceCurrencies = $currencyOptions;
    sort($versionPriceCurrencies);

    $sanitizedCategoryMarkers = sanitizeSubcategoryMarkers($categoryMarkers);
    $sanitizedSubcategoryMarkers = sanitizeSubcategoryMarkers($subcategoryMarkers);
    $iconLibrary = collectSnapshotIconLibrary(
        array_values($categoryIconPaths),
        array_values($subcategoryIconPaths),
        array_values($sanitizedCategoryMarkers),
        array_values($sanitizedSubcategoryMarkers)
    );

    $filesystemIcons = collectFilesystemIconLibrary('assets/icons-30');
    if ($filesystemIcons) {
        $iconLibrary = mergeIconLibraries($iconLibrary, $filesystemIcons);
    }

    return [
        'categories' => $categoriesList,
        'categoryIcons' => $categoryIcons,
        'categoryIconPaths' => $categoryIconPaths,
        'categoryMarkers' => $sanitizedCategoryMarkers,
        'subcategoryIcons' => $subcategoryIcons,
        'subcategoryIconPaths' => $subcategoryIconPaths,
        'subcategoryMarkers' => $sanitizedSubcategoryMarkers,
        'subcategoryMarkerIds' => $subcategoryMarkerIds,
        'subcategoryFieldTypeIds' => $subcategoryFieldTypeIds,
        'subcategoryFieldTypeNames' => $subcategoryFieldTypeNames,
        'versionPriceCurrencies' => $versionPriceCurrencies,
        'iconLibrary' => array_values($iconLibrary),
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

function collectSnapshotIconLibrary(array ...$groups): array
{
    $unique = [];

    foreach ($groups as $group) {
        foreach ($group as $value) {
            if (!is_string($value)) {
                continue;
            }

            $sanitizedPath = sanitizeSnapshotIconPath($value);
            if ($sanitizedPath === '') {
                continue;
            }

            $normalizedPath = normalizeSnapshotMarkerIconPath($sanitizedPath);
            if ($normalizedPath === '') {
                $normalizedPath = $sanitizedPath;
            }

            $unique[$normalizedPath] = true;
        }
    }

    return array_keys($unique);
}

function collectFilesystemIconLibrary(string $relativeDirectory): array
{
    $normalizedRelative = trim($relativeDirectory, '/');
    if ($normalizedRelative === '') {
        return [];
    }

    $extensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'];
    $unique = [];

    $baseCandidates = [
        dirname(__DIR__, 3),
        dirname(__DIR__, 2),
        dirname(__DIR__),
        __DIR__,
    ];

    foreach ($baseCandidates as $basePath) {
        if (!is_string($basePath) || $basePath === '') {
            continue;
        }

        $absolutePath = rtrim($basePath, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $normalizedRelative;

        if (!is_dir($absolutePath)) {
            continue;
        }

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator(
                    $absolutePath,
                    FilesystemIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS
                ),
                RecursiveIteratorIterator::SELF_FIRST
            );
        } catch (UnexpectedValueException $e) {
            continue;
        }

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo instanceof SplFileInfo || !$fileInfo->isFile()) {
                continue;
            }

            $extension = strtolower($fileInfo->getExtension());
            if ($extension === '' || !in_array($extension, $extensions, true)) {
                continue;
            }

            $relativePathPart = substr($fileInfo->getPathname(), strlen($absolutePath));
            if (!is_string($relativePathPart)) {
                continue;
            }

            $relativePathPart = str_replace('\\', '/', $relativePathPart);
            $relativePathPart = ltrim($relativePathPart, '/');

            $relativePath = $normalizedRelative;
            if ($relativePathPart !== '') {
                $relativePath .= '/' . $relativePathPart;
            }

            $sanitized = sanitizeSnapshotIconPath($relativePath);
            if ($sanitized === '') {
                continue;
            }

            $normalized = normalizeSnapshotMarkerIconPath($sanitized);
            if ($normalized === '') {
                $normalized = $sanitized;
            }

            $unique[$normalized] = true;
        }

        if ($unique) {
            break;
        }
    }

    return array_keys($unique);
}

function mergeIconLibraries(array $existing, array $additional): array
{
    $seen = [];
    $merged = [];

    foreach ($existing as $value) {
        if (!is_string($value)) {
            continue;
        }

        $trimmed = trim($value);
        if ($trimmed === '' || isset($seen[$trimmed])) {
            continue;
        }

        $seen[$trimmed] = true;
        $merged[] = $trimmed;
    }

    foreach ($additional as $value) {
        if (!is_string($value)) {
            continue;
        }

        $trimmed = trim($value);
        if ($trimmed === '' || isset($seen[$trimmed])) {
            continue;
        }

        $seen[$trimmed] = true;
        $merged[] = $trimmed;
    }

    return $merged;
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

    $directoryNormalized = preg_replace('#^assets/icons-\d+/#i', 'assets/icons-30/', $markerPath, 1);
    if (is_string($directoryNormalized) && $directoryNormalized !== '') {
        $markerPath = $directoryNormalized;
    }

    $sizeAdjusted = preg_replace('/-(\d{2,3})(\.[a-z0-9]+)$/i', '-30$2', $markerPath, 1);
    if (is_string($sizeAdjusted) && $sizeAdjusted !== '') {
        $markerPath = $sizeAdjusted;
    }

    return snapshotSanitizeString($markerPath, 255);
}

function parseFieldTypeIdCsv(string $value): array
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

function parseFieldTypeNameCsv(string $value): array
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
