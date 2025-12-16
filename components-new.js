/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   STRUCTURE:
   1. FIELDSETS     - Form field types
   2. CALENDAR      - Horizontal scrolling date picker
   3. MENU          - Generic dropdown menu (from menu-test.html)
   4. ICON PICKER   - Icon dropdown menu (from iconpicker-test.html)
   5. MENU CLEAN    - Clean menu variant (from test-menu-clean.html)
   6. CURRENCY      - Currency selector (from test-currency-menu.html)
   7. PHONE PREFIX  - Phone prefix selector (from test-prefix-menu.html)
   
   ============================================================================ */

console.log('[components.js] Components loaded');


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
        
        var options = { fields: ['formatted_address', 'geometry', 'name', 'place_id'] };
        
        if (type === 'address') options.types = ['address'];
        else if (type === 'establishment') options.types = ['establishment'];
        else if (type === '(cities)') options.types = ['(cities)'];
        
        var autocomplete = new google.maps.places.Autocomplete(inputElement, options);
        
        autocomplete.addListener('place_changed', function() {
            var place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
                if (statusElement) {
                    statusElement.textContent = 'No location data for this place';
                    statusElement.className = 'fieldset-location-status error';
                }
                return;
            }
            
            var lat = place.geometry.location.lat();
            var lng = place.geometry.location.lng();
            
            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;
            
            if (statusElement) {
                statusElement.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                statusElement.className = 'fieldset-location-status success';
            }
        });
        
        return autocomplete;
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
        var monthsPast = options.monthsPast || 12;
        var monthsFuture = options.monthsFuture || 24;
        var onDateClick = options.onDateClick || function() {};
        
        var today = new Date();
        today.setHours(0,0,0,0);
        var todayIso = toISODate(today);
        
        var minDate = new Date(today.getFullYear(), today.getMonth() - monthsPast, 1);
        var maxDate = new Date(today.getFullYear(), today.getMonth() + monthsFuture, 1);
        
        var todayMonthEl = null;
        var todayMonthIndex = 0;
        var totalMonths = 0;
        var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        
        var scroll = document.createElement('div');
        scroll.className = 'calendar-scroll';
        
        var calendar = document.createElement('div');
        calendar.className = 'calendar';
        
        var marker = document.createElement('div');
        marker.className = 'today-marker';
        
        var current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        var monthIndex = 0;
        while(current <= maxDate) {
            var monthEl = document.createElement('div');
            monthEl.className = 'month';
            
            var header = document.createElement('div');
            header.className = 'calendar-header';
            header.textContent = current.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            monthEl.appendChild(header);
            
            var grid = document.createElement('div');
            grid.className = 'grid';
            
            weekdays.forEach(function(wd) {
                var w = document.createElement('div');
                w.className = 'weekday';
                w.textContent = wd;
                grid.appendChild(w);
            });
            
            var firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
            var startDow = firstDay.getDay();
            var daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
            
            for(var i = 0; i < 42; i++) {
                var cell = document.createElement('div');
                cell.className = 'day';
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
        containerEl.appendChild(scroll);
        containerEl.appendChild(marker);
        
        if(todayMonthEl) {
            scroll.scrollLeft = todayMonthEl.offsetLeft;
        }
        
        var markerFraction = (todayMonthIndex + 0.5) / totalMonths;
        var markerPos = markerFraction * (containerEl.clientWidth - 8);
        marker.style.left = markerPos + 'px';
        
        marker.addEventListener('click', function() {
            if(todayMonthEl) {
                scroll.scrollTo({ left: todayMonthEl.offsetLeft, behavior: 'smooth' });
            }
        });
        
        calendar.addEventListener('click', function(e) {
            var day = e.target;
            if(day.classList.contains('day') && !day.classList.contains('empty')) {
                day.classList.toggle('selected');
                onDateClick(day.dataset.iso, day.classList.contains('selected'));
            }
        });
        
        scroll.addEventListener('wheel', function(e) {
            e.preventDefault();
            scroll.scrollLeft += e.deltaY || e.deltaX;
        });
        
        return {
            scroll: scroll,
            calendar: calendar,
            marker: marker,
            scrollToToday: function() {
                if(todayMonthEl) {
                    scroll.scrollTo({ left: todayMonthEl.offsetLeft, behavior: 'smooth' });
                }
            }
        };
    }
    
    return {
        create: create,
        toISODate: toISODate
    };
})();


/* ============================================================================
   SECTION 3: MENU
   Source: menu-test.html
   ============================================================================ */

const MenuComponent = (function(){
    
    function create(containerEl, options) {
        options = options || {};
        var imageFolder = options.imageFolder || 'assets/flags';
        var items = options.items || [];
        var onSelect = options.onSelect || function() {};
        
        containerEl.innerHTML = 
            '<div class="menu-button">' +
                '<img class="menu-button-image" src="" alt="" hidden>' +
                '<span class="menu-button-text">Select...</span>' +
                '<span class="menu-button-arrow">▼</span>' +
            '</div>' +
            '<div class="menu-options"></div>';
        
        var btn = containerEl.querySelector('.menu-button');
        var img = containerEl.querySelector('.menu-button-image');
        var txt = containerEl.querySelector('.menu-button-text');
        var opts = containerEl.querySelector('.menu-options');
        
        items.forEach(function(d) {
            var src = imageFolder + '/' + d.file;
            var o = document.createElement('div');
            o.className = 'menu-option';
            o.innerHTML = '<img class="menu-option-image" src="' + src + '"><span class="menu-option-text">' + d.text + '</span>';
            o.onclick = function() {
                img.src = src;
                img.hidden = false;
                txt.textContent = d.text;
                opts.style.display = 'none';
                containerEl.classList.remove('open');
                onSelect(d);
            };
            opts.appendChild(o);
        });
        
        btn.onclick = function() {
            var isOpen = containerEl.classList.contains('open');
            if (isOpen) {
                opts.style.display = 'none';
                containerEl.classList.remove('open');
            } else {
                opts.style.display = 'block';
                containerEl.classList.add('open');
            }
        };
        
        document.addEventListener('click', function(e) {
            if (!containerEl.contains(e.target)) {
                opts.style.display = 'none';
                containerEl.classList.remove('open');
            }
        });
        
        return {
            setValue: function(text, imageSrc) {
                txt.textContent = text;
                if (imageSrc) {
                    img.src = imageSrc;
                    img.hidden = false;
                }
            }
        };
    }
    
    return {
        create: create
    };
})();


