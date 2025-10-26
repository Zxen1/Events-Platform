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

    $configPath = __DIR__ . '/../config/config-db.php';
    if (!is_file($configPath)) {
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

    if (in_array('id', $columns, true)) {
        $selectColumns[] = '`id`';
    }
    if (in_array('name', $columns, true)) {
        $selectColumns[] = '`name`';
    }
    if (in_array('sort_order', $columns, true)) {
        $selectColumns[] = '`sort_order`';
        $orderBy = ' ORDER BY `sort_order` ASC';
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
        $categories[] = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'name' => (string) $row['name'],
            'sort_order' => isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'subs' => [],
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
    $select = ['s.`id`', 's.`name`'];

    $hasCategoryName = in_array('category_name', $columns, true);
    $hasCategoryId = in_array('category_id', $columns, true);
    $hasSortOrder = in_array('sort_order', $columns, true);
    $hasMetadata = in_array('metadata_json', $columns, true);

    if ($hasCategoryName) {
        $select[] = 's.`category_name`';
    }
    if ($hasCategoryId) {
        $select[] = 's.`category_id`';
    }
    if (!$hasCategoryName && $hasCategoryId) {
        $select[] = 'c.`name` AS category_name';
    }
    if ($hasSortOrder) {
        $select[] = 's.`sort_order`';
    }
    if ($hasMetadata) {
        $select[] = 's.`metadata_json`';
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
    $order[] = 's.`name` ASC';

    $sql = 'SELECT ' . implode(', ', $select) . ' FROM subcategories s';
    if (!$hasCategoryName && $hasCategoryId) {
        $sql .= ' JOIN categories c ON c.id = s.category_id';
    }
    $sql .= ' ORDER BY ' . implode(', ', $order);

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
            'sort_order' => $hasSortOrder && isset($row['sort_order']) ? (int) $row['sort_order'] : null,
            'metadata' => $metadata,
        ];
    }

    return $results;
}

function buildSnapshot(array $categories, array $subcategories): array
{
    $categoriesMap = [];
    foreach ($categories as $category) {
        $categoriesMap[$category['name']] = [
            'name' => $category['name'],
            'subs' => [],
            'subFields' => [],
        ];
    }

    $categoryShapes = [];
    $subcategoryIcons = [];
    $subcategoryMarkers = [];
    $subcategoryMarkerIds = [];
    $currencySet = [];

    foreach ($subcategories as $sub) {
        $categoryName = $sub['category'];
        if (!isset($categoriesMap[$categoryName])) {
            $categoriesMap[$categoryName] = [
                'name' => $categoryName,
                'subs' => [],
                'subFields' => [],
            ];
        }

        $categoriesMap[$categoryName]['subs'][] = [
            'name' => $sub['name'],
            'sort_order' => $sub['sort_order'],
        ];

        $fields = [];
        $metadata = $sub['metadata'];
        if (isset($metadata['fields']) && is_array($metadata['fields'])) {
            $fields = $metadata['fields'];
        }
        $categoriesMap[$categoryName]['subFields'][$sub['name']] = $fields;

        if (isset($metadata['icon']) && is_string($metadata['icon']) && $metadata['icon'] !== '') {
            $subcategoryIcons[$sub['name']] = $metadata['icon'];
        }
        if (isset($metadata['marker']) && is_string($metadata['marker']) && $metadata['marker'] !== '') {
            $subcategoryMarkers[$sub['name']] = $metadata['marker'];
        }
        if (isset($metadata['markerId']) && is_string($metadata['markerId']) && $metadata['markerId'] !== '') {
            $subcategoryMarkerIds[$sub['name']] = $metadata['markerId'];
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
        }
    }
    unset($category);

    $categoriesList = array_values($categoriesMap);

    usort($categoriesList, static function (array $a, array $b): int {
        return strcasecmp($a['name'], $b['name']);
    });

    $versionPriceCurrencies = array_keys($currencySet);
    sort($versionPriceCurrencies);

    return [
        'categories' => $categoriesList,
        'subcategoryIcons' => $subcategoryIcons,
        'subcategoryMarkers' => sanitizeSubcategoryMarkers($subcategoryMarkers),
        'subcategoryMarkerIds' => $subcategoryMarkerIds,
        'categoryShapes' => $categoryShapes,
        'versionPriceCurrencies' => $versionPriceCurrencies,
    ];
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

        $slug = slugify_key($name);
        if ($slug === '') {
            continue;
        }

        $clean[$slug] = $trimmed;
    }

    return $clean;
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
