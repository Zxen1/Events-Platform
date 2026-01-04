/* ============================================================================
   FORMBUILDER MODULE - Admin Panel > Forms Tab
   Category/Subcategory/Field Editor
   ============================================================================
   
   FIELD-LEVEL TRACKING:
   This module registers itself with AdminModule's field registry as a
   "composite" field. Instead of tracking individual inputs, it captures
   the entire formbuilder state as JSON and compares it to the baseline.
   
   HOW IT WORKS:
   1. When formbuilder loads, it calls:
      AdminModule.registerComposite('formbuilder', captureFormbuilderState)
      
   2. captureFormbuilderState() reads the current DOM and returns an object
      with all categories, subcategories, fields, icons, etc.
      
   3. When any input changes, notifyChange() tells AdminModule to recheck.
      AdminModule calls captureFormbuilderState() and compares to baseline.
      
   4. If JSON differs from baseline → save button green
      If JSON matches baseline → save button not green
      
   5. After save, AdminModule.updateCompositeBaseline('formbuilder') is called
      to set the new baseline.
      
   6. Discard fetches fresh data from database (single source of truth).
   
   FOR FUTURE DEVELOPERS:
   - Every input in formbuilder must call notifyChange() when it changes
   - The captureFormbuilderState() function must capture ALL user-editable data
   - If you add new fields, update captureFormbuilderState() to include them
   - Do NOT store cached data for comparison - use the field registry system
   
   ============================================================================ */

