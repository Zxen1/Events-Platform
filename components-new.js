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
        getPicklist: function() { return picklist; }
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
    
    var defaultData = [
        { value: 'us USD', label: 'US Dollar' },
        { value: 'gb GBP', label: 'British Pound' },
        { value: 'eu EUR', label: 'Euro' },
        { value: 'au AUD', label: 'Australian Dollar' },
        { value: 'ca CAD', label: 'Canadian Dollar' },
        { value: 'jp JPY', label: 'Japanese Yen' },
        { value: 'cn CNY', label: 'Chinese Yuan' },
        { value: 'in INR', label: 'Indian Rupee' },
        { value: 'br BRL', label: 'Brazilian Real' },
        { value: 'mx MXN', label: 'Mexican Peso' },
        { value: 'kr KRW', label: 'South Korean Won' },
        { value: 'sg SGD', label: 'Singapore Dollar' },
        { value: 'nz NZD', label: 'New Zealand Dollar' },
        { value: 'ch CHF', label: 'Swiss Franc' },
        { value: 'se SEK', label: 'Swedish Krona' },
    ];
    
    function parseCurrencyValue(optionValue) {
        if (!optionValue || typeof optionValue !== 'string') return { countryCode: null, currencyCode: optionValue || '' };
        var parts = optionValue.trim().split(' ');
        if (parts.length >= 2) {
            return { countryCode: parts[0].toLowerCase(), currencyCode: parts.slice(1).join(' ') };
        }
        return { countryCode: null, currencyCode: optionValue };
    }
    
    function getFlagHTML(countryCode) {
        if (!countryCode) return '';
        return '<span class="dropdown-flag"><img src="assets/flags/' + countryCode + '.svg" alt="" /></span>';
    }
    
    function getCurrencyButtonHTML(countryCode, currencyCode) {
        var flagHTML = countryCode ? getFlagHTML(countryCode) : '';
        return flagHTML + '<span class="dropdown-text">' + currencyCode + '</span>';
    }
    
    function setupDropdownKeyboardNav(menuElement, closeMenuCallback) {
        var searchString = '';
        var searchTimeout = null;
        
        var keydownHandler = function(e) {
            if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key) && !e.isComposing) {
                e.preventDefault();
                if (searchTimeout) clearTimeout(searchTimeout);
                searchString += e.key.toUpperCase();
                
                var options = menuElement.querySelectorAll('.menu-option[data-label]');
                for (var i = 0; i < options.length; i++) {
                    var opt = options[i];
                    var label = (opt.dataset.label || '').toUpperCase();
                    if (label && label.startsWith(searchString)) {
                        opt.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        opt.focus();
                        break;
                    }
                }
                searchTimeout = setTimeout(function() { searchString = ''; }, 800);
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                if (typeof closeMenuCallback === 'function') closeMenuCallback();
            }
            else if (e.key === 'Enter') {
                var focused = menuElement.querySelector('.menu-option:focus');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        };
        
        menuElement.addEventListener('keydown', keydownHandler);
        return function() { menuElement.removeEventListener('keydown', keydownHandler); };
    }
    
    function create(wrapperEl, buttonEl, menuEl, options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var data = options.data || defaultData;
        
        data.forEach(function(opt) {
            var parsed = parseCurrencyValue(opt.value);
            var optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'menu-option';
            optionBtn.dataset.value = parsed.currencyCode;
            optionBtn.dataset.countryCode = parsed.countryCode;
            optionBtn.dataset.label = opt.label;
            optionBtn.innerHTML = getFlagHTML(parsed.countryCode) + '<span class="dropdown-text">' + parsed.currencyCode + ' - ' + opt.label + '</span>';
            
            optionBtn.addEventListener('click', function() {
                var arrow = buttonEl.querySelector('.dropdown-arrow');
                buttonEl.innerHTML = getCurrencyButtonHTML(parsed.countryCode, parsed.currencyCode);
                if (arrow) buttonEl.appendChild(arrow);
                buttonEl.dataset.value = parsed.currencyCode;
                menuEl.hidden = true;
                buttonEl.setAttribute('aria-expanded', 'false');
                onSelect(parsed.currencyCode, opt.label, parsed.countryCode);
            });
            
            menuEl.appendChild(optionBtn);
        });
        
        var cleanupKeyboardNav = null;
        buttonEl.addEventListener('click', function(e) {
            e.stopPropagation();
            var open = !menuEl.hasAttribute('hidden');
            if (open) {
                menuEl.hidden = true;
                buttonEl.setAttribute('aria-expanded', 'false');
                if (cleanupKeyboardNav) cleanupKeyboardNav();
            } else {
                menuEl.hidden = false;
                buttonEl.setAttribute('aria-expanded', 'true');
                cleanupKeyboardNav = setupDropdownKeyboardNav(menuEl, function() {
                    menuEl.hidden = true;
                    buttonEl.setAttribute('aria-expanded', 'false');
                });
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!wrapperEl.contains(e.target)) {
                menuEl.hidden = true;
                buttonEl.setAttribute('aria-expanded', 'false');
                if (cleanupKeyboardNav) cleanupKeyboardNav();
            }
        });
    }
    
    return {
        create: create,
        parseCurrencyValue: parseCurrencyValue,
        getFlagHTML: getFlagHTML,
        getCurrencyButtonHTML: getCurrencyButtonHTML,
        setData: function(data) { defaultData = data; }
    };
})();


