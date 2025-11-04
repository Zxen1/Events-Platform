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

        // Prefer DB CSVs; only fall back to metadata when CSVs are empty
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
            // use metadata only if DB CSV was empty
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

        // Prefer DB CSVs; only fall back to metadata when CSVs are empty
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

    $itemColumns = [];
    for ($i = 1; $i <= 5; $i++) {
        $column = 'field_type_item_' . $i;
        if (in_array($column, $columns, true)) {
            $selectColumns[] = '`' . $column . '`';
            $itemColumns[] = $column;
        }
    }

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

    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM field_types' . $orderBy;

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return [];
    }

    $fieldDefinitionLookup = buildFieldDefinitionLookup($pdo);
    $fieldsetLookup = buildFieldsetLookup($pdo, $fieldDefinitionLookup);

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

        $fieldsList = buildFieldTypeFieldList($row, $itemColumns, $fieldDefinitionLookup, $fieldsetLookup);
        $entry['fields'] = deepCloneValue($fieldsList);
        if (!isset($entry['definition']) || !is_array($entry['definition'])) {
            $entry['definition'] = [];
        }
        $entry['definition']['defaultFields'] = deepCloneValue($fieldsList);

        foreach ($itemColumns as $columnName) {
            if (array_key_exists($columnName, $row)) {
                $entry[$columnName] = $row[$columnName];
            }
        }

        $fieldTypes[] = $entry;
        $seen[$dedupeKey] = true;
    }

    return $fieldTypes;
}

function buildFieldDefinitionLookup(PDO $pdo): array
{
    $columns = fetchTableColumns($pdo, 'fields');
    if (!$columns) {
        return ['byId' => [], 'byKey' => []];
    }

    $select = [];
    foreach (['id', 'field_key', 'type', 'required', 'options_json'] as $column) {
        if (in_array($column, $columns, true)) {
            $select[] = '`' . $column . '`';
        }
    }

    if (!$select) {
        return ['byId' => [], 'byKey' => []];
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM fields';

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return ['byId' => [], 'byKey' => []];
    }

    $byId = [];
    $byKey = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'])) {
            continue;
        }

        $id = (int) $row['id'];
        $rawKey = isset($row['field_key']) ? trim((string) $row['field_key']) : '';
        $key = $rawKey !== '' ? $rawKey : 'field_' . $id;
        $name = formatFieldDisplayName($rawKey !== '' ? $rawKey : ('Field ' . $id));
        $inputType = isset($row['type']) ? (string) $row['type'] : null;
        $type = mapFieldBuilderType($rawKey, $inputType);
        $required = normalizeBooleanValue($row['required'] ?? null);
        $options = normalizeFieldOptions($row['options_json'] ?? null);

        $definition = [
            'id' => $id,
            'field_id' => $id,
            'fieldId' => $id,
            'key' => $key,
            'field_key' => $key,
            'name' => $name,
            'type' => $type,
            'placeholder' => '',
            'required' => $required,
            'options' => $options,
            'source' => 'field',
        ];

        if ($inputType !== null) {
            $definition['input_type'] = $inputType;
        }
        if (isset($row['options_json'])) {
            $definition['options_source'] = (string) $row['options_json'];
        }

        $byId[$id] = $definition;
        if ($rawKey !== '') {
            $byKey[strtolower($rawKey)] = $definition;
        }
    }

    return ['byId' => $byId, 'byKey' => $byKey];
}

