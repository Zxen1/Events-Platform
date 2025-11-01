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

    $fields = [];
    $fieldColumns = fetchTableColumns($pdo, 'fields');
    if ($fieldColumns) {
        $fields = fetchFields($pdo, $fieldColumns);
    }

    $fieldsets = [];
    $fieldsetColumns = fetchTableColumns($pdo, 'fieldsets');
    if ($fieldsetColumns) {
        $fieldsets = fetchFieldsets($pdo, $fieldsetColumns);
    }

    $placeholderHints = loadPlaceholderHints($pdo);

    $fieldTypeCatalog = buildFieldTypeCatalog($fieldTypes, $fields, $fieldsets, $placeholderHints);

    $snapshot = buildSnapshot($categories, $subcategories, $fieldTypeCatalog);
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
    $itemColumns = [];
    for ($i = 1; $i <= 5; $i++) {
        $candidate = 'field_type_item_' . $i;
        if (in_array($candidate, $columns, true)) {
            $itemColumns[] = $candidate;
        }
    }
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

function fetchFieldTypes(PDO $pdo, array $columns): array
{
    $selectColumns = [];
    $orderBy = '';

    $hasId = in_array('id', $columns, true);
    $hasKey = in_array('field_type_key', $columns, true);
    $hasName = in_array('field_type_name', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);

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

    foreach ($itemColumns as $column) {
        $selectColumns[] = '`' . $column . '`';
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

        if ($itemColumns) {
            $items = [];
            foreach ($itemColumns as $column) {
                if (!isset($row[$column]) || !is_string($row[$column])) {
                    continue;
                }
                $itemValue = trim($row[$column]);
                if ($itemValue === '') {
                    continue;
                }
                $items[] = $itemValue;
            }
            $entry['items'] = $items;
        }

        $fieldTypes[] = $entry;
        $seen[$dedupeKey] = true;
    }

    return $fieldTypes;
}

function fetchFields(PDO $pdo, array $columns): array
{
    $selectColumns = [];

    $hasId = in_array('id', $columns, true);
    $hasKey = in_array('field_key', $columns, true);
    $hasType = in_array('type', $columns, true);
    $hasRequired = in_array('required', $columns, true);
    $hasOptions = in_array('options_json', $columns, true);

    if ($hasId) {
        $selectColumns[] = '`id`';
    }
    if ($hasKey) {
        $selectColumns[] = '`field_key`';
    }
    if ($hasType) {
        $selectColumns[] = '`type`';
    }
    if ($hasRequired) {
        $selectColumns[] = '`required`';
    }
    if ($hasOptions) {
        $selectColumns[] = '`options_json`';
    }

    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM fields';

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return [];
    }

    $fields = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!is_array($row)) {
            continue;
        }

        if (!$hasId || !isset($row['id']) || !is_numeric($row['id'])) {
            continue;
        }

        $id = (int) $row['id'];
        $key = '';
        if ($hasKey && isset($row['field_key'])) {
            $key = trim((string) $row['field_key']);
        }

        $type = '';
        if ($hasType && isset($row['type'])) {
            $type = trim((string) $row['type']);
        }

        $required = null;
        if ($hasRequired && isset($row['required'])) {
            if (is_bool($row['required'])) {
                $required = $row['required'];
            } elseif (is_numeric($row['required'])) {
                $required = ((int) $row['required']) === 1;
            }
        }

        $options = [];
        if ($hasOptions && isset($row['options_json']) && is_string($row['options_json'])) {
            $options = decodeJsonToArray($row['options_json']);
        }

        $fields[$id] = [
            'id' => $id,
            'key' => $key,
            'field_key' => $key,
            'type' => $type,
            'required' => $required,
            'options' => $options,
        ];
    }

    return $fields;
}

