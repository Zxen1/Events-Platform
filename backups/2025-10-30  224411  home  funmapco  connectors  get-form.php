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

    $fieldBlueprints = loadFieldBlueprints($pdo);

    $categories = fetchCategories($pdo, $categoryColumns);
    $subcategories = fetchSubcategories($pdo, $subcategoryColumns, $categories, $fieldBlueprints);

    $snapshot = buildSnapshot($categories, $subcategories);

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
    $hasCategoryName = in_array('category_name', $columns, true) || in_array('name', $columns, true);
    $hasCategoryKey = in_array('category_key', $columns, true) || in_array('key', $columns, true);

    if (in_array('id', $columns, true)) {
        $selectColumns[] = '`id`';
    }
    if ($hasCategoryName) {
        if (in_array('category_name', $columns, true)) {
            $selectColumns[] = '`category_name` AS `category_name`';
        } elseif (in_array('name', $columns, true)) {
            $selectColumns[] = '`name` AS `category_name`';
        }
    }
    if ($hasCategoryKey) {
        if (in_array('category_key', $columns, true)) {
            $selectColumns[] = '`category_key` AS `category_key`';
        } elseif (in_array('key', $columns, true)) {
            $selectColumns[] = '`key` AS `category_key`';
        }
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
    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM categories' . $orderBy;
    $stmt = $pdo->query($sql);

    $categories = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $categoryName = '';
        if (isset($row['category_name']) && is_string($row['category_name'])) {
            $categoryName = trim($row['category_name']);
        } elseif (isset($row['name']) && is_string($row['name'])) {
            $categoryName = trim($row['name']);
        }

        if ($categoryName === '') {
            continue;
        }

        $categoryKey = '';
        if (isset($row['category_key']) && is_string($row['category_key'])) {
            $categoryKey = trim($row['category_key']);
        } elseif (isset($row['key']) && is_string($row['key'])) {
            $categoryKey = trim($row['key']);
        }
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }

        $metadata = [];
        if ($hasMetadata && isset($row['metadata_json']) && is_string($row['metadata_json']) && $row['metadata_json'] !== '') {
            $decoded = json_decode($row['metadata_json'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }

        $categories[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => $categoryName,
            'key' => $categoryKey,
            'label' => $categoryName,
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'subs' => [],
            'metadata' => $metadata,
            'icon_path' => $hasIconPath && isset($row['icon_path']) && is_string($row['icon_path'])
                ? trim($row['icon_path'])
                : null,
            'mapmarker_path' => $hasMapmarkerPath && isset($row['mapmarker_path']) && is_string($row['mapmarker_path'])
                ? trim($row['mapmarker_path'])
                : null,
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

function fetchSubcategories(PDO $pdo, array $columns, array $categories, array $fieldBlueprints): array
{
    $select = ['s.`id`'];

    $hasCategoryName = in_array('category_name', $columns, true);
    $hasCategoryKey = in_array('category_key', $columns, true);
    $hasCategoryId = in_array('category_id', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasMetadata = in_array('metadata_json', $columns, true);
    $hasIconPath = in_array('icon_path', $columns, true);
    $hasMapmarkerPath = in_array('mapmarker_path', $columns, true);
    $hasSubcategoryName = in_array('subcategory_name', $columns, true) || in_array('name', $columns, true);
    $hasSubcategoryKey = in_array('subcategory_key', $columns, true) || in_array('key', $columns, true);
    $hasFieldTypeId = in_array('field_type_id', $columns, true);

    if ($hasSubcategoryName) {
        if (in_array('subcategory_name', $columns, true)) {
            $select[] = 's.`subcategory_name` AS `subcategory_name`';
        } elseif (in_array('name', $columns, true)) {
            $select[] = 's.`name` AS `subcategory_name`';
        }
    } else {
        $select[] = 's.`subcategory_name` AS `subcategory_name`';
    }

    if ($hasSubcategoryKey) {
        if (in_array('subcategory_key', $columns, true)) {
            $select[] = 's.`subcategory_key` AS `subcategory_key`';
        } elseif (in_array('key', $columns, true)) {
            $select[] = 's.`key` AS `subcategory_key`';
        }
    }

    if ($hasCategoryName) {
        $select[] = 's.`category_name` AS `category_name`';
    }
    if ($hasCategoryKey) {
        $select[] = 's.`category_key` AS `category_key`';
    }
    if ($hasCategoryId) {
        $select[] = 's.`category_id`';
    }
    if (!$hasCategoryName && $hasCategoryId) {
        $select[] = 'c.`category_name` AS category_name';
    }
    if (!$hasCategoryKey && $hasCategoryId) {
        $select[] = 'c.`category_key` AS category_key';
    }
    if ($hasSortOrder) {
        $select[] = 's.`sort_order`';
    }
    if ($hasFieldTypeId) {
        $select[] = 's.`field_type_id`';
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

    $order = [];
    if ($hasCategoryId) {
        $order[] = 's.`category_id` ASC';
    }
    if ($hasCategoryName || !$hasCategoryId) {
        $order[] = 's.`category_name` ASC';
    }
    if ($hasSortOrder) {
        $order[] = 's.`sort_order` ASC';
    }
    $order[] = 's.`subcategory_name` ASC';

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM subcategories s';
    if ((!$hasCategoryName || !$hasCategoryKey) && $hasCategoryId) {
        $sql .= ' JOIN categories c ON c.id = s.category_id';
    }
    $sql .= ' ORDER BY ' . implode(', ', $order);

    $stmt = $pdo->query($sql);

    $categoryById = [];
    $categoryKeyById = [];
    $categoryKeyByName = [];
    foreach ($categories as $category) {
        if (isset($category['name']) && is_string($category['name'])) {
            $categoryKeyByName[$category['name']] = $category['key'] ?? '';
        }
        if ($category['id'] !== null) {
            $categoryById[$category['id']] = $category['name'];
            $categoryKeyById[$category['id']] = $category['key'] ?? '';
        }
    }

    $fieldTypes = $fieldBlueprints['field_types'] ?? [];
    $fieldsets = $fieldBlueprints['fieldsets'] ?? [];
    $fields = $fieldBlueprints['fields'] ?? [];

    $results = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $categoryName = '';
        if (isset($row['category_name']) && is_string($row['category_name'])) {
            $categoryName = trim($row['category_name']);
        }
        if ($categoryName === '' && $hasCategoryId && isset($row['category_id'])) {
            $id = (int) $row['category_id'];
            $categoryName = $categoryById[$id] ?? '';
        }

        $subcategoryName = '';
        if (isset($row['subcategory_name']) && is_string($row['subcategory_name'])) {
            $subcategoryName = trim($row['subcategory_name']);
        }

        if ($categoryName === '' || $subcategoryName === '') {
            continue;
        }

        $categoryKey = '';
        if (isset($row['category_key']) && is_string($row['category_key'])) {
            $categoryKey = trim($row['category_key']);
        } elseif ($hasCategoryId && isset($row['category_id'])) {
            $id = (int) $row['category_id'];
            $categoryKey = $categoryKeyById[$id] ?? '';
        } elseif (isset($categoryKeyByName[$categoryName])) {
            $categoryKey = $categoryKeyByName[$categoryName];
        }
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }

        $subcategoryKey = '';
        if (isset($row['subcategory_key']) && is_string($row['subcategory_key'])) {
            $subcategoryKey = trim($row['subcategory_key']);
        }
        if ($subcategoryKey === '') {
            $subcategoryKey = slugify_key($subcategoryName);
        }

        $metadata = [];
        if ($hasMetadata && isset($row['metadata_json']) && is_string($row['metadata_json']) && $row['metadata_json'] !== '') {
            $decoded = json_decode($row['metadata_json'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }

        $placeholderHints = collectPlaceholderHints($metadata);
        $fieldTypeIds = [];
        if ($hasFieldTypeId && isset($row['field_type_id'])) {
            $fieldTypeIds = parseFieldTypeIds((string) $row['field_type_id']);
        }

        $expandedFields = [];
        if ($fieldTypeIds) {
            $expandedFields = expandFieldTypes($fieldTypeIds, $fieldTypes, $fieldsets, $fields, $placeholderHints, $subcategoryKey);
        }
        if (!$expandedFields && isset($metadata['fields']) && is_array($metadata['fields'])) {
            $expandedFields = normalizeMetadataFields($metadata['fields']);
        }

        $results[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => $subcategoryName,
            'key' => $subcategoryKey,
            'category' => $categoryName,
            'category_key' => $categoryKey,
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'metadata' => $metadata,
            'fields' => $expandedFields,
            'field_type_ids' => $fieldTypeIds,
            'icon_path' => $hasIconPath && isset($row['icon_path']) && is_string($row['icon_path'])
                ? trim($row['icon_path'])
                : null,
            'mapmarker_path' => $hasMapmarkerPath && isset($row['mapmarker_path']) && is_string($row['mapmarker_path'])
                ? trim($row['mapmarker_path'])
                : null,
        ];
    }

    return $results;
}

function buildSnapshot(array $categories, array $subcategories): array
{
    $categoriesMap = [];
    $categoryAliasMap = [];
    $categoryIcons = [];
    $categoryIconsByKey = [];
    $categoryIconPaths = [];
    $categoryIconPathsByKey = [];
    $categoryMarkers = [];
    $categoryMarkersByKey = [];
    $categoryShapes = [];
    $categoryShapesByKey = [];
    $categoryLabelByKey = [];
    $subcategoryIcons = [];
    $subcategoryIconsByKey = [];
    $subcategoryIconPaths = [];
    $subcategoryIconPathsByKey = [];
    $subcategoryMarkers = [];
    $subcategoryMarkersByKey = [];
    $subcategoryMarkerIds = [];
    $subcategoryMarkerIdsByKey = [];
    $subcategoryLabelByKey = [];
    $currencySet = [];

    foreach ($categories as $category) {
        $categoryName = isset($category['name']) && is_string($category['name']) ? $category['name'] : '';
        $categoryName = trim($categoryName);
        if ($categoryName === '') {
            continue;
        }

        $categoryKey = isset($category['key']) && is_string($category['key']) ? trim($category['key']) : '';
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }

        $primaryKey = $categoryKey !== '' ? $categoryKey : ($categoryName !== '' ? slugify_key($categoryName) : '');
        if ($primaryKey === '') {
            $primaryKey = 'category_' . md5($categoryName);
        }

        if (!isset($categoriesMap[$primaryKey])) {
            $categoriesMap[$primaryKey] = [
                'id' => $category['id'] ?? null,
                'name' => $categoryName,
                'label' => $category['label'] ?? $categoryName,
                'key' => $categoryKey,
                'sort_order' => $category['sort_order'] ?? null,
                'subs' => [],
                'subsDetailed' => [],
                'subFields' => [],
                'subFieldsByKey' => [],
                'subIds' => [],
                'subIdsByKey' => [],
                'subKeyLookup' => [],
                'subLabelByKey' => [],
                'fieldTypeIds' => [],
                'fieldTypeIdsByKey' => [],
                'subsMeta' => [],
            ];
        } else {
            if (!isset($categoriesMap[$primaryKey]['name']) || $categoriesMap[$primaryKey]['name'] === '') {
                $categoriesMap[$primaryKey]['name'] = $categoryName;
            }
            if (!isset($categoriesMap[$primaryKey]['label']) || $categoriesMap[$primaryKey]['label'] === '') {
                $categoriesMap[$primaryKey]['label'] = $category['label'] ?? $categoryName;
            }
            if ((!isset($categoriesMap[$primaryKey]['key']) || $categoriesMap[$primaryKey]['key'] === '') && $categoryKey !== '') {
                $categoriesMap[$primaryKey]['key'] = $categoryKey;
            }
            if (!isset($categoriesMap[$primaryKey]['id']) || $categoriesMap[$primaryKey]['id'] === null) {
                $categoriesMap[$primaryKey]['id'] = $category['id'] ?? null;
            }
        }

        $categoryAliasMap[$categoryName] = $primaryKey;
        if ($categoryKey !== '') {
            $categoryAliasMap[$categoryKey] = $primaryKey;
            $categoryLabelByKey[$categoryKey] = $categoryName;
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
            if ($categoryKey !== '') {
                $categoryIconsByKey[$categoryKey] = $iconHtml;
            }
        }
        if ($iconPath === '' && $iconHtml !== '') {
            $iconPath = extract_icon_src($iconHtml);
        }
        if ($iconPath !== '') {
            $categoryIconPaths[$categoryName] = $iconPath;
            if ($categoryKey !== '') {
                $categoryIconPathsByKey[$categoryKey] = $iconPath;
            }
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
            if ($categoryKey !== '') {
                $categoryMarkersByKey[$categoryKey] = $markerPath;
            }
        }

        if (isset($metadata['categoryShape']) && $metadata['categoryShape'] !== null) {
            $categoryShapes[$categoryName] = $metadata['categoryShape'];
            if ($categoryKey !== '') {
                $categoryShapesByKey[$categoryKey] = $metadata['categoryShape'];
            }
        }
    }

    foreach ($subcategories as $sub) {
        $categoryName = isset($sub['category']) && is_string($sub['category']) ? trim($sub['category']) : '';
        $categoryKey = isset($sub['category_key']) && is_string($sub['category_key']) ? trim($sub['category_key']) : '';
        $subcategoryName = isset($sub['name']) && is_string($sub['name']) ? trim($sub['name']) : '';
        $subcategoryKey = isset($sub['key']) && is_string($sub['key']) ? trim($sub['key']) : '';

        if ($categoryName === '' || $subcategoryName === '') {
            continue;
        }

        if ($subcategoryKey === '') {
            $subcategoryKey = slugify_key($subcategoryName);
        }
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }

        $primaryKey = $categoryAliasMap[$categoryKey] ?? $categoryAliasMap[$categoryName] ?? $categoryKey;
        if (!isset($categoriesMap[$primaryKey])) {
            $categoriesMap[$primaryKey] = [
                'id' => $sub['category_id'] ?? null,
                'name' => $categoryName,
                'label' => $categoryName,
                'key' => $categoryKey,
                'sort_order' => null,
                'subs' => [],
                'subsDetailed' => [],
                'subFields' => [],
                'subFieldsByKey' => [],
                'subIds' => [],
                'subIdsByKey' => [],
                'subKeyLookup' => [],
                'subLabelByKey' => [],
                'fieldTypeIds' => [],
                'fieldTypeIdsByKey' => [],
                'subsMeta' => [],
            ];
            $categoryAliasMap[$categoryName] = $primaryKey;
            if ($categoryKey !== '') {
                $categoryAliasMap[$categoryKey] = $primaryKey;
                $categoryLabelByKey[$categoryKey] = $categoryName;
            }
        } else {
            if ($categoryKey !== '' && (!isset($categoriesMap[$primaryKey]['key']) || $categoriesMap[$primaryKey]['key'] === '')) {
                $categoriesMap[$primaryKey]['key'] = $categoryKey;
            }
            if (!isset($categoriesMap[$primaryKey]['name']) || $categoriesMap[$primaryKey]['name'] === '') {
                $categoriesMap[$primaryKey]['name'] = $categoryName;
            }
            if (!isset($categoriesMap[$primaryKey]['label']) || $categoriesMap[$primaryKey]['label'] === '') {
                $categoriesMap[$primaryKey]['label'] = $categoryName;
            }
        }

        if ($categoryKey !== '') {
            $categoryLabelByKey[$categoryKey] = $categoryName;
        }

        $categoriesMap[$primaryKey]['subsMeta'][] = [
            'name' => $subcategoryName,
            'key' => $subcategoryKey,
            'id' => $sub['id'] ?? null,
            'sort_order' => $sub['sort_order'] ?? null,
        ];
        $categoriesMap[$primaryKey]['subIds'][$subcategoryName] = $sub['id'] ?? null;
        $categoriesMap[$primaryKey]['fieldTypeIds'][$subcategoryName] = $sub['field_type_ids'] ?? [];

        if ($subcategoryKey !== '') {
            $categoriesMap[$primaryKey]['subIdsByKey'][$subcategoryKey] = $sub['id'] ?? null;
            $categoriesMap[$primaryKey]['fieldTypeIdsByKey'][$subcategoryKey] = $sub['field_type_ids'] ?? [];
            $categoriesMap[$primaryKey]['subKeyLookup'][$subcategoryName] = $subcategoryKey;
            $categoriesMap[$primaryKey]['subLabelByKey'][$subcategoryKey] = $subcategoryName;
            if ($categoryKey !== '') {
                if (!isset($subcategoryLabelByKey[$categoryKey])) {
                    $subcategoryLabelByKey[$categoryKey] = [];
                }
                $subcategoryLabelByKey[$categoryKey][$subcategoryKey] = $subcategoryName;
            }
        }

        $metadata = isset($sub['metadata']) && is_array($sub['metadata']) ? $sub['metadata'] : [];

        $fields = [];
        if (isset($sub['fields']) && is_array($sub['fields'])) {
            $fields = $sub['fields'];
        } elseif (isset($metadata['fields']) && is_array($metadata['fields'])) {
            $fields = normalizeMetadataFields($metadata['fields']);
        }
        $categoriesMap[$primaryKey]['subFields'][$subcategoryName] = $fields;
        if ($subcategoryKey !== '') {
            $categoriesMap[$primaryKey]['subFieldsByKey'][$subcategoryKey] = $fields;
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
            $subcategoryIcons[$subcategoryName] = $iconHtml;
            if ($subcategoryKey !== '') {
                $subcategoryIconsByKey[$subcategoryKey] = $iconHtml;
            }
        }
        if ($iconPath === '' && $iconHtml !== '') {
            $iconPath = extract_icon_src($iconHtml);
        }
        if ($iconPath !== '') {
            $subcategoryIconPaths[$subcategoryName] = $iconPath;
            if ($subcategoryKey !== '') {
                $subcategoryIconPathsByKey[$subcategoryKey] = $iconPath;
            }
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
            $subcategoryMarkers[$subcategoryName] = $markerPath;
            if ($subcategoryKey !== '') {
                $subcategoryMarkersByKey[$subcategoryKey] = $markerPath;
            }
        }

        $markerId = null;
        if (isset($metadata['markerId']) && is_string($metadata['markerId']) && $metadata['markerId'] !== '') {
            $markerId = trim($metadata['markerId']);
        }
        if ($markerId === null) {
            $markerId = slugify_key($subcategoryKey !== '' ? $subcategoryKey : $subcategoryName);
        }
        if ($markerId !== '') {
            $subcategoryMarkerIds[$subcategoryName] = $markerId;
            if ($subcategoryKey !== '') {
                $subcategoryMarkerIdsByKey[$subcategoryKey] = $markerId;
            }
        }

        if (isset($metadata['categoryShape']) && $metadata['categoryShape'] !== null) {
            $categoryShapes[$categoryName] = $metadata['categoryShape'];
            if ($categoryKey !== '') {
                $categoryShapesByKey[$categoryKey] = $metadata['categoryShape'];
            }
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

    foreach ($categoriesMap as $primaryKey => &$category) {
        if (!isset($category['subFields']) || !is_array($category['subFields'])) {
            $category['subFields'] = [];
        }
        if (!isset($category['subFieldsByKey']) || !is_array($category['subFieldsByKey'])) {
            $category['subFieldsByKey'] = [];
        }
        if (!isset($category['subIds']) || !is_array($category['subIds'])) {
            $category['subIds'] = [];
        }
        if (!isset($category['subIdsByKey']) || !is_array($category['subIdsByKey'])) {
            $category['subIdsByKey'] = [];
        }
        if (!isset($category['subKeyLookup']) || !is_array($category['subKeyLookup'])) {
            $category['subKeyLookup'] = [];
        }
        if (!isset($category['subLabelByKey']) || !is_array($category['subLabelByKey'])) {
            $category['subLabelByKey'] = [];
        }
        if (!isset($category['fieldTypeIds']) || !is_array($category['fieldTypeIds'])) {
            $category['fieldTypeIds'] = [];
        }
        if (!isset($category['fieldTypeIdsByKey']) || !is_array($category['fieldTypeIdsByKey'])) {
            $category['fieldTypeIdsByKey'] = [];
        }

        $subsMeta = isset($category['subsMeta']) && is_array($category['subsMeta']) ? $category['subsMeta'] : [];
        usort($subsMeta, static function (array $a, array $b): int {
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

        $category['subs'] = [];
        $category['subsDetailed'] = [];
        foreach ($subsMeta as $entry) {
            $name = $entry['name'];
            $key = $entry['key'];
            $category['subs'][] = $name;
            $category['subsDetailed'][] = [
                'name' => $name,
                'key' => $key,
                'id' => $entry['id'],
            ];
            if (!isset($category['subFields'][$name]) || !is_array($category['subFields'][$name])) {
                $category['subFields'][$name] = [];
            }
            if ($key !== '') {
                if (!isset($category['subFieldsByKey'][$key]) || !is_array($category['subFieldsByKey'][$key])) {
                    $category['subFieldsByKey'][$key] = $category['subFields'][$name];
                }
                if (!isset($category['subIdsByKey'][$key])) {
                    $category['subIdsByKey'][$key] = $category['subIds'][$name] ?? null;
                }
                $category['subKeyLookup'][$name] = $key;
                $category['subLabelByKey'][$key] = $name;
            }
        }

        unset($category['subsMeta']);
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
    $sanitizedCategoryMarkersByKey = sanitizeSubcategoryMarkers($categoryMarkersByKey, true);
    $sanitizedSubcategoryMarkers = sanitizeSubcategoryMarkers($subcategoryMarkers);
    $sanitizedSubcategoryMarkersByKey = sanitizeSubcategoryMarkers($subcategoryMarkersByKey, true);

    $iconLibrary = collectSnapshotIconLibrary(
        array_values($categoryIconPaths),
        array_values($subcategoryIconPaths),
        array_values($categoryIconPathsByKey),
        array_values($subcategoryIconPathsByKey),
        array_values($sanitizedCategoryMarkers),
        array_values($sanitizedSubcategoryMarkers),
        array_values($sanitizedCategoryMarkersByKey),
        array_values($sanitizedSubcategoryMarkersByKey)
    );

    $filesystemIcons = collectFilesystemIconLibrary('assets/icons-30');
    if ($filesystemIcons) {
        $iconLibrary = mergeIconLibraries($iconLibrary, $filesystemIcons);
    }

    return [
        'categories' => $categoriesList,
        'categoryIcons' => $categoryIcons,
        'categoryIconsByKey' => $categoryIconsByKey,
        'categoryIconPaths' => $categoryIconPaths,
        'categoryIconPathsByKey' => $categoryIconPathsByKey,
        'categoryMarkers' => $sanitizedCategoryMarkers,
        'categoryMarkersByKey' => $sanitizedCategoryMarkersByKey,
        'subcategoryIcons' => $subcategoryIcons,
        'subcategoryIconsByKey' => $subcategoryIconsByKey,
        'subcategoryIconPaths' => $subcategoryIconPaths,
        'subcategoryIconPathsByKey' => $subcategoryIconPathsByKey,
        'subcategoryMarkers' => $sanitizedSubcategoryMarkers,
        'subcategoryMarkersByKey' => $sanitizedSubcategoryMarkersByKey,
        'subcategoryMarkerIds' => $subcategoryMarkerIds,
        'subcategoryMarkerIdsByKey' => $subcategoryMarkerIdsByKey,
        'categoryShapes' => $categoryShapes,
        'categoryShapesByKey' => $categoryShapesByKey,
        'versionPriceCurrencies' => $versionPriceCurrencies,
        'iconLibrary' => array_values($iconLibrary),
        'categoryLabelByKey' => $categoryLabelByKey,
        'subcategoryLabelByKey' => $subcategoryLabelByKey,
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

function sanitizeSubcategoryMarkers(array $markers, bool $allowRawKey = false): array
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

        $identifier = is_string($name) ? trim((string) $name) : '';
        if ($identifier === '') {
            continue;
        }

        if ($allowRawKey && preg_match('/^[a-z0-9_-]+$/i', $identifier)) {
            $key = strtolower($identifier);
        } else {
            $key = slugify_key($identifier);
        }

        if ($key === '') {
            continue;
        }

        $clean[$key] = $trimmed;
    }

    return $clean;
}

function loadFieldBlueprints(PDO $pdo): array
{
    $blueprints = [
        'fields' => [],
        'fieldsets' => [],
        'field_types' => [],
    ];

    try {
        $fieldsStmt = $pdo->query('SELECT id, field_key, type, required, options_json FROM fields');
        while ($row = $fieldsStmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['id'])) {
                continue;
            }

            $id = (int) $row['id'];
            $fieldKey = isset($row['field_key']) ? trim((string) $row['field_key']) : '';
            $blueprints['fields'][$id] = [
                'id' => $id,
                'field_key' => $fieldKey,
                'type' => isset($row['type']) ? trim((string) $row['type']) : '',
                'required' => isset($row['required']) ? ((int) $row['required'] === 1) : false,
                'options' => normalizeFieldOptions($row['options_json'] ?? null),
            ];
        }
    } catch (Throwable $e) {
        logConnectorWarning('Unable to load fields metadata: ' . $e->getMessage());
    }

    try {
        $fieldsetStmt = $pdo->query('SELECT id, fieldset_key, field_id FROM fieldsets');
        while ($row = $fieldsetStmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['id'])) {
                continue;
            }

            $id = (int) $row['id'];
            $fieldIds = parseIntegerList($row['field_id'] ?? '', 'fieldsets.field_id', false);
            $blueprints['fieldsets'][$id] = [
                'id' => $id,
                'fieldset_key' => isset($row['fieldset_key']) ? trim((string) $row['fieldset_key']) : '',
                'field_ids' => $fieldIds,
            ];
        }
    } catch (Throwable $e) {
        logConnectorWarning('Unable to load fieldsets metadata: ' . $e->getMessage());
    }

    try {
        $typeStmt = $pdo->query('SELECT id, field_type_name, field_type_key, field_type_item_1, field_type_item_2, field_type_item_3, field_type_item_4, field_type_item_5 FROM field_types');
        while ($row = $typeStmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['id'])) {
                continue;
            }

            $id = (int) $row['id'];
            $items = [];
            for ($i = 1; $i <= 5; $i++) {
                $column = 'field_type_item_' . $i;
                if (!array_key_exists($column, $row)) {
                    continue;
                }
                $parsed = parseFieldTypeItem($row[$column]);
                if ($parsed !== null) {
                    $items[] = $parsed;
                }
            }

            $blueprints['field_types'][$id] = [
                'id' => $id,
                'field_type_name' => isset($row['field_type_name']) ? trim((string) $row['field_type_name']) : '',
                'field_type_key' => isset($row['field_type_key']) ? trim((string) $row['field_type_key']) : '',
                'items' => $items,
            ];
        }
    } catch (Throwable $e) {
        logConnectorWarning('Unable to load field_types metadata: ' . $e->getMessage());
    }

    return $blueprints;
}

function parseFieldTypeIds(string $csv): array
{
    return parseIntegerList($csv, 'field_type_id');
}

function parseIntegerList($value, string $context, bool $logWarnings = true): array
{
    if (!is_string($value)) {
        return [];
    }

    $cleaned = trim($value);
    if ($cleaned === '') {
        return [];
    }

    $cleaned = trim($cleaned, "[]");
    $parts = preg_split('/[\s,]+/', $cleaned);
    if (!is_array($parts)) {
        return [];
    }

    $ids = [];
    foreach ($parts as $part) {
        $candidate = trim($part);
        $candidate = trim($candidate, "'\"");
        if ($candidate === '') {
            continue;
        }
        if (!preg_match('/^-?\d+$/', $candidate)) {
            if ($logWarnings) {
                logConnectorWarning("Ignoring non-numeric {$context} value '{$candidate}'");
            }
            continue;
        }

        $ids[] = (int) $candidate;
    }

    return array_values(array_unique($ids));
}

function parseFieldTypeItem($value): ?array
{
    if (!is_string($value)) {
        return null;
    }

    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }

    if (!preg_match('/\[(field|fieldset)\s*=\s*(\d+)\]/i', $trimmed, $matches)) {
        return null;
    }

    $kind = strtolower($matches[1]);
    $id = (int) $matches[2];
    $label = trim(preg_replace('/\[[^\]]+\]/', '', $trimmed));
    if ($label === '') {
        $label = $kind === 'fieldset' ? 'Fieldset ' . $id : 'Field ' . $id;
    }

    return [
        'kind' => $kind,
        'id' => $id,
        'label' => $label,
    ];
}

function expandFieldTypes(
    array $fieldTypeIds,
    array $fieldTypes,
    array $fieldsets,
    array $fields,
    array $placeholderHints,
    string $subcategoryKey
): array {
    $expanded = [];

    foreach ($fieldTypeIds as $fieldTypeId) {
        if (!isset($fieldTypes[$fieldTypeId])) {
            logConnectorWarning("Unknown field_type_id {$fieldTypeId} encountered for subcategory '{$subcategoryKey}'");
            continue;
        }

        $fieldType = $fieldTypes[$fieldTypeId];
        $items = $fieldType['items'] ?? [];
        if (!$items) {
            logConnectorWarning("Field type {$fieldTypeId} has no items defined");
            continue;
        }

        foreach ($items as $item) {
            if (!is_array($item) || !isset($item['kind'], $item['id'])) {
                continue;
            }

            if ($item['kind'] === 'field') {
                $fieldId = (int) $item['id'];
                if (!isset($fields[$fieldId])) {
                    logConnectorWarning("Missing field {$fieldId} referenced by field type {$fieldTypeId}");
                    continue;
                }

                $definition = normalizeFieldDefinition($fields[$fieldId], $fieldType, $item, $placeholderHints, null);
                if ($definition !== null) {
                    $expanded[] = $definition;
                }
                continue;
            }

            if ($item['kind'] === 'fieldset') {
                $fieldsetId = (int) $item['id'];
                if (!isset($fieldsets[$fieldsetId])) {
                    logConnectorWarning("Missing fieldset {$fieldsetId} referenced by field type {$fieldTypeId}");
                    continue;
                }
                $fieldset = $fieldsets[$fieldsetId];
                $fieldIds = $fieldset['field_ids'] ?? [];
                foreach ($fieldIds as $fieldId) {
                    if (!isset($fields[$fieldId])) {
                        logConnectorWarning("Missing field {$fieldId} inside fieldset {$fieldsetId} referenced by field type {$fieldTypeId}");
                        continue;
                    }

                    $definition = normalizeFieldDefinition($fields[$fieldId], $fieldType, $item, $placeholderHints, $fieldset);
                    if ($definition !== null) {
                        $expanded[] = $definition;
                    }
                }
            }
        }
    }

    return $expanded;
}

function collectPlaceholderHints(array $metadata): array
{
    $hints = [];
    if (!isset($metadata['fields']) || !is_array($metadata['fields'])) {
        return $hints;
    }

    foreach ($metadata['fields'] as $field) {
        if (!is_array($field)) {
            continue;
        }
        $placeholder = isset($field['placeholder']) && is_string($field['placeholder'])
            ? trim($field['placeholder'])
            : '';
        if ($placeholder === '') {
            continue;
        }

        $candidates = [];
        if (isset($field['type']) && is_string($field['type'])) {
            $candidates[] = strtolower(trim($field['type']));
        }
        if (isset($field['key']) && is_string($field['key'])) {
            $candidates[] = strtolower(trim($field['key']));
        }
        if (isset($field['name']) && is_string($field['name'])) {
            $candidates[] = slugify_key($field['name']);
        }

        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }
            if (!isset($hints[$candidate])) {
                $hints[$candidate] = $placeholder;
            }
        }
    }

    return $hints;
}

