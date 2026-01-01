/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   STRUCTURE:
   - ICONS               - (removed) no hard-coded SVG icons allowed in new site
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
   - AVATAR CROPPER      - Standalone reusable avatar cropper (destructive, outputs blob)
   
   ============================================================================ */

// Components loaded


/* ============================================================================
   IMAGE ADD TILE (Camera + "Add")
   Shared markup for "Add image" tiles (eg. member avatar add, fieldset images add).
   ============================================================================ */

const ImageAddTileComponent = (function(){
    
    function cameraSvgMarkup() {
        // No hard-coded SVG fallbacks allowed (icons must come from system images).
        return '';
    }
    
    // Returns HTML string (so callers can drop into innerHTML safely)
    // options: { iconClass, textClass, label }
    function buildMarkup(options) {
        options = options || {};
        var iconClass = options.iconClass || '';
        var textClass = options.textClass || '';
        var label = options.label || 'Add';

        return (
            '<div class="' + iconClass + '"></div>' +
            '<div class="' + textClass + '">' + label + '</div>'
        );
    }
    
    return {
        cameraSvgMarkup: cameraSvgMarkup,
        buildMarkup: buildMarkup
    };
})();


/* ============================================================================
   MENU MANAGER
   Global manager to close all open menus when clicking outside or opening another
   ============================================================================ */

const MenuManager = (function(){
    var openMenus = [];

    /* --------------------------------------------------------------------------
       TYPE-TO-FILTER MENUS (no click required)
       When a menu is open, typing should go into its input automatically.
       -------------------------------------------------------------------------- */

    function isEditableTarget(t) {
        if (!t || !(t instanceof Element)) return false;
        try {
            if (t.isContentEditable) return true;
            if (t.closest && t.closest('input, textarea, select, option, [contenteditable], [contenteditable="true"], [contenteditable="plaintext-only"]')) return true;
        } catch (e) {}
        return false;
    }

    function getOpenMenu() {
        var open = null;
        try {
            openMenus.forEach(function(menu) {
                try {
                    if (menu && isMenuOpen(menu)) open = menu;
                } catch (e0) {}
            });
        } catch (e1) {}
        return open;
    }

    function getMenuTypingInput(menu) {
        if (!menu || !menu.querySelector) return null;
        try {
            // Menus designed to accept typing in their "button" row.
            return (
                menu.querySelector('input.fieldset-menu-button-input') ||
                menu.querySelector('input.component-currencycompact-menu-button-input') ||
                menu.querySelector('input.component-currencyfull-menu-button-input') ||
                menu.querySelector('input.admin-language-button-input') ||
                null
            );
        } catch (e) {
            return null;
        }
    }

    function applyTypingKeyToInput(input, e) {
        if (!input || !e) return false;
        var key = String(e.key || '');
        var hasModifier = !!(e.ctrlKey || e.metaKey || e.altKey);
        if (hasModifier) return false;

        var isBackspace = key === 'Backspace';
        var isChar = key.length === 1;
        if (!isBackspace && !isChar) return false;

        try {
            if (document.activeElement !== input) {
                input.focus();
                try { input.select(); } catch (e0) {}
            }

            var v = String(input.value || '');
            var s = (typeof input.selectionStart === 'number') ? input.selectionStart : v.length;
            var en = (typeof input.selectionEnd === 'number') ? input.selectionEnd : v.length;

            var next = v;
            if (isBackspace) {
                if (s !== en) {
                    next = v.slice(0, s) + v.slice(en);
                } else if (s > 0) {
                    next = v.slice(0, s - 1) + v.slice(en);
                }
            } else {
                next = v.slice(0, s) + key + v.slice(en);
            }

            input.value = next;

            try {
                var caret = isBackspace ? Math.max(0, s - 1) : (s + 1);
                input.setSelectionRange(caret, caret);
            } catch (e1) {}

            try {
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e2) {
                var ev = document.createEvent('Event');
                ev.initEvent('input', true, true);
                input.dispatchEvent(ev);
            }

            if (typeof e.preventDefault === 'function') e.preventDefault();
            return true;
        } catch (e3) {
            return false;
        }
    }
    
    function isMenuOpen(menu) {
        if (!menu) return false;
        if (typeof menu.__menuIsOpen !== 'function') {
            throw new Error('MenuManager: menu is missing __menuIsOpen()');
        }
        return menu.__menuIsOpen() === true;
    }
    
    function setMenuOpen(menu, isOpen) {
        if (!menu) return;
        if (typeof menu.__menuApplyOpenState !== 'function') {
            throw new Error('MenuManager: menu is missing __menuApplyOpenState(isOpen)');
        }
        var wasOpen = isMenuOpen(menu);
        menu.__menuApplyOpenState(!!isOpen);
        // If closing the menu, trigger the revert callback to restore selected value
        if (wasOpen && !isOpen && typeof menu.__menuOnClose === 'function') {
            menu.__menuOnClose();
        }
    }
    
    // Close all open menus
    function closeAll(except) {
        openMenus.forEach(function(menu) {
            if (menu !== except && isMenuOpen(menu)) setMenuOpen(menu, false);
        });
    }
    
    // Register a menu element
    function register(menuElement) {
        if (!menuElement || typeof menuElement.__menuIsOpen !== 'function' || typeof menuElement.__menuApplyOpenState !== 'function') {
            throw new Error('MenuManager.register: menuElement must define __menuIsOpen() and __menuApplyOpenState(isOpen)');
        }
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
                setMenuOpen(menu, false);
            }
        });
    });

    // Type-to-filter: if a menu is open, route keystrokes to its input without requiring a click.
    document.addEventListener('keydown', function(e) {
        try {
            if (!e) return;
            if (isEditableTarget(e.target)) return;

            var menu = getOpenMenu();
            if (!menu) return;

            if (e.key === 'Escape') {
                setMenuOpen(menu, false);
                if (typeof e.preventDefault === 'function') e.preventDefault();
                return;
            }

            var input = getMenuTypingInput(menu);
            if (!input) return;
            applyTypingKeyToInput(input, e);
        } catch (e0) {}
    }, true);
    
    return {
        closeAll: closeAll,
        register: register,
        isOpen: isMenuOpen,
        setOpen: setMenuOpen
    };
})();

window.MenuManager = MenuManager;

/* --------------------------------------------------------------------------
   MENU FILTER MATCHING (prefix/word-start, not substring-anywhere)
   -------------------------------------------------------------------------- */

function menuFilterMatch(optData, searchText) {
    var s = String(searchText || '').trim().toLowerCase();
    if (!s) return true;
    if (!optData) return false;

    var value = String(optData.valueLower || '').toLowerCase();
    var label = String(optData.labelLower || '').toLowerCase();
    var words = optData.labelWords || [];

    var tokens = s.split(/\s+/).filter(Boolean);
    for (var i = 0; i < tokens.length; i++) {
        var raw = tokens[i];
        // Allow optional '+' prefix for phone prefixes.
        // "+61" and "61" should behave the same for numeric matching.
        var hasPlus = raw.charAt(0) === '+';
        var t = hasPlus ? raw.slice(1) : raw;
        if (!t) t = raw; // If user typed just "+", fall back to raw.
        var isNumeric = /^[0-9]+$/.test(t);

        var ok = false;
        if (isNumeric) {
            // Numeric search prefers prefix matching against value, ignoring optional '+'.
            var vDigits = value.charAt(0) === '+' ? value.slice(1) : value;
            ok = vDigits.indexOf(t) === 0;
        } else {
            if (value.indexOf(t) === 0) ok = true;
            if (!ok && label.indexOf(t) === 0) ok = true;
            if (!ok && Array.isArray(words)) {
                for (var w = 0; w < words.length; w++) {
                    if (String(words[w] || '').indexOf(t) === 0) { ok = true; break; }
                }
            }
        }

        if (!ok) return false;
    }
    return true;
}

/* --------------------------------------------------------------------------
   MENU ARROW KEY NAVIGATION
   Allows navigating menu options with ArrowUp/ArrowDown and selecting with Enter.
   -------------------------------------------------------------------------- */