function fetchFieldsets(PDO $pdo, array $columns): array
{
    $selectColumns = [];

    $hasId = in_array('id', $columns, true);
    $hasKey = in_array('fieldset_key', $columns, true);
    $hasFieldIds = in_array('field_id', $columns, true);
    $hasFieldKeys = in_array('field_key', $columns, true);

    if ($hasId) {
        $selectColumns[] = '`id`';
    }
    if ($hasKey) {
        $selectColumns[] = '`fieldset_key`';
    }
    if ($hasFieldIds) {
        $selectColumns[] = '`field_id`';
    }
    if ($hasFieldKeys) {
        $selectColumns[] = '`field_key`';
    }

    if (!$selectColumns) {
        $selectColumns[] = '*';
    }

    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM fieldsets';

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return [];
    }

    $fieldsets = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!is_array($row)) {
            continue;
        }

        if (!$hasId || !isset($row['id']) || !is_numeric($row['id'])) {
            continue;
        }

        $id = (int) $row['id'];
        $key = '';
        if ($hasKey && isset($row['fieldset_key'])) {
            $key = trim((string) $row['fieldset_key']);
        }

        $fieldIds = [];
        if ($hasFieldIds && isset($row['field_id']) && is_string($row['field_id'])) {
            $fieldIds = parseIntegerCsv($row['field_id']);
        }

        $fieldKeys = [];
        if ($hasFieldKeys && isset($row['field_key']) && is_string($row['field_key'])) {
            $fieldKeys = parseStringCsv($row['field_key']);
        }

        $fieldsets[$id] = [
            'id' => $id,
            'key' => $key,
            'field_ids' => $fieldIds,
            'field_keys' => $fieldKeys,
        ];
    }

    return $fieldsets;
}

function loadPlaceholderHints(PDO $pdo): array
{
    $base = [
        'field' => [],
        'type' => [],
        'fieldset' => [],
        'general' => [],
    ];

    $tables = [
        'field_placeholder_hints',
        'field_placeholders',
        'field_type_placeholder_hints',
        'field_type_placeholders',
        'placeholder_hints',
    ];

    foreach ($tables as $table) {
        $columns = fetchTableColumns($pdo, $table);
        if (!$columns) {
            continue;
        }

        $hints = fetchPlaceholderHintsFromTable($pdo, $table, $columns);
        if (!$hints) {
            continue;
        }

        $base = mergePlaceholderHints($base, $hints);
    }

    return $base;
}

function fetchPlaceholderHintsFromTable(PDO $pdo, string $table, array $columns): array
{
    $keyCandidates = [
        'field_key',
        'fieldtype_key',
        'field_type_key',
        'field_type',
        'fieldname',
        'field_name',
        'key',
        'type_key',
        'type',
        'fieldset_key',
        'fieldset',
        'identifier',
        'slug',
        'code',
    ];

    $placeholderCandidates = [
        'placeholder',
        'placeholder_text',
        'placeholder_hint',
        'placeholder_example',
        'default_placeholder',
        'hint',
        'hint_text',
        'example',
        'example_text',
        'text',
        'value',
    ];

    $selectParts = [];
    $keyColumns = [];
    foreach ($columns as $column) {
        $normalized = strtolower($column);
        if (in_array($normalized, $keyCandidates, true)) {
            $keyColumns[$column] = $normalized;
            $selectParts[] = '`' . str_replace('`', '``', $column) . '`';
        }
    }

    $placeholderColumns = [];
    foreach ($columns as $column) {
        $normalized = strtolower($column);
        if (in_array($normalized, $placeholderCandidates, true)) {
            $placeholderColumns[] = $column;
            $selectParts[] = '`' . str_replace('`', '``', $column) . '`';
        }
    }

    if (!$keyColumns || !$placeholderColumns) {
        return [];
    }

    $selectParts = array_values(array_unique($selectParts));
    $sql = 'SELECT ' . implode(', ', $selectParts) . ' FROM `' . str_replace('`', '``', $table) . '`';

    try {
        $stmt = $pdo->query($sql);
    } catch (PDOException $e) {
        return [];
    }

    $hints = [
        'field' => [],
        'type' => [],
        'fieldset' => [],
        'general' => [],
    ];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!is_array($row)) {
            continue;
        }

        $placeholder = '';
        foreach ($placeholderColumns as $column) {
            if (!isset($row[$column]) || !is_string($row[$column])) {
                continue;
            }
            $candidate = trim($row[$column]);
            if ($candidate === '') {
                continue;
            }
            $placeholder = $candidate;
            break;
        }

        if ($placeholder === '') {
            continue;
        }

        foreach ($keyColumns as $column => $normalized) {
            if (!isset($row[$column])) {
                continue;
            }
            $value = $row[$column];
            if (!is_string($value) && !is_numeric($value)) {
                continue;
            }

            $key = strtolower(trim((string) $value));
            if ($key === '') {
                continue;
            }

            if (strpos($normalized, 'fieldset') !== false) {
                if (!isset($hints['fieldset'][$key])) {
                    $hints['fieldset'][$key] = $placeholder;
                }
            } elseif (strpos($normalized, 'type') !== false) {
                if (!isset($hints['type'][$key])) {
                    $hints['type'][$key] = $placeholder;
                }
            } elseif (strpos($normalized, 'field') !== false) {
                if (!isset($hints['field'][$key])) {
                    $hints['field'][$key] = $placeholder;
                }
            } else {
                if (!isset($hints['general'][$key])) {
                    $hints['general'][$key] = $placeholder;
                }
            }
        }
    }

    return $hints;
}

