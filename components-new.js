/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   STRUCTURE:
   0. ICONS               - SVG icon library
   0b. CLEAR BUTTON       - Reusable X/clear button
   1. FIELDSETS           - Form field types
   2. CALENDAR            - Horizontal scrolling date picker
   3. CURRENCY            - Currency selector (compact + full)
   4. PHONE PREFIX        - Phone prefix selector
   5. ICON PICKER         - Category icon picker
   6. SYSTEM IMAGE PICKER - System image picker
   7. MAP CONTROL ROW     - Geocoder + Geolocate + Compass
   8. CHECKOUT OPTIONS    - Radio card selector for checkout tiers
   
   ============================================================================ */

console.log('[components.js] Components loaded');


/* ============================================================================
   SECTION 0: ICONS
   SVG icon library for consistent icons across the site
   ============================================================================ */

const Icons = {
    clear: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    
    geolocate: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    
    compass: '<svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12,2 15,10 12,8 9,10" fill="#e74c3c"/><polygon points="12,22 9,14 12,16 15,14" fill="currentColor"/></svg>',
    
    search: '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14.5 14.5L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    
    chevronDown: '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
};


/* ============================================================================
   SECTION 0b: CLEAR BUTTON
   Reusable X/clear button component
   ============================================================================ */

const ClearButtonComponent = (function(){
    
    /**
     * Create a new clear button element
     * @param {Object} options - Configuration options
     * @param {string} options.className - Additional CSS class(es) to add
     * @param {string} options.ariaLabel - Accessible label (default: 'Clear')
     * @param {Function} options.onClick - Click handler
     * @returns {HTMLButtonElement} The clear button element
     */
    function create(options) {
        options = options || {};
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clear-button';
        if (options.className) {
            btn.className += ' ' + options.className;
        }
        btn.setAttribute('aria-label', options.ariaLabel || 'Clear');
        btn.innerHTML = Icons.clear;
        
        if (typeof options.onClick === 'function') {
            btn.addEventListener('click', options.onClick);
        }
        
        return btn;
    }
    
    /**
     * Inject SVG icon into existing buttons that don't have one
     * @param {string} selector - CSS selector for buttons to upgrade
     */
    function upgradeAll(selector) {
        var buttons = document.querySelectorAll(selector);
        buttons.forEach(function(btn) {
            // Add SVG if button doesn't already have one
            if (!btn.querySelector('svg')) {
                btn.innerHTML = Icons.clear;
            }
        });
    }
    
    return {
        create: create,
        upgradeAll: upgradeAll
    };
})();


/* ============================================================================
   SECTION 1: FIELDSETS
   Source: fieldset-test.html
   ============================================================================ */

const FieldsetComponent = (function(){
    var picklist = {};
    
    function initGooglePlaces(inputElement, type, latInput, lngInput, statusElement) {
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            console.warn('Google Places API not loaded');
            if (statusElement) {
                statusElement.textContent = 'Location search unavailable';
                statusElement.className = 'fieldset-location-status error';
            }
            return null;
        }
        
        // Use new PlaceAutocompleteElement API
        if (google.maps.places.PlaceAutocompleteElement) {
            var placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
                componentRestrictions: { country: [] }
            });
            
            // Copy placeholder from original input
            if (inputElement.placeholder) {
                placeAutocomplete.placeholder = inputElement.placeholder;
            }
            
            // Style via JavaScript (shadow DOM doesn't accept external CSS)
            placeAutocomplete.style.width = '100%';
            placeAutocomplete.style.height = '36px';
            placeAutocomplete.style.backgroundColor = '#333';
            placeAutocomplete.style.border = '1px solid #444';
            placeAutocomplete.style.borderRadius = '6px';
            placeAutocomplete.style.colorScheme = 'dark';
            placeAutocomplete.style.setProperty('--gmpx-color-surface', '#333');
            placeAutocomplete.style.setProperty('--gmpx-color-on-surface', '#ffffff');
            placeAutocomplete.style.setProperty('--gmpx-color-on-surface-variant', '#666666');
            placeAutocomplete.style.setProperty('--gmpx-color-primary', '#3b82f5');
            placeAutocomplete.style.setProperty('--gmpx-font-family-base', 'inherit');
            placeAutocomplete.style.setProperty('--gmpx-font-size-base', '13px');
            
            // Replace the original input with the new element
            inputElement.parentNode.replaceChild(placeAutocomplete, inputElement);
            
            placeAutocomplete.addEventListener('gmp-placeselect', async function(event) {
                var place = event.place;
                if (!place) return;
                
                await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
                
                if (!place.location) {
                if (statusElement) {
                    statusElement.textContent = 'No location data for this place';
                    statusElement.className = 'fieldset-location-status error';
                }
                return;
            }
            
                var lat = place.location.lat();
                var lng = place.location.lng();
            
            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;
            
            if (statusElement) {
                statusElement.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                statusElement.className = 'fieldset-location-status success';
            }
        });
        
            return placeAutocomplete;
        }
        
        // PlaceAutocompleteElement not available
        console.warn('PlaceAutocompleteElement not available');
        if (statusElement) {
            statusElement.textContent = 'Location search unavailable';
            statusElement.className = 'fieldset-location-status error';
        }
        return null;
    }
    
    function buildLabel(name, tooltip, required) {
        var label = document.createElement('div');
        label.className = 'fieldset-label';
        var html = '<span class="fieldset-label-text">' + name + '</span>';
        if (required !== false) {
            html += '<span class="fieldset-label-required">*</span>';
        }
        label.innerHTML = html;
        
        if (tooltip) {
            var tip = document.createElement('span');
            tip.className = 'fieldset-label-tooltip';
            tip.textContent = 'i';
            tip.setAttribute('data-tooltip', tooltip);
            label.appendChild(tip);
        }
        return label;
    }
    
    function addInputValidation(input, minLength, maxLength, validationFn) {
        var charCount = document.createElement('div');
        charCount.className = 'fieldset-char-count';
        charCount.style.display = 'none';
        
        var touched = false;
        
        function updateCharCount() {
            var remaining = maxLength - input.value.length;
            if (remaining <= 5 && input.value.length > 0) {
                charCount.style.display = 'block';
                charCount.textContent = remaining + ' characters remaining';
                charCount.className = remaining <= 0 ? 'fieldset-char-count fieldset-char-count--danger' : 'fieldset-char-count fieldset-char-count--warning';
            } else {
                charCount.style.display = 'none';
            }
        }
        
        function validate() {
            if (!touched) return;
            var isValid = true;
            var len = input.value.length;
            
            if (len > 0 && minLength > 0 && len < minLength) isValid = false;
            if (len > maxLength) isValid = false;
            if (len > 0 && validationFn && !validationFn(input.value)) isValid = false;
            
            input.classList.toggle('fieldset-input--invalid', !isValid);
        }
        
        input.setAttribute('maxlength', maxLength);
        input.addEventListener('input', function() { updateCharCount(); if (touched) validate(); });
        input.addEventListener('blur', function() { touched = true; validate(); });
        input.addEventListener('focus', updateCharCount);
        
        return { charCount: charCount };
    }
    
    function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
    function isValidUrl(url) { return /^(https?:\/\/)?.+\..+/.test(url); }
    
    function makePhoneDigitsOnly(input) {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }
    
    function autoUrlProtocol(input) {
        input.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val && !val.match(/^https?:\/\//i)) {
                this.value = 'https://' + val;
            }
        });
    }
    
    function setPicklist(data) {
        picklist = data || {};
        // Also set data in Currency and PhonePrefix components
        if (data.currency && typeof CurrencyComponent !== 'undefined') {
            CurrencyComponent.setData(data.currency);
        }
        if (data['phone-prefix'] && typeof PhonePrefixComponent !== 'undefined') {
            PhonePrefixComponent.setData(data['phone-prefix']);
        }
    }
    
    // Build a currency menu using CurrencyComponent
    // options: { container, onSelect }
    function buildCurrencyMenu(options) {
        if (typeof CurrencyComponent === 'undefined') {
            console.error('CurrencyComponent not loaded');
            return document.createElement('div');
        }
        return CurrencyComponent.buildCompactMenu(options);
    }
    
    // Build a phone prefix menu using PhonePrefixComponent
    // options: { container, onSelect }
    function buildPhonePrefixMenu(options) {
        if (typeof PhonePrefixComponent === 'undefined') {
            console.error('PhonePrefixComponent not loaded');
            return document.createElement('div');
        }
        return PhonePrefixComponent.buildCompactMenu(options);
    }
    
    // Build a complete phone field (prefix dropdown + input)
    // options: { container, placeholder, minLength, maxLength, onPrefixSelect }
    function buildPhoneField(options) {
        options = options || {};
        
        var row = document.createElement('div');
        row.className = 'fieldset-row';
        
        // Phone prefix menu from PhonePrefixComponent
        var prefixMenu = buildPhonePrefixMenu({
            container: options.container,
            onSelect: options.onPrefixSelect || function() {}
        });
        row.appendChild(prefixMenu);
        
        // Phone number input
        var phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.className = 'fieldset-input';
        phoneInput.placeholder = options.placeholder || '';
        makePhoneDigitsOnly(phoneInput);
        
        var validation = addInputValidation(phoneInput, options.minLength || 0, options.maxLength || 20, null);
        row.appendChild(phoneInput);
        
        return {
            row: row,
            prefixMenu: prefixMenu,
            input: phoneInput,
            charCount: validation.charCount
        };
    }
    
    return {
        initGooglePlaces: initGooglePlaces,
        buildLabel: buildLabel,
        addInputValidation: addInputValidation,
        isValidEmail: isValidEmail,
        isValidUrl: isValidUrl,
        makePhoneDigitsOnly: makePhoneDigitsOnly,
        autoUrlProtocol: autoUrlProtocol,
        setPicklist: setPicklist,
        getPicklist: function() { return picklist; },
        buildCurrencyMenu: buildCurrencyMenu,
        buildPhonePrefixMenu: buildPhonePrefixMenu,
        buildPhoneField: buildPhoneField
    };
})();


