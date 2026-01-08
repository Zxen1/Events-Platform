/* ============================================================================
   FIELDSETS.JS - Form Field Builder
   ============================================================================
   
   Form building system used across admin and member panels.
   
   ============================================================================ */

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
        
        // Insert dropdown after input element
        var parent = inputElement.parentNode;
        if (parent) {
            parent.appendChild(dropdown);
        }
        
        // Keyboard navigation
        var dropdownItems = [];
        var activeIndex = -1;
        function dropdownIsOpen() {
            return dropdown && dropdown.style && dropdown.style.display !== 'none';
        }
        function closeDropdown() {
            dropdown.style.display = 'none';
            dropdownItems = [];
            activeIndex = -1;
            try { if (parent) parent.classList.remove('fieldset-location-inputwrap--open'); } catch (e0) {}
        }
        function setActiveIndex(nextIdx) {
            if (!dropdownItems || dropdownItems.length === 0) {
                activeIndex = -1;
                return;
            }
            var i = nextIdx;
            if (i < 0) i = dropdownItems.length - 1;
            if (i >= dropdownItems.length) i = 0;
            activeIndex = i;
            dropdownItems.forEach(function(el, idx) {
                try { el.classList.toggle('fieldset-location-dropdown-item--active', idx === activeIndex); } catch (e) {}
            });
            try {
                var el0 = dropdownItems[activeIndex];
                if (el0 && typeof el0.scrollIntoView === 'function') el0.scrollIntoView({ block: 'nearest' });
            } catch (e2) {}
        }
        function selectActive() {
            if (!dropdownItems || dropdownItems.length === 0) return false;
            if (activeIndex < 0) setActiveIndex(0);
            var el = dropdownItems[activeIndex];
            if (!el) return false;
            try { el.click(); return true; } catch (e) { return false; }
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

        // Fetch suggestions using new API with type filtering
        var debounceTimer = null;
        async function fetchSuggestions(query) {
            if (!query || query.length < 2) {
                closeDropdown();
                return;
            }
            
            try {
                // Build request with type filtering based on the 'type' parameter
                var request = { input: query };
                
                // Map legacy type values to new API includedPrimaryTypes
                if (type === '(cities)') {
                    // Cities only - locality covers cities/towns, administrative_area_level_3 covers smaller municipalities
                    request.includedPrimaryTypes = ['locality', 'administrative_area_level_3', 'postal_town', 'sublocality_level_1'];
                } else if (type === 'address') {
                    // Street addresses only
                    request.includedPrimaryTypes = ['street_address', 'route', 'premise', 'subpremise'];
                } else if (type === 'establishment') {
                    // Businesses and points of interest
                    request.includedPrimaryTypes = ['establishment'];
                }
                // If type is not specified or unrecognized, no filtering is applied (all results)
                
                var response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                
                dropdown.innerHTML = '';
                dropdownItems = [];
                activeIndex = -1;
                
                if (!response || !response.suggestions || response.suggestions.length === 0) {
                    closeDropdown();
                    return;
                }
                
                response.suggestions.forEach(function(suggestion) {
                    var prediction = suggestion.placePrediction;
                    if (!prediction) return;
                    
                    var item = document.createElement('div');
                    item.className = 'fieldset-location-dropdown-item';
                    item.addEventListener('mouseenter', function() {
                        var idx = dropdownItems.indexOf(item);
                        if (idx >= 0) setActiveIndex(idx);
                    });
                    
                    var mainText = prediction.mainText ? prediction.mainText.text : (prediction.text ? prediction.text.text : '');
                    var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                    
                    item.innerHTML = 
                        '<div class="fieldset-location-dropdown-item-main">' + mainText + '</div>' +
                        (secondaryText ? '<div class="fieldset-location-dropdown-item-secondary">' + secondaryText + '</div>' : '');
                    
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
                                // Also notify listeners bound to lat/lng fields (e.g. wallpaper)
                                try { if (latInput) latInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e5) {}
                                try { if (lngInput) lngInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e6) {}
                                
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
                    dropdownItems.push(item);
                });
                
                dropdown.style.display = 'block';
                try { if (parent) parent.classList.add('fieldset-location-inputwrap--open'); } catch (e0c) {}
                setActiveIndex(0);
            } catch (err) {
                console.error('Autocomplete error:', err);
                closeDropdown();
            }
        }
        
        // If the user types, the location is no longer confirmed (must pick from Google again).
        inputElement.addEventListener('input', function() {
            // Manual typing invalidates confirmation, but must not re-dispatch input (would recurse).
            clearConfirmedLocation(false);
            clearTimeout(debounceTimer);
            var query = inputElement.value.trim();
            
            if (query.length < 2) {
                closeDropdown();
                return;
            }
            
            debounceTimer = setTimeout(function() {
                fetchSuggestions(query);
            }, 300);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
                closeDropdown();
            }
        });
        
        inputElement.addEventListener('keydown', function(e) {
            var key = e && e.key ? e.key : '';
            if (!dropdownIsOpen()) return;
            if (!dropdownItems || dropdownItems.length === 0) return;
            if (key === 'ArrowDown') {
                try { e.preventDefault(); e.stopPropagation(); } catch (e0) {}
                setActiveIndex(activeIndex + 1);
                return;
            }
            if (key === 'ArrowUp') {
                try { e.preventDefault(); e.stopPropagation(); } catch (e1) {}
                setActiveIndex(activeIndex - 1);
                return;
            }
            if (key === 'Enter') {
                try { e.preventDefault(); e.stopPropagation(); } catch (e2) {}
                selectActive();
                return;
            }
            if (key === 'Escape') {
                try { e.preventDefault(); e.stopPropagation(); } catch (e3) {}
                closeDropdown();
                return;
            }
            if (key === 'Tab') {
                closeDropdown();
                return;
            }
        });
        
        // Return object with cleanup method
        return {
            destroy: function() {
                if (dropdown && dropdown.parentNode) {
                    dropdown.parentNode.removeChild(dropdown);
                }
                closeDropdown();
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
    
    // Build age rating menu - uses AgeRatingComponent
    function buildAgeRatingMenu(container) {
        if (typeof AgeRatingComponent === 'undefined') {
            console.error('[FieldsetBuilder] AgeRatingComponent not available');
            return document.createElement('div');
        }
        var result = AgeRatingComponent.buildMenu({
            initialValue: null,
            container: container
        });
        return result.element;
    }
    
    // Build label with required indicator (dot) and tooltip
    function buildLabel(name, tooltip, minLength, maxLength) {
        var label = document.createElement('div');
        label.className = 'fieldset-label';
        label.innerHTML = '<span class="fieldset-label-text">' + name + '</span><span class="fieldset-label-required">●</span>';
        
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
            label.appendChild(tip);

            // Full-width tooltip box (panel-width), toggled via CSS
            var tipBox = document.createElement('div');
            tipBox.className = 'fieldset-label-tooltipbox';
            tipBox.textContent = tooltipText;
            label.appendChild(tipBox);
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
        if (data && data['age-rating'] && typeof AgeRatingComponent !== 'undefined') {
            AgeRatingComponent.setData(data['age-rating']);
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
                // Use password settings from member_settings if provided
                var pwSettings = options.passwordSettings || null;
                var pwMinLength = pwSettings ? pwSettings.min_length : (minLength || 8);
                var pwMaxLength = pwSettings ? pwSettings.max_length : (maxLength || 128);
                
                // Build dynamic password requirements for tooltip
                var pwRequirements = [];
                pwRequirements.push(pwMinLength + '-' + pwMaxLength + ' characters');
                if (pwSettings) {
                    if (pwSettings.require_lowercase) pwRequirements.push('Lowercase letter (a-z)');
                    if (pwSettings.require_uppercase) pwRequirements.push('Uppercase letter (A-Z)');
                    if (pwSettings.require_number) pwRequirements.push('Number (0-9)');
                    if (pwSettings.require_symbol) pwRequirements.push('Special character (!@#$%^&*)');
                }
                
                // Build tooltip with custom text + requirements
                var pwTooltipText = tooltip || '';
                var pwRequirementsText = pwRequirements.join('\n');
                if (pwTooltipText) {
                    pwTooltipText = pwTooltipText + '\n──────────\n' + pwRequirementsText;
                } else {
                    pwTooltipText = pwRequirementsText;
                }
                
                // Build label with dynamic tooltip (pass null for min/max to prevent double display)
                fieldset.appendChild(buildLabel(name, pwTooltipText, null, null));
                
                // Store password settings on fieldset for computeComplete validation
                fieldset.dataset.pwMinLength = pwMinLength;
                fieldset.dataset.pwMaxLength = pwMaxLength;
                if (pwSettings) {
                    fieldset.dataset.pwRequireLowercase = pwSettings.require_lowercase ? '1' : '0';
                    fieldset.dataset.pwRequireUppercase = pwSettings.require_uppercase ? '1' : '0';
                    fieldset.dataset.pwRequireNumber = pwSettings.require_number ? '1' : '0';
                    fieldset.dataset.pwRequireSymbol = pwSettings.require_symbol ? '1' : '0';
                }
                
                var pwInput = document.createElement('input');
                pwInput.type = 'password';
                pwInput.className = 'fieldset-input';
                
                // Dynamic placeholder showing min length
                var pwPlaceholder = placeholder || ('Min ' + pwMinLength + ' characters');
                applyPlaceholder(pwInput, pwPlaceholder);
                
                // Use password settings for validation
                var pwValidation = addInputValidation(pwInput, pwMinLength, pwMaxLength, null);
                fieldset.appendChild(pwInput);
                fieldset.appendChild(pwValidation.charCount);
                break;

            case 'title':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'fieldset-input';
                titleInput.autocomplete = 'off';
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
                
                // Custom dropdown menu (no native <select> arrow). Uses MenuManager + animated ▼ arrow like Formbuilder menus.
                var cdPlaceholderText = (typeof placeholder === 'string') ? placeholder.trim() : '';
                var cdMenu = document.createElement('div');
                cdMenu.className = 'fieldset-customdropdown';
                cdMenu.dataset.value = '';
                
                var cdButton = document.createElement('button');
                cdButton.type = 'button';
                cdButton.className = 'fieldset-customdropdown-button form-preview-select';
                cdButton.dataset.value = '';
                
                var cdButtonText = document.createElement('span');
                cdButtonText.className = 'fieldset-customdropdown-button-text';
                cdButtonText.textContent = cdPlaceholderText;
                
                var cdArrow = document.createElement('span');
                cdArrow.className = 'fieldset-customdropdown-button-arrow';
                cdArrow.textContent = '▼';
                
                cdButton.appendChild(cdButtonText);
                cdButton.appendChild(cdArrow);
                cdMenu.appendChild(cdButton);
                
                var cdOptions = document.createElement('div');
                cdOptions.className = 'fieldset-customdropdown-options';
                cdMenu.appendChild(cdOptions);
                
                function cdApplyOpenState(isOpen) {
                    cdMenu.classList.toggle('fieldset-customdropdown--open', !!isOpen);
                    cdButton.classList.toggle('fieldset-customdropdown-button--open', !!isOpen);
                    cdArrow.classList.toggle('fieldset-customdropdown-button-arrow--open', !!isOpen);
                    cdOptions.classList.toggle('fieldset-customdropdown-options--open', !!isOpen);
                }
                
                cdMenu.__menuIsOpen = function() { return cdMenu.classList.contains('fieldset-customdropdown--open'); };
                cdMenu.__menuApplyOpenState = cdApplyOpenState;
                
                try {
                    if (window.MenuManager && typeof window.MenuManager.register === 'function') {
                        window.MenuManager.register(cdMenu);
                    }
                } catch (e0) {}
                
                function cdSetValue(v) {
                    var s = (v == null) ? '' : String(v);
                    cdMenu.dataset.value = s;
                    cdButton.dataset.value = s;
                    cdButtonText.textContent = s ? s : cdPlaceholderText;
                }
                
                function cdPick(v) {
                    cdSetValue(v);
                    cdApplyOpenState(false);
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                }
                
                if (Array.isArray(fieldOptions)) {
                    fieldOptions.forEach(function(opt) {
                        var label = String(opt == null ? '' : opt);
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'fieldset-customdropdown-option';
                        btn.textContent = label;
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            cdPick(label);
                        });
                        cdOptions.appendChild(btn);
                    });
                }
                
                cdButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var isOpen = cdMenu.classList.contains('fieldset-customdropdown--open');
                    try {
                        if (window.MenuManager && typeof window.MenuManager.closeAll === 'function') {
                            window.MenuManager.closeAll(cdMenu);
                        }
                    } catch (e2) {}
                    cdApplyOpenState(!isOpen);
                });
                
                fieldset.appendChild(cdMenu);
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
                
            case 'custom_checklist': // post_map_cards.custom_checklist
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                
                // Checkbox/checkmark icons from Admin Settings (system_images)
                function ccGetSystemIconUrl(settingKey) {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys[settingKey] ? String(sys[settingKey] || '').trim() : '';
                        if (!filename) return '';
                        return App.getImageUrl('systemImages', filename);
                    } catch (e0) {
                        return '';
                    }
                }
                
                var checkboxUrl = ccGetSystemIconUrl('icon_checkbox');
                var checkmarkUrl = ccGetSystemIconUrl('icon_checkmark');
                
                var checklist = document.createElement('div');
                checklist.className = 'fieldset-customchecklist';
                checklist.dataset.value = '[]'; // JSON array of selected labels
                
                function ccGetSelected() {
                    try {
                        var raw = String(checklist.dataset.value || '').trim();
                        var arr = raw ? JSON.parse(raw) : [];
                        return Array.isArray(arr) ? arr : [];
                    } catch (e1) {
                        return [];
                    }
                }
                
                function ccSetSelected(arr) {
                    try {
                        var clean = (Array.isArray(arr) ? arr : [])
                            .map(function(v){ return String(v || '').trim(); })
                            .filter(function(v){ return v !== ''; });
                        // de-dupe while preserving order
                        var seen = {};
                        var uniq = [];
                        clean.forEach(function(v){
                            var k = v.toLowerCase();
                            if (seen[k]) return;
                            seen[k] = true;
                            uniq.push(v);
                        });
                        checklist.dataset.value = JSON.stringify(uniq);
                    } catch (e2) {}
                }
                
                function ccSyncUi() {
                    var selected = ccGetSelected();
                    var sel = {};
                    selected.forEach(function(v){ sel[String(v).toLowerCase()] = true; });
                    var rows = checklist.querySelectorAll('.fieldset-customchecklist-row');
                    rows.forEach(function(row) {
                        var v = String(row.dataset.value || '').toLowerCase();
                        var isOn = !!sel[v];
                        row.classList.toggle('fieldset-customchecklist-row--selected', isOn);
                        var checkImg = row.querySelector('.fieldset-customchecklist-row-check');
                        if (checkImg) checkImg.style.display = isOn ? '' : 'none';
                    });
                }
                
                if (Array.isArray(fieldOptions)) {
                    fieldOptions.forEach(function(opt) {
                        var label = String(opt == null ? '' : opt).trim();
                        if (!label) return;
                        
                        var row = document.createElement('button');
                        row.type = 'button';
                        row.className = 'fieldset-customchecklist-row';
                        row.dataset.value = label;
                        
                        var boxWrap = document.createElement('span');
                        boxWrap.className = 'fieldset-customchecklist-row-box';
                        
                        var boxImg = document.createElement('img');
                        boxImg.className = 'fieldset-customchecklist-row-boximg';
                        boxImg.alt = '';
                        boxImg.src = checkboxUrl;
                        boxWrap.appendChild(boxImg);
                        
                        var checkImg = document.createElement('img');
                        checkImg.className = 'fieldset-customchecklist-row-check';
                        checkImg.alt = '';
                        checkImg.src = checkmarkUrl;
                        checkImg.style.display = 'none';
                        boxWrap.appendChild(checkImg);
                        
                        var text = document.createElement('span');
                        text.className = 'fieldset-customchecklist-row-text';
                        text.textContent = label;
                        
                        row.appendChild(boxWrap);
                        row.appendChild(text);
                        
                        row.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var selected = ccGetSelected();
                            var lower = label.toLowerCase();
                            var idx = -1;
                            for (var i0 = 0; i0 < selected.length; i0++) {
                                if (String(selected[i0] || '').toLowerCase() === lower) { idx = i0; break; }
                            }
                            if (idx >= 0) selected.splice(idx, 1);
                            else selected.push(label);
                            ccSetSelected(selected);
                            ccSyncUi();
                            try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e3) {}
                        });
                        
                        checklist.appendChild(row);
                    });
                }
                
                fieldset.appendChild(checklist);
                break;
                
            case 'email':
            case 'account_email':
            case 'public_email':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));
                var emailInput = document.createElement('input');
                emailInput.type = 'email';
                emailInput.className = 'fieldset-input';
                if (key === 'public_email') emailInput.autocomplete = 'off';
                applyPlaceholder(emailInput, placeholder);
                var emailValidation = addInputValidation(emailInput, minLength, maxLength, isValidEmail);
                fieldset.appendChild(emailInput);
                fieldset.appendChild(emailValidation.charCount);
                break;
                
            case 'public_phone':
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
                var addrWrap = document.createElement('div');
                addrWrap.className = 'fieldset-location-inputwrap';
                var addrInputEl = document.createElement('input');
                addrInputEl.type = 'text';
                addrInputEl.className = 'fieldset-input';
                applyPlaceholder(addrInputEl, placeholder);
                addrWrap.appendChild(addrInputEl);
                fieldset.appendChild(addrWrap);
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
                var cityWrap = document.createElement('div');
                cityWrap.className = 'fieldset-location-inputwrap';
                var cityInputEl = document.createElement('input');
                cityInputEl.type = 'text';
                cityInputEl.className = 'fieldset-input';
                applyPlaceholder(cityInputEl, placeholder);
                cityWrap.appendChild(cityInputEl);
                fieldset.appendChild(cityWrap);
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
                // IMAGE STORAGE FLOW:
                // 1. User crops here → cropRect {x1,y1,x2,y2} stored in hidden input (images_meta)
                // 2. On submit: ORIGINAL image uploaded, crop coords saved to post_media.settings_json
                // 3. Storage set by admin_settings.folder_post_images:
                //    - http/https path → external CDN (e.g. Bunny), ?crop= params for dynamic cropping
                //    - local path → server filesystem
                // 4. For CDN: first request processes crop & caches globally; subsequent = instant
                // 5. Each unique URL (class+crop combo) cached separately

                function imgGetSystemClearIconUrl() {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys.icon_clear ? String(sys.icon_clear || '').trim() : '';
                        if (!filename) return '';
                        return App.getImageUrl('systemImages', filename);
                    } catch (e) {
                        return '';
                    }
                }
                
                // Image validation settings (from admin_settings 400-402)
                var imageMinWidth = 1000;
                var imageMinHeight = 1000;
                var imageMaxSize = 5242880; // 5MB
                try {
                    if (window.adminSettings) {
                        if (window.adminSettings.image_min_width) imageMinWidth = parseInt(window.adminSettings.image_min_width, 10) || 1000;
                        if (window.adminSettings.image_min_height) imageMinHeight = parseInt(window.adminSettings.image_min_height, 10) || 1000;
                        if (window.adminSettings.image_max_size) imageMaxSize = parseInt(window.adminSettings.image_max_size, 10) || 5242880;
                    }
                } catch (e) {}
                
                // Build dynamic tooltip with image requirements
                var imageMaxMB = (imageMaxSize / 1024 / 1024).toFixed(0);
                var imageRequirements = 'Min ' + imageMinWidth + '×' + imageMinHeight + ' pixels\nMax ' + imageMaxMB + 'MB';
                var imageTooltipText = tooltip || '';
                if (imageTooltipText) {
                    imageTooltipText += '\n\n———\n' + imageRequirements;
                } else {
                    imageTooltipText = imageRequirements;
                }
                
                fieldset.appendChild(buildLabel(name, imageTooltipText, null, null));
                
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
                        thumb.className = 'fieldset-images-item';
                        // Native drag is disabled until a press-and-hold (no visible drag handle here).
                        thumb.draggable = false;
                        // Stable ID so we can rebuild imageEntries order from DOM order after drag.
                        if (entry && !entry._imageEntryId) {
                            entry._imageEntryId = String(nextImageEntryId++);
                        }
                        thumb.dataset.imageEntryId = entry ? entry._imageEntryId : '';
                        
                        var img = document.createElement('img');
                        img.className = 'fieldset-images-item-image';
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
                        removeBtn.className = 'fieldset-images-item-button-remove';
                        var clearIconUrl = imgGetSystemClearIconUrl();
                        if (clearIconUrl) {
                            var clearImg = document.createElement('img');
                            clearImg.className = 'fieldset-images-item-button-icon';
                            clearImg.alt = '';
                            clearImg.src = clearIconUrl;
                            removeBtn.appendChild(clearImg);
                        }
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
                            if (e && e.target && (e.target === removeBtn || (e.target.closest && e.target.closest('.fieldset-images-item-button-remove')))) {
                                return;
                            }
                            dragArmed = true;
                            thumb.draggable = true;
                            thumb.classList.add('fieldset-images-item--dragready');
                        }

                        function disarmDrag() {
                            dragArmed = false;
                            if (!thumb.classList.contains('fieldset-images-item--dragging')) {
                                thumb.draggable = false;
                                thumb.classList.remove('fieldset-images-item--dragready');
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
                            var siblings = Array.from(imagesContainer.querySelectorAll('.fieldset-images-item'));
                            dragStartIndex = siblings.indexOf(thumb);
                            if (e && e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                try { e.dataTransfer.setData('text/plain', thumb.dataset.imageEntryId || ''); } catch (err) {}
                            }
                            thumb.classList.add('fieldset-images-item--dragging');
                        });
                        thumb.addEventListener('dragend', function() {
                            thumb.classList.remove('fieldset-images-item--dragging');
                            thumb.classList.remove('fieldset-images-item--dragready');
                            thumb.draggable = false;
                            dragArmed = false;

                            // Rebuild imageEntries in the new DOM order (exclude the upload tile).
                            var orderedThumbs = Array.from(imagesContainer.querySelectorAll('.fieldset-images-item'));
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
                            var siblingsNow = Array.from(imagesContainer.querySelectorAll('.fieldset-images-item'));
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
                        uploadBox.className = 'fieldset-images-button-add';
                        uploadBox.innerHTML = ImageAddTileComponent.buildMarkup({
                            iconClass: 'fieldset-images-button-add-icon',
                            textClass: 'fieldset-images-button-add-text',
                            label: 'Add Image'
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
                    var dragging = imagesContainer.querySelector('.fieldset-images-item--dragging');
                    if (!dragging) return;

                    var px = (e && typeof e.clientX === 'number') ? e.clientX : 0;
                    var py = (e && typeof e.clientY === 'number') ? e.clientY : 0;

                    // Prefer the element under the cursor for intuitive drops.
                    var target = null;
                    if (document && typeof document.elementFromPoint === 'function') {
                        target = document.elementFromPoint(px, py);
                    }
                    var overThumb = target && target.closest ? target.closest('.fieldset-images-item') : null;
                    if (overThumb && overThumb === dragging) overThumb = null;

                    var thumbs = Array.from(imagesContainer.querySelectorAll('.fieldset-images-item'));
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
                
                function validateImageFile(file) {
                    return new Promise(function(resolve, reject) {
                        // Check file size first
                        if (file.size > imageMaxSize) {
                            var maxMB = (imageMaxSize / 1024 / 1024).toFixed(1);
                            reject('Image must be smaller than ' + maxMB + 'MB');
                            return;
                        }
                        
                        // Check dimensions
                        var img = new Image();
                        var objectUrl = URL.createObjectURL(file);
                        img.onload = function() {
                            URL.revokeObjectURL(objectUrl);
                            if (img.naturalWidth < imageMinWidth || img.naturalHeight < imageMinHeight) {
                                reject('Image must be at least ' + imageMinWidth + 'x' + imageMinHeight + ' pixels');
                            } else {
                                resolve();
                            }
                        };
                        img.onerror = function() {
                            URL.revokeObjectURL(objectUrl);
                            reject('Could not read image file');
                        };
                        img.src = objectUrl;
                    });
                }
                
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
                    var inputEl = this;
                    
                    // Process files sequentially with validation
                    var processNext = function(index) {
                        if (index >= files.length) {
                            try { fileInput._imageFiles = imageEntries.map(function(e){ return e && e.file ? e.file : null; }).filter(Boolean); } catch (e0) {}
                            updateImagesMeta();
                            renderImages();
                            inputEl.value = '';
                            return;
                        }
                        
                        var file = files[index];
                        if (imageEntries.length >= maxImages || !file.type.startsWith('image/')) {
                            processNext(index + 1);
                            return;
                        }
                        
                        validateImageFile(file).then(function() {
                            var fileUrl = URL.createObjectURL(file);
                            imageEntries.push({
                                _imageEntryId: String(nextImageEntryId++),
                                file: file,
                                fileUrl: fileUrl,
                                previewUrl: '',
                                cropState: null,
                                cropRect: null
                            });
                            processNext(index + 1);
                        }).catch(function(errorMsg) {
                            if (window.ToastComponent && ToastComponent.showError) {
                                ToastComponent.showError(errorMsg);
                            }
                            processNext(index + 1);
                        });
                    };
                    
                    processNext(0);
                });
                fieldset.appendChild(fileInput);
                fieldset.appendChild(imagesContainer);
                
                renderImages();
                break;
            
            case 'amenities':
                fieldset.appendChild(buildLabel(name, tooltip));
                var amenitiesGrid = document.createElement('div');
                amenitiesGrid.className = 'fieldset-amenities-container';
                
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
                    row.className = 'fieldset-amenities-row';
                    row.title = description; // Tooltip on hover
                    
                    // Icon (no wrapper, direct img element)
                    var amenityUrl = '';
                    if (filename) {
                        // Remove .svg extension if present (getImageUrl may add it, or filename may already include it)
                        var cleanFilename = filename.replace(/\.svg$/i, '');
                        amenityUrl = window.App.getImageUrl('amenities', cleanFilename + '.svg');
                    }
                    var iconImg = document.createElement('img');
                    iconImg.className = 'fieldset-amenities-row-image';
                    iconImg.src = amenityUrl;
                    iconImg.alt = amenityName;
                    row.appendChild(iconImg);
                    
                    // Name
                    var nameEl = document.createElement('div');
                    nameEl.className = 'fieldset-amenities-row-text';
                    nameEl.textContent = amenityName;
                    row.appendChild(nameEl);
                    
                    // Yes/No options
                    var optionsEl = document.createElement('div');
                    optionsEl.className = 'fieldset-amenities-row-options';
                    
                    // Use value as unique identifier for radio button names
                    var radioName = 'amenity-' + (item.value || i).replace(/[^a-z0-9]/gi, '-').toLowerCase();
                    
                    var yesLabel = document.createElement('label');
                    yesLabel.className = 'fieldset-amenities-option';
                    var yesRadio = document.createElement('input');
                    yesRadio.type = 'radio';
                    yesRadio.name = radioName;
                    yesRadio.value = '1';
                    yesRadio.className = 'fieldset-amenities-option-radio';
                    var yesText = document.createElement('span');
                    yesText.className = 'fieldset-amenities-option-text';
                    yesText.textContent = 'Yes';
                    yesLabel.appendChild(yesRadio);
                    yesLabel.appendChild(yesText);
                    optionsEl.appendChild(yesLabel);
                    
                    var noLabel = document.createElement('label');
                    noLabel.className = 'fieldset-amenities-option';
                    var noRadio = document.createElement('input');
                    noRadio.type = 'radio';
                    noRadio.name = radioName;
                    noRadio.value = '0';
                    noRadio.className = 'fieldset-amenities-option-radio';
                    var noText = document.createElement('span');
                    noText.className = 'fieldset-amenities-option-text';
                    noText.textContent = 'No';
                    noLabel.appendChild(noRadio);
                    noLabel.appendChild(noText);
                    optionsEl.appendChild(noLabel);
                    
                    // Add change listeners to update row styling
                    function setAmenityState(isYes) {
                        nameEl.classList.toggle('fieldset-amenities-row-text--no', !isYes);
                        iconImg.classList.toggle('fieldset-amenities-row-image--yes', !!isYes);
                        iconImg.classList.toggle('fieldset-amenities-row-image--no', !isYes);
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
            
            case 'age_rating':
                fieldset.appendChild(buildLabel(name, tooltip));
                fieldset.appendChild(buildAgeRatingMenu(container));
                break;
                
            case 'item-pricing':
                // Item Name, Currency, Item Price (full width), then list of variants
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength));

                function ipGetSystemPlusIconUrl() {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys.icon_plus ? String(sys.icon_plus || '').trim() : '';
                        if (!filename) return '';
                        return App.getImageUrl('systemImages', filename);
                    } catch (e) {
                        return '';
                    }
                }

                function ipGetSystemMinusIconUrl() {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys.icon_minus ? String(sys.icon_minus || '').trim() : '';
                        if (!filename) return '';
                        return App.getImageUrl('systemImages', filename);
                    } catch (e) {
                        return '';
                    }
                }

                // Item Name sublabel
                var itemNameSub = document.createElement('div');
                itemNameSub.className = 'fieldset-itempricing-sublabel-itemname';
                itemNameSub.textContent = 'Item Name';
                fieldset.appendChild(itemNameSub);
                
                // Item Name input
                var itemNameInput = document.createElement('input');
                itemNameInput.type = 'text';
                itemNameInput.className = 'fieldset-itempricing-input-itemname';
                itemNameInput.placeholder = 'eg. T-Shirt';
                fieldset.appendChild(itemNameInput);
                
                // Currency + Item Price row
                var itemPriceRow = document.createElement('div');
                itemPriceRow.className = 'fieldset-itempricing-row-itemprice';
                
                // Currency column (fixed width 100px)
                var itemCurrencyCol = document.createElement('div');
                itemCurrencyCol.style.flex = '0 0 100px';
                
                // Currency sublabel
                var itemCurrencySub = document.createElement('div');
                itemCurrencySub.className = 'fieldset-itempricing-sublabel-currency';
                itemCurrencySub.textContent = 'Currency';
                itemCurrencyCol.appendChild(itemCurrencySub);
                
                // Build currency menu for item
                var initialCurrencyCode = defaultCurrency || null;
                if (typeof CurrencyComponent === 'undefined') {
                    console.error('[FieldsetBuilder] CurrencyComponent not available');
                    var placeholderMenu = document.createElement('div');
                    itemCurrencyCol.appendChild(placeholderMenu);
                } else {
                    var result = CurrencyComponent.buildCompactMenu({
                        initialValue: initialCurrencyCode,
                        onSelect: function(value, label, countryCode) {
                            // Currency selected for entire item
                        }
                    });
                    result.element.classList.add('fieldset-itempricing-menu-currency');
                    itemCurrencyCol.appendChild(result.element);
                }
                itemPriceRow.appendChild(itemCurrencyCol);
                
                // Item Price column (flexible width)
                var itemPriceCol = document.createElement('div');
                itemPriceCol.style.flex = '1';
                
                // Item Price sublabel
                var itemPriceSub = document.createElement('div');
                itemPriceSub.className = 'fieldset-itempricing-sublabel-itemprice';
                itemPriceSub.textContent = 'Item Price';
                itemPriceCol.appendChild(itemPriceSub);
                
                // Item Price input
                var itemPriceInput = document.createElement('input');
                itemPriceInput.type = 'text';
                itemPriceInput.className = 'fieldset-itempricing-input-itemprice';
                itemPriceInput.placeholder = '0.00';
                attachMoneyInputBehavior(itemPriceInput);
                itemPriceCol.appendChild(itemPriceInput);
                itemPriceRow.appendChild(itemPriceCol);
                applyFieldsetRowItemClasses(itemPriceRow);
                
                fieldset.appendChild(itemPriceRow);
                
                // Variants section sublabel
                var variantsSectionLabel = document.createElement('div');
                variantsSectionLabel.className = 'fieldset-itempricing-sublabel-itemvariants';
                variantsSectionLabel.textContent = 'Item Variants';
                fieldset.appendChild(variantsSectionLabel);
                
                // Variants container
                var itemVariantsContainer = document.createElement('div');
                itemVariantsContainer.className = 'fieldset-itempricing-container-itemvariants';
                fieldset.appendChild(itemVariantsContainer);
                
                function createItemVariantRow() {
                    // Single row element (no separate block wrapper)
                    var variantRow = document.createElement('div');
                    variantRow.className = 'fieldset-itempricing-row-itemvariant';
                    
                    // Variant name input
                    var variantInput = document.createElement('input');
                    variantInput.type = 'text';
                    variantInput.className = 'fieldset-itempricing-input-itemvariantname';
                    variantInput.placeholder = 'eg. Large Red';
                    variantRow.appendChild(variantInput);
                    
                    // + button
                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-itempricing-button-itemvariantadd';
                    var ipPlusIconUrl = ipGetSystemPlusIconUrl();
                    if (ipPlusIconUrl) {
                        var ipPlusImg = document.createElement('img');
                        ipPlusImg.className = 'fieldset-itempricing-button-icon fieldset-itempricing-button-icon--plus';
                        ipPlusImg.alt = '';
                        ipPlusImg.src = ipPlusIconUrl;
                        addBtn.appendChild(ipPlusImg);
                    }
                    addBtn.addEventListener('click', function() {
                        itemVariantsContainer.appendChild(createItemVariantRow());
                        updateItemVariantButtons();
                    });
                    variantRow.appendChild(addBtn);
                    
                    // - button
                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-itempricing-button-itemvariantremove';
                    var ipMinusIconUrl = ipGetSystemMinusIconUrl();
                    if (ipMinusIconUrl) {
                        var ipMinusImg = document.createElement('img');
                        ipMinusImg.className = 'fieldset-itempricing-button-icon fieldset-itempricing-button-icon--minus';
                        ipMinusImg.alt = '';
                        ipMinusImg.src = ipMinusIconUrl;
                        removeBtn.appendChild(ipMinusImg);
                    }
                    removeBtn.addEventListener('click', function() {
                        variantRow.remove();
                        updateItemVariantButtons();
                    });
                    variantRow.appendChild(removeBtn);
                    applyFieldsetRowItemClasses(variantRow);
                    
                    return variantRow;
                }
                
                function updateItemVariantButtons() {
                    var rows = itemVariantsContainer.querySelectorAll('.fieldset-itempricing-row-itemvariant');
                    var atMax = rows.length >= 10;
                    rows.forEach(function(row) {
                        var addBtn = row.querySelector('.fieldset-itempricing-button-itemvariantadd');
                        var removeBtn = row.querySelector('.fieldset-itempricing-button-itemvariantremove');
                        if (atMax) {
                            addBtn.style.opacity = '0.3';
                            addBtn.style.cursor = 'not-allowed';
                            addBtn.disabled = true;
                        } else {
                            addBtn.style.opacity = '1';
                            addBtn.style.cursor = 'pointer';
                            addBtn.disabled = false;
                        }
                        if (rows.length === 1) {
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
                
                // Create first variant row
                itemVariantsContainer.appendChild(createItemVariantRow());
                updateItemVariantButtons();
                break;
                
            case 'session_pricing':
                // Sessions + ticket-group popover (lettered groups, embedded pricing editor).
                var spLabelEl = buildLabel(name, tooltip, minLength, maxLength);
                fieldset.appendChild(spLabelEl);

                // Track selected dates:
                // { 'YYYY-MM-DD': { times: ['19:00', ...], edited: [true,false...], groups: ['','B',...] } }
                var spSessionData = {};

                // Ticket-group popover state
                var spTicketGroups = {}; // { A: itemEl, B: itemEl, ... } (itemEl has .fieldset-sessionpricing-ticketgroup-item)
                var spTicketGroupList = null; // container element for group list inside popover
                var spTicketMenuOpen = false;
                var spTicketMenuDocHandler = null;
                var spTicketMenuWinHandler = null;
                var spTicketMenuScrollEl = null;
                var spActivePicker = null; // { dateStr, idx, timeInput, ticketBtn, rowEl }

                var spOpenGroupKey = null;
                var spOpenGroupSnapshot = null; // pricing snapshot array

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

                function spGetSystemPlusIconUrl() {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys.icon_plus ? String(sys.icon_plus || '').trim() : '';
                        if (!filename) return '';
                        return App.getImageUrl('systemImages', filename);
                    } catch (e) {
                        return '';
                    }
                }

                function spGetSystemMinusIconUrl() {
                    try {
                        if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') return '';
                        var sys = App.getState('system_images') || {};
                        var filename = sys && sys.icon_minus ? String(sys.icon_minus || '').trim() : '';
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
                    // Default starting group is A (question-mark system remains for cleared/deleted cases)
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
                var spTicketCurrencyMenus = []; // [{ element, setValue }]

                function spSyncAllTicketCurrencies() {
                    spTicketCurrencyMenus.forEach(function(menuObj) {
                        try {
                            if (!menuObj || typeof menuObj.setValue !== 'function') return;
                            menuObj.setValue(spTicketCurrencyState.code || null);
                        } catch (e0) {}
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
                    spTicketCurrencyMenus.push(result);
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

                // --- Pricing editor builders ---
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
                    addBtn.className = 'fieldset-sessionpricing-pricing-button-add fieldset-row-item--no-flex';
                    var plusIconUrl = spGetSystemPlusIconUrl();
                    if (plusIconUrl) {
                        var plusImg = document.createElement('img');
                        plusImg.className = 'fieldset-sessionpricing-pricing-button-icon fieldset-sessionpricing-pricing-button-icon--plus';
                        plusImg.alt = '';
                        plusImg.src = plusIconUrl;
                        addBtn.appendChild(plusImg);
                    }
                    addBtn.addEventListener('click', function() {
                        tiersContainer.appendChild(spCreatePricingTierBlock(tiersContainer));
                        spUpdateTierButtons(tiersContainer);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    tierRow.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-sessionpricing-pricing-button-remove fieldset-row-item--no-flex';
                    var minusIconUrl = spGetSystemMinusIconUrl();
                    if (minusIconUrl) {
                        var minusImg = document.createElement('img');
                        minusImg.className = 'fieldset-sessionpricing-pricing-button-icon fieldset-sessionpricing-pricing-button-icon--minus';
                        minusImg.alt = '';
                        minusImg.src = minusIconUrl;
                        removeBtn.appendChild(minusImg);
                    }
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
                        var addBtn = block.querySelector('.fieldset-sessionpricing-pricing-button-add');
                        var removeBtn = block.querySelector('.fieldset-sessionpricing-pricing-button-remove');
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
                    addBtn.className = 'fieldset-sessionpricing-pricing-button-add fieldset-row-item--no-flex';
                    var plusIconUrl2 = spGetSystemPlusIconUrl();
                    if (plusIconUrl2) {
                        var plusImg2 = document.createElement('img');
                        plusImg2.className = 'fieldset-sessionpricing-pricing-button-icon fieldset-sessionpricing-pricing-button-icon--plus';
                        plusImg2.alt = '';
                        plusImg2.src = plusIconUrl2;
                        addBtn.appendChild(plusImg2);
                    }
                    addBtn.addEventListener('click', function() {
                        seatingAreasContainer.appendChild(spCreateSeatingAreaBlock(seatingAreasContainer));
                        spUpdateSeatingAreaButtons(seatingAreasContainer);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    seatRow.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-sessionpricing-pricing-button-remove fieldset-row-item--no-flex';
                    var minusIconUrl2 = spGetSystemMinusIconUrl();
                    if (minusIconUrl2) {
                        var minusImg2 = document.createElement('img');
                        minusImg2.className = 'fieldset-sessionpricing-pricing-button-icon fieldset-sessionpricing-pricing-button-icon--minus';
                        minusImg2.alt = '';
                        minusImg2.src = minusIconUrl2;
                        removeBtn.appendChild(minusImg2);
                    }
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
                        var addBtn = block.querySelector('.fieldset-sessionpricing-pricing-button-add');
                        var removeBtn = block.querySelector('.fieldset-sessionpricing-pricing-button-remove');
                        if (atMax) { addBtn.style.opacity = '0.3'; addBtn.style.cursor = 'not-allowed'; addBtn.disabled = true; }
                        else { addBtn.style.opacity = '1'; addBtn.style.cursor = 'pointer'; addBtn.disabled = false; }
                        if (blocks.length === 1) { removeBtn.style.opacity = '0.3'; removeBtn.style.cursor = 'not-allowed'; removeBtn.disabled = true; }
                        else { removeBtn.style.opacity = '1'; removeBtn.style.cursor = 'pointer'; removeBtn.disabled = false; }
                    });
                }

                // Calendar + sessions list
                function spGetDayOfWeek(dateStr) { return new Date(dateStr + 'T00:00:00').getDay(); }

                // Apply draft changes immediately to session data
                function spApplyDraft() {
                    if (!spDateDraft) return;
                    var draftKeys = Array.from(spDateDraft).sort();
                    var currentKeys = Object.keys(spSessionData).sort();
                    
                    // Remove deselected dates
                    currentKeys.forEach(function(k) {
                        if (!spDateDraft.has(k)) delete spSessionData[k];
                    });
                    
                    // Add newly selected dates
                    draftKeys.forEach(function(k) {
                        if (!spSessionData[k]) {
                            spEnsureDefaultGroup();
                            var autofillVal = spGetAutofillForSlot(k, 0);
                            spSessionData[k] = { times: [autofillVal], edited: [false], groups: ['A'] };
                        }
                    });
                    
                    spRenderSessions();
                    try { fieldset.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true })); } catch (e1) {}
                }

                // Single source of truth: use CalendarComponent (same calendar used elsewhere).
                var spCalContainer = document.createElement('div');
                spCalContainer.className = 'calendar-container fieldset-sessionpricing-calendar-container';
                var spCalendarInstance = CalendarComponent.create(spCalContainer, {
                    monthsPast: 0,
                    monthsFuture: 24,
                    allowPast: false,
                    showActions: false,
                    selectionMode: 'multi',
                    onChange: function(_start, _end, dates) {
                        // Only track changes while the picker is open.
                        if (!spDatePickerOpen) return;
                        try {
                            spDateDraft = new Set(Array.isArray(dates) ? dates : []);
                        } catch (e0) {
                            spDateDraft = new Set();
                        }
                        // Apply changes immediately (no OK button needed)
                        spApplyDraft();
                    }
                });

                // Date picker pop-up (mirrors filter daterange behavior: OK / Cancel / click-away)
                var spDatePickerOpen = false;
                var spDateDraft = null; // Set of iso strings while popover is open
                var spDatePickerDocHandler = null;
                var spDatePickerAnchorEl = null;

                var spDatePickerPopover = document.createElement('div');
                spDatePickerPopover.className = 'fieldset-sessionpricing-calendar-popover';

                var spDatePickerBody = document.createElement('div');
                spDatePickerBody.className = 'fieldset-sessionpricing-calendar-popover-body';
                spDatePickerBody.appendChild(spCalContainer);

                // No OK/Cancel buttons - changes apply immediately
                spDatePickerPopover.appendChild(spDatePickerBody);
                // Attach inside the fieldset so it naturally scrolls with the panel (same model as the session picker originally).
                fieldset.appendChild(spDatePickerPopover);

                var spSessionsContainer = document.createElement('div');
                spSessionsContainer.className = 'fieldset-sessionpricing-sessions-container';
                fieldset.appendChild(spSessionsContainer);

                // Date selector row (shown even before any dates are selected)
                var spDatePickerRow = document.createElement('div');
                spDatePickerRow.className = 'fieldset-sessionpricing-session-row fieldset-sessionpricing-session-row--picker';
                var spDatePickerBox = document.createElement('div');
                spDatePickerBox.className = 'fieldset-sessionpricing-session-field-label fieldset-sessionpricing-session-field-label--picker';
                spDatePickerBox.setAttribute('role', 'button');
                spDatePickerBox.setAttribute('tabindex', '0');
                spDatePickerBox.setAttribute('aria-haspopup', 'dialog');
                spDatePickerBox.setAttribute('aria-expanded', 'false');
                spDatePickerBox.textContent = 'Select Dates';
                spDatePickerRow.appendChild(spDatePickerBox);
                
                // Make the initial row match real session rows: include disabled controls until dates exist.
                var spPickerTimeWrap = document.createElement('div');
                spPickerTimeWrap.className = 'fieldset-sessionpricing-session-field-time';
                var spPickerTimeInput = document.createElement('input');
                spPickerTimeInput.type = 'text';
                spPickerTimeInput.className = 'fieldset-sessionpricing-session-field-time-input';
                spPickerTimeInput.placeholder = 'HH:MM';
                spPickerTimeInput.maxLength = 5;
                spPickerTimeInput.disabled = true;
                spPickerTimeWrap.appendChild(spPickerTimeInput);
                spDatePickerRow.appendChild(spPickerTimeWrap);
                
                var spPickerAddBtn = document.createElement('button');
                spPickerAddBtn.type = 'button';
                spPickerAddBtn.className = 'fieldset-sessionpricing-session-button-add';
                var pickerPlusIconUrl = spGetSystemPlusIconUrl();
                if (pickerPlusIconUrl) {
                    var pickerPlusImg = document.createElement('img');
                    pickerPlusImg.className = 'fieldset-sessionpricing-session-button-icon fieldset-sessionpricing-session-button-icon--plus';
                    pickerPlusImg.alt = '';
                    pickerPlusImg.src = pickerPlusIconUrl;
                    spPickerAddBtn.appendChild(pickerPlusImg);
                }
                spPickerAddBtn.disabled = true;
                spPickerAddBtn.style.opacity = '0.3';
                spPickerAddBtn.style.cursor = 'not-allowed';
                spDatePickerRow.appendChild(spPickerAddBtn);
                
                var spPickerRemoveBtn = document.createElement('button');
                spPickerRemoveBtn.type = 'button';
                spPickerRemoveBtn.className = 'fieldset-sessionpricing-session-button-remove';
                var pickerMinusIconUrl = spGetSystemMinusIconUrl();
                if (pickerMinusIconUrl) {
                    var pickerMinusImg = document.createElement('img');
                    pickerMinusImg.className = 'fieldset-sessionpricing-session-button-icon fieldset-sessionpricing-session-button-icon--minus';
                    pickerMinusImg.alt = '';
                    pickerMinusImg.src = pickerMinusIconUrl;
                    spPickerRemoveBtn.appendChild(pickerMinusImg);
                }
                spPickerRemoveBtn.disabled = true;
                spPickerRemoveBtn.style.opacity = '0.3';
                spPickerRemoveBtn.style.cursor = 'not-allowed';
                spDatePickerRow.appendChild(spPickerRemoveBtn);

                var spPickerTicketBtn = document.createElement('button');
                spPickerTicketBtn.type = 'button';
                spPickerTicketBtn.className = 'fieldset-sessionpricing-ticketgroup-button-toggle';
                spPickerTicketBtn.title = 'Ticket Group';
                spPickerTicketBtn.disabled = true;
                spPickerTicketBtn.style.opacity = '0.3';
                spPickerTicketBtn.style.cursor = 'not-allowed';
                var spPickerIconUrl = spGetSystemTicketIconUrl();
                if (spPickerIconUrl) {
                    var spPImg = document.createElement('img');
                    spPImg.className = 'fieldset-sessionpricing-ticketgroup-button-icon';
                    spPImg.alt = '';
                    spPImg.src = spPickerIconUrl;
                    spPickerTicketBtn.appendChild(spPImg);
                }
                var spPLetter = document.createElement('div');
                spPLetter.className = 'fieldset-sessionpricing-ticketgroup-button-label';
                spPLetter.textContent = 'A';
                spPickerTicketBtn.appendChild(spPLetter);
                spDatePickerRow.appendChild(spPickerTicketBtn);

                var spPricingGroupsWrap = document.createElement('div');
                spPricingGroupsWrap.className = 'fieldset-sessionpricing-ticketgroups-container';
                spPricingGroupsWrap.classList.add('fieldset-sessionpricing-ticketgroups-popover');

                // Scroll container INSIDE the popover shell so the shell padding area never scrolls.
                // This prevents content bleeding "behind" the sticky header.
                var spTicketGroupScroll = document.createElement('div');
                spTicketGroupScroll.className = 'fieldset-sessionpricing-ticketgroups-popover-scroll';

                // Inner padded content so the scrollbar stays flush to the popover edge.
                var spTicketGroupContent = document.createElement('div');
                spTicketGroupContent.className = 'fieldset-sessionpricing-ticketgroups-popover-content';

                spTicketGroupList = document.createElement('div');
                spTicketGroupList.className = 'fieldset-sessionpricing-ticketgroups-container-list';
                spTicketGroupContent.appendChild(spTicketGroupList);

                spTicketGroupScroll.appendChild(spTicketGroupContent);
                spPricingGroupsWrap.appendChild(spTicketGroupScroll);

                // Pop-up footer (locked like session picker)
                var spTicketGroupFooter = document.createElement('div');
                spTicketGroupFooter.className = 'fieldset-sessionpricing-ticketgroups-popover-footer';

                // Add/Remove buttons (left side of footer)
                var spFooterAddBtn = document.createElement('button');
                spFooterAddBtn.type = 'button';
                spFooterAddBtn.className = 'fieldset-sessionpricing-ticketgroups-button-add';
                var footerPlusIconUrl = spGetSystemPlusIconUrl();
                if (footerPlusIconUrl) {
                    var footerPlusImg = document.createElement('img');
                    footerPlusImg.className = 'fieldset-sessionpricing-ticketgroups-button-icon fieldset-sessionpricing-ticketgroups-button-icon--plus';
                    footerPlusImg.alt = '';
                    footerPlusImg.src = footerPlusIconUrl;
                    spFooterAddBtn.appendChild(footerPlusImg);
                }
                spFooterAddBtn.setAttribute('aria-label', 'Add Ticket Group');
                spFooterAddBtn.addEventListener('click', function(e) {
                    try { e.preventDefault(); } catch (e0) {}
                    var newKey = spFirstUnusedLetter();
                    spEnsureTicketGroup(newKey);
                    spUpdateFooterButtons();
                    spAssignGroupToActive(newKey);
                    spCloseAllGroupEditors();
                    spOpenGroupKey = newKey;
                    spOpenGroupSnapshot = [];
                    spSetGroupEditorOpen(newKey, true);
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                });
                spTicketGroupFooter.appendChild(spFooterAddBtn);

                var spFooterRemoveBtn = document.createElement('button');
                spFooterRemoveBtn.type = 'button';
                spFooterRemoveBtn.className = 'fieldset-sessionpricing-ticketgroups-button-remove';
                var footerMinusIconUrl = spGetSystemMinusIconUrl();
                if (footerMinusIconUrl) {
                    var footerMinusImg = document.createElement('img');
                    footerMinusImg.className = 'fieldset-sessionpricing-ticketgroups-button-icon fieldset-sessionpricing-ticketgroups-button-icon--minus';
                    footerMinusImg.alt = '';
                    footerMinusImg.src = footerMinusIconUrl;
                    spFooterRemoveBtn.appendChild(footerMinusImg);
                }
                spFooterRemoveBtn.setAttribute('aria-label', 'Remove Last Ticket Group');
                spFooterRemoveBtn.addEventListener('click', async function(e) {
                    try { e.preventDefault(); } catch (e0) {}
                    var keys = Object.keys(spTicketGroups).sort();
                    if (keys.length <= 1) return;
                    var lastKey = keys[keys.length - 1];
                    if (lastKey === 'A') return;
                    try {
                        if (typeof ConfirmDialogComponent === 'undefined' || !ConfirmDialogComponent || typeof ConfirmDialogComponent.show !== 'function') {
                            console.error('[session_pricing] ConfirmDialogComponent not available');
                            return;
                        }
                    } catch (eCheck) { return; }
                    var confirmed = false;
                    try {
                        confirmed = await ConfirmDialogComponent.show({
                            titleText: 'Delete Ticket Group ' + lastKey,
                            messageText: 'Are you sure?',
                            confirmLabel: 'Delete',
                            confirmClass: 'danger',
                            focusCancel: true
                        });
                    } catch (eDlg) { confirmed = false; }
                    if (!confirmed) return;
                    var g = spTicketGroups[lastKey];
                    if (g) try { g.remove(); } catch (e1) {}
                    delete spTicketGroups[lastKey];
                    spOpenGroupKey = null;
                    spOpenGroupSnapshot = null;
                    Object.keys(spSessionData).forEach(function(ds) {
                        var data = spSessionData[ds];
                        if (!data || !Array.isArray(data.groups)) return;
                        data.groups = data.groups.map(function(gk) { return gk === lastKey ? 'A' : gk; });
                    });
                    spUpdateAllTicketButtonsFromData();
                    spUpdateFooterButtons();
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
                });
                spTicketGroupFooter.appendChild(spFooterRemoveBtn);

                // Spacer to push OK/Cancel to the right
                var spFooterSpacer = document.createElement('div');
                spFooterSpacer.style.flex = '1';
                spTicketGroupFooter.appendChild(spFooterSpacer);

                var spTicketGroupFooterOk = document.createElement('button');
                spTicketGroupFooterOk.type = 'button';
                spTicketGroupFooterOk.className = 'fieldset-sessionpricing-ticketgroups-button-ok';
                spTicketGroupFooterOk.textContent = 'OK';
                var spTicketGroupFooterCancel = document.createElement('button');
                spTicketGroupFooterCancel.type = 'button';
                spTicketGroupFooterCancel.className = 'fieldset-sessionpricing-ticketgroups-button-cancel';
                spTicketGroupFooterCancel.textContent = 'Cancel';
                spTicketGroupFooter.appendChild(spTicketGroupFooterOk);
                spTicketGroupFooter.appendChild(spTicketGroupFooterCancel);
                spPricingGroupsWrap.appendChild(spTicketGroupFooter);

                function spUpdateFooterButtons() {
                    var keys = Object.keys(spTicketGroups);
                    var count = keys.length;
                    spFooterRemoveBtn.disabled = count <= 1;
                    spFooterRemoveBtn.style.opacity = count <= 1 ? '0.3' : '1';
                    spFooterRemoveBtn.style.cursor = count <= 1 ? 'not-allowed' : 'pointer';
                }

                fieldset.appendChild(spPricingGroupsWrap);

                function spApplyDraftToCalendar() {
                    try {
                        if (!spCalendarInstance || typeof spCalendarInstance.setSelectedDates !== 'function') return;
                        spCalendarInstance.setSelectedDates(spDateDraft ? Array.from(spDateDraft) : []);
                    } catch (e0) {}
                }

                function spCloseDatePicker() {
                    if (!spDatePickerOpen) return;
                    spDatePickerOpen = false;
                    spDatePickerPopover.classList.remove('fieldset-sessionpricing-calendar-popover--open');
                    spDatePickerBox.setAttribute('aria-expanded', 'false');
                    try {
                        if (spDatePickerAnchorEl) {
                            spDatePickerAnchorEl.classList.remove('fieldset-sessionpricing-session-field-label--open');
                        }
                    } catch (e0) {}
                    spDatePickerAnchorEl = null;
                    spDateDraft = null;
                    if (spDatePickerDocHandler) {
                        try { document.removeEventListener('click', spDatePickerDocHandler, true); } catch (e1) {}
                        spDatePickerDocHandler = null;
                    }
                }

                function spOpenDatePicker(anchorEl) {
                    if (!anchorEl) return;
                    // Toggle close when clicking any date box while open.
                    if (spDatePickerOpen) {
                        spCloseDatePicker();
                        return;
                    }
                    spDatePickerOpen = true;
                    spDateDraft = new Set(Object.keys(spSessionData || {}));
                    spApplyDraftToCalendar();
                    spDatePickerAnchorEl = anchorEl;
                    try { anchorEl.classList.add('fieldset-sessionpricing-session-field-label--open'); } catch (eOpen2) {}

                    // Position popover above the main session pricing label
                    try {
                        if (fieldset && fieldset.style) fieldset.style.position = 'relative';
                        var fsRect = fieldset.getBoundingClientRect();
                        var labelRect = spLabelEl.getBoundingClientRect();
                        
                        // Measure popover height (must be visible but hidden to measure)
                        spDatePickerPopover.style.visibility = 'hidden';
                        spDatePickerPopover.style.display = 'block';
                        spDatePickerPopover.classList.add('fieldset-sessionpricing-calendar-popover--open');
                        var popHeight = spDatePickerPopover.offsetHeight;
                        spDatePickerPopover.classList.remove('fieldset-sessionpricing-calendar-popover--open');
                        spDatePickerPopover.style.display = '';
                        spDatePickerPopover.style.visibility = '';
                        
                        // Calculate top: label's top relative to fieldset minus popover height minus 10px
                        var top = (labelRect.top - fsRect.top) - popHeight - 10;
                        spDatePickerPopover.style.top = top + 'px';
                    } catch (eTop) {}

                    spDatePickerPopover.classList.add('fieldset-sessionpricing-calendar-popover--open');
                    spDatePickerBox.setAttribute('aria-expanded', 'true');

                    // Scroll to today month when opening (like filter)
                    try { if (spTodayMonthEl) spCalScroll.scrollLeft = spTodayMonthEl.offsetLeft; } catch (eScroll) {}

                    // Close when clicking outside (treat as cancel, like filter)
                    spDatePickerDocHandler = function(ev) {
                        try {
                            // Clicking any session date box should NOT close the picker.
                            if (ev.target && ev.target.closest && ev.target.closest('.fieldset-sessionpricing-session-field-label')) return;
                            if (!spDatePickerPopover.contains(ev.target) && !(spDatePickerAnchorEl && spDatePickerAnchorEl.contains(ev.target))) {
                                spCloseDatePicker();
                            }
                        } catch (e2) {}
                    };
                    try { document.addEventListener('click', spDatePickerDocHandler, true); } catch (e3) {}
                }

                // Open date picker on click/enter/space
                spDatePickerBox.addEventListener('click', function(e) {
                    try { e.preventDefault(); } catch (e0) {}
                    spOpenDatePicker(spDatePickerBox);
                });
                spDatePickerBox.addEventListener('keydown', function(e) {
                    if (!e) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        spOpenDatePicker(spDatePickerBox);
                    }
                });

                // Click outside to close (already handled by spDatePickerDocHandler)

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
                    
                    // Age Rating row at top of editor
                    var ageRatingRow = document.createElement('div');
                    ageRatingRow.className = 'fieldset-sessionpricing-pricing-agerating-row';
                    var ageRatingLabel = document.createElement('div');
                    ageRatingLabel.className = 'fieldset-sessionpricing-pricing-agerating-label';
                    ageRatingLabel.textContent = 'Age Rating';
                    ageRatingRow.appendChild(ageRatingLabel);
                    ageRatingRow.appendChild(buildAgeRatingMenu(fieldset));
                    editorEl.appendChild(ageRatingRow);
                    
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
                            // IMPORTANT: do not clear the currency input directly (that causes "flag + Search").
                            // Only set currency when we actually have a saved value, and do it via the component API.
                            var curr = String((tierObj && tierObj.currency) || '').trim();
                            if (curr) {
                                try {
                                    var menuEl = tierBlock.querySelector('.component-currencycompact-menu');
                                    if (menuEl) {
                                        for (var mi = 0; mi < spTicketCurrencyMenus.length; mi++) {
                                            var mo = spTicketCurrencyMenus[mi];
                                            if (mo && mo.element === menuEl && typeof mo.setValue === 'function') {
                                                mo.setValue(curr);
                                                break;
                                            }
                                        }
                                    }
                                } catch (eCur) {}
                            }
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
                    var wrap = g.querySelector('.fieldset-sessionpricing-ticketgroup-item-editorwrap');
                    if (!wrap) return;
                    wrap.style.display = isOpen ? '' : 'none';
                    g.classList.toggle('fieldset-sessionpricing-ticketgroup-item--open', !!isOpen);

                    // Toggle sticky class on header (CSS handles the sticky behavior)
                    try {
                        Object.keys(spTicketGroups).forEach(function(k) {
                            var gg = spTicketGroups[k];
                            if (!gg) return;
                            var hh = gg.querySelector('.fieldset-sessionpricing-ticketgroup-item-header');
                            if (hh) hh.classList.remove('fieldset-sessionpricing-ticketgroup-item-header--sticky');
                        });
                        if (isOpen) {
                            var h0 = g.querySelector('.fieldset-sessionpricing-ticketgroup-item-header');
                            if (h0) h0.classList.add('fieldset-sessionpricing-ticketgroup-item-header--sticky');
                        }
                    } catch (eSticky) {}
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
                    var normalizedKey = String(groupKey || '').trim();
                    var dateStr = spActivePicker.dateStr;
                    var idx = spActivePicker.idx;
                    var data = spSessionData[dateStr];
                    if (!data) return;
                    if (!Array.isArray(data.groups)) data.groups = [];
                    data.groups[idx] = normalizedKey;
                    spActivePicker.timeInput.dataset.ticketGroupKey = normalizedKey;
                    var letterEl = spActivePicker.ticketBtn.querySelector('.fieldset-sessionpricing-ticketgroup-button-label');
                    if (letterEl) letterEl.textContent = normalizedKey ? normalizedKey : '?';
                    try { spActivePicker.ticketBtn.setAttribute('aria-label', normalizedKey ? ('Ticket Group ' + normalizedKey) : 'Ticket Group unassigned'); } catch (eAria) {}

                    // Highlight the selected group in the picker menu (so selection is obvious)
                    try {
                        Object.keys(spTicketGroups).forEach(function(k) {
                            var g = spTicketGroups[k];
                            if (!g) return;
                            var header = g.querySelector('.fieldset-sessionpricing-ticketgroup-item-header');
                            if (!header) return;
                            header.classList.toggle('fieldset-sessionpricing-ticketgroup-item-header--selected', normalizedKey && String(k) === String(normalizedKey));
                        });
                    } catch (eSel) {}
                }

                function spUpdateAllTicketButtonsFromData() {
                    try {
                        var inputs = spSessionsContainer.querySelectorAll('.fieldset-sessionpricing-session-field-time-input');
                        inputs.forEach(function(input) {
                            var d = String(input.dataset.date || '');
                            var i = parseInt(String(input.dataset.idx || '0'), 10);
                            if (!d || !spSessionData[d] || !Array.isArray(spSessionData[d].groups)) return;
                            var g = String(spSessionData[d].groups[i] || '').trim();
                            input.dataset.ticketGroupKey = g;
                            var row = input.closest('.fieldset-sessionpricing-session-row');
                            if (!row) return;
                            var btn = row.querySelector('.fieldset-sessionpricing-ticketgroup-button-toggle');
                            if (!btn) return;
                            var letterEl = btn.querySelector('.fieldset-sessionpricing-ticketgroup-button-label');
                            if (letterEl) letterEl.textContent = g ? g : '?';
                            try { btn.setAttribute('aria-label', g ? ('Ticket Group ' + g) : 'Ticket Group unassigned'); } catch (eAria2) {}
                        });
                    } catch (eUp) {}
                }

                function spCloseTicketMenu() {
                    if (!spTicketMenuOpen) return;
                    spTicketMenuOpen = false;
                    spPricingGroupsWrap.classList.remove('fieldset-sessionpricing-ticketgroups-popover--open');
                    try {
                        if (spActivePicker && spActivePicker.ticketBtn) {
                            spActivePicker.ticketBtn.classList.remove('fieldset-sessionpricing-ticketgroup-button-toggle--open');
                        }
                    } catch (eCls) {}
                    spActivePicker = null;
                    if (spTicketMenuDocHandler) {
                        try { document.removeEventListener('click', spTicketMenuDocHandler, true); } catch (e) {}
                        spTicketMenuDocHandler = null;
                    }
                    if (spTicketMenuWinHandler) {
                        try { window.removeEventListener('resize', spTicketMenuWinHandler, true); } catch (e1) {}
                        spTicketMenuWinHandler = null;
                    }
                    spTicketMenuScrollEl = null;
                }

                // Footer buttons (OK/Cancel) for the ticket-group pop-up (locked like session picker)
                spTicketGroupFooterOk.addEventListener('click', function(e) {
                    try { e.preventDefault(); } catch (e0) {}
                    spCloseAllGroupEditors();
                    spCloseTicketMenu();
                });

                spTicketGroupFooterCancel.addEventListener('click', function(e) {
                    try { e.preventDefault(); } catch (e0) {}
                    // Revert current open editor only, then close the menu.
                    try {
                        if (spOpenGroupKey && spOpenGroupSnapshot) {
                            var g = spTicketGroups[String(spOpenGroupKey || '')];
                            if (g) {
                                var editorEl = g.querySelector('.fieldset-sessionpricing-pricing-editor');
                                if (editorEl) spReplaceEditorFromPricing(editorEl, spOpenGroupSnapshot || []);
                            }
                        }
                    } catch (e1) {}
                    spCloseAllGroupEditors();
                    spCloseTicketMenu();
                });

                function spOpenTicketMenu(anchorRowEl, pickerObj) {
                    if (!anchorRowEl || !pickerObj) return;
                    spCloseTicketMenu();
                    spActivePicker = pickerObj;
                    try { if (pickerObj.ticketBtn) pickerObj.ticketBtn.classList.add('fieldset-sessionpricing-ticketgroup-button-toggle--open'); } catch (eCls2) {}

                    // Ensure active row has a group assigned
                    var currentKey = '';
                    try { currentKey = String(pickerObj.timeInput.dataset.ticketGroupKey || '').trim(); } catch (e0) { currentKey = ''; }
                    if (!currentKey) {
                        currentKey = 'A';
                        spEnsureDefaultGroup();
                    }
                    spAssignGroupToActive(currentKey);

                    // Auto-open the editor for the currently selected group when the menu opens.
                    try {
                        spEnsureTicketGroup(currentKey);
                        spCloseAllGroupEditors();
                        spOpenGroupKey = currentKey;
                        var grpEl0 = spTicketGroups[currentKey];
                        var editorEl0 = grpEl0 ? grpEl0.querySelector('.fieldset-sessionpricing-pricing-editor') : null;
                        spOpenGroupSnapshot = spExtractPricingFromEditor(editorEl0);
                        spSetGroupEditorOpen(currentKey, true);
                    } catch (eAutoOpen) {}

                    // Pop-up positioning inside the fieldset (same model as session picker)
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
                        var top = (rowRect.bottom - fsRect.top) + 10;
                        if (top < 0) top = 0;
                        spPricingGroupsWrap.style.top = top + 'px';
                    } catch (eTop) {}

                    spPricingGroupsWrap.classList.add('fieldset-sessionpricing-ticketgroups-popover--open');
                    spTicketMenuOpen = true;

                    // Close when clicking outside (Formbuilder-style)
                    spTicketMenuDocHandler = function(ev) {
                        try {
                            // If a confirm dialog is open, don't treat clicks inside it as "outside" the ticket-group menu.
                            var confirmOverlay = document.querySelector('.component-confirm-dialog-overlay--visible');
                            if (confirmOverlay && confirmOverlay.contains(ev.target)) return;
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
                    group.className = 'fieldset-sessionpricing-ticketgroup-item';
                    group.dataset.ticketGroupKey = key;

                    // Header wrapper (46px when sticky - top 10px is shield, bottom 36px is content)
                    var header = document.createElement('div');
                    header.className = 'fieldset-sessionpricing-ticketgroup-item-header';

                    // Content row inside header (36px button area with all interactions)
                    var headerContent = document.createElement('div');
                    headerContent.className = 'fieldset-sessionpricing-ticketgroup-item-header-content';

                    var selectBtn = document.createElement('button');
                    selectBtn.type = 'button';
                    selectBtn.className = 'fieldset-sessionpricing-ticketgroup-button-select';
                    selectBtn.textContent = 'Ticket Group ' + key;
                    selectBtn.addEventListener('click', function() {
                        // Selecting a group closes any open edit panels (only one editing context at a time)
                        spCloseAllGroupEditors();
                        spAssignGroupToActive(key);
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    headerContent.appendChild(selectBtn);

                    var editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'fieldset-sessionpricing-ticketgroup-button-edit';
                    editBtn.textContent = '✎';
                    editBtn.title = 'Edit Ticket Group';
                    editBtn.setAttribute('aria-label', 'Edit Ticket Group');
                    editBtn.addEventListener('click', function(e) {
                        if (spOpenGroupKey && spOpenGroupKey !== key) {
                            spCloseAllGroupEditors();
                        }
                        var isOpen = group.classList.contains('fieldset-sessionpricing-ticketgroup-item--open');
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
                    headerContent.appendChild(editBtn);

                    header.appendChild(headerContent);
                    group.appendChild(header);

                    var editorWrap = document.createElement('div');
                    editorWrap.className = 'fieldset-sessionpricing-ticketgroup-item-editorwrap';
                    editorWrap.style.display = 'none';

                    var editor = document.createElement('div');
                    editor.className = 'fieldset-sessionpricing-pricing-editor';
                    editorWrap.appendChild(editor);
                    spReplaceEditorFromPricing(editor, []);
                    group.appendChild(editorWrap);

                    spTicketGroups[key] = group;
                    if (spTicketGroupList) spTicketGroupList.appendChild(group);
                    try { spUpdateFooterButtons(); } catch (eBtn0) {}
                    return group;
                }

                function spRenderSessions() {
                    // Close the ticket menu before rerendering (prevents stale anchors)
                    spCloseTicketMenu();
                    spSessionsContainer.innerHTML = '';
                    var sortedDates = Object.keys(spSessionData).sort();
                    // Update the date selector box text
                    if (sortedDates.length === 0) {
                        // Only show the date selector row when there are no dates yet.
                        spSessionsContainer.appendChild(spDatePickerRow);
                        spDatePickerBox.textContent = 'Select Dates';
                        // Disable the placeholder row controls until at least one date exists
                        try {
                            spPickerTimeInput.disabled = true;
                            spPickerAddBtn.disabled = true;
                            spPickerRemoveBtn.disabled = true;
                            spPickerTicketBtn.disabled = true;
                            spPickerTimeInput.style.opacity = '0.3';
                            spPickerTicketBtn.style.opacity = '0.3';
                        } catch (e0) {}
                    } else {
                        try {
                            var d0 = new Date(sortedDates[0] + 'T00:00:00');
                            var wd0 = d0.toLocaleDateString('en-AU', { weekday: 'short' });
                            var dm0 = d0.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                            var yy0 = d0.toLocaleDateString('en-AU', { year: 'numeric' });
                            spDatePickerBox.textContent = (wd0 + ' ' + dm0 + ', ' + yy0).replace(/\s+/g, ' ').trim();
                        } catch (eFmt0) {
                            spDatePickerBox.textContent = sortedDates[0];
                        }
                    }
                    sortedDates.forEach(function(dateStr) {
                        var data = spSessionData[dateStr];
                        var group = document.createElement('div');
                        group.className = 'fieldset-sessionpricing-session-container-item';
                        data.times.forEach(function(timeVal, idx) {
                            var row = document.createElement('div');
                            row.className = 'fieldset-sessionpricing-session-row';
                            if (idx === 0) {
                                var dateDisplay = document.createElement('div');
                                dateDisplay.className = 'fieldset-sessionpricing-session-field-label';
                                var d = new Date(dateStr + 'T00:00:00');
                                try {
                                    var wd = d.toLocaleDateString('en-AU', { weekday: 'short' });
                                    var dm = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                                    var yy = d.toLocaleDateString('en-AU', { year: 'numeric' });
                                    dateDisplay.textContent = (wd + ' ' + dm + ', ' + yy).replace(/\s+/g, ' ').trim();
                                } catch (eFmt) {
                                    dateDisplay.textContent = d.toDateString();
                                }
                                // Clicking any date box opens the date picker pop-up
                                try {
                                    dateDisplay.setAttribute('role', 'button');
                                    dateDisplay.setAttribute('tabindex', '0');
                                    dateDisplay.addEventListener('click', function(ev) {
                                        try { ev.preventDefault(); } catch (e0) {}
                                        spOpenDatePicker(dateDisplay);
                                    });
                                } catch (ePick) {}
                                row.appendChild(dateDisplay);
                            } else {
                                var spacer = document.createElement('div');
                                spacer.className = 'fieldset-sessionpricing-session-field-label-spacer';
                                row.appendChild(spacer);
                            }
                            var timeWrapper = document.createElement('div');
                            timeWrapper.className = 'fieldset-sessionpricing-session-field-time';
                            var timeInput = document.createElement('input');
                            timeInput.type = 'text';
                            timeInput.className = 'fieldset-sessionpricing-session-field-time-input';
                            timeInput.placeholder = 'HH:MM';
                            timeInput.maxLength = 5;
                            timeInput.value = timeVal;
                            timeInput.dataset.date = dateStr;
                            timeInput.dataset.idx = idx;
                            if (!Array.isArray(data.groups)) data.groups = [];
                            // Default each session time to Group A unless it was explicitly cleared ('' -> '?')
                            if (typeof data.groups[idx] !== 'string') data.groups[idx] = 'A';
                            timeInput.dataset.ticketGroupKey = String(data.groups[idx] || '').trim();
                            timeInput.addEventListener('focus', function() {
                                var input = this;
                                setTimeout(function() { input.select(); }, 0);
                            });
                            timeInput.addEventListener('input', function() {
                                var v = String(this.value || '').replace(/[^0-9]/g, '');
                                if (v.length >= 2) v = v.substring(0, 2) + ':' + v.substring(2, 4);
                                this.value = v;
                            });
                            function spTimeToMinutes(timeStr) {
                                var t = String(timeStr || '').trim();
                                if (!t) return null;
                                var m = t.match(/^(\d{1,2}):(\d{2})$/);
                                if (!m) return null;
                                var hh = parseInt(m[1], 10);
                                var mm = parseInt(m[2], 10);
                                if (isNaN(hh) || isNaN(mm)) return null;
                                if (hh < 0 || hh > 23) return null;
                                if (mm < 0 || mm > 59) return null;
                                return (hh * 60) + mm;
                            }
                            function spSortTimesForDate(dateKey) {
                                try {
                                    var ds = String(dateKey || '');
                                    var d = spSessionData[ds];
                                    if (!d || !Array.isArray(d.times)) return false;
                                    if (!Array.isArray(d.edited)) d.edited = [];
                                    if (!Array.isArray(d.groups)) d.groups = [];

                                    var items = d.times.map(function(tv, i) {
                                        return {
                                            i: i,
                                            time: String(tv || ''),
                                            edited: !!d.edited[i],
                                            group: String(d.groups[i] || 'A')
                                        };
                                    });

                                    // Stable sort: valid times first (ascending), blanks/invalid last, preserve relative order for ties.
                                    items.sort(function(a, b) {
                                        var am = spTimeToMinutes(a.time);
                                        var bm = spTimeToMinutes(b.time);
                                        var aValid = (am !== null);
                                        var bValid = (bm !== null);
                                        if (aValid && bValid) {
                                            if (am < bm) return -1;
                                            if (am > bm) return 1;
                                            return a.i - b.i;
                                        }
                                        if (aValid && !bValid) return -1;
                                        if (!aValid && bValid) return 1;
                                        return a.i - b.i;
                                    });

                                    var changed = false;
                                    for (var k = 0; k < items.length; k++) {
                                        if (items[k].i !== k) { changed = true; break; }
                                    }
                                    if (!changed) return false;

                                    d.times = items.map(function(it) { return it.time; });
                                    d.edited = items.map(function(it) { return it.edited; });
                                    d.groups = items.map(function(it) { return it.group; });
                                    return true;
                                } catch (eSort) {
                                    return false;
                                }
                            }
                            (function(dateStr, idx) {
                                timeInput.addEventListener('blur', function() {
                                    var raw = String(this.value || '').replace(/[^0-9]/g, '');
                                    if (raw === '') {
                                        spSessionData[dateStr].times[idx] = '';
                                        // Sort after user finishes editing (blur), even if clearing, so blanks drift to the end.
                                        if (spSortTimesForDate(dateStr)) spRenderSessions();
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
                                        // Sort only after the user finishes typing (blur), and keep group/edited aligned with the time.
                                        if (spSortTimesForDate(dateStr)) {
                                            spRenderSessions();
                                        } else {
                                            // Still sync any autofill results without rerendering if order didn't change.
                                            spSessionsContainer.querySelectorAll('.fieldset-sessionpricing-session-field-time-input').forEach(function(input) {
                                                var d0 = input.dataset.date;
                                                var i0 = parseInt(input.dataset.idx, 10);
                                                if (d0 && spSessionData[d0] && spSessionData[d0].times[i0] !== undefined) input.value = spSessionData[d0].times[i0];
                                            });
                                        }
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                    } else {
                                        this.value = '';
                                        spSessionData[dateStr].times[idx] = '';
                                        if (spSortTimesForDate(dateStr)) spRenderSessions();
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
                                    }
                                });
                            })(dateStr, idx);
                            timeWrapper.appendChild(timeInput);
                            row.appendChild(timeWrapper);

                            var spMaxTimesPerDate = 10;
                            var addBtn = document.createElement('button');
                            addBtn.type = 'button';
                            addBtn.className = 'fieldset-sessionpricing-session-button-add';
                            var rowPlusIconUrl = spGetSystemPlusIconUrl();
                            if (rowPlusIconUrl) {
                                var rowPlusImg = document.createElement('img');
                                rowPlusImg.className = 'fieldset-sessionpricing-session-button-icon fieldset-sessionpricing-session-button-icon--plus';
                                rowPlusImg.alt = '';
                                rowPlusImg.src = rowPlusIconUrl;
                                addBtn.appendChild(rowPlusImg);
                            }
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
                                        var inheritKey = String(spSessionData[dateStr].groups[idx] || '').trim();
                                        if (!inheritKey) inheritKey = 'A';
                                        spSessionData[dateStr].groups.splice(newSlotIdx, 0, inheritKey);
                                        spEnsureDefaultGroup();
                                        spRenderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(addBtn);

                            var removeBtn = document.createElement('button');
                            removeBtn.type = 'button';
                            removeBtn.className = 'fieldset-sessionpricing-session-button-remove';
                            var rowMinusIconUrl = spGetSystemMinusIconUrl();
                            if (rowMinusIconUrl) {
                                var rowMinusImg = document.createElement('img');
                                rowMinusImg.className = 'fieldset-sessionpricing-session-button-icon fieldset-sessionpricing-session-button-icon--minus';
                                rowMinusImg.alt = '';
                                rowMinusImg.src = rowMinusIconUrl;
                                removeBtn.appendChild(rowMinusImg);
                            }
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

                            // Ticket group button (icon + label)
                            var ticketBtn = document.createElement('button');
                            ticketBtn.type = 'button';
                            ticketBtn.className = 'fieldset-sessionpricing-ticketgroup-button-toggle';
                            ticketBtn.title = 'Ticket Group';

                            var iconUrl = spGetSystemTicketIconUrl();
                            if (iconUrl) {
                                var img = document.createElement('img');
                                img.className = 'fieldset-sessionpricing-ticketgroup-button-icon';
                                img.alt = '';
                                img.src = iconUrl;
                                ticketBtn.appendChild(img);
                            }
                            var letter = document.createElement('div');
                            letter.className = 'fieldset-sessionpricing-ticketgroup-button-label';
                            letter.textContent = String(data.groups[idx] || '').trim() ? String(data.groups[idx] || '').trim() : '?';
                            ticketBtn.appendChild(letter);
                            try { ticketBtn.setAttribute('aria-label', String(data.groups[idx] || '').trim() ? ('Ticket Group ' + String(data.groups[idx] || '').trim()) : 'Ticket Group unassigned'); } catch (eAriaBtn) {}

                            (function(dateStr, idx, timeInput, ticketBtn, rowEl) {
                                ticketBtn.addEventListener('click', function(e) {
                                    try { e.preventDefault(); } catch (e0) {}
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

                // Calendar clicks are handled by CalendarComponent (single source of truth).

                // Initial UI state
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
                var smartVenueWrap = document.createElement('div');
                smartVenueWrap.className = 'fieldset-location-inputwrap';
                smartVenueWrap.appendChild(smartVenueInput);
                fieldset.appendChild(smartVenueWrap);
                
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
                var smartAddrWrap = document.createElement('div');
                smartAddrWrap.className = 'fieldset-location-inputwrap';
                smartAddrWrap.appendChild(smartAddrInput);
                
                // Address "secret input" display (click-to-edit, like Messages tab)
                var smartAddrDisplay = document.createElement('div');
                smartAddrDisplay.className = 'fieldset-venue-address-display';
                smartAddrDisplay.title = 'Click to edit address';
                smartAddrWrap.insertBefore(smartAddrDisplay, smartAddrInput);
                smartAddrInput.classList.add('fieldset-venue-address-input--hidden');
                
                function syncSmartAddrDisplay() {
                    var v = String(smartAddrInput.value || '').trim();
                    smartAddrDisplay.textContent = v ? v : 'Address';
                }
                syncSmartAddrDisplay();
                
                smartAddrDisplay.addEventListener('click', function() {
                    smartAddrDisplay.classList.add('fieldset-venue-address-display--hidden');
                    smartAddrInput.classList.remove('fieldset-venue-address-input--hidden');
                    try { smartAddrInput.focus(); } catch (e0) {}
                });
                smartAddrInput.addEventListener('blur', function() {
                    syncSmartAddrDisplay();
                    smartAddrDisplay.classList.remove('fieldset-venue-address-display--hidden');
                    smartAddrInput.classList.add('fieldset-venue-address-input--hidden');
                });
                fieldset.appendChild(smartAddrWrap);

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
                    
                    var parent = inputEl.parentNode;
                    if (parent) {
                        parent.appendChild(dropdown);
                    }
                    
                    // Keyboard navigation (per input instance)
                    var dropdownItems = [];
                    var activeIndex = -1;
                    function dropdownIsOpen() {
                        return dropdown && dropdown.style && dropdown.style.display !== 'none';
                    }
                    function closeDropdown() {
                        dropdown.style.display = 'none';
                        dropdownItems = [];
                        activeIndex = -1;
                        try { if (parent) parent.classList.remove('fieldset-location-inputwrap--open'); } catch (e0) {}
                    }
                    function setActiveIndex(nextIdx) {
                        if (!dropdownItems || dropdownItems.length === 0) {
                            activeIndex = -1;
                            return;
                        }
                        var i = nextIdx;
                        if (i < 0) i = dropdownItems.length - 1;
                        if (i >= dropdownItems.length) i = 0;
                        activeIndex = i;
                        dropdownItems.forEach(function(el, idx) {
                            try { el.classList.toggle('fieldset-location-dropdown-item--active', idx === activeIndex); } catch (e) {}
                        });
                        try {
                            var el0 = dropdownItems[activeIndex];
                            if (el0 && typeof el0.scrollIntoView === 'function') el0.scrollIntoView({ block: 'nearest' });
                        } catch (e2) {}
                    }
                    function selectActive() {
                        if (!dropdownItems || dropdownItems.length === 0) return false;
                        if (activeIndex < 0) setActiveIndex(0);
                        var el = dropdownItems[activeIndex];
                        if (!el) return false;
                        try { el.click(); return true; } catch (e) { return false; }
                    }
                    
                    // Fetch suggestions using new API (unrestricted - finds both venues and addresses)
                    var debounceTimer = null;
                    async function fetchSuggestions(query) {
                        if (!query || query.length < 2) {
                            closeDropdown();
                            return;
                        }
                        
                        try {
                            // Use same API call as map controls (no type restrictions)
                            var response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                                input: query
                            });
                            
                            dropdown.innerHTML = '';
                            dropdownItems = [];
                            activeIndex = -1;
                            
                            if (!response || !response.suggestions || response.suggestions.length === 0) {
                                closeDropdown();
                                return;
                            }
                            
                            response.suggestions.forEach(function(suggestion) {
                                var prediction = suggestion.placePrediction;
                                if (!prediction) return;
                                
                                var item = document.createElement('div');
                                item.className = 'fieldset-location-dropdown-item';
                                item.addEventListener('mouseenter', function() {
                                    var idx = dropdownItems.indexOf(item);
                                    if (idx >= 0) setActiveIndex(idx);
                                });
                                
                                var mainText = prediction.mainText ? prediction.mainText.text : (prediction.text ? prediction.text.text : '');
                                var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                                
                                item.innerHTML = 
                                    '<div class="fieldset-location-dropdown-item-main">' + mainText + '</div>' +
                                    (secondaryText ? '<div class="fieldset-location-dropdown-item-secondary">' + secondaryText + '</div>' : '');
                                
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
                                        try { smartLatInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (eLatCh) {}
                                        try { smartLngInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (eLngCh) {}
                                        
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
                                            syncSmartAddrDisplay();
                                        } else {
                                            // User searched in address box
                                            // Address: strip to just address (in case Google added extra)
                                            smartAddrInput.value = address;
                                            syncSmartAddrDisplay();
                                            // Venue name: fill only if empty AND result is an establishment
                                            if (!smartVenueInput.value.trim() && isEstablishment && venueName) {
                                                smartVenueInput.value = venueName;
                                            }
                                        }
                                        
                                        inputEl.value = isVenueBox ? (isEstablishment ? venueName : address) : address;
                                        dropdown.style.display = 'none';
                                        try { if (parent) parent.classList.remove('fieldset-location-inputwrap--open'); } catch (eCls0) {}
                                        dropdownItems = [];
                                        activeIndex = -1;
                                        
                                        // After a confirmed selection, return address to display-mode.
                                        if (!isVenueBox) {
                                            syncSmartAddrDisplay();
                                            smartAddrDisplay.classList.remove('fieldset-venue-address-display--hidden');
                                            smartAddrInput.classList.add('fieldset-venue-address-input--hidden');
                                        }

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
                            try { if (parent) parent.classList.add('fieldset-location-inputwrap--open'); } catch (e0c) {}
                            setActiveIndex(0);
                        } catch (err) {
                            console.error('Autocomplete error:', err);
                            closeDropdown();
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
                            closeDropdown();
                            return;
                        }
                        
                        debounceTimer = setTimeout(function() {
                            fetchSuggestions(query);
                        }, 300);
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', function(e) {
                        if (!inputEl.contains(e.target) && !dropdown.contains(e.target)) {
                            closeDropdown();
                        }
                    });
                    
                    inputEl.addEventListener('keydown', function(e) {
                        var key = e && e.key ? e.key : '';
                        if (!dropdownIsOpen()) return;
                        if (!dropdownItems || dropdownItems.length === 0) return;
                        if (key === 'ArrowDown') {
                            try { e.preventDefault(); e.stopPropagation(); } catch (e0) {}
                            setActiveIndex(activeIndex + 1);
                            return;
                        }
                        if (key === 'ArrowUp') {
                            try { e.preventDefault(); e.stopPropagation(); } catch (e1) {}
                            setActiveIndex(activeIndex - 1);
                            return;
                        }
                        if (key === 'Enter') {
                            try { e.preventDefault(); e.stopPropagation(); } catch (e2) {}
                            selectActive();
                            return;
                        }
                        if (key === 'Escape') {
                            try { e.preventDefault(); e.stopPropagation(); } catch (e3) {}
                            closeDropdown();
                            return;
                        }
                        if (key === 'Tab') {
                            closeDropdown();
                            return;
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
                            var menu = fieldset.querySelector('.fieldset-customdropdown');
                            return !!(menu && String(menu.dataset.value || '').trim());
                        }
                        case 'custom_checklist': {
                            var list = fieldset.querySelector('.fieldset-customchecklist');
                            if (!list) return false;
                            try {
                                var arr = JSON.parse(String(list.dataset.value || '[]'));
                                return Array.isArray(arr) && arr.length > 0;
                            } catch (eC) {
                                return false;
                            }
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
                            return !!fieldset.querySelector('.fieldset-amenities-row input[type="radio"]:checked');
                        case 'age_rating': {
                            var ageRatingMenu = fieldset.querySelector('.component-ageratingpicker');
                            return !!(ageRatingMenu && String(ageRatingMenu.dataset.value || '').trim());
                        }
                        case 'session_pricing': {
                            var selected2 = fieldset.querySelectorAll('.calendar-day.selected[data-iso]');
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
                        case 'public_phone': {
                            var pfx = fieldset.querySelector('.fieldset-menu-button-input');
                            var tel = fieldset.querySelector('input[type="tel"].fieldset-input');
                            if (pfx && String(pfx.value || '').trim()) return true;
                            if (tel && String(tel.value || '').trim()) return true;
                            return false;
                        }
                        case 'item-pricing': {
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
                    if (!inp) return false;
                    var val = String(inp.value || '');
                    // Use password settings from dataset (set during fieldset build)
                    var pwMin = fieldset.dataset.pwMinLength ? parseInt(fieldset.dataset.pwMinLength, 10) : minLength;
                    var pwMax = fieldset.dataset.pwMaxLength ? parseInt(fieldset.dataset.pwMaxLength, 10) : maxLength;
                    if (!strLenOk(val, pwMin, pwMax)) return false;
                    // Check additional requirements from member_settings
                    if (fieldset.dataset.pwRequireLowercase === '1' && !/[a-z]/.test(val)) return false;
                    if (fieldset.dataset.pwRequireUppercase === '1' && !/[A-Z]/.test(val)) return false;
                    if (fieldset.dataset.pwRequireNumber === '1' && !/[0-9]/.test(val)) return false;
                    if (fieldset.dataset.pwRequireSymbol === '1' && !/[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?`~]/.test(val)) return false;
                    return true;
                }
                case 'confirm-password': {
                    var confirmInput = fieldset.querySelector('input.fieldset-input');
                    if (!confirmInput) return false;
                    var confirmVal = String(confirmInput.value || '');

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

                    // Use password settings from the password fieldset for validation
                    var pwMin = pwFieldset.dataset.pwMinLength ? parseInt(pwFieldset.dataset.pwMinLength, 10) : minLength;
                    var pwMax = pwFieldset.dataset.pwMaxLength ? parseInt(pwFieldset.dataset.pwMaxLength, 10) : maxLength;
                    if (!strLenOk(confirmVal, pwMin, pwMax)) return false;
                    // Check additional requirements
                    if (pwFieldset.dataset.pwRequireLowercase === '1' && !/[a-z]/.test(confirmVal)) return false;
                    if (pwFieldset.dataset.pwRequireUppercase === '1' && !/[A-Z]/.test(confirmVal)) return false;
                    if (pwFieldset.dataset.pwRequireNumber === '1' && !/[0-9]/.test(confirmVal)) return false;
                    if (pwFieldset.dataset.pwRequireSymbol === '1' && !/[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?`~]/.test(confirmVal)) return false;

                    // Identical means identical (no trimming differences).
                    return confirmVal === String(pwInput.value || '');
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
                    var menu = fieldset.querySelector('.fieldset-customdropdown');
                    var v = menu ? String(menu.dataset.value || '').trim() : '';
                    return !!v;
                }
                case 'custom_checklist': {
                    var list = fieldset.querySelector('.fieldset-customchecklist');
                    if (!list) return false;
                    try {
                        var arr = JSON.parse(String(list.dataset.value || '[]'));
                        return Array.isArray(arr) && arr.length > 0;
                    } catch (eC2) {
                        return false;
                    }
                }
                case 'custom_radio': {
                    var checked = fieldset.querySelector('input[type="radio"]:checked');
                    return !!checked;
                }
                case 'public_phone': {
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
                case 'session_pricing': {
                    var selectedDays2 = fieldset.querySelectorAll('.calendar-day.selected[data-iso]');
                    if (!selectedDays2 || selectedDays2.length === 0) return false;

                    var timeInputs2 = fieldset.querySelectorAll('input.fieldset-sessionpricing-sessions-time-input');
                    if (!timeInputs2 || timeInputs2.length === 0) return false;
                    for (var i2 = 0; i2 < timeInputs2.length; i2++) {
                        var ti2 = timeInputs2[i2];
                        if (!ti2) return false;
                        if (!isVisibleControl(ti2)) continue;
                        if (!isTimeHHMM(ti2.value)) return false;
                    }

                    // Ticket pricing groups must be complete:
                    // - Every visible time must have a non-empty group selected
                    // - Every existing group editor must have no blank fields (no partial/half-built groups)
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

                    for (var tgi = 0; tgi < timeInputs2.length; tgi++) {
                        var ti3 = timeInputs2[tgi];
                        if (!ti3 || !isVisibleControl(ti3)) continue;
                        var gk = ti3.dataset ? String(ti3.dataset.ticketGroupKey || '').trim() : '';
                        if (!gk) return false; // every visible time must have a group
                        var grpEl0 = groupsWrap.querySelector('.fieldset-sessionpricing-pricing-group[data-ticket-group-key="' + gk + '"]');
                        if (!grpEl0) return false;
                    }

                    for (var gi = 0; gi < groups.length; gi++) {
                        var grpEl = groups[gi];
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
                    var rows = fieldset.querySelectorAll('.fieldset-amenities-row');
                    if (!rows || rows.length === 0) return false;
                    for (var i = 0; i < rows.length; i++) {
                        if (!rows[i].querySelector('input[type="radio"]:checked')) return false;
                    }
                    return true;
                }
                case 'age_rating': {
                    // Required age rating: must have a value selected (not "Select rating")
                    var ageRatingMenu = fieldset.querySelector('.component-ageratingpicker');
                    return !!(ageRatingMenu && String(ageRatingMenu.dataset.value || '').trim());
                }
                case 'item-pricing': {
                    // Rule: all visible boxes in this pricing UI must be filled out.
                    // Covers item name + each variant's name/currency/price.
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

        // Browser autofill detection handled by global initGlobalAutofillHandler() in index-new.js

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
        buildPhonePrefixMenu: buildPhonePrefixMenu,
        buildAgeRatingMenu: buildAgeRatingMenu
    };
})();


window.FieldsetBuilder = FieldsetBuilder;
