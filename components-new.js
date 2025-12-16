/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   CONTAINS:
   - Fieldsets (form field types with validation, Google Places, etc.)
   - Calendars (daterange picker, session calendar)
   - Menus (sort, icon picker, currency, phone prefix, dropdowns)
   
   DEPENDENCIES:
   - index.js (backbone)
   - Google Places API (for location fields)
   
   USED BY:
   - filter.js (sort menu, daterange calendar)
   - admin.js (icon pickers, form preview)
   - member.js (form filling)
   - post.js (venue/session menus)
   
   ============================================================================ */

console.log('[components.js] Components loaded');


/* ============================================================================
   SECTION 1: FIELDSETS
   Source: fieldset-test.html
   ============================================================================ */

const FieldsetComponent = (function(){
    var picklist = {};
    
    // Google Places Autocomplete helper
    // type: 'address' | 'establishment' | '(cities)'
    function initGooglePlaces(inputElement, type, latInput, lngInput, statusElement) {
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            console.warn('Google Places API not loaded');
            if (statusElement) {
                statusElement.textContent = 'Location search unavailable';
                statusElement.className = 'fieldset-location-status error';
            }
            return null;
        }
        
        var options = {
            fields: ['formatted_address', 'geometry', 'name', 'place_id']
        };
        
        // Set type restriction
        if (type === 'address') {
            options.types = ['address'];
        } else if (type === 'establishment') {
            options.types = ['establishment'];
        } else if (type === '(cities)') {
            options.types = ['(cities)'];
        }
        
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
    
    // Build compact currency menu (100px, value only, default USD)
    function buildCurrencyMenuCompact(container) {
        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="assets/flags/us.svg" alt=""><span class="fieldset-menu-button-text">USD</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        
        var currencies = picklist['currency'] || [];
        currencies.forEach(function(item) {
            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + item.value.substring(0,2) + '.svg" alt=""><span class="fieldset-menu-option-text">' + item.value.substring(3) + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = 'assets/flags/' + item.value.substring(0,2) + '.svg';
                btnText.textContent = item.value.substring(3); // Value only
                menu.classList.remove('open');
            };
            opts.appendChild(op);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            container.querySelectorAll('.fieldset-menu.open').forEach(function(el) {
                if (el !== menu) el.classList.remove('open');
            });
            menu.classList.toggle('open');
        };
        
        return menu;
    }
    
    // Build phone prefix menu (100px compact, same style as currency)
    function buildPhonePrefixMenu(container) {
        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="" alt=""><span class="fieldset-menu-button-text">+...</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        
        var prefixes = picklist['phone-prefix'] || [];
        if (prefixes.length > 0) {
            btnImg.src = 'assets/flags/' + prefixes[0].value.substring(0,2) + '.svg';
            btnText.textContent = prefixes[0].value.substring(3);
        }
        
        prefixes.forEach(function(item) {
            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + item.value.substring(0,2) + '.svg" alt=""><span class="fieldset-menu-option-text">' + item.value.substring(3) + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = 'assets/flags/' + item.value.substring(0,2) + '.svg';
                btnText.textContent = item.value.substring(3);
                menu.classList.remove('open');
            };
            opts.appendChild(op);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            container.querySelectorAll('.fieldset-menu.open').forEach(function(el) {
                if (el !== menu) el.classList.remove('open');
            });
            menu.classList.toggle('open');
        };
        
        return menu;
    }
    
    // Build label with required asterisk and tooltip
    function buildLabel(name, tooltip) {
        var label = document.createElement('div');
        label.className = 'fieldset-label';
        label.innerHTML = '<span class="fieldset-label-text">' + name + '</span><span class="fieldset-label-required">*</span>';
        if (tooltip) {
            var tip = document.createElement('span');
            tip.className = 'fieldset-label-tooltip';
            tip.textContent = 'i';
            tip.setAttribute('data-tooltip', tooltip);
            label.appendChild(tip);
        }
        return label;
    }
    
    // Add validation with char limit and invalid state
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
                if (remaining <= 0) {
                    charCount.className = 'fieldset-char-count fieldset-char-count--danger';
                } else {
                    charCount.className = 'fieldset-char-count fieldset-char-count--warning';
                }
            } else {
                charCount.style.display = 'none';
            }
        }
        
        function validate() {
            if (!touched) return;
            var isValid = true;
            var len = input.value.length;
            
            // Check min length (only if field has content)
            if (len > 0 && minLength > 0 && len < minLength) {
                isValid = false;
            }
            // Check max length
            if (len > maxLength) {
                isValid = false;
            }
            // Check custom validation
            if (len > 0 && validationFn && !validationFn(input.value)) {
                isValid = false;
            }
            
            if (!isValid) {
                input.classList.add('fieldset-input--invalid');
            } else {
                input.classList.remove('fieldset-input--invalid');
            }
        }
        
        input.setAttribute('maxlength', maxLength);
        
        input.addEventListener('input', function() {
            updateCharCount();
            if (touched) validate();
        });
        
        input.addEventListener('blur', function() {
            touched = true;
            validate();
        });
        
        input.addEventListener('focus', function() {
            updateCharCount();
        });
        
        return { charCount: charCount };
    }
    
    // Email validation regex
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // URL validation (accepts with or without protocol)
    function isValidUrl(url) {
        return /^(https?:\/\/)?.+\..+/.test(url);
    }
    
    // Phone digits-only filter
    function makePhoneDigitsOnly(input) {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }
    
    // URL auto-prepend https://
    function autoUrlProtocol(input) {
        input.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val && !val.match(/^https?:\/\//i)) {
                this.value = 'https://' + val;
            }
        });
    }
    
    // Set picklist data
    function setPicklist(data) {
        picklist = data || {};
    }
    
    // Public API
    return {
        initGooglePlaces: initGooglePlaces,
        buildCurrencyMenuCompact: buildCurrencyMenuCompact,
        buildPhonePrefixMenu: buildPhonePrefixMenu,
        buildLabel: buildLabel,
        addInputValidation: addInputValidation,
        isValidEmail: isValidEmail,
        isValidUrl: isValidUrl,
        makePhoneDigitsOnly: makePhoneDigitsOnly,
        autoUrlProtocol: autoUrlProtocol,
        setPicklist: setPicklist
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
    
    function createCalendar(containerEl, options) {
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
        
        // Create structure
        var scroll = document.createElement('div');
        scroll.className = 'calendar-scroll';
        
        var calendar = document.createElement('div');
        calendar.className = 'calendar';
        
        var marker = document.createElement('div');
        marker.className = 'today-marker';
        
        // Build months
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
        
        // Scroll to today
        if(todayMonthEl) {
            scroll.scrollLeft = todayMonthEl.offsetLeft;
        }
        
        // Position marker
        var markerFraction = (todayMonthIndex + 0.5) / totalMonths;
        var markerPos = markerFraction * (containerEl.clientWidth - 8);
        marker.style.left = markerPos + 'px';
        
        // Marker click - scroll to today
        marker.addEventListener('click', function() {
            if(todayMonthEl) {
                scroll.scrollTo({ left: todayMonthEl.offsetLeft, behavior: 'smooth' });
            }
        });
        
        // Day click
        calendar.addEventListener('click', function(e) {
            var day = e.target;
            if(day.classList.contains('day') && !day.classList.contains('empty')) {
                day.classList.toggle('selected');
                onDateClick(day.dataset.iso, day.classList.contains('selected'));
            }
        });
        
        // Horizontal wheel scroll
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
        create: createCalendar,
        toISODate: toISODate
    };
})();


