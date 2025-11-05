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
    $categoriesByKey = fetchCategoriesByKey($pdo, $categoryColumns);
    $categoriesById = fetchCategoriesById($pdo, $categoryColumns);
    $subcategoriesByKey = fetchSubcategoriesByCompositeKey($pdo, $subcategoryColumns);
    $subcategoriesById = fetchSubcategoriesById($pdo, $subcategoryColumns);
    $fieldCatalog = fetchFieldCatalog($pdo);
    $fieldTypeDefinitions = fetchFieldTypeDefinitions($pdo);

    $versionCurrencies = [];
    if (isset($decoded['versionPriceCurrencies']) && is_array($decoded['versionPriceCurrencies'])) {
        foreach ($decoded['versionPriceCurrencies'] as $code) {
            $normalized = strtoupper(trim((string) $code));
            if ($normalized !== '' && !in_array($normalized, $versionCurrencies, true)) {
                $versionCurrencies[] = $normalized;
            }
        }
    }

    $categoryIconsPayload = [];
    if (isset($decoded['categoryIcons']) && is_array($decoded['categoryIcons'])) {
        $categoryIconsPayload = $decoded['categoryIcons'];
    }

    $subcategoryIcons = [];
    if (isset($decoded['subcategoryIcons']) && is_array($decoded['subcategoryIcons'])) {
        $subcategoryIcons = $decoded['subcategoryIcons'];
    }

    $categoryIconPaths = [];
    if (isset($decoded['categoryIconPaths']) && is_array($decoded['categoryIconPaths'])) {
        $categoryIconPaths = normalizeIconMap($decoded['categoryIconPaths']);
    }

    $subcategoryIconPaths = [];
    if (isset($decoded['subcategoryIconPaths']) && is_array($decoded['subcategoryIconPaths'])) {
        $subcategoryIconPaths = normalizeIconMap($decoded['subcategoryIconPaths']);
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
    $iconLibrary = [];
    if (isset($decoded['iconLibrary']) && is_array($decoded['iconLibrary'])) {
        foreach ($decoded['iconLibrary'] as $entry) {
            if (!is_string($entry)) {
                continue;
            }
            $clean = sanitizeIconPath($entry);
            if ($clean === '') {
                continue;
            }
            $normalized = normalizeMarkerIconPath($clean);
            if ($normalized === '') {
                $normalized = $clean;
            }
            $iconLibrary[$normalized] = true;
        }
    }
    $iconLibrary = array_values(array_keys($iconLibrary));

    $updated = [];
    $pdo->beginTransaction();

    $categorySortSupported = in_array('sort_order', $categoryColumns, true);
    $categorySortUpdates = [];
    $categoryOrder = 0;
    foreach ($decoded['categories'] as $categoryPayload) {
        if (!is_array($categoryPayload)) {
            continue;
        }

        $categoryId = filterPositiveInt($categoryPayload['id'] ?? null);
        $categoryName = sanitizeString($categoryPayload['name'] ?? '');
        $categoryKey = sanitizeKey($categoryPayload['key'] ?? '');

        $categoryRow = null;
        $originalCategoryName = $categoryName;
        $originalCategoryKey = $categoryKey;

        if ($categoryId !== null && isset($categoriesById[$categoryId])) {
            $categoryRow = $categoriesById[$categoryId];
            $originalCategoryName = isset($categoryRow['name']) ? (string) $categoryRow['name'] : $categoryName;
            if (isset($categoryRow['category_key']) && is_string($categoryRow['category_key'])) {
                $originalCategoryKey = sanitizeKey($categoryRow['category_key']);
            }
        } elseif ($categoryKey !== '' && isset($categoriesByKey[$categoryKey])) {
            $categoryRow = $categoriesByKey[$categoryKey];
            $categoryId = (int) $categoryRow['id'];
            $originalCategoryName = isset($categoryRow['name']) ? (string) $categoryRow['name'] : $categoryName;
            $originalCategoryKey = isset($categoryRow['category_key']) ? sanitizeKey((string) $categoryRow['category_key']) : $categoryKey;
        } elseif ($categoryName !== '') {
            $categoryLookup = mb_strtolower($categoryName);
            if (isset($categoriesByName[$categoryLookup])) {
                $categoryRow = $categoriesByName[$categoryLookup];
                $categoryId = (int) $categoryRow['id'];
                $originalCategoryName = isset($categoryRow['name']) ? (string) $categoryRow['name'] : $categoryName;
                if (isset($categoryRow['category_key'])) {
                    $originalCategoryKey = sanitizeKey((string) $categoryRow['category_key']);
                }
            }
        }

        if (!$categoryRow || !isset($categoryId)) {
            $label = $categoryName !== '' ? $categoryName : ($categoryId !== null ? (string) $categoryId : '');
            throw new RuntimeException(sprintf('Unknown category "%s".', $label));
        }

        if ($categoryName === '') {
            $categoryName = $originalCategoryName;
        }
        if ($categoryKey === '') {
            $categoryKey = $originalCategoryKey !== '' ? $originalCategoryKey : sanitizeKey($categoryName);
        }

        if ($categorySortSupported) {
            $categorySortUpdates[] = [
                'id' => $categoryId,
                'sort_order' => $categoryOrder + 1,
            ];
        }
        $categoryOrder++;

        $resolvedCategoryIconPath = resolveIconPath($categoryIconPaths, $categoryId, $categoryName, $categoryKey);
        if ($resolvedCategoryIconPath === '' && $categoryKey !== '' && isset($categoryIconsPayload[$categoryKey])) {
            $resolvedCategoryIconPath = extractIconSrcFromHtml($categoryIconsPayload[$categoryKey]);
        }
        if ($resolvedCategoryIconPath === '' && $originalCategoryName !== '' && isset($categoryIconsPayload[$originalCategoryName])) {
            $resolvedCategoryIconPath = extractIconSrcFromHtml($categoryIconsPayload[$originalCategoryName]);
        }
        if ($resolvedCategoryIconPath === '' && isset($categoryRow['icon_path'])) {
            $resolvedCategoryIconPath = sanitizeIconPath($categoryRow['icon_path']);
        }
        $categoryIconVariants = deriveIconVariants($resolvedCategoryIconPath);

        $categoryUpdateParts = [];
        $categoryParams = [':id' => $categoryId];
        $categoryNameColumn = null;
        if (in_array('name', $categoryColumns, true)) {
            $categoryNameColumn = 'name';
        } elseif (in_array('category_name', $categoryColumns, true)) {
            $categoryNameColumn = 'category_name';
        }
        if ($categoryNameColumn !== null && $categoryName !== '' && $categoryName !== $originalCategoryName) {
            $categoryUpdateParts[] = $categoryNameColumn . ' = :category_name';
            $categoryParams[':category_name'] = $categoryName;
        }
        if (in_array('icon_path', $categoryColumns, true)) {
            $categoryUpdateParts[] = 'icon_path = :category_icon_path';
            $categoryParams[':category_icon_path'] = $categoryIconVariants['icon'];
        }
        if (in_array('mapmarker_path', $categoryColumns, true)) {
            $categoryUpdateParts[] = 'mapmarker_path = :category_marker_path';
            $categoryParams[':category_marker_path'] = $categoryIconVariants['marker'];
        }
        if ($categoryKey !== '' && in_array('category_key', $categoryColumns, true)) {
            $categoryUpdateParts[] = 'category_key = :category_key';
            $categoryParams[':category_key'] = $categoryKey;
        }

        if ($categoryUpdateParts) {
            $sql = 'UPDATE categories SET ' . implode(', ', $categoryUpdateParts) . ' WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($categoryParams);
        }

        $categoriesById[$categoryId]['name'] = $categoryName;
        $categoriesById[$categoryId]['category_name'] = $categoryName;
        $categoriesById[$categoryId]['category_key'] = $categoryKey;
        $categoriesByName[mb_strtolower($categoryName)] = ['id' => $categoryId, 'name' => $categoryName, 'category_key' => $categoryKey];
        if ($categoryKey !== '') {
            $categoriesByKey[$categoryKey] = ['id' => $categoryId, 'name' => $categoryName, 'category_key' => $categoryKey];
        }

        $subs = $categoryPayload['subs'] ?? [];
        if (!is_array($subs)) {
            $subs = [];
        }
        $subFieldsMap = $categoryPayload['subFields'] ?? [];
        if (!is_array($subFieldsMap)) {
            $subFieldsMap = [];
        }
        $hasSubFieldsInPayload = !empty($subFieldsMap);
        $subFieldTypesMap = $categoryPayload['subFieldTypes'] ?? [];
        if (!is_array($subFieldTypesMap)) {
            $subFieldTypesMap = [];
        }
        $hasSubFieldTypesInPayload = !empty($subFieldTypesMap);
        $subIdMap = [];
        if (isset($categoryPayload['subIds']) && is_array($categoryPayload['subIds'])) {
            foreach ($categoryPayload['subIds'] as $key => $value) {
                $stringKey = is_string($key) || is_int($key) ? (string) $key : '';
                if ($stringKey === '') {
                    continue;
                }
                $idValue = filterPositiveInt($value);
                if ($idValue === null) {
                    continue;
                }
                $nameKey = sanitizeString($stringKey);
                if ($nameKey !== '') {
                    $subIdMap[$nameKey] = $idValue;
                }
                $normalizedKey = sanitizeKey($stringKey);
                if ($normalizedKey !== '') {
                    $subIdMap[$normalizedKey] = $idValue;
                }
            }
        }

        foreach (array_values($subs) as $index => $subEntry) {
            $subName = '';
            $subKey = '';
            $subId = null;
            $fieldTypeIds = [];

            if (is_array($subEntry)) {
                $subName = sanitizeString($subEntry['name'] ?? '');
                $subKey = sanitizeKey($subEntry['key'] ?? '');
                $subId = filterPositiveInt($subEntry['id'] ?? null);
                if (isset($subEntry['fieldTypeIds']) && is_array($subEntry['fieldTypeIds'])) {
                    foreach ($subEntry['fieldTypeIds'] as $typeId) {
                        if (is_int($typeId)) {
                            $fieldTypeIds[] = $typeId;
                        } elseif (is_string($typeId) && preg_match('/^\d+$/', $typeId)) {
                            $fieldTypeIds[] = (int) $typeId;
                        }
                    }
                }
            } else {
                $subName = sanitizeString($subEntry);
            }

            if ($subKey === '' && $subName !== '') {
                $subKey = sanitizeKey($subName);
            }

            if ($subId === null && $subKey !== '' && isset($subIdMap[$subKey])) {
                $subId = $subIdMap[$subKey];
            }
            if ($subId === null && $subName !== '' && isset($subIdMap[$subName])) {
                $subId = $subIdMap[$subName];
            }

            if ($subName === '' && $subKey === '' && $subId === null) {
                continue;
            }

            $subcategoryRow = null;
            if ($subId !== null && isset($subcategoriesById[$subId])) {
                $subcategoryRow = $subcategoriesById[$subId];
                if ($subName === '' && isset($subcategoryRow['name'])) {
                    $subName = sanitizeString($subcategoryRow['name']);
                }
                if ($subKey === '' && isset($subcategoryRow['subcategory_key'])) {
                    $subKey = sanitizeKey((string) $subcategoryRow['subcategory_key']);
                }
            }

            if (!$subcategoryRow) {
                $lookupCategoryName = $originalCategoryName !== '' ? $originalCategoryName : $categoryName;
                $lookupCategoryKey = $originalCategoryKey !== '' ? $originalCategoryKey : $categoryKey;
                $compositeCandidates = [];
                if ($lookupCategoryKey !== '' && $subKey !== '') {
                    $compositeCandidates[] = mb_strtolower($lookupCategoryKey . '::' . $subKey);
                }
                if ($lookupCategoryKey !== '' && $subName !== '') {
                    $compositeCandidates[] = mb_strtolower($lookupCategoryKey . '::' . sanitizeKey($subName));
                }
                if ($lookupCategoryName !== '' && $subKey !== '') {
                    $compositeCandidates[] = mb_strtolower($lookupCategoryName . '::' . $subKey);
                }
                if ($lookupCategoryName !== '' && $subName !== '') {
                    $compositeCandidates[] = mb_strtolower($lookupCategoryName . '::' . $subName);
                }
                $subcategoryRow = null;
                foreach ($compositeCandidates as $compositeKey) {
                    if (isset($subcategoriesByKey[$compositeKey])) {
                        $subcategoryRow = $subcategoriesByKey[$compositeKey];
                        $subId = (int) $subcategoryRow['id'];
                        if ($subName === '' && isset($subcategoryRow['name'])) {
                            $subName = sanitizeString($subcategoryRow['name']);
                        }
                        if ($subKey === '' && isset($subcategoryRow['subcategory_key'])) {
                            $subKey = sanitizeKey((string) $subcategoryRow['subcategory_key']);
                        }
                        break;
                    }
                }
                if (!$subcategoryRow) {
                    $label = $subName !== '' ? $subName : ($subKey !== '' ? $subKey : ($subId !== null ? (string) $subId : ''));
                    $categoryLabel = $lookupCategoryName !== '' ? $lookupCategoryName : ($lookupCategoryKey !== '' ? $lookupCategoryKey : $categoryName);
                    throw new RuntimeException(sprintf('Unknown subcategory "%s" within "%s".', $label, $categoryLabel));
                }
            }

            if ($subName === '') {
                $subName = sanitizeString($subcategoryRow['name'] ?? '');
            }
            if ($subKey === '') {
                $subKey = sanitizeKey($subcategoryRow['subcategory_key'] ?? $subName);
            }

            $fieldsPayload = [];
            $hasFieldsForThisSub = false;
            if ($subKey !== '' && isset($subFieldsMap[$subKey])) {
                $fieldsPayload = $subFieldsMap[$subKey];
                $hasFieldsForThisSub = true;
            } elseif ($subName !== '' && isset($subFieldsMap[$subName])) {
                $fieldsPayload = $subFieldsMap[$subName];
                $hasFieldsForThisSub = true;
            }
            if (!is_array($fieldsPayload)) {
                $fieldsPayload = [];
            }
            $sanitizedFields = [];
            if ($hasFieldsForThisSub) {
                foreach ($fieldsPayload as $fieldPayload) {
                    if (!is_array($fieldPayload)) {
                        continue;
                    }
                    $sanitizedFields[] = sanitizeField($fieldPayload);
                }
            } else {
                // Preserve existing fields from database if not in payload
                if (isset($subcategoryRow['metadata_json']) && is_string($subcategoryRow['metadata_json'])) {
                    $existingMeta = json_decode($subcategoryRow['metadata_json'], true);
                    if (is_array($existingMeta) && isset($existingMeta['fields']) && is_array($existingMeta['fields'])) {
                        $sanitizedFields = $existingMeta['fields'];
                    }
                }
            }

            $hasFieldTypesForThisSub = false;
            if (!$fieldTypeIds) {
                $fieldTypeSource = null;
                if ($subKey !== '' && isset($subFieldTypesMap[$subKey])) {
                    $fieldTypeSource = $subFieldTypesMap[$subKey];
                    $hasFieldTypesForThisSub = true;
                } elseif ($subName !== '' && isset($subFieldTypesMap[$subName])) {
                    $fieldTypeSource = $subFieldTypesMap[$subName];
                    $hasFieldTypesForThisSub = true;
                }
                if (is_array($fieldTypeSource)) {
                    foreach ($fieldTypeSource as $typeId) {
                        if (is_int($typeId)) {
                            $fieldTypeIds[] = $typeId;
                        } elseif (is_string($typeId) && preg_match('/^\d+$/', $typeId)) {
                            $fieldTypeIds[] = (int) $typeId;
                        }
                    }
                }
            } else {
                $hasFieldTypesForThisSub = true;
            }
            
            // If field types not in payload, try to extract from existing metadata_json
            if (!$hasFieldTypesForThisSub && isset($subcategoryRow['metadata_json']) && is_string($subcategoryRow['metadata_json']) && $subcategoryRow['metadata_json'] !== '') {
                $existingMeta = json_decode($subcategoryRow['metadata_json'], true);
                if (is_array($existingMeta) && isset($existingMeta['fieldTypeIds']) && is_array($existingMeta['fieldTypeIds'])) {
                    foreach ($existingMeta['fieldTypeIds'] as $typeId) {
                        if (is_int($typeId)) {
                            $fieldTypeIds[] = $typeId;
                        } elseif (is_string($typeId) && preg_match('/^\d+$/', $typeId)) {
                            $fieldTypeIds[] = (int) $typeId;
                        }
                    }
                    if (!empty($fieldTypeIds)) {
                        $hasFieldTypesForThisSub = true;
                    }
                }
            }
            
            // If still no field types, preserve existing from database columns
            if (!$hasFieldTypesForThisSub && isset($subcategoryRow['field_type_id']) && is_string($subcategoryRow['field_type_id']) && $subcategoryRow['field_type_id'] !== '') {
                $trimmed = trim($subcategoryRow['field_type_id']);
                if ($trimmed !== '') {
                    $parts = preg_split('/\s*,\s*/', $trimmed);
                    if (is_array($parts)) {
                        foreach ($parts as $part) {
                            $id = filterPositiveInt($part);
                            if ($id !== null) {
                                $fieldTypeIds[] = $id;
                            }
                        }
                    }
                }
            }

            $fieldTypeIds = array_values(array_unique(array_map('intval', $fieldTypeIds)));

            $fieldTypeIdCsv = $fieldTypeIds ? implode(',', array_unique($fieldTypeIds)) : null;
            $fieldTypeNameList = [];
            if ($fieldTypeIds) {
                foreach ($fieldTypeIds as $typeId) {
                    if (isset($fieldTypeDefinitions[$typeId]['name']) && $fieldTypeDefinitions[$typeId]['name'] !== '') {
                        $fieldTypeNameList[] = $fieldTypeDefinitions[$typeId]['name'];
                    }
                }
            }
            $fieldTypeNameList = array_values(array_unique($fieldTypeNameList));
            $fieldTypeNameCsv = $fieldTypeNameList ? implode(', ', $fieldTypeNameList) : null;

            $fieldNames = [];
            $fieldIds = [];
            if ($hasFieldsForThisSub) {
                foreach ($sanitizedFields as $field) {
                    $fieldNames[] = $field['name'] !== '' ? $field['name'] : $field['type'];
                    $matchedId = matchFieldId($fieldCatalog, $field);
                    if ($matchedId !== null) {
                        $fieldIds[] = $matchedId;
                    }
                }
            } else {
                // Preserve existing field_names and field_ids from database if not in payload
                if (isset($subcategoryRow['field_names']) && is_string($subcategoryRow['field_names']) && $subcategoryRow['field_names'] !== '') {
                    $decoded = json_decode($subcategoryRow['field_names'], true);
                    if (is_array($decoded)) {
                        $fieldNames = $decoded;
                    }
                }
                if (isset($subcategoryRow['field_ids']) && is_string($subcategoryRow['field_ids']) && $subcategoryRow['field_ids'] !== '') {
                    $decoded = json_decode($subcategoryRow['field_ids'], true);
                    if (is_array($decoded)) {
                        $fieldIds = $decoded;
                    }
                }
            }

            $resolvedSubIconPath = resolveIconPath($subcategoryIconPaths, $subId, $subName, $subKey);
            if ($resolvedSubIconPath === '' && $subKey !== '' && isset($subcategoryIcons[$subKey])) {
                $resolvedSubIconPath = extractIconSrcFromHtml($subcategoryIcons[$subKey]);
            }
            if ($resolvedSubIconPath === '' && isset($subcategoryIcons[$subName])) {
                $resolvedSubIconPath = extractIconSrcFromHtml($subcategoryIcons[$subName]);
            }
            if ($resolvedSubIconPath === '' && isset($subcategoryRow['icon_path'])) {
                $resolvedSubIconPath = sanitizeIconPath($subcategoryRow['icon_path']);
            }
            $subIconVariants = deriveIconVariants($resolvedSubIconPath);

            $metaIcon = '';
            if ($subIconVariants['icon'] !== '') {
                $metaIcon = sprintf('<img src="%s" width="20" height="20" alt="">', htmlspecialchars($subIconVariants['icon'], ENT_QUOTES, 'UTF-8'));
            } else {
                $iconSource = $subKey !== '' && isset($subcategoryIcons[$subKey])
                    ? $subcategoryIcons[$subKey]
                    : ($subcategoryIcons[$subName] ?? '');
                $metaIcon = sanitizeIcon($iconSource);
            }

            $categoryShapeValue = null;
            if ($categoryKey !== '' && isset($categoryShapes[$categoryKey])) {
                $categoryShapeValue = $categoryShapes[$categoryKey];
            } elseif ($categoryName !== '' && isset($categoryShapes[$categoryName])) {
                $categoryShapeValue = $categoryShapes[$categoryName];
            } elseif ($originalCategoryKey !== '' && isset($categoryShapes[$originalCategoryKey])) {
                $categoryShapeValue = $categoryShapes[$originalCategoryKey];
            } elseif ($originalCategoryName !== '' && isset($categoryShapes[$originalCategoryName])) {
                $categoryShapeValue = $categoryShapes[$originalCategoryName];
            }

            $meta = [
                'category' => $categoryName,
                'subcategory' => $subName,
                'categoryKey' => $categoryKey,
                'subcategoryKey' => $subKey,
                'fields' => $sanitizedFields,
                'versionPriceCurrencies' => $versionCurrencies,
                'fieldTypeIds' => $fieldTypeIds,
                'fieldTypeNames' => $fieldTypeNameList,
                'icon' => $metaIcon,
                'marker' => sanitizeString($subKey !== '' && isset($subcategoryMarkers[$subKey]) ? $subcategoryMarkers[$subKey] : ($subcategoryMarkers[$subName] ?? ''), 512),
                'markerId' => sanitizeString($subKey !== '' && isset($subcategoryMarkerIds[$subKey]) ? $subcategoryMarkerIds[$subKey] : ($subcategoryMarkerIds[$subName] ?? ''), 128),
                'categoryShape' => sanitizeMixed($categoryShapeValue),
                'updatedAt' => gmdate('c'),
            ];

            $updateParts = [];
            $params = [':id' => $subId];

            $subNameColumn = null;
            if (in_array('subcategory_name', $subcategoryColumns, true)) {
                $subNameColumn = 'subcategory_name';
            } elseif (in_array('name', $subcategoryColumns, true)) {
                $subNameColumn = 'name';
            }
            if ($subNameColumn !== null) {
                $updateParts[] = $subNameColumn . ' = :name';
                $params[':name'] = $subName;
            }
            if (in_array('category_name', $subcategoryColumns, true)) {
                $updateParts[] = 'category_name = :category_name';
                $params[':category_name'] = $categoryName;
            }
            if (in_array('subcategory_key', $subcategoryColumns, true)) {
                $updateParts[] = 'subcategory_key = :subcategory_key';
                $params[':subcategory_key'] = $subKey;
            }
            // Only update field_names and field_ids if fields were provided in payload
            if ($hasFieldsForThisSub) {
                if (in_array('field_names', $subcategoryColumns, true)) {
                    $updateParts[] = 'field_names = :field_names';
                    $params[':field_names'] = json_encode($fieldNames, JSON_UNESCAPED_UNICODE);
                }
                if (in_array('field_ids', $subcategoryColumns, true)) {
                    $updateParts[] = 'field_ids = :field_ids';
                    $params[':field_ids'] = json_encode($fieldIds, JSON_UNESCAPED_UNICODE);
                }
            }
            // Always update field_type_id and field_type_name when field types are provided or exist
            if (in_array('field_type_id', $subcategoryColumns, true) && ($hasFieldTypesForThisSub || !empty($fieldTypeIds))) {
                $updateParts[] = 'field_type_id = :field_type_id';
                $params[':field_type_id'] = $fieldTypeIdCsv;
            }
            if (in_array('field_type_name', $subcategoryColumns, true) && ($hasFieldTypesForThisSub || !empty($fieldTypeNameCsv))) {
                $updateParts[] = 'field_type_name = :field_type_name';
                $params[':field_type_name'] = $fieldTypeNameCsv;
            }
            if (in_array('sort_order', $subcategoryColumns, true)) {
                $updateParts[] = 'sort_order = :sort_order';
                $params[':sort_order'] = $index + 1;
            }
            // Only update icon_path and mapmarker_path if icon data was provided in payload
            $hasIconInPayload = !empty($subcategoryIconPaths) || !empty($subcategoryIcons);
            if ($hasIconInPayload) {
                if (in_array('icon_path', $subcategoryColumns, true)) {
                    $updateParts[] = 'icon_path = :icon_path';
                    $params[':icon_path'] = $subIconVariants['icon'];
                }
                if (in_array('mapmarker_path', $subcategoryColumns, true)) {
                    $updateParts[] = 'mapmarker_path = :mapmarker_path';
                    $params[':mapmarker_path'] = $subIconVariants['marker'];
                }
            }
            // Always update metadata_json if we have any data to preserve (including field types)
            // This ensures field types are always saved in metadata_json even if not in dedicated columns
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
            $updated[] = $subId;

            $subcategoriesById[$subId]['name'] = $subName;
            $subcategoriesById[$subId]['subcategory_name'] = $subName;
            $subcategoriesById[$subId]['subcategory_key'] = $subKey;
            $subcategoriesById[$subId]['category_name'] = $categoryName;
            $subcategoriesById[$subId]['category_key'] = $categoryKey;
            $subcategoriesById[$subId]['field_type_id'] = $fieldTypeIdCsv;
            $subcategoriesById[$subId]['field_type_name'] = $fieldTypeNameCsv;

            $compositeCandidates = [];
            if ($categoryKey !== '' && $subKey !== '') {
                $compositeCandidates[] = mb_strtolower($categoryKey . '::' . $subKey);
            }
            if ($categoryKey !== '' && $subName !== '') {
                $compositeCandidates[] = mb_strtolower($categoryKey . '::' . sanitizeKey($subName));
            }
            if ($categoryName !== '' && $subKey !== '') {
                $compositeCandidates[] = mb_strtolower($categoryName . '::' . $subKey);
            }
            if ($categoryName !== '' && $subName !== '') {
                $compositeCandidates[] = mb_strtolower($categoryName . '::' . $subName);
            }
            foreach (array_unique($compositeCandidates) as $candidate) {
                $subcategoriesByKey[$candidate] = [
                    'id' => $subId,
                    'name' => $subName,
                    'category_name' => $categoryName,
                    'subcategory_key' => $subKey,
                    'category_key' => $categoryKey,
                    'field_type_id' => $fieldTypeIdCsv,
                    'field_type_name' => $fieldTypeNameCsv,
                ];
            }
        }
    }

    if ($categorySortSupported && $categorySortUpdates) {
        $categorySortStmt = $pdo->prepare('UPDATE categories SET sort_order = :sort_order WHERE id = :id');
        foreach ($categorySortUpdates as $update) {
            $categorySortStmt->execute([
                ':sort_order' => $update['sort_order'],
                ':id' => $update['id'],
            ]);
        }
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'updated' => count($updated),
        'subcategory_ids' => $updated,
        'iconLibrary' => array_values($iconLibrary),
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

function sanitizeKey($value): string
{
    $string = strtolower(trim((string) $value));
    if ($string === '') {
        return '';
    }
    $string = preg_replace('/[^a-z0-9_-]+/', '-', $string);
    if (!is_string($string)) {
        return '';
    }
    $string = preg_replace('/-{2,}/', '-', $string);
    $string = trim($string, '-_');
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

function sanitizeIconPath($value): string
{
    $path = trim((string) $value);
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
    return sanitizeString($normalized, 255);
}

function upgradeIconBasePath(string $sanitizedPath): string
{
    if ($sanitizedPath === '') {
        return '';
    }

    $upgraded = $sanitizedPath;

    if (stripos($upgraded, 'assets/icons-20/') === 0) {
        $upgraded = 'assets/icons-30/' . substr($upgraded, strlen('assets/icons-20/'));

        $sizeAdjusted = preg_replace('/-20(\.[a-z0-9]+)$/i', '-30$1', $upgraded, 1);
        if (is_string($sizeAdjusted) && $sizeAdjusted !== '') {
            $upgraded = $sizeAdjusted;
        }
    }

    return sanitizeString($upgraded, 255);
}

function normalizeMarkerIconPath(string $sanitizedPath): string
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

    return sanitizeString($markerPath, 255);
}

function extractIconSrcFromHtml($value): string
{
    $html = (string) $value;
    if ($html === '') {
        return '';
    }
    if (preg_match('/src\s*=\s*"([^"]+)"/i', $html, $matches)) {
        return sanitizeIconPath($matches[1]);
    }
    if (preg_match("/src\s*=\s*'([^']+)'/i", $html, $matches)) {
        return sanitizeIconPath($matches[1]);
    }
    return '';
}

function normalizeIconMap(array $input): array
{
    $normalized = [];
    foreach ($input as $key => $value) {
        if (is_int($key)) {
            $key = (string) $key;
        } elseif (!is_string($key)) {
            continue;
        }
        $trimmedKey = trim($key);
        if ($trimmedKey === '') {
            continue;
        }
        $path = sanitizeIconPath($value);
        if (preg_match('/^id:(\d+)$/i', $trimmedKey, $matches)) {
            $normalized['id:' . $matches[1]] = $path;
            continue;
        }
        if (ctype_digit($trimmedKey)) {
            $normalized['id:' . $trimmedKey] = $path;
            continue;
        }
        if (stripos($trimmedKey, 'name:') === 0) {
            $name = trim(mb_strtolower(substr($trimmedKey, 5)));
            if ($name !== '') {
                $normalized['name:' . $name] = $path;
                $slug = sanitizeKey($name);
                if ($slug !== '') {
                    $normalized['slug:' . $slug] = $path;
                }
            }
            continue;
        }
        $lowerName = mb_strtolower($trimmedKey);
        $normalized['name:' . $lowerName] = $path;
        $slug = sanitizeKey($trimmedKey);
        if ($slug !== '') {
            $normalized['slug:' . $slug] = $path;
        }
    }
    return $normalized;
}

function resolveIconPath(array $map, ?int $id, string $name, string $key = ''): string
{
    if ($id !== null) {
        $idKey = 'id:' . $id;
        if (array_key_exists($idKey, $map)) {
            return $map[$idKey];
        }
    }
    $lower = mb_strtolower($name);
    if ($lower !== '') {
        $nameKey = 'name:' . $lower;
        if (array_key_exists($nameKey, $map)) {
            return $map[$nameKey];
        }
    }
    $normalizedKey = sanitizeKey($key);
    if ($normalizedKey !== '') {
        $slugKey = 'slug:' . $normalizedKey;
        if (array_key_exists($slugKey, $map)) {
            return $map[$slugKey];
        }
    }
    $slugFromName = sanitizeKey($name);
    if ($slugFromName !== '') {
        $slugKey = 'slug:' . $slugFromName;
        if (array_key_exists($slugKey, $map)) {
            return $map[$slugKey];
        }
    }
    return '';
}

function iconFileExists(string $relativePath): bool
{
    $clean = sanitizeIconPath($relativePath);
    if ($clean === '') {
        return false;
    }
    $fullPath = dirname(__DIR__, 3) . '/' . $clean;
    return is_file($fullPath);
}

function deriveIconVariants(string $path): array
{
    $clean = sanitizeIconPath($path);
    if ($clean === '') {
        return ['icon' => '', 'marker' => ''];
    }
    $base = upgradeIconBasePath($clean);
    $marker = normalizeMarkerIconPath($base);
    $icon = $base;
    if ($marker !== '' && stripos($marker, 'icons-30/') !== false) {
        $candidate = preg_replace('#icons-30/#i', 'icons-20/', $marker, 1);
        if (is_string($candidate) && $candidate !== '') {
            $candidate = preg_replace('/-30(\.[a-z0-9]+)$/i', '-20$1', $candidate, 1) ?: $candidate;
            $candidate = sanitizeString($candidate, 255);
            if ($candidate !== '' && iconFileExists($candidate)) {
                $icon = $candidate;
            }
        }
    }
    return ['icon' => $icon, 'marker' => $marker];
}

function filterPositiveInt($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_int($value)) {
        return $value >= 0 ? $value : null;
    }
    if (is_string($value) && preg_match('/^\d+$/', $value)) {
        return (int) $value;
    }
    if (is_numeric($value)) {
        $intValue = (int) $value;
        return $intValue >= 0 ? $intValue : null;
    }
    return null;
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
        'variant_pricing',
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
        case 'variant_pricing':
            $safe['options'] = sanitizeVariantPricingOptions($options);
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

function sanitizeVariantPricingOptions(array $options): array
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
    $hasLegacyName = $columns && in_array('name', $columns, true);
    $hasCategoryNameColumn = $columns && in_array('category_name', $columns, true);
    if (!$hasLegacyName && !$hasCategoryNameColumn) {
        return [];
    }
    $column = $hasCategoryNameColumn ? 'category_name' : 'name';
    $sql = 'SELECT id, `' . $column . '` AS name FROM categories';
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

function fetchCategoriesByKey(PDO $pdo, array $columns): array
{
    if (!$columns || !in_array('category_key', $columns, true)) {
        return [];
    }

    $selectedColumns = ['id', 'category_key'];
    if (in_array('category_name', $columns, true)) {
        $selectedColumns[] = 'category_name';
    }

    $sql = 'SELECT ' . implode(', ', array_map(static function (string $col): string {
        return '`' . str_replace('`', '``', $col) . '`';
    }, array_unique($selectedColumns))) . ' FROM categories';

    $stmt = $pdo->query($sql);
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'], $row['category_key']) || !is_string($row['category_key'])) {
            continue;
        }
        $normalizedKey = sanitizeKey($row['category_key']);
        if ($normalizedKey === '') {
            continue;
        }
        if (!isset($row['name']) && isset($row['category_name'])) {
            $row['name'] = $row['category_name'];
        }
        $map[$normalizedKey] = [
            'id' => (int) $row['id'],
            'name' => isset($row['name']) ? (string) $row['name'] : '',
            'category_key' => $normalizedKey,
        ];
    }

    return $map;
}