function mergePlaceholderHints(array $base, array $additional): array
{
    foreach (['field', 'type', 'fieldset', 'general'] as $group) {
        if (!isset($additional[$group]) || !is_array($additional[$group])) {
            continue;
        }
        if (!isset($base[$group]) || !is_array($base[$group])) {
            $base[$group] = [];
        }
        foreach ($additional[$group] as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }
            if (!is_string($value) || $value === '') {
                continue;
            }
            if (!isset($base[$group][$key])) {
                $base[$group][$key] = $value;
            }
        }
    }

    return $base;
}

function decodeJsonToArray(?string $json): array
{
    if (!is_string($json)) {
        return [];
    }

    $trimmed = trim($json);
    if ($trimmed === '') {
        return [];
    }

    try {
        $decoded = json_decode($trimmed, true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        $decoded = json_decode($trimmed, true);
    }

    return is_array($decoded) ? $decoded : [];
}

function parseIntegerCsv(string $value): array
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
        if (preg_match('/^-?\d+$/', $candidate)) {
            $ids[] = (int) $candidate;
        }
    }

    return $ids;
}

function parseStringCsv(string $value): array
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return [];
    }

    $parts = preg_split('/\s*,\s*/', $trimmed);
    if (!is_array($parts)) {
        $parts = [$trimmed];
    }

    $strings = [];
    foreach ($parts as $part) {
        if (!is_string($part)) {
            continue;
        }
        $candidate = trim($part);
        $candidate = trim($candidate, '_');
        if ($candidate === '') {
            continue;
        }
        $strings[] = $candidate;
    }

    return $strings;
}

