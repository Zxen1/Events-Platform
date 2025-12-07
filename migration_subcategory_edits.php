<?php
/**
 * Migration Script: Move editable_fieldsets from JSON column to subcategory_edits table
 * 
 * This script:
 * 1. Creates the subcategory_edits table
 * 2. Migrates existing data from subcategories.editable_fieldsets JSON to the new table
 * 3. Optionally removes the editable_fieldsets column (commented out for safety)
 * 
 * Usage: Run this script once via command line or browser
 * php migration_subcategory_edits.php
 */

require_once __DIR__ . '/home/funmapco/config.php';

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    echo "Starting migration...\n\n";

    // Step 1: Create the subcategory_edits table
    echo "Step 1: Creating subcategory_edits table...\n";
    $createTableSql = "
        CREATE TABLE IF NOT EXISTS `subcategory_edits` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `subcategory_id` int(11) NOT NULL,
          `fieldset_id` int(11) NOT NULL,
          `custom_name` varchar(255) DEFAULT NULL,
          `custom_options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_options`)),
          `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
          `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `subcategory_fieldset` (`subcategory_id`, `fieldset_id`),
          KEY `idx_subcategory_id` (`subcategory_id`),
          KEY `idx_fieldset_id` (`fieldset_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $pdo->exec($createTableSql);
    echo "✓ Table created successfully\n\n";

    // Step 2: Migrate existing data
    echo "Step 2: Migrating existing data...\n";
    
    // Get all subcategories with editable_fieldsets
    $stmt = $pdo->query("
        SELECT id, fieldset_ids, editable_fieldsets 
        FROM subcategories 
        WHERE editable_fieldsets IS NOT NULL 
        AND editable_fieldsets != '' 
        AND JSON_VALID(editable_fieldsets) = 1
    ");
    
    $migrated = 0;
    $errors = 0;
    
    while ($row = $stmt->fetch()) {
        $subcategoryId = (int)$row['id'];
        $fieldsetIdsCsv = $row['fieldset_ids'] ?? '';
        $editableFieldsetsJson = $row['editable_fieldsets'];
        
        if (empty($fieldsetIdsCsv) || empty($editableFieldsetsJson)) {
            continue;
        }
        
        // Parse fieldset_ids CSV
        $fieldsetIds = array_filter(
            array_map('trim', explode(',', $fieldsetIdsCsv)),
            function($id) { return is_numeric($id) && $id > 0; }
        );
        $fieldsetIds = array_values(array_map('intval', $fieldsetIds));
        
        // Parse editable_fieldsets JSON
        $editableFieldsets = json_decode($editableFieldsetsJson, true);
        if (!is_array($editableFieldsets)) {
            echo "  ⚠ Warning: Invalid JSON for subcategory ID {$subcategoryId}\n";
            $errors++;
            continue;
        }
        
        // Migrate each editable fieldset
        foreach ($editableFieldsets as $csvIndex => $editData) {
            $index = (int)$csvIndex;
            
            // Validate index is within bounds
            if ($index < 0 || $index >= count($fieldsetIds)) {
                echo "  ⚠ Warning: Index {$index} out of bounds for subcategory ID {$subcategoryId}\n";
                $errors++;
                continue;
            }
            
            $fieldsetId = $fieldsetIds[$index];
            
            // Extract custom data
            $customName = null;
            $customOptions = null;
            
            if (isset($editData['name']) && is_string($editData['name']) && trim($editData['name']) !== '') {
                $customName = trim($editData['name']);
            }
            
            if (isset($editData['options']) && is_array($editData['options']) && !empty($editData['options'])) {
                $customOptions = json_encode($editData['options'], JSON_UNESCAPED_UNICODE);
            }
            
            // Only insert if there's actual custom data
            if ($customName !== null || $customOptions !== null) {
                try {
                    $insertStmt = $pdo->prepare("
                        INSERT INTO subcategory_edits (subcategory_id, fieldset_id, custom_name, custom_options)
                        VALUES (:subcategory_id, :fieldset_id, :custom_name, :custom_options)
                        ON DUPLICATE KEY UPDATE
                            custom_name = VALUES(custom_name),
                            custom_options = VALUES(custom_options),
                            updated_at = CURRENT_TIMESTAMP
                    ");
                    
                    $insertStmt->execute([
                        ':subcategory_id' => $subcategoryId,
                        ':fieldset_id' => $fieldsetId,
                        ':custom_name' => $customName,
                        ':custom_options' => $customOptions,
                    ]);
                    
                    $migrated++;
                } catch (PDOException $e) {
                    echo "  ✗ Error migrating subcategory {$subcategoryId}, fieldset {$fieldsetId}: " . $e->getMessage() . "\n";
                    $errors++;
                }
            }
        }
    }
    
    echo "✓ Migration complete: {$migrated} records migrated, {$errors} errors\n\n";
    
    // Step 3: Verify migration
    echo "Step 3: Verifying migration...\n";
    $countStmt = $pdo->query("SELECT COUNT(*) as count FROM subcategory_edits");
    $count = $countStmt->fetch()['count'];
    echo "✓ Total records in subcategory_edits: {$count}\n\n";
    
    // Step 4: Optional - Remove editable_fieldsets column (commented out for safety)
    // Uncomment the following lines after verifying the migration is successful
    /*
    echo "Step 4: Removing editable_fieldsets column from subcategories table...\n";
    $pdo->exec("ALTER TABLE `subcategories` DROP COLUMN `editable_fieldsets`");
    echo "✓ Column removed successfully\n\n";
    */
    
    echo "Migration completed successfully!\n";
    echo "\n⚠ IMPORTANT: After verifying the migration, uncomment Step 4 in this script to remove the old column.\n";
    
} catch (PDOException $e) {
    echo "✗ Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}
