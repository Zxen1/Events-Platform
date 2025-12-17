/* ============================================================================
   FILTER.JS - FILTER PANEL
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
    var sortMenuEl = null;
    var sortButtonEl = null;
    var sortButtonText = null;
    var currentSort = 'az';


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
        initSortMenu();
        initHeaderDrag();
        bindPanelEvents();
        
        console.log('[Filter] Filter module initialized');
    }


    /* --------------------------------------------------------------------------
       PANEL SHOW/HIDE
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
       SUMMARY
       -------------------------------------------------------------------------- */
    
    function updateSummary(text) {
        if (summaryEl) {
            summaryEl.textContent = text || '';
        }
    }


    /* --------------------------------------------------------------------------
       MAP CONTROLS
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
       RESET BUTTONS
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


    /* --------------------------------------------------------------------------
       FAVOURITES BUTTON
       -------------------------------------------------------------------------- */
    
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
       SORT MENU
       -------------------------------------------------------------------------- */
    
    function initSortMenu() {
        sortMenuEl = panelEl.querySelector('.filter-sort-menu');
        if (!sortMenuEl) return;
        
        sortButtonEl = sortMenuEl.querySelector('.filter-sort-menu-button');
        sortButtonText = sortMenuEl.querySelector('.filter-sort-menu-button-text');
        var options = sortMenuEl.querySelectorAll('.filter-sort-menu-option');
        
        // Toggle menu open/close
        if (sortButtonEl) {
            sortButtonEl.addEventListener('click', function(e) {
                e.stopPropagation();
                sortMenuEl.classList.toggle('open');
            });
        }
        
        // Handle option selection
        options.forEach(function(option) {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                var sort = option.getAttribute('data-sort');
                selectSort(sort, option.textContent);
                sortMenuEl.classList.remove('open');
            });
        });
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (sortMenuEl && !sortMenuEl.contains(e.target)) {
                sortMenuEl.classList.remove('open');
            }
        });
        
        // Set initial selected state
        var firstOption = sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="az"]');
        if (firstOption) {
            firstOption.classList.add('selected');
        }
    }
    
    function selectSort(sortKey, label) {
        currentSort = sortKey;
        
        if (sortButtonText) {
            sortButtonText.textContent = label;
        }
        
        // Update selected state
        var options = sortMenuEl.querySelectorAll('.filter-sort-menu-option');
        options.forEach(function(opt) {
            opt.classList.toggle('selected', opt.getAttribute('data-sort') === sortKey);
        });
        
        App.emit('filter:sortChanged', { sort: sortKey });
    }
    
    function setSort(sortKey) {
        var option = sortMenuEl ? sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="' + sortKey + '"]') : null;
        if (option) {
            selectSort(sortKey, option.textContent);
        }
    }


    /* --------------------------------------------------------------------------
       HEADER DRAG
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
        setFavouritesOn: setFavouritesOn,
        setSort: setSort
    };

})();

// Register module with App
App.registerModule('filter', FilterModule);