function buildFieldsetLookup(PDO $pdo, array $fieldDefinitionLookup): array
{
    $columns = fetchTableColumns($pdo, 'fieldsets');
    if (!$columns) {
        return ['byId' => [], 'byKey' => []];
    }

    $select = [];
    foreach (['id', 'fieldset_key', 'description', 'field_id', 'field_key'] as $column) {
        if (in_array($column, $columns, true)) {
            $select[] = '`' . $column . '`';
        }
    }

    if (!$select) {
        return ['byId' => [], 'byKey' => []];
    }

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM fieldsets';

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return ['byId' => [], 'byKey' => []];
    }

    $byId = [];
    $byKey = [];

    $fieldsById = $fieldDefinitionLookup['byId'] ?? [];
    $fieldsByKey = $fieldDefinitionLookup['byKey'] ?? [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'])) {
            continue;
        }

        $id = (int) $row['id'];
        $rawKey = isset($row['fieldset_key']) ? trim((string) $row['fieldset_key']) : '';
        $key = $rawKey !== '' ? $rawKey : 'fieldset_' . $id;
        $name = formatFieldDisplayName($rawKey !== '' ? $rawKey : ('Fieldset ' . $id));
        $description = isset($row['description']) && is_string($row['description'])
            ? trim($row['description'])
            : null;

        $fieldIds = parseNumericCsv($row['field_id'] ?? null);
        $fieldKeys = parseFieldKeyCsv($row['field_key'] ?? null);

        $resolvedFields = [];
        foreach ($fieldIds as $fieldId) {
            if (isset($fieldsById[$fieldId])) {
                $resolvedFields[] = cloneFieldConfigArray($fieldsById[$fieldId]);
            }
        }

        if (!$resolvedFields && $fieldKeys) {
            foreach ($fieldKeys as $fieldKey) {
                $lower = strtolower($fieldKey);
                if (isset($fieldsByKey[$lower])) {
                    $resolvedFields[] = cloneFieldConfigArray($fieldsByKey[$lower]);
                }
            }
        }

        $fieldset = [
            'id' => $id,
            'key' => $key,
            'name' => $name !== '' ? $name : ('Fieldset ' . $id),
            'description' => $description,
            'fields' => $resolvedFields,
        ];

        $byId[$id] = $fieldset;
        $byKey[strtolower($key)] = $fieldset;
    }

    return ['byId' => $byId, 'byKey' => $byKey];
}

function buildFieldTypeFieldList(array $row, array $itemColumns, array $fieldDefinitionLookup, array $fieldsetLookup): array
{
    if (!$itemColumns) {
        return [];
    }

    $fields = [];
    $fieldsById = $fieldDefinitionLookup['byId'] ?? [];
    $fieldsByKey = $fieldDefinitionLookup['byKey'] ?? [];
    $fieldsetsById = $fieldsetLookup['byId'] ?? [];
    $fieldsetsByKey = $fieldsetLookup['byKey'] ?? [];

    foreach ($itemColumns as $column) {
        if (!isset($row[$column]) || !is_string($row[$column])) {
            continue;
        }

        $parsed = parseFieldTypeItemValue($row[$column]);
        if ($parsed === null) {
            continue;
        }

        if ($parsed['kind'] === 'field') {
            $fieldConfig = null;
            if (isset($fieldsById[$parsed['id']])) {
                $fieldConfig = cloneFieldConfigArray($fieldsById[$parsed['id']]);
            } elseif ($parsed['label'] !== null) {
                $labelKey = strtolower(str_replace(' ', '_', $parsed['label']));
                if (isset($fieldsByKey[$labelKey])) {
                    $fieldConfig = cloneFieldConfigArray($fieldsByKey[$labelKey]);
                } elseif (isset($fieldsByKey[strtolower($parsed['label'])])) {
                    $fieldConfig = cloneFieldConfigArray($fieldsByKey[strtolower($parsed['label'])]);
                }
            }

            if ($fieldConfig !== null) {
                if ($parsed['label'] !== null && $parsed['label'] !== '') {
                    $fieldConfig['name'] = formatFieldDisplayName($parsed['label']);
                }
                $fieldConfig['source'] = 'field';
                $fieldConfig['field_type_item'] = $row[$column];
                $fieldConfig['fieldTypeItemColumn'] = $column;
                $fields[] = $fieldConfig;
            }

            continue;
        }

        if ($parsed['kind'] === 'fieldset') {
            $fieldset = $fieldsetsById[$parsed['id']] ?? null;
            if ($fieldset === null && $parsed['label'] !== null) {
                $fieldsetKey = strtolower(str_replace(' ', '_', $parsed['label']));
                if (isset($fieldsetsByKey[$fieldsetKey])) {
                    $fieldset = $fieldsetsByKey[$fieldsetKey];
                }
            }

            if ($fieldset === null) {
                continue;
            }

            $fieldsetName = $parsed['label'] !== null && $parsed['label'] !== ''
                ? formatFieldDisplayName($parsed['label'])
                : $fieldset['name'];

            foreach ($fieldset['fields'] as $fieldsetField) {
                $fieldConfig = cloneFieldConfigArray($fieldsetField);
                $fieldConfig['fieldsetId'] = $fieldset['id'];
                $fieldConfig['fieldsetKey'] = $fieldset['key'];
                $fieldConfig['fieldsetName'] = $fieldsetName;
                $fieldConfig['fieldsetSource'] = [
                    'id' => $fieldset['id'],
                    'key' => $fieldset['key'],
                    'name' => $fieldsetName,
                ];
                $fieldConfig['source'] = 'fieldset';
                $fieldConfig['field_type_item'] = $row[$column];
                $fieldConfig['fieldTypeItemColumn'] = $column;
                $fields[] = $fieldConfig;
            }
        }
    }

    return $fields;
}

