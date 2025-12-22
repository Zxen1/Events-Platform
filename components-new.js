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
        // Don't close if clicking on save/discard buttons
        if (e.target.closest('.admin-panel-actions-icon-btn--save') ||
            e.target.closest('.admin-panel-actions-icon-btn--discard') ||
            e.target.closest('.admin-panel-actions')) {
            return;
        }
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
    var fieldsets = [];
    var dataLoaded = false;
    var loadPromise = null;
    
    // Load picklist data and fieldset definitions from database
    function loadFromDatabase() {
        if (loadPromise) return loadPromise;
        loadPromise = fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.picklist) {
                    // Set picklist data and propagate to CurrencyComponent and PhonePrefixComponent
                    setPicklist(res.picklist);
                }
                // Also fetch fieldset definitions for tooltip matching
                return fetch('/gateway.php?action=get-form');
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success && res.formData && res.formData.fieldsets) {
                    fieldsets = res.formData.fieldsets;
                }
                dataLoaded = true;
                return { picklist: picklist, fieldsets: fieldsets };
            });
        return loadPromise;
    }
    
    // Google Places Autocomplete helper - Uses new API (AutocompleteSuggestion)
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
        
        // Check if new API is available
        if (!google.maps.places.AutocompleteSuggestion) {
            console.warn('Google Places AutocompleteSuggestion API not available');
            if (statusElement) {
                statusElement.textContent = 'Location search unavailable';
                statusElement.className = 'fieldset-location-status error';
            }
            return null;
        }
        
        // Create dropdown for suggestions
        var dropdown = document.createElement('div');
        dropdown.className = 'fieldset-location-dropdown';
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '1000';
        dropdown.style.backgroundColor = '#fff';
        dropdown.style.border = '1px solid #ccc';
        dropdown.style.borderRadius = '4px';
        dropdown.style.maxHeight = '200px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.width = '100%';
        dropdown.style.marginTop = '2px';
        dropdown.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        
        // Insert dropdown after input element
        var parent = inputElement.parentNode;
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(dropdown);
        }
        
        // Determine included types for new API
        var includedTypes = [];
        if (type === 'address') {
            includedTypes = ['geocode'];
        } else if (type === 'establishment') {
            includedTypes = ['establishment'];
        } else if (type === '(cities)') {
            includedTypes = ['(cities)'];
        } else {
            includedTypes = ['geocode', 'establishment'];
        }
        
        // Fetch suggestions using new API
        var debounceTimer = null;
        async function fetchSuggestions(query) {
            if (!query || query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            try {
                var requestOptions = {
                    input: query
                };
                
                // Add type restrictions if specified
                if (includedTypes.length > 0) {
                    requestOptions.includedTypes = includedTypes;
                }
                
                var response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(requestOptions);
                
                dropdown.innerHTML = '';
                
                if (!response || !response.suggestions || response.suggestions.length === 0) {
                    dropdown.style.display = 'none';
                    return;
                }
                
                response.suggestions.forEach(function(suggestion) {
                    var prediction = suggestion.placePrediction;
                    if (!prediction) return;
                    
                    var item = document.createElement('div');
                    item.className = 'fieldset-location-dropdown-item';
                    item.style.padding = '8px 12px';
                    item.style.cursor = 'pointer';
                    item.style.borderBottom = '1px solid #eee';
                    
                    var mainText = prediction.mainText ? prediction.mainText.text : (prediction.text ? prediction.text.text : '');
                    var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                    
                    item.innerHTML = 
                        '<div style="font-weight: 500; color: #333;">' + mainText + '</div>' +
                        (secondaryText ? '<div style="font-size: 0.9em; color: #666; margin-top: 2px;">' + secondaryText + '</div>' : '');
                    
                    // Hover effect
                    item.addEventListener('mouseenter', function() {
                        item.style.backgroundColor = '#f5f5f5';
                    });
                    item.addEventListener('mouseleave', function() {
                        item.style.backgroundColor = 'transparent';
                    });
                    
                    item.addEventListener('click', async function() {
                        try {
                            var place = prediction.toPlace();
                            await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
                            
                            if (place.location) {
                                var lat = place.location.lat();
                                var lng = place.location.lng();
                                
                                inputElement.value = place.displayName || place.formattedAddress || mainText;
                                dropdown.style.display = 'none';
                                
                                if (latInput) latInput.value = lat;
                                if (lngInput) lngInput.value = lng;
                                
                                if (statusElement) {
                                    statusElement.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                                    statusElement.className = 'fieldset-location-status success';
                                }
                            } else {
                                if (statusElement) {
                                    statusElement.textContent = 'No location data for this place';
                                    statusElement.className = 'fieldset-location-status error';
                                }
                            }
                        } catch (err) {
                            console.error('Place details error:', err);
                            if (statusElement) {
                                statusElement.textContent = 'Error loading place details';
                                statusElement.className = 'fieldset-location-status error';
                            }
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
        
        // Input event handler with debounce
        inputElement.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            var query = inputElement.value.trim();
            
            if (query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(function() {
                fetchSuggestions(query);
            }, 300);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
        
        // Return object with cleanup method
        return {
            destroy: function() {
                if (dropdown && dropdown.parentNode) {
                    dropdown.parentNode.removeChild(dropdown);
                }
            }
        };
    }
    
    // Build compact currency menu - uses CurrencyComponent
    function buildCurrencyMenuCompact(container, defaultCurrency) {
        if (typeof CurrencyComponent === 'undefined') {
            console.error('[FieldsetComponent] CurrencyComponent not available');
            return document.createElement('div');
        }
        // Use defaultCurrency if provided, otherwise null (user must select)
        var initialValue = defaultCurrency || null;
        var result = CurrencyComponent.buildCompactMenu({
            initialValue: initialValue,
            container: container
        });
        return result.element;
    }
    
    // Build phone prefix menu - uses PhonePrefixComponent
    function buildPhonePrefixMenu(container) {
        if (typeof PhonePrefixComponent === 'undefined') {
            console.error('[FieldsetComponent] PhonePrefixComponent not available');
            return document.createElement('div');
        }
        // No default - user must select
        var initialValue = null;
        var result = PhonePrefixComponent.buildCompactMenu({
            initialValue: initialValue,
            container: container
        });
        return result.element;
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
     * @param {Object} fieldData - Field configuration from the form data
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
        var defaultCurrency = options.defaultCurrency || null;
        
        var fieldset = document.createElement('div');
        fieldset.className = 'fieldset';
        
        var key = fieldData.fieldset_key || fieldData.key || '';
        var name = fieldData.fieldset_name || fieldData.name || 'Unnamed';
        
        // Get tooltip: check customTooltip first (editable fieldsets), then tooltip, then fieldset_tooltip
        // If still empty, try to match against fieldset definitions (like live site)
        var tooltip = fieldData.customTooltip || fieldData.tooltip || fieldData.fieldset_tooltip || '';
        if (!tooltip && key) {
            // No fallbacks - fieldsets must be provided
            var availableFieldsets = fieldsets || [];
            if (availableFieldsets && availableFieldsets.length > 0) {
                var matchingFieldset = availableFieldsets.find(function(fs) {
                    return fs.value === key || fs.key === key || fs.fieldset_key === key || fs.fieldsetKey === key;
                });
                if (matchingFieldset && matchingFieldset.fieldset_tooltip) {
                    tooltip = matchingFieldset.fieldset_tooltip;
                }
            }
        }
        
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
                    var amenityUrl = window.App.getImageUrl('amenities', iconKey + '.svg');
                    iconEl.innerHTML = '<img src="' + amenityUrl + '" alt="' + amenityName + '">';
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
                // Use defaultCurrency if provided, otherwise null (user must select)
                var initialCurrencyCode = defaultCurrency || null;
                var initialCurrency = null;
                if (initialCurrencyCode && CurrencyComponent.isLoaded()) {
                    var found = CurrencyComponent.getData().find(function(item) {
                        return item.value === initialCurrencyCode;
                    });
                    if (found) {
                        var countryCode = found.filename ? found.filename.replace('.svg', '') : null;
                        initialCurrency = { flag: countryCode, code: initialCurrencyCode };
                    }
                }
                var itemCurrencyState = initialCurrency || { flag: null, code: null };
                var itemCurrencyMenus = [];

                function syncAllItemCurrencies() {
                    itemCurrencyMenus.forEach(function(menu) {
                        var img = menu.querySelector('.fieldset-menu-button-image');
                        var input = menu.querySelector('.fieldset-menu-button-input');
                        if (itemCurrencyState.flag) {
                            img.src = window.App.getImageUrl('currencies', itemCurrencyState.flag + '.svg');
                        }
                        input.value = itemCurrencyState.code || '';
                    });
                }

                function buildItemCurrencyMenu() {
                    if (typeof CurrencyComponent === 'undefined') {
                        console.error('[FieldsetComponent] CurrencyComponent not available');
                        return document.createElement('div');
                    }
                    var result = CurrencyComponent.buildCompactMenu({
                        initialValue: itemCurrencyState.code,
                        onSelect: function(value, label, countryCode) {
                            itemCurrencyState.flag = countryCode;
                            itemCurrencyState.code = value;
                            syncAllItemCurrencies();
                        }
                    });
                    itemCurrencyMenus.push(result.element);
                    return result.element;
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
                // Use defaultCurrency if provided, otherwise null (user must select)
                var initialCurrencyCode = defaultCurrency || null;
                var initialCurrency = null;
                if (initialCurrencyCode && CurrencyComponent.isLoaded()) {
                    var found = CurrencyComponent.getData().find(function(item) {
                        return item.value === initialCurrencyCode;
                    });
                    if (found) {
                        var countryCode = found.filename ? found.filename.replace('.svg', '') : null;
                        initialCurrency = { flag: countryCode, code: initialCurrencyCode };
                    }
                }
                var ticketCurrencyState = initialCurrency || { flag: null, code: null };
                var ticketCurrencyMenus = [];

                function syncAllTicketCurrencies() {
                    ticketCurrencyMenus.forEach(function(menu) {
                        var img = menu.querySelector('.fieldset-menu-button-image');
                        var input = menu.querySelector('.fieldset-menu-button-input');
                        if (ticketCurrencyState.flag) {
                            img.src = window.App.getImageUrl('currencies', ticketCurrencyState.flag + '.svg');
                        }
                        input.value = ticketCurrencyState.code || '';
                    });
                }

                function buildTicketCurrencyMenu() {
                    if (typeof CurrencyComponent === 'undefined') {
                        console.error('[FieldsetComponent] CurrencyComponent not available');
                        return document.createElement('div');
                    }
                    var result = CurrencyComponent.buildCompactMenu({
                        initialValue: ticketCurrencyState.code,
                        onSelect: function(value, label, countryCode) {
                            ticketCurrencyState.flag = countryCode;
                            ticketCurrencyState.code = value;
                            syncAllTicketCurrencies();
                        }
                    });
                    ticketCurrencyMenus.push(result.element);
                    return result.element;
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
                
                // Smart autofill function - only fills empty boxes - Uses new API
                function initSmartVenueAutocomplete(inputEl, otherInputEl, isVenueBox) {
                    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
                        console.warn('Google Places API not loaded');
                        return;
                    }
                    
                    if (!google.maps.places.AutocompleteSuggestion) {
                        console.warn('Google Places AutocompleteSuggestion API not available');
                        return;
                    }
                    
                    // Create dropdown for suggestions
                    var dropdown = document.createElement('div');
                    dropdown.className = 'fieldset-location-dropdown';
                    dropdown.style.display = 'none';
                    dropdown.style.position = 'absolute';
                    dropdown.style.zIndex = '1000';
                    dropdown.style.backgroundColor = '#fff';
                    dropdown.style.border = '1px solid #ccc';
                    dropdown.style.borderRadius = '4px';
                    dropdown.style.maxHeight = '200px';
                    dropdown.style.overflowY = 'auto';
                    dropdown.style.width = '100%';
                    dropdown.style.marginTop = '2px';
                    dropdown.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    
                    var parent = inputEl.parentNode;
                    if (parent) {
                        parent.style.position = 'relative';
                        parent.appendChild(dropdown);
                    }
                    
                    // Fetch suggestions using new API (unrestricted - finds both venues and addresses)
                    var debounceTimer = null;
                    async function fetchSuggestions(query) {
                        if (!query || query.length < 2) {
                            dropdown.style.display = 'none';
                            return;
                        }
                        
                        try {
                            var response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                                input: query,
                                includedTypes: ['geocode', 'establishment']
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
                                item.className = 'fieldset-location-dropdown-item';
                                item.style.padding = '8px 12px';
                                item.style.cursor = 'pointer';
                                item.style.borderBottom = '1px solid #eee';
                                
                                var mainText = prediction.mainText ? prediction.mainText.text : (prediction.text ? prediction.text.text : '');
                                var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                                
                                item.innerHTML = 
                                    '<div style="font-weight: 500; color: #333;">' + mainText + '</div>' +
                                    (secondaryText ? '<div style="font-size: 0.9em; color: #666; margin-top: 2px;">' + secondaryText + '</div>' : '');
                                
                                item.addEventListener('mouseenter', function() {
                                    item.style.backgroundColor = '#f5f5f5';
                                });
                                item.addEventListener('mouseleave', function() {
                                    item.style.backgroundColor = 'transparent';
                                });
                                
                                item.addEventListener('click', async function() {
                                    try {
                                        var place = prediction.toPlace();
                                        await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'types'] });
                                        
                                        if (!place.location) return;
                                        
                                        var lat = place.location.lat();
                                        var lng = place.location.lng();
                                        var venueName = place.displayName || '';
                                        var address = place.formattedAddress || '';
                                        var types = place.types || [];
                                        var isEstablishment = types.includes('establishment');
                                        
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
                                        
                                        inputEl.value = isVenueBox ? (isEstablishment ? venueName : address) : address;
                                        dropdown.style.display = 'none';
                                        
                                        // Update status
                                        smartStatus.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                                        smartStatus.className = 'fieldset-location-status success';
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
                    
                    // Input event handler with debounce
                    inputEl.addEventListener('input', function() {
                        clearTimeout(debounceTimer);
                        var query = inputEl.value.trim();
                        
                        if (query.length < 2) {
                            dropdown.style.display = 'none';
                            return;
                        }
                        
                        debounceTimer = setTimeout(function() {
                            fetchSuggestions(query);
                        }, 300);
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', function(e) {
                        if (!inputEl.contains(e.target) && !dropdown.contains(e.target)) {
                            dropdown.style.display = 'none';
                        }
                    });
                }
                
                // Init both inputs with smart autofill
                initSmartVenueAutocomplete(smartVenueInput, smartAddrInput, true);
                initSmartVenueAutocomplete(smartAddrInput, smartVenueInput, false);
                break;
                
            default:
                // Unknown field type - use generic text input
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
        getFieldsets: function() { return fieldsets; },
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
        // No longer needs parsing - option_value is just the currency code
        // Country code comes from option_filename
        return { countryCode: null, currencyCode: optionValue || '' };
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
    // Combobox style - type to filter options
    // Returns object with element and setValue method
    function buildCompactMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;

        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="fieldset-menu-button-input" placeholder="Search" autocomplete="off"><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';

        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnInput = menu.querySelector('.fieldset-menu-button-input');

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set value
        function setValue(code) {
            var found = currencyData.find(function(item) {
                return item.value === code;
            });
            if (found) {
                var countryCode = found.filename ? found.filename.replace('.svg', '') : null;
                if (countryCode) {
                    btnImg.src = window.App.getImageUrl('currencies', countryCode + '.svg');
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = found.value;
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
        currencyData.forEach(function(item) {
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;

            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="' + flagUrl + '" alt=""><span class="fieldset-menu-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                if (countryCode) {
                    btnImg.src = flagUrl;
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = item.value;
                selectedCode = item.value;
                menu.classList.remove('open');
                filterOptions('');
                onSelect(item.value, item.label, countryCode);
            };
            opts.appendChild(op);

            // Store for filtering
                    allOptions.push({
                        element: op,
                        searchText: displayText.toLowerCase() + ' ' + item.label.toLowerCase()
                    });
        });

        // Set initial value
        if (initialValue) {
            setValue(initialValue);
        }

        // Data must be loaded BEFORE building menu (via FieldsetComponent.setPicklist)
        // If data isn't loaded, menu will be empty - this is expected behavior

        // Register with MenuManager
        MenuManager.register(menu);

        // Input events
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            menu.classList.add('open');
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
                setValue(selectedCode);
                filterOptions('');
            }
        });

        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        var arrow = menu.querySelector('.fieldset-menu-button-arrow');
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

        return {
            element: menu,
            setValue: setValue
        };
    }
    
    // Build a full currency menu (wide, shows code + label)
    // Combobox style - type to filter options
    // Returns object with element and setValue method
    function buildFullMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null;
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;
        
        var menu = document.createElement('div');
        menu.className = 'admin-currency-wrapper';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="admin-currency-button"><img class="admin-currency-button-flag" src="' + initialFlagUrl + '" alt=""><input type="text" class="admin-currency-button-input" placeholder="Select currency" autocomplete="off"><span class="admin-currency-button-arrow">▼</span></div><div class="admin-currency-options"></div>';
        
        var btn = menu.querySelector('.admin-currency-button');
        var opts = menu.querySelector('.admin-currency-options');
        var btnImg = menu.querySelector('.admin-currency-button-flag');
        var btnInput = menu.querySelector('.admin-currency-button-input');

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set initial value
        function setValue(code) {
            var found = currencyData.find(function(item) {
                return item.value === code;
            });
            if (found) {
                var countryCode = found.filename ? found.filename.replace('.svg', '') : null;
                btnImg.src = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
                btnInput.value = found.value + ' - ' + found.label;
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
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;
            
            var op = document.createElement('div');
            op.className = 'admin-currency-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="admin-currency-option-flag" src="' + flagUrl + '" alt=""><span class="admin-currency-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = flagUrl;
                btnInput.value = displayText;
                selectedCode = item.value;
                menu.classList.remove('open');
                filterOptions(''); // Reset filter
                onSelect(item.value, item.label, countryCode);
            };
            opts.appendChild(op);
            
            // Store for filtering
            allOptions.push({
                element: op,
                searchText: displayText.toLowerCase() + ' ' + item.label.toLowerCase()
            });
        });

        // Set initial value (only if provided)
        if (initialValue) {
            setValue(initialValue);
        }

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
        // No longer needs parsing - option_value is just the prefix
        // Country code comes from option_filename
        return { countryCode: null, prefix: optionValue || '' };
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
    // Combobox style - type to filter options
    // Returns object with element and setValue method
    function buildCompactMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;

        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-currency-compact';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="fieldset-menu-button-input" placeholder="Search" autocomplete="off"><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';

        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnInput = menu.querySelector('.fieldset-menu-button-input');

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set value
        function setValue(code) {
            var found = prefixData.find(function(item) {
                return item.value === code;
            });
            if (found) {
                var countryCode = found.filename ? found.filename.replace('.svg', '') : null;
                if (countryCode) {
                    btnImg.src = window.App.getImageUrl('phonePrefixes', countryCode + '.svg');
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = found.value;
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

        // Build options - filter out entries without proper data
        prefixData.forEach(function(item) {
            // Skip entries without filename, value, or label
            if (!item.filename || !item.value || !item.label) {
                return;
            }
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;

            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('phonePrefixes', countryCode + '.svg') : '';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="' + flagUrl + '" alt=""><span class="fieldset-menu-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                if (countryCode) {
                    btnImg.src = flagUrl;
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = item.value;
                selectedCode = item.value;
                menu.classList.remove('open');
                filterOptions('');
                onSelect(item.value, item.label, countryCode);
            };
            opts.appendChild(op);

            // Store for filtering
            allOptions.push({
                element: op,
                searchText: displayText.toLowerCase() + ' ' + item.label.toLowerCase()
            });
        });

        // Set initial value
        if (initialValue) {
            setValue(initialValue);
        }

        // Data must be loaded BEFORE building menu (via FieldsetComponent.setPicklist)
        // If data isn't loaded, menu will be empty - this is expected behavior

        // Register with MenuManager
        MenuManager.register(menu);

        // Input events
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            menu.classList.add('open');
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
                setValue(selectedCode);
                filterOptions('');
            }
        });

        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        var arrow = menu.querySelector('.fieldset-menu-button-arrow');
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
        parsePrefixValue: parsePrefixValue
    };
})();


/* ============================================================================
   ICON PICKER COMPONENT
   
   IMAGE SYNC SYSTEM (Category Icons):
   This component uses the unified picklist table with option_group 'category-icon'.
   The picklist table serves as a "basket" of all available filenames for instant menu loading.
   
   1. Menu opens instantly with images from database basket (picklist table, option_group='category-icon')
   2. API call fetches current file list from Bunny CDN folder_category_icons in background
   3. New images from API are appended to menu (if not already in database basket)
   
   NO API CALLS AT STARTUP - all API calls happen only when menu opens.
   Database sync is handled by syncAllPicklists() when admin panel opens (ALL picklist types synced together).
   ============================================================================ */

const IconPickerComponent = (function(){
    
    var iconFolder = null;
    var icons = [];
    var dataLoaded = false;
    var apiCache = {}; // Cache for API results by folder path
    var categoryIconsBasket = null; // Basket of available filenames from category_icons table
    
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
    
    // Load icon folder path and basket from admin settings
    function loadFolderFromSettings() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.settings && res.settings.folder_category_icons) {
                    iconFolder = res.settings.folder_category_icons;
                }
                if (res.category_icons_basket && Array.isArray(res.category_icons_basket)) {
                    categoryIconsBasket = res.category_icons_basket;
                }
                return iconFolder;
            });
    }
    
    // Get database icons instantly (from category_icons basket table)
    function getDatabaseIcons(folderPath) {
        if (!categoryIconsBasket || !folderPath || !Array.isArray(categoryIconsBasket)) return [];
        var folder = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        var dbIcons = [];
        categoryIconsBasket.forEach(function(filename) {
            dbIcons.push(folder + filename);
        });
        return dbIcons;
    }
    
    // Load icons list - returns database icons instantly, loads API in background
    function loadIconsFromFolder(folderPath, callback) {
        folderPath = folderPath || iconFolder;
        if (!folderPath) {
            if (callback) callback([]);
            return Promise.resolve([]);
        }
        
        var folder = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        
        // Return cached API results if available for this folder
        if (apiCache[folderPath]) {
            icons = apiCache[folderPath];
            dataLoaded = true;
            if (callback) callback(apiCache[folderPath]);
            return Promise.resolve(apiCache[folderPath]);
        }
        
        // Get database icons instantly
        var dbIcons = getDatabaseIcons(folderPath);
        icons = dbIcons;
        
        // Return database icons immediately
        if (callback) callback(dbIcons);
        var dbPromise = Promise.resolve(dbIcons);
        
        // Load API in background
        fetch('/gateway.php?action=list-files&folder=' + encodeURIComponent(folderPath))
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success && Array.isArray(res.icons)) {
                    var apiIconList = res.icons.map(function(icon) {
                        return folder + icon;
                    });
                    
                    // Merge with database icons (avoid duplicates)
                    var allIcons = dbIcons.slice();
                    var dbFilenames = dbIcons.map(function(path) {
                        return getFilename(path);
                    });
                    
                    apiIconList.forEach(function(apiPath) {
                        var apiFilename = getFilename(apiPath);
                        if (dbFilenames.indexOf(apiFilename) === -1) {
                            allIcons.push(apiPath);
                        }
                    });
                    
                    // Update cache and icons
                    apiCache[folderPath] = allIcons;
                    icons = allIcons;
                    dataLoaded = true;
                    
                    // Callback with updated list if provided (menu is already loaded)
                    if (callback) callback(allIcons);
                    
                    // Note: Sync is handled by syncAllPicklists() when admin panel opens
                    // No need to sync here - database basket is already synced
                } else {
                    // API failed, but we already returned database icons
                    if (callback) callback(dbIcons);
                }
            })
            .catch(function(err) {
                console.warn('Failed to load icons from API:', err);
                // API failed, but we already returned database icons
                if (callback) callback(dbIcons);
            });
        
        return dbPromise;
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
        
        // NO PRELOADING - menu only loads when opened (admin only, doesn't affect page load speed)
        
        // Render icon options
        function renderIconOptions(iconList, isInitial) {
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
        }
        
        // NO PRELOADING - menu only loads when opened (admin only, doesn't affect page load speed)
        
        // Toggle menu
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('open');
            if (isOpen) {
                menu.classList.remove('open');
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Open menu immediately
                menu.classList.add('open');
                
                // Show database icons instantly (menu is now open and interactive)
                if (!categoryIconsBasket) {
                    loadFolderFromSettings().then(function() {
                        // Update with database icons now that they're loaded
                        var updatedDbIcons = getDatabaseIcons(iconFolder);
                        renderIconOptions(updatedDbIcons, true);
                    });
                } else {
                    var dbIcons = getDatabaseIcons(iconFolder);
                    renderIconOptions(dbIcons, true);
                }
                
                // Load API in background and append new icons (always runs)
                loadIconsFromFolder(null, function(updatedIconList) {
                    renderIconOptions(updatedIconList, false);
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
        var currency = options.currency || null;
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
                            var curr = card.dataset.currency || null;
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


/* ============================================================================
   SYSTEM IMAGE PICKER COMPONENT
   
   IMAGE SYNC SYSTEM (System Images):
   This component uses the unified picklist table with option_group 'system-image'.
   The picklist table serves as a "basket" of all available filenames for instant menu loading.
   
   1. Menu opens instantly with images from database basket (picklist table, option_group='system-image')
   2. API call fetches current file list from Bunny CDN folder_system_images in background
   3. New images from API are appended to menu (if not already in database basket)
   
   NO API CALLS AT STARTUP - all API calls happen only when menu opens.
   Database sync is handled by syncAllPicklists() when admin panel opens (ALL picklist types synced together).
   ============================================================================ */

const SystemImagePickerComponent = (function(){
    
    var imageFolder = null;
    var images = [];
    var dataLoaded = false;
    var apiCache = {}; // Cache for API results by folder path
    var systemImagesData = null; // Selected system images from admin_settings
    var systemImagesBasket = null; // Basket of available filenames from system_images table
    
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
    
    // Load system images folder path and basket from admin settings
    function loadFolderFromSettings() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.settings && res.settings.folder_system_images) {
                    imageFolder = res.settings.folder_system_images;
                }
                if (res.system_images) {
                    systemImagesData = res.system_images;
                }
                if (res.system_images_basket && Array.isArray(res.system_images_basket)) {
                    systemImagesBasket = res.system_images_basket;
                }
                return imageFolder;
            });
    }
    
    // Get database images instantly (from system_images basket table)
    function getDatabaseImages(folderPath) {
        if (!systemImagesBasket || !folderPath || !Array.isArray(systemImagesBasket)) return [];
        var folder = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        var dbImages = [];
        systemImagesBasket.forEach(function(filename) {
            dbImages.push(folder + filename);
        });
        return dbImages;
    }
    
    // Load images list - returns database images instantly, loads API in background
    function loadImagesFromFolder(folderPath, callback) {
        folderPath = folderPath || imageFolder;
        if (!folderPath) {
            if (callback) callback([]);
            return Promise.resolve([]);
        }
        
        var folder = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        
        // Return cached API results if available for this folder
        if (apiCache[folderPath]) {
            images = apiCache[folderPath];
            dataLoaded = true;
            if (callback) callback(apiCache[folderPath]);
            return Promise.resolve(apiCache[folderPath]);
        }
        
        // Get database images instantly
        var dbImages = getDatabaseImages(folderPath);
        images = dbImages;
        
        // Return database images immediately
        if (callback) callback(dbImages);
        var dbPromise = Promise.resolve(dbImages);
        
        // Load API in background
        fetch('/gateway.php?action=list-files&folder=' + encodeURIComponent(folderPath))
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success && Array.isArray(res.icons)) {
                    var apiImageList = res.icons.map(function(img) {
                        return folder + img;
                    });
                    
                    // Merge with database images (avoid duplicates)
                    var allImages = dbImages.slice();
                    var dbFilenames = dbImages.map(function(path) {
                        return getFilename(path);
                    });
                    
                    apiImageList.forEach(function(apiPath) {
                        var apiFilename = getFilename(apiPath);
                        if (dbFilenames.indexOf(apiFilename) === -1) {
                            allImages.push(apiPath);
                        }
                    });
                    
                    // Update cache and images
                    apiCache[folderPath] = allImages;
                    images = allImages;
                    dataLoaded = true;
                    
                    // Callback with updated list if provided (menu is already loaded)
                    if (callback) callback(allImages);
                    
                    // Note: Sync is handled by syncAllPicklists() when admin panel opens
                    // No need to sync here - database basket is already synced
                }
            })
            .catch(function(err) {
                console.warn('Failed to load system images from API:', err);
            });
        
        return dbPromise;
    }
    
    // Extract filename from path
    function getFilename(path) {
        if (!path) return '';
        var parts = path.split('/');
        return parts[parts.length - 1] || path;
    }
    
    // Build system image picker dropdown menu (matches menu-test.html design)
    // options: { onSelect, databaseValue } - databaseValue is checked against loaded images
    function buildPicker(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var databaseValue = options.databaseValue || null;
        var currentImage = null; // Only set if databaseValue exists in loaded images
        
        var menu = document.createElement('div');
        menu.className = 'component-systemimagepicker';
        
        // Button
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-systemimagepicker-button';
        
        var buttonImage = document.createElement('img');
        buttonImage.className = 'component-systemimagepicker-button-image';
        buttonImage.src = '';
        buttonImage.alt = '';
        buttonImage.style.display = 'none';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-systemimagepicker-button-text';
        buttonText.textContent = 'Select...';
        
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
        
        // Set button if database value exists (NO API CALL - just construct URL from folder + filename)
        // Ensure folder and system_images are loaded from settings if not already set
        var loadPromise = (imageFolder && systemImagesData) ? Promise.resolve() : loadFolderFromSettings();
        loadPromise.then(function() {
            if (databaseValue) {
                var databaseFilename = getFilename(databaseValue);
                var fullImageUrl = null;
                
                if (imageFolder) {
                    // Construct URL from folder + filename (no API call needed for button display)
                    var folder = imageFolder.endsWith('/') ? imageFolder : imageFolder + '/';
                    fullImageUrl = folder + databaseFilename;
                }
                
                if (fullImageUrl) {
                    currentImage = fullImageUrl;
                    buttonImage.src = fullImageUrl;
                    buttonImage.style.display = '';
                    buttonText.textContent = databaseFilename;
                }
            }
        });
        
        // Function to render image options (appends new ones, doesn't clear existing)
        function renderImageOptions(imageList, clearFirst) {
            if (clearFirst) {
                optionsDiv.innerHTML = '';
            }
            
            if (imageList.length === 0) {
                if (clearFirst) {
                    var msg = document.createElement('div');
                    msg.className = 'component-systemimagepicker-error';
                    msg.innerHTML = 'No images found.<br>Please set system images folder in Admin Settings.';
                    optionsDiv.appendChild(msg);
                }
            } else {
                imageList.forEach(function(imagePath) {
                    // Skip if already rendered
                    var existing = optionsDiv.querySelector('[data-image-path="' + imagePath + '"]');
                    if (existing) return;
                    
                    var option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'component-systemimagepicker-option';
                    option.setAttribute('data-image-path', imagePath);
                    
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
        }
        
        // Toggle menu
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('open');
            if (isOpen) {
                menu.classList.remove('open');
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Open menu immediately
                menu.classList.add('open');
                
                // Show database images instantly (menu is now open and interactive)
                if (!systemImagesBasket) {
                    loadFolderFromSettings().then(function() {
                        // Update with database images now that they're loaded
                        var updatedDbImages = getDatabaseImages(imageFolder);
                        renderImageOptions(updatedDbImages, true);
                    });
                } else {
                    var dbImages = getDatabaseImages(imageFolder);
                    renderImageOptions(dbImages, true);
                }
                
                // Load API in background and append new images (always runs)
                loadImagesFromFolder(null, function(updatedImageList) {
                    renderImageOptions(updatedImageList, false);
                });
            }
        };
        
        return {
            element: menu,
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


/* ============================================================================
   THREE BUTTON DIALOG COMPONENT
   Duplicated from ConfirmDialogComponent with independent classes
   Used for unsaved changes dialogs (Cancel, Save, Discard)
   ============================================================================ */

const ThreeButtonDialogComponent = (function() {
    var overlayEl = null;
    
    function ensureOverlay() {
        if (overlayEl) return overlayEl;
        
        var overlay = document.createElement('div');
        overlay.className = 'component-three-button-dialog-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('tabindex', '-1');
        
        var dialog = document.createElement('div');
        dialog.className = 'component-three-button-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'threeButtonDialogTitle');
        dialog.setAttribute('aria-describedby', 'threeButtonDialogMessage');
        
        var title = document.createElement('h2');
        title.id = 'threeButtonDialogTitle';
        title.className = 'component-three-button-dialog-title';
        
        var message = document.createElement('p');
        message.id = 'threeButtonDialogMessage';
        message.className = 'component-three-button-dialog-message';
        
        var actions = document.createElement('div');
        actions.className = 'component-three-button-dialog-actions';
        
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'component-three-button-dialog-button--cancel';
        cancelBtn.dataset.role = 'cancel';
        cancelBtn.textContent = 'Cancel';
        
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'component-three-button-dialog-button--save';
        saveBtn.dataset.role = 'save';
        saveBtn.textContent = 'Save';
        
        var discardBtn = document.createElement('button');
        discardBtn.type = 'button';
        discardBtn.className = 'component-three-button-dialog-button--discard';
        discardBtn.dataset.role = 'discard';
        discardBtn.textContent = 'Discard';
        
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        actions.appendChild(discardBtn);
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
        var titleText = options.titleText || 'Unsaved Changes';
        var messageText = options.messageText || 'You have unsaved changes. What would you like to do?';
        var cancelLabel = options.cancelLabel || 'Cancel';
        var saveLabel = options.saveLabel || 'Save';
        var discardLabel = options.discardLabel || 'Discard';
        var focusCancel = options.focusCancel !== false;
        
        var overlay = ensureOverlay();
        var title = overlay.querySelector('#threeButtonDialogTitle');
        var message = overlay.querySelector('#threeButtonDialogMessage');
        var cancelBtn = overlay.querySelector('[data-role="cancel"]');
        var saveBtn = overlay.querySelector('[data-role="save"]');
        var discardBtn = overlay.querySelector('[data-role="discard"]');
        var previousFocused = document.activeElement;
        
        // Clone buttons to remove old event listeners
        var newCancelBtn = cancelBtn.cloneNode(true);
        var newSaveBtn = saveBtn.cloneNode(true);
        var newDiscardBtn = discardBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        discardBtn.parentNode.replaceChild(newDiscardBtn, discardBtn);
        cancelBtn = newCancelBtn;
        saveBtn = newSaveBtn;
        discardBtn = newDiscardBtn;
        
        // Set content
        title.textContent = titleText;
        message.textContent = messageText;
        cancelBtn.textContent = cancelLabel;
        saveBtn.textContent = saveLabel;
        discardBtn.textContent = discardLabel;
        
        // Show overlay
        overlay.classList.add('component-three-button-dialog-overlay--visible');
        overlay.setAttribute('aria-hidden', 'false');
        
        // Focus appropriate button
        if (focusCancel) {
            cancelBtn.focus();
        } else {
            saveBtn.focus();
        }
        
        return new Promise(function(resolve) {
            function cleanup(result) {
                overlay.classList.remove('component-three-button-dialog-overlay--visible');
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
                    cleanup('cancel');
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    var focused = document.activeElement;
                    if (focused === cancelBtn) {
                        cleanup('cancel');
                    } else if (focused === saveBtn) {
                        cleanup('save');
                    } else if (focused === discardBtn) {
                        cleanup('discard');
                    }
                } else if (e.key === 'Tab') {
                    // Trap focus inside dialog
                    var buttons = [cancelBtn, saveBtn, discardBtn];
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
                    cleanup('cancel');
                }
            }
            
            cancelBtn.addEventListener('click', function() {
                cleanup('cancel');
            });
            
            saveBtn.addEventListener('click', function() {
                cleanup('save');
            });
            
            discardBtn.addEventListener('click', function() {
                cleanup('discard');
            });
            
            document.addEventListener('keydown', onKeyDown, true);
            overlay.addEventListener('click', onOverlayClick);
        });
    }
    
    return {
        show: show
    };
})();


/* ============================================================================
   TOAST COMPONENT
   Toast notifications matching old site design
   Variants: success (green), error (red), warning (yellow/orange)
   ============================================================================ */

const ToastComponent = (function() {
    var toastEl = null;
    var toastTimer = null;
    
    function ensureToastElement() {
        if (toastEl) return toastEl;
        
        var toast = document.createElement('div');
        toast.className = 'component-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-hidden', 'true');
        document.body.appendChild(toast);
        
        toastEl = toast;
        return toast;
    }
    
    function show(message, variant, duration) {
        variant = variant || 'default';
        duration = duration || 2000;
        
        if (!ensureToastElement()) return;
        
        toastEl.textContent = message || '';
        toastEl.setAttribute('aria-hidden', 'false');
        
        // Remove all variant classes
        toastEl.classList.remove(
            'component-toast--success',
            'component-toast--error',
            'component-toast--warning',
            'component-toast--show'
        );
        
        // Add variant class
        if (variant !== 'default') {
            toastEl.classList.add('component-toast--' + variant);
        }
        
        // Clear existing timer
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }
        
        // Show toast
        toastEl.classList.add('component-toast--show');
        
        // Auto-hide
        toastTimer = setTimeout(function() {
            toastEl.classList.remove('component-toast--show');
            toastEl.setAttribute('aria-hidden', 'true');
        }, duration);
    }
    
    function showSuccess(message, duration) {
        show(message, 'success', duration);
    }
    
    function showError(message, duration) {
        show(message, 'error', duration);
    }
    
    function showWarning(message, duration) {
        show(message, 'warning', duration);
    }
    
    return {
        show: show,
        showSuccess: showSuccess,
        showError: showError,
        showWarning: showWarning
    };
})();


/* ============================================================================
   WELCOME MODAL
   Full-screen modal with logo and map controls (geocoder, geolocate, compass)
   Uses big_logo from admin settings
   ============================================================================ */

const WelcomeModalComponent = (function() {
    
    var modal = null;
    var logoElement = null;
    var controlsElement = null;
    var isOpen = false;
    
    /**
     * Initialize the welcome modal
     * Finds or creates the modal element and sets up event handlers
     */
    function init() {
        modal = document.getElementById('welcome-modal');
        if (!modal) {
            // Create modal if it doesn't exist
            modal = document.createElement('div');
            modal.id = 'welcome-modal';
            modal.className = 'welcome-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = '<div class="welcome-modal-content">' +
                '<div class="welcome-modal-body" id="welcomeBody">' +
                '<img class="welcome-modal-logo" src="" alt="FunMap logo" loading="eager">' +
                '<div class="welcome-modal-controls map-controls-welcome">' +
                '<div id="geocoder-welcome" class="geocoder"></div>' +
                '<div id="geolocate-welcome" class="geolocate-btn"></div>' +
                '<div id="compass-welcome" class="compass-btn"></div>' +
                '</div>' +
                '</div>' +
                '</div>';
            
            document.body.appendChild(modal);
        }
        
        logoElement = modal.querySelector('.welcome-modal-logo');
        controlsElement = modal.querySelector('.welcome-modal-controls');
        
        // Close when clicking outside content
        modal.addEventListener('click', function(e) {
            var content = modal.querySelector('.welcome-modal-content');
            if (controlsElement && controlsElement.contains(e.target)) return;
            if (content && !content.contains(e.target)) {
                close();
            }
        });
        
        // Close on content click (but not controls)
        var content = modal.querySelector('.welcome-modal-content');
        if (content) {
            content.addEventListener('click', function(e) {
                if (controlsElement && controlsElement.contains(e.target)) return;
                close();
            });
        }
    }
    
    /**
     * Open the welcome modal
     */
    function open() {
        if (!modal) init();
        modal.classList.add('show');
        modal.removeAttribute('aria-hidden');
        isOpen = true;
        
        // Hide map controls while welcome is open
        var mapControls = document.querySelector('.map-controls');
        if (mapControls) mapControls.style.display = 'none';
    }
    
    /**
     * Close the welcome modal
     */
    function close() {
        if (!modal) return;
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        isOpen = false;
        
        // Show map controls again
        var mapControls = document.querySelector('.map-controls');
        if (mapControls) mapControls.style.display = '';
    }
    
    /**
     * Toggle the welcome modal
     */
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }
    
    /**
     * Set the logo image
     * @param {string} imagePath - Path to logo image
     */
    function setLogo(imagePath) {
        if (!modal) init();
        if (logoElement && imagePath) {
            logoElement.onload = function() {
                logoElement.classList.add('welcome-modal-logo--loaded');
                if (controlsElement) controlsElement.classList.add('welcome-modal-controls--visible');
            };
            logoElement.src = imagePath;
            if (logoElement.complete) {
                logoElement.classList.add('welcome-modal-logo--loaded');
                if (controlsElement) controlsElement.classList.add('welcome-modal-controls--visible');
            }
        }
    }
    
    /**
     * Check if modal is currently open
     * @returns {boolean}
     */
    function isVisible() {
        return isOpen;
    }
    
    /**
     * Get the modal element
     * @returns {HTMLElement}
     */
    function getElement() {
        if (!modal) init();
        return modal;
    }
    
    return {
        init: init,
        open: open,
        close: close,
        toggle: toggle,
        setLogo: setLogo,
        isVisible: isVisible,
        getElement: getElement
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
window.WelcomeModalComponent = WelcomeModalComponent;

