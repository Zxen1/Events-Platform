# Database Comparison: Version 79 → Version 83

## CRITICAL CHANGES THAT COULD BREAK THE WEBSITE

### 1. **checkout_options Table - MAJOR SCHEMA CHANGE**

**REMOVED Column:**
- `checkout_duration_days` (int(11) NOT NULL) - **This column was removed entirely**

**Data Changes:**
- **DB 79:** Had 10 checkout options (IDs 1-10) with duration-based keys:
  - 'free-30', 'standard-30', 'featured-30', 'featured-ad-30'
  - 'free-60', 'standard-60', 'featured-60', 'featured-ad-60'
  - 'free-365', 'standard-365'
  
- **DB 83:** Only 4 checkout options (IDs 1-4) with simplified keys:
  - 'free', 'standard', 'featured', 'featured-ad'
  - **6 options were deleted (IDs 5-10)**

**Impact:** If code references `checkout_duration_days` column or the deleted option IDs, it will fail.

---

### 2. **subcategories Table - MAJOR SCHEMA CHANGE**

**REMOVED Columns:**
- `listing_fee` (decimal(10,2))
- `renew_fee` (decimal(10,2))
- `featured_fee` (decimal(10,2))
- `renew_featured_fee` (decimal(10,2))
- `listing_days` (int(11))

**ADDED Column:**
- `checkout_surcharge` (decimal(10,2) DEFAULT NULL)

**Data Changes:**
- **Field Type IDs:** Removed checkout field type (15)
  - DB 79: `'1,2,12,16,15'` (included checkout field type 15)
  - DB 83: `'1,2,12,16'` (checkout field type removed)
  
- **Field Type Names:** Removed "Checkout" from names
  - DB 79: `'Title, Description, Images, Venue Ticketing, Checkout'`
  - DB 83: `'Title, Description, Images, Venue Ticketing'`
  
- **Required Fields:** Reduced from 5 to 4
  - DB 79: `'1,1,1,1,1'` (5 required fields)
  - DB 83: `'1,1,1,1'` (4 required fields)
  
- **checkout_options_id:** Changed from specific IDs to NULL
  - DB 79: `'1,11,7,2,3'` (had checkout option IDs)
  - DB 83: `NULL` (all set to NULL)

**Impact:** 
- Code expecting fee columns will fail
- Code expecting checkout field type in subcategories will fail
- Code expecting checkout_options_id values will get NULL instead

---

## SUMMARY OF BREAKING CHANGES

1. ✅ **checkout_options.checkout_duration_days** - Column removed
2. ✅ **checkout_options** - 6 options deleted (IDs 5-10)
3. ✅ **checkout_options.checkout_key** - All keys renamed (removed duration suffixes)
4. ✅ **subcategories.listing_fee** - Column removed
5. ✅ **subcategories.renew_fee** - Column removed
6. ✅ **subcategories.featured_fee** - Column removed
7. ✅ **subcategories.renew_featured_fee** - Column removed
8. ✅ **subcategories.listing_days** - Column removed
9. ✅ **subcategories.checkout_surcharge** - New column added
10. ✅ **subcategories.field_type_id** - Checkout field type (15) removed
11. ✅ **subcategories.checkout_options_id** - All set to NULL (was populated)

---

## POTENTIAL CODE ISSUES

Check these files for references to removed columns:
- Any code accessing `checkout_duration_days`
- Any code accessing `listing_fee`, `renew_fee`, `featured_fee`, `renew_featured_fee`, `listing_days`
- Any code expecting checkout field type (15) in subcategories
- Any code expecting `checkout_options_id` to have values (now all NULL)

