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

    $snapshot = buildSnapshot($categories, $subcategories);
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
    $hasMetadata = in_array('metadata_json', $columns, true);
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
    if ($hasMetadata) {
        $selectColumns[] = '`metadata_json`';
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

        $metadata = [];
        if ($hasMetadata && isset($row['metadata_json']) && is_string($row['metadata_json']) && $row['metadata_json'] !== '') {
            $decoded = json_decode($row['metadata_json'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }

        // ONLY use metadata if DB CSV is empty (database is source of truth for categories)
        if (!$fieldTypeIds && isset($metadata['fieldTypeIds']) && is_array($metadata['fieldTypeIds'])) {
            $metadataFieldTypeIds = [];
            foreach ($metadata['fieldTypeIds'] as $value) {
                if (is_int($value)) {
                    $metadataFieldTypeIds[] = $value;
                } elseif (is_string($value) && preg_match('/^\d+$/', $value)) {
                    $metadataFieldTypeIds[] = (int) $value;
                }
            }
            $metadataFieldTypeIds = array_values(array_unique($metadataFieldTypeIds));
            if ($metadataFieldTypeIds) {
                $fieldTypeIds = $metadataFieldTypeIds;
            }
            $metadata['fieldTypeIds'] = $metadataFieldTypeIds;
        } else {
            $metadata['fieldTypeIds'] = $fieldTypeIds;
        }

        if (!$fieldTypeNames && isset($metadata['fieldTypeNames']) && is_array($metadata['fieldTypeNames'])) {
            $metadataFieldTypeNames = [];
            foreach ($metadata['fieldTypeNames'] as $value) {
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed !== '') {
                        $metadataFieldTypeNames[] = $trimmed;
                    }
                }
            }
            $metadataFieldTypeNames = array_values(array_unique($metadataFieldTypeNames));
            if ($metadataFieldTypeNames) {
                $fieldTypeNames = $metadataFieldTypeNames;
            }
            $metadata['fieldTypeNames'] = $metadataFieldTypeNames;
        } else {
            $metadata['fieldTypeNames'] = $fieldTypeNames;
        }

        $categories[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'subs' => [],
            'metadata' => $metadata,
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
    $hasMetadata = in_array('metadata_json', $columns, true);
    $hasIconPath = in_array('icon_path', $columns, true);
    $hasMapmarkerPath = in_array('mapmarker_path', $columns, true);

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
    if ($hasMetadata) {
        $select[] = 's.`metadata_json`';
    }
    if ($hasIconPath) {
        $select[] = 's.`icon_path`';
    }
    if ($hasMapmarkerPath) {
        $select[] = 's.`mapmarker_path`';
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

        $metadata = [];
        if ($hasMetadata && isset($row['metadata_json']) && is_string($row['metadata_json']) && $row['metadata_json'] !== '') {
            $decoded = json_decode($row['metadata_json'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }

        // ONLY use metadata if DB CSV is empty (database is source of truth for subcategories)
        if (!$fieldTypeIds && isset($metadata['fieldTypeIds']) && is_array($metadata['fieldTypeIds'])) {
            $metadataFieldTypeIds = [];
            foreach ($metadata['fieldTypeIds'] as $value) {
                if (is_int($value)) {
                    $metadataFieldTypeIds[] = $value;
                } elseif (is_string($value) && preg_match('/^\d+$/', $value)) {
                    $metadataFieldTypeIds[] = (int) $value;
                }
            }
            $metadataFieldTypeIds = array_values(array_unique($metadataFieldTypeIds));
            if ($metadataFieldTypeIds) {
                $fieldTypeIds = $metadataFieldTypeIds;
            }
            $metadata['fieldTypeIds'] = $metadataFieldTypeIds;
        } else {
            $metadata['fieldTypeIds'] = $fieldTypeIds;
        }

        if (!$fieldTypeNames && isset($metadata['fieldTypeNames']) && is_array($metadata['fieldTypeNames'])) {
            $metadataFieldTypeNames = [];
            foreach ($metadata['fieldTypeNames'] as $value) {
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed !== '') {
                        $metadataFieldTypeNames[] = $trimmed;
                    }
                }
            }
            $metadataFieldTypeNames = array_values(array_unique($metadataFieldTypeNames));
            if ($metadataFieldTypeNames) {
                $fieldTypeNames = $metadataFieldTypeNames;
            }
            $metadata['fieldTypeNames'] = $metadataFieldTypeNames;
        } else {
            $metadata['fieldTypeNames'] = $fieldTypeNames;
        }

        $results[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'category' => $categoryName,
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'metadata' => $metadata,
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
    $hasFieldTypeItems = in_array('field_type_item_1', $columns, true) || in_array('field_type_item_2', $columns, true) || in_array('field_type_item_3', $columns, true) || in_array('field_type_item_4', $columns, true) || in_array('field_type_item_5', $columns, true);

    if ($hasId) {
        $selectColumns[] = '`id`';
    }
    if ($hasKey) {
        $selectColumns[] = '`field_type_key`';
    }
    if ($hasName) {
        $selectColumns[] = '`field_type_name`';
    }
    if ($hasSortOrder) {
        $selectColumns[] = '`sort_order`';
        $orderBy = ' ORDER BY `sort_order` ASC';
    } elseif ($hasName) {
        $orderBy = ' ORDER BY `field_type_name` ASC';
    } elseif ($hasId) {
        $orderBy = ' ORDER BY `id` ASC';
    }
    
    // Include field_type_item_X columns to parse field definitions
    if ($hasFieldTypeItems) {
        for ($i = 1; $i <= 5; $i++) {
            $colName = 'field_type_item_' . $i;
            if (in_array($colName, $columns, true)) {
                $selectColumns[] = '`' . $colName . '`';
            }
        }
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
        if ($hasSortOrder && isset($row['sort_order'])) {
            $entry['sort_order'] = is_numeric($row['sort_order'])
                ? (int) $row['sort_order']
                : $row['sort_order'];
        }
        
        // Parse field_type_item_X columns to build field definitions
        $fields = [];
        if ($hasFieldTypeItems) {
            for ($i = 1; $i <= 5; $i++) {
                $colName = 'field_type_item_' . $i;
                if (isset($row[$colName]) && is_string($row[$colName]) && $row[$colName] !== '') {
                    // Parse format like "title [field=1]" or "venues [fieldset=1]"
                    $item = trim($row[$colName]);
                    if (preg_match('/^(.+?)\s*\[(field|fieldset)=(\d+)\]$/', $item, $matches)) {
                        $fieldName = trim($matches[1]);
                        $isFieldset = ($matches[2] === 'fieldset');
                        $fieldId = (int) $matches[3];
                        
                        // Create field definition from parsed reference
                        $fieldDef = [
                            'name' => ucfirst(str_replace('_', ' ', $fieldName)),
                            'type' => $fieldName,
                            'required' => false,
                            'options' => []
                        ];
                        
                        // Add specific handling for known field types
                        if ($fieldName === 'title') {
                            $fieldDef['required'] = true;
                        } elseif ($fieldName === 'description') {
                            $fieldDef['required'] = true;
                        } elseif ($fieldName === 'images') {
                            $fieldDef['required'] = true;
                        }
                        
                        if ($isFieldset) {
                            $fieldDef['isFieldset'] = true;
                            $fieldDef['fieldsetId'] = $fieldId;
                        } else {
                            $fieldDef['fieldId'] = $fieldId;
                        }
                        
                        $fields[] = $fieldDef;
                    }
                }
            }
        }
        
        if (!empty($fields)) {
            $entry['fields'] = $fields;
        }

        $fieldTypes[] = $entry;
        $seen[$dedupeKey] = true;
    }

    return $fieldTypes;
}

function buildSnapshot(array $categories, array $subcategories): array
{
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
        ];
        // Ensure subFieldTypes is treated as an object (associative array)
        if (!is_array($categoriesMap[$categoryName]['subFieldTypes'])) {
            $categoriesMap[$categoryName]['subFieldTypes'] = [];
        }

        $metadata = [];
        if (isset($category['metadata']) && is_array($category['metadata'])) {
            $metadata = $category['metadata'];
        }

        $iconHtml = '';
        $iconPath = '';
        if (isset($category['icon_path']) && is_string($category['icon_path'])) {
            $iconPath = trim($category['icon_path']);
            if ($iconPath !== '') {
                $safeIconPath = htmlspecialchars($iconPath, ENT_QUOTES, 'UTF-8');
                $iconHtml = sprintf('<img src="%s" width="20" height="20" alt="">', $safeIconPath);
            }
        }
        if ($iconHtml === '' && isset($metadata['icon']) && is_string($metadata['icon'])) {
            $iconHtml = trim($metadata['icon']);
        }
        if ($iconHtml !== '') {
            $categoryIcons[$categoryName] = $iconHtml;
        }
        if ($iconPath === '' && $iconHtml !== '') {
            $iconPath = extract_icon_src($iconHtml);
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
        if ($markerPath === '' && isset($metadata['marker']) && is_string($metadata['marker'])) {
            $markerPath = trim($metadata['marker']);
        }
        if ($markerPath !== '') {
            $categoryMarkers[$categoryName] = $markerPath;
        }
    }

    $categoryShapes = [];
    $subcategoryIcons = [];
    $subcategoryMarkers = [];
    $subcategoryMarkerIds = [];
    $subcategoryFieldTypeIds = [];
    $subcategoryFieldTypeNames = [];
    $currencySet = [];

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
            ];
        }

        $categoriesMap[$categoryName]['subs'][] = [
            'name' => $sub['name'],
            'sort_order' => $sub['sort_order'],
        ];
        $categoriesMap[$categoryName]['subIds'][$sub['name']] = $sub['id'] ?? null;

        $metadata = $sub['metadata'];
        if (!is_array($metadata)) {
            $metadata = [];
        }

        $fields = [];
        if (isset($metadata['fields']) && is_array($metadata['fields'])) {
            $fields = $metadata['fields'];
        }

        $fieldTypeIds = [];
        if (isset($sub['field_type_ids']) && is_array($sub['field_type_ids'])) {
            foreach ($sub['field_type_ids'] as $value) {
                if (is_int($value)) {
                    $fieldTypeIds[] = $value;
                } elseif (is_string($value) && preg_match('/^\d+$/', $value)) {
                    $fieldTypeIds[] = (int) $value;
                }
            }
        } elseif (isset($metadata['fieldTypeIds']) && is_array($metadata['fieldTypeIds'])) {
            foreach ($metadata['fieldTypeIds'] as $value) {
                if (is_int($value)) {
                    $fieldTypeIds[] = $value;
                } elseif (is_string($value) && preg_match('/^\d+$/', $value)) {
                    $fieldTypeIds[] = (int) $value;
                }
            }
        }
        $fieldTypeIds = array_values(array_unique($fieldTypeIds));

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
        } elseif (isset($metadata['fieldTypeNames']) && is_array($metadata['fieldTypeNames'])) {
            foreach ($metadata['fieldTypeNames'] as $value) {
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed !== '') {
                        $fieldTypeNames[] = $trimmed;
                    }
                }
            }
        }
        $fieldTypeNames = array_values(array_unique($fieldTypeNames));

        $metadata['fieldTypeIds'] = $fieldTypeIds;
        $metadata['fieldTypeNames'] = $fieldTypeNames;

        $categoriesMap[$categoryName]['subFields'][$sub['name']] = $fields;
        $categoriesMap[$categoryName]['subFieldTypes'][$sub['name']] = $fieldTypeIds;

        $subcategoryFieldTypeIds[$sub['name']] = $fieldTypeIds;
        $subcategoryFieldTypeNames[$sub['name']] = $fieldTypeNames;
        
        // Debug: Log field type IDs for Live Gigs
        if ($sub['name'] === 'Live Gigs') {
            error_log('Live Gigs - field_type_ids from DB: ' . json_encode($sub['field_type_ids'] ?? 'NOT SET'));
            error_log('Live Gigs - resolved fieldTypeIds: ' . json_encode($fieldTypeIds));
            error_log('Live Gigs - metadata fieldTypeIds: ' . json_encode($metadata['fieldTypeIds'] ?? 'NOT SET'));
        }

        $iconHtml = '';
        $iconPath = '';
        if (isset($sub['icon_path']) && is_string($sub['icon_path'])) {
            $iconPath = trim($sub['icon_path']);
            if ($iconPath !== '') {
                $safeIconPath = htmlspecialchars($iconPath, ENT_QUOTES, 'UTF-8');
                $iconHtml = sprintf('<img src="%s" width="20" height="20" alt="">', $safeIconPath);
            }
        }
        if ($iconHtml === '' && isset($metadata['icon']) && is_string($metadata['icon'])) {
            $iconHtml = trim($metadata['icon']);
        }
        if ($iconHtml !== '') {
            $subcategoryIcons[$sub['name']] = $iconHtml;
        }
        if ($iconPath === '' && $iconHtml !== '') {
            $iconPath = extract_icon_src($iconHtml);
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
        if ($markerPath === '' && isset($metadata['marker']) && is_string($metadata['marker'])) {
            $markerPath = trim($metadata['marker']);
        }
        if ($markerPath !== '') {
            $subcategoryMarkers[$sub['name']] = $markerPath;
        }

        if (isset($metadata['markerId']) && is_string($metadata['markerId']) && $metadata['markerId'] !== '') {
            $subcategoryMarkerIds[$sub['name']] = $metadata['markerId'];
        } else {
            $slugForId = slugify_key($sub['name']);
            if ($slugForId !== '') {
                $subcategoryMarkerIds[$sub['name']] = $slugForId;
            }
        }

        if (isset($metadata['categoryShape']) && $metadata['categoryShape'] !== null) {
            $categoryShapes[$categoryName] = $metadata['categoryShape'];
        }
        if (isset($metadata['versionPriceCurrencies']) && is_array($metadata['versionPriceCurrencies'])) {
            foreach ($metadata['versionPriceCurrencies'] as $code) {
                $normalized = strtoupper(trim((string) $code));
                if ($normalized !== '') {
                    $currencySet[$normalized] = true;
                }
            }
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

    $versionPriceCurrencies = array_keys($currencySet);
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
        'categoryShapes' => $categoryShapes,
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