(function() {
    'use strict';

    var container = null;
    var isLoaded = false;
    var checkoutOptions = []; // Module-local storage
    var siteCurrency = ''; // Module-local storage
    
    // Scroll anchoring (keeps clicked accordion headers stationary when panels above collapse)
    var scrollContainer = null;
    var scrollGapEl = null;
    var scrollGapBottomEl = null;
    var isAdjustingScroll = false;
    var suppressGapConsumeUntil = 0;
    
    // Reference data (not for change tracking - just data needed to build the UI)
    var loadedFieldsets = [];
    var loadedCurrencies = [];
    var loadedCategoryIconPaths = {};
    var loadedSubcategoryIconPaths = {};
    
    function applySafeIconImage(imgEl, src) {
        if (!imgEl) return;
        imgEl.alt = '';
        // Hide broken icons but keep spacing (visibility hidden).
        imgEl.onerror = function() {
            imgEl.classList.add('formbuilder-icon--empty');
            imgEl.removeAttribute('src');
        };
        if (src && typeof src === 'string' && src.trim() !== '') {
            imgEl.classList.remove('formbuilder-icon--empty');
            imgEl.src = src;
        } else {
            imgEl.classList.add('formbuilder-icon--empty');
            imgEl.removeAttribute('src');
        }
    }
    
    function findScrollContainer() {
        if (!container) return null;
        if (scrollContainer && scrollContainer.isConnected) return scrollContainer;
        
        // Admin panel body is the intended scroll container in the new site
        scrollContainer = container.closest('.admin-panel-body') || container.closest('.admin-panel-content');
        if (!scrollContainer) {
            scrollContainer = document.scrollingElement || document.documentElement;
        }
        return scrollContainer;
    }
    
    function ensureScrollGap() {
        if (!container) return null;
        if (scrollGapEl && scrollGapEl.isConnected) return scrollGapEl;
        
        scrollGapEl = container.querySelector('.formbuilder-scroll-gap');
        if (!scrollGapEl) {
            scrollGapEl = document.createElement('div');
            scrollGapEl.className = 'formbuilder-scroll-gap';
            scrollGapEl.setAttribute('aria-hidden', 'true');
            container.insertBefore(scrollGapEl, container.firstChild);
        } else {
            // Keep it at the top
            if (container.firstChild !== scrollGapEl) {
                container.insertBefore(scrollGapEl, container.firstChild);
            }
        }
        return scrollGapEl;
    }

    function ensureScrollGapBottom() {
        if (!container) return null;
        if (scrollGapBottomEl && scrollGapBottomEl.isConnected) {
            // Keep it at the bottom, but avoid re-appending on every call (can trigger
            // expensive MutationObserver work / console errors in external scripts).
            if (container.lastChild !== scrollGapBottomEl) {
                container.appendChild(scrollGapBottomEl);
            }
            return scrollGapBottomEl;
        }

        scrollGapBottomEl = container.querySelector('.formbuilder-scroll-gap-bottom');
        if (!scrollGapBottomEl) {
            scrollGapBottomEl = document.createElement('div');
            scrollGapBottomEl.className = 'formbuilder-scroll-gap-bottom';
            scrollGapBottomEl.setAttribute('aria-hidden', 'true');
        }
        // Ensure it's last (once)
        if (container.lastChild !== scrollGapBottomEl) {
            container.appendChild(scrollGapBottomEl);
        }
        return scrollGapBottomEl;
    }
    
    function getGapHeight() {
        var el = ensureScrollGap();
        if (!el) return 0;
        return el.offsetHeight || 0;
    }
    
    function setGapHeight(px) {
        var el = ensureScrollGap();
        if (!el) return;
        var next = Math.max(0, Math.round(px || 0));
        el.style.height = next ? (next + 'px') : '0px';
    }

    function getBottomGapHeight() {
        var el = ensureScrollGapBottom();
        if (!el) return 0;
        return el.offsetHeight || 0;
    }

    function setBottomGapHeight(px) {
        var el = ensureScrollGapBottom();
        if (!el) return;
        var next = Math.max(0, Math.round(px || 0));
        el.style.height = next ? (next + 'px') : '0px';
    }
    
    function maybeConsumeGapOnScroll() {
        if (isAdjustingScroll) return;
        if (suppressGapConsumeUntil && Date.now() < suppressGapConsumeUntil) return;
        
        var sc = findScrollContainer();
        if (!sc) return;
        
        // IMPORTANT: do not call ensure/append helpers here; scroll handlers must avoid
        // DOM mutations. External scripts may observe mutations and throw.
        var gap = (scrollGapEl && scrollGapEl.isConnected) ? (scrollGapEl.offsetHeight || 0) : 0;
        var bottomGap = (scrollGapBottomEl && scrollGapBottomEl.isConnected) ? (scrollGapBottomEl.offsetHeight || 0) : 0;
        if (!gap && !bottomGap) return;
        
        // If the user scrolls up into the gap, remove the gap so they never see blank space.
        if (sc.scrollTop < gap) {
            var reduceBy = gap - sc.scrollTop;
            isAdjustingScroll = true;
            setGapHeight(gap - reduceBy);
            sc.scrollTop = 0;
            isAdjustingScroll = false;
        }

        // If the user scrolls down into the bottom gap, remove it so they never see blank space.
        if (bottomGap) {
            var maxScrollTop = Math.max(0, sc.scrollHeight - sc.clientHeight);
            var distanceToBottom = maxScrollTop - sc.scrollTop;
            if (distanceToBottom < bottomGap) {
                var reduceBottomBy = bottomGap - distanceToBottom;
                isAdjustingScroll = true;
                setBottomGapHeight(bottomGap - reduceBottomBy);
                sc.scrollTop = Math.max(0, sc.scrollTop - reduceBottomBy);
                isAdjustingScroll = false;
            }
        }
    }
    
    function runWithScrollAnchor(anchorEl, fn) {
        var sc = findScrollContainer();
        if (!sc || !anchorEl || typeof fn !== 'function') {
            if (typeof fn === 'function') fn();
            return;
        }

        // Anchoring only works when the anchor element is inside the scroll container.
        // If someone clicks a control outside the scroll area (e.g., panel header buttons),
        // skip anchoring rather than mis-adjusting scroll.
        if (!sc.contains(anchorEl)) {
            fn();
            return;
        }

        // Prevent our scroll-gap cleanup handler from immediately consuming the slack we add
        // while anchoring (scroll events can fire async after scrollTop changes).
        suppressGapConsumeUntil = Date.now() + 250;
        
        ensureScrollGap();
        ensureScrollGapBottom();
        
        var scRect = sc.getBoundingClientRect();
        var anchorRect = anchorEl.getBoundingClientRect();
        var oldTop = anchorRect.top - scRect.top;
        var oldScrollTop = sc.scrollTop;
        
        fn();
        
        requestAnimationFrame(function() {
            if (!anchorEl.isConnected) return;
            var scNow = findScrollContainer();
            if (!scNow) return;

            // If content collapse shrank scrollHeight, the browser may clamp scrollTop down.
            // Add bottom slack so the original scrollTop stays valid, then restore it.
            var maxAfter = Math.max(0, scNow.scrollHeight - scNow.clientHeight);
            if (oldScrollTop > maxAfter) {
                var clampSlack = oldScrollTop - maxAfter;
                setBottomGapHeight(getBottomGapHeight() + clampSlack);
                // Force layout so new maxScrollTop applies before we restore
                void scNow.scrollHeight;
            }
            
            isAdjustingScroll = true;
            scNow.scrollTop = oldScrollTop;
            isAdjustingScroll = false;
            
            var scNowRect = scNow.getBoundingClientRect();
            var newTop = anchorEl.getBoundingClientRect().top - scNowRect.top;
            var delta = newTop - oldTop;
            if (!delta) return;
            
            var currentScrollTop = scNow.scrollTop;
            
            // If we'd need to scroll above 0 to keep the anchor stationary, create gap slack instead.
            if (currentScrollTop + delta < 0) {
                var topSlack = -(currentScrollTop + delta);
                setGapHeight(getGapHeight() + topSlack);
                delta = delta + topSlack;
            }

            // If we'd need to scroll past maxScrollTop, create bottom slack instead.
            var maxNow = Math.max(0, scNow.scrollHeight - scNow.clientHeight);
            if (currentScrollTop + delta > maxNow) {
                var bottomSlack = (currentScrollTop + delta) - maxNow;
                setBottomGapHeight(getBottomGapHeight() + bottomSlack);
                void scNow.scrollHeight;
            }
            
            isAdjustingScroll = true;
            scNow.scrollTop = currentScrollTop + delta;
            isAdjustingScroll = false;
        });
    }
    
    // Use central icon registry from AdminModule
    function getIcon(name) {
        if (window.AdminModule && AdminModule.icons && AdminModule.icons[name]) {
            return AdminModule.icons[name];
        }
        throw new Error('[Formbuilder] AdminModule.icons not available for: ' + name);
    }
    
    /* --------------------------------------------------------------------------
       CHANGE NOTIFICATION
       -------------------------------------------------------------------------- */
    
    function notifyChange() {
        if (!isLoaded) return; // Don't notify during initial load
        
        // Tell admin to recheck the field registry
        // Admin's composite registration will call captureFormbuilderState() to compare
        if (window.AdminModule && typeof AdminModule.notifyFieldChange === 'function') {
            AdminModule.notifyFieldChange();
        }
        if (window.App && typeof App.emit === 'function') {
            App.emit('formbuilder:changed');
        }
    }
    
    /* --------------------------------------------------------------------------
       CAPTURE STATE FROM UI
       -------------------------------------------------------------------------- */
    
    function captureFormbuilderState() {
        if (!container) return null;
        
        var categories = [];
        var categoryIconPaths = {};
        var subcategoryIconPaths = {};
        
        // Iterate through all category accordions
        var categoryAccordions = container.querySelectorAll('.formbuilder-accordion');
        categoryAccordions.forEach(function(accordion, catIndex) {
            var headerText = accordion.querySelector('.formbuilder-accordion-header-text');
            var headerImg = accordion.querySelector('.formbuilder-accordion-header-image');
            var nameInput = accordion.querySelector('.formbuilder-accordion-editpanel-input');
            var hideSwitch = accordion.querySelector('.formbuilder-accordion-editpanel-more-switch');
            
            var catName = nameInput ? nameInput.value.trim() : (headerText ? headerText.textContent.trim() : '');
            var catKey = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            var catId = accordion.dataset.categoryId ? parseInt(accordion.dataset.categoryId, 10) : null;
            var catHidden = hideSwitch ? hideSwitch.classList.contains('on') : false;
            // Use src attribute (not resolved .src) to avoid capturing current page URL when src is empty/removed.
            var catIconAttr = headerImg ? headerImg.getAttribute('src') : '';
            var catIconPath = catIconAttr ? catIconAttr.replace(window.location.origin + '/', '').replace(/^\//, '') : '';
            
            // Store icon path
            if (catIconPath) {
                if (catId) {
                    categoryIconPaths['id:' + catId] = catIconPath;
                }
                categoryIconPaths['name:' + catName.toLowerCase()] = catIconPath;
            }
            
            var category = {
                id: catId,
                name: catName,
                key: catKey,
                hidden: catHidden,
                subs: [],
                subIds: {},
                subHidden: {},
                subFees: {},
                subFields: {}
            };
            
            // Iterate through subcategories
            var subcategoryOptions = accordion.querySelectorAll('.formbuilder-accordion-option');
            subcategoryOptions.forEach(function(option, subIndex) {
                var subHeaderText = option.querySelector('.formbuilder-accordion-option-text');
                var subHeaderImg = option.querySelector('.formbuilder-accordion-option-image');
                var subNameInput = option.querySelector('.formbuilder-accordion-editpanel-input');
                var subHideSwitch = option.querySelector('.formbuilder-accordion-editpanel-more-switch');
                var surchargeInput = option.querySelector('.formbuilder-fee-input');
                var eventsRadio = option.querySelector('input[type="radio"][value="Events"]');
                
                var subName = subNameInput ? subNameInput.value.trim() : (subHeaderText ? subHeaderText.textContent.trim() : '');
                var subKey = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                var subId = option.dataset.subcategoryId ? parseInt(option.dataset.subcategoryId, 10) : null;
                var subHidden = subHideSwitch ? subHideSwitch.classList.contains('on') : false;
                var subIconAttr = subHeaderImg ? subHeaderImg.getAttribute('src') : '';
                var subIconPath = subIconAttr ? subIconAttr.replace(window.location.origin + '/', '').replace(/^\//, '') : '';
                
                // Store subcategory icon path
                if (subIconPath) {
                    if (subId) {
                        subcategoryIconPaths['id:' + subId] = subIconPath;
                    }
                    subcategoryIconPaths['name:' + subName.toLowerCase()] = subIconPath;
                }
                
                category.subs.push(subName);
                if (subId) {
                    category.subIds[subName] = subId;
                }
                category.subHidden[subName] = subHidden;
                
                // Fee data
                var surchargeValue = surchargeInput && surchargeInput.value ? parseFloat(surchargeInput.value) : null;
                var subcategoryType = eventsRadio && eventsRadio.checked ? 'Events' : 'General';
                
                // Location type - read from radio buttons (name pattern: locationType-{catName}-{subName})
                var locationTypeRadio = option.querySelector('input[type="radio"][name^="locationType-"]:checked');
                var locationType = null;
                if (locationTypeRadio && locationTypeRadio.value) {
                    locationType = locationTypeRadio.value;
                }
                
                category.subFees[subName] = {
                    checkout_surcharge: surchargeValue,
                    subcategory_type: subcategoryType,
                    location_type: locationType
                };
                
                // Fields
                var fields = [];
                var fieldsContainer = option.querySelector('.formbuilder-fields-container');
                if (fieldsContainer) {
                    var fieldWrappers = fieldsContainer.querySelectorAll('.formbuilder-field-wrapper');
                    fieldWrappers.forEach(function(wrapper, fieldIndex) {
                        var fieldsetId = wrapper.dataset.fieldsetId;
                        var fieldNameSpan = wrapper.querySelector('.formbuilder-field-name');
                        var requiredCheckbox = wrapper.querySelector('.formbuilder-field-required-checkbox');
                        var locationRepeatSwitch = wrapper.querySelector('.formbuilder-field-switch');
                        
                        var fieldName = fieldNameSpan ? fieldNameSpan.textContent.trim() : '';
                        var isRequired = requiredCheckbox ? requiredCheckbox.checked : false;
                        var isLocationRepeat = wrapper.classList.contains('formbuilder-field-wrapper--location-repeat');
                        var isMustRepeat = wrapper.classList.contains('formbuilder-field-wrapper--must-repeat');
                        var isAutofillRepeat = wrapper.classList.contains('formbuilder-field-wrapper--autofill-repeat');
                        
                        // Find matching fieldset from loaded reference data
                        var fieldsetDef = null;
                        if (loadedFieldsets && loadedFieldsets.length > 0) {
                            fieldsetDef = loadedFieldsets.find(function(fs) {
                                return fs.id == fieldsetId || fs.key === fieldsetId;
                            });
                        }

                        // Enforce repeat invariants for location fieldsets on save:
                        // Venue/City/Address must always be location-repeat + must-repeat, never autofill.
                        var repeatKeyLower = String((fieldsetDef ? fieldsetDef.key : fieldsetId) || '').toLowerCase();
                        if (repeatKeyLower === 'venue' || repeatKeyLower === 'city' || repeatKeyLower === 'address') {
                            isLocationRepeat = true;
                            isMustRepeat = true;
                            isAutofillRepeat = false;
                        }
                        
                        var field = {
                            fieldsetKey: fieldsetDef ? fieldsetDef.key : fieldsetId,
                            name: fieldName,
                            required: isRequired,
                            location_repeat: isLocationRepeat,
                            must_repeat: isMustRepeat,
                            autofill_repeat: isAutofillRepeat,
                            input_type: fieldsetDef ? fieldsetDef.key : fieldsetId
                        };
                        
                        // Check for editable field customizations
                        var customNameInput = wrapper.querySelector('.formbuilder-field-input[placeholder="Field name"]');
                        var customPlaceholderInput = wrapper.querySelector('.formbuilder-field-input[placeholder="Placeholder text"]');
                        var customTooltipInput = wrapper.querySelector('.formbuilder-field-input[placeholder="Tooltip text"]');
                        
                        if (customNameInput && customNameInput.value.trim()) {
                            field.name = customNameInput.value.trim();
                        }
                        if (customPlaceholderInput && customPlaceholderInput.value.trim()) {
                            field.customPlaceholder = customPlaceholderInput.value.trim();
                        }
                        if (customTooltipInput && customTooltipInput.value.trim()) {
                            field.customTooltip = customTooltipInput.value.trim();
                        }
                        
                        // Collect options for dropdown/radio fields
                        var optionsContainer = wrapper.querySelector('.formbuilder-field-options');
                        if (optionsContainer) {
                            var optionInputs = optionsContainer.querySelectorAll('.formbuilder-field-option-input');
                            var options = [];
                            optionInputs.forEach(function(input) {
                                if (input.value.trim()) {
                                    options.push(input.value.trim());
                                }
                            });
                            if (options.length > 0) {
                                field.options = options;
                            }
                        }
                        
                        // Collect selected amenities for amenities fieldset
                        var selectedAmenitiesData = wrapper.dataset.selectedAmenities;
                        if (selectedAmenitiesData) {
                            try {
                                var selectedAmenities = JSON.parse(selectedAmenitiesData);
                                if (Array.isArray(selectedAmenities) && selectedAmenities.length > 0) {
                                    field.selectedAmenities = selectedAmenities;
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                        
                        fields.push(field);
                    });
                }
                
                category.subFields[subName] = fields;
            });
            
            categories.push(category);
        });
        
        return {
            categories: categories,
            categoryIconPaths: categoryIconPaths,
            subcategoryIconPaths: subcategoryIconPaths,
            fieldsets: loadedFieldsets,
            checkoutOptions: checkoutOptions,
            currencies: loadedCurrencies
        };
    }
    
    /* --------------------------------------------------------------------------
       SAVE TO DATABASE
       -------------------------------------------------------------------------- */
    
    function saveFormbuilder() {
        var payload = captureFormbuilderState();
        if (!payload) {
            console.error('[Formbuilder] Failed to capture state');
            return Promise.reject(new Error('Failed to capture formbuilder state'));
        }
        
        // Saving...
        
        return fetch('/gateway.php?action=save-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(result) {
            if (!result.success) {
                throw new Error(result.message);
            }
            // Saved successfully
            
            // Update IDs for newly created items
            if (result.new_category_ids && result.new_category_ids.length > 0) {
                updateCategoryIds(result.new_category_ids);
            }
            if (result.new_subcategory_ids && result.new_subcategory_ids.length > 0) {
                updateSubcategoryIds(result.new_subcategory_ids);
            }
            
            // Update field registry baseline so future comparisons are against saved state
            if (window.AdminModule && typeof AdminModule.updateCompositeBaseline === 'function') {
                AdminModule.updateCompositeBaseline('formbuilder');
            }
            
            return result;
        });
    }
    
    function updateCategoryIds(newIds) {
        if (!container) return;
        var accordions = container.querySelectorAll('.formbuilder-accordion:not([data-category-id])');
        var idIndex = 0;
        accordions.forEach(function(accordion) {
            if (idIndex < newIds.length) {
                accordion.dataset.categoryId = newIds[idIndex];
                idIndex++;
            }
        });
    }
    
    function updateSubcategoryIds(newIds) {
        if (!container) return;
        var options = container.querySelectorAll('.formbuilder-accordion-option:not([data-subcategory-id])');
        var idIndex = 0;
        options.forEach(function(option) {
            if (idIndex < newIds.length) {
                option.dataset.subcategoryId = newIds[idIndex];
                idIndex++;
            }
        });
    }
    
    /* --------------------------------------------------------------------------
       ADD CATEGORY
       -------------------------------------------------------------------------- */
    
    function addCategory() {
        if (!container) return;
        
        var newCatName = 'New Category';
        var catIndex = container.querySelectorAll('.formbuilder-accordion').length;
        
        // Create a minimal category object
        var newCat = {
            name: newCatName,
            subs: []
        };
        
        // Build the accordion using the same function as renderForm
        var accordion = buildCategoryAccordion(newCat, {}, {}, []);
        
        // Insert before the Add Category button
        var addCatBtn = container.querySelector('.formbuilder-add-category');
        if (addCatBtn) {
            container.insertBefore(accordion, addCatBtn);
        } else {
            container.appendChild(accordion);
        }
        
        // Open it for editing
        accordion.classList.add('formbuilder-accordion--open');
        accordion.classList.add('formbuilder-accordion--editing');
        syncCategoryAccordionUi(accordion);
        
        // Focus the name input
        var nameInput = accordion.querySelector('.formbuilder-accordion-editpanel-input');
        if (nameInput) {
            nameInput.select();
            nameInput.focus();
        }
        
        notifyChange();
    }
    
    /* --------------------------------------------------------------------------
       ADD SUBCATEGORY
       -------------------------------------------------------------------------- */
    
    function addSubcategory(categoryAccordion) {
        if (!categoryAccordion) return;
        
        var body = categoryAccordion.querySelector('.formbuilder-accordion-body');
        if (!body) return;
        
        // Get category info
        var catNameInput = categoryAccordion.querySelector('.formbuilder-accordion-editpanel-input');
        var catName = catNameInput ? catNameInput.value.trim() : 'Category';
        
        // Get existing subcategory names from UI to ensure uniqueness
        var existingSubs = [];
        var existingOptions = body.querySelectorAll('.formbuilder-accordion-option');
        existingOptions.forEach(function(opt) {
            var optNameInput = opt.querySelector('.formbuilder-accordion-editpanel-input');
            if (optNameInput && optNameInput.value.trim()) {
                existingSubs.push(optNameInput.value.trim());
            }
        });
        
        // Generate unique subcategory name
        var baseName = 'New Subcategory';
        var existingSet = new Set(existingSubs);
        var newSubName = baseName;
        var counter = 2;
        while (existingSet.has(newSubName)) {
            newSubName = baseName + ' ' + counter;
            counter++;
        }
        
        // Get category data structure (needed for buildSubcategoryOption)
        var cat = {
            name: catName,
            subs: existingSubs,
            subFees: {}
        };
        
        // Build the subcategory option
        var option = buildSubcategoryOption(cat, newSubName, loadedSubcategoryIconPaths, loadedFieldsets, body);
        
        // Insert before the Add Subcategory button
        var addSubBtn = body.querySelector('.formbuilder-add-subcategory');
        if (addSubBtn) {
            body.insertBefore(option, addSubBtn);
        } else {
            body.appendChild(option);
        }
        
        // Open it for editing
        option.classList.add('formbuilder-accordion-option--open');
        option.classList.add('formbuilder-accordion-option--editing');
        syncSubcategoryOptionUi(option);
        
        // Focus the name input
        var nameInput = option.querySelector('.formbuilder-accordion-editpanel-input');
        if (nameInput) {
            nameInput.select();
            nameInput.focus();
        }
        
        notifyChange();
    }
    
    /* --------------------------------------------------------------------------
       DELETE CATEGORY
       -------------------------------------------------------------------------- */
    
    function deleteCategory(categoryAccordion) {
        if (!categoryAccordion) return;
        
        var catName = categoryAccordion.querySelector('.formbuilder-accordion-header-text');
        var name = catName ? catName.textContent.trim() : 'this category';

        if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
            ConfirmDialogComponent.show({
                titleText: 'Delete Category',
                messageText: 'Delete "' + name + '" and all its subcategories?',
                confirmLabel: 'Delete',
                confirmClass: 'danger',
                focusCancel: true
            }).then(function(confirmed) {
                if (confirmed) {
                    categoryAccordion.remove();
                    notifyChange();
                }
            });
            return;
        }
        
        if (confirm('Delete "' + name + '" and all its subcategories?')) {
            categoryAccordion.remove();
            notifyChange();
        }
    }
    
    /* --------------------------------------------------------------------------
       DELETE SUBCATEGORY
       -------------------------------------------------------------------------- */
    
    function deleteSubcategory(subcategoryOption) {
        if (!subcategoryOption) return;
        
        var subName = subcategoryOption.querySelector('.formbuilder-accordion-option-text');
        var name = subName ? subName.textContent.trim() : 'this subcategory';

        if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
            ConfirmDialogComponent.show({
                titleText: 'Delete Subcategory',
                messageText: 'Delete "' + name + '"?',
                confirmLabel: 'Delete',
                confirmClass: 'danger',
                focusCancel: true
            }).then(function(confirmed) {
                if (confirmed) {
                    subcategoryOption.remove();
                    notifyChange();
                }
            });
            return;
        }
        
        if (confirm('Delete "' + name + '"?')) {
            subcategoryOption.remove();
            notifyChange();
        }
    }
    
    function syncCategoryAccordionUi(accordion) {
        if (!accordion) return;
        var isOpen = accordion.classList.contains('formbuilder-accordion--open');
        var isEditing = accordion.classList.contains('formbuilder-accordion--editing');
        
        var header = accordion.querySelector('.formbuilder-accordion-header');
        var arrow = accordion.querySelector('.formbuilder-accordion-header-arrow');
        var editArea = accordion.querySelector('.formbuilder-accordion-header-editarea');
        var editPanel = accordion.querySelector('.formbuilder-accordion-editpanel');
        var body = accordion.querySelector('.formbuilder-accordion-body');
        
        if (header) {
            header.classList.toggle('formbuilder-accordion-header--open', !!isOpen);
            header.classList.toggle('formbuilder-accordion-header--editing', !!isEditing);
        }
        if (arrow) arrow.classList.toggle('formbuilder-accordion-header-arrow--open', !!isOpen);
        if (editArea) editArea.classList.toggle('formbuilder-accordion-header-editarea--editing', !!isEditing);
        if (editPanel) editPanel.classList.toggle('formbuilder-accordion-editpanel--editing', !!isEditing);
        if (body) body.classList.toggle('formbuilder-accordion-body--open', !!isOpen);
    }
    
    function syncSubcategoryOptionUi(option) {
        if (!option) return;
        var isOpen = option.classList.contains('formbuilder-accordion-option--open');
        var isEditing = option.classList.contains('formbuilder-accordion-option--editing');
        
        var header = option.querySelector('.formbuilder-accordion-option-header');
        var arrow = option.querySelector('.formbuilder-accordion-option-arrow');
        var editArea = option.querySelector('.formbuilder-accordion-option-editarea');
        var editPanel = option.querySelector('.formbuilder-accordion-option-editpanel');
        var body = option.querySelector('.formbuilder-accordion-option-body');
        
        if (header) {
            header.classList.toggle('formbuilder-accordion-option-header--open', !!isOpen);
            header.classList.toggle('formbuilder-accordion-option-header--editing', !!isEditing);
        }
        if (arrow) arrow.classList.toggle('formbuilder-accordion-option-arrow--open', !!isOpen);
        if (editArea) editArea.classList.toggle('formbuilder-accordion-option-editarea--editing', !!isEditing);
        if (editPanel) {
            editPanel.classList.toggle('formbuilder-accordion-option-editpanel--editing', !!isEditing);
            editPanel.classList.toggle('formbuilder-accordion-option-editpanel--editing-open', !!(isEditing && isOpen));
        }
        if (body) {
            body.classList.toggle('formbuilder-accordion-option-body--open', !!isOpen);
            body.classList.toggle('formbuilder-accordion-option-body--editing-open', !!(isEditing && isOpen));
        }
    }
    
    function syncFieldWrapperUi(fieldWrapper) {
        if (!fieldWrapper) return;
        var isEditing = fieldWrapper.classList.contains('formbuilder-field-wrapper--editing');
        var isRequired = fieldWrapper.classList.contains('formbuilder-field-wrapper--required');
        var isModified = fieldWrapper.classList.contains('formbuilder-field-wrapper--modified');
        var isLocationRepeat = fieldWrapper.classList.contains('formbuilder-field-wrapper--location-repeat');
        var isMustRepeat = fieldWrapper.classList.contains('formbuilder-field-wrapper--must-repeat');
        var isAutofillRepeat = fieldWrapper.classList.contains('formbuilder-field-wrapper--autofill-repeat');
        
        var fieldEl = fieldWrapper.querySelector('.formbuilder-field');
        var editBtn = fieldWrapper.querySelector('.formbuilder-field-edit');
        var editPanel = fieldWrapper.querySelector('.formbuilder-field-editpanel');
        var requiredEl = fieldWrapper.querySelector('.formbuilder-field-required');
        var modifiedLabel = fieldWrapper.querySelector('.formbuilder-field-modified-label');
        var indRepeat = fieldWrapper.querySelector('.formbuilder-field-indicator-repeat');
        var indMust = fieldWrapper.querySelector('.formbuilder-field-indicator-must');
        var indAutofill = fieldWrapper.querySelector('.formbuilder-field-indicator-autofill');
        
        if (fieldEl) fieldEl.classList.toggle('formbuilder-field--editing', !!isEditing);
        if (editBtn) editBtn.classList.toggle('formbuilder-field-edit--editing', !!isEditing);
        if (editPanel) editPanel.classList.toggle('formbuilder-field-editpanel--editing', !!isEditing);
        if (requiredEl) requiredEl.classList.toggle('formbuilder-field-required--required', !!isRequired);
        if (modifiedLabel) modifiedLabel.classList.toggle('formbuilder-field-modified-label--modified', !!isModified);
        if (indRepeat) indRepeat.classList.toggle('formbuilder-field-indicator-repeat--location-repeat', !!isLocationRepeat);
        if (indMust) indMust.classList.toggle('formbuilder-field-indicator-must--must-repeat', !!isMustRepeat);
        if (indAutofill) indAutofill.classList.toggle('formbuilder-field-indicator-autofill--autofill-repeat', !!isAutofillRepeat);
    }
    
    function closeAllEditPanels() {
        if (!container) return;

        function setFormbuilderMenuOpen(menuEl, isOpen) {
            if (!menuEl) return;
            menuEl.classList.toggle('formbuilder-menu--open', !!isOpen);
            var btnEl = menuEl.querySelector('.formbuilder-menu-button');
            var arrowEl = menuEl.querySelector('.formbuilder-menu-button-arrow');
            var optsEl = menuEl.querySelector('.formbuilder-menu-options');
            if (btnEl) btnEl.classList.toggle('formbuilder-menu-button--open', !!isOpen);
            if (arrowEl) arrowEl.classList.toggle('formbuilder-menu-button-arrow--open', !!isOpen);
            if (optsEl) optsEl.classList.toggle('formbuilder-menu-options--open', !!isOpen);
        }

        function setFormbuilderFieldsetMenuOpen(menuEl, isOpen) {
            if (!menuEl) return;
            menuEl.classList.toggle('formbuilder-fieldset-menu--open', !!isOpen);
            var btnEl = menuEl.querySelector('.formbuilder-fieldset-menu-button');
            var optsEl = menuEl.querySelector('.formbuilder-fieldset-menu-options');
            if (btnEl) btnEl.classList.toggle('formbuilder-fieldset-menu-button--open', !!isOpen);
            if (optsEl) optsEl.classList.toggle('formbuilder-fieldset-menu-options--open', !!isOpen);
        }

        function setFormbuilderAccordionMoreOpen(moreEl, isOpen) {
            if (!moreEl) return;
            var menuEl = moreEl.querySelector('.formbuilder-accordion-editpanel-more-menu');
            if (menuEl) menuEl.classList.toggle('formbuilder-accordion-editpanel-more-menu--open', !!isOpen);
        }

        function setFormbuilderFieldMoreOpen(moreEl, isOpen) {
            if (!moreEl) return;
            var menuEl = moreEl.querySelector('.formbuilder-field-more-menu');
            if (menuEl) menuEl.classList.toggle('formbuilder-field-more-menu--open', !!isOpen);
        }

        container.querySelectorAll('.formbuilder-accordion--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion--editing');
            syncCategoryAccordionUi(el);
        });
        container.querySelectorAll('.formbuilder-accordion-option--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion-option--editing');
            syncSubcategoryOptionUi(el);
        });
        container.querySelectorAll('.formbuilder-menu').forEach(function(el) { setFormbuilderMenuOpen(el, false); });
        container.querySelectorAll('.formbuilder-fieldset-menu').forEach(function(el) { setFormbuilderFieldsetMenuOpen(el, false); });
        container.querySelectorAll('.formbuilder-accordion-editpanel-more').forEach(function(el) { setFormbuilderAccordionMoreOpen(el, false); });
        container.querySelectorAll('.formbuilder-field-more').forEach(function(el) { setFormbuilderFieldMoreOpen(el, false); });
    }

    // Close ONLY subcategory edit panels (do not collapse category edit panels).
    // This prevents subcategory clicks from yanking the list upward when the category edit panel is open.
    function closeAllSubcategoryEditPanels() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-accordion-option--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion-option--editing');
            syncSubcategoryOptionUi(el);
        });
        container.querySelectorAll('.formbuilder-menu').forEach(function(el) {
            el.classList.remove('formbuilder-menu--open');
            el.querySelectorAll('.formbuilder-menu-button--open').forEach(function(x){ x.classList.remove('formbuilder-menu-button--open'); });
            el.querySelectorAll('.formbuilder-menu-button-arrow--open').forEach(function(x){ x.classList.remove('formbuilder-menu-button-arrow--open'); });
            el.querySelectorAll('.formbuilder-menu-options--open').forEach(function(x){ x.classList.remove('formbuilder-menu-options--open'); });
        });
        container.querySelectorAll('.formbuilder-fieldset-menu').forEach(function(el) {
            el.classList.remove('formbuilder-fieldset-menu--open');
            el.querySelectorAll('.formbuilder-fieldset-menu-button--open').forEach(function(x){ x.classList.remove('formbuilder-fieldset-menu-button--open'); });
            el.querySelectorAll('.formbuilder-fieldset-menu-options--open').forEach(function(x){ x.classList.remove('formbuilder-fieldset-menu-options--open'); });
        });
        container.querySelectorAll('.formbuilder-field-more-menu--open').forEach(function(el) {
            el.classList.remove('formbuilder-field-more-menu--open');
        });
    }
    
    function closeAllFieldEditPanels() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
            el.classList.remove('formbuilder-field-wrapper--editing');
            syncFieldWrapperUi(el);
        });
    }
    
    function closeAllMenus() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-menu').forEach(function(el) {
            el.classList.remove('formbuilder-menu--open');
            el.querySelectorAll('.formbuilder-menu-button--open').forEach(function(x){ x.classList.remove('formbuilder-menu-button--open'); });
            el.querySelectorAll('.formbuilder-menu-button-arrow--open').forEach(function(x){ x.classList.remove('formbuilder-menu-button-arrow--open'); });
            el.querySelectorAll('.formbuilder-menu-options--open').forEach(function(x){ x.classList.remove('formbuilder-menu-options--open'); });
        });
        container.querySelectorAll('.formbuilder-accordion-editpanel-more-menu--open').forEach(function(el) {
            el.classList.remove('formbuilder-accordion-editpanel-more-menu--open');
        });
        container.querySelectorAll('.formbuilder-fieldset-menu').forEach(function(el) {
            el.classList.remove('formbuilder-fieldset-menu--open');
            el.querySelectorAll('.formbuilder-fieldset-menu-button--open').forEach(function(x){ x.classList.remove('formbuilder-fieldset-menu-button--open'); });
            el.querySelectorAll('.formbuilder-fieldset-menu-options--open').forEach(function(x){ x.classList.remove('formbuilder-fieldset-menu-options--open'); });
        });
        container.querySelectorAll('.formbuilder-field-more-menu--open').forEach(function(el) {
            el.classList.remove('formbuilder-field-more-menu--open');
        });
    }
    
    function buildIconPicker(currentSrc, onSelect) {
        // Use standard IconPickerComponent (has sync functionality built in)
        var picker = IconPickerComponent.buildPicker({
            currentIcon: currentSrc,
            onSelect: onSelect
        });
        return picker.element;
    }
    
    function bindDocumentListeners() {
        // Helper function to check if click is on save/discard button or calculator
        function isSaveOrDiscardButton(target) {
            return target.closest('.admin-panel-actions-icon-btn--save') ||
                   target.closest('.admin-panel-actions-icon-btn--discard') ||
                   target.closest('.admin-panel-actions');
        }
        
        // Helper function to check if click is on calculator button or popup
        function isCalculatorButtonOrPopup(target) {
            return target.closest('.formbuilder-calculator-btn') ||
                   target.closest('.formbuilder-formpreview-modal');
        }
        
        // Close category/subcategory edit panels when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-accordion-editpanel') && 
                !e.target.closest('.formbuilder-accordion-option-editpanel') &&
                !e.target.closest('.formbuilder-accordion-header-editarea') &&
                !e.target.closest('.formbuilder-accordion-option-editarea') &&
                !e.target.closest('.formbuilder-accordion-header') &&
                !e.target.closest('.formbuilder-accordion-option-header')) {
                closeAllEditPanels();
            }
        });
        
        // Close 3-dot menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-accordion-editpanel-more')) {
                container.querySelectorAll('.formbuilder-accordion-editpanel-more-menu--open').forEach(function(el) {
                    el.classList.remove('formbuilder-accordion-editpanel-more-menu--open');
                });
            }
        });
        
        // Close fieldset menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            // Check if click is inside any fieldset menu (button or options)
            var clickedInsideMenu = e.target.closest('.formbuilder-fieldset-menu');
            if (!clickedInsideMenu) {
                // Click was outside - close all open fieldset menus
                container.querySelectorAll('.formbuilder-fieldset-menu-options--open').forEach(function(el) {
                    el.classList.remove('formbuilder-fieldset-menu-options--open');
                });
                container.querySelectorAll('.formbuilder-fieldset-menu-button--open').forEach(function(el) {
                    el.classList.remove('formbuilder-fieldset-menu-button--open');
                });
                container.querySelectorAll('.formbuilder-fieldset-menu--open').forEach(function(el) {
                    el.classList.remove('formbuilder-fieldset-menu--open');
                });
            }
        });
        
        // Close icon picker menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-menu')) {
                container.querySelectorAll('.formbuilder-menu-options--open').forEach(function(el) {
                    el.classList.remove('formbuilder-menu-options--open');
                });
                container.querySelectorAll('.formbuilder-menu-button-arrow--open').forEach(function(el) {
                    el.classList.remove('formbuilder-menu-button-arrow--open');
                });
                container.querySelectorAll('.formbuilder-menu-button--open').forEach(function(el) {
                    el.classList.remove('formbuilder-menu-button--open');
                });
                container.querySelectorAll('.formbuilder-menu--open').forEach(function(el) {
                    el.classList.remove('formbuilder-menu--open');
                });
            }
        });
        
        // Close field 3-dot menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-field-more')) {
                container.querySelectorAll('.formbuilder-field-more-menu--open').forEach(function(el) {
                    el.classList.remove('formbuilder-field-more-menu--open');
                });
            }
        });
        
        // Close field edit panels when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-field-wrapper')) {
                // Keep the clicked thing stationary while the field edit panel above collapses.
                // This matches the category/subcategory anchoring behavior.
                var anchor = e.target.closest(
                    '.formbuilder-fieldset-menu-button,' +
                    '.formbuilder-menu-button,' +
                    '.formbuilder-add-category,' +
                    '.formbuilder-add-subcategory,' +
                    '.formbuilder-add-fieldset,' +
                    '.formbuilder-form-preview,' +
                    '.formbuilder-calculator-btn,' +
                    '.formbuilder-accordion-option-header,' +
                    '.formbuilder-accordion-header,' +
                    'button'
                ) || e.target;
                
                runWithScrollAnchor(anchor, function() {
                closeAllFieldEditPanels();
                });
            }
        });
    }
    
    function loadFormData() {
        // Fetch admin settings first to get checkout options and currency
        fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (!res.success) {
                    throw new Error('Failed to load admin settings');
                }
                // Preload picklists for FieldsetBuilder (amenities, currencies, phone prefixes)
                // so building fieldsets later does not force its own extra fetch.
                try {
                    if (res.dropdown_options && window.FieldsetBuilder && typeof FieldsetBuilder.setPicklist === 'function') {
                        FieldsetBuilder.setPicklist(res.dropdown_options);
                    }
                } catch (e) {
                    // ignore
                }
                checkoutOptions = res.checkout_options;
                siteCurrency = res.settings && res.settings.website_currency;
                // Get icon folder from database setting
                var iconFolder = res.settings && res.settings.folder_category_icons;
                if (!iconFolder) {
                    throw new Error('folder_category_icons not found in admin settings');
                }
                if (!checkoutOptions) {
                    checkoutOptions = {};
                }
                checkoutOptions.icon_folder = iconFolder;
                // IconPickerComponent handles icon loading and syncing internally
                // No need to fetch icon list here - IconPickerComponent does it when menu opens
                return fetch('/gateway.php?action=get-form');
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (!res.success || !res.formData) return;
                renderForm(res.formData);
            });
    }
    
    function renderForm(formData) {
        if (!container) return;
        container.innerHTML = '';
        
        // Store reference data (not for change tracking - just data needed to build UI)
        // Only subcategory fieldsets should be selectable in Form Builder.
        // Auth fieldsets (username/password/etc) are still returned by get-form for other UI,
        // but must not appear as subcategory options here.
        loadedFieldsets = Array.isArray(formData.fieldsets) ? formData.fieldsets.filter(function(fs) {
            if (!fs) return false;
            var t = (fs.fieldset_type || fs.fieldsetType || '').toString().trim().toLowerCase();
            if (!t) return true; // backward compat (before fieldset_type existed)
            return t === 'subcategory';
        }) : [];
        loadedCurrencies = formData.currencies;
        loadedCategoryIconPaths = formData.categoryIconPaths;
        loadedSubcategoryIconPaths = formData.subcategoryIconPaths;
        
        var categories = formData.categories;
        var categoryIconPaths = loadedCategoryIconPaths;
        var subcategoryIconPaths = loadedSubcategoryIconPaths;
        var fieldsets = loadedFieldsets;
        
        categories.forEach(function(cat) {
            var accordion = buildCategoryAccordion(cat, categoryIconPaths, subcategoryIconPaths, fieldsets);
            container.appendChild(accordion);
        });
        
        // Add Category button
        var addCatBtn = document.createElement('div');
        addCatBtn.className = 'formbuilder-add-category';
        addCatBtn.textContent = '+ Add Category';
        addCatBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            addCategory();
        });
        container.appendChild(addCatBtn);
        
        // Mark as loaded after rendering
        isLoaded = true;
        
        // Register formbuilder as a composite field with admin's field registry
        // This captures current state and sets it as the baseline for comparison
        if (window.AdminModule && typeof AdminModule.registerComposite === 'function') {
            AdminModule.registerComposite('formbuilder', captureFormbuilderState);
        }
    }
    
    function buildCategoryAccordion(cat, categoryIconPaths, subcategoryIconPaths, fieldsets) {
        var accordion = document.createElement('div');
        accordion.className = 'formbuilder-accordion formbuilder-accordion--open';
        
        // Store category ID if exists
        if (cat.id) {
            accordion.dataset.categoryId = cat.id;
        }
        
        var catIconSrc = '';
        if (cat.id && categoryIconPaths['id:' + cat.id]) {
            catIconSrc = categoryIconPaths['id:' + cat.id];
        } else if (cat.name && categoryIconPaths['name:' + cat.name.toLowerCase()]) {
            catIconSrc = categoryIconPaths['name:' + cat.name.toLowerCase()];
        } else if (categoryIconPaths[cat.name]) {
            catIconSrc = categoryIconPaths[cat.name];
        }
        
        // Header
        var header = document.createElement('div');
        header.className = 'formbuilder-accordion-header';
        
        var headerImg = document.createElement('img');
        headerImg.className = 'formbuilder-accordion-header-image';
        applySafeIconImage(headerImg, catIconSrc);
        
        var headerText = document.createElement('span');
        headerText.className = 'formbuilder-accordion-header-text';
        headerText.textContent = cat.name;
        
        var headerArrow = document.createElement('span');
        headerArrow.className = 'formbuilder-accordion-header-arrow';
        headerArrow.textContent = '▼';
        
        var headerEditArea = document.createElement('div');
        headerEditArea.className = 'formbuilder-accordion-header-editarea';
        var headerEdit = document.createElement('div');
        headerEdit.className = 'formbuilder-accordion-header-edit';
        headerEdit.innerHTML = getIcon('editPen');
        headerEditArea.appendChild(headerEdit);
        
        var headerDrag = document.createElement('div');
        headerDrag.className = 'formbuilder-accordion-header-drag';
        headerDrag.innerHTML = getIcon('dragHandle');
        
        header.appendChild(headerImg);
        header.appendChild(headerText);
        header.appendChild(headerArrow);
        header.appendChild(headerDrag);
        header.appendChild(headerEditArea);
        
        // Category drag and drop - only via drag handle
        accordion.draggable = false;
        var dragStartIndex = -1;
        headerDrag.addEventListener('mousedown', function() {
            accordion.draggable = true;
        });
        document.addEventListener('mouseup', function() {
            accordion.draggable = false;
        });
        accordion.addEventListener('dragstart', function(e) {
            if (!accordion.draggable) {
                e.preventDefault();
                return;
            }
            // Remember starting position
            var siblings = Array.from(container.querySelectorAll('.formbuilder-accordion'));
            dragStartIndex = siblings.indexOf(accordion);
            e.dataTransfer.effectAllowed = 'move';
            accordion.classList.add('dragging');
        });
        accordion.addEventListener('dragend', function() {
            accordion.classList.remove('dragging');
            accordion.draggable = false;
            // Only notify if position actually changed
            var siblings = Array.from(container.querySelectorAll('.formbuilder-accordion'));
            var currentIndex = siblings.indexOf(accordion);
            if (currentIndex !== dragStartIndex) {
                notifyChange();
            }
            dragStartIndex = -1;
        });
        accordion.addEventListener('dragover', function(e) {
            e.preventDefault();
            var dragging = container.querySelector('.formbuilder-accordion.dragging');
            if (dragging && dragging !== accordion) {
                var rect = accordion.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    accordion.parentNode.insertBefore(dragging, accordion);
                } else {
                    accordion.parentNode.insertBefore(dragging, accordion.nextSibling);
                }
            }
        });
        
        // Edit panel
        var editPanel = document.createElement('div');
        editPanel.className = 'formbuilder-accordion-editpanel';
        
        var nameRow = document.createElement('div');
        nameRow.className = 'formbuilder-accordion-editpanel-row';
        
        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'formbuilder-accordion-editpanel-input';
        nameInput.value = cat.name;
        nameInput.oninput = function() {
            headerText.textContent = nameInput.value;
            notifyChange();
        };
        
        var moreBtn = document.createElement('div');
        moreBtn.className = 'formbuilder-accordion-editpanel-more';
        moreBtn.innerHTML = getIcon('moreDots') + '<div class="formbuilder-accordion-editpanel-more-menu"><div class="formbuilder-accordion-editpanel-more-item"><span class="formbuilder-accordion-editpanel-more-item-text">Hide Category</span><div class="formbuilder-accordion-editpanel-more-switch' + (cat.hidden ? ' on' : '') + '"></div></div><div class="formbuilder-accordion-editpanel-more-item formbuilder-accordion-editpanel-more-delete">Delete Category</div></div>';
        var moreMenuEl = moreBtn.querySelector('.formbuilder-accordion-editpanel-more-menu');
        
        moreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasOpen = moreMenuEl && moreMenuEl.classList.contains('formbuilder-accordion-editpanel-more-menu--open');
            closeAllMenus();
            if (!wasOpen && moreMenuEl) moreMenuEl.classList.add('formbuilder-accordion-editpanel-more-menu--open');
        });
        
        var hideSwitch = moreBtn.querySelector('.formbuilder-accordion-editpanel-more-switch');
        hideSwitch.addEventListener('click', function(e) {
            e.stopPropagation();
            hideSwitch.classList.toggle('on');
            notifyChange();
        });
        
        // Delete category button
        var deleteCatBtn = moreBtn.querySelector('.formbuilder-accordion-editpanel-more-delete');
        deleteCatBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (moreMenuEl) moreMenuEl.classList.remove('formbuilder-accordion-editpanel-more-menu--open');
            deleteCategory(accordion);
        });
        
        nameRow.appendChild(nameInput);
        nameRow.appendChild(moreBtn);
        
        var iconPicker = buildIconPicker(catIconSrc, function(newIcon) {
            applySafeIconImage(headerImg, newIcon);
            notifyChange();
        });
        
        editPanel.appendChild(nameRow);
        editPanel.appendChild(iconPicker);
        
        // Body
        var body = document.createElement('div');
        body.className = 'formbuilder-accordion-body';
        
        var subs = cat.subs;
        if (subs && Array.isArray(subs)) {
            subs.forEach(function(subName) {
                var option = buildSubcategoryOption(cat, subName, subcategoryIconPaths, fieldsets, body);
                body.appendChild(option);
            });
        }
        
        // Add Subcategory button
        var addSubBtn = document.createElement('div');
        addSubBtn.className = 'formbuilder-add-subcategory';
        addSubBtn.textContent = '+ Add Subcategory';
        addSubBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            addSubcategory(accordion);
        });
        body.appendChild(addSubBtn);
        
        accordion.appendChild(header);
        accordion.appendChild(editPanel);
        accordion.appendChild(body);
        
        // Header edit area click
        headerEditArea.addEventListener('click', function(e) {
            e.stopPropagation();
            runWithScrollAnchor(header, function() {
            var isOpen = accordion.classList.contains('formbuilder-accordion--editing');
            closeAllEditPanels();
            if (!isOpen) {
                accordion.classList.add('formbuilder-accordion--editing');
            }
            syncCategoryAccordionUi(accordion);
            });
        });
        
        // Header click (except edit area) expands/collapses
        header.addEventListener('click', function(e) {
            if (e.target.closest('.formbuilder-accordion-header-editarea')) return;
            runWithScrollAnchor(header, function() {
            if (!accordion.classList.contains('formbuilder-accordion--editing')) {
                closeAllEditPanels();
            }
            accordion.classList.toggle('formbuilder-accordion--open');
            syncCategoryAccordionUi(accordion);
            });
        });
        
        syncCategoryAccordionUi(accordion);
        return accordion;
    }
    
    function buildSubcategoryOption(cat, subName, subcategoryIconPaths, fieldsets, parentBody) {
        var option = document.createElement('div');
        option.className = 'formbuilder-accordion-option';
        
        // Get subcategory ID if exists
        var subId = cat.subIds && cat.subIds[subName];
        if (subId) {
            option.dataset.subcategoryId = subId;
        }
        
        // Get subcategory icon
        var subIconSrc = '';
        if (subId && subcategoryIconPaths['id:' + subId]) {
            subIconSrc = subcategoryIconPaths['id:' + subId];
        } else if (subName && subcategoryIconPaths['name:' + subName.toLowerCase()]) {
            subIconSrc = subcategoryIconPaths['name:' + subName.toLowerCase()];
        } else if (subcategoryIconPaths[subName]) {
            subIconSrc = subcategoryIconPaths[subName];
        }
        
        // Check if hidden
        var subHidden = cat.subHidden && cat.subHidden[subName];
        
        var optHeader = document.createElement('div');
        optHeader.className = 'formbuilder-accordion-option-header';
        
        var optImg = document.createElement('img');
        optImg.className = 'formbuilder-accordion-option-image';
        applySafeIconImage(optImg, subIconSrc);
        
        var optText = document.createElement('span');
        optText.className = 'formbuilder-accordion-option-text';
        optText.textContent = subName;
        
        var optArrow = document.createElement('span');
        optArrow.className = 'formbuilder-accordion-option-arrow';
        optArrow.textContent = '▼';
        
        var optEditArea = document.createElement('div');
        optEditArea.className = 'formbuilder-accordion-option-editarea';
        var optEdit = document.createElement('div');
        optEdit.className = 'formbuilder-accordion-option-edit';
        optEdit.innerHTML = getIcon('editPen');
        optEditArea.appendChild(optEdit);
        
        var optDrag = document.createElement('div');
        optDrag.className = 'formbuilder-accordion-option-drag';
        optDrag.innerHTML = getIcon('dragHandle');
        
        optHeader.appendChild(optImg);
        optHeader.appendChild(optText);
        optHeader.appendChild(optArrow);
        optHeader.appendChild(optDrag);
        optHeader.appendChild(optEditArea);
        
        // Subcategory drag and drop - only via drag handle
        option.draggable = false;
        var subDragStartIndex = -1;
        optDrag.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            option.draggable = true;
        });
        document.addEventListener('mouseup', function() {
            option.draggable = false;
        });
        option.addEventListener('dragstart', function(e) {
            if (!option.draggable) {
                e.preventDefault();
                return;
            }
            // Remember starting position
            var siblings = Array.from(parentBody.querySelectorAll('.formbuilder-accordion-option'));
            subDragStartIndex = siblings.indexOf(option);
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            option.classList.add('dragging');
        });
        option.addEventListener('dragend', function() {
            option.classList.remove('dragging');
            option.draggable = false;
            // Only notify if position actually changed
            var siblings = Array.from(parentBody.querySelectorAll('.formbuilder-accordion-option'));
            var currentIndex = siblings.indexOf(option);
            if (currentIndex !== subDragStartIndex) {
                notifyChange();
            }
            subDragStartIndex = -1;
        });
        option.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var dragging = parentBody.querySelector('.formbuilder-accordion-option.dragging');
            if (dragging && dragging !== option) {
                var rect = option.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    option.parentNode.insertBefore(dragging, option);
                } else {
                    option.parentNode.insertBefore(dragging, option.nextSibling);
                }
            }
        });
        
        // Sub edit panel
        var subEditPanel = document.createElement('div');
        subEditPanel.className = 'formbuilder-accordion-option-editpanel';
        
        var subNameRow = document.createElement('div');
        subNameRow.className = 'formbuilder-accordion-editpanel-row';
        
        var subNameInput = document.createElement('input');
        subNameInput.type = 'text';
        subNameInput.className = 'formbuilder-accordion-editpanel-input';
        subNameInput.classList.add('formbuilder-accordion-editpanel-input--subcategory');
        subNameInput.value = subName;
        subNameInput.oninput = function() {
            optText.textContent = subNameInput.value;
            notifyChange();
        };
        
        var subMoreBtn = document.createElement('div');
        subMoreBtn.className = 'formbuilder-accordion-editpanel-more';
        subMoreBtn.classList.add('formbuilder-accordion-editpanel-more--subcategory');
        subMoreBtn.innerHTML = getIcon('moreDots') + '<div class="formbuilder-accordion-editpanel-more-menu"><div class="formbuilder-accordion-editpanel-more-item"><span class="formbuilder-accordion-editpanel-more-item-text">Hide Subcategory</span><div class="formbuilder-accordion-editpanel-more-switch' + (subHidden ? ' on' : '') + '"></div></div><div class="formbuilder-accordion-editpanel-more-item formbuilder-accordion-editpanel-more-delete">Delete Subcategory</div></div>';
        var subMoreMenuEl = subMoreBtn.querySelector('.formbuilder-accordion-editpanel-more-menu');
        
        subMoreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasOpen = subMoreMenuEl && subMoreMenuEl.classList.contains('formbuilder-accordion-editpanel-more-menu--open');
            closeAllMenus();
            if (!wasOpen && subMoreMenuEl) subMoreMenuEl.classList.add('formbuilder-accordion-editpanel-more-menu--open');
        });
        
        var subHideSwitch = subMoreBtn.querySelector('.formbuilder-accordion-editpanel-more-switch');
        subHideSwitch.addEventListener('click', function(e) {
            e.stopPropagation();
            subHideSwitch.classList.toggle('on');
            notifyChange();
        });
        
        // Delete subcategory button
        var deleteSubBtn = subMoreBtn.querySelector('.formbuilder-accordion-editpanel-more-delete');
        deleteSubBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (subMoreMenuEl) subMoreMenuEl.classList.remove('formbuilder-accordion-editpanel-more-menu--open');
            deleteSubcategory(option);
        });
        
        subNameRow.appendChild(subNameInput);
        subNameRow.appendChild(subMoreBtn);
        
        var subIconPicker = buildIconPicker(subIconSrc, function(newIcon) {
            applySafeIconImage(optImg, newIcon);
            notifyChange();
        });
        
        subEditPanel.appendChild(subNameRow);
        subEditPanel.appendChild(subIconPicker);
        
        // Ensure "subcategory edit panel" elements get explicit styling classes (no structural CSS selectors).
        subEditPanel.querySelectorAll('.formbuilder-menu-button').forEach(function(el) {
            el.classList.add('formbuilder-menu-button--subcategory');
        });
        subEditPanel.querySelectorAll('.formbuilder-menu-options').forEach(function(el) {
            el.classList.add('formbuilder-menu-options--subcategory');
        });
        
        // Get fee data from subFees if available
        // New subcategories may not have a subFees entry yet → create an empty one so UI doesn't crash.
        if (!cat.subFees) cat.subFees = {};
        if (!cat.subFees[subName]) cat.subFees[subName] = {};
        var subFees = cat.subFees;
        var subFeeData = cat.subFees[subName];
        
        // Subcategory Type row
        var typeRow = document.createElement('div');
        typeRow.className = 'formbuilder-type-row';
        
        var typeLabel = document.createElement('span');
        typeLabel.className = 'formbuilder-type-row-label';
        typeLabel.textContent = 'Subcategory Type';
        
        var currentType = subFeeData && subFeeData.subcategory_type ? subFeeData.subcategory_type : null;
        
        var eventsLabel = document.createElement('label');
        eventsLabel.className = 'formbuilder-type-option';
        var eventsInput = document.createElement('input');
        eventsInput.type = 'radio';
        eventsInput.className = 'formbuilder-type-option-input';
        eventsInput.name = 'subType-' + cat.name + '-' + subName;
        eventsInput.value = 'Events';
        eventsInput.checked = currentType === 'Events';
        var eventsText = document.createElement('span');
        eventsText.className = 'formbuilder-type-option-text';
        eventsText.textContent = 'Events';
        eventsLabel.appendChild(eventsInput);
        eventsLabel.appendChild(eventsText);
        
        var generalLabel = document.createElement('label');
        generalLabel.className = 'formbuilder-type-option';
        var generalInput = document.createElement('input');
        generalInput.type = 'radio';
        generalInput.className = 'formbuilder-type-option-input';
        generalInput.name = 'subType-' + cat.name + '-' + subName;
        generalInput.value = 'General';
        generalInput.checked = currentType === 'General';
        var generalText = document.createElement('span');
        generalText.className = 'formbuilder-type-option-text';
        generalText.textContent = 'General';
        generalLabel.appendChild(generalInput);
        generalLabel.appendChild(generalText);
        
        typeRow.appendChild(typeLabel);
        typeRow.appendChild(eventsLabel);
        typeRow.appendChild(generalLabel);
        subEditPanel.appendChild(typeRow);
        
        // Location Type row
        var locationTypeRow = document.createElement('div');
        locationTypeRow.className = 'formbuilder-type-row';
        
        var locationTypeLabel = document.createElement('span');
        locationTypeLabel.className = 'formbuilder-type-row-label';
        locationTypeLabel.textContent = 'Location Type';
        
        // Only use existing value from database, NO FALLBACKS
        // New subcategories may not have a subFees entry yet → keep as null until admin selects it.
        var currentLocationType = (subFeeData && subFeeData.location_type) ? subFeeData.location_type : null;
        
        var venueLabel = document.createElement('label');
        venueLabel.className = 'formbuilder-type-option';
        var venueInput = document.createElement('input');
        venueInput.type = 'radio';
        venueInput.className = 'formbuilder-type-option-input';
        venueInput.name = 'locationType-' + cat.name + '-' + subName;
        venueInput.value = 'Venue';
        // Only check if explicitly 'Venue', not null/undefined/empty
        venueInput.checked = (currentLocationType === 'Venue');
        var venueText = document.createElement('span');
        venueText.className = 'formbuilder-type-option-text';
        venueText.textContent = 'Venue';
        venueLabel.appendChild(venueInput);
        venueLabel.appendChild(venueText);
        
        var cityLabel = document.createElement('label');
        cityLabel.className = 'formbuilder-type-option';
        var cityInput = document.createElement('input');
        cityInput.type = 'radio';
        cityInput.className = 'formbuilder-type-option-input';
        cityInput.name = 'locationType-' + cat.name + '-' + subName;
        cityInput.value = 'City';
        // Only check if explicitly 'City', not null/undefined/empty
        cityInput.checked = (currentLocationType === 'City');
        if (currentType === 'Events') {
            cityInput.disabled = true;
        }
        var cityText = document.createElement('span');
        cityText.className = 'formbuilder-type-option-text';
        cityText.textContent = 'City';
        cityLabel.appendChild(cityInput);
        cityLabel.appendChild(cityText);
        
        var addressLabel = document.createElement('label');
        addressLabel.className = 'formbuilder-type-option';
        var addressInput = document.createElement('input');
        addressInput.type = 'radio';
        addressInput.className = 'formbuilder-type-option-input';
        addressInput.name = 'locationType-' + cat.name + '-' + subName;
        addressInput.value = 'Address';
        // Only check if explicitly 'Address', not null/undefined/empty
        addressInput.checked = (currentLocationType === 'Address');
        if (currentType === 'Events') {
            addressInput.disabled = true;
        }
        var addressText = document.createElement('span');
        addressText.className = 'formbuilder-type-option-text';
        addressText.textContent = 'Address';
        addressLabel.appendChild(addressInput);
        addressLabel.appendChild(addressText);
        
        function updateLocationTypeFieldsets(selectedType) {
            if (!fieldsetOpts) return;
            var allOptions = fieldsetOpts.querySelectorAll('.formbuilder-fieldset-menu-option');
            var selectedTypeLower = selectedType ? String(selectedType).toLowerCase() : '';
            
            allOptions.forEach(function(opt) {
                var fsId = opt.getAttribute('data-fieldset-id');
                var fieldset = fieldsets.find(function(fs) {
                    if (fs.fieldset_key && typeof fs.fieldset_key === 'string') {
                        return String(fs.fieldset_key) == fsId;
                    }
                    return false;
                });
                if (!fieldset) return;
                
                var fieldsetKey = '';
                if (fieldset.fieldset_key && typeof fieldset.fieldset_key === 'string') {
                    fieldsetKey = fieldset.fieldset_key;
                }
                if (!fieldsetKey) return;
                // Normalize to lowercase for comparison
                var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
                var isVenue = fieldsetKeyLower === 'venue';
                var isCity = fieldsetKeyLower === 'city';
                var isAddress = fieldsetKeyLower === 'address' || fieldsetKeyLower === 'location';
                
                // Only filter venue, city, and address fieldsets - other fieldsets are always enabled
                if (!isVenue && !isCity && !isAddress) {
                    // Not a location fieldset - always enabled (but keep existing disabled state if field already added)
                    return;
                }
                
                // For location fieldsets, apply filtering based on selected type
                // Use separate class '--disabled-location-type' to avoid breaking "already added" disabled state
                if (!selectedType || selectedTypeLower === 'null' || selectedTypeLower === '') {
                    // No selection - enable all location fieldsets
                    opt.classList.remove('formbuilder-fieldset-menu-option--disabled-location-type');
                } else if (selectedTypeLower === 'venue') {
                    if (isCity || isAddress) {
                        opt.classList.add('formbuilder-fieldset-menu-option--disabled-location-type');
                    } else if (isVenue) {
                        opt.classList.remove('formbuilder-fieldset-menu-option--disabled-location-type');
                    }
                } else if (selectedTypeLower === 'city') {
                    if (isVenue || isAddress) {
                        opt.classList.add('formbuilder-fieldset-menu-option--disabled-location-type');
                    } else if (isCity) {
                        opt.classList.remove('formbuilder-fieldset-menu-option--disabled-location-type');
                    }
                } else if (selectedTypeLower === 'address') {
                    if (isVenue || isCity) {
                        opt.classList.add('formbuilder-fieldset-menu-option--disabled-location-type');
                    } else if (isAddress) {
                        opt.classList.remove('formbuilder-fieldset-menu-option--disabled-location-type');
                    }
                }
            });
        }
        
        // Function to update divider line and location repeat switches based on location type selection
        function updateLocationDividerAndRepeatSwitches() {
            if (!fieldsContainer) return;
            
            // Check if any location type is selected (Venue, City, or Address)
            var currentLocationTypeRadio = subEditPanel.querySelector('input[type="radio"][name^="locationType-"]:checked');
            var isLocationTypeSelected = currentLocationTypeRadio && currentLocationTypeRadio.checked;
            
            // Find all field wrappers
            var allFieldWrappers = Array.from(fieldsContainer.querySelectorAll('.formbuilder-field-wrapper'));
            
            // Find the location fieldset (venue, city, or address)
            var locationFieldsetWrapper = null;
            var locationFieldsetIndex = -1;
            
            for (var i = 0; i < allFieldWrappers.length; i++) {
                var wrapper = allFieldWrappers[i];
                var fsId = wrapper.getAttribute('data-fieldset-id');
                if (!fsId) continue;
                
                var fieldset = fieldsets.find(function(fs) {
                    if (fs.id && String(fs.id) === fsId) return true;
                    if (fs.fieldset_key && String(fs.fieldset_key) === fsId) return true;
                    if (fs.key && String(fs.key) === fsId) return true;
                    if (fs.name && String(fs.name) === fsId) return true;
                    return false;
                });
                if (!fieldset) continue;
                
                if (!fieldset.fieldset_key) continue;
                var fieldsetKeyLower = String(fieldset.fieldset_key).toLowerCase();
                var isLocationFieldset = fieldsetKeyLower === 'venue' || 
                                        fieldsetKeyLower === 'city' || 
                                        fieldsetKeyLower === 'address' || 
                                        fieldsetKeyLower === 'location';
                
                if (isLocationFieldset) {
                    locationFieldsetWrapper = wrapper;
                    locationFieldsetIndex = i;
                    break;
                }
            }
            
            // Remove existing divider if any
            var existingDivider = fieldsContainer.querySelector('.formbuilder-location-divider');
            if (existingDivider) {
                existingDivider.remove();
            }
            
            // If location type is selected and location fieldset exists, add divider above it
            if (isLocationTypeSelected && locationFieldsetWrapper) {
                var divider = document.createElement('div');
                divider.className = 'formbuilder-location-divider';
                fieldsContainer.insertBefore(divider, locationFieldsetWrapper);
            }
            
            // Update location repeat switches based on position relative to divider
            if (isLocationTypeSelected && locationFieldsetWrapper) {
                var dividerIndex = locationFieldsetIndex; // Divider is right before location fieldset
                
                for (var i = 0; i < allFieldWrappers.length; i++) {
                    var wrapper = allFieldWrappers[i];
                    var fsId = wrapper.getAttribute('data-fieldset-id');
                    if (!fsId) continue;
                    
                    var fieldset = fieldsets.find(function(fs) {
                        if (fs.id && String(fs.id) === fsId) return true;
                        if (fs.fieldset_key && String(fs.fieldset_key) === fsId) return true;
                        if (fs.key && String(fs.key) === fsId) return true;
                        if (fs.name && String(fs.name) === fsId) return true;
                        return false;
                    });
                    if (!fieldset) continue;
                    
                    if (!fieldset.fieldset_key) continue;
                    var fieldsetKeyLower = String(fieldset.fieldset_key).toLowerCase();
                    var isLocationFieldset = fieldsetKeyLower === 'venue' || 
                                            fieldsetKeyLower === 'city' || 
                                            fieldsetKeyLower === 'address' || 
                                            fieldsetKeyLower === 'location';
                    
                    // Skip locked location fieldsets (they're always on)
                    if (isLocationFieldset) continue;
                    
                    var locationRepeatSwitch = wrapper.querySelector('.formbuilder-field-switch');
                    var locationRepeatLabel = wrapper.querySelector('.formbuilder-field-switch-label');
                    if (!locationRepeatSwitch || !locationRepeatLabel) continue;
                    
                    // Fieldsets below the divider (index > dividerIndex) should have location repeat ON and locked (disabled)
                    // Fieldsets above the divider (index < dividerIndex) should have location repeat OFF and disabled
                    if (i > dividerIndex) {
                        // Below divider - lock location repeat switch ON (disabled but on)
                        locationRepeatSwitch.classList.add('on');
                        locationRepeatLabel.classList.add('disabled');
                        locationRepeatSwitch.classList.add('disabled');
                        wrapper.classList.add('formbuilder-field-wrapper--location-repeat');
                        syncFieldWrapperUi(wrapper);
                        notifyChange();
                    } else {
                        // Above divider - disable location repeat switch and turn it off
                        locationRepeatSwitch.classList.remove('on');
                        locationRepeatLabel.classList.add('disabled');
                        locationRepeatSwitch.classList.add('disabled');
                        wrapper.classList.remove('formbuilder-field-wrapper--location-repeat');
                        
                        // Lock must-repeat and autofill-repeat switches above divider (disable but don't change values)
                        var mustRepeatLabel = wrapper.querySelectorAll('.formbuilder-field-switch-label')[1];
                        var mustRepeatSwitch = wrapper.querySelectorAll('.formbuilder-field-switch')[1];
                        var autofillRepeatLabel = wrapper.querySelectorAll('.formbuilder-field-switch-label')[2];
                        var autofillRepeatSwitch = wrapper.querySelectorAll('.formbuilder-field-switch')[2];
                        if (mustRepeatLabel) mustRepeatLabel.classList.add('disabled');
                        if (mustRepeatSwitch) mustRepeatSwitch.classList.add('disabled');
                        if (autofillRepeatLabel) autofillRepeatLabel.classList.add('disabled');
                        if (autofillRepeatSwitch) autofillRepeatSwitch.classList.add('disabled');
                        
                        syncFieldWrapperUi(wrapper);
                        notifyChange();
                    }
                }
                
                // Ensure location fieldset is first below the divider
                // Get all wrappers again (in case order changed)
                var allWrappersAfterDivider = Array.from(fieldsContainer.children);
                var dividerElement = fieldsContainer.querySelector('.formbuilder-location-divider');
                if (dividerElement && locationFieldsetWrapper) {
                    var dividerPos = allWrappersAfterDivider.indexOf(dividerElement);
                    var locationPos = allWrappersAfterDivider.indexOf(locationFieldsetWrapper);
                    
                    // If location fieldset is not immediately after divider, move it
                    if (locationPos !== dividerPos + 1) {
                        // Find first non-location fieldset after divider
                        var firstNonLocationAfterDivider = null;
                        for (var i = dividerPos + 1; i < allWrappersAfterDivider.length; i++) {
                            var el = allWrappersAfterDivider[i];
                            if (el === locationFieldsetWrapper) continue;
                            if (el.classList.contains('formbuilder-field-wrapper')) {
                                var fsId = el.getAttribute('data-fieldset-id');
                                if (!fsId) continue;
                                
                                var fieldset = fieldsets.find(function(fs) {
                                    if (fs.id && String(fs.id) === fsId) return true;
                                    if (fs.fieldset_key && String(fs.fieldset_key) === fsId) return true;
                                    if (fs.key && String(fs.key) === fsId) return true;
                                    if (fs.name && String(fs.name) === fsId) return true;
                                    return false;
                                });
                                if (!fieldset) continue;
                                if (!fieldset.fieldset_key) continue;
                                var fieldsetKeyLower = String(fieldset.fieldset_key).toLowerCase();
                                var isLocationFieldset = fieldsetKeyLower === 'venue' || 
                                                        fieldsetKeyLower === 'city' || 
                                                        fieldsetKeyLower === 'address' || 
                                                        fieldsetKeyLower === 'location';
                                if (!isLocationFieldset) {
                                    firstNonLocationAfterDivider = el;
                                    break;
                                }
                            }
                        }
                        
                        // Move location fieldset to be first after divider
                        if (firstNonLocationAfterDivider) {
                            fieldsContainer.insertBefore(locationFieldsetWrapper, firstNonLocationAfterDivider);
                        } else {
                            // No non-location fieldsets after divider, just ensure it's right after divider
                            if (locationPos !== dividerPos + 1) {
                                fieldsContainer.insertBefore(locationFieldsetWrapper, dividerElement.nextSibling);
                            }
                        }
                    }
                }
            } else {
                // Location type not selected - remove divider
                // (location repeat states remain as user set them)
            }
        }
        
        function manageLocationTypeFieldsets(selectedType) {
            if (!selectedType) {
                // No location type selected:
                // - Keep button visible but force admin to pick a location type first
                // - Do NOT allow fieldset menu to open yet
                if (fieldsetMenu) {
                    fieldsetMenu.style.display = '';
                    fieldsetMenu.classList.remove('formbuilder-fieldset-menu--open');
                    if (fieldsetBtn) fieldsetBtn.classList.remove('formbuilder-fieldset-menu-button--open');
                    if (fieldsetOpts) fieldsetOpts.classList.remove('formbuilder-fieldset-menu-options--open');
                }
                if (fieldsetBtn) {
                    fieldsetBtn.textContent = 'Select Location Type';
                }
                return;
            }
            
            // Show Add Field button
            if (fieldsetMenu) {
                fieldsetMenu.style.display = '';
            }
            if (fieldsetBtn) {
                fieldsetBtn.textContent = '+ Add Fieldset';
            }
            
            // Update gray-out state based on selected type
            updateLocationTypeFieldsets(selectedType);
            
            var selectedTypeLower = String(selectedType).toLowerCase();
            var targetFieldsetKey = null;
            
            // Determine which fieldset key to use
            if (selectedTypeLower === 'venue') {
                targetFieldsetKey = 'venue';
            } else if (selectedTypeLower === 'city') {
                targetFieldsetKey = 'city';
            } else if (selectedTypeLower === 'address') {
                targetFieldsetKey = 'address';
            }
            
            if (!targetFieldsetKey) return;
            
            // Find all location type fieldsets in the fields container
            var allFieldWrappers = Array.from(fieldsContainer.querySelectorAll('.formbuilder-field-wrapper'));
            var existingLocationWrapper = null;
            var existingLocationIndex = -1;
            var targetFieldsetExists = false;
            
            // Find existing location fieldset and its position
            for (var i = 0; i < allFieldWrappers.length; i++) {
                var wrapper = allFieldWrappers[i];
                var fsId = wrapper.getAttribute('data-fieldset-id');
                // Match by id, key, or fieldset_key since fields loaded from database use fieldsetKey
                var fieldset = fieldsets.find(function(fs) {
                    return fs.id == fsId || fs.key == fsId || fs.fieldset_key == fsId;
                });
                if (!fieldset) continue;
                
                if (!fieldset.fieldset_key) continue;
                var fieldsetKeyLower = String(fieldset.fieldset_key).toLowerCase();
                
                // Check if this is a location fieldset
                var isLocationFieldset = fieldsetKeyLower === 'venue' || 
                                        fieldsetKeyLower === 'city' || 
                                        fieldsetKeyLower === 'address' || 
                                        fieldsetKeyLower === 'location';
                
                if (isLocationFieldset) {
                    existingLocationWrapper = wrapper;
                    existingLocationIndex = i;
                    
                    // Check if it matches the selected type
                    var matches = false;
                    if (targetFieldsetKey === 'address') {
                        matches = (fieldsetKeyLower === 'address' || fieldsetKeyLower === 'location');
                    } else {
                        matches = (fieldsetKeyLower === targetFieldsetKey);
                    }
                    
                    if (matches) {
                        targetFieldsetExists = true;
                    }
                    break;
                }
            }
            
            // If target fieldset doesn't exist, swap it in at the same position
            if (!targetFieldsetExists) {
                // Find target fieldset by fieldset_key
                var targetFieldset = null;
                if (targetFieldsetKey === 'address') {
                    // Try 'address' first, then 'location'
                    targetFieldset = fieldsets.find(function(fs) {
                        if (!fs.fieldset_key) return false;
                        return String(fs.fieldset_key).toLowerCase() === 'address';
                    });
                    if (!targetFieldset) {
                        targetFieldset = fieldsets.find(function(fs) {
                            if (!fs.fieldset_key) return false;
                            return String(fs.fieldset_key).toLowerCase() === 'location';
                        });
                    }
                } else {
                    targetFieldset = fieldsets.find(function(fs) {
                        if (!fs.fieldset_key) return false;
                        return String(fs.fieldset_key).toLowerCase() === targetFieldsetKey;
                    });
                }
                
                if (targetFieldset) {
                    // Save reference to next sibling before removing old location fieldset
                    var insertBeforeNode = null;
                    if (existingLocationWrapper) {
                        insertBeforeNode = existingLocationWrapper.nextSibling;
                        var oldFsId = existingLocationWrapper.getAttribute('data-fieldset-id');
                        existingLocationWrapper.remove();
                        addedFieldsets[oldFsId] = false;
                        var oldMenuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + oldFsId + '"]');
                        if (oldMenuOpt) {
                            oldMenuOpt.classList.remove('formbuilder-fieldset-menu-option--disabled');
                        }
                    }
                    
                    // Create new location fieldset
                    var result = createFieldElement(targetFieldset, true, targetFieldset);
                    addedFieldsets[result.fsId] = true;
                    var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + result.fsId + '"]');
                    if (menuOpt) {
                        menuOpt.classList.add('formbuilder-fieldset-menu-option--disabled');
                    }
                    
                    // Insert at the same position if location existed, otherwise append
                    if (insertBeforeNode) {
                        // Insert before the element that was after the old location fieldset
                        fieldsContainer.insertBefore(result.wrapper, insertBeforeNode);
                    } else {
                        // No existing location, just append
                        fieldsContainer.appendChild(result.wrapper);
                    }
                    
                    // Update divider and location repeat switches after swapping location fieldset
                    setTimeout(function() {
                        updateLocationDividerAndRepeatSwitches();
                    }, 0);
                    notifyChange();
                }
        }
    }
    
    venueInput.addEventListener('change', function(e) {
            e.stopPropagation();
            if (venueInput.checked) {
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].location_type = 'Venue';
                updateLocationTypeFieldsets('Venue');
                manageLocationTypeFieldsets('Venue');
                if (fieldsetBtn) fieldsetBtn.textContent = '+ Add Fieldset';
                // Update divider and location repeat switches after a brief delay to ensure DOM is updated
                setTimeout(function() {
                    updateLocationDividerAndRepeatSwitches();
                }, 0);
                notifyChange();
            }
        });
        
        cityInput.addEventListener('change', function(e) {
            e.stopPropagation();
            if (cityInput.checked) {
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].location_type = 'City';
                updateLocationTypeFieldsets('City');
                manageLocationTypeFieldsets('City');
                if (fieldsetBtn) fieldsetBtn.textContent = '+ Add Fieldset';
                // Update divider and location repeat switches after a brief delay to ensure DOM is updated
                setTimeout(function() {
                    updateLocationDividerAndRepeatSwitches();
                }, 0);
                notifyChange();
            }
        });
        
        addressInput.addEventListener('change', function(e) {
            e.stopPropagation();
            if (addressInput.checked) {
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].location_type = 'Address';
                updateLocationTypeFieldsets('Address');
                manageLocationTypeFieldsets('Address');
                if (fieldsetBtn) fieldsetBtn.textContent = '+ Add Fieldset';
                // Update divider and location repeat switches after a brief delay to ensure DOM is updated
                setTimeout(function() {
                    updateLocationDividerAndRepeatSwitches();
                }, 0);
                notifyChange();
            }
        });
        
        // Also handle clicks on labels to ensure radio selection works
        venueLabel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        cityLabel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        addressLabel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // Store location type for later use when fieldsetOpts is created
        var initialLocationType = currentLocationType;
        
        // Update when Events/General type changes
        eventsInput.addEventListener('change', function() {
            if (eventsInput.checked) {
                // Venue stays enabled, only City and Address are disabled
                cityInput.disabled = true;
                addressInput.disabled = true;
                // When switching to Events, location type must be Venue
                // Get current location type from data structure
                var existingLocationType = (cat.subFees && cat.subFees[subName] && cat.subFees[subName].location_type) ? cat.subFees[subName].location_type : null;
                if (!existingLocationType || existingLocationType === null || existingLocationType === '') {
                    // No location type set - set to Venue
                    venueInput.checked = true;
                    cityInput.checked = false;
                    addressInput.checked = false;
                    if (!cat.subFees) cat.subFees = {};
                    if (!cat.subFees[subName]) cat.subFees[subName] = {};
                    cat.subFees[subName].location_type = 'Venue';
                    updateLocationTypeFieldsets('Venue');
                    manageLocationTypeFieldsets('Venue');
                } else {
                    // Location type already set - if it's not Venue, change to Venue (Events requires Venue)
                    if (existingLocationType === 'Venue') {
                        venueInput.checked = true;
                        cityInput.checked = false;
                        addressInput.checked = false;
                        // Keep Venue, just update UI
                        updateLocationTypeFieldsets('Venue');
                        manageLocationTypeFieldsets('Venue');
                    } else {
                        // If it was City or Address, change to Venue (Events requires Venue)
                        venueInput.checked = true;
                        cityInput.checked = false;
                        addressInput.checked = false;
                        if (!cat.subFees) cat.subFees = {};
                        if (!cat.subFees[subName]) cat.subFees[subName] = {};
                        cat.subFees[subName].location_type = 'Venue';
                        updateLocationTypeFieldsets('Venue');
                        manageLocationTypeFieldsets('Venue');
                    }
                }
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].subcategory_type = 'Events';
                notifyChange();
            }
        });
        
        generalInput.addEventListener('change', function() {
            if (generalInput.checked) {
                venueInput.disabled = false;
                cityInput.disabled = false;
                addressInput.disabled = false;
                // When switching to General, keep the current location type (don't clear it)
                // Get current location type from data structure
                var existingLocationType = (cat.subFees && cat.subFees[subName] && cat.subFees[subName].location_type) ? cat.subFees[subName].location_type : null;
                // Update radio button states to match current location type
                if (existingLocationType === 'Venue') {
                    venueInput.checked = true;
                    cityInput.checked = false;
                    addressInput.checked = false;
                } else if (existingLocationType === 'City') {
                    venueInput.checked = false;
                    cityInput.checked = true;
                    addressInput.checked = false;
                } else if (existingLocationType === 'Address') {
                    venueInput.checked = false;
                    cityInput.checked = false;
                    addressInput.checked = true;
                } else {
                    // No location type set - leave all unchecked
                    venueInput.checked = false;
                    cityInput.checked = false;
                    addressInput.checked = false;
                }
                // Update fieldset states based on current location type
                if (existingLocationType) {
                    updateLocationTypeFieldsets(existingLocationType);
                    manageLocationTypeFieldsets(existingLocationType);
                } else {
                    updateLocationTypeFieldsets(null);
                    manageLocationTypeFieldsets(null);
                }
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].subcategory_type = 'General';
                // Keep existing location_type - don't set to null
                notifyChange();
            }
        });
        
        locationTypeRow.appendChild(locationTypeLabel);
        locationTypeRow.appendChild(venueLabel);
        locationTypeRow.appendChild(cityLabel);
        locationTypeRow.appendChild(addressLabel);
        subEditPanel.appendChild(locationTypeRow);
        
        // Surcharge row
        var surchargeRow = document.createElement('div');
        surchargeRow.className = 'formbuilder-fee-row';
        
        var surchargeLabel = document.createElement('span');
        surchargeLabel.className = 'formbuilder-fee-row-label';
        surchargeLabel.textContent = 'Checkout Surcharge';
        
        var surchargePercent = document.createElement('span');
        surchargePercent.className = 'formbuilder-fee-percent';
        surchargePercent.textContent = '%';
        
        var surchargeInput = document.createElement('input');
        surchargeInput.type = 'number';
        surchargeInput.step = '0.01';
        surchargeInput.min = '-100';
        surchargeInput.className = 'formbuilder-fee-input';
        surchargeInput.placeholder = 'N/A';
        
        if (subFeeData && subFeeData.checkout_surcharge !== null && subFeeData.checkout_surcharge !== undefined) {
            surchargeInput.value = parseFloat(subFeeData.checkout_surcharge).toFixed(2);
        }
        
        // Only allow numbers and minus sign
        surchargeInput.addEventListener('keypress', function(e) {
            var char = String.fromCharCode(e.which);
            // Allow: numbers, minus sign (only at start), decimal point
            if (!/[0-9]/.test(char) && char !== '-' && char !== '.') {
                e.preventDefault();
                return false;
            }
            // Only allow minus at the start
            if (char === '-' && (this.selectionStart !== 0 || this.value.indexOf('-') !== -1)) {
                e.preventDefault();
                return false;
            }
            // Only allow one decimal point
            if (char === '.' && this.value.indexOf('.') !== -1) {
                e.preventDefault();
                return false;
            }
        });
        
        surchargeInput.addEventListener('input', function() {
            // Filter out any non-numeric characters except minus and decimal
            var value = this.value;
            // Remove any characters that aren't numbers, minus, or decimal
            value = value.replace(/[^0-9.\-]/g, '');
            // Ensure minus is only at the start
            if (value.indexOf('-') > 0) {
                value = value.replace(/-/g, '');
            }
            // Ensure only one decimal point
            var parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            this.value = value;
            
            var numValue = value ? parseFloat(value) : null;
            if (numValue !== null && numValue < -100) {
                numValue = -100;
                this.value = numValue.toFixed(2);
            }
            if (!cat.subFees) cat.subFees = {};
            if (!cat.subFees[subName]) cat.subFees[subName] = {};
            cat.subFees[subName].checkout_surcharge = numValue !== null ? Math.round(numValue * 100) / 100 : null;
            notifyChange();
        });
        
        surchargeInput.addEventListener('blur', function() {
            var value = this.value ? parseFloat(this.value) : null;
            if (value !== null && value < -100) {
                value = -100;
            }
            if (value !== null) {
                this.value = value.toFixed(2);
            }
        });
        
        // Calculator button
        var calculatorBtn = document.createElement('button');
        calculatorBtn.type = 'button';
        calculatorBtn.className = 'formbuilder-calculator-btn';
        calculatorBtn.textContent = 'Calculator';
        calculatorBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showCheckoutCalculator(cat, subName);
        });
        
        surchargeRow.appendChild(surchargeLabel);
        surchargeRow.appendChild(surchargePercent);
        surchargeRow.appendChild(surchargeInput);
        surchargeRow.appendChild(calculatorBtn);
        subEditPanel.appendChild(surchargeRow);
        
        
        // Subcategory body with fieldset menu and form preview
        var optBody = document.createElement('div');
        optBody.className = 'formbuilder-accordion-option-body';
        
        var fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'formbuilder-fields-container';
        optBody.appendChild(fieldsContainer);
        
        // Fieldset menu
        var fieldsetMenu = document.createElement('div');
        fieldsetMenu.className = 'formbuilder-fieldset-menu';
        fieldsetMenu.innerHTML = '<div class="formbuilder-fieldset-menu-button formbuilder-add-fieldset">+ Add Fieldset</div><div class="formbuilder-fieldset-menu-options"></div>';
        
        var fieldsetBtn = fieldsetMenu.querySelector('.formbuilder-fieldset-menu-button');
        var fieldsetOpts = fieldsetMenu.querySelector('.formbuilder-fieldset-menu-options');
        
        var addedFieldsets = {};
        
        function createFieldElement(fieldData, isRequired, fieldsetDef) {
            var fsId = '';
            if (fieldData.id && typeof fieldData.id === 'string') {
                fsId = fieldData.id;
            } else if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                fsId = fieldData.fieldsetKey;
            } else if (fieldData.key && typeof fieldData.key === 'string') {
                fsId = fieldData.key;
            } else if (fieldData.name && typeof fieldData.name === 'string') {
                fsId = fieldData.name;
            }
            var fieldName = '';
            if (fieldData.name && typeof fieldData.name === 'string') {
                fieldName = fieldData.name;
            } else if (fieldData.key && typeof fieldData.key === 'string') {
                fieldName = fieldData.key;
            }
            
            // Location fieldsets are mandatory per-location and must never be configurable.
            // Lock repeat settings and required checkbox for: Venue, City, Address
            var isLockedLocationFieldset = false;
            if (fieldsetDef && fieldsetDef.fieldset_key) {
                var fieldsetKeyLower = String(fieldsetDef.fieldset_key).toLowerCase();
                isLockedLocationFieldset = (fieldsetKeyLower === 'venue' || fieldsetKeyLower === 'city' || fieldsetKeyLower === 'address');
            }
            
            // Location fieldsets must always be required
            if (isLockedLocationFieldset) {
                isRequired = true;
            }
            
            var fieldWrapper = document.createElement('div');
            fieldWrapper.className = 'formbuilder-field-wrapper';
            fieldWrapper.setAttribute('data-fieldset-id', fsId);
            
            var field = document.createElement('div');
            field.className = 'formbuilder-field';
            
            var fieldText = document.createElement('span');
            fieldText.className = 'formbuilder-field-text';
            
            var fieldNameSpan = document.createElement('span');
            fieldNameSpan.className = 'formbuilder-field-name';
            fieldNameSpan.textContent = fieldName;
            
            var fieldRequired = document.createElement('span');
            fieldRequired.className = 'formbuilder-field-required';
            fieldRequired.textContent = '*';
            
            var fieldIndicators = document.createElement('span');
            fieldIndicators.className = 'formbuilder-field-indicators';
            
            var indicatorRepeat = document.createElement('span');
            indicatorRepeat.className = 'formbuilder-field-indicator formbuilder-field-indicator-repeat';
            indicatorRepeat.textContent = '↻';
            indicatorRepeat.title = 'Location Repeat';
            
            var indicatorMust = document.createElement('span');
            indicatorMust.className = 'formbuilder-field-indicator formbuilder-field-indicator-must';
            indicatorMust.textContent = '!';
            indicatorMust.title = 'Must Repeat';
            
            var indicatorAutofill = document.createElement('span');
            indicatorAutofill.className = 'formbuilder-field-indicator formbuilder-field-indicator-autofill';
            indicatorAutofill.textContent = '≡';
            indicatorAutofill.title = 'Autofill Repeat';
            
            fieldIndicators.appendChild(indicatorRepeat);
            fieldIndicators.appendChild(indicatorMust);
            fieldIndicators.appendChild(indicatorAutofill);
            
            var fieldDrag = document.createElement('div');
            fieldDrag.className = 'formbuilder-field-drag';
            fieldDrag.innerHTML = getIcon('dragHandle');
            
            var fieldEdit = document.createElement('div');
            fieldEdit.className = 'formbuilder-field-edit';
            fieldEdit.innerHTML = getIcon('editPen');
            
            // Create Modified label span (will be shown/hidden via CSS)
            var modifiedLabel = document.createElement('span');
            modifiedLabel.className = 'formbuilder-field-modified-label';
            modifiedLabel.textContent = 'Modified';
            
            fieldText.appendChild(fieldNameSpan);
            fieldText.appendChild(fieldRequired);
            fieldText.appendChild(fieldIndicators);
            fieldText.appendChild(modifiedLabel);
            field.appendChild(fieldText);
            field.appendChild(fieldDrag);
            field.appendChild(fieldEdit);
            
            var fieldEditPanel = document.createElement('div');
            fieldEditPanel.className = 'formbuilder-field-editpanel';
            
            var editRow = document.createElement('div');
            editRow.className = 'formbuilder-field-editpanel-row';
            
            var requiredLabel = document.createElement('label');
            requiredLabel.className = 'formbuilder-field-required-label';
            
            var requiredCheckbox = document.createElement('input');
            requiredCheckbox.type = 'checkbox';
            requiredCheckbox.className = 'formbuilder-field-required-checkbox';
            requiredCheckbox.checked = isRequired;
            if (isRequired) {
                fieldWrapper.classList.add('formbuilder-field-wrapper--required');
            }
            
            // Lock required checkbox for location fieldsets
            if (isLockedLocationFieldset) {
                requiredCheckbox.checked = true;
                requiredCheckbox.disabled = true;
                requiredLabel.classList.add('disabled');
            }
            
            syncFieldWrapperUi(fieldWrapper);
            requiredCheckbox.onchange = function() {
                if (isLockedLocationFieldset) {
                    // Prevent unchecking location fieldsets - force it back to checked
                    requiredCheckbox.checked = true;
                    return;
                }
                if (requiredCheckbox.checked) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--required');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--required');
                }
                syncFieldWrapperUi(fieldWrapper);
                notifyChange();
            };
            
            requiredLabel.appendChild(requiredCheckbox);
            requiredLabel.appendChild(document.createTextNode('Required'));
            
            var fieldMoreBtn = document.createElement('div');
            fieldMoreBtn.className = 'formbuilder-field-more';
            fieldMoreBtn.innerHTML = getIcon('moreDots') + '<div class="formbuilder-field-more-menu"><div class="formbuilder-field-more-item formbuilder-field-more-delete">Delete Field</div></div>';
            var fieldMoreMenuEl = fieldMoreBtn.querySelector('.formbuilder-field-more-menu');
            
            // Lock more menu for location fieldsets - prevent deletion
            if (isLockedLocationFieldset) {
                fieldMoreBtn.classList.add('disabled');
                fieldMoreBtn.style.pointerEvents = 'none';
                fieldMoreBtn.style.opacity = '0.5';
            } else {
                fieldMoreBtn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    var wasOpen = fieldMoreMenuEl && fieldMoreMenuEl.classList.contains('formbuilder-field-more-menu--open');
                    closeAllMenus();
                    if (!wasOpen && fieldMoreMenuEl) fieldMoreMenuEl.classList.add('formbuilder-field-more-menu--open');
                });
                
                var fieldDeleteItem = fieldMoreBtn.querySelector('.formbuilder-field-more-delete');
                fieldDeleteItem.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    fieldWrapper.remove();
                    addedFieldsets[fsId] = false;
                    var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + fsId + '"]');
                    if (menuOpt) {
                        menuOpt.classList.remove('formbuilder-fieldset-menu-option--disabled');
                        // Re-apply location type filtering after removing "already added" disabled state
                        var currentLocationTypeRadio = subEditPanel.querySelector('input[type="radio"][name^="locationType-"]:checked');
                        var currentLocationType = currentLocationTypeRadio ? currentLocationTypeRadio.value : null;
                        updateLocationTypeFieldsets(currentLocationType);
                    }
                    notifyChange();
                });
            }
            
            editRow.appendChild(requiredLabel);
            editRow.appendChild(fieldMoreBtn);
            fieldEditPanel.appendChild(editRow);
            
            // Repeat switches
            var switchRow = document.createElement('div');
            switchRow.className = 'formbuilder-field-switch-row';
            
            var locationRepeatLabel = document.createElement('label');
            locationRepeatLabel.className = 'formbuilder-field-switch-label';
            var locationRepeatSwitch = document.createElement('div');
            locationRepeatSwitch.className = 'formbuilder-field-switch';
            locationRepeatLabel.appendChild(locationRepeatSwitch);
            locationRepeatLabel.appendChild(document.createTextNode('Location Repeat'));
            
            var mustRepeatLabel = document.createElement('label');
            mustRepeatLabel.className = 'formbuilder-field-switch-label disabled';
            var mustRepeatSwitch = document.createElement('div');
            mustRepeatSwitch.className = 'formbuilder-field-switch disabled';
            mustRepeatLabel.appendChild(mustRepeatSwitch);
            mustRepeatLabel.appendChild(document.createTextNode('Must Repeat'));
            
            var autofillRepeatLabel = document.createElement('label');
            autofillRepeatLabel.className = 'formbuilder-field-switch-label disabled';
            var autofillRepeatSwitch = document.createElement('div');
            autofillRepeatSwitch.className = 'formbuilder-field-switch disabled';
            autofillRepeatLabel.appendChild(autofillRepeatSwitch);
            autofillRepeatLabel.appendChild(document.createTextNode('Autofill Repeat'));

            // Force-lock repeat switches for location fieldsets (Venue/City/Address)
            if (isLockedLocationFieldset) {
                // Location Repeat + Must Repeat ON
                locationRepeatLabel.classList.add('disabled');
                locationRepeatSwitch.classList.add('disabled', 'on');
                fieldWrapper.classList.add('formbuilder-field-wrapper--location-repeat');

                mustRepeatLabel.classList.add('disabled');
                mustRepeatSwitch.classList.add('disabled', 'on');
                fieldWrapper.classList.add('formbuilder-field-wrapper--must-repeat');

                // Autofill OFF
                autofillRepeatLabel.classList.add('disabled');
                autofillRepeatSwitch.classList.add('disabled');
                autofillRepeatSwitch.classList.remove('on');
                fieldWrapper.classList.remove('formbuilder-field-wrapper--autofill-repeat');
                syncFieldWrapperUi(fieldWrapper);
            }
            
            locationRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isLockedLocationFieldset || locationRepeatSwitch.classList.contains('disabled')) return;
                var isOn = locationRepeatSwitch.classList.toggle('on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--location-repeat');
                    mustRepeatLabel.classList.remove('disabled');
                    mustRepeatSwitch.classList.remove('disabled');
                    autofillRepeatLabel.classList.remove('disabled');
                    autofillRepeatSwitch.classList.remove('disabled');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--location-repeat');
                    mustRepeatLabel.classList.add('disabled');
                    mustRepeatSwitch.classList.add('disabled');
                    autofillRepeatLabel.classList.add('disabled');
                    autofillRepeatSwitch.classList.add('disabled');
                }
                syncFieldWrapperUi(fieldWrapper);
                notifyChange();
            });
            
            mustRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isLockedLocationFieldset) return;
                if (mustRepeatSwitch.classList.contains('disabled')) return;
                var isOn = mustRepeatSwitch.classList.toggle('on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--must-repeat');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--must-repeat');
                }
                syncFieldWrapperUi(fieldWrapper);
                notifyChange();
            });
            
            autofillRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isLockedLocationFieldset) return;
                if (autofillRepeatSwitch.classList.contains('disabled')) return;
                var isOn = autofillRepeatSwitch.classList.toggle('on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--autofill-repeat');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--autofill-repeat');
                }
                syncFieldWrapperUi(fieldWrapper);
                notifyChange();
            });
            
            switchRow.appendChild(locationRepeatLabel);
            switchRow.appendChild(mustRepeatLabel);
            switchRow.appendChild(autofillRepeatLabel);
            fieldEditPanel.appendChild(switchRow);

            // Initialize repeat switch states from fieldData (loaded from database)
            // Location fieldsets are force-locked above (Venue/City/Address).
            if (!isLockedLocationFieldset) {
                var initialLocationRepeat = false;
                if (fieldData) {
                    if (fieldData.location_repeat !== undefined) {
                        initialLocationRepeat = !!fieldData.location_repeat;
                    } else if (fieldData.locationRepeat !== undefined) {
                        initialLocationRepeat = !!fieldData.locationRepeat;
                    }
                }
                var initialMustRepeat = false;
                if (fieldData) {
                    if (fieldData.must_repeat !== undefined) {
                        initialMustRepeat = !!fieldData.must_repeat;
                    } else if (fieldData.mustRepeat !== undefined) {
                        initialMustRepeat = !!fieldData.mustRepeat;
                    }
                }
                var initialAutofillRepeat = false;
                if (fieldData) {
                    if (fieldData.autofill_repeat !== undefined) {
                        initialAutofillRepeat = !!fieldData.autofill_repeat;
                    } else if (fieldData.autofillRepeat !== undefined) {
                        initialAutofillRepeat = !!fieldData.autofillRepeat;
                    }
                }

                if (initialLocationRepeat) {
                    locationRepeatSwitch.classList.add('on');
                    fieldWrapper.classList.add('formbuilder-field-wrapper--location-repeat');
                    mustRepeatLabel.classList.remove('disabled');
                    mustRepeatSwitch.classList.remove('disabled');
                    autofillRepeatLabel.classList.remove('disabled');
                    autofillRepeatSwitch.classList.remove('disabled');
                } else {
                    mustRepeatLabel.classList.add('disabled');
                    mustRepeatSwitch.classList.add('disabled');
                    autofillRepeatLabel.classList.add('disabled');
                    autofillRepeatSwitch.classList.add('disabled');
                    initialMustRepeat = false;
                    initialAutofillRepeat = false;
                }

                if (initialMustRepeat) {
                    mustRepeatSwitch.classList.add('on');
                    fieldWrapper.classList.add('formbuilder-field-wrapper--must-repeat');
                }
                if (initialAutofillRepeat) {
                    autofillRepeatSwitch.classList.add('on');
                    fieldWrapper.classList.add('formbuilder-field-wrapper--autofill-repeat');
                }
            }
            syncFieldWrapperUi(fieldWrapper);
            
            // Check field type
            // CRITICAL: fieldset key is the source of truth (not input_type / not a generic "type").
            // If we prioritize a generic type first, option/amenities editors can disappear even when
            // the fieldset is actually "amenities" or "custom_*".
            var fieldType = '';
            if (fieldsetDef.fieldset_key && typeof fieldsetDef.fieldset_key === 'string') {
                fieldType = fieldsetDef.fieldset_key;
            } else if (fieldsetDef.key && typeof fieldsetDef.key === 'string') {
                fieldType = fieldsetDef.key;
            } else if (fieldsetDef.type && typeof fieldsetDef.type === 'string') {
                fieldType = fieldsetDef.type;
            } else if (fieldsetDef.fieldset_type && typeof fieldsetDef.fieldset_type === 'string') {
                fieldType = fieldsetDef.fieldset_type;
            }
            var needsAmenities = fieldType === 'amenities';
            // CRITICAL: No fallbacks in the member/admin renderers, but Form Builder must still
            // recognize option-based fieldsets so the editor UI is available.
            // Canonical keys are now custom_dropdown/custom_radio.
            var needsOptions = (
                fieldType === 'custom_dropdown' ||
                fieldType === 'custom_radio' ||
                fieldType === 'dropdown' ||
                fieldType === 'radio' ||
                fieldType === 'select'
            );
            
            // Declare variables that will be used in checkModifiedState
            var selectedAmenities = fieldData.selectedAmenities;
            var optionsContainer = null;
            var nameInput, placeholderInput, tooltipInput, modifyButton;
            
            // Get default values from fieldset definition
            var defaultName = fieldsetDef ? (fieldsetDef.fieldset_name || fieldsetDef.name) : '';
            var defaultPlaceholder = fieldsetDef ? (fieldsetDef.fieldset_placeholder || '') : '';
            var defaultTooltip = fieldsetDef ? (fieldsetDef.fieldset_tooltip || '') : '';
            var defaultOptions = fieldsetDef && fieldsetDef.fieldset_fields ? [] : []; // Options are typically empty by default
            
            // Track modification state (must be defined before it's called)
            function checkModifiedState() {
                var nameValue = nameInput ? nameInput.value.trim() : '';
                var placeholderValue = placeholderInput ? placeholderInput.value.trim() : '';
                var tooltipValue = tooltipInput ? tooltipInput.value.trim() : '';
                
                var hasNameOverride = nameValue !== '' && nameValue !== defaultName;
                var hasPlaceholderOverride = placeholderValue !== '' && placeholderValue !== defaultPlaceholder;
                var hasTooltipOverride = tooltipValue !== '' && tooltipValue !== defaultTooltip;
                
                // Check if options differ from defaults (default is empty array)
                var hasOptions = false;
                if (needsOptions && optionsContainer) {
                    var currentOptions = Array.from(optionsContainer.querySelectorAll('.formbuilder-field-option-input'))
                        .map(function(inp) { return inp.value.trim(); })
                        .filter(function(val) { return val !== ''; });
                    hasOptions = currentOptions.length > 0; // Any options = modified (since default is empty)
                }
                
                // Check if amenities differ from defaults (default is empty array)
                var hasAmenities = needsAmenities && selectedAmenities && selectedAmenities.length > 0;
                
                var isModified = hasNameOverride || hasPlaceholderOverride || hasTooltipOverride || hasOptions || hasAmenities;
                
                if (modifyButton) {
                    if (isModified) {
                        modifyButton.classList.add('formbuilder-field-modify-button--modified');
                        fieldWrapper.classList.add('formbuilder-field-wrapper--modified');
                    } else {
                        modifyButton.classList.remove('formbuilder-field-modify-button--modified');
                        fieldWrapper.classList.remove('formbuilder-field-wrapper--modified');
                    }
                    syncFieldWrapperUi(fieldWrapper);
                }
                
                // Update Field Tracker
                if (window.AdminModule && typeof window.AdminModule.updateField === 'function' && typeof subKey !== 'undefined') {
                    var fieldId = 'formbuilder.' + subKey + '.' + fieldsetKey;
                    var nameValue = nameInput ? nameInput.value.trim() : '';
                    var placeholderValue = placeholderInput ? placeholderInput.value.trim() : '';
                    var tooltipValue = tooltipInput ? tooltipInput.value.trim() : '';
                    var currentState = {
                        name: hasNameOverride ? nameValue : '',
                        placeholder: hasPlaceholderOverride ? placeholderValue : '',
                        tooltip: hasTooltipOverride ? tooltipValue : '',
                        options: hasOptions && optionsContainer ? Array.from(optionsContainer.querySelectorAll('.formbuilder-field-option-input')).map(function(inp) { return inp.value.trim(); }).filter(function(v) { return v !== ''; }) : [],
                        selectedAmenities: hasAmenities ? selectedAmenities : []
                    };
                    window.AdminModule.updateField(fieldId, JSON.stringify(currentState));
                }
            }
            
            // Modify toggle button (placed before container so it stays visible)
            modifyButton = document.createElement('button');
            modifyButton.type = 'button';
            modifyButton.className = 'formbuilder-field-modify-button';
            modifyButton.textContent = 'Modify';
            modifyButton.addEventListener('click', function(e) {
                e.stopPropagation();
                var isOpen = modifyContainer.style.display !== 'none';
                modifyContainer.style.display = isOpen ? 'none' : 'block';
                modifyButton.classList.toggle('formbuilder-field-modify-button--open');
                notifyChange();
            });
            fieldEditPanel.appendChild(modifyButton);
            
            // Modify section (name, options, amenities, placeholder, tooltip - hidden by default)
            var modifyContainer = document.createElement('div');
            modifyContainer.className = 'formbuilder-field-modify-container';
            modifyContainer.style.display = 'none';
            
            // Name field (first)
            var nameLabel = document.createElement('label');
            nameLabel.className = 'formbuilder-field-label';
            nameLabel.textContent = 'Name';
            nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'formbuilder-field-input';
            if (defaultName) {
                nameInput.placeholder = defaultName;
            }
            // Only set value if it's different from default (meaning it was modified)
            var customName = fieldData.name || '';
            if (customName && customName !== defaultName) {
                nameInput.value = customName;
                nameInput.style.color = '#fff';
            } else {
                nameInput.value = '';
                nameInput.style.color = '#888';
            }
            nameInput.addEventListener('input', function() {
                if (nameInput.value && nameInput.value !== defaultName) {
                    nameInput.style.color = '#fff';
                } else {
                    nameInput.value = '';
                    nameInput.style.color = '#888';
                }
                var displayName = '';
                if (nameInput.value && nameInput.value.trim()) {
                    displayName = nameInput.value.trim();
                } else if (defaultName && typeof defaultName === 'string' && defaultName.trim()) {
                    displayName = defaultName.trim();
                } else {
                    displayName = 'Unnamed';
                }
                fieldNameSpan.textContent = displayName;
                checkModifiedState();
                notifyChange();
            });
            modifyContainer.appendChild(nameLabel);
            modifyContainer.appendChild(nameInput);
            
            // Options editor (after Name, for dropdown/radio)
            if (needsOptions) {
                var optionsLabel = document.createElement('label');
                optionsLabel.className = 'formbuilder-field-label';
                optionsLabel.textContent = 'Options';
                modifyContainer.appendChild(optionsLabel);
                
                optionsContainer = document.createElement('div');
                optionsContainer.className = 'formbuilder-field-options';
                
                function createOptionRow(value) {
                    var row = document.createElement('div');
                    row.className = 'formbuilder-field-option-row';
                    
                    var input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'formbuilder-field-option-input';
                    input.value = value || '';
                    input.placeholder = 'Option';
                    input.addEventListener('input', function() {
                        checkModifiedState();
                        notifyChange();
                    });
                    
                    var addBtn = document.createElement('div');
                    addBtn.className = 'formbuilder-field-option-add';
                    addBtn.innerHTML = getIcon('plus');
                    addBtn.onclick = function() {
                        var newRow = createOptionRow('');
                        row.parentNode.insertBefore(newRow, row.nextSibling);
                        checkModifiedState();
                        notifyChange();
                    };
                    
                    var removeBtn = document.createElement('div');
                    removeBtn.className = 'formbuilder-field-option-remove';
                    removeBtn.innerHTML = getIcon('minus');
                    removeBtn.onclick = function() {
                        if (optionsContainer.querySelectorAll('.formbuilder-field-option-row').length > 1) {
                            row.remove();
                            checkModifiedState();
                            notifyChange();
                        }
                    };
                    
                    row.appendChild(input);
                    row.appendChild(addBtn);
                    row.appendChild(removeBtn);
                    return row;
                }
                
                var existingOptions = fieldData.options || fieldData.checkoutOptions || [];
                if (Array.isArray(existingOptions) && existingOptions.length > 0) {
                    existingOptions.forEach(function(o) {
                        var val = typeof o === 'string' ? o : (o.label || o.name || o.value || '');
                        optionsContainer.appendChild(createOptionRow(val));
                    });
                } else {
                    optionsContainer.appendChild(createOptionRow(''));
                }
                
                modifyContainer.appendChild(optionsContainer);
            }
            
            // Amenities menu (after Options, or after Name if no options)
            if (needsAmenities) {
                var amenitiesLabel = document.createElement('label');
                amenitiesLabel.className = 'formbuilder-field-label';
                amenitiesLabel.textContent = 'Amenities';
                modifyContainer.appendChild(amenitiesLabel);
                
                if (!selectedAmenities) {
                    selectedAmenities = [];
                }
                
                if (window.AmenitiesMenuComponent) {
                    var amenitiesMenu = AmenitiesMenuComponent.buildMenu({
                        onSelect: function(amenities) {
                            fieldData.selectedAmenities = amenities;
                            selectedAmenities = amenities;
                            // Store in data attribute for capture
                            fieldWrapper.dataset.selectedAmenities = JSON.stringify(amenities);
                            checkModifiedState();
                            notifyChange();
                        },
                        selectedAmenities: selectedAmenities
                    });
                    // Store initial value in data attribute
                    if (selectedAmenities.length > 0) {
                        fieldWrapper.dataset.selectedAmenities = JSON.stringify(selectedAmenities);
                    }
                    modifyContainer.appendChild(amenitiesMenu.element);
                }
            }
            
            var placeholderLabel = document.createElement('label');
            placeholderLabel.className = 'formbuilder-field-label';
            placeholderLabel.textContent = 'Placeholder';
            placeholderInput = document.createElement('textarea');
            placeholderInput.className = 'formbuilder-field-textarea';
            placeholderInput.placeholder = defaultPlaceholder || 'Placeholder text';
            placeholderInput.rows = 3;
            // Only set value if it's different from default (meaning it was modified)
            var customPlaceholder = fieldData.placeholder || '';
            if (customPlaceholder && customPlaceholder !== defaultPlaceholder) {
                placeholderInput.value = customPlaceholder;
                placeholderInput.style.color = '#fff';
            } else {
                placeholderInput.value = '';
                placeholderInput.style.color = '#888';
            }
            placeholderInput.addEventListener('input', function() {
                if (placeholderInput.value && placeholderInput.value !== defaultPlaceholder) {
                    placeholderInput.style.color = '#fff';
                } else {
                    placeholderInput.value = '';
                    placeholderInput.style.color = '#888';
                }
                checkModifiedState();
                notifyChange();
            });
            modifyContainer.appendChild(placeholderLabel);
            modifyContainer.appendChild(placeholderInput);
            
            var tooltipLabel = document.createElement('label');
            tooltipLabel.className = 'formbuilder-field-label';
            tooltipLabel.textContent = 'Tooltip';
            tooltipInput = document.createElement('textarea');
            tooltipInput.className = 'formbuilder-field-textarea';
            tooltipInput.placeholder = defaultTooltip || 'Tooltip text';
            tooltipInput.rows = 3;
            // Only set value if it's different from default (meaning it was modified)
            var customTooltip = fieldData.tooltip || fieldData.fieldset_tooltip || '';
            if (customTooltip && customTooltip !== defaultTooltip) {
                tooltipInput.value = customTooltip;
                tooltipInput.style.color = '#fff';
            } else {
                tooltipInput.value = '';
                tooltipInput.style.color = '#888';
            }
            tooltipInput.addEventListener('input', function() {
                if (tooltipInput.value && tooltipInput.value !== defaultTooltip) {
                    tooltipInput.style.color = '#fff';
                } else {
                    tooltipInput.value = '';
                    tooltipInput.style.color = '#888';
                }
                checkModifiedState();
                notifyChange();
            });
            modifyContainer.appendChild(tooltipLabel);
            modifyContainer.appendChild(tooltipInput);
            
            fieldEditPanel.appendChild(modifyContainer);
            
            // Register with Field Tracker
            if (window.AdminModule && typeof window.AdminModule.registerField === 'function' && typeof subKey !== 'undefined') {
                var fieldId = 'formbuilder.' + subKey + '.' + fieldsetKey;
                var originalState = {
                    name: fieldData.name || defaultName || '',
                    placeholder: fieldData.placeholder || defaultPlaceholder || '',
                    tooltip: fieldData.tooltip || fieldData.fieldset_tooltip || defaultTooltip || '',
                    options: fieldData.options || [],
                    selectedAmenities: fieldData.selectedAmenities || []
                };
                window.AdminModule.registerField(fieldId, JSON.stringify(originalState));
            }
            
            // Check initial modified state
            checkModifiedState();
            
            fieldWrapper.appendChild(field);
            fieldWrapper.appendChild(fieldEditPanel);
            // Important: sync AFTER the button elements have been appended, otherwise
            // syncFieldWrapperUi() can't find/toggle the indicator elements on initial render.
            syncFieldWrapperUi(fieldWrapper);
            
            field.addEventListener('click', function(ev) {
                ev.stopPropagation();
                runWithScrollAnchor(field, function() {
                container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
                    if (el !== fieldWrapper) {
                        el.classList.remove('formbuilder-field-wrapper--editing');
                        syncFieldWrapperUi(el);
                    }
                    });
                });
            });
            
            fieldEdit.addEventListener('click', function(ev) {
                ev.stopPropagation();
                runWithScrollAnchor(field, function() {
                var isOpen = fieldWrapper.classList.contains('formbuilder-field-wrapper--editing');
                container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
                    el.classList.remove('formbuilder-field-wrapper--editing');
                    syncFieldWrapperUi(el);
                });
                if (!isOpen) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--editing');
                }
                syncFieldWrapperUi(fieldWrapper);
                });
            });
            
            // Field drag and drop - only via drag handle
            fieldWrapper.draggable = false;
            var fieldDragStartIndex = -1;
            fieldDrag.addEventListener('mousedown', function(ev) {
                ev.stopPropagation();
                fieldWrapper.draggable = true;
            });
            document.addEventListener('mouseup', function() {
                fieldWrapper.draggable = false;
            });
            fieldWrapper.addEventListener('dragstart', function(ev) {
                if (!fieldWrapper.draggable) {
                    ev.preventDefault();
                    return;
                }
                // Remember starting position
                var siblings = Array.from(fieldsContainer.querySelectorAll('.formbuilder-field-wrapper'));
                fieldDragStartIndex = siblings.indexOf(fieldWrapper);
                ev.stopPropagation();
                ev.dataTransfer.effectAllowed = 'move';
                fieldWrapper.classList.add('dragging');
            });
            fieldWrapper.addEventListener('dragend', function() {
                fieldWrapper.classList.remove('dragging');
                fieldWrapper.draggable = false;
                // Only notify if position actually changed
                var siblings = Array.from(fieldsContainer.querySelectorAll('.formbuilder-field-wrapper'));
                var currentIndex = siblings.indexOf(fieldWrapper);
                if (currentIndex !== fieldDragStartIndex) {
                    // Update divider and location repeat switches after drag-sort
                    updateLocationDividerAndRepeatSwitches();
                    notifyChange();
                }
                fieldDragStartIndex = -1;
            });
            fieldWrapper.addEventListener('dragover', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                var dragging = fieldsContainer.querySelector('.formbuilder-field-wrapper.dragging');
                if (dragging && dragging !== fieldWrapper) {
                    var rect = fieldWrapper.getBoundingClientRect();
                    var midY = rect.top + rect.height / 2;
                    if (ev.clientY < midY) {
                        fieldWrapper.parentNode.insertBefore(dragging, fieldWrapper);
                    } else {
                        fieldWrapper.parentNode.insertBefore(dragging, fieldWrapper.nextSibling);
                    }
                }
            });
            
            return { wrapper: fieldWrapper, fsId: fsId };
        }
        
        // Populate fieldset options - NO FALLBACKS
        // All fieldsets appear in menu, but location fieldsets are dictated by Location Type and auto-added/maintained by the system.
        var selectedLocationType = subFeeData.location_type;
        var currentSubcategoryType = subFeeData.subcategory_type;
        fieldsets.forEach(function(fs) {
            var fsId = '';
            if (fs.id && typeof fs.id === 'string') {
                fsId = fs.id;
            } else if (fs.key && typeof fs.key === 'string') {
                fsId = fs.key;
            } else if (fs.name && typeof fs.name === 'string') {
                fsId = fs.name;
            }
            var fieldsetKey = '';
            if (fs.key && typeof fs.key === 'string') {
                fieldsetKey = fs.key;
            } else if (fs.fieldset_key && typeof fs.fieldset_key === 'string') {
                fieldsetKey = fs.fieldset_key;
            } else if (fs.id && typeof fs.id === 'string') {
                fieldsetKey = fs.id;
            }
            // Normalize to lowercase for comparison
            var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
            var isVenue = fieldsetKeyLower === 'venue';
            var isCity = fieldsetKeyLower === 'city';
            var isAddress = fieldsetKeyLower === 'address' || fieldsetKeyLower === 'location';

            // Do not show location fieldsets in the menu at all.
            // Location fieldset is dictated by Location Type and auto-added/maintained by the system.
            if (isVenue || isCity || isAddress) {
                return;
            }
            
            var opt = document.createElement('div');
            opt.className = 'formbuilder-fieldset-menu-option';
            var displayName = '';
            if (fs.name && typeof fs.name === 'string' && fs.name.trim()) {
                displayName = fs.name.trim();
            } else if (fs.key && typeof fs.key === 'string' && fs.key.trim()) {
                displayName = fs.key.trim();
            } else {
                displayName = 'Unnamed';
            }
            opt.textContent = displayName;
            opt.setAttribute('data-fieldset-id', fsId);
            
            opt.onclick = function(e) {
                e.stopPropagation();
                // Check for "already added" disabled
                if (opt.classList.contains('formbuilder-fieldset-menu-option--disabled')) return;
                
                var result = createFieldElement(fs, true, fs);
                fieldsContainer.appendChild(result.wrapper);
                addedFieldsets[result.fsId] = true;
                opt.classList.add('formbuilder-fieldset-menu-option--disabled');
                setFieldsetMenuOpen(false);
                // Update divider and location repeat switches after adding fieldset
                setTimeout(function() {
                    updateLocationDividerAndRepeatSwitches();
                }, 0);
                notifyChange();
            };
            fieldsetOpts.appendChild(opt);
        });
        
        // Apply initial location type filtering (gray-out state) now that fieldsetOpts exists
        if (initialLocationType) {
            updateLocationTypeFieldsets(initialLocationType);
        } else {
            // No location type selected - keep button visible but force location type selection first
            updateLocationTypeFieldsets(null);
        }
        
        // Load existing fields from database FIRST
        var subFieldsMap = cat.subFields || {};
        var existingFields = subFieldsMap[subName] || [];
        existingFields.forEach(function(fieldData) {
            var isRequired = fieldData.required === true || fieldData.required === 1 || fieldData.required === '1';
            var fieldsetKey = '';
            if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                fieldsetKey = fieldData.fieldsetKey;
            } else if (fieldData.key && typeof fieldData.key === 'string') {
                fieldsetKey = fieldData.key;
            } else if (fieldData.id && typeof fieldData.id === 'string') {
                fieldsetKey = fieldData.id;
            }
            var matchingFieldset = fieldsets.find(function(fs) {
                return fs.id === fieldsetKey || fs.key === fieldsetKey || fs.fieldset_key === fieldsetKey;
            });
            var result = createFieldElement(fieldData, isRequired, matchingFieldset);
            fieldsContainer.appendChild(result.wrapper);
            addedFieldsets[result.fsId] = true;
            var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + result.fsId + '"]');
            if (menuOpt) menuOpt.classList.add('formbuilder-fieldset-menu-option--disabled');
        });
        
        // AFTER loading existing fields, manage location type fieldset (will only add if missing)
        if (initialLocationType) {
            manageLocationTypeFieldsets(initialLocationType);
            // Update divider and location repeat switches for existing subcategories with location type
            setTimeout(function() {
                updateLocationDividerAndRepeatSwitches();
            }, 0);
        }
        
        function setFieldsetMenuOpen(isOpen) {
            if (!fieldsetMenu) return;
            fieldsetMenu.classList.toggle('formbuilder-fieldset-menu--open', !!isOpen);
            if (fieldsetBtn) fieldsetBtn.classList.toggle('formbuilder-fieldset-menu-button--open', !!isOpen);
            if (fieldsetOpts) fieldsetOpts.classList.toggle('formbuilder-fieldset-menu-options--open', !!isOpen);
        }
        
        fieldsetBtn.onclick = function(e) {
            e.stopPropagation();
            // If location type isn't set yet, clicking this button should open the subcategory edit panel
            // so the admin can pick a location type (Venue/City/Address).
            var currentLocationType = (cat.subFees && cat.subFees[subName]) ? cat.subFees[subName].location_type : null;
            if (!currentLocationType) {
                setFieldsetMenuOpen(false);
                if (fieldsetBtn) fieldsetBtn.textContent = 'Select Location Type';
                runWithScrollAnchor(fieldsetBtn, function() {
                    option.classList.add('formbuilder-accordion-option--editing');
                    syncSubcategoryOptionUi(option);
                });
                return;
            }

            // Normal behavior: open fieldset menu
            if (fieldsetBtn) fieldsetBtn.textContent = '+ Add Fieldset';
            var wasOpen = fieldsetMenu.classList.contains('formbuilder-fieldset-menu--open');
            closeAllMenus();
            if (!wasOpen) {
                setFieldsetMenuOpen(true);
            }
        };
        
        optBody.appendChild(fieldsetMenu);
        
        var formPreviewBtn = document.createElement('div');
        formPreviewBtn.className = 'formbuilder-form-preview';
        formPreviewBtn.textContent = 'Form Preview';
        formPreviewBtn.onclick = function(e) {
            e.stopPropagation();
            showFormPreview(cat, subName);
        };
        optBody.appendChild(formPreviewBtn);
        
        option.appendChild(optHeader);
        option.appendChild(subEditPanel);
        option.appendChild(optBody);
        
        // Sub edit area click
        optEditArea.addEventListener('click', function(e) {
            e.stopPropagation();
            runWithScrollAnchor(optHeader, function() {
            var isOpen = option.classList.contains('formbuilder-accordion-option--editing');
            closeAllSubcategoryEditPanels();
            if (!isOpen) {
                option.classList.add('formbuilder-accordion-option--editing');
            }
            syncSubcategoryOptionUi(option);
            });
        });
        
        // Prevent edit panel from blocking clicks on interactive elements
        subEditPanel.addEventListener('click', function(e) {
            // Allow clicks on inputs, labels, buttons, and other interactive elements
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL' || e.target.tagName === 'BUTTON' || e.target.closest('label') || e.target.closest('input')) {
                return; // Don't stop propagation for interactive elements
            }
        });
        
        // Sub header click (except edit area)
        optHeader.addEventListener('click', function(e) {
            if (e.target.closest('.formbuilder-accordion-option-editarea')) return;
            runWithScrollAnchor(optHeader, function() {
            if (!option.classList.contains('formbuilder-accordion-option--editing')) {
                closeAllSubcategoryEditPanels();
            }
            option.classList.toggle('formbuilder-accordion-option--open');
            syncSubcategoryOptionUi(option);
            });
        });
        
        syncSubcategoryOptionUi(option);
        return option;
    }
    
    var isInitialized = false;
    
    function init() {
        if (isInitialized) return;
        
        container = document.getElementById('admin-formbuilder');
        if (!container) return;
        
        // Ensure gap exists early and bind scroll handler (kept lightweight; only runs for admin panel scroll events)
        ensureScrollGap();
        ensureScrollGapBottom();
        var sc = findScrollContainer();
        if (sc) {
            sc.addEventListener('scroll', maybeConsumeGapOnScroll, { passive: true });
        }
        
        bindDocumentListeners();
        loadFormData();
        isInitialized = true;
    }
    
    // Listen for admin panel open - only load data when panel actually opens
    if (window.App && App.on) {
        App.on('admin:opened', function() {
            if (!isInitialized) {
                init();
            }
        });
    }
    
    // Also support direct init call from admin module
    document.addEventListener('formbuilder:init', function() {
        if (!isInitialized) {
            init();
        }
    });
    
    /* --------------------------------------------------------------------------
       DISCARD CHANGES - Fetch fresh from database
       -------------------------------------------------------------------------- */
    
    function discardChanges() {
        isLoaded = false; // Prevent notifyChange during reload
        loadFormData(); // Fetch fresh from database - single source of truth
    }
    
    /* --------------------------------------------------------------------------
       CHECKOUT CALCULATOR MODAL
       Shows checkout options in a popup similar to form preview
       -------------------------------------------------------------------------- */
    
    function showCheckoutCalculator(cat, subName) {
        // Get subcategory data
        var subFees = cat.subFees || {};
        var subFeeData = subFees[subName] || {};
        var currentSurcharge = parseFloat(subFeeData.checkout_surcharge) || 0;
        
        // Get active checkout options (respect hidden/admin_only from get-admin-settings.php)
        var activeCheckoutOptions = checkoutOptions.filter(function(opt) {
            if (!opt) {
                throw new Error('[Formbuilder] Invalid checkout option entry (null/undefined) in get-admin-settings response.');
            }
            if (opt.hidden === true || opt.hidden === 1 || opt.hidden === '1') return false;
            if (opt.admin_only === true || opt.admin_only === 1 || opt.admin_only === '1') return false;
            return true;
        });
        
        // Create modal backdrop
        var modal = document.createElement('div');
        modal.className = 'formbuilder-formpreview-modal';
        
        // Create modal container
        var modalContainer = document.createElement('div');
        modalContainer.className = 'formbuilder-formpreview-modal-container';
        
        // Create header
        var header = document.createElement('div');
        header.className = 'formbuilder-formpreview-modal-header';
        
        var headerTitle = document.createElement('span');
        headerTitle.className = 'formbuilder-formpreview-modal-title';
        headerTitle.textContent = 'Checkout Calculator';
        
        var closeBtn = ClearButtonComponent.create({
            className: 'formbuilder-formpreview-modal-close',
            ariaLabel: 'Close calculator',
            onClick: function() {
                closeModal();
            }
        });
        
        header.appendChild(headerTitle);
        header.appendChild(closeBtn);
        
        // Create body
        var body = document.createElement('div');
        body.className = 'formbuilder-formpreview-modal-body';
        
        // Add surcharge input at top of body
        var surchargeSection = document.createElement('div');
        surchargeSection.className = 'formbuilder-calculator-surcharge';
        
        var surchargeLabel = document.createElement('span');
        surchargeLabel.className = 'formbuilder-fee-row-label';
        surchargeLabel.textContent = 'Checkout Surcharge';
        
        var surchargePercent = document.createElement('span');
        surchargePercent.className = 'formbuilder-fee-percent';
        surchargePercent.textContent = '%';
        
        var popupSurchargeInput = document.createElement('input');
        popupSurchargeInput.type = 'number';
        popupSurchargeInput.step = '0.01';
        popupSurchargeInput.min = '-100';
        popupSurchargeInput.className = 'formbuilder-fee-input';
        popupSurchargeInput.placeholder = 'N/A';
        
        if (subFeeData.checkout_surcharge !== null && subFeeData.checkout_surcharge !== undefined) {
            popupSurchargeInput.value = parseFloat(subFeeData.checkout_surcharge).toFixed(2);
        }
        
        // Store reference to update function
        var updatePrices = function() {
            // Re-render all checkout cards with new surcharge
            checkoutList.innerHTML = '';
            renderCheckoutCards();
        };
        
        // Only allow numbers and minus sign
        popupSurchargeInput.addEventListener('keypress', function(e) {
            var char = String.fromCharCode(e.which);
            // Allow: numbers, minus sign (only at start), decimal point
            if (!/[0-9]/.test(char) && char !== '-' && char !== '.') {
                e.preventDefault();
                return false;
            }
            // Only allow minus at the start
            if (char === '-' && (this.selectionStart !== 0 || this.value.indexOf('-') !== -1)) {
                e.preventDefault();
                return false;
            }
            // Only allow one decimal point
            if (char === '.' && this.value.indexOf('.') !== -1) {
                e.preventDefault();
                return false;
            }
        });
        
        popupSurchargeInput.addEventListener('input', function() {
            // Filter out any non-numeric characters except minus and decimal
            var value = this.value;
            // Remove any characters that aren't numbers, minus, or decimal
            value = value.replace(/[^0-9.\-]/g, '');
            // Ensure minus is only at the start
            if (value.indexOf('-') > 0) {
                value = value.replace(/-/g, '');
            }
            // Ensure only one decimal point
            var parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            this.value = value;
            
            var numValue = value ? parseFloat(value) : null;
            if (numValue !== null && numValue < -100) {
                numValue = -100;
                this.value = numValue.toFixed(2);
            }
            if (!cat.subFees) cat.subFees = {};
            if (!cat.subFees[subName]) cat.subFees[subName] = {};
            cat.subFees[subName].checkout_surcharge = numValue !== null ? Math.round(numValue * 100) / 100 : null;
            currentSurcharge = numValue !== null ? numValue : 0;
            
            // Update the surcharge input in the edit panel if it exists
            var editPanelInput = document.querySelector('.formbuilder-accordion-option--editing .formbuilder-fee-input');
            if (editPanelInput) {
                editPanelInput.value = numValue !== null ? numValue.toFixed(2) : '';
            }
            
            // Recalculate and update prices
            updatePrices();
            notifyChange();
        });
        
        popupSurchargeInput.addEventListener('blur', function() {
            var value = this.value ? parseFloat(this.value) : null;
            if (value !== null && value < -100) {
                value = -100;
            }
            if (value !== null) {
                this.value = value.toFixed(2);
            }
        });
        
        surchargeSection.appendChild(surchargeLabel);
        surchargeSection.appendChild(surchargePercent);
        surchargeSection.appendChild(popupSurchargeInput);
        body.appendChild(surchargeSection);
        
        // Create checkout list container
        var checkoutList = document.createElement('div');
        checkoutList.className = 'formbuilder-checkout-list';
        
        // Function to render checkout cards
        function renderCheckoutCards() {
        
        // Render checkout options
        if (activeCheckoutOptions.length === 0) {
            throw new Error('[Formbuilder] No enabled checkout options available');
        } else {
            if (!siteCurrency || typeof siteCurrency !== 'string' || !siteCurrency.trim()) {
                throw new Error('[Formbuilder] Missing required settings.website_currency (siteCurrency)');
            }
            var currency = siteCurrency.trim().toUpperCase();
            
            activeCheckoutOptions.forEach(function(opt) {
                if (!opt) {
                    throw new Error('[Formbuilder] checkoutOptions contains null/undefined option');
                }
                if (opt.id === undefined || opt.id === null || String(opt.id).trim() === '') {
                    throw new Error('[Formbuilder] checkout option id is required');
                }
                if (!opt.checkout_title || String(opt.checkout_title).trim() === '') {
                    throw new Error('[Formbuilder] checkout_title is required for option id ' + String(opt.id));
                }
                var card = document.createElement('div');
                card.className = 'formbuilder-checkout-card';
                
                var flagfall = parseFloat(opt.checkout_flagfall_price) || 0;
                var basicDayRate = opt.checkout_basic_day_rate !== null && opt.checkout_basic_day_rate !== undefined 
                    ? parseFloat(opt.checkout_basic_day_rate) : null;
                var discountDayRate = opt.checkout_discount_day_rate !== null && opt.checkout_discount_day_rate !== undefined 
                    ? parseFloat(opt.checkout_discount_day_rate) : null;
                if (basicDayRate === null || !isFinite(basicDayRate)) {
                    throw new Error('[Formbuilder] checkout_basic_day_rate is required for option id ' + String(opt.id));
                }
                if (discountDayRate === null || !isFinite(discountDayRate)) {
                    throw new Error('[Formbuilder] checkout_discount_day_rate is required for option id ' + String(opt.id));
                }
                
                    function calculatePrice(days) {
                        var basePrice = flagfall;
                        if (days >= 365) basePrice += discountDayRate * days;
                        else basePrice += basicDayRate * days;
                        if (currentSurcharge !== 0 && !isNaN(currentSurcharge)) {
                            basePrice = basePrice * (1 + currentSurcharge / 100);
                        }
                        return basePrice;
                    }
                
                var price30 = calculatePrice(30);
                var price365 = calculatePrice(365);
                
                var title = document.createElement('div');
                title.className = 'formbuilder-checkout-title';
                title.textContent = String(opt.checkout_title).trim();
                
                var prices = document.createElement('div');
                prices.className = 'formbuilder-checkout-prices';
                prices.innerHTML = '<div class="formbuilder-checkout-price-item"><span>30 days: </span><span class="formbuilder-checkout-price-value">' + currency + ' ' + price30.toFixed(2) + '</span></div>' +
                    '<div class="formbuilder-checkout-price-item"><span>365 days: </span><span class="formbuilder-checkout-price-value">' + currency + ' ' + price365.toFixed(2) + '</span></div>';
                
                var calculator = document.createElement('div');
                calculator.className = 'formbuilder-checkout-calculator';
                
                var calcLabel = document.createElement('span');
                calcLabel.textContent = 'Calculator:';
                
                var calcInput = document.createElement('input');
                calcInput.type = 'number';
                calcInput.className = 'formbuilder-checkout-calc-input';
                calcInput.placeholder = 'Days';
                calcInput.min = '1';
                calcInput.step = '1';
                
                var calcTotal = document.createElement('span');
                calcTotal.className = 'formbuilder-checkout-calc-total';
                calcTotal.textContent = currency + ' 0.00';
                
                calcInput.addEventListener('input', function() {
                    var days = parseFloat(calcInput.value) || 0;
                    if (days <= 0) {
                        calcTotal.textContent = currency + ' 0.00';
                        return;
                    }
                    var total = calculatePrice(days);
                    calcTotal.textContent = currency + ' ' + total.toFixed(2);
                });
                
                calculator.appendChild(calcLabel);
                calculator.appendChild(calcInput);
                calculator.appendChild(calcTotal);
                
                    card.appendChild(title);
                    card.appendChild(prices);
                    card.appendChild(calculator);
                    checkoutList.appendChild(card);
                });
            }
        }
        
        // Initial render
        renderCheckoutCards();
        
        body.appendChild(checkoutList);
        
        modalContainer.appendChild(header);
        modalContainer.appendChild(body);
        modal.appendChild(modalContainer);
        
        // Add to admin panel content
        var adminPanelContent = document.querySelector('.admin-panel-content');
        if (adminPanelContent) {
            adminPanelContent.appendChild(modal);
        } else if (container) {
            container.appendChild(modal);
        } else {
            document.body.appendChild(modal);
        }
        
        function closeModal() {
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }
        
        // Close on backdrop click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        var escapeHandler = function(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    /* --------------------------------------------------------------------------
       FORM PREVIEW MODAL
       Shows the form as it would appear to members
       -------------------------------------------------------------------------- */
    
    function showFormPreview(cat, subName) {
        // Get subcategory data
        var subFees = cat.subFees || {};
        var subFeeData = subFees[subName] || {};
        var subcategoryType = subFeeData.subcategory_type || 'General';
        var isEvent = subcategoryType === 'Events';
        var surcharge = parseFloat(subFeeData.checkout_surcharge) || 0;
        
        // Get fields for this subcategory
        var subFieldsMap = cat.subFields || {};
        var fields = subFieldsMap[subName] || [];
        
        // Get active checkout options (respect hidden/admin_only from get-admin-settings.php)
        var activeCheckoutOptions = checkoutOptions.filter(function(opt) {
            if (!opt) {
                throw new Error('[Formbuilder] Invalid checkout option entry (null/undefined) in get-admin-settings response.');
            }
            if (opt.hidden === true || opt.hidden === 1 || opt.hidden === '1') return false;
            if (opt.admin_only === true || opt.admin_only === 1 || opt.admin_only === '1') return false;
            return true;
        });
        
        // Create modal backdrop
        var modal = document.createElement('div');
        modal.className = 'formbuilder-formpreview-modal';
        
        // Create modal container
        var modalContainer = document.createElement('div');
        modalContainer.className = 'formbuilder-formpreview-modal-container';
        
        // Create header
        var header = document.createElement('div');
        header.className = 'formbuilder-formpreview-modal-header';
        
        var headerTitle = document.createElement('span');
        headerTitle.className = 'formbuilder-formpreview-modal-title';
        var previewTitle = '';
        if (subName && typeof subName === 'string' && subName.trim()) {
            previewTitle = subName.trim();
        } else {
            previewTitle = 'Form Preview';
        }
        headerTitle.textContent = previewTitle;
        
        var closeBtn = ClearButtonComponent.create({
            className: 'formbuilder-formpreview-modal-close',
            ariaLabel: 'Close preview',
            onClick: function() {
                closeModal();
            }
        });
        
        header.appendChild(headerTitle);
        header.appendChild(closeBtn);
        
        // Create body
        var body = document.createElement('div');
        body.className = 'formbuilder-formpreview-modal-body';
        
        // Render fields using shared location container infrastructure
        if (fields.length === 0) {
            var emptyMsg = document.createElement('p');
            emptyMsg.className = 'formbuilder-formpreview-empty';
            emptyMsg.textContent = 'No fields configured for this subcategory.';
            body.appendChild(emptyMsg);
        } else {
            var locationData = organizeFieldsIntoLocationContainers({
                fields: fields,
                container: body,
                buildFieldset: function(fieldData, options) {
                    var fieldset = FieldsetBuilder.buildFieldset(fieldData, options);
                    if (fieldset && fieldset.classList) {
                        fieldset.classList.add('fieldset--formbuilder-preview');
                    }
                    return fieldset;
                },
                initialQuantity: 1,
                onQuantityChange: function(quantity, isIncrease) {
                    // Preview doesn't need to handle quantity changes
                },
                getMessage: function(key, params, fallback) {
                    if (typeof window.getMessage === 'function') {
                        return window.getMessage(key, params, fallback);
                    }
                    return Promise.resolve(null);
                },
                idPrefix: 'formpreview'
            });
        }
        
        // Render checkout options using CheckoutOptionsComponent
        if (activeCheckoutOptions.length > 0) {
            var checkoutWrapper = document.createElement('div');
            checkoutWrapper.className = 'formbuilder-formpreview-checkout';
            
            var checkoutLabel = document.createElement('div');
            checkoutLabel.className = 'fieldset-label';
            checkoutLabel.innerHTML = '<span class="fieldset-label-text">Checkout Options</span><span class="fieldset-label-required">*</span>';
            checkoutWrapper.appendChild(checkoutLabel);
            
            CheckoutOptionsComponent.create(checkoutWrapper, {
                checkoutOptions: activeCheckoutOptions,
                currency: (function(){
                    if (!siteCurrency || typeof siteCurrency !== 'string' || !siteCurrency.trim()) {
                        throw new Error('[Formbuilder] Missing required settings.website_currency (siteCurrency)');
                    }
                    return siteCurrency.trim().toUpperCase();
                })(),
                surchargePercent: surcharge,
                isEvent: isEvent,
                locationCount: 1,
                eventVenueDays: isEvent ? null : null,
                baseId: 'formpreview',
                groupName: 'formpreview-checkout'
            });
            
            body.appendChild(checkoutWrapper);
        }
        
        // Assemble modal
        modalContainer.appendChild(header);
        modalContainer.appendChild(body);
        modal.appendChild(modalContainer);
        
        // Close on backdrop click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        function handleEscape(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        }
        document.addEventListener('keydown', handleEscape);
        
        function closeModal() {
            document.removeEventListener('keydown', handleEscape);
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }
        
        // Add to admin panel content
        var adminPanelContent = document.querySelector('.admin-panel-content');
        if (adminPanelContent) {
            adminPanelContent.appendChild(modal);
        }
    }
    
    /* ============================================================================
       FORM LOCATION MANAGER
       ============================================================================
       Centralized location container infrastructure for form building.
       This is the single source of truth for location-related UI components,
       used by both admin form preview and member-facing forms.
       
       Functions:
       - createLocationQuantityPicker: Creates the "Number of locations" selector
       - createLocationContainerHeader: Creates location container headers with collapse/expand and delete
       - organizeFieldsIntoLocationContainers: Main function that organizes fieldsets into location containers
       ============================================================================ */
    
    /**
     * Creates location quantity picker (Number of locations selector)
     * @param {Object} options - Configuration options
     * @param {number} options.initialQuantity - Starting quantity (default: 1)
     * @param {Function} options.onQuantityChange - Callback when quantity changes (quantity, isIncrease)
     * @param {Function} options.getMessage - Function to get message text (optional)
     * @returns {Object} - { quantityRow, quantityDisplay, explainerMsg }
     */
    function createLocationQuantityPicker(options) {
        options = options || {};
        var initialQuantity = options.initialQuantity || 1;
        var onQuantityChange = options.onQuantityChange || function() {};
        var getMessage = options.getMessage || null;
        
        // Create quantity selector row
        var quantityRow = document.createElement('div');
        quantityRow.className = 'formbuilder-location-quantity-row';
        
        var quantityLabel = document.createElement('span');
        quantityLabel.className = 'formbuilder-location-quantity-label';
        quantityLabel.textContent = 'Number of locations:';
        
        var quantityControls = document.createElement('div');
        quantityControls.className = 'formbuilder-location-quantity-controls';
        
        var minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'formbuilder-location-quantity-btn formbuilder-location-quantity-btn--minus';
        minusBtn.innerHTML = '−';
        minusBtn.setAttribute('aria-label', 'Decrease location quantity');
        
        var quantityDisplay = document.createElement('span');
        quantityDisplay.className = 'formbuilder-location-quantity-display';
        quantityDisplay.textContent = initialQuantity;
        
        var plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'formbuilder-location-quantity-btn formbuilder-location-quantity-btn--plus';
        plusBtn.innerHTML = '+';
        plusBtn.setAttribute('aria-label', 'Increase location quantity');
        
        quantityControls.appendChild(quantityDisplay);
        quantityControls.appendChild(minusBtn);
        quantityControls.appendChild(plusBtn);
        
        quantityRow.appendChild(quantityLabel);
        quantityRow.appendChild(quantityControls);
        
        // Quantity button handlers
        minusBtn.addEventListener('click', function() {
            var currentQty = parseInt(quantityDisplay.textContent, 10);
            if (isNaN(currentQty) || currentQty < 1) currentQty = 1;
            if (currentQty > 1) {
                currentQty--;
                quantityDisplay.textContent = currentQty;
                onQuantityChange(currentQty, false);
            }
        });
        
        plusBtn.addEventListener('click', function() {
            var currentQty = parseInt(quantityDisplay.textContent, 10);
            if (isNaN(currentQty) || currentQty < 1) currentQty = 1;
            currentQty++;
            quantityDisplay.textContent = currentQty;
            onQuantityChange(currentQty, true);
        });
        
        // Explanatory message
        var explainerMsg = document.createElement('p');
        explainerMsg.className = 'formbuilder-location-explainer';
        
        if (getMessage && typeof getMessage === 'function') {
            getMessage('msg_post_location_explainer', {}, false).then(function(msg) {
                if (msg) {
                    explainerMsg.innerHTML = msg.replace(/\n/g, '<br>');
                }
            });
        }
        
        return {
            quantityRow: quantityRow,
            quantityLabel: quantityLabel,
            quantityDisplay: quantityDisplay,
            explainerMsg: explainerMsg
        };
    }
    
    /**
     * Creates a location container header with text, arrow, and delete button
     * @param {Object} options - Configuration options
     * @param {string} options.locationName - Display name (e.g., "Venue 1", "City 2")
     * @param {number} options.locationNumber - Location number (1, 2, 3, etc.)
     * @param {boolean} options.showDelete - Whether to show delete button
     * @param {Function} options.onDelete - Callback when delete is clicked
     * @param {Function} options.onHeaderClick - Callback when header is clicked (for collapse/expand)
     * @param {Function} options.onActivate - Callback when container is activated
     * @returns {Object} - { container, header, headerText, arrow, deleteBtn, content }
     */
    function createLocationContainerHeader(options) {
        options = options || {};
        var locationName = options.locationName || 'Location 1';
        var locationNumber = options.locationNumber || 1;
        var showDelete = options.showDelete !== false;
        var onDelete = options.onDelete || function() {};
        var onHeaderClick = options.onHeaderClick || function() {};
        var onActivate = options.onActivate || function() {};
        
        // Create container
        var container = document.createElement('div');
        container.className = 'formbuilder-location-container';
        container.dataset.venue = String(locationNumber);
        container.dataset.locationNumber = String(locationNumber);
        
        // Create header
        var header = document.createElement('div');
        header.className = 'formbuilder-location-header';
        
        // Header text
        var headerText = document.createElement('span');
        headerText.className = 'formbuilder-location-header-text';
        headerText.textContent = locationName;
        
        // Arrow
        var arrow = document.createElement('span');
        arrow.className = 'formbuilder-location-header-arrow';
        arrow.textContent = '▼';
        
        // Delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'formbuilder-location-header-button-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.setAttribute('aria-label', 'Delete ' + locationName);
        if (!showDelete) {
            deleteBtn.style.display = 'none';
        }
        
        // Delete button handler
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            onDelete(container, locationNumber);
        });
        
        // Header click handler (collapse/expand, activate)
        header.addEventListener('click', function(e) {
            if (e.target === deleteBtn || deleteBtn.contains(e.target)) return;
            onHeaderClick(container, locationNumber);
            onActivate(container, locationNumber);
        });
        
        // Assemble header
        header.appendChild(headerText);
        header.appendChild(arrow);
        header.appendChild(deleteBtn);
        container.appendChild(header);
        
        // Create content wrapper
        var content = document.createElement('div');
        content.className = 'formbuilder-location-content';
        container.appendChild(content);
        
        return {
            container: container,
            header: header,
            headerText: headerText,
            arrow: arrow,
            deleteBtn: deleteBtn,
            content: content
        };
    }
    
    /**
     * Organizes fieldsets into location containers with quantity picker
     * This is the central source of truth for location container infrastructure
     * @param {Object} options - Configuration options
     * @param {Array} options.fields - Array of field data objects
     * @param {HTMLElement} options.container - Container element to render into
     * @param {Function} options.buildFieldset - Function to build a fieldset element (FieldsetBuilder.buildFieldset)
     * @param {number} options.initialQuantity - Starting location quantity (default: 1)
     * @param {Function} options.onQuantityChange - Callback when quantity changes (optional)
     * @param {Function} options.getMessage - Function to get messages (optional)
     * @param {string} options.idPrefix - Prefix for field IDs (e.g., 'formpreview', 'memberCreate')
     * @param {Function} options.onDelete - Custom delete callback for Venue 1 (optional)
     * @param {Function} options.onHeaderClick - Custom header click callback for Venue 1 (optional)
     * @param {Function} options.onActivate - Custom activate callback for Venue 1 (optional)
     * @param {boolean} options.setupHeaderRenaming - Whether to set up automatic header renaming from venue input (default: false)
     * @returns {Object} - { quantityPicker, locationContainers, locationFieldsetType }
     */
    function organizeFieldsIntoLocationContainers(options) {
        options = options || {};
        var fields = options.fields || [];
        var container = options.container;
        var buildFieldset = options.buildFieldset;
        var initialQuantity = options.initialQuantity || 1;
        var onQuantityChange = options.onQuantityChange || function() {};
        var getMessage = options.getMessage || null;
        var customOnDelete = options.onDelete || null;
        var customOnHeaderClick = options.onHeaderClick || null;
        var customOnActivate = options.onActivate || null;
        var setupHeaderRenaming = options.setupHeaderRenaming === true;
        var idPrefix = '';
        if (options && options.idPrefix && typeof options.idPrefix === 'string') {
            idPrefix = options.idPrefix;
        } else {
            idPrefix = 'form';
        }
        
        if (!container || !buildFieldset) {
            console.error('[FormBuilder] organizeFieldsIntoLocationContainers: container and buildFieldset are required');
            return null;
        }
        
        // Identify location fieldset and repeat fieldsets
        var locationFieldset = null;
        var locationFieldsetType = null;
        var mustRepeatFieldsets = [];
        var locationRepeatOnlyFieldsets = [];
        
        // Parse repeat flags from field data
        fields.forEach(function(fieldData, index) {
            var fieldsetKey = '';
            if (fieldData.fieldset_key && typeof fieldData.fieldset_key === 'string') {
                fieldsetKey = fieldData.fieldset_key.toLowerCase();
            } else if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                fieldsetKey = fieldData.fieldsetKey.toLowerCase();
            } else if (fieldData.key && typeof fieldData.key === 'string') {
                fieldsetKey = fieldData.key.toLowerCase();
            } else if (fieldData.type && typeof fieldData.type === 'string') {
                fieldsetKey = fieldData.type.toLowerCase();
            }
            if (!fieldsetKey) return;
            
            // Check if location fieldset
            if (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location') {
                if (!locationFieldset) {
                    locationFieldset = fieldData;
                    locationFieldsetType = fieldsetKey === 'location' ? 'address' : fieldsetKey;
                }
            }
            
            // Check for repeat flags
            var isLocationRepeat = false;
            if (fieldData.location_repeat !== undefined) {
                isLocationRepeat = !!fieldData.location_repeat;
            }
            var isMustRepeat = false;
            if (fieldData.must_repeat !== undefined) {
                isMustRepeat = !!fieldData.must_repeat;
            }
            var isLocationKey = (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location');
            
            if (isMustRepeat && !isLocationKey) {
                mustRepeatFieldsets.push(fieldData);
            }
            if (isLocationRepeat && !isMustRepeat && !isLocationKey) {
                locationRepeatOnlyFieldsets.push(fieldData);
            }
        });
        
        if (!locationFieldset) {
            // No location fieldset - render fields normally
            fields.forEach(function(fieldData, index) {
                var fieldset = buildFieldset(fieldData, {
                    idPrefix: idPrefix,
                    fieldIndex: index,
                    container: container
                });
                if (fieldset) container.appendChild(fieldset);
            });
            return { quantityPicker: null, locationContainers: [], locationFieldsetType: null };
        }
        
        // Build all fieldsets first and organize them
        var locationFieldsetEl = null;
        var regularFieldsets = [];
        var allRepeatKeys = {};
        mustRepeatFieldsets.forEach(function(f) {
            var k = '';
            if (f.fieldset_key && typeof f.fieldset_key === 'string') {
                k = f.fieldset_key.toLowerCase();
            } else if (f.fieldsetKey && typeof f.fieldsetKey === 'string') {
                k = f.fieldsetKey.toLowerCase();
            }
            if (k) allRepeatKeys[k] = true;
        });
        locationRepeatOnlyFieldsets.forEach(function(f) {
            var k = '';
            if (f.fieldset_key && typeof f.fieldset_key === 'string') {
                k = f.fieldset_key.toLowerCase();
            } else if (f.fieldsetKey && typeof f.fieldsetKey === 'string') {
                k = f.fieldsetKey.toLowerCase();
            }
            if (k) allRepeatKeys[k] = true;
        });
        
        // Create location container for Venue 1
        var locationTypeName = locationFieldsetType ? locationFieldsetType.charAt(0).toUpperCase() + locationFieldsetType.slice(1) : 'Venue';
        var venue1Name = locationTypeName + ' 1';
        
        var v1ContainerData = createLocationContainerHeader({
            locationName: venue1Name,
            locationNumber: 1,
            showDelete: customOnDelete !== null && initialQuantity > 1,
            onDelete: customOnDelete || function() {},
            onHeaderClick: customOnHeaderClick || function(container, locationNumber) {
                if (initialQuantity > 1) {
                    container.classList.toggle('formbuilder-location-container--collapsed');
                }
            },
            onActivate: customOnActivate || function() {}
        });
        
        // Hide arrow and delete button when only one location
        if (initialQuantity <= 1) {
            v1ContainerData.arrow.style.display = 'none';
            v1ContainerData.deleteBtn.style.display = 'none';
        }
        
        // Build fieldsets and organize them into containers
        fields.forEach(function(fieldData, index) {
            var fieldset = buildFieldset(fieldData, {
                idPrefix: idPrefix,
                fieldIndex: index,
                container: null
            });
            if (!fieldset) return;
            
            var fieldsetKey = '';
            if (fieldData.fieldset_key && typeof fieldData.fieldset_key === 'string') {
                fieldsetKey = fieldData.fieldset_key.toLowerCase();
            } else if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                fieldsetKey = fieldData.fieldsetKey.toLowerCase();
            }
            
            // Location fieldset goes into Venue 1 container
            if (fieldsetKey && (fieldsetKey === locationFieldsetType || fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location')) {
                if (!locationFieldsetEl) {
                    locationFieldsetEl = fieldset;
                    v1ContainerData.content.appendChild(fieldset);
                    
                    // Set up automatic header renaming from venue input (supports Google Places autofill)
                    if (setupHeaderRenaming) {
                        var venueInput = fieldset.querySelector('input[type="text"]');
                        if (venueInput && v1ContainerData.headerText) {
                            var lastValue = '';
                            function updateHeader() {
                                var name = venueInput.value.trim();
                                if (name !== lastValue) {
                                    lastValue = name;
                                    var headerText = '';
                                    if (name && name.trim()) {
                                        headerText = name.trim();
                                    } else {
                                        headerText = venue1Name;
                                    }
                                    v1ContainerData.headerText.textContent = headerText;
                                }
                            }
                            venueInput.addEventListener('input', updateHeader);
                            venueInput.addEventListener('change', updateHeader);
                            // Use MutationObserver to catch Google Places autofill
                            var observer = new MutationObserver(function() { updateHeader(); });
                            observer.observe(venueInput, { attributes: true, attributeFilter: ['value'] });
                            // Also check on focus out (catches Google Places autofill)
                            venueInput.addEventListener('blur', function() { setTimeout(updateHeader, 50); });
                        }
                    }
                }
            }
            // Must-repeat and location-repeat-only fieldsets go into Venue 1 container
            else if (fieldsetKey && allRepeatKeys[fieldsetKey]) {
                v1ContainerData.content.appendChild(fieldset);
            }
            // Regular fieldsets go first (before quantity picker and venue containers)
            // This includes fields without fieldsetKey/fieldset_key
            else {
                regularFieldsets.push(fieldset);
            }
        });
        
        // STEP 1: Append regular fieldsets first
        regularFieldsets.forEach(function(fieldset) {
            container.appendChild(fieldset);
        });
        
        // STEP 2: Create and append quantity picker + message together
        var quantityPicker = createLocationQuantityPicker({
            initialQuantity: initialQuantity,
            onQuantityChange: function(quantity, isIncrease) {
                onQuantityChange(quantity, isIncrease);
            },
            getMessage: getMessage
        });
        
        // Append quantity picker row (contains label + controls)
        if (quantityPicker.quantityRow) {
            container.appendChild(quantityPicker.quantityRow);
        }
        // Append explainer message immediately after quantity picker
        if (quantityPicker.explainerMsg) {
            container.appendChild(quantityPicker.explainerMsg);
        }
        
        // STEP 3: Append Venue 1 container after quantity picker + message
        container.appendChild(v1ContainerData.container);
        
        // STEP 4: Create additional location containers if quantity > 1
        var allLocationContainers = [v1ContainerData];
        if (initialQuantity > 1 && locationFieldset) {
            for (var i = 2; i <= initialQuantity; i++) {
                var locationNum = i;
                var additionalName = locationTypeName + ' ' + locationNum;
                
                var additionalContainerData = createLocationContainerHeader({
                    locationName: additionalName,
                    locationNumber: locationNum,
                    showDelete: customOnDelete !== null,
                    onDelete: customOnDelete || function() {},
                    onHeaderClick: customOnHeaderClick || function(container, locationNumber) {
                        container.classList.toggle('formbuilder-location-container--collapsed');
                    },
                    onActivate: customOnActivate || function() {}
                });
                
                // Build location fieldset for this additional location
                var additionalLocationFieldData = {};
                for (var prop in locationFieldset) {
                    if (locationFieldset.hasOwnProperty(prop)) {
                        additionalLocationFieldData[prop] = locationFieldset[prop];
                    }
                }
                
                var additionalLocationFieldset = buildFieldset(additionalLocationFieldData, {
                    idPrefix: idPrefix,
                    fieldIndex: 0,
                    container: null,
                    locationNumber: locationNum
                });
                
                if (additionalLocationFieldset) {
                    additionalContainerData.content.appendChild(additionalLocationFieldset);
                    
                    // Set up automatic header renaming from venue input (supports Google Places autofill)
                    if (setupHeaderRenaming) {
                        var venueInput = additionalLocationFieldset.querySelector('input[type="text"]');
                        if (venueInput && additionalContainerData.headerText) {
                            var lastValue = '';
                            function updateHeader() {
                                var name = venueInput.value.trim();
                                if (name !== lastValue) {
                                    lastValue = name;
                                    var headerText = '';
                                    if (name && name.trim()) {
                                        headerText = name.trim();
                                    } else {
                                        headerText = additionalName;
                                    }
                                    additionalContainerData.headerText.textContent = headerText;
                                }
                            }
                            venueInput.addEventListener('input', updateHeader);
                            venueInput.addEventListener('change', updateHeader);
                            var observer = new MutationObserver(function() { updateHeader(); });
                            observer.observe(venueInput, { attributes: true, attributeFilter: ['value'] });
                            venueInput.addEventListener('blur', function() { setTimeout(updateHeader, 50); });
                        }
                    }
                }
                
                // Build repeat fieldsets for this additional location
                var combinedRepeatFieldsets = mustRepeatFieldsets.concat(locationRepeatOnlyFieldsets);
                combinedRepeatFieldsets.forEach(function(fieldData, fieldIndex) {
                    var fieldsetKey = '';
                    if (fieldData.fieldset_key && typeof fieldData.fieldset_key === 'string') {
                        fieldsetKey = fieldData.fieldset_key.toLowerCase();
                    } else if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                        fieldsetKey = fieldData.fieldsetKey.toLowerCase();
                    }
                    
                    if (fieldsetKey && (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location')) {
                        return;
                    }
                    
                    if (fieldsetKey && allRepeatKeys[fieldsetKey]) {
                        var repeatFieldset = buildFieldset(fieldData, {
                            idPrefix: idPrefix,
                            fieldIndex: fieldIndex,
                            container: null,
                            locationNumber: locationNum
                        });
                        if (repeatFieldset) {
                            additionalContainerData.content.appendChild(repeatFieldset);
                        }
                    }
                });
                
                container.appendChild(additionalContainerData.container);
                allLocationContainers.push(additionalContainerData);
            }
        }
        
        return {
            quantityPicker: quantityPicker,
            locationContainers: allLocationContainers,
            locationFieldsetType: locationFieldsetType,
            venue1Container: v1ContainerData.container,
            venue1HeaderText: v1ContainerData.headerText,
            venue1Arrow: v1ContainerData.arrow,
            venue1DeleteBtn: v1ContainerData.deleteBtn
        };
    }
    
    /**
     * Renders additional location containers (Venue 2, 3, etc.) when quantity changes
     * @param {Object} options - Configuration options
     * @param {number} options.quantity - Number of locations to render
     * @param {string} options.locationType - Type of location (venue, city, address)
     * @param {Object} options.locationFieldsetData - Field data for the location fieldset
     * @param {Array} options.mustRepeatFieldsets - Fieldsets that must repeat for each location
     * @param {Array} options.autofillRepeatFieldsets - Fieldsets that autofill from location 1
     * @param {Array} options.locationRepeatOnlyFieldsets - Optional override fieldsets
     * @param {Function} options.buildFieldset - Function to build fieldsets (FieldsetBuilder.buildFieldset)
     * @param {string} options.idPrefix - Prefix for field IDs
     * @param {Function} options.getDefaultCurrency - Function to get default currency
     * @param {HTMLElement} options.venue1Container - Reference to venue 1 container
     * @param {HTMLElement} options.insertBeforeElement - Element to insert locations before (e.g., checkout)
     * @param {Function} options.onQuantityUpdate - Callback when quantity is updated (for delete)
     */
    function renderAdditionalLocations(options) {
        options = options || {};
        var quantity = options.quantity || 1;
        var locationType = options.locationType || 'venue';
        var locationFieldsetData = options.locationFieldsetData;
        var mustRepeatFieldsets = options.mustRepeatFieldsets || [];
        var autofillRepeatFieldsets = options.autofillRepeatFieldsets || [];
        var locationRepeatOnlyFieldsets = options.locationRepeatOnlyFieldsets || [];
        var buildFieldset = options.buildFieldset;
        var idPrefix = options.idPrefix || 'form';
        var getDefaultCurrency = options.getDefaultCurrency || function() { return 'USD'; };
        var venue1Container = options.venue1Container;
        var insertBeforeElement = options.insertBeforeElement;
        var onQuantityUpdate = options.onQuantityUpdate || function() {};
        
        // Remove existing additional location containers (keep venue 1)
        document.querySelectorAll('.formbuilder-location-container[data-location-number]').forEach(function(el) {
            var locNum = parseInt(el.dataset.locationNumber || '0', 10);
            if (locNum > 1) {
                el.remove();
            }
        });
        
        if (quantity <= 1) return;
        
        if (!venue1Container) {
            venue1Container = document.querySelector('.formbuilder-location-container[data-venue="1"]');
        }
        
        if (!venue1Container) {
            console.warn('[FormBuilder] Venue 1 container not found');
            return;
        }
        
        if (!locationFieldsetData) {
            console.warn('[FormBuilder] locationFieldsetData not set');
            return;
        }
        
        var parentContainer = venue1Container.parentNode;
        var insertAfter = venue1Container;
        
        // Build lookup for repeat fieldsets
        var locationRepeatOnlyKeys = {};
        locationRepeatOnlyFieldsets.forEach(function(f) {
            var k = getFieldsetKey(f);
            if (k) locationRepeatOnlyKeys[k] = f;
        });
        
        var mustRepeatKeys = {};
        mustRepeatFieldsets.forEach(function(f) {
            var k = getFieldsetKey(f);
            if (k) mustRepeatKeys[k] = f;
        });
        
        // Combine fieldsets in order
        var combinedFieldsets = mustRepeatFieldsets.concat(locationRepeatOnlyFieldsets);
        
        for (var i = 2; i <= quantity; i++) {
            (function(locationNum) {
                var venueTypeName = locationType.charAt(0).toUpperCase() + locationType.slice(1);
                var defaultName = venueTypeName + ' ' + locationNum;
                
                // Create container using shared function
                var locationContainerData = createLocationContainerHeader({
                    locationName: defaultName,
                    locationNumber: locationNum,
                    showDelete: true,
                    onDelete: function(container, locNum) {
                        var headerText = locationContainerData.headerText;
                        var deleteName = headerText.textContent || defaultName;
                        if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
                            ConfirmDialogComponent.show({
                                titleText: 'Delete ' + deleteName,
                                messageText: 'This cannot be undone.',
                                confirmLabel: 'Delete',
                                cancelLabel: 'Cancel',
                                confirmClass: 'danger',
                                focusCancel: true
                            }).then(function(confirmed) {
                                if (confirmed) {
                                    container.remove();
                                    onQuantityUpdate(-1);
                                    updateVenueDeleteButtons();
                                }
                            });
                        }
                    },
                    onHeaderClick: function(container, locNum) {
                        container.classList.toggle('formbuilder-location-container--collapsed');
                    },
                    onActivate: function(container, locNum) {
                        parentContainer.querySelectorAll('.formbuilder-location-container--active').forEach(function(c) {
                            c.classList.remove('formbuilder-location-container--active');
                        });
                        container.classList.add('formbuilder-location-container--active');
                    }
                });
                
                var locationContainer = locationContainerData.container;
                var headerText = locationContainerData.headerText;
                var locationSection = locationContainerData.content;
                
                locationSection.dataset.locationNumber = locationNum;
                
                // Build location fieldset for this location
                var locationFieldData = {};
                for (var prop in locationFieldsetData) {
                    if (locationFieldsetData.hasOwnProperty(prop)) {
                        locationFieldData[prop] = locationFieldsetData[prop];
                    }
                }
                locationFieldData.name = defaultName;
                
                var locationFieldsetClone = buildFieldset(locationFieldData, {
                    idPrefix: idPrefix,
                    fieldIndex: 0,
                    locationNumber: locationNum,
                    container: locationSection,
                    defaultCurrency: getDefaultCurrency()
                });
                
                if (locationFieldsetClone) {
                    locationSection.appendChild(locationFieldsetClone);
                    
                    // Sync header with venue input (supports Google Places autofill)
                    var venueInput = locationFieldsetClone.querySelector('input[type="text"]');
                    if (venueInput) {
                        var lastValue = '';
                        function updateLocHeader() {
                            var name = venueInput.value.trim();
                            if (name !== lastValue) {
                                lastValue = name;
                                headerText.textContent = name || defaultName;
                            }
                        }
                        venueInput.addEventListener('input', updateLocHeader);
                        venueInput.addEventListener('change', updateLocHeader);
                        venueInput.addEventListener('blur', function() { setTimeout(updateLocHeader, 50); });
                    }
                }
                
                // Render all repeat fieldsets in order
                combinedFieldsets.forEach(function(fieldData, fieldIndex) {
                    var key = getFieldsetKey(fieldData);
                    if (key === 'venue' || key === 'city' || key === 'address' || key === 'location') {
                        return;
                    }
                    
                    var isOptionalOverride = !!locationRepeatOnlyKeys[key];
                    
                    var fieldset = buildFieldset(fieldData, {
                        idPrefix: idPrefix,
                        fieldIndex: fieldIndex,
                        locationNumber: locationNum,
                        container: locationSection,
                        defaultCurrency: getDefaultCurrency()
                    });
                    
                    if (!fieldset) return;
                    
                    // Mark optional override fieldsets
                    if (isOptionalOverride) {
                        fieldset.dataset.isOverride = 'true';
                        fieldset.dataset.fieldsetKey = key;
                    }
                    
                    locationSection.appendChild(fieldset);
                    
                    // Number fieldsets by location number
                    var labelTextEl = fieldset.querySelector('.fieldset-label-text');
                    if (labelTextEl) {
                        if (!fieldset.dataset.baseLabel) {
                            fieldset.dataset.baseLabel = (labelTextEl.textContent || '').trim();
                        }
                        var base = fieldset.dataset.baseLabel || '';
                        if (base) {
                            labelTextEl.textContent = base + ' ' + locationNum;
                        }
                    }
                    
                    // Handle autofill behavior
                    var isAutofill = autofillRepeatFieldsets.indexOf(fieldData) !== -1;
                    if (isOptionalOverride) {
                        if (isAutofill) {
                            fieldset.dataset.autofillMode = 'value';
                            (function(fs, k) {
                                setTimeout(function() {
                                    copyLocation1Values(fs, k);
                                }, 150);
                            })(fieldset, key);
                        } else {
                            fieldset.dataset.autofillMode = 'placeholder';
                            fieldset.classList.add('formbuilder-location-override--placeholder');
                            (function(fs, k) {
                                setTimeout(function() {
                                    setupPlaceholderSync(fs, k);
                                }, 150);
                            })(fieldset, key);
                        }
                    } else if (isAutofill) {
                        (function(fs, fd) {
                            setTimeout(function() {
                                copyFieldsetValues(fs, fd);
                            }, 100);
                        })(fieldset, fieldData);
                    }
                });
                
                // Insert after previous venue (before insertBeforeElement if provided)
                if (insertBeforeElement && insertBeforeElement.parentNode === parentContainer) {
                    parentContainer.insertBefore(locationContainer, insertBeforeElement);
                } else {
                    parentContainer.insertBefore(locationContainer, insertAfter.nextSibling);
                }
                insertAfter = locationContainer;
                
                // Focus tracking for blue border
                locationContainer.addEventListener('focusin', function() {
                    parentContainer.querySelectorAll('.formbuilder-location-container--active').forEach(function(c) {
                        c.classList.remove('formbuilder-location-container--active');
                    });
                    locationContainer.classList.add('formbuilder-location-container--active');
                });
            })(i);
        }
    }
    
    /**
     * Helper: Get fieldset key from field data (checks multiple property names)
     */
    function getFieldsetKey(fieldData) {
        if (!fieldData) return '';
        if (fieldData.fieldset_key && typeof fieldData.fieldset_key === 'string') {
            return fieldData.fieldset_key.toLowerCase();
        }
        if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
            return fieldData.fieldsetKey.toLowerCase();
        }
        if (fieldData.key && typeof fieldData.key === 'string') {
            return fieldData.key.toLowerCase();
        }
        if (fieldData.type && typeof fieldData.type === 'string') {
            return fieldData.type.toLowerCase();
        }
        return '';
    }
    
    /**
     * Update delete button visibility based on venue count
     */
    function updateVenueDeleteButtons() {
        var allVenueContainers = document.querySelectorAll('.formbuilder-location-container');
        var venueCount = allVenueContainers.length;
        var showDelete = venueCount > 1;
        
        // Update venue 1 delete button (stored globally)
        if (window._formbuilderVenue1DeleteBtn) {
            window._formbuilderVenue1DeleteBtn.style.display = showDelete ? '' : 'none';
        }
        if (window._formbuilderVenue1Arrow) {
            window._formbuilderVenue1Arrow.style.display = showDelete ? '' : 'none';
        }
        
        // Update all venue delete buttons
        allVenueContainers.forEach(function(container) {
            var deleteBtn = container.querySelector('.formbuilder-location-header-button-delete');
            if (deleteBtn) {
                deleteBtn.style.display = showDelete ? '' : 'none';
            }
            var arrow = container.querySelector('.formbuilder-location-header-arrow');
            if (arrow) {
                arrow.style.display = showDelete ? '' : 'none';
            }
        });
    }
    
    /**
     * Copy values from location 1 fieldset to target fieldset (autofill - one-time, frozen)
     */
    function copyLocation1Values(targetFieldset, fieldsetKeyLower) {
        if (!targetFieldset) return;
        var sourceFieldset = findLocation1Fieldset(fieldsetKeyLower);
        if (!sourceFieldset) return;
        
        var sourceInputs = sourceFieldset.querySelectorAll('input:not([type="hidden"]), textarea');
        var targetInputs = targetFieldset.querySelectorAll('input:not([type="hidden"]), textarea');
        
        for (var j = 0; j < sourceInputs.length && j < targetInputs.length; j++) {
            var srcVal = String(sourceInputs[j].value || '').trim();
            if (targetInputs[j]) {
                targetInputs[j].value = srcVal;
                targetInputs[j].dataset.autofillValue = srcVal;
            }
        }
        
        // Copy radio/checkbox states
        var sourceRadios = sourceFieldset.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        var targetRadios = targetFieldset.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        for (var k = 0; k < sourceRadios.length && k < targetRadios.length; k++) {
            targetRadios[k].checked = sourceRadios[k].checked;
        }
    }
    
    /**
     * Setup placeholder sync between location 1 and target fieldset (non-autofill - live updates)
     */
    function setupPlaceholderSync(targetFieldset, fieldsetKeyLower) {
        if (!targetFieldset) return;
        
        function syncPlaceholders() {
            var sourceFieldset = findLocation1Fieldset(fieldsetKeyLower);
            if (!sourceFieldset) return;
            
            var sourceInputs = sourceFieldset.querySelectorAll('input:not([type="hidden"]), textarea');
            var targetInputs = targetFieldset.querySelectorAll('input:not([type="hidden"]), textarea');
            
            for (var j = 0; j < sourceInputs.length && j < targetInputs.length; j++) {
                var srcVal = String(sourceInputs[j].value || '').trim();
                if (targetInputs[j]) {
                    targetInputs[j].placeholder = srcVal || '';
                    targetInputs[j].dataset.inheritedValue = srcVal;
                }
            }
        }
        
        // Initial sync
        syncPlaceholders();
        
        // Listen for changes in location 1
        var sourceFieldset = findLocation1Fieldset(fieldsetKeyLower);
        if (sourceFieldset) {
            sourceFieldset.addEventListener('input', syncPlaceholders);
            sourceFieldset.addEventListener('change', syncPlaceholders);
        }
    }
    
    /**
     * Find location 1's fieldset by key
     */
    function findLocation1Fieldset(fieldsetKeyLower) {
        // Check venue 1 container first
        var venue1 = document.querySelector('.formbuilder-location-container[data-venue="1"]');
        if (venue1) {
            var allFieldsets = venue1.querySelectorAll('.fieldset');
            for (var j = 0; j < allFieldsets.length; j++) {
                var fs = allFieldsets[j];
                if (!fs || !fs.dataset) continue;
                var k = String(fs.dataset.fieldsetKey || '').toLowerCase();
                if (k === fieldsetKeyLower) {
                    return fs;
                }
            }
        }
        return null;
    }
    
    /**
     * Copy all field values from location 1 to target fieldset
     */
    function copyFieldsetValues(targetFieldset, fieldData) {
        if (!targetFieldset) return;
        if (!fieldData) return;
        
        var fieldsetKeyLower = getFieldsetKey(fieldData);
        if (!fieldsetKeyLower) return;
        
        // Find the location-1 fieldset in venue 1 container
        var venue1Container = document.querySelector('.formbuilder-location-container[data-venue="1"]');
        if (!venue1Container) return;
        
        var sourceFieldset = null;
        var allFieldsets = venue1Container.querySelectorAll('.fieldset');
        for (var i = 0; i < allFieldsets.length; i++) {
            var fs = allFieldsets[i];
            if (!fs || !fs.dataset) continue;
            var k = String(fs.dataset.fieldsetKey || '').toLowerCase();
            if (k === fieldsetKeyLower) {
                sourceFieldset = fs;
                break;
            }
        }
        
        if (!sourceFieldset) return;
        
        var sourceInputs = sourceFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
        var targetInputs = targetFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
        
        var minLen = Math.min(sourceInputs.length, targetInputs.length);
        for (var j = 0; j < minLen; j++) {
            targetInputs[j].value = sourceInputs[j].value;
            var event = new Event('input', { bubbles: true });
            targetInputs[j].dispatchEvent(event);
        }
    }
    
    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    window.FormbuilderModule = {
        init: init,
        refresh: loadFormData,
        save: saveFormbuilder,
        discard: discardChanges,
        capture: captureFormbuilderState,
        createLocationQuantityPicker: createLocationQuantityPicker,
        createLocationContainerHeader: createLocationContainerHeader,
        organizeFieldsIntoLocationContainers: organizeFieldsIntoLocationContainers,
        renderAdditionalLocations: renderAdditionalLocations,
        updateVenueDeleteButtons: updateVenueDeleteButtons,
        getFieldsetKey: getFieldsetKey
    };
    
    // Register module with App
    if (window.App && App.registerModule) {
        App.registerModule('formbuilder', window.FormbuilderModule);
    }
})();
