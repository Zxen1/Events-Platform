/* ============================================================================
   FILTER.JS - FILTER SECTION
   ============================================================================
   
   Controls the filter panel on the left side.
   
   CONTAINS:
   - Geocoder search (Google Places)
   - Geolocate button
   - Compass button
   - Reset All Filters button
   - Reset All Categories button
   - Favourites button
   - Sort by dropdown
   - Keywords input
   - Price range inputs (min/max)
   - Date range input + calendar
   - Show Expired Events switch
   - Category filters (accordions with toggles)
   
   DEPENDENCIES:
   - index-new.js (App backbone)
   - components-new.js (CalendarComponent)
   - Google Places API (external)
   
   ============================================================================ */

const FilterModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var filterState = {
        keywords: '',
        priceMin: null,
        priceMax: null,
        dateStart: null,
        dateEnd: null,
        showExpired: false,
        favouritesOnly: false,
        sortBy: 'title-az',
        categories: {},      // { categoryName: { enabled: true, subs: { subName: true } } }
        hasActiveFilters: false
    };
    
    var geocoder = null;
    var calendarInstance = null;
    var panelEl = null;
    var bodyEl = null;


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
        
        bodyEl = panelEl.querySelector('.filter-panel-body');
        
        // Build UI
        buildFilterUI();
        
        // Load categories from server
        loadCategories();
        
        // Bind panel events
        bindPanelEvents();
        
        console.log('[Filter] Filter module initialized');
    }


    /* --------------------------------------------------------------------------
       BUILD UI
       -------------------------------------------------------------------------- */
    
    function buildFilterUI() {
        if (!bodyEl) return;
        
        // Clear existing content
        bodyEl.innerHTML = '';
        
        // 1. Map control row (geocoder, geolocate, compass)
        bodyEl.appendChild(buildMapControlRow());
        
        // 2. Reset All Filters button
        bodyEl.appendChild(buildResetFiltersButton());
        
        // 3. Reset All Categories button
        bodyEl.appendChild(buildResetCategoriesButton());
        
        // 4. Favourites button
        bodyEl.appendChild(buildFavouritesButton());
        
        // 5. Sort menu
        bodyEl.appendChild(buildSortMenu());
        
        // 6. Basics section (keywords, price, date, expired)
        bodyEl.appendChild(buildBasicsSection());
        
        // 7. Categories section (placeholder - populated by loadCategories)
        var categoriesSection = document.createElement('div');
        categoriesSection.className = 'filter-panel-section filter-panel-section--categories';
        categoriesSection.id = 'filterCategories';
        bodyEl.appendChild(categoriesSection);
    }


    /* --------------------------------------------------------------------------
       MAP CONTROL ROW (Geocoder, Geolocate, Compass)
       -------------------------------------------------------------------------- */
    
    function buildMapControlRow() {
        var row = document.createElement('div');
        row.className = 'filter-map-control-row';
        
        // Geocoder container
        var geoContainer = document.createElement('div');
        geoContainer.className = 'filter-google-geocoder';
        
        var geoInput = document.createElement('input');
        geoInput.type = 'text';
        geoInput.className = 'filter-google-geocoder-input';
        geoInput.placeholder = 'Search venues or places';
        geoInput.setAttribute('autocomplete', 'off');
        geoInput.setAttribute('data-lpignore', 'true');
        geoContainer.appendChild(geoInput);
        
        row.appendChild(geoContainer);
        
        // Geolocate button
        var geolocateBtn = document.createElement('button');
        geolocateBtn.type = 'button';
        geolocateBtn.className = 'filter-geolocate-button';
        geolocateBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
        geolocateBtn.onclick = handleGeolocate;
        row.appendChild(geolocateBtn);
        
        // Compass button
        var compassBtn = document.createElement('button');
        compassBtn.type = 'button';
        compassBtn.className = 'filter-compass-button';
        compassBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3,12 12,3 21,12 12,21"/></svg>';
        compassBtn.onclick = handleCompass;
        row.appendChild(compassBtn);
        
        // Initialize Google Places after DOM is ready
        setTimeout(function() {
            initGeocoder(geoInput);
        }, 100);
        
        return row;
    }
    
    function initGeocoder(inputEl) {
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            setTimeout(function() { initGeocoder(inputEl); }, 100);
            return;
        }
        
        var autocomplete = new google.maps.places.Autocomplete(inputEl, {
            fields: ['formatted_address', 'geometry', 'name', 'place_id']
        });
        
        autocomplete.addListener('place_changed', function() {
            var place = autocomplete.getPlace();
            if (!place || !place.geometry || !place.geometry.location) return;
            
            var lat = place.geometry.location.lat();
            var lng = place.geometry.location.lng();
            
            App.emit('filter:placeSelected', {
                lat: lat,
                lng: lng,
                name: place.name,
                address: place.formatted_address
            });
        });
        
        geocoder = {
            input: inputEl,
            autocomplete: autocomplete,
            clear: function() { inputEl.value = ''; }
        };
    }
    
    function handleGeolocate() {
        if (!navigator.geolocation) return;
        
        navigator.geolocation.getCurrentPosition(function(pos) {
            App.emit('filter:geolocate', {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            });
        });
    }
    
    function handleCompass() {
        App.emit('filter:compass');
    }


    /* --------------------------------------------------------------------------
       RESET BUTTONS
       -------------------------------------------------------------------------- */
    
    function buildResetFiltersButton() {
        var box = document.createElement('div');
        box.className = 'filter-reset-box';
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-reset-button';
        btn.id = 'resetFiltersBtn';
        btn.innerHTML = '<svg class="filter-reset-button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Reset All Filters</span>';
        btn.onclick = resetAllFilters;
        
        box.appendChild(btn);
        return box;
    }
    
    function buildResetCategoriesButton() {
        var box = document.createElement('div');
        box.className = 'filter-reset-box';
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-reset-button';
        btn.id = 'resetCategoriesBtn';
        btn.innerHTML = '<svg class="filter-reset-button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Reset All Categories</span>';
        btn.onclick = resetAllCategories;
        
        box.appendChild(btn);
        return box;
    }
    
    function resetAllFilters() {
        filterState.keywords = '';
        filterState.priceMin = null;
        filterState.priceMax = null;
        filterState.dateStart = null;
        filterState.dateEnd = null;
        filterState.showExpired = false;
        
        // Clear inputs
        var keywordInput = document.getElementById('filterKeywords');
        if (keywordInput) keywordInput.value = '';
        
        var priceMinInput = document.getElementById('filterPriceMin');
        if (priceMinInput) priceMinInput.value = '';
        
        var priceMaxInput = document.getElementById('filterPriceMax');
        if (priceMaxInput) priceMaxInput.value = '';
        
        var dateInput = document.getElementById('filterDateRange');
        if (dateInput) dateInput.value = '';
        
        var expiredToggle = document.getElementById('filterExpiredToggle');
        if (expiredToggle) {
            expiredToggle.checked = false;
            var slider = expiredToggle.nextElementSibling;
            if (slider) slider.classList.remove('filter-expired-switch-slider--checked');
        }
        
        // Clear calendar selections
        if (calendarInstance) {
            var selectedDays = calendarInstance.calendar.querySelectorAll('.day.selected');
            selectedDays.forEach(function(day) { day.classList.remove('selected'); });
        }
        
        updateFilterButtons();
        applyFilters();
    }
    
    function resetAllCategories() {
        // Enable all categories and subcategories
        Object.keys(filterState.categories).forEach(function(catName) {
            filterState.categories[catName].enabled = true;
            Object.keys(filterState.categories[catName].subs).forEach(function(subName) {
                filterState.categories[catName].subs[subName] = true;
            });
        });
        
        // Update UI
        var accordions = document.querySelectorAll('.filter-categoryfilter-accordion');
        accordions.forEach(function(acc) {
            acc.classList.remove('filter-categoryfilter-accordion--disabled');
            var headerToggle = acc.querySelector('.filter-categoryfilter-accordion-header-toggle');
            if (headerToggle) headerToggle.classList.add('on');
            
            var optionToggles = acc.querySelectorAll('.filter-categoryfilter-accordion-option-toggle');
            optionToggles.forEach(function(t) { t.classList.add('on'); });
        });
        
        updateFilterButtons();
        applyFilters();
    }


    /* --------------------------------------------------------------------------
       FAVOURITES BUTTON
       -------------------------------------------------------------------------- */
    
    function buildFavouritesButton() {
        var box = document.createElement('div');
        box.className = 'filter-reset-box';
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-reset-button';
        btn.id = 'favouritesBtn';
        btn.innerHTML = '<svg class="filter-reset-button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>Favourites Only</span>';
        btn.onclick = toggleFavourites;
        
        box.appendChild(btn);
        return box;
    }
    
    function toggleFavourites() {
        filterState.favouritesOnly = !filterState.favouritesOnly;
        
        var btn = document.getElementById('favouritesBtn');
        if (btn) {
            if (filterState.favouritesOnly) {
                btn.classList.add('filter-reset-button--active');
            } else {
                btn.classList.remove('filter-reset-button--active');
            }
        }
        
        updateFilterButtons();
        applyFilters();
    }


    /* --------------------------------------------------------------------------
       SORT MENU
       -------------------------------------------------------------------------- */
    
    function buildSortMenu() {
        var field = document.createElement('div');
        field.className = 'filter-sort-field';
        
        var menu = document.createElement('div');
        menu.className = 'filter-sort-menu';
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-sort-menu-button';
        btn.innerHTML = '<span class="filter-sort-menu-button-text">Sort by Title A-Z</span><span class="filter-sort-menu-button-arrow">▼</span>';
        
        var options = document.createElement('div');
        options.className = 'filter-sort-menu-options';
        
        var sortOptions = [
            { value: 'title-az', label: 'Title A-Z' },
            { value: 'title-za', label: 'Title Z-A' },
            { value: 'date-newest', label: 'Date (Newest)' },
            { value: 'date-oldest', label: 'Date (Oldest)' },
            { value: 'price-low', label: 'Price (Low to High)' },
            { value: 'price-high', label: 'Price (High to Low)' },
            { value: 'distance', label: 'Distance' }
        ];
        
        sortOptions.forEach(function(opt) {
            var option = document.createElement('div');
            option.className = 'filter-sort-menu-option';
            if (opt.value === filterState.sortBy) option.classList.add('filter-sort-menu-option--selected');
            option.innerHTML = '<span class="filter-sort-menu-option-text">' + opt.label + '</span>';
            option.dataset.value = opt.value;
            
            option.onclick = function(e) {
                e.stopPropagation();
                filterState.sortBy = opt.value;
                
                // Update button text
                var btnText = btn.querySelector('.filter-sort-menu-button-text');
                if (btnText) btnText.textContent = 'Sort by ' + opt.label;
                
                // Update selected state
                options.querySelectorAll('.filter-sort-menu-option').forEach(function(o) {
                    o.classList.remove('filter-sort-menu-option--selected');
                });
                option.classList.add('filter-sort-menu-option--selected');
                
                // Close menu
                menu.classList.remove('open');
                
                applyFilters();
            };
            
            options.appendChild(option);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            menu.classList.toggle('open');
        };
        
        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) {
                menu.classList.remove('open');
            }
        });
        
        menu.appendChild(btn);
        menu.appendChild(options);
        field.appendChild(menu);
        
        return field;
    }


    /* --------------------------------------------------------------------------
       BASICS SECTION (Keywords, Price, Date, Expired)
       -------------------------------------------------------------------------- */
    
    function buildBasicsSection() {
        var section = document.createElement('div');
        section.className = 'filter-panel-section filter-panel-section--basics';
        
        // Keywords row
        section.appendChild(buildKeywordRow());
        
        // Price row
        section.appendChild(buildPriceRow());
        
        // Date row
        section.appendChild(buildDateRow());
        
        // Expired toggle
        section.appendChild(buildExpiredRow());
        
        return section;
    }
    
    function buildKeywordRow() {
        var row = document.createElement('div');
        row.className = 'filter-keyword-row';
        
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'filter-keyword-input';
        input.id = 'filterKeywords';
        input.placeholder = 'Keywords';
        
        input.oninput = function() {
            filterState.keywords = input.value.trim();
            updateClearButton(clearBtn, filterState.keywords.length > 0);
            applyFilters();
        };
        
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'filter-keyword-clear';
        clearBtn.textContent = '×';
        clearBtn.onclick = function() {
            input.value = '';
            filterState.keywords = '';
            updateClearButton(clearBtn, false);
            applyFilters();
        };
        
        row.appendChild(input);
        row.appendChild(clearBtn);
        
        return row;
    }
    
    function buildPriceRow() {
        var row = document.createElement('div');
        row.className = 'filter-price-row';
        
        var minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'filter-price-input';
        minInput.id = 'filterPriceMin';
        minInput.placeholder = 'Min price';
        
        var separator = document.createElement('span');
        separator.className = 'filter-price-separator';
        separator.textContent = '-';
        
        var maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'filter-price-input';
        maxInput.id = 'filterPriceMax';
        maxInput.placeholder = 'Max price';
        
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'filter-price-clear';
        clearBtn.textContent = '×';
        
        function updatePrice() {
            filterState.priceMin = minInput.value ? parseFloat(minInput.value) : null;
            filterState.priceMax = maxInput.value ? parseFloat(maxInput.value) : null;
            updateClearButton(clearBtn, filterState.priceMin !== null || filterState.priceMax !== null);
            applyFilters();
        }
        
        minInput.oninput = updatePrice;
        maxInput.oninput = updatePrice;
        
        clearBtn.onclick = function() {
            minInput.value = '';
            maxInput.value = '';
            filterState.priceMin = null;
            filterState.priceMax = null;
            updateClearButton(clearBtn, false);
            applyFilters();
        };
        
        row.appendChild(minInput);
        row.appendChild(separator);
        row.appendChild(maxInput);
        row.appendChild(clearBtn);
        
        return row;
    }
    
    function buildDateRow() {
        var row = document.createElement('div');
        row.className = 'filter-daterange-row';
        
        // Input row wrapper
        var inputRow = document.createElement('div');
        inputRow.className = 'filter-daterange-row-inputs';
        
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'filter-daterange-input';
        input.id = 'filterDateRange';
        input.placeholder = 'Date Range';
        input.readOnly = true;
        
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'filter-daterange-clear';
        clearBtn.textContent = '×';
        
        // Calendar container (hidden by default via CSS)
        var calendarContainer = document.createElement('div');
        calendarContainer.className = 'filter-calendar-container';
        
        input.onclick = function() {
            var isVisible = calendarContainer.classList.contains('filter-calendar-container--visible');
            calendarContainer.classList.toggle('filter-calendar-container--visible');
            
            // Build calendar on first open
            if (!calendarInstance && !isVisible) {
                calendarInstance = CalendarComponent.create(calendarContainer, {
                    monthsPast: 1,
                    monthsFuture: 12
                });
                
                // Add range selection behavior
                calendarInstance.calendar.addEventListener('click', function(e) {
                    var day = e.target;
                    if (!day.classList.contains('day') || day.classList.contains('empty')) return;
                    
                    handleDateRangeClick(day, input, clearBtn);
                });
            }
        };
        
        clearBtn.onclick = function() {
            filterState.dateStart = null;
            filterState.dateEnd = null;
            input.value = '';
            updateClearButton(clearBtn, false);
            
            // Clear calendar selections
            if (calendarInstance) {
                calendarInstance.calendar.querySelectorAll('.day.selected, .day.in-range').forEach(function(d) {
                    d.classList.remove('selected', 'in-range', 'range-start', 'range-end');
                });
            }
            
            applyFilters();
        };
        
        inputRow.appendChild(input);
        inputRow.appendChild(clearBtn);
        row.appendChild(inputRow);
        row.appendChild(calendarContainer);
        
        return row;
    }
    
    function handleDateRangeClick(dayEl, input, clearBtn) {
        var date = dayEl.dataset.iso;
        
        // If no start date or both dates set, start new range
        if (!filterState.dateStart || (filterState.dateStart && filterState.dateEnd)) {
            // Clear previous selection
            calendarInstance.calendar.querySelectorAll('.day.selected, .day.in-range').forEach(function(d) {
                d.classList.remove('selected', 'in-range', 'range-start', 'range-end');
            });
            
            filterState.dateStart = date;
            filterState.dateEnd = null;
            dayEl.classList.add('selected', 'range-start');
            input.value = formatDate(date) + ' - ...';
        } else {
            // Set end date
            if (date < filterState.dateStart) {
                // Clicked before start - swap
                filterState.dateEnd = filterState.dateStart;
                filterState.dateStart = date;
            } else {
                filterState.dateEnd = date;
            }
            
            // Highlight range
            highlightDateRange();
            input.value = formatDate(filterState.dateStart) + ' - ' + formatDate(filterState.dateEnd);
        }
        
        updateClearButton(clearBtn, filterState.dateStart !== null);
        applyFilters();
    }
    
    function highlightDateRange() {
        if (!calendarInstance || !filterState.dateStart || !filterState.dateEnd) return;
        
        var days = calendarInstance.calendar.querySelectorAll('.day[data-iso]');
        days.forEach(function(day) {
            var date = day.dataset.iso;
            day.classList.remove('selected', 'in-range', 'range-start', 'range-end');
            
            if (date === filterState.dateStart) {
                day.classList.add('selected', 'range-start');
            } else if (date === filterState.dateEnd) {
                day.classList.add('selected', 'range-end');
            } else if (date > filterState.dateStart && date < filterState.dateEnd) {
                day.classList.add('in-range');
            }
        });
    }
    
    function formatDate(isoDate) {
        if (!isoDate) return '';
        var parts = isoDate.split('-');
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    
    function buildExpiredRow() {
        var row = document.createElement('div');
        row.className = 'filter-expired-row';
        
        var text = document.createElement('span');
        text.className = 'filter-expired-text';
        text.textContent = 'Show Expired Events';
        
        var switchLabel = document.createElement('label');
        switchLabel.className = 'filter-expired-switch';
        
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'filter-expired-switch-input';
        checkbox.id = 'filterExpiredToggle';
        
        var slider = document.createElement('span');
        slider.className = 'filter-expired-switch-slider';
        
        checkbox.onchange = function() {
            filterState.showExpired = checkbox.checked;
            if (checkbox.checked) {
                slider.classList.add('filter-expired-switch-slider--checked');
            } else {
                slider.classList.remove('filter-expired-switch-slider--checked');
            }
            updateFilterButtons();
            applyFilters();
        };
        
        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);
        
        row.appendChild(text);
        row.appendChild(switchLabel);
        
        return row;
    }


    /* --------------------------------------------------------------------------
       CATEGORY FILTERS
       -------------------------------------------------------------------------- */
    
    function loadCategories() {
        App.api('get-form')
            .then(function(res) {
                if (!res.success || !res.snapshot) return;
                
                var categories = res.snapshot.categories || [];
                var categoryIconPaths = res.snapshot.categoryIconPaths || {};
                var subcategoryIconPaths = res.snapshot.subcategoryIconPaths || {};
                
                buildCategoryFilters(categories, categoryIconPaths, subcategoryIconPaths);
            })
            .catch(function(err) {
                console.warn('[Filter] Failed to load categories:', err);
            });
    }
    
    function buildCategoryFilters(categories, categoryIconPaths, subcategoryIconPaths) {
        var container = document.getElementById('filterCategories');
        if (!container) return;
        
        container.innerHTML = '';
        
        categories.forEach(function(cat) {
            // Initialize state
            filterState.categories[cat.name] = {
                enabled: true,
                subs: {}
            };
            
            var subs = cat.subs || [];
            subs.forEach(function(subName) {
                filterState.categories[cat.name].subs[subName] = true;
            });
            
            // Build accordion
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
                
                // Click toggles subcategory
                option.addEventListener('click', function() {
                    optToggle.classList.toggle('on');
                    filterState.categories[cat.name].subs[subName] = optToggle.classList.contains('on');
                    updateFilterButtons();
                    applyFilters();
                });
                
                body.appendChild(option);
            });
            
            accordion.appendChild(header);
            accordion.appendChild(body);
            
            // Category toggle click - enable/disable entire category
            headerToggleArea.addEventListener('click', function(e) {
                e.stopPropagation();
                headerToggle.classList.toggle('on');
                var isEnabled = headerToggle.classList.contains('on');
                filterState.categories[cat.name].enabled = isEnabled;
                
                if (isEnabled) {
                    accordion.classList.remove('filter-categoryfilter-accordion--disabled');
                } else {
                    accordion.classList.add('filter-categoryfilter-accordion--disabled');
                    accordion.classList.remove('filter-categoryfilter-accordion--open');
                }
                
                updateFilterButtons();
                applyFilters();
            });
            
            // Header click (except toggle) expands/collapses
            header.addEventListener('click', function(e) {
                if (e.target === headerToggleArea || headerToggleArea.contains(e.target)) return;
                if (accordion.classList.contains('filter-categoryfilter-accordion--disabled')) return;
                accordion.classList.toggle('filter-categoryfilter-accordion--open');
            });
            
            container.appendChild(accordion);
        });
    }


    /* --------------------------------------------------------------------------
       FILTER APPLICATION
       -------------------------------------------------------------------------- */
    
    function applyFilters() {
        updateHasActiveFilters();
        
        App.emit('filter:changed', {
            keywords: filterState.keywords,
            priceMin: filterState.priceMin,
            priceMax: filterState.priceMax,
            dateStart: filterState.dateStart,
            dateEnd: filterState.dateEnd,
            showExpired: filterState.showExpired,
            favouritesOnly: filterState.favouritesOnly,
            sortBy: filterState.sortBy,
            categories: filterState.categories
        });
    }
    
    function updateHasActiveFilters() {
        var hasFilters = false;
        
        if (filterState.keywords) hasFilters = true;
        if (filterState.priceMin !== null || filterState.priceMax !== null) hasFilters = true;
        if (filterState.dateStart || filterState.dateEnd) hasFilters = true;
        if (filterState.showExpired) hasFilters = true;
        if (filterState.favouritesOnly) hasFilters = true;
        
        filterState.hasActiveFilters = hasFilters;
    }
    
    function updateFilterButtons() {
        updateHasActiveFilters();
        
        // Reset Filters button
        var resetFiltersBtn = document.getElementById('resetFiltersBtn');
        if (resetFiltersBtn) {
            if (filterState.hasActiveFilters) {
                resetFiltersBtn.classList.add('filter-reset-button--active');
            } else {
                resetFiltersBtn.classList.remove('filter-reset-button--active');
            }
        }
        
        // Reset Categories button - active if any category/subcategory is disabled
        var resetCategoriesBtn = document.getElementById('resetCategoriesBtn');
        if (resetCategoriesBtn) {
            var hasCategoryChanges = false;
            Object.keys(filterState.categories).forEach(function(catName) {
                if (!filterState.categories[catName].enabled) hasCategoryChanges = true;
                Object.keys(filterState.categories[catName].subs).forEach(function(subName) {
                    if (!filterState.categories[catName].subs[subName]) hasCategoryChanges = true;
                });
            });
            
            if (hasCategoryChanges) {
                resetCategoriesBtn.classList.add('filter-reset-button--active');
            } else {
                resetCategoriesBtn.classList.remove('filter-reset-button--active');
            }
        }
    }
    
    function updateClearButton(btn, isActive) {
        if (isActive) {
            btn.classList.add('filter-keyword-clear--active');
        } else {
            btn.classList.remove('filter-keyword-clear--active');
        }
    }


    /* --------------------------------------------------------------------------
       PANEL EVENTS
       -------------------------------------------------------------------------- */
    
    function bindPanelEvents() {
        // Listen for panel open/close from header
        App.on('panel:toggle', function(data) {
            if (data.panel === 'filter') {
                togglePanel(data.show);
            }
        });
    }
    
    function togglePanel(show) {
        if (!panelEl) return;
        
        var content = panelEl.querySelector('.filter-panel-content');
        if (!content) return;
        
        if (show) {
            panelEl.classList.add('filter-panel--show');
            content.classList.add('filter-panel-content--visible');
            content.classList.remove('filter-panel-content--hidden');
        } else {
            content.classList.remove('filter-panel-content--visible');
            content.classList.add('filter-panel-content--hidden');
            setTimeout(function() {
                panelEl.classList.remove('filter-panel--show');
            }, 300);
        }
    }


    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        
        // State
        getState: function() { return filterState; },
        
        // Panel
        togglePanel: togglePanel,
        
        // Filters
        applyFilters: applyFilters,
        resetAllFilters: resetAllFilters,
        resetAllCategories: resetAllCategories,
        
        // Geocoder
        clearGeocoder: function() {
            if (geocoder && geocoder.clear) geocoder.clear();
        }
    };

})();

// Register module with App
App.registerModule('filter', FilterModule);