/* ============================================================================
   SECTION 3: MENU (Basic)
   Source: menu-test.html
   ============================================================================ */

const MenuComponent = (function(){
    
    function createMenu(containerEl, options) {
        options = options || {};
        var imageFolder = options.imageFolder || 'assets/flags';
        var items = options.items || [];
        var onSelect = options.onSelect || function() {};
        
        containerEl.innerHTML = `
            <button class="menu-button">
                <img class="menu-button-image" src="" alt="" hidden>
                <span class="menu-button-text">Select...</span>
                <span class="menu-button-arrow">▼</span>
            </button>
            <div class="menu-options" hidden></div>`;
        
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
            },
            close: function() {
                opt.hidden = true;
            }
        };
    }
    
    return {
        create: createMenu
    };
})();


/* ============================================================================
   SECTION 4: ICON PICKER (Simple)
   Source: iconpicker-test.html
   ============================================================================ */

const IconPickerSimple = (function(){
    
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
                        onSelect(item);
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
    }
    
    return {
        create: create
    };
})();


/* ============================================================================
   SECTION 5: ICON PICKER (Advanced with Grid)
   Source: test-icon-picker.html
   ============================================================================ */

const IconPickerGrid = (function(){
    
    var iconCache = null;
    
    async function loadIcons(folder) {
        if (iconCache) return iconCache;
        
        try {
            var response = await fetch('/gateway.php?action=list-icons&folder=' + encodeURIComponent(folder));
            if (!response.ok) throw new Error('Failed to load icons');
            var data = await response.json();
            if (data.success && Array.isArray(data.icons)) {
                iconCache = data.icons.map(function(icon) { return folder + '/' + icon; });
                return iconCache;
            }
        } catch (err) {
            console.warn('Failed to load icons:', err);
        }
        
        iconCache = [];
        return iconCache;
    }
    
    function create(containerEl, options) {
        options = options || {};
        var iconFolder = options.iconFolder || 'assets/icons-30';
        var onSelect = options.onSelect || function() {};
        
        var picker = containerEl;
        var btn = picker.querySelector('.icon-picker-button');
        var popup = picker.querySelector('.icon-picker-popup');
        var grid = picker.querySelector('.icon-picker-grid');
        var preview = picker.querySelector('.icon-picker-preview');
        var label = picker.querySelector('.icon-picker-label');
        
        var selectedIcon = null;
        
        async function initPicker() {
            var icons = await loadIcons(iconFolder);
            
            if (!icons.length) {
                grid.innerHTML = '<div class="icon-error" style="grid-column: 1/-1;">No icons found.</div>';
                return;
            }
            
            icons.forEach(function(iconPath) {
                var option = document.createElement('button');
                option.type = 'button';
                option.className = 'icon-option';
                option.dataset.path = iconPath;
                
                var img = document.createElement('img');
                img.src = iconPath;
                img.alt = '';
                img.loading = 'lazy';
                option.appendChild(img);
                
                option.addEventListener('click', function() {
                    grid.querySelectorAll('.icon-option.selected').forEach(function(el) { el.classList.remove('selected'); });
                    option.classList.add('selected');
                    selectedIcon = iconPath;
                    preview.src = iconPath;
                    var filename = iconPath.split('/').pop();
                    label.textContent = filename;
                    popup.hidden = true;
                    btn.setAttribute('aria-expanded', 'false');
                    onSelect(iconPath, filename);
                });
                
                grid.appendChild(option);
            });
        }
        
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var open = !popup.hidden;
            popup.hidden = open;
            btn.setAttribute('aria-expanded', String(!open));
        });
        
        document.addEventListener('click', function(e) {
            if (!picker.contains(e.target)) {
                popup.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                popup.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        
        initPicker();
        
        return {
            getSelected: function() { return selectedIcon; }
        };
    }
    
    return {
        create: create,
        clearCache: function() { iconCache = null; }
    };
})();


/* ============================================================================
   SECTION 6: CURRENCY MENU
   Source: test-currency-menu.html
   ============================================================================ */

const CurrencyMenuComponent = (function(){
    
    // Mock currency data (normally from database)
    var currencyData = [
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
    
    function getCurrencyOptions() {
        if (Array.isArray(window.currencyData) && window.currencyData.length > 0) {
            return window.currencyData;
        }
        return currencyData;
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
                cleanup();
            }
            else if (e.key === 'Enter') {
                var focused = menuElement.querySelector('.menu-option:focus');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        };
        
        var cleanup = function() {
            menuElement.removeEventListener('keydown', keydownHandler);
            if (searchTimeout) clearTimeout(searchTimeout);
            searchString = '';
        };
        
        menuElement.addEventListener('keydown', keydownHandler);
        return cleanup;
    }
    
    function create(wrapperEl, buttonEl, menuEl, options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        
        var opts = getCurrencyOptions();
        opts.forEach(function(opt) {
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
        setData: function(data) { currencyData = data; }
    };
})();


/* ============================================================================
   SECTION 7: PHONE PREFIX MENU
   Source: test-prefix-menu.html
   ============================================================================ */

const PhonePrefixComponent = (function(){
    
    // Mock phone prefix data (normally from database)
    var phonePrefixData = [
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
    
    function getPhonePrefixOptions() {
        if (Array.isArray(window.phonePrefixData) && window.phonePrefixData.length > 0) {
            return window.phonePrefixData;
        }
        return phonePrefixData;
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
                cleanup();
            }
            else if (e.key === 'Enter') {
                var focused = menuElement.querySelector('.menu-option:focus');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        };
        
        var cleanup = function() {
            menuElement.removeEventListener('keydown', keydownHandler);
            if (searchTimeout) clearTimeout(searchTimeout);
            searchString = '';
        };
        
        menuElement.addEventListener('keydown', keydownHandler);
        return cleanup;
    }
    
    function create(wrapperEl, buttonEl, menuEl, phoneInputEl, options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var defaultCountry = options.defaultCountry || 'us';
        
        var opts = getPhonePrefixOptions();
        var defaultOpt = opts.find(function(opt) { return opt.value && opt.value.startsWith(defaultCountry + ' '); }) || opts[0];
        
        if (defaultOpt) {
            var parsed = parsePhonePrefixValue(defaultOpt.value);
            var arrow = buttonEl.querySelector('.dropdown-arrow');
            buttonEl.innerHTML = getPhonePrefixButtonHTML(parsed.countryCode, parsed.prefix);
            if (arrow) buttonEl.appendChild(arrow);
            buttonEl.dataset.value = parsed.prefix;
            buttonEl.dataset.countryCode = parsed.countryCode;
        }
        
        opts.forEach(function(opt) {
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
        
        // Restrict phone input to digits and formatting chars
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
        setData: function(data) { phonePrefixData = data; }
    };
})();


/* ============================================================================
   SECTION 8: GENERIC DROPDOWN MENU (Attribute-based)
   Source: menu-test.html (multi-purpose section)
   ============================================================================ */

const DropdownMenuComponent = (function(){
    
    function initFromAttributes(containerEl) {
        var imageFolder = containerEl.getAttribute('image-folder');
        var textSource = containerEl.getAttribute('text-source');
        var textFormat = containerEl.getAttribute('text-format') || '{value}';
        
        containerEl.innerHTML = '<div class="menu-button"><img class="menu-button-image" src="" alt=""><span class="menu-button-text">Select...</span><span class="menu-button-arrow">▼</span></div><div class="menu-options"></div>';
        
        var btn = containerEl.querySelector('.menu-button');
        var opts = containerEl.querySelector('.menu-options');
        var btnImg = containerEl.querySelector('.menu-button-image');
        var btnText = containerEl.querySelector('.menu-button-text');
        
        if (textSource === 'folder') {
            // Load from folder listing
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
                        };
                        opts.appendChild(op);
                    });
                });
        } else {
            // Load from admin settings picklist
            fetch('/gateway.php?action=get-admin-settings')
                .then(function(r) { return r.json(); })
                .then(function(res) {
                    var data = (res.picklist && res.picklist[textSource]) || [];
                    if (data.length > 0) {
                        btnImg.src = imageFolder + data[0].value.substring(0, 2) + '.svg';
                        btnText.textContent = textFormat.replace('{value}', data[0].value.substring(3)).replace('{label}', data[0].label);
                    }
                    data.forEach(function(item) {
                        var op = document.createElement('div');
                        op.className = 'menu-option';
                        op.innerHTML = '<img class="menu-option-image" src="' + imageFolder + item.value.substring(0, 2) + '.svg" alt=""><span class="menu-option-text">' + textFormat.replace('{value}', item.value.substring(3)).replace('{label}', item.label) + '</span>';
                        op.onclick = function() {
                            btnImg.src = imageFolder + item.value.substring(0, 2) + '.svg';
                            btnText.textContent = textFormat.replace('{value}', item.value.substring(3)).replace('{label}', item.label);
                            containerEl.classList.remove('open');
                        };
                        opts.appendChild(op);
                    });
                });
        }
        
        btn.onclick = function() {
            containerEl.classList.toggle('open');
        };
        
        document.addEventListener('click', function(e) {
            if (!containerEl.contains(e.target)) {
                containerEl.classList.remove('open');
            }
        });
    }
    
    return {
        initFromAttributes: initFromAttributes
    };
})();


