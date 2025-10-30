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

    $fieldBlueprints = fetchFieldBlueprints($pdo);

    $categories = fetchCategories($pdo, $categoryColumns);
    $subcategories = fetchSubcategories($pdo, $subcategoryColumns, $categories);

    $snapshot = buildSnapshot($categories, $subcategories, $fieldBlueprints);

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

function fetchFieldBlueprints(PDO $pdo): array
{
    $result = [
        'fields' => [],
        'fieldsets' => [],
        'field_types' => [],
    ];

    try {
        $fieldColumns = fetchTableColumns($pdo, 'fields');
        if ($fieldColumns && in_array('id', $fieldColumns, true)) {
            $select = [];
            foreach ($fieldColumns as $column) {
                $select[] = '`' . str_replace('`', '``', $column) . '`';
            }
            $stmt = $pdo->query('SELECT ' . implode(', ', $select) . ' FROM fields');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!isset($row['id'])) {
                    continue;
                }
                $result['fields'][(int) $row['id']] = $row;
            }
        }
    } catch (PDOException $e) {
        // ignored; field definitions are optional
    }

    try {
        $fieldsetColumns = fetchTableColumns($pdo, 'fieldsets');
        if ($fieldsetColumns && in_array('id', $fieldsetColumns, true)) {
            $select = [];
            foreach ($fieldsetColumns as $column) {
                $select[] = '`' . str_replace('`', '``', $column) . '`';
            }
            $stmt = $pdo->query('SELECT ' . implode(', ', $select) . ' FROM fieldsets');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!isset($row['id'])) {
                    continue;
                }
                $result['fieldsets'][(int) $row['id']] = $row;
            }
        }
    } catch (PDOException $e) {
        // ignored; fieldsets optional
    }

    try {
        $typeColumns = fetchTableColumns($pdo, 'field_types');
        if ($typeColumns && in_array('id', $typeColumns, true)) {
            $select = [];
            foreach ($typeColumns as $column) {
                $select[] = '`' . str_replace('`', '``', $column) . '`';
            }
            $stmt = $pdo->query('SELECT ' . implode(', ', $select) . ' FROM field_types');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!isset($row['id'])) {
                    continue;
                }
                $result['field_types'][(int) $row['id']] = $row;
            }
        }
    } catch (PDOException $e) {
        // ignored; field type metadata optional
    }

    return $result;
}

