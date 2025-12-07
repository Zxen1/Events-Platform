# Migration: editable_fieldsets JSON → subcategory_edits Table

## Overview
This migration moves editable fieldset customizations from a JSON column in the `subcategories` table to a dedicated `subcategory_edits` table for better data integrity, queryability, and maintainability.

## Changes Made

### 1. New Table: `subcategory_edits`
- **Purpose**: Stores customizations for editable fieldsets (name, options) per subcategory
- **Structure**:
  - `id` (primary key)
  - `subcategory_id` (foreign key to subcategories)
  - `fieldset_id` (foreign key to fieldsets)
  - `custom_name` (varchar 255, nullable)
  - `custom_options` (JSON, nullable)
  - `created_at`, `updated_at` (timestamps)
  - Unique constraint on `(subcategory_id, fieldset_id)`

### 2. Migration Scripts
- **migration_subcategory_edits.sql**: SQL schema for the new table
- **migration_subcategory_edits.php**: PHP script to:
  1. Create the new table
  2. Migrate existing data from JSON column
  3. Optionally remove the old column (commented out for safety)

### 3. Code Updates

#### `save-form.php`
- **Before**: Built JSON array keyed by CSV index, saved to `editable_fieldsets` column
- **After**: 
  - Builds array of edit records keyed by `fieldset_id` (not CSV index)
  - Deletes existing edits for subcategory
  - Inserts new edits into `subcategory_edits` table
  - Removes old JSON column update code

#### `get-form.php`
- **Before**: Read `editable_fieldsets` JSON column, parsed to array keyed by CSV index
- **After**:
  - Queries `subcategory_edits` table for all subcategories
  - Builds map: `subcategory_id => fieldset_id => edit_data`
  - Uses `fieldset_id` as key instead of CSV index (more stable)

## Benefits

1. **Data Integrity**: Foreign key constraints ensure fieldset_id and subcategory_id exist
2. **Stability**: Uses `fieldset_id` instead of CSV index position (won't break if order changes)
3. **Queryability**: Can easily query "which subcategories customize fieldset X?"
4. **Maintainability**: Normalized structure, easier to understand and modify
5. **Performance**: Indexed lookups instead of JSON parsing

## Migration Steps

1. **Run the migration script**:
   ```bash
   php migration_subcategory_edits.php
   ```

2. **Verify the migration**:
   - Check that records were migrated correctly
   - Test form saving and loading
   - Compare data before/after

3. **Remove old column** (after verification):
   - Uncomment Step 4 in `migration_subcategory_edits.php`
   - Or run: `ALTER TABLE subcategories DROP COLUMN editable_fieldsets;`

## Backward Compatibility

- The code still accepts `editable_fieldsets` in the columns array (for API compatibility)
- The data structure returned is similar (fieldset_id keyed map instead of index-keyed)
- Frontend code should work without changes since it receives the same structure

## Notes

- The old `editable_fieldsets` column can be removed after migration is verified
- The migration script handles the conversion from CSV index to fieldset_id automatically
- Only stores customizations that differ from defaults (same behavior as before)
