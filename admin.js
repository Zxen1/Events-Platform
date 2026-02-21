/* ============================================================================
   ADMIN.JS - ADMIN SECTION
   ============================================================================
   
   Controls the admin panel (right side, admin only).
   
   CONTAINS:
   - Panel header (title, autosave toggle, save/discard, close)
   - Tab bar (Settings, Forms, Map, Messages)
   - Settings tab (to be built)
   - Forms tab (to be built)
   - Map tab (to be built)
   - Messages tab (to be built)
   
   DEPENDENCIES:
   - index.js (backbone - App object)
   
   COMMUNICATES WITH:
   - header.js (admin button state)
   - member.js (admin login state)
   
   ============================================================================ */

const AdminModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    // DOM references
    var panel = null;
    var panelContent = null;
    var closeBtn = null;
    var saveBtn = null;
    var discardBtn = null;
    var autosaveCheckbox = null;
    var tabButtons = null;
    var tabPanels = null;

    /* --------------------------------------------------------------------------
       SVG ICONS REGISTRY
       
       DEVELOPER NOTE:
       Icons are now loaded via CSS mask-image from Bunny CDN.
       Icon elements are empty divs/spans with appropriate classes.
       CSS variables (--ui-icon-*) are set in index.js on app load.
       -------------------------------------------------------------------------- */

    /* --------------------------------------------------------------------------
       FIELD-LEVEL TRACKING REGISTRY
       
       PURPOSE:
       Makes the save button accurate. Save button only turns green when there
       are ACTUAL changes. If you toggle a switch on then off, nothing changed,
       save button stays not-green.
       
       HOW IT WORKS:
       Each field registers itself with an original value (from database).
       When a field changes, it updates its current value.
       Save button is green only if ANY field has current ≠ original.
       
       TWO TYPES OF FIELDS:
       1. Simple: For individual inputs (text, checkbox, dropdown, etc.)
          - Call registerField(id, originalValue) when field loads
          - Call updateField(id, currentValue) when field changes
          
       2. Composite: For complex structures (like formbuilder with nested data)
          - Call registerComposite(id, captureStateFn) when component loads
          - The captureStateFn returns current state, compared as JSON
       
       FOR FUTURE DEVELOPERS:
       When adding new inputs to the admin panel, you MUST:
       1. Register the field when it loads with its database value
       2. Call updateField() whenever the input changes
       3. Use a unique field ID (e.g., 'settings.website_name', 'map.spin_speed')
       
       Example for a text input:
         // When loading:
         AdminModule.registerField('settings.website_name', valueFromDatabase);
         
         // When input changes:
         input.addEventListener('input', function() {
             AdminModule.updateField('settings.website_name', input.value);
         });
       
       Example for a checkbox:
         // When loading:
         AdminModule.registerField('settings.maintenance_mode', checkboxValueFromDb);
         
         // When checkbox changes:
         checkbox.addEventListener('change', function() {
             AdminModule.updateField('settings.maintenance_mode', checkbox.checked);
         });
       -------------------------------------------------------------------------- */
    
    var fieldRegistry = {};
    
    function requireWebsiteCurrencyFromSettings(settingsObj) {
        var c = settingsObj && settingsObj.website_currency;
        if (!c || typeof c !== 'string' || !c.trim()) {
            throw new Error('[Admin] Missing required settings.website_currency');
        }
        return c.trim().toUpperCase();
    }
    
    // Register a simple field (text input, checkbox, dropdown, etc.)
    function registerField(fieldId, originalValue) {
        fieldRegistry[fieldId] = {
            type: 'simple',
            original: originalValue,
            current: originalValue
        };
    }
    
    // Update a simple field's current value
    function updateField(fieldId, currentValue) {
        if (!fieldRegistry[fieldId]) {
            console.error('[Admin] Field "' + fieldId + '" was not registered before being updated. Call registerField() first.');
            return;
        }
        fieldRegistry[fieldId].current = currentValue;
        recheckDirtyState();
    }
    
    // Remove a field from registry (for dynamic fields that get deleted)
    function unregisterField(fieldId) {
        delete fieldRegistry[fieldId];
        recheckDirtyState();
    }
    
    // Register a composite field (like formbuilder - captures entire state as JSON)
    function registerComposite(fieldId, captureStateFn) {
        var initialState = captureStateFn();
        fieldRegistry[fieldId] = {
            type: 'composite',
            original: JSON.stringify(initialState),
            captureState: captureStateFn
        };
    }
    
    // Update a composite field's baseline (called after successful save)
    function updateCompositeBaseline(fieldId) {
        var entry = fieldRegistry[fieldId];
        if (entry && entry.type === 'composite') {
            var currentState = entry.captureState();
            entry.original = JSON.stringify(currentState);
        }
    }
    
    // Check if any field has changes
    function hasFieldChanges() {
        for (var fieldId in fieldRegistry) {
            var entry = fieldRegistry[fieldId];
            if (entry.type === 'simple') {
                if (entry.current !== entry.original) {
                    return true;
                }
            } else if (entry.type === 'composite') {
                var currentState = entry.captureState();
                if (JSON.stringify(currentState) !== entry.original) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Mark all fields as saved (update original to match current)
    function markAllFieldsSaved() {
        for (var fieldId in fieldRegistry) {
            var entry = fieldRegistry[fieldId];
            if (entry.type === 'simple') {
                entry.original = entry.current;
            } else if (entry.type === 'composite') {
                var currentState = entry.captureState();
                entry.original = JSON.stringify(currentState);
            }
        }
    }
    
    // Get list of changed field IDs (for debugging)
    function getChangedFields() {
        var changed = [];
        for (var fieldId in fieldRegistry) {
            var entry = fieldRegistry[fieldId];
            if (entry.type === 'simple') {
                if (entry.current !== entry.original) {
                    changed.push(fieldId);
                }
            } else if (entry.type === 'composite') {
                var currentState = entry.captureState();
                if (JSON.stringify(currentState) !== entry.original) {
                    changed.push(fieldId);
                }
            }
        }
        return changed;
    }
    
    // Recheck and update button states based on field registry
    function recheckDirtyState() {
        var hasChanges = hasFieldChanges();
        if (hasChanges !== isDirty) {
            isDirty = hasChanges;
            updateButtonStates();
            if (hasChanges) {
                scheduleAutoSave();
            }
        }
    }
    
    // Trigger a recheck (called by other modules after they make changes)
    function notifyFieldChange() {
        recheckDirtyState();
    }

    /* --------------------------------------------------------------------------
       AUTOSAVE SETTING (persisted to database)
       -------------------------------------------------------------------------- */
    
    function loadAutosaveSetting() {
        fetch('/gateway.php?action=get-admin-settings')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data && data.settings && data.settings.admin_autosave !== undefined) {
                    // Boolean is already converted by PHP, but handle string just in case
                    var isEnabled = data.settings.admin_autosave === true || data.settings.admin_autosave === 'true';
                    if (autosaveCheckbox) {
                        autosaveCheckbox.checked = isEnabled;
                        updateAutosaveLabel();
                    }
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load autosave setting:', err);
            });
    }
    
    function saveAutosaveSetting(enabled) {
        var payload = {
            admin_autosave: enabled ? 'true' : 'false'
        };
        
        fetch('/gateway.php?action=save-admin-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                // Autosave setting saved
            }
        })
        .catch(function(err) {
            console.error('[Admin] Failed to save autosave setting:', err);
        });
    }
    
    function updateAutosaveLabel() {
        if (!autosaveCheckbox) return;
        var label = autosaveCheckbox.parentElement.querySelector('.admin-autosave-toggle-label');
        if (label) {
            label.classList.toggle('admin-autosave-toggle-label--checked', autosaveCheckbox.checked);
        }
    }

    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        cacheElements();
        if (!panel) {
            console.warn('[Admin] Admin panel not found');
            return;
        }

        bindEvents();
        initHeaderDrag();
        loadAutosaveSetting();
        
        // Initialize Settings tab (default tab)
        initSettingsTab();

        // Admin module initialized
    }
    
    function cacheElements() {
        panel = document.querySelector('.admin-panel');
        if (!panel) return;
        
        panelContent = panel.querySelector('.admin-panel-contents');
        closeBtn = panel.querySelector('.admin-panel-actions-icon-btn--close');
        saveBtn = panel.querySelector('.admin-panel-actions-icon-btn--save');
        discardBtn = panel.querySelector('.admin-panel-actions-icon-btn--discard');
        autosaveCheckbox = document.getElementById('admin-autosave-checkbox');
        tabButtons = panel.querySelectorAll('.admin-tab-bar > .button-class-2');
        tabPanels = panel.querySelectorAll('.admin-tab-contents');
        
        // Enable horizontal scrolling with mouse wheel on tab bar
        var tabBar = panel.querySelector('.admin-tab-bar');
        if (tabBar) {
            tabBar.addEventListener('wheel', function(e) {
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.preventDefault();
                    tabBar.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }
    }
    
    function initHeaderDrag() {
        var headerEl = panel.querySelector('.admin-panel-header');
        if (!headerEl || !panelContent) return;
        
        // Drag via header
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) return;
            
            var rect = panelContent.getBoundingClientRect();
            var startX = e.clientX;
            var startLeft = rect.left;
            
            function onMove(ev) {
                var dx = ev.clientX - startX;
                var newLeft = startLeft + dx;
                var maxLeft = window.innerWidth - rect.width;
                if (newLeft < 0) newLeft = 0;
                if (newLeft > maxLeft) newLeft = maxLeft;
                panelContent.style.left = newLeft + 'px';
                panelContent.style.right = 'auto';
            }
            
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        window.addEventListener('resize', function() {
            if (!panelContent.style.left) return;
            var currentLeft = parseFloat(panelContent.style.left);
            if (isNaN(currentLeft)) return;
            var maxLeft = window.innerWidth - 40;
            if (currentLeft > maxLeft) panelContent.style.left = maxLeft + 'px';
        });
    }

    function bindEvents() {
        // Bring to front when panel is clicked
        if (panel) {
            panel.addEventListener('mousedown', function() {
                App.bringToTop(panel);
            });
        }
        
        // Panel close
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                if (isDirty) {
                    showUnsavedChangesDialog();
                } else {
                    closePanel();
                }
            });
        }
        
        // Save button
        if (saveBtn) {
            saveBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent click-away handlers from closing menus
                if (!saveBtn.disabled) {
                    runSave();
                }
            });
        }
        
        // Discard button
        if (discardBtn) {
            discardBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent click-away handlers from closing menus
                if (!discardBtn.disabled) {
                    discardChanges();
                }
            });
        }
        
        // Autosave checkbox - save setting immediately and trigger autosave if enabled with pending changes
        if (autosaveCheckbox) {
            autosaveCheckbox.addEventListener('change', function() {
                // Save the setting to database immediately
                saveAutosaveSetting(autosaveCheckbox.checked);
                updateAutosaveLabel();
                
                // If enabled and there are pending changes, schedule autosave
                if (autosaveCheckbox.checked && isDirty) {
                    scheduleAutoSave();
                }
            });
        }

        // Tab switching
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    switchTab(btn.dataset.tab);
                });
            });
        }
        
        // Panel toggle is handled by lazy init wrapper outside module
        
        // Listen for member state changes (to know if admin is logged in)
        App.on('member:stateChanged', function(data) {
            // Admin panel access is controlled by header button visibility
            // which is handled in header.js
        });
    }

    /* --------------------------------------------------------------------------
       PANEL OPEN/CLOSE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panel || !panelContent) return;
        
        panel.classList.add('admin-panel--show');
        panel.setAttribute('aria-hidden', 'false');

        // Show (force a frame between "off-screen" and "visible" so slide-in
        // always transitions at the same speed as slide-out)
        panelContent.classList.remove('admin-panel-contents--visible');
        panelContent.classList.add('admin-panel-contents--hidden');
        try { void panelContent.offsetWidth; } catch (e) {}
        requestAnimationFrame(function() {
            panelContent.classList.remove('admin-panel-contents--hidden');
            panelContent.classList.add('admin-panel-contents--visible');
        });
        
        // Bring panel to front of stack
        App.bringToTop(panel);
        
        // Update header button
        App.emit('admin:opened');
        
        // Sync all picklists from Bunny CDN (1.5 second delay, background, once per session)
        setTimeout(function() {
            syncAllPicklists();
        }, 1500);
    }
    
    // Sync all picklist types from Bunny CDN (background, once per session)
    function syncAllPicklists() {
        var syncKey = 'picklists_synced';
        var alreadySynced = localStorage.getItem(syncKey) === 'true';
        
        if (alreadySynced) {
            return; // Already synced this session
        }
        
        // Get folder paths from admin settings
        fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (!res.settings) return;
                
                // Sync ALL data types from their Bunny CDN folders
                // Each folder syncs to its corresponding table (category_icons, system_images, amenities, currencies, phone_prefixes)
                // This ensures all available filenames are in the database "basket" for instant menu loading
                var foldersToSync = [
                    { folder: res.settings.folder_system_images, option_group: 'system-image' },
                    { folder: res.settings.folder_category_icons, option_group: 'category-icon' },
                    { folder: res.settings.folder_amenities, option_group: 'amenity' },
                    { folder: res.settings.folder_currencies, option_group: 'currency' },
                    { folder: res.settings.folder_phone_prefixes, option_group: 'phone-prefix' },
                    { folder: res.settings.folder_countries, option_group: 'country' },
                    { folder: res.settings.folder_age_ratings, option_group: 'age-rating' }
                ];
                
                // Sync each folder in parallel (non-blocking, background)
                // Each sync runs only once per session (checked via localStorage)
                var syncPromises = [];
                foldersToSync.forEach(function(item) {
                    if (!item.folder) return;
                    
                    // Check if this specific folder has been synced
                    var folderSyncKey = 'picklist_synced_' + item.option_group + '_' + item.folder;
                    var folderSynced = localStorage.getItem(folderSyncKey) === 'true';
                    
                    if (!folderSynced) {
                        // Fetch file list from Bunny CDN
                        var syncPromise = fetch('/gateway.php?action=list-files&folder=' + encodeURIComponent(item.folder))
                            .then(function(r) { return r.json(); })
                            .then(function(fileRes) {
                                if (fileRes.success && Array.isArray(fileRes.icons) && fileRes.icons.length > 0) {
                                    // Sync to corresponding table (category_icons, system_images, amenities, currencies, or phone_prefixes)
                                    return fetch('/gateway.php?action=list-files', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            filenames: fileRes.icons,
                                            option_group: item.option_group
                                        })
                                    })
                                    .then(function(r) { return r.json(); })
                                    .then(function(syncRes) {
                                        if (syncRes.success) {
                                            localStorage.setItem(folderSyncKey, 'true');
                                            if (syncRes.inserted_count > 0 || syncRes.deleted_count > 0) {
                                                // Synced option group
                                            }
                                        } else {
                                            console.error('[Admin] Sync failed for ' + item.option_group + ':', syncRes.errors || syncRes.message || 'Unknown error');
                                            if (syncRes.errors && syncRes.errors.length > 0) {
                                                syncRes.errors.forEach(function(err) {
                                                    console.error('[Admin] ' + item.option_group + ' error:', err);
                                                });
                                            }
                                        }
                                    })
                                    .catch(function(err) {
                                        console.warn('[Admin] Failed to sync ' + item.option_group + ':', err);
                                    });
                                }
                            })
                            .catch(function(err) {
                                console.warn('[Admin] Failed to fetch ' + item.option_group + ' files:', err);
                            });
                        
                        syncPromises.push(syncPromise);
                    }
                });
                
                // Mark as synced when all complete
                Promise.all(syncPromises).then(function() {
                    localStorage.setItem(syncKey, 'true');
                });
            })
            .catch(function(err) {
                console.warn('[Admin] Failed to load admin settings for sync:', err);
            });
    }

    function closePanel() {
        if (!panel || !panelContent) return;
        
        panelContent.classList.remove('admin-panel-contents--visible');
        panelContent.classList.add('admin-panel-contents--hidden');
        
        function finalizeClose() {
            panel.classList.remove('admin-panel--show');
            if (document.activeElement && panel.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (_eBlur) {}
            }
            panel.setAttribute('aria-hidden', 'true');
            try { App.removeFromStack(panel); } catch (_eStack) {}
        }
        
        // With transitions disabled, transitionend will never fire. Close immediately.
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(panelContent) : null;
            var dur = cs ? String(cs.transitionDuration || '0s').split(',')[0].trim() : '0s';
            if (dur === '0s' || dur === '0ms') {
                finalizeClose();
            } else {
                // Wait for transition then hide panel
                panelContent.addEventListener('transitionend', function handler() {
                    panelContent.removeEventListener('transitionend', handler);
                    finalizeClose();
                }, { once: true });
            }
        } catch (_eDur) {
            finalizeClose();
        }
        
        // Update header button
        App.emit('admin:closed');
    }

    /* --------------------------------------------------------------------------
       TAB SWITCHING
       -------------------------------------------------------------------------- */
    
    function switchTab(tabName) {
        if (!tabButtons || !tabPanels) return;

        // Update tab buttons
        tabButtons.forEach(function(btn) {
            var isSelected = btn.dataset.tab === tabName;
            // Button Class 2 uses aria-selected for styling - no class toggle needed
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });

        // Update tab panels
        tabPanels.forEach(function(panel) {
            var isActive = panel.id === 'admin-tab-' + tabName;
            panel.classList.toggle('admin-tab-contents--active', isActive);
        });
        
        // Initialize tab content on first view
        if (tabName === 'settings') {
            initSettingsTab();
        } else if (tabName === 'messages') {
            initMessagesTab();
        } else if (tabName === 'map') {
            initMapTab();
        } else if (tabName === 'checkout') {
            initCheckoutTab();
        } else if (tabName === 'moderation') {
            initModerationTab();
        } else if (tabName === 'sitemap') {
            initSitemapTab();
        }
    }

    /* --------------------------------------------------------------------------
       SITEMAP TAB
       -------------------------------------------------------------------------- */
    
    var sitemapTabInitialized = false;
    
    function initSitemapTab() {
        if (sitemapTabInitialized) return;
        var iframe = document.getElementById('admin-sitemap-iframe');
        if (!iframe) return;
        var src = iframe.getAttribute('data-src');
        if (src) iframe.setAttribute('src', src);
        sitemapTabInitialized = true;
    }

    /* --------------------------------------------------------------------------
       CHANGE TRACKING (uses field registry above)
       -------------------------------------------------------------------------- */
    
    // isDirty is now derived from field registry via recheckDirtyState()
    var isDirty = false;
    
    // Called by other modules to trigger a recheck after changes
    function markDirty() {
        recheckDirtyState();
    }
    
    // Called after successful save
    function markSaved() {
        markAllFieldsSaved();
        isDirty = false;
        updateButtonStates();
        // Clear any pending autosave since there's nothing to save
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
    }
    
    function updateButtonStates() {
        if (saveBtn) {
            saveBtn.disabled = !isDirty;
            saveBtn.classList.toggle('admin-panel-actions-icon-btn--disabled', !isDirty);
            var saveIcon = saveBtn.querySelector('.admin-panel-actions-icon-btn-icon');
            if (saveIcon) {
                saveIcon.classList.toggle('admin-panel-actions-icon-btn-icon--disabled', !isDirty);
                saveIcon.classList.toggle('admin-panel-actions-icon-btn-icon--save-enabled', isDirty);
            }
        }
        
        if (discardBtn) {
            discardBtn.disabled = !isDirty;
            discardBtn.classList.toggle('admin-panel-actions-icon-btn--disabled', !isDirty);
            var discardIcon = discardBtn.querySelector('.admin-panel-actions-icon-btn-icon');
            if (discardIcon) {
                discardIcon.classList.toggle('admin-panel-actions-icon-btn-icon--disabled', !isDirty);
                discardIcon.classList.toggle('admin-panel-actions-icon-btn-icon--discard-enabled', isDirty);
            }
        }
    }

    /* --------------------------------------------------------------------------
       SAVE/DISCARD
       -------------------------------------------------------------------------- */
    
    var autoSaveTimer = null;
    var isSaving = false;
    
    function isAutoSaveEnabled() {
        return autosaveCheckbox && autosaveCheckbox.checked;
    }
    
    function hasActualChanges() {
        // Use field registry to check for actual changes
        return hasFieldChanges();
    }
    
    function runSave(options) {
        options = options || {};
        
        // Prevent concurrent saves
        if (isSaving) {
            // Save already in progress, skipping
            return;
        }
        
        // Clear any pending autosave
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
        
        // Final check: are there actual changes to save?
        if (!hasActualChanges()) {
            // No actual changes to save
            markSaved();
            return;
        }
        
        isSaving = true;
        
        // Collect all save promises
        var savePromises = [];
        
        // Save formbuilder data
        if (window.FormbuilderModule && typeof FormbuilderModule.save === 'function') {
            savePromises.push(FormbuilderModule.save());
        }
        
        // Save modified settings (uses save-admin-settings endpoint)
        var modifiedSettings = getModifiedSettings();
        if (Object.keys(modifiedSettings).length > 0) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(modifiedSettings)
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save settings');
                    }
                    // Settings saved
                })
            );
        }
        
        // Save modified messages (uses save-admin-settings endpoint)
        var modifiedMessages = getModifiedMessages();
        if (modifiedMessages.length > 0) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: modifiedMessages })
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save messages');
                    }
                    // Messages saved
                    // Update composite baseline (like Formbuilder does)
                    updateCompositeBaseline('messages');
                })
            );
        }
        
        // Save modified fieldset tooltips (uses save-admin-settings endpoint)
        var modifiedTooltips = getModifiedFieldsetTooltips();
        if (modifiedTooltips.length > 0) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fieldset_tooltips: modifiedTooltips })
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save fieldset tooltips');
                    }
                    // Fieldset tooltips saved
                    // Update composite baseline (like Formbuilder does)
                    updateCompositeBaseline('messages');
                })
            );
        }
        
        // Save modified field tooltips (uses save-admin-settings endpoint)
        var modifiedFieldTooltips = getModifiedFieldTooltips();
        if (modifiedFieldTooltips.length > 0) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ field_tooltips: modifiedFieldTooltips })
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save field tooltips');
                    }
                    // Field tooltips saved
                    // Update composite baseline (like Formbuilder does)
                    updateCompositeBaseline('messages');
                })
            );
        }
        
        // Save modified category names (uses save-admin-settings endpoint)
        var modifiedCategoryNames = getModifiedCategoryNames();
        if (Object.keys(modifiedCategoryNames).length > 0) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(modifiedCategoryNames)
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save category names');
                    }
                    // Category names saved
                    updateCompositeBaseline('messages');
                })
            );
        }
        
        // Save category order if changed (uses save-admin-settings endpoint)
        var newCategoryOrder = getCategoryOrderIfChanged();
        if (newCategoryOrder) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ msg_category_order: JSON.stringify(newCategoryOrder) })
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save category order');
                    }
                    // Category order saved
                    updateCompositeBaseline('messages');
                })
            );
        }
        
        // Save checkout options (uses save-admin-settings endpoint)
        var checkoutOptions = getCheckoutOptionsFromUI();
        if (checkoutOptions.length > 0 || document.getElementById('adminCheckoutTiers')) {
            savePromises.push(
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkout_options: checkoutOptions })
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (!data.success) {
                        throw new Error(data.message || 'Failed to save checkout options');
                    }
                    // Checkout options saved
                    updateCompositeBaseline('checkout_options');
                })
            );
        }
        
        // Run all saves
        Promise.all(savePromises)
            .then(function() {
                // All saves completed successfully
                isSaving = false;
                
                // Update baselines to saved values
                markSaved();
                
                // Show success message
                getMessage('msg_admin_saved', {}, true).then(function(message) {
                    if (message) {
                        ToastComponent.showSuccess(message);
                    }
                });
                
                // If user made changes during save, recheckDirtyState will detect them
                // via the next input event - no need to check here
                
                if (options.closeAfter) {
                    closePanel();
                }
            })
            .catch(function(err) {
                console.error('[Admin] Save failed:', err);
                isSaving = false;
                
                // Show error message
                var errorKey = 'msg_admin_save_error_response';
                if (err && (err.message && err.message.includes('fetch')) || err.name === 'TypeError') {
                    errorKey = 'msg_admin_save_error_network';
                }
                getMessage(errorKey, {}, true).then(function(message) {
                    if (message) {
                        ToastComponent.showError(message);
                    }
                });
                
                // Keep dirty state on error - don't lose user's changes
                // Buttons stay lit so user knows save failed and can retry
            });
    }
    
    function discardChanges() {
        // Prevent discard during save
        if (isSaving) {
            // Cannot discard during save
            return;
        }
        
        // Clear any pending autosave
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
        
        // Reset tabs to original values before clearing registry
        resetSettingsToOriginal();
        resetMessagesToOriginal();
        resetCheckoutOptionsToOriginal();
        resetMapTabToOriginal();
        
        // Reset field registry values (current = original) instead of clearing
        // This preserves registrations so fields don't need to re-register
        for (var fieldId in fieldRegistry) {
            var entry = fieldRegistry[fieldId];
            if (entry.type === 'simple') {
                entry.current = entry.original;
            }
        }
        
        // Tell formbuilder to re-fetch from database (not restore from cache)
        if (window.FormbuilderModule && typeof FormbuilderModule.discard === 'function') {
            FormbuilderModule.discard();
        }
        
        // Emit event for other modules to discard their changes
        App.emit('admin:discard');
        
        // Changes discarded
        isDirty = false;
        updateButtonStates();
        
        // Show discard message
        getMessage('msg_admin_discarded', {}, true).then(function(message) {
            if (message) {
                ToastComponent.show(message);
            }
        });
    }
    
    function scheduleAutoSave() {
        if (!isAutoSaveEnabled()) return;
        if (!isDirty) return;
        if (isSaving) return; // Don't schedule during active save
        
        // Clear existing timer
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        
        // Schedule autosave after 800ms of inactivity
        autoSaveTimer = setTimeout(function() {
            // Re-verify conditions at execution time
            if (isDirty && isAutoSaveEnabled() && !isSaving && hasActualChanges()) {
                runSave({ closeAfter: false });
            }
        }, 800);
    }

    /* --------------------------------------------------------------------------
       MESSAGES TAB
       
       FIELD-LEVEL TRACKING:
       Like Formbuilder, Messages registers as a "composite" field.
       Instead of tracking individual textareas, it captures all message
       values from the DOM and compares as JSON.
       
       HOW IT WORKS:
       1. After messages load, we call:
          registerComposite('messages', captureMessagesState)
       
       2. captureMessagesState() reads all textarea values from DOM
       
       3. When any textarea changes, notifyChange() tells AdminModule to recheck.
          AdminModule calls captureMessagesState() and compares to baseline.
       
       4. If JSON differs from baseline → save button green
          If JSON matches baseline → save button not green
       
       5. After save, updateCompositeBaseline('messages') is called
          to set the new baseline.
       -------------------------------------------------------------------------- */
    
    var messagesContainer = null;
    var messagesInitialized = false;
    var messagesLoaded = false; // Don't notify during initial load
    
    // Message categories (icons loaded from database)
    var MESSAGE_CATEGORIES = [
        { key: 'user', name: 'User Messages', icon: '', description: 'Messages for public visitors' },
        { key: 'member', name: 'Member Messages', icon: '', description: 'Messages for authenticated members' },
        { key: 'admin', name: 'Admin Messages', icon: '', description: 'Messages for admin panel' },
        { key: 'email', name: 'Email Messages', icon: '', description: 'Email communications' },
        { key: 'fieldset-tooltips', name: 'Fieldset Tooltips', icon: '', description: 'Tooltip help text for form fieldsets' },
        { key: 'field-tooltips', name: 'Field Tooltips', icon: '', description: 'Tooltip help text for individual form fields' }
    ];
    
    // Map database container_key to our category key
    var CONTAINER_KEY_MAP = {
        'msg_user': 'user',
        'msg_member': 'member',
        'msg_admin': 'admin',
        'msg_email': 'email'
    };
    
    // Capture current state of all messages from DOM (like Formbuilder's captureFormbuilderState)
    function captureMessagesState() {
        var state = { messages: {}, tooltips: {}, fieldTooltips: {}, categoryNames: {}, categoryOrder: [] };

        if (!messagesContainer) return state;

        // Capture category order and names (in DOM order, reflects drag changes)
        messagesContainer.querySelectorAll('.admin-messages-accordion').forEach(function(accordion) {
            var key = accordion.dataset.messageCategory;
            if (key) {
                state.categoryOrder.push(key);
                var nameInput = accordion.querySelector('.admin-messages-accordion-editpanel-input[data-category-key]');
                if (nameInput) {
                    state.categoryNames[key] = nameInput.value;
                }
            }
        });

        // Capture message textareas (keyed by message_key so IDs can be rebucketed safely)
        messagesContainer.querySelectorAll('.admin-message-text-input[data-message-key]').forEach(function(textarea) {
            var key = textarea.dataset.messageKey;
            if (key) {
                state.messages[key] = textarea.value;
            }
        });

        // Capture tooltip textareas
        messagesContainer.querySelectorAll('.admin-message-text-input[data-fieldset-id]').forEach(function(textarea) {
            var id = textarea.dataset.fieldsetId;
            if (id) {
                state.tooltips[id] = textarea.value;
            }
        });

        // Capture field tooltip textareas
        messagesContainer.querySelectorAll('.admin-message-text-input[data-field-id]').forEach(function(textarea) {
            var id = textarea.dataset.fieldId;
            if (id) {
                state.fieldTooltips[id] = textarea.value;
            }
        });

        return state;
    }
    
    // Notify change (like Formbuilder's notifyChange)
    function notifyMessagesChange() {
        if (!messagesLoaded) return; // Don't notify during initial load
        notifyFieldChange();
    }
    
    function initMessagesTab() {
        if (messagesInitialized) return;
        
        messagesContainer = document.getElementById('admin-tab-messages');
        if (!messagesContainer) return;
        
        // Clear placeholder content
        messagesContainer.innerHTML = '';
        
        // Create search box (sticky)
        var searchWrap = document.createElement('div');
        searchWrap.className = 'admin-messages-search';
        
        var searchIcon = document.createElement('span');
        searchIcon.className = 'admin-messages-search-icon';
        
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'admin-messages-search-input';
        searchInput.placeholder = 'Search messages...';
        searchInput.setAttribute('aria-label', 'Search messages');
        
        searchWrap.appendChild(searchIcon);
        searchWrap.appendChild(searchInput);
        messagesContainer.appendChild(searchWrap);
        
        // Create container for accordions
        var accordionsWrap = document.createElement('div');
        accordionsWrap.className = 'admin-messages-container';
        messagesContainer.appendChild(accordionsWrap);
        
        // Search functionality
        searchInput.addEventListener('input', function() {
            var query = searchInput.value.toLowerCase().trim();
            filterMessages(query, accordionsWrap);
        });
        
        // Load category icons then render
        loadMessageCategoryIcons().then(function() {
            renderMessagesAccordions(accordionsWrap);
            loadMessagesFromDatabase();
            loadFieldsetTooltips();
            loadFieldTooltips();
        });
        
        messagesInitialized = true;
    }
    
    function filterMessages(query, accordionsWrap) {
        var accordions = accordionsWrap.querySelectorAll('.admin-messages-accordion');
        
        accordions.forEach(function(accordion) {
            var content = accordion.querySelector('.admin-messages-accordion-content');
            var header = accordion.querySelector('.admin-messages-accordion-header');
            var messageItems = accordion.querySelectorAll('.admin-message-item');
            var hasVisibleItems = false;
            
            if (!query) {
                // No search - show all items, collapse accordions
                messageItems.forEach(function(item) {
                    item.style.display = '';
                });
                accordion.style.display = '';
                // Collapse accordion
                accordion.classList.remove('admin-messages-accordion--open');
                if (content) content.classList.add('admin-messages-accordion-content--hidden');
                if (header) {
                    var arrow = header.querySelector('.admin-messages-accordion-header-arrow');
                    if (arrow) arrow.classList.remove('admin-messages-accordion-header-arrow--open');
                }
                return;
            }
            
            // Filter items
            messageItems.forEach(function(item) {
                var label = item.querySelector('.admin-message-label');
                var textDisplay = item.querySelector('.admin-message-text-display');
                var textInput = item.querySelector('.admin-message-text-input');
                
                var labelText = label ? label.textContent.toLowerCase() : '';
                var displayText = textDisplay ? textDisplay.textContent.toLowerCase() : '';
                var inputText = textInput ? textInput.value.toLowerCase() : '';
                
                var matches = labelText.includes(query) || displayText.includes(query) || inputText.includes(query);
                
                item.style.display = matches ? '' : 'none';
                if (matches) hasVisibleItems = true;
            });
            
            // Show/hide accordion based on matches
            accordion.style.display = hasVisibleItems ? '' : 'none';
            
            // Open accordions with matches
            if (hasVisibleItems) {
                accordion.classList.add('admin-messages-accordion--open');
                if (content) content.classList.remove('admin-messages-accordion-content--hidden');
                if (header) {
                    var arrow = header.querySelector('.admin-messages-accordion-header-arrow');
                    if (arrow) arrow.classList.add('admin-messages-accordion-header-arrow--open');
                }
            }
        });
    }
    
    function loadMessageCategoryIcons() {
        // Reuse settingsData if Settings tab already loaded it
        var useExisting = settingsInitialized && Object.keys(settingsData).length > 0;
        
        if (useExisting) {
            MESSAGE_CATEGORIES.forEach(function(cat) {
                var imageKey = 'msg_category_' + cat.key + '_icon';
                // Get filename from system_images, convert to full URL
                if (settingsData.system_images && settingsData.system_images[imageKey]) {
                    var filename = settingsData.system_images[imageKey];
                    cat.icon = window.App.getImageUrl('systemImages', filename);
                }
                var nameKey = 'msg_category_' + cat.key + '_name';
                if (settingsData[nameKey]) {
                    cat.name = settingsData[nameKey];
                }
            });
            return Promise.resolve();
        }
        
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success) {
                    // Cache settings + system_images so Messages tab can build pickers without opening Settings tab
                    if (data.settings) {
                        // Shallow-merge settings keys (do not overwrite the object ref elsewhere)
                        for (var k in data.settings) {
                            settingsData[k] = data.settings[k];
                        }
                    }
                    if (data.system_images) {
                        if (!settingsData.system_images) settingsData.system_images = {};
                        for (var ik in data.system_images) {
                            settingsData.system_images[ik] = data.system_images[ik];
                        }
                    }
                    
                    MESSAGE_CATEGORIES.forEach(function(cat) {
                        var imageKey = 'msg_category_' + cat.key + '_icon';
                        // Get filename from system_images, convert to full URL
                        if (data.system_images && data.system_images[imageKey]) {
                            var filename = data.system_images[imageKey];
                            cat.icon = window.App.getImageUrl('systemImages', filename);
                        }
                        // Also check for custom name
                        var nameKey = 'msg_category_' + cat.key + '_name';
                        if (data.settings && data.settings[nameKey]) {
                            cat.name = data.settings[nameKey];
                        }
                    });
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load message category icons:', err);
            });
    }
    
    
    function renderMessagesAccordions(container) {
        container.innerHTML = '';
        
        MESSAGE_CATEGORIES.forEach(function(cat) {
            var accordion = document.createElement('div');
            accordion.className = 'admin-messages-accordion accordion-class-1';
            accordion.dataset.messageCategory = cat.key;
            
            // Header (same structure as formbuilder)
            var header = document.createElement('div');
            header.className = 'admin-messages-accordion-header accordion-header';
            
            // Header image
            var headerImg = document.createElement('img');
            headerImg.className = 'admin-messages-accordion-header-image';
            if (cat.icon) {
                headerImg.src = cat.icon;
                headerImg.alt = '';
            }
            // No fallback - icon must come from database
            
            // Header text
            var headerText = document.createElement('span');
            headerText.className = 'admin-messages-accordion-header-text';
            headerText.textContent = cat.name;
            
            // Header arrow
            var headerArrow = document.createElement('span');
            headerArrow.className = 'admin-messages-accordion-header-arrow';
            
            // Drag handle
            var headerDrag = document.createElement('div');
            headerDrag.className = 'admin-messages-accordion-header-drag';
            var headerDragIcon = document.createElement('div');
            headerDragIcon.className = 'admin-messages-accordion-header-drag-icon';
            headerDrag.appendChild(headerDragIcon);
            
            // Edit area (wrapper around pencil icon, like formbuilder)
            var headerEditArea = document.createElement('div');
            headerEditArea.className = 'admin-messages-accordion-header-editarea';
            var headerEdit = document.createElement('div');
            headerEdit.className = 'admin-messages-accordion-header-edit';
            headerEditArea.appendChild(headerEdit);
            
            header.appendChild(headerImg);
            header.appendChild(headerText);
            header.appendChild(headerArrow);
            header.appendChild(headerDrag);
            header.appendChild(headerEditArea);
            
            // Edit panel (sibling to header, like formbuilder)
            var editPanel = document.createElement('div');
            editPanel.className = 'admin-messages-accordion-editpanel';
            
            // Name input row
            var nameRow = document.createElement('div');
            nameRow.className = 'admin-messages-accordion-editpanel-row';
            
            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'admin-messages-accordion-editpanel-input input-class-1';
            nameInput.value = cat.name;
            nameInput.dataset.categoryKey = cat.key;
            nameInput.oninput = function() {
                headerText.textContent = nameInput.value || cat.name;
                notifyMessagesChange();
            };
            
            nameRow.appendChild(nameInput);
            editPanel.appendChild(nameRow);
            
            // Icon picker (System Images) - saves to admin_settings via system_images.* payload
            (function() {
                if (!window.SystemImagePickerComponent) return;
                
                var imageKey = 'msg_category_' + cat.key + '_icon';
                var initialValue = '';
                if (settingsData.system_images && settingsData.system_images[imageKey]) {
                    initialValue = settingsData.system_images[imageKey];
                }
                
                var iconRow = document.createElement('div');
                iconRow.className = 'admin-messages-accordion-editpanel-row';
                
                var picker = SystemImagePickerComponent.buildPicker({
                    databaseValue: initialValue,
                    onSelect: function(imagePath) {
                        // Extract filename from full path
                        var filename = imagePath;
                        if (imagePath && imagePath.indexOf('/') !== -1) {
                            filename = imagePath.split('/').pop();
                        }
                        
                        // Update header preview immediately
                        cat.icon = imagePath || '';
                        if (cat.icon) {
                            headerImg.src = cat.icon;
                            headerImg.alt = '';
                        } else {
                            headerImg.removeAttribute('src');
                        }
                        
                        updateField('system_images.' + imageKey, filename || '');
                        notifyMessagesChange();
                    }
                });
                
                picker.element.dataset.settingKey = imageKey;
                picker.element.dataset.isSystemImage = 'true';
                iconRow.appendChild(picker.element);
                editPanel.appendChild(iconRow);
                
                registerField('system_images.' + imageKey, initialValue);
            })();
            
            // Content area (for messages list)
            var content = document.createElement('div');
            content.className = 'admin-messages-accordion-content admin-messages-accordion-content--hidden accordion-body';
            
            accordion.appendChild(header);
            accordion.appendChild(editPanel);
            accordion.appendChild(content);
            container.appendChild(accordion);
            
            // Category drag and drop - only via drag handle (same as formbuilder)
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
                var siblings = Array.from(container.querySelectorAll('.admin-messages-accordion'));
                dragStartIndex = siblings.indexOf(accordion);
                e.dataTransfer.effectAllowed = 'move';
                accordion.classList.add('dragging');
            });
            accordion.addEventListener('dragend', function() {
                accordion.classList.remove('dragging');
                accordion.draggable = false;
                // Only notify if position actually changed
                var siblings = Array.from(container.querySelectorAll('.admin-messages-accordion'));
                var currentIndex = siblings.indexOf(accordion);
                if (currentIndex !== dragStartIndex) {
                    notifyMessagesChange();
                }
                dragStartIndex = -1;
            });
            accordion.addEventListener('dragover', function(e) {
                e.preventDefault();
                var dragging = container.querySelector('.admin-messages-accordion.dragging');
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
            
            // Edit area click - toggle editing mode (like formbuilder)
            headerEditArea.addEventListener('click', function(e) {
                e.stopPropagation();
                var isEditing = accordion.classList.contains('admin-messages-accordion--editing');
                closeAllMessagesEditPanels();
                if (!isEditing) {
                    accordion.classList.add('admin-messages-accordion--editing');
                }
                syncMessagesAccordionUi(accordion);
            });
            
            // Header click (except edit area/drag) - toggle open/close (like formbuilder)
            header.addEventListener('click', function(e) {
                if (e.target.closest('.admin-messages-accordion-header-editarea')) return;
                if (e.target.closest('.admin-messages-accordion-header-drag')) return;
                if (!accordion.classList.contains('admin-messages-accordion--editing')) {
                    closeAllMessagesEditPanels();
                }
                accordion.classList.toggle('admin-messages-accordion--open');
                content.classList.toggle('admin-messages-accordion-content--hidden');
                syncMessagesAccordionUi(accordion);
            });
            
            syncMessagesAccordionUi(accordion);
        });
        
        // Bind document click to close edit panels (like formbuilder)
        bindMessagesDocumentListeners();
    }
    
    function closeAllMessagesEditPanels() {
        if (!messagesContainer) return;
        messagesContainer.querySelectorAll('.admin-messages-accordion--editing').forEach(function(el) {
            el.classList.remove('admin-messages-accordion--editing');
            syncMessagesAccordionUi(el);
        });
    }

    function syncMessagesAccordionUi(accordion) {
        if (!accordion) return;
        var isOpen = accordion.classList.contains('admin-messages-accordion--open');
        var isEditing = accordion.classList.contains('admin-messages-accordion--editing');
        var arrow = accordion.querySelector('.admin-messages-accordion-header-arrow');
        var editArea = accordion.querySelector('.admin-messages-accordion-header-editarea');
        var editPanel = accordion.querySelector('.admin-messages-accordion-editpanel');
        accordion.classList.toggle('accordion-class-1--open', isOpen || isEditing);
        if (arrow) arrow.classList.toggle('admin-messages-accordion-header-arrow--open', !!isOpen);
        if (editArea) editArea.classList.toggle('admin-messages-accordion-header-editarea--editing', !!isEditing);
        if (editPanel) editPanel.classList.toggle('admin-messages-accordion-editpanel--editing', !!isEditing);
    }
    
    function bindMessagesDocumentListeners() {
        // Close edit panels when clicking outside (like formbuilder)
        document.addEventListener('click', function(e) {
            if (!messagesContainer) return;
            if (!e.target.closest('.admin-messages-accordion-editpanel') &&
                !e.target.closest('.admin-messages-accordion-header-editarea') &&
                !e.target.closest('.admin-messages-accordion-header')) {
                closeAllMessagesEditPanels();
            }
        });
    }
    
    function loadMessagesFromDatabase() {
        fetch('/gateway.php?action=get-admin-settings&include_messages=true')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.messages) {
                    populateMessagesIntoAccordions(data.messages);
                    registerMessagesCompositeIfReady();
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load messages:', err);
            });
    }
    
    // Track loading state for messages, fieldset tooltips, and field tooltips
    var messagesDataLoaded = false;
    var fieldsetTooltipsLoaded = false;
    var fieldTooltipsLoaded = false;
    
    function registerMessagesCompositeIfReady() {
        messagesDataLoaded = true;
        if (messagesDataLoaded && fieldsetTooltipsLoaded && fieldTooltipsLoaded) {
            // Register messages as composite field (like Formbuilder)
            registerComposite('messages', captureMessagesState);
            messagesLoaded = true;
        }
    }

    function registerFieldsetTooltipsCompositeIfReady() {
        fieldsetTooltipsLoaded = true;
        if (messagesDataLoaded && fieldsetTooltipsLoaded && fieldTooltipsLoaded) {
            // Register messages as composite field (like Formbuilder)
            registerComposite('messages', captureMessagesState);
            messagesLoaded = true;
        }
    }

    function registerFieldTooltipsCompositeIfReady() {
        fieldTooltipsLoaded = true;
        if (messagesDataLoaded && fieldsetTooltipsLoaded && fieldTooltipsLoaded) {
            // Register messages as composite field (like Formbuilder)
            registerComposite('messages', captureMessagesState);
            messagesLoaded = true;
        }
    }
    
    // Collect modified field tooltips for saving (compares DOM to composite baseline)
    function getModifiedFieldTooltips() {
        var modified = [];
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return modified;
        
        var originalState = JSON.parse(entry.original);
        var currentState = captureMessagesState();
        
        // Compare each tooltip
        for (var id in currentState.fieldTooltips) {
            var currentValue = currentState.fieldTooltips[id];
            var originalValue = originalState.fieldTooltips ? originalState.fieldTooltips[id] : undefined;
            if (currentValue !== originalValue) {
                modified.push({
                    id: parseInt(id, 10),
                    field_tooltip: currentValue
                });
            }
        }
        
        return modified;
    }

    
    function populateMessagesIntoAccordions(messageContainers) {
        messageContainers.forEach(function(container) {
            var categoryKey = CONTAINER_KEY_MAP[container.container_key];
            if (!categoryKey) return;
            
            var accordion = messagesContainer.querySelector('[data-message-category="' + categoryKey + '"]');
            if (!accordion) return;
            
            var content = accordion.querySelector('.admin-messages-accordion-content');
            if (!content) return;
            
            content.innerHTML = '';
            
            if (container.messages && container.messages.length > 0) {
                var messagesList = document.createElement('div');
                messagesList.className = 'admin-messages-list';
                
                container.messages.forEach(function(message) {
                    var messageItem = createMessageItem(message);
                    messagesList.appendChild(messageItem);
                });
                
                content.appendChild(messagesList);
            } else {
                var emptyMsg = document.createElement('div');
                emptyMsg.className = 'admin-messages-empty';
                emptyMsg.textContent = 'No messages in this category';
                content.appendChild(emptyMsg);
            }
        });
    }
    
    function createMessageItem(message) {
        var item = document.createElement('div');
        item.className = 'admin-message-item';
        item.setAttribute('role', 'button');
        item.dataset.messageId = message.id;
        item.dataset.messageKey = message.message_key;
        
        var originalValue = message.message_text || '';
        
        // Label with hover popup
        var label = document.createElement('div');
        label.className = 'admin-message-label';
        label.textContent = message.message_name || message.message_key;
        
        // Hover popup
        var popup = document.createElement('div');
        popup.className = 'admin-message-hover-popup';
        
        // Type badge
        var typeBadge = document.createElement('span');
        typeBadge.className = 'admin-message-type-badge admin-message-type-badge--' + message.message_type;
        typeBadge.textContent = message.message_type;
        popup.appendChild(typeBadge);
        
        // Description
        if (message.message_description) {
            var desc = document.createElement('div');
            desc.className = 'admin-message-popup-description';
            desc.textContent = message.message_description;
            popup.appendChild(desc);
        }
        
        // Placeholders
        if (message.placeholders && message.placeholders.length > 0) {
            var placeholders = document.createElement('div');
            placeholders.className = 'admin-message-popup-placeholders';
            var title = document.createElement('span');
            title.className = 'admin-message-popup-placeholders-title';
            title.textContent = 'Placeholders:';
            placeholders.appendChild(title);
            
            message.placeholders.forEach(function(p) {
                var code = document.createElement('code');
                code.className = 'admin-message-popup-placeholders-code';
                code.textContent = '{' + p + '}';
                placeholders.appendChild(document.createTextNode(' '));
                placeholders.appendChild(code);
            });
            popup.appendChild(placeholders);
        }
        
        label.appendChild(popup);
        
        // Show popup on hover
        label.addEventListener('mouseenter', function() {
            popup.classList.add('admin-message-hover-popup--visible');
        });
        label.addEventListener('mouseleave', function() {
            popup.classList.remove('admin-message-hover-popup--visible');
        });
        
        // Text display (click to edit)
        var textDisplay = document.createElement('div');
        textDisplay.className = 'admin-message-text-display';
        textDisplay.innerHTML = originalValue;
        textDisplay.title = 'Click to edit';
        
        // Text input (hidden by default)
        var textInput = document.createElement('textarea');
        textInput.className = 'admin-message-text-input admin-message-text-input--hidden';
        textInput.value = originalValue;
        textInput.rows = 3;
        textInput.dataset.messageKey = message.message_key;
        
        // Click to edit
        textDisplay.addEventListener('click', function() {
            textDisplay.classList.add('admin-message-text-display--hidden');
            textInput.classList.remove('admin-message-text-input--hidden');
            textInput.focus();
        });
        
        // Track changes - notify AdminModule to recheck (like Formbuilder)
        textInput.addEventListener('input', function() {
            textDisplay.innerHTML = textInput.value;
            notifyMessagesChange();
        });
        
        // Blur to close
        textInput.addEventListener('blur', function() {
            textDisplay.innerHTML = textInput.value;
            textDisplay.classList.remove('admin-message-text-display--hidden');
            textInput.classList.add('admin-message-text-input--hidden');
        });
        
        item.appendChild(label);
        item.appendChild(textDisplay);
        item.appendChild(textInput);
        TextareaResizeComponent.attach(textInput);
        
        return item;
    }
    
    function loadFieldsetTooltips() {
        // Fetch fieldsets from get-form endpoint (returns form data with fieldsets)
        fetch('/gateway.php?action=get-form')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.formData && data.formData.fieldsets) {
                    populateFieldsetTooltips(data.formData.fieldsets);
                    registerFieldsetTooltipsCompositeIfReady();
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load fieldset tooltips:', err);
            });
    }

    function loadFieldTooltips() {
        // Fetch fields from get-form endpoint (returns form data with fields)
        fetch('/gateway.php?action=get-form')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.formData && data.formData.fields) {
                    populateFieldTooltips(data.formData.fields);
                    registerFieldTooltipsCompositeIfReady();
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load field tooltips:', err);
            });
    }

    function populateFieldTooltips(fields) {
        var accordion = messagesContainer.querySelector('[data-message-category="field-tooltips"]');
        if (!accordion) return;
        
        var content = accordion.querySelector('.admin-messages-accordion-content');
        if (!content) return;
        
        content.innerHTML = '';
        
        if (fields && fields.length > 0) {
            var tooltipsList = document.createElement('div');
            tooltipsList.className = 'admin-messages-list';
            
            // Sort fields by ID or key
            var sorted = fields.slice().sort(function(a, b) {
                return (a.field_key || '').localeCompare((b.field_key || ''));
            });
            
            sorted.forEach(function(field) {
                var item = createFieldTooltipItem(field);
                tooltipsList.appendChild(item);
            });
            
            content.appendChild(tooltipsList);
        } else {
            var emptyMsg = document.createElement('div');
            emptyMsg.className = 'admin-messages-empty';
            emptyMsg.textContent = 'No fields found';
            content.appendChild(emptyMsg);
        }
    }

    function createFieldTooltipItem(field) {
        var item = document.createElement('div');
        item.className = 'admin-message-item';
        item.setAttribute('role', 'button');
        item.dataset.fieldId = field.id;
        
        var originalValue = field.field_tooltip || '';
        
        // Label
        var label = document.createElement('div');
        label.className = 'admin-message-label';
        label.textContent = field.field_key || 'Unknown Field';
        
        // Text display
        var textDisplay = document.createElement('div');
        textDisplay.className = 'admin-message-text-display';
        textDisplay.textContent = originalValue || '(empty)';
        textDisplay.title = 'Click to edit';
        
        if (!originalValue) {
            textDisplay.style.color = 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = 'italic';
        }
        
        // Text input
        var textInput = document.createElement('textarea');
        textInput.className = 'admin-message-text-input admin-message-text-input--hidden';
        textInput.value = originalValue;
        textInput.rows = 3;
        textInput.placeholder = 'Enter field tooltip help text';
        textInput.dataset.fieldId = field.id;
        
        // Click to edit
        textDisplay.addEventListener('click', function() {
            textDisplay.classList.add('admin-message-text-display--hidden');
            textInput.classList.remove('admin-message-text-input--hidden');
            textInput.focus();
        });
        
        // Track changes - notify AdminModule to recheck (like Formbuilder)
        textInput.addEventListener('input', function() {
            var currentValue = textInput.value;
            
            textDisplay.textContent = currentValue || '(empty)';
            textDisplay.style.color = currentValue ? '' : 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = currentValue ? '' : 'italic';
            
            notifyMessagesChange();
        });
        
        // Blur to close
        textInput.addEventListener('blur', function() {
            textDisplay.textContent = textInput.value || '(empty)';
            textDisplay.style.color = textInput.value ? '' : 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = textInput.value ? '' : 'italic';
            textDisplay.classList.remove('admin-message-text-display--hidden');
            textInput.classList.add('admin-message-text-input--hidden');
        });
        
        item.appendChild(label);
        item.appendChild(textDisplay);
        item.appendChild(textInput);
        TextareaResizeComponent.attach(textInput);
        
        return item;
    }
    
    function populateFieldsetTooltips(fieldsets) {
        var accordion = messagesContainer.querySelector('[data-message-category="fieldset-tooltips"]');
        if (!accordion) return;
        
        var content = accordion.querySelector('.admin-messages-accordion-content');
        if (!content) return;
        
        content.innerHTML = '';
        
        if (fieldsets && fieldsets.length > 0) {
            var tooltipsList = document.createElement('div');
            tooltipsList.className = 'admin-messages-list';
            
            // Sort fieldsets
            var sorted = fieldsets.slice().sort(function(a, b) {
                var orderA = a.sort_order !== undefined ? a.sort_order : 999;
                var orderB = b.sort_order !== undefined ? b.sort_order : 999;
                if (orderA !== orderB) return orderA - orderB;
                var nameA = (a.name || a.label || a.value || '').toLowerCase();
                var nameB = (b.name || b.label || b.value || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            sorted.forEach(function(fieldset) {
                var item = createFieldsetTooltipItem(fieldset);
                tooltipsList.appendChild(item);
            });
            
            content.appendChild(tooltipsList);
        } else {
            var emptyMsg = document.createElement('div');
            emptyMsg.className = 'admin-messages-empty';
            emptyMsg.textContent = 'No fieldsets found';
            content.appendChild(emptyMsg);
        }
    }
    
    function createFieldsetTooltipItem(fieldset) {
        var item = document.createElement('div');
        item.className = 'admin-message-item';
        item.setAttribute('role', 'button');
        item.dataset.fieldsetId = fieldset.id;
        
        var originalValue = fieldset.fieldset_tooltip || '';
        
        // Label
        var label = document.createElement('div');
        label.className = 'admin-message-label';
        label.textContent = fieldset.name || fieldset.label || fieldset.value || 'Unknown Fieldset';
        
        // Text display
        var textDisplay = document.createElement('div');
        textDisplay.className = 'admin-message-text-display';
        textDisplay.textContent = originalValue || '(empty)';
        textDisplay.title = 'Click to edit';
        
        if (!originalValue) {
            textDisplay.style.color = 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = 'italic';
        }
        
        // Text input
        var textInput = document.createElement('textarea');
        textInput.className = 'admin-message-text-input admin-message-text-input--hidden';
        textInput.value = originalValue;
        textInput.rows = 3;
        textInput.placeholder = 'Enter tooltip help text';
        textInput.dataset.fieldsetId = fieldset.id;
        
        // Click to edit
        textDisplay.addEventListener('click', function() {
            textDisplay.classList.add('admin-message-text-display--hidden');
            textInput.classList.remove('admin-message-text-input--hidden');
            textInput.focus();
        });
        
        // Track changes - notify AdminModule to recheck (like Formbuilder)
        textInput.addEventListener('input', function() {
            var currentValue = textInput.value;
            
            textDisplay.textContent = currentValue || '(empty)';
            textDisplay.style.color = currentValue ? '' : 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = currentValue ? '' : 'italic';
            
            notifyMessagesChange();
        });
        
        // Blur to close
        textInput.addEventListener('blur', function() {
            textDisplay.textContent = textInput.value || '(empty)';
            textDisplay.style.color = textInput.value ? '' : 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = textInput.value ? '' : 'italic';
            textDisplay.classList.remove('admin-message-text-display--hidden');
            textInput.classList.add('admin-message-text-input--hidden');
        });
        
        item.appendChild(label);
        item.appendChild(textDisplay);
        item.appendChild(textInput);
        TextareaResizeComponent.attach(textInput);
        
        return item;
    }
    
    // Collect modified messages for saving (compares DOM to composite baseline)
    function getModifiedMessages() {
        var modified = [];
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return modified;
        
        var originalState = JSON.parse(entry.original);
        var currentState = captureMessagesState();
        
        // Compare each message (by message_key)
        for (var key in currentState.messages) {
            var currentValue = currentState.messages[key];
            var originalValue = originalState.messages[key];
            if (currentValue !== originalValue) {
                modified.push({
                    message_key: key,
                    message_text: currentValue
                });
            }
        }
        
        return modified;
    }
    
    // Collect modified fieldset tooltips for saving (compares DOM to composite baseline)
    function getModifiedFieldsetTooltips() {
        var modified = [];
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return modified;
        
        var originalState = JSON.parse(entry.original);
        var currentState = captureMessagesState();
        
        // Compare each tooltip
        for (var id in currentState.tooltips) {
            var currentValue = currentState.tooltips[id];
            var originalValue = originalState.tooltips[id];
            if (currentValue !== originalValue) {
                modified.push({
                    id: parseInt(id, 10),
                    fieldset_tooltip: currentValue
                });
            }
        }
        
        return modified;
    }
    
    // Collect modified category names for saving (compares DOM to composite baseline)
    function getModifiedCategoryNames() {
        var modified = {};
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return modified;
        
        var originalState = JSON.parse(entry.original);
        var currentState = captureMessagesState();
        
        // Compare each category name
        for (var key in currentState.categoryNames) {
            var currentValue = currentState.categoryNames[key];
            var originalValue = originalState.categoryNames ? originalState.categoryNames[key] : undefined;
            if (currentValue !== originalValue) {
                modified['msg_category_' + key + '_name'] = currentValue;
            }
        }
        
        return modified;
    }
    
    // Check if category order has changed
    function getCategoryOrderIfChanged() {
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return null;
        
        var originalState = JSON.parse(entry.original);
        var currentState = captureMessagesState();
        
        var originalOrder = originalState.categoryOrder || [];
        var currentOrder = currentState.categoryOrder || [];
        
        // Compare arrays
        if (originalOrder.length !== currentOrder.length) return currentOrder;
        for (var i = 0; i < originalOrder.length; i++) {
            if (originalOrder[i] !== currentOrder[i]) return currentOrder;
        }
        
        return null; // No change
    }
    
    // Reset messages tab to original values (called on discard)
    function resetMessagesToOriginal() {
        if (!messagesContainer) return;
        
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return;
        
        var originalState = JSON.parse(entry.original);
        
        // Reset category order (reorder DOM elements)
        if (originalState.categoryOrder && originalState.categoryOrder.length > 0) {
            var accordionsContainer = messagesContainer.querySelector('.admin-messages-container');
            if (accordionsContainer) {
                originalState.categoryOrder.forEach(function(key) {
                    var accordion = accordionsContainer.querySelector('.admin-messages-accordion[data-message-category="' + key + '"]');
                    if (accordion) {
                        accordionsContainer.appendChild(accordion);
                    }
                });
            }
        }
        
        // Reset category name inputs and header text
        messagesContainer.querySelectorAll('.admin-messages-accordion-editpanel-input[data-category-key]').forEach(function(input) {
            var key = input.dataset.categoryKey;
            if (key && originalState.categoryNames && originalState.categoryNames[key] !== undefined) {
                var originalValue = originalState.categoryNames[key];
                input.value = originalValue;
                
                // Also update header text
                var accordion = input.closest('.admin-messages-accordion');
                if (accordion) {
                    var headerText = accordion.querySelector('.admin-messages-accordion-header-text');
                    if (headerText) {
                        headerText.textContent = originalValue;
                    }
                }
            }
        });
        
        // Reset message textareas (by message_key)
        messagesContainer.querySelectorAll('.admin-message-text-input[data-message-key]').forEach(function(textarea) {
            var key = textarea.dataset.messageKey;
            if (key && originalState.messages[key] !== undefined) {
                var originalValue = originalState.messages[key];
                textarea.value = originalValue;
                
                var item = textarea.closest('.admin-message-item');
                if (item) {
                    var display = item.querySelector('.admin-message-text-display');
                    if (display) {
                        display.innerHTML = originalValue;
                    }
                    item.classList.remove('admin-message-item--modified');
                }
            }
        });
        
        // Reset tooltip textareas
        messagesContainer.querySelectorAll('.admin-message-text-input[data-fieldset-id]').forEach(function(textarea) {
            var id = textarea.dataset.fieldsetId;
            if (id && originalState.tooltips[id] !== undefined) {
                var originalValue = originalState.tooltips[id];
                textarea.value = originalValue;
                
                var item = textarea.closest('.admin-message-item');
                if (item) {
                    var display = item.querySelector('.admin-message-text-display');
                    if (display) {
                        display.textContent = originalValue || '(empty)';
                        display.style.color = originalValue ? '' : 'var(--text-muted, #888)';
                        display.style.fontStyle = originalValue ? '' : 'italic';
                    }
                    item.classList.remove('admin-message-item--modified');
                }
            }
        });
        
        // Close any open edit panels
        closeAllMessagesEditPanels();
    }

    /* --------------------------------------------------------------------------
       MAP TAB
       
       Contains map-related settings: starting location, spin settings,
       map shadow, map card display, and system image pickers.
       -------------------------------------------------------------------------- */
    
    var mapTabContainer = null;
    var mapTabInitialized = false;
    var mapTabData = {}; // Cached map settings from database
    
    function initMapTab() {
        if (mapTabInitialized) return;
        
        mapTabContainer = document.getElementById('admin-tab-map');
        if (!mapTabContainer) return;
        
        // Load settings from database then initialize controls
        loadMapTabSettings().then(function() {
            attachMapTabHandlers();
            mapTabInitialized = true;
        });
    }
    
    function loadMapTabSettings() {
        // Reuse settingsData if Settings tab already loaded it
        if (settingsInitialized && Object.keys(settingsData).length > 0) {
            mapTabData = settingsData;
            // Store system_images data separately
            if (settingsData.system_images) {
                mapTabData.system_images = settingsData.system_images;
            }
            // Use database setting for system images folder
            if (window.SystemImagePickerComponent && mapTabData && mapTabData.folder_system_images) {
                SystemImagePickerComponent.setImageFolder(mapTabData.folder_system_images);
            }
            return Promise.resolve();
        }
        
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.settings) {
                    mapTabData = data.settings;
                    // Store system_images data separately
                    if (data.system_images) {
                        mapTabData.system_images = data.system_images;
                    }
                    // Use database setting for system images folder
                    if (window.SystemImagePickerComponent && mapTabData.folder_system_images) {
                        SystemImagePickerComponent.setImageFolder(mapTabData.folder_system_images);
                    }
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load map tab settings:', err);
            });
    }
    
    function attachMapTabHandlers() {
        if (!mapTabContainer) return;
        
        // Map Lighting buttons
        var lightingButtons = mapTabContainer.querySelectorAll('.admin-lighting-button');
        if (lightingButtons.length) {
            // Apply lighting icons from system images
            var sys = (window.App && typeof App.getState === 'function') ? (App.getState('system_images') || {}) : {};
            lightingButtons.forEach(function(btn) {
                var iconEl = btn.querySelector('.admin-lighting-button-icon');
                if (!iconEl) return;
                var key = iconEl.dataset.iconKey;
                if (key && sys[key] && window.App && typeof App.getImageUrl === 'function') {
                    var url = App.getImageUrl('systemImages', sys[key]);
                    iconEl.style.webkitMaskImage = 'url(' + url + ')';
                    iconEl.style.maskImage = 'url(' + url + ')';
                    iconEl.style.opacity = '1';
                }
            });
            
            var initialLighting = mapTabData.map_lighting || 'day';
            lightingButtons.forEach(function(btn) {
                var lighting = btn.dataset.lighting;
                var isActive = lighting === initialLighting;
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                
                btn.addEventListener('click', function() {
                    if (btn.getAttribute('aria-pressed') === 'true') return;
                    
                    console.log('[Admin] Lighting button clicked:', lighting);
                    
                    lightingButtons.forEach(function(b) {
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.setAttribute('aria-pressed', 'true');
                    
                    updateField('map.map_lighting', lighting);
                    if (window.MapModule && window.MapModule.setMapLighting) {
                        console.log('[Admin] Calling MapModule.setMapLighting');
                        window.MapModule.setMapLighting(lighting);
                    } else {
                        console.warn('[Admin] MapModule not available or setMapLighting missing');
                    }
                });
            });
            registerField('map.map_lighting', initialLighting);
        }
        
        // Map Style buttons
        var styleButtons = mapTabContainer.querySelectorAll('.admin-style-button');
        if (styleButtons.length) {
            var initialStyle = mapTabData.map_style || 'standard';
            styleButtons.forEach(function(btn) {
                var style = btn.dataset.style;
                var isActive = style === initialStyle;
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                
                btn.addEventListener('click', function() {
                    if (btn.getAttribute('aria-pressed') === 'true') return;
                    
                    console.log('[Admin] Style button clicked:', style);
                    
                    styleButtons.forEach(function(b) {
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.setAttribute('aria-pressed', 'true');
                    
                    updateField('map.map_style', style);
                    if (window.MapModule && window.MapModule.setMapStyle) {
                        console.log('[Admin] Calling MapModule.setMapStyle');
                        window.MapModule.setMapStyle(style);
                    } else {
                        console.warn('[Admin] MapModule not available or setMapStyle missing');
                    }
                });
            });
            registerField('map.map_style', initialStyle);
        }
        
        // Map Card Breakpoint slider
        var mapCardBreakpointSlider = document.getElementById('adminMapCardBreakpoint');
        var mapCardBreakpointDisplay = document.getElementById('adminMapCardBreakpointDisplay');
        if (mapCardBreakpointSlider && mapCardBreakpointDisplay) {
            var initialMapCardBreakpoint = mapTabData.map_card_breakpoint !== undefined ? parseFloat(mapTabData.map_card_breakpoint) : 8;
            mapCardBreakpointSlider.value = initialMapCardBreakpoint;
            mapCardBreakpointDisplay.textContent = Math.round(initialMapCardBreakpoint).toString();
            
            registerField('map.map_card_breakpoint', initialMapCardBreakpoint);
            
            mapCardBreakpointSlider.addEventListener('input', function() {
                mapCardBreakpointDisplay.textContent = Math.round(parseFloat(mapCardBreakpointSlider.value)).toString();
                updateField('map.map_card_breakpoint', parseFloat(mapCardBreakpointSlider.value));
            });
        }
        
        // Starting Zoom Desktop slider
        var startingZoomDesktopSlider = document.getElementById('adminStartingZoomDesktop');
        var startingZoomDesktopDisplay = document.getElementById('adminStartingZoomDesktopDisplay');
        if (startingZoomDesktopSlider && startingZoomDesktopDisplay) {
            var initialZoomDesktop = mapTabData.starting_zoom_desktop !== undefined ? parseFloat(mapTabData.starting_zoom_desktop) : 10;
            startingZoomDesktopSlider.value = initialZoomDesktop;
            startingZoomDesktopDisplay.textContent = Math.round(initialZoomDesktop).toString();
            
            registerField('map.starting_zoom_desktop', initialZoomDesktop);
            
            startingZoomDesktopSlider.addEventListener('input', function() {
                startingZoomDesktopDisplay.textContent = Math.round(parseFloat(startingZoomDesktopSlider.value)).toString();
                updateField('map.starting_zoom_desktop', parseFloat(startingZoomDesktopSlider.value));
            });
        }
        
        // Starting Zoom Mobile slider
        var startingZoomMobileSlider = document.getElementById('adminStartingZoomMobile');
        var startingZoomMobileDisplay = document.getElementById('adminStartingZoomMobileDisplay');
        if (startingZoomMobileSlider && startingZoomMobileDisplay) {
            var initialZoomMobile = mapTabData.starting_zoom_mobile !== undefined ? parseFloat(mapTabData.starting_zoom_mobile) : 10;
            startingZoomMobileSlider.value = initialZoomMobile;
            startingZoomMobileDisplay.textContent = Math.round(initialZoomMobile).toString();
            
            registerField('map.starting_zoom_mobile', initialZoomMobile);
            
            startingZoomMobileSlider.addEventListener('input', function() {
                startingZoomMobileDisplay.textContent = Math.round(parseFloat(startingZoomMobileSlider.value)).toString();
                updateField('map.starting_zoom_mobile', parseFloat(startingZoomMobileSlider.value));
            });
        }
        
        // Fly-To Zoom Desktop slider
        var flytoZoomDesktopSlider = document.getElementById('adminFlytoZoomDesktop');
        var flytoZoomDesktopDisplay = document.getElementById('adminFlytoZoomDesktopDisplay');
        if (flytoZoomDesktopSlider && flytoZoomDesktopDisplay) {
            var initialFlytoDesktop = mapTabData.flyto_zoom_desktop !== undefined ? parseFloat(mapTabData.flyto_zoom_desktop) : 12;
            flytoZoomDesktopSlider.value = initialFlytoDesktop;
            flytoZoomDesktopDisplay.textContent = Math.round(initialFlytoDesktop).toString();
            
            registerField('map.flyto_zoom_desktop', initialFlytoDesktop);
            
            flytoZoomDesktopSlider.addEventListener('input', function() {
                flytoZoomDesktopDisplay.textContent = Math.round(parseFloat(flytoZoomDesktopSlider.value)).toString();
                updateField('map.flyto_zoom_desktop', parseFloat(flytoZoomDesktopSlider.value));
            });
        }
        
        // Fly-To Zoom Mobile slider
        var flytoZoomMobileSlider = document.getElementById('adminFlytoZoomMobile');
        var flytoZoomMobileDisplay = document.getElementById('adminFlytoZoomMobileDisplay');
        if (flytoZoomMobileSlider && flytoZoomMobileDisplay) {
            var initialFlytoMobile = mapTabData.flyto_zoom_mobile !== undefined ? parseFloat(mapTabData.flyto_zoom_mobile) : 12;
            flytoZoomMobileSlider.value = initialFlytoMobile;
            flytoZoomMobileDisplay.textContent = Math.round(initialFlytoMobile).toString();
            
            registerField('map.flyto_zoom_mobile', initialFlytoMobile);
            
            flytoZoomMobileSlider.addEventListener('input', function() {
                flytoZoomMobileDisplay.textContent = Math.round(parseFloat(flytoZoomMobileSlider.value)).toString();
                updateField('map.flyto_zoom_mobile', parseFloat(flytoZoomMobileSlider.value));
            });
        }
        
        // Map Card Priority Reshuffle Zoom slider
        var reshuffleZoomSlider = document.getElementById('adminMapCardPriorityReshuffleZoom');
        var reshuffleZoomDisplay = document.getElementById('adminMapCardPriorityReshuffleZoomDisplay');
        if (reshuffleZoomSlider && reshuffleZoomDisplay) {
            var initialReshuffle = mapTabData.map_card_priority_reshuffle_zoom !== undefined ? parseFloat(mapTabData.map_card_priority_reshuffle_zoom) : 0.5;
            reshuffleZoomSlider.value = initialReshuffle;
            reshuffleZoomDisplay.textContent = parseFloat(initialReshuffle).toFixed(1);
            
            registerField('map.map_card_priority_reshuffle_zoom', initialReshuffle);
            
            reshuffleZoomSlider.addEventListener('input', function() {
                reshuffleZoomDisplay.textContent = parseFloat(reshuffleZoomSlider.value).toFixed(1);
                updateField('map.map_card_priority_reshuffle_zoom', parseFloat(reshuffleZoomSlider.value));
            });
        }
        
        // Starting Pitch Desktop slider
        var startingPitchDesktopSlider = document.getElementById('adminStartingPitchDesktop');
        var startingPitchDesktopDisplay = document.getElementById('adminStartingPitchDesktopDisplay');
        if (startingPitchDesktopSlider && startingPitchDesktopDisplay) {
            var initialPitchDesktop = mapTabData.starting_pitch_desktop !== undefined ? parseFloat(mapTabData.starting_pitch_desktop) : 0;
            startingPitchDesktopSlider.value = initialPitchDesktop;
            startingPitchDesktopDisplay.textContent = Math.round(initialPitchDesktop).toString() + '°';
            
            registerField('map.starting_pitch_desktop', initialPitchDesktop);
            
            startingPitchDesktopSlider.addEventListener('input', function() {
                startingPitchDesktopDisplay.textContent = Math.round(parseFloat(startingPitchDesktopSlider.value)).toString() + '°';
                updateField('map.starting_pitch_desktop', parseFloat(startingPitchDesktopSlider.value));
            });
        }
        
        // Starting Pitch Mobile slider
        var startingPitchMobileSlider = document.getElementById('adminStartingPitchMobile');
        var startingPitchMobileDisplay = document.getElementById('adminStartingPitchMobileDisplay');
        if (startingPitchMobileSlider && startingPitchMobileDisplay) {
            var initialPitchMobile = mapTabData.starting_pitch_mobile !== undefined ? parseFloat(mapTabData.starting_pitch_mobile) : 0;
            startingPitchMobileSlider.value = initialPitchMobile;
            startingPitchMobileDisplay.textContent = Math.round(initialPitchMobile).toString() + '°';
            
            registerField('map.starting_pitch_mobile', initialPitchMobile);
            
            startingPitchMobileSlider.addEventListener('input', function() {
                startingPitchMobileDisplay.textContent = Math.round(parseFloat(startingPitchMobileSlider.value)).toString() + '°';
                updateField('map.starting_pitch_mobile', parseFloat(startingPitchMobileSlider.value));
            });
        }
        
        // Spin on Load checkbox
        var spinLoadStartCheckbox = document.getElementById('adminSpinLoadStart');
        if (spinLoadStartCheckbox) {
            var initialSpinLoad = mapTabData.spin_on_load === true || mapTabData.spin_on_load === '1';
            spinLoadStartCheckbox.checked = initialSpinLoad;
            updateSwitchSlider(spinLoadStartCheckbox);
            
            registerField('map.spin_on_load', initialSpinLoad);
            
            spinLoadStartCheckbox.addEventListener('change', function() {
                updateSwitchSlider(spinLoadStartCheckbox);
                updateField('map.spin_on_load', spinLoadStartCheckbox.checked);
            });
        }
        
        // Spin Type radios
        var spinTypeRadios = mapTabContainer.querySelectorAll('input[name="adminSpinType"]');
        if (spinTypeRadios.length) {
            var initialSpinType = mapTabData.spin_load_type || 'everyone';
            spinTypeRadios.forEach(function(radio) {
                radio.checked = (radio.value === initialSpinType);
            });
            
            registerField('map.spin_load_type', initialSpinType);
            
            spinTypeRadios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    if (radio.checked) {
                        updateField('map.spin_load_type', radio.value);
                    }
                });
            });
        }
        
        // Grey out spin type radios when spin on load is off
        var spinTypeContainer = document.getElementById('adminSpinType');
        if (spinLoadStartCheckbox && spinTypeContainer) {
            if (!spinLoadStartCheckbox.checked) spinTypeContainer.classList.add('admin-panel-field--disabled');
            spinLoadStartCheckbox.addEventListener('change', function() {
                if (spinLoadStartCheckbox.checked) {
                    spinTypeContainer.classList.remove('admin-panel-field--disabled');
                } else {
                    spinTypeContainer.classList.add('admin-panel-field--disabled');
                }
            });
        }

        // Spin on Logo checkbox
        var spinLogoClickCheckbox = document.getElementById('adminSpinLogoClick');
        if (spinLogoClickCheckbox) {
            var initialSpinLogo = mapTabData.spin_on_logo !== false && mapTabData.spin_on_logo !== '0';
            spinLogoClickCheckbox.checked = initialSpinLogo;
            updateSwitchSlider(spinLogoClickCheckbox);
            
            registerField('map.spin_on_logo', initialSpinLogo);
            
            spinLogoClickCheckbox.addEventListener('change', function() {
                updateSwitchSlider(spinLogoClickCheckbox);
                updateField('map.spin_on_logo', spinLogoClickCheckbox.checked);
            });
        }
        
        // Spin Max Zoom slider
        var spinZoomMaxSlider = document.getElementById('adminSpinZoomMax');
        var spinZoomMaxDisplay = document.getElementById('adminSpinZoomMaxDisplay');
        if (spinZoomMaxSlider && spinZoomMaxDisplay) {
            var initialSpinZoomMax = mapTabData.spin_zoom_max !== undefined ? parseFloat(mapTabData.spin_zoom_max) : 4;
            spinZoomMaxSlider.value = initialSpinZoomMax;
            spinZoomMaxDisplay.textContent = Math.round(initialSpinZoomMax).toString();
            
            registerField('map.spin_zoom_max', initialSpinZoomMax);
            
            spinZoomMaxSlider.addEventListener('input', function() {
                spinZoomMaxDisplay.textContent = Math.round(parseFloat(spinZoomMaxSlider.value)).toString();
                updateField('map.spin_zoom_max', parseFloat(spinZoomMaxSlider.value));
            });
        }
        
        // Spin Speed slider
        var spinSpeedSlider = document.getElementById('adminSpinSpeed');
        var spinSpeedDisplay = document.getElementById('adminSpinSpeedDisplay');
        if (spinSpeedSlider && spinSpeedDisplay) {
            var initialSpinSpeed = mapTabData.spin_speed !== undefined ? parseFloat(mapTabData.spin_speed) : 0.3;
            spinSpeedSlider.value = initialSpinSpeed;
            spinSpeedDisplay.textContent = initialSpinSpeed.toFixed(1);
            
            registerField('map.spin_speed', initialSpinSpeed);
            
            spinSpeedSlider.addEventListener('input', function() {
                spinSpeedDisplay.textContent = parseFloat(spinSpeedSlider.value).toFixed(1);
                updateField('map.spin_speed', parseFloat(spinSpeedSlider.value));
            });
        }
        
        // Wait for Map Tiles checkbox
        var waitForMapTilesCheckbox = document.getElementById('adminWaitForMapTiles');
        if (waitForMapTilesCheckbox) {
            var initialWaitTiles = mapTabData.wait_for_map_tiles !== false && mapTabData.wait_for_map_tiles !== '0';
            waitForMapTilesCheckbox.checked = initialWaitTiles;
            updateSwitchSlider(waitForMapTilesCheckbox);
            
            registerField('map.wait_for_map_tiles', initialWaitTiles);
            
            waitForMapTilesCheckbox.addEventListener('change', function() {
                updateSwitchSlider(waitForMapTilesCheckbox);
                updateField('map.wait_for_map_tiles', waitForMapTilesCheckbox.checked);
            });
        }
        
        // Map Card Display radios
        var mapCardDisplayRadios = mapTabContainer.querySelectorAll('input[name="adminMapCardDisplay"]');
        if (mapCardDisplayRadios.length) {
            var initialMapCardDisplay = mapTabData.map_card_display || 'hover_only';
            mapCardDisplayRadios.forEach(function(radio) {
                radio.checked = (radio.value === initialMapCardDisplay);
            });
            
            registerField('map.map_card_display', initialMapCardDisplay);
            
            mapCardDisplayRadios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    if (radio.checked) {
                        updateField('map.map_card_display', radio.value);
                    }
                });
            });
        }
        
        // Default Wallpaper Mode buttons (default for new users; members override with their own preference)
        var wallpaperButtons = mapTabContainer.querySelectorAll('.admin-wallpaper-button');
        if (wallpaperButtons.length) {
            var initialWallpaperMode = mapTabData.default_wallpaper_mode || 'basic';
            wallpaperButtons.forEach(function(btn) {
                var mode = btn.dataset.wallpaper;
                var isActive = mode === initialWallpaperMode;
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                
                btn.addEventListener('click', function() {
                    if (btn.getAttribute('aria-pressed') === 'true') return;
                    
                    wallpaperButtons.forEach(function(b) {
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.setAttribute('aria-pressed', 'true');
                    
                    updateField('map.default_wallpaper_mode', mode);
                });
            });
            registerField('map.default_wallpaper_mode', initialWallpaperMode);
        }
        
        // Wallpaper Dimmer slider (site-wide for everyone)
        var dimmerSlider = document.getElementById('adminLocationWallpaperDimmer');
        var dimmerDisplay = document.getElementById('adminLocationWallpaperDimmerDisplay');
        if (dimmerSlider && dimmerDisplay) {
            var initialDimmer = mapTabData.location_wallpaper_dimmer !== undefined ? parseFloat(mapTabData.location_wallpaper_dimmer) : 30;
            dimmerSlider.value = initialDimmer;
            dimmerDisplay.textContent = Math.round(initialDimmer).toString() + '%';
            
            registerField('map.location_wallpaper_dimmer', initialDimmer);
            
            dimmerSlider.addEventListener('input', function() {
                dimmerDisplay.textContent = Math.round(parseFloat(dimmerSlider.value)).toString() + '%';
                updateField('map.location_wallpaper_dimmer', parseFloat(dimmerSlider.value));
            });
        }
        
        // Initialize Starting Location Geocoder
        initStartingLocationGeocoder();
        
        // Initialize Map tab image pickers
        initMapImagePicker('adminSmallMapCardPillPicker', 'small_map_card_pill');
        initMapImagePicker('adminBigMapCardPillPicker', 'big_map_card_pill');
        initMapImagePicker('adminHoverMapCardPillPicker', 'hover_map_card_pill');
        initMapImagePicker('adminMultiPostIconPicker', 'multi_post_icon');
        initMapImagePicker('adminMarkerClusterIconPicker', 'marker_cluster_icon');
    }
    
    // Helper to update switch slider visual state
    function updateSwitchSlider(checkbox) {
        var slider = checkbox.parentElement.querySelector('.component-switch-slider');
        if (slider) {
            slider.classList.toggle('component-switch-slider--on-default', checkbox.checked);
        }
    }
    
    function initStartingLocationGeocoder() {
        var startingAddressInput = document.getElementById('adminStartingAddress');
        var startingLatInput = document.getElementById('adminStartingLat');
        var startingLngInput = document.getElementById('adminStartingLng');
        var startingGeocoderContainer = document.getElementById('admin-geocoder-starting');
        var startingAddressDisplay = document.getElementById('admin-starting-address-display');
        if (!startingGeocoderContainer) return;
        if (startingGeocoderContainer.dataset.geocoderAdded) return;
        startingGeocoderContainer.dataset.geocoderAdded = 'true';
        
        var startingAddress = mapTabData.starting_address || '';
        var startingLat = mapTabData.starting_lat || null;
        var startingLng = mapTabData.starting_lng || null;
        
        // Register field for change tracking
        registerField('map.starting_address', startingAddress);
        registerField('map.starting_lat', startingLat);
        registerField('map.starting_lng', startingLng);
        
        var showGeocoderInput = function() {
            // Keep Mapbox geocoder visible at all times (display:none breaks sizing and can freeze typing).
            if (startingAddressDisplay) startingAddressDisplay.hidden = true;
            setTimeout(function() {
                // Mapbox geocoder input (created by map.js)
                var input = startingGeocoderContainer.querySelector('.admin-mapbox-geocoder-input--starting') ||
                            startingGeocoderContainer.querySelector('input.mapboxgl-ctrl-geocoder--input') ||
                            startingGeocoderContainer.querySelector('input');
                if (input) input.focus();
            }, 50);
        };
        
        var showAddressDisplay = function() {
            // Do not hide the Mapbox geocoder container. The display toggle caused broken/squeezed layout and typing freezes.
                if (startingAddressDisplay) startingAddressDisplay.hidden = true;
        };
        
        // Address display is disabled; keep input active/visible.
        
        var saveStartingLocation = function(address, lat, lng) {
            startingAddress = address || '';
            startingLat = lat || null;
            startingLng = lng || null;
            
            if (startingAddressInput) startingAddressInput.value = address || '';
            if (startingLatInput) startingLatInput.value = lat || '';
            if (startingLngInput) startingLngInput.value = lng || '';
            
            updateField('map.starting_address', startingAddress);
            updateField('map.starting_lat', startingLat);
            updateField('map.starting_lng', startingLng);
            
            // Update the display element
            if (startingAddressDisplay) {
                if (startingAddress) {
                    startingAddressDisplay.textContent = startingAddress;
                    startingAddressDisplay.hidden = false;
                } else {
                    startingAddressDisplay.hidden = true;
                }
            }
        };
        
        // Mapbox geocoder is created by `map.js` and emits `map:startingLocationChanged`.
        // We listen and store values in mapTabData fields for saving.
        if (window.App && typeof App.on === 'function') {
            if (!startingGeocoderContainer.dataset.startingListenerAdded) {
                startingGeocoderContainer.dataset.startingListenerAdded = 'true';
                App.on('map:startingLocationChanged', function(payload) {
                    if (!payload) return;
                    saveStartingLocation(payload.address, payload.lat, payload.lng);
                });
            }
        }
        
        // Show saved starting location in the display element (below label, above geocoder)
        if (startingAddressDisplay) {
            if (startingAddress) {
                startingAddressDisplay.textContent = startingAddress;
                startingAddressDisplay.hidden = false;
            } else {
                startingAddressDisplay.hidden = true;
            }
        }
    }
    
    function initMapImagePicker(containerId, settingKey) {
        var container = document.getElementById(containerId);
        if (!container || !window.SystemImagePickerComponent) return;
        
        // Get initial value from system_images (filename only, not full path)
        var initialValue = '';
        if (mapTabData.system_images && mapTabData.system_images[settingKey]) {
            initialValue = mapTabData.system_images[settingKey];
        }
        
        var picker = SystemImagePickerComponent.buildPicker({
            container: mapTabContainer,
            databaseValue: initialValue,
            onSelect: function(imagePath) {
                // Extract filename from full path
                var filename = imagePath;
                if (imagePath.indexOf('/') !== -1) {
                    filename = imagePath.split('/').pop();
                }
                // Update system_images field (not map)
                updateField('system_images.' + settingKey, filename);
            }
        });
        
        picker.element.dataset.settingKey = settingKey;
        picker.element.dataset.isSystemImage = 'true';
        container.appendChild(picker.element);
        
        registerField('system_images.' + settingKey, initialValue);
    }
    
    // Reset map tab to original values (called on discard)
    function resetMapTabToOriginal() {
        if (!mapTabContainer) return;
        
        // Reset sliders
        var sliders = [
            { id: 'adminMapCardBreakpoint', displayId: 'adminMapCardBreakpointDisplay', fieldId: 'map.map_card_breakpoint', format: 'int' },
            { id: 'adminStartingZoomDesktop', displayId: 'adminStartingZoomDesktopDisplay', fieldId: 'map.starting_zoom_desktop', format: 'int' },
            { id: 'adminStartingZoomMobile', displayId: 'adminStartingZoomMobileDisplay', fieldId: 'map.starting_zoom_mobile', format: 'int' },
            { id: 'adminFlytoZoomDesktop', displayId: 'adminFlytoZoomDesktopDisplay', fieldId: 'map.flyto_zoom_desktop', format: 'int' },
            { id: 'adminFlytoZoomMobile', displayId: 'adminFlytoZoomMobileDisplay', fieldId: 'map.flyto_zoom_mobile', format: 'int' },
            { id: 'adminMapCardPriorityReshuffleZoom', displayId: 'adminMapCardPriorityReshuffleZoomDisplay', fieldId: 'map.map_card_priority_reshuffle_zoom', format: 'decimal1' },
            { id: 'adminStartingPitchDesktop', displayId: 'adminStartingPitchDesktopDisplay', fieldId: 'map.starting_pitch_desktop', format: 'degree' },
            { id: 'adminStartingPitchMobile', displayId: 'adminStartingPitchMobileDisplay', fieldId: 'map.starting_pitch_mobile', format: 'degree' },
            { id: 'adminSpinZoomMax', displayId: 'adminSpinZoomMaxDisplay', fieldId: 'map.spin_zoom_max', format: 'int' },
            { id: 'adminSpinSpeed', displayId: 'adminSpinSpeedDisplay', fieldId: 'map.spin_speed', format: 'decimal1' },
            { id: 'adminLocationWallpaperDimmer', displayId: 'adminLocationWallpaperDimmerDisplay', fieldId: 'map.location_wallpaper_dimmer', format: 'percent' }
        ];
        
        sliders.forEach(function(s) {
            var slider = document.getElementById(s.id);
            var display = document.getElementById(s.displayId);
            var entry = fieldRegistry[s.fieldId];
            if (slider && display && entry && entry.type === 'simple') {
                slider.value = entry.original;
                if (s.format === 'int') {
                    display.textContent = Math.round(entry.original).toString();
                } else if (s.format === 'degree') {
                    display.textContent = Math.round(entry.original).toString() + '°';
                } else if (s.format === 'decimal1') {
                    display.textContent = parseFloat(entry.original).toFixed(1);
                } else if (s.format === 'decimal2') {
                    display.textContent = parseFloat(entry.original).toFixed(2);
                } else if (s.format === 'percent') {
                    display.textContent = Math.round(entry.original).toString() + '%';
                }
            }
        });
        
        // Reset checkboxes
        var checkboxes = [
            { id: 'adminSpinLoadStart', fieldId: 'map.spin_on_load' },
            { id: 'adminSpinLogoClick', fieldId: 'map.spin_on_logo' },
            { id: 'adminWaitForMapTiles', fieldId: 'map.wait_for_map_tiles' }
        ];
        
        checkboxes.forEach(function(c) {
            var checkbox = document.getElementById(c.id);
            var entry = fieldRegistry[c.fieldId];
            if (checkbox && entry && entry.type === 'simple') {
                checkbox.checked = entry.original === true || entry.original === '1';
                updateSwitchSlider(checkbox);
            }
        });
        
        // Reset radio groups
        var radioGroups = [
            { name: 'adminSpinType', fieldId: 'map.spin_load_type' },
            { name: 'adminMapCardDisplay', fieldId: 'map.map_card_display' }
        ];
        
        radioGroups.forEach(function(rg) {
            var radios = mapTabContainer.querySelectorAll('input[name="' + rg.name + '"]');
            var entry = fieldRegistry[rg.fieldId];
            if (radios.length && entry && entry.type === 'simple') {
                radios.forEach(function(radio) {
                    radio.checked = (radio.value === entry.original);
                });
            }
        });
        
        // Reset button groups
        var buttonGroups = [
            { selector: '.admin-wallpaper-button', fieldId: 'map.default_wallpaper_mode', dataAttr: 'wallpaper' }
        ];
        
        buttonGroups.forEach(function(bg) {
            var buttons = mapTabContainer.querySelectorAll(bg.selector);
            var entry = fieldRegistry[bg.fieldId];
            if (buttons.length && entry && entry.type === 'simple') {
                buttons.forEach(function(btn) {
                    var value = btn.dataset[bg.dataAttr];
                    var isActive = value === entry.original;
                    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });
            }
        });
        
        // Reset starting address
        var addressEntry = fieldRegistry['map.starting_address'];
        if (addressEntry && addressEntry.type === 'simple') {
            var originalAddress = addressEntry.original || '';
            
            // Update hidden inputs
            var startingAddressInput = document.getElementById('adminStartingAddress');
            var startingLatInput = document.getElementById('adminStartingLat');
            var startingLngInput = document.getElementById('adminStartingLng');
            var latEntry = fieldRegistry['map.starting_lat'];
            var lngEntry = fieldRegistry['map.starting_lng'];
            
            if (startingAddressInput) startingAddressInput.value = originalAddress;
            if (startingLatInput && latEntry) startingLatInput.value = latEntry.original || '';
            if (startingLngInput && lngEntry) startingLngInput.value = lngEntry.original || '';
            
            // Update display
            var addressDisplay = document.getElementById('admin-starting-address-display');
            var geocoderContainer = document.getElementById('admin-geocoder-starting');
            
            if (originalAddress.trim() && addressDisplay) {
                addressDisplay.textContent = originalAddress;
                if (geocoderContainer) geocoderContainer.classList.add('admin-map-controls-starting-geocoder--hidden');
                addressDisplay.hidden = false;
            } else {
                if (geocoderContainer) geocoderContainer.classList.remove('admin-map-controls-starting-geocoder--hidden');
                if (addressDisplay) addressDisplay.hidden = true;
            }
            
            // Update geocoder input value
            if (geocoderContainer) {
                var geocoderInput = geocoderContainer.querySelector('input');
                if (geocoderInput) geocoderInput.value = originalAddress;
            }
        }
        
        // Reset image pickers (need to update the preview images)
        var imagePickers = [
            { containerId: 'adminSmallMapCardPillPicker', fieldId: 'map.small_map_card_pill' },
            { containerId: 'adminBigMapCardPillPicker', fieldId: 'map.big_map_card_pill' },
            { containerId: 'adminHoverMapCardPillPicker', fieldId: 'map.hover_map_card_pill' },
            { containerId: 'adminMultiPostIconPicker', fieldId: 'map.multi_post_icon' },
            { containerId: 'adminMarkerClusterIconPicker', fieldId: 'map.marker_cluster_icon' }
        ];
        
        imagePickers.forEach(function(ip) {
            var entry = fieldRegistry[ip.fieldId];
            if (entry && entry.type === 'simple') {
                var container = document.getElementById(ip.containerId);
                if (container) {
                    var buttonImg = container.querySelector('.systemimagepicker-button-preview');
                    var placeholder = container.querySelector('.systemimagepicker-button-placeholder');
                    if (entry.original) {
                        if (buttonImg) {
                            buttonImg.src = entry.original;
                            buttonImg.style.display = '';
                        }
                        if (placeholder) placeholder.style.display = 'none';
                    } else {
                        if (buttonImg) buttonImg.style.display = 'none';
                        if (placeholder) placeholder.style.display = '';
                    }
                }
            }
        });
    }

    /* --------------------------------------------------------------------------
       CHECKOUT TAB
       
       Checkout options are now in their own tab.
       Uses the existing checkout options rendering from Settings tab.
       -------------------------------------------------------------------------- */
    
    var checkoutTabContainer = null;
    var checkoutTabInitialized = false;
    
    function initCheckoutTab() {
        // Checkout tab is already initialized via Settings tab load
        // since they share the same settingsData and checkout options rendering
        if (checkoutTabInitialized) return;
        
        checkoutTabContainer = document.getElementById('admin-tab-checkout');
        if (!checkoutTabContainer) return;
        
        // Load settings if not already loaded
        if (!settingsInitialized) {
            loadSettingsFromDatabase().then(function() {
                attachCheckoutTabHandlers();
                checkoutTabInitialized = true;
            });
        } else {
            attachCheckoutTabHandlers();
            checkoutTabInitialized = true;
        }
    }
    
    function attachCheckoutTabHandlers() {
        if (!checkoutTabContainer) return;
        
        var checkoutMsgEl = checkoutTabContainer.querySelector('[data-message-key="msg_checkout_settings"]');
        if (checkoutMsgEl && typeof window.getMessage === 'function') {
            window.getMessage('msg_checkout_settings', {}, true).then(function(message) {
                if (message) checkoutMsgEl.textContent = message;
            }).catch(function() {});
        }
    }

    /* --------------------------------------------------------------------------
       MODERATION TAB
       
       Displays pending deletion accounts and flagged posts.
       Admin can reactivate, anonymize, or take action on flagged content.
       -------------------------------------------------------------------------- */
    
    var moderationTabContainer = null;
    var moderationTabInitialized = false;
    var moderationData = null;
    
    function initModerationTab() {
        if (moderationTabInitialized) return;
        
        moderationTabContainer = document.getElementById('admin-tab-moderation');
        if (!moderationTabContainer) return;
        
        attachModerationAccordionHandlers();
        loadModerationData();
        moderationTabInitialized = true;
    }
    
    function attachModerationAccordionHandlers() {
        if (!moderationTabContainer) return;
        
        moderationTabContainer.querySelectorAll('.admin-moderation-accordion').forEach(function(acc) {
            var header = acc.querySelector('.admin-moderation-accordion-header');
            if (!header) return;
            header.addEventListener('click', function() {
                acc.classList.toggle('admin-moderation-accordion--open');
                syncModerationAccordionUi(acc);
            });
        });
    }
    
    function syncModerationAccordionUi(acc) {
        if (!acc) return;
        var isOpen = acc.classList.contains('admin-moderation-accordion--open');
        var arrow = acc.querySelector('.admin-moderation-accordion-arrow');
        var body = acc.querySelector('.admin-moderation-accordion-body');
        acc.classList.toggle('accordion-class-1--open', isOpen);
        if (arrow) arrow.classList.toggle('admin-moderation-accordion-arrow--open', isOpen);
        if (body) body.classList.toggle('admin-moderation-accordion-body--open', isOpen);
    }
    
    function loadModerationData() {
        fetch('/gateway.php?action=get-moderation-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
        .then(function(res) {
            return res.text().then(function(text) {
                var data = null;
                try { data = JSON.parse(text); } catch (_eParse) {}

                if (!res.ok) {
                    var msg = (data && (data.error || data.message)) ? (data.error || data.message) : ('Request failed (' + res.status + ')');
                    console.error('[Admin] Moderation request failed:', res.status, data || text);
                    showError(msg);
                    return;
                }

                if (!data) {
                    console.error('[Admin] Moderation response was not JSON:', text);
                    showError('Moderation response was not JSON.');
                    return;
                }

                if (!data.success) {
                    console.error('[Admin] Moderation response error:', data);
                    showError(data.error || data.message || 'Failed to load moderation data.');
                    return;
                }

                moderationData = data;
                renderModerationData();
            });
        })
        .catch(function(err) {
            console.error('[Admin] Failed to load moderation data:', err);
            showError('Failed to load moderation data.');
        });
    }
    
    function renderModerationData() {
        if (!moderationData || !moderationTabContainer) return;
        
        // Update counts
        var deletionCount = moderationTabContainer.querySelector('#admin-moderation-deletion-count');
        var flaggedCount = moderationTabContainer.querySelector('#admin-moderation-flagged-count');
        
        if (deletionCount) {
            deletionCount.textContent = moderationData.pending_deletion_count || 0;
            deletionCount.classList.toggle('admin-moderation-accordion-count--alert', moderationData.pending_deletion_count > 0);
        }
        if (flaggedCount) {
            flaggedCount.textContent = moderationData.flagged_posts_count || 0;
            flaggedCount.classList.toggle('admin-moderation-accordion-count--alert', moderationData.flagged_posts_count > 0);
        }
        
        // Render pending deletion list
        var deletionList = moderationTabContainer.querySelector('#admin-moderation-deletion-list');
        var deletionEmpty = moderationTabContainer.querySelector('#admin-moderation-deletion-empty');
        if (deletionList) {
            deletionList.innerHTML = '';
            if (moderationData.pending_deletion && moderationData.pending_deletion.length > 0) {
                moderationData.pending_deletion.forEach(function(member) {
                    deletionList.appendChild(createMemberItem(member));
                });
                if (deletionEmpty) deletionEmpty.classList.add('admin-moderation-empty--hidden');
            } else {
                if (deletionEmpty) deletionEmpty.classList.remove('admin-moderation-empty--hidden');
            }
        }
        
        // Render flagged posts list
        var flaggedList = moderationTabContainer.querySelector('#admin-moderation-flagged-list');
        var flaggedEmpty = moderationTabContainer.querySelector('#admin-moderation-flagged-empty');
        if (flaggedList) {
            flaggedList.innerHTML = '';
            if (moderationData.flagged_posts && moderationData.flagged_posts.length > 0) {
                moderationData.flagged_posts.forEach(function(post) {
                    flaggedList.appendChild(createPostItem(post));
                });
                if (flaggedEmpty) flaggedEmpty.classList.add('admin-moderation-empty--hidden');
            } else {
                if (flaggedEmpty) flaggedEmpty.classList.remove('admin-moderation-empty--hidden');
            }
        }
        
        // Render missing map images list
        var mapImagesCount = moderationTabContainer.querySelector('#admin-moderation-mapimages-count');
        var mapImagesList = moderationTabContainer.querySelector('#admin-moderation-mapimages-list');
        var mapImagesEmpty = moderationTabContainer.querySelector('#admin-moderation-mapimages-empty');
        
        if (mapImagesCount) {
            mapImagesCount.textContent = moderationData.missing_map_images_count || 0;
            mapImagesCount.classList.toggle('admin-moderation-accordion-count--alert', moderationData.missing_map_images_count > 0);
        }
        if (mapImagesList) {
            mapImagesList.innerHTML = '';
            if (moderationData.missing_map_images && moderationData.missing_map_images.length > 0) {
                moderationData.missing_map_images.forEach(function(entry) {
                    mapImagesList.appendChild(createMapImagesItem(entry));
                });
                if (mapImagesEmpty) mapImagesEmpty.classList.add('admin-moderation-empty--hidden');
            } else {
                if (mapImagesEmpty) mapImagesEmpty.classList.remove('admin-moderation-empty--hidden');
            }
        }
    }
    
    function createMapImagesItem(entry) {
        var item = document.createElement('div');
        item.className = 'admin-moderation-item';
        item.dataset.logId = entry.id;
        item.dataset.postId = entry.post_id;
        
        // Map icon
        var icon = document.createElement('div');
        icon.className = 'admin-moderation-item-avatar';
        icon.innerHTML = '<div class="admin-moderation-item-avatar-icon admin-moderation-item-avatar-icon--map"></div>';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        
        // Info
        var info = document.createElement('div');
        info.className = 'admin-moderation-item-info';
        
        var name = document.createElement('span');
        name.className = 'admin-moderation-item-name';
        name.textContent = entry.post_title || 'Post #' + entry.post_id;
        
        var meta = document.createElement('span');
        meta.className = 'admin-moderation-item-meta';
        if (entry.lat && entry.lng) {
            meta.textContent = 'Lat: ' + Number(entry.lat).toFixed(4) + ', Lng: ' + Number(entry.lng).toFixed(4);
        } else {
            meta.textContent = 'Coordinates unknown';
        }
        
        info.appendChild(name);
        info.appendChild(meta);
        
        // Actions
        var actions = document.createElement('div');
        actions.className = 'admin-moderation-item-actions';
        
        var dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'admin-moderation-item-btn admin-moderation-item-btn--reactivate';
        dismissBtn.innerHTML = '<div class="admin-moderation-item-btn-icon admin-moderation-item-btn-icon--tick"></div>';
        dismissBtn.title = 'Dismiss (Mark as Resolved)';
        dismissBtn.onclick = function() { handleModerationAction('dismiss_missing_map_images', null, null, entry.id); };
        
        actions.appendChild(dismissBtn);
        
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(actions);
        
        return item;
    }
    
    function createMemberItem(member) {
        var item = document.createElement('div');
        item.className = 'admin-moderation-item';
        item.dataset.memberId = member.id;
        
        // Avatar
        var avatar = document.createElement('img');
        avatar.className = 'admin-moderation-item-avatar';
        avatar.alt = '';
        if (member.avatar_file && window.App && App.getImageUrl) {
            avatar.src = App.getImageUrl('avatars', member.avatar_file);
        } else {
            avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="8" r="4" fill="%23666"/%3E%3Cpath d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="%23666"/%3E%3C/svg%3E';
        }
        
        // Info
        var info = document.createElement('div');
        info.className = 'admin-moderation-item-info';
        
        var name = document.createElement('span');
        name.className = 'admin-moderation-item-name';
        name.textContent = member.username || member.account_email;
        
        var meta = document.createElement('span');
        meta.className = 'admin-moderation-item-meta';
        meta.textContent = member.account_email;
        
        info.appendChild(name);
        info.appendChild(meta);
        
        // Days remaining
        var days = document.createElement('span');
        days.className = 'admin-moderation-item-days';
        days.textContent = member.days_remaining + 'd';
        days.title = member.days_remaining + ' days remaining';
        
        // Actions
        var actions = document.createElement('div');
        actions.className = 'admin-moderation-item-actions';
        
        var reactivateBtn = document.createElement('button');
        reactivateBtn.type = 'button';
        reactivateBtn.className = 'admin-moderation-item-btn admin-moderation-item-btn--reactivate';
        reactivateBtn.innerHTML = '<div class="admin-moderation-item-btn-icon admin-moderation-item-btn-icon--reactivate"></div>';
        reactivateBtn.title = 'Reactivate Account';
        reactivateBtn.onclick = function() { handleModerationAction('reactivate_member', member.id); };
        
        var anonymizeBtn = document.createElement('button');
        anonymizeBtn.type = 'button';
        anonymizeBtn.className = 'admin-moderation-item-btn admin-moderation-item-btn--anonymize';
        anonymizeBtn.innerHTML = '<div class="admin-moderation-item-btn-icon admin-moderation-item-btn-icon--trash"></div>';
        anonymizeBtn.title = 'Anonymize Account';
        anonymizeBtn.onclick = function() { confirmAnonymize(member); };
        
        actions.appendChild(reactivateBtn);
        actions.appendChild(anonymizeBtn);
        
        item.appendChild(avatar);
        item.appendChild(info);
        item.appendChild(days);
        item.appendChild(actions);
        
        return item;
    }
    
    function createPostItem(post) {
        var item = document.createElement('div');
        item.className = 'admin-moderation-item';
        item.dataset.postId = post.id;
        
        // Flag icon instead of avatar
        var icon = document.createElement('div');
        icon.className = 'admin-moderation-item-avatar';
        icon.innerHTML = '<div class="admin-moderation-item-avatar-icon"></div>';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        
        // Info
        var info = document.createElement('div');
        info.className = 'admin-moderation-item-info';
        
        var name = document.createElement('span');
        name.className = 'admin-moderation-item-name';
        name.textContent = post.title || 'Untitled Post';
        
        var meta = document.createElement('span');
        meta.className = 'admin-moderation-item-meta';
        meta.textContent = 'by ' + (post.member_name || 'Unknown');
        
        info.appendChild(name);
        info.appendChild(meta);
        
        // Actions
        var actions = document.createElement('div');
        actions.className = 'admin-moderation-item-actions';
        
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'admin-moderation-item-btn admin-moderation-item-btn--reactivate';
        clearBtn.innerHTML = '<div class="admin-moderation-item-btn-icon admin-moderation-item-btn-icon--tick"></div>';
        clearBtn.title = 'Clear Flag';
        clearBtn.onclick = function() { handleModerationAction('clear_post_flag', null, post.id); };
        
        var hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'admin-moderation-item-btn admin-moderation-item-btn--anonymize';
        hideBtn.innerHTML = '<div class="admin-moderation-item-btn-icon admin-moderation-item-btn-icon--hide"></div>';
        hideBtn.title = 'Hide Post';
        hideBtn.onclick = function() { handleModerationAction('hide_post', null, post.id); };
        
        actions.appendChild(clearBtn);
        actions.appendChild(hideBtn);
        
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(actions);
        
        return item;
    }
    
    function confirmAnonymize(member) {
        var name = member.username || member.account_email;
        if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
            ConfirmDialogComponent.show({
                titleText: 'Anonymize Account',
                messageText: 'Permanently anonymize "' + name + '"? This cannot be undone.',
                confirmLabel: 'Anonymize',
                cancelLabel: 'Cancel',
                confirmClass: 'danger',
                focusCancel: true
            }).then(function(confirmed) {
                if (confirmed) {
                    handleModerationAction('anonymize_member', member.id);
                }
            });
        }
    }
    
    function handleModerationAction(action, memberId, postId, logId) {
        var body = { action: action };
        if (memberId) body.member_id = memberId;
        if (postId) body.post_id = postId;
        if (logId) body.log_id = logId;
        
        fetch('/gateway.php?action=moderation-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                // Reload moderation data
                loadModerationData();
                if (window.ToastComponent) {
                    ToastComponent.showSuccess('Action completed.');
                }
            } else {
                if (window.ToastComponent) {
                    ToastComponent.showError(data.error || 'Action failed.');
                }
            }
        })
        .catch(function(err) {
            console.error('[Admin] Moderation action failed:', err);
            if (window.ToastComponent) {
                ToastComponent.showError('Action failed.');
            }
        });
    }

    /* --------------------------------------------------------------------------
       SETTINGS TAB
       
       Contains website settings loaded from admin_settings table.
       Uses simple field tracking (registerField/updateField).
       -------------------------------------------------------------------------- */
    
    var settingsContainer = null;
    var settingsInitialized = false;
    var settingsData = {}; // Cached settings from database
    
    function initSettingsTab() {
        if (settingsInitialized) return;
        
        settingsContainer = document.getElementById('admin-tab-settings');
        if (!settingsContainer) return;
        
        // Load settings from database then attach to existing HTML
        loadSettingsFromDatabase().then(function() {
            attachSettingsHandlers();
            settingsInitialized = true;
        });
    }
    
    function loadSettingsFromDatabase() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.settings) {
                    settingsData = data.settings;
                    
                    // Store system_images data separately
                    if (data.system_images) {
                        settingsData.system_images = data.system_images;
                    }
                    
                    // Store console_filter setting from database (source of truth)
                    if (data.settings.console_filter !== undefined) {
                        window._consoleFilterEnabled = data.settings.console_filter;
                        // Apply immediately if the ConsoleFilter module is available
                        try {
                            if (window.ConsoleFilter && typeof window.ConsoleFilter.enable === 'function' && typeof window.ConsoleFilter.disable === 'function') {
                                if (data.settings.console_filter) window.ConsoleFilter.enable();
                                else window.ConsoleFilter.disable();
                            }
                        } catch (e) {}
                    }

                    // Use database setting for system images folder
                    if (window.SystemImagePickerComponent && settingsData.folder_system_images) {
                        SystemImagePickerComponent.setImageFolder(settingsData.folder_system_images);
                    }

                    // Initialize CurrencyComponent data if available
                    if (window.CurrencyComponent && data.dropdown_options && data.dropdown_options.currency) {
                        CurrencyComponent.setData(data.dropdown_options.currency);
                    }

                    // Initialize AgeRatingComponent data if available
                    if (window.AgeRatingComponent && data.dropdown_options && data.dropdown_options['age-rating']) {
                        AgeRatingComponent.setData(data.dropdown_options['age-rating']);
                    }

                    // Render checkout options and register for tracking
                    if (data.checkout_options && Array.isArray(data.checkout_options)) {
                        renderCheckoutOptions(data.checkout_options, requireWebsiteCurrencyFromSettings(settingsData));
                        // Register as composite field for change tracking
                        registerComposite('checkout_options', getCheckoutOptionsFromUI);
                    }
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load settings:', err);
            });
    }
    
    function attachSettingsHandlers() {
        if (!settingsContainer) return;
        
        // Attach accordion toggles (Image Manager + Image Files)
        settingsContainer.querySelectorAll('.admin-settings-imagemanager-accordion').forEach(function(acc) {
            var header = acc.querySelector('.admin-settings-imagemanager-accordion-header');
            if (!header) return;
            header.addEventListener('click', function() {
                acc.classList.toggle('admin-settings-imagemanager-accordion--open');
                syncSettingsImagemanagerAccordionUi(acc);
            });
            syncSettingsImagemanagerAccordionUi(acc);
        });
        
        // Attach to text inputs
        settingsContainer.querySelectorAll('.admin-settings-field-input[data-setting-key]').forEach(function(input) {
            var key = input.dataset.settingKey;
            var initialValue = settingsData[key] || '';
            input.value = initialValue;
            
            registerField('settings.' + key, initialValue);
            
            input.addEventListener('input', function() {
                updateField('settings.' + key, input.value);
            });
        });
        
        // Attach to textareas
        settingsContainer.querySelectorAll('.admin-settings-field-textarea[data-setting-key]').forEach(function(textarea) {
            var key = textarea.dataset.settingKey;
            var initialValue = settingsData[key] || '';
            // Parse JSON string if needed (welcome_message is stored as JSON)
            if (typeof initialValue === 'string' && initialValue.startsWith('"')) {
                try {
                    initialValue = JSON.parse(initialValue);
                } catch (e) {}
            }
            textarea.value = initialValue;
            
            registerField('settings.' + key, initialValue);
            
            textarea.addEventListener('input', function() {
                updateField('settings.' + key, textarea.value);
            });
            
            TextareaResizeComponent.attach(textarea);
        });
        
        // Attach to toggle checkboxes
        settingsContainer.querySelectorAll('.component-switch-input[data-setting-key]').forEach(function(checkbox) {
            var key = checkbox.dataset.settingKey;
            var initialValue = settingsData[key] === true || settingsData[key] === 'true' || settingsData[key] === '1';
            checkbox.checked = initialValue;
            syncSettingsToggleUi(checkbox);
            
            registerField('settings.' + key, initialValue);
            
            checkbox.addEventListener('change', function() {
                updateField('settings.' + key, checkbox.checked);
                syncSettingsToggleUi(checkbox);
                
                // Special handling for console_filter: apply immediately (no localStorage dependency)
                if (key === 'console_filter') {
                    window._consoleFilterEnabled = checkbox.checked;
                    try {
                        if (window.ConsoleFilter && typeof window.ConsoleFilter.enable === 'function' && typeof window.ConsoleFilter.disable === 'function') {
                            if (checkbox.checked) window.ConsoleFilter.enable();
                            else window.ConsoleFilter.disable();
                        }
                    } catch (e) {}
                }
            });
        });
        
        // Countdown postcards mode radio buttons
        var countdownModeRadios = settingsContainer.querySelectorAll('input[name="adminCountdownPostcardsMode"]');
        if (countdownModeRadios.length) {
            var initialCountdownMode = settingsData.countdown_postcards_mode || 'soonest_only';
            countdownModeRadios.forEach(function(radio) {
                radio.checked = (radio.value === initialCountdownMode);
            });
            
            registerField('settings.countdown_postcards_mode', initialCountdownMode);
            
            countdownModeRadios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    if (radio.checked) {
                        updateField('settings.countdown_postcards_mode', radio.value);
                    }
                });
            });
        }
        
        // Welcome load type radio buttons
        var welcomeLoadTypeRadios = settingsContainer.querySelectorAll('input[name="adminWelcomeLoadType"]');
        if (welcomeLoadTypeRadios.length) {
            var initialWelcomeLoadType = settingsData.welcome_load_type || 'everyone';
            welcomeLoadTypeRadios.forEach(function(radio) {
                radio.checked = (radio.value === initialWelcomeLoadType);
            });
            
            registerField('settings.welcome_load_type', initialWelcomeLoadType);
            
            welcomeLoadTypeRadios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    if (radio.checked) {
                        updateField('settings.welcome_load_type', radio.value);
                    }
                });
            });
        }
        
        // Grey out welcome load type when welcome message is off
        var welcomeEnabledCheckbox = document.getElementById('adminWelcomeEnabled');
        var welcomeLoadTypeContainer = document.getElementById('adminWelcomeLoadType');
        if (welcomeEnabledCheckbox && welcomeLoadTypeContainer) {
            if (!welcomeEnabledCheckbox.checked) welcomeLoadTypeContainer.classList.add('admin-panel-field--disabled');
            welcomeEnabledCheckbox.addEventListener('change', function() {
                if (welcomeEnabledCheckbox.checked) {
                    welcomeLoadTypeContainer.classList.remove('admin-panel-field--disabled');
                } else {
                    welcomeLoadTypeContainer.classList.add('admin-panel-field--disabled');
                }
            });
        }

        // Grey out countdown postcards mode when countdown postcards is off
        var countdownPostcardsCheckbox = document.getElementById('adminCountdownPostcards');
        var countdownPostcardsModeContainer = document.getElementById('adminCountdownPostcardsMode');
        if (countdownPostcardsCheckbox && countdownPostcardsModeContainer) {
            if (!countdownPostcardsCheckbox.checked) countdownPostcardsModeContainer.classList.add('admin-panel-field--disabled');
            countdownPostcardsCheckbox.addEventListener('change', function() {
                if (countdownPostcardsCheckbox.checked) {
                    countdownPostcardsModeContainer.classList.remove('admin-panel-field--disabled');
                } else {
                    countdownPostcardsModeContainer.classList.add('admin-panel-field--disabled');
                }
            });
        }

        // Load countdown info message from admin_messages
        loadCountdownInfoMessage();
        
        // Initialize image pickers (using SystemImagePickerComponent from components file)
        initImagePicker('adminBigLogoPicker', 'big_logo');
        initImagePicker('adminSmallLogoPicker', 'small_logo');
        initImagePicker('adminFaviconPicker', 'favicon');
        initImagePicker('adminIconFilterPicker', 'icon_filter');
        initImagePicker('adminIconRecentPicker', 'icon_recent');
        initImagePicker('adminIconPostsPicker', 'icon_posts');
        initImagePicker('adminIconMapPicker', 'icon_map');
        initImagePicker('adminIconMemberPicker', 'icon_member');
        initImagePicker('adminIconAdminPicker', 'icon_admin');
        initImagePicker('adminIconFullscreenPicker', 'icon_fullscreen');
        initImagePicker('adminIconFullscreenExitPicker', 'icon_fullscreen_exit');
        initImagePicker('adminIconGeolocatePicker', 'icon_geolocate');
        initImagePicker('adminIconCompassPicker', 'icon_compass');
        initImagePicker('adminIconLightingDawnPicker', 'icon_lighting_dawn');
        initImagePicker('adminIconLightingDayPicker', 'icon_lighting_day');
        initImagePicker('adminIconLightingDuskPicker', 'icon_lighting_dusk');
        initImagePicker('adminIconLightingNightPicker', 'icon_lighting_night');
        initImagePicker('adminIconSavePicker', 'icon_save');
        initImagePicker('adminIconDiscardPicker', 'icon_discard');
        initImagePicker('adminIconClosePicker', 'icon_close');
        initImagePicker('adminIconClearPicker', 'icon_clear');
        initImagePicker('adminIconAddImagePicker', 'icon_add_image');
        initImagePicker('adminIconTicketPicker', 'icon_ticket');
        initImagePicker('adminIconFavouritesPicker', 'icon_favourites');
        initImagePicker('adminIconPlusPicker', 'icon_plus');
        initImagePicker('adminIconMinusPicker', 'icon_minus');
        initImagePicker('adminIconCheckmarkPicker', 'icon_checkmark');
        initImagePicker('adminIconCheckboxPicker', 'icon_checkbox');
        initImagePicker('adminIconRadioPicker', 'icon_radio');
        initImagePicker('adminIconRadioSelectedPicker', 'icon_radio_selected');
        initImagePicker('adminIconArrowDownPicker', 'icon_arrow_down');
        initImagePicker('adminIconEditPicker', 'icon_edit');
        initImagePicker('adminIconInfoPicker', 'icon_info');
        initImagePicker('adminIconSharePicker', 'icon_share');
        initImagePicker('adminIconDragHandlePicker', 'icon_drag_handle');
        initImagePicker('adminIconMoreDotsPicker', 'icon_more_dots');
        initImagePicker('adminIconSearchPicker', 'icon_search');
        initImagePicker('adminIconReactivatePicker', 'icon_reactivate');
        initImagePicker('adminIconTrashPicker', 'icon_trash');
        initImagePicker('adminIconFlagPicker', 'icon_flag');
        initImagePicker('adminIconTickPicker', 'icon_tick');
        initImagePicker('adminIconHidePicker', 'icon_hide');
        initImagePicker('adminIconShowPicker', 'icon_show');
        initImagePicker('adminPostPanelEmptyImagePicker', 'post_panel_empty_image', 'folder_post_system_images');
        initImagePicker('adminRecentPanelEmptyImagePicker', 'recent_panel_footer_image', 'folder_recent_system_images');
        
        // Initialize currency picker (using CurrencyComponent from components file)
        initCurrencyPicker('adminCurrencyPicker', 'website_currency');
        
        // Add explanation to API container
        addImageSyncExplanation();
    }

    function syncSettingsToggleUi(checkbox) {
        if (!checkbox) return;
        var wrapper = checkbox.closest('.component-switch');
        if (!wrapper) return;
        var slider = wrapper.querySelector('.component-switch-slider');
        if (!slider) return;
        slider.classList.toggle('component-switch-slider--on-default', !!checkbox.checked);
    }

    function syncSettingsImagemanagerAccordionUi(acc) {
        if (!acc) return;
        var isOpen = acc.classList.contains('admin-settings-imagemanager-accordion--open');
        var header = acc.querySelector('.admin-settings-imagemanager-accordion-header');
        var arrow = acc.querySelector('.admin-settings-imagemanager-accordion-header-arrow');
        var body = acc.querySelector('.admin-settings-imagemanager-accordion-body');
        // Toggle bridge state class on accordion root
        acc.classList.toggle('accordion-class-1--open', !!isOpen);
        // Keep component-specific classes for backwards compatibility
        if (header) header.classList.toggle('admin-settings-imagemanager-accordion-header--open', !!isOpen);
        if (arrow) arrow.classList.toggle('admin-settings-imagemanager-accordion-header-arrow--open', !!isOpen);
        if (body) body.classList.toggle('admin-settings-imagemanager-accordion-body--open', !!isOpen);
    }
    
    function addImageSyncExplanation() {
        var apiContainer = settingsContainer.querySelector('.admin-settings-api-container');
        if (!apiContainer) return;
        
        // Check if explanation already exists
        if (apiContainer.querySelector('.admin-settings-explanation')) return;
        
        var explanation = document.createElement('div');
        explanation.className = 'admin-settings-explanation';
        explanation.style.cssText = 'padding: 15px; margin-top: 20px; background-color: rgba(255, 255, 255, 0.1); border-radius: 4px; font-size: 13px; line-height: 1.6; color: rgba(255, 255, 255, 0.9);';
        explanation.innerHTML = '<strong>How Image Sync Works:</strong><br>' +
            'All image picker menus (System Images, Category Icons, Currencies, Phone Prefixes, Amenities) use separate database tables (system_images, category_icons, currencies, phone_prefixes, amenities) for instant menu loading. When you open an image picker menu, it displays instantly from the database tables. The system syncs with Bunny CDN when the admin panel opens (1.5 second delay, background, once per session) to add new files, remove deleted files, and handle renamed files. No API calls occur at website startup, ensuring fast page loads.';
        
        apiContainer.appendChild(explanation);
    }
    
    function loadCountdownInfoMessage() {
        var countdownTooltipEls = document.querySelectorAll('.admin-countdown-tooltip');
        var mapCardTooltipEl = document.querySelector('.admin-map-card-breakpoint-tooltip');
        var mapCardPriorityTooltipEl = document.querySelector('.admin-map-card-priority-tooltip');
        
        if (!countdownTooltipEls.length && !mapCardTooltipEl && !mapCardPriorityTooltipEl) return;
        
        // Fetch messages from admin_messages
        fetch('/gateway.php?action=get-admin-settings&include_messages=true')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.messages) {
                    var timezoneMsg = null;
                    var mapCardMsg = null;
                    var mapCardPriorityMsg = null;
                    
                    // Messages are grouped by container
                    for (var containerKey in data.messages) {
                        var container = data.messages[containerKey];
                        if (container.messages) {
                            for (var i = 0; i < container.messages.length; i++) {
                                var msg = container.messages[i];
                                if (msg.message_key === 'msg_timezone_info') {
                                    timezoneMsg = msg;
                                }
                                if (msg.message_key === 'msg_map_card_breakpoint_info') {
                                    mapCardMsg = msg;
                                }
                                if (msg.message_key === 'msg_map_card_priority_info') {
                                    mapCardPriorityMsg = msg;
                                }
                            }
                        }
                    }
                    
                    // Populate countdown tooltips
                    if (timezoneMsg && timezoneMsg.message_text && countdownTooltipEls.length) {
                        countdownTooltipEls.forEach(function(el) {
                            el.textContent = timezoneMsg.message_text;
                        });
                    }
                    
                    // Populate map card breakpoint tooltip
                    if (mapCardMsg && mapCardMsg.message_text && mapCardTooltipEl) {
                        mapCardTooltipEl.textContent = mapCardMsg.message_text;
                    }
                    
                    // Populate map card priority tooltip
                    if (mapCardPriorityMsg && mapCardPriorityMsg.message_text && mapCardPriorityTooltipEl) {
                        mapCardPriorityTooltipEl.textContent = mapCardPriorityMsg.message_text;
                    }
                }
            })
            .catch(function(err) {
                console.warn('[Admin] Could not load tooltip messages:', err);
            });
    }
    
    function initImagePicker(containerId, settingKey, folderSettingKey) {
        var container = document.getElementById(containerId);
        if (!container || !window.SystemImagePickerComponent) return;

        // Get initial value from system_images (filename only, not full path)
        var initialValue = '';
        if (settingsData.system_images && settingsData.system_images[settingKey]) {
            initialValue = settingsData.system_images[settingKey];
        }

        var folderPathOverride = null;
        if (folderSettingKey && settingsData && settingsData[folderSettingKey]) {
            folderPathOverride = settingsData[folderSettingKey];
        }

        var picker = SystemImagePickerComponent.buildPicker({
            container: settingsContainer,
            databaseValue: initialValue,
            folderPath: folderPathOverride,
            onSelect: function(imagePath) {
                // Extract filename from full path
                var filename = imagePath;
                if (imagePath.indexOf('/') !== -1) {
                    filename = imagePath.split('/').pop();
                }
                
                // Update system_images field (not settings)
                updateField('system_images.' + settingKey, filename);
                
                // Update UI immediately based on which setting changed
                if (settingKey === 'small_logo') {
                    // Header module handles small logo
                    var headerModule = App.getModule('header');
                    if (headerModule && headerModule.setLogo) {
                        headerModule.setLogo(imagePath);
                    }
                } else if (settingKey === 'favicon') {
                    // App handles favicon
                    App.setFavicon(imagePath);
                } else if (settingKey === 'big_logo') {
                    // WelcomeModalComponent handles big logo
                    if (window.WelcomeModalComponent && WelcomeModalComponent.setLogo) {
                        WelcomeModalComponent.setLogo(imagePath);
                    }
                }
            }
        });

        picker.element.dataset.settingKey = settingKey;
        picker.element.dataset.isSystemImage = 'true';
        container.appendChild(picker.element);

        registerField('system_images.' + settingKey, initialValue);
    }
    
    function initCurrencyPicker(containerId, settingKey) {
        var container = document.getElementById(containerId);
        if (!container || !window.CurrencyComponent) return;
        
        // Use settingsData value if available, otherwise null (user must select)
        var initialValue = settingsData[settingKey] || null;
        
        var picker = CurrencyComponent.buildFullMenu({
            container: settingsContainer,
            initialValue: initialValue,
            onSelect: function(currencyCode, currencyName, countryCode) {
                updateField('settings.' + settingKey, currencyCode);
                // Update local cache so new checkout options use correct currency
                settingsData[settingKey] = currencyCode;
                // Update checkout options currency display
                updateCheckoutOptionsCurrency(currencyCode);
            }
        });
        
        picker.element.dataset.settingKey = settingKey;
        container.appendChild(picker.element);
        
        registerField('settings.' + settingKey, initialValue);
    }
    
    // Update all currency displays in checkout options
    function updateCheckoutOptionsCurrency(currencyCode) {
        // Update data attribute on container so updateCalculator uses correct currency
        var container = document.getElementById('adminCheckoutTiers');
        if (container) {
            container.dataset.currency = currencyCode;
        }
        
        // Update calculator totals
        document.querySelectorAll('.admin-checkout-option-calc-total').forEach(function(span) {
            var text = span.textContent;
            // Replace old currency code with new one (format: "XXX 0.00")
            var match = text.match(/^[A-Z]{3}\s+(.*)$/);
            if (match) {
                span.textContent = currencyCode + ' ' + match[1];
            } else {
                span.textContent = currencyCode + ' 0.00';
            }
        });

    }

    /* --------------------------------------------------------------------------
       CHECKOUT OPTIONS (accordion style like Messages/Formbuilder)
       -------------------------------------------------------------------------- */

    function closeAllCheckoutEditPanels(exceptAccordion) {
        var container = document.getElementById('adminCheckoutTiers');
        if (!container) return;
        container.querySelectorAll('.admin-checkout-accordion--editing').forEach(function(el) {
            if (el !== exceptAccordion) {
                el.classList.remove('admin-checkout-accordion--editing');
                syncCheckoutAccordionUi(el);
            }
        });
    }

    function syncCheckoutAccordionUi(accordion) {
        if (!accordion) return;
        var isEditing = accordion.classList.contains('admin-checkout-accordion--editing');
        var isHidden = accordion.classList.contains('admin-checkout-accordion--hidden');
        var header = accordion.querySelector('.admin-checkout-accordion-header');
        var arrow = accordion.querySelector('.admin-checkout-accordion-header-arrow');
        var body = accordion.querySelector('.admin-checkout-accordion-body');
        accordion.classList.toggle('accordion-class-1--open', !!isEditing);
        if (header) {
            header.classList.toggle('admin-checkout-accordion-header--hidden', !!isHidden);
        }
        if (arrow) arrow.classList.toggle('admin-checkout-accordion-header-arrow--editing', !!isEditing);
        if (body) body.classList.toggle('admin-checkout-accordion-body--open', !!isEditing);
    }

    function renderCheckoutOptions(checkoutOptions, siteCurrency) {
        var container = document.getElementById('adminCheckoutTiers');
        if (!container) return;

        if (!siteCurrency || typeof siteCurrency !== 'string' || !siteCurrency.trim()) {
            throw new Error('[Admin] renderCheckoutOptions: siteCurrency is required');
        }

        // Store currency on container for dynamic updates
        container.dataset.currency = siteCurrency.trim().toUpperCase();
        container.innerHTML = '';

        if (!checkoutOptions || !checkoutOptions.length) {
            throw new Error('[Admin] No checkout options configured');
        }

        checkoutOptions.forEach(function(option, index) {
            if (!option) {
                throw new Error('[Admin] renderCheckoutOptions: checkoutOptions contains null/undefined option');
            }
            if (option.id === undefined || option.id === null || String(option.id).trim() === '') {
                throw new Error('[Admin] renderCheckoutOptions: option.id is required');
            }
            if (!option.checkout_title || String(option.checkout_title).trim() === '') {
                throw new Error('[Admin] renderCheckoutOptions: option.checkout_title is required for option id ' + String(option.id));
            }

            var accordion = document.createElement('div');
            accordion.className = 'admin-checkout-accordion accordion-class-1';
            accordion.dataset.id = option.id;

            var flagfallPrice = option.checkout_flagfall_price !== undefined ? option.checkout_flagfall_price : 0;
            var basicDayRate = option.checkout_basic_day_rate !== undefined && option.checkout_basic_day_rate !== null ? parseFloat(option.checkout_basic_day_rate).toFixed(2) : '0.00';
            var discountDayRate = option.checkout_discount_day_rate !== undefined && option.checkout_discount_day_rate !== null ? parseFloat(option.checkout_discount_day_rate).toFixed(2) : '0.00';
            var isFeatured = option.checkout_featured === 1 || option.checkout_featured === true;
            var featuredBadgeText = isFeatured ? 'featured' : 'standard';
            var isHidden = option.hidden === 1 || option.hidden === true;

            // Header
            var header = document.createElement('div');
            header.className = 'admin-checkout-accordion-header accordion-header';

            // Header text (title)
            var headerText = document.createElement('span');
            headerText.className = 'admin-checkout-accordion-header-text';
            headerText.textContent = String(option.checkout_title).trim();

            // Header badge
            var headerBadge = document.createElement('span');
            headerBadge.className = 'admin-checkout-accordion-header-badge' + (isFeatured ? ' admin-checkout-accordion-header-badge--featured' : '');
            headerBadge.textContent = featuredBadgeText;

            // Arrow (same as messages/formbuilder)
            var headerArrow = document.createElement('span');
            headerArrow.className = 'admin-checkout-accordion-header-arrow';

            header.appendChild(headerText);
            header.appendChild(headerBadge);
            header.appendChild(headerArrow);

            // Body
            var body = document.createElement('div');
            body.className = 'admin-checkout-accordion-body accordion-body';

            // Title row with input and more button (same as formbuilder)
            var titleRow = document.createElement('div');
            titleRow.className = 'admin-checkout-accordion-body-row admin-checkout-accordion-body-row--title';

            var titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'admin-checkout-accordion-body-input admin-checkout-option-title';
            titleInput.classList.add('admin-checkout-accordion-body-input--title');
            titleInput.value = String(option.checkout_title).trim();
            titleInput.placeholder = 'Title';

            // More button (3-dot menu) - inside edit panel like formbuilder
            var moreBtn = document.createElement('div');
            moreBtn.className = 'admin-checkout-accordion-body-more';
            moreBtn.innerHTML = '<div class="admin-checkout-accordion-body-more-icon"></div>' + 
                '<div class="admin-checkout-accordion-body-more-menu">' +
                    '<div class="admin-checkout-accordion-body-more-item">' +
                        '<span class="admin-checkout-accordion-body-more-item-text">Hide Tier</span>' +
                        '<label class="component-switch"><input class="component-switch-input" type="checkbox"' + (isHidden ? ' checked' : '') + '><span class="component-switch-slider' + (isHidden ? ' component-switch-slider--on-default' : '') + '"></span></label>' +
                    '</div>' +
                '</div>';

            titleRow.appendChild(titleInput);
            titleRow.appendChild(moreBtn);
            body.appendChild(titleRow);

            // Rest of the body
            var restOfPanel = document.createElement('div');
            restOfPanel.innerHTML =
                '<div class="admin-checkout-accordion-body-row">' +
                    '<label class="admin-checkout-accordion-body-label">Description</label>' +
                    '<textarea class="admin-checkout-accordion-body-textarea admin-checkout-option-description" placeholder="Description">' + escapeHtml(option.checkout_description || '') + '</textarea>' +
                '</div>' +
                '<div class="admin-checkout-accordion-body-row admin-checkout-accordion-body-row--checkboxes admin-checkout-accordion-body-row--disabled">' +
                    '<label class="admin-checkout-accordion-body-checkbox"><input type="checkbox" class="admin-checkout-option-featured" disabled' + (isFeatured ? ' checked' : '') + ' /><span>Featured</span></label>' +
                    '<label class="admin-checkout-accordion-body-checkbox"><input type="checkbox" class="admin-checkout-option-sidebar" disabled' + (option.checkout_sidebar_ad ? ' checked' : '') + ' /><span>Sidebar Ad</span></label>' +
                '</div>' +
                '<div class="admin-checkout-accordion-body-row">' +
                    '<label class="admin-checkout-accordion-body-label">Flagfall Price</label>' +
                    '<input type="text" inputmode="decimal" class="admin-checkout-accordion-body-input admin-checkout-option-price" value="' + flagfallPrice.toFixed(2) + '" placeholder="0.00" />' +
                '</div>' +
                '<div class="admin-checkout-accordion-body-row">' +
                    '<label class="admin-checkout-accordion-body-label">Basic Day Rate</label>' +
                    '<input type="text" inputmode="decimal" class="admin-checkout-accordion-body-input admin-checkout-option-basic-day-rate" value="' + basicDayRate + '" placeholder="N/A" />' +
                '</div>' +
                '<div class="admin-checkout-accordion-body-row">' +
                    '<label class="admin-checkout-accordion-body-label">Discount Day Rate</label>' +
                    '<input type="text" inputmode="decimal" class="admin-checkout-accordion-body-input admin-checkout-option-discount-day-rate" value="' + discountDayRate + '" placeholder="N/A" />' +
                '</div>' +
                '<div class="admin-checkout-accordion-body-row">' +
                    '<label class="admin-checkout-accordion-body-label">Price Calculator (Sandbox)</label>' +
                    '<div class="admin-checkout-accordion-body-calc">' +
                        '<input type="text" inputmode="numeric" class="admin-checkout-accordion-body-input admin-checkout-accordion-body-input--calc admin-checkout-option-calc-days" value="" placeholder="Days" />' +
                        '<input type="text" inputmode="numeric" class="admin-checkout-accordion-body-input admin-checkout-accordion-body-input--calc admin-checkout-option-calc-locations" value="1" placeholder="Locations" />' +
                        '<input type="text" inputmode="decimal" class="admin-checkout-accordion-body-input admin-checkout-accordion-body-input--calc admin-checkout-option-calc-surcharge" value="0" placeholder="Surcharge %" />' +
                        '<span class="admin-checkout-accordion-body-calc-equals">=</span>' +
                        '<span class="admin-checkout-option-calc-total">' + siteCurrency + ' 0.00</span>' +
                    '</div>' +
                '</div>';
            
            // Append all children from restOfPanel
            while (restOfPanel.firstChild) {
                body.appendChild(restOfPanel.firstChild);
            }
            
            // Calculator inputs have their --calc class baked into the markup above.

            // Set hidden class if hidden
            if (isHidden) {
                accordion.classList.add('admin-checkout-accordion--hidden');
            }

            accordion.appendChild(header);
            accordion.appendChild(body);
            container.appendChild(accordion);
            syncCheckoutAccordionUi(accordion);

            // More button click - toggle menu
            var moreMenuEl = moreBtn.querySelector('.admin-checkout-accordion-body-more-menu');
            moreBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var wasOpen = moreMenuEl && moreMenuEl.classList.contains('admin-checkout-accordion-body-more-menu--open');
                // Close all other menus
                container.querySelectorAll('.admin-checkout-accordion-body-more-menu--open').forEach(function(el) {
                    if (el !== moreMenuEl) el.classList.remove('admin-checkout-accordion-body-more-menu--open');
                });
                if (!moreMenuEl) return;
                if (!wasOpen) moreMenuEl.classList.add('admin-checkout-accordion-body-more-menu--open');
                else moreMenuEl.classList.remove('admin-checkout-accordion-body-more-menu--open');
            });

            // Hide switch click
            var hideSwitch = moreBtn.querySelector('.component-switch');
            var hideSwitchInput = hideSwitch.querySelector('.component-switch-input');
            var hideSwitchSlider = hideSwitch.querySelector('.component-switch-slider');
            hideSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                hideSwitchInput.checked = !hideSwitchInput.checked;
                hideSwitchSlider.classList.toggle('component-switch-slider--on-default');
                accordion.classList.toggle('admin-checkout-accordion--hidden');
                syncCheckoutAccordionUi(accordion);
                markDirty();
            });


            // Title input updates header text
            titleInput.addEventListener('input', function() {
                headerText.textContent = titleInput.value.trim();
                markDirty();
            });

            // Header click - toggle edit panel
            header.addEventListener('click', function(e) {
                var isEditing = accordion.classList.contains('admin-checkout-accordion--editing');
                closeAllCheckoutEditPanels(accordion);
                if (!isEditing) {
                    accordion.classList.add('admin-checkout-accordion--editing');
                } else {
                    accordion.classList.remove('admin-checkout-accordion--editing');
                }
                syncCheckoutAccordionUi(accordion);
            });

            // Description textarea
            var descriptionInput = accordion.querySelector('.admin-checkout-option-description');
            if (descriptionInput) {
                descriptionInput.addEventListener('input', function() {
                    markDirty();
                });
                TextareaResizeComponent.attach(descriptionInput);
            }

            // Featured checkbox updates badge
            var featuredCheckbox = accordion.querySelector('.admin-checkout-option-featured');
            if (featuredCheckbox) {
                featuredCheckbox.addEventListener('change', function() {
                    var isFeatured = featuredCheckbox.checked;
                    headerBadge.className = 'admin-checkout-accordion-header-badge' + (isFeatured ? ' admin-checkout-accordion-header-badge--featured' : '');
                    headerBadge.textContent = isFeatured ? 'featured' : 'standard';
                    markDirty();
                });
            }

            // Sidebar checkbox
            var sidebarCheckbox = accordion.querySelector('.admin-checkout-option-sidebar');
            if (sidebarCheckbox) {
                sidebarCheckbox.addEventListener('change', function() {
                    markDirty();
                });
            }

            // Price calculator logic
            var calcDaysInput = accordion.querySelector('.admin-checkout-option-calc-days');
            var calcLocationsInput = accordion.querySelector('.admin-checkout-option-calc-locations');
            var calcSurchargeInput = accordion.querySelector('.admin-checkout-option-calc-surcharge');
            var calcTotalSpan = accordion.querySelector('.admin-checkout-option-calc-total');
            var priceInput = accordion.querySelector('.admin-checkout-option-price');
            var basicDayRateInput = accordion.querySelector('.admin-checkout-option-basic-day-rate');
            var discountDayRateInput = accordion.querySelector('.admin-checkout-option-discount-day-rate');

            // Prevent letters and scroll wheel on number inputs
            function setupNumericInput(input, allowDecimal) {
                if (!input) return;
                // Prevent scroll wheel changing value
                input.addEventListener('wheel', function(e) {
                    e.preventDefault();
                }, { passive: false });
                // Only allow numbers (and decimal if specified)
                input.addEventListener('keydown', function(e) {
                    // Allow: backspace, delete, tab, escape, enter, arrows
                    if ([8, 46, 9, 27, 13, 37, 38, 39, 40].indexOf(e.keyCode) !== -1) return;
                    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    if ((e.ctrlKey || e.metaKey) && [65, 67, 86, 88].indexOf(e.keyCode) !== -1) return;
                    // Allow decimal point (only one)
                    if (allowDecimal && (e.key === '.' || e.key === ',')) {
                        if (this.value.indexOf('.') === -1 && this.value.indexOf(',') === -1) return;
                        e.preventDefault();
                        return;
                    }
                    // Block non-numeric
                    if ((e.shiftKey || e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) {
                        e.preventDefault();
                    }
                });
            }

            setupNumericInput(priceInput, true);
            setupNumericInput(basicDayRateInput, true);
            setupNumericInput(discountDayRateInput, true);
            setupNumericInput(calcDaysInput, false);
            setupNumericInput(calcLocationsInput, false);
            setupNumericInput(calcSurchargeInput, true);

            function updateCalculator() {
                if (!calcDaysInput || !calcTotalSpan) return;
                
                // Get current currency from container (updates when site currency changes)
                var currency = container.dataset.currency;
                if (!currency || typeof currency !== 'string' || !currency.trim()) {
                    throw new Error('[Admin] Checkout calculator missing container.dataset.currency');
                }
                currency = currency.trim().toUpperCase();

                var days = parseFloat(calcDaysInput.value) || 0;
                if (days <= 0) {
                    calcTotalSpan.textContent = currency + ' 0.00';
                    return;
                }

                var locations = calcLocationsInput ? (parseInt(calcLocationsInput.value, 10) || 1) : 1;
                if (locations < 1) locations = 1;
                var surchargePct = calcSurchargeInput ? (parseFloat(calcSurchargeInput.value) || 0) : 0;

                var flagfall = parseFloat(priceInput.value) || 0;
                var dayRate = null;

                if (days >= 365) {
                    var discountRateValue = discountDayRateInput.value.trim();
                    dayRate = discountRateValue !== '' ? parseFloat(discountRateValue) : null;
                } else {
                    var basicRateValue = basicDayRateInput.value.trim();
                    dayRate = basicRateValue !== '' ? parseFloat(basicRateValue) : null;
                }

                // Extra locations always use discount rate (required if locations > 1)
                var discountRate = null;
                var discountRateValue2 = discountDayRateInput.value.trim();
                discountRate = discountRateValue2 !== '' ? parseFloat(discountRateValue2) : null;
                if (locations > 1 && (discountRate === null || isNaN(discountRate))) {
                    throw new Error('[Admin] Discount day rate is required when locations > 1');
                }
                var extraLocRate = discountRate;

                var durationCharge = (dayRate !== null && !isNaN(dayRate)) ? (dayRate * days) : 0;
                var extraLocCharge = (locations > 1 && extraLocRate !== null && !isNaN(extraLocRate)) ? ((locations - 1) * extraLocRate * days) : 0;
                var variable = durationCharge + extraLocCharge;
                var total = flagfall + (variable * (1 + (surchargePct / 100)));
                calcTotalSpan.textContent = currency + ' ' + total.toFixed(2);
            }

            if (calcDaysInput) {
                calcDaysInput.addEventListener('input', updateCalculator);
                calcDaysInput.addEventListener('change', updateCalculator);
            }
            if (calcLocationsInput) {
                calcLocationsInput.addEventListener('input', updateCalculator);
                calcLocationsInput.addEventListener('change', updateCalculator);
                calcLocationsInput.addEventListener('blur', function() {
                    var v = parseInt(this.value, 10);
                    if (!isNaN(v)) this.value = String(Math.max(1, v));
                });
            }
            if (calcSurchargeInput) {
                calcSurchargeInput.addEventListener('input', updateCalculator);
                calcSurchargeInput.addEventListener('change', updateCalculator);
                calcSurchargeInput.addEventListener('blur', function() {
                    var v = parseFloat(this.value);
                    if (!isNaN(v)) this.value = v.toFixed(2);
                });
            }
            if (priceInput) {
                priceInput.addEventListener('input', function() {
                    updateCalculator();
                    markDirty();
                });
                priceInput.addEventListener('change', updateCalculator);
                priceInput.addEventListener('blur', function() {
                    var val = parseFloat(this.value);
                    if (!isNaN(val)) {
                        this.value = val.toFixed(2);
                    } else if (this.value.trim() === '') {
                        this.value = '0.00';
                    }
                });
            }
            if (basicDayRateInput) {
                basicDayRateInput.addEventListener('input', function() {
                    updateCalculator();
                    markDirty();
                });
                basicDayRateInput.addEventListener('change', updateCalculator);
                basicDayRateInput.addEventListener('blur', function() {
                    var val = parseFloat(this.value);
                    if (!isNaN(val)) {
                        this.value = val.toFixed(2);
                    }
                    // Leave empty if N/A
                });
            }
            if (discountDayRateInput) {
                discountDayRateInput.addEventListener('input', function() {
                    updateCalculator();
                    markDirty();
                });
                discountDayRateInput.addEventListener('change', updateCalculator);
                discountDayRateInput.addEventListener('blur', function() {
                    var val = parseFloat(this.value);
                    if (!isNaN(val)) {
                        this.value = val.toFixed(2);
                    }
                    // Leave empty if N/A
                });
            }

        });

        // Close more menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.admin-checkout-accordion-body-more')) {
                document.querySelectorAll('.admin-checkout-accordion-body-more-menu--open').forEach(function(el) {
                    el.classList.remove('admin-checkout-accordion-body-more-menu--open');
                });
            }
        });

    }

    function getCheckoutOptionsFromUI() {
        var container = document.getElementById('adminCheckoutTiers');
        if (!container) return [];

        var options = [];
        container.querySelectorAll('.admin-checkout-accordion').forEach(function(accordion) {
            var basicDayRateInput = accordion.querySelector('.admin-checkout-option-basic-day-rate');
            var discountDayRateInput = accordion.querySelector('.admin-checkout-option-discount-day-rate');
            var priceInput = accordion.querySelector('.admin-checkout-option-price');

            var flagfallPrice = priceInput ? Math.round((parseFloat(priceInput.value) || 0) * 100) / 100 : 0;
            var basicDayRate = basicDayRateInput && basicDayRateInput.value.trim() !== '' ? Math.round(parseFloat(basicDayRateInput.value) * 100) / 100 : 0;
            var discountDayRate = discountDayRateInput && discountDayRateInput.value.trim() !== '' ? Math.round(parseFloat(discountDayRateInput.value) * 100) / 100 : 0;

            var titleInput = accordion.querySelector('.admin-checkout-option-title');
            var descriptionInput = accordion.querySelector('.admin-checkout-option-description');
            var featuredCheckbox = accordion.querySelector('.admin-checkout-option-featured');
            var sidebarCheckbox = accordion.querySelector('.admin-checkout-option-sidebar');
            var hiddenSwitchInput = accordion.querySelector('.component-switch-input');

            if (!titleInput) {
                console.warn('Checkout option title input not found for accordion:', accordion);
                return;
            }

            options.push({
                id: accordion.dataset.id,
                checkout_title: (titleInput.value || '').trim(),
                checkout_description: descriptionInput ? (descriptionInput.value || '').trim() : '',
                checkout_flagfall_price: flagfallPrice,
                checkout_basic_day_rate: basicDayRate,
                checkout_discount_day_rate: discountDayRate,
                checkout_featured: featuredCheckbox && featuredCheckbox.checked ? 1 : 0,
                checkout_sidebar_ad: sidebarCheckbox && sidebarCheckbox.checked ? 1 : 0,
                hidden: hiddenSwitchInput && hiddenSwitchInput.checked ? 1 : 0
            });
        });
        return options;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function resetCheckoutOptionsToOriginal() {
        // Re-render checkout options from the composite field's original baseline
        var entry = fieldRegistry['checkout_options'];
        if (entry && entry.type === 'composite' && entry.original) {
            var originalOptions = JSON.parse(entry.original);
            var currency = requireWebsiteCurrencyFromSettings(settingsData);
            renderCheckoutOptions(originalOptions, currency);
        }
    }

    // Get modified settings for saving (includes settings.* and map.* prefixes)
    function getModifiedSettings() {
        var modified = {};
        var systemImages = {};
        
        for (var key in fieldRegistry) {
            // Include settings.*, map.*, and checkout.* prefixed fields
            if (key.indexOf('settings.') === 0 || key.indexOf('map.') === 0 || key.indexOf('checkout.') === 0) {
                var entry = fieldRegistry[key];
                if (entry.type === 'simple') {
                    var currentStr = String(entry.current);
                    var originalStr = String(entry.original);
                    if (currentStr !== originalStr) {
                        // Remove prefix to get database key
                        var settingKey = key.replace(/^(settings\.|map\.|checkout\.)/, '');
                        modified[settingKey] = entry.current;
                    }
                }
            }
            // Collect system_images.* fields separately
            else if (key.indexOf('system_images.') === 0) {
                var entry = fieldRegistry[key];
                if (entry.type === 'simple') {
                    var currentStr = String(entry.current);
                    var originalStr = String(entry.original);
                    if (currentStr !== originalStr) {
                        // Remove prefix to get image key
                        var imageKey = key.replace(/^system_images\./, '');
                        systemImages[imageKey] = entry.current;
                    }
                }
            }
        }
        
        // Add system_images to modified if any changes
        if (Object.keys(systemImages).length > 0) {
            modified['system_images'] = systemImages;
        }
        
        return modified;
    }
    
    // Reset settings to original values (called on discard)
    function resetSettingsToOriginal() {
        if (!settingsContainer) return;
        
        // Reset text inputs
        settingsContainer.querySelectorAll('.admin-settings-field-input[data-setting-key]').forEach(function(input) {
            var key = input.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                input.value = entry.original || '';
            }
        });
        
        // Reset textareas
        settingsContainer.querySelectorAll('.admin-settings-field-textarea[data-setting-key]').forEach(function(textarea) {
            var key = textarea.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                textarea.value = entry.original || '';
            }
        });
        
        // Reset toggles
        settingsContainer.querySelectorAll('.component-switch-input[data-setting-key]').forEach(function(checkbox) {
            var key = checkbox.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                checkbox.checked = entry.original === true || entry.original === 'true';
                syncSettingsToggleUi(checkbox);
            }
        });
        
        // Reset countdown postcards mode radio buttons
        var countdownModeEntry = fieldRegistry['settings.countdown_postcards_mode'];
        if (countdownModeEntry && countdownModeEntry.type === 'simple') {
            var countdownModeRadios = settingsContainer.querySelectorAll('input[name="adminCountdownPostcardsMode"]');
            countdownModeRadios.forEach(function(radio) {
                radio.checked = (radio.value === countdownModeEntry.original);
            });
        }
        
        // Reset welcome load type radio buttons
        var welcomeLoadTypeEntry = fieldRegistry['settings.welcome_load_type'];
        if (welcomeLoadTypeEntry && welcomeLoadTypeEntry.type === 'simple') {
            var welcomeLoadTypeRadios = settingsContainer.querySelectorAll('input[name="adminWelcomeLoadType"]');
            welcomeLoadTypeRadios.forEach(function(radio) {
                radio.checked = (radio.value === welcomeLoadTypeEntry.original);
            });
        }
        
        // Reset currency (uses CurrencyComponent from components file)
        settingsContainer.querySelectorAll('.component-currencyfull-menu[data-setting-key]').forEach(function(menu) {
            var key = menu.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                var code = entry.original;
                if (!code || typeof code !== 'string' || !code.trim()) {
                    // No original value set - skip (don't throw, just log)
                    console.warn('[Admin] Missing currency setting value for ' + String(key));
                    return; // continue to next iteration
                }
                code = code.trim().toUpperCase();
                // Look up the currency label from data
                // Data format: { value: 'USD', label: 'US Dollar', filename: 'us.svg' }
                var currencyData = window.CurrencyComponent ? CurrencyComponent.getData() : [];
                var found = currencyData.find(function(item) {
                    return item.value === code;
                });
                var btnImg = menu.querySelector('.component-currencyfull-menu-button-image');
                var btnInput = menu.querySelector('.component-currencyfull-menu-button-input');
                if (found) {
                    // Use filename directly for flag image
                    if (btnImg && found.filename) btnImg.src = window.App.getImageUrl('currencies', found.filename);
                    if (btnInput) btnInput.value = code + ' - ' + found.label;
                } else {
                    // Don't throw - just log warning and leave as-is (data might not be loaded yet)
                    console.warn('[Admin] Currency code not found in CurrencyComponent data: ' + code + '. Data count: ' + currencyData.length);
                }
            }
        });
        
        // Reset image pickers
        settingsContainer.querySelectorAll('.systemimagepicker-container[data-setting-key]').forEach(function(picker) {
            var key = picker.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                var preview = picker.querySelector('.systemimagepicker-button-preview');
                var placeholder = picker.querySelector('.systemimagepicker-button-placeholder');
                if (entry.original) {
                    if (preview) {
                        preview.src = entry.original;
                        preview.style.display = '';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                } else {
                    if (preview) preview.style.display = 'none';
                    if (placeholder) placeholder.style.display = '';
                }
            }
        });
    }

    /* --------------------------------------------------------------------------
       UNSAVED CHANGES DIALOG
       -------------------------------------------------------------------------- */
    
    function showUnsavedChangesDialog() {
        Promise.all([
            getMessage('msg_admin_unsaved_title', {}, true),
            getMessage('msg_admin_unsaved_message', {}, true)
        ]).then(function(messages) {
            var title = messages[0] || 'Unsaved Changes';
            var message = messages[1] || 'You have unsaved changes. What would you like to do?';
            
            ThreeButtonDialogComponent.show({
                titleText: title,
                messageText: message,
                cancelLabel: 'Cancel',
                saveLabel: 'Save',
                discardLabel: 'Discard',
                focusCancel: true
            }).then(function(result) {
                if (result === 'save') {
                    runSave({ closeAfter: true });
                } else if (result === 'discard') {
                    discardChanges();
                    closePanel();
                }
                // If result === 'cancel', do nothing (stay in panel)
            });
        });
    }

    /* --------------------------------------------------------------------------
       STATUS MESSAGES
       -------------------------------------------------------------------------- */
    
    var statusMessage = null;
    var statusTimer = null;
    
    function ensureStatusElement() {
        if (!statusMessage) {
            statusMessage = document.getElementById('adminStatusMessage');
        }
        return statusMessage;
    }
    
    function showStatus(message, options) {
        options = options || {};
        if (!ensureStatusElement()) return;
        
        statusMessage.textContent = message || '';
        statusMessage.setAttribute('aria-hidden', 'false');
        statusMessage.classList.remove('admin-status-message--error', 'admin-status-message--show');
        
        if (options.error) {
            statusMessage.classList.add('admin-status-message--error');
        }
        
        if (window.__adminStatusMessageTimer) {
            clearTimeout(window.__adminStatusMessageTimer);
            window.__adminStatusMessageTimer = null;
        }
        
        if (statusTimer) {
            clearTimeout(statusTimer);
        }
        
        statusMessage.classList.add('admin-status-message--show');
        statusTimer = setTimeout(function() {
            statusMessage.classList.remove('admin-status-message--show');
            statusMessage.setAttribute('aria-hidden', 'true');
        }, 2000);
    }
    
    function showError(message) {
        showStatus(message, { error: true });
    }

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        openPanel: openPanel,
        closePanel: closePanel,
        switchTab: switchTab,

        // Field-level tracking
        registerField: registerField,
        updateField: updateField,
        unregisterField: unregisterField,
        registerComposite: registerComposite,
        updateCompositeBaseline: updateCompositeBaseline,
        notifyFieldChange: notifyFieldChange,
        getChangedFields: getChangedFields,

        // Change state
        markDirty: markDirty,
        markSaved: markSaved,
        runSave: runSave,
        discardChanges: discardChanges,
        isDirty: function() { return isDirty; },
        hasChanges: hasActualChanges,
        isAutoSaveEnabled: isAutoSaveEnabled,
        
        // Settings tab
        getModifiedSettings: getModifiedSettings,
        
        // Messages tab
        getModifiedMessages: getModifiedMessages,
        getModifiedFieldsetTooltips: getModifiedFieldsetTooltips,
        
        // Status messages
        showStatus: showStatus,
        showError: showError
    };

})();

// Register module with App
App.registerModule('admin', AdminModule);

// Expose globally for modules that check window.AdminModule
window.AdminModule = AdminModule;

// Lazy initialization - only init when panel is first opened
(function() {
    var isInitialized = false;
    
    // Listen for panel toggle to init on first open
    if (window.App && App.on) {
        App.on('panel:toggle', function(data) {
            if (data.panel === 'admin' && data.show) {
                if (!isInitialized) {
                    AdminModule.init();
                    isInitialized = true;
                }
                AdminModule.openPanel();
            } else if (data.panel === 'admin' && !data.show) {
                if (isInitialized) {
                    AdminModule.closePanel();
                }
            }
        });
    }
})();