function buildFieldTypeCatalog(array $fieldTypes, array $fields, array $fieldsets, array $placeholderHints): array
{
    $fieldsById = [];
    $fieldsByKey = [];
    foreach ($fields as $field) {
        if (!is_array($field)) {
            continue;
        }
        if (!isset($field['id']) || !is_int($field['id'])) {
            continue;
        }
        $fieldsById[$field['id']] = $field;
        if (isset($field['key']) && is_string($field['key'])) {
            $key = strtolower(trim($field['key']));
            if ($key !== '') {
                $fieldsByKey[$key] = $field;
            }
        }
    }

    $fieldsetsById = [];
    foreach ($fieldsets as $fieldset) {
        if (!is_array($fieldset)) {
            continue;
        }
        if (!isset($fieldset['id']) || !is_int($fieldset['id'])) {
            continue;
        }
        $fieldsetsById[$fieldset['id']] = $fieldset;
    }

    $hints = mergePlaceholderHints([
        'field' => [],
        'type' => [],
        'fieldset' => [],
        'general' => [],
    ], $placeholderHints);

    $catalog = [];

    foreach ($fieldTypes as $fieldType) {
        if (!is_array($fieldType)) {
            continue;
        }

        $fieldTypeId = null;
        if (isset($fieldType['id']) && is_int($fieldType['id'])) {
            $fieldTypeId = $fieldType['id'];
        } elseif (isset($fieldType['id']) && is_numeric($fieldType['id'])) {
            $fieldTypeId = (int) $fieldType['id'];
        }

        if ($fieldTypeId === null) {
            continue;
        }

        $fieldTypeKey = sanitizeFieldTypeKeyFromEntry($fieldType);
        if ($fieldTypeKey === '') {
            $fieldTypeKey = 'text-box';
        }

        $fieldTypeName = sanitizeFieldTypeNameFromEntry($fieldType);
        if ($fieldTypeName === '') {
            $fieldTypeName = $fieldTypeKey;
        }

        $itemsRaw = [];
        if (isset($fieldType['items']) && is_array($fieldType['items'])) {
            $itemsRaw = $fieldType['items'];
        }

        $parsedItems = [];
        foreach ($itemsRaw as $item) {
            if (!is_string($item)) {
                continue;
            }
            $parsed = parseFieldTypeItem($item);
            if ($parsed === null) {
                continue;
            }

            if ($parsed['kind'] === 'field' && isset($parsed['id'])) {
                $field = $fieldsById[$parsed['id']] ?? null;
                if (!$field && isset($parsed['label']) && is_string($parsed['label'])) {
                    $field = $fieldsByKey[strtolower($parsed['label'])] ?? null;
                }
                if ($field && isset($field['key'])) {
                    $parsed['field_key'] = $field['key'];
                }
            } elseif ($parsed['kind'] === 'fieldset' && isset($parsed['id'])) {
                $fieldset = $fieldsetsById[$parsed['id']] ?? null;
                if ($fieldset && isset($fieldset['key'])) {
                    $parsed['fieldset_key'] = $fieldset['key'];
                }
            }

            $parsedItems[] = $parsed;
        }

        $placeholder = resolvePlaceholderHint(
            $fieldTypeKey,
            $fieldTypeName,
            $parsedItems,
            $fieldsById,
            $fieldsetsById,
            $hints
        );

        $required = resolveFieldTypeRequired($parsedItems, $fieldsById, $fieldsetsById);
        $options = resolveFieldTypeOptions($fieldTypeKey, $parsedItems, $fieldsById, $fieldsetsById);

        $fieldDefinition = [
            'name' => $fieldTypeName,
            'type' => $fieldTypeKey,
            'placeholder' => $placeholder,
            'options' => $options,
        ];
        if ($required !== null) {
            $fieldDefinition['required'] = $required;
        }
        if ($fieldTypeKey === 'location') {
            $fieldDefinition['location'] = [
                'address' => '',
                'latitude' => '',
                'longitude' => '',
            ];
        }

        $sanitizedDefinition = sanitizeFieldBlueprint($fieldDefinition, $fieldTypeKey, $fieldTypeName);
        if ($sanitizedDefinition === null) {
            continue;
        }

        $catalog[$fieldTypeId] = [
            'fieldTypeId' => $fieldTypeId,
            'fieldTypeKey' => $fieldTypeKey,
            'fieldTypeName' => $fieldTypeName,
            'fields' => [$sanitizedDefinition],
            'items' => $parsedItems,
        ];
    }

    return $catalog;
}

