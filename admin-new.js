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
    
    // Change tracking
    var isDirty = false;
    var savedState = null;

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
            var wasRight = panelContent.classList.contains('admin-panel-content--side-right');
            var startRight = window.innerWidth - rect.right;
            var startLeft = rect.left;
            
            function onMove(ev) {
                var dx = ev.clientX - startX;
                
                if (wasRight) {
                    var newRight = startRight - dx;
                    var maxRight = window.innerWidth - rect.width;
                    if (newRight < 0) newRight = 0;
                    if (newRight > maxRight) newRight = maxRight;
                    panelContent.style.right = newRight + 'px';
                    panelContent.style.left = 'auto';
                } else {
                    var newLeft = startLeft + dx;
                    var maxLeft = window.innerWidth - rect.width;
                    if (newLeft < 0) newLeft = 0;
                    if (newLeft > maxLeft) newLeft = maxLeft;
                    panelContent.style.left = newLeft + 'px';
                    panelContent.style.right = 'auto';
                }
            }
            
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                
                // Snap to nearest side
                var finalRect = panelContent.getBoundingClientRect();
                var centerX = finalRect.left + finalRect.width / 2;
                var screenCenter = window.innerWidth / 2;
                
                if (centerX < screenCenter) {
                    panelContent.classList.remove('admin-panel-content--side-right');
                    panelContent.classList.add('admin-panel-content--side-left');
                    panelContent.style.left = '';
                    panelContent.style.right = '';
                } else {
                    panelContent.classList.remove('admin-panel-content--side-left');
                    panelContent.classList.add('admin-panel-content--side-right');
                    panelContent.style.left = '';
                    panelContent.style.right = '';
                }
            }
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function bindEvents() {
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
        
        // Tab switching
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    switchTab(btn.dataset.tab);
                });
            });
        }
        
        // Listen for header button click
        App.on('panel:toggle', function(data) {
            if (data.panel === 'admin') {
                if (data.show) {
                    openPanel();
                } else {
                    closePanel();
                }
            }
        });
        
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
       CHANGE TRACKING
       -------------------------------------------------------------------------- */
    
    function markDirty() {
        if (isDirty) return;
        isDirty = true;
        updateButtonStates();
    }
    
    function markSaved() {
        isDirty = false;
        updateButtonStates();
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
    
    function runSave(options) {
        options = options || {};
        
        // TODO: Implement actual save logic
        console.log('[Admin] Save triggered');
        
        markSaved();
        
        if (options.closeAfter) {
            closePanel();
        }
    }
    
    function discardChanges() {
        // TODO: Implement actual discard logic
        console.log('[Admin] Discard triggered');
        
        markSaved();
    }

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        openPanel: openPanel,
        closePanel: closePanel,
        switchTab: switchTab,
        markDirty: markDirty,
        markSaved: markSaved,
        runSave: runSave,
        isDirty: function() { return isDirty; }
    };

})();

// Register module with App
App.registerModule('admin', AdminModule);
