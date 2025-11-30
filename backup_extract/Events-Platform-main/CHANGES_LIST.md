# Changes Made - Numbered List for Incremental Testing

## Category A: Removed metadata_json references (Backend PHP)

### A1. get-form.php - Removed metadata_json from categories
- Removed `metadata_json` column selection and processing
- Removed metadata JSON decoding for categories
- Removed metadata fallbacks for fieldTypeIds, fieldTypeNames, icon, marker

### A2. get-form.php - Removed metadata_json from subcategories  
- Removed `metadata_json` column selection and processing
- Removed metadata JSON decoding for subcategories
- Removed metadata fallbacks for fieldTypeIds, fieldTypeNames, icon, marker, markerId, categoryShape, versionPriceCurrencies

### A3. get-form.php - Added currency field options fetch
- Added code to fetch `versionPriceCurrencies` from `fields.options` where `field_key='currency'` and `id=13`
- Updated `buildSnapshot()` to accept `currencyOptions` parameter

### A4. get-form.php - Added required column support
- Added `required` column selection and reading from `subcategories.required`
- Added `subcategory_key` column selection and reading

### A5. get-form.php - Added placeholder from field_types
- Added `placeholder` column selection and reading from `field_types.placeholder`

### A6. get-form.php - Updated markerId source
- Changed `markerId` to come from `subcategory_key` instead of `metadata_json`
- Removed `categoryShape` handling (obsolete)

### A7. save-form.php - Removed metadata_json writes
- Removed all `metadata_json` column writes
- Removed field preservation from metadata_json
- Removed field type preservation from metadata_json

### A8. save-form.php - Added required column support
- Added code to read and write `required` column in `subcategories` table
- Parses CSV of required field type IDs

---

## Category B: Removed hardcoded defaults with Elvis placeholders (Frontend JS)

### B1. Removed DEFAULT_SUBCATEGORY_FIELDS constant
- **Location**: Line ~3925-3931
- **Content**: Hardcoded fields with Elvis placeholders:
  ```javascript
  { name: 'Title', type: 'title', placeholder: 'ie. Elvis Presley - Live on Stage', required: true },
  { name: 'Description', type: 'description', placeholder: 'ie. Come and enjoy the music!', required: true },
  { name: 'Images', type: 'images', placeholder: '', required: true }
  ```
- **Replaced with**: Comment "Fields now come from backend via field_types table, no hardcoded defaults"

### B2. Removed sharedDefaultSubcategoryFields constant
- **Location**: Line ~20746-20752
- **Content**: Same Elvis placeholders as B1
- **Replaced with**: Comment "Fields now come from backend via field_types table, no hardcoded defaults"

### B3. Removed ensureDefaultFieldSet function
- **Location**: Line ~11275-11287
- **Content**: Function that forced default fields (Title, Description, Images) to be added if fields array was empty
- **Replaced with**: Comment "Fields now come from backend via field_types, no hardcoded defaults"

### B4. Removed forced title/description/images to be required
- **Location**: Line ~8649-8653
- **Content**: Code that forced `title`, `description`, and `images` field types to be required by default
- **Changed to**: Only use `required` property if it exists, otherwise defaults to `false`

### B5. Removed hardcoded title requirement before posting
- **Location**: Line ~22127-22138
- **Content**: Code that forced "Enter a title before posting your listing" error
- **Changed to**: Comment "Title requirement is now handled by backend validation based on subcategories.required column"

### B6. Removed fallback to sharedDefaultSubcategoryFields
- **Location**: Line ~20980-20982 in `getFieldsForSelection()`
- **Content**: Code that fell back to `sharedDefaultSubcategoryFields` if fields array was empty
- **Removed**: Now returns empty array if no fields from backend

---

## Category C: Removed obsolete data from snapshot (Frontend JS)

### C1. Removed categoryShapes from captureFormbuilderSnapshot()
- **Location**: Line ~12976-12987
- **Removed**: `categoryShapes: cloneMapLike(categoryShapes)`

### C2. Removed categoryShapes from restoreFormbuilderSnapshot()
- **Location**: Line ~13061-13062
- **Removed**: `assignMapLike(categoryShapes, snapshot.categoryShapes)`

### C3. Removed categoryShapes window variable
- **Location**: Line ~4125
- **Removed**: `const categoryShapes = window.categoryShapes = window.categoryShapes || {};`