function parseFieldTypeItemValue(?string $value): ?array
{
    if (!is_string($value)) {
        return null;
    }

    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }

    if (!preg_match('/^(.*?)\s*\[(field|fieldset)\s*=\s*(\d+)\]\s*$/i', $trimmed, $matches)) {
        return null;
    }

    $label = trim((string) $matches[1]);
    $kind = strtolower((string) $matches[2]);
    $id = (int) $matches[3];

    return [
        'kind' => $kind === 'fieldset' ? 'fieldset' : 'field',
        'id' => $id,
        'label' => $label !== '' ? $label : null,
    ];
}

function normalizeFieldOptions($rawOptions): array
{
    $decoded = null;

    if (is_string($rawOptions)) {
        $trimmed = trim($rawOptions);
        if ($trimmed !== '') {
            $json = json_decode($trimmed, true);
            if (is_array($json)) {
                $decoded = $json;
            }
        }
    } elseif (is_array($rawOptions)) {
        $decoded = $rawOptions;
    }

    if ($decoded === null) {
        return [];
    }

    if (isset($decoded['options']) && is_array($decoded['options'])) {
        return sanitizeFieldOptionsList($decoded['options']);
    }

    if (isset($decoded['values']) && is_array($decoded['values'])) {
        return sanitizeFieldOptionsList($decoded['values']);
    }

    if (is_list_array($decoded)) {
        return sanitizeFieldOptionsList($decoded);
    }

    return [];
}

function sanitizeFieldOptionsList(array $list): array
{
    $options = [];
    $seen = [];

    foreach ($list as $option) {
        $value = sanitizeFieldOptionValue($option);
        if ($value === '') {
            continue;
        }

        $dedupeKey = strtolower($value);
        if (isset($seen[$dedupeKey])) {
            continue;
        }

        $options[] = $value;
        $seen[$dedupeKey] = true;
    }

    return $options;
}

function sanitizeFieldOptionValue($option): string
{
    if (is_string($option)) {
        return trim($option);
    }

    if (is_array($option)) {
        if (isset($option['value']) && is_string($option['value'])) {
            return trim($option['value']);
        }
        if (isset($option['label']) && is_string($option['label'])) {
            return trim($option['label']);
        }
    }

    if (is_scalar($option)) {
        return trim((string) $option);
    }

    return '';
}

function formatFieldDisplayName(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    $normalized = preg_replace('/[_\-]+/', ' ', $trimmed);
    if (!is_string($normalized)) {
        $normalized = $trimmed;
    }
    $normalized = preg_replace('/\s+/', ' ', $normalized);
    if (!is_string($normalized)) {
        $normalized = $trimmed;
    }

    return ucwords(strtolower($normalized));
}