/* ============================================================================
   SECTION 2: CALENDAR
   Source: calendar-test.html
   ============================================================================ */

const CalendarComponent = (function(){
    
    function toISODate(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    
    function create(containerEl, options) {
        options = options || {};
        var monthsPast = typeof options.monthsPast === 'number' ? options.monthsPast : 12;
        var monthsFuture = typeof options.monthsFuture === 'number' ? options.monthsFuture : 24;
        var allowPast = options.allowPast || false;
        var onSelect = options.onSelect || null;
        var showActions = options.showActions || false;
        
        var today = new Date();
        today.setHours(0,0,0,0);
        var todayIso = toISODate(today);
        
        var minDate = new Date(today.getFullYear(), today.getMonth() - monthsPast, 1);
        var maxDate = new Date(today.getFullYear(), today.getMonth() + monthsFuture, 1);
        
        var todayMonthEl = null;
        var todayMonthIndex = 0;
        var totalMonths = 0;
        var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        
        // Date selection state
        var selectedStart = null;
        var selectedEnd = null;
        
        var scroll = document.createElement('div');
        scroll.className = 'calendar-scroll';
        
        var calendar = document.createElement('div');
        calendar.className = 'calendar-body';
        
        var marker = document.createElement('div');
        marker.className = 'calendar-today-marker';
        
        var current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        var monthIndex = 0;
        while(current <= maxDate) {
            var monthEl = document.createElement('div');
            monthEl.className = 'calendar-month';
            
            var header = document.createElement('div');
            header.className = 'calendar-header';
            header.textContent = current.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            monthEl.appendChild(header);
            
            var grid = document.createElement('div');
            grid.className = 'calendar-grid';
            
            weekdays.forEach(function(wd) {
                var w = document.createElement('div');
                w.className = 'calendar-weekday';
                w.textContent = wd;
                grid.appendChild(w);
            });
            
            var firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
            var startDow = firstDay.getDay();
            var daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
            
            for(var i = 0; i < 42; i++) {
                var cell = document.createElement('div');
                cell.className = 'calendar-day';
                var dayNum = i - startDow + 1;
                
                if(i < startDow || dayNum > daysInMonth) {
                    cell.classList.add('empty');
                } else {
                    cell.textContent = dayNum;
                    var dateObj = new Date(current.getFullYear(), current.getMonth(), dayNum);
                    dateObj.setHours(0,0,0,0);
                    var iso = toISODate(dateObj);
                    cell.dataset.iso = iso;
                    
                    if(dateObj < today) {
                        cell.classList.add('past');
                    } else {
                        cell.classList.add('future');
                    }
                    
                    // Add click handler if future OR if allowPast is true
                    if (dateObj >= today || allowPast) {
                        cell.addEventListener('click', function() {
                            var clickedDate = this.dataset.iso;
                            
                            if (!selectedStart || (selectedStart && selectedEnd)) {
                                // Start new selection
                                selectedStart = clickedDate;
                                selectedEnd = null;
                                updateSelection(calendar);
                            } else {
                                // Complete selection
                                if (clickedDate < selectedStart) {
                                    selectedEnd = selectedStart;
                                    selectedStart = clickedDate;
                                } else {
                                    selectedEnd = clickedDate;
                                }
                                updateSelection(calendar);
                                
                                if (!showActions && onSelect) {
                                    onSelect(selectedStart, selectedEnd);
                                }
                            }
                        });
                    }
                    
                    if(iso === todayIso) {
                        cell.classList.add('today');
                        todayMonthEl = monthEl;
                        todayMonthIndex = monthIndex;
                    }
                }
                grid.appendChild(cell);
            }
            
            monthEl.appendChild(grid);
            calendar.appendChild(monthEl);
            current.setMonth(current.getMonth() + 1);
            monthIndex++;
        }
        totalMonths = monthIndex;
        
        scroll.appendChild(calendar);
        
        // Wrap scroll and marker so marker stays at bottom of scroll area
        var scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'calendar-scroll-wrapper';
        scrollWrapper.appendChild(scroll);
        scrollWrapper.appendChild(marker);
        containerEl.appendChild(scrollWrapper);

        // Add action buttons if showActions is true
        var actionsEl = null;
        if (showActions) {
            actionsEl = document.createElement('div');
            actionsEl.className = 'calendar-actions';
            
            var cancelBtn = document.createElement('button');
            cancelBtn.className = 'calendar-cancel';
            cancelBtn.type = 'button';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', function() {
                selectedStart = null;
                selectedEnd = null;
                updateSelection(calendar);
                if (onSelect) onSelect(null, null);
            });
            
            var okBtn = document.createElement('button');
            okBtn.className = 'calendar-ok';
            okBtn.type = 'button';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', function() {
                if (onSelect) onSelect(selectedStart, selectedEnd);
            });
            
            actionsEl.appendChild(cancelBtn);
            actionsEl.appendChild(okBtn);
            containerEl.appendChild(actionsEl);
        }
        
        // Scroll to today's month initially (defer to allow layout)
        if (todayMonthEl) {
            requestAnimationFrame(function() {
                scroll.scrollLeft = todayMonthEl.offsetLeft;
            });
        }
        
        // Position the red dot marker
        // Formula: (todayMonthIndex + 0.5) / totalMonths gives the fraction
        // e.g., month 13 of 37 = (13 + 0.5) / 37 = 0.365 (about 1/3 along)
        function positionMarker() {
            var width = scrollWrapper.clientWidth;
            if (width > 0 && totalMonths > 0) {
                var markerFraction = (todayMonthIndex + 0.5) / totalMonths;
                var markerPos = markerFraction * (width - 8);
                marker.style.left = markerPos + 'px';
            }
        }
        
        // Initial position
        positionMarker();
        
        // Recalculate marker position when container resizes (e.g., becomes visible)
        if (typeof ResizeObserver !== 'undefined') {
            var resizeObserver = new ResizeObserver(function() {
                positionMarker();
            });
            resizeObserver.observe(scrollWrapper);
        }
        
        // Click marker to scroll to today
        marker.addEventListener('click', function() {
            if (todayMonthEl) {
                scroll.scrollTo({ left: todayMonthEl.offsetLeft, behavior: 'smooth' });
            }
        });
        
        // Mouse wheel horizontal scrolling
        scroll.addEventListener('wheel', function(e) {
            var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            if (delta !== 0) {
                scroll.scrollLeft += delta;
            e.preventDefault();
            }
        }, {passive: false});
        
        // Update visual selection state
        function updateSelection(calendarEl) {
            var days = calendarEl.querySelectorAll('.calendar-day[data-iso]');
            days.forEach(function(d) {
                d.classList.remove('selected', 'range-start', 'range-end', 'in-range');
                var iso = d.dataset.iso;
                
                if (selectedStart && iso === selectedStart) {
                    d.classList.add('selected', 'range-start');
                }
                if (selectedEnd && iso === selectedEnd) {
                    d.classList.add('selected', 'range-end');
                }
                if (selectedStart && selectedEnd && iso > selectedStart && iso < selectedEnd) {
                    d.classList.add('in-range');
                }
            });
        }
        
        return {
            scroll: scroll,
            calendar: calendar,
            marker: marker,
            scrollToToday: function() {
                if (todayMonthEl) {
                    scroll.scrollTo({ left: todayMonthEl.offsetLeft, behavior: 'smooth' });
                }
            },
            positionMarker: positionMarker,
            clearSelection: function() {
                selectedStart = null;
                selectedEnd = null;
                updateSelection(calendar);
            },
            getSelection: function() {
                return { start: selectedStart, end: selectedEnd };
            }
        };
    }
    
    return {
        create: create,
        toISODate: toISODate
    };
})();


