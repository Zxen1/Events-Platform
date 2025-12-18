/* ============================================================================
   HEADER.JS - HEADER SECTION
   ============================================================================
   
   Controls the header bar at the top of the page.
   
   CURRENTLY IMPLEMENTED:
   - Filter button (opens/closes filter panel, shows active filter count)
   - Member button (opens/closes member panel)
   - Admin button (hidden until admin logged in)
   - Fullscreen button (toggles fullscreen mode)
   
   NOT YET IMPLEMENTED (dependencies needed):
   - Logo button (needs admin settings)
   - Mode switch (needs post module)
   
   ============================================================================ */

const HeaderModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var filterPanelOpen = false;
    var memberPanelOpen = false;
    var filterBtn = null;
    var memberBtn = null;
    var adminBtn = null;
    var fullscreenBtn = null;


    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        initFilterButton();
        initModeSwitch();
        initMemberButton();
        initAdminButton();
        initFullscreenButton();
    }
    
    
    /* --------------------------------------------------------------------------
       MODE SWITCH (Recents / Posts / Map)
       -------------------------------------------------------------------------- */
    
    var modeSwitchButtons = null;
    var currentMode = 'map'; // Default mode
    
    function initModeSwitch() {
        modeSwitchButtons = document.querySelectorAll('.header-modeswitch-button');
        if (!modeSwitchButtons.length) return;
        
        modeSwitchButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = btn.dataset.mode;
                if (!mode || mode === currentMode) return;
                
                setMode(mode);
            });
        });
        
        // Set initial mode (map is default)
        setMode('map');
    }
    
    function setMode(mode) {
        currentMode = mode;
        
        // Update button states
        modeSwitchButtons.forEach(function(btn) {
            var isActive = btn.dataset.mode === mode;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.classList.toggle('header-modeswitch-button--active', isActive);
        });
        
        // Emit event for other modules
        App.emit('mode:changed', { mode: mode });
    }


    /* --------------------------------------------------------------------------
       FILTER BUTTON
       -------------------------------------------------------------------------- */
    
    function initFilterButton() {
        filterBtn = document.querySelector('.header-filter-button');
        if (!filterBtn) return;
        
        filterBtn.addEventListener('click', function() {
            filterPanelOpen = !filterPanelOpen;
            
            // Update aria state
            filterBtn.setAttribute('aria-expanded', filterPanelOpen ? 'true' : 'false');
            
            // Emit event to filter module
            App.emit('panel:toggle', {
                panel: 'filter',
                show: filterPanelOpen
            });
        });
        
        // Listen for filter state changes to update counter
        App.on('filter:changed', updateFilterCounter);
        
        // Listen for filter panel close events
        App.on('filter:closed', function() {
            filterPanelOpen = false;
            if (filterBtn) {
                filterBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    
    function updateFilterCounter(filterState) {
        if (!filterBtn) return;
        
        // Count active filters
        var count = 0;
        
        if (filterState.keywords) count++;
        if (filterState.priceMin !== null || filterState.priceMax !== null) count++;
        if (filterState.dateStart || filterState.dateEnd) count++;
        if (filterState.showExpired) count++;
        if (filterState.favouritesOnly) count++;
        
        // Count disabled categories
        if (filterState.categories) {
            Object.keys(filterState.categories).forEach(function(catName) {
                if (!filterState.categories[catName].enabled) count++;
                Object.keys(filterState.categories[catName].subs).forEach(function(subName) {
                    if (!filterState.categories[catName].subs[subName]) count++;
                });
            });
        }
        
        // Update or create counter badge
        var counter = filterBtn.querySelector('.header-filter-button-counter');
        
        if (count > 0) {
            if (!counter) {
                counter = document.createElement('span');
                counter.className = 'header-filter-button-counter';
                filterBtn.appendChild(counter);
            }
            counter.textContent = count;
            filterBtn.classList.add('header-filter-button--active');
        } else {
            if (counter) counter.remove();
            filterBtn.classList.remove('header-filter-button--active');
        }
    }


    /* --------------------------------------------------------------------------
       MEMBER BUTTON
       -------------------------------------------------------------------------- */
    
    function initMemberButton() {
        memberBtn = document.querySelector('.header-access-button[data-panel="member"]');
        if (!memberBtn) return;
        
        memberBtn.addEventListener('click', function() {
            memberPanelOpen = !memberPanelOpen;
            
            // Update aria state
            memberBtn.setAttribute('aria-expanded', memberPanelOpen ? 'true' : 'false');
            
            // Emit event to member module
            App.emit('panel:toggle', {
                panel: 'member',
                show: memberPanelOpen
            });
        });
        
        // Listen for member panel close events
        App.on('member:closed', function() {
            memberPanelOpen = false;
            if (memberBtn) {
                memberBtn.setAttribute('aria-expanded', 'false');
                memberBtn.classList.remove('header-access-button--active');
            }
        });
        
        App.on('member:opened', function() {
            memberPanelOpen = true;
            if (memberBtn) {
                memberBtn.setAttribute('aria-expanded', 'true');
                memberBtn.classList.add('header-access-button--active');
            }
        });
    }


    /* --------------------------------------------------------------------------
       ADMIN BUTTON
       -------------------------------------------------------------------------- */
    
    var adminPanelOpen = false;
    
    function initAdminButton() {
        adminBtn = document.querySelector('.header-access-button[data-panel="admin"]');
        if (!adminBtn) return;
        
        adminBtn.addEventListener('click', function() {
            adminPanelOpen = !adminPanelOpen;
            
            // Update aria state
            adminBtn.setAttribute('aria-expanded', adminPanelOpen ? 'true' : 'false');
            
            // Emit event to admin module
            App.emit('panel:toggle', {
                panel: 'admin',
                show: adminPanelOpen
            });
        });
        
        // Listen for admin panel close events
        App.on('admin:closed', function() {
            adminPanelOpen = false;
            if (adminBtn) {
                adminBtn.setAttribute('aria-expanded', 'false');
            }
        });
        
        App.on('admin:opened', function() {
            adminPanelOpen = true;
            if (adminBtn) {
                adminBtn.setAttribute('aria-expanded', 'true');
            }
        });
        
        // Listen for member state changes to show/hide admin button
        App.on('member:stateChanged', function(data) {
            var user = data && data.user;
            if (user && user.isAdmin === true) {
                showAdminButton();
            } else {
                hideAdminButton();
            }
        });
    }
    
    function showAdminButton() {
        if (!adminBtn) return;
        adminBtn.classList.remove('header-access-button--hidden');
        adminBtn.removeAttribute('hidden');
        adminBtn.setAttribute('aria-hidden', 'false');
    }
    
    function hideAdminButton() {
        if (!adminBtn) return;
        adminBtn.classList.add('header-access-button--hidden');
        adminBtn.setAttribute('hidden', '');
        adminBtn.setAttribute('aria-hidden', 'true');
    }


    /* --------------------------------------------------------------------------
       FULLSCREEN BUTTON
       -------------------------------------------------------------------------- */
    
    function initFullscreenButton() {
        fullscreenBtn = document.querySelector('.header-access-button[data-action="fullscreen"]');
        if (!fullscreenBtn) return;
        
        var docEl = document.documentElement;
        var canFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        var enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;
        
        // Hide button if fullscreen not supported
        if (!canFS || enabled === false) {
            fullscreenBtn.classList.add('header-access-button--hidden');
            return;
        }
        
        // Initial state
        updateFullscreenState();
        
        // Listen for fullscreen changes (cross-browser)
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function(evt) {
            document.addEventListener(evt, updateFullscreenState);
        });
        
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    function getFullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }
    
    function toggleFullscreen() {
        var docEl = document.documentElement;
        var isFull = getFullscreenElement();
        
        if (!isFull) {
            var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (req) {
                try {
                    var result = req.call(docEl);
                    if (result && typeof result.catch === 'function') result.catch(function() {});
                } catch (err) {
                    updateFullscreenState();
                }
            }
        } else {
            var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) {
                try {
                    var result = exit.call(document);
                    if (result && typeof result.catch === 'function') result.catch(function() {});
                } catch (err) {
                    updateFullscreenState();
                }
            }
        }
    }
    
    function updateFullscreenState() {
        if (!fullscreenBtn) return;
        
        var isFull = getFullscreenElement();
        fullscreenBtn.setAttribute('aria-pressed', isFull ? 'true' : 'false');
        fullscreenBtn.classList.toggle('is-fullscreen', !!isFull);
    }


    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        updateFilterCounter: updateFilterCounter
    };

})();

// Register module with App
App.registerModule('header', HeaderModule);
