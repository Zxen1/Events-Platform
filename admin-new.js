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
   - index-new.js (backbone - App object)
   
   COMMUNICATES WITH:
   - header-new.js (admin button state)
   - member-new.js (admin login state)
   
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
       Admin-specific icons are kept here as a central registry. This prevents
       duplication across modules and ensures consistency.
       
       - Modules access icons via AdminModule.icons.editPen, AdminModule.icons.dragHandle, etc.
       - Site-wide icons (save, close, etc.) are in assets/system-images/
       - Add new admin UI icons here, not in individual module files
       -------------------------------------------------------------------------- */
    
    var icons = {
        editPen: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>',
        dragHandle: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L4 6h8L8 2zM8 14l4-4H4l4 4z"/></svg>',
        moreDots: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="2.5" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13.5" r="1.5"/></svg>',
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        minus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    };

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
                console.log('[Admin] Autosave setting saved:', enabled);
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

        console.log('[Admin] Admin module initialized');
    }
    
    function cacheElements() {
        panel = document.querySelector('.admin-panel');
        if (!panel) return;
        
        panelContent = panel.querySelector('.admin-panel-content');
        closeBtn = panel.querySelector('.admin-panel-actions-icon-btn--close');
        saveBtn = panel.querySelector('.admin-panel-actions-icon-btn--save');
        discardBtn = panel.querySelector('.admin-panel-actions-icon-btn--discard');
        autosaveCheckbox = document.getElementById('admin-autosave-checkbox');
        tabButtons = panel.querySelectorAll('.admin-tab-bar-button');
        tabPanels = panel.querySelectorAll('.admin-tab-panel');
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
                    // TODO: Show unsaved changes dialog
                    closePanel();
                } else {
                    closePanel();
                }
            });
        }
        
        // Save button
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                if (!saveBtn.disabled) {
                    runSave();
                }
            });
        }
        
        // Discard button
        if (discardBtn) {
            discardBtn.addEventListener('click', function() {
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
            // which is handled in header-new.js
        });
    }

    /* --------------------------------------------------------------------------
       PANEL OPEN/CLOSE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panel || !panelContent) return;
        
        panel.classList.add('admin-panel--show');
        panel.setAttribute('aria-hidden', 'false');
        panelContent.classList.remove('admin-panel-content--hidden');
        panelContent.classList.add('admin-panel-content--visible');
        
        // Bring panel to front of stack
        App.bringToTop(panel);
        
        // Update header button
        App.emit('admin:opened');
    }

    function closePanel() {
        if (!panel || !panelContent) return;
        
        panelContent.classList.remove('admin-panel-content--visible');
        panelContent.classList.add('admin-panel-content--hidden');
        
        // Wait for transition then hide panel
        panelContent.addEventListener('transitionend', function handler() {
            panelContent.removeEventListener('transitionend', handler);
            panel.classList.remove('admin-panel--show');
            panel.setAttribute('aria-hidden', 'true');
            
            // Remove from panel stack
            App.removeFromStack(panel);
        }, { once: true });
        
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
            btn.classList.toggle('admin-tab-bar-button--selected', isSelected);
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });

        // Update tab panels
        tabPanels.forEach(function(panel) {
            var isActive = panel.id === 'admin-tab-' + tabName;
            panel.classList.toggle('admin-tab-panel--active', isActive);
        });
        
        // Initialize tab content on first view
        if (tabName === 'settings') {
            initSettingsTab();
        } else if (tabName === 'messages') {
            initMessagesTab();
        }
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
            console.log('[Admin] Save already in progress, skipping');
            return;
        }
        
        // Clear any pending autosave
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
        
        // Final check: are there actual changes to save?
        if (!hasActualChanges()) {
            console.log('[Admin] No actual changes to save');
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
                    console.log('[Admin] Settings saved:', Object.keys(modifiedSettings).length);
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
                    console.log('[Admin] Messages saved:', modifiedMessages.length);
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
                    console.log('[Admin] Fieldset tooltips saved:', modifiedTooltips.length);
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
                    console.log('[Admin] Category names saved');
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
                    console.log('[Admin] Category order saved');
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
                    console.log('[Admin] Checkout options saved:', checkoutOptions.length);
                    updateCompositeBaseline('checkout_options');
                })
            );
        }
        
        // Run all saves
        Promise.all(savePromises)
            .then(function() {
                console.log('[Admin] All saves completed successfully');
                isSaving = false;
                
                // Update baselines to saved values
                markSaved();
                
                // If user made changes during save, recheckDirtyState will detect them
                // via the next input event - no need to check here
                
                if (options.closeAfter) {
                    closePanel();
                }
            })
            .catch(function(err) {
                console.error('[Admin] Save failed:', err);
                isSaving = false;
                // Keep dirty state on error - don't lose user's changes
                // Buttons stay lit so user knows save failed and can retry
            });
    }
    
    function discardChanges() {
        // Prevent discard during save
        if (isSaving) {
            console.log('[Admin] Cannot discard during save');
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
        
        // Reset field registry values (current = original) instead of clearing
        // This preserves registrations so fields don't need to re-register
        for (var fieldId in fieldRegistry) {
            var entry = fieldRegistry[fieldId];
            if (entry.type === 'simple') {
                entry.current = entry.original;
            }
        }
        
        // Tell formbuilder to re-fetch from database (not restore from snapshot)
        if (window.FormbuilderModule && typeof FormbuilderModule.discard === 'function') {
            FormbuilderModule.discard();
        }
        
        // Emit event for other modules to discard their changes
        App.emit('admin:discard');
        
        console.log('[Admin] Changes discarded');
        isDirty = false;
        updateButtonStates();
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
        { key: 'fieldset-tooltips', name: 'Fieldset Tooltips', icon: '', description: 'Tooltip help text for form fieldsets' }
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
        var state = { messages: {}, tooltips: {}, categoryNames: {}, categoryOrder: [] };

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

        // Capture message textareas
        messagesContainer.querySelectorAll('.admin-message-text-input[data-message-id]').forEach(function(textarea) {
            var id = textarea.dataset.messageId;
            if (id) {
                state.messages[id] = textarea.value;
            }
        });

        // Capture tooltip textareas
        messagesContainer.querySelectorAll('.admin-message-text-input[data-fieldset-id]').forEach(function(textarea) {
            var id = textarea.dataset.fieldsetId;
            if (id) {
                state.tooltips[id] = textarea.value;
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
        
        // Create container for accordions
        var accordionsWrap = document.createElement('div');
        accordionsWrap.className = 'admin-messages-container';
        messagesContainer.appendChild(accordionsWrap);
        
        // Load category icons then render
        loadMessageCategoryIcons().then(function() {
            renderMessagesAccordions(accordionsWrap);
            loadMessagesFromDatabase();
            loadFieldsetTooltips();
        });
        
        messagesInitialized = true;
    }
    
    function loadMessageCategoryIcons() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.settings) {
                    MESSAGE_CATEGORIES.forEach(function(cat) {
                        var settingKey = 'msg_category_' + cat.key + '_icon';
                        if (data.settings[settingKey]) {
                            cat.icon = data.settings[settingKey];
                        }
                        // Also check for custom name
                        var nameKey = 'msg_category_' + cat.key + '_name';
                        if (data.settings[nameKey]) {
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
            accordion.className = 'admin-messages-accordion';
            accordion.dataset.messageCategory = cat.key;
            
            // Header (same structure as formbuilder)
            var header = document.createElement('div');
            header.className = 'admin-messages-accordion-header';
            
            // Header image
            var headerImg = document.createElement('img');
            headerImg.className = 'admin-messages-accordion-header-image';
            if (cat.icon) {
                headerImg.src = cat.icon;
                headerImg.alt = '';
            } else {
                headerImg.src = 'assets/icons-30/default.png';
            }
            
            // Header text
            var headerText = document.createElement('span');
            headerText.className = 'admin-messages-accordion-header-text';
            headerText.textContent = cat.name;
            
            // Header arrow
            var headerArrow = document.createElement('span');
            headerArrow.className = 'admin-messages-accordion-header-arrow';
            headerArrow.textContent = '▼';
            
            // Drag handle
            var headerDrag = document.createElement('div');
            headerDrag.className = 'admin-messages-accordion-header-drag';
            headerDrag.innerHTML = icons.dragHandle;
            
            // Edit area (wrapper around pencil icon, like formbuilder)
            var headerEditArea = document.createElement('div');
            headerEditArea.className = 'admin-messages-accordion-header-editarea';
            var headerEdit = document.createElement('div');
            headerEdit.className = 'admin-messages-accordion-header-edit';
            headerEdit.innerHTML = icons.editPen;
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
            nameInput.className = 'admin-messages-accordion-editpanel-input';
            nameInput.value = cat.name;
            nameInput.dataset.categoryKey = cat.key;
            nameInput.oninput = function() {
                headerText.textContent = nameInput.value || cat.name;
                notifyMessagesChange();
            };
            
            nameRow.appendChild(nameInput);
            editPanel.appendChild(nameRow);
            
            // TODO: Icon picker will go here (like formbuilder)
            
            // Content area (for messages list)
            var content = document.createElement('div');
            content.className = 'admin-messages-accordion-content admin-messages-accordion-content--hidden';
            
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
            });
        });
        
        // Bind document click to close edit panels (like formbuilder)
        bindMessagesDocumentListeners();
    }
    
    function closeAllMessagesEditPanels() {
        if (!messagesContainer) return;
        messagesContainer.querySelectorAll('.admin-messages-accordion--editing').forEach(function(el) {
            el.classList.remove('admin-messages-accordion--editing');
        });
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
    
    // Track loading state for both messages and tooltips
    var messagesDataLoaded = false;
    var tooltipsDataLoaded = false;
    
    function registerMessagesCompositeIfReady() {
        messagesDataLoaded = true;
        if (messagesDataLoaded && tooltipsDataLoaded) {
            // Register messages as composite field (like Formbuilder)
            registerComposite('messages', captureMessagesState);
            messagesLoaded = true;
        }
    }
    
    function registerTooltipsCompositeIfReady() {
        tooltipsDataLoaded = true;
        if (messagesDataLoaded && tooltipsDataLoaded) {
            // Register messages as composite field (like Formbuilder)
            registerComposite('messages', captureMessagesState);
            messagesLoaded = true;
        }
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
        textInput.dataset.messageId = message.id;
        
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
        
        return item;
    }
    
    function loadFieldsetTooltips() {
        // Fetch fieldsets from get-form endpoint (returns snapshot with fieldsets)
        fetch('/gateway.php?action=get-form')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.snapshot && data.snapshot.fieldsets) {
                    populateFieldsetTooltips(data.snapshot.fieldsets);
                    registerTooltipsCompositeIfReady();
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load fieldset tooltips:', err);
            });
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
        
        return item;
    }
    
    // Collect modified messages for saving (compares DOM to composite baseline)
    function getModifiedMessages() {
        var modified = [];
        var entry = fieldRegistry['messages'];
        if (!entry || entry.type !== 'composite') return modified;
        
        var originalState = JSON.parse(entry.original);
        var currentState = captureMessagesState();
        
        // Compare each message
        for (var id in currentState.messages) {
            var currentValue = currentState.messages[id];
            var originalValue = originalState.messages[id];
            if (currentValue !== originalValue) {
                modified.push({
                    id: parseInt(id, 10),
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
        
        // Reset message textareas
        messagesContainer.querySelectorAll('.admin-message-text-input[data-message-id]').forEach(function(textarea) {
            var id = textarea.dataset.messageId;
            if (id && originalState.messages[id] !== undefined) {
                var originalValue = originalState.messages[id];
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

                    // Initialize SystemImagePickerComponent with folder from settings
                    if (window.SystemImagePickerComponent && settingsData.system_images_folder) {
                        SystemImagePickerComponent.setImageFolder(settingsData.system_images_folder);
                    }

                    // Initialize CurrencyComponent data if available
                    if (window.CurrencyComponent && data.picklist && data.picklist.currency) {
                        CurrencyComponent.setData(data.picklist.currency);
                    }

                    // Render checkout options and register for tracking
                    if (data.checkout_options && Array.isArray(data.checkout_options)) {
                        renderCheckoutOptions(data.checkout_options, settingsData.website_currency || 'USD');
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
        
        // Attach to toggle checkboxes
        settingsContainer.querySelectorAll('.admin-settings-toggle-input[data-setting-key]').forEach(function(checkbox) {
            var key = checkbox.dataset.settingKey;
            var initialValue = settingsData[key] === true || settingsData[key] === 'true' || settingsData[key] === '1';
            checkbox.checked = initialValue;
            
            registerField('settings.' + key, initialValue);
            
            checkbox.addEventListener('change', function() {
                updateField('settings.' + key, checkbox.checked);
            });
        });
        
        // Initialize image pickers (using SystemImagePickerComponent from components file)
        initImagePicker('adminBigLogoPicker', 'big_logo');
        initImagePicker('adminSmallLogoPicker', 'small_logo');
        initImagePicker('adminFaviconPicker', 'favicon');
        
        // Initialize currency picker (using CurrencyComponent from components file)
        initCurrencyPicker('adminCurrencyPicker', 'website_currency');
    }
    
    function initImagePicker(containerId, settingKey) {
        var container = document.getElementById(containerId);
        if (!container || !window.SystemImagePickerComponent) return;

        var initialValue = settingsData[settingKey] || '';

        var picker = SystemImagePickerComponent.buildPicker({
            container: settingsContainer,
            onSelect: function(imagePath) {
                updateField('settings.' + settingKey, imagePath);
                
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
        container.appendChild(picker.element);

        // Set initial image if exists
        if (initialValue) {
            picker.setImage(initialValue);
        }

        registerField('settings.' + settingKey, initialValue);
    }
    
    function initCurrencyPicker(containerId, settingKey) {
        var container = document.getElementById(containerId);
        if (!container || !window.CurrencyComponent) return;
        
        var initialValue = settingsData[settingKey] || 'USD';
        
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
                var editPanel = el.querySelector('.admin-checkout-accordion-editpanel');
                if (editPanel) editPanel.style.display = 'none';
            }
        });
    }

    function renderCheckoutOptions(checkoutOptions, siteCurrency) {
        var container = document.getElementById('adminCheckoutTiers');
        if (!container) return;

        // Store currency on container for dynamic updates
        container.dataset.currency = siteCurrency;
        container.innerHTML = '';

        if (!checkoutOptions || !checkoutOptions.length) {
            container.innerHTML = '<div class="admin-checkout-option-empty">No checkout options configured.</div>';
            return;
        }

        checkoutOptions.forEach(function(option, index) {
            var accordion = document.createElement('div');
            accordion.className = 'admin-checkout-accordion';
            accordion.dataset.id = option.id;

            var flagfallPrice = option.checkout_flagfall_price !== undefined ? option.checkout_flagfall_price : 0;
            var basicDayRate = option.checkout_basic_day_rate !== undefined && option.checkout_basic_day_rate !== null ? parseFloat(option.checkout_basic_day_rate).toFixed(2) : '';
            var discountDayRate = option.checkout_discount_day_rate !== undefined && option.checkout_discount_day_rate !== null ? parseFloat(option.checkout_discount_day_rate).toFixed(2) : '';
            var isFeatured = option.checkout_featured === 1 || option.checkout_featured === true;
            var featuredBadgeText = isFeatured ? 'featured' : 'standard';
            var isHidden = option.hidden === 1 || option.hidden === true;

            // Header
            var header = document.createElement('div');
            header.className = 'admin-checkout-accordion-header';

            // Header text (title)
            var headerText = document.createElement('span');
            headerText.className = 'admin-checkout-accordion-header-text';
            headerText.textContent = option.checkout_title || 'Untitled';

            // Header badge
            var headerBadge = document.createElement('span');
            headerBadge.className = 'admin-checkout-accordion-header-badge' + (isFeatured ? ' admin-checkout-accordion-header-badge--featured' : '');
            headerBadge.textContent = featuredBadgeText;

            // Arrow (same as messages/formbuilder)
            var headerArrow = document.createElement('span');
            headerArrow.className = 'admin-checkout-accordion-header-arrow';
            headerArrow.textContent = '▼';

            header.appendChild(headerText);
            header.appendChild(headerBadge);
            header.appendChild(headerArrow);

            // Edit panel (sibling to header)
            var editPanel = document.createElement('div');
            editPanel.className = 'admin-checkout-accordion-editpanel';
            editPanel.style.display = 'none';

            // Title row with input and more button (same as formbuilder)
            var titleRow = document.createElement('div');
            titleRow.className = 'admin-checkout-accordion-editpanel-row admin-checkout-accordion-editpanel-row--title';

            var titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'admin-checkout-accordion-editpanel-input admin-checkout-option-title';
            titleInput.value = option.checkout_title || '';
            titleInput.placeholder = 'Title';

            // More button (3-dot menu) - inside edit panel like formbuilder
            var moreBtn = document.createElement('div');
            moreBtn.className = 'admin-checkout-accordion-editpanel-more';
            moreBtn.innerHTML = icons.moreDots + 
                '<div class="admin-checkout-accordion-editpanel-more-menu">' +
                    '<div class="admin-checkout-accordion-editpanel-more-item">' +
                        '<span class="admin-checkout-accordion-editpanel-more-item-text">Hide Tier</span>' +
                        '<div class="admin-checkout-accordion-editpanel-more-switch' + (isHidden ? ' on' : '') + '"></div>' +
                    '</div>' +
                    '<div class="admin-checkout-accordion-editpanel-more-item admin-checkout-accordion-editpanel-more-delete">Delete Tier</div>' +
                '</div>';

            titleRow.appendChild(titleInput);
            titleRow.appendChild(moreBtn);
            editPanel.appendChild(titleRow);

            // Rest of the edit panel
            var restOfPanel = document.createElement('div');
            restOfPanel.innerHTML =
                '<div class="admin-checkout-accordion-editpanel-row">' +
                    '<label class="admin-checkout-accordion-editpanel-label">Description</label>' +
                    '<textarea class="admin-checkout-accordion-editpanel-textarea admin-checkout-option-description" placeholder="Description">' + escapeHtml(option.checkout_description || '') + '</textarea>' +
                '</div>' +
                '<div class="admin-checkout-accordion-editpanel-row admin-checkout-accordion-editpanel-row--checkboxes">' +
                    '<label class="admin-checkout-accordion-editpanel-checkbox"><input type="checkbox" class="admin-checkout-option-featured"' + (isFeatured ? ' checked' : '') + ' /><span>Featured</span></label>' +
                    '<label class="admin-checkout-accordion-editpanel-checkbox"><input type="checkbox" class="admin-checkout-option-sidebar"' + (option.checkout_sidebar_ad ? ' checked' : '') + ' /><span>Sidebar Ad</span></label>' +
                '</div>' +
                '<div class="admin-checkout-accordion-editpanel-row">' +
                    '<label class="admin-checkout-accordion-editpanel-label">Flagfall Price</label>' +
                    '<input type="text" inputmode="decimal" class="admin-checkout-accordion-editpanel-input admin-checkout-option-price" value="' + flagfallPrice.toFixed(2) + '" placeholder="0.00" />' +
                '</div>' +
                '<div class="admin-checkout-accordion-editpanel-row">' +
                    '<label class="admin-checkout-accordion-editpanel-label">Basic Day Rate</label>' +
                    '<input type="text" inputmode="decimal" class="admin-checkout-accordion-editpanel-input admin-checkout-option-basic-day-rate" value="' + basicDayRate + '" placeholder="N/A" />' +
                '</div>' +
                '<div class="admin-checkout-accordion-editpanel-row">' +
                    '<label class="admin-checkout-accordion-editpanel-label">Discount Day Rate</label>' +
                    '<input type="text" inputmode="decimal" class="admin-checkout-accordion-editpanel-input admin-checkout-option-discount-day-rate" value="' + discountDayRate + '" placeholder="N/A" />' +
                '</div>' +
                '<div class="admin-checkout-accordion-editpanel-row">' +
                    '<label class="admin-checkout-accordion-editpanel-label">Price Calculator (Sandbox)</label>' +
                    '<div class="admin-checkout-accordion-editpanel-calc">' +
                        '<input type="text" inputmode="numeric" class="admin-checkout-accordion-editpanel-input admin-checkout-option-calc-days" value="" placeholder="Days" />' +
                        '<span class="admin-checkout-accordion-editpanel-calc-equals">=</span>' +
                        '<span class="admin-checkout-option-calc-total">' + siteCurrency + ' 0.00</span>' +
                    '</div>' +
                '</div>';
            
            // Append all children from restOfPanel
            while (restOfPanel.firstChild) {
                editPanel.appendChild(restOfPanel.firstChild);
            }

            // Set hidden class if hidden
            if (isHidden) {
                accordion.classList.add('admin-checkout-accordion--hidden');
            }

            accordion.appendChild(header);
            accordion.appendChild(editPanel);
            container.appendChild(accordion);

            // More button click - toggle menu
            moreBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var wasOpen = moreBtn.classList.contains('open');
                // Close all other menus
                container.querySelectorAll('.admin-checkout-accordion-editpanel-more.open').forEach(function(el) {
                    if (el !== moreBtn) el.classList.remove('open');
                });
                if (!wasOpen) {
                    moreBtn.classList.add('open');
                } else {
                    moreBtn.classList.remove('open');
                }
            });

            // Hide switch click
            var hideSwitch = moreBtn.querySelector('.admin-checkout-accordion-editpanel-more-switch');
            hideSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                hideSwitch.classList.toggle('on');
                accordion.classList.toggle('admin-checkout-accordion--hidden');
                markDirty();
            });

            // Delete option click
            var deleteOption = moreBtn.querySelector('.admin-checkout-accordion-editpanel-more-delete');
            deleteOption.addEventListener('click', function(e) {
                e.stopPropagation();
                moreBtn.classList.remove('open');
                var titleText = titleInput.value.trim();
                if (!titleText) titleText = 'this checkout option';
                
                if (window.ConfirmDialogComponent) {
                    ConfirmDialogComponent.show({
                        titleText: 'Delete Checkout Option',
                        messageText: 'Delete "' + titleText + '"?',
                        confirmLabel: 'Delete',
                        focusCancel: true
                    }).then(function(confirmed) {
                        if (confirmed) {
                            accordion.remove();
                            markDirty();
                        }
                    });
                } else {
                    accordion.remove();
                    markDirty();
                }
            });

            // Title input updates header text
            titleInput.addEventListener('input', function() {
                headerText.textContent = titleInput.value.trim() || 'Untitled';
                markDirty();
            });

            // Header click - toggle edit panel
            header.addEventListener('click', function(e) {
                var isEditing = accordion.classList.contains('admin-checkout-accordion--editing');
                closeAllCheckoutEditPanels(accordion);
                if (!isEditing) {
                    accordion.classList.add('admin-checkout-accordion--editing');
                    editPanel.style.display = 'block';
                } else {
                    accordion.classList.remove('admin-checkout-accordion--editing');
                    editPanel.style.display = 'none';
                }
            });

            // Description textarea
            var descriptionInput = accordion.querySelector('.admin-checkout-option-description');
            if (descriptionInput) {
                descriptionInput.addEventListener('input', function() {
                    markDirty();
                });
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

            function updateCalculator() {
                if (!calcDaysInput || !calcTotalSpan) return;
                
                // Get current currency from container (updates when site currency changes)
                var currency = container.dataset.currency || 'USD';

                var days = parseFloat(calcDaysInput.value) || 0;
                if (days <= 0) {
                    calcTotalSpan.textContent = currency + ' 0.00';
                    return;
                }

                var flagfall = parseFloat(priceInput.value) || 0;
                var dayRate = null;

                if (days >= 365) {
                    var discountRateValue = discountDayRateInput.value.trim();
                    dayRate = discountRateValue !== '' ? parseFloat(discountRateValue) : null;
                } else {
                    var basicRateValue = basicDayRateInput.value.trim();
                    dayRate = basicRateValue !== '' ? parseFloat(basicRateValue) : null;
                }

                if (dayRate === null || isNaN(dayRate)) {
                    calcTotalSpan.textContent = currency + ' ' + flagfall.toFixed(2);
                    return;
                }

                var total = flagfall + (dayRate * days);
                calcTotalSpan.textContent = currency + ' ' + total.toFixed(2);
            }

            if (calcDaysInput) {
                calcDaysInput.addEventListener('input', updateCalculator);
                calcDaysInput.addEventListener('change', updateCalculator);
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
            if (!e.target.closest('.admin-checkout-accordion-editpanel-more')) {
                document.querySelectorAll('.admin-checkout-accordion-editpanel-more.open').forEach(function(el) {
                    el.classList.remove('open');
                });
            }
        });

        // Add tier button handler
        var addBtn = document.querySelector('.admin-checkout-options-add');
        if (addBtn && !addBtn.dataset.initialized) {
            addBtn.dataset.initialized = 'true';
            addBtn.addEventListener('click', function() {
                // Get current currency from settings (may have changed since render)
                var currentCurrency = settingsData.website_currency || 'USD';
                var newOption = {
                    id: 'new-' + Date.now(),
                    checkout_key: '',
                    checkout_title: 'New Tier',
                    checkout_description: '',
                    checkout_flagfall_price: 0,
                    checkout_basic_day_rate: null,
                    checkout_discount_day_rate: null,
                    checkout_currency: currentCurrency,
                    checkout_featured: 0,
                    checkout_sidebar_ad: false,
                    hidden: 0
                };
                renderCheckoutOptions([].concat(getCheckoutOptionsFromUI(), [newOption]), currentCurrency);
                markDirty();
            });
        }
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
            var basicDayRate = basicDayRateInput && basicDayRateInput.value.trim() !== '' ? Math.round(parseFloat(basicDayRateInput.value) * 100) / 100 : null;
            var discountDayRate = discountDayRateInput && discountDayRateInput.value.trim() !== '' ? Math.round(parseFloat(discountDayRateInput.value) * 100) / 100 : null;

            var titleInput = accordion.querySelector('.admin-checkout-option-title');
            var descriptionInput = accordion.querySelector('.admin-checkout-option-description');
            var featuredCheckbox = accordion.querySelector('.admin-checkout-option-featured');
            var sidebarCheckbox = accordion.querySelector('.admin-checkout-option-sidebar');
            var hiddenSwitch = accordion.querySelector('.admin-checkout-accordion-editpanel-more-switch');

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
                hidden: hiddenSwitch && hiddenSwitch.classList.contains('on') ? 1 : 0
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
            var currency = settingsData.website_currency || 'USD';
            renderCheckoutOptions(originalOptions, currency);
        }
    }

    // Get modified settings for saving
    function getModifiedSettings() {
        var modified = {};
        
        for (var key in fieldRegistry) {
            if (key.indexOf('settings.') === 0) {
                var entry = fieldRegistry[key];
                if (entry.type === 'simple') {
                    var currentStr = String(entry.current);
                    var originalStr = String(entry.original);
                    if (currentStr !== originalStr) {
                        var settingKey = key.replace('settings.', '');
                        modified[settingKey] = entry.current;
                    }
                }
            }
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
        
        // Reset toggles
        settingsContainer.querySelectorAll('.admin-settings-toggle-input[data-setting-key]').forEach(function(checkbox) {
            var key = checkbox.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                checkbox.checked = entry.original === true || entry.original === 'true';
            }
        });
        
        // Reset currency (uses CurrencyComponent from components file)
        settingsContainer.querySelectorAll('.admin-currency-wrapper[data-setting-key]').forEach(function(menu) {
            var key = menu.dataset.settingKey;
            var entry = fieldRegistry['settings.' + key];
            if (entry && entry.type === 'simple') {
                var code = entry.original || 'USD';
                // Look up the currency label from data
                var currencyData = window.CurrencyComponent ? CurrencyComponent.getData() : [];
                var found = currencyData.find(function(item) {
                    return item.value.substring(3) === code;
                });
                var btnImg = menu.querySelector('.admin-currency-button-flag');
                var btnText = menu.querySelector('.admin-currency-button-text');
                if (found) {
                    var countryCode = found.value.substring(0, 2);
                    if (btnImg) btnImg.src = 'assets/flags/' + countryCode + '.svg';
                    if (btnText) btnText.textContent = code + ' - ' + found.label;
                } else {
                    if (btnImg) btnImg.src = 'assets/flags/us.svg';
                    if (btnText) btnText.textContent = code + ' - US Dollar';
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
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        openPanel: openPanel,
        closePanel: closePanel,
        switchTab: switchTab,

        // SVG icons registry (shared with formbuilder and other modules)
        icons: icons,

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
        getModifiedFieldsetTooltips: getModifiedFieldsetTooltips
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