/* ============================================================================
   SECTION 3: CURRENCY
   Source: test-currency-menu.html
   ============================================================================ */

const CurrencyComponent = (function(){
    
    // Data loaded from database - no hardcoded fallback
    var currencyData = [];
    var dataLoaded = false;
    
    function parseCurrencyValue(optionValue) {
        if (!optionValue || typeof optionValue !== 'string') return { countryCode: null, currencyCode: optionValue || '' };
        var parts = optionValue.trim().split(' ');
        if (parts.length >= 2) {
            return { countryCode: parts[0].toLowerCase(), currencyCode: parts.slice(1).join(' ') };
        }
        return { countryCode: null, currencyCode: optionValue };
    }
    
    function getData() {
        return currencyData;
    }
    
    function setData(data) {
        currencyData = data || [];
        dataLoaded = true;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Load currency data from database via gateway
    function loadFromDatabase() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.picklist && res.picklist.currency) {
                    currencyData = res.picklist.currency;
                    dataLoaded = true;
                }
                return currencyData;
            });
    }
    
    // Build a compact currency menu (100px, code only)
    // Returns the complete menu element
    function buildCompactMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null; // For closing other menus
        
        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="assets/flags/us.svg" alt=""><span class="fieldset-menu-button-text">USD</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        
        var currencies = currencyData;
        currencies.forEach(function(item) {
            var countryCode = item.value.substring(0, 2);
            var currencyCode = item.value.substring(3);
            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + countryCode + '.svg" alt=""><span class="fieldset-menu-option-text">' + currencyCode + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnText.textContent = currencyCode;
                menu.classList.remove('open');
                onSelect(currencyCode, item.label, countryCode);
            };
            opts.appendChild(op);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            // Close other open menus in container
            if (containerEl) {
                containerEl.querySelectorAll('.fieldset-menu.open').forEach(function(el) {
                    if (el !== menu) el.classList.remove('open');
                });
            }
            menu.classList.toggle('open');
        };
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) {
                menu.classList.remove('open');
            }
        });
        
        return menu;
    }
    
    // Build a full currency menu (wide, shows code + label)
    // Returns the complete menu element
    function buildFullMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null;
        
        var menu = document.createElement('div');
        menu.className = 'admin-menu admin-currency-menu';
        menu.innerHTML = '<div class="admin-menu-button"><img class="admin-menu-button-image" src="assets/flags/us.svg" alt=""><span class="admin-menu-button-text">USD - US Dollar</span><span class="admin-menu-button-arrow">▼</span></div><div class="admin-menu-options"></div>';
        
        var btn = menu.querySelector('.admin-menu-button');
        var opts = menu.querySelector('.admin-menu-options');
        var btnImg = menu.querySelector('.admin-menu-button-image');
        var btnText = menu.querySelector('.admin-menu-button-text');
        
        var currencies = currencyData;
        currencies.forEach(function(item) {
            var countryCode = item.value.substring(0, 2);
            var currencyCode = item.value.substring(3);
            var op = document.createElement('div');
            op.className = 'admin-menu-option';
            op.innerHTML = '<img class="admin-menu-option-image" src="assets/flags/' + countryCode + '.svg" alt=""><span class="admin-menu-option-text">' + currencyCode + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnText.textContent = currencyCode + ' - ' + item.label;
                menu.classList.remove('open');
                onSelect(currencyCode, item.label, countryCode);
            };
            opts.appendChild(op);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            if (containerEl) {
                containerEl.querySelectorAll('.admin-menu.open').forEach(function(el) {
                    if (el !== menu) el.classList.remove('open');
                });
            }
            menu.classList.toggle('open');
        };
        
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) {
                menu.classList.remove('open');
            }
        });
        
        return menu;
    }
    
    return {
        getData: getData,
        setData: setData,
        isLoaded: isLoaded,
        loadFromDatabase: loadFromDatabase,
        buildCompactMenu: buildCompactMenu,
        buildFullMenu: buildFullMenu,
        parseCurrencyValue: parseCurrencyValue
    };
})();


