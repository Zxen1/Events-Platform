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
                menu.querySelector('input.admin-currency-button-input') ||
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
   FIELDSETS
   Source: fieldset-test.html
   ============================================================================ */

const FieldsetComponent = (function(){
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
            throw new Error('FieldsetComponent.buildFieldset: options parameter is required');
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
                if (child.classList.contains('fieldset-currency-compact')) child.classList.add('fieldset-row-item--currency-compact');
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
        switch (key) {
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
                
            case 'text-box':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip, minLength, maxLength));
                var textBoxInput = document.createElement('input');
                textBoxInput.type = 'text';
                textBoxInput.className = 'fieldset-input';
                applyPlaceholder(textBoxInput, placeholder);
                var textBoxValidation = addInputValidation(textBoxInput, minLength, maxLength, null);
                fieldset.appendChild(textBoxInput);
                fieldset.appendChild(textBoxValidation.charCount);
                break;
                
            case 'text-area':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip, minLength, maxLength));
                var editableTextarea = document.createElement('textarea');
                editableTextarea.className = 'fieldset-textarea';
                applyPlaceholder(editableTextarea, placeholder);
                var textareaValidation = addInputValidation(editableTextarea, minLength, maxLength, null);
                fieldset.appendChild(editableTextarea);
                fieldset.appendChild(textareaValidation.charCount);
                break;
                
            case 'dropdown':
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip, minLength, maxLength));
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
                fieldset.appendChild(buildLabel(name + ' (editable)', tooltip, minLength, maxLength));
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
                // Cropper (avatar-style UI), non-destructive for post images.
                // Uses Bunny Dynamic Image API crop params later (server-side + cached).
                // ------------------------------------------------------------------

                var cropper = {
                    overlay: null,
                    dialog: null,
                    canvas: null,
                    zoomInput: null,
                    cancelBtn: null,
                    saveBtn: null,
                    img: null,
                    activeEntry: null,
                    state: {
                        zoom: 1,
                        offsetX: 0,
                        offsetY: 0,
                        dragging: false,
                        lastX: 0,
                        lastY: 0,
                        didDrag: false,
                        backdropMouseDown: false
                    }
                };

                function ensureCropper() {
                    if (cropper.overlay) return;

                    var overlay = document.createElement('div');
                    overlay.className = 'member-avatar-cropper';
                    overlay.hidden = true;
                    overlay.setAttribute('aria-hidden', 'true');

                    var dialog = document.createElement('div');
                    dialog.className = 'member-avatar-cropper-dialog';
                    dialog.setAttribute('role', 'dialog');
                    dialog.setAttribute('aria-modal', 'true');
                    dialog.setAttribute('aria-label', 'Crop image');

                    var previewWrap = document.createElement('div');
                    previewWrap.className = 'member-avatar-cropper-preview-wrap';
                    var canvas = document.createElement('canvas');
                    canvas.className = 'member-avatar-cropper-canvas';
                    canvas.width = 530;
                    canvas.height = 530;
                    previewWrap.appendChild(canvas);

                    var zoomLabel = document.createElement('label');
                    zoomLabel.className = 'member-auth-panel-label';
                    zoomLabel.textContent = 'Zoom';

                    var zoomInput = document.createElement('input');
                    zoomInput.type = 'range';
                    zoomInput.className = 'member-avatar-cropper-zoom-input';
                    zoomInput.min = '1';
                    zoomInput.max = '3';
                    zoomInput.step = '0.01';
                    zoomInput.value = '1';

                    var actions = document.createElement('div');
                    actions.className = 'member-avatar-cropper-actions';
                    var cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'member-button-auth';
                    cancelBtn.textContent = 'Cancel';
                    var saveBtn = document.createElement('button');
                    saveBtn.type = 'button';
                    saveBtn.className = 'member-button-auth';
                    saveBtn.textContent = 'Use Crop';
                    actions.appendChild(cancelBtn);
                    actions.appendChild(saveBtn);

                    dialog.appendChild(previewWrap);
                    dialog.appendChild(zoomLabel);
                    dialog.appendChild(zoomInput);
                    dialog.appendChild(actions);
                    overlay.appendChild(dialog);
                    document.body.appendChild(overlay);

                    cropper.overlay = overlay;
                    cropper.dialog = dialog;
                    cropper.canvas = canvas;
                    cropper.zoomInput = zoomInput;
                    cropper.cancelBtn = cancelBtn;
                    cropper.saveBtn = saveBtn;

                    // Events
                    // Backdrop close: only when the user deliberately clicks the backdrop (mouse down + mouse up on backdrop),
                    // and never as a side-effect of dragging the image around.
                    overlay.addEventListener('mousedown', function(e) {
                        cropper.state.backdropMouseDown = (e.target === overlay);
                    });
                    dialog.addEventListener('mousedown', function() {
                        cropper.state.backdropMouseDown = false;
                    });
                    overlay.addEventListener('click', function(e) {
                        if (e.target !== overlay) return;
                        if (!cropper.state.backdropMouseDown) return;
                        if (cropper.state.dragging) return;
                        if (cropper.state.didDrag) {
                            cropper.state.didDrag = false;
                            cropper.state.backdropMouseDown = false;
                            return;
                        }
                        cropper.state.backdropMouseDown = false;
                        closeCropper(false);
                    });

                    cancelBtn.addEventListener('click', function() {
                        closeCropper(false);
                    });

                    saveBtn.addEventListener('click', function() {
                        saveCropForActiveEntry();
                    });

                    zoomInput.addEventListener('input', function() {
                        var z = parseFloat(zoomInput.value || '1');
                        if (!isFinite(z) || z <= 0) z = 1;
                        if (z < 1) z = 1;
                        cropper.state.zoom = z;
                        drawCropper();
                    });

                    // Drag to reposition
                    canvas.addEventListener('mousedown', function(e) {
                        cropper.state.dragging = true;
                        cropper.state.didDrag = false;
                        cropper.state.lastX = e.clientX;
                        cropper.state.lastY = e.clientY;
                    });
                    window.addEventListener('mousemove', function(e) {
                        if (!cropper.state.dragging) return;
                        var dx = e.clientX - cropper.state.lastX;
                        var dy = e.clientY - cropper.state.lastY;
                        cropper.state.lastX = e.clientX;
                        cropper.state.lastY = e.clientY;
                        if (dx !== 0 || dy !== 0) {
                            cropper.state.didDrag = true;
                        }

                        var rect = canvas.getBoundingClientRect();
                        var scaleX = rect.width ? (canvas.width / rect.width) : 1;
                        var scaleY = rect.height ? (canvas.height / rect.height) : 1;
                        cropper.state.offsetX += dx * scaleX;
                        cropper.state.offsetY += dy * scaleY;
                        drawCropper();
                    });
                    window.addEventListener('mouseup', function() {
                        cropper.state.dragging = false;
                    });
                }

                function openCropperForEntry(entry) {
                    if (!entry || !entry.fileUrl) return;
                    ensureCropper();

                    cropper.activeEntry = entry;
                    cropper.state.zoom = (entry.cropState && typeof entry.cropState.zoom === 'number') ? entry.cropState.zoom : 1;
                    cropper.state.offsetX = (entry.cropState && typeof entry.cropState.offsetX === 'number') ? entry.cropState.offsetX : 0;
                    cropper.state.offsetY = (entry.cropState && typeof entry.cropState.offsetY === 'number') ? entry.cropState.offsetY : 0;
                    cropper.zoomInput.value = String(cropper.state.zoom);

                    cropper.img = new Image();
                    cropper.img.onload = function() {
                        drawCropper();
                        cropper.overlay.hidden = false;
                        cropper.overlay.setAttribute('aria-hidden', 'false');
                    };
                    cropper.img.onerror = function() {
                        cropper.img = null;
                        throw new Error('Images fieldset cropper: failed to load image for cropping.');
                    };
                    cropper.img.src = entry.fileUrl;
                }

                function closeCropper(save) {
                    if (!cropper.overlay) return;
                    cropper.overlay.hidden = true;
                    cropper.overlay.setAttribute('aria-hidden', 'true');
                    cropper.activeEntry = null;
                    cropper.img = null;
                }

                function drawCropper() {
                    if (!cropper.canvas || !cropper.img) return;
                    var ctx = cropper.canvas.getContext('2d');
                    if (!ctx) throw new Error('Images fieldset cropper: canvas 2D context unavailable.');

                    var cw = cropper.canvas.width;
                    var ch = cropper.canvas.height;
                    ctx.clearRect(0, 0, cw, ch);

                    var iw = cropper.img.naturalWidth || cropper.img.width;
                    var ih = cropper.img.naturalHeight || cropper.img.height;
                    if (!iw || !ih) return;

                    // Cover-only zoom (no blank areas)
                    var cover = Math.max(cw / iw, ch / ih);
                    var scale = cover * (cropper.state.zoom || 1);
                    var drawW = iw * scale;
                    var drawH = ih * scale;

                    var baseX = (cw - drawW) / 2;
                    var baseY = (ch - drawH) / 2;

                    var offX = cropper.state.offsetX || 0;
                    var offY = cropper.state.offsetY || 0;

                    // Clamp offsets so the image always fully covers the crop square (no blank areas).
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

                    cropper.state.offsetX = offX;
                    cropper.state.offsetY = offY;

                    var x = baseX + offX;
                    var y = baseY + offY;
                    ctx.drawImage(cropper.img, x, y, drawW, drawH);
                }

                function computeCropRectFromState(img, canvas, state) {
                    var iw = img.naturalWidth || img.width;
                    var ih = img.naturalHeight || img.height;
                    var cw = canvas.width;
                    var ch = canvas.height;
                    if (!iw || !ih || !cw || !ch) return null;

                    var cover = Math.max(cw / iw, ch / ih);
                    var scale = cover * (state.zoom || 1);
                    var drawW = iw * scale;
                    var drawH = ih * scale;
                    var baseX = (cw - drawW) / 2;
                    var baseY = (ch - drawH) / 2;
                    var x = baseX + (state.offsetX || 0);
                    var y = baseY + (state.offsetY || 0);

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

                    // Ensure integer pixel crop
                    return {
                        x1: Math.round(x1),
                        y1: Math.round(y1),
                        x2: Math.round(x2),
                        y2: Math.round(y2)
                    };
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

                function saveCropForActiveEntry() {
                    if (!cropper.activeEntry || !cropper.img || !cropper.canvas) return;

                    var entry = cropper.activeEntry;
                    entry.cropState = {
                        zoom: cropper.state.zoom,
                        offsetX: cropper.state.offsetX,
                        offsetY: cropper.state.offsetY
                    };

                    var rect = computeCropRectFromState(cropper.img, cropper.canvas, cropper.state);
                    entry.cropRect = rect;

                    updateImagesMeta();
                    closeCropper(true);
                    renderEntryPreviewFromCrop(entry);
                }
                
                function renderImages() {
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
                        // Notify listeners (member checkout pricing needs final session date per location)
                        try {
                            fieldset.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true }));
                        } catch (e) {}
                    }
                });
                
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
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var input = document.createElement('input');
                input.type = 'text';
                input.className = 'fieldset-input';
                applyPlaceholder(input, placeholder);
                var validation = addInputValidation(input, minLength, maxLength, null);
                fieldset.appendChild(input);
                fieldset.appendChild(validation.charCount);
        }
        
        return fieldset;
    }
    
    // NOTE: No auto-load at script startup (performance). Callers should call
    // FieldsetComponent.loadFromDatabase() before building fieldsets that need picklists.
    
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
        var arrow = menu.querySelector('.fieldset-menu-button-arrow');

        // Compact variant styling (no descendant selectors)
        btn.classList.add('fieldset-menu-button--compact');
        btnInput.classList.add('fieldset-menu-button-input--compact');
        opts.classList.add('fieldset-menu-options--compact');

        // Compact variant styling (no descendant selectors)
        btn.classList.add('fieldset-menu-button--compact');
        btnInput.classList.add('fieldset-menu-button-input--compact');
        opts.classList.add('fieldset-menu-options--compact');

        function applyOpenState(isOpen) {
            menu.classList.toggle('fieldset-menu--open', !!isOpen);
            btn.classList.toggle('fieldset-menu-button--open', !!isOpen);
            arrow.classList.toggle('fieldset-menu-button-arrow--open', !!isOpen);
            opts.classList.toggle('fieldset-menu-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('fieldset-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;
        var arrow = menu.querySelector('.fieldset-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('fieldset-menu--open', !!isOpen);
            btn.classList.toggle('fieldset-menu-button--open', !!isOpen);
            arrow.classList.toggle('fieldset-menu-button-arrow--open', !!isOpen);
            opts.classList.toggle('fieldset-menu-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('fieldset-menu--open');
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

        // Data must be loaded BEFORE building menu (via FieldsetComponent.setPicklist)
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
                if (!menu.classList.contains('fieldset-menu--open')) {
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

        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('fieldset-menu--open')) {
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
        menu.innerHTML = '<div class="admin-currency-button"><img class="admin-currency-button-flag" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="admin-currency-button-input" placeholder="Select currency" autocomplete="off"><span class="admin-currency-button-arrow">▼</span></div><div class="admin-currency-options"></div>';
        
        var btn = menu.querySelector('.admin-currency-button');
        var opts = menu.querySelector('.admin-currency-options');
        var btnImg = menu.querySelector('.admin-currency-button-flag');
        var btnInput = menu.querySelector('.admin-currency-button-input');
        var arrow = menu.querySelector('.admin-currency-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('admin-currency-wrapper--open', !!isOpen);
            btn.classList.toggle('admin-currency-button--open', !!isOpen);
            arrow.classList.toggle('admin-currency-button-arrow--open', !!isOpen);
            opts.classList.toggle('admin-currency-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('admin-currency-wrapper--open');
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
            op.className = 'admin-currency-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="admin-currency-option-flag" src="' + flagUrl + '" alt=""><span class="admin-currency-option-text">' + displayText + '</span>';
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
                if (!menu.classList.contains('admin-currency-wrapper--open')) {
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
            if (!menu.classList.contains('admin-currency-wrapper--open')) applyOpenState(true);
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
            if (menu.classList.contains('admin-currency-wrapper--open')) {
                menuArrowKeyNav(e, opts, '.admin-currency-option', function(opt) { opt.click(); });
            }
        });
        
        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            // Small delay to allow option click to fire first
            setTimeout(function() {
                if (!menu.classList.contains('admin-currency-wrapper--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('admin-currency-wrapper--open')) {
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

        // Data must be loaded BEFORE building menu (via FieldsetComponent.setPicklist)
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
                applyOpenState(false);
                filterOptions('');
                onSelect(code, item.label, item.filename);
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
                if (optionIndex === 0) radio30.checked = true;
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
                var days = e.target.dataset.days ? parseInt(e.target.dataset.days, 10) : calculatedDays;
                var price = e.target.dataset.price ? parseFloat(e.target.dataset.price) : null;
                onSelect(optionId, days, price);
            }
        });
        syncSelectedStyles();
        
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
                            if (idx === 0 && !group.querySelector('input[type="radio"]:checked')) {
                                radio.checked = true;
                            }
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
   BUTTON ANCHOR BOTTOM
   Prevents "clicked button flies away" when collapsible content above closes.
   Self-contained: injects required slack CSS and creates the slack element if missing.
   ============================================================================ */

const ButtonAnchorBottom = (function() {
    var STYLE_ID = 'button-anchor-bottom-style';
    var attached = new WeakMap(); // scrollEl -> controller
    var registered = []; // [{ panelEl, scrollEl, controller }]
    var tabListenerInstalled = false;
    
    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent =
                '.panel-bottom-slack{' +
                'height:var(--panel-bottom-slack,0px);' +
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
        try { slackEl = scrollEl.querySelector('.panel-bottom-slack'); } catch (e) { slackEl = null; }
        if (slackEl) return slackEl;
        try {
            slackEl = document.createElement('div');
            slackEl.className = 'panel-bottom-slack';
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
            throw new Error('ButtonAnchorBottom.attach: scrollEl must be an Element');
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
            scrollEl.style.setProperty('--panel-bottom-slack', String(px) + 'px');
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
                        var wrap = t.closest('.fieldset-menu.fieldset-menu--open, .admin-currency-wrapper.admin-currency-wrapper--open, .admin-language-wrapper.admin-language-wrapper--open');
                        if (wrap) {
                            var opts = wrap.querySelector('.fieldset-menu-options--open, .admin-currency-options--open, .admin-language-options--open') ||
                                       wrap.querySelector('.fieldset-menu-options, .admin-currency-options, .admin-language-options');
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
        function holdClickSlack() {
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
   BUTTON ANCHOR TOP
   Prevents "clicked button flies away" when collapsible content above changes near the TOP edge.
   Opposite of ButtonAnchorBottom:
   - Uses a TOP slack element + CSS var: --panel-top-slack
   - Blocks UPWARD scrolling while the top spacer is on-screen
   ============================================================================ */

const ButtonAnchorTop = (function() {
    var STYLE_ID = 'button-anchor-top-style';
    var attached = new WeakMap(); // scrollEl -> controller
    var registered = []; // [{ panelEl, scrollEl, controller }]
    var tabListenerInstalled = false;
    
    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent =
                '.panel-top-slack{' +
                'height:var(--panel-top-slack,0px);' +
                'flex:0 0 auto;' +
                'pointer-events:none;' +
                'transition:none;' +
                '}';
            document.head.appendChild(style);
        } catch (e) {}
    }
    
    function ensureSlackEl(scrollEl) {
        var slackEl = null;
        try { slackEl = scrollEl.querySelector('.panel-top-slack'); } catch (e) { slackEl = null; }
        if (slackEl) return slackEl;
        try {
            slackEl = document.createElement('div');
            slackEl.className = 'panel-top-slack';
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
            throw new Error('ButtonAnchorTop.attach: scrollEl must be an Element');
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
                    scrollEl.style.setProperty('--panel-top-slack', String(px) + 'px');
                    scrollEl.scrollTop = (scrollEl.scrollTop || 0) + (px - oldPx);
                } else {
                    scrollEl.style.setProperty('--panel-top-slack', String(px) + 'px');
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


// Expose globally
window.ClearButtonComponent = ClearButtonComponent;
window.SwitchComponent = SwitchComponent;
window.FieldsetComponent = FieldsetComponent;
window.CalendarComponent = CalendarComponent;
window.CurrencyComponent = CurrencyComponent;
window.LanguageMenuComponent = LanguageMenuComponent;
window.PhonePrefixComponent = PhonePrefixComponent;
window.CountryComponent = CountryComponent;
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
window.ButtonAnchorBottom = ButtonAnchorBottom;
window.ButtonAnchorTop = ButtonAnchorTop;

