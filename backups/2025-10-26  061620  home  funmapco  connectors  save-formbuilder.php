<?php
declare(strict_types=1);

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
        return;
    }

    $rawBody = file_get_contents('php://input');
    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid JSON payload'
        ]);
        return;
    }

    if (!isset($decoded['categories']) || !is_array($decoded['categories'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing categories payload'
        ]);
        return;
    }

    $configPath = __DIR__ . '/../config/config-db.php';
    if (!is_file($configPath)) {
        throw new RuntimeException('Database configuration file is missing.');
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
        throw new RuntimeException('Database connection not configured.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $categoryColumns = fetchTableColumns($pdo, 'categories');
    $subcategoryColumns = fetchTableColumns($pdo, 'subcategories');
    if (!$subcategoryColumns) {
        throw new RuntimeException('Subcategories table is unavailable.');
    }

    $categoriesByName = fetchCategoriesByName($pdo, $categoryColumns);
    $subcategoriesByKey = fetchSubcategoriesByCompositeKey($pdo, $subcategoryColumns);
    $fieldCatalog = fetchFieldCatalog($pdo);

    $versionCurrencies = [];
    if (isset($decoded['versionPriceCurrencies']) && is_array($decoded['versionPriceCurrencies'])) {
        foreach ($decoded['versionPriceCurrencies'] as $code) {
            $normalized = strtoupper(trim((string) $code));
            if ($normalized !== '' && !in_array($normalized, $versionCurrencies, true)) {
                $versionCurrencies[] = $normalized;
            }
        }
    }

    $subcategoryIcons = [];
    if (isset($decoded['subcategoryIcons']) && is_array($decoded['subcategoryIcons'])) {
        $subcategoryIcons = $decoded['subcategoryIcons'];
    }
    $subcategoryMarkers = [];
    if (isset($decoded['subcategoryMarkers']) && is_array($decoded['subcategoryMarkers'])) {
        $subcategoryMarkers = $decoded['subcategoryMarkers'];
    }
    $subcategoryMarkerIds = [];
    if (isset($decoded['subcategoryMarkerIds']) && is_array($decoded['subcategoryMarkerIds'])) {
        $subcategoryMarkerIds = $decoded['subcategoryMarkerIds'];
    }
    $categoryShapes = [];
    if (isset($decoded['categoryShapes']) && is_array($decoded['categoryShapes'])) {
        $categoryShapes = $decoded['categoryShapes'];
    }

    $updated = [];
    $pdo->beginTransaction();

    foreach ($decoded['categories'] as $categoryPayload) {
        if (!is_array($categoryPayload)) {
            continue;
        }
        $categoryName = sanitizeString($categoryPayload['name'] ?? '');
        if ($categoryName === '') {
            continue;
        }
        $categoryKey = mb_strtolower($categoryName);
        if (!isset($categoriesByName[$categoryKey])) {
            throw new RuntimeException(sprintf('Unknown category "%s".', $categoryName));
        }
        $categoryRow = $categoriesByName[$categoryKey];

        $subs = $categoryPayload['subs'] ?? [];
        if (!is_array($subs)) {
            $subs = [];
        }
        $subFieldsMap = $categoryPayload['subFields'] ?? [];
        if (!is_array($subFieldsMap)) {
            $subFieldsMap = [];
        }

        foreach (array_values($subs) as $index => $subNameRaw) {
            $subName = sanitizeString($subNameRaw);
            if ($subName === '') {
                continue;
            }
            $canonicalSubName = normalizeSubcategoryCanonicalName($categoryName, $subName);
            $compositeKey = mb_strtolower($categoryName . '::' . $canonicalSubName);
            $subcategoryRow = $subcategoriesByKey[$compositeKey] ?? null;
            if (!$subcategoryRow) {
                $slugCategory = slugify_key($categoryName);
                $slugSub = slugify_key($canonicalSubName);
                if ($slugCategory !== '' && $slugSub !== '') {
                    $slugKey = $slugCategory . '::' . $slugSub;
                    $subcategoryRow = $subcategoriesByKey[$slugKey] ?? null;
                }
            }
            if (!$subcategoryRow) {
                throw new RuntimeException(sprintf('Unknown subcategory "%s" within "%s".', $subName, $categoryName));
            }

            $fieldsPayload = $subFieldsMap[$subName] ?? [];
            if (!is_array($fieldsPayload)) {
                $fieldsPayload = [];
            }
            $sanitizedFields = [];
            foreach ($fieldsPayload as $fieldPayload) {
                if (!is_array($fieldPayload)) {
                    continue;
                }
                $sanitizedFields[] = sanitizeField($fieldPayload);
            }

            $fieldNames = [];
            $fieldIds = [];
            foreach ($sanitizedFields as $field) {
                $fieldNames[] = $field['name'] !== '' ? $field['name'] : $field['type'];
                $matchedId = matchFieldId($fieldCatalog, $field);
                if ($matchedId !== null) {
                    $fieldIds[] = $matchedId;
                }
            }

            $meta = [
                'category' => $categoryName,
                'subcategory' => $subName,
                'fields' => $sanitizedFields,
                'versionPriceCurrencies' => $versionCurrencies,
                'icon' => sanitizeIcon($subcategoryIcons[$subName] ?? ''),
                'marker' => sanitizeString($subcategoryMarkers[$subName] ?? '', 512),
                'markerId' => sanitizeString($subcategoryMarkerIds[$subName] ?? '', 128),
                'categoryShape' => sanitizeMixed($categoryShapes[$categoryName] ?? null),
                'updatedAt' => gmdate('c'),
            ];

            $updateParts = [];
            $params = [':id' => $subcategoryRow['id']];

            if (in_array('field_names', $subcategoryColumns, true)) {
                $updateParts[] = 'field_names = :field_names';
                $params[':field_names'] = json_encode($fieldNames, JSON_UNESCAPED_UNICODE);
            }
            if (in_array('field_ids', $subcategoryColumns, true)) {
                $updateParts[] = 'field_ids = :field_ids';
                $params[':field_ids'] = json_encode($fieldIds, JSON_UNESCAPED_UNICODE);
            }
            if (in_array('sort_order', $subcategoryColumns, true)) {
                $updateParts[] = 'sort_order = :sort_order';
                $params[':sort_order'] = $index + 1;
            }
            if (in_array('metadata_json', $subcategoryColumns, true)) {
                $updateParts[] = 'metadata_json = :metadata_json';
                $params[':metadata_json'] = json_encode($meta, JSON_UNESCAPED_UNICODE);
            }

            if (!$updateParts) {
                throw new RuntimeException('Unable to persist formbuilder state: no writable columns available.');
            }

            $sql = 'UPDATE subcategories SET ' . implode(', ', $updateParts) . ' WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $updated[] = (int) $subcategoryRow['id'];
        }
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'updated' => count($updated),
        'subcategory_ids' => $updated,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

function sanitizeString($value, int $maxLength = 255): string
{
    $string = trim((string) $value);
    if ($maxLength > 0 && mb_strlen($string) > $maxLength) {
        $string = mb_substr($string, 0, $maxLength);
    }
    return $string;
}

function sanitizeBool($value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_string($value)) {
        $value = strtolower(trim($value));
        return in_array($value, ['1', 'true', 'yes', 'on'], true);
    }
    return (bool) $value;
}

function sanitizeMixed($value, int $depth = 0)
{
    if ($depth > 10) {
        return null;
    }
    if (is_array($value)) {
        $out = [];
        foreach ($value as $key => $item) {
            $out[$key] = sanitizeMixed($item, $depth + 1);
        }
        return $out;
    }
    if (is_object($value)) {
        $out = [];
        foreach (get_object_vars($value) as $key => $item) {
            $out[$key] = sanitizeMixed($item, $depth + 1);
        }
        return $out;
    }
    if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
        return $value;
    }
    return sanitizeString((string) $value, 512);
}

function sanitizeIcon($value): string
{
    $value = (string) $value;
    if ($value === '') {
        return '';
    }
    $allowed = '<img>';
    $clean = strip_tags($value, $allowed);
    return sanitizeString($clean, 512);
}

function sanitizeField(array $field): array
{
    $allowedTypes = [
        'title',
        'description',
        'text-box',
        'text-area',
        'dropdown',
        'radio-toggle',
        'email',
        'phone',
        'website-url',
        'tickets-url',
        'images',
        'coupon',
        'version-price',
        'checkout',
        'venue-session-version-tier-price',
    ];

    $safe = [
        'id' => sanitizeString($field['id'] ?? '', 128),
        'name' => sanitizeString($field['name'] ?? ''),
        'type' => sanitizeString($field['type'] ?? 'text-box', 64),
        'placeholder' => sanitizeString($field['placeholder'] ?? '', 512),
        'required' => sanitizeBool($field['required'] ?? false),
    ];

    if (!in_array($safe['type'], $allowedTypes, true)) {
        $safe['type'] = 'text-box';
    }

    if ($safe['id'] === '') {
        unset($safe['id']);
    }

    $options = $field['options'] ?? [];
    if (!is_array($options)) {
        $options = [];
    }

    switch ($safe['type']) {
        case 'version-price':
            $safe['options'] = sanitizeVersionPriceOptions($options);
            break;
        case 'dropdown':
        case 'radio-toggle':
            $safe['options'] = sanitizeOptionList($options);
            break;
        case 'venue-session-version-tier-price':
            $safe['options'] = sanitizeVenueOptions($options);
            break;
        default:
            $safe['options'] = sanitizeGenericOptions($options);
            break;
    }

    if (isset($field['metadata'])) {
        $safe['metadata'] = sanitizeMixed($field['metadata']);
    }
    if (isset($field['helpText'])) {
        $safe['helpText'] = sanitizeString($field['helpText'], 512);
    }

    return $safe;
}

function sanitizeOptionList(array $options): array
{
    $clean = [];
    foreach ($options as $option) {
        if (is_string($option) || is_numeric($option)) {
            $value = sanitizeString($option);
        } elseif (is_array($option)) {
            $value = sanitizeString($option['value'] ?? $option['label'] ?? $option['version'] ?? '', 255);
        } else {
            $value = '';
        }
        if ($value !== '') {
            $clean[] = $value;
        }
    }
    return $clean;
}

function sanitizeGenericOptions(array $options): array
{
    $clean = [];
    foreach ($options as $option) {
        if (is_array($option)) {
            $clean[] = sanitizeMixed($option);
        } elseif ($option !== null) {
            $clean[] = sanitizeString((string) $option, 255);
        }
    }
    return $clean;
}

function sanitizeVersionPriceOptions(array $options): array
{
    $clean = [];
    foreach ($options as $option) {
        if (!is_array($option)) {
            continue;
        }
        $clean[] = [
            'version' => sanitizeString($option['version'] ?? '', 255),
            'currency' => strtoupper(sanitizeString($option['currency'] ?? '', 12)),
            'price' => sanitizeString($option['price'] ?? '', 64),
        ];
    }
    return $clean;
}

function sanitizeVenueOptions(array $options): array
{
    $venues = [];
    foreach ($options as $venue) {
        if (!is_array($venue)) {
            continue;
        }
        $venues[] = [
            'name' => sanitizeString($venue['name'] ?? ''),
            'address' => sanitizeString($venue['address'] ?? ''),
            'location' => sanitizeLocation($venue['location'] ?? null),
            'feature' => sanitizeFeature($venue['feature'] ?? null),
            'sessions' => sanitizeSessions($venue['sessions'] ?? []),
        ];
    }
    return $venues;
}

function sanitizeLocation($location): ?array
{
    if (!is_array($location)) {
        return null;
    }
    $lat = isset($location['lat']) ? (float) $location['lat'] : null;
    $lng = isset($location['lng']) ? (float) $location['lng'] : null;
    if ($lat === null && $lng === null) {
        return null;
    }
    return [
        'lat' => $lat,
        'lng' => $lng,
    ];
}

function sanitizeFeature($feature): ?array
{
    if (!is_array($feature)) {
        return null;
    }
    $type = sanitizeString($feature['type'] ?? '', 64);
    $id = sanitizeString($feature['id'] ?? '', 128);
    if ($type === '' && $id === '') {
        return null;
    }
    return [
        'type' => $type,
        'id' => $id,
    ];
}

function sanitizeSessions($sessions): array
{
    if (!is_array($sessions)) {
        return [];
    }
    $clean = [];
    foreach ($sessions as $session) {
        if (!is_array($session)) {
            continue;
        }
        $clean[] = [
            'date' => sanitizeString($session['date'] ?? '', 64),
            'times' => sanitizeTimes($session['times'] ?? []),
        ];
    }
    return $clean;
}

function sanitizeTimes($times): array
{
    if (!is_array($times)) {
        return [];
    }
    $clean = [];
    foreach ($times as $time) {
        if (!is_array($time)) {
            continue;
        }
        $clean[] = [
            'time' => sanitizeString($time['time'] ?? '', 64),
            'samePricingAsAbove' => sanitizeBool($time['samePricingAsAbove'] ?? false),
            'samePricingSourceIndex' => max(0, (int) ($time['samePricingSourceIndex'] ?? 0)),
            'tierAutofillLocked' => sanitizeBool($time['tierAutofillLocked'] ?? false),
            'versions' => sanitizeVersions($time['versions'] ?? []),
        ];
    }
    return $clean;
}

function sanitizeVersions($versions): array
{
    if (!is_array($versions)) {
        return [];
    }
    $clean = [];
    foreach ($versions as $version) {
        if (!is_array($version)) {
            continue;
        }
        $clean[] = [
            'name' => sanitizeString($version['name'] ?? '', 255),
            'tiers' => sanitizeTiers($version['tiers'] ?? []),
        ];
    }
    return $clean;
}

function sanitizeTiers($tiers): array
{
    if (!is_array($tiers)) {
        return [];
    }
    $clean = [];
    foreach ($tiers as $tier) {
        if (!is_array($tier)) {
            continue;
        }
        $clean[] = [
            'name' => sanitizeString($tier['name'] ?? '', 255),
            'currency' => strtoupper(sanitizeString($tier['currency'] ?? '', 12)),
            'price' => sanitizeString($tier['price'] ?? '', 64),
        ];
    }
    return $clean;
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

function fetchCategoriesByName(PDO $pdo, array $columns): array
{
    if (!$columns || !in_array('name', $columns, true)) {
        return [];
    }
    $sql = 'SELECT id, name FROM categories';
    $stmt = $pdo->query($sql);
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['name'], $row['id'])) {
            continue;
        }
        $map[mb_strtolower($row['name'])] = [
            'id' => (int) $row['id'],
            'name' => $row['name'],
        ];
    }
    return $map;
}