/* ============================================================================
   SECTION 4: PHONE PREFIX
   Source: test-prefix-menu.html
   ============================================================================ */

const PhonePrefixComponent = (function(){
    
    // Data loaded from database - no hardcoded fallback
    var prefixData = [];
    var dataLoaded = false;
    
    function parsePrefixValue(optionValue) {
        if (!optionValue || typeof optionValue !== 'string') return { countryCode: null, prefix: optionValue || '' };
        var parts = optionValue.trim().split(' ');
        if (parts.length >= 2) {
            return { countryCode: parts[0].toLowerCase(), prefix: parts.slice(1).join(' ') };
        }
        return { countryCode: null, prefix: optionValue };
    }
    
    function getData() {
        return prefixData;
    }
    
    function setData(data) {
        prefixData = data || [];
        dataLoaded = true;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Load phone prefix data from database via gateway
    function loadFromDatabase() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.picklist && res.picklist['phone-prefix']) {
                    prefixData = res.picklist['phone-prefix'];
                    dataLoaded = true;
                }
                return prefixData;
            });
    }
    
    // Build a compact phone prefix menu (100px, prefix only)
    // Returns the complete menu element
    function buildCompactMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null; // For closing other menus
        
        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="" alt=""><span class="fieldset-menu-button-text">+...</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        
        var prefixes = prefixData;
        
        // Set default to first item if available
        if (prefixes.length > 0) {
            var firstCountry = prefixes[0].value.substring(0, 2);
            var firstPrefix = prefixes[0].value.substring(3);
            btnImg.src = 'assets/flags/' + firstCountry + '.svg';
            btnText.textContent = firstPrefix;
        }
        
        prefixes.forEach(function(item) {
            var countryCode = item.value.substring(0, 2);
            var prefix = item.value.substring(3);
                    var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + countryCode + '.svg" alt=""><span class="fieldset-menu-option-text">' + prefix + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnText.textContent = prefix;
                menu.classList.remove('open');
                onSelect(prefix, item.label, countryCode);
                    };
                    opts.appendChild(op);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            // Close other open menus in container
            if (containerEl) {
                containerEl.querySelectorAll('.fieldset-menu.open').forEach(function(el) {
                    if (el !== menu) el.classList.remove('open');
                });
            }
            menu.classList.toggle('open');
        };
        
        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) {
                menu.classList.remove('open');
            }
        });
        
        return menu;
    }
    
    return {
        getData: getData,
        setData: setData,
        isLoaded: isLoaded,
        loadFromDatabase: loadFromDatabase,
        buildCompactMenu: buildCompactMenu,
        parsePrefixValue: parsePrefixValue
    };
})();


/* ============================================================================
   SECTION 5: ICON PICKER
   Uses icon folder path from admin settings (e.g. assets/category-icons)
   ============================================================================ */

const IconPickerComponent = (function(){
    
    var iconFolder = null;
    var icons = [];
    var dataLoaded = false;
    
    function getIconFolder() {
        return iconFolder;
    }
    
    function setIconFolder(folder) {
        iconFolder = folder;
    }
    
    function getIcons() {
        return icons;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Load icon folder path from admin settings
    function loadFolderFromSettings() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.settings && res.settings.icon_folder) {
                    iconFolder = res.settings.icon_folder;
                }
                return iconFolder;
            });
    }
    
    // Load icons list from folder
    function loadIconsFromFolder(folderPath) {
        folderPath = folderPath || iconFolder;
        if (!folderPath) return Promise.resolve([]);
        
        return fetch('/gateway.php?action=list-icons&folder=' + encodeURIComponent(folderPath))
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success && Array.isArray(res.icons)) {
                    var iconList = res.icons.map(function(icon) {
                        return folderPath + '/' + icon;
                    });
                    icons = iconList;
                    dataLoaded = true;
                    return iconList;
                }
                return [];
            })
            .catch(function(err) {
                console.warn('Failed to load icons from folder:', err);
                return [];
            });
    }
    
    // Build icon picker popup
    // options: { onSelect, label, currentIcon }
    function buildPicker(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var label = options.label || 'Select Icon';
        var currentIcon = options.currentIcon || null;
        
        var picker = document.createElement('div');
        picker.className = 'iconpicker-container';
        
        // Preview button
        var button = document.createElement('button');
        button.className = 'iconpicker-button';
        button.type = 'button';
        
        var preview = document.createElement('img');
        preview.className = 'iconpicker-button-preview';
        preview.src = currentIcon || '';
        preview.alt = '';
        if (!currentIcon) preview.style.display = 'none';
        
        var placeholder = document.createElement('span');
        placeholder.className = 'iconpicker-button-placeholder';
        placeholder.textContent = '+';
        if (currentIcon) placeholder.style.display = 'none';
        
        button.appendChild(preview);
        button.appendChild(placeholder);
        picker.appendChild(button);
        
        // Popup
        var popup = document.createElement('div');
        popup.className = 'iconpicker-popup';
        popup.style.display = 'none';
        
        var popupHeader = document.createElement('div');
        popupHeader.className = 'iconpicker-popup-header';
        popupHeader.textContent = label;
        popup.appendChild(popupHeader);
        
        var grid = document.createElement('div');
        grid.className = 'iconpicker-grid';
        popup.appendChild(grid);
        
        picker.appendChild(popup);
        
        // Toggle popup
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = popup.style.display !== 'none';
            if (isOpen) {
                popup.style.display = 'none';
            } else {
                // Load and show icons
                loadIconsFromFolder().then(function(iconList) {
                    grid.innerHTML = '';
                    if (iconList.length === 0) {
                        var msg = document.createElement('div');
                        msg.className = 'iconpicker-error';
                        msg.innerHTML = 'No icons found.<br>Please set icon folder in Admin Settings.';
                        grid.appendChild(msg);
                    } else {
                        iconList.forEach(function(iconPath) {
                            var cell = document.createElement('button');
                            cell.className = 'iconpicker-cell';
                            cell.type = 'button';
                            var img = document.createElement('img');
                            img.src = iconPath;
                            img.alt = '';
                            cell.appendChild(img);
                            
                            if (iconPath === currentIcon) {
                                cell.classList.add('selected');
                            }
                            
                            cell.onclick = function(ev) {
                                ev.stopPropagation();
                                currentIcon = iconPath;
                                preview.src = iconPath;
                                preview.style.display = '';
                                placeholder.style.display = 'none';
                                popup.style.display = 'none';
                                
                                // Update selected state
                                grid.querySelectorAll('.iconpicker-cell').forEach(function(c) {
                                    c.classList.remove('selected');
                                });
                                cell.classList.add('selected');
                                
                                onSelect(iconPath);
                            };
                            grid.appendChild(cell);
                        });
                    }
                    popup.style.display = 'block';
                });
            }
        };
        
        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!picker.contains(e.target)) {
                popup.style.display = 'none';
            }
        });
        
        return {
            element: picker,
            setIcon: function(iconPath) {
                currentIcon = iconPath;
                if (iconPath) {
                    preview.src = iconPath;
                    preview.style.display = '';
                    placeholder.style.display = 'none';
                } else {
                    preview.style.display = 'none';
                    placeholder.style.display = '';
                }
            },
            getIcon: function() {
                return currentIcon;
            }
        };
    }
    
    return {
        getIconFolder: getIconFolder,
        setIconFolder: setIconFolder,
        getIcons: getIcons,
        isLoaded: isLoaded,
        loadFolderFromSettings: loadFolderFromSettings,
        loadIconsFromFolder: loadIconsFromFolder,
        buildPicker: buildPicker
    };
})();


