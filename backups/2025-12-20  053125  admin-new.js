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
        
        // Initialize tab content on first view
        if (tabName === 'messages') {
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
                })
            );
        }
        
        // Run all saves
        Promise.all(savePromises)
            .then(function() {
                console.log('[Admin] All saves completed successfully');
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
        
        // Reset messages tab to original values before clearing registry
        resetMessagesToOriginal();
        
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
       -------------------------------------------------------------------------- */
    
    var messagesContainer = null;
    var messagesInitialized = false;
    
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
            
            // Header
            var header = document.createElement('div');
            header.className = 'admin-messages-accordion-header';
            
            // Header image
            var headerImg = document.createElement('img');
            headerImg.className = 'admin-messages-accordion-header-image';
            if (cat.icon) {
                headerImg.src = cat.icon;
                headerImg.alt = '';
            } else {
                headerImg.className += ' admin-messages-accordion-header-image--empty';
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
            var dragHandle = document.createElement('div');
            dragHandle.className = 'admin-messages-accordion-header-drag';
            dragHandle.innerHTML = '<svg class="admin-messages-accordion-header-drag-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4h12v1H2V4zm0 3.5h12v1H2v-1zm0 3.5h12v1H2v-1z"/></svg>';
            dragHandle.setAttribute('aria-label', 'Reorder ' + cat.name);
            
            // Edit button
            var editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'admin-messages-accordion-header-edit';
            editBtn.innerHTML = '<svg class="admin-messages-accordion-header-edit-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M12.854 1.146a.5.5 0 0 1 .707 0l1.293 1.293a.5.5 0 0 1 0 .707l-8.939 8.939a.5.5 0 0 1-.233.131l-3.5.875a.5.5 0 0 1-.606-.606l.875-3.5a.5.5 0 0 1 .131-.233l8.939-8.939z"/></svg>';
            editBtn.setAttribute('aria-label', 'Edit ' + cat.name);
            
            header.appendChild(headerImg);
            header.appendChild(headerText);
            header.appendChild(headerArrow);
            header.appendChild(dragHandle);
            header.appendChild(editBtn);
            
            // Content area (for messages list)
            var content = document.createElement('div');
            content.className = 'admin-messages-accordion-content admin-messages-accordion-content--hidden';
            
            // Edit panel (hidden by default)
            var editPanel = createMessageEditPanel(cat, headerText, headerImg);
            header.appendChild(editPanel);
            
            accordion.appendChild(header);
            accordion.appendChild(content);
            container.appendChild(accordion);
            
            // Toggle accordion on header click (but not on buttons)
            header.addEventListener('click', function(e) {
                if (e.target.closest('button') || e.target.closest('.admin-messages-accordion-header-drag')) return;
                toggleMessagesAccordion(accordion);
            });
            
            // Edit button click
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleMessageEditPanel(editPanel, editBtn);
            });
        });
    }
    
    function createMessageEditPanel(cat, headerTextEl, headerImgEl) {
        var editPanel = document.createElement('div');
        editPanel.className = 'admin-messages-accordion-editpanel admin-messages-accordion-editpanel--hidden';
        
        // Name input
        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'admin-messages-accordion-editpanel-input';
        nameInput.placeholder = 'Category Name';
        nameInput.value = cat.name;
        
        // Save name on blur
        nameInput.addEventListener('blur', function() {
            var newName = nameInput.value.trim();
            if (newName && newName !== cat.name) {
                cat.name = newName;
                headerTextEl.textContent = newName;
                
                // Save to database
                var payload = {};
                payload['msg_category_' + cat.key + '_name'] = newName;
                fetch('/gateway.php?action=save-admin-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(function(err) {
                    console.error('[Admin] Failed to save category name:', err);
                });
            }
        });
        
        // TODO: Icon picker integration will go here
        // For now, just show the name input
        
        // Save button
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'admin-messages-accordion-editpanel-save';
        saveBtn.textContent = 'Done';
        saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            editPanel.classList.add('admin-messages-accordion-editpanel--hidden');
        });
        
        editPanel.appendChild(nameInput);
        editPanel.appendChild(saveBtn);
        
        // Close on click outside
        document.addEventListener('pointerdown', function(e) {
            if (editPanel.classList.contains('admin-messages-accordion-editpanel--hidden')) return;
            if (editPanel.contains(e.target)) return;
            if (e.target.closest('.admin-messages-accordion-header-edit')) return;
            editPanel.classList.add('admin-messages-accordion-editpanel--hidden');
        }, true);
        
        return editPanel;
    }
    
    function toggleMessagesAccordion(accordion) {
        var isOpen = accordion.classList.contains('admin-messages-accordion--open');
        var content = accordion.querySelector('.admin-messages-accordion-content');
        
        if (isOpen) {
            accordion.classList.remove('admin-messages-accordion--open');
            content.classList.add('admin-messages-accordion-content--hidden');
        } else {
            accordion.classList.add('admin-messages-accordion--open');
            content.classList.remove('admin-messages-accordion-content--hidden');
        }
    }
    
    function toggleMessageEditPanel(editPanel, editBtn) {
        var isHidden = editPanel.classList.contains('admin-messages-accordion-editpanel--hidden');
        
        // Close all other edit panels first
        document.querySelectorAll('.admin-messages-accordion-editpanel').forEach(function(panel) {
            if (panel !== editPanel) {
                panel.classList.add('admin-messages-accordion-editpanel--hidden');
            }
        });
        
        if (isHidden) {
            editPanel.classList.remove('admin-messages-accordion-editpanel--hidden');
            editBtn.classList.add('admin-messages-accordion-header-edit--active');
        } else {
            editPanel.classList.add('admin-messages-accordion-editpanel--hidden');
            editBtn.classList.remove('admin-messages-accordion-header-edit--active');
        }
    }
    
    function loadMessagesFromDatabase() {
        fetch('/gateway.php?action=get-admin-settings&include_messages=true')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success && data.messages) {
                    populateMessagesIntoAccordions(data.messages);
                }
            })
            .catch(function(err) {
                console.error('[Admin] Failed to load messages:', err);
            });
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
        
        // Field ID for registry
        var fieldId = 'messages.msg_' + message.id;
        var originalValue = message.message_text || '';
        
        // Register with field-level tracking
        registerField(fieldId, originalValue);
        
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
        textInput.dataset.fieldId = fieldId;
        
        // Click to edit
        textDisplay.addEventListener('click', function() {
            textDisplay.classList.add('admin-message-text-display--hidden');
            textInput.classList.remove('admin-message-text-input--hidden');
            textInput.focus();
        });
        
        // Track changes using field registry
        textInput.addEventListener('input', function() {
            var currentValue = textInput.value;
            updateField(fieldId, currentValue);
            textDisplay.innerHTML = currentValue;
            
            // Visual indicator
            var entry = fieldRegistry[fieldId];
            if (entry && currentValue !== entry.original) {
                item.classList.add('admin-message-item--modified');
            } else {
                item.classList.remove('admin-message-item--modified');
            }
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
        
        // Field ID for registry
        var fieldId = 'messages.tooltip_' + fieldset.id;
        var originalValue = fieldset.fieldset_tooltip || '';
        
        // Register with field-level tracking
        registerField(fieldId, originalValue);
        
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
        textInput.dataset.fieldId = fieldId;
        
        // Click to edit
        textDisplay.addEventListener('click', function() {
            textDisplay.classList.add('admin-message-text-display--hidden');
            textInput.classList.remove('admin-message-text-input--hidden');
            textInput.focus();
        });
        
        // Track changes using field registry
        textInput.addEventListener('input', function() {
            var currentValue = textInput.value;
            updateField(fieldId, currentValue);
            
            textDisplay.textContent = currentValue || '(empty)';
            textDisplay.style.color = currentValue ? '' : 'var(--text-muted, #888)';
            textDisplay.style.fontStyle = currentValue ? '' : 'italic';
            
            // Visual indicator
            var entry = fieldRegistry[fieldId];
            if (entry && currentValue !== entry.original) {
                item.classList.add('admin-message-item--modified');
            } else {
                item.classList.remove('admin-message-item--modified');
            }
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
    
    // Collect modified messages for saving (uses field registry)
    function getModifiedMessages() {
        var modified = [];
        
        for (var fieldId in fieldRegistry) {
            if (fieldId.indexOf('messages.msg_') === 0) {
                var entry = fieldRegistry[fieldId];
                if (entry.type === 'simple' && entry.current !== entry.original) {
                    var messageId = parseInt(fieldId.replace('messages.msg_', ''), 10);
                    modified.push({
                        id: messageId,
                        message_text: entry.current
                    });
                }
            }
        }
        
        return modified;
    }
    
    // Collect modified fieldset tooltips for saving (uses field registry)
    function getModifiedFieldsetTooltips() {
        var modified = [];
        
        for (var fieldId in fieldRegistry) {
            if (fieldId.indexOf('messages.tooltip_') === 0) {
                var entry = fieldRegistry[fieldId];
                if (entry.type === 'simple' && entry.current !== entry.original) {
                    var fieldsetId = parseInt(fieldId.replace('messages.tooltip_', ''), 10);
                    modified.push({
                        id: fieldsetId,
                        fieldset_tooltip: entry.current
                    });
                }
            }
        }
        
        return modified;
    }
    
    // Reset messages tab to original values (called on discard)
    function resetMessagesToOriginal() {
        if (!messagesContainer) return;
        
        messagesContainer.querySelectorAll('.admin-message-text-input').forEach(function(textarea) {
            var fieldId = textarea.dataset.fieldId;
            if (fieldId && fieldRegistry[fieldId]) {
                var originalValue = fieldRegistry[fieldId].original;
                textarea.value = originalValue;
                
                // Update display
                var item = textarea.closest('.admin-message-item');
                if (item) {
                    var display = item.querySelector('.admin-message-text-display');
                    if (display) {
                        // For tooltips, show "(empty)" if empty
                        if (fieldId.indexOf('messages.tooltip_') === 0) {
                            display.textContent = originalValue || '(empty)';
                            display.style.color = originalValue ? '' : 'var(--text-muted, #888)';
                            display.style.fontStyle = originalValue ? '' : 'italic';
                        } else {
                            display.innerHTML = originalValue;
                        }
                    }
                    item.classList.remove('admin-message-item--modified');
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