function fetchCategoriesById(PDO $pdo, array $columns): array
{
    if (!$columns || !in_array('id', $columns, true)) {
        return [];
    }
    $stmt = $pdo->query('SELECT * FROM categories');
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'])) {
            continue;
        }
        if (!isset($row['name']) && isset($row['category_name'])) {
            $row['name'] = $row['category_name'];
        }
        if (!isset($row['category_name']) && isset($row['name'])) {
            $row['category_name'] = $row['name'];
        }
        $map[(int) $row['id']] = $row;
    }
    return $map;
}

function fetchSubcategoriesByCompositeKey(PDO $pdo, array $columns): array
{
    if (!$columns || !in_array('subcategory_name', $columns, true)) {
        return [];
    }

    $nameColumn = 'subcategory_name';
    $hasCategoryName = $columns && in_array('category_name', $columns, true);
    $hasSubKey = $columns && in_array('subcategory_key', $columns, true);
    $hasCategoryKey = $columns && in_array('category_key', $columns, true);
    $hasFieldTypeId = $columns && in_array('field_type_id', $columns, true);
    $hasFieldTypeName = $columns && in_array('field_type_name', $columns, true);

    $selectParts = ['s.id', 's.`' . $nameColumn . '` AS name'];
    if ($hasSubKey) {
        $selectParts[] = 's.`subcategory_key`';
    }
    if ($hasCategoryName) {
        $selectParts[] = 's.`category_name`';
    }
    if ($hasCategoryKey) {
        $selectParts[] = 's.`category_key`';
    }
    if ($hasFieldTypeId) {
        $selectParts[] = 's.`field_type_id`';
    }
    if ($hasFieldTypeName) {
        $selectParts[] = 's.`field_type_name`';
    }

    if (!$hasCategoryName || !$hasCategoryKey) {
        $selectParts[] = 'c.`category_name` AS joined_category_name';
        $selectParts[] = 'c.`category_key` AS joined_category_key';
    }

    $sql = 'SELECT ' . implode(', ', $selectParts) . ' FROM subcategories s';
    if (!$hasCategoryName || !$hasCategoryKey) {
        $sql .= ' JOIN categories c ON c.id = s.category_id';
    }

    $stmt = $pdo->query($sql);
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'], $row['name'])) {
            continue;
        }

        $categoryName = '';
        if ($hasCategoryName && isset($row['category_name'])) {
            $categoryName = (string) $row['category_name'];
        } elseif (isset($row['joined_category_name'])) {
            $categoryName = (string) $row['joined_category_name'];
        }

        $categoryKey = '';
        if ($hasCategoryKey && isset($row['category_key'])) {
            $categoryKey = sanitizeKey((string) $row['category_key']);
        } elseif (isset($row['joined_category_key'])) {
            $categoryKey = sanitizeKey((string) $row['joined_category_key']);
        }

        $subName = (string) $row['name'];
        $subKey = '';
        if ($hasSubKey && isset($row['subcategory_key'])) {
            $subKey = sanitizeKey((string) $row['subcategory_key']);
        }

        $record = [
            'id' => (int) $row['id'],
            'name' => $subName,
            'category_name' => $categoryName,
            'subcategory_key' => $subKey,
            'category_key' => $categoryKey,
        ];
        if ($hasFieldTypeId && isset($row['field_type_id'])) {
            $record['field_type_id'] = $row['field_type_id'];
        }
        if ($hasFieldTypeName && isset($row['field_type_name'])) {
            $record['field_type_name'] = $row['field_type_name'];
        }

        $candidates = [];
        if ($categoryKey !== '' && $subKey !== '') {
            $candidates[] = mb_strtolower($categoryKey . '::' . $subKey);
        }
        if ($categoryKey !== '' && $subName !== '') {
            $candidates[] = mb_strtolower($categoryKey . '::' . sanitizeKey($subName));
        }
        if ($categoryName !== '' && $subKey !== '') {
            $candidates[] = mb_strtolower($categoryName . '::' . $subKey);
        }
        if ($categoryName !== '' && $subName !== '') {
            $candidates[] = mb_strtolower($categoryName . '::' . $subName);
        }

        foreach (array_unique($candidates) as $candidate) {
            $map[$candidate] = $record;
        }
    }

    return $map;
}

