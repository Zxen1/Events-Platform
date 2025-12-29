# Missing Messages List - New Site vs Live Site

This document lists all messages that exist in the live site but are missing or not being called in the new site.

## ADMIN PANEL MESSAGES

### ✅ EXISTS BUT NOT CALLED

1. **Save Success Message** (`msg_admin_saved`)
   - **Type:** Toast/Success
   - **Message:** "Saved"
   - **Should appear:** After successful save in admin panel
   - **Status:** `showStatus()` function exists but is NOT called after save
   - **Location:** Should be called in `admin-new.js` after `runSave()` succeeds (line ~798)

2. **Discard Changes Message** (`msg_admin_discarded`)
   - **Type:** Toast
   - **Message:** "Changes Discarded"
   - **Should appear:** After clicking discard button
   - **Status:** `showStatus()` function exists but is NOT called after discard
   - **Location:** Should be called in `admin-new.js` after `discardChanges()` (line ~855)

3. **Save Error - Network** (`msg_admin_save_error_network`)
   - **Type:** Error Toast
   - **Message:** "Unable to reach the server. Please try again."
   - **Should appear:** When save request fails due to network error
   - **Status:** `showError()` function exists but is NOT called in catch block
   - **Location:** Should be called in `admin-new.js` catch block (line ~811)

4. **Save Error - Response** (`msg_admin_save_error_response`)
   - **Type:** Error Toast
   - **Message:** "Unexpected response while saving changes."
   - **Should appear:** When server returns invalid response
   - **Status:** `showError()` function exists but is NOT called
   - **Location:** Should be called in `admin-new.js` when response validation fails

### ❌ MISSING COMPONENT

5. **Unsaved Changes Dialog** (`msg_admin_unsaved_title`, `msg_admin_unsaved_message`)
   - **Type:** Modal/Dialog (should use ConfirmDialogComponent)
   - **Title:** "Unsaved Changes"
   - **Message:** "You have unsaved changes. Save before closing the admin panel?"
   - **Should appear:** When trying to close admin panel with unsaved changes
   - **Status:** HTML element exists in old site (`index.html` line 573) but MISSING in new site (`index-new.html`)
   - **Status:** Code has TODO comment (line 352 in `admin-new.js`)
   - **Actions:** Cancel, Save, Discard Changes
   - **Component:** Should use `ConfirmDialogComponent` from `components-new.js`

## MEMBER PANEL MESSAGES

### ✅ EXISTS BUT USING HARDCODED STRINGS

6. **Login Success** (`msg_auth_login_success`)
   - **Type:** Toast/Success
   - **Message:** "Welcome back, {name}!"
   - **Status:** Currently hardcoded in `member-new.js` line 985: `'Welcome back, ' + displayName`
   - **Should use:** `getMessage('msg_auth_login_success', { name: displayName })`

7. **Logout Success** (`msg_auth_logout_success`)
   - **Type:** Toast/Success
   - **Message:** "You have been logged out."
   - **Status:** Currently hardcoded in `member-new.js` line 1083: `'You have been logged out'`
   - **Should use:** `getMessage('msg_auth_logout_success')`

8. **Login Fields Empty** (`msg_auth_login_empty`)
   - **Type:** Error Toast
   - **Message:** "Enter your email and password."
   - **Status:** Currently hardcoded in `member-new.js` line 955: `'Please enter email and password'`
   - **Should use:** `getMessage('msg_auth_login_empty')`

9. **Incorrect Credentials** (`msg_auth_login_incorrect`)
   - **Type:** Error Toast
   - **Message:** "Incorrect email or password. Try again."
   - **Status:** Currently hardcoded in `member-new.js` line 967: `'Invalid email or password'`
   - **Should use:** `getMessage('msg_auth_login_incorrect')`

10. **Login Failed** (`msg_auth_login_failed`)
    - **Type:** Error Toast
    - **Message:** "Unable to verify credentials. Please try again."
    - **Status:** Currently hardcoded in `member-new.js` line 989: `'Login failed. Please try again.'`
    - **Should use:** `getMessage('msg_auth_login_failed')`

11. **Registration Success** (`msg_auth_register_success`)
    - **Type:** Toast/Success
    - **Message:** "Welcome, {name}!"
    - **Status:** Currently hardcoded in `member-new.js` line 1071: `'Account created! Welcome, ' + name`
    - **Should use:** `getMessage('msg_auth_register_success', { name: name })`