function menuArrowKeyNav(e, optsContainer, optionSelector, onSelect) {
    if (!e || !optsContainer) return false;
    var key = e.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Enter') return false;
    
    // Get visible options only
    var allOpts = Array.from(optsContainer.querySelectorAll(optionSelector));
    var visibleOpts = allOpts.filter(function(opt) {
        return opt.offsetParent !== null && !opt.hidden && opt.style.display !== 'none';
    });
    if (visibleOpts.length === 0) return false;
    
    // Find currently highlighted option
    var highlightClass = 'menu-option--highlighted';
    var currentIdx = -1;
    for (var i = 0; i < visibleOpts.length; i++) {
        if (visibleOpts[i].classList.contains(highlightClass)) {
            currentIdx = i;
            break;
        }
    }
    
    if (key === 'Enter') {
        if (currentIdx >= 0 && visibleOpts[currentIdx]) {
            e.preventDefault();
            visibleOpts[currentIdx].click();
            return true;
        }
        return false;
    }
    
    // ArrowUp / ArrowDown
    e.preventDefault();
    var nextIdx;
    if (key === 'ArrowDown') {
        nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % visibleOpts.length;
    } else {
        nextIdx = currentIdx <= 0 ? visibleOpts.length - 1 : currentIdx - 1;
    }
    
    // Remove highlight from all, add to new
    visibleOpts.forEach(function(opt) { opt.classList.remove(highlightClass); });
    visibleOpts[nextIdx].classList.add(highlightClass);
    
    // Scroll into view
    try {
        visibleOpts[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (err) {
        visibleOpts[nextIdx].scrollIntoView(false);
    }
    
    return true;
}


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
        if (!options) {
            throw new Error('ClearButtonComponent.create: options parameter is required');
        }
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clear-button';
        if (options.className) {
            btn.className += ' ' + options.className;
        }
        if (options.ariaLabel) {
            btn.setAttribute('aria-label', options.ariaLabel);
        }
        btn.innerHTML = '<span class="clear-button-icon" aria-hidden="true"></span>';
        
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
            // Add icon span if button doesn't already have one
            if (!btn.querySelector('.clear-button-icon')) {
                btn.innerHTML = '<span class="clear-button-icon" aria-hidden="true"></span>';
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
        if (!options) {
            throw new Error('SwitchComponent.create: options parameter is required');
        }
        
        var size = options.size;
        var checked = options.checked;
        
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
        slider.classList.toggle(prefix + '-slider--on', !!input.checked);
        
        label.appendChild(input);
        label.appendChild(slider);
        
            input.addEventListener('change', function() {
            slider.classList.toggle(prefix + '-slider--on', !!input.checked);
            if (typeof options.onChange === 'function') {
                options.onChange(input.checked);
        }
        });
        
        return {
            element: label,
            input: input,
            isChecked: function() {
                return input.checked;
            },
            setChecked: function(value) {
                input.checked = !!value;
                slider.classList.toggle(prefix + '-slider--on', !!input.checked);
            },
            toggle: function() {
                input.checked = !input.checked;
                slider.classList.toggle(prefix + '-slider--on', !!input.checked);
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
   FIELDSET BUILDER
   Source: fieldset-test.html
   ============================================================================ */

const FieldsetBuilder = (function(){
    var dropdownOptions = {};
    var fieldsets = [];
    var dataLoaded = false;
    var loadPromise = null;
    
    // Load data from various tables (currencies, phone_prefixes, amenities, etc.) from database
    function loadFromDatabase() {
        if (loadPromise) return loadPromise;
        loadPromise = fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.dropdown_options) {
                    // Set dropdown options data and propagate to CurrencyComponent and PhonePrefixComponent
                    setPicklist(res.dropdown_options);
                }
                dataLoaded = true;
                return { dropdown_options: dropdownOptions, fieldsets: fieldsets };
            });
        return loadPromise;
    }
    
    // Google Places Autocomplete helper - Uses new API (AutocompleteSuggestion)
    // type: 'address' | 'establishment' | '(cities)'
    // countryInput: hidden <input> to receive 2-letter country code (e.g. "AU")
    function initGooglePlaces(inputElement, type, latInput, lngInput, countryInput, statusElement) {
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
        
        // Track whether the current value is confirmed from Google Places (required for "complete")
        try { inputElement.dataset.placesConfirmed = 'false'; } catch (e0) {}

        function clearConfirmedLocation(emitChange) {
            try { inputElement.dataset.placesConfirmed = 'false'; } catch (e1) {}
            if (latInput) latInput.value = '';
            if (lngInput) lngInput.value = '';
            if (countryInput) countryInput.value = '';
            if (statusElement) {
                statusElement.textContent = '';
                statusElement.className = 'fieldset-location-status';
            }
            if (emitChange) {
                // Use a non-input event to avoid recursion with the input handler.
                try { inputElement.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
            }
        }

        function extractCountryCode(place) {
            // New Places API may expose `addressComponents` entries like:
            // { shortText, longText, types: [...] }
            try {
                var comps = place && place.addressComponents ? place.addressComponents : null;
                if (!Array.isArray(comps)) return '';
                for (var i = 0; i < comps.length; i++) {
                    var c = comps[i];
                    if (!c) continue;
                    var types = c.types;
                    if (!Array.isArray(types) || types.indexOf('country') === -1) continue;
                    var raw = (c.shortText || c.short_name || c.short || c.longText || c.long_name || '');
                    var code = String(raw || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
                    if (code.length === 2) return code;
                }
            } catch (e) {}
            return '';
        }

        // Fetch suggestions using new API (same as map controls - no type restrictions)
        var debounceTimer = null;
        async function fetchSuggestions(query) {
            if (!query || query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            try {
                // Use same API call as map controls (no type restrictions)
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
                            await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'addressComponents'] });
                            
                            if (place.location) {
                                var lat = place.location.lat();
                                var lng = place.location.lng();
                                var cc = extractCountryCode(place);
                                
                                inputElement.value = place.displayName || place.formattedAddress || mainText;
                                dropdown.style.display = 'none';
                                
                                if (latInput) latInput.value = lat;
                                if (lngInput) lngInput.value = lng;
                                if (countryInput) countryInput.value = cc;
                                try { inputElement.dataset.placesConfirmed = 'true'; } catch (e3) {}
                                try { inputElement.dispatchEvent(new Event('change', { bubbles: true })); } catch (e4) {}
                                
                                if (statusElement) {
                                    statusElement.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                                    statusElement.className = 'fieldset-location-status success';
                                }
                            } else {
                                clearConfirmedLocation(true);
                                if (statusElement) {
                                    statusElement.textContent = 'No location data for this place';
                                    statusElement.className = 'fieldset-location-status error';
                                }
                            }
                        } catch (err) {
                            console.error('Place details error:', err);
                            clearConfirmedLocation(true);
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
        
        // If the user types, the location is no longer confirmed (must pick from Google again).
        inputElement.addEventListener('input', function() {
            // Manual typing invalidates confirmation, but must not re-dispatch input (would recurse).
            clearConfirmedLocation(false);
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
            console.error('[FieldsetBuilder] CurrencyComponent not available');
            return document.createElement('div');
        }
        // Use defaultCurrency if provided (user must select if not provided)
        var initialValue = defaultCurrency;
        var result = CurrencyComponent.buildCompactMenu({
            initialValue: initialValue,
            container: container
        });
        return result.element;
    }
    
    // Build phone prefix menu - uses PhonePrefixComponent
    function buildPhonePrefixMenu(container) {
        if (typeof PhonePrefixComponent === 'undefined') {
            console.error('[FieldsetBuilder] PhonePrefixComponent not available');
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
    function buildLabel(name, tooltip, minLength, maxLength) {
        var label = document.createElement('div');
        label.className = 'fieldset-label';
        label.innerHTML = '<span class="fieldset-label-text">' + name + '</span><span class="fieldset-label-required">*</span>';
        
        // Build tooltip text with character limits appended
        var tooltipText = tooltip;
        var charLimitText = '';
        
        if (minLength !== null && minLength !== undefined && maxLength !== null && maxLength !== undefined) {
            charLimitText = minLength + '-' + maxLength + ' characters';
        } else if (maxLength !== null && maxLength !== undefined) {
            charLimitText = 'Maximum ' + maxLength + ' characters';
        } else if (minLength !== null && minLength !== undefined) {
            charLimitText = 'Minimum ' + minLength + ' characters';
        }
        
        if (charLimitText) {
            if (tooltipText) {
                // Match live-site style: visually separate tooltip body from char-limit note.
                tooltipText = tooltipText + '\n──────────\n' + charLimitText;
            } else {
                tooltipText = charLimitText;
            }
        }
        
        if (tooltipText) {
            var tip = document.createElement('span');
            tip.className = 'fieldset-label-tooltip';
            tip.textContent = 'i';
            tip.setAttribute('data-tooltip', tooltipText);
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
        
        // ENFORCE maxlength via HTML attribute (prevents most excessive input)
        if (typeof maxLength === 'number' && isFinite(maxLength) && maxLength > 0) {
            input.setAttribute('maxlength', String(maxLength));
        }

        // Handle paste events to truncate oversized content safely (prevents browser freeze from massive paste)
        input.addEventListener('paste', function(e) {
            if (typeof maxLength !== 'number' || !isFinite(maxLength) || maxLength <= 0) return;
            if (!e) return;

            var pastedText = '';
            try {
                if (e.clipboardData && typeof e.clipboardData.getData === 'function') {
                    pastedText = e.clipboardData.getData('text') || '';
                } else if (window.clipboardData && typeof window.clipboardData.getData === 'function') {
                    pastedText = window.clipboardData.getData('text') || '';
                }
            } catch (err) {
                pastedText = '';
            }

            if (!pastedText) return;

            var currentValue = input.value || '';
            var selStart = (typeof input.selectionStart === 'number') ? input.selectionStart : currentValue.length;
            var selEnd = (typeof input.selectionEnd === 'number') ? input.selectionEnd : currentValue.length;
            var before = currentValue.slice(0, selStart);
            var after = currentValue.slice(selEnd);
            var nextValue = before + pastedText + after;

            if (nextValue.length > maxLength) {
                e.preventDefault();
                var availableSpace = maxLength - before.length - after.length;
                var truncatedPaste = pastedText.slice(0, Math.max(0, availableSpace));
                input.value = (before + truncatedPaste + after).slice(0, maxLength);
                try {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (err2) {}
            }
        });
        
        function updateCharCount() {
            if (typeof maxLength !== 'number' || !isFinite(maxLength) || maxLength <= 0) {
                charCount.style.display = 'none';
                charCount.textContent = '';
                charCount.className = 'fieldset-char-count';
                return;
            }

            var len = (input.value || '').length;
            var remaining = maxLength - len;

            // Live-site behavior: show only when within 10 chars of max (or over).
            if (remaining <= 10 || remaining < 0) {
                charCount.style.display = 'block';
                if (remaining < 0) {
                    charCount.textContent = Math.abs(remaining) + ' over limit';
                    charCount.className = 'fieldset-char-count fieldset-char-count--danger';
                } else if (remaining === 0) {
                    charCount.textContent = '0 remaining';
                    charCount.className = 'fieldset-char-count fieldset-char-count--warning';
                } else {
                    charCount.textContent = remaining + ' remaining';
                    charCount.className = 'fieldset-char-count fieldset-char-count--warning';
                }
            } else {
                charCount.style.display = 'none';
                charCount.textContent = '';
                charCount.className = 'fieldset-char-count';
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
        
        input.addEventListener('input', function() {
            updateCharCount();
            if (touched) validate();
        });
        
        input.addEventListener('change', function() {
            updateCharCount();
        });
        
        input.addEventListener('blur', function() {
            touched = true;
            updateCharCount();
            validate();
        });
        
        // Initial render
            updateCharCount();
        
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

    // Money input behavior (prices): digits + one dot, max 2 decimals; format to 2 decimals on blur.
    // Uses text input with inputMode=decimal to avoid browser 'number' quirks (e/E, locale issues).
    function attachMoneyInputBehavior(input) {
        if (!input) return;
        input.type = 'text';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';

        function sanitize(raw) {
            var val = (raw || '').toString();
            val = val.trim();

            // Support comma decimal when no dot is present (e.g. "14,5" -> "14.5")
            if (val.indexOf(',') !== -1 && val.indexOf('.') === -1) {
                val = val.replace(/,/g, '.');
            } else {
                val = val.replace(/,/g, '');
            }

            // Keep only digits and dot
            val = val.replace(/[^0-9.]/g, '');

            // Only one dot
            var firstDot = val.indexOf('.');
            if (firstDot !== -1) {
                var before = val.slice(0, firstDot + 1);
                var after = val.slice(firstDot + 1).replace(/\./g, '');
                // Max 2 decimals
                after = after.slice(0, 2);
                val = before + after;
            }

            return val;
        }

        input.addEventListener('keydown', function(e) {
            if (!e) return;
            var k = e.key;
            // Allow navigation/control keys
            if (
                k === 'Backspace' || k === 'Delete' || k === 'Tab' || k === 'Enter' ||
                k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' ||
                k === 'Home' || k === 'End' || k === 'Escape'
            ) {
                return;
            }
            // Allow Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) return;
            if (typeof k !== 'string' || k.length !== 1) return;

            // Block anything not digit/dot
            if (!(/[0-9.]/.test(k))) {
                e.preventDefault();
                return;
            }
            // Block second dot
            if (k === '.' && this.value.indexOf('.') !== -1) {
                e.preventDefault();
                return;
            }
        });

        input.addEventListener('input', function() {
            var next = sanitize(this.value);
            if (this.value !== next) {
                this.value = next;
            }
            if (typeof this.setCustomValidity === 'function') {
                this.setCustomValidity('');
            }
        });

        input.addEventListener('blur', function() {
            var cleaned = sanitize(this.value);
            if (cleaned === '') {
                this.value = '';
                if (typeof this.setCustomValidity === 'function') {
                    this.setCustomValidity('');
                }
                return;
            }
            var num = parseFloat(cleaned);
            if (!isFinite(num)) {
                if (typeof this.setCustomValidity === 'function') {
                    this.setCustomValidity('Please enter a valid price.');
                    if (typeof this.reportValidity === 'function') this.reportValidity();
                }
                return;
            }
            this.value = num.toFixed(2);
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
    
    // Set dropdown options data and propagate to external components
    function setPicklist(data) {
        dropdownOptions = data;
        // Also set data in Currency and PhonePrefix components
        if (data && data.currency && typeof CurrencyComponent !== 'undefined') {
            CurrencyComponent.setData(data.currency);
        }
        if (data && data['phone-prefix'] && typeof PhonePrefixComponent !== 'undefined') {
            PhonePrefixComponent.setData(data['phone-prefix']);
        }
        if (data && data.country && typeof CountryComponent !== 'undefined') {
            CountryComponent.setData(data.country);
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
        if (!options) {
            throw new Error('FieldsetBuilder.buildFieldset: options parameter is required');
        }
        var idPrefix = options.idPrefix;
        var index = options.fieldIndex;
        var container = options.container;
        var defaultCurrency = options.defaultCurrency;
        
        function applyFieldsetRowItemClasses(rowEl) {
            if (!rowEl) return;
            Array.from(rowEl.children).forEach(function(child) {
                if (!child || !child.classList) return;
                child.classList.add('fieldset-row-item');
                
                if (child.classList.contains('fieldset-menu')) child.classList.add('fieldset-row-item--menu');
                if (child.classList.contains('fieldset-currency-wrapper')) child.classList.add('fieldset-row-item--currency-wrapper');
                if (child.classList.contains('component-currencycompact-menu')) child.classList.add('fieldset-row-item--currency-compact');
                if (child.classList.contains('fieldset-input-small')) child.classList.add('fieldset-row-item--input-small');
                if (child.classList.contains('fieldset-pricing-add') || child.classList.contains('fieldset-pricing-remove')) {
                    child.classList.add('fieldset-row-item--no-flex');
                }
            });
        }
        
        var fieldset = document.createElement('div');
        fieldset.className = 'fieldset';
        
        var key = fieldData.fieldset_key || fieldData.key;
        var name = fieldData.fieldset_name || fieldData.name;
        if (typeof key === 'string' && key.trim() !== '') {
            fieldset.dataset.fieldsetKey = key;
        }
        // Expose canonical type/name for any callers that serialize fieldsets (member/admin).
        // This must be component-owned so all consumers behave identically.
        try {
            fieldset.dataset.fieldsetType = (typeof key === 'string') ? String(key).trim() : '';
            fieldset.dataset.fieldsetName = (typeof name === 'string') ? String(name).trim() : '';
        } catch (e) {}
        
        // Get tooltip: check customTooltip first (editable fieldsets), then tooltip, then fieldset_tooltip
        var tooltip = fieldData.customTooltip || fieldData.tooltip || fieldData.fieldset_tooltip;
        if (!tooltip && key && fieldsets && fieldsets.length > 0) {
            var matchingFieldset = fieldsets.find(function(fs) {
                return fs.value === key || fs.key === key || fs.fieldset_key === key || fs.fieldsetKey === key;
            });
            if (matchingFieldset && matchingFieldset.fieldset_tooltip) {
                tooltip = matchingFieldset.fieldset_tooltip;
            }
        }
        
        // Canonical: fieldset_placeholder (from DB). Editable override: customPlaceholder (from fieldset_mods).
        var placeholder = fieldData.customPlaceholder || fieldData.fieldset_placeholder;
        var minLength = fieldData.min_length;
        var maxLength = fieldData.max_length;
        var fieldOptions = fieldData.fieldset_options || fieldData.options;
        var fields = fieldData.fieldset_fields;

        function applyPlaceholder(el, value) {
            if (!el) return;
            if (typeof value !== 'string') return;
            var v = value.trim();
            if (!v) return;
            el.placeholder = v;
        }
        
        // Build based on fieldset type
        // CRITICAL: No fallbacks. Fieldset keys must match DB-defined keys exactly.
        switch (key) {
            case 'password':
            case 'confirm-password':
            case 'new-password':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var pwInput = document.createElement('input');
                pwInput.type = 'password';
                pwInput.className = 'fieldset-input';
                applyPlaceholder(pwInput, placeholder);
                var pwValidation = addInputValidation(pwInput, minLength, maxLength, null);
                fieldset.appendChild(pwInput);
                fieldset.appendChild(pwValidation.charCount);
                break;

            case 'title':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'fieldset-input';
                applyPlaceholder(titleInput, placeholder);
                var titleValidation = addInputValidation(titleInput, minLength, maxLength, null);
                fieldset.appendChild(titleInput);
                fieldset.appendChild(titleValidation.charCount);
                break;
            
            case 'coupon':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var couponInput = document.createElement('input');
                couponInput.type = 'text';
                couponInput.className = 'fieldset-input';
                applyPlaceholder(couponInput, placeholder);
                var couponValidation = addInputValidation(couponInput, minLength, maxLength, null);
                fieldset.appendChild(couponInput);
                fieldset.appendChild(couponValidation.charCount);
                break;
                
            case 'description':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var descTextarea = document.createElement('textarea');
                descTextarea.className = 'fieldset-textarea';
                applyPlaceholder(descTextarea, placeholder);
                var descValidation = addInputValidation(descTextarea, minLength, maxLength, null);
                fieldset.appendChild(descTextarea);
                fieldset.appendChild(descValidation.charCount);
                break;
                
            case 'custom_text': // post_map_cards.custom_text
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var textBoxInput = document.createElement('input');
                textBoxInput.type = 'text';
                textBoxInput.className = 'fieldset-input';
                applyPlaceholder(textBoxInput, placeholder);
                var textBoxValidation = addInputValidation(textBoxInput, minLength, maxLength, null);
                fieldset.appendChild(textBoxInput);
                fieldset.appendChild(textBoxValidation.charCount);
                break;
                
            case 'custom_textarea': // post_map_cards.custom_textarea
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var editableTextarea = document.createElement('textarea');
                editableTextarea.className = 'fieldset-textarea';
                applyPlaceholder(editableTextarea, placeholder);
                var textareaValidation = addInputValidation(editableTextarea, minLength, maxLength, null);
                fieldset.appendChild(editableTextarea);
                fieldset.appendChild(textareaValidation.charCount);
                break;
                
            case 'custom_dropdown': // post_map_cards.custom_dropdown
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
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
                
            case 'custom_radio': // post_map_cards.custom_radio
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
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
            case 'account_email':
            case 'public_email':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var emailInput = document.createElement('input');
                emailInput.type = 'email';
                emailInput.className = 'fieldset-input';
                applyPlaceholder(emailInput, placeholder);
                var emailValidation = addInputValidation(emailInput, minLength, maxLength, isValidEmail);
                fieldset.appendChild(emailInput);
                fieldset.appendChild(emailValidation.charCount);
                break;
                
            case 'phone':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var phoneRow = document.createElement('div');
                phoneRow.className = 'fieldset-row';
                phoneRow.appendChild(buildPhonePrefixMenu(container));
                var phoneInput = document.createElement('input');
                phoneInput.type = 'tel';
                phoneInput.className = 'fieldset-input';
                applyPlaceholder(phoneInput, placeholder);
                makePhoneDigitsOnly(phoneInput);
                var phoneValidation = addInputValidation(phoneInput, minLength, maxLength, null);
                phoneRow.appendChild(phoneInput);
                applyFieldsetRowItemClasses(phoneRow);
                fieldset.appendChild(phoneRow);
                fieldset.appendChild(phoneValidation.charCount);
                break;
                
            case 'address':
            case 'location': // legacy support
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var addrInputEl = document.createElement('input');
                addrInputEl.type = 'text';
                addrInputEl.className = 'fieldset-input';
                applyPlaceholder(addrInputEl, placeholder);
                fieldset.appendChild(addrInputEl);
                // Hidden lat/lng fields
                var addrLatInput = document.createElement('input');
                addrLatInput.type = 'hidden';
                addrLatInput.className = 'fieldset-lat';
                var addrLngInput = document.createElement('input');
                addrLngInput.type = 'hidden';
                addrLngInput.className = 'fieldset-lng';
                var addrCountryInput = document.createElement('input');
                addrCountryInput.type = 'hidden';
                addrCountryInput.className = 'fieldset-country';
                fieldset.appendChild(addrLatInput);
                fieldset.appendChild(addrLngInput);
                fieldset.appendChild(addrCountryInput);
                // Status indicator
                var addrStatus = document.createElement('div');
                addrStatus.className = 'fieldset-location-status';
                fieldset.appendChild(addrStatus);
                // Init Google Places
                initGooglePlaces(addrInputEl, 'address', addrLatInput, addrLngInput, addrCountryInput, addrStatus);
                break;
                
            case 'city':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var cityInputEl = document.createElement('input');
                cityInputEl.type = 'text';
                cityInputEl.className = 'fieldset-input';
                applyPlaceholder(cityInputEl, placeholder);
                fieldset.appendChild(cityInputEl);
                // Hidden lat/lng fields
                var cityLatInput = document.createElement('input');
                cityLatInput.type = 'hidden';
                cityLatInput.className = 'fieldset-lat';
                var cityLngInput = document.createElement('input');
                cityLngInput.type = 'hidden';
                cityLngInput.className = 'fieldset-lng';
                var cityCountryInput = document.createElement('input');
                cityCountryInput.type = 'hidden';
                cityCountryInput.className = 'fieldset-country';
                fieldset.appendChild(cityLatInput);
                fieldset.appendChild(cityLngInput);
                fieldset.appendChild(cityCountryInput);
                // Status indicator
                var cityStatus = document.createElement('div');
                cityStatus.className = 'fieldset-location-status';
                fieldset.appendChild(cityStatus);
                // Init Google Places (cities only)
                initGooglePlaces(cityInputEl, '(cities)', cityLatInput, cityLngInput, cityCountryInput, cityStatus);
                break;
                
            case 'website-url':
            case 'tickets-url':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var urlInput = document.createElement('input');
                urlInput.type = 'text'; // text not url, we handle protocol
                urlInput.className = 'fieldset-input';
                applyPlaceholder(urlInput, placeholder);
                autoUrlProtocol(urlInput);
                var urlValidation = addInputValidation(urlInput, minLength, maxLength, isValidUrl);
                fieldset.appendChild(urlInput);
                fieldset.appendChild(urlValidation.charCount);
                break;
                
            case 'images':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                
                var imagesContainer = document.createElement('div');
                imagesContainer.className = 'fieldset-images-container';
                
                // Each entry: { file, fileUrl, cropState?, cropRect?, previewUrl? }
                // cropRect: { x1, y1, x2, y2 } in original image pixels (for Bunny Dynamic Image API crop=...)
                var imageEntries = [];
                var nextImageEntryId = 1;
                var maxImages = 10;

                // Hidden JSON payload so the outside form serializer can pick up crop info later.
                // NOTE: This fieldset currently manages files in-memory; upload/saving is implemented elsewhere.
                var imagesMetaInput = document.createElement('input');
                imagesMetaInput.type = 'hidden';
                imagesMetaInput.className = 'fieldset-images-meta';
                imagesMetaInput.value = '[]';
                fieldset.appendChild(imagesMetaInput);

                function updateImagesMeta() {
                    try {
                        var payload = imageEntries.map(function(entry) {
                            return {
                                file_name: entry && entry.file ? (entry.file.name || '') : '',
                                file_type: entry && entry.file ? (entry.file.type || '') : '',
                                file_size: entry && entry.file ? (entry.file.size || 0) : 0,
                                crop: entry && entry.cropRect ? {
                                    x1: entry.cropRect.x1,
                                    y1: entry.cropRect.y1,
                                    x2: entry.cropRect.x2,
                                    y2: entry.cropRect.y2
                                } : null
                            };
                        });
                        imagesMetaInput.value = JSON.stringify(payload);

                        // Notify FieldsetBuilder validity system (required asterisk + dataset.complete).
                        // The hidden input value changes programmatically, so we must emit an event.
                        try {
                            imagesMetaInput.dispatchEvent(new Event('input', { bubbles: true }));
                        } catch (e2) {}
                    } catch (e) {
                        // If JSON fails, we want the error visible (no silent fallback)
                        throw e;
                    }
                }

                function revokeEntryUrls(entry) {
                    if (!entry) return;
                    if (entry.previewUrl && typeof entry.previewUrl === 'string' && entry.previewUrl.indexOf('blob:') === 0) {
                        try { URL.revokeObjectURL(entry.previewUrl); } catch (e) {}
                    }
                    if (entry.fileUrl && typeof entry.fileUrl === 'string' && entry.fileUrl.indexOf('blob:') === 0) {
                        try { URL.revokeObjectURL(entry.fileUrl); } catch (e) {}
                    }
                    entry.previewUrl = '';
                    entry.fileUrl = '';
                }

                // ------------------------------------------------------------------
                // Cropper - uses PostCropperComponent (non-destructive for post images)
                // Uses Bunny Dynamic Image API crop params later (server-side + cached).
                // ------------------------------------------------------------------

                var currentCropEntry = null;

                function openCropperForEntry(entry) {
                    if (!entry || !entry.fileUrl) return;
                    
                    if (!window.PostCropperComponent) {
                        console.error('[Fieldset] PostCropperComponent not available');
                        return;
                    }
                    
                    currentCropEntry = entry;
                    
                    PostCropperComponent.open({
                        url: entry.fileUrl,
                        cropState: entry.cropState || null,
                        callback: function(result) {
                            if (!result || !currentCropEntry) return;
                            
                            currentCropEntry.cropState = result.cropState;
                            currentCropEntry.cropRect = result.cropRect;
                            
                            updateImagesMeta();
                            renderEntryPreviewFromCrop(currentCropEntry);
                            currentCropEntry = null;
                        }
                    });
                }

                function renderEntryPreviewFromCrop(entry) {
                    if (!entry || !entry.fileUrl || !entry.cropRect) return;

                    // Create a small local preview so users see exactly what the square crop will look like.
                    var url = entry.fileUrl;
                    var img = new Image();
                    img.onload = function() {
                        var iw = img.naturalWidth || img.width;
                        var ih = img.naturalHeight || img.height;
                        if (!iw || !ih) return;

                        var rect = entry.cropRect;
                        var sx = Math.max(0, Math.min(iw, rect.x1));
                        var sy = Math.max(0, Math.min(ih, rect.y1));
                        var sw = Math.max(1, Math.min(iw - sx, rect.x2 - rect.x1));
                        var sh = Math.max(1, Math.min(ih - sy, rect.y2 - rect.y1));

                        var canvas = document.createElement('canvas');
                        canvas.width = 200;
                        canvas.height = 200;
                        var ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error('Images fieldset crop preview: canvas 2D context unavailable.');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

                        canvas.toBlob(function(blob) {
                            if (!blob) throw new Error('Images fieldset crop preview: failed to generate preview blob.');

                            if (entry.previewUrl && entry.previewUrl.indexOf('blob:') === 0) {
                                try { URL.revokeObjectURL(entry.previewUrl); } catch (e) {}
                            }
                            entry.previewUrl = URL.createObjectURL(blob);
                            renderImages();
                        }, 'image/jpeg', 0.92);
                    };
                    img.onerror = function() {
                        throw new Error('Images fieldset crop preview: failed to load image for preview.');
                    };
                    img.src = url;
                }
                
                function renderImages() {
                    // Prevent layout "flash" / jump while we rebuild the grid.
                    // Re-rendering clears and re-adds nodes; locking the min-height keeps the page stable.
                    try {
                        var r = imagesContainer.getBoundingClientRect();
                        if (r && r.height && r.height > 0) {
                            imagesContainer.style.minHeight = Math.ceil(r.height) + 'px';
                        }
                    } catch (e0) {}

                    imagesContainer.innerHTML = '';
                    
                    // Show existing images
                    imageEntries.forEach(function(entry, idx) {
                        var thumb = document.createElement('div');
                        thumb.className = 'fieldset-image-thumb';
                        // Native drag is disabled until a press-and-hold (no visible drag handle here).
                        thumb.draggable = false;
                        // Stable ID so we can rebuild imageEntries order from DOM order after drag.
                        if (entry && !entry._imageEntryId) {
                            entry._imageEntryId = String(nextImageEntryId++);
                        }
                        thumb.dataset.imageEntryId = entry ? entry._imageEntryId : '';
                        
                        var img = document.createElement('img');
                        img.className = 'fieldset-image-thumb-img';
                        img.src = (entry && entry.previewUrl) ? entry.previewUrl : (entry ? entry.fileUrl : '');
                        thumb.appendChild(img);

                        // Click thumb to crop (avatar-style)
                        var didDrag = false;
                        thumb.addEventListener('click', function() {
                            // If this click is the tail-end of a drag, ignore it.
                            if (didDrag) {
                                didDrag = false;
                                return;
                            }
                            if (entry) openCropperForEntry(entry);
                        });
                        
                        var removeBtn = document.createElement('button');
                        removeBtn.type = 'button';
                        removeBtn.className = 'fieldset-image-thumb-remove';
                        removeBtn.textContent = '×';
                        (function(idx) {
                            removeBtn.addEventListener('click', function(e) {
                                // Prevent thumb click from opening cropper
                                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                                if (imageEntries[idx]) {
                                    revokeEntryUrls(imageEntries[idx]);
                                }
                                imageEntries.splice(idx, 1);
                                updateImagesMeta();
                                renderImages();
                            });
                        })(idx);
                        thumb.appendChild(removeBtn);
                        
                        // ------------------------------------------------------------------
                        // Drag-to-reorder (same drag pattern used in Formbuilder)
                        // - No drag handle: dragging begins immediately when the user grabs + moves a thumb
                        // - Click without dragging still opens the cropper
                        // ------------------------------------------------------------------
                        var dragStartIndex = -1;
                        var dragArmed = false;

                        function armDrag(e) {
                            // Don't arm dragging from the remove button.
                            if (e && e.target && (e.target === removeBtn || (e.target.closest && e.target.closest('.fieldset-image-thumb-remove')))) {
                                return;
                            }
                            dragArmed = true;
                            thumb.draggable = true;
                            thumb.classList.add('fieldset-image-thumb--dragready');
                        }

                        function disarmDrag() {
                            dragArmed = false;
                            if (!thumb.classList.contains('dragging')) {
                                thumb.draggable = false;
                                thumb.classList.remove('fieldset-image-thumb--dragready');
                            }
                        }

                        function setThumbDragImage(ev) {
                            try {
                                if (!ev || !ev.dataTransfer) return;
                                var r = thumb.getBoundingClientRect();
                                var size = Math.max(1, Math.round(Math.min(r.width || 1, r.height || 1)));

                                // Use an offscreen square ghost so the browser drag preview can't distort/squash.
                                var ghost = document.createElement('div');
                                ghost.style.width = size + 'px';
                                ghost.style.height = size + 'px';
                                ghost.style.borderRadius = '5px';
                                ghost.style.overflow = 'hidden';
                                ghost.style.background = '#222';
                                ghost.style.position = 'fixed';
                                ghost.style.left = '-99999px';
                                ghost.style.top = '-99999px';
                                ghost.style.pointerEvents = 'none';

                                var gimg = document.createElement('img');
                                gimg.src = (entry && entry.previewUrl) ? entry.previewUrl : (entry ? entry.fileUrl : '');
                                gimg.style.width = '100%';
                                gimg.style.height = '100%';
                                gimg.style.objectFit = 'cover';
                                gimg.draggable = false;
                                ghost.appendChild(gimg);

                                document.body.appendChild(ghost);
                                ev.dataTransfer.setDragImage(ghost, Math.floor(size / 2), Math.floor(size / 2));
                                setTimeout(function() {
                                    try { ghost.remove(); } catch (e) {}
                                }, 0);
                            } catch (e) {
                                // If setDragImage fails (browser quirks), allow default behavior.
                            }
                        }

                        thumb.addEventListener('mousedown', function(e) {
                            if (e && typeof e.button === 'number' && e.button !== 0) return;
                            armDrag(e);
                        });
                        thumb.addEventListener('mouseup', function() {
                            disarmDrag();
                        });
                        thumb.addEventListener('mouseleave', function() {
                            // If the user didn't start an actual drag, disarm when leaving.
                            disarmDrag();
                        });

                        thumb.addEventListener('dragstart', function(e) {
                            if (!thumb.draggable || !dragArmed) {
                                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                                return;
                            }
                            didDrag = true;
                            setThumbDragImage(e);
                            var siblings = Array.from(imagesContainer.querySelectorAll('.fieldset-image-thumb'));
                            dragStartIndex = siblings.indexOf(thumb);
                            if (e && e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                try { e.dataTransfer.setData('text/plain', thumb.dataset.imageEntryId || ''); } catch (err) {}
                            }
                            thumb.classList.add('dragging');
                        });
                        thumb.addEventListener('dragend', function() {
                            thumb.classList.remove('dragging');
                            thumb.classList.remove('fieldset-image-thumb--dragready');
                            thumb.draggable = false;
                            dragArmed = false;

                            // Rebuild imageEntries in the new DOM order (exclude the upload tile).
                            var orderedThumbs = Array.from(imagesContainer.querySelectorAll('.fieldset-image-thumb'));
                            var idToEntry = {};
                            imageEntries.forEach(function(en) {
                                if (en && en._imageEntryId) idToEntry[String(en._imageEntryId)] = en;
                            });
                            var nextEntries = [];
                            orderedThumbs.forEach(function(el) {
                                var id = el && el.dataset ? el.dataset.imageEntryId : '';
                                if (id && idToEntry[id]) nextEntries.push(idToEntry[id]);
                            });
                            // Only apply if we still have the same number of entries
                            if (nextEntries.length === imageEntries.length) {
                                imageEntries = nextEntries;
                                updateImagesMeta();
                            }

                            // Only notify meta/UI if position actually changed
                            var siblingsNow = Array.from(imagesContainer.querySelectorAll('.fieldset-image-thumb'));
                            var currentIndex = siblingsNow.indexOf(thumb);
                            if (dragStartIndex !== -1 && currentIndex !== -1 && currentIndex !== dragStartIndex) {
                                // Re-render to ensure remove buttons map to correct indices
                                renderImages();
                            }
                            dragStartIndex = -1;
                        });
                        // Dragover on each thumb is handled at container level for grid-friendly ordering
                        
                        imagesContainer.appendChild(thumb);
                    });
                    
                    // Show upload button if under max
                    if (imageEntries.length < maxImages) {
                        var uploadBox = document.createElement('div');
                        uploadBox.className = 'fieldset-images';
                        uploadBox.innerHTML = ImageAddTileComponent.buildMarkup({
                            iconClass: 'fieldset-images-icon',
                            textClass: 'fieldset-images-text',
                            label: 'Add'
                        });
                        uploadBox.addEventListener('click', function() {
                            fileInput.click();
                        });
                        imagesContainer.appendChild(uploadBox);
                    }

                    // Release the height lock on the next frame once DOM is populated.
                    try {
                        requestAnimationFrame(function() {
                            imagesContainer.style.minHeight = '';
                        });
                    } catch (e1) {
                        try { imagesContainer.style.minHeight = ''; } catch (e2) {}
                    }
                }

                // Grid-friendly dragover handler (insertBefore/after like Formbuilder)
                imagesContainer.addEventListener('dragover', function(e) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    var dragging = imagesContainer.querySelector('.fieldset-image-thumb.dragging');
                    if (!dragging) return;

                    var px = (e && typeof e.clientX === 'number') ? e.clientX : 0;
                    var py = (e && typeof e.clientY === 'number') ? e.clientY : 0;

                    // Prefer the element under the cursor for intuitive drops.
                    var target = null;
                    if (document && typeof document.elementFromPoint === 'function') {
                        target = document.elementFromPoint(px, py);
                    }
                    var overThumb = target && target.closest ? target.closest('.fieldset-image-thumb') : null;
                    if (overThumb && overThumb === dragging) overThumb = null;

                    var thumbs = Array.from(imagesContainer.querySelectorAll('.fieldset-image-thumb'));
                    if (!thumbs.length) return;

                    // If not directly over a thumb, allow easier "drop to first" / "drop to last" behavior.
                    if (!overThumb) {
                        var containerRect = imagesContainer.getBoundingClientRect();
                        var first = thumbs[0];
                        var last = thumbs[thumbs.length - 1];
                        if (first) {
                            var fr = first.getBoundingClientRect();
                            // If cursor is above/left of the first thumb (with some leniency), insert before first.
                            if (py < (fr.top + fr.height * 0.5) && px < (fr.left + fr.width * 0.5)) {
                                imagesContainer.insertBefore(dragging, first);
                                return;
                            }
                        }
                        if (last) {
                            var lr = last.getBoundingClientRect();
                            // If cursor is below/right of the last thumb (with some leniency), insert after last.
                            if (py > (lr.top + lr.height * 0.5) && px > (lr.left + lr.width * 0.5)) {
                                imagesContainer.insertBefore(dragging, last.nextSibling);
                                return;
                            }
                        }
                        // Otherwise do nothing (avoids jumpiness when dragging between grid gaps).
                        return;
                    }

                    var rect = overThumb.getBoundingClientRect();
                    var midX = rect.left + rect.width / 2;
                    // Flip before/after at 50% of the thumb width (no need to drag "90% across").
                    var after = (px >= midX);
                    if (after) {
                        imagesContainer.insertBefore(dragging, overThumb.nextSibling);
                    } else {
                        imagesContainer.insertBefore(dragging, overThumb);
                    }
                });
                
                var fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.multiple = true;
                fileInput.style.display = 'none';
                // Keep a stable reference to the selected files, because we clear fileInput.value after reading.
                // This allows the create-post submit pipeline to read the actual File objects without drafts.
                fileInput._imageFiles = [];
                fileInput.addEventListener('change', function() {
                    var files = Array.from(this.files);
                    files.forEach(function(file) {
                        if (imageEntries.length < maxImages && file.type.startsWith('image/')) {
                            var fileUrl = URL.createObjectURL(file);
                            imageEntries.push({
                                _imageEntryId: String(nextImageEntryId++),
                                file: file,
                                fileUrl: fileUrl,
                                previewUrl: '',
                                cropState: null,
                                cropRect: null
                            });
                        }
                    });
                    try { fileInput._imageFiles = imageEntries.map(function(e){ return e && e.file ? e.file : null; }).filter(Boolean); } catch (e0) {}
                    updateImagesMeta();
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
                
                // Get amenities from amenities table (via picklist response structure)
                var allAmenities = dropdownOptions['amenity'];
                if (!allAmenities) {
                    allAmenities = [];
                }
                
                // Filter to only show selected amenities (if specified in fieldData)
                var selectedAmenities = fieldData.selectedAmenities;
                if (selectedAmenities && !Array.isArray(selectedAmenities)) {
                    // Handle case where it might be a string or other type
                    selectedAmenities = null;
                }
                var amenities = [];
                if (selectedAmenities && Array.isArray(selectedAmenities) && selectedAmenities.length > 0) {
                    // Normalize selectedAmenities for comparison (trim and lowercase)
                    var normalizedSelected = selectedAmenities.map(function(val) {
                        if (!val) return '';
                        return val.toString().trim().toLowerCase();
                    });
                    // Only show amenities that are in the selected list
                    amenities = allAmenities.filter(function(item) {
                        if (!item || !item.value) return false;
                        var itemValue = item.value.toString().trim().toLowerCase();
                        return normalizedSelected.indexOf(itemValue) !== -1;
                    });
                } else {
                    // If no selection, show all amenities (backward compatibility)
                    amenities = allAmenities;
                }
                
                amenities.forEach(function(item, i) {
                    // Use database values directly
                    var amenityName = item.value; // Display name (e.g., "Parking", "Wheelchair Access")
                    var description = item.label || ''; // Full description for tooltip
                    var filename = item.filename || ''; // Icon filename (e.g., "parking.svg")
                    
                    var row = document.createElement('div');
                    row.className = 'fieldset-amenity-row';
                    row.title = description; // Tooltip on hover
                    
                    // Icon
                    var iconEl = document.createElement('div');
                    iconEl.className = 'fieldset-amenity-icon';
                    var amenityUrl = '';
                    if (filename) {
                        // Remove .svg extension if present (getImageUrl may add it, or filename may already include it)
                        var cleanFilename = filename.replace(/\.svg$/i, '');
                        amenityUrl = window.App.getImageUrl('amenities', cleanFilename + '.svg');
                    }
                    var iconImg = document.createElement('img');
                    iconImg.className = 'fieldset-amenity-icon-image';
                    iconImg.src = amenityUrl;
                    iconImg.alt = amenityName;
                    iconEl.appendChild(iconImg);
                    row.appendChild(iconEl);
                    
                    // Name
                    var nameEl = document.createElement('div');
                    nameEl.className = 'fieldset-amenity-name';
                    nameEl.textContent = amenityName;
                    row.appendChild(nameEl);
                    
                    // Yes/No options
                    var optionsEl = document.createElement('div');
                    optionsEl.className = 'fieldset-amenity-options';
                    
                    // Use value as unique identifier for radio button names
                    var radioName = 'amenity-' + (item.value || i).replace(/[^a-z0-9]/gi, '-').toLowerCase();
                    
                    var yesLabel = document.createElement('label');
                    yesLabel.className = 'fieldset-amenity-option';
                    var yesRadio = document.createElement('input');
                    yesRadio.type = 'radio';
                    yesRadio.name = radioName;
                    yesRadio.value = '1';
                    yesRadio.className = 'fieldset-amenity-option-input';
                    var yesText = document.createElement('span');
                    yesText.className = 'fieldset-amenity-option-text';
                    yesText.textContent = 'Yes';
                    yesLabel.appendChild(yesRadio);
                    yesLabel.appendChild(yesText);
                    optionsEl.appendChild(yesLabel);
                    
                    var noLabel = document.createElement('label');
                    noLabel.className = 'fieldset-amenity-option';
                    var noRadio = document.createElement('input');
                    noRadio.type = 'radio';
                    noRadio.name = radioName;
                    noRadio.value = '0';
                    noRadio.className = 'fieldset-amenity-option-input';
                    var noText = document.createElement('span');
                    noText.className = 'fieldset-amenity-option-text';
                    noText.textContent = 'No';
                    noLabel.appendChild(noRadio);
                    noLabel.appendChild(noText);
                    optionsEl.appendChild(noLabel);
                    
                    // Add change listeners to update row styling
                    function setAmenityState(isYes) {
                        nameEl.classList.toggle('fieldset-amenity-name--selected-no', !isYes);
                        iconImg.classList.toggle('fieldset-amenity-icon-image--selected-yes', !!isYes);
                        iconImg.classList.toggle('fieldset-amenity-icon-image--selected-no', !isYes);
                    }
                    
                    yesRadio.addEventListener('change', function() {
                        setAmenityState(true);
                    });
                    
                    noRadio.addEventListener('change', function() {
                        setAmenityState(false);
                    });
                    
                    row.appendChild(optionsEl);
                    amenitiesGrid.appendChild(row);
                });
                
                fieldset.appendChild(amenitiesGrid);
                break;
                
            case 'item-pricing':
                // Item Name (full width), then variants with currency + price
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));

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
                        console.error('[FieldsetBuilder] CurrencyComponent not available');
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
                        var blockMenu = block.querySelector('.component-currencycompact-menu');
                        var idx = itemCurrencyMenus.indexOf(blockMenu);
                        if (idx > -1) itemCurrencyMenus.splice(idx, 1);
                        updateItemVariantButtons();
                    });
                    variantRow.appendChild(removeBtn);
                    applyFieldsetRowItemClasses(variantRow);
                    
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
                    priceInput.className = 'fieldset-input';
                    priceInput.placeholder = '0.00';
                    attachMoneyInputBehavior(priceInput);
                    priceCol.appendChild(priceSub);
                    priceCol.appendChild(priceInput);
                    priceRow.appendChild(priceCol);
                    applyFieldsetRowItemClasses(priceRow);
                    
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
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                
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
                        console.error('[FieldsetBuilder] CurrencyComponent not available');
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
                        var blockMenu = block.querySelector('.component-currencycompact-menu');
                        var idx = ticketCurrencyMenus.indexOf(blockMenu);
                        if (idx > -1) ticketCurrencyMenus.splice(idx, 1);
                        updateTierButtons(tiersContainer);
                    });
                    tierRow.appendChild(removeBtn);
                    applyFieldsetRowItemClasses(tierRow);
                    
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
                    priceInput.className = 'fieldset-input';
                    priceInput.placeholder = '0.00';
                    attachMoneyInputBehavior(priceInput);
                    priceCol.appendChild(priceSub);
                    priceCol.appendChild(priceInput);
                    priceRow.appendChild(priceCol);
                    applyFieldsetRowItemClasses(priceRow);
                    
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
                    applyFieldsetRowItemClasses(seatRow);
                    
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
                
                // Create first seating area
                seatingAreasContainer.appendChild(createSeatingAreaBlock());
                updateSeatingAreaButtons();
                break;
                
            case 'sessions':
                // Horizontal scrolling calendar + auto-generated session rows with autofill
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                
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
                                        // Notify fieldset completion logic after blur cleanup.
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
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
                                        // Notify fieldset completion logic after normalization.
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                    } else {
                                        // Invalid time - reset input
                                        this.value = '';
                                        sessionData[dateStr].times[idx] = '';
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
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

                    // Recompute required/completion state after the DOM has changed (new time inputs, removals, etc.)
                    // This keeps the asterisk honest without requiring the user to click into a newly added input.
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
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
                        // Notify listeners (member checkout pricing needs final session date per location)
                        try {
                            fieldset.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true }));
                        } catch (e) {}
                    }
                });
                
                break;

            case 'session_pricing':
                // Sessions + ticket-group popover (lettered groups, embedded pricing editor).
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));

                // Track selected dates:
                // { 'YYYY-MM-DD': { times: ['19:00', ...], edited: [true,false...], groups: ['A','A',...] } }
                var spSessionData = {};

                // Ticket-group popover state
                var spTicketGroups = {}; // { A: groupEl, B: groupEl, ... } (groupEl has .fieldset-sessionpricing-pricing-group)
                var spTicketGroupList = null; // container element for group list inside popover
                var spTicketMenuOpen = false;
                var spTicketMenuDocHandler = null;
                var spActivePicker = null; // { dateStr, idx, timeInput, ticketBtn, rowEl }

                var spOpenGroupKey = null;
                var spOpenGroupSnapshot = null;

                function spGetSystemTicketIconUrl() {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys.icon_ticket ? String(sys.icon_ticket || '').trim() : '';
                        if (!filename) return '';
                        return App.getImageUrl('systemImages', filename);
                    } catch (e) {
                        return '';
                    }
                }

                function spFirstUnusedLetter() {
                    for (var i = 0; i < 26; i++) {
                        var key = String.fromCharCode(65 + i);
                        if (!spTicketGroups[key]) return key;
                    }
                    // Extremely rare: beyond Z
                    return 'G' + (Object.keys(spTicketGroups).length + 1);
                }

                function spEnsureDefaultGroup() {
                    if (!spTicketGroups['A']) spEnsureTicketGroup('A');
                }

                // Shared currency state across all pricing editors in this fieldset
                var spInitialCurrencyCode = defaultCurrency || null;
                var spInitialCurrency = null;
                if (spInitialCurrencyCode && CurrencyComponent.isLoaded()) {
                    var spFound = CurrencyComponent.getData().find(function(item) { return item.value === spInitialCurrencyCode; });
                    if (spFound) {
                        var spCountryCode = spFound.filename ? spFound.filename.replace('.svg', '') : null;
                        spInitialCurrency = { flag: spCountryCode, code: spInitialCurrencyCode };
                    }
                }
                var spTicketCurrencyState = spInitialCurrency || { flag: null, code: null };
                var spTicketCurrencyMenus = [];

                function spSyncAllTicketCurrencies() {
                    spTicketCurrencyMenus.forEach(function(menu) {
                        var img = menu.querySelector('.fieldset-menu-button-image');
                        var input = menu.querySelector('.fieldset-menu-button-input');
                        if (spTicketCurrencyState.flag) {
                            img.src = window.App.getImageUrl('currencies', spTicketCurrencyState.flag + '.svg');
                        }
                        input.value = spTicketCurrencyState.code || '';
                    });
                }
                function spBuildTicketCurrencyMenu() {
                    if (typeof CurrencyComponent === 'undefined') {
                        console.error('[FieldsetBuilder] CurrencyComponent not available');
                        return document.createElement('div');
                    }
                    var result = CurrencyComponent.buildCompactMenu({
                        initialValue: spTicketCurrencyState.code,
                        onSelect: function(value, label, countryCode) {
                            spTicketCurrencyState.flag = countryCode;
                            spTicketCurrencyState.code = value;
                            spSyncAllTicketCurrencies();
                        }
                    });
                    spTicketCurrencyMenus.push(result.element);
                    return result.element;
                }
                function spAttachMoneyInputBehavior(inputEl) {
                    if (!inputEl) return;
                    inputEl.addEventListener('input', function() {
                        var raw = String(this.value || '').replace(/[^0-9.]/g, '');
                        var parts = raw.split('.');
                        if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
                        this.value = raw;
                    });
                    inputEl.addEventListener('blur', function() {
                        var v = String(this.value || '').trim();
                        if (v === '') return;
                        var num = parseFloat(v);
                        if (isNaN(num)) { this.value = ''; return; }
                        this.value = num.toFixed(2);
                    });
                }

                // --- Pricing editor builders (same visual as ticket-pricing) ---
                function spCreatePricingTierBlock(tiersContainer) {
                    var block = document.createElement('div');
                    block.className = 'fieldset-sessionpricing-pricing-tier-block';
                    block.style.marginBottom = '10px';
                    block.style.marginLeft = '20px';

                    var tierRow = document.createElement('div');
                    tierRow.className = 'fieldset-row';
                    tierRow.style.marginBottom = '10px';

                    var tierCol = document.createElement('div');
                    tierCol.style.flex = '1';
                    var tierSub = document.createElement('div');
                    tierSub.className = 'fieldset-sublabel';
                    tierSub.textContent = 'Pricing Tier';
                    var tierInput = document.createElement('input');
                    tierInput.className = 'fieldset-input';
                    tierInput.placeholder = 'eg. Adult';
                    tierCol.appendChild(tierSub);
                    tierCol.appendChild(tierInput);
                    tierRow.appendChild(tierCol);

                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-sessionpricing-pricing-add';
                    addBtn.textContent = '+';
                    addBtn.addEventListener('click', function() {
                        tiersContainer.appendChild(spCreatePricingTierBlock(tiersContainer));
                        spUpdateTierButtons(tiersContainer);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    tierRow.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-sessionpricing-pricing-remove';
                    removeBtn.textContent = '−';
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        spUpdateTierButtons(tiersContainer);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    tierRow.appendChild(removeBtn);

                    applyFieldsetRowItemClasses(tierRow);
                    block.appendChild(tierRow);

                    var priceRow = document.createElement('div');
                    priceRow.className = 'fieldset-row';
                    priceRow.style.marginRight = '92px';

                    var currencyCol = document.createElement('div');
                    currencyCol.style.flex = '0 0 100px';
                    var currencySub = document.createElement('div');
                    currencySub.className = 'fieldset-sublabel';
                    currencySub.textContent = 'Currency';
                    currencyCol.appendChild(currencySub);
                    currencyCol.appendChild(spBuildTicketCurrencyMenu());
                    priceRow.appendChild(currencyCol);

                    var priceCol = document.createElement('div');
                    priceCol.style.flex = '1';
                    var priceSub = document.createElement('div');
                    priceSub.className = 'fieldset-sublabel';
                    priceSub.textContent = 'Price';
                    var priceInput = document.createElement('input');
                    priceInput.className = 'fieldset-input';
                    priceInput.placeholder = '0.00';
                    spAttachMoneyInputBehavior(priceInput);
                    priceCol.appendChild(priceSub);
                    priceCol.appendChild(priceInput);
                    priceRow.appendChild(priceCol);

                    applyFieldsetRowItemClasses(priceRow);
                    block.appendChild(priceRow);
                    return block;
                }
                function spUpdateTierButtons(tiersContainer) {
                    var blocks = tiersContainer.querySelectorAll('.fieldset-sessionpricing-pricing-tier-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block) {
                        var addBtn = block.querySelector('.fieldset-sessionpricing-pricing-add');
                        var removeBtn = block.querySelector('.fieldset-sessionpricing-pricing-remove');
                        if (atMax) { addBtn.style.opacity = '0.3'; addBtn.style.cursor = 'not-allowed'; addBtn.disabled = true; }
                        else { addBtn.style.opacity = '1'; addBtn.style.cursor = 'pointer'; addBtn.disabled = false; }
                        if (blocks.length === 1) { removeBtn.style.opacity = '0.3'; removeBtn.style.cursor = 'not-allowed'; removeBtn.disabled = true; }
                        else { removeBtn.style.opacity = '1'; removeBtn.style.cursor = 'pointer'; removeBtn.disabled = false; }
                    });
                }
                function spCreateSeatingAreaBlock(seatingAreasContainer) {
                    var block = document.createElement('div');
                    block.className = 'fieldset-sessionpricing-pricing-seating-block';
                    block.style.marginBottom = '20px';
                    block.style.paddingBottom = '10px';
                    block.style.borderBottom = '1px solid #333';

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

                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-sessionpricing-pricing-add';
                    addBtn.textContent = '+';
                    addBtn.addEventListener('click', function() {
                        seatingAreasContainer.appendChild(spCreateSeatingAreaBlock(seatingAreasContainer));
                        spUpdateSeatingAreaButtons(seatingAreasContainer);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    seatRow.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-sessionpricing-pricing-remove';
                    removeBtn.textContent = '−';
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        spUpdateSeatingAreaButtons(seatingAreasContainer);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    seatRow.appendChild(removeBtn);

                    applyFieldsetRowItemClasses(seatRow);
                    block.appendChild(seatRow);

                    var tiersContainer = document.createElement('div');
                    tiersContainer.className = 'fieldset-sessionpricing-pricing-tiers-container';
                    tiersContainer.appendChild(spCreatePricingTierBlock(tiersContainer));
                    spUpdateTierButtons(tiersContainer);
                    block.appendChild(tiersContainer);
                    return block;
                }
                function spUpdateSeatingAreaButtons(seatingAreasContainer) {
                    var blocks = seatingAreasContainer.querySelectorAll('.fieldset-sessionpricing-pricing-seating-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block) {
                        var addBtn = block.querySelector('.fieldset-sessionpricing-pricing-add');
                        var removeBtn = block.querySelector('.fieldset-sessionpricing-pricing-remove');
                        if (atMax) { addBtn.style.opacity = '0.3'; addBtn.style.cursor = 'not-allowed'; addBtn.disabled = true; }
                        else { addBtn.style.opacity = '1'; addBtn.style.cursor = 'pointer'; addBtn.disabled = false; }
                        if (blocks.length === 1) { removeBtn.style.opacity = '0.3'; removeBtn.style.cursor = 'not-allowed'; removeBtn.disabled = true; }
                        else { removeBtn.style.opacity = '1'; removeBtn.style.cursor = 'pointer'; removeBtn.disabled = false; }
                    });
                }

                // Calendar + sessions list
                var spToday = new Date();
                spToday.setHours(0, 0, 0, 0);
                var spTodayIso = spToday.getFullYear() + '-' + String(spToday.getMonth() + 1).padStart(2, '0') + '-' + String(spToday.getDate()).padStart(2, '0');
                var spMinDate = new Date(spToday.getFullYear(), spToday.getMonth(), 1);
                var spMaxDate = new Date(spToday.getFullYear(), spToday.getMonth() + 24, 1);
                var spTodayMonthEl = null;
                var spTodayMonthIndex = 0;
                var spTotalMonths = 0;
                var spWeekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                function spToISODate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
                function spGetDayOfWeek(dateStr) { return new Date(dateStr + 'T00:00:00').getDay(); }

                var spCalContainer = document.createElement('div');
                spCalContainer.className = 'fieldset-sessionpricing-calendar-container';
                var spCalScroll = document.createElement('div');
                spCalScroll.className = 'fieldset-sessionpricing-calendar-scroll';
                var spCalendar = document.createElement('div');
                spCalendar.className = 'fieldset-sessionpricing-calendar';

                var spCurrent = new Date(spMinDate.getFullYear(), spMinDate.getMonth(), 1);
                var spMonthIdx = 0;
                while (spCurrent <= spMaxDate) {
                    var spMonthEl = document.createElement('div');
                    spMonthEl.className = 'fieldset-sessionpricing-calendar-month';
                    var spHeader = document.createElement('div');
                    spHeader.className = 'fieldset-sessionpricing-calendar-header';
                    spHeader.textContent = spCurrent.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                    spMonthEl.appendChild(spHeader);
                    var spGrid = document.createElement('div');
                    spGrid.className = 'fieldset-sessionpricing-calendar-grid';
                    spWeekdayNames.forEach(function(wd) {
                        var w = document.createElement('div');
                        w.className = 'fieldset-sessionpricing-calendar-weekday';
                        w.textContent = wd;
                        spGrid.appendChild(w);
                    });
                    var spFirstDay = new Date(spCurrent.getFullYear(), spCurrent.getMonth(), 1);
                    var spStartDow = spFirstDay.getDay();
                    var spDaysInMonth = new Date(spCurrent.getFullYear(), spCurrent.getMonth() + 1, 0).getDate();
                    for (var spi = 0; spi < 42; spi++) {
                        var spCell = document.createElement('div');
                        spCell.className = 'fieldset-sessionpricing-calendar-day';
                        var spDayNum = spi - spStartDow + 1;
                        if (spi < spStartDow || spDayNum > spDaysInMonth) {
                            spCell.classList.add('fieldset-sessionpricing-calendar-day--empty');
                        } else {
                            spCell.textContent = spDayNum;
                            var spDateObj = new Date(spCurrent.getFullYear(), spCurrent.getMonth(), spDayNum);
                            spDateObj.setHours(0, 0, 0, 0);
                            var spIso = spToISODate(spDateObj);
                            spCell.dataset.iso = spIso;
                            if (spDateObj < spToday) spCell.classList.add('fieldset-sessionpricing-calendar-day--past');
                            else spCell.classList.add('fieldset-sessionpricing-calendar-day--future');
                            if (spIso === spTodayIso) {
                                spCell.classList.add('fieldset-sessionpricing-calendar-day--today');
                                spTodayMonthEl = spMonthEl;
                                spTodayMonthIndex = spMonthIdx;
                            }
                        }
                        spGrid.appendChild(spCell);
                    }
                    spMonthEl.appendChild(spGrid);
                    spCalendar.appendChild(spMonthEl);
                    spCurrent.setMonth(spCurrent.getMonth() + 1);
                    spMonthIdx++;
                }
                spTotalMonths = spMonthIdx;
                spCalScroll.appendChild(spCalendar);
                spCalContainer.appendChild(spCalScroll);
                var spMarker = document.createElement('div');
                spMarker.className = 'fieldset-sessionpricing-calendar-today-marker';
                spCalContainer.appendChild(spMarker);
                fieldset.appendChild(spCalContainer);

                var spSessionsContainer = document.createElement('div');
                spSessionsContainer.className = 'fieldset-sessionpricing-sessions-container';
                fieldset.appendChild(spSessionsContainer);

                var spPricingGroupsWrap = document.createElement('div');
                spPricingGroupsWrap.className = 'fieldset-sessionpricing-pricing-groups';
                spPricingGroupsWrap.classList.add('fieldset-sessionpricing-ticketgroup-popover');

                // Top action: Create New Ticket Group
                var spTicketGroupCreate = document.createElement('button');
                spTicketGroupCreate.type = 'button';
                spTicketGroupCreate.className = 'fieldset-sessionpricing-ticketgroup-create';
                spTicketGroupCreate.textContent = 'Create New Ticket Group';
                spTicketGroupCreate.addEventListener('click', function() {
                    var k = spFirstUnusedLetter();
                    spEnsureTicketGroup(k);
                    if (spActivePicker) {
                        spAssignGroupToActive(k);
                    }
                    // Open the editor for the new group
                    spCloseAllGroupEditors();
                    spOpenGroupKey = k;
                    spOpenGroupSnapshot = [];
                    spSetGroupEditorOpen(k, true);
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                });
                spPricingGroupsWrap.appendChild(spTicketGroupCreate);

                spTicketGroupList = document.createElement('div');
                spTicketGroupList.className = 'fieldset-sessionpricing-ticketgroup-list';
                spPricingGroupsWrap.appendChild(spTicketGroupList);

                fieldset.appendChild(spPricingGroupsWrap);

                setTimeout(function() {
                    if (spTodayMonthEl) spCalScroll.scrollLeft = spTodayMonthEl.offsetLeft;
                    var markerFraction = (spTodayMonthIndex + 0.5) / spTotalMonths;
                    var markerPos = markerFraction * (spCalContainer.clientWidth - 8);
                    spMarker.style.left = markerPos + 'px';
                }, 0);
                spMarker.addEventListener('click', function() {
                    if (spTodayMonthEl) spCalScroll.scrollTo({ left: spTodayMonthEl.offsetLeft, behavior: 'smooth' });
                });
                spCalScroll.addEventListener('wheel', function(e) {
                    e.preventDefault();
                    spCalScroll.scrollLeft += (e.deltaY || e.deltaX) * 0.3;
                });

                var spGodSetForSlot = {};
                function spAutofillTimes(changedDateStr, changedSlotIdx, newTime) {
                    var sortedDates = Object.keys(spSessionData).sort();
                    var changedDow = spGetDayOfWeek(changedDateStr);
                    if (!spGodSetForSlot[changedSlotIdx]) {
                        spGodSetForSlot[changedSlotIdx] = true;
                        for (var i = 0; i < sortedDates.length; i++) {
                            var dateStr = sortedDates[i];
                            if (dateStr === changedDateStr) continue;
                            var data = spSessionData[dateStr];
                            if (data.times.length > changedSlotIdx && !data.edited[changedSlotIdx]) data.times[changedSlotIdx] = newTime;
                        }
                    } else {
                        for (var i = 0; i < sortedDates.length; i++) {
                            var dateStr = sortedDates[i];
                            if (dateStr === changedDateStr) continue;
                            if (spGetDayOfWeek(dateStr) !== changedDow) continue;
                            var data = spSessionData[dateStr];
                            if (data.times.length > changedSlotIdx && !data.edited[changedSlotIdx]) data.times[changedSlotIdx] = newTime;
                        }
                    }
                }
                function spGetAutofillForSlot(dateStr, slotIdx) {
                    var dow = spGetDayOfWeek(dateStr);
                    var sortedDates = Object.keys(spSessionData).sort();
                    for (var i = 0; i < sortedDates.length; i++) {
                        var d = sortedDates[i];
                        if (d === dateStr) continue;
                        if (spGetDayOfWeek(d) === dow && spSessionData[d].times.length > slotIdx && spSessionData[d].times[slotIdx]) return spSessionData[d].times[slotIdx];
                    }
                    for (var i = 0; i < sortedDates.length; i++) {
                        var d = sortedDates[i];
                        if (d === dateStr) continue;
                        if (spSessionData[d].times.length > slotIdx && spSessionData[d].times[slotIdx]) return spSessionData[d].times[slotIdx];
                    }
                    return '';
                }

                function spExtractPricingFromEditor(editorEl) {
                    if (!editorEl) return [];
                    try {
                        var seatingBlocks = editorEl.querySelectorAll('.fieldset-sessionpricing-pricing-seating-block');
                        var seatOut = [];
                        seatingBlocks.forEach(function(block) {
                            var seatName = '';
                            var seatInput = block.querySelector('.fieldset-row input.fieldset-input');
                            if (seatInput) seatName = String(seatInput.value || '').trim();
                            var tiers = [];
                            block.querySelectorAll('.fieldset-sessionpricing-pricing-tier-block').forEach(function(tier) {
                                var tierName = '';
                                var tierInput = tier.querySelector('.fieldset-row input.fieldset-input');
                                if (tierInput) tierName = String(tierInput.value || '').trim();
                                var currencyInput = tier.querySelector('input.component-currencycompact-menu-button-input');
                                var curr = currencyInput ? String(currencyInput.value || '').trim() : '';
                                var priceInput = null;
                                var inputs = tier.querySelectorAll('input.fieldset-input');
                                if (inputs && inputs.length) priceInput = inputs[inputs.length - 1];
                                var price = priceInput ? String(priceInput.value || '').trim() : '';
                                tiers.push({ pricing_tier: tierName, currency: curr, price: price });
                            });
                            seatOut.push({ seating_area: seatName, tiers: tiers });
                        });
                        return seatOut;
                    } catch (e) {
                        return [];
                    }
                }

                function spReplaceEditorFromPricing(editorEl, pricingArr) {
                    if (!editorEl) return;
                    editorEl.innerHTML = '';
                    var seatingAreasContainer = document.createElement('div');
                    seatingAreasContainer.className = 'fieldset-sessionpricing-pricing-seatingareas-container';
                    editorEl.appendChild(seatingAreasContainer);
                    var seats = Array.isArray(pricingArr) ? pricingArr : [];
                    if (seats.length === 0) seats = [{}];
                    seats.forEach(function(seat) {
                        var block = spCreateSeatingAreaBlock(seatingAreasContainer);
                        seatingAreasContainer.appendChild(block);
                        var seatInput = block.querySelector('.fieldset-row input.fieldset-input');
                        if (seatInput) seatInput.value = String((seat && seat.seating_area) || '');
                        var tiersContainer = block.querySelector('.fieldset-sessionpricing-pricing-tiers-container');
                        if (tiersContainer) tiersContainer.innerHTML = '';
                        var tiers = (seat && Array.isArray(seat.tiers)) ? seat.tiers : [];
                        if (tiers.length === 0) tiers = [{}];
                        tiers.forEach(function(tierObj) {
                            var tierBlock = spCreatePricingTierBlock(tiersContainer);
                            tiersContainer.appendChild(tierBlock);
                            var tierNameInput = tierBlock.querySelector('.fieldset-row input.fieldset-input');
                            if (tierNameInput) tierNameInput.value = String((tierObj && tierObj.pricing_tier) || '');
                            var currInput = tierBlock.querySelector('input.component-currencycompact-menu-button-input');
                            if (currInput) currInput.value = String((tierObj && tierObj.currency) || '');
                            var inputs = tierBlock.querySelectorAll('input.fieldset-input');
                            var priceInput = inputs && inputs.length ? inputs[inputs.length - 1] : null;
                            if (priceInput) priceInput.value = String((tierObj && tierObj.price) || '');
                        });
                        spUpdateTierButtons(tiersContainer);
                    });
                    spUpdateSeatingAreaButtons(seatingAreasContainer);
                }

                function spSetGroupEditorOpen(groupKey, isOpen) {
                    var g = spTicketGroups[String(groupKey || '')];
                    if (!g) return;
                    var wrap = g.querySelector('.fieldset-sessionpricing-ticketgroup-editorwrap');
                    if (!wrap) return;
                    wrap.style.display = isOpen ? '' : 'none';
                    g.classList.toggle('fieldset-sessionpricing-pricing-group--open', !!isOpen);
                }

                function spCloseAllGroupEditors() {
                    Object.keys(spTicketGroups).forEach(function(k) {
                        spSetGroupEditorOpen(k, false);
                    });
                    spOpenGroupKey = null;
                    spOpenGroupSnapshot = null;
                }

                function spAssignGroupToActive(groupKey) {
                    if (!spActivePicker || !spActivePicker.timeInput || !spActivePicker.ticketBtn) return;
                    var dateStr = spActivePicker.dateStr;
                    var idx = spActivePicker.idx;
                    var data = spSessionData[dateStr];
                    if (!data) return;
                    if (!Array.isArray(data.groups)) data.groups = [];
                    data.groups[idx] = groupKey;
                    spActivePicker.timeInput.dataset.ticketGroupKey = groupKey;
                    var letterEl = spActivePicker.ticketBtn.querySelector('.fieldset-sessionpricing-ticketgroup-letter');
                    if (letterEl) letterEl.textContent = groupKey;

                    // Highlight the selected group in the picker menu (so selection is obvious)
                    try {
                        Object.keys(spTicketGroups).forEach(function(k) {
                            var g = spTicketGroups[k];
                            if (!g) return;
                            var header = g.querySelector('.fieldset-sessionpricing-ticketgroup-header');
                            if (!header) return;
                            header.classList.toggle('fieldset-sessionpricing-ticketgroup-header--selected', String(k) === String(groupKey));
                        });
                    } catch (eSel) {}
                }

                function spUpdateAllTicketButtonsFromData() {
                    try {
                        var inputs = spSessionsContainer.querySelectorAll('.fieldset-sessionpricing-sessions-time-input');
                        inputs.forEach(function(input) {
                            var d = String(input.dataset.date || '');
                            var i = parseInt(String(input.dataset.idx || '0'), 10);
                            if (!d || !spSessionData[d] || !Array.isArray(spSessionData[d].groups)) return;
                            var g = String(spSessionData[d].groups[i] || 'A');
                            input.dataset.ticketGroupKey = g;
                            var row = input.closest('.fieldset-sessionpricing-sessions-row');
                            if (!row) return;
                            var btn = row.querySelector('.fieldset-sessionpricing-ticketgroup-button');
                            if (!btn) return;
                            var letterEl = btn.querySelector('.fieldset-sessionpricing-ticketgroup-letter');
                            if (letterEl) letterEl.textContent = g;
                        });
                    } catch (eUp) {}
                }

                function spCloseTicketMenu() {
                    if (!spTicketMenuOpen) return;
                    spTicketMenuOpen = false;
                    spPricingGroupsWrap.classList.remove('fieldset-sessionpricing-ticketgroup-popover--open');
                    spActivePicker = null;
                    spCloseAllGroupEditors();
                    if (spTicketMenuDocHandler) {
                        try { document.removeEventListener('click', spTicketMenuDocHandler, true); } catch (e) {}
                        spTicketMenuDocHandler = null;
                    }
                }

                function spOpenTicketMenu(anchorRowEl, pickerObj) {
                    if (!anchorRowEl || !pickerObj) return;
                    spEnsureDefaultGroup();
                    spActivePicker = pickerObj;

                    // Ensure active row has a group assigned
                    var currentKey = '';
                    try { currentKey = String(pickerObj.timeInput.dataset.ticketGroupKey || '').trim(); } catch (e0) { currentKey = ''; }
                    if (!currentKey) currentKey = 'A';
                    spAssignGroupToActive(currentKey);

                    // Pop-up positioning (absolute overlay inside this fieldset)
                    try {
                        if (fieldset && fieldset.style) fieldset.style.position = 'relative';
                    } catch (ePos) {}
                    try {
                        if (spPricingGroupsWrap.parentNode !== fieldset) {
                            fieldset.appendChild(spPricingGroupsWrap);
                        }
                    } catch (eApp) {}
                    try {
                        var fsRect = fieldset.getBoundingClientRect();
                        var rowRect = anchorRowEl.getBoundingClientRect();
                        var top = (rowRect.bottom - fsRect.top) + 8;
                        if (top < 0) top = 0;
                        spPricingGroupsWrap.style.top = top + 'px';
                    } catch (eTop) {}

                    spPricingGroupsWrap.classList.add('fieldset-sessionpricing-ticketgroup-popover--open');
                    spTicketMenuOpen = true;

                    // Close when clicking outside (Formbuilder-style)
                    spTicketMenuDocHandler = function(ev) {
                        try {
                            if (!spPricingGroupsWrap.contains(ev.target) && !(pickerObj.ticketBtn && pickerObj.ticketBtn.contains(ev.target))) {
                                spCloseTicketMenu();
                            }
                        } catch (e) {}
                    };
                    try { document.addEventListener('click', spTicketMenuDocHandler, true); } catch (e1) {}
                }

                function spEnsureTicketGroup(groupKey) {
                    var key = String(groupKey || '').trim();
                    if (!key) return null;
                    if (spTicketGroups[key]) return spTicketGroups[key];

                    var group = document.createElement('div');
                    group.className = 'fieldset-sessionpricing-pricing-group';
                    group.dataset.ticketGroupKey = key;

                    // Header row: select group + edit pencil
                    var header = document.createElement('div');
                    header.className = 'fieldset-sessionpricing-ticketgroup-header';

                    var selectBtn = document.createElement('button');
                    selectBtn.type = 'button';
                    selectBtn.className = 'fieldset-sessionpricing-ticketgroup-select';
                    selectBtn.textContent = 'Ticket Group ' + key;
                    selectBtn.addEventListener('click', function() {
                        spAssignGroupToActive(key);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    header.appendChild(selectBtn);

                    var editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'fieldset-sessionpricing-ticketgroup-edit';
                    editBtn.textContent = '✎';
                    editBtn.addEventListener('click', function(e) {
                        try { e.stopPropagation(); } catch (e0) {}
                        if (spOpenGroupKey && spOpenGroupKey !== key) {
                            spCloseAllGroupEditors();
                        }
                        var isOpen = group.classList.contains('fieldset-sessionpricing-pricing-group--open');
                        if (!isOpen) {
                            var editorEl0 = group.querySelector('.fieldset-sessionpricing-pricing-editor');
                            spOpenGroupSnapshot = spExtractPricingFromEditor(editorEl0);
                            spOpenGroupKey = key;
                        } else {
                            spOpenGroupSnapshot = null;
                            spOpenGroupKey = null;
                        }
                        spSetGroupEditorOpen(key, !isOpen);
                    });
                    header.appendChild(editBtn);

                    group.appendChild(header);

                    var editorWrap = document.createElement('div');
                    editorWrap.className = 'fieldset-sessionpricing-ticketgroup-editorwrap';
                    editorWrap.style.display = 'none';

                    var editor = document.createElement('div');
                    editor.className = 'fieldset-sessionpricing-pricing-editor';
                    editorWrap.appendChild(editor);
                    spReplaceEditorFromPricing(editor, []);

                    var actions = document.createElement('div');
                    actions.className = 'fieldset-sessionpricing-ticketgroup-actions';

                    var applyBtn = document.createElement('button');
                    applyBtn.type = 'button';
                    applyBtn.className = 'fieldset-sessionpricing-ticketgroup-apply';
                    applyBtn.textContent = 'Apply';
                    applyBtn.addEventListener('click', function() {
                        spOpenGroupSnapshot = null;
                        spOpenGroupKey = null;
                        spSetGroupEditorOpen(key, false);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    actions.appendChild(applyBtn);

                    var deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = 'fieldset-sessionpricing-ticketgroup-delete';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.addEventListener('click', function() {
                        try { group.remove(); } catch (e0) {}
                        delete spTicketGroups[key];
                        spOpenGroupKey = null;
                        spOpenGroupSnapshot = null;

                        // Reassign any session times using this group to A (or the first remaining)
                        var fallbackKey = 'A';
                        if (!spTicketGroups[fallbackKey]) {
                            var keys = Object.keys(spTicketGroups).sort();
                            fallbackKey = keys.length ? keys[0] : 'A';
                            if (!spTicketGroups[fallbackKey]) spEnsureTicketGroup(fallbackKey);
                        }
                        Object.keys(spSessionData).forEach(function(ds) {
                            var data = spSessionData[ds];
                            if (!data || !Array.isArray(data.groups)) return;
                            for (var i = 0; i < data.groups.length; i++) {
                                if (String(data.groups[i] || '') === key) data.groups[i] = fallbackKey;
                            }
                        });
                        spUpdateAllTicketButtonsFromData();
                        spAssignGroupToActive(fallbackKey);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                    });
                    actions.appendChild(deleteBtn);

                    var cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'fieldset-sessionpricing-ticketgroup-cancel';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.addEventListener('click', function() {
                        if (spOpenGroupKey === key && spOpenGroupSnapshot) {
                            spReplaceEditorFromPricing(editor, spOpenGroupSnapshot);
                        }
                        spOpenGroupSnapshot = null;
                        spOpenGroupKey = null;
                        spSetGroupEditorOpen(key, false);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    actions.appendChild(cancelBtn);

                    editorWrap.appendChild(actions);
                    group.appendChild(editorWrap);

                    spTicketGroups[key] = group;
                    if (spTicketGroupList) spTicketGroupList.appendChild(group);
                    return group;
                }

                function spRenderSessions() {
                    // Close the ticket menu before rerendering (prevents stale anchors)
                    spCloseTicketMenu();
                    spSessionsContainer.innerHTML = '';
                    var sortedDates = Object.keys(spSessionData).sort();
                    sortedDates.forEach(function(dateStr) {
                        var data = spSessionData[dateStr];
                        var group = document.createElement('div');
                        group.className = 'fieldset-sessionpricing-sessions-group';
                        data.times.forEach(function(timeVal, idx) {
                            var row = document.createElement('div');
                            row.className = 'fieldset-sessionpricing-sessions-row';
                            if (idx === 0) {
                                var dateDisplay = document.createElement('div');
                                dateDisplay.className = 'fieldset-sessionpricing-sessions-date';
                                var d = new Date(dateStr + 'T00:00:00');
                                try {
                                    var wd = d.toLocaleDateString('en-AU', { weekday: 'short' });
                                    var dm = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                                    var yy = d.toLocaleDateString('en-AU', { year: 'numeric' });
                                    dateDisplay.textContent = (wd + ' ' + dm + ', ' + yy).replace(/\s+/g, ' ').trim();
                                } catch (eFmt) {
                                    dateDisplay.textContent = d.toDateString();
                                }
                                row.appendChild(dateDisplay);
                            } else {
                                var spacer = document.createElement('div');
                                spacer.className = 'fieldset-sessionpricing-sessions-date-spacer';
                                row.appendChild(spacer);
                            }
                            var timeWrapper = document.createElement('div');
                            timeWrapper.className = 'fieldset-sessionpricing-sessions-time';
                            var timeInput = document.createElement('input');
                            timeInput.type = 'text';
                            timeInput.className = 'fieldset-sessionpricing-sessions-time-input';
                            timeInput.placeholder = 'HH:MM';
                            timeInput.maxLength = 5;
                            timeInput.value = timeVal;
                            timeInput.dataset.date = dateStr;
                            timeInput.dataset.idx = idx;
                            if (!Array.isArray(data.groups)) data.groups = [];
                            spEnsureDefaultGroup();
                            if (!data.groups[idx]) data.groups[idx] = 'A';
                            timeInput.dataset.ticketGroupKey = String(data.groups[idx] || 'A');
                            timeInput.addEventListener('focus', function() {
                                var input = this;
                                setTimeout(function() { input.select(); }, 0);
                            });
                            timeInput.addEventListener('input', function() {
                                var v = String(this.value || '').replace(/[^0-9]/g, '');
                                if (v.length >= 2) v = v.substring(0, 2) + ':' + v.substring(2, 4);
                                this.value = v;
                            });
                            (function(dateStr, idx) {
                                timeInput.addEventListener('blur', function() {
                                    var raw = String(this.value || '').replace(/[^0-9]/g, '');
                                    if (raw === '') {
                                        spSessionData[dateStr].times[idx] = '';
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                                        return;
                                    }
                                    var hh, mm;
                                    if (raw.length === 1) { hh = '0' + raw; mm = '00'; }
                                    else if (raw.length === 2) { hh = raw; mm = '00'; }
                                    else if (raw.length === 3) { hh = raw.substring(0, 2); mm = raw.substring(2) + '0'; }
                                    else { hh = raw.substring(0, 2); mm = raw.substring(2, 4); }
                                    var newTime = hh + ':' + mm;
                                    var hours = parseInt(hh, 10);
                                    var mins = parseInt(mm, 10);
                                    if (hours <= 23 && mins <= 59) {
                                        this.value = newTime;
                                        spSessionData[dateStr].times[idx] = newTime;
                                        spSessionData[dateStr].edited[idx] = true;
                                        spAutofillTimes(dateStr, idx, newTime);
                                        spSessionsContainer.querySelectorAll('.fieldset-sessionpricing-sessions-time-input').forEach(function(input) {
                                            var d0 = input.dataset.date;
                                            var i0 = parseInt(input.dataset.idx, 10);
                                            if (d0 && spSessionData[d0] && spSessionData[d0].times[i0] !== undefined) input.value = spSessionData[d0].times[i0];
                                        });
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                    } else {
                                        this.value = '';
                                        spSessionData[dateStr].times[idx] = '';
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
                                    }
                                });
                            })(dateStr, idx);
                            timeWrapper.appendChild(timeInput);
                            row.appendChild(timeWrapper);

                            var spMaxTimesPerDate = 10;
                            var addBtn = document.createElement('button');
                            addBtn.type = 'button';
                            addBtn.className = 'fieldset-sessionpricing-sessions-add';
                            addBtn.textContent = '+';
                            if (data.times.length >= spMaxTimesPerDate) {
                                addBtn.disabled = true;
                                addBtn.style.opacity = '0.3';
                                addBtn.style.cursor = 'not-allowed';
                            } else {
                                (function(dateStr, idx) {
                                    addBtn.addEventListener('click', function() {
                                        var newSlotIdx = idx + 1;
                                        var autofillVal = spGetAutofillForSlot(dateStr, newSlotIdx);
                                        spSessionData[dateStr].times.splice(newSlotIdx, 0, autofillVal);
                                        spSessionData[dateStr].edited.splice(newSlotIdx, 0, false);
                                        if (!Array.isArray(spSessionData[dateStr].groups)) spSessionData[dateStr].groups = [];
                                        var inheritKey = spSessionData[dateStr].groups[idx] || 'A';
                                        spSessionData[dateStr].groups.splice(newSlotIdx, 0, inheritKey);
                                        spRenderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(addBtn);

                            var removeBtn = document.createElement('button');
                            removeBtn.type = 'button';
                            removeBtn.className = 'fieldset-sessionpricing-sessions-remove';
                            removeBtn.textContent = '−';
                            if (data.times.length === 1) {
                                removeBtn.disabled = true;
                                removeBtn.style.opacity = '0.3';
                                removeBtn.style.cursor = 'not-allowed';
                            } else {
                                (function(dateStr, idx) {
                                    removeBtn.addEventListener('click', function() {
                                        spSessionData[dateStr].times.splice(idx, 1);
                                        spSessionData[dateStr].edited.splice(idx, 1);
                                        if (Array.isArray(spSessionData[dateStr].groups)) spSessionData[dateStr].groups.splice(idx, 1);
                                        spRenderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(removeBtn);

                            // Ticket group button (icon + letter)
                            var ticketBtn = document.createElement('button');
                            ticketBtn.type = 'button';
                            ticketBtn.className = 'fieldset-sessionpricing-ticketgroup-button';
                            ticketBtn.title = 'Ticket Group';

                            var iconUrl = spGetSystemTicketIconUrl();
                            if (iconUrl) {
                                var img = document.createElement('img');
                                img.className = 'fieldset-sessionpricing-ticketgroup-icon';
                                img.alt = '';
                                img.src = iconUrl;
                                ticketBtn.appendChild(img);
                            }
                            var letter = document.createElement('div');
                            letter.className = 'fieldset-sessionpricing-ticketgroup-letter';
                            letter.textContent = String(data.groups[idx] || 'A');
                            ticketBtn.appendChild(letter);

                            (function(dateStr, idx, timeInput, ticketBtn, rowEl) {
                                ticketBtn.addEventListener('click', function(e) {
                                    try { e.preventDefault(); e.stopPropagation(); } catch (e0) {}
                                    var picker = { dateStr: dateStr, idx: idx, timeInput: timeInput, ticketBtn: ticketBtn, rowEl: rowEl };
                                    if (spTicketMenuOpen && spActivePicker && spActivePicker.ticketBtn === ticketBtn) {
                                        spCloseTicketMenu();
                                        return;
                                    }
                                    spOpenTicketMenu(rowEl, picker);
                                });
                            })(dateStr, idx, timeInput, ticketBtn, row);
                            row.appendChild(ticketBtn);

                            group.appendChild(row);
                        });
                        spSessionsContainer.appendChild(group);
                    });
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                }

                spCalendar.addEventListener('click', function(e) {
                    var day = e.target;
                    if (day.classList.contains('fieldset-sessionpricing-calendar-day') && !day.classList.contains('fieldset-sessionpricing-calendar-day--empty')) {
                        var iso = day.dataset.iso;
                        if (spSessionData[iso]) {
                            delete spSessionData[iso];
                            day.classList.remove('fieldset-sessionpricing-calendar-day--selected');
                        } else {
                            spEnsureDefaultGroup();
                            var autofillVal = spGetAutofillForSlot(iso, 0);
                            spSessionData[iso] = { times: [autofillVal], edited: [false], groups: ['A'] };
                            day.classList.add('fieldset-sessionpricing-calendar-day--selected');
                        }
                        spRenderSessions();
                        try { fieldset.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true })); } catch (e1) {}
                    }
                });

                // Initial UI state
                spEnsureDefaultGroup();
                spRenderSessions();

                break;
                
            case 'venue':
                // SMART VENUE FIELDSET
                // - Both inputs have Google Places (unrestricted)
                // - Auto-fill ONLY empty boxes
                // - User edits are protected
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                
                // Hidden lat/lng fields
                var smartLatInput = document.createElement('input');
                smartLatInput.type = 'hidden';
                smartLatInput.className = 'fieldset-lat';
                var smartLngInput = document.createElement('input');
                smartLngInput.type = 'hidden';
                smartLngInput.className = 'fieldset-lng';
                var smartCountryInput = document.createElement('input');
                smartCountryInput.type = 'hidden';
                smartCountryInput.className = 'fieldset-country';
                
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

                // Address must be confirmed via Google Places (lat/lng set). Typing alone is not enough.
                try { smartAddrInput.dataset.placesConfirmed = 'false'; } catch (e0) {}
                
                // Status indicator
                var smartStatus = document.createElement('div');
                smartStatus.className = 'fieldset-location-status';
                fieldset.appendChild(smartStatus);
                
                fieldset.appendChild(smartLatInput);
                fieldset.appendChild(smartLngInput);
                fieldset.appendChild(smartCountryInput);
                
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
                            // Use same API call as map controls (no type restrictions)
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
                                        await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'types', 'addressComponents'] });
                                        
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
                                        
                                        // Country code (2-letter)
                                        try {
                                            var cc = '';
                                            if (Array.isArray(place.addressComponents)) {
                                                place.addressComponents.forEach(function(c) {
                                                    if (!c || !Array.isArray(c.types)) return;
                                                    if (c.types.indexOf('country') === -1) return;
                                                    var raw = c.shortText || c.short_name || c.short || c.longText || c.long_name || '';
                                                    var code = String(raw || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
                                                    if (code.length === 2) cc = code;
                                                });
                                            }
                                            smartCountryInput.value = cc;
                                        } catch (eCC) {}
                                        
                                        if (isVenueBox) {
                                            // User searched in venue box
                                            // Strip venue name to just the name (Google fills with full address)
                                            if (isEstablishment && venueName) {
                                                smartVenueInput.value = venueName;
                                            }
                                            // Address: ALWAYS use the Google-confirmed formatted address.
                                            smartAddrInput.value = address;
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

                                        // Mark address as Places-confirmed (required for completion)
                                        try { smartAddrInput.dataset.placesConfirmed = 'true'; } catch (e0) {}
                                        // Use change so we don't trigger the address input handler.
                                        try { smartAddrInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                        
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
                        // Manual typing invalidates Places confirmation for the address field.
                        // Venue name can be typed freely, but the address must be confirmed via Google.
                        if (!isVenueBox) {
                            try { smartAddrInput.dataset.placesConfirmed = 'false'; } catch (e2) {}
                            smartLatInput.value = '';
                            smartLngInput.value = '';
                            // No re-dispatch here; this handler is already running due to input.
                        }
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
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var input = document.createElement('input');
                input.type = 'text';
                input.className = 'fieldset-input';
                applyPlaceholder(input, placeholder);
                var validation = addInputValidation(input, minLength, maxLength, null);
                fieldset.appendChild(input);
                fieldset.appendChild(validation.charCount);
        }

        // ---------------------------------------------------------------------
        // REQUIRED + COMPLETE STATE (component-owned)
        //
        // - FieldsetBuilder is the single source of truth for fieldset validity UI,
        //   so Admin form preview and Member Create Post behave identically.
        // - Member/Admin code should only read dataset flags; it must not re-implement
        //   per-field rules (min/max, email/url, complex nested fieldsets, etc).
        // ---------------------------------------------------------------------

        function normalizeRequiredFlag(v) {
            if (v === true || v === 1 || v === '1' || v === 'true') return true;
            return false;
        }

        var requiredFlag = normalizeRequiredFlag(fieldData.required || fieldData.is_required);
        try {
            fieldset.dataset.required = requiredFlag ? 'true' : 'false';
        } catch (e) {}

        var requiredStar = fieldset.querySelector('.fieldset-label-required');
        if (requiredStar) {
            // If not required, hide the star entirely (no "complete" state needed).
            if (!requiredFlag) {
                requiredStar.style.display = 'none';
            }
        }

        function setCompleteState(isComplete) {
            var complete = !!isComplete;
            try {
                fieldset.dataset.complete = complete ? 'true' : 'false';
            } catch (e) {}
            if (requiredStar && requiredStar.style.display !== 'none') {
                requiredStar.classList.toggle('fieldset-label-required--complete', complete);
            }
            try {
                fieldset.dispatchEvent(new CustomEvent('fieldset:validity-change', { bubbles: true }));
            } catch (e2) {}
        }

        function strLenOk(v, minL, maxL) {
            var s = (typeof v === 'string') ? v.trim() : '';
            if (!s) return false;
            var L = s.length;
            if (typeof minL === 'number' && isFinite(minL) && minL > 0 && L < minL) return false;
            if (typeof maxL === 'number' && isFinite(maxL) && maxL > 0 && L > maxL) return false;
            return true;
        }

        function isTimeHHMM(v) {
            var s = (typeof v === 'string') ? v.trim() : '';
            var m = s.match(/^(\d{2}):(\d{2})$/);
            if (!m) return false;
            var hh = parseInt(m[1], 10);
            var mm = parseInt(m[2], 10);
            return (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59);
        }

        function computeComplete() {
            function fieldHasAnyUserValue() {
                try {
                    switch (key) {
                        case 'custom_radio':
                            return !!fieldset.querySelector('input[type="radio"]:checked');
                        case 'custom_dropdown': {
                            var sel = fieldset.querySelector('select');
                            return !!(sel && String(sel.value || '').trim());
                        }
                        case 'images': {
                            var meta = fieldset.querySelector('input.fieldset-images-meta');
                            var raw = meta ? String(meta.value || '').trim() : '';
                            if (!raw) return false;
                            try {
                                var arr = JSON.parse(raw);
                                return Array.isArray(arr) && arr.length > 0;
                            } catch (e0) {
                                return true; // has something, but malformed => treat as "user value exists"
                            }
                        }
                        case 'amenities':
                            return !!fieldset.querySelector('.fieldset-amenity-row input[type="radio"]:checked');
                        case 'sessions': {
                            var selected = fieldset.querySelectorAll('.fieldset-calendar-day.selected[data-iso]');
                            if (selected && selected.length > 0) return true;
                            // If any time input has value, user interacted.
                            var t = fieldset.querySelectorAll('input.fieldset-time');
                            for (var i = 0; i < t.length; i++) {
                                if (t[i] && String(t[i].value || '').trim()) return true;
                            }
                            return false;
                        }
                        case 'session_pricing': {
                            var selected2 = fieldset.querySelectorAll('.fieldset-sessionpricing-calendar-day--selected[data-iso]');
                            if (selected2 && selected2.length > 0) return true;
                            var t2 = fieldset.querySelectorAll('input.fieldset-sessionpricing-sessions-time-input');
                            for (var i2 = 0; i2 < t2.length; i2++) {
                                if (t2[i2] && String(t2[i2].value || '').trim()) return true;
                            }
                            var pricingInputs = fieldset.querySelectorAll('.fieldset-sessionpricing-pricing-groups .fieldset-sessionpricing-pricing-group:not([style*="display: none"]) input:not([type="hidden"]), .fieldset-sessionpricing-pricing-groups .fieldset-sessionpricing-pricing-group:not([style*="display: none"]) select, .fieldset-sessionpricing-pricing-groups .fieldset-sessionpricing-pricing-group:not([style*="display: none"]) textarea');
                            for (var p0 = 0; p0 < pricingInputs.length; p0++) {
                                var el0 = pricingInputs[p0];
                                if (!el0) continue;
                                if (el0.type === 'checkbox' || el0.type === 'radio') {
                                    if (el0.checked) return true;
                                } else if (String(el0.value || '').trim()) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        case 'phone': {
                            var pfx = fieldset.querySelector('.fieldset-menu-button-input');
                            var tel = fieldset.querySelector('input[type="tel"].fieldset-input');
                            if (pfx && String(pfx.value || '').trim()) return true;
                            if (tel && String(tel.value || '').trim()) return true;
                            return false;
                        }
                        case 'item-pricing':
                        case 'ticket-pricing': {
                            var els = fieldset.querySelectorAll('input:not([type="hidden"]), select, textarea');
                            for (var i = 0; i < els.length; i++) {
                                var el = els[i];
                                if (!el) continue;
                                if (el.type === 'checkbox' || el.type === 'radio') {
                                    if (el.checked) return true;
                                } else if (String(el.value || '').trim()) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        default: {
                            var els = fieldset.querySelectorAll('input:not([type="hidden"]), select, textarea');
                            for (var i = 0; i < els.length; i++) {
                                var el = els[i];
                                if (!el) continue;
                                if (el.type === 'checkbox' || el.type === 'radio') {
                                    if (el.checked) return true;
                                } else if (String(el.value || '').trim()) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    }
                } catch (e) {
                    return false;
                }
            }

            // Optional fieldsets: empty => complete; but if the user entered anything, it must validate.
            if (!requiredFlag && !fieldHasAnyUserValue()) return true;

            function isVisibleControl(el) {
                if (!el) return false;
                if (el.disabled) return false;
                if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
                // During initial build, fieldsets are often validated before being inserted into the DOM.
                // In that state, offsetParent/rects can be "invisible" even though the control will be visible.
                // Be conservative: treat detached controls as visible so required fieldsets start incomplete (red).
                if (el.isConnected === false) return true;
                // Covers display:none, detached, etc.
                if (el.offsetParent === null && el.getClientRects().length === 0) return false;
                return true;
            }

            function allVisibleControlsFilled(containerEl) {
                var els = containerEl.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)');
                if (!els || els.length === 0) return false;
                var checkedCount = 0;
                for (var i = 0; i < els.length; i++) {
                    var el = els[i];
                    if (!isVisibleControl(el)) continue;
                    checkedCount++;
                    if (typeof el.checkValidity === 'function' && !el.checkValidity()) return false;
                    if (el.type === 'checkbox' || el.type === 'radio') {
                        if (!el.checked) return false;
                        continue;
                    }
                    var val = String(el.value || '').trim();
                    if (!val) return false;
                }
                // If none were considered visible/required, do not allow a required fieldset to be "complete".
                return checkedCount > 0;
            }

            switch (key) {
                case 'title':
                case 'coupon':
                case 'custom_text':
                case 'username':
                case 'password':
                case 'new-password': {
                    var inp = fieldset.querySelector('input.fieldset-input');
                    return inp ? strLenOk(inp.value, minLength, maxLength) : false;
                }
                case 'confirm-password': {
                    var confirmInput = fieldset.querySelector('input.fieldset-input');
                    if (!confirmInput) return false;
                    // Must meet its own length constraints and must match the password field above it.
                    if (!strLenOk(confirmInput.value, minLength, maxLength)) return false;

                    // Find the nearest password/new-password fieldset above this one in DOM order.
                    var pwFieldset = null;
                    try {
                        var prev = fieldset.previousElementSibling;
                        while (prev) {
                            if (prev.classList && prev.classList.contains('fieldset')) {
                                var k = String(prev.dataset && prev.dataset.fieldsetKey ? prev.dataset.fieldsetKey : '').trim();
                                if (k === 'password' || k === 'new-password') {
                                    pwFieldset = prev;
                                    break;
                                }
                            }
                            prev = prev.previousElementSibling;
                        }
                        // Fallback: first matching fieldset in the same container
                        if (!pwFieldset && fieldset.parentNode && fieldset.parentNode.querySelector) {
                            pwFieldset = fieldset.parentNode.querySelector('.fieldset[data-fieldset-key="password"], .fieldset[data-fieldset-key="new-password"]');
                        }
                    } catch (e0) {}

                    var pwInput = pwFieldset ? pwFieldset.querySelector('input.fieldset-input') : null;
                    if (!pwInput) return false;

                    // Identical means identical (no trimming differences).
                    return String(confirmInput.value || '') === String(pwInput.value || '');
                }
                case 'description':
                case 'custom_textarea':
                {
                    var ta = fieldset.querySelector('textarea');
                    return ta ? strLenOk(ta.value, minLength, maxLength) : false;
                }
                case 'email':
                case 'account_email':
                case 'public_email': {
                    var e = fieldset.querySelector('input.fieldset-input');
                    if (!e) return false;
                    if (!strLenOk(e.value, minLength, maxLength)) return false;
                    return isValidEmail(e.value);
                }
                case 'website-url':
                case 'tickets-url': {
                    var u = fieldset.querySelector('input.fieldset-input');
                    if (!u) return false;
                    if (!strLenOk(u.value, minLength, maxLength)) return false;
                    return isValidUrl(u.value);
                }
                case 'custom_dropdown': {
                    var sel = fieldset.querySelector('select');
                    var v = sel ? String(sel.value || '').trim() : '';
                    return !!v;
                }
                case 'custom_radio': {
                    var checked = fieldset.querySelector('input[type="radio"]:checked');
                    return !!checked;
                }
                case 'phone': {
                    var prefixInput = fieldset.querySelector('.fieldset-menu-button-input');
                    var phoneInput = fieldset.querySelector('input[type="tel"].fieldset-input');
                    if (!prefixInput || !phoneInput) return false;
                    var pfx = String(prefixInput.value || '').trim();
                    if (!pfx) return false;
                    return strLenOk(phoneInput.value, minLength, maxLength);
                }
                case 'address':
                case 'city':
                case 'location': {
                    // Address/City must be Google Places confirmed (not manual typing).
                    var addr = fieldset.querySelector('input.fieldset-input');
                    var lat = fieldset.querySelector('input.fieldset-lat');
                    var lng = fieldset.querySelector('input.fieldset-lng');
                    if (!addr || !lat || !lng) return false;
                    if (!strLenOk(addr.value, minLength, maxLength)) return false;
                    if (String(addr.dataset.placesConfirmed || '') !== 'true') return false;
                    return !!(String(lat.value || '').trim() && String(lng.value || '').trim());
                }
                case 'venue': {
                    // Venue requires:
                    // - Venue Name: any non-empty text (user-typed allowed)
                    // - Address: Google Places confirmed (lat/lng set)
                    var inputs = fieldset.querySelectorAll('input.fieldset-input');
                    var venueName = inputs && inputs[0] ? String(inputs[0].value || '').trim() : '';
                    var addr = inputs && inputs[1] ? inputs[1] : null;
                    var lat = fieldset.querySelector('input.fieldset-lat');
                    var lng = fieldset.querySelector('input.fieldset-lng');
                    if (!venueName) return false;
                    if (!addr || !lat || !lng) return false;
                    if (!strLenOk(String(addr.value || ''), minLength, maxLength)) return false;
                    if (String(addr.dataset.placesConfirmed || '') !== 'true') return false;
                    return !!(String(lat.value || '').trim() && String(lng.value || '').trim());
                }
                case 'sessions': {
                    var selectedDays = fieldset.querySelectorAll('.fieldset-calendar-day.selected[data-iso]');
                    if (!selectedDays || selectedDays.length === 0) return false;
                    // Session time inputs are rendered with class "fieldset-time"
                    var timeInputs = fieldset.querySelectorAll('input.fieldset-time');
                    if (!timeInputs || timeInputs.length === 0) return false;
                    for (var i = 0; i < timeInputs.length; i++) {
                        var ti = timeInputs[i];
                        if (!ti) return false;
                        // Only require boxes the user can actually see/interact with.
                        if (!isVisibleControl(ti)) continue;
                        // A time box is only "complete" when it's fully formed (HH:MM).
                        if (!isTimeHHMM(ti.value)) return false;
                    }
                    return true;
                }
                case 'session_pricing': {
                    var selectedDays2 = fieldset.querySelectorAll('.fieldset-sessionpricing-calendar-day--selected[data-iso]');
                    if (!selectedDays2 || selectedDays2.length === 0) return false;

                    var timeInputs2 = fieldset.querySelectorAll('input.fieldset-sessionpricing-sessions-time-input');
                    if (!timeInputs2 || timeInputs2.length === 0) return false;
                    for (var i2 = 0; i2 < timeInputs2.length; i2++) {
                        var ti2 = timeInputs2[i2];
                        if (!ti2) return false;
                        if (!isVisibleControl(ti2)) continue;
                        if (!isTimeHHMM(ti2.value)) return false;
                    }

                    // Ticket pricing groups must be complete for every group referenced by any session time,
                    // regardless of whether the popover is currently open/visible.
                    var groupsWrap = fieldset.querySelector('.fieldset-sessionpricing-pricing-groups');
                    if (!groupsWrap) return false;
                    var groups = groupsWrap.querySelectorAll('.fieldset-sessionpricing-pricing-group');
                    if (!groups || groups.length === 0) return false;

                    function allControlsFilledNoVisibility(containerEl) {
                        var els = containerEl.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)');
                        if (!els || els.length === 0) return false;
                        for (var i = 0; i < els.length; i++) {
                            var el = els[i];
                            if (!el) return false;
                            if (typeof el.checkValidity === 'function' && !el.checkValidity()) return false;
                            if (el.type === 'checkbox' || el.type === 'radio') {
                                if (!el.checked) return false;
                                continue;
                            }
                            var val = String(el.value || '').trim();
                            if (!val) return false;
                        }
                        return true;
                    }

                    var referenced = {};
                    for (var tgi = 0; tgi < timeInputs2.length; tgi++) {
                        var ti3 = timeInputs2[tgi];
                        if (!ti3 || !isVisibleControl(ti3)) continue;
                        var gk = ti3.dataset ? String(ti3.dataset.ticketGroupKey || '').trim() : '';
                        if (!gk) return false; // every visible time must have a group
                        referenced[gk] = true;
                    }
                    var refKeys = Object.keys(referenced);
                    if (refKeys.length === 0) return false;

                    for (var rk = 0; rk < refKeys.length; rk++) {
                        var key = refKeys[rk];
                        var grpEl = groupsWrap.querySelector('.fieldset-sessionpricing-pricing-group[data-ticket-group-key="' + key + '"]');
                        if (!grpEl) return false;
                        var editor = grpEl.querySelector('.fieldset-sessionpricing-pricing-editor') || grpEl;
                        if (!allControlsFilledNoVisibility(editor)) return false;
                    }
                    return true;
                }
                case 'images': {
                    var meta = fieldset.querySelector('input.fieldset-images-meta');
                    var raw = meta ? String(meta.value || '').trim() : '';
                    if (!raw) return false;
                    try {
                        var arr = JSON.parse(raw);
                        return Array.isArray(arr) && arr.length > 0;
                    } catch (e) {
                        return false;
                    }
                }
                case 'amenities': {
                    // Required amenities: every row needs Yes/No selected.
                    var rows = fieldset.querySelectorAll('.fieldset-amenity-row');
                    if (!rows || rows.length === 0) return false;
                    for (var i = 0; i < rows.length; i++) {
                        if (!rows[i].querySelector('input[type="radio"]:checked')) return false;
                    }
                    return true;
                }
                case 'item-pricing': {
                    // Rule: all visible boxes in this pricing UI must be filled out.
                    // Covers item name + each variant's name/currency/price.
                    return allVisibleControlsFilled(fieldset);
                }
                case 'ticket-pricing': {
                    // Rule: all visible boxes in this seating/tier pricing UI must be filled out.
                    // Covers seating area name + tier name + currency + price.
                    return allVisibleControlsFilled(fieldset);
                }
                default: {
                    // Fallback: require at least one non-hidden input to have a value and to be natively valid.
                    var els = fieldset.querySelectorAll('input:not([type="hidden"]), select, textarea');
                    if (!els || els.length === 0) return false;
                    for (var i = 0; i < els.length; i++) {
                        var el = els[i];
                        if (!el) continue;
                        if (typeof el.checkValidity === 'function' && !el.checkValidity()) return false;
                        var val = (el.type === 'checkbox') ? (el.checked ? '1' : '') : String(el.value || '').trim();
                        if (!val) return false;
                    }
                    return true;
                }
            }
        }

        function updateCompleteFromDom() {
            // Only show "complete" for required fieldsets.
            setCompleteState(computeComplete());
        }

        // Initial state
        updateCompleteFromDom();

        // Recalculate on any interaction inside this fieldset.
        fieldset.addEventListener('input', updateCompleteFromDom, true);
        fieldset.addEventListener('change', updateCompleteFromDom, true);
        fieldset.addEventListener('blur', updateCompleteFromDom, true);

        // Confirm-password depends on the password field above it, so it must revalidate when that field changes too.
        if (key === 'confirm-password' && container && typeof container.addEventListener === 'function') {
            try { container.addEventListener('input', updateCompleteFromDom, true); } catch (e3) {}
            try { container.addEventListener('change', updateCompleteFromDom, true); } catch (e4) {}
        }

        return fieldset;
    }
    
    // NOTE: No auto-load at script startup (performance). Callers should call
    // FieldsetBuilder.loadFromDatabase() before building fieldsets that need picklists.
    
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
        getPicklist: function() { return dropdownOptions; },
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
        var onChange = options.onChange || null;
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
                                if (onChange) onChange(selectedStart, selectedEnd);
                            } else {
                                // Complete selection
                                if (clickedDate < selectedStart) {
                                    selectedEnd = selectedStart;
                                    selectedStart = clickedDate;
                                } else {
                                    selectedEnd = clickedDate;
                                }
                                updateSelection(calendar);
                                if (onChange) onChange(selectedStart, selectedEnd);
                                
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
                if (onChange) onChange(selectedStart, selectedEnd);
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
                if (res.dropdown_options && res.dropdown_options.currency) {
                    currencyData = res.dropdown_options.currency;
                    dataLoaded = true;
                }
                return currencyData;
            });
    }
    
    // Build a compact currency menu (100px, code only)
    // Combobox style - type to filter options
    // Returns object with element and setValue method
    // Class pattern: component-currencycompact-menu-{part}--{state}
    function buildCompactMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;

        var menu = document.createElement('div');
        menu.className = 'component-currencycompact-menu';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-currencycompact-menu-button"><img class="component-currencycompact-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="component-currencycompact-menu-button-input" placeholder="Search" autocomplete="off"><span class="component-currencycompact-menu-button-arrow">▼</span></div><div class="component-currencycompact-menu-options"></div>';

        var btn = menu.querySelector('.component-currencycompact-menu-button');
        var opts = menu.querySelector('.component-currencycompact-menu-options');
        var btnImg = menu.querySelector('.component-currencycompact-menu-button-image');
        var btnInput = menu.querySelector('.component-currencycompact-menu-button-input');
        var arrow = menu.querySelector('.component-currencycompact-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-currencycompact-menu--open', !!isOpen);
            if (btn) btn.classList.toggle('component-currencycompact-menu-button--open', !!isOpen);
            if (arrow) arrow.classList.toggle('component-currencycompact-menu-button-arrow--open', !!isOpen);
            if (opts) opts.classList.toggle('component-currencycompact-menu-options--open', !!isOpen);
        }

        // Required by MenuManager (strict)
        menu.__menuIsOpen = function() {
            return menu.classList.contains('component-currencycompact-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;

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
            var search = String(searchText || '').toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = menuFilterMatch(optData, search);
                optData.element.style.display = matches ? '' : 'none';
            });
        }

        // Build options
        currencyData.forEach(function(item) {
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;

            var op = document.createElement('div');
            op.className = 'component-currencycompact-menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="component-currencycompact-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-currencycompact-menu-option-text">' + displayText + '</span>';
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
                applyOpenState(false);
                filterOptions('');
                onSelect(item.value, item.label, countryCode);
            };
            opts.appendChild(op);

            // Store for filtering (prefix-first, word-start matching)
            allOptions.push({
                element: op,
                valueLower: String(item.value || '').toLowerCase(),
                labelLower: String(item.label || '').toLowerCase(),
                labelWords: String(item.label || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean)
            });
        });

        // Set initial value
        if (initialValue) {
            setValue(initialValue);
        }

        // Data must be loaded BEFORE building menu (via FieldsetBuilder.setPicklist)
        // If data isn't loaded, menu will be empty - this is expected behavior

        // Called when menu closes externally - revert to selected value
        menu.__menuOnClose = function() {
            setValue(selectedCode);
            filterOptions('');
        };

        // Register with MenuManager
        MenuManager.register(menu);

        // Clicking anywhere on the button opens the menu (if closed)
        // (Arrow has its own handler; it stops propagation so it won't double-trigger.)
        if (btn) {
            btn.addEventListener('click', function(e) {
                if (e) e.stopPropagation();
                if (!menu.classList.contains('component-currencycompact-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }

        // Input events
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            applyOpenState(true);
            this.select();
        });

        btnInput.addEventListener('input', function(e) {
            filterOptions(this.value);
            // Only auto-open while the user is actually typing in this input.
            // Programmatic value copies (e.g. multi-location autofill dispatching input events) must NOT open menus.
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('component-currencycompact-menu--open')) applyOpenState(true);
        });

        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('component-currencycompact-menu--open')) {
                menuArrowKeyNav(e, opts, '.component-currencycompact-menu-option', function(opt) { opt.click(); });
            }
        });

        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('component-currencycompact-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('fieldset-menu--open')) {
                applyOpenState(false);
            } else {
                MenuManager.closeAll(menu);
                applyOpenState(true);
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
    // Class pattern: component-currencyfull-menu-{part}--{state}
    function buildFullMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null;
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;
        
        var menu = document.createElement('div');
        menu.className = 'component-currencyfull-menu';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-currencyfull-menu-button"><img class="component-currencyfull-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="component-currencyfull-menu-button-input" placeholder="Select currency" autocomplete="off"><span class="component-currencyfull-menu-button-arrow">▼</span></div><div class="component-currencyfull-menu-options"></div>';
        
        var btn = menu.querySelector('.component-currencyfull-menu-button');
        var opts = menu.querySelector('.component-currencyfull-menu-options');
        var btnImg = menu.querySelector('.component-currencyfull-menu-button-image');
        var btnInput = menu.querySelector('.component-currencyfull-menu-button-input');
        var arrow = menu.querySelector('.component-currencyfull-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-currencyfull-menu--open', !!isOpen);
            btn.classList.toggle('component-currencyfull-menu-button--open', !!isOpen);
            arrow.classList.toggle('component-currencyfull-menu-button-arrow--open', !!isOpen);
            opts.classList.toggle('component-currencyfull-menu-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('component-currencyfull-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set initial value
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
                btnInput.value = found.value + ' - ' + found.label;
                selectedCode = code;
            }
        }

        // Filter options based on search text
        function filterOptions(searchText) {
            var search = String(searchText || '').toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = menuFilterMatch(optData, search);
                optData.element.style.display = matches ? '' : 'none';
            });
        }

        // Build options
        var currencies = currencyData;
        currencies.forEach(function(item) {
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;
            
            var op = document.createElement('div');
            op.className = 'component-currencyfull-menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="component-currencyfull-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-currencyfull-menu-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                if (flagUrl) {
                btnImg.src = flagUrl;
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = displayText;
                selectedCode = item.value;
                applyOpenState(false);
                filterOptions(''); // Reset filter
                onSelect(item.value, item.label, countryCode);
            };
            opts.appendChild(op);
            
            // Store for filtering
            allOptions.push({
                element: op,
                valueLower: String(item.value || '').toLowerCase(),
                labelLower: String(item.label || '').toLowerCase(),
                labelWords: String(item.label || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean)
            });
        });

        // Set initial value (only if provided)
        if (initialValue) {
            setValue(initialValue);
        }

        // Register with MenuManager
        MenuManager.register(menu);

        // Clicking anywhere on the button opens the menu (if closed)
        if (btn) {
            btn.addEventListener('click', function(e) {
                if (e) e.stopPropagation();
                if (!menu.classList.contains('component-currencyfull-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }

        // Input events
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            applyOpenState(true);
            // Select all text for easy replacement
            this.select();
        });

        btnInput.addEventListener('input', function(e) {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('component-currencyfull-menu--open')) applyOpenState(true);
        });
        
        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                // Restore selected value
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('component-currencyfull-menu--open')) {
                menuArrowKeyNav(e, opts, '.component-currencyfull-menu-option', function(opt) { opt.click(); });
            }
        });
        
        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            // Small delay to allow option click to fire first
            setTimeout(function() {
                if (!menu.classList.contains('component-currencyfull-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('component-currencyfull-menu--open')) {
                applyOpenState(false);
            } else {
                MenuManager.closeAll(menu);
                applyOpenState(true);
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
   LANGUAGE MENU (FULL WIDTH)
   NOTE: This is intentionally duplicated from CurrencyComponent.buildFullMenu
   and uses the same database data source for now (currency list).
   ============================================================================ */

const LanguageMenuComponent = (function(){
    
    // Data loaded from database - no hardcoded fallback (TEMP: currency list)
    var languageData = [];
    var dataLoaded = false;
    
    function getData() {
        return languageData;
    }
    
    function setData(data) {
        languageData = data || [];
        dataLoaded = true;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Load language data from database via gateway (TEMP: currency list)
    function loadFromDatabase() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.dropdown_options && res.dropdown_options.currency) {
                    languageData = res.dropdown_options.currency;
                    dataLoaded = true;
                }
                return languageData;
            });
    }
    
    // Build a full language menu (wide, shows code + label)
    // Combobox style - type to filter options
    // Returns object with element and setValue method
    function buildFullMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var containerEl = options.container || null;
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;
        
        var menu = document.createElement('div');
        menu.className = 'admin-language-wrapper';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="admin-language-button"><img class="admin-language-button-flag" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="admin-language-button-input" placeholder="Select currency" autocomplete="off"><span class="admin-language-button-arrow">▼</span></div><div class="admin-language-options"></div>';
        
        var btn = menu.querySelector('.admin-language-button');
        var opts = menu.querySelector('.admin-language-options');
        var btnImg = menu.querySelector('.admin-language-button-flag');
        var btnInput = menu.querySelector('.admin-language-button-input');
        var arrow = menu.querySelector('.admin-language-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('admin-language-wrapper--open', !!isOpen);
            btn.classList.toggle('admin-language-button--open', !!isOpen);
            arrow.classList.toggle('admin-language-button-arrow--open', !!isOpen);
            opts.classList.toggle('admin-language-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('admin-language-wrapper--open');
        };
        menu.__menuApplyOpenState = applyOpenState;

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set initial value
        function setValue(code) {
            var found = languageData.find(function(item) {
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
                btnInput.value = found.value + ' - ' + found.label;
                selectedCode = code;
            }
        }

        // Filter options based on search text
        function filterOptions(searchText) {
            var search = String(searchText || '').toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = menuFilterMatch(optData, search);
                optData.element.style.display = matches ? '' : 'none';
            });
        }

        // Build options
        var languages = languageData;
        languages.forEach(function(item) {
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;
            
            var op = document.createElement('div');
            op.className = 'admin-language-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="admin-language-option-flag" src="' + flagUrl + '" alt=""><span class="admin-language-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                if (flagUrl) {
                    btnImg.src = flagUrl;
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = displayText;
                selectedCode = item.value;
                applyOpenState(false);
                filterOptions(''); // Reset filter
                onSelect(item.value, item.label, countryCode);
            };
            opts.appendChild(op);
            
            // Store for filtering
            allOptions.push({
                element: op,
                valueLower: String(item.value || '').toLowerCase(),
                labelLower: String(item.label || '').toLowerCase(),
                labelWords: String(item.label || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean)
            });
        });

        // Set initial value (only if provided)
        if (initialValue) {
            setValue(initialValue);
        }

        // Called when menu closes externally - revert to selected value
        menu.__menuOnClose = function() {
            setValue(selectedCode);
            filterOptions('');
        };

        // Register with MenuManager
        MenuManager.register(menu);

        // Clicking anywhere on the button opens the menu (if closed)
        // (Arrow has its own handler; it stops propagation so it won't double-trigger.)
        if (btn) {
            btn.addEventListener('click', function(e) {
                if (e) e.stopPropagation();
                if (!menu.classList.contains('admin-language-wrapper--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }

        // Input events
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            applyOpenState(true);
            // Select all text for easy replacement
            this.select();
        });

        btnInput.addEventListener('input', function(e) {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('admin-language-wrapper--open')) applyOpenState(true);
        });
        
        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                // Restore selected value
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('admin-language-wrapper--open')) {
                menuArrowKeyNav(e, opts, '.admin-language-option', function(opt) { opt.click(); });
            }
        });
        
        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            // Small delay to allow option click to fire first
            setTimeout(function() {
                if (!menu.classList.contains('admin-language-wrapper--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('admin-language-wrapper--open')) {
                applyOpenState(false);
            } else {
                MenuManager.closeAll(menu);
                applyOpenState(true);
            }
        });

        // Mount into container if provided
        if (containerEl) {
            containerEl.appendChild(menu);
        }

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
        buildFullMenu: buildFullMenu
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
                if (res.dropdown_options && res.dropdown_options['phone-prefix']) {
                    prefixData = res.dropdown_options['phone-prefix'];
                    dataLoaded = true;
                }
                return prefixData;
            });
    }
    
    // Build a compact phone prefix menu (100px, prefix only)
    // Returns object with element and setValue method
    function buildCompactMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;

        // Match the Currency compact menu pattern (fieldset-menu combobox)
        var menu = document.createElement('div');
        menu.className = 'phoneprefix-button-wrapper fieldset-menu fieldset-currency-compact';

        var initialFlagUrl = '';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: none;"><input type="text" class="fieldset-menu-button-input" placeholder="Search" autocomplete="off"><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';

        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnInput = menu.querySelector('.fieldset-menu-button-input');
        var arrow = menu.querySelector('.fieldset-menu-button-arrow');

        // Compact variant styling (no descendant selectors)
        btn.classList.add('fieldset-menu-button--compact');
        btnInput.classList.add('fieldset-menu-button-input--compact');
        opts.classList.add('fieldset-menu-options--compact');

        function applyOpenState(isOpen) {
            menu.classList.toggle('fieldset-menu--open', !!isOpen);
            if (btn) btn.classList.toggle('fieldset-menu-button--open', !!isOpen);
            if (arrow) arrow.classList.toggle('fieldset-menu-button-arrow--open', !!isOpen);
            if (opts) opts.classList.toggle('fieldset-menu-options--open', !!isOpen);
        }

        // Required by MenuManager (strict)
        menu.__menuIsOpen = function() { return menu.classList.contains('fieldset-menu--open'); };
        menu.__menuApplyOpenState = applyOpenState;

        // Store all option elements for filtering
        var allOptions = [];

        function filterOptions(searchText) {
            var search = String(searchText || '').toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = menuFilterMatch(optData, search);
                optData.element.style.display = matches ? '' : 'none';
            });
        }

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

        // Build options - filter out entries without proper data
        prefixData.forEach(function(item) {
            // Skip entries without filename, value, or label
            if (!item.filename || !item.value || !item.label) {
                return;
            }
            var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
            var displayText = item.value + ' - ' + item.label;

            var op = document.createElement('button');
            op.type = 'button';
            op.className = 'fieldset-menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('phonePrefixes', countryCode + '.svg') : '';
            op.innerHTML = '<img class="fieldset-menu-option-image" src="' + flagUrl + '" alt=""><span class="fieldset-menu-option-text">' + displayText + '</span>';
            op.addEventListener('click', function(e) {
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
                applyOpenState(false);
                filterOptions('');
                onSelect(item.value, item.label, countryCode);
            });
            opts.appendChild(op);

            allOptions.push({
                element: op,
                valueLower: String(item.value || '').toLowerCase(),
                labelLower: String(item.label || '').toLowerCase(),
                labelWords: String(item.label || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean)
            });
        });

        // Set initial value
        if (initialValue) {
            setValue(initialValue);
        }

        // Data must be loaded BEFORE building menu (via FieldsetBuilder.setPicklist)
        // If data isn't loaded, menu will be empty - this is expected behavior

        // Called when menu closes externally - revert to selected value
        menu.__menuOnClose = function() {
            setValue(selectedCode);
            filterOptions('');
        };

        // Register with MenuManager
        MenuManager.register(menu);

        if (btn) {
            btn.addEventListener('click', function(e) {
                if (e) e.stopPropagation();
                if (!menu.classList.contains('fieldset-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }

        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            applyOpenState(true);
            this.select();
        });

        btnInput.addEventListener('input', function() {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('fieldset-menu--open')) applyOpenState(true);
        });

        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('fieldset-menu--open')) {
                menuArrowKeyNav(e, opts, '.fieldset-menu-option', function(opt) { opt.click(); });
            }
        });

        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('fieldset-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('fieldset-menu--open')) {
                applyOpenState(false);
            } else {
                MenuManager.closeAll(menu);
                applyOpenState(true);
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
   COUNTRY (2-letter code + flag)
   Pattern: copied from CurrencyComponent.buildCompactMenu (fieldset-menu combobox)
   ============================================================================ */

const CountryComponent = (function(){
    
    // Data loaded from database - no hardcoded fallback
    var countryData = [];
    var dataLoaded = false;
    
    function getData() {
        return countryData;
    }
    
    function setData(data) {
        countryData = data || [];
        dataLoaded = true;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Load country data from database via gateway
    function loadFromDatabase() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.dropdown_options && res.dropdown_options.country) {
                    countryData = res.dropdown_options.country;
                    dataLoaded = true;
                }
                return countryData;
            });
    }
    
    // Build a country menu (full width, shows code + label)
    function buildMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var initialValue = options.initialValue || null;
        var selectedCode = initialValue;
        
        var menu = document.createElement('div');
        menu.className = 'fieldset-menu fieldset-country-menu';
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="fieldset-menu-button"><img class="fieldset-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="fieldset-menu-button-input" placeholder="Select country" autocomplete="off"><span class="fieldset-menu-button-arrow">▼</span></div><div class="fieldset-menu-options"></div>';
        
        var btn = menu.querySelector('.fieldset-menu-button');
        var opts = menu.querySelector('.fieldset-menu-options');
        var btnImg = menu.querySelector('.fieldset-menu-button-image');
        var btnInput = menu.querySelector('.fieldset-menu-button-input');
        var arrow = menu.querySelector('.fieldset-menu-button-arrow');
        
        function applyOpenState(isOpen) {
            menu.classList.toggle('fieldset-menu--open', !!isOpen);
            if (btn) btn.classList.toggle('fieldset-menu-button--open', !!isOpen);
            if (arrow) arrow.classList.toggle('fieldset-menu-button-arrow--open', !!isOpen);
            if (opts) opts.classList.toggle('fieldset-menu-options--open', !!isOpen);
        }
        
        // Required by MenuManager (strict)
        menu.__menuIsOpen = function() {
            return menu.classList.contains('fieldset-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Store all option elements for filtering
        var allOptions = [];
        
        function setValue(code) {
            var found = countryData.find(function(item) {
                return item.value === code;
            });
            if (!found && !code) {
                // Clear the input if no code
                btnImg.src = '';
                btnImg.style.display = 'none';
                btnInput.value = '';
                selectedCode = null;
                try { menu.dataset.value = ''; } catch (e0) {}
                return;
            }
            if (found) {
                var filename = found.filename ? String(found.filename) : '';
                if (filename) {
                    btnImg.src = window.App.getImageUrl('countries', filename);
                    btnImg.style.display = 'block';
                } else {
                    btnImg.src = '';
                    btnImg.style.display = 'none';
                }
                btnInput.value = (found.value || '').toUpperCase() + ' - ' + (found.label || '');
                selectedCode = code;
                try { menu.dataset.value = String(code || '').toLowerCase(); } catch (e1) {}
            }
        }
        
        function filterOptions(searchText) {
            var search = String(searchText || '').toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = menuFilterMatch(optData, search);
                optData.element.style.display = matches ? '' : 'none';
            });
        }
        
        // Build options
        countryData.forEach(function(item) {
            if (!item || !item.filename || !item.value || !item.label) return;
            var code = String(item.value || '').toLowerCase();
            var displayText = code.toUpperCase() + ' - ' + item.label;
            
            var op = document.createElement('div');
            op.className = 'fieldset-menu-option';
            var flagUrl = window.App.getImageUrl('countries', item.filename);
            op.innerHTML = '<img class="fieldset-menu-option-image" src="' + flagUrl + '" alt=""><span class="fieldset-menu-option-text">' + displayText + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = flagUrl;
                btnImg.style.display = 'block';
                btnInput.value = displayText;
                selectedCode = code;
                try { menu.dataset.value = String(code || '').toLowerCase(); } catch (e2) {}
                applyOpenState(false);
                filterOptions('');
                onSelect(code, item.label, item.filename);
                // Let parent fieldsets/forms react (required/completion checks).
                try { menu.dispatchEvent(new Event('change', { bubbles: true })); } catch (e3) {}
            };
            opts.appendChild(op);
            
            allOptions.push({
                element: op,
                valueLower: String(code || '').toLowerCase(),
                labelLower: String(item.label || '').toLowerCase(),
                labelWords: String(item.label || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean)
            });
        });
        
        if (initialValue) {
            setValue(initialValue);
        }
        
        // Called when menu closes externally - revert to selected value
        menu.__menuOnClose = function() {
            setValue(selectedCode);
            filterOptions('');
        };
        
        MenuManager.register(menu);
        
        if (btn) {
            btn.addEventListener('click', function(e) {
                if (e) e.stopPropagation();
                if (!menu.classList.contains('fieldset-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }
        
        btnInput.addEventListener('focus', function(e) {
            e.stopPropagation();
            MenuManager.closeAll(menu);
            applyOpenState(true);
            this.select();
        });
        
        btnInput.addEventListener('input', function() {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('fieldset-menu--open')) applyOpenState(true);
        });
        
        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('fieldset-menu--open')) {
                menuArrowKeyNav(e, opts, '.fieldset-menu-option', function(opt) { opt.click(); });
            }
        });
        
        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('fieldset-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });
        
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('fieldset-menu--open')) {
                applyOpenState(false);
            } else {
                MenuManager.closeAll(menu);
                applyOpenState(true);
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
        buildMenu: buildMenu
    };
})();

/* ============================================================================
   MEMBER AUTH FIELDSETS (Register + Profile)
   Uses DB-driven fieldsets (labels/tooltips/placeholders) via FieldsetBuilder.
   ============================================================================ */

const MemberAuthFieldsetsComponent = (function(){
    var fieldsetMap = null;
    var loadPromise = null;

    function loadFromDatabase() {
        if (loadPromise) return loadPromise;
        loadPromise = fetch('/gateway.php?action=get-form')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                var fs = res && res.formData && Array.isArray(res.formData.fieldsets) ? res.formData.fieldsets : [];
                fieldsetMap = {};
                fs.forEach(function(f) {
                    var k = (f && (f.fieldset_key || f.key || f.fieldsetKey)) ? String(f.fieldset_key || f.key || f.fieldsetKey).trim() : '';
                    if (!k) return;
                    fieldsetMap[k] = f;
                });
                return fieldsetMap;
            })
            .catch(function(err) {
                console.warn('[MemberAuthFieldsetsComponent] Failed to load fieldsets', err);
                fieldsetMap = {};
                return fieldsetMap;
            });
        return loadPromise;
    }

    function getFieldset(key) {
        if (!fieldsetMap) return null;
        return fieldsetMap[key] || null;
    }

    // Wrap a host element (like AvatarPicker/Country menu) in a DB-driven fieldset label.
    function wrapHostInFieldset(fieldsetKey, hostEl, options) {
        options = options || {};
        var required = !!options.required;

        var fs = getFieldset(fieldsetKey) || {};
        var name = fs.fieldset_name || fs.name || fieldsetKey;
        var tooltip = fs.fieldset_tooltip || fs.tooltip || '';

        var wrap = document.createElement('div');
        wrap.className = 'fieldset';
        if (typeof fieldsetKey === 'string' && fieldsetKey) wrap.dataset.fieldsetKey = fieldsetKey;
        if (window.FieldsetBuilder && typeof FieldsetBuilder.buildLabel === 'function') {
            wrap.appendChild(FieldsetBuilder.buildLabel(String(name || ''), tooltip || '', null, null));
        }
        if (hostEl) wrap.appendChild(hostEl);

        // Required + complete state for host-wrapped components (avatar, country).
        try { wrap.dataset.required = required ? 'true' : 'false'; } catch (e0) {}
        var requiredStar = wrap.querySelector('.fieldset-label-required');
        if (requiredStar && !required) {
            requiredStar.style.display = 'none';
        }

        function computeComplete() {
            if (!required) return true;
            if (fieldsetKey === 'country') {
                var menu = wrap.querySelector('.fieldset-country-menu');
                var code = menu && menu.dataset ? String(menu.dataset.value || '').trim() : '';
                return !!code;
            }
            if (fieldsetKey === 'avatar') {
                var host = hostEl || wrap.querySelector('.component-avatarpicker') || null;
                // AvatarPicker writes dataset.complete on the host element we pass in.
                var c = host && host.dataset ? String(host.dataset.complete || '') : '';
                return c === 'true';
            }
            return false;
        }

        function setCompleteState(isComplete) {
            var complete = !!isComplete;
            try { wrap.dataset.complete = complete ? 'true' : 'false'; } catch (e1) {}
            if (requiredStar && requiredStar.style.display !== 'none') {
                requiredStar.classList.toggle('fieldset-label-required--complete', complete);
            }
            try { wrap.dispatchEvent(new CustomEvent('fieldset:validity-change', { bubbles: true })); } catch (e2) {}
        }

        // Initial state + react to internal changes from wrapped component.
        setCompleteState(computeComplete());
        wrap.addEventListener('change', function() { setCompleteState(computeComplete()); }, true);
        wrap.addEventListener('input', function() { setCompleteState(computeComplete()); }, true);

        return wrap;
    }

    function renderRegister(containerEl, options) {
        options = options || {};
        if (!containerEl) throw new Error('MemberAuthFieldsetsComponent.renderRegister: containerEl is required');
        if (!window.FieldsetBuilder || typeof FieldsetBuilder.buildFieldset !== 'function') {
            throw new Error('MemberAuthFieldsetsComponent.renderRegister: FieldsetBuilder is required');
        }

        var avatarHost = options.avatarHost || null;   // existing element, will be moved into container
        var countryHost = options.countryHost || null; // existing element, will be moved into container

        return loadFromDatabase().then(function() {
            containerEl.innerHTML = '';

            function addFieldset(fieldsetKey, patchInput) {
                var fd = getFieldset(fieldsetKey);
                if (!fd) return null;
                // Registration rule: all auth fieldsets are required.
                var fdReq = Object.assign({}, fd, { required: true, is_required: true });
                var fieldset = FieldsetBuilder.buildFieldset(fdReq, {
                    idPrefix: 'memberRegister',
                    fieldIndex: 0,
                    container: containerEl
                });
                containerEl.appendChild(fieldset);
                var input = fieldset.querySelector('input, textarea, select');
                if (typeof patchInput === 'function') patchInput(input || null);
                return { fieldset: fieldset, input: input || null };
            }

            var username = addFieldset('username', function(el) {
                if (!el) return;
                el.id = 'member-register-name';
                el.name = 'registerName';
                el.autocomplete = 'name';
            });

            if (avatarHost) containerEl.appendChild(wrapHostInFieldset('avatar', avatarHost, { required: true }));

            var email = addFieldset('account_email', function(el) {
                if (!el) return;
                el.id = 'member-register-email';
                el.name = 'registerEmail';
                el.autocomplete = 'email';
            });

            var password = addFieldset('password', function(el) {
                if (!el) return;
                el.id = 'member-register-password';
                el.name = 'registerPassword';
                el.autocomplete = 'new-password';
            });

            var confirm = addFieldset('confirm-password', function(el) {
                if (!el) return;
                el.id = 'member-register-confirm';
                el.name = 'registerConfirm';
                el.autocomplete = 'new-password';
            });

            if (countryHost) containerEl.appendChild(wrapHostInFieldset('country', countryHost, { required: true }));

            return {
                usernameInput: username ? username.input : null,
                emailInput: email ? email.input : null,
                passwordInput: password ? password.input : null,
                confirmInput: confirm ? confirm.input : null
            };
        });
    }

    function renderProfile(containerEl, options) {
        options = options || {};
        if (!containerEl) throw new Error('MemberAuthFieldsetsComponent.renderProfile: containerEl is required');
        if (!window.FieldsetBuilder || typeof FieldsetBuilder.buildFieldset !== 'function') {
            throw new Error('MemberAuthFieldsetsComponent.renderProfile: FieldsetBuilder is required');
        }

        var avatarHost = options.avatarHost || null; // existing element, will be moved into container
        var usernameValue = typeof options.usernameValue === 'string' ? options.usernameValue : '';

        return loadFromDatabase().then(function() {
            containerEl.innerHTML = '';

            function addFieldset(fieldsetKey, patchInput) {
                var fd = getFieldset(fieldsetKey);
                if (!fd) return null;
                var fieldset = FieldsetBuilder.buildFieldset(fd, {
                    idPrefix: 'memberProfile',
                    fieldIndex: 0,
                    container: containerEl
                });
                containerEl.appendChild(fieldset);
                var input = fieldset.querySelector('input, textarea, select');
                if (typeof patchInput === 'function') patchInput(input || null);
                return { fieldset: fieldset, input: input || null };
            }

            if (avatarHost) containerEl.appendChild(wrapHostInFieldset('avatar', avatarHost, { required: false }));

            var username = addFieldset('username', function(el) {
                if (!el) return;
                el.id = 'member-profile-edit-name';
                el.classList.add('member-profile-edit-name-input');
                el.autocomplete = 'name';
                el.value = usernameValue || '';
            });

            // Move the 3-dot "more" button to the right of the username input (same layout as before fieldsets).
            // The button/menu are part of the member panel UI, but the username layout is built here.
            try {
                if (username && username.fieldset && username.input) {
                    var moreBtn = document.getElementById('member-profile-more-btn');
                    var moreMenu = document.getElementById('member-profile-more-menu');
                    if (moreBtn) {
                        // If it's already positioned correctly (inside the username row), do nothing.
                        var currentRow = username.input.closest ? username.input.closest('.member-profile-edit-row') : null;
                        if (currentRow && currentRow.contains(moreBtn)) {
                            // Ensure the menu is also inside the row if present.
                            if (moreMenu && !currentRow.contains(moreMenu)) currentRow.appendChild(moreMenu);
                        } else {
                            var oldRow = moreBtn.closest ? moreBtn.closest('.member-profile-edit-row') : null;

                            var row = document.createElement('div');
                            row.className = 'member-profile-edit-row';

                            // Replace the raw input with the row wrapper (row sits directly under the label).
                            var inputEl = username.input;
                            var parent = inputEl.parentNode;
                            if (parent) {
                                parent.insertBefore(row, inputEl);
                                row.appendChild(inputEl);
                                row.appendChild(moreBtn);
                                if (moreMenu) row.appendChild(moreMenu);
                            }

                            // Remove the old row container (it was only a placeholder in the HTML).
                            if (oldRow && oldRow !== row && oldRow.parentNode) {
                                oldRow.parentNode.removeChild(oldRow);
                            }
                        }
                    }
                }
            } catch (e) {
                // If anything about the more button structure changes, fail silently (no layout break).
            }

            var newPw = addFieldset('new-password', function(el) {
                if (!el) return;
                el.id = 'member-profile-edit-password';
                el.autocomplete = 'new-password';
                el.value = '';
            });

            var confirm = addFieldset('confirm-password', function(el) {
                if (!el) return;
                el.id = 'member-profile-edit-confirm';
                el.autocomplete = 'new-password';
                el.value = '';
            });

            return {
                usernameInput: username ? username.input : null,
                newPasswordInput: newPw ? newPw.input : null,
                confirmInput: confirm ? confirm.input : null
            };
        });
    }

    return {
        loadFromDatabase: loadFromDatabase,
        renderRegister: renderRegister,
        renderProfile: renderProfile
    };
})();


/* ============================================================================
   ICON PICKER COMPONENT
   
   IMAGE SYNC SYSTEM (Category Icons):
   This component uses the category_icons table.
   The category_icons table serves as a "basket" of all available filenames for instant menu loading.
   
   1. Menu opens instantly with images from database basket (category_icons table)
   2. API call fetches current file list from Bunny CDN folder_category_icons in background
   3. New images from API are appended to menu (if not already in database basket)
   
   NO API CALLS AT STARTUP - all API calls happen only when menu opens.
   Database sync is handled by syncAllPicklists() when admin panel opens (ALL table types synced together).
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

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-iconpicker--open', !!isOpen);
            button.classList.toggle('component-iconpicker-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-iconpicker-button-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-iconpicker-options--open', !!isOpen);
        }
        menu.__menuIsOpen = function() { return menu.classList.contains('component-iconpicker--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
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
                        applyOpenState(false);
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
            var isOpen = menu.classList.contains('component-iconpicker--open');
            if (isOpen) {
                applyOpenState(false);
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Open menu immediately
                applyOpenState(true);
                
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
                var btnBase = inst.geolocateBtnBaseClass;
                inst.geolocateBtn.classList.add(btnBase + '--loading');
                inst.geolocateBtn.classList.remove(btnBase + '--active');
            }
            if (inst.geolocateIcon) {
                var iconBase = inst.geolocateIconBaseClass;
                inst.geolocateIcon.classList.add(iconBase + '--loading');
            }
        });
    }
    
    // Sync all geolocate buttons to active state
    function setAllGeolocateActive() {
        geolocateActive = true;
        instances.forEach(function(inst) {
            if (inst.geolocateBtn) {
                var btnBase = inst.geolocateBtnBaseClass;
                inst.geolocateBtn.classList.remove(btnBase + '--loading');
                inst.geolocateBtn.classList.add(btnBase + '--active');
            }
            if (inst.geolocateIcon) {
                var iconBase = inst.geolocateIconBaseClass;
                inst.geolocateIcon.classList.remove(iconBase + '--loading');
            }
        });
    }
    
    // Clear loading state from all geolocate buttons
    function clearAllGeolocateLoading() {
        instances.forEach(function(inst) {
            if (inst.geolocateBtn) {
                var btnBase = inst.geolocateBtnBaseClass;
                inst.geolocateBtn.classList.remove(btnBase + '--loading');
            }
            if (inst.geolocateIcon) {
                var iconBase = inst.geolocateIconBaseClass;
                inst.geolocateIcon.classList.remove(iconBase + '--loading');
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
        geolocateBtn.innerHTML = '<span class="' + prefix + '-geolocate-icon" aria-hidden="true"></span>';
        geolocateBtn.title = 'Find my location';
        row.appendChild(geolocateBtn);
        var geolocateIcon = geolocateBtn.querySelector('.' + prefix + '-geolocate-icon');
        
        // Compass button
        // NOTE: Compass needs to support multi-color artwork (eg red/blue needle), so it uses <img>,
        // not a CSS mask (masks flatten to a single color).
        var compassBtn = document.createElement('button');
        compassBtn.type = 'button';
        compassBtn.className = prefix + '-compass';
        compassBtn.innerHTML = '<img class="' + prefix + '-compass-img" alt="" style="display:none;">';
        compassBtn.title = 'Reset north';
        row.appendChild(compassBtn);
        
        containerEl.appendChild(row);
        
        var instance = {
            row: row,
            input: input,
            clearBtn: clearBtn,
            dropdown: dropdown,
            geolocateBtn: geolocateBtn,
            geolocateIcon: geolocateIcon,
            geolocateBtnBaseClass: prefix + '-geolocate',
            geolocateIconBaseClass: prefix + '-geolocate-icon',
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
            var compassIcon = compassBtn.querySelector('.' + prefix + '-compass-icon, .' + prefix + '-compass-img');
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
            geolocateBtn.classList.add(prefix + '-geolocate--active');
        }
        
        instances.push(instance);

        // Apply system images if configured
        try {
            var sys = (window.App && typeof App.getState === 'function') ? (App.getState('system_images') || {}) : {};
            if (window.App && typeof App.getImageUrl === 'function' && sys) {
                var geoFilename = sys.icon_geolocate || '';
                var compassFilename = sys.icon_compass || '';
                
                var geoEl = geolocateBtn.querySelector('.' + prefix + '-geolocate-icon');
                var compassImg = compassBtn.querySelector('.' + prefix + '-compass-img');
                
                if (geoEl && geoFilename) {
                    var geoUrl = App.getImageUrl('systemImages', geoFilename);
                    geoEl.style.webkitMaskImage = 'url(' + geoUrl + ')';
                    geoEl.style.maskImage = 'url(' + geoUrl + ')';
                }
                
                // Compass uses <img> so multi-color icons are preserved.
                // Also avoid broken-image icons by only setting src after a successful load.
                if (compassImg && compassFilename) {
                    var compassUrl = App.getImageUrl('systemImages', compassFilename);
                    var testImg = new Image();
                    testImg.onload = function() {
                        compassImg.src = compassUrl;
                        compassImg.style.display = 'block';
                    };
                    testImg.onerror = function() {
                        // Leave hidden on error
                        compassImg.removeAttribute('src');
                        compassImg.style.display = 'none';
                    };
                    testImg.src = compassUrl;
                }
            }
        } catch (e) {
            // ignore
        }
        
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
     * @param {number} options.surchargePercent - Subcategory surcharge percentage (default: 0). Can be negative.
     * @param {boolean} options.isEvent - True for events with session dates
     * @param {number} options.locationCount - Number of locations (default: 1)
     * @param {Array<number>|null} options.eventVenueDays - For events: array of day counts per location (length must equal locationCount). Null = no dates yet.
     * @param {string} options.baseId - Base ID for form elements
     * @param {string} options.groupName - Radio group name
     * @param {Function} options.onSelect - Callback when option selected (optionId, days, price)
     * @returns {Object} Component instance with update methods
     */
    function create(containerEl, options) {
        options = options || {};
        var checkoutOptions = options.checkoutOptions || [];
        var currency = options.currency || null;
        var surchargePercent = (options.surchargePercent !== undefined && options.surchargePercent !== null)
            ? (parseFloat(options.surchargePercent) || 0)
            : 0;
        var isEvent = options.isEvent || false;
        var locationCount = options.locationCount !== undefined ? parseInt(options.locationCount, 10) : 1;
        if (!isFinite(locationCount) || locationCount < 1) locationCount = 1;
        var eventVenueDays = options.eventVenueDays !== undefined ? options.eventVenueDays : null;
        var baseId = options.baseId || 'checkout';
        var groupName = options.groupName || baseId + '-option';
        var onSelect = options.onSelect || function() {};

        // For member-facing checkout summary lines:
        // - Use digits for days (e.g. "31 days")
        // - Use words for number of locations (e.g. "one location", "three locations")
        function numberToWords(n) {
            var num = parseInt(n, 10) || 0;
            if (num < 0) return 'zero';

            var ones = [
                'zero','one','two','three','four','five','six','seven','eight','nine',
                'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'
            ];
            var tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

            function inner(x) {
                if (x < 20) return ones[x];
                if (x < 100) {
                    var t = Math.floor(x / 10);
                    var r = x % 10;
                    return tens[t] + (r ? '-' + ones[r] : '');
                }
                if (x < 1000) {
                    var h = Math.floor(x / 100);
                    var rem = x % 100;
                    return ones[h] + ' hundred' + (rem ? ' ' + inner(rem) : '');
                }
                if (x < 1000000) {
                    var th = Math.floor(x / 1000);
                    var remT = x % 1000;
                    return inner(th) + ' thousand' + (remT ? ' ' + inner(remT) : '');
                }
                return 'many';
            }

            return inner(num);
        }

        function buildLocationSummary(days, locCount) {
            var d = parseInt(days, 10) || 0;
            var L = parseInt(locCount, 10) || 1;
            if (L < 1) L = 1;
            var locWord = numberToWords(L);
            var locLabel = (L === 1) ? 'location' : 'locations';
            return d + ' days, ' + locWord + ' ' + locLabel;
        }
        
        function computeGeneralTotal(flagfall, basicRate, discountRate, days, locCount, surchargePct) {
            var d = parseInt(days, 10) || 0;
            var L = parseInt(locCount, 10) || 1;
            if (L < 1) L = 1;

            if (basicRate === null || !isFinite(basicRate)) {
                throw new Error('CheckoutOptionsComponent: checkout_basic_day_rate is required');
            }
            if (discountRate === null || !isFinite(discountRate)) {
                throw new Error('CheckoutOptionsComponent: checkout_discount_day_rate is required');
            }

            var baseRate = (d >= 365) ? discountRate : basicRate;

            var durationCharge = baseRate * d;
            var extraLocRate = discountRate;
            var extraLocCharge = (L > 1) ? ((L - 1) * extraLocRate * d) : 0;

            var variable = durationCharge + extraLocCharge;
            var total = (flagfall || 0) + (variable * (1 + (surchargePct || 0) / 100));
            return { total: total, days: d };
        }

        function computeEventTotal(flagfall, basicRate, discountRate, venueDays, locCount, surchargePct) {
            var L = parseInt(locCount, 10) || 1;
            if (L < 1) L = 1;
            if (!Array.isArray(venueDays) || venueDays.length !== L) {
                return { hasDates: false, total: (flagfall || 0), primaryDays: null };
            }
            // Require a date for each venue to avoid ambiguous pricing
            for (var i = 0; i < venueDays.length; i++) {
                var di = parseInt(venueDays[i], 10) || 0;
                if (di <= 0) return { hasDates: false, total: (flagfall || 0), primaryDays: null };
            }

            var maxDays = 0;
            var primaryIdx = 0;
            for (var i = 0; i < venueDays.length; i++) {
                var di = parseInt(venueDays[i], 10) || 0;
                if (di > maxDays) {
                    maxDays = di;
                    primaryIdx = i;
                }
            }
            if (maxDays <= 0) return { hasDates: false, total: (flagfall || 0), primaryDays: null };

            if (basicRate === null || !isFinite(basicRate)) {
                throw new Error('CheckoutOptionsComponent: checkout_basic_day_rate is required');
            }
            if (discountRate === null || !isFinite(discountRate)) {
                throw new Error('CheckoutOptionsComponent: checkout_discount_day_rate is required');
            }

            // Primary venue uses standard selection (B for <365, D for >=365)
            var primaryRate = null;
            if (maxDays >= 365) {
                primaryRate = discountRate;
            } else {
                primaryRate = basicRate;
            }
            var primaryCharge = primaryRate * maxDays;

            // Other venues always use discount day rate
            var otherRate = discountRate;
            var othersCharge = 0;
            for (var i = 0; i < venueDays.length; i++) {
                if (i === primaryIdx) continue;
                othersCharge += otherRate * (parseInt(venueDays[i], 10) || 0);
            }

            var variable = primaryCharge + othersCharge;
            var total = (flagfall || 0) + (variable * (1 + (surchargePct || 0) / 100));
            return { hasDates: true, total: total, primaryDays: maxDays };
        }
        
        var group = document.createElement('div');
        group.className = 'member-checkout-group';
        group.dataset.isEvent = isEvent ? 'true' : 'false';

        // Make the checkout wrapper behave like a required fieldset:
        // - No default selection
        // - Incomplete (red) until user selects an option
        try { containerEl.dataset.required = 'true'; } catch (e0) {}
        try { containerEl.dataset.complete = 'false'; } catch (e1) {}
        var requiredStar = containerEl ? containerEl.querySelector('.fieldset-label-required') : null;

        function setCompleteState(isComplete) {
            var complete = !!isComplete;
            try { containerEl.dataset.complete = complete ? 'true' : 'false'; } catch (e2) {}
            if (requiredStar && requiredStar.style.display !== 'none') {
                requiredStar.classList.toggle('fieldset-label-required--complete', complete);
            }
            try {
                containerEl.dispatchEvent(new CustomEvent('fieldset:validity-change', { bubbles: true }));
            } catch (e3) {}
        }

        function computeComplete() {
            // For events, if no radios are enabled (no dates yet), we are not complete.
            if (isEvent) {
                var anyEnabled = !!group.querySelector('input[type="radio"]:not(:disabled)');
                if (!anyEnabled) return false;
            }
            return !!group.querySelector('input[type="radio"]:checked');
        }

        function getEventDaysForRadio(radioEl) {
            if (!radioEl) return null;
            var card = radioEl.closest ? radioEl.closest('.member-checkout-option') : null;
            if (!card) return null;
            var flagfall = parseFloat(card.dataset.flagfall) || 0;
            var basicRate = card.dataset.basicRate !== '' ? parseFloat(card.dataset.basicRate) : null;
            var discountRate = card.dataset.discountRate !== '' ? parseFloat(card.dataset.discountRate) : null;
            var res = computeEventTotal(flagfall, basicRate, discountRate, eventVenueDays, locationCount, surchargePercent);
            return res && res.hasDates ? res.primaryDays : null;
        }
        
        if (!checkoutOptions || checkoutOptions.length === 0) {
            throw new Error('CheckoutOptionsComponent.create: checkoutOptions is empty');
        }
        
        var hasDates = isEvent ? (Array.isArray(eventVenueDays) && eventVenueDays.length === locationCount && eventVenueDays.every(function(d){ return (parseInt(d, 10) || 0) > 0; })) : true;
        
        checkoutOptions.forEach(function(option, optionIndex) {
            if (!option) {
                throw new Error('CheckoutOptionsComponent.create: checkoutOptions contains null/undefined option');
            }
            if (option.id === undefined || option.id === null || String(option.id).trim() === '') {
                throw new Error('CheckoutOptionsComponent.create: option.id is required');
            }
            if (!option.checkout_title || String(option.checkout_title).trim() === '') {
                throw new Error('CheckoutOptionsComponent.create: option.checkout_title is required for option id ' + String(option.id));
            }

            var flagfallPrice = (parseFloat(option.checkout_flagfall_price) || 0);
            var basicDayRate = option.checkout_basic_day_rate !== undefined && option.checkout_basic_day_rate !== null 
                ? parseFloat(option.checkout_basic_day_rate) : null;
            var discountDayRate = option.checkout_discount_day_rate !== undefined && option.checkout_discount_day_rate !== null 
                ? parseFloat(option.checkout_discount_day_rate) : null;
            if (basicDayRate === null || !isFinite(basicDayRate)) {
                throw new Error('CheckoutOptionsComponent.create: checkout_basic_day_rate is required for option id ' + String(option.id));
            }
            if (discountDayRate === null || !isFinite(discountDayRate)) {
                throw new Error('CheckoutOptionsComponent.create: checkout_discount_day_rate is required for option id ' + String(option.id));
            }

            var title = String(option.checkout_title).trim();
            var description = option.checkout_description ? String(option.checkout_description) : '';
            
            var card = document.createElement('label');
            card.className = 'member-checkout-option' + (hasDates ? '' : ' member-checkout-option--disabled');
            card.dataset.optionId = String(option.id);
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
                radio.value = String(option.id);
                radio.id = baseId + '-checkout-' + optionIndex;
                radio.dataset.optionId = String(option.id);
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
                    var res = computeEventTotal(flagfallPrice, basicDayRate, discountDayRate, eventVenueDays, locationCount, surchargePercent);
                    var primaryDays = res.primaryDays;
                    var price = res.total;
                    priceText.textContent = buildLocationSummary(primaryDays, locationCount) + ' — ' + (price > 0 ? currency + ' ' + price.toFixed(2) : 'Free');
                } else {
                    priceText.classList.add('member-checkout-price-display--disabled');
                    priceText.textContent = 'Select session dates for all locations for price';
                }
                priceSection.appendChild(priceText);
            } else {
                // General posts: Two duration radio options
                var durationBtns = document.createElement('div');
                durationBtns.className = 'member-checkout-duration-buttons';
                
                var res30 = computeGeneralTotal(flagfallPrice, basicDayRate, discountDayRate, 30, locationCount, surchargePercent);
                var res365 = computeGeneralTotal(flagfallPrice, basicDayRate, discountDayRate, 365, locationCount, surchargePercent);
                var price30 = res30.total;
                var price365 = res365.total;
                
                // 30 days option
                var label30 = document.createElement('label');
                label30.className = 'member-checkout-duration-option';
                var radio30 = document.createElement('input');
                radio30.type = 'radio';
                radio30.className = 'member-checkout-duration-radio';
                radio30.name = groupName;
                radio30.value = String(option.id) + '-30';
                radio30.dataset.optionId = String(option.id);
                radio30.dataset.days = '30';
                radio30.dataset.price = price30.toFixed(2);
                radio30.required = true;
                var text30 = document.createElement('span');
                text30.className = 'member-checkout-duration-text';
                text30.textContent = buildLocationSummary(30, locationCount) + ' — ' + (price30 > 0 ? currency + ' ' + price30.toFixed(2) : 'Free');
                label30.appendChild(radio30);
                label30.appendChild(text30);
                
                // 365 days option
                var label365 = document.createElement('label');
                label365.className = 'member-checkout-duration-option';
                var radio365 = document.createElement('input');
                radio365.type = 'radio';
                radio365.className = 'member-checkout-duration-radio';
                radio365.name = groupName;
                radio365.value = String(option.id) + '-365';
                radio365.dataset.optionId = String(option.id);
                radio365.dataset.days = '365';
                radio365.dataset.price = price365.toFixed(2);
                radio365.required = true;
                var text365 = document.createElement('span');
                text365.className = 'member-checkout-duration-text';
                text365.textContent = buildLocationSummary(365, locationCount) + ' — ' + (price365 > 0 ? currency + ' ' + price365.toFixed(2) : 'Free');
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
        
        function syncSelectedStyles() {
            // Selected option cards
            group.querySelectorAll('.member-checkout-option').forEach(function(card) {
                var checked = false;
                var r = card.querySelector('input[type="radio"]');
                if (r && r.checked) checked = true;
                if (!checked) {
                    // General posts: any checked duration inside the card counts as selected
                    var anyChecked = card.querySelector('input[type="radio"]:checked');
                    checked = !!anyChecked;
                }
                card.classList.toggle('member-checkout-option--selected', checked);
            });
            
            // Selected duration buttons (general posts)
            group.querySelectorAll('.member-checkout-duration-option').forEach(function(label) {
                var r = label.querySelector('input[type="radio"]');
                label.classList.toggle('member-checkout-duration-option--selected', !!(r && r.checked));
            });
        }
        
        // Selection change handler
        group.addEventListener('change', function(e) {
            if (e.target.type === 'radio') {
                syncSelectedStyles();
                var optionId = e.target.dataset.optionId;
                var days = null;
                if (e.target.dataset && e.target.dataset.days) {
                    days = parseInt(e.target.dataset.days, 10);
                } else if (isEvent) {
                    days = getEventDaysForRadio(e.target);
                }
                var price = e.target.dataset.price ? parseFloat(e.target.dataset.price) : null;
                onSelect(optionId, days, price);
                setCompleteState(computeComplete());
            }
        });
        syncSelectedStyles();
        setCompleteState(computeComplete());
        
        containerEl.appendChild(group);
        
        // Return component instance with update method for reactive price updates
        return {
            element: group,
            
            // Update prices when event session dates change
            updateContext: function(next) {
                next = next || {};
                if (next.surchargePercent !== undefined && next.surchargePercent !== null) {
                    surchargePercent = parseFloat(next.surchargePercent) || 0;
                }
                if (next.locationCount !== undefined && next.locationCount !== null) {
                    locationCount = parseInt(next.locationCount, 10) || 1;
                    if (locationCount < 1) locationCount = 1;
                }
                if (next.eventVenueDays !== undefined) {
                    eventVenueDays = next.eventVenueDays;
                }

                if (isEvent) {
                    var nowHasDates = Array.isArray(eventVenueDays) && eventVenueDays.length === locationCount && eventVenueDays.every(function(d){ return (parseInt(d, 10) || 0) > 0; });
                group.querySelectorAll('.member-checkout-option').forEach(function(card, idx) {
                    var radio = card.querySelector('input[type="radio"]');
                    var priceDisplay = card.querySelector('.member-checkout-price-display');
                    if (nowHasDates) {
                        card.classList.remove('member-checkout-option--disabled');
                        if (radio) {
                            radio.disabled = false;
                            // Store computed days so selection handler can read it without globals.
                            try {
                                var flagfall = parseFloat(card.dataset.flagfall) || 0;
                                var basicRate = card.dataset.basicRate !== '' ? parseFloat(card.dataset.basicRate) : null;
                                var discountRate = card.dataset.discountRate !== '' ? parseFloat(card.dataset.discountRate) : null;
                                var res = computeEventTotal(flagfall, basicRate, discountRate, eventVenueDays, locationCount, surchargePercent);
                                radio.dataset.days = (res && res.hasDates) ? String(res.primaryDays || '') : '';
                            } catch (e0) {}
                        }
                        if (priceDisplay) {
                            priceDisplay.classList.remove('member-checkout-price-display--disabled');
                            var flagfall = parseFloat(card.dataset.flagfall) || 0;
                            var basicRate = card.dataset.basicRate !== '' ? parseFloat(card.dataset.basicRate) : null;
                            var discountRate = card.dataset.discountRate !== '' ? parseFloat(card.dataset.discountRate) : null;
                            var curr = card.dataset.currency || null;
                                var res = computeEventTotal(flagfall, basicRate, discountRate, eventVenueDays, locationCount, surchargePercent);
                                priceDisplay.textContent = buildLocationSummary(res.primaryDays, locationCount) + ' — ' + (res.total > 0 ? curr + ' ' + res.total.toFixed(2) : 'Free');
                        }
                    } else {
                        card.classList.add('member-checkout-option--disabled');
                        if (radio) {
                            radio.disabled = true;
                            radio.checked = false;
                            try { delete radio.dataset.days; } catch (e1) {}
                        }
                        if (priceDisplay) {
                                priceDisplay.classList.add('member-checkout-price-display--disabled');
                                priceDisplay.textContent = 'Select session dates for all locations for price';
                        }
                    }
                });
                } else {
                    // General: update 30/365 prices and radio datasets based on locations + surcharge
                    group.querySelectorAll('.member-checkout-option').forEach(function(card) {
                        var flagfall = parseFloat(card.dataset.flagfall) || 0;
                        var basicRate = card.dataset.basicRate !== '' ? parseFloat(card.dataset.basicRate) : null;
                        var discountRate = card.dataset.discountRate !== '' ? parseFloat(card.dataset.discountRate) : null;
                        var curr = card.dataset.currency || null;

                        var r30 = card.querySelector('input[type="radio"][data-days="30"]');
                        var t30 = r30 && r30.parentNode ? r30.parentNode.querySelector('.member-checkout-duration-text') : null;
                        var r365 = card.querySelector('input[type="radio"][data-days="365"]');
                        var t365 = r365 && r365.parentNode ? r365.parentNode.querySelector('.member-checkout-duration-text') : null;

                        var res30 = computeGeneralTotal(flagfall, basicRate, discountRate, 30, locationCount, surchargePercent);
                        var res365 = computeGeneralTotal(flagfall, basicRate, discountRate, 365, locationCount, surchargePercent);
                        if (r30) r30.dataset.price = res30.total.toFixed(2);
                        if (t30) t30.textContent = buildLocationSummary(30, locationCount) + ' — ' + (res30.total > 0 ? curr + ' ' + res30.total.toFixed(2) : 'Free');
                        if (r365) r365.dataset.price = res365.total.toFixed(2);
                        if (t365) t365.textContent = buildLocationSummary(365, locationCount) + ' — ' + (res365.total > 0 ? curr + ' ' + res365.total.toFixed(2) : 'Free');
                    });
                }
                syncSelectedStyles();
                setCompleteState(computeComplete());
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
   This component uses the system_images table.
   The system_images table serves as a "basket" of all available filenames for instant menu loading.
   
   1. Menu opens instantly with images from database basket (system_images table)
   2. API call fetches current file list from Bunny CDN folder_system_images in background
   3. New images from API are appended to menu (if not already in database basket)
   
   NO API CALLS AT STARTUP - all API calls happen only when menu opens.
   Database sync is handled by syncAllPicklists() when admin panel opens (ALL table types synced together).
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
    // options:
    //   - onSelect(imagePath)
    //   - databaseValue (filename or full path)
    //   - folderPath (optional override; uses this folder instead of folder_system_images)
    function buildPicker(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var databaseValue = options.databaseValue || null;
        var folderPathOverride = options.folderPath || null;
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

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-systemimagepicker--open', !!isOpen);
            button.classList.toggle('component-systemimagepicker-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-systemimagepicker-button-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-systemimagepicker-options--open', !!isOpen);
        }
        menu.__menuIsOpen = function() { return menu.classList.contains('component-systemimagepicker--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        // Set button if database value exists (NO API CALL - just construct URL from folder + filename)
        // Ensure folder and system_images are loaded from settings if not already set
        var loadPromise = (systemImagesData && (folderPathOverride || imageFolder)) ? Promise.resolve() : loadFolderFromSettings();
        loadPromise.then(function() {
            if (databaseValue) {
                var databaseFilename = getFilename(databaseValue);
                var fullImageUrl = null;
                
                var effectiveFolder = folderPathOverride || imageFolder;
                if (effectiveFolder) {
                    // Construct URL from folder + filename (no API call needed for button display)
                    var folder = effectiveFolder.endsWith('/') ? effectiveFolder : effectiveFolder + '/';
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
                        applyOpenState(false);
                        onSelect(imagePath);
                    };
                    optionsDiv.appendChild(option);
                });
            }
        }
        
        // Toggle menu
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('component-systemimagepicker--open');
            if (isOpen) {
                applyOpenState(false);
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Open menu immediately
                applyOpenState(true);
                
                // Show database images instantly (menu is now open and interactive)
                var effectiveFolder2 = folderPathOverride || imageFolder;
                if (!systemImagesBasket) {
                    loadFolderFromSettings().then(function() {
                        // Update with database images now that they're loaded
                        var updatedDbImages = getDatabaseImages(effectiveFolder2);
                        renderImageOptions(updatedDbImages, true);
                    });
                } else {
                    var dbImages = getDatabaseImages(effectiveFolder2);
                    renderImageOptions(dbImages, true);
                }
                
                // Load API in background and append new images (always runs)
                loadImagesFromFolder(effectiveFolder2, function(updatedImageList) {
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
   AMENITIES MENU COMPONENT
   
   Multi-select menu for choosing amenities in formbuilder edit panel.
   Similar to SystemImagePickerComponent but with checkboxes for multiple selection.
   ============================================================================ */

const AmenitiesMenuComponent = (function(){
    
    var amenitiesData = null; // Amenities from amenities table (fetched via get-admin-settings API)
    
    // Load amenities from amenities table (via get-admin-settings API)
    function loadAmenities() {
        if (amenitiesData) {
            return Promise.resolve(amenitiesData);
        }
        
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.dropdown_options && res.dropdown_options.amenity && Array.isArray(res.dropdown_options.amenity)) {
                    amenitiesData = res.dropdown_options.amenity;
                } else {
                    amenitiesData = [];
                }
                return amenitiesData;
            })
            .catch(function(err) {
                console.warn('Failed to load amenities:', err);
                amenitiesData = [];
                return [];
            });
    }
    
    // Build amenities menu with checkboxes - EXACT copy of SystemImagePickerComponent structure
    // options: { onSelect, selectedAmenities }
    // onSelect: function(selectedAmenities) - called when selection changes
    // selectedAmenities: array of amenity values that are currently selected
    function buildMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var selectedAmenities = options.selectedAmenities || [];
        
        var menu = document.createElement('div');
        menu.className = 'component-amenitiespicker';
        
        // Button - EXACT same structure as SystemImagePickerComponent
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-amenitiespicker-button';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-amenitiespicker-button-text';
        buttonText.textContent = 'Select amenities...';
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-amenitiespicker-button-arrow';
        buttonArrow.textContent = '▼';
        
        button.appendChild(buttonText);
        button.appendChild(buttonArrow);
        menu.appendChild(button);
        
        // Options dropdown - EXACT same structure
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-amenitiespicker-options';
        menu.appendChild(optionsDiv);

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-amenitiespicker--open', !!isOpen);
            button.classList.toggle('component-amenitiespicker-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-amenitiespicker-button-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-amenitiespicker-options--open', !!isOpen);
        }
        menu.__menuIsOpen = function() { return menu.classList.contains('component-amenitiespicker--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Register with MenuManager
        MenuManager.register(menu);
        
        // Update button text based on selected count
        function updateButtonText() {
            var count = selectedAmenities.length;
            if (count === 0) {
                buttonText.textContent = 'Select amenities...';
            } else if (count === 1) {
                buttonText.textContent = '1 amenity selected';
            } else {
                buttonText.textContent = count + ' amenities selected';
            }
        }
        
        // Render amenity options - EXACT same structure as SystemImagePickerComponent, just add checkbox
        function renderAmenityOptions(amenities) {
            optionsDiv.innerHTML = '';
            
            if (!amenities || amenities.length === 0) {
                var msg = document.createElement('div');
                msg.className = 'component-amenitiespicker-error';
                msg.innerHTML = 'No amenities found.<br>Please set amenities folder in Admin Settings.';
                optionsDiv.appendChild(msg);
                return;
            }
            
            amenities.forEach(function(amenity) {
                var option = document.createElement('button');
                option.type = 'button';
                option.className = 'component-amenitiespicker-option';
                option.setAttribute('data-amenity-value', amenity.value || '');
                
                // Checkbox - added to match amenities requirement
                var checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'component-amenitiespicker-option-checkbox';
                checkbox.checked = selectedAmenities.indexOf(amenity.value) !== -1;
                
                // Icon - EXACT same structure as SystemImagePickerComponent
                var optImg = document.createElement('img');
                optImg.className = 'component-amenitiespicker-option-image';
                if (amenity.filename && window.App) {
                    var iconUrl = window.App.getImageUrl('amenities', amenity.filename);
                    optImg.src = iconUrl;
                }
                optImg.alt = '';
                
                // Text - EXACT same structure as SystemImagePickerComponent
                var optText = document.createElement('span');
                optText.className = 'component-amenitiespicker-option-text';
                optText.textContent = amenity.value || amenity.label || '';
                
                option.appendChild(checkbox);
                option.appendChild(optImg);
                option.appendChild(optText);
                
                // Make checkbox display-only (non-interactive)
                checkbox.style.pointerEvents = 'none';
                
                // Update visual state based on checkbox
                function updateOptionState() {
                    optImg.classList.toggle('component-amenitiespicker-option-image--selected', !!checkbox.checked);
                }
                updateOptionState();
                
                // Single click handler on entire row
                option.onclick = function(ev) {
                    ev.stopPropagation();
                    // Toggle checkbox (display only)
                    checkbox.checked = !checkbox.checked;
                    var isChecked = checkbox.checked;
                    
                    updateOptionState();
                    
                    if (isChecked) {
                        // Add to selected
                        if (selectedAmenities.indexOf(amenity.value) === -1) {
                            selectedAmenities.push(amenity.value);
                        }
                    } else {
                        // Remove from selected
                        var index = selectedAmenities.indexOf(amenity.value);
                        if (index !== -1) {
                            selectedAmenities.splice(index, 1);
                        }
                    }
                    updateButtonText();
                    onSelect(selectedAmenities.slice()); // Pass copy of array
                };
                
                optionsDiv.appendChild(option);
            });
        }
        
        // Initialize button text
        updateButtonText();
        
        // Toggle menu - EXACT same structure as SystemImagePickerComponent
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('component-amenitiespicker--open');
            if (isOpen) {
                applyOpenState(false);
            } else {
                // Close all other menus first
                MenuManager.closeAll(menu);
                // Open menu immediately
                applyOpenState(true);
                
                // Load amenities and render
                loadAmenities().then(function(amenities) {
                    renderAmenityOptions(amenities);
                });
            }
        };
        
        return {
            element: menu,
            getSelected: function() {
                return selectedAmenities.slice(); // Return copy
            },
            setSelected: function(amenities) {
                selectedAmenities = amenities || [];
                updateButtonText();
                // Re-render if menu is open
                if (menu.classList.contains('component-amenitiespicker--open')) {
                    loadAmenities().then(function(amenitiesList) {
                        renderAmenityOptions(amenitiesList);
                    });
                }
            }
        };
    }
    
    return {
        loadAmenities: loadAmenities,
        buildMenu: buildMenu
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


/* ============================================================================
   BOTTOM SLACK
   Prevents "clicked button flies away" when collapsible content above closes.
   Self-contained: injects required slack CSS and creates the slack element if missing.
   ============================================================================ */

const BottomSlack = (function() {
    var STYLE_ID = 'bottomSlackStyle';
    var attached = new WeakMap(); // scrollEl -> controller
    var registered = []; // [{ panelEl, scrollEl, controller }]
    var tabListenerInstalled = false;
    
    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent =
                '.bottomSlack{' +
                'height:var(--bottomSlack,0px);' +
                'flex:0 0 auto;' +
                'pointer-events:none;' +
                'transition:none;' +
                /* DEBUG VISUAL: commented out to achieve true zero */
                // 'background:repeating-linear-gradient(45deg, rgba(160, 32, 240, 0.22), rgba(160, 32, 240, 0.22) 12px, rgba(160, 32, 240, 0.12) 12px, rgba(160, 32, 240, 0.12) 24px);' +
                // 'border-top:2px solid rgba(160, 32, 240, 0.95);' +
                '}';
            document.head.appendChild(style);
        } catch (e) {}
    }
    
    function ensureSlackEl(scrollEl) {
        var slackEl = null;
        try { slackEl = scrollEl.querySelector('.bottomSlack'); } catch (e) { slackEl = null; }
        if (slackEl) return slackEl;
        try {
            slackEl = document.createElement('div');
            slackEl.className = 'bottomSlack';
            slackEl.setAttribute('aria-hidden', 'true');
            scrollEl.appendChild(slackEl);
        } catch (e2) {}
        return slackEl;
    }
    
    function installTabSwitchListener(tabSelector, panelSelector) {
        if (tabListenerInstalled) return;
        tabListenerInstalled = true;
        
        document.addEventListener('click', function(e) {
            var t = e && e.target;
            if (!t || !t.closest) return;
            var tabBtn = t.closest(tabSelector);
            if (!tabBtn) return;
            var panel = tabBtn.closest(panelSelector);
            if (!panel) return;
            
            for (var i = 0; i < registered.length; i++) {
                var r = registered[i];
                if (!r || !r.panelEl || !r.controller) continue;
                if (r.panelEl === panel) {
                    try { r.controller.forceOff(); } catch (e0) {}
                    return;
                }
            }
        }, true);
    }
    
    function attach(scrollEl, opts) {
        if (!(scrollEl instanceof Element)) {
            throw new Error('BottomSlack.attach: scrollEl must be an Element');
        }
        
        var existing = null;
        try { existing = attached.get(scrollEl); } catch (e0) { existing = null; }
        if (existing) return existing;
        
        opts = opts || {};
        ensureStyle();
        
        var stopDelayMs = (typeof opts.stopDelayMs === 'number') ? opts.stopDelayMs : 180;
        var clickHoldMs = (typeof opts.clickHoldMs === 'number') ? opts.clickHoldMs : 250;
        var scrollbarFadeMs = (typeof opts.scrollbarFadeMs === 'number') ? opts.scrollbarFadeMs : 160;
        
        var tabSelector = opts.tabSelector || '[role="tab"]';
        var panelSelector = opts.panelSelector || '.admin-panel, .member-panel';
        var enableForceOffOnTabs = (opts.enableForceOffOnTabs !== false);
        
        // STRICT RULE: only two slack sizes exist.
        var expandedSlackPx = 4000;
        var collapsedSlackPx = 0;
        
        var unlockTimer = null;
        var locked = false;
        var clickHoldUntil = 0;
        var currentSlackPx = null;
        var lastScrollTop = scrollEl.scrollTop || 0;
        var scrollbarFadeTimer = null;
        
        var slackEl = ensureSlackEl(scrollEl);
        var pendingOffscreenCollapse = false;
        
        function fadeScrollbar() {
            try {
                scrollEl.classList.add('panel-scrollbar-fade');
                if (scrollbarFadeTimer) clearTimeout(scrollbarFadeTimer);
                scrollbarFadeTimer = setTimeout(function() {
                    try { scrollEl.classList.remove('panel-scrollbar-fade'); } catch (e) {}
                }, scrollbarFadeMs);
            } catch (e) {}
        }
        
        function applySlackPx(px) {
            if (currentSlackPx === px) return;
            currentSlackPx = px;
            scrollEl.style.setProperty('--bottomSlack', String(px) + 'px');
            try { scrollEl.getBoundingClientRect(); } catch (e) {}
            fadeScrollbar();
        }
        
        function isSlackOnScreen() {
            if (!slackEl) return false;
            // Slack is always the last child (at the bottom). Use scrollHeight math (most reliable),
            // not offsetTop/getBoundingClientRect (can misreport during big reflows).
            try {
                var slackH = slackEl.offsetHeight || 0;
                if (slackH <= 0) return false;
                var viewBottom = (scrollEl.scrollTop || 0) + (scrollEl.clientHeight || 0);
                var totalH = scrollEl.scrollHeight || 0;
                var slackStart = totalH - slackH;
                return viewBottom > slackStart;
            } catch (e) {
                return false;
            }
        }
        
        var collapseRafPending = false;
        function maybeCollapseOffscreen() {
            if (!pendingOffscreenCollapse) return;
            
            // If the panel/tab content does not overflow (excluding any current slack),
            // the spacer must never be on-screen.
            try {
                var contentNoSlack = (scrollEl.scrollHeight || 0) - (currentSlackPx || 0);
                var h = scrollEl.clientHeight || 0;
                if (contentNoSlack <= h) {
                    // Do not collapse slack while it's visibly on-screen (prevents "slam shut").
                    // If there truly is no overflow, we'll collapse once the slack is off-screen.
                    try {
                        if (isSlackOnScreen()) return;
                    } catch (_eVis) {}
                    pendingOffscreenCollapse = false;
                    applySlackPx(collapsedSlackPx);
                    return;
                }
            } catch (e0) {}
            
            // Never collapse while visible. Also defer the decision to the next frame so
            // accordion layout changes settle before we check visibility.
            if (collapseRafPending) return;
            collapseRafPending = true;
            requestAnimationFrame(function() {
                collapseRafPending = false;
                if (!pendingOffscreenCollapse) return;
                if (isSlackOnScreen()) return;
                pendingOffscreenCollapse = false;
                applySlackPx(collapsedSlackPx);
            });
        }
        
        function requestCollapseOffscreen() {
            pendingOffscreenCollapse = true;
            maybeCollapseOffscreen();
        }
        
        // If slack is ON (4000) but still off-screen below, and the click window is over,
        // turn it OFF immediately before the user can ever scroll into it.
        function collapseIfOffscreenBelow() {
            try {
                if (currentSlackPx !== expandedSlackPx) return false;
                // During the click hold window, never collapse slack.
                if (Date.now() < clickHoldUntil) return false;
                if (isSlackOnScreen()) return false;
                pendingOffscreenCollapse = false;
                applySlackPx(collapsedSlackPx);
                return true;
            } catch (e) {
                return false;
            }
        }
        
        function lock() {
            if (locked) return;
            var h = scrollEl.clientHeight || 0;
            if (h <= 0) return;
            // During click hold window, don't lock/collapse.
            if (Date.now() < clickHoldUntil) return;
            scrollEl.style.maxHeight = h + 'px';
            locked = true;
        }
        
        function unlock() {
            if (!locked) return;
            scrollEl.style.maxHeight = '';
            requestCollapseOffscreen();
            locked = false;
        }
        
        function startScrollBurst() {
            lock();
            if (unlockTimer) clearTimeout(unlockTimer);
            unlockTimer = setTimeout(unlock, stopDelayMs);
        }
        
        function onScroll() {
            try {
                var st = scrollEl.scrollTop || 0;
                // If slack is on-screen and scrollTop increases anyway (e.g. scrollbar drag),
                // do NOT snap back. Just ignore this scroll event.
                if (st > lastScrollTop && isSlackOnScreen()) return;
                
                // If the user is scrolling down and slack is ON but still off-screen, kill it now.
                if (st > lastScrollTop) collapseIfOffscreenBelow();
                
                if (st === lastScrollTop) return;
                lastScrollTop = st;
            } catch (e) {}
            
            startScrollBurst();
            maybeCollapseOffscreen();
        }
        
        scrollEl.addEventListener('scroll', onScroll, { passive: true });
        
        // Wheel/trackpad: block downward scroll while slack is visible.
        scrollEl.addEventListener('wheel', function(e) {
            try {
                var deltaY = Number(e && e.deltaY) || 0;
                
                // If the wheel event happens within an open dropdown wrapper, route the scroll to the
                // dropdown options list when it can actually scroll in that direction.
                // This prevents the anchor from "eating" the first downward scroll.
                try {
                    var t = e && e.target;
                    if (t && t.closest) {
                        var wrap = t.closest('.fieldset-menu.fieldset-menu--open, .component-currencycompact-menu.component-currencycompact-menu--open, .component-currencyfull-menu.component-currencyfull-menu--open, .admin-language-wrapper.admin-language-wrapper--open');
                        if (wrap) {
                            var opts = wrap.querySelector('.fieldset-menu-options--open, .component-currencycompact-menu-options--open, .component-currencyfull-menu-options--open, .admin-language-options--open') ||
                                       wrap.querySelector('.fieldset-menu-options, .component-currencycompact-menu-options, .component-currencyfull-menu-options, .admin-language-options');
                            if (opts && opts.scrollHeight > (opts.clientHeight + 1)) {
                                var max = opts.scrollHeight - opts.clientHeight;
                                var st = opts.scrollTop || 0;
                                if ((deltaY > 0 && st < max) || (deltaY < 0 && st > 0)) {
                                    opts.scrollTop = st + deltaY;
                                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                                    return;
                                }
                            }
                        }
                    }
                } catch (_eMenu) {}

                if (deltaY > 0) collapseIfOffscreenBelow();
                if (deltaY > 0 && isSlackOnScreen()) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    return;
                }
            } catch (e0) {}
            startScrollBurst();
        }, { passive: false });
        
        // Touch (mobile): block downward scroll while slack is visible.
        var lastTouchY = null;
        scrollEl.addEventListener('touchstart', function(e) {
            try {
                var t = e && e.touches && e.touches[0];
                lastTouchY = t ? t.clientY : null;
            } catch (e0) { lastTouchY = null; }
            startScrollBurst();
        }, { passive: true });
        
        scrollEl.addEventListener('touchmove', function(e) {
            try {
                var t = e && e.touches && e.touches[0];
                if (!t) return;
                var y = t.clientY;
                if (lastTouchY === null) lastTouchY = y;
                var dy = y - lastTouchY;
                lastTouchY = y;
                // Finger moving up (dy < 0) attempts to scroll down.
                if (dy < 0) collapseIfOffscreenBelow();
                if (dy < 0 && isSlackOnScreen()) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                }
            } catch (e1) {}
        }, { passive: false });
        
        // Keyboard: block downward keys while slack is visible.
        scrollEl.addEventListener('keydown', function(e) {
            try {
                if (!isSlackOnScreen()) return;
                var k = e && (e.key || e.code) ? String(e.key || e.code) : '';
                if (k === 'ArrowDown' || k === 'PageDown' || k === 'End' || k === ' ' || k === 'Spacebar' || k === 'Space') {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                }
            } catch (e2) {}
        }, true);
        
        // Clicking: click-hold window + temporary slack ON.
        // This must arm BEFORE collapse-induced shrink so the button doesn't "fly away".
        function holdClickSlack(e) {
            // Never expand slack when clicking tab buttons (let forceOff handle it).
            try {
                var t = e && e.target;
                if (t && t.closest && t.closest('[role="tab"]')) return;
            } catch (_eTab) {}
            
            // Check if the clicked element is within a tab/panel that has BOTTOM anchor disabled.
            try {
                var t2 = e && e.target;
                if (t2 && t2.closest) {
                    var anchorDisabled = t2.closest('[data-bottomslack="false"]');
                    if (anchorDisabled) {
                        // This tab/panel doesn't want bottom anchor - collapse any existing slack and return.
                        applySlackPx(collapsedSlackPx);
                        return;
                    }
                }
            } catch (_eAttr) {}
            
            // Never show slack for containers that don't overflow.
            try {
                var h = scrollEl.clientHeight || 0;
                var contentNoSlack = (scrollEl.scrollHeight || 0) - (currentSlackPx || 0);
                if (contentNoSlack <= h) {
                    // Do not collapse slack while it's visibly on-screen (prevents "slam shut").
                    try {
                        if (isSlackOnScreen()) return;
                    } catch (_eVis) {}
                    pendingOffscreenCollapse = false;
                    applySlackPx(collapsedSlackPx);
                    return;
                }
            } catch (e0) {}
            
            clickHoldUntil = Date.now() + clickHoldMs;
            applySlackPx(expandedSlackPx);
        }
        scrollEl.addEventListener('pointerdown', holdClickSlack, { passive: true, capture: true });
        scrollEl.addEventListener('click', holdClickSlack, { passive: true, capture: true });
        
        // Default: slack off.
        applySlackPx(collapsedSlackPx);
        
        var controller = {
            forceOff: function() {
                try { clickHoldUntil = 0; } catch (e0) {}
                try { pendingOffscreenCollapse = false; } catch (e1) {}
                try { if (unlockTimer) clearTimeout(unlockTimer); } catch (e2) {}
                try { scrollEl.style.maxHeight = ''; } catch (e3) {}
                locked = false;
                applySlackPx(collapsedSlackPx);
                try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e4) {}
            }
        };
        
        if (enableForceOffOnTabs) {
            try {
                var panelEl = scrollEl.closest(panelSelector);
                if (panelEl) registered.push({ panelEl: panelEl, scrollEl: scrollEl, controller: controller });
                installTabSwitchListener(tabSelector, panelSelector);
            } catch (e0) {}
        }
        
        try { attached.set(scrollEl, controller); } catch (e5) {}
        return controller;
    }
    
    return {
        attach: attach
    };
})();

/* ============================================================================
   TOP SLACK
   Prevents "clicked button flies away" when collapsible content above changes near the TOP edge.
   Opposite of BottomSlack:
   - Uses a TOP slack element + CSS var: --topSlack
   - Blocks UPWARD scrolling while the top spacer is on-screen
   ============================================================================ */

const TopSlack = (function() {
    var STYLE_ID = 'topSlackStyle';
    var attached = new WeakMap(); // scrollEl -> controller
    var registered = []; // [{ panelEl, scrollEl, controller }]
    var tabListenerInstalled = false;
    
    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent =
                '.topSlack{' +
                'height:var(--topSlack,0px);' +
                'flex:0 0 auto;' +
                'pointer-events:none;' +
                'transition:none;' +
                '}';
            document.head.appendChild(style);
        } catch (e) {}
    }
    
    function ensureSlackEl(scrollEl) {
        var slackEl = null;
        try { slackEl = scrollEl.querySelector('.topSlack'); } catch (e) { slackEl = null; }
        if (slackEl) return slackEl;
        try {
            slackEl = document.createElement('div');
            slackEl.className = 'topSlack';
            slackEl.setAttribute('aria-hidden', 'true');
            scrollEl.insertBefore(slackEl, scrollEl.firstChild);
        } catch (e2) {}
        return slackEl;
    }
    
    function installTabSwitchListener(tabSelector, panelSelector) {
        if (tabListenerInstalled) return;
        tabListenerInstalled = true;
        
        document.addEventListener('click', function(e) {
            var t = e && e.target;
            if (!t || !t.closest) return;
            var tabBtn = t.closest(tabSelector);
            if (!tabBtn) return;
            var panel = tabBtn.closest(panelSelector);
            if (!panel) return;
            
            for (var i = 0; i < registered.length; i++) {
                var r = registered[i];
                if (!r || !r.panelEl || !r.controller) continue;
                if (r.panelEl === panel) {
                    try { r.controller.forceOff(); } catch (e0) {}
                    return;
                }
            }
        }, true);
    }
    
    function attach(scrollEl, opts) {
        if (!(scrollEl instanceof Element)) {
            throw new Error('TopSlack.attach: scrollEl must be an Element');
        }
        
        var existing = null;
        try { existing = attached.get(scrollEl); } catch (e0) { existing = null; }
        if (existing) return existing;
        
        opts = opts || {};
        ensureStyle();
        
        var stopDelayMs = (typeof opts.stopDelayMs === 'number') ? opts.stopDelayMs : 180;
        var clickHoldMs = (typeof opts.clickHoldMs === 'number') ? opts.clickHoldMs : 250;
        var scrollbarFadeMs = (typeof opts.scrollbarFadeMs === 'number') ? opts.scrollbarFadeMs : 160;
        
        var tabSelector = opts.tabSelector || '[role="tab"]';
        var panelSelector = opts.panelSelector || '.admin-panel, .member-panel';
        var enableForceOffOnTabs = (opts.enableForceOffOnTabs !== false);
        
        // STRICT RULE: only two slack sizes exist.
        var expandedSlackPx = 4000;
        var collapsedSlackPx = 0;
        
        var slackEl = ensureSlackEl(scrollEl);
        var unlockTimer = null;
        var locked = false;
        var clickHoldUntil = 0;
        var currentSlackPx = 0;
        var lastScrollTop = scrollEl.scrollTop || 0;
        var scrollbarFadeTimer = null;
        var pendingOffscreenCollapse = false;
        var internalAdjust = false;
        var pendingAnchor = null; // { el, topBefore }
        var anchorObserver = null;
        var anchorApplied = false;
        var anchorDirty = false;
        
        function fadeScrollbar() {
            try {
                scrollEl.classList.add('panel-scrollbar-fade');
                if (scrollbarFadeTimer) clearTimeout(scrollbarFadeTimer);
                scrollbarFadeTimer = setTimeout(function() {
                    try { scrollEl.classList.remove('panel-scrollbar-fade'); } catch (e) {}
                }, scrollbarFadeMs);
            } catch (e) {}
        }
        
        function applySlackPx(px) {
            if (px !== collapsedSlackPx && px !== expandedSlackPx) return;
            if (currentSlackPx === px) return;
            
            var oldPx = currentSlackPx;
            currentSlackPx = px;
            
            // IMPORTANT: changing top slack changes layout; compensate scrollTop so there is no visible jump.
            internalAdjust = true;
            try {
                if (px > oldPx) {
                    scrollEl.style.setProperty('--topSlack', String(px) + 'px');
                    scrollEl.scrollTop = (scrollEl.scrollTop || 0) + (px - oldPx);
                } else {
                    scrollEl.style.setProperty('--topSlack', String(px) + 'px');
                    var next = (scrollEl.scrollTop || 0) - (oldPx - px);
                    scrollEl.scrollTop = next < 0 ? 0 : next;
                }
            } catch (e0) {}
            internalAdjust = false;
            
            try { scrollEl.getBoundingClientRect(); } catch (e1) {}
            fadeScrollbar();
            
            try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e2) {}
        }
        
        function isSlackOnScreen() {
            if (!slackEl) return false;
            try {
                var slackRect = slackEl.getBoundingClientRect();
                var scrollRect = scrollEl.getBoundingClientRect();
                return slackRect.bottom > scrollRect.top && slackRect.top < scrollRect.bottom;
            } catch (e) {
                return false;
            }
        }
        
        function isSlackOffscreenAbove() {
            if (!slackEl) return false;
            try {
                var slackRect = slackEl.getBoundingClientRect();
                var scrollRect = scrollEl.getBoundingClientRect();
                return slackRect.bottom <= scrollRect.top;
            } catch (e) {
                return false;
            }
        }
        
        function maybeCollapseOffscreen() {
            if (!pendingOffscreenCollapse) return;
            // Never resize while visible
            if (isSlackOnScreen()) return;
            pendingOffscreenCollapse = false;
            applySlackPx(collapsedSlackPx);
        }
        
        function requestCollapseOffscreen() {
            pendingOffscreenCollapse = true;
            maybeCollapseOffscreen();
        }
        
        // If slack is ON but sits above the viewport, collapse it before the user can ever scroll into it.
        function collapseIfOffscreenAbove() {
            try {
                if (currentSlackPx !== expandedSlackPx) return false;
                if (Date.now() < clickHoldUntil) return false;
                if (!isSlackOffscreenAbove()) return false;
                pendingOffscreenCollapse = false;
                applySlackPx(collapsedSlackPx);
                return true;
            } catch (e) {
                return false;
            }
        }
        
        function lock() {
            if (locked) return;
            var h = scrollEl.clientHeight || 0;
            if (h <= 0) return;
            if (Date.now() < clickHoldUntil) return;
            scrollEl.style.maxHeight = h + 'px';
            locked = true;
        }
        
        function unlock() {
            if (!locked) return;
            scrollEl.style.maxHeight = '';
            requestCollapseOffscreen();
            locked = false;
        }
        
        function startScrollBurst() {
            lock();
            if (unlockTimer) clearTimeout(unlockTimer);
            unlockTimer = setTimeout(unlock, stopDelayMs);
        }
        
        function applyAnchorAdjustment() {
            if (!pendingAnchor) return;
            var a = pendingAnchor;
            pendingAnchor = null;
            if (!a || !a.el || !a.el.isConnected) return;
            
            // Check if the anchor element is within a tab/panel that has BOTTOM anchor disabled.
            try {
                if (a.el.closest && a.el.closest('[data-topslack="false"]')) {
                    return; // This tab/panel doesn't want top anchor adjustments.
                }
            } catch (_eAttr) {}
            
            try {
                var afterTop = a.el.getBoundingClientRect().top;
                var delta = afterTop - a.topBefore;
                if (!delta) return;
                
                var desired = (scrollEl.scrollTop || 0) + delta;
                if (desired < 0) {
                    // Need room above: enable slack (compensated, no visible jump), then offset desired.
                    applySlackPx(expandedSlackPx);
                    desired = desired + expandedSlackPx;
                }
                
                internalAdjust = true;
                scrollEl.scrollTop = desired;
                internalAdjust = false;
                lastScrollTop = scrollEl.scrollTop || 0;
            } catch (e) {
                internalAdjust = false;
            }
        }
        
        function startAnchorObserver() {
            if (anchorObserver) return;
            try {
                anchorObserver = new MutationObserver(function() {
                    // Many tiny mutations happen before the *real* auto-close mutation.
                    // We only mark dirty here, and apply once at the end of the click task.
                    if (anchorApplied) return;
                    anchorDirty = true;
                });
                anchorObserver.observe(scrollEl, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    characterData: false
                });
            } catch (e) {
                anchorObserver = null;
            }
        }

        function stopAnchorObserver() {
            if (!anchorObserver) return;
            try { anchorObserver.disconnect(); } catch (e0) {}
            anchorObserver = null;
        }

        // Capture the anchor target before DOM changes.
        scrollEl.addEventListener('pointerdown', function(e) {
            try {
                var t = e && e.target;
                if (!(t instanceof Element)) return;
                if (slackEl && (t === slackEl || slackEl.contains(t))) return;
                // Only anchor if the click is inside this scroll container.
                if (!scrollEl.contains(t)) return;
                // Anchor the closest "button-like" element to avoid anchoring to inner icon spans.
                var anchorEl = t.closest('button, [role="button"], a') || t;
                pendingAnchor = { el: anchorEl, topBefore: anchorEl.getBoundingClientRect().top };
                clickHoldUntil = Date.now() + clickHoldMs;
                anchorApplied = false;
                anchorDirty = false;
                startAnchorObserver();
            } catch (e0) {}
        }, { passive: true, capture: true });
        
        // Bubble phase so any inner click handlers (that close panels above) run first.
        // Apply once at the end of the click task, after all synchronous handlers ran.
        scrollEl.addEventListener('click', function() {
            try {
                queueMicrotask(function() {
                    if (anchorApplied) return;
                    anchorApplied = true;
                    stopAnchorObserver();
                    // If nothing changed, no-op.
                    if (!anchorDirty) return;
                    applyAnchorAdjustment();
                });
            } catch (e0) {}
        }, false);
        
        function onScroll() {
            if (internalAdjust) return;
            try {
                var st = scrollEl.scrollTop || 0;
                // While slack is visible, do not allow upward scrolling (no snapping).
                if (st < lastScrollTop && isSlackOnScreen()) return;
                
                // If the user is scrolling up and slack exists above, collapse it before it becomes reachable.
                if (st < lastScrollTop) collapseIfOffscreenAbove();
                
                if (st === lastScrollTop) return;
                lastScrollTop = st;
            } catch (e) {}
            
            startScrollBurst();
            maybeCollapseOffscreen();
        }
        
        scrollEl.addEventListener('scroll', onScroll, { passive: true });
        
        // Wheel/trackpad: block upward scroll while slack is visible.
        scrollEl.addEventListener('wheel', function(e) {
            try {
                var deltaY = Number(e && e.deltaY) || 0;
                if (deltaY < 0) collapseIfOffscreenAbove();
                if (deltaY < 0 && isSlackOnScreen()) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    return;
                }
            } catch (e0) {}
            startScrollBurst();
        }, { passive: false });
        
        // Touch: block upward scroll while slack is visible.
        var lastTouchY = null;
        scrollEl.addEventListener('touchstart', function(e) {
            try {
                var t = e && e.touches && e.touches[0];
                lastTouchY = t ? t.clientY : null;
            } catch (e0) { lastTouchY = null; }
            startScrollBurst();
        }, { passive: true });
        
        scrollEl.addEventListener('touchmove', function(e) {
            try {
                var t = e && e.touches && e.touches[0];
                if (!t) return;
                var y = t.clientY;
                if (lastTouchY === null) lastTouchY = y;
                var dy = y - lastTouchY;
                lastTouchY = y;
                // Finger moving down (dy > 0) attempts to scroll up.
                if (dy > 0) collapseIfOffscreenAbove();
                if (dy > 0 && isSlackOnScreen()) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                }
            } catch (e1) {}
        }, { passive: false });
        
        // Keyboard: block upward keys while slack is visible.
        scrollEl.addEventListener('keydown', function(e) {
            try {
                if (!isSlackOnScreen()) return;
                var k = e && (e.key || e.code) ? String(e.key || e.code) : '';
                if (k === 'ArrowUp' || k === 'PageUp' || k === 'Home') {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                }
            } catch (e2) {}
        }, true);
        
        // Default: slack off.
        applySlackPx(collapsedSlackPx);
        
        var controller = {
            forceOff: function() {
                try { clickHoldUntil = 0; } catch (e0) {}
                try { pendingOffscreenCollapse = false; } catch (e1) {}
                try { if (unlockTimer) clearTimeout(unlockTimer); } catch (e2) {}
                try { scrollEl.style.maxHeight = ''; } catch (e3) {}
                locked = false;
                pendingAnchor = null;
                applySlackPx(collapsedSlackPx);
                try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e4) {}
            }
        };
        
        if (enableForceOffOnTabs) {
            try {
                var panelEl = scrollEl.closest(panelSelector);
                if (panelEl) registered.push({ panelEl: panelEl, scrollEl: scrollEl, controller: controller });
                installTabSwitchListener(tabSelector, panelSelector);
            } catch (e0) {}
        }
        
        try { attached.set(scrollEl, controller); } catch (e5) {}
        return controller;
    }
    
    return { attach: attach };
})();