function sanitizeFieldTypeKeyFromEntry(array $fieldType): string
{
    $candidates = [
        $fieldType['field_type_key'] ?? null,
        $fieldType['key'] ?? null,
        $fieldType['value'] ?? null,
        $fieldType['fieldTypeKey'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate)) {
            continue;
        }
        $trimmed = trim($candidate);
        if ($trimmed === '') {
            continue;
        }
        $normalized = strtolower(str_replace(' ', '_', $trimmed));
        $normalized = preg_replace('/[^a-z0-9_\-]+/', '_', $normalized);
        $normalized = preg_replace('/_+/', '_', $normalized);
        return trim($normalized, '_');
    }

    return '';
}

function sanitizeFieldTypeNameFromEntry(array $fieldType): string
{
    $candidates = [
        $fieldType['field_type_name'] ?? null,
        $fieldType['name'] ?? null,
        $fieldType['label'] ?? null,
        $fieldType['fieldTypeName'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate)) {
            continue;
        }
        $trimmed = trim($candidate);
        if ($trimmed !== '') {
            return $trimmed;
        }
    }

    return '';
}

function parseFieldTypeItem(string $item): ?array
{
    $trimmed = trim($item);
    if ($trimmed === '') {
        return null;
    }

    if (preg_match('/^(.*?)\s*\[(field|fieldset)=(\d+)\]\s*$/i', $trimmed, $matches)) {
        return [
            'label' => trim($matches[1]),
            'kind' => strtolower($matches[2]) === 'fieldset' ? 'fieldset' : 'field',
            'id' => (int) $matches[3],
        ];
    }

    return [
        'label' => $trimmed,
        'kind' => 'raw',
        'id' => null,
    ];
}

function resolvePlaceholderHint(
    string $fieldTypeKey,
    string $fieldTypeName,
    array $parsedItems,
    array $fieldsById,
    array $fieldsetsById,
    array $placeholderHints
): string {
    $typeKey = strtolower($fieldTypeKey);
    if ($typeKey !== '') {
        if (isset($placeholderHints['type'][$typeKey])) {
            return $placeholderHints['type'][$typeKey];
        }
        if (isset($placeholderHints['general'][$typeKey])) {
            return $placeholderHints['general'][$typeKey];
        }
    }

    $typeNameKey = strtolower($fieldTypeName);
    if ($typeNameKey !== '' && $typeNameKey !== $typeKey) {
        if (isset($placeholderHints['type'][$typeNameKey])) {
            return $placeholderHints['type'][$typeNameKey];
        }
        if (isset($placeholderHints['general'][$typeNameKey])) {
            return $placeholderHints['general'][$typeNameKey];
        }
    }

    foreach ($parsedItems as $item) {
        if (!is_array($item)) {
            continue;
        }

        if (($item['kind'] ?? null) === 'field') {
            $fieldKey = '';
            if (isset($item['field_key']) && is_string($item['field_key'])) {
                $fieldKey = strtolower(trim($item['field_key']));
            } elseif (isset($item['label']) && is_string($item['label'])) {
                $fieldKey = strtolower(trim($item['label']));
            }
            if ($fieldKey === '' && isset($item['id'])) {
                $field = $fieldsById[$item['id']] ?? null;
                if ($field && isset($field['key'])) {
                    $fieldKey = strtolower(trim((string) $field['key']));
                }
            }
            if ($fieldKey !== '' && isset($placeholderHints['field'][$fieldKey])) {
                return $placeholderHints['field'][$fieldKey];
            }
        } elseif (($item['kind'] ?? null) === 'fieldset') {
            $fieldset = null;
            if (isset($item['id']) && isset($fieldsetsById[$item['id']])) {
                $fieldset = $fieldsetsById[$item['id']];
            }
            if ($fieldset && isset($fieldset['key'])) {
                $fieldsetKey = strtolower(trim((string) $fieldset['key']));
                if ($fieldsetKey !== '' && isset($placeholderHints['fieldset'][$fieldsetKey])) {
                    return $placeholderHints['fieldset'][$fieldsetKey];
                }
            }
            if ($fieldset && isset($fieldset['field_ids']) && is_array($fieldset['field_ids'])) {
                foreach ($fieldset['field_ids'] as $fieldId) {
                    if (!is_int($fieldId)) {
                        continue;
                    }
                    $field = $fieldsById[$fieldId] ?? null;
                    if ($field && isset($field['key'])) {
                        $fieldKey = strtolower(trim((string) $field['key']));
                        if ($fieldKey !== '' && isset($placeholderHints['field'][$fieldKey])) {
                            return $placeholderHints['field'][$fieldKey];
                        }
                    }
                }
            }
        }
    }

    return '';
}