function fetchCategories(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    $orderBy = '';

    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasMetadata = in_array('metadata_json', $columns, true);
    $hasIconPath = in_array('icon_path', $columns, true);
    $hasMapmarkerPath = in_array('mapmarker_path', $columns, true);
    $hasCategoryKey = in_array('category_key', $columns, true);

    if (in_array('id', $columns, true)) {
        $selectColumns[] = '`id`';
    }
    $hasLegacyName = in_array('name', $columns, true);
    $hasCategoryNameColumn = in_array('category_name', $columns, true);
    if ($hasLegacyName) {
        $selectColumns[] = '`name`';
    } elseif ($hasCategoryNameColumn) {
        $selectColumns[] = '`category_name` AS `name`';
    }
    if ($hasSortOrder) {
        $selectColumns[] = '`sort_order`';
        $orderBy = ' ORDER BY `sort_order` ASC';
    }
    if ($hasCategoryKey) {
        $selectColumns[] = '`category_key`';
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
        if (!isset($row['name'])) {
            continue;
        }

        $metadata = [];
        if ($hasMetadata && isset($row['metadata_json']) && is_string($row['metadata_json']) && $row['metadata_json'] !== '') {
            $decoded = json_decode($row['metadata_json'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }

        $key = '';
        if ($hasCategoryKey && isset($row['category_key']) && is_string($row['category_key'])) {
            $key = trim($row['category_key']);
        }
        if ($key === '') {
            $key = slugify_key($row['name']);
        }

        $categories[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'key' => $key,
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

function fetchSubcategories(PDO $pdo, array $columns, array $categories): array
{
    $hasLegacySubName = in_array('name', $columns, true);
    $hasSubcategoryNameColumn = in_array('subcategory_name', $columns, true);

    $select = ['s.`id`'];
    if ($hasLegacySubName) {
        $select[] = 's.`name`';
    } elseif ($hasSubcategoryNameColumn) {
        $select[] = 's.`subcategory_name` AS `name`';
    }

    $hasCategoryName = in_array('category_name', $columns, true);
    $hasCategoryId = in_array('category_id', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasMetadata = in_array('metadata_json', $columns, true);
    $hasIconPath = in_array('icon_path', $columns, true);
    $hasMapmarkerPath = in_array('mapmarker_path', $columns, true);
    $hasSubcategoryKey = in_array('subcategory_key', $columns, true);
    $hasFieldTypeId = in_array('field_type_id', $columns, true);
    $hasFieldTypeName = in_array('field_type_name', $columns, true);

    if ($hasCategoryName) {
        $select[] = 's.`category_name`';
    }
    if ($hasCategoryId) {
        $select[] = 's.`category_id`';
    }
    if ($hasSubcategoryKey) {
        $select[] = 's.`subcategory_key`';
    }
    if ($hasFieldTypeId) {
        $select[] = 's.`field_type_id`';
    }
    if ($hasFieldTypeName) {
        $select[] = 's.`field_type_name`';
    }
    if (!$hasCategoryName && $hasCategoryId) {
        $select[] = 'c.`category_name` AS category_name';
        $select[] = 'c.`category_key` AS category_key';
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
    if ($hasLegacySubName) {
        $order[] = 's.`name` ASC';
    } elseif ($hasSubcategoryNameColumn) {
        $order[] = 's.`subcategory_name` ASC';
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM subcategories s';
    if (!$hasCategoryName && $hasCategoryId) {
        $sql .= ' JOIN categories c ON c.id = s.category_id';
    }
    $sql .= ' ORDER BY ' . implode(', ', $order);

    $stmt = $pdo->query($sql);

    $categoryById = [];
    foreach ($categories as $category) {
        if ($category['id'] !== null) {
            $categoryById[$category['id']] = [
                'name' => $category['name'],
                'key' => $category['key'] ?? slugify_key($category['name']),
            ];
        }
    }

    $results = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $categoryName = null;
        $categoryKey = '';
        if (isset($row['category_name'])) {
            $categoryName = (string) $row['category_name'];
        }
        if ($hasCategoryId && isset($row['category_id'])) {
            $id = (int) $row['category_id'];
            if (isset($categoryById[$id])) {
                $categoryName = $categoryName ?? $categoryById[$id]['name'];
                $categoryKey = $categoryById[$id]['key'] ?? $categoryKey;
            }
        }
        if (isset($row['category_key']) && is_string($row['category_key']) && trim($row['category_key']) !== '') {
            $categoryKey = trim($row['category_key']);
        }
        if ($categoryKey === '' && $categoryName !== null) {
            $categoryKey = slugify_key($categoryName);
        }

        if (!$categoryName || !isset($row['name'])) {
            continue;
        }
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }

        $subKey = '';
        if ($hasSubcategoryKey && isset($row['subcategory_key']) && is_string($row['subcategory_key'])) {
            $subKey = trim($row['subcategory_key']);
        }
        if ($subKey === '') {
            $subKey = slugify_key((string) $row['name']);
        }

        $fieldTypeIds = [];
        if ($hasFieldTypeId && isset($row['field_type_id']) && is_string($row['field_type_id'])) {
            $parts = preg_split('/\s*,\s*/', trim($row['field_type_id']));
            if (is_array($parts)) {
                foreach ($parts as $part) {
                    if ($part === '') {
                        continue;
                    }
                    if (preg_match('/^\d+$/', $part)) {
                        $fieldTypeIds[] = (int) $part;
                    }
                }
            }
        }
        $fieldTypeNames = [];
        if ($hasFieldTypeName && isset($row['field_type_name']) && is_string($row['field_type_name'])) {
            $fieldTypeNames = array_values(array_filter(array_map('trim', explode(',', $row['field_type_name'])), static function ($value) {
                return $value !== '';
            }));
        }
        $metadata = [];
        if ($hasMetadata && isset($row['metadata_json']) && is_string($row['metadata_json']) && $row['metadata_json'] !== '') {
            $decoded = json_decode($row['metadata_json'], true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }
        $results[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'category' => $categoryName,
            'category_key' => $categoryKey,
            'key' => $subKey,
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'metadata' => $metadata,
            'field_type_ids' => $fieldTypeIds,
            'field_type_names' => $fieldTypeNames,
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

function buildSnapshot(array $categories, array $subcategories, array $fieldBlueprints = []): array
{
    $fieldTypeCatalog = buildFieldTypeCatalog($fieldBlueprints);
    $categoriesMap = [];
    $categoryIcons = [];
    $categoryIconPaths = [];
    $categoryMarkers = [];
    $subcategoryIconPaths = [];
    $categoryAliases = [];
    foreach ($categories as $category) {
        $categoryName = $category['name'];
        $categoryKey = isset($category['key']) && is_string($category['key'])
            ? trim($category['key'])
            : '';
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }
        if ($categoryKey === '') {
            $categoryKey = $categoryName;
        }

        $categoriesMap[$categoryKey] = [
            'id' => $category['id'] ?? null,
            'name' => $categoryName,
            'key' => $categoryKey,
            'subs' => [],
            'subFields' => [],
            'subFieldTypes' => [],
            'subAliases' => [],
            'sort_order' => $category['sort_order'] ?? null,
            'subIds' => [],
        ];
        $categoryAliases[$categoryName] = $categoryKey;
        if ($categoryKey !== $categoryName) {
            $categoryAliases[$categoryKey] = $categoryKey;
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
            $categoryIcons[$categoryKey] = $iconHtml;
            if ($categoryKey !== $categoryName) {
                $categoryIcons[$categoryName] = $iconHtml;
            }
        }
        if ($iconPath === '' && $iconHtml !== '') {
            $iconPath = extract_icon_src($iconHtml);
        }
        if ($iconPath !== '') {
            $categoryIconPaths[$categoryKey] = $iconPath;
            if ($categoryKey !== $categoryName) {
                $categoryIconPaths[$categoryName] = $iconPath;
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
            $categoryMarkers[$categoryKey] = $markerPath;
            if ($categoryKey !== $categoryName) {
                $categoryMarkers[$categoryName] = $markerPath;
            }
        }
    }

    $categoryShapes = [];
    $subcategoryIcons = [];
    $subcategoryMarkers = [];
    $subcategoryMarkerIds = [];
    $currencySet = [];

    foreach ($subcategories as $sub) {
        $categoryName = $sub['category'];
        $categoryKey = isset($sub['category_key']) && is_string($sub['category_key'])
            ? trim($sub['category_key'])
            : '';
        if ($categoryKey === '' && isset($categoryAliases[$categoryName])) {
            $categoryKey = $categoryAliases[$categoryName];
        }
        if ($categoryKey === '') {
            $categoryKey = slugify_key($categoryName);
        }
        if ($categoryKey === '') {
            $categoryKey = $categoryName;
        }
        if (!isset($categoriesMap[$categoryKey])) {
            $categoriesMap[$categoryKey] = [
                'id' => null,
                'name' => $categoryName,
                'key' => $categoryKey,
                'subs' => [],
                'subFields' => [],
                'subFieldTypes' => [],
                'subAliases' => [],
                'sort_order' => null,
                'subIds' => [],
            ];
            $categoryAliases[$categoryName] = $categoryKey;
            if ($categoryKey !== $categoryName) {
                $categoryAliases[$categoryKey] = $categoryKey;
            }
        }

        $subName = $sub['name'];
        $subKey = isset($sub['key']) && is_string($sub['key']) ? trim($sub['key']) : '';
        if ($subKey === '') {
            $subKey = slugify_key($subName);
        }
        if ($subKey === '') {
            $subKey = $subName;
        }

        $fieldTypeIds = [];
        if (isset($sub['field_type_ids']) && is_array($sub['field_type_ids'])) {
            foreach ($sub['field_type_ids'] as $typeId) {
                if (is_int($typeId)) {
                    $fieldTypeIds[] = $typeId;
                } elseif (is_string($typeId) && preg_match('/^\d+$/', $typeId)) {
                    $fieldTypeIds[] = (int) $typeId;
                }
            }
        }

        $categoriesMap[$categoryKey]['subs'][] = [
            'id' => $sub['id'] ?? null,
            'name' => $subName,
            'key' => $subKey,
            'sort_order' => $sub['sort_order'],
            'field_type_ids' => $fieldTypeIds,
        ];
        $categoriesMap[$categoryKey]['subIds'][$subKey] = $sub['id'] ?? null;
        if ($subName !== '' && $subName !== $subKey) {
            $categoriesMap[$categoryKey]['subIds'][$subName] = $sub['id'] ?? null;
        }

        $categoriesMap[$categoryKey]['subAliases'][$subName] = $subKey;
        if ($subKey !== '' && !isset($categoriesMap[$categoryKey]['subAliases'][$subKey])) {
            $categoriesMap[$categoryKey]['subAliases'][$subKey] = $subKey;
        }

        $metadata = is_array($sub['metadata']) ? $sub['metadata'] : [];
        $fields = buildFieldsForSubcategory($fieldTypeIds, $fieldTypeCatalog, $metadata);
        $categoriesMap[$categoryKey]['subFields'][$subKey] = $fields;
        if ($subName !== '' && $subName !== $subKey) {
            $categoriesMap[$categoryKey]['subFields'][$subName] = $fields;
        }
        $categoriesMap[$categoryKey]['subFieldTypes'][$subKey] = $fieldTypeIds;
        if ($subName !== '' && $subName !== $subKey) {
            $categoriesMap[$categoryKey]['subFieldTypes'][$subName] = $fieldTypeIds;
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
            $subcategoryIcons[$subKey] = $iconHtml;
            if ($subKey !== $subName) {
                $subcategoryIcons[$subName] = $iconHtml;
            }
        }
        if ($iconPath === '' && $iconHtml !== '') {
            $iconPath = extract_icon_src($iconHtml);
        }
        if ($iconPath !== '') {
            $subcategoryIconPaths[$subKey] = $iconPath;
            if ($subKey !== $subName) {
                $subcategoryIconPaths[$subName] = $iconPath;
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
            $subcategoryMarkers[$subKey] = $markerPath;
            if ($subKey !== $subName) {
                $subcategoryMarkers[$subName] = $markerPath;
            }
        }

        if (isset($metadata['markerId']) && is_string($metadata['markerId']) && $metadata['markerId'] !== '') {
            $subcategoryMarkerIds[$subKey] = $metadata['markerId'];
            if ($subKey !== $subName) {
                $subcategoryMarkerIds[$subName] = $metadata['markerId'];
            }
        } else {
            $slugForId = slugify_key($subKey);
            if ($slugForId !== '') {
                $subcategoryMarkerIds[$subKey] = $slugForId;
                if ($subKey !== $subName) {
                    $subcategoryMarkerIds[$subName] = $slugForId;
                }
            }
        }

        if (isset($metadata['categoryShape']) && $metadata['categoryShape'] !== null) {
            $categoryShapes[$categoryKey] = $metadata['categoryShape'];
            if ($categoryKey !== $categoryName) {
                $categoryShapes[$categoryName] = $metadata['categoryShape'];
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

    foreach ($categoriesMap as &$category) {
        if (!is_array($category['subs'])) {
            $category['subs'] = [];
        }
        if (!is_array($category['subFields'])) {
            $category['subFields'] = [];
        }
        if (!isset($category['subFieldTypes']) || !is_array($category['subFieldTypes'])) {
            $category['subFieldTypes'] = [];
        }
        if (!isset($category['subAliases']) || !is_array($category['subAliases'])) {
            $category['subAliases'] = [];
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
        $category['subs'] = $subs;

        foreach ($category['subs'] as $subEntry) {
            if (!is_array($subEntry)) {
                continue;
            }
            $subName = isset($subEntry['name']) && is_string($subEntry['name']) ? $subEntry['name'] : '';
            $subKey = isset($subEntry['key']) && is_string($subEntry['key']) ? $subEntry['key'] : '';
            if ($subKey === '') {
                $subKey = $subName;
            }
            if ($subKey === '') {
                continue;
            }

            if (!isset($category['subFields'][$subKey]) || !is_array($category['subFields'][$subKey])) {
                $category['subFields'][$subKey] = [];
            }
            if ($subName !== '' && !isset($category['subFields'][$subName])) {
                $category['subFields'][$subName] = $category['subFields'][$subKey];
            }

            if (!isset($category['subFieldTypes'][$subKey]) || !is_array($category['subFieldTypes'][$subKey])) {
                $category['subFieldTypes'][$subKey] = [];
            }
            if ($subName !== '' && !isset($category['subFieldTypes'][$subName])) {
                $category['subFieldTypes'][$subName] = $category['subFieldTypes'][$subKey];
            }

            if (!isset($category['subIds'][$subKey])) {
                $category['subIds'][$subKey] = null;
            }
            if ($subName !== '' && !isset($category['subIds'][$subName])) {
                $category['subIds'][$subName] = $category['subIds'][$subKey];
            }

            if ($subName !== '' && (!isset($category['subAliases'][$subName]) || $category['subAliases'][$subName] === '')) {
                $category['subAliases'][$subName] = $subKey;
            }
            if (!isset($category['subAliases'][$subKey]) || $category['subAliases'][$subKey] === '') {
                $category['subAliases'][$subKey] = $subKey;
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
        'categoryShapes' => $categoryShapes,
        'versionPriceCurrencies' => $versionPriceCurrencies,
        'fieldTypes' => array_values($fieldTypeCatalog),
        'fieldTypesById' => $fieldTypeCatalog,
        'iconLibrary' => array_values($iconLibrary),
    ];
}

function buildFieldTypeCatalog(array $blueprints): array
{
    $fieldsRaw = isset($blueprints['fields']) && is_array($blueprints['fields']) ? $blueprints['fields'] : [];
    $fieldsetsRaw = isset($blueprints['fieldsets']) && is_array($blueprints['fieldsets']) ? $blueprints['fieldsets'] : [];
    $typesRaw = isset($blueprints['field_types']) && is_array($blueprints['field_types']) ? $blueprints['field_types'] : [];

    $fields = [];
    foreach ($fieldsRaw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $normalized = normalizeFieldBlueprintRow($row);
        if ($normalized !== null) {
            $fields[$normalized['__id']] = $normalized;
        }
    }

    $fieldsets = [];
    foreach ($fieldsetsRaw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $normalized = normalizeFieldsetBlueprintRow($row);
        if ($normalized !== null) {
            $fieldsets[$normalized['id']] = $normalized;
        }
    }

    $catalog = [];
    foreach ($typesRaw as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (!isset($row['id']) || !preg_match('/^\d+$/', (string) $row['id'])) {
            continue;
        }
        $typeId = (int) $row['id'];
        $typeKey = isset($row['field_type_key']) && is_string($row['field_type_key']) ? trim($row['field_type_key']) : '';
        $typeName = isset($row['field_type_name']) && is_string($row['field_type_name']) ? trim($row['field_type_name']) : '';

        $fieldsForType = [];
        for ($i = 1; $i <= 5; $i++) {
            $column = 'field_type_item_' . $i;
            if (!isset($row[$column]) || !is_string($row[$column])) {
                continue;
            }
            $descriptor = parseFieldTypeItemDescriptor($row[$column]);
            if (!$descriptor) {
                continue;
            }

            if ($descriptor['kind'] === 'field') {
                $fieldId = $descriptor['id'];
                if (!isset($fields[$fieldId])) {
                    continue;
                }
                $fieldDef = cloneFieldDefinition($fields[$fieldId]);
                if ($descriptor['label'] !== '') {
                    $fieldDef['name'] = $descriptor['label'];
                    $fieldDef['label'] = $descriptor['label'];
                }
                $fieldsForType[] = $fieldDef;
            } elseif ($descriptor['kind'] === 'fieldset') {
                $fieldsetId = $descriptor['id'];
                if (!isset($fieldsets[$fieldsetId])) {
                    continue;
                }
                $fieldset = $fieldsets[$fieldsetId];
                foreach ($fieldset['field_ids'] as $index => $fieldId) {
                    if (!isset($fields[$fieldId])) {
                        continue;
                    }
                    $fieldDef = cloneFieldDefinition($fields[$fieldId]);
                    $label = $fieldset['field_labels'][$index] ?? '';
                    if ($label === '' && isset($fieldset['field_keys'][$index])) {
                        $label = formatFieldLabel($fieldset['field_keys'][$index]);
                    }
                    if ($label !== '') {
                        $fieldDef['name'] = $label;
                        $fieldDef['label'] = $label;
                    }
                    $fieldsForType[] = $fieldDef;
                }
            }
        }

        $catalog[$typeId] = [
            'id' => $typeId,
            'key' => $typeKey,
            'name' => $typeName,
            'label' => $typeName,
            'fields' => $fieldsForType,
        ];
    }

    return $catalog;
}

function buildFieldsForSubcategory(array $fieldTypeIds, array $fieldTypeCatalog, array $metadata): array
{
    $fields = [];

    foreach ($fieldTypeIds as $typeId) {
        $typeId = (int) $typeId;
        if ($typeId <= 0 || !isset($fieldTypeCatalog[$typeId])) {
            continue;
        }
        foreach ($fieldTypeCatalog[$typeId]['fields'] as $fieldDef) {
            $fields[] = cloneFieldDefinition($fieldDef);
        }
    }

    if (!$fields && isset($metadata['fields']) && is_array($metadata['fields'])) {
        foreach ($metadata['fields'] as $field) {
            if (is_array($field)) {
                $fields[] = $field;
            }
        }
    }

    return $fields;
}

function normalizeFieldBlueprintRow(array $row): ?array
{
    if (!isset($row['id']) || !preg_match('/^\d+$/', (string) $row['id'])) {
        return null;
    }
    $id = (int) $row['id'];
    if ($id <= 0) {
        return null;
    }

    $fieldKey = isset($row['field_key']) && is_string($row['field_key']) ? trim($row['field_key']) : '';
    if ($fieldKey === '') {
        $fieldKey = 'field_' . $id;
    }

    $typeKey = normalizeFieldTypeKey($fieldKey);
    $label = formatFieldLabel($fieldKey);
    $required = false;
    if (isset($row['required'])) {
        $required = filter_var($row['required'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $required = $required === null ? false : $required;
    }

    $options = [];
    if (isset($row['options_json'])) {
        $options = decodeFieldOptions($row['options_json']);
    }

    return [
        '__id' => $id,
        'id' => (string) $id,
        'key' => $fieldKey,
        'type' => $typeKey,
        'name' => $label,
        'label' => $label,
        'required' => $required,
        'options' => $options,
        'placeholder' => '',
        'input_type' => isset($row['type']) && is_string($row['type']) ? trim($row['type']) : null,
    ];
}

function normalizeFieldsetBlueprintRow(array $row): ?array
{
    if (!isset($row['id']) || !preg_match('/^\d+$/', (string) $row['id'])) {
        return null;
    }
    $id = (int) $row['id'];
    if ($id <= 0) {
        return null;
    }

    $fieldIds = [];
    if (isset($row['field_id']) && is_string($row['field_id'])) {
        $fieldIds = parseNumericCsv($row['field_id']);
    }

    $fieldKeys = [];
    if (isset($row['field_key']) && is_string($row['field_key'])) {
        $fieldKeys = parseStringCsv($row['field_key']);
    }

    $fieldLabels = [];
    foreach ($fieldKeys as $value) {
        $fieldLabels[] = formatFieldLabel($value);
    }

    return [
        'id' => $id,
        'field_ids' => $fieldIds,
        'field_keys' => $fieldKeys,
        'field_labels' => $fieldLabels,
    ];
}

function parseFieldTypeItemDescriptor(string $value): ?array
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }
    if (!preg_match('/^(?P<label>.+?)\s*\[(?P<kind>field|fieldset)=(?P<id>\d+)\]$/i', $trimmed, $matches)) {
        return null;
    }
    return [
        'label' => trim($matches['label']),
        'kind' => strtolower($matches['kind']),
        'id' => (int) $matches['id'],
    ];
}

function normalizeFieldTypeKey(string $key): string
{
    $trimmed = strtolower(trim($key));
    if ($trimmed === '') {
        return '';
    }
    $normalized = preg_replace('/[^a-z0-9_\-]+/', '-', $trimmed);
    return str_replace('_', '-', $normalized);
}

function formatFieldLabel(string $value): string
{
    $trimmed = trim(str_replace(['_', '-'], ' ', $value));
    if ($trimmed === '') {
        return '';
    }
    return ucwords(preg_replace('/\s+/', ' ', $trimmed));
}

function decodeFieldOptions($json): array
{
    if (!is_string($json) || trim($json) === '') {
        return [];
    }
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        return [];
    }
    if (isset($decoded['options']) && is_array($decoded['options'])) {
        $decoded = $decoded['options'];
    }

    $options = [];
    foreach ($decoded as $option) {
        if (is_string($option)) {
            $candidate = trim($option);
        } elseif (is_scalar($option)) {
            $candidate = trim((string) $option);
        } else {
            $candidate = '';
        }
        if ($candidate !== '') {
            $options[] = $candidate;
        }
    }

    return $options;
}

function parseNumericCsv(string $value): array
{
    $parts = array_map('trim', explode(',', $value));
    $result = [];
    foreach ($parts as $part) {
        if ($part === '' || !preg_match('/^\d+$/', $part)) {
            continue;
        }
        $result[] = (int) $part;
    }
    return $result;
}

function parseStringCsv(string $value): array
{
    $parts = array_map('trim', explode(',', $value));
    $result = [];
    foreach ($parts as $part) {
        $clean = trim($part, " \t\n\r\0\x0B_");
        if ($clean !== '') {
            $result[] = $clean;
        }
    }
    return $result;
}

function cloneFieldDefinition(array $field): array
{
    $clone = $field;
    if (isset($clone['options']) && is_array($clone['options'])) {
        $clone['options'] = array_values($clone['options']);
    }
    if (isset($clone['__id'])) {
        unset($clone['__id']);
    }
    return $clone;
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