function fetchSubcategoriesByCompositeKey(PDO $pdo, array $columns): array
{
    if (!$columns || !in_array('name', $columns, true) || !in_array('category_name', $columns, true)) {
        $sql = 'SELECT s.id, s.name, c.name AS category_name FROM subcategories s JOIN categories c ON c.id = s.category_id';
    } else {
        $sql = 'SELECT id, name, category_name FROM subcategories';
    }

    $stmt = $pdo->query($sql);
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['name'], $row['category_name'], $row['id'])) {
            continue;
        }
        $normalizedCategory = mb_strtolower($row['category_name']);
        $normalizedSub = mb_strtolower($row['name']);
        $rowData = [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'category_name' => $row['category_name'],
        ];
        $primaryKey = $normalizedCategory . '::' . $normalizedSub;
        $map[$primaryKey] = $rowData;

        $slugCategory = slugify_key($row['category_name']);
        $slugSub = slugify_key($row['name']);
        if ($slugCategory !== '' && $slugSub !== '') {
            $map[$slugCategory . '::' . $slugSub] = $rowData;
        }

        foreach (getSubcategoryAliasNames($row['category_name'], $row['name']) as $aliasName) {
            $aliasNormalized = mb_strtolower($aliasName);
            $map[$normalizedCategory . '::' . $aliasNormalized] = $rowData;
            $aliasSlug = slugify_key($aliasName);
            if ($slugCategory !== '' && $aliasSlug !== '') {
                $map[$slugCategory . '::' . $aliasSlug] = $rowData;
            }
        }
    }
    return $map;
}