function fetchSubcategoriesById(PDO $pdo, array $columns): array
{
    if (!$columns || !in_array('id', $columns, true)) {
        return [];
    }
    $stmt = $pdo->query('SELECT * FROM subcategories');
    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!isset($row['id'])) {
            continue;
        }
        if (!isset($row['name']) && isset($row['subcategory_name'])) {
            $row['name'] = $row['subcategory_name'];
        }
        if (!isset($row['subcategory_name']) && isset($row['name'])) {
            $row['subcategory_name'] = $row['name'];
        }
        $map[(int) $row['id']] = $row;
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

function fetchFieldTypeDefinitions(PDO $pdo): array
{
    try {
        $columns = fetchTableColumns($pdo, 'field_types');
        if (!$columns || !in_array('id', $columns, true)) {
            return [];
        }

        $select = ['id'];
        if (in_array('field_type_name', $columns, true)) {
            $select[] = 'field_type_name';
        }
        if (in_array('field_type_key', $columns, true)) {
            $select[] = 'field_type_key';
        }

        $sql = 'SELECT ' . implode(', ', array_map(static function (string $col): string {
            return '`' . str_replace('`', '``', $col) . '`';
        }, $select)) . ' FROM field_types';

        $stmt = $pdo->query($sql);
        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['id'])) {
                continue;
            }
            $id = (int) $row['id'];
            $name = isset($row['field_type_name']) ? trim((string) $row['field_type_name']) : '';
            $key = isset($row['field_type_key']) ? sanitizeKey((string) $row['field_type_key']) : '';
            $map[$id] = [
                'id' => $id,
                'name' => $name,
                'key' => $key,
            ];
        }

        return $map;
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
