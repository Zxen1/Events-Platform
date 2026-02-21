/* ============================================================================
   FILTER.JS - FILTER PANEL
   ============================================================================ */
const FilterModule = (function() {
    'use strict';

    /* ==========================================================================
       IMPORTANT (Developer Note): TWO FILTERING PIPELINES EXIST
       --------------------------------------------------------------------------
       This file (`filter.js`) DOES NOT filter posts directly.

       It is the Filter PANEL UI + persistence layer only:
       - Builds the UI, reads/writes saved state to `localStorage['funmap_filters']`
       - Emits `App.emit('filter:changed', state)` whenever the user changes filters

       The actual filtering/rendering happens in TWO different modules depending on zoom:

       1) LOW ZOOM (worldwide clusters): `map.js`
          - Reads `localStorage['funmap_filters']`
          - Calls `/gateway.php?action=get-clusters` (+ filter params)
          - Renders cluster markers (aggregated, lightweight)

       2) HIGH ZOOM (zoom >= postsLoadZoom): `post.js`
          - Listens to `filter:changed` AND `map:boundsChanged`
          - Calls `/gateway.php?action=get-posts` with BOTH:
              - saved filter params
              - `bounds` (map area filter)
          - Renders Post cards + Map cards (detailed)

       This split is intentional for performance:
       - Worldwide is cheap for clusters/counts
       - Detailed posts are only fetched "in this map area" at high zoom
       ========================================================================== */

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var panelEl = null;
    var contentEl = null;
    var panelDragged = false;
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
    var currentSort = 'recommended';
    var previousSort = 'recommended';  // For reverting if geolocation is denied
    var userGeoLocation = null;        // { lat, lng } from geolocation API
    var closeSortMenu = null;          // Reference to setSortMenuOpen for use in applySort
    var sortGeoIconEl = null;          // Geolocate icon in "Sort by Distance" dropdown option
    var sortGeoIconBtnEl = null;       // Geolocate icon in the sort button (shown when sort is 'nearest')
    var closeBtn = null;
    
    // Filter basics
    var keywordInput = null;
    var keywordClear = null;
    var priceMinInput = null;
    var priceMaxInput = null;
    var priceClear = null;
    var daterangeInput = null;
    var daterangeClear = null;
    var expiredInput = null;
    var calendarContainer = null;
    var calendarInstance = null;
    var dateStart = null;
    var dateEnd = null;
    var dateRangeDraftOpen = false;
    var outsideCloseBound = false;
    var expiredStateBeforeOpen = false;
    
    // Persistence
    var STORAGE_KEY = 'funmap_filters';
    var saveDebounceTimer = null;
    var requestCountsFn = null;
    var serverCountsOk = false;
    var lastMemberAuthState = null;
    
    // Latest formatted summary text (updated by updateFilterCounts, readable
    // by any module via getFilterSummaryText without depending on panel DOM).
    var lastSummaryText = '';


    /* --------------------------------------------------------------------------
       PERSISTENCE - Save/Load filter state to localStorage
       -------------------------------------------------------------------------- */
    
    function saveFilters(immediate) {
        // Debounce saves to avoid excessive writes (e.g. typing in keyword).
        // Immediate mode skips the debounce (e.g. reset buttons).
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        if (immediate) {
            doSaveFilters();
        } else {
            saveDebounceTimer = setTimeout(doSaveFilters, 300);
        }
    }
    
    function doSaveFilters() {
        try {
            var state = {
                keyword:         keywordInput  ? keywordInput.value.trim()  : '',
                minPrice:        priceMinInput ? priceMinInput.value.trim() : '',
                maxPrice:        priceMaxInput ? priceMaxInput.value.trim() : '',
                dateStart:       dateStart,
                dateEnd:         dateEnd,
                expired:         expiredInput ? expiredInput.checked : false,
                favourites:      favouritesOn,
                sort:            currentSort,
                categories:      getCategoryState(),
                map:             getMapState(),
                subcategoryKeys: getSelectedSubcategoryKeys()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            
            // DB-first persistence (member/admin row), localStorage is secondary.
            try {
                if (window.MemberModule && typeof MemberModule.getCurrentUser === 'function' && typeof MemberModule.saveSetting === 'function') {
                    var u = MemberModule.getCurrentUser();
                    if (u && u.id && u.account_email) {
                        MemberModule.saveSetting('filters_json', JSON.stringify(state));
                    }
                }
            } catch (_eSaveDb) {}
        } catch (e) {
            console.warn('[Filter] Failed to save filters:', e);
        }
    }
    
    function loadFilters() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;
            return JSON.parse(stored);
        } catch (e) {
            console.warn('[Filter] Failed to load filters:', e);
            return null;
        }
    }
    
    function getCategoryState() {
        var container = panelEl ? panelEl.querySelector('.filter-categoryfilter-container') : null;
        if (!container) return null;
        
        var state = {};
        var accordions = container.querySelectorAll('.filter-categoryfilter-accordion');
        accordions.forEach(function(accordion) {
            var catName = accordion.querySelector('.filter-categoryfilter-accordion-header-text');
            if (!catName) return;
            var catKey = catName.textContent.trim();
            
            // IMPORTANT: use the accordion disabled class as the source of truth.
            // The checkbox state can drift if events are prevented/cancelled; the class is what the UI uses.
            var catEnabled = !accordion.classList.contains('filter-categoryfilter-accordion--disabled');
            
            var subs = {};
            accordion.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
                var subName = opt.querySelector('.filter-categoryfilter-accordion-option-text');
                if (!subName) return;
                var subKey = subName.textContent.trim();
                var subToggle = opt.querySelector('.filter-categoryfilter-toggle input');
                subs[subKey] = subToggle && subToggle.checked;
            });
            
            state[catKey] = { enabled: catEnabled, subs: subs };
        });
        return state;
    }

    /**
     * Get selected subcategory keys for filtering posts.
     * This matches the live-site "selection.subs" concept, but uses subcategory_key
     * because the new API returns `post.subcategory_key` as the source-of-truth.
     *
     * - Category OFF => none of its subs are included
     * - Category ON + no subs selected => yields zero keys for that category (filters out those posts)
     */
    function getSelectedSubcategoryKeys() {
        var container = panelEl ? panelEl.querySelector('.filter-categoryfilter-container') : null;
        if (!container) return null;
        
        var keys = [];
        var accordions = container.querySelectorAll('.filter-categoryfilter-accordion');
        accordions.forEach(function(accordion) {
            // Category OFF => none of its subs are included.
            // Use the accordion disabled class as the source-of-truth (it is what the UI sets),
            // because relying on the checkbox alone can drift when events are cancelled/handled.
            var catEnabled = !accordion.classList.contains('filter-categoryfilter-accordion--disabled');
            if (!catEnabled) return;
            
            accordion.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
                var subToggle = opt.querySelector('.filter-categoryfilter-toggle input');
                var subEnabled = subToggle && subToggle.checked;
                if (!subEnabled) return;
                
                var subKey = opt.dataset ? (opt.dataset.subcategoryKey || '') : '';
                if (subKey) keys.push(String(subKey));
            });
        });
        
        // De-dupe, preserve order
        var seen = {};
        return keys.filter(function(k) {
            if (!k) return false;
            if (seen[k]) return false;
            seen[k] = true;
            return true;
        });
    }
    
    function applyCategoryState(state) {
        if (!state) return;
        var container = panelEl ? panelEl.querySelector('.filter-categoryfilter-container') : null;
        if (!container) return;
        
        var accordions = container.querySelectorAll('.filter-categoryfilter-accordion');
        accordions.forEach(function(accordion) {
            var catName = accordion.querySelector('.filter-categoryfilter-accordion-header-text');
            if (!catName) return;
            var catKey = catName.textContent.trim();
            var catState = state[catKey];
            if (!catState) return;
            
            // Apply category toggle
            var headerToggleLabel = accordion.querySelector('.filter-categoryfilter-accordion-header-togglearea .filter-categoryfilter-toggle');
            var headerToggleInput = headerToggleLabel ? headerToggleLabel.querySelector('input') : null;
            var headerToggleSlider = headerToggleLabel ? headerToggleLabel.querySelector('span') : null;
            if (headerToggleInput && headerToggleSlider) {
                headerToggleInput.checked = catState.enabled;
                headerToggleSlider.classList.toggle('component-switch-slider--on-default', catState.enabled);
                // Update disabled state
                accordion.classList.toggle('filter-categoryfilter-accordion--disabled', !catState.enabled);
                var header = accordion.querySelector('.filter-categoryfilter-accordion-header');
                if (header) header.classList.toggle('filter-categoryfilter-accordion-header--disabled', !catState.enabled);
            }
            
            // Apply subcategory toggles
            if (catState.subs) {
                accordion.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
                    var subName = opt.querySelector('.filter-categoryfilter-accordion-option-text');
                    if (!subName) return;
                    var subKey = subName.textContent.trim();
                    if (catState.subs.hasOwnProperty(subKey)) {
                        var subToggleLabel = opt.querySelector('.filter-categoryfilter-toggle');
                        var subToggleInput = subToggleLabel ? subToggleLabel.querySelector('input') : null;
                        var subToggleSlider = subToggleLabel ? subToggleLabel.querySelector('span') : null;
                        if (subToggleInput && subToggleSlider) {
                            subToggleInput.checked = catState.subs[subKey];
                            // Project rule: category filter uses BIG switches (no small switches).
                            subToggleSlider.classList.toggle('component-switch-slider--on-default', catState.subs[subKey]);
                            opt.classList.toggle('filter-categoryfilter-accordion-option--suboff', !catState.subs[subKey]);
                        }
                        opt.classList.toggle('filter-categoryfilter-accordion-option--disabled', !catState.enabled);
                    }
                });
            }

            // Update partial state on category switch
            if (headerToggleSlider && catState.enabled) {
                var anySubOff = false;
                if (catState.subs) {
                    Object.keys(catState.subs).forEach(function(k) {
                        if (!catState.subs[k]) anySubOff = true;
                    });
                }
                headerToggleSlider.classList.toggle('component-switch-slider--on-filter', anySubOff);
            } else if (headerToggleSlider) {
                headerToggleSlider.classList.remove('component-switch-slider--on-filter');
            }
        });
        
        updateResetCategoriesButton();
    }
    
    function getMapState() {
        // Get map center and zoom from the map module
        try {
            var mapModule = App.getModule('map');
            if (mapModule && typeof mapModule.getMapState === 'function') {
                var state = mapModule.getMapState();
                // Rule: Only persist map memory if zoom level is at or above postsLoadZoom threshold.
                // postsLoadZoom is set by index.js from database settings (no hardcoded fallback)
                if (!window.App || typeof App.getConfig !== 'function') {
                    throw new Error('[Filter] App.getConfig is required for postsLoadZoom.');
                }
                var threshold = App.getConfig('postsLoadZoom');
                if (typeof threshold !== 'number' || !isFinite(threshold)) {
                    throw new Error('[Filter] postsLoadZoom config is missing or invalid.');
                }
                if (state && state.zoom >= threshold) {
                    return state;
                }
            }
        } catch (e) {
            // Map module not available
        }
        return null;
    }
    
    function applyMapState(state) {
        if (!state) return;
        try {
            var mapModule = App.getModule('map');
            if (mapModule && typeof mapModule.setMapState === 'function') {
                mapModule.setMapState(state);
            }
        } catch (e) {
            // Map module not available
        }
    }
    
    function restoreFilters() {
        var saved = loadFilters();
        // DB-first: if logged in and a DB snapshot exists, mirror it into localStorage and use it.
        try {
            if (window.MemberModule && typeof MemberModule.getCurrentUser === 'function') {
                var u = MemberModule.getCurrentUser();
                if (u && u.filters_json && typeof u.filters_json === 'string') {
                    // Keep localStorage in sync so map clusters can load correctly before opening filter panel.
                    localStorage.setItem(STORAGE_KEY, u.filters_json);
                    saved = JSON.parse(u.filters_json);
                }
            }
        } catch (_eDbRestore) {}

        if (!saved) return;
        
        // Restore basic filters
        if (keywordInput && saved.keyword) {
            keywordInput.value = saved.keyword;
        }
        if (priceMinInput && saved.minPrice) {
            priceMinInput.value = saved.minPrice;
        }
        if (priceMaxInput && saved.maxPrice) {
            priceMaxInput.value = saved.maxPrice;
        }
        if (saved.dateStart || saved.dateEnd) {
            dateStart = saved.dateStart || null;
            dateEnd = saved.dateEnd || null;
            if (daterangeInput) {
                var parts = [];
                if (dateStart) parts.push(dateStart);
                if (dateEnd && dateEnd !== dateStart) parts.push(dateEnd);
                daterangeInput.value = parts.join(' – ');
            }
        }
        if (expiredInput && saved.expired !== undefined) {
            expiredInput.checked = saved.expired;
            syncExpiredToggleUi();
        }
        if (saved.favourites !== undefined) {
            favouritesOn = saved.favourites;
            if (favouritesBtn) {
                favouritesBtn.setAttribute('aria-pressed', favouritesOn ? 'true' : 'false');
            }
            syncFavouritesButtonUi();
        }
        if (saved.sort) {
            currentSort = saved.sort;
            // Keep UI label in sync with the actual option text (matches live-site behavior).
            // Do NOT emit sort change during restore; sorting will occur when posts are loaded / user interacts.
            try {
                var opt = sortMenuEl ? sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="' + currentSort + '"]') : null;
                if (opt && sortButtonText) {
                    sortButtonText.textContent = opt.textContent;
                }
                if (sortMenuEl) {
                    sortMenuEl.querySelectorAll('.filter-sort-menu-option').forEach(function(o) {
                        o.classList.toggle('filter-sort-menu-option--selected', o.getAttribute('data-sort') === currentSort);
                    });
                }
                // Show geolocate icon in button if sort is 'nearest'
                if (sortGeoIconBtnEl) {
                    sortGeoIconBtnEl.style.display = (currentSort === 'nearest') ? 'inline-block' : 'none';
                }
            } catch (_eSortRestore) {}

            // If saved sort is 'nearest', restore geolocation on page load.
            // If permission was previously granted, this resolves instantly (no popup).
            // If not, the browser will prompt — which is appropriate since the user
            // explicitly chose "Sort by Distance" as their preference.
            if (currentSort === 'nearest' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(pos) {
                        userGeoLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.setCachedLocation) {
                            MapControlRowComponent.setCachedLocation(pos.coords.latitude, pos.coords.longitude);
                        }
                        if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.setAllGeolocateActive) {
                            MapControlRowComponent.setAllGeolocateActive();
                        }
                        App.emit('filter:sortChanged', { sort: 'nearest', userGeoLocation: userGeoLocation });
                    },
                    function() {
                        // Denied or error — revert to recommended
                        currentSort = 'recommended';
                        try {
                            var recOpt = sortMenuEl ? sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="recommended"]') : null;
                            if (recOpt && sortButtonText) sortButtonText.textContent = recOpt.textContent;
                            if (sortGeoIconBtnEl) sortGeoIconBtnEl.style.display = 'none';
                            if (sortMenuEl) {
                                sortMenuEl.querySelectorAll('.filter-sort-menu-option').forEach(function(o) {
                                    o.classList.toggle('filter-sort-menu-option--selected', o.getAttribute('data-sort') === 'recommended');
                                });
                            }
                        } catch (_e) {}
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        }
        
        // Map viewport restore is handled by MapModule at init (DB-first for logged-in users, localStorage for guests)
        // to avoid a visible "world first, then jump" flicker caused by restoring on map:ready here.
        
        updateClearButtons();
    }


    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
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
        initFilterBasics();
        initCategoryFilter(); // Categories restore their state after loading
        initHeaderDrag();
        initBackdropClose();
        initCloseButton();
        bindPanelEvents();
        
        // Restore saved filters (except categories, handled in initCategoryFilter)
        restoreFilters();

        // Panel DOM now exists — refresh counts so summary bar + facets populate.
        requestCounts();
    }
    
    function initBackdropClose() {
        if (outsideCloseBound) return;
        outsideCloseBound = true;
        
        // "Click outside to close" WITHOUT any click-capture overlay.
        // Uses a normal document click listener (like MenuManager) so:
        // - It won't block other UI from receiving clicks
        // - It plays nicely with DevTools inspection
        // - It won't fight the header filter toggle button
        document.addEventListener('click', function(e) {
            if (!panelEl || !contentEl) return;
            if (!panelEl.classList.contains('show')) return;
            if (!e || !e.target) return;
            if (e.target.closest && e.target.closest('.header-filter')) return;
            if (contentEl.contains(e.target)) return;
            
            closePanel();
        }, false);
    }

    function initCloseButton() {
        closeBtn = panelEl.querySelector('.filter-panel-actions-icon-btn--close');
        if (!closeBtn) return;
        
        closeBtn.addEventListener('click', function() {
                closePanel();
            });
    }


    /* --------------------------------------------------------------------------
       PANEL SHOW/HIDE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panelEl || !contentEl) return;

        // Avoid "jolt": reserve the summary line before the slide-in finishes.
        // Show last known counts immediately if we have them.
        try {
            if (summaryEl && typeof lastFilteredCount === 'number' && typeof lastTotalCount === 'number') {
                var areaActive = false;
                try {
                    if (window.MapModule && typeof MapModule.getMap === 'function') {
                        var m = MapModule.getMap();
                        // postsLoadZoom from database settings (no hardcoded fallback)
                        if (!window.App || typeof App.getConfig !== 'function') {
                            throw new Error('[Filter] App.getConfig is required for postsLoadZoom.');
                        }
                        var threshold = App.getConfig('postsLoadZoom');
                        if (typeof threshold !== 'number' || !isFinite(threshold)) {
                            throw new Error('[Filter] postsLoadZoom config is missing or invalid.');
                        }
                        if (m && typeof m.getZoom === 'function' && m.getZoom() >= threshold) areaActive = true;
                    }
                } catch (_eArea) {}
                updateFilterCounts(lastFilteredCount, lastTotalCount, areaActive);
            }
        } catch (_eSummary) {}
        
        panelEl.classList.add('show');
        panelEl.setAttribute('aria-hidden', 'false');
        panelEl.removeAttribute('inert');

        // Show (force a frame between "off-screen" and "visible" so slide-in
        // always transitions at the same speed as slide-out)
        contentEl.classList.remove('panel-visible');
        try { void contentEl.offsetWidth; } catch (e) {}
        if (!panelDragged && window.innerWidth > 530) {
            contentEl.style.left = '0px';
            contentEl.style.right = 'auto';
        }
        requestAnimationFrame(function() {
            contentEl.classList.add('panel-visible');
        });
        
        // Bring panel to front of stack
        App.bringToTop(panelEl);

        // Authoritative counts (worldwide + in-area)
        try { if (typeof requestCountsFn === 'function') requestCountsFn(); } catch (_eCounts) {}
    }
    
    function closePanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.setAttribute('inert', '');
        contentEl.classList.remove('panel-visible');
        
        function finalizeClose() {
            panelEl.classList.remove('show');
            panelEl.setAttribute('aria-hidden', 'true');
            try { App.removeFromStack(panelEl); } catch (_eStack) {}
            // Always notify header/state sync. This prevents "button stays blue when closed".
            try { App.emit('filter:closed'); } catch (_eEmit) {}
        }
        
        // With transitions disabled, transitionend will never fire. Close immediately.
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(contentEl) : null;
            var dur = cs ? String(cs.transitionDuration || '0s').split(',')[0].trim() : '0s';
            if (dur === '0s' || dur === '0ms') {
                finalizeClose();
                return;
            }
        } catch (_eDur) {
            finalizeClose();
            return;
        }
        
        contentEl.addEventListener('transitionend', function handler() {
            contentEl.removeEventListener('transitionend', handler);
            finalizeClose();
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
       SUMMARY & COUNTS
       -------------------------------------------------------------------------- */
    
    var lastFilteredCount = 0;
    var lastTotalCount = 0;
    var headerFilterBadge = null;
    
    function updateSummary(text) {
        if (summaryEl) {
            summaryEl.textContent = text || '';
        }
    }
    
    /**
     * Update filter counts display (summary message + header badge)
     * @param {number} filtered - Number of filtered results
     * @param {number} total - Total results in visible area
     */
    function updateFilterCounts(filtered, total, areaActive) {
        lastFilteredCount = filtered;
        lastTotalCount = total;
        
        // Build summary text (stored for any module to read, not panel-dependent)
        var scopeText = areaActive ? 'in this map area' : 'worldwide';
        lastSummaryText =
            String(filtered) + ' result' + (filtered !== 1 ? 's' : '') +
            ' showing out of ' + String(total) +
            ' ' + scopeText;
        
        // Update summary message in filter panel (if open)
        if (summaryEl) {
            summaryEl.textContent = lastSummaryText;
        }
        
        // Update header filter button badge
        updateHeaderBadge(filtered);
    }
    
    /**
     * Update the count badge on the header filter button
     */
    function updateHeaderBadge(count) {
        // Find or create badge element
        var headerFilterBtn = document.querySelector('.header-filter');
        if (!headerFilterBtn) return;
        
        headerFilterBadge = headerFilterBtn.querySelector('.header-filter-badge');
        if (!headerFilterBadge) {
            headerFilterBadge = document.createElement('span');
            headerFilterBadge.className = 'header-filter-badge';
            headerFilterBtn.appendChild(headerFilterBadge);
        }
        
        // Update badge content
        headerFilterBadge.textContent = String(count);
        headerFilterBadge.style.display = '';
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
        // Wait for system_images so icon masks are available at creation time
        // (without this, icons render as colored squares if images load after controls)
        var sys = (window.App && typeof App.getState === 'function') ? App.getState('system_images') : null;
        if (!sys || !sys.icon_geolocate) {
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
            variant: 'filter',
            placeholder: 'Search venues or places',
            map: map,
            onResult: function(result) {
                handleGeocoderResult(result);
            }
        });

        // Register the sort geolocate icons now that MapControlRowComponent is ready
        // and system_images are loaded (same timing as the built-in geolocate icons)
        if (sortGeoIconEl && MapControlRowComponent.registerGeolocateIcon) {
            MapControlRowComponent.registerGeolocateIcon(
                sortGeoIconEl,
                'filter-sort-geolocate-icon',
                'filter-sort-geolocate-icon'
            );
        }
        if (sortGeoIconBtnEl && MapControlRowComponent.registerGeolocateIcon) {
            MapControlRowComponent.registerGeolocateIcon(
                sortGeoIconBtnEl,
                'filter-sort-geolocate-icon',
                'filter-sort-geolocate-icon'
            );
        }
    }
    
    function handleGeocoderResult(result) {
        // Geocoder result received
        if (!result || !result.center) {
            console.warn('[Filter] Invalid result');
            return;
        }
        
        var lng = result.center[0];
        var lat = result.center[1];
        // Flying to location
        
        // Pass to MapModule to handle bbox/viewport for proper zoom
        if (typeof MapModule !== 'undefined' && MapModule.handleGeocoderResult) {
            MapModule.handleGeocoderResult(result, 'filter');
        } else {
            console.warn('[Filter] MapModule.handleGeocoderResult not available');
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
                    resetAllFilters();
                    App.emit('filter:resetAll');
                }
            });
        }
        
        if (resetCategoriesBtn) {
            resetCategoriesBtn.addEventListener('click', function() {
                if (!resetCategoriesBtn.disabled) {
                    resetAllCategories();
                    App.emit('filter:resetCategories');
                }
            });
        }
    }
    
    function resetAllCategories() {
        var container = panelEl.querySelector('.filter-categoryfilter-container');
        if (!container) return;
        
        // Turn on all toggles (both header and option)
        var allToggles = container.querySelectorAll('.filter-categoryfilter-toggle');
        allToggles.forEach(function(toggle) {
            var input = toggle.querySelector('input');
            var slider = toggle.querySelector('span');
            if (input) input.checked = true;
            if (slider) {
                // Project rule: category filter uses BIG switches (no small switches).
                slider.classList.remove('component-switch-slider--on-default');
                slider.classList.add('component-switch-slider--on-default');
                slider.classList.remove('component-switch-slider--on-filter');
            }
        });
        
        // Remove disabled state from all accordions
        var accordions = container.querySelectorAll('.filter-categoryfilter-accordion');
        accordions.forEach(function(accordion) {
            accordion.classList.remove('filter-categoryfilter-accordion--disabled');
            var header = accordion.querySelector('.filter-categoryfilter-accordion-header');
            if (header) header.classList.remove('filter-categoryfilter-accordion-header--disabled');
            accordion.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
                opt.classList.remove('filter-categoryfilter-accordion-option--disabled');
                opt.classList.remove('filter-categoryfilter-accordion-option--suboff');
            });
        });
        
        applyFilters();
        // Reset is a one-shot action — save to DB immediately (skip debounce)
        // so the state survives a fast page refresh.
        saveFilters(true);
        setResetCategoriesActive(false);
    }
    
    function setResetFiltersActive(active) {
        if (resetFiltersBtn) {
            resetFiltersBtn.disabled = !active;
        }
        // Summary and header reflect ANY active filtering (filters OR categories).
        updateFilterActiveVisual();
    }
    
    function setResetCategoriesActive(active) {
        if (resetCategoriesBtn) {
            resetCategoriesBtn.disabled = !active;
        }
        // Summary and header reflect ANY active filtering (filters OR categories).
        updateFilterActiveVisual();
    }

    /**
     * Update the summary bar color and header icon based on whether ANY
     * filtering is active (filters OR categories). Called whenever either
     * the filter reset button or category reset button state changes.
     */
    function updateFilterActiveVisual() {
        var hasFilters = resetFiltersBtn && !resetFiltersBtn.disabled;
        var hasCategories = resetCategoriesBtn && !resetCategoriesBtn.disabled;
        var anyActive = hasFilters || hasCategories;
        if (summaryEl) {
            summaryEl.classList.toggle('filter-panel-summary--active', anyActive);
        }
        App.emit('filter:activeState', { active: anyActive });
    }
    
    function updateResetCategoriesButton() {
        // Check if any category or subcategory toggle is OFF
        var container = panelEl.querySelector('.filter-categoryfilter-container');
        if (!container) return;
        
        // Check all toggles
        var allToggles = container.querySelectorAll('.filter-categoryfilter-toggle');
        var anyOff = false;
        
        allToggles.forEach(function(toggle) {
            var input = toggle.querySelector('input');
            if (input && !input.checked) {
                anyOff = true;
            }
        });
        
        setResetCategoriesActive(anyOff);
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
                syncFavouritesButtonUi();
                App.emit('filter:favouritesToggle', { enabled: favouritesOn });
                saveFilters();
            });
            syncFavouritesButtonUi();
        }
    }
    
    function setFavouritesOn(on) {
        favouritesOn = !!on;
        if (favouritesBtn) {
            favouritesBtn.setAttribute('aria-pressed', favouritesOn ? 'true' : 'false');
            syncFavouritesButtonUi();
        }
    }
    
    function syncFavouritesButtonUi() {
        if (!favouritesBtn) return;
        var icon = favouritesBtn.querySelector('.filter-favourites-icon');
        if (icon) icon.classList.toggle('filter-favourites-icon--active', !!favouritesOn);
    }


    /* --------------------------------------------------------------------------
       SORT MENU
       -------------------------------------------------------------------------- */
    
    function initSortMenu() {
        sortMenuEl = panelEl.querySelector('.filter-sort-menu');
        if (!sortMenuEl) return;
        
        sortButtonEl = sortMenuEl.querySelector('.filter-sort-menu-button');
        sortButtonText = sortMenuEl.querySelector('.filter-sort-menu-button-text');
        var sortArrowEl = sortMenuEl.querySelector('.filter-sort-menu-button-arrow');
        var sortOptionsEl = sortMenuEl.querySelector('.filter-sort-menu-options');
        var options = sortMenuEl.querySelectorAll('.filter-sort-menu-option');

        // Store icon elements for deferred registration
        sortGeoIconEl = sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="nearest"] .filter-sort-geolocate-icon');
        sortGeoIconBtnEl = sortMenuEl.querySelector('.filter-sort-geolocate-icon--button');

        function setSortMenuOpen(isOpen) {
            sortMenuEl.classList.toggle('filter-sort-menu--open', !!isOpen);
            if (sortButtonEl) sortButtonEl.classList.toggle('menu-button--open', !!isOpen);
            if (sortArrowEl) sortArrowEl.classList.toggle('menu-arrow--open', !!isOpen);
            if (sortOptionsEl) sortOptionsEl.classList.toggle('menu-options--open', !!isOpen);
            // Keep component-specific classes for display toggle
            if (sortOptionsEl) sortOptionsEl.classList.toggle('filter-sort-menu-options--open', !!isOpen);
        }
        // Expose to module scope so applySort can close the menu after async geolocation
        closeSortMenu = setSortMenuOpen;
        
        // Toggle menu open/close
        if (sortButtonEl) {
            sortButtonEl.addEventListener('click', function(e) {
                e.stopPropagation();
                setSortMenuOpen(!sortMenuEl.classList.contains('filter-sort-menu--open'));
            });
        }
        
        // Handle option selection
        // Menu closes from applySort (handles both sync and async geolocation paths)
        options.forEach(function(option) {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                var sort = option.getAttribute('data-sort');
                selectSort(sort, option.textContent);
            });
        });
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (sortMenuEl && !sortMenuEl.contains(e.target)) {
                setSortMenuOpen(false);
            }
        });
        
        // Set initial selected state
        var firstOption = sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="recommended"]');
        if (firstOption) {
            firstOption.classList.add('filter-sort-menu-option--selected');
        }
    }
    
    function selectSort(sortKey, label) {
        // "Sort by Closest" triggers geolocation; on denial, revert to previous sort
        if (sortKey === 'nearest') {
            if (userGeoLocation) {
                // Already have location — apply sort immediately
                applySort(sortKey, label);
                return;
            }
            // Check if geolocate was already done via map control buttons
            if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.getCachedLocation) {
                var cached = MapControlRowComponent.getCachedLocation();
                if (cached && cached.lat && cached.lng) {
                    userGeoLocation = { lat: cached.lat, lng: cached.lng };
                    applySort(sortKey, label);
                    return;
                }
            }
            if (!navigator.geolocation) {
                // Browser doesn't support geolocation — revert
                applySort(previousSort);
                return;
            }
            // Trigger loading state on all synced geolocate icons
            if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.setAllGeolocateLoading) {
                MapControlRowComponent.setAllGeolocateLoading();
            }
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    userGeoLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    // Sync cached location with MapControlRowComponent so map geolocate buttons
                    // can reuse it instantly without re-triggering the browser prompt
                    if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.setCachedLocation) {
                        MapControlRowComponent.setCachedLocation(pos.coords.latitude, pos.coords.longitude);
                    }
                    // Set active state on all synced geolocate icons
                    if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.setAllGeolocateActive) {
                        MapControlRowComponent.setAllGeolocateActive();
                    }
                    applySort(sortKey, label);
                },
                function() {
                    // Clear loading state on all synced geolocate icons
                    if (typeof MapControlRowComponent !== 'undefined' && MapControlRowComponent.clearAllGeolocateLoading) {
                        MapControlRowComponent.clearAllGeolocateLoading();
                    }
                    // Denied or error — revert to previous sort
                    applySort(previousSort);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
            return;
        }
        applySort(sortKey, label);
    }

    function applySort(sortKey, label) {
        previousSort = currentSort;
        currentSort = sortKey;
        
        // Resolve label from DOM if not provided (used when reverting)
        if (!label && sortMenuEl) {
            var opt = sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="' + sortKey + '"]');
            if (opt) label = opt.textContent;
        }
        
        if (sortButtonText && label) {
            sortButtonText.textContent = label;
        }
        
        // Show/hide the geolocate icon in the sort button
        if (sortGeoIconBtnEl) {
            sortGeoIconBtnEl.style.display = (sortKey === 'nearest') ? 'inline-block' : 'none';
        }
        
        // Update selected state
        var options = sortMenuEl.querySelectorAll('.filter-sort-menu-option');
        options.forEach(function(opt) {
            opt.classList.toggle('filter-sort-menu-option--selected', opt.getAttribute('data-sort') === sortKey);
        });
        
        // Close the sort menu (handles both immediate and async geolocation paths)
        if (closeSortMenu) closeSortMenu(false);
        
        App.emit('filter:sortChanged', { sort: sortKey, userGeoLocation: userGeoLocation });
        saveFilters();
    }
    
    function setSort(sortKey) {
        var option = sortMenuEl ? sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="' + sortKey + '"]') : null;
        if (option) {
            selectSort(sortKey, option.textContent);
        }
    }


    /* --------------------------------------------------------------------------
       FILTER BASICS
       -------------------------------------------------------------------------- */
    
    function initFilterBasics() {
        var container = panelEl.querySelector('.filter-basics-container');
        if (!container) return;
        
        // Upgrade clear buttons to use SVG icons
        if (typeof ClearButtonComponent !== 'undefined') {
            ClearButtonComponent.upgradeAll('.filter-keyword-clear, .filter-price-clear, .filter-daterange-clear');
        }
        
        // Keyword
        keywordInput = container.querySelector('.filter-keyword-input');
        keywordClear = container.querySelector('.filter-keyword-clear');
        
        if (keywordInput) {
            keywordInput.addEventListener('input', function() {
                applyFilters();
                updateClearButtons();
            });
        }
        
        if (keywordClear) {
            keywordClear.addEventListener('click', function() {
                if (keywordInput) keywordInput.value = '';
                applyFilters();
                updateClearButtons();
            });
        }
        
        // Price - numbers only
        priceMinInput = container.querySelector('.filter-price-min');
        priceMaxInput = container.querySelector('.filter-price-max');
        priceClear = container.querySelector('.filter-price-clear');
        
        [priceMinInput, priceMaxInput].forEach(function(input) {
            if (!input) return;
            
            // Only allow numbers
            input.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
                applyFilters();
                updateClearButtons();
            });
            
            // Prevent non-numeric keys
            input.addEventListener('keypress', function(e) {
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });
        });
        
        if (priceClear) {
            priceClear.addEventListener('click', function() {
                if (priceMinInput) priceMinInput.value = '';
                if (priceMaxInput) priceMaxInput.value = '';
                applyFilters();
                updateClearButtons();
            });
        }
        
        // Daterange
        daterangeInput = container.querySelector('.filter-daterange-input');
        daterangeClear = container.querySelector('.filter-daterange-clear');
        calendarContainer = container.querySelector('.filter-calendar-container');
        
        // Initialize calendar component
        buildCalendar();
        
        if (daterangeInput) {
            daterangeInput.addEventListener('click', function() {
                toggleCalendar();
            });
        }
        
        if (daterangeClear) {
            daterangeClear.addEventListener('click', function() {
                if (expiredInput) expiredInput.checked = false;
                clearDateRange();
                rebuildCalendar();
                applyFilters();
                updateClearButtons();
            });
        }
        
        // Close calendar when clicking outside
        document.addEventListener('click', function(e) {
            if (calendarContainer && calendarContainer.classList.contains('filter-calendar-container--open')) {
                var isClearBtn = daterangeClear && (daterangeClear === e.target || daterangeClear.contains(e.target));
                if (!calendarContainer.contains(e.target) && e.target !== daterangeInput && !isClearBtn) {
                    if (expiredInput) expiredInput.checked = expiredStateBeforeOpen;
                    setDaterangeInputValue(dateStart, dateEnd);
                    if (calendarInstance && calendarInstance.clearSelection) {
                        calendarInstance.clearSelection();
                    }
                    rebuildCalendar();
                    closeCalendar();
                }
            }
        });
        
        // Expired toggle (hidden checkbox, controlled by button inside calendar actions)
        expiredInput = container.querySelector('.filter-expired-input');
        
        updateClearButtons();
    }
    

    function updateClearButtons() {
        // Keyword
        if (keywordClear && keywordInput) {
            keywordClear.classList.toggle('active', keywordInput.value.trim() !== '');
        }
        
        // Price
        if (priceClear) {
            var hasPrice = (priceMinInput && priceMinInput.value.trim() !== '') || 
                           (priceMaxInput && priceMaxInput.value.trim() !== '');
            priceClear.classList.toggle('active', hasPrice);
        }
        
        // Daterange
        if (daterangeClear && daterangeInput) {
            var hasDate = daterangeInput.value.trim() !== '' || dateStart || dateEnd;
            daterangeClear.classList.toggle('active', !!hasDate);
        }
        
        updateResetBtn();
    }
    
    function updateResetBtn() {
        var hasKeyword = keywordInput && keywordInput.value.trim() !== '';
        var hasPrice = (priceMinInput && priceMinInput.value.trim() !== '') || 
                       (priceMaxInput && priceMaxInput.value.trim() !== '');
        var hasDate = (daterangeInput && daterangeInput.value.trim() !== '') || dateStart || dateEnd;
        var hasExpired = expiredInput && expiredInput.checked;
        
        // Categories have their own Reset All Categories button — they do not
        // affect the Reset All Filters button state.
        var active = hasKeyword || hasPrice || hasDate || hasExpired;
        setResetFiltersActive(active);
    }
    
    function applyFilters() {
        var state = getFilterState();
        // Write localStorage BEFORE emitting so every handler reads the correct state.
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_e) {}
        App.emit('filter:changed', state);
        // Debounced DB save
        saveFilters();
    }
    
    function getFilterState() {
        return {
            keyword: keywordInput ? keywordInput.value.trim() : '',
            minPrice: priceMinInput ? priceMinInput.value.trim() : '',
            maxPrice: priceMaxInput ? priceMaxInput.value.trim() : '',
            dateStart: dateStart,
            dateEnd: dateEnd,
            expired: expiredInput ? expiredInput.checked : false,
            favourites: favouritesOn,
            sort: currentSort,
            // Category filter
            categories: getCategoryState(),
            subcategoryKeys: getSelectedSubcategoryKeys()
        };
    }
    
    function buildCalendar() {
        if (!calendarContainer || typeof CalendarComponent === 'undefined') return;
        
        var calendarEl = calendarContainer.querySelector('.filter-calendar');
        if (!calendarEl) return;
        
        // Match index.js: 12 months past when expired is on, 0 months past when off
        // maxPickerDate is 2 years forward (24 months)
        var showExpired = expiredInput && expiredInput.checked;
        var monthsPast = showExpired ? 12 : 0;
        
        calendarInstance = CalendarComponent.create(calendarEl, {
            monthsPast: monthsPast,
            monthsFuture: 24,
            allowPast: showExpired
        });
        
        // Add date range selection logic - store in calendarInstance for external access
        calendarInstance.selectedStart = null;
        calendarInstance.selectedEnd = null;
        
        calendarInstance.updateRangeSelection = function() {
            var days = calendarInstance.calendar.querySelectorAll('.calendar-day[data-iso]');
            days.forEach(function(d) {
                d.classList.remove('selected', 'range-start', 'range-end', 'in-range');
            });
            days.forEach(function(d) {
                var iso = d.dataset.iso;
                if (calendarInstance.selectedStart && iso === calendarInstance.selectedStart) {
                    d.classList.add('selected', 'range-start');
                }
                if (calendarInstance.selectedEnd && iso === calendarInstance.selectedEnd) {
                    d.classList.add('selected', 'range-end');
                }
                if (calendarInstance.selectedStart && calendarInstance.selectedEnd && iso > calendarInstance.selectedStart && iso < calendarInstance.selectedEnd) {
                    d.classList.add('in-range');
                }
            });
        };
        
        calendarInstance.clearSelection = function() {
            calendarInstance.selectedStart = null;
            calendarInstance.selectedEnd = null;
            calendarInstance.updateRangeSelection();
        };
        
        var days = calendarInstance.calendar.querySelectorAll('.calendar-day[data-iso]');
        days.forEach(function(cell) {
            var dateObj = new Date(cell.dataset.iso);
            if (dateObj >= calendarInstance.today || showExpired) {
                cell.addEventListener('click', function() {
                    var clickedDate = String(this.dataset.iso || '');
                    if (!clickedDate) return;
                    
                    if (!calendarInstance.selectedStart || (calendarInstance.selectedStart && calendarInstance.selectedEnd)) {
                        calendarInstance.selectedStart = clickedDate;
                        calendarInstance.selectedEnd = null;
                        calendarInstance.updateRangeSelection();
                        if (!calendarContainer || !calendarContainer.classList.contains('filter-calendar-container--open')) return;
                        dateRangeDraftOpen = true;
                        setDaterangeInputValue(calendarInstance.selectedStart, calendarInstance.selectedEnd, true);
                    } else {
                        if (clickedDate < calendarInstance.selectedStart) {
                            calendarInstance.selectedEnd = calendarInstance.selectedStart;
                            calendarInstance.selectedStart = clickedDate;
                        } else {
                            calendarInstance.selectedEnd = clickedDate;
                        }
                        calendarInstance.updateRangeSelection();
                        if (!calendarContainer || !calendarContainer.classList.contains('filter-calendar-container--open')) return;
                        dateRangeDraftOpen = true;
                        setDaterangeInputValue(calendarInstance.selectedStart, calendarInstance.selectedEnd, true);
                    }
                });
            }
        });
        
        var actionsEl = document.createElement('div');
        actionsEl.className = 'calendar-actions';
        
        var expiredBtn = document.createElement('button');
        expiredBtn.className = 'filter-expired-btn button-class-2';
        expiredBtn.type = 'button';
        expiredBtn.textContent = 'Show Expired Events';
        if (expiredInput && expiredInput.checked && expiredStateBeforeOpen) {
            expiredBtn.classList.add('filter-expired-btn--active');
        } else if (expiredInput && expiredInput.checked) {
            expiredBtn.classList.add('filter-expired-btn--selected');
        }
        expiredBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (expiredInput) {
                expiredInput.checked = !expiredInput.checked;
            }
            var isOn = expiredInput && expiredInput.checked;
            expiredBtn.classList.remove('filter-expired-btn--active', 'filter-expired-btn--selected');
            if (isOn && expiredStateBeforeOpen) {
                expiredBtn.classList.add('filter-expired-btn--active');
            } else if (isOn) {
                expiredBtn.classList.add('filter-expired-btn--selected');
            }
            rebuildCalendar();
            
            if (isOn) {
                var now = new Date();
                var pastDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                var futureDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
                setDaterangeInputValue(pastDate.toISOString().slice(0, 10), futureDate.toISOString().slice(0, 10));
            } else {
                setDaterangeInputValue(dateStart, dateEnd);
            }
        });
        
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'calendar-cancel button-class-2';
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            calendarInstance.clearSelection();
            if (expiredInput) expiredInput.checked = expiredStateBeforeOpen;
            setDaterangeInputValue(dateStart, dateEnd, false);
            dateRangeDraftOpen = false;
            rebuildCalendar();
            closeCalendar();
            updateClearButtons();
        });
        
        var okBtn = document.createElement('button');
        okBtn.className = 'calendar-ok button-class-2';
        okBtn.type = 'button';
        okBtn.textContent = 'OK';
        okBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (calendarInstance.selectedStart || calendarInstance.selectedEnd) {
                setDateRange(calendarInstance.selectedStart, calendarInstance.selectedEnd);
            } else if (expiredInput && expiredInput.checked) {
                var now = new Date();
                var pastDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                var futureDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
                setDateRange(pastDate.toISOString().slice(0, 10), futureDate.toISOString().slice(0, 10));
            }
            dateRangeDraftOpen = false;
            closeCalendar();
            applyFilters();
            updateClearButtons();
        });
        
        actionsEl.appendChild(expiredBtn);
        actionsEl.appendChild(cancelBtn);
        actionsEl.appendChild(okBtn);
        calendarContainer.appendChild(actionsEl);
    }
    
    function rebuildCalendar() {
        if (!calendarContainer) return;
        
        var calendarEl = calendarContainer.querySelector('.filter-calendar');
        if (calendarEl) {
            calendarEl.innerHTML = '';
        }
        
        var oldActions = calendarContainer.querySelector('.calendar-actions');
        if (oldActions) {
            oldActions.parentNode.removeChild(oldActions);
        }
        
        buildCalendar();
    }
    
    function toggleCalendar() {
        if (!calendarContainer) return;
        
        var isOpen = calendarContainer.classList.contains('filter-calendar-container--open');
        
        if (isOpen) {
            if (expiredInput) expiredInput.checked = expiredStateBeforeOpen;
            setDaterangeInputValue(dateStart, dateEnd, false);
            dateRangeDraftOpen = false;
            rebuildCalendar();
            closeCalendar();
        } else {
            openCalendar();
        }
    }
    
    function openCalendar() {
        if (!calendarContainer) return;
        expiredStateBeforeOpen = expiredInput ? expiredInput.checked : false;
        calendarContainer.classList.add('filter-calendar-container--open');
        syncExpiredToggleUi();
        if (daterangeInput) {
            daterangeInput.setAttribute('aria-expanded', 'true');
        }
        if (calendarInstance && calendarInstance.scrollToToday) {
            calendarInstance.scrollToToday();
        }
    }
    
    function closeCalendar() {
        if (!calendarContainer) return;
        calendarContainer.classList.remove('filter-calendar-container--open');
        if (daterangeInput) {
            daterangeInput.setAttribute('aria-expanded', 'false');
        }
    }
    
    function setDaterangeInputValue(start, end, showPendingRangeHint) {
        if (!daterangeInput) return;
            if (start && end) {
                daterangeInput.value = formatDateShort(start) + ' - ' + formatDateShort(end);
            } else if (start) {
            daterangeInput.value = showPendingRangeHint ? (formatDateShort(start) + ' -') : formatDateShort(start);
            } else {
                daterangeInput.value = '';
            }
        }

    function setDateRange(start, end) {
        dateStart = start;
        dateEnd = end;
        
        setDaterangeInputValue(start, end, false);
        
        updateClearButtons();
    }
    
    function clearDateRange() {
        dateStart = null;
        dateEnd = null;
        if (daterangeInput) daterangeInput.value = '';
        if (calendarInstance && calendarInstance.clearSelection) {
            calendarInstance.clearSelection();
        }
        closeCalendar();
    }
    
    function formatDateShort(date) {
        return App.formatDateShort(date);
    }
    
    function resetAllFilters() {
        if (keywordInput) keywordInput.value = '';
        if (priceMinInput) priceMinInput.value = '';
        if (priceMaxInput) priceMaxInput.value = '';
        if (expiredInput) expiredInput.checked = false;
        syncExpiredToggleUi();
        rebuildCalendar();
        clearDateRange();
        clearGeocoder();
        updateClearButtons();
        
        // applyFilters() reads the current DOM state (including categories) and
        // writes the correct state to localStorage + emits filter:changed.
        // No need to remove localStorage first — that creates a window where
        // other listeners (clusters) read empty state and show unfiltered results.
        applyFilters();
        // Reset is a one-shot action — save to DB immediately (skip debounce)
        // so the state survives a fast page refresh.
        saveFilters(true);
    }
    
    function syncExpiredToggleUi() {
        if (!expiredInput) return;
        var btn = calendarContainer ? calendarContainer.querySelector('.filter-expired-btn') : null;
        if (!btn) return;
        btn.classList.remove('filter-expired-btn--active', 'filter-expired-btn--selected');
        if (expiredInput.checked && expiredStateBeforeOpen) {
            btn.classList.add('filter-expired-btn--active');
        } else if (expiredInput.checked) {
            btn.classList.add('filter-expired-btn--selected');
        }
    }


    /* --------------------------------------------------------------------------
       CATEGORY FILTER
       -------------------------------------------------------------------------- */

    function setCategoryCountsLoading(on) {
        try {
            var els = panelEl ? panelEl.querySelectorAll('.filter-categoryfilter-count') : [];
            els.forEach(function(el) {
                if (!el) return;
                el.classList.toggle('filter-categoryfilter-count--loading', !!on);
                if (on) {
                    // Blank (no wrong numbers, no flicker if request is fast)
                    if (el.textContent !== '') el.textContent = '';
                }
            });
        } catch (_e) {}
    }

    function applyFacetCounts(facetMap) {
        if (!facetMap || typeof facetMap !== 'object') return;
        var container = panelEl ? panelEl.querySelector('.filter-categoryfilter-container') : null;
        if (!container) return;

        // Subcategory counts
        container.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
            var key = opt && opt.dataset ? (opt.dataset.subcategoryKey || '') : '';
            var countEl = opt ? opt.querySelector('.filter-categoryfilter-count') : null;
            if (!countEl) return;
            var val = key && facetMap.hasOwnProperty(key) ? Number(facetMap[key] || 0) : 0;
            var nextText = String(val);
            if (countEl.textContent !== nextText) {
                countEl.textContent = nextText;
            }
        });

        // Category header counts:
        // - If all subs are enabled => show a single number (total).
        // - If any sub is disabled => show a fraction enabled/total (even if disabled subs are 0),
        //   so users can see at a glance that the drawer has internal filters.
        // Sub counts always show "would be" counts regardless of enabled state.
        container.querySelectorAll('.filter-categoryfilter-accordion').forEach(function(acc) {
            var enabledTotal = 0;
            var allTotal = 0;
            var anySubOff = false;
            acc.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
                var subToggle = opt.querySelector('.filter-categoryfilter-toggle input');
                var subEnabled = !!(subToggle && subToggle.checked);
                if (!subEnabled) anySubOff = true;
                var key = opt && opt.dataset ? (opt.dataset.subcategoryKey || '') : '';
                if (!key) return;
                if (facetMap.hasOwnProperty(key)) {
                    var n = Number(facetMap[key] || 0);
                    allTotal += n;
                    if (subEnabled) enabledTotal += n;
                }
            });
            var headerCount = acc.querySelector('.filter-categoryfilter-accordion-header .filter-categoryfilter-count');
            if (headerCount) {
                var t = anySubOff ? (String(enabledTotal) + '/' + String(allTotal)) : String(allTotal);
                if (headerCount.textContent !== t) headerCount.textContent = t;
            }
        });
    }
    
    function initCategoryFilter() {
        var container = panelEl.querySelector('.filter-categoryfilter-container');
        if (!container) {
            console.warn('[Filter] Category filter container not found');
            return;
        }
        
        // Loading category filters...
        
        // Fetch categories from database
        fetch('/gateway.php?action=get-form')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (!res.success) {
                    console.warn('[Filter] get-form request failed:', res);
                    return;
                }
                if (!res.formData) {
                    console.warn('[Filter] No formData in get-form response');
                    return;
                }
                
                var categories = res.formData.categories || [];
                var categoryIconPaths = res.formData.categoryIconPaths || {};
                var subcategoryIconPaths = res.formData.subcategoryIconPaths || {};
                
                // Categories loaded
                if (categories.length === 0) {
                    console.warn('[Filter] No categories found in formData');
                    return;
                }
                
                categories.forEach(function(cat) {
                    var accordion = document.createElement('div');
                    accordion.className = 'filter-categoryfilter-accordion accordion-class-2';
                    
                    // Header
                    var header = document.createElement('div');
                    header.className = 'filter-categoryfilter-accordion-header accordion-header';
                    
                    var headerImg = document.createElement('img');
                    headerImg.className = 'filter-categoryfilter-accordion-header-image';
                    headerImg.src = categoryIconPaths[cat.name] || '';
                    headerImg.alt = '';
                    
                    var headerText = document.createElement('span');
                    headerText.className = 'filter-categoryfilter-accordion-header-text';
                    headerText.textContent = cat.name;

                    var headerCount = document.createElement('span');
                    headerCount.className = 'filter-categoryfilter-count';
                    headerCount.textContent = '';
                    
                    var headerArrow = document.createElement('span');
                    headerArrow.className = 'filter-categoryfilter-accordion-header-arrow';
                    
                    var headerToggleArea = document.createElement('div');
                    headerToggleArea.className = 'filter-categoryfilter-accordion-header-togglearea';
                    var headerSwitch = SwitchComponent.create({
                        checked: true
                    });
                    headerSwitch.element.classList.add('filter-categoryfilter-toggle');
                    headerToggleArea.appendChild(headerSwitch.element);
                    
                    header.appendChild(headerImg);
                    header.appendChild(headerText);
                    header.appendChild(headerCount);
                    header.appendChild(headerArrow);
                    header.appendChild(headerToggleArea);
                    
                    // Body
                    var body = document.createElement('div');
                    body.className = 'filter-categoryfilter-accordion-body accordion-body';
                    
                    var subs = cat.subs || [];
                    subs.forEach(function(sub) {
                        var subName = (typeof sub === 'string') ? sub : (sub && sub.name);
                        if (!subName) return;

                        var option = document.createElement('div');
                        option.className = 'filter-categoryfilter-accordion-option';
                        // Store subcategory_key on the option for PostModule filtering (source-of-truth is DB dump).
                        try {
                            var feeInfo = cat && cat.subFees && cat.subFees[subName];
                            var subKey = feeInfo && feeInfo.subcategory_key ? String(feeInfo.subcategory_key) : '';
                            if (subKey) {
                                option.dataset.subcategoryKey = subKey;
                            }
                        } catch (_eSubKey) {}
                        
                        var optImg = document.createElement('img');
                        optImg.className = 'filter-categoryfilter-accordion-option-image';
                        optImg.src = subcategoryIconPaths[subName] || '';
                        optImg.alt = '';
                        
                        var optText = document.createElement('span');
                        optText.className = 'filter-categoryfilter-accordion-option-text';
                        optText.textContent = subName;

                        var optCount = document.createElement('span');
                        optCount.className = 'filter-categoryfilter-count';
                        optCount.textContent = '';
                        
                        var optSwitch = SwitchComponent.create({
                            checked: true,
                            onChange: function() {
                                // Grey out when subcategory is off (but still allow toggling back on)
                                try {
                                    option.classList.toggle('filter-categoryfilter-accordion-option--suboff', !optSwitch.isChecked());
                                } catch (_eSubOff) {}
                                updateCategoryPartialState();
                                applyFilters();
                                updateResetCategoriesButton();
                                updateClearButtons();
                            }
                        });
                        optSwitch.element.classList.add('filter-categoryfilter-toggle');
                        
                        option.appendChild(optImg);
                        option.appendChild(optText);
                        option.appendChild(optCount);
                        option.appendChild(optSwitch.element);
                        
                        // Click anywhere on option toggles the switch
                        option.addEventListener('click', function(e) {
                            if (e.target === optSwitch.element || optSwitch.element.contains(e.target)) return;
                            optSwitch.toggle();
                        });
                        
                        body.appendChild(option);
                    });
                    
                    accordion.appendChild(header);
                    accordion.appendChild(body);

                    function setAccordionOpen(isOpen) {
                        accordion.classList.toggle('filter-categoryfilter-accordion--open', !!isOpen);
                        accordion.classList.toggle('accordion-class-2--open', !!isOpen);
                        headerArrow.classList.toggle('filter-categoryfilter-accordion-header-arrow--open', !!isOpen);
                        body.classList.toggle('filter-categoryfilter-accordion-body--open', !!isOpen);
                    }

                    function setAccordionDisabled(isDisabled) {
                        accordion.classList.toggle('filter-categoryfilter-accordion--disabled', !!isDisabled);
                        header.classList.toggle('filter-categoryfilter-accordion-header--disabled', !!isDisabled);
                        body.querySelectorAll('.filter-categoryfilter-accordion-option').forEach(function(opt) {
                            opt.classList.toggle('filter-categoryfilter-accordion-option--disabled', !!isDisabled);
                        });
                    }

                    // Orange partial state: category is ON but some subs are OFF
                    function updateCategoryPartialState() {
                        var slider = headerSwitch.element.querySelector('span');
                        if (!slider) return;
                        if (!headerSwitch.isChecked()) {
                            slider.classList.remove('component-switch-slider--on-filter');
                            return;
                        }
                        var anySubOff = false;
                        body.querySelectorAll('.filter-categoryfilter-toggle input').forEach(function(inp) {
                            if (!inp.checked) anySubOff = true;
                        });
                        slider.classList.toggle('component-switch-slider--on-filter', anySubOff);
                    }
                    
                    // Category toggle area click - disable and force close
                    headerToggleArea.addEventListener('click', function(e) {
                        // IMPORTANT:
                        // SwitchComponent renders a <label><input type="checkbox">...</label>.
                        // Clicking it will toggle the checkbox by default. We also toggle manually below.
                        // Without preventDefault(), that can double-toggle and leave the checkbox unchanged,
                        // which breaks category filtering at or above map_card_breakpoint (subcategoryKeys won't update).
                        e.preventDefault();
                        e.stopPropagation();
                        headerSwitch.toggle();
                        if (headerSwitch.isChecked()) {
                            setAccordionDisabled(false);
                        } else {
                            setAccordionDisabled(true);
                            setAccordionOpen(false);
                        }
                        updateCategoryPartialState();
                        applyFilters();
                        updateResetCategoriesButton();
                        updateClearButtons();
                    });
                    
                    // Click anywhere except toggle area expands/collapses
                    header.addEventListener('click', function(e) {
                        if (e.target === headerToggleArea || headerToggleArea.contains(e.target)) return;
                        setAccordionOpen(!accordion.classList.contains('filter-categoryfilter-accordion--open'));
                    });
                    
                    container.appendChild(accordion);
                });
                
                // Category filters rendered - restore saved state
                var saved = loadFilters();
                if (saved && saved.categories) {
                    applyCategoryState(saved.categories);
                }

                // The category DOM is built async (get-form). The initial requestCounts() can complete
                // before the accordions exist, so facet counters have nowhere to render.
                // Now that the DOM exists, request counts again to paint counters immediately.
                try { if (typeof requestCountsFn === 'function') requestCountsFn(); } catch (_eCounts2) {}
            })
            .catch(function(err) {
                console.error('[Filter] Failed to load categories:', err);
            });
    }
    
    
    /* --------------------------------------------------------------------------
       HEADER DRAG
       -------------------------------------------------------------------------- */
    
    function initHeaderDrag() {
        if (!headerEl || !contentEl) return;
        
        // ---- Panel Drag ----
        // Moves the panel freely within the viewport. Left transition is suppressed
        // during drag for instant response, then restored on release.
        // Panel is clamped to stay fully on screen at all times.
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            
            var rect = contentEl.getBoundingClientRect();
            var startX = e.clientX;
            var startLeft = rect.left;
            
            contentEl.style.transitionProperty = 'transform';
            
            function onMove(ev) {
                panelDragged = true;
                var dx = ev.clientX - startX;
                var newLeft = startLeft + dx;
                if (newLeft < 0) newLeft = 0;
                if (newLeft > window.innerWidth - rect.width) newLeft = window.innerWidth - rect.width;
                contentEl.style.left = newLeft + 'px';
                contentEl.style.right = 'auto';
            }
            
            function onUp() {
                contentEl.style.transitionProperty = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // ---- Resize Smoothing / Resize Teleport ----
        // RESIZE_SMOOTHING: panel holds position during resize, then glides back via CSS transition.
        // RESIZE_TELEPORT:  panel hides instantly on resize start, snaps to correct position,
        //                   then slides back in using the normal open animation.
        // Default (both false): no intervention — browser renders as normal.
        var RESIZE_SMOOTHING = false;
        var RESIZE_TELEPORT  = true;

        var resizeTimer  = null;
        var resizeFading = false;

        window.addEventListener('resize', function() {
            if (!contentEl || !contentEl.style.left) return;
            if (window.innerWidth <= 530) return;

            if (RESIZE_TELEPORT && !resizeFading) {
                resizeFading = true;
                contentEl.style.transition = 'none';
                contentEl.style.opacity = '0';
            }

            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                var newLeft = panelDragged
                    ? Math.min(parseFloat(contentEl.style.left) || 0, window.innerWidth - 40)
                    : 0;

                if (RESIZE_TELEPORT) {
                    contentEl.style.transition = 'none';
                    contentEl.style.left = newLeft + 'px';
                    void contentEl.offsetWidth;
                    contentEl.style.transition = '';
                    contentEl.style.opacity = '1';
                    resizeFading = false;
                } else if (RESIZE_SMOOTHING) {
                    contentEl.style.left = newLeft + 'px';
                }
            }, 100);
        });
    }


    /* --------------------------------------------------------------------------
       PANEL EVENTS
       -------------------------------------------------------------------------- */
    
    function bindPanelEvents() {
        // Bring to front when panel is clicked
        if (panelEl) {
            panelEl.addEventListener('mousedown', function() {
                App.bringToTop(panelEl);
            });
        }
        
        App.on('panel:toggle', function(data) {
            if (data.panel === 'filter') {
                togglePanel(data.show);
            }
        });

        try {
            if (window.MemberModule && typeof MemberModule.isLoggedIn === 'function') {
                lastMemberAuthState = !!MemberModule.isLoggedIn();
            } else {
                lastMemberAuthState = false;
            }
        } catch (_eAuthInit) {
            lastMemberAuthState = false;
        }

        // Login/logout refresh rule:
        // If Filter is open, close then reopen to refresh auth-dependent state.
        App.on('member:stateChanged', function(data) {
            var nextAuthState = !!(data && data.user);
            if (lastMemberAuthState === nextAuthState) return;
            lastMemberAuthState = nextAuthState;
            refreshOpenFilterPanelForAuthChange();
        });
        
        // Map viewport is persisted by scheduleSaveMapView() in map.js
        // and included via getMapState() when doSaveFilters() runs.
        // Do NOT call saveFilters() on boundsChanged — it resets the
        // debounce timer on every map movement, preventing DB saves.
    }

    function refreshOpenFilterPanelForAuthChange() {
        if (!panelEl || !contentEl) return;
        if (!panelEl.classList.contains('show')) return;

        closePanel();
        // Respect real slide animation duration before reopening.
        var reopenDelayMs = getContentTransitionDurationMs(contentEl) + 60;
        setTimeout(function() {
            openPanel();
        }, reopenDelayMs);
    }

    function getContentTransitionDurationMs(el) {
        var durationMs = 300;
        try {
            if (!el || !window.getComputedStyle) return durationMs;
            var cs = window.getComputedStyle(el);
            var dur = (cs && cs.transitionDuration) ? String(cs.transitionDuration).split(',')[0].trim() : '';
            if (dur.endsWith('ms')) durationMs = Math.max(0, parseFloat(dur) || 0);
            else if (dur.endsWith('s')) durationMs = Math.max(0, (parseFloat(dur) || 0) * 1000);
        } catch (_eDur) {}
        return Math.max(0, Math.ceil(durationMs));
    }


    /* --------------------------------------------------------------------------
       COUNTING SYSTEM — runs from page load, independent of panel open state.
       Reads filter state from localStorage + map state. Updates header badge,
       summary bar (if panel open), and facet counts (if panel open).
       -------------------------------------------------------------------------- */
    
    var countsToken = 0;
    var countsAbort = null;
    
    function requestCounts() {
        countsToken++;
        var myToken = countsToken;

        var st = {};
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') st = parsed;
            }
        } catch (_e) {}

        var zoom = 0;
        var boundsParam = '';
        try {
            if (window.MapModule && typeof MapModule.getMap === 'function') {
                var map = MapModule.getMap();
                if (map && typeof map.getZoom === 'function') zoom = map.getZoom();
                if (map && typeof map.getBounds === 'function') {
                    var b = map.getBounds();
                    if (b && typeof b.getWest === 'function') {
                        boundsParam = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',');
                    }
                }
            }
        } catch (_e2) {}

        var qs = new URLSearchParams();
        qs.set('action', 'get-filter-counts');
        qs.set('zoom', String(zoom));
        if (boundsParam) qs.set('bounds', boundsParam);
        if (st.keyword) qs.set('keyword', String(st.keyword));
        if (st.minPrice) qs.set('min_price', String(st.minPrice));
        if (st.maxPrice) qs.set('max_price', String(st.maxPrice));
        if (st.dateStart) qs.set('date_start', String(st.dateStart));
        if (st.dateEnd) qs.set('date_end', String(st.dateEnd));
        if (st.expired) qs.set('expired', '1');
        if (Array.isArray(st.subcategoryKeys) && st.subcategoryKeys.length) {
            qs.set('subcategory_keys', st.subcategoryKeys.map(String).join(','));
        }

        // Only show "loading" state if request is not instant (prevents flicker).
        var loadingTimer = setTimeout(function() {
            setCategoryCountsLoading(true);
        }, 120);

        // Cancel any in-flight count request (counters must be cancellable).
        try { if (countsAbort) countsAbort.abort(); } catch (_eAbort) {}
        countsAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;

        fetch('/gateway.php?' + qs.toString(), countsAbort ? { signal: countsAbort.signal } : undefined)
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (myToken !== countsToken) return;
                clearTimeout(loadingTimer);
                if (!res || res.success !== true) {
                    setCategoryCountsLoading(false);
                    return;
                }
                setCategoryCountsLoading(false);
                serverCountsOk = true;
                updateFilterCounts(Number(res.total_showing || 0), Number(res.total_available || 0), !!res.area_active);
                if (res.facet_subcategories && typeof res.facet_subcategories === 'object') {
                    applyFacetCounts(res.facet_subcategories);
                }
            })
            .catch(function() {
                clearTimeout(loadingTimer);
                setCategoryCountsLoading(false);
            });
    }

    requestCountsFn = requestCounts;

    // Register counting listeners immediately (no panel dependency).
    
    // Legacy post-module counts (server-side counts override once available)
    App.on('filter:countsUpdated', function(data) {
        if (serverCountsOk) return;
        if (data && typeof data.filtered === 'number' && typeof data.total === 'number') {
            updateFilterCounts(data.filtered, data.total, !!data.areaActive);
        }
    });
    
    // Early cluster counts (before detailed counts arrive)
    App.on('clusters:countUpdated', function(data) {
        if (data && typeof data.total === 'number') {
            if (lastTotalCount === 0 && lastFilteredCount === 0) {
                updateHeaderBadge(data.total);
                if (summaryEl) {
                    var scopeText = 'worldwide';
                    try {
                        if (window.MapModule && typeof MapModule.getMap === 'function') {
                            var m = MapModule.getMap();
                            if (!window.App || typeof App.getConfig !== 'function') {
                                throw new Error('[Filter] App.getConfig is required for postsLoadZoom.');
                            }
                            var threshold = App.getConfig('postsLoadZoom');
                            if (typeof threshold !== 'number' || !isFinite(threshold)) {
                                throw new Error('[Filter] postsLoadZoom config is missing or invalid.');
                            }
                            if (m && typeof m.getZoom === 'function' && m.getZoom() >= threshold) scopeText = 'in this area';
                        }
                    } catch (_eScope) {}
                    summaryEl.textContent = data.total + ' result' + (data.total !== 1 ? 's' : '') + ' ' + scopeText;
                }
            }
        }
    });

    // Recompute counts when filters change
    App.on('filter:changed', function() { requestCounts(); });

    // Recompute counts on login/logout
    App.on('member:stateChanged', function() { requestCounts(); });

    // Recompute counts when map crosses the breakpoint threshold or moves above it
    var wasAboveThreshold = false;
    App.on('map:boundsChanged', function() {
        try {
            if (!window.App || typeof App.getConfig !== 'function') return;
            var threshold = App.getConfig('postsLoadZoom');
            if (typeof threshold !== 'number' || !isFinite(threshold)) return;
            var currentZoom = 0;
            if (window.MapModule && typeof MapModule.getMap === 'function') {
                var m = MapModule.getMap();
                if (m && typeof m.getZoom === 'function') {
                    currentZoom = m.getZoom();
                }
            }
            var isAboveThreshold = currentZoom >= threshold;
            var crossedThreshold = isAboveThreshold !== wasAboveThreshold;
            wasAboveThreshold = isAboveThreshold;
            if (!crossedThreshold && !isAboveThreshold) return;
        } catch (_e) { return; }
        requestCounts();
    });

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    /**
     * Re-read filter state from localStorage and update the entire UI to match.
     * Called by external code (e.g. MemberModule) after writing new filters to
     * localStorage so the panel, header, counts, and map all agree.
     * Safe to call whether the panel has been initialized or not.
     */
    function refreshFromStorage() {
        var saved = loadFilters();
        if (!saved) return;

        // Update panel UI only if the panel has been initialized.
        // If not, the panel will read from localStorage when it eventually inits.
        if (panelEl) {
            if (keywordInput) keywordInput.value = saved.keyword || '';
            if (priceMinInput) priceMinInput.value = saved.minPrice || '';
            if (priceMaxInput) priceMaxInput.value = saved.maxPrice || '';
            dateStart = saved.dateStart || null;
            dateEnd = saved.dateEnd || null;
            if (daterangeInput) {
                var parts = [];
                if (dateStart) parts.push(dateStart);
                if (dateEnd && dateEnd !== dateStart) parts.push(dateEnd);
                daterangeInput.value = parts.join(' – ');
            }
            if (expiredInput) {
                expiredInput.checked = !!saved.expired;
                syncExpiredToggleUi();
            }
            if (saved.favourites !== undefined) {
                favouritesOn = !!saved.favourites;
                if (favouritesBtn) favouritesBtn.setAttribute('aria-pressed', favouritesOn ? 'true' : 'false');
                syncFavouritesButtonUi();
            }
            if (saved.sort) {
                currentSort = saved.sort;
                try {
                    var opt = sortMenuEl ? sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="' + currentSort + '"]') : null;
                    if (opt && sortButtonText) sortButtonText.textContent = opt.textContent;
                    if (sortMenuEl) {
                        sortMenuEl.querySelectorAll('.filter-sort-menu-option').forEach(function(o) {
                            o.classList.toggle('filter-sort-menu-option--selected', o.getAttribute('data-sort') === currentSort);
                        });
                    }
                } catch (_eSort) {}
            }

            if (saved.categories) {
                applyCategoryState(saved.categories);
            }

            updateClearButtons();

            try { if (typeof requestCountsFn === 'function') requestCountsFn(); } catch (_eCounts) {}
        }

        // Always emit so header badge/colour and map clusters sync,
        // even if the filter panel hasn't been opened yet.
        App.emit('filter:changed', saved);
    }

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
        setSort: setSort,
        getFilterState: getFilterState,
        getFilterSummaryText: function() { return lastSummaryText; },
        setDateRange: setDateRange,
        openCalendar: openCalendar,
        closeCalendar: closeCalendar,
        resetAllFilters: resetAllFilters,
        refreshFromStorage: refreshFromStorage
    };

})();

// Register module with App
App.registerModule('filter', FilterModule);

// Expose globally for consistency with other modules
window.FilterModule = FilterModule;