/* ============================================================================
   SECTION 7: PHONE PREFIX
   Source: test-prefix-menu.html
   ============================================================================ */

const PhonePrefixComponent = (function(){
    
    var defaultData = [
        { value: 'us +1', label: 'United States' },
        { value: 'gb +44', label: 'United Kingdom' },
        { value: 'au +61', label: 'Australia' },
        { value: 'ca +1', label: 'Canada' },
        { value: 'de +49', label: 'Germany' },
        { value: 'fr +33', label: 'France' },
        { value: 'jp +81', label: 'Japan' },
        { value: 'cn +86', label: 'China' },
        { value: 'in +91', label: 'India' },
        { value: 'br +55', label: 'Brazil' },
        { value: 'mx +52', label: 'Mexico' },
        { value: 'it +39', label: 'Italy' },
        { value: 'es +34', label: 'Spain' },
        { value: 'kr +82', label: 'South Korea' },
        { value: 'nl +31', label: 'Netherlands' },
        { value: 'se +46', label: 'Sweden' },
        { value: 'ch +41', label: 'Switzerland' },
        { value: 'nz +64', label: 'New Zealand' },
        { value: 'sg +65', label: 'Singapore' },
        { value: 'hk +852', label: 'Hong Kong' },
        { value: 'ae +971', label: 'United Arab Emirates' },
        { value: 'za +27', label: 'South Africa' },
        { value: 'ru +7', label: 'Russia' },
        { value: 'pl +48', label: 'Poland' },
        { value: 'ie +353', label: 'Ireland' },
    ];
    
    function getFlagHTML(countryCode) {
        if (!countryCode) return '';
        return '<span class="dropdown-flag"><img src="assets/flags/' + countryCode + '.svg" alt="" /></span>';
    }
    
    function parsePhonePrefixValue(optionValue) {
        if (!optionValue || typeof optionValue !== 'string') return { countryCode: null, prefix: optionValue || '' };
        var parts = optionValue.trim().split(' ');
        if (parts.length >= 2) {
            return { countryCode: parts[0].toLowerCase(), prefix: parts.slice(1).join(' ') };
        }
        return { countryCode: null, prefix: optionValue };
    }
    
    function getPhonePrefixDisplayText(opt) {
        if (!opt) return '';
        var parsed = parsePhonePrefixValue(opt.value);
        var label = opt.label || '';
        var flagHTML = parsed.countryCode ? getFlagHTML(parsed.countryCode) : '';
        return flagHTML + '<span class="dropdown-text">' + parsed.prefix + ' - ' + label + '</span>';
    }
    
    function getPhonePrefixButtonHTML(countryCode, prefix) {
        var flagHTML = countryCode ? getFlagHTML(countryCode) : '';
        return flagHTML + '<span class="dropdown-text">' + prefix + '</span>';
    }
    
    function setupDropdownKeyboardNav(menuElement, closeMenuCallback) {
        var searchString = '';
        var searchTimeout = null;
        
        var keydownHandler = function(e) {
            if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key) && !e.isComposing) {
                e.preventDefault();
                if (searchTimeout) clearTimeout(searchTimeout);
                searchString += e.key.toUpperCase();
                
                var options = menuElement.querySelectorAll('.menu-option[data-label]');
                for (var i = 0; i < options.length; i++) {
                    var opt = options[i];
                    var label = (opt.dataset.label || '').toUpperCase();
                    if (label && label.startsWith(searchString)) {
                        opt.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        opt.focus();
                        break;
                    }
                }
                searchTimeout = setTimeout(function() { searchString = ''; }, 800);
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                if (typeof closeMenuCallback === 'function') closeMenuCallback();
            }
            else if (e.key === 'Enter') {
                var focused = menuElement.querySelector('.menu-option:focus');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        };
        
        menuElement.addEventListener('keydown', keydownHandler);
        return function() { menuElement.removeEventListener('keydown', keydownHandler); };
    }
    
    function create(wrapperEl, buttonEl, menuEl, phoneInputEl, options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var defaultCountry = options.defaultCountry || 'us';
        var data = options.data || defaultData;
        
        var defaultOpt = data.find(function(opt) { return opt.value && opt.value.startsWith(defaultCountry + ' '); }) || data[0];
        var parsed = parsePhonePrefixValue(defaultOpt.value);
        
        var arrow = buttonEl.querySelector('.dropdown-arrow');
        buttonEl.innerHTML = getPhonePrefixButtonHTML(parsed.countryCode, parsed.prefix);
        if (arrow) buttonEl.appendChild(arrow);
        buttonEl.dataset.value = parsed.prefix;
        buttonEl.dataset.countryCode = parsed.countryCode;
        
        data.forEach(function(opt) {
            var parsed = parsePhonePrefixValue(opt.value);
            var optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'menu-option';
            optionBtn.innerHTML = getPhonePrefixDisplayText(opt);
            optionBtn.dataset.value = parsed.prefix;
            optionBtn.dataset.countryCode = parsed.countryCode || '';
            optionBtn.dataset.label = opt.label || '';
            
            optionBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var arrow = buttonEl.querySelector('.dropdown-arrow');
                buttonEl.innerHTML = getPhonePrefixButtonHTML(parsed.countryCode, parsed.prefix);
                if (arrow) buttonEl.appendChild(arrow);
                buttonEl.dataset.value = parsed.prefix;
                buttonEl.dataset.countryCode = parsed.countryCode || '';
                menuEl.hidden = true;
                buttonEl.setAttribute('aria-expanded', 'false');
                onSelect(parsed.prefix, opt.label, parsed.countryCode);
            });
            
            menuEl.appendChild(optionBtn);
        });
        
        var cleanupKeyboardNav = null;
        buttonEl.addEventListener('click', function(e) {
            e.stopPropagation();
            var open = !menuEl.hasAttribute('hidden');
            if (open) {
                menuEl.hidden = true;
                buttonEl.setAttribute('aria-expanded', 'false');
                if (cleanupKeyboardNav) cleanupKeyboardNav();
            } else {
                menuEl.hidden = false;
                buttonEl.setAttribute('aria-expanded', 'true');
                cleanupKeyboardNav = setupDropdownKeyboardNav(menuEl, function() {
                    menuEl.hidden = true;
                    buttonEl.setAttribute('aria-expanded', 'false');
                });
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!wrapperEl.contains(e.target)) {
                menuEl.hidden = true;
                buttonEl.setAttribute('aria-expanded', 'false');
                if (cleanupKeyboardNav) cleanupKeyboardNav();
            }
        });
        
        if (phoneInputEl) {
            phoneInputEl.addEventListener('beforeinput', function(e) {
                if (e.data && !/^[0-9 +()-]+$/.test(e.data)) {
                    e.preventDefault();
                }
            });
        }
    }
    
    return {
        create: create,
        parsePhonePrefixValue: parsePhonePrefixValue,
        getFlagHTML: getFlagHTML,
        getPhonePrefixButtonHTML: getPhonePrefixButtonHTML,
        setData: function(data) { defaultData = data; }
    };
})();