/* ============================================================================
   SECTION 4: ICON PICKER
   Source: iconpicker-test.html
   ============================================================================ */

const IconPickerComponent = (function(){
    
    function create(containerEl, options) {
        options = options || {};
        var imageFolder = options.imageFolder || 'assets/icons-30/';
        var textFormat = options.textFormat || '{filename}';
        var onSelect = options.onSelect || function() {};
        
        containerEl.innerHTML = '<div class="menu-button"><img class="menu-button-image" src="" alt=""><span class="menu-button-text">Select...</span><span class="menu-button-arrow">▼</span></div><div class="menu-options"></div>';
        
        var btn = containerEl.querySelector('.menu-button');
        var opts = containerEl.querySelector('.menu-options');
        var btnImg = containerEl.querySelector('.menu-button-image');
        var btnText = containerEl.querySelector('.menu-button-text');
        
        fetch('/gateway.php?action=list-icons&folder=' + encodeURIComponent(imageFolder))
            .then(function(r) { return r.json(); })
            .then(function(res) {
                var icons = res.icons || [];
                if (icons.length > 0) {
                    btnImg.src = imageFolder + icons[0];
                    btnText.textContent = textFormat.replace('{filename}', icons[0]);
                }
                icons.forEach(function(item) {
                    var op = document.createElement('div');
                    op.className = 'menu-option';
                    op.innerHTML = '<img class="menu-option-image" src="' + imageFolder + item + '" alt=""><span class="menu-option-text">' + textFormat.replace('{filename}', item) + '</span>';
                    op.onclick = function() {
                        btnImg.src = imageFolder + item;
                        btnText.textContent = textFormat.replace('{filename}', item);
                        containerEl.classList.remove('open');
                        onSelect(item, imageFolder + item);
                    };
                    opts.appendChild(op);
                });
            });
        
        btn.onclick = function() {
            containerEl.classList.toggle('open');
        };
        
        document.addEventListener('click', function(e) {
            if (!containerEl.contains(e.target)) {
                containerEl.classList.remove('open');
            }
        });
        
        return {
            getValue: function() { return btnText.textContent; },
            getImageSrc: function() { return btnImg.src; }
        };
    }
    
    return {
        create: create
    };
})();


/* ============================================================================
   SECTION 5: MENU CLEAN
   Source: test-menu-clean.html
   ============================================================================ */

const MenuCleanComponent = (function(){
    
    function create(containerEl, options) {
        options = options || {};
        var imageFolder = options.imageFolder || 'assets/flags';
        var items = options.items || [];
        var onSelect = options.onSelect || function() {};
        
        containerEl.innerHTML = 
            '<button class="menu-button">' +
                '<img class="menu-button-image" src="" alt="" hidden>' +
                '<span class="menu-button-text">Select...</span>' +
                '<span class="menu-button-arrow">▼</span>' +
            '</button>' +
            '<div class="menu-options" hidden></div>';
        
        var btn = containerEl.querySelector('.menu-button');
        var img = containerEl.querySelector('.menu-button-image');
        var txt = containerEl.querySelector('.menu-button-text');
        var opt = containerEl.querySelector('.menu-options');
        
        items.forEach(function(d) {
            var src = imageFolder + '/' + d.file;
            var o = document.createElement('button');
            o.className = 'menu-option';
            o.innerHTML = '<img class="menu-option-image" src="' + src + '"><span class="menu-option-text">' + d.text + '</span>';
            o.onclick = function() {
                img.src = src;
                img.hidden = false;
                txt.textContent = d.text;
                opt.hidden = true;
                onSelect(d);
            };
            opt.appendChild(o);
        });
        
        btn.onclick = function() {
            opt.hidden = !opt.hidden;
        };
        
        document.addEventListener('click', function(e) {
            if (!containerEl.contains(e.target)) {
                opt.hidden = true;
            }
        });
        
        return {
            setValue: function(text, imageSrc) {
                txt.textContent = text;
                if (imageSrc) {
                    img.src = imageSrc;
                    img.hidden = false;
                }
            }
        };
    }
    
    return {
        create: create
    };
})();


/* ============================================================================
   SECTION 6: CURRENCY
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
    
    // Build a compact currency menu (100px, value only, default USD)
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
    
    return {
        getData: getData,
        setData: setData,
        isLoaded: isLoaded,
        loadFromDatabase: loadFromDatabase,
        buildCompactMenu: buildCompactMenu,
        parseCurrencyValue: parseCurrencyValue
    };
})();


/* ============================================================================
   SECTION 7: PHONE PREFIX
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
    
    // Build a compact phone prefix menu (100px, same style as currency)
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