function resolveFieldTypeRequired(array $parsedItems, array $fieldsById, array $fieldsetsById): ?bool
{
    foreach ($parsedItems as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (($item['kind'] ?? null) === 'field' && isset($item['id']) && isset($fieldsById[$item['id']])) {
            $field = $fieldsById[$item['id']];
            if (isset($field['required'])) {
                if ($field['required']) {
                    return true;
                }
            }
        } elseif (($item['kind'] ?? null) === 'fieldset' && isset($item['id']) && isset($fieldsetsById[$item['id']])) {
            $fieldset = $fieldsetsById[$item['id']];
            if (isset($fieldset['field_ids']) && is_array($fieldset['field_ids'])) {
                foreach ($fieldset['field_ids'] as $fieldId) {
                    if (!is_int($fieldId) || !isset($fieldsById[$fieldId])) {
                        continue;
                    }
                    $field = $fieldsById[$fieldId];
                    if (isset($field['required']) && $field['required']) {
                        return true;
                    }
                }
            }
        }
    }

    foreach ($parsedItems as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (($item['kind'] ?? null) === 'field' && isset($item['id']) && isset($fieldsById[$item['id']])) {
            $field = $fieldsById[$item['id']];
            if (isset($field['required'])) {
                return (bool) $field['required'];
            }
        }
    }

    return null;
}

function resolveFieldTypeOptions(
    string $fieldTypeKey,
    array $parsedItems,
    array $fieldsById,
    array $fieldsetsById
): array {
    foreach ($parsedItems as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (($item['kind'] ?? null) === 'field' && isset($item['id']) && isset($fieldsById[$item['id']])) {
            $field = $fieldsById[$item['id']];
            if (isset($field['options']) && is_array($field['options']) && $field['options']) {
                return sanitizeFieldOptions($fieldTypeKey, $field['options']);
            }
        } elseif (($item['kind'] ?? null) === 'fieldset' && isset($item['id']) && isset($fieldsetsById[$item['id']])) {
            $fieldset = $fieldsetsById[$item['id']];
            if (isset($fieldset['field_ids']) && is_array($fieldset['field_ids'])) {
                foreach ($fieldset['field_ids'] as $fieldId) {
                    if (!is_int($fieldId) || !isset($fieldsById[$fieldId])) {
                        continue;
                    }
                    $field = $fieldsById[$fieldId];
                    if (isset($field['options']) && is_array($field['options']) && $field['options']) {
                        return sanitizeFieldOptions($fieldTypeKey, $field['options']);
                    }
                }
            }
        }
    }

    return [];
}

