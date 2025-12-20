/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   STRUCTURE:
   - ICONS               - SVG icon library (JS only, no CSS needed)
   - MENU MANAGER        - Global manager for closing menus
   - CLEAR BUTTON        - Reusable X/clear button
   - SWITCH              - Toggle switch (has size variants)
   - FIELDSETS           - Form field types
   - CALENDAR            - Horizontal scrolling date picker
   - CURRENCY            - Currency selector (has variants)
   - PHONE PREFIX        - Phone prefix selector
   - ICON PICKER         - Category icon picker
   - SYSTEM IMAGE PICKER - System image picker
   - MAP CONTROL ROW     - Geocoder + Geolocate + Compass (has variants)
   - CHECKOUT OPTIONS    - Radio card selector for checkout tiers
   - CONFIRM DIALOG      - Confirmation dialog for destructive actions
   
   ============================================================================ */

console.log('[components.js] Components loaded');


/* ============================================================================
   ICONS
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
   MENU MANAGER
   Global manager to close all open menus when clicking outside or opening another
   ============================================================================ */

const MenuManager = (function(){
    var openMenus = [];
    
    // Close all open menus
    function closeAll(except) {
        openMenus.forEach(function(menu) {
            if (menu !== except && menu.classList.contains('open')) {
                menu.classList.remove('open');
            }
        });
    }
    
    // Register a menu element
    function register(menuElement) {
        if (openMenus.indexOf(menuElement) === -1) {
            openMenus.push(menuElement);
        }
    }
    
    // Close all menus when clicking outside
    document.addEventListener('click', function(e) {
        openMenus.forEach(function(menu) {
            if (!menu.contains(e.target)) {
                menu.classList.remove('open');
            }
        });
    });
    
    return {
        closeAll: closeAll,
        register: register
    };
})();

window.MenuManager = MenuManager;


/* ============================================================================
   CLEAR BUTTON
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
   SWITCH
   Toggle switch component with size variants
   ============================================================================ */

const SwitchComponent = (function(){
    
    /**
     * Create a new switch element
     * @param {Object} options - Configuration options
     * @param {string} options.size - Size variant: 'small', 'medium' (default), 'large'
     * @param {boolean} options.checked - Initial checked state
     * @param {string} options.name - Input name attribute
     * @param {string} options.id - Input id attribute
     * @param {string} options.ariaLabel - Accessible label
     * @param {Function} options.onChange - Change handler (receives checked state)
     * @returns {Object} Object with element and control methods
     */
    function create(options) {
        options = options || {};
        
        var size = options.size || 'medium';
        var checked = options.checked || false;
        
        // Build class prefix based on size
        var prefix = size === 'medium' ? 'component-switch' : 'component-' + size + '-switch';
        
        var label = document.createElement('label');
        label.className = prefix;
        
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.className = prefix + '-input';
        input.checked = checked;
        if (options.name) input.name = options.name;
        if (options.id) input.id = options.id;
        if (options.ariaLabel) input.setAttribute('aria-label', options.ariaLabel);
        
        var slider = document.createElement('span');
        slider.className = prefix + '-slider';
        
        label.appendChild(input);
        label.appendChild(slider);
        
        if (typeof options.onChange === 'function') {
            input.addEventListener('change', function() {
                options.onChange(input.checked);
            });
        }
        
        return {
            element: label,
            input: input,
            isChecked: function() {
                return input.checked;
            },
            setChecked: function(value) {
                input.checked = !!value;
            },
            toggle: function() {
                input.checked = !input.checked;
                if (typeof options.onChange === 'function') {
                    options.onChange(input.checked);
                }
            }
        };
    }
    
    return {
        create: create
    };
})();


/* ============================================================================
   FIELDSETS
   Source: fieldset-test.html
   ============================================================================ */