function fetchFieldCatalog(PDO $pdo): array
{
    try {
        $columns = fetchTableColumns($pdo, 'fields');
        if (!$columns || !in_array('id', $columns, true)) {
            return [];
        }
        $selectColumns = array_map(fn($col) => '`' . str_replace('`', '``', $col) . '`', $columns);
        $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM fields';
        $stmt = $pdo->query($sql);
        $catalog = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['id'])) {
                continue;
            }
            $values = [];
            foreach ($row as $key => $value) {
                if ($key === 'id') {
                    continue;
                }
                if (is_string($value) && $value !== '') {
                    $values[] = mb_strtolower(trim($value));
                }
            }
            $catalog[] = [
                'id' => (int) $row['id'],
                'values' => array_unique($values),
            ];
        }
        return $catalog;
    } catch (PDOException $e) {
        return [];
    }
}

function matchFieldId(array $catalog, array $field): ?int
{
    $candidates = [];
    if (isset($field['id']) && $field['id'] !== '') {
        $candidates[] = mb_strtolower((string) $field['id']);
    }
    if (isset($field['name']) && $field['name'] !== '') {
        $candidates[] = mb_strtolower($field['name']);
    }
    if (isset($field['type']) && $field['type'] !== '') {
        $candidates[] = mb_strtolower($field['type']);
    }

    foreach ($catalog as $row) {
        if (!isset($row['id'], $row['values']) || !is_array($row['values'])) {
            continue;
        }
        foreach ($row['values'] as $value) {
            if (in_array($value, $candidates, true)) {
                return (int) $row['id'];
            }
        }
    }
    return null;
}

