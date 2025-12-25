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
    
    // Reference data (not for change tracking - just data needed to build the UI)
    var loadedFieldsets = [];
    var loadedCurrencies = [];
    var loadedCategoryIconPaths = {};
    var loadedSubcategoryIconPaths = {};
    
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
            // Keep it at the bottom
            container.appendChild(scrollGapBottomEl);
            return scrollGapBottomEl;
        }

        scrollGapBottomEl = container.querySelector('.formbuilder-scroll-gap-bottom');
        if (!scrollGapBottomEl) {
            scrollGapBottomEl = document.createElement('div');
            scrollGapBottomEl.className = 'formbuilder-scroll-gap-bottom';
            scrollGapBottomEl.setAttribute('aria-hidden', 'true');
        }
        // Always ensure it's last
        container.appendChild(scrollGapBottomEl);
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
        
        var sc = findScrollContainer();
        if (!sc) return;
        
        var gap = getGapHeight();
        var bottomGap = getBottomGapHeight();
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

            // Optional diagnostics: set window.__FORMBUILDER_ANCHOR_DEBUG__ = true in console.
            try {
                if (window.__FORMBUILDER_ANCHOR_DEBUG__) {
                    console.log('[Formbuilder Anchor]', {
                        oldTop: oldTop,
                        newTop: newTop,
                        delta: delta,
                        oldScrollTop: oldScrollTop,
                        currentScrollTop: currentScrollTop,
                        gapTop: getGapHeight(),
                        gapBottom: getBottomGapHeight(),
                        maxNow: Math.max(0, scNow.scrollHeight - scNow.clientHeight)
                    });
                }
            } catch (e) {}
            
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
            var catIconPath = headerImg && headerImg.src ? headerImg.src.replace(window.location.origin + '/', '').replace(/^\//, '') : '';
            
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
                var subIconPath = subHeaderImg && subHeaderImg.src ? subHeaderImg.src.replace(window.location.origin + '/', '').replace(/^\//, '') : '';
                
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
                        
                        // Find matching fieldset from loaded reference data
                        var fieldsetDef = null;
                        if (loadedFieldsets && loadedFieldsets.length > 0) {
                            fieldsetDef = loadedFieldsets.find(function(fs) {
                                return fs.id == fieldsetId || fs.key === fieldsetId;
                            });
                        }
                        
                        var field = {
                            fieldsetKey: fieldsetDef ? fieldsetDef.key : fieldsetId,
                            name: fieldName,
                            required: isRequired,
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
        var addSubBtn = body.querySelector('.formbuilder-add-button');
        if (addSubBtn) {
            body.insertBefore(option, addSubBtn);
        } else {
            body.appendChild(option);
        }
        
        // Open it for editing
        option.classList.add('formbuilder-accordion-option--open');
        option.classList.add('formbuilder-accordion-option--editing');
        
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
        
        if (confirm('Delete "' + name + '"?')) {
            subcategoryOption.remove();
            notifyChange();
        }
    }
    
    function closeAllEditPanels() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-accordion--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion--editing');
        });
        container.querySelectorAll('.formbuilder-accordion-option--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion-option--editing');
        });
        container.querySelectorAll('.formbuilder-menu.open').forEach(function(el) {
            el.classList.remove('open');
        });
    }
    
    function closeAllFieldEditPanels() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
            el.classList.remove('formbuilder-field-wrapper--editing');
        });
    }
    
    function closeAllMenus() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-menu.open').forEach(function(el) {
            el.classList.remove('open');
        });
        container.querySelectorAll('.formbuilder-accordion-editpanel-more.open').forEach(function(el) {
            el.classList.remove('open');
        });
        container.querySelectorAll('.formbuilder-fieldset-menu.open').forEach(function(el) {
            el.classList.remove('open');
        });
        container.querySelectorAll('.formbuilder-field-more.open').forEach(function(el) {
            el.classList.remove('open');
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
                container.querySelectorAll('.formbuilder-accordion-editpanel-more.open').forEach(function(el) {
                    el.classList.remove('open');
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
                container.querySelectorAll('.formbuilder-fieldset-menu.open').forEach(function(el) {
                    el.classList.remove('open');
                });
            }
        });
        
        // Close icon picker menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-menu')) {
                container.querySelectorAll('.formbuilder-menu.open').forEach(function(el) {
                    el.classList.remove('open');
                });
            }
        });
        
        // Close field 3-dot menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            // Don't close if clicking on save/discard buttons or calculator
            if (isSaveOrDiscardButton(e.target) || isCalculatorButtonOrPopup(e.target)) return;
            if (!e.target.closest('.formbuilder-field-more')) {
                container.querySelectorAll('.formbuilder-field-more.open').forEach(function(el) {
                    el.classList.remove('open');
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
                    '.formbuilder-add-button,' +
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
                // Preload picklists for FieldsetComponent (amenities, currencies, phone prefixes)
                // so building fieldsets later does not force its own extra fetch.
                try {
                    if (res.dropdown_options && window.FieldsetComponent && typeof FieldsetComponent.setPicklist === 'function') {
                        FieldsetComponent.setPicklist(res.dropdown_options);
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
        loadedFieldsets = formData.fieldsets;
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
        addCatBtn.className = 'formbuilder-add-button formbuilder-add-category';
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
        headerImg.src = catIconSrc;
        
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
        
        moreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasOpen = moreBtn.classList.contains('open');
            closeAllMenus();
            if (!wasOpen) moreBtn.classList.add('open');
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
            deleteCategory(accordion);
        });
        
        nameRow.appendChild(nameInput);
        nameRow.appendChild(moreBtn);
        
        var iconPicker = buildIconPicker(catIconSrc, function(newIcon) {
            headerImg.src = newIcon;
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
        addSubBtn.className = 'formbuilder-add-button';
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
            });
        });
        
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
        optImg.src = subIconSrc;
        
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
        subNameInput.value = subName;
        subNameInput.oninput = function() {
            optText.textContent = subNameInput.value;
            notifyChange();
        };
        
        var subMoreBtn = document.createElement('div');
        subMoreBtn.className = 'formbuilder-accordion-editpanel-more';
        subMoreBtn.innerHTML = getIcon('moreDots') + '<div class="formbuilder-accordion-editpanel-more-menu"><div class="formbuilder-accordion-editpanel-more-item"><span class="formbuilder-accordion-editpanel-more-item-text">Hide Subcategory</span><div class="formbuilder-accordion-editpanel-more-switch' + (subHidden ? ' on' : '') + '"></div></div><div class="formbuilder-accordion-editpanel-more-item formbuilder-accordion-editpanel-more-delete">Delete Subcategory</div></div>';
        
        subMoreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasOpen = subMoreBtn.classList.contains('open');
            closeAllMenus();
            if (!wasOpen) subMoreBtn.classList.add('open');
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
            deleteSubcategory(option);
        });
        
        subNameRow.appendChild(subNameInput);
        subNameRow.appendChild(subMoreBtn);
        
        var subIconPicker = buildIconPicker(subIconSrc, function(newIcon) {
            optImg.src = newIcon;
            notifyChange();
        });
        
        subEditPanel.appendChild(subNameRow);
        subEditPanel.appendChild(subIconPicker);
        
        // Get surcharge from subFees if available
        var subFees = cat.subFees;
        var subFeeData = subFees && subFees[subName] ? subFees[subName] : null;
        
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
        eventsInput.name = 'subType-' + cat.name + '-' + subName;
        eventsInput.value = 'Events';
        eventsInput.checked = currentType === 'Events';
        var eventsText = document.createElement('span');
        eventsText.textContent = 'Events';
        eventsLabel.appendChild(eventsInput);
        eventsLabel.appendChild(eventsText);
        
        var generalLabel = document.createElement('label');
        generalLabel.className = 'formbuilder-type-option';
        var generalInput = document.createElement('input');
        generalInput.type = 'radio';
        generalInput.name = 'subType-' + cat.name + '-' + subName;
        generalInput.value = 'General';
        generalInput.checked = currentType === 'General';
        var generalText = document.createElement('span');
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
        var currentLocationType = subFeeData.location_type;
        
        var venueLabel = document.createElement('label');
        venueLabel.className = 'formbuilder-type-option';
        var venueInput = document.createElement('input');
        venueInput.type = 'radio';
        venueInput.name = 'locationType-' + cat.name + '-' + subName;
        venueInput.value = 'Venue';
        // Only check if explicitly 'Venue', not null/undefined/empty
        venueInput.checked = (currentLocationType === 'Venue');
        var venueText = document.createElement('span');
        venueText.textContent = 'Venue';
        venueLabel.appendChild(venueInput);
        venueLabel.appendChild(venueText);
        
        var cityLabel = document.createElement('label');
        cityLabel.className = 'formbuilder-type-option';
        var cityInput = document.createElement('input');
        cityInput.type = 'radio';
        cityInput.name = 'locationType-' + cat.name + '-' + subName;
        cityInput.value = 'City';
        // Only check if explicitly 'City', not null/undefined/empty
        cityInput.checked = (currentLocationType === 'City');
        if (currentType === 'Events') {
            cityInput.disabled = true;
        }
        var cityText = document.createElement('span');
        cityText.textContent = 'City';
        cityLabel.appendChild(cityInput);
        cityLabel.appendChild(cityText);
        
        var addressLabel = document.createElement('label');
        addressLabel.className = 'formbuilder-type-option';
        var addressInput = document.createElement('input');
        addressInput.type = 'radio';
        addressInput.name = 'locationType-' + cat.name + '-' + subName;
        addressInput.value = 'Address';
        // Only check if explicitly 'Address', not null/undefined/empty
        addressInput.checked = (currentLocationType === 'Address');
        if (currentType === 'Events') {
            addressInput.disabled = true;
        }
        var addressText = document.createElement('span');
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
                    return (fs.id || fs.key || fs.fieldset_key) == fsId;
                });
                if (!fieldset) return;
                
                var fieldsetKey = fieldset.key || fieldset.fieldset_key || fieldset.id;
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
                // Use separate class 'disabled-location-type' to avoid breaking "already added" disabled state
                if (!selectedType || selectedTypeLower === 'null' || selectedTypeLower === '') {
                    // No selection - enable all location fieldsets
                    opt.classList.remove('disabled-location-type');
                } else if (selectedTypeLower === 'venue') {
                    if (isCity || isAddress) {
                        opt.classList.add('disabled-location-type');
                    } else if (isVenue) {
                        opt.classList.remove('disabled-location-type');
                    }
                } else if (selectedTypeLower === 'city') {
                    if (isVenue || isAddress) {
                        opt.classList.add('disabled-location-type');
                    } else if (isCity) {
                        opt.classList.remove('disabled-location-type');
                    }
                } else if (selectedTypeLower === 'address') {
                    if (isVenue || isCity) {
                        opt.classList.add('disabled-location-type');
                    } else if (isAddress) {
                        opt.classList.remove('disabled-location-type');
                    }
                }
            });
        }
        
        // Update sessions fieldset gray-out state based on subcategory type
        function updateSessionsFieldset(subcategoryType) {
            if (!fieldsetOpts) return;
            var allOptions = fieldsetOpts.querySelectorAll('.formbuilder-fieldset-menu-option');
            
            allOptions.forEach(function(opt) {
                var fsId = opt.getAttribute('data-fieldset-id');
                var fieldset = fieldsets.find(function(fs) {
                    return (fs.id || fs.key || fs.fieldset_key) == fsId;
                });
                if (!fieldset) return;
                
                var fieldsetKey = fieldset.key || fieldset.fieldset_key || fieldset.id;
                var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
                var isSessions = fieldsetKeyLower === 'sessions';
                
                if (isSessions) {
                    if (subcategoryType === 'Events') {
                        opt.classList.remove('disabled-location-type');
                    } else {
                        opt.classList.add('disabled-location-type');
                    }
                }
            });
        }
        
        function manageLocationTypeFieldsets(selectedType) {
            if (!selectedType) {
                // No location type selected - hide Add Field button
                if (fieldsetMenu) {
                    fieldsetMenu.style.display = 'none';
                }
                // Update gray-out state for all location fieldsets
                updateLocationTypeFieldsets(null);
                return;
            }
            
            // Show Add Field button
            if (fieldsetMenu) {
                fieldsetMenu.style.display = '';
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
            var allFieldWrappers = fieldsContainer.querySelectorAll('.formbuilder-field-wrapper');
            var targetFieldsetExists = false;
            
            // Remove any location fieldsets that don't match the selected type
            allFieldWrappers.forEach(function(wrapper) {
                var fsId = wrapper.getAttribute('data-fieldset-id');
                var fieldset = fieldsets.find(function(fs) {
                    return (fs.id || fs.key || fs.fieldset_key) == fsId;
                });
                if (!fieldset) return;
                
                var fieldsetKey = fieldset.key || fieldset.fieldset_key || fieldset.id;
                var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
                
                // Check if this is a location fieldset
                var isLocationFieldset = fieldsetKeyLower === 'venue' || 
                                        fieldsetKeyLower === 'city' || 
                                        fieldsetKeyLower === 'address' || 
                                        fieldsetKeyLower === 'location';
                
                if (isLocationFieldset) {
                    // Check if it matches the selected type
                    var matches = false;
                    if (targetFieldsetKey === 'address') {
                        matches = (fieldsetKeyLower === 'address' || fieldsetKeyLower === 'location');
                    } else {
                        matches = (fieldsetKeyLower === targetFieldsetKey);
                    }
                    
                    // Remove if it doesn't match the selected type
                    if (!matches) {
                        wrapper.remove();
                        addedFieldsets[fsId] = false;
                        var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + fsId + '"]');
                        if (menuOpt) {
                            menuOpt.classList.remove('disabled');
                        }
                    } else {
                        // This is the matching fieldset
                        targetFieldsetExists = true;
                    }
                }
            });
            
            // If target fieldset doesn't exist, add it automatically
            if (!targetFieldsetExists) {
                // Try to find fieldset by target key, or 'location' if target is 'address'
                var targetFieldset = null;
                if (targetFieldsetKey === 'address') {
                    // Try 'address' first, then 'location'
                    targetFieldset = fieldsets.find(function(fs) {
                        var fsKey = fs.key || fs.fieldset_key || fs.id;
                        return String(fsKey).toLowerCase() === 'address';
                    });
                    if (!targetFieldset) {
                        targetFieldset = fieldsets.find(function(fs) {
                            var fsKey = fs.key || fs.fieldset_key || fs.id;
                            return String(fsKey).toLowerCase() === 'location';
                        });
                    }
                } else {
                    targetFieldset = fieldsets.find(function(fs) {
                        var fsKey = fs.key || fs.fieldset_key || fs.id;
                        return String(fsKey).toLowerCase() === targetFieldsetKey;
                    });
                }
                
                if (targetFieldset) {
                    var result = createFieldElement(targetFieldset, true, targetFieldset);
                    fieldsContainer.appendChild(result.wrapper);
                    addedFieldsets[result.fsId] = true;
                    var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + result.fsId + '"]');
                    if (menuOpt) {
                        menuOpt.classList.add('disabled');
                    }
                    notifyChange();
                }
            }
        }
        
        // Manage sessions fieldset based on subcategory type (Events vs General)
        function manageSessionsFieldset(isEvents) {
            // Update gray-out state in menu
            updateSessionsFieldset(isEvents ? 'Events' : 'General');
            
            var allFieldWrappers = fieldsContainer.querySelectorAll('.formbuilder-field-wrapper');
            
            // If General is selected, remove sessions fieldset if it exists
            if (!isEvents) {
                allFieldWrappers.forEach(function(wrapper) {
                    var fsId = wrapper.getAttribute('data-fieldset-id');
                    var fieldset = fieldsets.find(function(fs) {
                        return (fs.id || fs.key || fs.fieldset_key) == fsId;
                    });
                    if (!fieldset) return;
                    
                    var fieldsetKey = fieldset.key || fieldset.fieldset_key || fieldset.id;
                    var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
                    
                    if (fieldsetKeyLower === 'sessions') {
                        wrapper.remove();
                        addedFieldsets[fsId] = false;
                        var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + fsId + '"]');
                        if (menuOpt) {
                            menuOpt.classList.remove('disabled');
                        }
                    }
                });
                notifyChange();
                return;
            }
            
            // If Events is selected, check if sessions fieldset exists and add it automatically if not
            var sessionsFieldsetExists = false;
            allFieldWrappers.forEach(function(wrapper) {
                var fsId = wrapper.getAttribute('data-fieldset-id');
                var fieldset = fieldsets.find(function(fs) {
                    return (fs.id || fs.key || fs.fieldset_key) == fsId;
                });
                if (fieldset) {
                    var fieldsetKey = fieldset.key || fieldset.fieldset_key || fieldset.id;
                    var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
                    if (fieldsetKeyLower === 'sessions') {
                        sessionsFieldsetExists = true;
                    }
                }
            });
            
            // If sessions fieldset doesn't exist, add it automatically
            if (!sessionsFieldsetExists) {
                var sessionsFieldset = fieldsets.find(function(fs) {
                    var fsKey = fs.key || fs.fieldset_key || fs.id;
                    return String(fsKey).toLowerCase() === 'sessions';
                });
                
                if (sessionsFieldset) {
                    var result = createFieldElement(sessionsFieldset, true, sessionsFieldset);
                    fieldsContainer.appendChild(result.wrapper);
                    addedFieldsets[result.fsId] = true;
                    var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + result.fsId + '"]');
                    if (menuOpt) {
                        menuOpt.classList.add('disabled');
                    }
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
                manageSessionsFieldset(true); // Add sessions fieldset for Events
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
                manageSessionsFieldset(false); // Remove sessions fieldset for General
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
        
        if (subFeeData.checkout_surcharge !== null && subFeeData.checkout_surcharge !== undefined) {
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
        fieldsetMenu.innerHTML = '<div class="formbuilder-fieldset-menu-button">+ Add Fieldset</div><div class="formbuilder-fieldset-menu-options"></div>';
        
        var fieldsetBtn = fieldsetMenu.querySelector('.formbuilder-fieldset-menu-button');
        var fieldsetOpts = fieldsetMenu.querySelector('.formbuilder-fieldset-menu-options');
        
        var addedFieldsets = {};
        
        function createFieldElement(fieldData, isRequired, fieldsetDef) {
            var fsId = fieldData.id || fieldData.fieldsetKey || fieldData.key || fieldData.name;
            var fieldName = fieldData.name || fieldData.key;
            
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
            requiredCheckbox.onchange = function() {
                if (requiredCheckbox.checked) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--required');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--required');
                }
                notifyChange();
            };
            
            requiredLabel.appendChild(requiredCheckbox);
            requiredLabel.appendChild(document.createTextNode('Required'));
            
            var fieldMoreBtn = document.createElement('div');
            fieldMoreBtn.className = 'formbuilder-field-more';
            fieldMoreBtn.innerHTML = getIcon('moreDots') + '<div class="formbuilder-field-more-menu"><div class="formbuilder-field-more-item formbuilder-field-more-delete">Delete Field</div></div>';
            
            fieldMoreBtn.addEventListener('click', function(ev) {
                ev.stopPropagation();
                var wasOpen = fieldMoreBtn.classList.contains('open');
                closeAllMenus();
                if (!wasOpen) fieldMoreBtn.classList.add('open');
            });
            
            var fieldDeleteItem = fieldMoreBtn.querySelector('.formbuilder-field-more-delete');
            fieldDeleteItem.addEventListener('click', function(ev) {
                ev.stopPropagation();
                fieldWrapper.remove();
                addedFieldsets[fsId] = false;
                var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + fsId + '"]');
                if (menuOpt) {
                    menuOpt.classList.remove('disabled');
                    // Re-apply location type filtering after removing "already added" disabled state
                    var currentLocationTypeRadio = subEditPanel.querySelector('input[type="radio"][name^="locationType-"]:checked');
                    var currentLocationType = currentLocationTypeRadio ? currentLocationTypeRadio.value : null;
                    updateLocationTypeFieldsets(currentLocationType);
                }
                notifyChange();
            });
            
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
            
            locationRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
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
                notifyChange();
            });
            
            mustRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (mustRepeatSwitch.classList.contains('disabled')) return;
                var isOn = mustRepeatSwitch.classList.toggle('on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--must-repeat');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--must-repeat');
                }
                notifyChange();
            });
            
            autofillRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (autofillRepeatSwitch.classList.contains('disabled')) return;
                var isOn = autofillRepeatSwitch.classList.toggle('on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--autofill-repeat');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--autofill-repeat');
                }
                notifyChange();
            });
            
            switchRow.appendChild(locationRepeatLabel);
            switchRow.appendChild(mustRepeatLabel);
            switchRow.appendChild(autofillRepeatLabel);
            fieldEditPanel.appendChild(switchRow);
            
            // Check field type
            var fieldType = fieldsetDef.type || fieldsetDef.fieldset_type || fieldsetDef.fieldset_key || fieldsetDef.key;
            var needsAmenities = fieldType === 'amenities';
            var needsOptions = fieldType === 'dropdown' || fieldType === 'radio' || fieldType === 'select';
            
            // Declare variables that will be used in checkModifiedState
            var selectedAmenities = fieldData.selectedAmenities;
            var optionsContainer = null;
            var nameInput, placeholderInput, tooltipInput, modifyButton;
            
            // Get default values from fieldset definition
            var defaultName = fieldsetDef ? (fieldsetDef.fieldset_name || fieldsetDef.name) : '';
            var defaultPlaceholder = fieldsetDef ? (fieldsetDef.fieldset_placeholder || fieldsetDef.placeholder) : '';
            var defaultTooltip = fieldsetDef ? (fieldsetDef.fieldset_tooltip || fieldsetDef.tooltip) : '';
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
                }
                
                // Show/hide Modified label
                var modifiedLabel = fieldWrapper.querySelector('.formbuilder-field-modified-label');
                if (modifiedLabel) {
                    if (isModified) {
                        modifiedLabel.style.display = 'inline';
                    } else {
                        modifiedLabel.style.display = 'none';
                    }
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
                fieldNameSpan.textContent = nameInput.value || defaultName || 'Unnamed';
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
            
            field.addEventListener('click', function(ev) {
                ev.stopPropagation();
                runWithScrollAnchor(field, function() {
                container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
                    if (el !== fieldWrapper) {
                        el.classList.remove('formbuilder-field-wrapper--editing');
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
                });
                if (!isOpen) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--editing');
                }
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
        // All fieldsets appear in menu, but location fieldsets and sessions are grayed out when not selectable
        var selectedLocationType = subFeeData.location_type;
        var currentSubcategoryType = subFeeData.subcategory_type;
        fieldsets.forEach(function(fs) {
            var fsId = fs.id || fs.key || fs.name;
            var fieldsetKey = fs.key || fs.fieldset_key || fs.id;
            // Normalize to lowercase for comparison
            var fieldsetKeyLower = String(fieldsetKey).toLowerCase();
            var isVenue = fieldsetKeyLower === 'venue';
            var isCity = fieldsetKeyLower === 'city';
            var isAddress = fieldsetKeyLower === 'address' || fieldsetKeyLower === 'location';
            var isSessions = fieldsetKeyLower === 'sessions';
            
            var opt = document.createElement('div');
            opt.className = 'formbuilder-fieldset-menu-option';
            opt.textContent = fs.name || fs.key || 'Unnamed';
            opt.setAttribute('data-fieldset-id', fsId);
            
            // Apply initial gray-out state for location fieldsets
            if (isVenue || isCity || isAddress) {
                var selectedTypeLower = selectedLocationType ? String(selectedLocationType).toLowerCase() : '';
                if (!selectedTypeLower || selectedTypeLower === 'null' || selectedTypeLower === '') {
                    // No location type selected - all location fieldsets are grayed out
                    opt.classList.add('disabled-location-type');
                } else if (selectedTypeLower === 'venue') {
                    if (isCity || isAddress) {
                        opt.classList.add('disabled-location-type');
                    }
                } else if (selectedTypeLower === 'city') {
                    if (isVenue || isAddress) {
                        opt.classList.add('disabled-location-type');
                    }
                } else if (selectedTypeLower === 'address') {
                    if (isVenue || isCity) {
                        opt.classList.add('disabled-location-type');
                    }
                }
            }
            
            // Apply initial gray-out state for sessions (only available for Events)
            if (isSessions && currentSubcategoryType !== 'Events') {
                opt.classList.add('disabled-location-type');
            }
            
            opt.onclick = function(e) {
                e.stopPropagation();
                // Check for both "already added" disabled AND location type/sessions disabled
                if (opt.classList.contains('disabled') || opt.classList.contains('disabled-location-type')) return;
                
                var result = createFieldElement(fs, true, fs);
                fieldsContainer.appendChild(result.wrapper);
                addedFieldsets[result.fsId] = true;
                opt.classList.add('disabled');
                fieldsetMenu.classList.remove('open');
                notifyChange();
            };
            fieldsetOpts.appendChild(opt);
        });
        
        // Apply initial location type filtering (gray-out state) now that fieldsetOpts exists
        if (initialLocationType) {
            updateLocationTypeFieldsets(initialLocationType);
        } else {
            // No location type selected - hide Add Field button and gray out all location fieldsets
            if (fieldsetMenu) {
                fieldsetMenu.style.display = 'none';
            }
            updateLocationTypeFieldsets(null);
        }
        
        // Apply initial sessions fieldset gray-out state
        updateSessionsFieldset(currentSubcategoryType);
        
        // Load existing fields from database FIRST
        var subFieldsMap = cat.subFields || {};
        var existingFields = subFieldsMap[subName] || [];
        existingFields.forEach(function(fieldData) {
            var isRequired = fieldData.required === true || fieldData.required === 1 || fieldData.required === '1';
            var fieldsetKey = fieldData.fieldsetKey || fieldData.key || fieldData.id;
            var matchingFieldset = fieldsets.find(function(fs) {
                return fs.id === fieldsetKey || fs.key === fieldsetKey || fs.fieldset_key === fieldsetKey;
            });
            var result = createFieldElement(fieldData, isRequired, matchingFieldset);
            fieldsContainer.appendChild(result.wrapper);
            addedFieldsets[result.fsId] = true;
            var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + result.fsId + '"]');
            if (menuOpt) menuOpt.classList.add('disabled');
        });
        
        // AFTER loading existing fields, manage location type fieldset (will only add if missing)
        if (initialLocationType) {
            manageLocationTypeFieldsets(initialLocationType);
        }
        
        // Also manage sessions fieldset based on current subcategory type
        var currentSubcategoryType = subFeeData.subcategory_type;
        if (currentSubcategoryType === 'Events') {
            manageSessionsFieldset(true);
        } else {
            manageSessionsFieldset(false);
        }
        
        fieldsetBtn.onclick = function(e) {
            e.stopPropagation();
            var wasOpen = fieldsetMenu.classList.contains('open');
            closeAllMenus();
            if (!wasOpen) {
                fieldsetMenu.classList.add('open');
                // Register with MenuManager for click-away handling
                if (typeof MenuManager !== 'undefined' && MenuManager.register) {
                    MenuManager.register(fieldsetMenu);
                }
            }
        };
        
        optBody.appendChild(fieldsetMenu);
        
        var formPreviewBtn = document.createElement('div');
        formPreviewBtn.className = 'formbuilder-add-button formbuilder-form-preview';
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
            closeAllEditPanels();
            if (!isOpen) {
                option.classList.add('formbuilder-accordion-option--editing');
            }
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
                closeAllEditPanels();
            }
            option.classList.toggle('formbuilder-accordion-option--open');
            });
        });
        
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
        
        // Get active checkout options
        var activeCheckoutOptions = checkoutOptions.filter(function(opt) {
            return opt.is_active !== false && opt.is_active !== 0;
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
            var emptyMsg = document.createElement('div');
            emptyMsg.className = 'formbuilder-checkout-empty';
            emptyMsg.textContent = 'No enabled checkout options available.';
            checkoutList.appendChild(emptyMsg);
        } else {
            var currency = siteCurrency;
            
            activeCheckoutOptions.forEach(function(opt) {
                var card = document.createElement('div');
                card.className = 'formbuilder-checkout-card';
                
                var flagfall = parseFloat(opt.checkout_flagfall_price) || 0;
                var basicDayRate = opt.checkout_basic_day_rate !== null && opt.checkout_basic_day_rate !== undefined 
                    ? parseFloat(opt.checkout_basic_day_rate) : null;
                var discountDayRate = opt.checkout_discount_day_rate !== null && opt.checkout_discount_day_rate !== undefined 
                    ? parseFloat(opt.checkout_discount_day_rate) : null;
                
                    function calculatePrice(days) {
                        var basePrice = flagfall;
                        if (days >= 365 && discountDayRate !== null && !isNaN(discountDayRate)) {
                            basePrice += discountDayRate * days;
                        } else if (basicDayRate !== null && !isNaN(basicDayRate)) {
                            basePrice += basicDayRate * days;
                        }
                        if (currentSurcharge !== 0 && !isNaN(currentSurcharge)) {
                            basePrice = basePrice * (1 + currentSurcharge / 100);
                        }
                        return basePrice;
                    }
                
                var price30 = calculatePrice(30);
                var price365 = calculatePrice(365);
                
                var title = document.createElement('div');
                title.className = 'formbuilder-checkout-title';
                title.textContent = opt.checkout_title || 'Untitled';
                
                var prices = document.createElement('div');
                prices.className = 'formbuilder-checkout-prices';
                prices.innerHTML = '<div class="formbuilder-checkout-price-item"><span>30 days: </span><span class="price-value">' + currency + ' ' + price30.toFixed(2) + '</span></div>' +
                    '<div class="formbuilder-checkout-price-item"><span>365 days: </span><span class="price-value">' + currency + ' ' + price365.toFixed(2) + '</span></div>';
                
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
        
        // Get active checkout options
        var activeCheckoutOptions = checkoutOptions.filter(function(opt) {
            return opt.is_active !== false && opt.is_active !== 0;
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
        headerTitle.textContent = subName || 'Form Preview';
        
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
        
        // Render fields using FieldsetComponent (auto-loads its own picklist data)
        if (fields.length === 0) {
            var emptyMsg = document.createElement('p');
            emptyMsg.className = 'formbuilder-formpreview-empty';
            emptyMsg.textContent = 'No fields configured for this subcategory.';
            body.appendChild(emptyMsg);
        } else {
            fields.forEach(function(fieldData, index) {
                var fieldset = FieldsetComponent.buildFieldset(fieldData, {
                    idPrefix: 'formpreview',
                    fieldIndex: index,
                    container: body
                });
                body.appendChild(fieldset);
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
                currency: siteCurrency || 'USD',
                surcharge: surcharge,
                isEvent: isEvent,
                calculatedDays: isEvent ? null : 30,
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
    
    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    window.FormbuilderModule = {
        init: init,
        refresh: loadFormData,
        save: saveFormbuilder,
        discard: discardChanges,
        capture: captureFormbuilderState
    };
    
    // Register module with App
    if (window.App && App.registerModule) {
        App.registerModule('formbuilder', window.FormbuilderModule);
    }
})();