12. **Registration Fields Empty** (`msg_auth_register_empty`)
    - **Type:** Error Toast
    - **Message:** "Please complete all required fields."
    - **Status:** Currently hardcoded in `member-new.js` line 1008: `'Please fill in all required fields'`
    - **Should use:** `getMessage('msg_auth_register_empty')`

13. **Password Too Short** (`msg_auth_register_password_short`)
    - **Type:** Error Toast
    - **Message:** "Password must be at least 4 characters."
    - **Status:** Currently hardcoded in `member-new.js` line 1016: `'Password must be at least 4 characters'`
    - **Should use:** `getMessage('msg_auth_register_password_short')`

14. **Passwords Don't Match** (`msg_auth_register_password_mismatch`)
    - **Type:** Error Toast
    - **Message:** "Passwords do not match."
    - **Status:** Currently hardcoded in `member-new.js` line 1022: `'Passwords do not match'`
    - **Should use:** `getMessage('msg_auth_register_password_mismatch')`

15. **Registration Failed** (`msg_auth_register_failed`)
    - **Type:** Error Toast
    - **Message:** "Registration failed."
    - **Status:** Currently hardcoded in `member-new.js` line 1075: `'Registration failed. Please try again.'`
    - **Should use:** `getMessage('msg_auth_register_failed')`

### ❌ MISSING COMPONENT

16. **Member Unsaved Changes Dialog** (`msg_member_unsaved_title`, `msg_member_unsaved_message`)
    - **Type:** Modal/Dialog (should use ConfirmDialogComponent)
    - **Title:** "Unsaved Changes"
    - **Message:** "You have unsaved changes. Save before closing the member panel?"
    - **Status:** HTML element exists in new site (`index-new.html` line 633) but may not be implemented
    - **Actions:** Cancel, Save, Discard
    - **Component:** Should use `ConfirmDialogComponent` from `components-new.js`

## POST CREATION MESSAGES

### ❌ MISSING (Not checked in member-new.js)

17. **Post Created Successfully** (`msg_post_create_success`)
    - **Type:** Toast/Success
    - **Message:** "Your listing has been posted!"
    - **Status:** Need to check if this is called in post creation flow

18. **Post Created With Images** (`msg_post_create_with_images`)
    - **Type:** Toast/Success
    - **Message:** "Your listing and images have been posted!"
    - **Status:** Need to check if this is called in post creation flow

19. **Post Creation Failed** (`msg_post_create_error`)
    - **Type:** Error Toast
    - **Message:** "Unable to post your listing. Please try again."
    - **Status:** Need to check if this is called in post creation flow

20. **Category Not Selected** (`msg_post_create_no_category`)
    - **Type:** Error Toast
    - **Message:** "Select a category and subcategory before posting."
    - **Status:** Need to check if this is called in post creation flow

21. **Form Loading** (`msg_post_loading_form`)
    - **Type:** Toast
    - **Message:** "Loading form fields…"
    - **Status:** Need to check if this is called when loading form

22. **Form Load Failed** (`msg_post_form_load_error`)
    - **Type:** Warning Toast
    - **Message:** "We couldn't load the latest form fields. You can continue with the defaults for now."
    - **Status:** Need to check if this is called when form load fails

23. **Post Submission Confirmation Error** (`msg_post_submit_confirm_error`)
    - **Type:** Error Toast
    - **Message:** "Unable to confirm your listing submission."
    - **Status:** Need to check if this is called in post creation flow

## VALIDATION MESSAGES

### ❌ MISSING (Not checked in post creation)

24. **Dropdown Selection Required** (`msg_post_validation_select`)
    - **Type:** Error Toast
    - **Message:** "Select an option for {field}."
    - **Status:** Need to check if validation messages are shown

25. **Field Required** (`msg_post_validation_required`)
    - **Type:** Error Toast
    - **Message:** "Enter a value for {field}."
    - **Status:** Need to check if validation messages are shown

26. **Location Required** (`msg_post_validation_location`)
    - **Type:** Error Toast
    - **Message:** "Select a location for {field}."
    - **Status:** Need to check if validation messages are shown

27. **Radio Selection Required** (`msg_post_validation_choose`)
    - **Type:** Error Toast
    - **Message:** "Choose an option for {field}."
    - **Status:** Need to check if validation messages are shown

28. **File Upload Required** (`msg_post_validation_file_required`)
    - **Type:** Error Toast
    - **Message:** "Add at least one file for {field}."
    - **Status:** Need to check if validation messages are shown