function getSubcategoryAliasDefinitions(): array
{
    return [
        "what's on" => [
            'Other' => ['Other Events'],
        ],
        'opportunities' => [
            'Other' => ['Other Opportunities'],
        ],
        'learning' => [
            'Other' => ['Other Learning'],
        ],
    ];
}

function getSubcategoryAliasNames(string $categoryName, string $canonicalName): array
{
    $definitions = getSubcategoryAliasDefinitions();
    $categoryKey = mb_strtolower($categoryName);
    $canonicalKey = mb_strtolower($canonicalName);
    if (!isset($definitions[$categoryKey])) {
        return [];
    }
    foreach ($definitions[$categoryKey] as $canonical => $aliases) {
        if (mb_strtolower($canonical) === $canonicalKey) {
            return $aliases;
        }
    }
    return [];
}

function normalizeSubcategoryCanonicalName(string $categoryName, string $subName): string
{
    $definitions = getSubcategoryAliasDefinitions();
    $categoryKey = mb_strtolower($categoryName);
    $subKey = mb_strtolower($subName);
    if (!isset($definitions[$categoryKey])) {
        return $subName;
    }
    foreach ($definitions[$categoryKey] as $canonical => $aliases) {
        if (mb_strtolower($canonical) === $subKey) {
            return $canonical;
        }
        foreach ($aliases as $alias) {
            if (mb_strtolower($alias) === $subKey) {
                return $canonical;
            }
        }
    }
    return $subName;
}

function slugify_key(string $value): string
{
    $normalized = trim($value);
    if ($normalized === '') {
        return '';
    }
    if (class_exists('Normalizer')) {
        $normalized = Normalizer::normalize($normalized, Normalizer::FORM_D);
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
    return trim($normalized, '-');
}