/* ============================================================================
   AVATAR CROPPER COMPONENT
   Standalone reusable avatar cropper (destructive - outputs cropped blob).
   Used by: AvatarPickerComponent
   Class pattern: component-avatarcropper-tool-{part}--{state}
   ============================================================================ */

const AvatarCropperComponent = (function() {
    // Singleton overlay - created once, reused
    var overlay = null;
    var toolEl = null;
    var canvas = null;
    var zoomInput = null;
    var cancelBtn = null;
    var saveBtn = null;
    var cropImg = null;
    
    var cropState = {
        zoom: 1,
        minZoom: 1,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        lastX: 0,
        lastY: 0,
        didDrag: false,
        backdropMouseDown: false
    };
    
    var currentCallback = null;
    
    function ensureOverlay() {
        if (overlay) return;
        
        overlay = document.createElement('div');
        overlay.className = 'component-avatarcropper-tool-overlay';
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        
        toolEl = document.createElement('div');
        toolEl.className = 'component-avatarcropper-tool';
        toolEl.setAttribute('role', 'dialog');
        toolEl.setAttribute('aria-modal', 'true');
        toolEl.setAttribute('aria-label', 'Crop avatar');
        
        var previewWrap = document.createElement('div');
        previewWrap.className = 'component-avatarcropper-tool-preview';
        canvas = document.createElement('canvas');
        canvas.className = 'component-avatarcropper-tool-canvas';
        canvas.width = 530;
        canvas.height = 530;
        previewWrap.appendChild(canvas);
        
        var zoomWrap = document.createElement('div');
        zoomWrap.className = 'component-avatarcropper-tool-zoom';
        var zoomLabel = document.createElement('label');
        zoomLabel.className = 'component-avatarcropper-tool-zoom-label';
        zoomLabel.textContent = 'Zoom';
        zoomInput = document.createElement('input');
        zoomInput.type = 'range';
        zoomInput.className = 'component-avatarcropper-tool-zoom-input';
        zoomInput.min = '1';
        zoomInput.max = '3';
        zoomInput.step = '0.01';
        zoomInput.value = '1';
        zoomWrap.appendChild(zoomLabel);
        zoomWrap.appendChild(zoomInput);
        
        var actions = document.createElement('div');
        actions.className = 'component-avatarcropper-tool-actions';
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'component-avatarcropper-tool-button component-avatarcropper-tool-button--cancel';
        cancelBtn.textContent = 'Cancel';
        saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'component-avatarcropper-tool-button component-avatarcropper-tool-button--save';
        saveBtn.textContent = 'Use Avatar';
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        
        toolEl.appendChild(previewWrap);
        toolEl.appendChild(zoomWrap);
        toolEl.appendChild(actions);
        overlay.appendChild(toolEl);
        document.body.appendChild(overlay);
        
        // Events
        overlay.addEventListener('mousedown', function(e) {
            cropState.backdropMouseDown = (e.target === overlay);
        });
        toolEl.addEventListener('mousedown', function() {
            cropState.backdropMouseDown = false;
        });
        overlay.addEventListener('click', function(e) {
            if (e.target !== overlay) return;
            if (!cropState.backdropMouseDown) return;
            if (cropState.dragging) return;
            if (cropState.didDrag) {
                cropState.didDrag = false;
                cropState.backdropMouseDown = false;
                return;
            }
            cropState.backdropMouseDown = false;
            close();
        });
        
        cancelBtn.addEventListener('click', function() {
            close();
        });
        
        saveBtn.addEventListener('click', function() {
            save();
        });
        
        zoomInput.addEventListener('input', function() {
            var z = parseFloat(zoomInput.value || '1');
            if (!isFinite(z) || z <= 0) z = 1;
            if (z < cropState.minZoom) z = cropState.minZoom;
            cropState.zoom = z;
            draw();
        });
        
        // Drag to reposition
        canvas.addEventListener('mousedown', function(e) {
            cropState.dragging = true;
            cropState.didDrag = false;
            cropState.lastX = e.clientX;
            cropState.lastY = e.clientY;
        });
        
        window.addEventListener('mousemove', function(e) {
            if (!cropState.dragging) return;
            var dx = e.clientX - cropState.lastX;
            var dy = e.clientY - cropState.lastY;
            cropState.lastX = e.clientX;
            cropState.lastY = e.clientY;
            if (dx !== 0 || dy !== 0) {
                cropState.didDrag = true;
            }
            
            var rect = canvas.getBoundingClientRect();
            var scaleX = rect.width ? (canvas.width / rect.width) : 1;
            var scaleY = rect.height ? (canvas.height / rect.height) : 1;
            cropState.offsetX += dx * scaleX;
            cropState.offsetY += dy * scaleY;
            draw();
        });
        
        window.addEventListener('mouseup', function() {
            cropState.dragging = false;
        });
        
        // Touch support
        canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            var touch = e.touches[0];
            cropState.dragging = true;
            cropState.didDrag = false;
            cropState.lastX = touch.clientX;
            cropState.lastY = touch.clientY;
            e.preventDefault();
        }, { passive: false });
        
        window.addEventListener('touchmove', function(e) {
            if (!cropState.dragging || e.touches.length !== 1) return;
            var touch = e.touches[0];
            var dx = touch.clientX - cropState.lastX;
            var dy = touch.clientY - cropState.lastY;
            cropState.lastX = touch.clientX;
            cropState.lastY = touch.clientY;
            if (dx !== 0 || dy !== 0) {
                cropState.didDrag = true;
            }
            
            var rect = canvas.getBoundingClientRect();
            var scaleX = rect.width ? (canvas.width / rect.width) : 1;
            var scaleY = rect.height ? (canvas.height / rect.height) : 1;
            cropState.offsetX += dx * scaleX;
            cropState.offsetY += dy * scaleY;
            draw();
        }, { passive: true });
        
        window.addEventListener('touchend', function() {
            cropState.dragging = false;
        });
    }
    
    function draw() {
        if (!cropImg || !canvas) return;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        var cw = canvas.width;
        var ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);
        
        var iw = cropImg.naturalWidth || cropImg.width;
        var ih = cropImg.naturalHeight || cropImg.height;
        if (!iw || !ih) return;
        
        // Cover-only zoom (no blank areas)
        var cover = Math.max(cw / iw, ch / ih);
        var scale = cover * (cropState.zoom || 1);
        var drawW = iw * scale;
        var drawH = ih * scale;
        
        var baseX = (cw - drawW) / 2;
        var baseY = (ch - drawH) / 2;
        var offX = cropState.offsetX || 0;
        var offY = cropState.offsetY || 0;
        
        // Clamp offsets so the image always fully covers the crop square
        if (drawW <= cw) {
            offX = 0;
        } else {
            var minOffX = baseX;
            var maxOffX = -baseX;
            if (offX < minOffX) offX = minOffX;
            if (offX > maxOffX) offX = maxOffX;
        }
        if (drawH <= ch) {
            offY = 0;
        } else {
            var minOffY = baseY;
            var maxOffY = -baseY;
            if (offY < minOffY) offY = minOffY;
            if (offY > maxOffY) offY = maxOffY;
        }
        
        cropState.offsetX = offX;
        cropState.offsetY = offY;
        
        var x = baseX + offX;
        var y = baseY + offY;
        ctx.drawImage(cropImg, x, y, drawW, drawH);
    }
    
    function open(file, callback) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError('Please select an image file.');
            }
            return;
        }
        
        ensureOverlay();
        currentCallback = callback || null;
        
        var url = URL.createObjectURL(file);
        cropImg = new Image();
        cropImg.onload = function() {
            // Reset crop state
            cropState.zoom = 1;
            cropState.offsetX = 0;
            cropState.offsetY = 0;
            cropState.minZoom = 1;
            
            if (zoomInput) {
                zoomInput.min = '1';
                zoomInput.value = '1';
            }
            
            draw();
            overlay.hidden = false;
            overlay.setAttribute('aria-hidden', 'false');
        };
        cropImg.onerror = function() {
            try { URL.revokeObjectURL(url); } catch (e) {}
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError('Failed to load image.');
            }
        };
        cropImg.src = url;
        cropImg.dataset.objectUrl = url;
    }
    
    function close() {
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        
        if (cropImg && cropImg.dataset && cropImg.dataset.objectUrl) {
            try { URL.revokeObjectURL(cropImg.dataset.objectUrl); } catch (e) {}
        }
        cropImg = null;
        currentCallback = null;
    }
    
    function save() {
        if (!canvas) return;
        
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('component-avatarcropper-tool-button--disabled');
        }
        
        canvas.toBlob(function(blob) {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('component-avatarcropper-tool-button--disabled');
            }
            
            if (!blob) {
                if (window.ToastComponent && ToastComponent.showError) {
                    ToastComponent.showError('Could not create avatar image.');
                }
                return;
            }
            
            // Create a preview URL for the blob
            var previewUrl = '';
            try {
                previewUrl = URL.createObjectURL(blob);
            } catch (e) {}
            
            if (currentCallback && typeof currentCallback === 'function') {
                currentCallback({ blob: blob, previewUrl: previewUrl });
            }
            
            close();
        }, 'image/png', 0.92);
    }
    
    function isOpen() {
        return overlay && !overlay.hidden;
    }
    
    return {
        open: open,
        close: close,
        isOpen: isOpen
    };
})();