29. **Pricing Details Required** (`msg_post_validation_pricing`)
    - **Type:** Error Toast
    - **Message:** "Provide pricing details for {field}."
    - **Status:** Need to check if validation messages are shown

30. **Price Tiers Required** (`msg_post_validation_pricing_tiers`)
    - **Type:** Error Toast
    - **Message:** "Add at least one price tier for {field}."
    - **Status:** Need to check if validation messages are shown

31. **Currency Required** (`msg_error_currency_required`)
    - **Type:** Error Toast
    - **Message:** "Please select a currency before entering a price."
    - **Status:** Need to check if validation messages are shown

32. **Duplicate Session Time** (`msg_error_duplicate_session_time`)
    - **Type:** Error Toast
    - **Message:** "There is already a session for that time."
    - **Status:** Need to check if validation messages are shown

## CONFIRMATION DIALOGS

### ✅ EXISTS (Using ConfirmDialogComponent)

33. **Delete Checkout Option** (`msg_confirm_delete_checkout_option_title`, `msg_confirm_delete_checkout_option`)
    - **Type:** Confirm Dialog
    - **Status:** ✅ IMPLEMENTED - Uses `ConfirmDialogComponent` in `admin-new.js` line 2634

### ❌ MISSING (Not checked)

34. **Delete Item Confirmation** (`msg_confirm_delete_item`)
    - **Type:** Confirm Dialog
    - **Message:** "Are you sure you want to delete this item?"
    - **Status:** Need to check if delete confirmations use this message

35. **Delete Venue Confirmation** (`msg_confirm_delete_venue`)
    - **Type:** Confirm Dialog
    - **Message:** "Are you sure you want to remove this venue?"
    - **Status:** Need to check if venue deletion uses this message

36. **Add Field Confirmation** (`msg_confirm_add_field`)
    - **Type:** Confirm Dialog
    - **Message:** "Add a new field to {subcategory}?"
    - **Status:** Need to check if formbuilder uses confirmations

37. **Add Subcategory Confirmation** (`msg_confirm_add_subcategory`)
    - **Type:** Confirm Dialog
    - **Message:** "Add a new subcategory to {category}?"
    - **Status:** Need to check if formbuilder uses confirmations

38. **Add Category Confirmation** (`msg_confirm_add_category`)
    - **Type:** Confirm Dialog
    - **Message:** "Add a new category to the formbuilder?"
    - **Status:** Need to check if formbuilder uses confirmations

39. **Console Filter Enable Confirmation** (`msg_confirm_console_filter_enable`)
    - **Type:** Confirm Dialog
    - **Message:** "Console filter will be enabled on next page load. Reload now?"
    - **Status:** Need to check if console filter uses this

40. **Console Filter Disable Confirmation** (`msg_confirm_console_filter_disable`)
    - **Type:** Confirm Dialog
    - **Message:** "Console filter will be disabled on next page load. Reload now?"
    - **Status:** Need to check if console filter uses this

## OTHER MESSAGES

### ❌ MISSING (Not checked)

41. **Map Zoom Required** (`msg_map_zoom_required`)
    - **Type:** Toast
    - **Message:** "Zoom the map to see post"
    - **Status:** Need to check if map module shows this

42. **Link Copied** (`msg_link_copied`)
    - **Type:** Toast
    - **Message:** "Link Copied"
    - **Status:** Need to check if link copying shows this

43. **No Icons Found Error** (`msg_error_no_icons`)
    - **Type:** Error Toast (supports HTML)
    - **Message:** "No icons found.<br><br>Please select the icon folder in the Admin Settings Tab.<br><br>Example: <code>assets/icons</code>"
    - **Status:** Need to check if icon picker shows this

## SUMMARY

### Critical Missing (Must Implement):
1. **Admin Unsaved Changes Dialog** - Missing HTML element and implementation
2. **Save Success Message** - Function exists but not called
3. **Discard Changes Message** - Function exists but not called
4. **Save Error Messages** - Functions exist but not called

### Should Use Database Messages (Currently Hardcoded):
- All member auth messages (login/register) - 10 messages
- Should use `getMessage()` instead of hardcoded strings

### Need to Verify:
- Post creation messages (7 messages)
- Validation messages (9 messages)
- Confirmation dialogs (8 messages)
- Other messages (3 messages)

**Total Messages in Database:** 82 messages
**Verified Missing/Not Called:** 16 messages
**Need to Verify:** 27 messages