function sanitizeFieldBlueprint(array $field, ?string $typeFallback = null, ?string $nameFallback = null): ?array
{
    $type = '';
    if (isset($field['type']) && is_string($field['type'])) {
        $type = trim($field['type']);
    } elseif (is_string($typeFallback)) {
        $type = trim($typeFallback);
    }
    if ($type === '') {
        return null;
    }

    $name = '';
    if (isset($field['name']) && is_string($field['name'])) {
        $name = trim($field['name']);
    } elseif (is_string($nameFallback)) {
        $name = trim($nameFallback);
    }
    if ($name === '') {
        $name = ucfirst(str_replace(['_', '-'], ' ', $type));
    }

    $placeholder = '';
    if (isset($field['placeholder']) && is_string($field['placeholder'])) {
        $placeholder = $field['placeholder'];
    }

    $required = false;
    if (array_key_exists('required', $field)) {
        $required = (bool) $field['required'];
    }

    $options = [];
    if (isset($field['options'])) {
        $options = sanitizeFieldOptions($type, $field['options']);
    }

    $result = [
        'name' => $name,
        'type' => $type,
        'placeholder' => $placeholder,
        'options' => $options,
        'required' => $required,
    ];

    if ($type === 'location') {
        $result['location'] = mergeLocationBlueprint([
            'address' => '',
            'latitude' => '',
            'longitude' => '',
        ], $field['location'] ?? null);
    } elseif (isset($field['location'])) {
        $result['location'] = mergeLocationBlueprint([], $field['location']);
    }

    return $result;
}

function sanitizeFieldOptions(string $type, $options): array
{
    if (!is_array($options)) {
        if (is_string($options)) {
            $decoded = decodeJsonToArray($options);
            if (is_array($decoded)) {
                $options = $decoded;
            }
        } else {
            return [];
        }
    }

    if ($type === 'variant_pricing') {
        $normalized = [];
        foreach ($options as $option) {
            if (is_array($option)) {
                $normalized[] = [
                    'version' => isset($option['version']) ? (string) $option['version'] : '',
                    'currency' => isset($option['currency']) ? (string) $option['currency'] : '',
                    'price' => isset($option['price']) ? (string) $option['price'] : '',
                ];
            } elseif (is_string($option) || is_numeric($option)) {
                $value = trim((string) $option);
                $normalized[] = ['version' => $value, 'currency' => '', 'price' => ''];
            }
        }
        return $normalized;
    }

    if ($type === 'dropdown' || $type === 'radio-toggle' || $type === 'radio_toggle') {
        $normalized = [];
        foreach ($options as $option) {
            if (is_string($option) || is_numeric($option)) {
                $candidate = trim((string) $option);
                if ($candidate !== '') {
                    $normalized[] = $candidate;
                }
                continue;
            }
            if (is_array($option)) {
                $candidate = '';
                if (isset($option['label']) && is_string($option['label'])) {
                    $candidate = trim($option['label']);
                } elseif (isset($option['value']) && is_string($option['value'])) {
                    $candidate = trim($option['value']);
                } elseif (isset($option['name']) && is_string($option['name'])) {
                    $candidate = trim($option['name']);
                }
                if ($candidate !== '') {
                    $normalized[] = $candidate;
                }
            }
        }
        return $normalized;
    }

    if ($type === 'venues_sessions_pricing' || $type === 'checkout' || $type === 'checkout_table') {
        return sanitizeNestedFieldArray($options);
    }

    return sanitizeNestedFieldArray($options);
}

function sanitizeNestedFieldArray(array $value): array
{
    $result = [];
    foreach ($value as $key => $item) {
        if (is_array($item)) {
            $result[$key] = sanitizeNestedFieldArray($item);
        } elseif (is_string($item)) {
            $result[$key] = $item;
        } elseif (is_int($item) || is_float($item)) {
            $result[$key] = $item;
        } elseif (is_bool($item)) {
            $result[$key] = $item;
        } elseif ($item === null) {
            $result[$key] = '';
        }
    }

    return $result;
}

function mergeLocationBlueprint(array $base, $override): array
{
    $result = [
        'address' => isset($base['address']) && is_string($base['address']) ? $base['address'] : '',
        'latitude' => isset($base['latitude']) && is_string($base['latitude']) ? $base['latitude'] : '',
        'longitude' => isset($base['longitude']) && is_string($base['longitude']) ? $base['longitude'] : '',
    ];

    if (is_array($override)) {
        if (isset($override['address'])) {
            $result['address'] = (string) $override['address'];
        }
        if (isset($override['latitude'])) {
            $result['latitude'] = (string) $override['latitude'];
        }
        if (isset($override['longitude'])) {
            $result['longitude'] = (string) $override['longitude'];
        }
    }

    return $result;
}