/* ============================================================================
   AVATAR PICKER COMPONENT
   Avatar selection interface with site avatars grid + upload option.
   Uses AvatarCropperComponent for cropping uploaded images.
   Class pattern: component-avatarpicker-{part}--{state}
   ============================================================================ */

const AvatarPickerComponent = (function() {
    
    // Host-integrated 4-tile picker:
    // - "self" tile (shows current/staged avatar; shows Add tile if empty)
    // - optional "upload" tile (second-click opens file picker)
    // - N site tiles (so total stays 4)
    //
    // options:
    // {
    //   hostEl: Element (required)
    //   resolveSrc: function(value) => string (optional; filename/url -> usable src)
    //   selfValue: string (optional; existing avatar filename/url)
    //   siteAvatars: [{ filename, url }]
    //   allowUpload: boolean (default true)
    //   onChange: function(state)   // state: { selectedKey, selfBlob, selfPreviewUrl, selectedSite }
    // }

    function attach(hostEl, options) {
        if (!hostEl) throw new Error('[AvatarPickerComponent] hostEl is required.');

        options = options || {};
        var resolveSrc = typeof options.resolveSrc === 'function' ? options.resolveSrc : function(v) { return v || ''; };
        var allowUpload = options.allowUpload !== false;

        var siteAvatars = Array.isArray(options.siteAvatars) ? options.siteAvatars.slice() : [];

        var selfValue = options.selfValue || '';
        var onChange = typeof options.onChange === 'function' ? options.onChange : function() {};

        // Internal staged self blob/preview (memory only)
        var selfBlob = null;
        var selfPreviewUrl = '';

        // Selection keys: 'self' | 'upload' | 'site-0'...'site-N'
        var selectedKey = 'self';

        // Build DOM
        hostEl.innerHTML = '';

        var root = document.createElement('div');
        root.className = 'component-avatarpicker';

        var grid = document.createElement('div');
        grid.className = 'component-avatarpicker-grid';
        
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.hidden = true;
        root.appendChild(fileInput);

        function buildTileButton(key, extraClass) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'component-avatarpicker-tile' + (extraClass ? (' ' + extraClass) : '');
            btn.dataset.choiceKey = key;
            btn.setAttribute('aria-pressed', 'false');
            return btn;
        }

        function setSelectedKey(nextKey) {
            selectedKey = nextKey || 'self';
            updateSelectionState();
            emitChange();
        }

        function updateSelectionState() {
            var tiles = grid.querySelectorAll('.component-avatarpicker-tile');
            tiles.forEach(function(tile) {
                var key = tile.dataset.choiceKey || '';
                var isSel = key === selectedKey;
                tile.classList.toggle('component-avatarpicker-tile--selected', isSel);
                tile.setAttribute('aria-pressed', isSel ? 'true' : 'false');
            });
        }

        function emitChange() {
            var selectedSite = null;
            if (selectedKey.indexOf('site-') === 0) {
                var idx = parseInt(String(selectedKey).split('-')[1] || '0', 10);
                if (isFinite(idx) && idx >= 0 && siteAvatars[idx]) selectedSite = siteAvatars[idx];
            }
            var complete = !!(selectedSite || hasSelfAvatar());
            // Expose selection state to parent wrappers (registration/profile fieldsets).
            try {
                hostEl.dataset.selectedKey = String(selectedKey || '');
                hostEl.dataset.complete = complete ? 'true' : 'false';
            } catch (e0) {}

            onChange({
                selectedKey: selectedKey,
                selfBlob: selfBlob,
                selfPreviewUrl: selfPreviewUrl,
                selfValue: selfValue,
                selectedSite: selectedSite
            });
            // Let parent fieldsets/forms react (required/completion checks).
            try { hostEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
        }

        function hasSelfAvatar() {
            if (selfPreviewUrl) return true;
            if (selfValue) {
                var src = resolveSrc(selfValue);
                return !!(src && String(src).trim());
            }
            return false;
        }

        function setSelfFromCropResult(result) {
            if (!result || !result.blob) return;

            // Cleanup previous preview URL
            if (selfPreviewUrl) {
                try { URL.revokeObjectURL(selfPreviewUrl); } catch (e) {}
            }
            selfBlob = result.blob;
            selfPreviewUrl = result.previewUrl || '';

            // Ensure layout updates (self occupies tile 1; upload shifts to tile 2; site tiles reduce)
            renderGrid();
            setSelectedKey('self');
        }

        function openCropperForFile(file) {
            if (!allowUpload) return;
            if (!window.AvatarCropperComponent || typeof AvatarCropperComponent.open !== 'function') {
                throw new Error('[AvatarPickerComponent] AvatarCropperComponent is required.');
            }
            AvatarCropperComponent.open(file, function(result) {
                setSelfFromCropResult(result);
            });
        }

        function openFilePicker() {
            if (!allowUpload) return;
                    fileInput.value = '';
                    fileInput.click();
                }

        function blobFromUrl(url) {
            return fetch(url).then(function(r) { return r.blob(); });
        }

        function openCropperForUrl(url, filename) {
            if (!allowUpload) return;
            filename = filename || (url ? (String(url).split('/').pop() || 'avatar.png') : 'avatar.png');
            return blobFromUrl(url).then(function(blob) {
                var file = new File([blob], filename, { type: blob.type || 'image/png' });
                openCropperForFile(file);
            }).catch(function() {
                // Silent fail; caller can show toast if desired.
            });
        }

        function renderGrid() {
            var hasSelf = hasSelfAvatar();
            var hasUploadTile = !!(allowUpload && hasSelf); // Upload tile exists only after a self avatar exists

            // Keep exactly 4 tiles at all times.
            // Layout rules (Paul):
            // - If NO uploaded avatar: tile1 = upload (self), tiles2-4 = site avatars (3)
            // - If HAS uploaded avatar: tile1 = self image, tile2 = upload, tiles3-4 = site avatars (2)
            grid.innerHTML = '';

            function renderAddTile(btn, text) {
                btn.innerHTML = '';
                var add = document.createElement('div');
                add.className = 'component-avatarpicker-tile-add';
                var t = document.createElement('div');
                t.className = 'component-avatarpicker-tile-add-text';
                t.textContent = text || 'Upload';
                add.appendChild(t);
                btn.appendChild(add);
            }

            function renderImgTile(btn, src) {
                btn.innerHTML = '';
            var img = document.createElement('img');
                img.className = 'component-avatarpicker-tile-image';
            img.alt = '';
                img.src = src;
                btn.appendChild(img);
            }

            // Tile 1: self OR upload box (if empty)
            var selfBtn = buildTileButton('self', 'component-avatarpicker-tile--self');
            grid.appendChild(selfBtn);

            var selfSrc = '';
            if (selfPreviewUrl) selfSrc = selfPreviewUrl;
            else if (selfValue) selfSrc = resolveSrc(selfValue);

            if (selfSrc) renderImgTile(selfBtn, selfSrc);
            else renderAddTile(selfBtn, 'Upload');

            // Tile 2: upload box (only if self exists)
            if (hasUploadTile) {
                var uploadBtn = buildTileButton('upload', 'component-avatarpicker-tile--upload');
                renderAddTile(uploadBtn, 'Upload');
                grid.appendChild(uploadBtn);
            }

            // Remaining tiles: site avatars
            var siteSlots = hasUploadTile ? 2 : 3;
            var visibleSites = siteAvatars.slice(0, siteSlots);
            visibleSites.forEach(function(avatar, idx) {
                var key = 'site-' + idx;
                var b = buildTileButton(key, 'component-avatarpicker-tile--site');
                var url = avatar && avatar.url ? String(avatar.url) : '';
                if (url) renderImgTile(b, url);
                else renderAddTile(b, '');
                grid.appendChild(b);
            });

            // If the current selection no longer exists (site-2 disappears after upload), reset to self.
            var hasSelected = !!grid.querySelector('.component-avatarpicker-tile[data-choice-key="' + selectedKey + '"]');
            if (!hasSelected) selectedKey = 'self';

            updateSelectionState();
        }

        root.appendChild(grid);
        hostEl.appendChild(root);

        // Initial render (tile order depends on whether a self avatar exists)
        renderGrid();
        emitChange();

        // Events
        grid.addEventListener('click', function(e) {
            var btn = e.target && e.target.closest ? e.target.closest('.component-avatarpicker-tile') : null;
            if (!btn) return;
            var key = btn.dataset.choiceKey || '';
            if (!key) return;

            var hasSelf = hasSelfAvatar();
            var hasUploadTile = !!(allowUpload && hasSelf);

            // Upload tile is always direct-open (no double-click required)
            if (key === 'upload') {
                setSelectedKey('upload');
                openFilePicker();
                return;
            }

            // Self tile acts as the upload tile when there is no self avatar yet (tile 1 upload).
            if (key === 'self' && !hasSelf) {
                setSelectedKey('self');
                openFilePicker();
                return;
            }

            // First click selects (for self w/ avatar + site avatars)
            if (key !== selectedKey) {
                setSelectedKey(key);
                return;
            }

            // Second click on selected opens cropper for self/site
            if (key === 'self') {
                if (selfBlob) {
                    var f = new File([selfBlob], 'avatar.png', { type: selfBlob.type || 'image/png' });
                    openCropperForFile(f);
                    return;
                }
                var src = selfValue ? resolveSrc(selfValue) : '';
                if (src) {
                    openCropperForUrl(src, 'avatar.png');
                    return;
                }
                // No src, but should not happen here (handled above). Fall back to file picker.
                if (allowUpload) openFilePicker();
                return;
            }

            if (key.indexOf('site-') === 0) {
                var idx = parseInt(String(key).split('-')[1] || '0', 10);
                var maxIdx = hasUploadTile ? 1 : 2; // visible site tiles are 0..1 or 0..2
                if (!isFinite(idx) || idx < 0 || idx > maxIdx) return;
                var c = siteAvatars[idx];
                if (c && c.url) {
                    openCropperForUrl(String(c.url), 'avatar.png');
                }
                return;
            }
        });

        fileInput.addEventListener('change', function() {
            var file = fileInput.files && fileInput.files[0];
            if (!file) return;
            openCropperForFile(file);
        });

        return {
            setSelectedKey: function(key) {
                setSelectedKey(key || 'self');
            },
            setSelfValue: function(value) {
                selfValue = value || '';
                renderGrid();
                emitChange();
            },
            setSelfBlob: function(blob, previewUrl) {
                if (!blob) {
                    if (selfPreviewUrl) {
                        try { URL.revokeObjectURL(selfPreviewUrl); } catch (e) {}
                    }
                    selfBlob = null;
                    selfPreviewUrl = '';
                    renderGrid();
                    emitChange();
                    return;
                }
                // Cleanup previous preview URL
                if (selfPreviewUrl) {
                    try { URL.revokeObjectURL(selfPreviewUrl); } catch (e) {}
                }
                selfBlob = blob;
                selfPreviewUrl = previewUrl || '';
                renderGrid();
                setSelectedKey('self');
            },
            update: function(next) {
                next = next || {};
                if (Array.isArray(next.siteAvatars)) siteAvatars = next.siteAvatars.slice();
                if (typeof next.allowUpload === 'boolean') allowUpload = next.allowUpload;
                if (typeof next.resolveSrc === 'function') resolveSrc = next.resolveSrc;
                if (typeof next.onChange === 'function') onChange = next.onChange;
                if (typeof next.selfValue === 'string') selfValue = next.selfValue;

                // Rebuild DOM by re-attaching (simpler + avoids drift)
                return attach(hostEl, {
                    siteAvatars: siteAvatars,
                    allowUpload: allowUpload,
                    resolveSrc: resolveSrc,
                    selfValue: selfValue,
                    onChange: onChange
                });
            },
            getState: function() {
                var selectedSite = null;
                if (selectedKey.indexOf('site-') === 0) {
                    var idx = parseInt(String(selectedKey).split('-')[1] || '0', 10);
                    if (isFinite(idx) && idx >= 0 && siteAvatars[idx]) selectedSite = siteAvatars[idx];
                }
                return {
                    selectedKey: selectedKey,
                    selfBlob: selfBlob,
                    selfPreviewUrl: selfPreviewUrl,
                    selfValue: selfValue,
                    selectedSite: selectedSite
                };
            },
            destroy: function() {
                if (selfPreviewUrl) {
                    try { URL.revokeObjectURL(selfPreviewUrl); } catch (e) {}
                }
                hostEl.innerHTML = '';
            }
        };
    }
    
    return {
        attach: attach
    };
})();