/* ============================================================================
   SECTION 6: SYSTEM IMAGE PICKER
   Uses system_images folder path from admin settings
   ============================================================================ */

/* ============================================================================
   SECTION 7: MAP CONTROL ROW
   
   Plain HTML controls - fully styled via CSS:
   - Input field for geocoder (Google Places API provides data only)
   - Geolocate button (Browser Geolocation API)
   - Compass button (Mapbox bearing reset)
   ============================================================================ */

const MapControlRowComponent = (function(){
    
    var instances = [];
    var geolocateActive = false;
    var cachedLocation = null;
    var userLocationMarker = null;
    var headingElement = null;
    var deviceOrientationActive = false;
    
    // Sync all geolocate buttons to loading state
    function setAllGeolocateLoading() {
        instances.forEach(function(inst) {
            if (inst.geolocateBtn) {
                inst.geolocateBtn.classList.add('loading');
            }
        });
    }
    
    // Sync all geolocate buttons to active state
    function setAllGeolocateActive() {
        geolocateActive = true;
        instances.forEach(function(inst) {
            if (inst.geolocateBtn) {
                inst.geolocateBtn.classList.remove('loading');
                inst.geolocateBtn.classList.add('active');
            }
        });
    }
    
    // Clear loading state from all geolocate buttons
    function clearAllGeolocateLoading() {
        instances.forEach(function(inst) {
            if (inst.geolocateBtn) {
                inst.geolocateBtn.classList.remove('loading');
            }
        });
    }
    
    // Add or update user location marker on the map
    function updateUserLocationMarker(lat, lng, map) {
        if (!map) return;
        
        if (userLocationMarker) {
            // Update existing marker position
            userLocationMarker.setLngLat([lng, lat]);
        } else {
            // Create new marker with dot and heading arrow
            var el = document.createElement('div');
            el.className = 'user-location-marker';
            
            var dot = document.createElement('div');
            dot.className = 'user-location-marker-dot';
            el.appendChild(dot);
            
            headingElement = document.createElement('div');
            headingElement.className = 'user-location-marker-heading';
            headingElement.style.display = 'none';
            el.appendChild(headingElement);
            
            userLocationMarker = new mapboxgl.Marker(el)
                .setLngLat([lng, lat])
                .addTo(map);
            
            // Start listening for device orientation
            startDeviceOrientation(map);
        }
    }
    
    // Listen for device orientation to show heading
    function startDeviceOrientation(map) {
        if (deviceOrientationActive) return;
        
        function handleOrientation(event) {
            var heading = event.webkitCompassHeading || (event.alpha !== null ? 360 - event.alpha : null);
            
            if (heading !== null && headingElement) {
                headingElement.style.display = 'block';
                // Adjust for map bearing
                var mapBearing = map ? map.getBearing() : 0;
                headingElement.style.transform = 'translateX(-50%) rotate(' + (heading - mapBearing) + 'deg)';
            }
        }
        
        if (window.DeviceOrientationEvent) {
            // iOS 13+ requires permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(function(permission) {
                        if (permission === 'granted') {
                            window.addEventListener('deviceorientation', handleOrientation);
                            deviceOrientationActive = true;
                        }
                    })
                    .catch(console.error);
            } else {
                window.addEventListener('deviceorientation', handleOrientation);
                deviceOrientationActive = true;
            }
            
            // Update heading when map rotates
            if (map) {
                map.on('rotate', function() {
                    // Trigger a fake orientation event to recalculate
                });
            }
        }
    }
    
    // Create the HTML structure for a map control row
    // options: { variant, placeholder, onResult, map }
    // variant: 'filter', 'map', or 'welcome'
    function create(containerEl, options) {
        options = options || {};
        var variant = options.variant || 'filter';
        var placeholder = options.placeholder || 'Search venues or places';
        var onResult = options.onResult || function() {};
        var map = options.map || null;
        
        // Build class prefix based on variant
        var prefix = variant + '-mapcontrol';
        
        // Create row container
        var row = document.createElement('div');
        row.className = prefix + '-row';
        
        // Geocoder container
        var geocoderEl = document.createElement('div');
        geocoderEl.className = prefix + '-geocoder';
        
        // Our styled input
        var input = document.createElement('input');
        input.type = 'text';
        input.className = prefix + '-geocoder-input';
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        geocoderEl.appendChild(input);
        
        // Dropdown for suggestions
        var dropdown = document.createElement('div');
        dropdown.className = prefix + '-geocoder-dropdown';
        dropdown.style.display = 'none';
        geocoderEl.appendChild(dropdown);
        
        var clearBtn = ClearButtonComponent.create({
            className: prefix + '-geocoder-clear',
            ariaLabel: 'Clear location'
        });
        clearBtn.style.display = 'none';
        geocoderEl.appendChild(clearBtn);
        
        row.appendChild(geocoderEl);
        
        // Geolocate button
        var geolocateBtn = document.createElement('button');
        geolocateBtn.type = 'button';
        geolocateBtn.className = prefix + '-geolocate';
        geolocateBtn.innerHTML = '<svg class="' + prefix + '-geolocate-icon" viewBox="0 0 20 20" width="20" height="20"><path d="M10 4C9 4 9 5 9 5L9 5.1A5 5 0 0 0 5.1 9L5 9C5 9 4 9 4 10 4 11 5 11 5 11L5.1 11A5 5 0 0 0 9 14.9L9 15C9 15 9 16 10 16 11 16 11 15 11 15L11 14.9A5 5 0 0 0 14.9 11L15 11C15 11 16 11 16 10 16 9 15 9 15 9L14.9 9A5 5 0 0 0 11 5.1L11 5C11 5 11 4 10 4zM10 6.5A3.5 3.5 0 0 1 13.5 10 3.5 3.5 0 0 1 10 13.5 3.5 3.5 0 0 1 6.5 10 3.5 3.5 0 0 1 10 6.5zM10 8.3A1.8 1.8 0 0 0 8.3 10 1.8 1.8 0 0 0 10 11.8 1.8 1.8 0 0 0 11.8 10 1.8 1.8 0 0 0 10 8.3z" fill="currentColor"/></svg>';
        geolocateBtn.title = 'Find my location';
        row.appendChild(geolocateBtn);
        
        // Compass button
        var compassBtn = document.createElement('button');
        compassBtn.type = 'button';
        compassBtn.className = prefix + '-compass';
        compassBtn.innerHTML = '<svg class="' + prefix + '-compass-icon" viewBox="0 0 20 20" width="20" height="20"><polygon fill="#3b82f6" points="6,9 10,1 14,9"/><polygon fill="#333333" points="6,11 10,19 14,11"/></svg>';
        compassBtn.title = 'Reset north';
        row.appendChild(compassBtn);
        
        containerEl.appendChild(row);
        
        var instance = {
            row: row,
            input: input,
            clearBtn: clearBtn,
            dropdown: dropdown,
            geolocateBtn: geolocateBtn,
            compassBtn: compassBtn,
            map: map
        };
        
        // Fetch and display suggestions using new Google Places API
        async function fetchSuggestions(query) {
            if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
            
            try {
                var response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input: query
                });
                
                dropdown.innerHTML = '';
                
                if (!response || !response.suggestions || response.suggestions.length === 0) {
                    dropdown.style.display = 'none';
                    return;
                }
                
                response.suggestions.forEach(function(suggestion) {
                    var prediction = suggestion.placePrediction;
                    if (!prediction) return;
                    
                    var item = document.createElement('div');
                    item.className = prefix + '-geocoder-dropdown-item';
                    
                    var mainText = prediction.mainText ? prediction.mainText.text : prediction.text.text;
                    var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                    
                    item.innerHTML = 
                        '<div class="' + prefix + '-geocoder-dropdown-main">' + mainText + '</div>' +
                        (secondaryText ? '<div class="' + prefix + '-geocoder-dropdown-secondary">' + secondaryText + '</div>' : '');
                    
                    item.addEventListener('click', async function() {
                        try {
                            var place = prediction.toPlace();
                            await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'viewport'] });
                            
                            if (place.location) {
                                var lat = place.location.lat();
                                var lng = place.location.lng();
                                
                                input.value = place.displayName || mainText;
                                dropdown.style.display = 'none';
                                clearBtn.style.display = 'flex';
                                
                                var result = {
                                    center: [lng, lat],
                                    geometry: { type: 'Point', coordinates: [lng, lat] },
                                    place_name: place.formattedAddress || mainText,
                                    text: place.displayName || mainText
                                };
                                
                                // Add bbox if viewport available (for proper zoom on cities/countries)
                                if (place.viewport) {
                                    var ne = place.viewport.getNorthEast();
                                    var sw = place.viewport.getSouthWest();
                                    result.bbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];
                                }
                                
                                onResult(result);
                            }
                        } catch (err) {
                            console.error('Place details error:', err);
                        }
                    });
                    
                    dropdown.appendChild(item);
                });
                
                dropdown.style.display = 'block';
            } catch (err) {
                console.error('Autocomplete error:', err);
                dropdown.style.display = 'none';
            }
        }
        
        // Input events
        var debounceTimer = null;
        input.addEventListener('input', function() {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            
            clearTimeout(debounceTimer);
            if (input.value.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(function() {
                fetchSuggestions(input.value);
            }, 300);
        });
        
        clearBtn.addEventListener('click', function() {
            input.value = '';
            clearBtn.style.display = 'none';
            dropdown.style.display = 'none';
            input.focus();
        });
        
        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (!geocoderEl.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
        
        // Geolocate button
        geolocateBtn.addEventListener('click', function() {
            // If we already have cached location, use it instantly
            if (cachedLocation) {
                if (map) {
                    map.flyTo({ center: [cachedLocation.lng, cachedLocation.lat], zoom: 14 });
                    updateUserLocationMarker(cachedLocation.lat, cachedLocation.lng, map);
                }
                onResult({
                    center: [cachedLocation.lng, cachedLocation.lat],
                    geometry: { type: 'Point', coordinates: [cachedLocation.lng, cachedLocation.lat] },
                    isGeolocate: true
                });
                return;
            }
            
            if (!navigator.geolocation) {
                console.warn('[Geolocate] Geolocation not supported');
                return;
            }
            
            setAllGeolocateLoading();
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    setAllGeolocateActive();
                    var lat = pos.coords.latitude;
                    var lng = pos.coords.longitude;
                    
                    // Cache the location
                    cachedLocation = { lat: lat, lng: lng };
                    
                    if (map) {
                        map.flyTo({ center: [lng, lat], zoom: 14 });
                        updateUserLocationMarker(lat, lng, map);
                    }
                    
                    onResult({
                        center: [lng, lat],
                        geometry: { type: 'Point', coordinates: [lng, lat] },
                        isGeolocate: true
                    });
                },
                function(err) {
                    clearAllGeolocateLoading();
                    console.error('[Geolocate] Error:', err.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
        
        // Compass button - reset bearing on click
        compassBtn.addEventListener('click', function() {
            if (map) {
                map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
            }
        });
        
        // Sync compass rotation with map bearing and pitch
        if (map) {
            var compassIcon = compassBtn.querySelector('svg');
            function updateCompass() {
                if (compassIcon) {
                    var bearing = map.getBearing();
                    var pitch = map.getPitch();
                    compassIcon.style.transform = 'rotateX(' + pitch + 'deg) rotateZ(' + (-bearing) + 'deg)';
                }
            }
            map.on('rotate', updateCompass);
            map.on('pitch', updateCompass);
            map.on('load', updateCompass);
            updateCompass();
        }
        
        // If geolocate was already active, mark this button too
        if (geolocateActive) {
            geolocateBtn.classList.add('active');
        }
        
        instances.push(instance);
        return instance;
    }
    
    function destroyAll() {
        instances.forEach(function(inst) {
            if (inst.row && inst.row.parentNode) {
                inst.row.parentNode.removeChild(inst.row);
            }
        });
        instances.length = 0;
    }
    
    return {
        create: create,
        destroyAll: destroyAll
    };
})();


const SystemImagePickerComponent = (function(){
    
    var imageFolder = null;
    var images = [];
    var dataLoaded = false;
    
    function getImageFolder() {
        return imageFolder;
    }
    
    function setImageFolder(folder) {
        imageFolder = folder;
    }
    
    function getImages() {
        return images;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Load system images folder path from admin settings
    function loadFolderFromSettings() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.settings && res.settings.system_images_folder) {
                    imageFolder = res.settings.system_images_folder;
                }
                return imageFolder;
            });
    }
    
    // Load images list from folder
    function loadImagesFromFolder(folderPath) {
        folderPath = folderPath || imageFolder;
        if (!folderPath) return Promise.resolve([]);
        
        return fetch('/gateway.php?action=list-icons&folder=' + encodeURIComponent(folderPath))
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success && Array.isArray(res.icons)) {
                    var imageList = res.icons.map(function(img) {
                        return folderPath + '/' + img;
                    });
                    images = imageList;
                    dataLoaded = true;
                    return imageList;
                }
                return [];
            })
            .catch(function(err) {
                console.warn('Failed to load system images from folder:', err);
                return [];
            });
    }
    
    // Build system image picker popup
    // options: { onSelect, label, currentImage }
    function buildPicker(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var label = options.label || 'Select Image';
        var currentImage = options.currentImage || null;
        
        var picker = document.createElement('div');
        picker.className = 'systemimagepicker-container';
        
        // Preview button
        var button = document.createElement('button');
        button.className = 'systemimagepicker-button';
        button.type = 'button';
        
        var preview = document.createElement('img');
        preview.className = 'systemimagepicker-button-preview';
        preview.src = currentImage || '';
        preview.alt = '';
        if (!currentImage) preview.style.display = 'none';
        
        var placeholder = document.createElement('span');
        placeholder.className = 'systemimagepicker-button-placeholder';
        placeholder.textContent = '+';
        if (currentImage) placeholder.style.display = 'none';
        
        button.appendChild(preview);
        button.appendChild(placeholder);
        picker.appendChild(button);
        
        // Popup
        var popup = document.createElement('div');
        popup.className = 'systemimagepicker-popup';
        popup.style.display = 'none';
        
        var popupHeader = document.createElement('div');
        popupHeader.className = 'systemimagepicker-popup-header';
        popupHeader.textContent = label;
        popup.appendChild(popupHeader);
        
        var grid = document.createElement('div');
        grid.className = 'systemimagepicker-grid';
        popup.appendChild(grid);
        
        picker.appendChild(popup);
        
        // Toggle popup
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = popup.style.display !== 'none';
            if (isOpen) {
                popup.style.display = 'none';
            } else {
                // Load and show images
                loadImagesFromFolder().then(function(imageList) {
                    grid.innerHTML = '';
                    if (imageList.length === 0) {
                        var msg = document.createElement('div');
                        msg.className = 'systemimagepicker-error';
                        msg.innerHTML = 'No images found.<br>Please set system images folder in Admin Settings.';
                        grid.appendChild(msg);
                    } else {
                        imageList.forEach(function(imagePath) {
                            var cell = document.createElement('button');
                            cell.className = 'systemimagepicker-cell';
                            cell.type = 'button';
                            var img = document.createElement('img');
                            img.src = imagePath;
                            img.alt = '';
                            cell.appendChild(img);
                            
                            if (imagePath === currentImage) {
                                cell.classList.add('selected');
                            }
                            
                            cell.onclick = function(ev) {
                                ev.stopPropagation();
                                currentImage = imagePath;
                                preview.src = imagePath;
                                preview.style.display = '';
                                placeholder.style.display = 'none';
                                popup.style.display = 'none';
                                
                                // Update selected state
                                grid.querySelectorAll('.systemimagepicker-cell').forEach(function(c) {
                                    c.classList.remove('selected');
                                });
                                cell.classList.add('selected');
                                
                                onSelect(imagePath);
                            };
                            grid.appendChild(cell);
                        });
                    }
                    popup.style.display = 'block';
                });
            }
        };
        
        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!picker.contains(e.target)) {
                popup.style.display = 'none';
            }
        });
        
        return {
            element: picker,
            setImage: function(imagePath) {
                currentImage = imagePath;
                if (imagePath) {
                    preview.src = imagePath;
                    preview.style.display = '';
                    placeholder.style.display = 'none';
                } else {
                    preview.style.display = 'none';
                    placeholder.style.display = '';
                }
            },
            getImage: function() {
                return currentImage;
            }
        };
    }
    
    return {
        getImageFolder: getImageFolder,
        setImageFolder: setImageFolder,
        getImages: getImages,
        isLoaded: isLoaded,
        loadFolderFromSettings: loadFolderFromSettings,
        loadImagesFromFolder: loadImagesFromFolder,
        buildPicker: buildPicker
    };
})();