### C4. Removed versionPriceCurrencies from captureFormbuilderSnapshot()
- **Location**: Line ~12976-12987
- **Removed**: `versionPriceCurrencies: Array.isArray(VERSION_PRICE_CURRENCIES) ? VERSION_PRICE_CURRENCIES.slice() : []`

### C5. Removed versionPriceCurrencies from restoreFormbuilderSnapshot()
- **Location**: Line ~13063-13065
- **Removed**: Code that restored `VERSION_PRICE_CURRENCIES` from snapshot

### C6. Removed fallback to DEFAULT_FORMBUILDER_SNAPSHOT.versionPriceCurrencies
- **Location**: Line ~3533-3534 in `normalizeFormbuilderSnapshot()`
- **Removed**: Fallback that added default currencies if snapshot was empty

### C7. Updated DEFAULT_FORMBUILDER_SNAPSHOT.versionPriceCurrencies
- **Location**: Line ~3364
- **Changed**: From `['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD']` to `[]` (empty array)

### C8. Removed subcategoryMarkerIds from captureFormbuilderSnapshot()
- **Location**: Line ~12976-12987
- **Removed**: `subcategoryMarkerIds: cloneMapLike(subcategoryMarkerIds)`

### C9. Removed subcategoryMarkerIds from restoreFormbuilderSnapshot()
- **Location**: Line ~13061
- **Removed**: `assignMapLike(subcategoryMarkerIds, snapshot.subcategoryMarkerIds)`

### C10. Removed subcategoryMarkerIds window variable
- **Location**: Line ~4124
- **Removed**: `const subcategoryMarkerIds = window.subcategoryMarkerIds = window.subcategoryMarkerIds || {};`

### C11. Updated references to use slugify instead of subcategoryMarkerIds
- **Location**: Line ~15764, ~15807, ~18027, ~16131
- **Changed**: From `subcategoryMarkerIds[post.subcategory] || slugify(post.subcategory)` to just `slugify(post.subcategory)`

---

## Category D: Safety checks and error handling

### D1. Updated cloneFieldValue to filter null/undefined
- **Location**: Line ~3348-3361
- **Added**: Check for null/undefined and filter them from arrays

### D2. Added null filtering after mapping fields
- **Location**: Line ~3487-3489
- **Added**: `.filter(f => f !== null && f !== undefined)` after mapping

### D3. Added null checks in fields.forEach loops
- **Location**: Multiple places
  - Line ~12550: Check `if(!existingField) return;`
  - Line ~12552: Check `if(!fieldRow || !fieldRow.row) return;`
  - Line ~11326: Check `if(!fieldData) return;`
  - Line ~21864: Check `if(!field) return;`

### D4. Added null check in rows.forEach loop
- **Location**: Line ~7529
- **Added**: Check `if(!row || !row.dataset) return;`

### D5. Added Mapbox token validation
- **Location**: Line ~15241-15245
- **Added**: Validation for Mapbox token before initialization

### D6. Added Mapbox error handler
- **Location**: Line ~15273-15281
- **Added**: Error event handler that detects token/auth errors

### D7. Added safety checks for Mapbox event listeners
- **Location**: Multiple places (~15290-15300, ~15362-15371, ~15374-15382)
- **Added**: Checks for `map && typeof map.on === 'function'` before attaching listeners

---

## Testing Order Recommendation

**Start with Category B (Elvis stuff) - Most likely culprit:**

1. **B1** - Remove DEFAULT_SUBCATEGORY_FIELDS constant
2. **B2** - Remove sharedDefaultSubcategoryFields constant  
3. **B3** - Remove ensureDefaultFieldSet function
4. **B4** - Remove forced title/description/images to be required
5. **B5** - Remove hardcoded title requirement
6. **B6** - Remove fallback to sharedDefaultSubcategoryFields

**Then test Category C (Snapshot data):**

7. **C1-C3** - Remove categoryShapes
8. **C4-C7** - Remove versionPriceCurrencies  
9. **C8-C11** - Remove subcategoryMarkerIds

**Then test Category A (Backend PHP):**

10. **A1-A8** - All metadata_json and backend changes

**Finally Category D (Safety checks):**

11. **D1-D7** - All null checks and error handling

