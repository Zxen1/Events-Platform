/* ============================================================================
   HEADER.JS - HEADER SECTION
   ============================================================================
   
   Controls the header bar at the top of the page.
   
   CURRENTLY IMPLEMENTED:
   - Filter button (opens/closes filter panel, shows active filter count)
   - Fullscreen button (toggles fullscreen mode)
   
   NOT YET IMPLEMENTED (dependencies needed):
   - Logo button (needs admin settings)
   - Mode switch (needs post module)
   - Member/Admin buttons (need their panels)
   
   ============================================================================ */

const HeaderModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var filterPanelOpen = false;
    var filterBtn = null;
    var fullscreenBtn = null;


    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        console.log('[Header] Initializing header module...');
        
        initFilterButton();
        initFullscreenButton();
        
        console.log('[Header] Header module initialized');
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
       FULLSCREEN BUTTON
       -------------------------------------------------------------------------- */
    
    function initFullscreenButton() {
        fullscreenBtn = document.querySelector('.header-access-button[data-action="fullscreen"]');
        if (!fullscreenBtn) return;
        
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        
        // Listen for fullscreen changes (from Escape key, etc.)
        document.addEventListener('fullscreenchange', updateFullscreenIcon);
    }
    
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function(err) {
                console.warn('[Header] Fullscreen request failed:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    function updateFullscreenIcon() {
        if (!fullscreenBtn) return;
        
        var enterIcon = fullscreenBtn.querySelector('.header-access-button-icon--fullscreen');
        var exitIcon = fullscreenBtn.querySelector('.header-access-button-icon--fullscreen-exit');
        
        if (document.fullscreenElement) {
            // In fullscreen - show exit icon, add blue glow
            fullscreenBtn.classList.add('header-access-button--active');
            if (enterIcon) enterIcon.classList.add('header-access-button-icon--hidden');
            if (exitIcon) exitIcon.classList.remove('header-access-button-icon--hidden');
        } else {
            // Not in fullscreen - show enter icon, remove glow
            fullscreenBtn.classList.remove('header-access-button--active');
            if (enterIcon) enterIcon.classList.remove('header-access-button-icon--hidden');
            if (exitIcon) exitIcon.classList.add('header-access-button-icon--hidden');
        }
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