/* ============================================================================
   POST CROPPER COMPONENT
   Standalone reusable post image cropper (non-destructive - stores crop coords).
   Outputs crop coordinates for use with Bunny Dynamic Image API.
   Class pattern: component-postcropper-tool-{part}--{state}
   ============================================================================ */

const PostCropperComponent = (function() {
    // Singleton overlay - created once, reused
    var overlay = null;
    var toolEl = null;
    var canvas = null;
    var zoomInput = null;
    var cancelBtn = null;
    var saveBtn = null;
    var cropImg = null;
    
    var cropState = {
        zoom: 1,
        minZoom: 1,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        lastX: 0,
        lastY: 0,
        didDrag: false,
        backdropMouseDown: false
    };
    
    var currentCallback = null;
    var currentImageUrl = null;
    
    function ensureOverlay() {
        if (overlay) return;
        
        overlay = document.createElement('div');
        overlay.className = 'component-postcropper-tool-overlay';
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        
        toolEl = document.createElement('div');
        toolEl.className = 'component-postcropper-tool';
        toolEl.setAttribute('role', 'dialog');
        toolEl.setAttribute('aria-modal', 'true');
        toolEl.setAttribute('aria-label', 'Crop image');
        
        var previewWrap = document.createElement('div');
        previewWrap.className = 'component-postcropper-tool-preview';
        canvas = document.createElement('canvas');
        canvas.className = 'component-postcropper-tool-canvas';
        canvas.width = 530;
        canvas.height = 530;
        previewWrap.appendChild(canvas);
        
        var zoomWrap = document.createElement('div');
        zoomWrap.className = 'component-postcropper-tool-zoom';
        var zoomLabel = document.createElement('label');
        zoomLabel.className = 'component-postcropper-tool-zoom-label';
        zoomLabel.textContent = 'Zoom';
        zoomInput = document.createElement('input');
        zoomInput.type = 'range';
        zoomInput.className = 'component-postcropper-tool-zoom-input';
        zoomInput.min = '1';
        zoomInput.max = '3';
        zoomInput.step = '0.01';
        zoomInput.value = '1';
        zoomWrap.appendChild(zoomLabel);
        zoomWrap.appendChild(zoomInput);
        
        var actions = document.createElement('div');
        actions.className = 'component-postcropper-tool-actions';
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'component-postcropper-tool-button component-postcropper-tool-button--cancel';
        cancelBtn.textContent = 'Cancel';
        saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'component-postcropper-tool-button component-postcropper-tool-button--save';
        saveBtn.textContent = 'Use Crop';
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        
        toolEl.appendChild(previewWrap);
        toolEl.appendChild(zoomWrap);
        toolEl.appendChild(actions);
        overlay.appendChild(toolEl);
        document.body.appendChild(overlay);
        
        // Events
        overlay.addEventListener('mousedown', function(e) {
            cropState.backdropMouseDown = (e.target === overlay);
        });
        toolEl.addEventListener('mousedown', function() {
            cropState.backdropMouseDown = false;
        });
        overlay.addEventListener('click', function(e) {
            if (e.target !== overlay) return;
            if (!cropState.backdropMouseDown) return;
            if (cropState.dragging) return;
            if (cropState.didDrag) {
                cropState.didDrag = false;
                cropState.backdropMouseDown = false;
                return;
            }
            cropState.backdropMouseDown = false;
            close();
        });
        
        cancelBtn.addEventListener('click', function() {
            close();
        });
        
        saveBtn.addEventListener('click', function() {
            save();
        });
        
        zoomInput.addEventListener('input', function() {
            var z = parseFloat(zoomInput.value || '1');
            if (!isFinite(z) || z <= 0) z = 1;
            if (z < cropState.minZoom) z = cropState.minZoom;
            cropState.zoom = z;
            draw();
        });
        
        // Drag to reposition
        canvas.addEventListener('mousedown', function(e) {
            cropState.dragging = true;
            cropState.didDrag = false;
            cropState.lastX = e.clientX;
            cropState.lastY = e.clientY;
        });
        
        window.addEventListener('mousemove', function(e) {
            if (!cropState.dragging) return;
            var dx = e.clientX - cropState.lastX;
            var dy = e.clientY - cropState.lastY;
            cropState.lastX = e.clientX;
            cropState.lastY = e.clientY;
            if (dx !== 0 || dy !== 0) {
                cropState.didDrag = true;
            }
            
            var rect = canvas.getBoundingClientRect();
            var scaleX = rect.width ? (canvas.width / rect.width) : 1;
            var scaleY = rect.height ? (canvas.height / rect.height) : 1;
            cropState.offsetX += dx * scaleX;
            cropState.offsetY += dy * scaleY;
            draw();
        });
        
        window.addEventListener('mouseup', function() {
            cropState.dragging = false;
        });
        
        // Touch support
        canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            var touch = e.touches[0];
            cropState.dragging = true;
            cropState.didDrag = false;
            cropState.lastX = touch.clientX;
            cropState.lastY = touch.clientY;
            e.preventDefault();
        }, { passive: false });
        
        window.addEventListener('touchmove', function(e) {
            if (!cropState.dragging || e.touches.length !== 1) return;
            var touch = e.touches[0];
            var dx = touch.clientX - cropState.lastX;
            var dy = touch.clientY - cropState.lastY;
            cropState.lastX = touch.clientX;
            cropState.lastY = touch.clientY;
            if (dx !== 0 || dy !== 0) {
                cropState.didDrag = true;
            }
            
            var rect = canvas.getBoundingClientRect();
            var scaleX = rect.width ? (canvas.width / rect.width) : 1;
            var scaleY = rect.height ? (canvas.height / rect.height) : 1;
            cropState.offsetX += dx * scaleX;
            cropState.offsetY += dy * scaleY;
            draw();
        }, { passive: true });
        
        window.addEventListener('touchend', function() {
            cropState.dragging = false;
        });
    }
    
    function draw() {
        if (!cropImg || !canvas) return;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        var cw = canvas.width;
        var ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);
        
        var iw = cropImg.naturalWidth || cropImg.width;
        var ih = cropImg.naturalHeight || cropImg.height;
        if (!iw || !ih) return;
        
        // Cover-only zoom (no blank areas)
        var cover = Math.max(cw / iw, ch / ih);
        var scale = cover * (cropState.zoom || 1);
        var drawW = iw * scale;
        var drawH = ih * scale;
        
        var baseX = (cw - drawW) / 2;
        var baseY = (ch - drawH) / 2;
        var offX = cropState.offsetX || 0;
        var offY = cropState.offsetY || 0;
        
        // Clamp offsets so the image always fully covers the crop square
        if (drawW <= cw) {
            offX = 0;
        } else {
            var minOffX = baseX;
            var maxOffX = -baseX;
            if (offX < minOffX) offX = minOffX;
            if (offX > maxOffX) offX = maxOffX;
        }
        if (drawH <= ch) {
            offY = 0;
        } else {
            var minOffY = baseY;
            var maxOffY = -baseY;
            if (offY < minOffY) offY = minOffY;
            if (offY > maxOffY) offY = maxOffY;
        }
        
        cropState.offsetX = offX;
        cropState.offsetY = offY;
        
        var x = baseX + offX;
        var y = baseY + offY;
        ctx.drawImage(cropImg, x, y, drawW, drawH);
    }
    
    function computeCropRect() {
        if (!cropImg || !canvas) return null;
        
        var iw = cropImg.naturalWidth || cropImg.width;
        var ih = cropImg.naturalHeight || cropImg.height;
        var cw = canvas.width;
        var ch = canvas.height;
        if (!iw || !ih || !cw || !ch) return null;
        
        var cover = Math.max(cw / iw, ch / ih);
        var scale = cover * (cropState.zoom || 1);
        var drawW = iw * scale;
        var drawH = ih * scale;
        var baseX = (cw - drawW) / 2;
        var baseY = (ch - drawH) / 2;
        var x = baseX + (cropState.offsetX || 0);
        var y = baseY + (cropState.offsetY || 0);
        
        // Map full canvas to image coords
        var x1 = (0 - x) / scale;
        var y1 = (0 - y) / scale;
        var x2 = (cw - x) / scale;
        var y2 = (ch - y) / scale;
        
        // Clamp to image bounds
        x1 = Math.max(0, Math.min(iw, x1));
        y1 = Math.max(0, Math.min(ih, y1));
        x2 = Math.max(0, Math.min(iw, x2));
        y2 = Math.max(0, Math.min(ih, y2));
        
        return {
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2)
        };
    }
    
    // Open with image URL and optional initial crop state
    // options: { url, cropState?, callback }
    function open(options) {
        options = options || {};
        var url = options.url || '';
        var initialCropState = options.cropState || null;
        currentCallback = options.callback || null;
        currentImageUrl = url;
        
        if (!url) {
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError('No image URL provided.');
            }
            return;
        }
        
        ensureOverlay();
        
        cropImg = new Image();
        cropImg.onload = function() {
            // Set crop state from initial or reset
            if (initialCropState) {
                cropState.zoom = initialCropState.zoom || 1;
                cropState.offsetX = initialCropState.offsetX || 0;
                cropState.offsetY = initialCropState.offsetY || 0;
            } else {
                cropState.zoom = 1;
                cropState.offsetX = 0;
                cropState.offsetY = 0;
            }
            cropState.minZoom = 1;
            
            if (zoomInput) {
                zoomInput.min = '1';
                zoomInput.value = String(cropState.zoom);
            }
            
            draw();
            overlay.hidden = false;
            overlay.setAttribute('aria-hidden', 'false');
        };
        cropImg.onerror = function() {
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError('Failed to load image.');
            }
        };
        cropImg.src = url;
    }
    
    function close() {
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        cropImg = null;
        currentCallback = null;
        currentImageUrl = null;
    }
    
    function save() {
        var cropRect = computeCropRect();
        
        if (currentCallback && typeof currentCallback === 'function') {
            currentCallback({
                cropRect: cropRect,
                cropState: {
                    zoom: cropState.zoom,
                    offsetX: cropState.offsetX,
                    offsetY: cropState.offsetY
                }
            });
        }
        
        close();
    }
    
    function isOpen() {
        return overlay && !overlay.hidden;
    }
    
    return {
        open: open,
        close: close,
        isOpen: isOpen
    };
})();


