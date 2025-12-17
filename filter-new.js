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
        initFilterBasics();
        initCategoryFilter();
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
        console.log('[Filter] Geocoder result received:', result);
        if (!result || !result.center) {
            console.warn('[Filter] Invalid result');
            return;
        }
        
        var lng = result.center[0];
        var lat = result.center[1];
        console.log('[Filter] Flying to:', lng, lat);
        
        // Fly to location via MapModule
        if (typeof MapModule !== 'undefined' && MapModule.flyTo) {
            MapModule.flyTo(lng, lat);
        } else {
            console.warn('[Filter] MapModule.flyTo not available');
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
        
        // Turn on all header toggles
        var headerToggles = container.querySelectorAll('.filter-categoryfilter-accordion-header-toggle');
        headerToggles.forEach(function(toggle) {
            toggle.classList.add('on');
        });
        
        // Turn on all option toggles
        var optionToggles = container.querySelectorAll('.filter-categoryfilter-accordion-option-toggle');
        optionToggles.forEach(function(toggle) {
            toggle.classList.add('on');
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
        
        // Check header toggles (categories)
        var headerToggles = container.querySelectorAll('.filter-categoryfilter-accordion-header-toggle');
        var anyOff = false;
        
        headerToggles.forEach(function(toggle) {
            if (!toggle.classList.contains('on')) {
                anyOff = true;
            }
        });
        
        // Check option toggles (subcategories)
        if (!anyOff) {
            var optionToggles = container.querySelectorAll('.filter-categoryfilter-accordion-option-toggle');
            optionToggles.forEach(function(toggle) {
                if (!toggle.classList.contains('on')) {
                    anyOff = true;
                }
            });
        }
        
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
        if (calendarContainer && typeof CalendarComponent !== 'undefined') {
            var calendarEl = calendarContainer.querySelector('.filter-calendar');
            if (calendarEl) {
                calendarInstance = CalendarComponent.create(calendarEl, {
                    monthsPast: 1,
                    monthsFuture: 12,
                    onSelect: function(start, end) {
                        setDateRange(start, end);
                        closeCalendar();
                        applyFilters();
                        updateClearButtons();
                    }
                });
            }
        }
        
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
            if (calendarContainer && calendarContainer.classList.contains('open')) {
                // Check if click is outside calendar and daterange input
                if (!calendarContainer.contains(e.target) && e.target !== daterangeInput) {
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
        
        if (expiredInput) {
            expiredInput.addEventListener('change', function() {
                applyFilters();
            });
        }
        
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
    
    function toggleCalendar() {
        if (!calendarContainer) return;
        
        var isOpen = calendarContainer.classList.contains('open');
        
        if (isOpen) {
            closeCalendar();
        } else {
            openCalendar();
        }
    }
    
    function openCalendar() {
        if (!calendarContainer) return;
        calendarContainer.classList.add('open');
        if (daterangeInput) {
            daterangeInput.setAttribute('aria-expanded', 'true');
        }
    }
    
    function closeCalendar() {
        if (!calendarContainer) return;
        calendarContainer.classList.remove('open');
        if (daterangeInput) {
            daterangeInput.setAttribute('aria-expanded', 'false');
        }
    }
    
    function setDateRange(start, end) {
        dateStart = start;
        dateEnd = end;
        
        if (daterangeInput) {
            if (start && end) {
                daterangeInput.value = formatDateShort(start) + ' - ' + formatDateShort(end);
            } else if (start) {
                daterangeInput.value = formatDateShort(start);
            } else {
                daterangeInput.value = '';
            }
        }
        
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
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
    }
    
    function resetAllFilters() {
        if (keywordInput) keywordInput.value = '';
        if (priceMinInput) priceMinInput.value = '';
        if (priceMaxInput) priceMaxInput.value = '';
        if (expiredInput) expiredInput.checked = false;
        clearDateRange();
        clearGeocoder();
        updateClearButtons();
        applyFilters();
    }


    /* --------------------------------------------------------------------------
       CATEGORY FILTER
       -------------------------------------------------------------------------- */
    
    function initCategoryFilter() {
        var container = panelEl.querySelector('.filter-categoryfilter-container');
        if (!container) return;
        
        // Fetch categories from database
        fetch('/gateway.php?action=get-form')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (!res.success || !res.snapshot) return;
                
                var categories = res.snapshot.categories || [];
                var categoryIconPaths = res.snapshot.categoryIconPaths || {};
                var subcategoryIconPaths = res.snapshot.subcategoryIconPaths || {};
                
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
                    var headerToggle = document.createElement('div');
                    headerToggle.className = 'filter-categoryfilter-accordion-header-toggle on';
                    headerToggleArea.appendChild(headerToggle);
                    
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
                        
                        var optToggle = document.createElement('div');
                        optToggle.className = 'filter-categoryfilter-accordion-option-toggle on';
                        
                        option.appendChild(optImg);
                        option.appendChild(optText);
                        option.appendChild(optToggle);
                        
                        // Click anywhere on option toggles the switch
                        option.addEventListener('click', function() {
                            optToggle.classList.toggle('on');
                            applyFilters();
                            updateResetCategoriesButton();
                        });
                        
                        body.appendChild(option);
                    });
                    
                    accordion.appendChild(header);
                    accordion.appendChild(body);
                    
                    // Category toggle area click - disable and force close
                    headerToggleArea.addEventListener('click', function(e) {
                        e.stopPropagation();
                        headerToggle.classList.toggle('on');
                        if (headerToggle.classList.contains('on')) {
                            accordion.classList.remove('filter-categoryfilter-accordion--disabled');
                        } else {
                            accordion.classList.add('filter-categoryfilter-accordion--disabled');
                            accordion.classList.remove('filter-categoryfilter-accordion--open');
                        }
                        applyFilters();
                        updateResetCategoriesButton();
                    });
                    
                    // Click anywhere except toggle area expands/collapses
                    header.addEventListener('click', function(e) {
                        if (e.target === headerToggleArea || headerToggleArea.contains(e.target)) return;
                        accordion.classList.toggle('filter-categoryfilter-accordion--open');
                    });
                    
                    container.appendChild(accordion);
                });
            })
            .catch(function(err) {
                console.warn('[Filter] Failed to load categories:', err);
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