/* ============================================================================
   SECTION 8: CHECKOUT OPTIONS
   
   Radio card selector for checkout tiers (events and general posts).
   Used in member panel create post form.
   
   Events: Show calculated price based on session dates
   General: Show 30-day and 365-day duration options
   ============================================================================ */

const CheckoutOptionsComponent = (function(){
    
    /**
     * Build checkout options UI
     * @param {HTMLElement} containerEl - Container to append to
     * @param {Object} options - Configuration
     * @param {Array} options.checkoutOptions - Array of checkout option objects from database
     * @param {string} options.currency - Currency code (default: 'USD')
     * @param {number} options.surcharge - Subcategory surcharge amount (default: 0)
     * @param {boolean} options.isEvent - True for events with session dates
     * @param {number|null} options.calculatedDays - Pre-calculated days for events (null = no dates yet)
     * @param {string} options.baseId - Base ID for form elements
     * @param {string} options.groupName - Radio group name
     * @param {Function} options.onSelect - Callback when option selected (optionId, days, price)
     * @returns {Object} Component instance with update methods
     */
    function create(containerEl, options) {
        options = options || {};
        var checkoutOptions = options.checkoutOptions || [];
        var currency = options.currency || 'USD';
        var surcharge = options.surcharge || 0;
        var isEvent = options.isEvent || false;
        var calculatedDays = options.calculatedDays !== undefined ? options.calculatedDays : null;
        var baseId = options.baseId || 'checkout';
        var groupName = options.groupName || baseId + '-option';
        var onSelect = options.onSelect || function() {};
        
        var group = document.createElement('div');
        group.className = 'member-checkout-group';
        group.dataset.isEvent = isEvent ? 'true' : 'false';
        
        if (!checkoutOptions || checkoutOptions.length === 0) {
            var placeholder = document.createElement('div');
            placeholder.className = 'member-checkout-placeholder';
            placeholder.textContent = 'No checkout options configured.';
            group.appendChild(placeholder);
            containerEl.appendChild(group);
            return { element: group, update: function() {} };
        }
        
        var hasDates = isEvent ? calculatedDays !== null : true;
        
        checkoutOptions.forEach(function(option, optionIndex) {
            var flagfallPrice = (parseFloat(option.checkout_flagfall_price) || 0) + surcharge;
            var basicDayRate = option.checkout_basic_day_rate !== undefined && option.checkout_basic_day_rate !== null 
                ? parseFloat(option.checkout_basic_day_rate) : null;
            var discountDayRate = option.checkout_discount_day_rate !== undefined && option.checkout_discount_day_rate !== null 
                ? parseFloat(option.checkout_discount_day_rate) : null;
            var title = option.checkout_title || 'Untitled';
            var description = option.checkout_description || '';
            
            var card = document.createElement('label');
            card.className = 'member-checkout-option' + (hasDates ? '' : ' member-checkout-option--disabled');
            card.dataset.optionId = String(option.id || '');
            card.dataset.flagfall = String(flagfallPrice);
            card.dataset.basicRate = String(basicDayRate !== null ? basicDayRate : '');
            card.dataset.discountRate = String(discountDayRate !== null ? discountDayRate : '');
            card.dataset.currency = currency;
            
            if (isEvent) {
                // Events: Single radio per option card
                var radio = document.createElement('input');
                radio.type = 'radio';
                radio.className = 'member-checkout-option-radio';
                radio.name = groupName;
                radio.value = String(option.id || '');
                radio.id = baseId + '-checkout-' + optionIndex;
                radio.dataset.optionId = String(option.id || '');
                if (optionIndex === 0 && hasDates) radio.checked = true;
                radio.required = true;
                radio.disabled = !hasDates;
                card.appendChild(radio);
            }
            
            var optionContent = document.createElement('div');
            optionContent.className = 'member-checkout-option-content';
            
            var titleRow = document.createElement('div');
            titleRow.className = 'member-checkout-option-title';
            
            var titleText = document.createElement('span');
            titleText.className = 'member-checkout-option-name';
            titleText.textContent = title;
            
            titleRow.appendChild(titleText);
            optionContent.appendChild(titleRow);
            
            if (description) {
                var descText = document.createElement('div');
                descText.className = 'member-checkout-option-description';
                descText.textContent = description;
                optionContent.appendChild(descText);
            }
            
            // Price section
            var priceSection = document.createElement('div');
            priceSection.className = 'member-checkout-price-section';
            
            if (isEvent) {
                // Events: Single calculated price display
                var priceText = document.createElement('span');
                priceText.className = 'member-checkout-price-display';
                if (hasDates) {
                    var dayRate = calculatedDays >= 365 && discountDayRate !== null ? discountDayRate : basicDayRate;
                    var price = dayRate !== null ? flagfallPrice + (dayRate * calculatedDays) : flagfallPrice;
                    priceText.textContent = '(' + calculatedDays + ' days) — ' + (price > 0 ? currency + ' ' + price.toFixed(2) : 'Free');
                } else {
                    priceText.textContent = 'Select session dates for price';
                }
                priceSection.appendChild(priceText);
            } else {
                // General posts: Two duration radio options
                var durationBtns = document.createElement('div');
                durationBtns.className = 'member-checkout-duration-buttons';
                
                var price30 = basicDayRate !== null ? flagfallPrice + (basicDayRate * 30) : flagfallPrice;
                var price365 = discountDayRate !== null 
                    ? flagfallPrice + (discountDayRate * 365) 
                    : (basicDayRate !== null ? flagfallPrice + (basicDayRate * 365) : flagfallPrice);
                
                // 30 days option
                var label30 = document.createElement('label');
                label30.className = 'member-checkout-duration-option';
                var radio30 = document.createElement('input');
                radio30.type = 'radio';
                radio30.className = 'member-checkout-duration-radio';
                radio30.name = groupName;
                radio30.value = (option.id || '') + '-30';
                radio30.dataset.optionId = String(option.id || '');
                radio30.dataset.days = '30';
                radio30.dataset.price = price30.toFixed(2);
                radio30.required = true;
                if (optionIndex === 0) radio30.checked = true;
                var text30 = document.createElement('span');
                text30.className = 'member-checkout-duration-text';
                text30.textContent = '30 days — ' + (price30 > 0 ? currency + ' ' + price30.toFixed(2) : 'Free');
                label30.appendChild(radio30);
                label30.appendChild(text30);
                
                // 365 days option
                var label365 = document.createElement('label');
                label365.className = 'member-checkout-duration-option';
                var radio365 = document.createElement('input');
                radio365.type = 'radio';
                radio365.className = 'member-checkout-duration-radio';
                radio365.name = groupName;
                radio365.value = (option.id || '') + '-365';
                radio365.dataset.optionId = String(option.id || '');
                radio365.dataset.days = '365';
                radio365.dataset.price = price365.toFixed(2);
                radio365.required = true;
                var text365 = document.createElement('span');
                text365.className = 'member-checkout-duration-text';
                text365.textContent = '365 days — ' + (price365 > 0 ? currency + ' ' + price365.toFixed(2) : 'Free');
                label365.appendChild(radio365);
                label365.appendChild(text365);
                
                durationBtns.appendChild(label30);
                durationBtns.appendChild(label365);
                priceSection.appendChild(durationBtns);
            }
            
            optionContent.appendChild(priceSection);
            card.appendChild(optionContent);
            group.appendChild(card);
        });
        
        // Selection change handler
        group.addEventListener('change', function(e) {
            if (e.target.type === 'radio') {
                var optionId = e.target.dataset.optionId;
                var days = e.target.dataset.days ? parseInt(e.target.dataset.days, 10) : calculatedDays;
                var price = e.target.dataset.price ? parseFloat(e.target.dataset.price) : null;
                onSelect(optionId, days, price);
            }
        });
        
        containerEl.appendChild(group);
        
        // Return component instance with update method for reactive price updates
        return {
            element: group,
            
            // Update prices when event session dates change
            updateEventPrices: function(newCalculatedDays) {
                if (!isEvent) return;
                
                var nowHasDates = newCalculatedDays !== null;
                
                group.querySelectorAll('.member-checkout-option').forEach(function(card, idx) {
                    var radio = card.querySelector('input[type="radio"]');
                    var priceDisplay = card.querySelector('.member-checkout-price-display');
                    
                    if (nowHasDates) {
                        card.classList.remove('member-checkout-option--disabled');
                        if (radio) {
                            radio.disabled = false;
                            if (idx === 0 && !group.querySelector('input[type="radio"]:checked')) {
                                radio.checked = true;
                            }
                        }
                        if (priceDisplay) {
                            var flagfall = parseFloat(card.dataset.flagfall) || 0;
                            var basicRate = card.dataset.basicRate !== '' ? parseFloat(card.dataset.basicRate) : null;
                            var discountRate = card.dataset.discountRate !== '' ? parseFloat(card.dataset.discountRate) : null;
                            var curr = card.dataset.currency || 'USD';
                            var dayRate = newCalculatedDays >= 365 && discountRate !== null ? discountRate : basicRate;
                            var price = dayRate !== null ? flagfall + (dayRate * newCalculatedDays) : flagfall;
                            priceDisplay.textContent = '(' + newCalculatedDays + ' days) — ' + (price > 0 ? curr + ' ' + price.toFixed(2) : 'Free');
                        }
                    } else {
                        card.classList.add('member-checkout-option--disabled');
                        if (radio) {
                            radio.disabled = true;
                            radio.checked = false;
                        }
                        if (priceDisplay) {
                            priceDisplay.textContent = 'Select session dates for price';
                        }
                    }
                });
            },
            
            // Get selected option data
            getSelected: function() {
                var checked = group.querySelector('input[type="radio"]:checked');
                if (!checked) return null;
                return {
                    optionId: checked.dataset.optionId,
                    days: checked.dataset.days ? parseInt(checked.dataset.days, 10) : null,
                    price: checked.dataset.price ? parseFloat(checked.dataset.price) : null,
                    value: checked.value
                };
            }
        };
    }
    
    return {
        create: create
    };
})();

