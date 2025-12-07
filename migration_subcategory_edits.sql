-- Migration: Move editable_fieldsets from JSON column to subcategory_edits table
-- Date: 2025-12-07
-- Description: Creates new subcategory_edits table and migrates data from subcategories.editable_fieldsets JSON column

-- Step 1: Create the new subcategory_edits table
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

-- Step 2: Migrate existing data from editable_fieldsets JSON column
-- This migration script needs to be run via PHP to properly parse JSON and fieldset_ids CSV
-- See migration_subcategory_edits.php for the actual migration logic

-- Step 3: After migration is complete and verified, remove the editable_fieldsets column
-- ALTER TABLE `subcategories` DROP COLUMN `editable_fieldsets`;