// Expose globally
window.AvatarCropperComponent = AvatarCropperComponent;
window.AvatarPickerComponent = AvatarPickerComponent;
window.PostCropperComponent = PostCropperComponent;
window.ClearButtonComponent = ClearButtonComponent;
window.SwitchComponent = SwitchComponent;
window.FieldsetBuilder = FieldsetBuilder;
window.CalendarComponent = CalendarComponent;
window.CurrencyComponent = CurrencyComponent;
window.LanguageMenuComponent = LanguageMenuComponent;
window.PhonePrefixComponent = PhonePrefixComponent;
window.CountryComponent = CountryComponent;
window.MemberAuthFieldsetsComponent = MemberAuthFieldsetsComponent;
window.IconPickerComponent = IconPickerComponent;
window.SystemImagePickerComponent = SystemImagePickerComponent;
window.AmenitiesMenuComponent = AmenitiesMenuComponent;
window.MapControlRowComponent = MapControlRowComponent;
window.CheckoutOptionsComponent = CheckoutOptionsComponent;
window.ConfirmDialogComponent = ConfirmDialogComponent;
window.ThreeButtonDialogComponent = ThreeButtonDialogComponent;
window.ToastComponent = ToastComponent;
window.WelcomeModalComponent = WelcomeModalComponent;
window.ImageAddTileComponent = ImageAddTileComponent;
window.BottomSlack = BottomSlack;
window.TopSlack = TopSlack;


