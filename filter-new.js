/* ============================================================================
   FILTER PANEL - Parts 1-5
   1. Panel Container
   2. Panel Content
   3. Panel Header
   4. Map Control Row (Geocoder, Geolocate, Compass)
   5. Reset Buttons + Favourites
   ============================================================================ */

const FilterModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var panelEl = null;
    var contentEl = null;
    var headerEl = null;
    var bodyEl = null;
    var summaryEl = null;
    var mapControls = null;
    var resetFiltersBtn = null;
    var resetCategoriesBtn = null;
    var favouritesBtn = null;
    var favouritesOn = false;


    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        console.log('[Filter] Initializing filter module...');
        
        panelEl = document.querySelector('.filter-panel');
        if (!panelEl) {
            console.warn('[Filter] No filter panel found');
            return;
        }
        
        contentEl = panelEl.querySelector('.filter-panel-content');
        headerEl = panelEl.querySelector('.filter-panel-header');
        bodyEl = panelEl.querySelector('.filter-panel-body');
        summaryEl = panelEl.querySelector('.filter-panel-summary');
        
        initMapControls();
        initResetButtons();
        initFavouritesButton();
        initHeaderDrag();
        bindPanelEvents();
        
        console.log('[Filter] Filter module initialized');
    }


    /* --------------------------------------------------------------------------
       PART 1-2: PANEL SHOW/HIDE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.classList.add('show');
        panelEl.setAttribute('aria-hidden', 'false');
        panelEl.removeAttribute('inert');
        
        contentEl.classList.add('panel-visible');
    }
    
    function closePanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.setAttribute('inert', '');
        contentEl.classList.remove('panel-visible');
        
        contentEl.addEventListener('transitionend', function handler() {
            contentEl.removeEventListener('transitionend', handler);
            panelEl.classList.remove('show');
            panelEl.setAttribute('aria-hidden', 'true');
        }, { once: true });
    }
    
    function togglePanel(show) {
        if (show === undefined) {
            show = !panelEl.classList.contains('show');
        }
        
        if (show) {
            openPanel();
        } else {
            closePanel();
        }
    }


    /* --------------------------------------------------------------------------
       PART 3: PANEL HEADER / SUMMARY
       -------------------------------------------------------------------------- */
    
    function updateSummary(text) {
        if (summaryEl) {
            summaryEl.textContent = text || '';
        }
    }


    /* --------------------------------------------------------------------------
       PART 4: MAP CONTROL ROW (Geocoder, Geolocate, Compass)
       Uses MapControlRowComponent from components-new.js
       -------------------------------------------------------------------------- */
    
    function initMapControls() {
        // Wait for dependencies
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            setTimeout(initMapControls, 100);
            return;
        }
        if (typeof MapControlRowComponent === 'undefined') {
            setTimeout(initMapControls, 100);
            return;
        }
        
        var container = panelEl.querySelector('.filter-map-controls');
        if (!container) return;
        
        // Get map instance from MapModule
        var map = null;
        if (typeof MapModule !== 'undefined' && MapModule.getMap) {
            map = MapModule.getMap();
        }
        
        // If map not ready yet, wait and retry
        if (!map) {
            App.on('map:ready', function(data) {
                if (data && data.map) {
                    createControls(container, data.map);
                }
            });
            return;
        }
        
        createControls(container, map);
    }
    
    function createControls(container, map) {
        mapControls = MapControlRowComponent.create(container, {
            location: 'filter',
            placeholder: 'Search venues or places',
            map: map,
            onResult: function(result) {
                handleGeocoderResult(result);
            }
        });
    }
    
    function handleGeocoderResult(result) {
        if (!result || !result.center) return;
        
        var lng = result.center[0];
        var lat = result.center[1];
        
        // Fly to location via MapModule
        if (typeof MapModule !== 'undefined' && MapModule.flyTo) {
            MapModule.flyTo(lng, lat);
        }
        
        // Emit event
        App.emit('filter:placeSelected', {
            lat: lat,
            lng: lng,
            name: result.text || '',
            address: result.place_name || ''
        });
    }
    
    function clearGeocoder() {
        if (mapControls && mapControls.geocoder && mapControls.geocoder.clear) {
            mapControls.geocoder.clear();
        }
    }


    /* --------------------------------------------------------------------------
       PART 5: RESET BUTTONS + FAVOURITES
       -------------------------------------------------------------------------- */
    
    function initResetButtons() {
        resetFiltersBtn = panelEl.querySelector('.filter-reset-btn[data-reset="filters"]');
        resetCategoriesBtn = panelEl.querySelector('.filter-reset-btn[data-reset="categories"]');
        
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', function() {
                if (!resetFiltersBtn.disabled) {
                    App.emit('filter:resetAll');
                }
            });
        }
        
        if (resetCategoriesBtn) {
            resetCategoriesBtn.addEventListener('click', function() {
                if (!resetCategoriesBtn.disabled) {
                    App.emit('filter:resetCategories');
                }
            });
        }
    }
    
    function setResetFiltersActive(active) {
        if (resetFiltersBtn) {
            resetFiltersBtn.disabled = !active;
        }
    }
    
    function setResetCategoriesActive(active) {
        if (resetCategoriesBtn) {
            resetCategoriesBtn.disabled = !active;
        }
    }
    
    function initFavouritesButton() {
        favouritesBtn = panelEl.querySelector('.filter-favourites-btn');
        
        if (favouritesBtn) {
            favouritesBtn.addEventListener('click', function() {
                favouritesOn = !favouritesOn;
                favouritesBtn.setAttribute('aria-pressed', favouritesOn ? 'true' : 'false');
                App.emit('filter:favouritesToggle', { enabled: favouritesOn });
            });
        }
    }
    
    function setFavouritesOn(on) {
        favouritesOn = !!on;
        if (favouritesBtn) {
            favouritesBtn.setAttribute('aria-pressed', favouritesOn ? 'true' : 'false');
        }
    }


    /* --------------------------------------------------------------------------
       PANEL HEADER DRAG (move panel left/right)
       Source: index.js line 27210
       -------------------------------------------------------------------------- */
    
    function initHeaderDrag() {
        if (!headerEl || !contentEl) return;
        
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            
            var rect = contentEl.getBoundingClientRect();
            var startX = e.clientX;
            var startLeft = rect.left;
            
            function onMove(ev) {
                var dx = ev.clientX - startX;
                var newLeft = startLeft + dx;
                var maxLeft = window.innerWidth - rect.width;
                if (newLeft < 0) newLeft = 0;
                if (newLeft > maxLeft) newLeft = maxLeft;
                contentEl.style.left = newLeft + 'px';
                contentEl.style.right = 'auto';
            }
            
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }


    /* --------------------------------------------------------------------------
       PANEL EVENTS
       -------------------------------------------------------------------------- */
    
    function bindPanelEvents() {
        App.on('panel:toggle', function(data) {
            if (data.panel === 'filter') {
                togglePanel(data.show);
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
        togglePanel: togglePanel,
        updateSummary: updateSummary,
        clearGeocoder: clearGeocoder,
        setResetFiltersActive: setResetFiltersActive,
        setResetCategoriesActive: setResetCategoriesActive,
        setFavouritesOn: setFavouritesOn
    };

})();

// Register module with App
App.registerModule('filter', FilterModule);

