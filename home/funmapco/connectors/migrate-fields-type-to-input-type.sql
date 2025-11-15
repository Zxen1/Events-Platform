-- Migration script to rename 'type' column to 'input_type' in 'fields' table
-- This avoids confusion with field_types.field_type_key

-- Step 1: Rename the column
ALTER TABLE `fields` CHANGE COLUMN `type` `input_type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;

-- Note: The code has been updated to support both 'type' (old) and 'input_type' (new)
-- for backwards compatibility during migration. After running this SQL, the old 'type'
-- references will no longer be used, but the code will continue to work.

