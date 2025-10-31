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
    $fieldTypes = fetchFieldTypes($pdo);

    $snapshot = buildSnapshot($categories, $subcategories, $fieldTypes);

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

        if (isset($metadata['fieldTypeIds']) && is_array($metadata['fieldTypeIds'])) {
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

        if (isset($metadata['fieldTypeNames']) && is_array($metadata['fieldTypeNames'])) {
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

        if (isset($metadata['fieldTypeIds']) && is_array($metadata['fieldTypeIds'])) {
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

        if (isset($metadata['fieldTypeNames']) && is_array($metadata['fieldTypeNames'])) {
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

function fetchFieldTypes(PDO $pdo): array
{
    try {
        $columns = fetchTableColumns($pdo, 'field_types');
        if (!$columns) {
            return [
                'definitions' => [],
                'raw' => [],
                'mapById' => [],
                'mapByName' => [],
            ];
        }

        $idColumn = null;
        if (in_array('field_type_id', $columns, true)) {
            $idColumn = 'field_type_id';
        } elseif (in_array('id', $columns, true)) {
            $idColumn = 'id';
        }

        if ($idColumn === null) {
            return [
                'definitions' => [],
                'raw' => [],
                'mapById' => [],
                'mapByName' => [],
            ];
        }

        $selectColumns = [];
        $selectColumns[] = '`' . str_replace('`', '``', $idColumn) . '` AS `field_type_id`';
        if ($idColumn !== 'id' && in_array('id', $columns, true)) {
            $selectColumns[] = '`id`';
        }
        if (in_array('field_type_name', $columns, true)) {
            $selectColumns[] = '`field_type_name`';
        }
        if (in_array('field_type_key', $columns, true)) {
            $selectColumns[] = '`field_type_key`';
        }
        if (in_array('sort_order', $columns, true)) {
            $selectColumns[] = '`sort_order`';
        }

        $itemColumns = [];
        for ($i = 1; $i <= 12; $i++) {
            $column = 'field_type_item_' . $i;
            if (in_array($column, $columns, true)) {
                $selectColumns[] = '`' . $column . '`';
                $itemColumns[] = $column;
            }
        }

        $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM field_types';
        $orderParts = [];
        if (in_array('sort_order', $columns, true)) {
            $orderParts[] = '`sort_order` ASC';
        }
        $orderParts[] = '`field_type_id` ASC';
        if ($orderParts) {
            $sql .= ' ORDER BY ' . implode(', ', $orderParts);
        }

        $stmt = $pdo->query($sql);

        $definitions = [];
        $rawRecords = [];
        $mapById = [];
        $mapByName = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['field_type_id'])) {
                continue;
            }

            $id = (int) $row['field_type_id'];
            if ($id <= 0) {
                continue;
            }

            $name = isset($row['field_type_name']) ? trim((string) $row['field_type_name']) : '';
            $key = isset($row['field_type_key']) ? normalizeFieldTypeKey((string) $row['field_type_key']) : '';

            $rawRow = [
                'field_type_id' => $id,
                'field_type_name' => $name,
                'field_type_key' => isset($row['field_type_key']) ? (string) $row['field_type_key'] : '',
            ];
            if (isset($row['id'])) {
                $rawRow['id'] = (int) $row['id'];
            } elseif ($idColumn === 'id') {
                $rawRow['id'] = $id;
            }
            if (isset($row['sort_order'])) {
                $rawRow['sort_order'] = is_numeric($row['sort_order']) ? (int) $row['sort_order'] : $row['sort_order'];
            }

            foreach ($itemColumns as $column) {
                $rawRow[$column] = isset($row[$column]) ? (string) $row[$column] : '';
            }

            $rawRecords[] = $rawRow;

            $items = [];
            foreach ($itemColumns as $column) {
                if (!isset($row[$column]) || !is_string($row[$column])) {
                    continue;
                }
                $meta = extractFieldTypeItemMeta($row[$column]);
                if ($meta === null) {
                    continue;
                }
                $items[] = $meta;
            }

            $definition = [
                'id' => $id,
                'name' => $name,
                'key' => $key,
                'items' => $items,
            ];
            $definitions[] = $definition;
            $mapById[$id] = $definition;
            if ($name !== '') {
                $mapByName[mb_strtolower($name)] = $definition;
            }
        }

        return [
            'definitions' => $definitions,
            'raw' => $rawRecords,
            'mapById' => $mapById,
            'mapByName' => $mapByName,
        ];
    } catch (PDOException $e) {
        return [
            'definitions' => [],
            'raw' => [],
            'mapById' => [],
            'mapByName' => [],
        ];
    }
}

function buildSnapshot(array $categories, array $subcategories, array $fieldTypes = []): array
{
    $fieldTypeDefinitions = [];
    $fieldTypeRawRecords = [];
    $fieldTypeMapById = [];
    $fieldTypeMapByName = [];

    if (isset($fieldTypes['definitions']) && is_array($fieldTypes['definitions'])) {
        $fieldTypeDefinitions = array_values($fieldTypes['definitions']);
    } elseif (is_array($fieldTypes)) {
        $fieldTypeDefinitions = array_values($fieldTypes);
    }

    if (isset($fieldTypes['raw']) && is_array($fieldTypes['raw'])) {
        $fieldTypeRawRecords = array_values($fieldTypes['raw']);
    }

    if (isset($fieldTypes['mapById']) && is_array($fieldTypes['mapById'])) {
        $fieldTypeMapById = $fieldTypes['mapById'];
    }

    if (isset($fieldTypes['mapByName']) && is_array($fieldTypes['mapByName'])) {
        $fieldTypeMapByName = $fieldTypes['mapByName'];
    }

    if (!$fieldTypeMapById) {
        foreach ($fieldTypeDefinitions as $definition) {
            if (!is_array($definition)) {
                continue;
            }
            if (!isset($definition['id'])) {
                continue;
            }
            $id = (int) $definition['id'];
            if ($id <= 0 || isset($fieldTypeMapById[$id])) {
                continue;
            }
            $fieldTypeMapById[$id] = $definition;
        }
    }

    if (!$fieldTypeMapByName) {
        foreach ($fieldTypeDefinitions as $definition) {
            if (!is_array($definition)) {
                continue;
            }
            if (!isset($definition['name'])) {
                continue;
            }
            $name = trim((string) $definition['name']);
            if ($name === '') {
                continue;
            }
            $fieldTypeMapByName[mb_strtolower($name)] = $definition;
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
        ];

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

        if ($fieldTypeNames) {
            foreach ($fieldTypeNames as $nameValue) {
                $lower = mb_strtolower($nameValue);
                if (isset($fieldTypeMapByName[$lower]) && isset($fieldTypeMapByName[$lower]['id'])) {
                    $mappedId = (int) $fieldTypeMapByName[$lower]['id'];
                    if ($mappedId > 0 && !in_array($mappedId, $fieldTypeIds, true)) {
                        $fieldTypeIds[] = $mappedId;
                    }
                }
            }
        }

        if ($fieldTypeIds) {
            foreach ($fieldTypeIds as $candidateId) {
                $normalizedId = (int) $candidateId;
                if ($normalizedId <= 0) {
                    continue;
                }
                if (isset($fieldTypeMapById[$normalizedId]['name'])) {
                    $candidateName = trim((string) $fieldTypeMapById[$normalizedId]['name']);
                    if ($candidateName !== '' && !in_array($candidateName, $fieldTypeNames, true)) {
                        $fieldTypeNames[] = $candidateName;
                    }
                }
            }
        }

        $fieldTypeIds = array_values(array_unique(array_map('intval', $fieldTypeIds)));
        $fieldTypeNames = array_values(array_unique(array_filter(array_map('trim', $fieldTypeNames), static function ($value) {
            return $value !== '';
        })));

        $metadata['fieldTypeIds'] = $fieldTypeIds;
        $metadata['fieldTypeNames'] = $fieldTypeNames;

        $categoriesMap[$categoryName]['subFields'][$sub['name']] = $fields;
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
        'fieldTypes' => array_values($fieldTypeDefinitions),
        'field_types' => array_values($fieldTypeRawRecords),
    ];
}

function normalizeFieldTypeKey(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    $normalized = strtolower($trimmed);
    $normalized = preg_replace('/[^a-z0-9_\-]+/', '-', $normalized);
    $normalized = preg_replace('/-+/', '-', $normalized);
    $normalized = preg_replace('/_+/', '_', $normalized);

    return trim((string) $normalized, '-_');
}

function extractFieldTypeItemMeta(string $value): ?array
{
    $label = trim($value);
    if ($label === '') {
        return null;
    }

    $keySource = $label;
    $bracketPos = strpos($keySource, '[');
    if ($bracketPos !== false) {
        $keySource = substr($keySource, 0, $bracketPos);
    }
    $keySource = trim((string) $keySource);
    if ($keySource === '') {
        return null;
    }

    $parts = preg_split('/\s+/', $keySource);
    $candidate = is_array($parts) && isset($parts[0]) ? $parts[0] : $keySource;
    $key = normalizeFieldTypeKey($candidate);
    if ($key === '') {
        return null;
    }

    $type = 'unknown';
    if (stripos($label, '[fieldset=') !== false) {
        $type = 'fieldset';
    } elseif (stripos($label, '[field=') !== false) {
        $type = 'field';
    }

    return [
        'key' => $key,
        'label' => $label,
        'type' => $type,
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
