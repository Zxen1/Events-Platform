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
        
        var docEl = document.documentElement;
        var canFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        var enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;
        
        // Hide button if fullscreen not supported
        if (!canFS || enabled === false) {
            fullscreenBtn.style.display = 'none';
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
        var enterIcon = fullscreenBtn.querySelector('.header-access-button-icon--fullscreen');
        var exitIcon = fullscreenBtn.querySelector('.header-access-button-icon--fullscreen-exit');
        
        fullscreenBtn.setAttribute('aria-pressed', isFull ? 'true' : 'false');
        fullscreenBtn.classList.toggle('is-fullscreen', !!isFull);
        
        if (enterIcon) enterIcon.classList.toggle('header-access-button-icon--hidden', !!isFull);
        if (exitIcon) exitIcon.classList.toggle('header-access-button-icon--hidden', !isFull);
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
