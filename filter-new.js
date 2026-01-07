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
    var expiredSlider = null;
    var calendarContainer = null;
    var calendarInstance = null;
    var dateStart = null;
    var dateEnd = null;
    var dateRangeDraftOpen = false;
    var outsideCloseBound = false;
    
    // Persistence
    var STORAGE_KEY = 'funmap_filters';
    var saveDebounceTimer = null;


    /* --------------------------------------------------------------------------
       PERSISTENCE - Save/Load filter state to localStorage
       -------------------------------------------------------------------------- */
    
    function saveFilters() {
        // Debounce saves to avoid excessive writes
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(function() {
            try {
                var state = {
                    keyword: keywordInput ? keywordInput.value.trim() : '',
                    minPrice: priceMinInput ? priceMinInput.value.trim() : '',
                    maxPrice: priceMaxInput ? priceMaxInput.value.trim() : '',
                    dateStart: dateStart,
                    dateEnd: dateEnd,
                    expired: expiredInput ? expiredInput.checked : false,
                    favourites: favouritesOn,
                    sort: currentSort,
                    categories: getCategoryState(),
                    map: getMapState()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.warn('[Filter] Failed to save filters:', e);
            }
        }, 300);
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
            
            var headerToggle = accordion.querySelector('.filter-categoryfilter-accordion-header-togglearea .filter-categoryfilter-toggle input');
            var catEnabled = headerToggle && headerToggle.checked;
            
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
                headerToggleSlider.classList.toggle('component-big-switch-slider--on', catState.enabled);
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
                            subToggleSlider.classList.toggle('component-small-switch-slider--on', catState.subs[subKey]);
                        }
                        opt.classList.toggle('filter-categoryfilter-accordion-option--disabled', !catState.enabled);
                    }
                });
            }
        });
        
        updateResetCategoriesButton();
    }
    
    function getMapState() {
        // Get map center and zoom from the map module
        try {
            var mapModule = App.getModule('map');
            if (mapModule && typeof mapModule.getMapState === 'function') {
                return mapModule.getMapState();
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
        }
        if (saved.sort) {
            currentSort = saved.sort;
            if (sortButtonText) {
                var sortLabels = { az: 'A–Z', za: 'Z–A', soonest: 'Soonest', latest: 'Latest' };
                sortButtonText.textContent = sortLabels[saved.sort] || saved.sort;
            }
        }
        
        // Map state is restored separately after map is ready
        if (saved.map) {
            App.on('map:ready', function() {
                applyMapState(saved.map);
            });
        }
        
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
            if (e.target.closest && e.target.closest('.header-filter-button-class-1')) return;
            if (contentEl.contains(e.target)) return;
            
            closePanel();
            App.emit('filter:closed');
        }, false);
    }

    function initCloseButton() {
        closeBtn = panelEl.querySelector('.filter-panel-actions-icon-btn--close');
        if (!closeBtn) return;
        
        closeBtn.addEventListener('click', function() {
                closePanel();
                App.emit('filter:closed');
            });
    }


    /* --------------------------------------------------------------------------
       PANEL SHOW/HIDE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.classList.add('show');
        panelEl.setAttribute('aria-hidden', 'false');
        panelEl.removeAttribute('inert');

        // Show (force a frame between "off-screen" and "visible" so slide-in
        // always transitions at the same speed as slide-out)
        contentEl.classList.remove('panel-visible');
        try { void contentEl.offsetWidth; } catch (e) {}
        requestAnimationFrame(function() {
            contentEl.classList.add('panel-visible');
        });
        
        // Bring panel to front of stack
        App.bringToTop(panelEl);
    }
    
    function closePanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.setAttribute('inert', '');
        contentEl.classList.remove('panel-visible');
        
        contentEl.addEventListener('transitionend', function handler() {
            contentEl.removeEventListener('transitionend', handler);
            panelEl.classList.remove('show');
            panelEl.setAttribute('aria-hidden', 'true');
            
            // Remove from panel stack
            App.removeFromStack(panelEl);
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
            variant: 'filter',
            placeholder: 'Search venues or places',
            map: map,
            onResult: function(result) {
                handleGeocoderResult(result);
            }
        });
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
                slider.classList.add('component-big-switch-slider--on');
                slider.classList.add('component-small-switch-slider--on');
            }
        });
        
        // Remove disabled state from all accordions
        var accordions = container.querySelectorAll('.filter-categoryfilter-accordion');
        accordions.forEach(function(accordion) {
            accordion.classList.remove('filter-categoryfilter-accordion--disabled');
        });
        
        applyFilters();
        setResetCategoriesActive(false);
    }
    
    function setResetFiltersActive(active) {
        if (resetFiltersBtn) {
            resetFiltersBtn.disabled = !active;
        }
        // Notify header to update filter icon color
        App.emit('filter:activeState', { active: active });
    }
    
    function setResetCategoriesActive(active) {
        if (resetCategoriesBtn) {
            resetCategoriesBtn.disabled = !active;
        }
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

        function setSortMenuOpen(isOpen) {
            sortMenuEl.classList.toggle('filter-sort-menu--open', !!isOpen);
            if (sortButtonEl) sortButtonEl.classList.toggle('filter-sort-menu-button--open', !!isOpen);
            if (sortArrowEl) sortArrowEl.classList.toggle('filter-sort-menu-button-arrow--open', !!isOpen);
            if (sortOptionsEl) sortOptionsEl.classList.toggle('filter-sort-menu-options--open', !!isOpen);
        }
        
        // Toggle menu open/close
        if (sortButtonEl) {
            sortButtonEl.addEventListener('click', function(e) {
                e.stopPropagation();
                setSortMenuOpen(!sortMenuEl.classList.contains('filter-sort-menu--open'));
            });
        }
        
        // Handle option selection
        options.forEach(function(option) {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                var sort = option.getAttribute('data-sort');
                selectSort(sort, option.textContent);
                setSortMenuOpen(false);
            });
        });
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (sortMenuEl && !sortMenuEl.contains(e.target)) {
                setSortMenuOpen(false);
            }
        });
        
        // Set initial selected state
        var firstOption = sortMenuEl.querySelector('.filter-sort-menu-option[data-sort="az"]');
        if (firstOption) {
            firstOption.classList.add('filter-sort-menu-option--selected');
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
            opt.classList.toggle('filter-sort-menu-option--selected', opt.getAttribute('data-sort') === sortKey);
        });
        
        App.emit('filter:sortChanged', { sort: sortKey });
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
                clearDateRange();
                applyFilters();
                updateClearButtons();
            });
        }
        
        // Close calendar when clicking outside
        document.addEventListener('click', function(e) {
            if (calendarContainer && calendarContainer.classList.contains('filter-calendar-container--open')) {
                // Check if click is outside calendar, daterange input, and expired toggle row
                var expiredRow = container.querySelector('.filter-expired-row');
                var isExpiredRow = expiredRow && expiredRow.contains(e.target);
                if (!calendarContainer.contains(e.target) && e.target !== daterangeInput && !isExpiredRow) {
                    // Revert draft display back to committed value
                    setDaterangeInputValue(dateStart, dateEnd);
                    // Clear any incomplete selection and close
                    if (calendarInstance && calendarInstance.clearSelection) {
                        calendarInstance.clearSelection();
                    }
                    closeCalendar();
                }
            }
        });
        
        // Expired toggle
        expiredInput = container.querySelector('.filter-expired-input');
        expiredSlider = container.querySelector('.component-big-switch-slider');
        
        if (expiredInput) {
            expiredInput.addEventListener('change', function() {
                syncExpiredToggleUi();
                // Rebuild calendar with extended date range when showing expired
                rebuildCalendar();
                applyFilters();
                updateClearButtons();
            });
        }
        syncExpiredToggleUi();
        
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
        
        var active = hasKeyword || hasPrice || hasDate || hasExpired;
        setResetFiltersActive(active);
    }
    
    function applyFilters() {
        App.emit('filter:changed', getFilterState());
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
            sort: currentSort
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
            allowPast: showExpired,
            showActions: true,
            // While user is selecting dates, show the draft range in the input
            onChange: function(start, end) {
                if (!calendarContainer || !calendarContainer.classList.contains('filter-calendar-container--open')) return;
                dateRangeDraftOpen = true;
                setDaterangeInputValue(start, end, true);
            },
            onSelect: function(start, end) {
                // Cancel: revert to committed value (whether blank or already set)
                if (!start && !end) {
                    setDaterangeInputValue(dateStart, dateEnd, false);
                    dateRangeDraftOpen = false;
                    closeCalendar();
                    updateClearButtons();
                    return;
                }
                
                // OK: commit
                setDateRange(start, end);
                dateRangeDraftOpen = false;
                closeCalendar();
                applyFilters();
                updateClearButtons();
            }
        });
    }
    
    function rebuildCalendar() {
        if (!calendarContainer) return;
        
        var calendarEl = calendarContainer.querySelector('.filter-calendar');
        if (calendarEl) {
            calendarEl.innerHTML = '';
        }
        
        buildCalendar();
    }
    
    function toggleCalendar() {
        if (!calendarContainer) return;
        
        var isOpen = calendarContainer.classList.contains('filter-calendar-container--open');
        
        if (isOpen) {
            // Treat closing as cancel: revert display and clear draft selection
            setDaterangeInputValue(dateStart, dateEnd, false);
            dateRangeDraftOpen = false;
            if (calendarInstance && calendarInstance.clearSelection) {
                calendarInstance.clearSelection();
            }
            closeCalendar();
        } else {
            openCalendar();
        }
    }
    
    function openCalendar() {
        if (!calendarContainer) return;
        calendarContainer.classList.add('filter-calendar-container--open');
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
        if (!date) return '';
        var d = new Date(date);
        var currentYear = new Date().getFullYear();
        var dateYear = d.getFullYear();
        var formatted = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
        if (dateYear !== currentYear) {
            formatted += ', ' + dateYear;
        }
        return formatted;
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
        
        // Clear stored filters
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        
        applyFilters();
    }
    
    function syncExpiredToggleUi() {
        if (!expiredInput || !expiredSlider) return;
        expiredSlider.classList.toggle('component-big-switch-slider--on', !!expiredInput.checked);
    }


    /* --------------------------------------------------------------------------
       CATEGORY FILTER
       -------------------------------------------------------------------------- */
    
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
                    accordion.className = 'filter-categoryfilter-accordion';
                    
                    // Header
                    var header = document.createElement('div');
                    header.className = 'filter-categoryfilter-accordion-header';
                    
                    var headerImg = document.createElement('img');
                    headerImg.className = 'filter-categoryfilter-accordion-header-image';
                    headerImg.src = categoryIconPaths[cat.name] || '';
                    headerImg.alt = '';
                    
                    var headerText = document.createElement('span');
                    headerText.className = 'filter-categoryfilter-accordion-header-text';
                    headerText.textContent = cat.name;
                    
                    var headerArrow = document.createElement('span');
                    headerArrow.className = 'filter-categoryfilter-accordion-header-arrow';
                    headerArrow.textContent = '▼';
                    
                    var headerToggleArea = document.createElement('div');
                    headerToggleArea.className = 'filter-categoryfilter-accordion-header-togglearea';
                    var headerSwitch = SwitchComponent.create({
                        size: 'big',
                        checked: true
                    });
                    headerSwitch.element.classList.add('filter-categoryfilter-toggle');
                    headerToggleArea.appendChild(headerSwitch.element);
                    
                    header.appendChild(headerImg);
                    header.appendChild(headerText);
                    header.appendChild(headerArrow);
                    header.appendChild(headerToggleArea);
                    
                    // Body
                    var body = document.createElement('div');
                    body.className = 'filter-categoryfilter-accordion-body';
                    
                    var subs = cat.subs || [];
                    subs.forEach(function(subName) {
                        var option = document.createElement('div');
                        option.className = 'filter-categoryfilter-accordion-option';
                        
                        var optImg = document.createElement('img');
                        optImg.className = 'filter-categoryfilter-accordion-option-image';
                        optImg.src = subcategoryIconPaths[subName] || '';
                        optImg.alt = '';
                        
                        var optText = document.createElement('span');
                        optText.className = 'filter-categoryfilter-accordion-option-text';
                        optText.textContent = subName;
                        
                        var optSwitch = SwitchComponent.create({
                            size: 'small',
                            checked: true,
                            onChange: function() {
                                applyFilters();
                                updateResetCategoriesButton();
                            }
                        });
                        optSwitch.element.classList.add('filter-categoryfilter-toggle');
                        
                        option.appendChild(optImg);
                        option.appendChild(optText);
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
                    
                    // Category toggle area click - disable and force close
                    headerToggleArea.addEventListener('click', function(e) {
                        e.stopPropagation();
                        headerSwitch.toggle();
                        if (headerSwitch.isChecked()) {
                            setAccordionDisabled(false);
                        } else {
                            setAccordionDisabled(true);
                            setAccordionOpen(false);
                        }
                        applyFilters();
                        updateResetCategoriesButton();
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
        
        // Save filters when map moves (debounced via saveFilters)
        App.on('map:boundsChanged', function() {
            saveFilters();
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
        setSort: setSort,
        getFilterState: getFilterState,
        setDateRange: setDateRange,
        openCalendar: openCalendar,
        closeCalendar: closeCalendar,
        resetAllFilters: resetAllFilters
    };

})();

// Register module with App
App.registerModule('filter', FilterModule);

// Expose globally for consistency with other modules
window.FilterModule = FilterModule;