function mapFieldBuilderType(?string $fieldKey, ?string $dbType): string
{
    $key = is_string($fieldKey) ? strtolower(trim($fieldKey)) : '';
    $dbTypeNormalized = is_string($dbType) ? strtolower(trim($dbType)) : '';

    $keyMap = [
        'title' => 'title',
        'description' => 'description',
        'images' => 'images',
        'text_box' => 'text-box',
        'text-area' => 'text-area',
        'text_area' => 'text-area',
        'dropdown' => 'dropdown',
        'radio_toggle' => 'radio-toggle',
        'radio-toggle' => 'radio-toggle',
        'email' => 'email',
        'phone' => 'phone',
        'website' => 'website_url',
        'website_url' => 'website_url',
        'tickets_url' => 'tickets_url',
        'coupon' => 'coupon',
        'location' => 'location',
        'variant_pricing' => 'variant_pricing',
        'venues_sessions_pricing' => 'venues_sessions_pricing',
        'checkout_table' => 'checkout',
        'checkout' => 'checkout',
    ];

    if ($key !== '' && isset($keyMap[$key])) {
        return $keyMap[$key];
    }

    $typeMap = [
        'text' => 'text-box',
        'textarea' => 'text-area',
        'dropdown' => 'dropdown',
        'radio' => 'radio-toggle',
        'email' => 'email',
        'tel' => 'phone',
        'phone' => 'phone',
        'url' => 'website_url',
        'images' => 'images',
        'decimal' => 'text-box',
        'decimal(10,2)' => 'text-box',
        'number' => 'text-box',
        'date' => 'text-box',
        'time' => 'text-box',
    ];

    if ($dbTypeNormalized !== '' && isset($typeMap[$dbTypeNormalized])) {
        return $typeMap[$dbTypeNormalized];
    }

    if ($key !== '') {
        return $key;
    }

    return 'text-box';
}

function normalizeBooleanValue($value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value)) {
        return $value === 1;
    }

    if (is_numeric($value)) {
        return (int) $value === 1;
    }

    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if ($normalized === '1' || $normalized === 'true' || $normalized === 'yes' || $normalized === 'required') {
            return true;
        }
        if ($normalized === '0' || $normalized === 'false' || $normalized === 'no' || $normalized === 'optional') {
            return false;
        }
    }

    return false;
}

function parseNumericCsv($value): array
{
    if (!is_string($value)) {
        return [];
    }

    $parts = preg_split('/\s*,\s*/', trim($value));
    if (!is_array($parts)) {
        return [];
    }

    $results = [];
    foreach ($parts as $part) {
        $candidate = trim($part);
        if ($candidate === '') {
            continue;
        }
        if (preg_match('/^\d+$/', $candidate)) {
            $results[] = (int) $candidate;
        }
    }

    return $results;
}

function parseFieldKeyCsv($value): array
{
    if (!is_string($value)) {
        return [];
    }

    $parts = explode(',', $value);
    $results = [];

    foreach ($parts as $part) {
        $candidate = trim($part);
        if ($candidate === '') {
            continue;
        }
        $candidate = ltrim($candidate, '_ ');
        if ($candidate === '') {
            continue;
        }
        $results[] = $candidate;
    }

    return $results;
}

function deepCloneValue($value)
{
    if (is_array($value)) {
        $clone = [];
        foreach ($value as $key => $item) {
            $clone[$key] = deepCloneValue($item);
        }
        return $clone;
    }

    return $value;
}

function cloneFieldConfigArray(array $config): array
{
    return deepCloneValue($config);
}

function is_list_array(array $array): bool
{
    if (function_exists('array_is_list')) {
        return array_is_list($array);
    }

    $i = 0;
    foreach ($array as $key => $_) {
        if ($key !== $i) {
            return false;
        }
        $i++;
    }

    return true;
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

        $fields = [];
        if (isset($metadata['fields']) && is_array($metadata['fields'])) {
            $fields = $metadata['fields'];
        }
        if ($fieldTypeIds) {
            $fields = [];
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