function mergeFieldBlueprint(array $blueprint, ?array $override): array
{
    $sanitizedBlueprint = sanitizeFieldBlueprint($blueprint, $blueprint['type'] ?? null, $blueprint['name'] ?? null);
    if ($sanitizedBlueprint === null) {
        return [];
    }

    if ($override === null) {
        return $sanitizedBlueprint;
    }

    $merged = $sanitizedBlueprint;

    if (isset($override['name']) && is_string($override['name']) && $override['name'] !== '') {
        $merged['name'] = $override['name'];
    }
    if (isset($override['placeholder']) && is_string($override['placeholder'])) {
        $merged['placeholder'] = $override['placeholder'];
    }
    if (array_key_exists('required', $override)) {
        $merged['required'] = (bool) $override['required'];
    }
    if (isset($override['options'])) {
        $merged['options'] = sanitizeFieldOptions($merged['type'], $override['options']);
    } else {
        $merged['options'] = sanitizeFieldOptions($merged['type'], $merged['options']);
    }
    if ($merged['type'] === 'location') {
        $merged['location'] = mergeLocationBlueprint($merged['location'] ?? [
            'address' => '',
            'latitude' => '',
            'longitude' => '',
        ], $override['location'] ?? null);
    } elseif (isset($override['location'])) {
        $merged['location'] = mergeLocationBlueprint([], $override['location']);
    }

    return $merged;
}

function buildFieldsForSubcategory(array $fieldTypeIds, array $fieldTypeCatalog, array $metadata): array
{
    $overridesByType = [];
    $extraOverrides = [];
    if (isset($metadata['fields']) && is_array($metadata['fields'])) {
        foreach ($metadata['fields'] as $field) {
            if (!is_array($field)) {
                continue;
            }
            $sanitized = sanitizeFieldBlueprint($field, $field['type'] ?? null, $field['name'] ?? null);
            if ($sanitized === null) {
                continue;
            }
            $typeKey = strtolower($sanitized['type']);
            if ($typeKey !== '' && !isset($overridesByType[$typeKey])) {
                $overridesByType[$typeKey] = $sanitized;
            } else {
                $extraOverrides[] = $sanitized;
            }
        }
    }

    $fields = [];

    foreach ($fieldTypeIds as $fieldTypeId) {
        if (!isset($fieldTypeCatalog[$fieldTypeId])) {
            continue;
        }
        $entry = $fieldTypeCatalog[$fieldTypeId];
        $catalogFields = isset($entry['fields']) && is_array($entry['fields']) ? $entry['fields'] : [];
        foreach ($catalogFields as $catalogField) {
            if (!is_array($catalogField)) {
                continue;
            }
            $typeKey = isset($catalogField['type']) ? strtolower((string) $catalogField['type']) : '';
            $override = null;
            if ($typeKey !== '' && isset($overridesByType[$typeKey])) {
                $override = $overridesByType[$typeKey];
                unset($overridesByType[$typeKey]);
            }
            $merged = mergeFieldBlueprint($catalogField, $override);
            if ($merged) {
                $fields[] = $merged;
            }
        }
    }

    foreach ($overridesByType as $override) {
        if (is_array($override) && isset($override['type'])) {
            $fields[] = $override;
        }
    }

    foreach ($extraOverrides as $override) {
        if (is_array($override) && isset($override['type'])) {
            $fields[] = $override;
        }
    }

    return $fields;
}

function buildSnapshot(array $categories, array $subcategories, array $fieldTypeCatalog): array
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

        $fields = buildFieldsForSubcategory($fieldTypeIds, $fieldTypeCatalog, $metadata);

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
