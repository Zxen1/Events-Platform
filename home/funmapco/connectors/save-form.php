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
    $fieldsetDefinitions = fetchFieldsetDefinitions($pdo);

    $versionCurrencies = [];
    if (isset($decoded['currencies']) && is_array($decoded['currencies'])) {
        foreach ($decoded['currencies'] as $currency) {
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
    $newCategoryIds = [];
    $newSubcategoryIds = [];
    $pdo->beginTransaction();

    $categorySortSupported = in_array('sort_order', $categoryColumns, true);
    $categorySortUpdates = [];
    $categoryOrder = 0;
    $processedCategoryIds = [];
    $processedSubcategoryIds = [];
    foreach ($decoded['categories'] as $categoryPayload) {
        if (!is_array($categoryPayload)) {
            continue;
        }

        $categoryId = filterPositiveInt($categoryPayload['id'] ?? null);
        $categoryName = sanitizeString($categoryPayload['name'] ?? '');
        $categoryKey = sanitizeKey($categoryPayload['key'] ?? '');
        $categoryHidden = isset($categoryPayload['hidden']) && $categoryPayload['hidden'] === true ? 1 : 0;

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
            if ($categoryName === '') {
                continue;
            }
            $insertParts = [];
            $insertValues = [];
            $insertParams = [];
            $categoryNameColumn = null;
            if (in_array('name', $categoryColumns, true)) {
                $categoryNameColumn = 'name';
            } elseif (in_array('category_name', $categoryColumns, true)) {
                $categoryNameColumn = 'category_name';
            }
            if ($categoryNameColumn !== null) {
                $insertParts[] = $categoryNameColumn;
                $insertValues[] = ':category_name';
                $insertParams[':category_name'] = $categoryName;
            }
            if ($categoryKey !== '' && in_array('category_key', $categoryColumns, true)) {
                $insertParts[] = 'category_key';
                $insertValues[] = ':category_key';
                $insertParams[':category_key'] = $categoryKey;
            }
            if (in_array('sort_order', $categoryColumns, true)) {
                $insertParts[] = 'sort_order';
                $insertValues[] = ':sort_order';
                $insertParams[':sort_order'] = $categoryOrder + 1;
            }
            if (in_array('hidden', $categoryColumns, true)) {
                $insertParts[] = 'hidden';
                $insertValues[] = ':hidden';
                $insertParams[':hidden'] = $categoryHidden;
            }
            if ($insertParts) {
                $sql = 'INSERT INTO categories (' . implode(', ', $insertParts) . ') VALUES (' . implode(', ', $insertValues) . ')';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($insertParams);
                $categoryId = (int) $pdo->lastInsertId();
                $newCategoryIds[] = $categoryId;
                $categoriesById[$categoryId] = [
                    'id' => $categoryId,
                    'name' => $categoryName,
                    'category_key' => $categoryKey
                ];
                $processedCategoryIds[] = $categoryId;
            } else {
                continue;
            }
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
        if (in_array('icon_path', $categoryColumns, true) && $categoryIconVariants['icon'] !== '') {
            $categoryUpdateParts[] = 'icon_path = :category_icon_path';
            $categoryParams[':category_icon_path'] = $categoryIconVariants['icon'];
        }
        if ($categoryKey !== '' && in_array('category_key', $categoryColumns, true)) {
            $categoryUpdateParts[] = 'category_key = :category_key';
            $categoryParams[':category_key'] = $categoryKey;
        }
        if (in_array('hidden', $categoryColumns, true)) {
            $categoryUpdateParts[] = 'hidden = :hidden';
            $categoryParams[':hidden'] = $categoryHidden;
        }

        if ($categoryUpdateParts) {
            $sql = 'UPDATE categories SET ' . implode(', ', $categoryUpdateParts) . ' WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($categoryParams);
        }
        
        // Track this category as processed (whether inserted or updated)
        if ($categoryId !== null && !in_array($categoryId, $processedCategoryIds, true)) {
            $processedCategoryIds[] = $categoryId;
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
        $hasSubFieldsInPayload = isset($categoryPayload['subFields']) && is_array($categoryPayload['subFields']);
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
        
        $subHiddenMap = [];
        if (isset($categoryPayload['subHidden']) && is_array($categoryPayload['subHidden'])) {
            foreach ($categoryPayload['subHidden'] as $key => $value) {
                $stringKey = is_string($key) || is_int($key) ? (string) $key : '';
                if ($stringKey === '') {
                    continue;
                }
                $hiddenValue = isset($value) && $value === true ? 1 : 0;
                $nameKey = sanitizeString($stringKey);
                if ($nameKey !== '') {
                    $subHiddenMap[$nameKey] = $hiddenValue;
                }
                $normalizedKey = sanitizeKey($stringKey);
                if ($normalizedKey !== '') {
                    $subHiddenMap[$normalizedKey] = $hiddenValue;
                }
            }
        }
        
        $subFeesMap = [];
        if (isset($categoryPayload['subFees']) && is_array($categoryPayload['subFees'])) {
            foreach ($categoryPayload['subFees'] as $key => $feeData) {
                if (!is_array($feeData)) continue;
                $stringKey = is_string($key) || is_int($key) ? (string) $key : '';
                if ($stringKey === '') continue;
                
                $fees = [
                    'checkout_surcharge' => isset($feeData['checkout_surcharge']) && $feeData['checkout_surcharge'] !== null && $feeData['checkout_surcharge'] !== '' ? round((float)$feeData['checkout_surcharge'], 2) : null,
                    'subcategory_type' => isset($feeData['subcategory_type']) ? (string)$feeData['subcategory_type'] : 'Standard',
                    'location_type' => isset($feeData['location_type']) && $feeData['location_type'] !== null && $feeData['location_type'] !== '' ? (string)$feeData['location_type'] : null,
                ];
                
                $nameKey = sanitizeString($stringKey);
                if ($nameKey !== '') {
                    $subFeesMap[$nameKey] = $fees;
                }
                $normalizedKey = sanitizeKey($stringKey);
                if ($normalizedKey !== '') {
                    $subFeesMap[$normalizedKey] = $fees;
                }
            }
        }

        foreach (array_values($subs) as $index => $subEntry) {
            $subName = '';
            $subKey = '';
            $subId = null;
            $fieldsetIds = [];

            if (is_array($subEntry)) {
                $subName = sanitizeString($subEntry['name'] ?? '');
                $subKey = sanitizeKey($subEntry['key'] ?? '');
                $subId = filterPositiveInt($subEntry['id'] ?? null);
                if (isset($subEntry['fieldsetIds']) && is_array($subEntry['fieldsetIds'])) {
                    foreach ($subEntry['fieldsetIds'] as $typeId) {
                        if (is_int($typeId)) {
                            $fieldsetIds[] = $typeId;
                        } elseif (is_string($typeId) && preg_match('/^\d+$/', $typeId)) {
                            $fieldsetIds[] = (int) $typeId;
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
                    if ($subName === '') {
                        continue;
                    }
                    $subHidden = 0;
                    if (isset($subHiddenMap[$subName])) {
                        $subHidden = $subHiddenMap[$subName];
                    } elseif (isset($subHiddenMap[$subKey]) && $subKey !== '') {
                        $subHidden = $subHiddenMap[$subKey];
                    }
                    $insertParts = [];
                    $insertValues = [];
                    $insertParams = [];
                    $subNameColumn = null;
                    if (in_array('subcategory_name', $subcategoryColumns, true)) {
                        $subNameColumn = 'subcategory_name';
                    } elseif (in_array('name', $subcategoryColumns, true)) {
                        $subNameColumn = 'name';
                    }
                    if ($subNameColumn !== null) {
                        $insertParts[] = $subNameColumn;
                        $insertValues[] = ':subcategory_name';
                        $insertParams[':subcategory_name'] = $subName;
                    }
                    if (in_array('category_name', $subcategoryColumns, true)) {
                        $insertParts[] = 'category_name';
                        $insertValues[] = ':category_name';
                        $insertParams[':category_name'] = $categoryName;
                    }
                    if (in_array('category_id', $subcategoryColumns, true)) {
                        $insertParts[] = 'category_id';
                        $insertValues[] = ':category_id';
                        $insertParams[':category_id'] = $categoryId;
                    }
                    if ($subKey !== '' && in_array('subcategory_key', $subcategoryColumns, true)) {
                        $insertParts[] = 'subcategory_key';
                        $insertValues[] = ':subcategory_key';
                        $insertParams[':subcategory_key'] = $subKey;
                    }
                    if (in_array('sort_order', $subcategoryColumns, true)) {
                        $insertParts[] = 'sort_order';
                        $insertValues[] = ':sort_order';
                        $insertParams[':sort_order'] = $index + 1;
                    }
                    if (in_array('hidden', $subcategoryColumns, true)) {
                        $insertParts[] = 'hidden';
                        $insertValues[] = ':hidden';
                        $insertParams[':hidden'] = $subHidden;
                    }
                    if (in_array('checkout_surcharge', $subcategoryColumns, true)) {
                        $insertParts[] = 'checkout_surcharge';
                        $insertValues[] = ':checkout_surcharge';
                        $insertParams[':checkout_surcharge'] = $checkoutSurcharge;
                    }
                    if (in_array('subcategory_type', $subcategoryColumns, true)) {
                        $insertParts[] = 'subcategory_type';
                        $insertValues[] = ':subcategory_type';
                        $insertParams[':subcategory_type'] = $subcategoryType;
                    }
                    if (in_array('location_type', $subcategoryColumns, true)) {
                        $insertParts[] = 'location_type';
                        $insertValues[] = ':location_type';
                        $insertParams[':location_type'] = $locationType;
                    }
                    if ($insertParts) {
                        $sql = 'INSERT INTO subcategories (' . implode(', ', $insertParts) . ') VALUES (' . implode(', ', $insertValues) . ')';
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($insertParams);
                        $subId = (int) $pdo->lastInsertId();
                        $newSubcategoryIds[] = $subId;
                        $processedSubcategoryIds[] = $subId;
                    } else {
                        continue;
                    }
                }
            }

            if ($subName === '') {
                $subName = sanitizeString($subcategoryRow['name'] ?? '');
            }
            if ($subKey === '') {
                $subKey = sanitizeKey($subcategoryRow['subcategory_key'] ?? $subName);
            }
            
            $subHidden = 0;
            if (isset($subHiddenMap[$subName])) {
                $subHidden = $subHiddenMap[$subName];
            } elseif (isset($subHiddenMap[$subKey]) && $subKey !== '') {
                $subHidden = $subHiddenMap[$subKey];
            }
            
            // Extract fee data
            $subFees = null;
            if (isset($subFeesMap[$subName])) {
                $subFees = $subFeesMap[$subName];
            } elseif (isset($subFeesMap[$subKey]) && $subKey !== '') {
                $subFees = $subFeesMap[$subKey];
            }
            
            $checkoutSurcharge = isset($subFees['checkout_surcharge']) && $subFees['checkout_surcharge'] !== null && $subFees['checkout_surcharge'] !== '' ? round((float)$subFees['checkout_surcharge'], 2) : null;
            $subcategoryType = isset($subFees['subcategory_type']) ? $subFees['subcategory_type'] : 'Standard';
            $locationType = isset($subFees['location_type']) && $subFees['location_type'] !== null && $subFees['location_type'] !== '' ? $subFees['location_type'] : null;

            $fieldsPayload = [];
            $hasFieldsForThisSub = false;
            $fieldsAreInPayload = false;
            
            // Check if fields are in payload for THIS SPECIFIC subcategory (even if empty array)
            // Try both subKey and subName to find the fields
            if ($subKey !== '' && array_key_exists($subKey, $subFieldsMap)) {
                $fieldsPayload = is_array($subFieldsMap[$subKey]) ? $subFieldsMap[$subKey] : [];
                $hasFieldsForThisSub = !empty($fieldsPayload);
                $fieldsAreInPayload = true;
                error_log("DEBUG: Found fields for subKey '$subKey': " . json_encode($fieldsPayload));
            } elseif ($subName !== '' && array_key_exists($subName, $subFieldsMap)) {
                $fieldsPayload = is_array($subFieldsMap[$subName]) ? $subFieldsMap[$subName] : [];
                $hasFieldsForThisSub = !empty($fieldsPayload);
                $fieldsAreInPayload = true;
                error_log("DEBUG: Found fields for subName '$subName': " . json_encode($fieldsPayload));
            } else {
                error_log("DEBUG: No fields found for sub (key='$subKey', name='$subName'). subFieldsMap keys: " . json_encode(array_keys($subFieldsMap)));
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
                    $sanitizedFields[] = sanitizeField($fieldPayload, $fieldsetDefinitions);
                }
            }
            // Fields come from field types, not from metadata_json

            // Extract field types, order, and required from fieldsPayload
            $hasFieldsetsForThisSub = false;
            $fieldsetsAreInPayload = false;
            $fieldsetIdsFromPayload = [];
            $requiredFieldsetIdsFromPayload = [];
            
            // If fields array exists in payload (even if empty), field types should be updated
            if ($fieldsAreInPayload) {
                $fieldsetsAreInPayload = true;
            }
            
            if ($hasFieldsForThisSub && !empty($fieldsPayload)) {
                error_log("DEBUG: Processing " . count($fieldsPayload) . " fields for subcategory $subKey");
                foreach ($fieldsPayload as $fieldIndex => $fieldData) {
                    if (!is_array($fieldData)) continue;
                    
                    // Get fieldset_id from the field's key or fieldsetKey
                    $fieldsetKey = $fieldData['fieldsetKey'] ?? $fieldData['key'] ?? null;
                    $inputType = $fieldData['input_type'] ?? $fieldData['type'] ?? 'null';
                    error_log("DEBUG: Field $fieldIndex - key=$fieldsetKey, type=" . $inputType . ", name=" . ($fieldData['name'] ?? 'null') . ", required=" . json_encode($fieldData['required'] ?? null));
                    
                    if ($fieldsetKey && is_string($fieldsetKey)) {
                        // Look up fieldset_id by key
                        $searchKey = $fieldsetKey;
                        foreach ($fieldsetDefinitions as $ftId => $ftDef) {
                            if (isset($ftDef['key']) && $ftDef['key'] === $searchKey) {
                                $fieldsetIdsFromPayload[] = $ftId;
                                // Check if required
                                if (!empty($fieldData['required'])) {
                                    $requiredFieldsetIdsFromPayload[] = $ftId;
                                }
                                break;
                            }
                        }
                    }
                }
                
                if (!empty($fieldsetIdsFromPayload)) {
                    $fieldsetIds = $fieldsetIdsFromPayload;
                    $requiredFieldsetIds = $requiredFieldsetIdsFromPayload;
                    $hasFieldsetsForThisSub = true;
                }
            }
            
            // Only check subFieldTypesMap if fields are NOT in payload
            // If fields are in payload (even empty), we already have the field types from there
            if (!$hasFieldsetsForThisSub && !$fieldsAreInPayload) {
                $fieldsetSource = null;
                if ($subKey !== '' && isset($subFieldTypesMap[$subKey])) {
                    $fieldsetSource = $subFieldTypesMap[$subKey];
                    $hasFieldsetsForThisSub = true;
                    $fieldsetsAreInPayload = true;
                } elseif ($subName !== '' && isset($subFieldTypesMap[$subName])) {
                    $fieldsetSource = $subFieldTypesMap[$subName];
                    $hasFieldsetsForThisSub = true;
                    $fieldsetsAreInPayload = true;
                }
                if (is_array($fieldsetSource)) {
                    foreach ($fieldsetSource as $typeId) {
                        if (is_int($typeId)) {
                            $fieldsetIds[] = $typeId;
                        } elseif (is_string($typeId) && preg_match('/^\d+$/', $typeId)) {
                            $fieldsetIds[] = (int) $typeId;
                        }
                    }
                }
            }
            
            // If still no field types AND fields are NOT in payload, preserve existing from database columns
            if (!$hasFieldsetsForThisSub && !$fieldsAreInPayload && isset($subcategoryRow['fieldset_ids']) && is_string($subcategoryRow['fieldset_ids']) && $subcategoryRow['fieldset_ids'] !== '') {
                $trimmed = trim($subcategoryRow['fieldset_ids']);
                if ($trimmed !== '') {
                    $parts = preg_split('/\s*,\s*/', $trimmed);
                    if (is_array($parts)) {
                        foreach ($parts as $part) {
                            $id = filterPositiveInt($part);
                            if ($id !== null) {
                                $fieldsetIds[] = $id;
                            }
                        }
                    }
                    // Also mark as having field types so junction table gets updated
                    if (!empty($fieldsetIds)) {
                        $hasFieldsetsForThisSub = true;
                    }
                }
            } elseif (!$hasFieldsetsForThisSub && !$fieldsAreInPayload && isset($subcategoryRow['fieldset_ids']) && is_string($subcategoryRow['fieldset_ids']) && $subcategoryRow['fieldset_ids'] !== '') {
                $trimmed = trim($subcategoryRow['fieldset_ids']);
                if ($trimmed !== '') {
                    $parts = preg_split('/\s*,\s*/', $trimmed);
                    if (is_array($parts)) {
                        foreach ($parts as $part) {
                            $id = filterPositiveInt($part);
                            if ($id !== null) {
                                $fieldsetIds[] = $id;
                            }
                        }
                    }
                    // Also mark as having field types so junction table gets updated
                    if (!empty($fieldsetIds)) {
                        $hasFieldsetsForThisSub = true;
                    }
                }
            }

            $fieldsetIds = array_values(array_unique(array_map('intval', $fieldsetIds)));

            // Process editable fieldsets and save to subcategory_edits table
            // This is completely separate from checkout options
            $subcategoryEditsToSave = [];
            $hasEditableColumnInfo = false; // Track if we found fieldset_editable info
            
            if ($hasFieldsForThisSub && !empty($sanitizedFields)) {
                // Create a map of fieldsetKey to field data for quick lookup
                $fieldsByFieldsetKey = [];
                foreach ($sanitizedFields as $field) {
                    $key = $field['fieldsetKey'] ?? $field['key'] ?? null;
                    if ($key) {
                        $fieldsByFieldsetKey[$key] = $field;
                    }
                }
                
                // Iterate through fieldsetIds and match with fields
                foreach ($fieldsetIds as $fieldsetId) {
                    $fieldsetDef = isset($fieldsetDefinitions[$fieldsetId]) ? $fieldsetDefinitions[$fieldsetId] : null;
                    if (!$fieldsetDef) continue;
                    
                    $fieldsetKey = $fieldsetDef['key'] ?? null;
                    if (!$fieldsetKey) continue;
                    
                    // Only process field types marked as editable in the database
                    // Track if we found any fieldset with editable info (to prevent accidental deletion)
                    if (isset($fieldsetDef['fieldset_editable'])) {
                        $hasEditableColumnInfo = true;
                    }
                    $isEditable = isset($fieldsetDef['fieldset_editable']) && $fieldsetDef['fieldset_editable'] === true;
                    $isAmenities = ($fieldsetKey === 'amenities');
                    
                    // Allow amenities fieldsets to save selectedAmenities even if not marked as editable
                    // (since the amenities menu is always shown in the edit panel)
                    if (!$isEditable && !$isAmenities) continue;
                    
                    $fieldData = isset($fieldsByFieldsetKey[$fieldsetKey]) ? $fieldsByFieldsetKey[$fieldsetKey] : null;
                    if (!$fieldData) continue;
                    
                    $customName = null;
                    $customOptions = null;
                    $customPlaceholder = null;
                    $customTooltip = null;
                    
                    // Always save name for editable fieldsets (so defaults are captured and can be customized)
                    if ($isEditable) {
                        $customNameValue = $fieldData['name'] ?? '';
                        if ($customNameValue !== '') {
                            $customName = $customNameValue;
                        }
                    }
                    
                    // Always save options for editable dropdown/radio types (so defaults are captured)
                    if ($isEditable && isset($fieldData['options'])) {
                        $customOptionsArray = is_array($fieldData['options']) ? array_values($fieldData['options']) : [];
                        if (!empty($customOptionsArray)) {
                            $customOptions = json_encode($customOptionsArray, JSON_UNESCAPED_UNICODE);
                        }
                    }
                    
                    // Save selectedAmenities for amenities fieldsets (stored in fieldset_options as JSON)
                    // This works even if amenities fieldset is not marked as editable
                    if ($isAmenities && isset($fieldData['selectedAmenities'])) {
                        $selectedAmenitiesArray = is_array($fieldData['selectedAmenities']) ? array_values($fieldData['selectedAmenities']) : [];
                        if (!empty($selectedAmenitiesArray)) {
                            $customOptions = json_encode($selectedAmenitiesArray, JSON_UNESCAPED_UNICODE);
                        }
                    }
                    
                    // Save custom placeholder if provided (any non-empty value)
                    $customPlaceholderValue = $fieldData['customPlaceholder'] ?? '';
                    if (is_string($customPlaceholderValue) && trim($customPlaceholderValue) !== '') {
                        $customPlaceholder = trim($customPlaceholderValue);
                    }
                    
                    // Save custom tooltip if provided (any non-empty value)
                    $customTooltipValue = $fieldData['customTooltip'] ?? '';
                    if (is_string($customTooltipValue) && trim($customTooltipValue) !== '') {
                        $customTooltip = trim($customTooltipValue);
                    }
                    
                    // Only save if there's actual custom data
                    if ($customName !== null || $customOptions !== null || $customPlaceholder !== null || $customTooltip !== null) {
                        $subcategoryEditsToSave[] = [
                            'subcategory_key' => $subKey,
                            'fieldset_key' => $fieldsetKey,
                            'fieldset_name' => $customName,
                            'fieldset_options' => $customOptions,
                            'fieldset_placeholder' => $customPlaceholder,
                            'fieldset_tooltip' => $customTooltip,
                        ];
                    }
                }
            }
            
            // Extract checkout_options_id from checkout field
            $checkoutOptionsIds = [];
            if ($hasFieldsForThisSub && !empty($sanitizedFields)) {
                foreach ($sanitizedFields as $field) {
                    $fieldKey = $field['fieldsetKey'] ?? $field['key'] ?? null;
                    if ($fieldKey === 'checkout' && isset($field['checkoutOptions']) && is_array($field['checkoutOptions'])) {
                        $validIds = [];
                        foreach ($field['checkoutOptions'] as $opt) {
                            $id = is_numeric($opt) ? (int)$opt : null;
                            if ($id !== null && $id > 0) {
                                $validIds[] = $id;
                            }
                        }
                        if (!empty($validIds)) {
                            $checkoutOptionsIds = array_values(array_unique($validIds));
                        }
                        break; // Only one checkout field per subcategory
                    }
                }
            }
            
            $fieldsetIdCsv = $fieldsetIds ? implode(',', array_unique($fieldsetIds)) : null;
            $fieldsetNameList = [];
            if ($fieldsetIds) {
                foreach ($fieldsetIds as $typeId) {
                    if (isset($fieldsetDefinitions[$typeId]['name']) && $fieldsetDefinitions[$typeId]['name'] !== '') {
                        $fieldsetNameList[] = $fieldsetDefinitions[$typeId]['name'];
                    }
                }
            }
            $fieldsetNameList = array_values(array_unique($fieldsetNameList));
            $fieldsetNameCsv = $fieldsetNameList ? implode(', ', $fieldsetNameList) : null;

            $fieldNames = [];
            $fieldIds = [];
            if ($hasFieldsForThisSub) {
                foreach ($sanitizedFields as $field) {
                    // Use field type (fieldset_key/fieldset_key) as fallback for field name, not input_type
                    $fieldsetKey = $field['fieldsetKey'] ?? $field['key'] ?? $field['input_type'] ?? $field['type'] ?? '';
                    $fieldNames[] = $field['name'] !== '' ? $field['name'] : $fieldsetKey;
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

            // Build required CSV in boolean format (1,0,1,0,0) aligned with fieldset_ids order
            $requiredBooleans = [];
            foreach ($fieldsetIds as $fieldsetId) {
                $isRequired = in_array($fieldsetId, $requiredFieldsetIds, true);
                $requiredBooleans[] = $isRequired ? '1' : '0';
            }
            $requiredCsv = !empty($requiredBooleans) ? implode(',', $requiredBooleans) : null;

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
            if (in_array('category_id', $subcategoryColumns, true)) {
                $updateParts[] = 'category_id = :category_id';
                $params[':category_id'] = $categoryId;
            }
            if (in_array('subcategory_key', $subcategoryColumns, true)) {
                $updateParts[] = 'subcategory_key = :subcategory_key';
                $params[':subcategory_key'] = $subKey;
            }
            // Only update field_names and field_ids if fields were provided in payload (even if empty)
            if ($fieldsAreInPayload) {
                error_log("DEBUG: Updating fields for sub '$subName' - fieldNames: " . json_encode($fieldNames) . ", fieldIds: " . json_encode($fieldIds));
                if (in_array('field_names', $subcategoryColumns, true)) {
                    $updateParts[] = 'field_names = :field_names';
                    $params[':field_names'] = json_encode($fieldNames, JSON_UNESCAPED_UNICODE);
                }
                if (in_array('field_ids', $subcategoryColumns, true)) {
                    $updateParts[] = 'field_ids = :field_ids';
                    $params[':field_ids'] = json_encode($fieldIds, JSON_UNESCAPED_UNICODE);
                }
            } else {
                error_log("DEBUG: NOT updating fields for sub '$subName' - fieldsAreInPayload is false");
            }
            // Always update fieldset_ids and fieldset_name when field types are provided in payload (even if empty)
            if ($fieldsetsAreInPayload) {
                error_log("DEBUG: Updating field types for '$subName' - fieldsetIdCsv: '$fieldsetIdCsv', fieldsetNameCsv: '$fieldsetNameCsv'");
                if (in_array('fieldset_ids', $subcategoryColumns, true)) {
                    $updateParts[] = 'fieldset_ids = :fieldset_ids';
                    $params[':fieldset_ids'] = $fieldsetIdCsv !== null && $fieldsetIdCsv !== '' ? $fieldsetIdCsv : null;
                    error_log("DEBUG: Setting fieldset_ids to: " . ($params[':fieldset_ids'] === null ? 'NULL' : $params[':fieldset_ids']));
                } elseif (in_array('fieldset_ids', $subcategoryColumns, true)) {
                    $updateParts[] = 'fieldset_ids = :fieldset_ids';
                    $params[':fieldset_ids'] = $fieldsetIdCsv !== null && $fieldsetIdCsv !== '' ? $fieldsetIdCsv : null;
                    error_log("DEBUG: Setting fieldset_ids to: " . ($params[':fieldset_ids'] === null ? 'NULL' : $params[':fieldset_ids']));
                }
                if (in_array('fieldset_name', $subcategoryColumns, true)) {
                    $updateParts[] = 'fieldset_name = :fieldset_name';
                    $params[':fieldset_name'] = $fieldsetNameCsv !== null && $fieldsetNameCsv !== '' ? $fieldsetNameCsv : null;
                } elseif (in_array('fieldset_name', $subcategoryColumns, true)) {
                    $updateParts[] = 'fieldset_name = :fieldset_name';
                    $params[':fieldset_name'] = $fieldsetNameCsv !== null && $fieldsetNameCsv !== '' ? $fieldsetNameCsv : null;
                }
                if (in_array('required', $subcategoryColumns, true)) {
                    $updateParts[] = 'required = :required';
                    $params[':required'] = $requiredCsv !== null && $requiredCsv !== '' ? $requiredCsv : null;
                }
                // Save subcategory_edits to database table (replaces editable_fieldsets JSON)
                if ($hasFieldsForThisSub && !empty($subcategoryEditsToSave)) {
                    // Delete existing edits for this subcategory first
                    $deleteStmt = $pdo->prepare("DELETE FROM subcategory_edits WHERE subcategory_key = :subcategory_key");
                    $deleteStmt->execute([':subcategory_key' => $subKey]);
                    
                    // Insert new edits
                    $insertStmt = $pdo->prepare("
                        INSERT INTO subcategory_edits (subcategory_key, fieldset_key, fieldset_name, fieldset_options, fieldset_placeholder, fieldset_tooltip)
                        VALUES (:subcategory_key, :fieldset_key, :fieldset_name, :fieldset_options, :fieldset_placeholder, :fieldset_tooltip)
                    ");
                    
                    foreach ($subcategoryEditsToSave as $edit) {
                        $insertStmt->execute([
                            ':subcategory_key' => $edit['subcategory_key'],
                            ':fieldset_key' => $edit['fieldset_key'],
                            ':fieldset_name' => $edit['fieldset_name'],
                            ':fieldset_options' => $edit['fieldset_options'],
                            ':fieldset_placeholder' => $edit['fieldset_placeholder'],
                            ':fieldset_tooltip' => $edit['fieldset_tooltip'],
                        ]);
                    }
                } elseif ($hasFieldsForThisSub && empty($subcategoryEditsToSave) && $hasEditableColumnInfo) {
                    // If fields were provided but no customizations AND we confirmed editable column exists,
                    // remove any existing edits. Skip deletion if editable column wasn't detected (safety measure).
                    $deleteStmt = $pdo->prepare("DELETE FROM subcategory_edits WHERE subcategory_key = :subcategory_key");
                    $deleteStmt->execute([':subcategory_key' => $subKey]);
                }
                // Save checkout_options_id as CSV of checkout option IDs
                if ($hasFieldsForThisSub && in_array('checkout_options_id', $subcategoryColumns, true)) {
                    $checkoutOptionsIdCsv = !empty($checkoutOptionsIds) ? implode(',', $checkoutOptionsIds) : null;
                    $updateParts[] = 'checkout_options_id = :checkout_options_id';
                    $params[':checkout_options_id'] = $checkoutOptionsIdCsv;
                }
            } else {
                error_log("DEBUG: NOT updating field types for '$subName' - fieldsetsAreInPayload is false");
            }
            if (in_array('sort_order', $subcategoryColumns, true)) {
                $updateParts[] = 'sort_order = :sort_order';
                $params[':sort_order'] = $index + 1;
            }
            if (in_array('hidden', $subcategoryColumns, true)) {
                $updateParts[] = 'hidden = :hidden';
                $params[':hidden'] = $subHidden;
            }
            if (in_array('checkout_surcharge', $subcategoryColumns, true)) {
                $updateParts[] = 'checkout_surcharge = :checkout_surcharge';
                $params[':checkout_surcharge'] = $checkoutSurcharge;
            }
            if (in_array('subcategory_type', $subcategoryColumns, true)) {
                $updateParts[] = 'subcategory_type = :subcategory_type';
                $params[':subcategory_type'] = $subcategoryType;
            }
            if (in_array('location_type', $subcategoryColumns, true)) {
                $updateParts[] = 'location_type = :location_type';
                $params[':location_type'] = $locationType;
            }
            // Only update icon_path if we have a non-empty icon path to save
            if (in_array('icon_path', $subcategoryColumns, true) && $subIconVariants['icon'] !== '') {
                $updateParts[] = 'icon_path = :icon_path';
                $params[':icon_path'] = $subIconVariants['icon'];
            }

            if (!$updateParts) {
                throw new RuntimeException('Unable to persist formbuilder state: no writable columns available.');
            }

            $sql = 'UPDATE subcategories SET ' . implode(', ', $updateParts) . ' WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $updated[] = $subId;
            
            // Track this subcategory as processed
            if ($subId !== null && !in_array($subId, $processedSubcategoryIds, true)) {
                $processedSubcategoryIds[] = $subId;
            }

            $subcategoriesById[$subId]['name'] = $subName;
            $subcategoriesById[$subId]['subcategory_name'] = $subName;
            $subcategoriesById[$subId]['subcategory_key'] = $subKey;
            $subcategoriesById[$subId]['category_name'] = $categoryName;
            $subcategoriesById[$subId]['category_key'] = $categoryKey;
            $subcategoriesById[$subId]['fieldset_ids'] = $fieldsetIdCsv;
            $subcategoriesById[$subId]['fieldset_name'] = $fieldsetNameCsv;
            // Keep old names for backward compatibility
            $subcategoriesById[$subId]['fieldset_ids'] = $fieldsetIdCsv;
            $subcategoriesById[$subId]['fieldset_name'] = $fieldsetNameCsv;

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
                    'fieldset_ids' => $fieldsetIdCsv,
                    'fieldset_name' => $fieldsetNameCsv,
                    'fieldset_ids' => $fieldsetIdCsv,
                    'fieldset_name' => $fieldsetNameCsv,
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

    // === DELETE ORPHANED CATEGORIES & SUBCATEGORIES ===
    // Delete categories that exist in DB but were not processed (i.e., not in payload)
    if (!empty($categoriesById)) {
        $allDbCategoryIds = array_keys($categoriesById);
        $categoriesToDelete = array_diff($allDbCategoryIds, $processedCategoryIds);
        if (!empty($categoriesToDelete)) {
            $placeholders = implode(',', array_fill(0, count($categoriesToDelete), '?'));
            $deleteStmt = $pdo->prepare("DELETE FROM categories WHERE id IN ($placeholders)");
            $deleteStmt->execute(array_values($categoriesToDelete));
        }
    }
    
    // Delete subcategories that exist in DB but were not processed (i.e., not in payload)
    if (!empty($subcategoriesById)) {
        $allDbSubcategoryIds = array_keys($subcategoriesById);
        $subcategoriesToDelete = array_diff($allDbSubcategoryIds, $processedSubcategoryIds);
        if (!empty($subcategoriesToDelete)) {
            $placeholders = implode(',', array_fill(0, count($subcategoriesToDelete), '?'));
            $deleteStmt = $pdo->prepare("DELETE FROM subcategories WHERE id IN ($placeholders)");
            $deleteStmt->execute(array_values($subcategoriesToDelete));
        }
    }
    // === END DELETE ORPHANED ITEMS ===

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'updated' => count($updated),
        'subcategory_ids' => $updated,
        'new_category_ids' => $newCategoryIds,
        'new_subcategory_ids' => $newSubcategoryIds,
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
    // No hardcoded path restrictions - admin controls all paths
    return sanitizeString($normalized, 255);
}

function upgradeIconBasePath(string $sanitizedPath): string
{
    if ($sanitizedPath === '') {
        return '';
    }

    // No hardcoded path upgrades - admin controls all paths
    return sanitizeString($sanitizedPath, 255);
}

function normalizeMarkerIconPath(string $sanitizedPath): string
{
    if ($sanitizedPath === '') {
        return '';
    }

    $markerPath = $sanitizedPath;

    // No hardcoded path normalization - admin controls all paths
    // Normalize size suffix to -30 (if needed for legacy compatibility)
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

/**
 * Extract just the filename from a full URL or path
 * Examples:
 *   "https://cdn.funmap.com/category-icons/whats-on.svg" -> "whats-on.svg"
 *   "category-icons/whats-on.svg" -> "whats-on.svg"
 *   "whats-on.svg" -> "whats-on.svg"
 */
function extractFilenameFromPath(string $path): string
{
    $path = trim($path);
    if ($path === '') {
        return '';
    }
    
    // Remove query string and fragment
    $path = preg_replace('/[?#].*$/', '', $path);
    
    // Extract filename (everything after the last slash)
    $filename = basename($path);
    
    // If it's empty or just a slash, return empty
    if ($filename === '' || $filename === '/' || $filename === '.') {
        return '';
    }
    
    return $filename;
}

function deriveIconVariants(string $path): array
{
    // Extract just the filename from the path (database should only store filenames)
    $filename = extractFilenameFromPath($path);
    if ($filename === '') {
        return ['icon' => '', 'marker' => ''];
    }
    
    // Sanitize the filename
    $clean = sanitizeIconPath($filename);
    if ($clean === '') {
        return ['icon' => '', 'marker' => ''];
    }
    
    $base = upgradeIconBasePath($clean);
    $normalized = normalizeMarkerIconPath($base);
    // Use same path for both icon and marker - resize in CSS where needed
    // Return just the filename (not full URL) for database storage
    return ['icon' => $normalized, 'marker' => $normalized];
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

function sanitizeField(array $field, array $fieldsetDefinitions = []): array
{
    // Build allowed types from database fieldsets instead of hardcoding
    $allowedTypes = [];
    foreach ($fieldsetDefinitions as $ftDef) {
        if (isset($ftDef['key']) && is_string($ftDef['key']) && $ftDef['key'] !== '') {
            $allowedTypes[] = $ftDef['key'];
        }
    }
    
    // No fallback - throw error if no fieldset definitions available
    if (empty($allowedTypes)) {
        throw new RuntimeException('No fieldset definitions available from database. Cannot validate field types.');
    }

    // Support both 'type' (old) and 'input_type' (new) for backwards compatibility
    $inputType = $field['input_type'] ?? $field['type'] ?? null;
    
    // No fallback - require explicit field type
    if ($inputType === null || $inputType === '') {
        throw new RuntimeException('Field type is required. Missing both input_type and type in field data: ' . json_encode($field));
    }
    
    $safe = [
        'id' => sanitizeString($field['id'] ?? '', 128),
        'name' => sanitizeString($field['name'] ?? ''),
        'type' => sanitizeString($inputType, 64),
        'input_type' => sanitizeString($inputType, 64), // Also include input_type for database compatibility
        'placeholder' => sanitizeString($field['placeholder'] ?? '', 512),
        'required' => sanitizeBool($field['required'] ?? false),
    ];

    // No fallback - throw error if field type is not in allowed list
    if (!in_array($safe['type'], $allowedTypes, true)) {
        throw new RuntimeException('Invalid field type "' . $safe['type'] . '". Must be one of: ' . implode(', ', $allowedTypes));
    }

    if ($safe['id'] === '') {
        unset($safe['id']);
    }

    $options = $field['options'] ?? [];
    if (!is_array($options)) {
        $options = [];
    }

    switch ($safe['type']) {
        case 'item-pricing':
            $safe['options'] = sanitizeItemPricingOptions($options);
            break;
        case 'dropdown':
        case 'radio':
        case 'radio-toggle':
            $safe['options'] = sanitizeOptionList($options);
            break;
        case 'venue-ticketing':
            try {
                error_log("DEBUG: Processing venue-ticketing field. Options count: " . count($options));
                $safe['options'] = sanitizeVenueOptions($options);
                error_log("DEBUG: Successfully sanitized venue options. Result count: " . count($safe['options']));
            } catch (Exception $e) {
                error_log("ERROR: Failed to sanitize venue options: " . $e->getMessage());
                error_log("ERROR: Stack trace: " . $e->getTraceAsString());
                $safe['options'] = [];
            }
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
    
    // Include fieldsetKey/fieldsetKey for matching during editable_fieldsets build
    if (isset($field['fieldsetKey'])) {
        $safe['fieldsetKey'] = sanitizeString($field['fieldsetKey'], 128);
    } elseif (isset($field['key'])) {
        $safe['fieldsetKey'] = sanitizeString($field['key'], 128);
    }
    
    // Include selectedAmenities for amenities field type (stores array of amenity IDs/values)
    if (isset($field['selectedAmenities']) && is_array($field['selectedAmenities'])) {
        $safe['selectedAmenities'] = array_values(array_filter(
            array_map(function($item) {
                return is_string($item) || is_numeric($item) ? (string)$item : null;
            }, $field['selectedAmenities']),
            function($item) { return $item !== null && $item !== ''; }
        ));
    }
    
    // Include checkoutOptions for checkout field type (stores numeric IDs)
    if (isset($field['checkoutOptions']) && is_array($field['checkoutOptions'])) {
        $safe['checkoutOptions'] = array_values(array_filter(
            array_map(function($opt) {
                // Accept both numeric and string representations of IDs
                if (is_numeric($opt)) {
                    return (int)$opt;
                } elseif (is_string($opt) && trim($opt) !== '') {
                    $trimmed = trim($opt);
                    return is_numeric($trimmed) ? (int)$trimmed : 0;
                }
                return 0;
            }, $field['checkoutOptions']),
            function($opt) { return $opt > 0; }
        ));
    }
    
    // Include customPlaceholder and customTooltip for editable fieldsets
    if (isset($field['customPlaceholder']) && is_string($field['customPlaceholder'])) {
        $safe['customPlaceholder'] = sanitizeString($field['customPlaceholder'], 512);
    }
    if (isset($field['customTooltip']) && is_string($field['customTooltip'])) {
        $safe['customTooltip'] = sanitizeString($field['customTooltip'], 512);
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
            $value = sanitizeString($option['value'] ?? $option['name'] ?? $option['item_name'] ?? '', 255);
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

function sanitizeItemPricingOptions(array $options): array
{
    $clean = [];
    foreach ($options as $option) {
        if (!is_array($option)) {
            continue;
        }
        $clean[] = [
            'item_name' => sanitizeString($option['item_name'] ?? '', 255),
            'item_currency' => strtoupper(sanitizeString($option['item_currency'] ?? '', 12)),
            'item_price' => sanitizeString($option['item_price'] ?? '', 64),
        ];
    }
    return $clean;
}

function sanitizeVenueOptions(array $options): array
{
    error_log("DEBUG: sanitizeVenueOptions called with " . count($options) . " options");
    $venues = [];
    foreach ($options as $index => $venue) {
        try {
            if (!is_array($venue)) {
                error_log("WARNING: Venue at index $index is not an array: " . gettype($venue));
                continue;
            }
            $venueData = [
                'name' => sanitizeString($venue['name'] ?? ''),
                'address' => sanitizeString($venue['address'] ?? ''),
                'location' => sanitizeLocation($venue['location'] ?? null),
                'feature' => sanitizeFeature($venue['feature'] ?? null),
                'sessions' => sanitizeSessions($venue['sessions'] ?? []),
            ];
            $venues[] = $venueData;
            error_log("DEBUG: Processed venue $index: name='" . $venueData['name'] . "', sessions=" . count($venueData['sessions']));
        } catch (Exception $e) {
            error_log("ERROR: Failed to process venue at index $index: " . $e->getMessage());
            error_log("ERROR: Venue data: " . json_encode($venue));
        }
    }
    error_log("DEBUG: sanitizeVenueOptions returning " . count($venues) . " venues");
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
        error_log("WARNING: sanitizeSessions received non-array: " . gettype($sessions));
        return [];
    }
    $clean = [];
    foreach ($sessions as $index => $session) {
        try {
            if (!is_array($session)) {
                error_log("WARNING: Session at index $index is not an array: " . gettype($session));
                continue;
            }
            $sessionData = [
                'date' => sanitizeString($session['date'] ?? '', 64),
                'times' => sanitizeTimes($session['times'] ?? []),
            ];
            $clean[] = $sessionData;
            error_log("DEBUG: Processed session $index: date='" . $sessionData['date'] . "', times=" . count($sessionData['times']));
        } catch (Exception $e) {
            error_log("ERROR: Failed to process session at index $index: " . $e->getMessage());
            error_log("ERROR: Session data: " . json_encode($session));
        }
    }
    error_log("DEBUG: sanitizeSessions returning " . count($clean) . " sessions");
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
            'seating_areas' => sanitizeSeatingAreas($time['seating_areas'] ?? []),
        ];
    }
    return $clean;
}

function sanitizeSeatingAreas($seatingAreas): array
{
    if (!is_array($seatingAreas)) {
        return [];
    }
    $clean = [];
    foreach ($seatingAreas as $seatingArea) {
        if (!is_array($seatingArea)) {
            continue;
        }
        $clean[] = [
            'name' => sanitizeString($seatingArea['name'] ?? '', 255),
            'tiers' => sanitizeTiers($seatingArea['tiers'] ?? []),
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
    $hasFieldsetIds = $columns && in_array('fieldset_ids', $columns, true);
    $hasFieldsetName = $columns && in_array('fieldset_name', $columns, true);
    $hasFieldsetIds = $columns && in_array('fieldset_ids', $columns, true);
    $hasFieldsetName = $columns && in_array('fieldset_name', $columns, true);

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
    if ($hasFieldsetIds) {
        $selectParts[] = 's.`fieldset_ids`';
    }
    if ($hasFieldsetName) {
        $selectParts[] = 's.`fieldset_name`';
    }
    if ($hasFieldsetIds) {
        $selectParts[] = 's.`fieldset_ids`';
    }
    if ($hasFieldsetName) {
        $selectParts[] = 's.`fieldset_name`';
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
        if ($hasFieldsetIds && isset($row['fieldset_ids'])) {
            $record['fieldset_ids'] = $row['fieldset_ids'];
        }
        if ($hasFieldsetName && isset($row['fieldset_name'])) {
            $record['fieldset_name'] = $row['fieldset_name'];
        }
        if ($hasFieldsetIds && isset($row['fieldset_ids'])) {
            $record['fieldset_ids'] = $row['fieldset_ids'];
        }
        if ($hasFieldsetName && isset($row['fieldset_name'])) {
            $record['fieldset_name'] = $row['fieldset_name'];
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
    // Only select columns that exist in the database (avoid removed columns)
    $selectColumns = array_map(fn($col) => '`' . str_replace('`', '``', $col) . '`', $columns);
    $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM subcategories';
    $stmt = $pdo->query($sql);
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

function fetchFieldsetDefinitions(PDO $pdo): array
{
    try {
        $columns = fetchTableColumns($pdo, 'fieldsets');
        if (!$columns || !in_array('id', $columns, true)) {
            return [];
        }

        $select = ['id'];
        if (in_array('fieldset_name', $columns, true)) {
            $select[] = 'fieldset_name';
        } elseif (in_array('fieldset_name', $columns, true)) {
            $select[] = 'fieldset_name';
        }
        if (in_array('fieldset_key', $columns, true)) {
            $select[] = 'fieldset_key';
        } elseif (in_array('fieldset_key', $columns, true)) {
            $select[] = 'fieldset_key';
        }
        // Check for new column name, fallback to old column name
        $hasFormbuilderEditable = in_array('fieldset_editable', $columns, true) || in_array('formbuilder_editable', $columns, true);
        $editableColumnName = in_array('fieldset_editable', $columns, true) ? 'fieldset_editable' : 'formbuilder_editable';
        if ($hasFormbuilderEditable) {
            $select[] = $editableColumnName;
        }
        // Check for new column name, fallback to old column name
        $hasPlaceholder = in_array('fieldset_placeholder', $columns, true) || in_array('placeholder', $columns, true);
        $placeholderColumnName = in_array('fieldset_placeholder', $columns, true) ? 'fieldset_placeholder' : 'placeholder';
        if ($hasPlaceholder) {
            $select[] = $placeholderColumnName;
        }

        $sql = 'SELECT ' . implode(', ', array_map(static function (string $col): string {
            return '`' . str_replace('`', '``', $col) . '`';
        }, $select)) . ' FROM fieldsets';

        $stmt = $pdo->query($sql);
        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($row['id'])) {
                continue;
            }
            $id = (int) $row['id'];
            $name = isset($row['fieldset_name']) ? trim((string) $row['fieldset_name']) : (isset($row['fieldset_name']) ? trim((string) $row['fieldset_name']) : '');
            $key = isset($row['fieldset_key']) ? sanitizeKey((string) $row['fieldset_key']) : (isset($row['fieldset_key']) ? sanitizeKey((string) $row['fieldset_key']) : '');
            $entry = [
                'id' => $id,
                'name' => $name,
                'key' => $key,
            ];
            if ($hasFormbuilderEditable && isset($row[$editableColumnName])) {
                $entry['fieldset_editable'] = (bool) $row[$editableColumnName];
            }
            if ($hasPlaceholder && isset($row[$placeholderColumnName])) {
                $entry['fieldset_placeholder'] = trim((string) $row[$placeholderColumnName]);
            }
            $map[$id] = $entry;
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
    if (isset($field['input_type']) && $field['input_type'] !== '') {
        $candidates[] = mb_strtolower((string) $field['input_type']);
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