const FieldsetComponent = (function(){
    var picklist = {};
    var dataLoaded = false;
    var loadPromise = null;
    
    // Load picklist data from database
    function loadFromDatabase() {
        if (loadPromise) return loadPromise;
        loadPromise = fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.picklist) {
                    picklist = res.picklist;
                    dataLoaded = true;
                }
                return picklist;
            });
        return loadPromise;
    }
    
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
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        btn.onclick = function(e) {
            e.stopPropagation();
            // Close all other menus first
            MenuManager.closeAll(menu);
            menu.classList.toggle('open');
        };
        
        return menu;
    }
    
    // Build phone prefix menu (120px compact, same style as currency)
    function buildPhonePrefixMenu(container) {
        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="assets/flags/us.svg" alt=""><span class="fieldset-menu-button-text">+1</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        
        // Default is hardcoded to US (+1) - set in innerHTML above
        var prefixes = picklist['phone-prefix'] || [];

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
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        btn.onclick = function(e) {
            e.stopPropagation();
            // Close all other menus first
            MenuManager.closeAll(menu);
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
    
    // Set picklist data and propagate to external components
    function setPicklist(data) {
        picklist = data || {};
        // Also set data in Currency and PhonePrefix components
        if (data && data.currency && typeof CurrencyComponent !== 'undefined') {
            CurrencyComponent.setData(data.currency);
        }
        if (data && data['phone-prefix'] && typeof PhonePrefixComponent !== 'undefined') {
            PhonePrefixComponent.setData(data['phone-prefix']);
        }
    }
    
    /**
     * Build a complete fieldset element based on field type
     * @param {Object} fieldData - Field configuration from the form snapshot
     * @param {Object} options - Additional options
     * @param {string} options.idPrefix - Prefix for element IDs (default 'fieldset')
     * @param {number} options.fieldIndex - Index for unique radio group names
     * @param {HTMLElement} options.container - Parent container (for closing menus)
     * @returns {HTMLElement} Complete fieldset element
     */
    function buildFieldset(fieldData, options) {
        options = options || {};
        var idPrefix = options.idPrefix || 'fieldset';
        var index = options.fieldIndex || 0;
        var container = options.container || null;
        
        var fieldset = document.createElement('div');
        fieldset.className = 'fieldset';
        
        var key = fieldData.fieldset_key || fieldData.key || '';
        var name = fieldData.fieldset_name || fieldData.name || 'Unnamed';
        var tooltip = fieldData.fieldset_tooltip || '';
        var placeholder = fieldData.fieldset_placeholder || '';
        var minLength = fieldData.min_length || 0;
        var maxLength = fieldData.max_length || 500;
        var fieldOptions = fieldData.fieldset_options || fieldData.options || [];
        var fields = fieldData.fieldset_fields || [];
        
        // Build based on fieldset type
        switch (key) {
            case 'title':
                fieldset.appendChild(buildLabel(name, tooltip));
                var titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'fieldset-input';
                titleInput.placeholder = placeholder;
                var titleValidation = addInputValidation(titleInput, minLength, maxLength, null);
                fieldset.appendChild(titleInput);
                fieldset.appendChild(titleValidation.charCount);
                break;
            
            case 'coupon':
                fieldset.appendChild(buildLabel(name, tooltip));
                var couponInput = document.createElement('input');
                couponInput.type = 'text';
                couponInput.className = 'fieldset-input';
                couponInput.placeholder = placeholder;
                var couponValidation = addInputValidation(couponInput, minLength, maxLength, null);
                fieldset.appendChild(couponInput);
                fieldset.appendChild(couponValidation.charCount);
                break;
                
            case 'description':
                fieldset.appendChild(buildLabel(name, tooltip));
                var descTextarea = document.createElement('textarea');
                descTextarea.className = 'fieldset-textarea';
                descTextarea.placeholder = placeholder;
                var descValidation = addInputValidation(descTextarea, minLength, maxLength, null);
                fieldset.appendChild(descTextarea);
                fieldset.appendChild(descValidation.charCount);
                break;
                
            case 'text-box':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip));
                var textBoxInput = document.createElement('input');
                textBoxInput.type = 'text';
                textBoxInput.className = 'fieldset-input';
                textBoxInput.placeholder = placeholder;
                var textBoxValidation = addInputValidation(textBoxInput, minLength, maxLength, null);
                fieldset.appendChild(textBoxInput);
                fieldset.appendChild(textBoxValidation.charCount);
                break;
                
            case 'text-area':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip));
                var editableTextarea = document.createElement('textarea');
                editableTextarea.className = 'fieldset-textarea';
                editableTextarea.placeholder = placeholder;
                var textareaValidation = addInputValidation(editableTextarea, minLength, maxLength, null);
                fieldset.appendChild(editableTextarea);
                fieldset.appendChild(textareaValidation.charCount);
                break;
                
            case 'dropdown':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip));
                var select = document.createElement('select');
                select.className = 'fieldset-select';
                select.innerHTML = '<option value="">Select an option...</option>';
                if (Array.isArray(fieldOptions)) {
                    fieldOptions.forEach(function(opt) {
                        var option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        select.appendChild(option);
                    });
                }
                fieldset.appendChild(select);
                break;
                
            case 'radio':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip));
                var radioGroup = document.createElement('div');
                radioGroup.className = 'fieldset-radio-group';
                if (Array.isArray(fieldOptions)) {
                    fieldOptions.forEach(function(opt, i) {
                        var radio = document.createElement('label');
                        radio.className = 'fieldset-radio';
                        radio.innerHTML = '<input type="radio" name="radio-' + index + '" class="fieldset-radio-input" value="' + opt + '"><span class="fieldset-radio-text">' + opt + '</span>';
                        radioGroup.appendChild(radio);
                    });
                }
                fieldset.appendChild(radioGroup);
                break;
                
            case 'email':
                fieldset.appendChild(buildLabel(name, tooltip));
                var emailInput = document.createElement('input');
                emailInput.type = 'email';
                emailInput.className = 'fieldset-input';
                emailInput.placeholder = placeholder;
                var emailValidation = addInputValidation(emailInput, minLength, maxLength, isValidEmail);
                fieldset.appendChild(emailInput);
                fieldset.appendChild(emailValidation.charCount);
                break;
                
            case 'phone':
                fieldset.appendChild(buildLabel(name, tooltip));
                var phoneRow = document.createElement('div');
                phoneRow.className = 'fieldset-row';
                phoneRow.appendChild(buildPhonePrefixMenu(container));
                var phoneInput = document.createElement('input');
                phoneInput.type = 'tel';
                phoneInput.className = 'fieldset-input';
                phoneInput.placeholder = placeholder;
                makePhoneDigitsOnly(phoneInput);
                var phoneValidation = addInputValidation(phoneInput, minLength, maxLength, null);
                phoneRow.appendChild(phoneInput);
                fieldset.appendChild(phoneRow);
                fieldset.appendChild(phoneValidation.charCount);
                break;
                
            case 'address':
            case 'location': // legacy support
                fieldset.appendChild(buildLabel(name, tooltip));
                var addrInputEl = document.createElement('input');
                addrInputEl.type = 'text';
                addrInputEl.className = 'fieldset-input';
                addrInputEl.placeholder = placeholder || 'Search for address...';
                fieldset.appendChild(addrInputEl);
                // Hidden lat/lng fields
                var addrLatInput = document.createElement('input');
                addrLatInput.type = 'hidden';
                addrLatInput.className = 'fieldset-lat';
                var addrLngInput = document.createElement('input');
                addrLngInput.type = 'hidden';
                addrLngInput.className = 'fieldset-lng';
                fieldset.appendChild(addrLatInput);
                fieldset.appendChild(addrLngInput);
                // Status indicator
                var addrStatus = document.createElement('div');
                addrStatus.className = 'fieldset-location-status';
                fieldset.appendChild(addrStatus);
                // Init Google Places
                initGooglePlaces(addrInputEl, 'address', addrLatInput, addrLngInput, addrStatus);
                break;
                
            case 'city':
                fieldset.appendChild(buildLabel(name, tooltip));
                var cityInputEl = document.createElement('input');
                cityInputEl.type = 'text';
                cityInputEl.className = 'fieldset-input';
                cityInputEl.placeholder = placeholder || 'Search for city or town...';
                fieldset.appendChild(cityInputEl);
                // Hidden lat/lng fields
                var cityLatInput = document.createElement('input');
                cityLatInput.type = 'hidden';
                cityLatInput.className = 'fieldset-lat';
                var cityLngInput = document.createElement('input');
                cityLngInput.type = 'hidden';
                cityLngInput.className = 'fieldset-lng';
                fieldset.appendChild(cityLatInput);
                fieldset.appendChild(cityLngInput);
                // Status indicator
                var cityStatus = document.createElement('div');
                cityStatus.className = 'fieldset-location-status';
                fieldset.appendChild(cityStatus);
                // Init Google Places (cities only)
                initGooglePlaces(cityInputEl, '(cities)', cityLatInput, cityLngInput, cityStatus);
                break;
                
            case 'website-url':
            case 'tickets-url':
                fieldset.appendChild(buildLabel(name, tooltip));
                var urlInput = document.createElement('input');
                urlInput.type = 'text'; // text not url, we handle protocol
                urlInput.className = 'fieldset-input';
                urlInput.placeholder = placeholder;
                autoUrlProtocol(urlInput);
                var urlValidation = addInputValidation(urlInput, minLength, maxLength, isValidUrl);
                fieldset.appendChild(urlInput);
                fieldset.appendChild(urlValidation.charCount);
                break;
                
            case 'images':
                fieldset.appendChild(buildLabel(name, tooltip));

                var imagesContainer = document.createElement('div');
                imagesContainer.className = 'fieldset-images-container';

                var imageFiles = [];
                var maxImages = 10;

                function renderImages() {
                    imagesContainer.innerHTML = '';

                    // Show existing images
                    imageFiles.forEach(function(file, idx) {
                        var thumb = document.createElement('div');
                        thumb.className = 'fieldset-image-thumb';

                        var img = document.createElement('img');
                        img.className = 'fieldset-image-thumb-img';
                        img.src = URL.createObjectURL(file);
                        thumb.appendChild(img);

                        var removeBtn = document.createElement('button');
                        removeBtn.type = 'button';
                        removeBtn.className = 'fieldset-image-thumb-remove';
                        removeBtn.textContent = '×';
                        (function(idx) {
                            removeBtn.addEventListener('click', function() {
                                imageFiles.splice(idx, 1);
                                renderImages();
                            });
                        })(idx);
                        thumb.appendChild(removeBtn);

                        imagesContainer.appendChild(thumb);
                    });

                    // Show upload button if under max
                    if (imageFiles.length < maxImages) {
                        var uploadBox = document.createElement('div');
                        uploadBox.className = 'fieldset-images';
                        uploadBox.innerHTML = '<div class="fieldset-images-icon">📷</div><div class="fieldset-images-text">Add</div>';
                        uploadBox.addEventListener('click', function() {
                            fileInput.click();
                        });
                        imagesContainer.appendChild(uploadBox);
                    }
                }
                
                var fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.multiple = true;
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', function() {
                    var files = Array.from(this.files);
                    files.forEach(function(file) {
                        if (imageFiles.length < maxImages && file.type.startsWith('image/')) {
                            imageFiles.push(file);
                        }
                    });
                    renderImages();
                    this.value = '';
                });
                fieldset.appendChild(fileInput);
                fieldset.appendChild(imagesContainer);
                
                renderImages();
                break;
            
            case 'amenities':
                fieldset.appendChild(buildLabel(name, tooltip));
                var amenitiesGrid = document.createElement('div');
                amenitiesGrid.className = 'fieldset-amenities';
                
                // Get amenities from picklist table
                var amenities = picklist['amenity'] || [];
                
                amenities.forEach(function(item, i) {
                    // Parse value: "parking Parking" -> icon: parking, name: Parking
                    var parts = item.value.split(' ');
                    var iconKey = parts[0];
                    var amenityName = parts.slice(1).join(' ');
                    var description = item.label;
                    
                    var row = document.createElement('div');
                    row.className = 'fieldset-amenity-row';
                    row.title = description; // Tooltip on hover
                    
                    // Icon
                    var iconEl = document.createElement('div');
                    iconEl.className = 'fieldset-amenity-icon';
                    iconEl.innerHTML = '<img src="assets/amenities/' + iconKey + '.svg" alt="' + amenityName + '">';
                    row.appendChild(iconEl);
                    
                    // Name
                    var nameEl = document.createElement('div');
                    nameEl.className = 'fieldset-amenity-name';
                    nameEl.textContent = amenityName;
                    row.appendChild(nameEl);
                    
                    // Yes/No options
                    var optionsEl = document.createElement('div');
                    optionsEl.className = 'fieldset-amenity-options';
                    
                    var yesLabel = document.createElement('label');
                    yesLabel.className = 'fieldset-amenity-option';
                    yesLabel.innerHTML = '<input type="radio" name="amenity-' + iconKey + '" value="1"> Yes';
                    optionsEl.appendChild(yesLabel);
                    
                    var noLabel = document.createElement('label');
                    noLabel.className = 'fieldset-amenity-option';
                    noLabel.innerHTML = '<input type="radio" name="amenity-' + iconKey + '" value="0"> No';
                    optionsEl.appendChild(noLabel);
                    
                    // Add change listeners to update row styling
                    var yesRadio = yesLabel.querySelector('input');
                    var noRadio = noLabel.querySelector('input');
                    
                    yesRadio.addEventListener('change', function() {
                        row.classList.remove('selected-no');
                        row.classList.add('selected-yes');
                    });
                    
                    noRadio.addEventListener('change', function() {
                        row.classList.remove('selected-yes');
                        row.classList.add('selected-no');
                    });
                    
                    row.appendChild(optionsEl);
                    amenitiesGrid.appendChild(row);
                });
                
                fieldset.appendChild(amenitiesGrid);
                break;
                
            case 'item-pricing':
                // Item Name (full width), then variants with currency + price
                fieldset.appendChild(buildLabel(name, tooltip));
                
                // Track shared currency state for item pricing
                var itemCurrencyState = { flag: 'us', code: 'USD' };
                var itemCurrencyMenus = [];
                
                function syncAllItemCurrencies() {
                    itemCurrencyMenus.forEach(function(menu) {
                        var img = menu.querySelector('.fieldset-menu-button-image');
                        var text = menu.querySelector('.fieldset-menu-button-text');
                        img.src = 'assets/flags/' + itemCurrencyState.flag + '.svg';
                        text.textContent = itemCurrencyState.code;
                    });
                }
                
                function buildItemCurrencyMenu() {
                    var menu = document.createElement('div');
                    menu.className = 'fieldset-menu fieldset-currency-compact';
                    menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="assets/flags/' + itemCurrencyState.flag + '.svg" alt=""><span class="fieldset-menu-button-text">' + itemCurrencyState.code + '</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
                    
                    var btn = menu.querySelector('.fieldset-menu-button');
                    var opts = menu.querySelector('.fieldset-menu-options');
                    
                    var currencies = picklist['currency'] || [];
                    currencies.forEach(function(item) {
                        var op = document.createElement('div');
                        op.className = 'fieldset-menu-option';
                        op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + item.value.substring(0,2) + '.svg" alt=""><span class="fieldset-menu-option-text">' + item.value.substring(3) + ' - ' + item.label + '</span>';
                        op.onclick = function(e) {
                            e.stopPropagation();
                            itemCurrencyState.flag = item.value.substring(0,2);
                            itemCurrencyState.code = item.value.substring(3);
                            syncAllItemCurrencies();
                            menu.classList.remove('open');
                        };
                        opts.appendChild(op);
                    });
                    
                    // Register with MenuManager
                    MenuManager.register(menu);
                    
                    btn.onclick = function(e) {
                        e.stopPropagation();
                        // Close all other menus first
                        MenuManager.closeAll(menu);
                        menu.classList.toggle('open');
                    };
                    
                    itemCurrencyMenus.push(menu);
                    return menu;
                }
                
                // Item Name (single, no +/-)
                var itemNameSub = document.createElement('div');
                itemNameSub.className = 'fieldset-sublabel';
                itemNameSub.textContent = 'Item Name';
                fieldset.appendChild(itemNameSub);
                var itemNameInput = document.createElement('input');
                itemNameInput.type = 'text';
                itemNameInput.className = 'fieldset-input';
                itemNameInput.placeholder = 'eg. T-Shirt';
                itemNameInput.style.marginBottom = '10px';
                fieldset.appendChild(itemNameInput);
                
                // Variants container
                var itemVariantsContainer = document.createElement('div');
                itemVariantsContainer.className = 'fieldset-variants-container';
                fieldset.appendChild(itemVariantsContainer);
                
                function createItemVariantBlock() {
                    var block = document.createElement('div');
                    block.className = 'fieldset-variant-block';
                    block.style.marginBottom = '10px';
                    block.style.marginLeft = '20px';
                    
                    // Row 1: Variant input + +/- buttons
                    var variantRow = document.createElement('div');
                    variantRow.className = 'fieldset-row';
                    variantRow.style.marginBottom = '10px';
                    
                    var variantCol = document.createElement('div');
                    variantCol.style.flex = '1';
                    var variantSub = document.createElement('div');
                    variantSub.className = 'fieldset-sublabel';
                    variantSub.textContent = 'Item Variant';
                    var variantInput = document.createElement('input');
                    variantInput.type = 'text';
                    variantInput.className = 'fieldset-input';
                    variantInput.placeholder = 'eg. Large Red';
                    variantCol.appendChild(variantSub);
                    variantCol.appendChild(variantInput);
                    variantRow.appendChild(variantCol);
                    
                    // + button
                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-pricing-add';
                    addBtn.textContent = '+';
                    addBtn.addEventListener('click', function() {
                        itemVariantsContainer.appendChild(createItemVariantBlock());
                        updateItemVariantButtons();
                    });
                    variantRow.appendChild(addBtn);
                    
                    // - button
                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-pricing-remove';
                    removeBtn.textContent = '−';
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        // Remove from tracked menus
                        var blockMenu = block.querySelector('.fieldset-currency-compact');
                        var idx = itemCurrencyMenus.indexOf(blockMenu);
                        if (idx > -1) itemCurrencyMenus.splice(idx, 1);
                        updateItemVariantButtons();
                    });
                    variantRow.appendChild(removeBtn);
                    
                    block.appendChild(variantRow);
                    
                    // Row 2: Currency + Price (cropped to align under variant)
                    var priceRow = document.createElement('div');
                    priceRow.className = 'fieldset-row';
                    priceRow.style.marginRight = '92px'; // 10px gap + 36px + 10px + 36px
                    
                    var currencyCol = document.createElement('div');
                    currencyCol.style.flex = '0 0 100px';
                    var currencySub = document.createElement('div');
                    currencySub.className = 'fieldset-sublabel';
                    currencySub.textContent = 'Currency';
                    currencyCol.appendChild(currencySub);
                    currencyCol.appendChild(buildItemCurrencyMenu());
                    priceRow.appendChild(currencyCol);
                    
                    var priceCol = document.createElement('div');
                    priceCol.style.flex = '1';
                    var priceSub = document.createElement('div');
                    priceSub.className = 'fieldset-sublabel';
                    priceSub.textContent = 'Price';
                    var priceInput = document.createElement('input');
                    priceInput.type = 'text';
                    priceInput.inputMode = 'decimal';
                    priceInput.className = 'fieldset-input';
                    priceInput.placeholder = '0.00';
                    priceInput.addEventListener('blur', function() {
                        if (this.value !== '') {
                            this.value = parseFloat(this.value).toFixed(2);
                        }
                    });
                    priceCol.appendChild(priceSub);
                    priceCol.appendChild(priceInput);
                    priceRow.appendChild(priceCol);
                    
                    block.appendChild(priceRow);
                    
                    return block;
                }
                
                function updateItemVariantButtons() {
                    var blocks = itemVariantsContainer.querySelectorAll('.fieldset-variant-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block) {
                        var addBtn = block.querySelector('.fieldset-pricing-add');
                        var removeBtn = block.querySelector('.fieldset-pricing-remove');
                        if (atMax) {
                            addBtn.style.opacity = '0.3';
                            addBtn.style.cursor = 'not-allowed';
                            addBtn.disabled = true;
                        } else {
                            addBtn.style.opacity = '1';
                            addBtn.style.cursor = 'pointer';
                            addBtn.disabled = false;
                        }
                        if (blocks.length === 1) {
                            removeBtn.style.opacity = '0.3';
                            removeBtn.style.cursor = 'not-allowed';
                            removeBtn.disabled = true;
                        } else {
                            removeBtn.style.opacity = '1';
                            removeBtn.style.cursor = 'pointer';
                            removeBtn.disabled = false;
                        }
                    });
                }
                
                // Create first variant block
                itemVariantsContainer.appendChild(createItemVariantBlock());
                updateItemVariantButtons();
                break;
                
            case 'ticket-pricing':
                // Seating Areas container with nested Pricing Tiers
                fieldset.appendChild(buildLabel(name, tooltip));
                
                var seatingAreasContainer = document.createElement('div');
                seatingAreasContainer.className = 'fieldset-seating-areas-container';
                fieldset.appendChild(seatingAreasContainer);
                
                // Track shared currency state
                var ticketCurrencyState = { flag: 'us', code: 'USD' };
                var ticketCurrencyMenus = [];
                
                function syncAllTicketCurrencies() {
                    ticketCurrencyMenus.forEach(function(menu) {
                        var img = menu.querySelector('.fieldset-menu-button-image');
                        var text = menu.querySelector('.fieldset-menu-button-text');
                        img.src = 'assets/flags/' + ticketCurrencyState.flag + '.svg';
                        text.textContent = ticketCurrencyState.code;
                    });
                }
                
                function buildTicketCurrencyMenu() {
                    var menu = document.createElement('div');
                    menu.className = 'fieldset-menu fieldset-currency-compact';
                    menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="assets/flags/' + ticketCurrencyState.flag + '.svg" alt=""><span class="fieldset-menu-button-text">' + ticketCurrencyState.code + '</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
                    
                    var btn = menu.querySelector('.fieldset-menu-button');
                    var opts = menu.querySelector('.fieldset-menu-options');
                    
                    var currencies = picklist['currency'] || [];
                    currencies.forEach(function(item) {
                        var op = document.createElement('div');
                        op.className = 'fieldset-menu-option';
                        op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + item.value.substring(0,2) + '.svg" alt=""><span class="fieldset-menu-option-text">' + item.value.substring(3) + ' - ' + item.label + '</span>';
                        op.onclick = function(e) {
                            e.stopPropagation();
                            ticketCurrencyState.flag = item.value.substring(0,2);
                            ticketCurrencyState.code = item.value.substring(3);
                            syncAllTicketCurrencies();
                            menu.classList.remove('open');
                        };
                        opts.appendChild(op);
                    });
                    
                    // Register with MenuManager
                    MenuManager.register(menu);
                    
                    btn.onclick = function(e) {
                        e.stopPropagation();
                        // Close all other menus first
                        MenuManager.closeAll(menu);
                        menu.classList.toggle('open');
                    };
                    
                    ticketCurrencyMenus.push(menu);
                    return menu;
                }
                
                function createPricingTierBlock(tiersContainer) {
                    var block = document.createElement('div');
                    block.className = 'fieldset-tier-block';
                    block.style.marginBottom = '10px';
                    block.style.marginLeft = '20px';
                    
                    // Row 1: Tier name + +/- buttons
                    var tierRow = document.createElement('div');
                    tierRow.className = 'fieldset-row';
                    tierRow.style.marginBottom = '10px';
                    
                    var tierCol = document.createElement('div');
                    tierCol.style.flex = '1';
                    var tierSub = document.createElement('div');
                    tierSub.className = 'fieldset-sublabel';
                    tierSub.textContent = 'Pricing Tier';
                    var tierInput = document.createElement('input');
                    tierInput.type = 'text';
                    tierInput.className = 'fieldset-input';
                    tierInput.placeholder = 'eg. Adult';
                    tierCol.appendChild(tierSub);
                    tierCol.appendChild(tierInput);
                    tierRow.appendChild(tierCol);
                    
                    // + button
                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-pricing-add';
                    addBtn.textContent = '+';
                    addBtn.addEventListener('click', function() {
                        tiersContainer.appendChild(createPricingTierBlock(tiersContainer));
                        updateTierButtons(tiersContainer);
                    });
                    tierRow.appendChild(addBtn);
                    
                    // - button
                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-pricing-remove';
                    removeBtn.textContent = '−';
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        // Remove from tracked menus
                        var blockMenu = block.querySelector('.fieldset-currency-compact');
                        var idx = ticketCurrencyMenus.indexOf(blockMenu);
                        if (idx > -1) ticketCurrencyMenus.splice(idx, 1);
                        updateTierButtons(tiersContainer);
                    });
                    tierRow.appendChild(removeBtn);
                    
                    block.appendChild(tierRow);
                    
                    // Row 2: Currency + Price (cropped to align under tier)
                    var priceRow = document.createElement('div');
                    priceRow.className = 'fieldset-row';
                    priceRow.style.marginRight = '92px'; // 10px gap + 36px + 10px + 36px
                    
                    var currencyCol = document.createElement('div');
                    currencyCol.style.flex = '0 0 100px';
                    var currencySub = document.createElement('div');
                    currencySub.className = 'fieldset-sublabel';
                    currencySub.textContent = 'Currency';
                    currencyCol.appendChild(currencySub);
                    currencyCol.appendChild(buildTicketCurrencyMenu());
                    priceRow.appendChild(currencyCol);
                    
                    var priceCol = document.createElement('div');
                    priceCol.style.flex = '1';
                    var priceSub = document.createElement('div');
                    priceSub.className = 'fieldset-sublabel';
                    priceSub.textContent = 'Price';
                    var priceInput = document.createElement('input');
                    priceInput.type = 'text';
                    priceInput.inputMode = 'decimal';
                    priceInput.className = 'fieldset-input';
                    priceInput.placeholder = '0.00';
                    priceInput.addEventListener('blur', function() {
                        if (this.value !== '') {
                            this.value = parseFloat(this.value).toFixed(2);
                        }
                    });
                    priceCol.appendChild(priceSub);
                    priceCol.appendChild(priceInput);
                    priceRow.appendChild(priceCol);
                    
                    block.appendChild(priceRow);
                    
                    return block;
                }
                
                function updateTierButtons(tiersContainer) {
                    var blocks = tiersContainer.querySelectorAll('.fieldset-tier-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block) {
                        var addBtn = block.querySelector('.fieldset-pricing-add');
                        var removeBtn = block.querySelector('.fieldset-pricing-remove');
                        // + button: grey out at cap
                        if (atMax) {
                            addBtn.style.opacity = '0.3';
                            addBtn.style.cursor = 'not-allowed';
                            addBtn.disabled = true;
                        } else {
                            addBtn.style.opacity = '1';
                            addBtn.style.cursor = 'pointer';
                            addBtn.disabled = false;
                        }
                        // - button: grey out when only 1
                        if (blocks.length === 1) {
                            removeBtn.style.opacity = '0.3';
                            removeBtn.style.cursor = 'not-allowed';
                            removeBtn.disabled = true;
                        } else {
                            removeBtn.style.opacity = '1';
                            removeBtn.style.cursor = 'pointer';
                            removeBtn.disabled = false;
                        }
                    });
                }
                
                function createSeatingAreaBlock() {
                    var block = document.createElement('div');
                    block.className = 'fieldset-seating-block';
                    block.style.marginBottom = '20px';
                    block.style.paddingBottom = '10px';
                    block.style.borderBottom = '1px solid #333';
                    
                    // Seating Area row
                    var seatRow = document.createElement('div');
                    seatRow.className = 'fieldset-row';
                    seatRow.style.marginBottom = '10px';
                    
                    var seatCol = document.createElement('div');
                    seatCol.style.flex = '1';
                    var seatSub = document.createElement('div');
                    seatSub.className = 'fieldset-sublabel';
                    seatSub.textContent = 'Seating Area';
                    var seatInput = document.createElement('input');
                    seatInput.type = 'text';
                    seatInput.className = 'fieldset-input';
                    seatInput.placeholder = 'eg. Orchestra';
                    seatCol.appendChild(seatSub);
                    seatCol.appendChild(seatInput);
                    seatRow.appendChild(seatCol);
                    
                    // + button for seating area
                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-pricing-add';
                    addBtn.textContent = '+';
                    addBtn.addEventListener('click', function() {
                        seatingAreasContainer.appendChild(createSeatingAreaBlock());
                        updateSeatingAreaButtons();
                    });
                    seatRow.appendChild(addBtn);
                    
                    // - button for seating area
                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-pricing-remove';
                    removeBtn.textContent = '−';
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        updateSeatingAreaButtons();
                    });
                    seatRow.appendChild(removeBtn);
                    
                    block.appendChild(seatRow);
                    
                    // Pricing tiers container for this seating area
                    var tiersContainer = document.createElement('div');
                    tiersContainer.className = 'fieldset-tiers-container';
                    tiersContainer.appendChild(createPricingTierBlock(tiersContainer));
                    updateTierButtons(tiersContainer);
                    block.appendChild(tiersContainer);
                    
                    return block;
                }
                
                function updateSeatingAreaButtons() {
                    var blocks = seatingAreasContainer.querySelectorAll('.fieldset-seating-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block) {
                        var addBtn = block.querySelector('.fieldset-row > .fieldset-pricing-add');
                        var removeBtn = block.querySelector('.fieldset-row > .fieldset-pricing-remove');
                        // + button: grey out at cap
                        if (atMax) {
                            addBtn.style.opacity = '0.3';
                            addBtn.style.cursor = 'not-allowed';
                            addBtn.disabled = true;
                        } else {
                            addBtn.style.opacity = '1';
                            addBtn.style.cursor = 'pointer';
                            addBtn.disabled = false;
                        }
                        // - button: grey out when only 1
                        if (blocks.length === 1) {
                            removeBtn.style.opacity = '0.3';
                            removeBtn.style.cursor = 'not-allowed';
                            removeBtn.disabled = true;
                        } else {
                            removeBtn.style.opacity = '1';
                            removeBtn.style.cursor = 'pointer';
                            removeBtn.disabled = false;
                        }
                    });
                }
                
                // Create first seating area
                seatingAreasContainer.appendChild(createSeatingAreaBlock());
                updateSeatingAreaButtons();
                break;
                
            case 'sessions':
                // Horizontal scrolling calendar + auto-generated session rows with autofill
                fieldset.appendChild(buildLabel(name, tooltip));
                
                // Track selected dates: { '2025-01-15': { times: ['19:00', ''], edited: [true, false] }, ... }
                var sessionData = {};
                
                var today = new Date();
                today.setHours(0, 0, 0, 0);
                var todayIso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                
                var minDate = new Date(today.getFullYear(), today.getMonth(), 1);
                var maxDate = new Date(today.getFullYear(), today.getMonth() + 24, 1);
                
                var todayMonthEl = null;
                var todayMonthIndex = 0;
                var totalMonths = 0;
                var weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                
                function toISODate(d) {
                    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                }
                
                function getDayOfWeek(dateStr) {
                    var d = new Date(dateStr + 'T00:00:00');
                    return d.getDay();
                }
                
                // Calendar container
                var calContainer = document.createElement('div');
                calContainer.className = 'fieldset-calendar-container';
                
                var calScroll = document.createElement('div');
                calScroll.className = 'fieldset-calendar-scroll';
                
                var calendar = document.createElement('div');
                calendar.className = 'fieldset-calendar';
                
                // Build months
                var current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                var monthIdx = 0;
                while (current <= maxDate) {
                    var monthEl = document.createElement('div');
                    monthEl.className = 'fieldset-calendar-month';
                    
                    var header = document.createElement('div');
                    header.className = 'fieldset-calendar-header';
                    header.textContent = current.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                    monthEl.appendChild(header);
                    
                    var grid = document.createElement('div');
                    grid.className = 'fieldset-calendar-grid';
                    
                    weekdayNames.forEach(function(wd) {
                        var w = document.createElement('div');
                        w.className = 'fieldset-calendar-weekday';
                        w.textContent = wd;
                        grid.appendChild(w);
                    });
                    
                    var firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
                    var startDow = firstDay.getDay();
                    var daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
                    
                    for (var i = 0; i < 42; i++) {
                        var cell = document.createElement('div');
                        cell.className = 'fieldset-calendar-day';
                        var dayNum = i - startDow + 1;
                        
                        if (i < startDow || dayNum > daysInMonth) {
                            cell.classList.add('empty');
                        } else {
                            cell.textContent = dayNum;
                            var dateObj = new Date(current.getFullYear(), current.getMonth(), dayNum);
                            dateObj.setHours(0, 0, 0, 0);
                            var iso = toISODate(dateObj);
                            cell.dataset.iso = iso;
                            
                            if (dateObj < today) {
                                cell.classList.add('past');
                            } else {
                                cell.classList.add('future');
                            }
                            
                            if (iso === todayIso) {
                                cell.classList.add('today');
                                todayMonthEl = monthEl;
                                todayMonthIndex = monthIdx;
                            }
                        }
                        grid.appendChild(cell);
                    }
                    
                    monthEl.appendChild(grid);
                    calendar.appendChild(monthEl);
                    current.setMonth(current.getMonth() + 1);
                    monthIdx++;
                }
                totalMonths = monthIdx;
                
                calScroll.appendChild(calendar);
                calContainer.appendChild(calScroll);
                
                // Today marker
                var marker = document.createElement('div');
                marker.className = 'fieldset-calendar-today-marker';
                calContainer.appendChild(marker);
                
                fieldset.appendChild(calContainer);
                
                // Sessions container (below calendar)
                var sessionsContainer = document.createElement('div');
                sessionsContainer.className = 'fieldset-sessions';
                fieldset.appendChild(sessionsContainer);
                
                // Position marker dynamically based on today's month index
                setTimeout(function() {
                    if (todayMonthEl) {
                        calScroll.scrollLeft = todayMonthEl.offsetLeft;
                    }
                    var markerFraction = (todayMonthIndex + 0.5) / totalMonths;
                    var markerPos = markerFraction * (calContainer.clientWidth - 8);
                    marker.style.left = markerPos + 'px';
                }, 0);
                
                // Marker click - scroll to today
                marker.addEventListener('click', function() {
                    if (todayMonthEl) {
                        calScroll.scrollTo({ left: todayMonthEl.offsetLeft, behavior: 'smooth' });
                    }
                });
                
                // Horizontal wheel scroll (reduced sensitivity)
                calScroll.addEventListener('wheel', function(e) {
                    e.preventDefault();
                    calScroll.scrollLeft += (e.deltaY || e.deltaX) * 0.3;
                });
                
                // Track which slot indices have had their "god" time set
                // GOD = first edit fills ALL dates
                // DEMIGOD = subsequent edits fill same weekday only
                var godSetForSlot = {};
                
                function autofillTimes(changedDateStr, changedSlotIdx, newTime) {
                    var sortedDates = Object.keys(sessionData).sort();
                    var changedDow = getDayOfWeek(changedDateStr);
                    
                    if (!godSetForSlot[changedSlotIdx]) {
                        // GOD MODE: first edit at this slot - fill ALL unedited slots
                        godSetForSlot[changedSlotIdx] = true;
                        
                        for (var i = 0; i < sortedDates.length; i++) {
                            var dateStr = sortedDates[i];
                            if (dateStr === changedDateStr) continue;
                            var data = sessionData[dateStr];
                            if (data.times.length > changedSlotIdx && !data.edited[changedSlotIdx]) {
                                data.times[changedSlotIdx] = newTime;
                            }
                        }
                    } else {
                        // DEMIGOD MODE: fill only same weekday unedited slots
                        for (var i = 0; i < sortedDates.length; i++) {
                            var dateStr = sortedDates[i];
                            if (dateStr === changedDateStr) continue;
                            if (getDayOfWeek(dateStr) !== changedDow) continue;
                            var data = sessionData[dateStr];
                            if (data.times.length > changedSlotIdx && !data.edited[changedSlotIdx]) {
                                data.times[changedSlotIdx] = newTime;
                            }
                        }
                    }
                }
                
                // Get autofill value for a new time slot (worship the demigod - same weekday first)
                function getAutofillForSlot(dateStr, slotIdx) {
                    var dow = getDayOfWeek(dateStr);
                    var sortedDates = Object.keys(sessionData).sort();
                    
                    // Priority 1: Same weekday with a value at this slot (worship the demigod)
                    for (var i = 0; i < sortedDates.length; i++) {
                        var d = sortedDates[i];
                        if (d === dateStr) continue;
                        if (getDayOfWeek(d) === dow && sessionData[d].times.length > slotIdx && sessionData[d].times[slotIdx]) {
                            return sessionData[d].times[slotIdx];
                        }
                    }
                    
                    // Priority 2: Any date with a value at this slot (worship the god if no demigod)
                    for (var i = 0; i < sortedDates.length; i++) {
                        var d = sortedDates[i];
                        if (d === dateStr) continue;
                        if (sessionData[d].times.length > slotIdx && sessionData[d].times[slotIdx]) {
                            return sessionData[d].times[slotIdx];
                        }
                    }
                    
                    return '';
                }
                
                // Render session rows
                function renderSessions() {
                    sessionsContainer.innerHTML = '';
                    
                    var sortedDates = Object.keys(sessionData).sort();
                    
                    sortedDates.forEach(function(dateStr) {
                        var data = sessionData[dateStr];
                        var group = document.createElement('div');
                        group.className = 'fieldset-session-group';
                        
                        data.times.forEach(function(timeVal, idx) {
                            var row = document.createElement('div');
                            row.className = 'fieldset-session-row';
                            
                            if (idx === 0) {
                                var dateDisplay = document.createElement('div');
                                dateDisplay.className = 'fieldset-session-date';
                                var d = new Date(dateStr + 'T00:00:00');
                                dateDisplay.textContent = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                row.appendChild(dateDisplay);
                            } else {
                                var spacer = document.createElement('div');
                                spacer.className = 'fieldset-session-date-spacer';
                                row.appendChild(spacer);
                            }
                            
                            var timeWrapper = document.createElement('div');
                            timeWrapper.className = 'fieldset-session-time';
                            var timeInput = document.createElement('input');
                            timeInput.type = 'text';
                            timeInput.className = 'fieldset-time';
                            timeInput.placeholder = 'HH:MM';
                            timeInput.maxLength = 5;
                            timeInput.value = timeVal;
                            timeInput.dataset.date = dateStr;
                            timeInput.dataset.idx = idx;
                            
                            // Select all on focus for easy overwrite
                            timeInput.addEventListener('focus', function() {
                                var input = this;
                                setTimeout(function() { input.select(); }, 0);
                            });
                            
                            // Auto-format time input (add colon after 2 digits)
                            timeInput.addEventListener('input', function() {
                                var v = this.value.replace(/[^0-9]/g, '');
                                if (v.length >= 2) {
                                    v = v.substring(0, 2) + ':' + v.substring(2, 4);
                                }
                                this.value = v;
                            });
                            
                            (function(dateStr, idx) {
                                timeInput.addEventListener('blur', function() {
                                    var raw = this.value.replace(/[^0-9]/g, ''); // digits only
                                    if (raw === '') {
                                        sessionData[dateStr].times[idx] = '';
                                        return;
                                    }
                                    
                                    var hh, mm;
                                    if (raw.length === 1) {
                                        // "9" → "09:00"
                                        hh = '0' + raw;
                                        mm = '00';
                                    } else if (raw.length === 2) {
                                        // "19" → "19:00"
                                        hh = raw;
                                        mm = '00';
                                    } else if (raw.length === 3) {
                                        // "193" → "19:30"
                                        hh = raw.substring(0, 2);
                                        mm = raw.substring(2) + '0';
                                    } else {
                                        // "1930" → "19:30"
                                        hh = raw.substring(0, 2);
                                        mm = raw.substring(2, 4);
                                    }
                                    
                                    var newTime = hh + ':' + mm;
                                    
                                    // Validate hours 00-23 and minutes 00-59
                                    var hours = parseInt(hh, 10);
                                    var mins = parseInt(mm, 10);
                                    if (hours <= 23 && mins <= 59) {
                                        this.value = newTime;
                                        sessionData[dateStr].times[idx] = newTime;
                                        sessionData[dateStr].edited[idx] = true;
                                        autofillTimes(dateStr, idx, newTime);
                                        // Update other visible time inputs without full re-render
                                        sessionsContainer.querySelectorAll('.fieldset-time').forEach(function(input) {
                                            var d = input.dataset.date;
                                            var i = parseInt(input.dataset.idx, 10);
                                            if (d && sessionData[d] && sessionData[d].times[i] !== undefined) {
                                                input.value = sessionData[d].times[i];
                                            }
                                        });
                                    } else {
                                        // Invalid time - reset input
                                        this.value = '';
                                        sessionData[dateStr].times[idx] = '';
                                    }
                                });
                            })(dateStr, idx);
                            
                            timeWrapper.appendChild(timeInput);
                            row.appendChild(timeWrapper);
                            
                            // + button (always visible, greyed out at max 10)
                            var maxTimesPerDate = 10;
                            var addBtn = document.createElement('button');
                            addBtn.type = 'button';
                            addBtn.className = 'fieldset-session-add';
                            addBtn.textContent = '+';
                            if (data.times.length >= maxTimesPerDate) {
                                addBtn.disabled = true;
                                addBtn.style.opacity = '0.3';
                                addBtn.style.cursor = 'not-allowed';
                            } else {
                                (function(dateStr, idx) {
                                    addBtn.addEventListener('click', function() {
                                        var newSlotIdx = idx + 1;
                                        var autofillVal = getAutofillForSlot(dateStr, newSlotIdx);
                                        sessionData[dateStr].times.splice(newSlotIdx, 0, autofillVal);
                                        sessionData[dateStr].edited.splice(newSlotIdx, 0, false);
                                        renderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(addBtn);
                            
                            // - button (always visible, greyed out if only 1 time)
                            var removeBtn = document.createElement('button');
                            removeBtn.type = 'button';
                            removeBtn.className = 'fieldset-session-remove';
                            removeBtn.textContent = '−';
                            if (data.times.length === 1) {
                                removeBtn.disabled = true;
                                removeBtn.style.opacity = '0.3';
                                removeBtn.style.cursor = 'not-allowed';
                            } else {
                                (function(dateStr, idx) {
                                    removeBtn.addEventListener('click', function() {
                                        sessionData[dateStr].times.splice(idx, 1);
                                        sessionData[dateStr].edited.splice(idx, 1);
                                        renderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(removeBtn);
                            
                            group.appendChild(row);
                        });
                        
                        sessionsContainer.appendChild(group);
                    });
                }
                
                // Calendar day click
                calendar.addEventListener('click', function(e) {
                    var day = e.target;
                    if (day.classList.contains('fieldset-calendar-day') && !day.classList.contains('empty')) {
                        var iso = day.dataset.iso;
                        if (sessionData[iso]) {
                            delete sessionData[iso];
                            day.classList.remove('selected');
                        } else {
                            // New date - autofill first time slot
                            var autofillVal = getAutofillForSlot(iso, 0);
                            sessionData[iso] = { times: [autofillVal], edited: [false] };
                            day.classList.add('selected');
                        }
                        renderSessions();
                    }
                });
                
                break;
                
            case 'venue':
                // SMART VENUE FIELDSET
                // - Both inputs have Google Places (unrestricted)
                // - Auto-fill ONLY empty boxes
                // - User edits are protected
                fieldset.appendChild(buildLabel(name, tooltip));
                
                // Hidden lat/lng fields
                var smartLatInput = document.createElement('input');
                smartLatInput.type = 'hidden';
                smartLatInput.className = 'fieldset-lat';
                var smartLngInput = document.createElement('input');
                smartLngInput.type = 'hidden';
                smartLngInput.className = 'fieldset-lng';
                
                // Venue name row
                var smartVenueSub = document.createElement('div');
                smartVenueSub.className = 'fieldset-sublabel';
                smartVenueSub.textContent = 'Venue Name';
                fieldset.appendChild(smartVenueSub);
                var smartVenueInput = document.createElement('input');
                smartVenueInput.type = 'text';
                smartVenueInput.className = 'fieldset-input';
                smartVenueInput.placeholder = 'Search or type venue name...';
                smartVenueInput.style.marginBottom = '8px';
                fieldset.appendChild(smartVenueInput);
                
                // Address row
                var smartAddrSub = document.createElement('div');
                smartAddrSub.className = 'fieldset-sublabel';
                smartAddrSub.textContent = 'Address';
                fieldset.appendChild(smartAddrSub);
                var smartAddrInput = document.createElement('input');
                smartAddrInput.type = 'text';
                smartAddrInput.className = 'fieldset-input';
                smartAddrInput.placeholder = 'Search or type address...';
                smartAddrInput.style.marginBottom = '4px';
                fieldset.appendChild(smartAddrInput);
                
                // Status indicator
                var smartStatus = document.createElement('div');
                smartStatus.className = 'fieldset-location-status';
                fieldset.appendChild(smartStatus);
                
                fieldset.appendChild(smartLatInput);
                fieldset.appendChild(smartLngInput);
                
                // Smart autofill function - only fills empty boxes
                function initSmartVenueAutocomplete(inputEl, otherInputEl, isVenueBox) {
                    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
                        console.warn('Google Places API not loaded');
                        return;
                    }
                    
                    // Unrestricted search - finds both venues and addresses
                    var autocomplete = new google.maps.places.Autocomplete(inputEl, {
                        fields: ['formatted_address', 'geometry', 'name', 'place_id', 'types']
                    });
                    
                    autocomplete.addListener('place_changed', function() {
                        var place = autocomplete.getPlace();
                        if (!place.geometry || !place.geometry.location) return;
                        
                        var lat = place.geometry.location.lat();
                        var lng = place.geometry.location.lng();
                        var venueName = place.name || '';
                        var address = place.formatted_address || '';
                        var isEstablishment = place.types && place.types.includes('establishment');
                        
                        // Always update lat/lng
                        smartLatInput.value = lat;
                        smartLngInput.value = lng;
                        
                        if (isVenueBox) {
                            // User searched in venue box
                            // Strip venue name to just the name (Google fills with full address)
                            if (isEstablishment && venueName) {
                                smartVenueInput.value = venueName;
                            }
                            // Address: fill only if empty
                            if (!smartAddrInput.value.trim()) {
                                smartAddrInput.value = address;
                            }
                        } else {
                            // User searched in address box
                            // Address: strip to just address (in case Google added extra)
                            smartAddrInput.value = address;
                            // Venue name: fill only if empty AND result is an establishment
                            if (!smartVenueInput.value.trim() && isEstablishment && venueName) {
                                smartVenueInput.value = venueName;
                            }
                        }
                        
                        // Update status
                        smartStatus.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                        smartStatus.className = 'fieldset-location-status success';
                    });
                }
                
                // Init both inputs with smart autofill
                initSmartVenueAutocomplete(smartVenueInput, smartAddrInput, true);
                initSmartVenueAutocomplete(smartAddrInput, smartVenueInput, false);
                break;
                
            default:
                // Generic text input fallback
                fieldset.appendChild(buildLabel(name, tooltip));
                var input = document.createElement('input');
                input.type = 'text';
                input.className = 'fieldset-input';
                input.placeholder = placeholder;
                fieldset.appendChild(input);
        }
        
        return fieldset;
    }
    
    // Auto-load picklist data when component initializes
    loadFromDatabase();
    
    return {
        initGooglePlaces: initGooglePlaces,
        buildLabel: buildLabel,
        buildFieldset: buildFieldset,
        addInputValidation: addInputValidation,
        isValidEmail: isValidEmail,
        isValidUrl: isValidUrl,
        makePhoneDigitsOnly: makePhoneDigitsOnly,
        autoUrlProtocol: autoUrlProtocol,
        setPicklist: setPicklist,
        getPicklist: function() { return picklist; },
        isLoaded: function() { return dataLoaded; },
        loadFromDatabase: loadFromDatabase,
        buildCurrencyMenuCompact: buildCurrencyMenuCompact,
        buildPhonePrefixMenu: buildPhonePrefixMenu
    };
})();


/* ============================================================================
   CALENDAR
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
   CURRENCY
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
        menu.innerHTML = '<div class="fieldset-menu-button"><span class="fieldset-menu-button-text">Select currency</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        var btnImg = null;
        
        var currencies = currencyData;
        currencies.forEach(function(item) {
            var countryCode = item.value.substring(0, 2);
            var currencyCode = item.value.substring(3);
            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + countryCode + '.svg" alt=""><span class="fieldset-menu-option-text">' + currencyCode + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                if (!btnImg) {
                    btnImg = document.createElement('img');
                    btnImg.className = 'fieldset-menu-button-image';
                    btnImg.alt = '';
                    btn.insertBefore(btnImg, btnText);
                }
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnText.textContent = currencyCode;
                menu.classList.remove('open');
                onSelect(currencyCode, item.label, countryCode);
            };
            opts.appendChild(op);
        });
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        btn.onclick = function(e) {
            e.stopPropagation();
            // Close all other menus first
            MenuManager.closeAll(menu);
            menu.classList.toggle('open');
        };
        
        return menu;
    }
    
    // Build a full currency menu (wide, shows code + label)
    // Combobox style - type to filter options
    // Returns object with element and setValue method
    function buildFullMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null;
        var initialValue = options.initialValue || 'USD';
        var selectedCode = initialValue;

        var menu = document.createElement('div');
        menu.className = 'admin-currency-wrapper';
        menu.innerHTML = '<div class="admin-currency-button"><img class="admin-currency-button-flag" src="assets/flags/us.svg" alt=""><input type="text" class="admin-currency-button-input" placeholder="Search currency..." autocomplete="off"><span class="admin-currency-button-arrow">▼</span></div><div class="admin-currency-options"></div>';

        var btn = menu.querySelector('.admin-currency-button');
        var opts = menu.querySelector('.admin-currency-options');
        var btnImg = menu.querySelector('.admin-currency-button-flag');
        var btnInput = menu.querySelector('.admin-currency-button-input');

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set initial value
        function setValue(code) {
            var found = currencyData.find(function(item) {
                return item.value.substring(3) === code;
            });
            if (found) {
                var countryCode = found.value.substring(0, 2);
                var currencyCode = found.value.substring(3);
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnInput.value = currencyCode + ' - ' + found.label;
                selectedCode = code;
            }
        }

        // Filter options based on search text
        function filterOptions(searchText) {
            var search = searchText.toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = optData.searchText.indexOf(search) !== -1;
                optData.element.style.display = matches ? '' : 'none';
            });
        }

        // Build options
        var currencies = currencyData;
        currencies.forEach(function(item) {
            var countryCode = item.value.substring(0, 2);
            var currencyCode = item.value.substring(3);
            var displayText = currencyCode + ' - ' + item.label;
            
            var op = document.createElement('div');
            op.className = 'admin-currency-option';
            op.innerHTML = '<img class="admin-currency-option-flag" src="assets/flags/' + countryCode + '.svg" alt=""><span class="admin-currency-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnInput.value = displayText;
                selectedCode = currencyCode;
                menu.classList.remove('open');
                filterOptions(''); // Reset filter
                onSelect(currencyCode, item.label, countryCode);
            };
            opts.appendChild(op);
            
            // Store for filtering
            allOptions.push({
                element: op,
                searchText: displayText.toLowerCase() + ' ' + item.label.toLowerCase()
            });
        });

        // Set initial value
        setValue(initialValue);

        // Register with MenuManager
        MenuManager.register(menu);

        // Input events
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            menu.classList.add('open');
            // Select all text for easy replacement
            this.select();
        });

        btnInput.addEventListener('input', function(e) {
            filterOptions(this.value);
            if (!menu.classList.contains('open')) {
                menu.classList.add('open');
            }
        });

        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                menu.classList.remove('open');
                // Restore selected value
                setValue(selectedCode);
                filterOptions('');
            }
        });

        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            // Small delay to allow option click to fire first
            setTimeout(function() {
                if (!menu.classList.contains('open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        var arrow = menu.querySelector('.admin-currency-button-arrow');
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('open')) {
                menu.classList.remove('open');
            } else {
                MenuManager.closeAll(menu);
                menu.classList.add('open');
                btnInput.focus();
                btnInput.select();
            }
        });

        // Return object with element and setValue method
        return {
            element: menu,
            setValue: setValue
        };
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
   PHONE PREFIX
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
        menu.innerHTML = '<div class="fieldset-menu-button"><span class="fieldset-menu-button-text">Select prefix</span><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnText = menu.querySelector('.fieldset-menu-button-text');
        var btnImg = null;
        
        var prefixes = prefixData;
        
        prefixes.forEach(function(item) {
            var countryCode = item.value.substring(0, 2);
            var prefix = item.value.substring(3);
                    var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="assets/flags/' + countryCode + '.svg" alt=""><span class="fieldset-menu-option-text">' + prefix + ' - ' + item.label + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                if (!btnImg) {
                    btnImg = document.createElement('img');
                    btnImg.className = 'fieldset-menu-button-image';
                    btnImg.alt = '';
                    btn.insertBefore(btnImg, btnText);
                }
                btnImg.src = 'assets/flags/' + countryCode + '.svg';
                btnText.textContent = prefix;
                menu.classList.remove('open');
                onSelect(prefix, item.label, countryCode);
            };
                    opts.appendChild(op);
        });
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        btn.onclick = function(e) {
            e.stopPropagation();
            // Close all other menus first
            MenuManager.closeAll(menu);
            menu.classList.toggle('open');
        };
        
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
   ICON PICKER
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
    
    // Extract filename from path
    function getFilename(path) {
        if (!path) return '';
        var parts = path.split('/');
        return parts[parts.length - 1] || path;
    }
    
    // Build icon picker dropdown menu (matches menu-test.html design)
    // options: { onSelect, currentIcon }
    function buildPicker(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var currentIcon = options.currentIcon || null;
        
        var menu = document.createElement('div');
        menu.className = 'component-iconpicker';
        
        // Button
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-iconpicker-button';
        
        var buttonImage = document.createElement('img');
        buttonImage.className = 'component-iconpicker-button-image';
        buttonImage.src = currentIcon || '';
        buttonImage.alt = '';
        if (!currentIcon) buttonImage.style.display = 'none';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-iconpicker-button-text';
        buttonText.textContent = currentIcon ? getFilename(currentIcon) : 'Select...';
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-iconpicker-button-arrow';
        buttonArrow.textContent = '▼';
        
        button.appendChild(buttonImage);
        button.appendChild(buttonText);
        button.appendChild(buttonArrow);
        menu.appendChild(button);
        
        // Options dropdown
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-iconpicker-options';
        menu.appendChild(optionsDiv);
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        // Toggle menu
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('open');
            if (isOpen) {
                menu.classList.remove('open');
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Load and show icons
                loadIconsFromFolder().then(function(iconList) {
                    optionsDiv.innerHTML = '';
                    if (iconList.length === 0) {
                        var msg = document.createElement('div');
                        msg.className = 'component-iconpicker-error';
                        msg.innerHTML = 'No icons found.<br>Please set icon folder in Admin Settings.';
                        optionsDiv.appendChild(msg);
                    } else {
                        iconList.forEach(function(iconPath) {
                            var option = document.createElement('button');
                            option.type = 'button';
                            option.className = 'component-iconpicker-option';
                            
                            var optImg = document.createElement('img');
                            optImg.className = 'component-iconpicker-option-image';
                            optImg.src = iconPath;
                            optImg.alt = '';
                            
                            var optText = document.createElement('span');
                            optText.className = 'component-iconpicker-option-text';
                            optText.textContent = getFilename(iconPath);
                            
                            option.appendChild(optImg);
                            option.appendChild(optText);
                            
                            option.onclick = function(ev) {
                                ev.stopPropagation();
                                currentIcon = iconPath;
                                buttonImage.src = iconPath;
                                buttonImage.style.display = '';
                                buttonText.textContent = getFilename(iconPath);
                                menu.classList.remove('open');
                                onSelect(iconPath);
                            };
                            optionsDiv.appendChild(option);
                        });
                    }
                    menu.classList.add('open');
                });
            }
        };
        
        return {
            element: menu,
            setIcon: function(iconPath) {
                currentIcon = iconPath;
                if (iconPath) {
                    buttonImage.src = iconPath;
                    buttonImage.style.display = '';
                    buttonText.textContent = getFilename(iconPath);
                } else {
                    buttonImage.style.display = 'none';
                    buttonText.textContent = 'Select...';
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
   SYSTEM IMAGE PICKER
   Uses system_images folder path from admin settings
   ============================================================================ */

/* ============================================================================
   MAP CONTROL ROW
   
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


/* ============================================================================
   CHECKOUT OPTIONS
   
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
    
    // Extract filename from path
    function getFilename(path) {
        if (!path) return '';
        var parts = path.split('/');
        return parts[parts.length - 1] || path;
    }
    
    // Build system image picker dropdown menu (matches menu-test.html design)
    // options: { onSelect, currentImage }
    function buildPicker(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var currentImage = options.currentImage || null;
        
        var menu = document.createElement('div');
        menu.className = 'component-systemimagepicker';
        
        // Button
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-systemimagepicker-button';
        
        var buttonImage = document.createElement('img');
        buttonImage.className = 'component-systemimagepicker-button-image';
        buttonImage.src = currentImage || '';
        buttonImage.alt = '';
        if (!currentImage) buttonImage.style.display = 'none';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-systemimagepicker-button-text';
        buttonText.textContent = currentImage ? getFilename(currentImage) : 'Select...';
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-systemimagepicker-button-arrow';
        buttonArrow.textContent = '▼';
        
        button.appendChild(buttonImage);
        button.appendChild(buttonText);
        button.appendChild(buttonArrow);
        menu.appendChild(button);
        
        // Options dropdown
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-systemimagepicker-options';
        menu.appendChild(optionsDiv);
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        // Toggle menu
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('open');
            if (isOpen) {
                menu.classList.remove('open');
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Load and show images
                loadImagesFromFolder().then(function(imageList) {
                    optionsDiv.innerHTML = '';
                    if (imageList.length === 0) {
                        var msg = document.createElement('div');
                        msg.className = 'component-systemimagepicker-error';
                        msg.innerHTML = 'No images found.<br>Please set system images folder in Admin Settings.';
                        optionsDiv.appendChild(msg);
                    } else {
                        imageList.forEach(function(imagePath) {
                            var option = document.createElement('button');
                            option.type = 'button';
                            option.className = 'component-systemimagepicker-option';
                            
                            var optImg = document.createElement('img');
                            optImg.className = 'component-systemimagepicker-option-image';
                            optImg.src = imagePath;
                            optImg.alt = '';
                            
                            var optText = document.createElement('span');
                            optText.className = 'component-systemimagepicker-option-text';
                            optText.textContent = getFilename(imagePath);
                            
                            option.appendChild(optImg);
                            option.appendChild(optText);
                            
                            option.onclick = function(ev) {
                                ev.stopPropagation();
                                currentImage = imagePath;
                                buttonImage.src = imagePath;
                                buttonImage.style.display = '';
                                buttonText.textContent = getFilename(imagePath);
                                menu.classList.remove('open');
                                onSelect(imagePath);
                            };
                            optionsDiv.appendChild(option);
                        });
                    }
                    menu.classList.add('open');
                });
            }
        };
        
        return {
            element: menu,
            setImage: function(imagePath) {
                currentImage = imagePath;
                if (imagePath) {
                    buttonImage.src = imagePath;
                    buttonImage.style.display = '';
                    buttonText.textContent = getFilename(imagePath);
                } else {
                    buttonImage.style.display = 'none';
                    buttonText.textContent = 'Select...';
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
   CONFIRM DIALOG
   
   Reusable confirmation dialog for destructive actions.
   Returns a Promise that resolves to true (confirmed) or false (cancelled).
   
   Usage:
     const confirmed = await ConfirmDialogComponent.show({
       titleText: 'Delete Item',
       messageText: 'Are you sure you want to delete this item?',
       confirmLabel: 'Delete',
       focusCancel: true
     });
     if (confirmed) {
       // do the thing
     }
   ============================================================================ */

const ConfirmDialogComponent = (function() {
    var overlayEl = null;
    
    function ensureOverlay() {
        if (overlayEl) return overlayEl;
        
        var overlay = document.createElement('div');
        overlay.className = 'component-confirm-dialog-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('tabindex', '-1');
        
        var dialog = document.createElement('div');
        dialog.className = 'component-confirm-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'confirmDialogTitle');
        dialog.setAttribute('aria-describedby', 'confirmDialogMessage');
        
        var title = document.createElement('h2');
        title.id = 'confirmDialogTitle';
        title.className = 'component-confirm-dialog-title';
        
        var message = document.createElement('p');
        message.id = 'confirmDialogMessage';
        message.className = 'component-confirm-dialog-message';
        
        var actions = document.createElement('div');
        actions.className = 'component-confirm-dialog-actions';
        
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'component-confirm-dialog-button component-confirm-dialog-button--cancel';
        cancelBtn.dataset.role = 'cancel';
        cancelBtn.textContent = 'Cancel';
        
        var confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'component-confirm-dialog-button component-confirm-dialog-button--confirm';
        confirmBtn.dataset.role = 'confirm';
        confirmBtn.textContent = 'Confirm';
        
        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        dialog.appendChild(title);
        dialog.appendChild(message);
        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        overlayEl = overlay;
        return overlay;
    }
    
    function show(options) {
        options = options || {};
        var titleText = options.titleText || 'Confirm';
        var messageText = options.messageText || 'Are you sure?';
        var confirmLabel = options.confirmLabel || 'Confirm';
        var cancelLabel = options.cancelLabel || 'Cancel';
        var focusCancel = options.focusCancel !== false;
        var confirmClass = options.confirmClass || '';
        
        var overlay = ensureOverlay();
        var title = overlay.querySelector('#confirmDialogTitle');
        var message = overlay.querySelector('#confirmDialogMessage');
        var cancelBtn = overlay.querySelector('[data-role="cancel"]');
        var confirmBtn = overlay.querySelector('[data-role="confirm"]');
        var previousFocused = document.activeElement;
        
        // Clone buttons to remove old event listeners
        var newCancelBtn = cancelBtn.cloneNode(true);
        var newConfirmBtn = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn = newCancelBtn;
        confirmBtn = newConfirmBtn;
        
        // Set content
        title.textContent = titleText;
        message.textContent = messageText;
        cancelBtn.textContent = cancelLabel;
        confirmBtn.textContent = confirmLabel;
        
        // Set confirm button class
        confirmBtn.className = 'component-confirm-dialog-button component-confirm-dialog-button--confirm';
        if (confirmClass) {
            confirmBtn.classList.add(confirmClass);
        }
        
        // Show overlay
        overlay.classList.add('component-confirm-dialog-overlay--visible');
        overlay.setAttribute('aria-hidden', 'false');
        
        // Focus appropriate button
        if (focusCancel) {
            cancelBtn.focus();
        } else {
            confirmBtn.focus();
        }
        
        return new Promise(function(resolve) {
            function cleanup(result) {
                overlay.classList.remove('component-confirm-dialog-overlay--visible');
                overlay.setAttribute('aria-hidden', 'true');
                document.removeEventListener('keydown', onKeyDown, true);
                overlay.removeEventListener('click', onOverlayClick);
                
                if (previousFocused && typeof previousFocused.focus === 'function') {
                    try {
                        previousFocused.focus({ preventScroll: true });
                    } catch (e) {
                        // ignore focus errors
                    }
                }
                
                resolve(result);
            }
            
            function onKeyDown(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    var focused = document.activeElement;
                    if (focused === cancelBtn) {
                        cleanup(false);
                    } else {
                        cleanup(true);
                    }
                } else if (e.key === 'Tab') {
                    // Trap focus inside dialog
                    var buttons = [cancelBtn, confirmBtn];
                    var first = buttons[0];
                    var last = buttons[buttons.length - 1];
                    
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
            
            function onOverlayClick(e) {
                if (e.target === overlay) {
                    cleanup(false);
                }
            }
            
            cancelBtn.addEventListener('click', function() {
                cleanup(false);
            });
            
            confirmBtn.addEventListener('click', function() {
                cleanup(true);
            });
            
            document.addEventListener('keydown', onKeyDown, true);
            overlay.addEventListener('click', onOverlayClick);
        });
    }
    
    return {
        show: show
    };
})();

// Expose globally
window.ClearButtonComponent = ClearButtonComponent;
window.SwitchComponent = SwitchComponent;
window.FieldsetComponent = FieldsetComponent;
window.CalendarComponent = CalendarComponent;
window.CurrencyComponent = CurrencyComponent;
window.PhonePrefixComponent = PhonePrefixComponent;
window.IconPickerComponent = IconPickerComponent;
window.SystemImagePickerComponent = SystemImagePickerComponent;
window.MapControlRowComponent = MapControlRowComponent;
window.CheckoutOptionsComponent = CheckoutOptionsComponent;
window.ConfirmDialogComponent = ConfirmDialogComponent;