function normalizeMetadataFields(array $fields): array
{
    $normalized = [];
    foreach ($fields as $field) {
        if (!is_array($field)) {
            continue;
        }

        $options = [];
        if (isset($field['options']) && is_array($field['options'])) {
            $mapped = array_map(static function ($option) {
                return is_string($option) ? trim($option) : null;
            }, $field['options']);
            $options = array_values(array_filter($mapped, static function ($value) {
                return $value !== null && $value !== '';
            }));
        }

        $normalized[] = [
            'name' => isset($field['name']) ? (string) $field['name'] : '',
            'type' => isset($field['type']) ? (string) $field['type'] : '',
            'placeholder' => isset($field['placeholder']) ? (string) $field['placeholder'] : '',
            'required' => isset($field['required']) ? (bool) $field['required'] : false,
            'options' => $options,
        ];
    }

    return $normalized;
}

function normalizeFieldDefinition(array $fieldRow, array $fieldType, array $item, array $placeholderHints, ?array $fieldset = null): ?array
{
    $fieldKey = isset($fieldRow['field_key']) ? trim((string) $fieldRow['field_key']) : '';
    $fieldTypeKey = isset($fieldType['field_type_key']) ? trim((string) $fieldType['field_type_key']) : '';
    $fieldTypeName = isset($fieldType['field_type_name']) ? trim((string) $fieldType['field_type_name']) : '';
    $labelSource = isset($item['label']) ? (string) $item['label'] : ($fieldTypeName !== '' ? $fieldTypeName : $fieldKey);
    $label = humanizeLabel($labelSource);

    $placeholder = '';
    $placeholderKeys = [];
    if ($fieldTypeKey !== '') {
        $placeholderKeys[] = strtolower($fieldTypeKey);
    }
    if ($fieldKey !== '') {
        $placeholderKeys[] = strtolower($fieldKey);
    }
    if (isset($item['label']) && is_string($item['label'])) {
        $placeholderKeys[] = slugify_key($item['label']);
    }
    if ($fieldset && isset($fieldset['fieldset_key'])) {
        $placeholderKeys[] = strtolower(trim((string) $fieldset['fieldset_key']));
    }

    foreach ($placeholderKeys as $candidate) {
        if ($candidate !== '' && isset($placeholderHints[$candidate])) {
            $placeholder = $placeholderHints[$candidate];
            break;
        }
    }

    $options = $fieldRow['options'] ?? [];
    if (!is_array($options)) {
        $options = [];
    }

    return [
        'id' => $fieldRow['id'] ?? null,
        'fieldKey' => $fieldKey,
        'fieldsetId' => $fieldset['id'] ?? null,
        'fieldsetKey' => $fieldset['fieldset_key'] ?? null,
        'fieldTypeId' => $fieldType['id'] ?? null,
        'fieldTypeKey' => $fieldTypeKey,
        'fieldTypeName' => $fieldTypeName,
        'label' => $label,
        'name' => $label,
        'type' => $fieldTypeKey !== '' ? $fieldTypeKey : $fieldKey,
        'inputType' => isset($fieldRow['type']) ? trim((string) $fieldRow['type']) : '',
        'required' => (bool) ($fieldRow['required'] ?? false),
        'options' => $options,
        'placeholder' => $placeholder,
    ];
}

function normalizeFieldOptions($raw): array
{
    if (is_string($raw)) {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return [];
        }

        $decoded = json_decode($trimmed, true);
        if (is_array($decoded)) {
            if (isset($decoded['options']) && is_array($decoded['options'])) {
                $decoded = $decoded['options'];
            }
            $mapped = array_map(static function ($value) {
                return is_string($value) ? trim($value) : null;
            }, $decoded);
            return array_values(array_filter($mapped, static function ($value) {
                return $value !== null && $value !== '';
            }));
        }
    } elseif (is_array($raw)) {
        $mapped = array_map(static function ($value) {
            return is_string($value) ? trim($value) : null;
        }, $raw);
        return array_values(array_filter($mapped, static function ($value) {
            return $value !== null && $value !== '';
        }));
    }

    return [];
}

function humanizeLabel(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    $normalized = str_replace(['_', '-'], ' ', $trimmed);
    $normalized = preg_replace('/\s+/', ' ', $normalized);

    return ucwords(strtolower($normalized));
}

function logConnectorWarning(string $message): void
{
    static $logged = [];
    if (isset($logged[$message])) {
        return;
    }
    $logged[$message] = true;
    error_log('[get-form] ' . $message);
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
