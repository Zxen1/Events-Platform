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
        
        // Save formbuilder data
        var savePromise = Promise.resolve();
        
        if (window.FormbuilderModule && typeof FormbuilderModule.save === 'function') {
            savePromise = FormbuilderModule.save();
        }
        
        savePromise
            .then(function() {
                console.log('[Admin] Saved successfully');
                isSaving = false;
                
                // Re-check if new changes occurred during save
                if (hasActualChanges()) {
                    console.log('[Admin] New changes detected during save, staying dirty');
                    // Don't markSaved - there are new changes
                    // Reschedule autosave if enabled
                    if (isAutoSaveEnabled()) {
                        scheduleAutoSave();
                    }
                } else {
                    markSaved();
                }
                
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
        
        // Clear the field registry - modules will re-register when they reload
        fieldRegistry = {};
        
        // Tell formbuilder to re-fetch from database (not restore from snapshot)
        if (window.FormbuilderModule && typeof FormbuilderModule.discard === 'function') {
            FormbuilderModule.discard();
        }
        
        // Emit event for other modules to discard their changes
        App.emit('admin:discard');
        
        console.log('[Admin] Changes discarded - re-fetching from database');
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
        isAutoSaveEnabled: isAutoSaveEnabled
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
