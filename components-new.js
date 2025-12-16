/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   STRUCTURE:
   1. FIELDSETS           - Form field types
   2. CALENDAR            - Horizontal scrolling date picker
   3. CURRENCY            - Currency selector (compact + full)
   4. PHONE PREFIX        - Phone prefix selector
   5. ICON PICKER         - Category icon picker
   6. SYSTEM IMAGE PICKER - System image picker
   
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
        picker.className = 'iconpicker';
        
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
        picker.className = 'systemimagepicker';
        
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

