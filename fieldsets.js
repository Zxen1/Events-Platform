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

    // Shared dropdown keyboard navigation (single source of truth)
    // Used by: initGooglePlaces (address/city) + initSmartVenueAutocomplete (venue fieldset)
    function installLocationDropdownKeyboard(inputEl, dropdownEl, parentWrapEl) {
        var activeIndex = -1;

        function getKeyName(e) {
            if (!e) return '';
            var k = (typeof e.key === 'string') ? e.key : '';
            if (!k && typeof e.code === 'string') k = e.code;
            var n = (typeof e.which === 'number') ? e.which : (typeof e.keyCode === 'number' ? e.keyCode : 0);
            if ((!k || k === 'Unidentified') && n) {
                if (n === 40) k = 'ArrowDown';
                else if (n === 38) k = 'ArrowUp';
                else if (n === 13) k = 'Enter';
                else if (n === 27) k = 'Escape';
                else if (n === 9) k = 'Tab';
            }
            // Some browsers report "Up/Down" instead of "ArrowUp/ArrowDown"
            if (k === 'Up') k = 'ArrowUp';
            if (k === 'Down') k = 'ArrowDown';
            return k;
        }

        function getItems() {
            try {
                return Array.prototype.slice.call(dropdownEl.querySelectorAll('.fieldset-location-dropdown-item'));
            } catch (e) {
                return [];
            }
        }

        function isOpen() {
            return dropdownEl && dropdownEl.style && dropdownEl.style.display !== 'none';
        }

        function syncActiveClass(items) {
            items.forEach(function(el, idx) {
                try { el.classList.toggle('menu-item--active', idx === activeIndex); } catch (e) {}
            });
        }

        function setActiveIndex(nextIdx) {
            var items = getItems();
            if (!items.length) {
                activeIndex = -1;
                return;
            }
            var i = nextIdx;
            if (i < 0) i = 0; // Stop at top, don't loop
            if (i >= items.length) i = items.length - 1; // Stop at bottom, don't loop
            activeIndex = i;
            syncActiveClass(items);
            try {
                var el0 = items[activeIndex];
                if (el0 && typeof el0.scrollIntoView === 'function') el0.scrollIntoView({ block: 'nearest' });
            } catch (e2) {}
        }

        var savedMargin = '';
        
        function open() {
            dropdownEl.style.display = 'block';
            try { if (parentWrapEl) parentWrapEl.classList.add('fieldset-location-inputwrap--open'); } catch (e0) {}
            // Save and clear inline margin to eliminate gap
            try {
                savedMargin = inputEl.style.marginBottom || '';
                inputEl.style.marginBottom = '0';
            } catch (e1) {}
            activeIndex = -1;
            setActiveIndex(0);
        }

        function close() {
            dropdownEl.style.display = 'none';
            activeIndex = -1;
            try { if (parentWrapEl) parentWrapEl.classList.remove('fieldset-location-inputwrap--open'); } catch (e0) {}
            // Restore inline margin
            try { inputEl.style.marginBottom = savedMargin; } catch (e1) {}
        }

        function selectActive() {
            var items = getItems();
            if (!items.length) return false;
            if (activeIndex < 0) setActiveIndex(0);
            var el = items[activeIndex];
            if (!el) return false;
            try { el.click(); return true; } catch (e) { return false; }
        }

        // Hover highlight via event delegation
        dropdownEl.addEventListener('mouseover', function(e) {
            var t = e && e.target ? e.target : null;
            if (!t || !(t instanceof Element)) return;
            var item = t.closest('.fieldset-location-dropdown-item');
            if (!item || !dropdownEl.contains(item)) return;
            var items = getItems();
            var idx = items.indexOf(item);
            if (idx >= 0) {
                activeIndex = idx;
                syncActiveClass(items);
            }
        });

        // Keydown on input (capture) so other handlers can't swallow Enter/arrows first.
        inputEl.addEventListener('keydown', function(e) {
            var key = getKeyName(e);
            if (!isOpen()) return;
            if (!getItems().length) return;

            if (key === 'ArrowDown') {
                try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch (e0) {}
                setActiveIndex(activeIndex + 1);
                return;
            }
            if (key === 'ArrowUp') {
                try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch (e1) {}
                setActiveIndex(activeIndex - 1);
                return;
            }
            if (key === 'Enter') {
                try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch (e2) {}
                selectActive();
                return;
            }
            if (key === 'Escape') {
                try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch (e3) {}
                close();
                return;
            }
            if (key === 'Tab') {
                close();
                return;
            }
        }, true);

        return {
            open: open,
            close: close
        };
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
        // menu-class-2 supplies appearance; component CSS supplies layout only.
        var parent = inputElement.parentNode;
        var dropdown = parent ? parent.querySelector('.fieldset-location-dropdown') : null;
        if (!dropdown && parent) {
            dropdown = document.createElement('div');
            dropdown.className = 'fieldset-location-dropdown menu-class-2 menu-dropdown';
            dropdown.style.display = 'none';
            parent.appendChild(dropdown);
        }
        if (dropdown) dropdown.innerHTML = '';
        
        var kb = installLocationDropdownKeyboard(inputElement, dropdown, parent);
        
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
                kb.close();
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
                
                if (!response || !response.suggestions || response.suggestions.length === 0) {
                    kb.close();
                    return;
                }
                
                response.suggestions.forEach(function(suggestion) {
                    var prediction = suggestion.placePrediction;
                    if (!prediction) return;
                    
                    var item = document.createElement('button');
                    item.type = 'button';
                    item.className = 'fieldset-location-dropdown-item menu-item';
                    
                    var mainText = prediction.mainText ? prediction.mainText.text : (prediction.text ? prediction.text.text : '');
                    var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                    
                    item.innerHTML = 
                        '<div class="fieldset-location-dropdown-item-main menu-item-main">' + mainText + '</div>' +
                        (secondaryText ? '<div class="fieldset-location-dropdown-item-secondary menu-item-secondary">' + secondaryText + '</div>' : '');
                    
                    item.addEventListener('click', async function(e) {
                        e.stopPropagation();
                        clearTimeout(debounceTimer);
                        try {
                            var place = prediction.toPlace();
                            await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'addressComponents'] });
                            
                            if (place.location) {
                                var lat = place.location.lat();
                                var lng = place.location.lng();
                                var cc = extractCountryCode(place);
                                
                                inputElement.value = place.displayName || place.formattedAddress || mainText;
                                kb.close();
                                
                                console.log('[TRACK] Google Places selected. Lat:', lat, 'Lng:', lng);
                                if (latInput) latInput.value = lat;
                                if (lngInput) lngInput.value = lng;
                                if (countryInput) countryInput.value = cc;
                                try { inputElement.dataset.placesConfirmed = 'true'; } catch (e3) {}
                                // Dispatch change event (not input) to avoid triggering the input handler
                                try { inputElement.dispatchEvent(new Event('change', { bubbles: true })); } catch (e5) {}
                                // Also notify listeners bound to lat/lng fields (e.g. wallpaper)
                                try { if (latInput) latInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e6) {}
                                try { if (lngInput) lngInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e7) {}
                                
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
                
                kb.open();
            } catch (err) {
                console.error('Autocomplete error:', err);
                kb.close();
            }
        }
        
        // If the user types, the location is no longer confirmed (must pick from Google again).
        inputElement.addEventListener('input', function() {
            // Any typing invalidates the confirmed location
            clearConfirmedLocation(false);
            clearTimeout(debounceTimer);
            var query = inputElement.value.trim();
            
            if (query.length < 2) {
                kb.close();
                return;
            }
            
            debounceTimer = setTimeout(function() {
                fetchSuggestions(query);
            }, 300);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
                kb.close();
            }
        });
        
        // Return object with cleanup method
        return {
            destroy: function() {
                if (dropdown && dropdown.parentNode) {
                    dropdown.parentNode.removeChild(dropdown);
                }
                kb.close();
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
        // Store setValue on the element for external access
        result.element._phonePrefixSetValue = result.setValue;
        return result.element;
    }
    
    // Build age rating menu - uses AgeRatingComponent
    function buildAgeRatingMenu(container, options) {
        if (typeof AgeRatingComponent === 'undefined') {
            console.error('[FieldsetBuilder] AgeRatingComponent not available');
            return document.createElement('div');
        }
        var result = AgeRatingComponent.buildMenu({
            initialValue: options && options.initialValue !== undefined ? options.initialValue : null,
            container: container,
            onSelect: options && options.onSelect ? options.onSelect : null
        });
        // Store setValue on the element for external access
        result.element._ageRatingSetValue = result.setValue;
        return result.element;
    }
    
    // Build label with required indicator (dot) and tooltip
    // Optional 5th parameter: instruction text to display after the label
    // Returns: label element if no instruction, or a wrapper div containing label + instruction
    function buildLabel(name, tooltip, minLength, maxLength, instructionText) {
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
            var tipIcon = document.createElement('span');
            tipIcon.className = 'fieldset-label-tooltip-icon';
            tip.appendChild(tipIcon);
            label.appendChild(tip);

            // Full-width tooltip box (panel-width), toggled via CSS
            var tipBox = document.createElement('div');
            tipBox.className = 'fieldset-label-tooltipbox';
            tipBox.textContent = tooltipText;
            label.appendChild(tipBox);
        }
        
        // If no instruction, return just the label element (backward compatible)
        if (!instructionText || typeof instructionText !== 'string' || !instructionText.trim()) {
            return label;
        }
        
        // If instruction exists, wrap label + instruction in a container
        var wrapper = document.createElement('div');
        wrapper.className = 'fieldset-label-wrapper';
        wrapper.appendChild(label);
        
        var instructionEl = document.createElement('div');
        instructionEl.className = 'fieldset-instruction';
        instructionEl.textContent = instructionText.trim();
        instructionEl.style.marginBottom = '10px';
        wrapper.appendChild(instructionEl);
        
        return wrapper;
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
    // getCurrencyCode: optional function that returns the currently selected currency code
    function attachMoneyInputBehavior(input, getCurrencyCode) {
        if (!input) return;
        input.type = 'text';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';

        function sanitize(raw) {
            var currencyCode = getCurrencyCode ? getCurrencyCode() : null;
            
            // If currency is selected, use currency-aware sanitization
            if (currencyCode) {
                if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.sanitizeInput) {
                    throw new Error('[FieldsetBuilder] CurrencyComponent.sanitizeInput is required');
                }
                return CurrencyComponent.sanitizeInput(raw, currencyCode);
            }
            
            // No currency selected yet - use standard decimal format (dot separator, 2 decimals)
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

            // Allow digits and both decimal separators (dot and comma) for better UX.
            // CurrencyComponent.sanitizeInput will normalize them to the correct one.
            var allowedPattern = /[0-9.,]/;
            if (!allowedPattern.test(k)) {
                e.preventDefault();
                return;
            }

            // Determine preferred decimal separator based on currency
            var currencyCode = getCurrencyCode ? getCurrencyCode() : null;
            var decSep = '.';
            if (currencyCode && typeof CurrencyComponent !== 'undefined' && CurrencyComponent.getCurrencyByCode) {
                var currency = CurrencyComponent.getCurrencyByCode(currencyCode);
                if (currency && currency.decimalSeparator) {
                    decSep = currency.decimalSeparator;
                }
            }

            // Block second decimal separator (regardless of whether they typed . or ,)
            if ((k === '.' || k === ',') && (this.value.indexOf('.') !== -1 || this.value.indexOf(',') !== -1)) {
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

        input.addEventListener('focus', function() {
            var v = String(this.value || '').trim();
            if (v === '') return;
            
            var currencyCode = getCurrencyCode ? getCurrencyCode() : null;
            
            // Strip symbol on focus so user can edit just the number
            if (currencyCode && typeof CurrencyComponent !== 'undefined' && CurrencyComponent.stripSymbol) {
                this.value = CurrencyComponent.stripSymbol(v, currencyCode);
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
            
            var currencyCode = getCurrencyCode ? getCurrencyCode() : null;
            
            // If currency is selected, format WITH symbol
            if (currencyCode) {
                if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.formatWithSymbol) {
                    throw new Error('[FieldsetBuilder] CurrencyComponent.formatWithSymbol is required');
                }
                var formatted = CurrencyComponent.formatWithSymbol(cleaned, currencyCode);
                if (formatted !== '') {
                    this.value = formatted;
                    return;
                }
            }
            
            // No currency selected yet - use standard 2-decimal format
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
    
    // Update placeholder text based on currency's format (symbol + decimal format)
    // No currency selected: shows "0.00" (valid initial state)
    // Currency selected: requires CurrencyComponent and valid currency data
    function updatePricePlaceholder(input, currencyCode) {
        if (!input) return;
        
        // No currency selected yet - valid initial state
        if (!currencyCode) {
            input.placeholder = '0.00';
            return;
        }
        
        // Currency selected - CurrencyComponent is required
        if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.getCurrencyByCode) {
            throw new Error('[FieldsetBuilder] CurrencyComponent.getCurrencyByCode is required');
        }
        
        var currency = CurrencyComponent.getCurrencyByCode(currencyCode);
        if (!currency) {
            throw new Error('[FieldsetBuilder] Currency not found: ' + currencyCode);
        }
        
        // Formatting properties are required
        if (currency.symbol === undefined || currency.symbolPosition === undefined ||
            currency.decimalSeparator === undefined || currency.decimalPlaces === undefined) {
            throw new Error('[FieldsetBuilder] Currency data incomplete for: ' + currencyCode);
        }
        
        // Build formatted placeholder with currency symbol
        var numPart;
        if (currency.decimalPlaces === 0) {
            numPart = '0';
        } else {
            numPart = '0' + currency.decimalSeparator + '0'.repeat(currency.decimalPlaces);
        }
        
        if (currency.symbolPosition === 'right') {
            input.placeholder = numPart + ' ' + currency.symbol;
        } else {
            input.placeholder = currency.symbol + numPart;
        }
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
                if (child.classList.contains('component-phoneprefixcompact-menu')) child.classList.add('fieldset-row-item--menu');
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
        
        // Placeholder: from field_placeholder (fields table) or custom override (fieldset_mods)
        // API returns field_placeholder as 'placeholder', custom override as 'customPlaceholder' or 'placeholder'
        var placeholder = '';
        if (fieldData.customPlaceholder && typeof fieldData.customPlaceholder === 'string') {
            placeholder = fieldData.customPlaceholder;
        } else if (typeof fieldData.placeholder === 'string') {
            placeholder = fieldData.placeholder;
        }
        // Canonical: fieldset_instruction (from DB). Editable override: customInstruction/instruction (from fieldset_mods).
        // Note: empty string is falsy, so we check typeof instead of using || chain
        var instruction = '';
        if (fieldData.customInstruction && typeof fieldData.customInstruction === 'string') {
            instruction = fieldData.customInstruction;
        } else if (typeof fieldData.instruction === 'string') {
            instruction = fieldData.instruction;
        } else if (fieldData.fieldset_instruction && typeof fieldData.fieldset_instruction === 'string') {
            instruction = fieldData.fieldset_instruction;
        }
        var minLength = fieldData.min_length;
        var maxLength = fieldData.max_length;
        var fieldOptions = fieldData.fieldset_options || fieldData.options;
        
        // Parse fieldset_fields - can be JSON string, array, or object
        // Also check fieldData.fields (API returns sub-fields there)
        var fields = fieldData.fieldset_fields || fieldData.fields;
        if (typeof fields === 'string') {
            try { fields = JSON.parse(fields); } catch (e) { fields = null; }
        }
        // If fields is an array, convert to object keyed by field key for easy lookup
        if (Array.isArray(fields)) {
            var fieldsObj = {};
            fields.forEach(function(f) {
                if (f && f.key) {
                    fieldsObj[f.key] = f;
                }
            });
            fields = fieldsObj;
        }
        if (!fields || typeof fields !== 'object') {
            fields = {};
        }

        // Helper to get sub-field placeholder from fields object
        function getSubfieldPlaceholder(fieldKey) {
            if (!fields || !fields[fieldKey]) return null;
            return fields[fieldKey].placeholder || null;
        }

        function applyPlaceholder(el, value) {
            if (!el) return;
            if (typeof value !== 'string') return;
            var v = value.trim();
            if (!v) return;
            el.placeholder = v;
        }
        
        // Default _setValue handles simple input/textarea/select
        fieldset._setValue = function(val) {
            var main = fieldset.querySelector('input:not([type="hidden"]), textarea, select');
            if (main) {
                if (main.type === 'checkbox') main.checked = !!val;
                else main.value = (val === null || val === undefined) ? '' : val;
                main.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

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
                fieldset.appendChild(buildLabel(name, pwTooltipText, null, null, instruction));
                
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
                pwInput.className = 'fieldset-input input-class-1';
                
                // Dynamic placeholder showing min length
                var pwPlaceholder = placeholder || ('Min ' + pwMinLength + ' characters');
                applyPlaceholder(pwInput, pwPlaceholder);
                
                // Use password settings for validation
                var pwValidation = addInputValidation(pwInput, pwMinLength, pwMaxLength, null);
                fieldset.appendChild(pwInput);
                fieldset.appendChild(pwValidation.charCount);
                break;

            case 'title':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'fieldset-input input-class-1';
                titleInput.autocomplete = 'off';
                applyPlaceholder(titleInput, placeholder);
                var titleValidation = addInputValidation(titleInput, minLength, maxLength, null);
                fieldset.appendChild(titleInput);
                fieldset.appendChild(titleValidation.charCount);
                break;
            
            case 'coupon':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var couponInput = document.createElement('input');
                couponInput.type = 'text';
                couponInput.className = 'fieldset-input input-class-1';
                applyPlaceholder(couponInput, placeholder);
                var couponValidation = addInputValidation(couponInput, minLength, maxLength, null);
                fieldset.appendChild(couponInput);
                fieldset.appendChild(couponValidation.charCount);
                break;
                
            case 'description':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var descTextarea = document.createElement('textarea');
                descTextarea.className = 'fieldset-textarea input-class-1';
                applyPlaceholder(descTextarea, placeholder);
                var descValidation = addInputValidation(descTextarea, minLength, maxLength, null);
                fieldset.appendChild(descTextarea);
                fieldset.appendChild(descValidation.charCount);
                break;
                
            case 'custom-text': // post_map_cards.custom_text
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var textBoxInput = document.createElement('input');
                textBoxInput.type = 'text';
                textBoxInput.className = 'fieldset-input input-class-1';
                applyPlaceholder(textBoxInput, placeholder);
                var textBoxValidation = addInputValidation(textBoxInput, minLength, maxLength, null);
                fieldset.appendChild(textBoxInput);
                fieldset.appendChild(textBoxValidation.charCount);
                break;
                
            case 'custom-textarea': // post_map_cards.custom_textarea
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var editableTextarea = document.createElement('textarea');
                editableTextarea.className = 'fieldset-textarea input-class-1';
                applyPlaceholder(editableTextarea, placeholder);
                var textareaValidation = addInputValidation(editableTextarea, minLength, maxLength, null);
                fieldset.appendChild(editableTextarea);
                fieldset.appendChild(textareaValidation.charCount);
                break;
                
            case 'custom-dropdown': // post_map_cards.custom_dropdown
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                
                // Custom dropdown menu (no native <select> arrow). Uses MenuManager + animated ▼ arrow like Formbuilder menus.
                // menu-class-1 supplies appearance; component CSS supplies layout only.
                var cdPlaceholderText = (typeof placeholder === 'string') ? placeholder.trim() : '';
                var cdMenu = document.createElement('div');
                cdMenu.className = 'fieldset-customdropdown menu-class-1';
                cdMenu.dataset.value = '';
                
                var cdButton = document.createElement('button');
                cdButton.type = 'button';
                cdButton.className = 'fieldset-customdropdown-button menu-button form-preview-select';
                cdButton.dataset.value = '';
                
                var cdButtonText = document.createElement('span');
                cdButtonText.className = 'fieldset-customdropdown-button-text menu-text';
                cdButtonText.textContent = cdPlaceholderText;
                
                var cdArrow = document.createElement('span');
                cdArrow.className = 'fieldset-customdropdown-button-arrow menu-arrow';
                
                cdButton.appendChild(cdButtonText);
                cdButton.appendChild(cdArrow);
                cdMenu.appendChild(cdButton);
                
                var cdOptions = document.createElement('div');
                cdOptions.className = 'fieldset-customdropdown-options menu-options';
                cdMenu.appendChild(cdOptions);
                
                function cdApplyOpenState(isOpen) {
                    cdMenu.classList.toggle('fieldset-customdropdown--open', !!isOpen);
                    cdButton.classList.toggle('fieldset-customdropdown-button--open', !!isOpen);
                    cdButton.classList.toggle('menu-button--open', !!isOpen);
                    cdArrow.classList.toggle('fieldset-customdropdown-button-arrow--open', !!isOpen);
                    cdArrow.classList.toggle('menu-arrow--open', !!isOpen);
                    cdOptions.classList.toggle('fieldset-customdropdown-options--open', !!isOpen);
                    cdOptions.classList.toggle('menu-options--open', !!isOpen);
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
                        btn.className = 'fieldset-customdropdown-option menu-option';
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
                
                fieldset._setValue = function(val) {
                    if (val && typeof val === 'string') {
                        cdPick(val);
                    }
                };
                break;
                
            case 'custom-radio': // post_map_cards.custom_radio
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                
                // Radio icons from Admin Settings (system_images)
                function crGetSystemIconUrl(settingKey) {
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
                
                var radioUrl = crGetSystemIconUrl('icon_radio');
                var radioSelectedUrl = crGetSystemIconUrl('icon_radio_selected');
                
                var radioGroup = document.createElement('div');
                radioGroup.className = 'fieldset-radio-group';
                radioGroup.dataset.value = '';
                
                function crSyncUi() {
                    var selected = String(radioGroup.dataset.value || '').toLowerCase();
                    var rows = radioGroup.querySelectorAll('.fieldset-radio');
                    rows.forEach(function(row) {
                        var v = String(row.dataset.value || '').toLowerCase();
                        var isOn = (v === selected && selected !== '');
                        row.classList.toggle('fieldset-radio--selected', isOn);
                        var selectedImg = row.querySelector('.fieldset-radio-icon-selected');
                        if (selectedImg) selectedImg.style.display = isOn ? '' : 'none';
                    });
                }
                
                if (Array.isArray(fieldOptions)) {
                    fieldOptions.forEach(function(opt) {
                        var label = String(opt == null ? '' : opt).trim();
                        if (!label) return;
                        
                        var row = document.createElement('button');
                        row.type = 'button';
                        row.className = 'fieldset-radio';
                        row.dataset.value = label;
                        
                        var iconWrap = document.createElement('span');
                        iconWrap.className = 'fieldset-radio-box';
                        
                        var radioImg = document.createElement('img');
                        radioImg.className = 'fieldset-radio-icon';
                        radioImg.alt = '';
                        radioImg.src = radioUrl;
                        iconWrap.appendChild(radioImg);
                        
                        var selectedImg = document.createElement('img');
                        selectedImg.className = 'fieldset-radio-icon-selected';
                        selectedImg.alt = '';
                        selectedImg.src = radioSelectedUrl;
                        selectedImg.style.display = 'none';
                        iconWrap.appendChild(selectedImg);
                        
                        var text = document.createElement('span');
                        text.className = 'fieldset-radio-text';
                        text.textContent = label;
                        
                        row.appendChild(iconWrap);
                        row.appendChild(text);
                        
                        row.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            radioGroup.dataset.value = label;
                            crSyncUi();
                            try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                        });
                        
                        radioGroup.appendChild(row);
                    });
                }
                fieldset.appendChild(radioGroup);
                
                fieldset._setValue = function(val) {
                    if (val && typeof val === 'string') {
                        radioGroup.dataset.value = val;
                        crSyncUi();
                    }
                };
                break;
                
            case 'custom-checklist': // post_map_cards.custom_checklist
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                
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
                
                fieldset._setValue = function(val) {
                    if (Array.isArray(val)) {
                        ccSetSelected(val);
                        ccSyncUi();
                    }
                };
                break;
                
            case 'email':
            case 'account-email':
            case 'public-email':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var emailInput = document.createElement('input');
                emailInput.type = 'email';
                emailInput.className = 'fieldset-input input-class-1';
                if (key === 'public-email') emailInput.autocomplete = 'off';
                applyPlaceholder(emailInput, placeholder);
                var emailValidation = addInputValidation(emailInput, minLength, maxLength, isValidEmail);
                fieldset.appendChild(emailInput);
                fieldset.appendChild(emailValidation.charCount);
                fieldset._setValue = function(val) {
                    if (emailInput && val !== null && val !== undefined) {
                        emailInput.value = val || '';
                        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                };
                break;
                
            case 'public-phone':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var phoneRow = document.createElement('div');
                phoneRow.className = 'fieldset-row';
                var prefixMenu = buildPhonePrefixMenu(container);
                phoneRow.appendChild(prefixMenu);
                var phoneInput = document.createElement('input');
                phoneInput.type = 'tel';
                phoneInput.className = 'fieldset-input input-class-1';
                applyPlaceholder(phoneInput, placeholder);
                makePhoneDigitsOnly(phoneInput);
                var phoneValidation = addInputValidation(phoneInput, minLength, maxLength, null);
                phoneRow.appendChild(phoneInput);
                applyFieldsetRowItemClasses(phoneRow);
                fieldset.appendChild(phoneRow);
                fieldset.appendChild(phoneValidation.charCount);

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    if (phoneInput) phoneInput.value = val.public_phone || ''; // DB column stays underscore
                    if (prefixMenu && typeof prefixMenu._phonePrefixSetValue === 'function') {
                        prefixMenu._phonePrefixSetValue(val.phone_prefix || null);
                    }
                    if (phoneInput) phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                };
                break;
                
            case 'address':
            case 'location': // legacy support
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var addrWrap = document.createElement('div');
                addrWrap.className = 'fieldset-location-inputwrap';
                var addrInputEl = document.createElement('input');
                addrInputEl.type = 'text';
                addrInputEl.className = 'fieldset-input input-class-1';
                applyPlaceholder(addrInputEl, placeholder);
                addrWrap.appendChild(addrInputEl);
                addrWrap.style.marginBottom = '10px';
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

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    if (addrInputEl) {
                        addrInputEl.value = val.address_line || '';
                        if (val.latitude && val.longitude) {
                            addrInputEl.dataset.placesConfirmed = 'true';
                        }
                    }
                    if (addrLatInput) addrLatInput.value = val.latitude || '';
                    if (addrLngInput) addrLngInput.value = val.longitude || '';
                    if (addrCountryInput) addrCountryInput.value = val.country_code || '';
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                };
                break;
                
            case 'city':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var cityWrap = document.createElement('div');
                cityWrap.className = 'fieldset-location-inputwrap';
                var cityInputEl = document.createElement('input');
                cityInputEl.type = 'text';
                cityInputEl.className = 'fieldset-input input-class-1';
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

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    if (cityInputEl) {
                        cityInputEl.value = val.address_line || '';
                        if (val.latitude && val.longitude) {
                            cityInputEl.dataset.placesConfirmed = 'true';
                        }
                    }
                    if (cityLatInput) cityLatInput.value = val.latitude || '';
                    if (cityLngInput) cityLngInput.value = val.longitude || '';
                    if (cityCountryInput) cityCountryInput.value = val.country_code || '';
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                };
                break;
                
            case 'website-url':
            case 'tickets-url':
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var urlInput = document.createElement('input');
                urlInput.type = 'text'; // text not url, we handle protocol
                urlInput.className = 'fieldset-input input-class-1';
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
                
                fieldset.appendChild(buildLabel(name, imageTooltipText, null, null, instruction));
                
                var imagesContainer = document.createElement('div');
                imagesContainer.className = 'fieldset-images-container';
                
                // Each entry: { file, fileUrl, cropState?, cropRect?, previewUrl? }
                // cropRect: { x1, y1, x2, y2 } in original image pixels (for Bunny Dynamic Image API crop=...)
                var imageEntries = [];
                var nextImageEntryId = 1;
                var maxImages = 10;
                
                // Basket: shows all post_media images as mini-thumbs (50x50)
                // Items in imageEntries get blue border + full opacity
                // Items not in imageEntries get lower opacity, click to add
                var postId = options.postId || null;
                var basketMedia = []; // All media from post_media for this post
                var basketLoaded = false;
                var basketContainer = null;
                var localBasketEntries = []; // Local images removed from slots (kept for re-adding)
                
                function isMediaInSlots(mediaId) {
                    if (!mediaId) return false;
                    for (var i = 0; i < imageEntries.length; i++) {
                        if (imageEntries[i] && imageEntries[i].id === mediaId) return true;
                    }
                    return false;
                }
                
                function isLocalEntryInSlots(entryId) {
                    if (!entryId) return false;
                    for (var i = 0; i < imageEntries.length; i++) {
                        if (imageEntries[i] && imageEntries[i]._imageEntryId === entryId) return true;
                    }
                    return false;
                }
                
                function addImageClassToUrl(url, className) {
                    if (!url || !className) return url;
                    var separator = url.indexOf('?') === -1 ? '?' : '&';
                    return url + separator + 'class=' + className;
                }
                
                function addMediaToSlot(mediaItem) {
                    if (!mediaItem || imageEntries.length >= maxImages) return;
                    if (isMediaInSlots(mediaItem.id)) return; // Already in slot
                    
                    imageEntries.push({
                        _imageEntryId: String(nextImageEntryId++),
                        id: mediaItem.id,
                        file: null,
                        fileUrl: mediaItem.file_url,
                        previewUrl: mediaItem.file_url,
                        cropState: null,
                        cropRect: mediaItem.settings_json && mediaItem.settings_json.crop ? mediaItem.settings_json.crop : null
                    });
                    updateImagesMeta();
                    renderImages();
                    renderBasket();
                }
                
                function addLocalEntryToSlot(localEntry) {
                    if (!localEntry || imageEntries.length >= maxImages) return;
                    if (isLocalEntryInSlots(localEntry._imageEntryId)) return;
                    
                    imageEntries.push(localEntry);
                    // Remove from localBasketEntries
                    var idx = localBasketEntries.indexOf(localEntry);
                    if (idx !== -1) localBasketEntries.splice(idx, 1);
                    
                    updateImagesMeta();
                    renderImages();
                    renderBasket();
                }
                
                function fetchBasketMedia() {
                    if (!postId || basketLoaded) return;
                    basketLoaded = true;
                    
                    fetch('/gateway.php?action=get-post-media&post_id=' + postId)
                        .then(function(res) { return res.json(); })
                        .then(function(data) {
                            if (data && data.success && Array.isArray(data.media)) {
                                basketMedia = data.media;
                                renderBasket();
                            }
                        })
                        .catch(function(err) {
                            console.warn('[Fieldset] Failed to load basket media:', err);
                        });
                }
                
                function renderBasket() {
                    // Combine basketMedia (from server) + localBasketEntries (local removals)
                    var allBasketItems = [];
                    
                    // Add local entries first (newest, on the left)
                    localBasketEntries.forEach(function(entry) {
                        allBasketItems.push({
                            type: 'local',
                            entry: entry,
                            id: entry._imageEntryId,
                            inSlot: isLocalEntryInSlots(entry._imageEntryId)
                        });
                    });
                    
                    // Add server media (sorted by created_at DESC from server)
                    basketMedia.forEach(function(media) {
                        allBasketItems.push({
                            type: 'server',
                            media: media,
                            id: media.id,
                            inSlot: isMediaInSlots(media.id)
                        });
                    });
                    
                    // Don't render if nothing to show
                    if (allBasketItems.length === 0) {
                        if (basketContainer) {
                            basketContainer.style.display = 'none';
                        }
                        return;
                    }
                    
                    // Create container if needed
                    if (!basketContainer) {
                        var basketLabel = document.createElement('div');
                        basketLabel.className = 'fieldset-images-basket-label';
                        basketLabel.textContent = 'Image History';
                        fieldset.appendChild(basketLabel);
                        
                        basketContainer = document.createElement('div');
                        basketContainer.className = 'fieldset-images-basket';
                        fieldset.appendChild(basketContainer);
                        
                        // Enable horizontal mousewheel scrolling
                        basketContainer.addEventListener('wheel', function(e) {
                            if (e.deltaY !== 0 && basketContainer.scrollWidth > basketContainer.clientWidth) {
                                e.preventDefault();
                                basketContainer.scrollLeft += e.deltaY;
                            }
                        }, { passive: false });
                    }
                    basketContainer.style.display = '';
                    basketContainer.innerHTML = '';
                    
                    allBasketItems.forEach(function(item) {
                        var thumb = document.createElement('div');
                        thumb.className = 'fieldset-images-basket-item';
                        if (item.inSlot) {
                            thumb.classList.add('fieldset-images-basket-item--active');
                        }
                        
                        var img = document.createElement('img');
                        img.className = 'fieldset-images-basket-item-image';
                        
                        if (item.type === 'local') {
                            // Local entry - use blob URL or preview
                            img.src = item.entry.previewUrl || item.entry.fileUrl || '';
                        } else {
                            // Server media - use minithumb class
                            img.src = addImageClassToUrl(item.media.file_url, 'minithumb');
                        }
                        
                        thumb.appendChild(img);
                        
                        // Click to add to slot (if not already there and under max)
                        if (!item.inSlot) {
                            thumb.style.cursor = 'pointer';
                            thumb.addEventListener('click', function() {
                                if (imageEntries.length >= maxImages) {
                                    if (window.ToastComponent && ToastComponent.showError) {
                                        ToastComponent.showError('Maximum ' + maxImages + ' images allowed');
                                    }
                                    return;
                                }
                                if (item.type === 'local') {
                                    addLocalEntryToSlot(item.entry);
                                } else {
                                    addMediaToSlot(item.media);
                                }
                            });
                        }
                        
                        basketContainer.appendChild(thumb);
                    });
                }

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
                                id: entry.id || null,
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

                fieldset._setValue = function(val) {
                    // val: array of objects with url and optional crop
                    imageEntries.forEach(revokeEntryUrls);
                    imageEntries = [];
                    
                    if (Array.isArray(val)) {
                        val.forEach(function(img) {
                            if (!img || !img.url) return;
                            imageEntries.push({
                                _imageEntryId: String(nextImageEntryId++),
                                id: img.id || null,
                                file: null,
                                fileUrl: img.url,
                                previewUrl: img.url,
                                cropState: null,
                                cropRect: img.crop || null
                            });
                        });
                    }
                    
                    updateImagesMeta();
                    renderImages();
                    // Fetch basket media if postId is set (edit mode)
                    if (postId && !basketLoaded) {
                        fetchBasketMedia();
                    } else {
                        renderBasket();
                    }
                };

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
                    // Enable CORS for CDN images so canvas can export them
                    img.crossOrigin = 'anonymous';
                    img.onload = function() {
                        try {
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
                            if (!ctx) return; // Can't get context, skip preview
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

                            canvas.toBlob(function(blob) {
                                if (!blob) return; // Failed to generate blob, skip preview

                                if (entry.previewUrl && entry.previewUrl.indexOf('blob:') === 0) {
                                    try { URL.revokeObjectURL(entry.previewUrl); } catch (e) {}
                                }
                                entry.previewUrl = URL.createObjectURL(blob);
                                renderImages();
                            }, 'image/jpeg', 0.92);
                        } catch (e) {
                            // CORS or other error - skip preview generation, crop is still saved
                            renderImages();
                        }
                    };
                    img.onerror = function() {
                        // Failed to load image for preview - crop is still saved, just no preview
                        renderImages();
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
                                var removed = imageEntries[idx];
                                if (removed) {
                                    // If it's a local file (no server id), keep in basket for re-adding
                                    if (removed.file && !removed.id) {
                                        localBasketEntries.unshift(removed); // Add to front (newest)
                                    }
                                    // Don't revoke URLs for items going to basket
                                    // revokeEntryUrls(removed);
                                }
                                imageEntries.splice(idx, 1);
                                updateImagesMeta();
                                renderImages();
                                renderBasket();
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
                
                // Fetch basket media if postId is set (edit mode)
                if (postId) {
                    fetchBasketMedia();
                }
                break;
            
            case 'amenities':
                fieldset.appendChild(buildLabel(name, tooltip, null, null, instruction));
                var amenitiesGrid = document.createElement('div');
                amenitiesGrid.className = 'fieldset-amenities-container';
                
                // Get radio icons from Admin Settings (system_images) - same pattern as custom_radio
                function amGetSystemIconUrl(settingKey) {
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
                
                var amRadioUrl = amGetSystemIconUrl('icon_radio');
                var amRadioSelectedUrl = amGetSystemIconUrl('icon_radio_selected');
                
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
                    row.dataset.amenity = amenityName; // Store amenity name for value extraction
                    row.dataset.value = ''; // Empty = unset, '1' = Yes, '0' = No
                    
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
                    
                    // Yes/No options (using buttons with system images - same pattern as custom_radio)
                    var optionsEl = document.createElement('div');
                    optionsEl.className = 'fieldset-amenities-row-options';
                    
                    // Helper to update row styling and button states
                    function setAmenityState(newValue) {
                        row.dataset.value = newValue;
                        var isYes = newValue === '1';
                        var isNo = newValue === '0';
                        nameEl.classList.toggle('fieldset-amenities-row-text--no', isNo);
                        iconImg.classList.toggle('fieldset-amenities-row-image--yes', isYes);
                        iconImg.classList.toggle('fieldset-amenities-row-image--no', isNo);
                        // Toggle selected icon visibility only - base icon always visible
                        yesRadioSelectedImg.style.display = isYes ? '' : 'none';
                        noRadioSelectedImg.style.display = isNo ? '' : 'none';
                    }
                    
                    // Yes button
                    var yesBtn = document.createElement('button');
                    yesBtn.type = 'button';
                    yesBtn.className = 'fieldset-amenities-option';
                    
                    var yesIconWrap = document.createElement('span');
                    yesIconWrap.className = 'fieldset-amenities-option-icon';
                    var yesRadioImg = document.createElement('img');
                    yesRadioImg.className = 'fieldset-amenities-option-radio';
                    yesRadioImg.src = amRadioUrl;
                    yesRadioImg.alt = '';
                    yesIconWrap.appendChild(yesRadioImg);
                    var yesRadioSelectedImg = document.createElement('img');
                    yesRadioSelectedImg.className = 'fieldset-amenities-option-radio-selected';
                    yesRadioSelectedImg.src = amRadioSelectedUrl;
                    yesRadioSelectedImg.alt = '';
                    yesRadioSelectedImg.style.display = 'none';
                    yesIconWrap.appendChild(yesRadioSelectedImg);
                    yesBtn.appendChild(yesIconWrap);
                    
                    var yesText = document.createElement('span');
                    yesText.className = 'fieldset-amenities-option-text';
                    yesText.textContent = 'Yes';
                    yesBtn.appendChild(yesText);
                    
                    yesBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        setAmenityState('1');
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                    });
                    optionsEl.appendChild(yesBtn);
                    
                    // No button
                    var noBtn = document.createElement('button');
                    noBtn.type = 'button';
                    noBtn.className = 'fieldset-amenities-option';
                    
                    var noIconWrap = document.createElement('span');
                    noIconWrap.className = 'fieldset-amenities-option-icon';
                    var noRadioImg = document.createElement('img');
                    noRadioImg.className = 'fieldset-amenities-option-radio';
                    noRadioImg.src = amRadioUrl;
                    noRadioImg.alt = '';
                    noIconWrap.appendChild(noRadioImg);
                    var noRadioSelectedImg = document.createElement('img');
                    noRadioSelectedImg.className = 'fieldset-amenities-option-radio-selected';
                    noRadioSelectedImg.src = amRadioSelectedUrl;
                    noRadioSelectedImg.alt = '';
                    noRadioSelectedImg.style.display = 'none';
                    noIconWrap.appendChild(noRadioSelectedImg);
                    noBtn.appendChild(noIconWrap);
                    
                    var noText = document.createElement('span');
                    noText.className = 'fieldset-amenities-option-text';
                    noText.textContent = 'No';
                    noBtn.appendChild(noText);
                    
                    noBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        setAmenityState('0');
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                    });
                    optionsEl.appendChild(noBtn);
                    
                    row.appendChild(optionsEl);
                    amenitiesGrid.appendChild(row);
                });

                fieldset._setValue = function(val) {
                    // val: array of { amenity, value }
                    if (!Array.isArray(val)) return;
                    val.forEach(function(item) {
                        var row = fieldset.querySelector('.fieldset-amenities-row[data-amenity="' + item.amenity + '"]');
                        if (row) {
                            var valStr = String(item.value);
                            row.dataset.value = valStr;
                            row.querySelectorAll('.fieldset-amenities-option').forEach(function(btn) {
                                var isYes = btn.textContent.trim() === 'Yes';
                                btn.classList.toggle('fieldset-amenities-option--selected', (isYes && valStr === '1') || (!isYes && valStr === '0'));
                                var selImg = btn.querySelector('.fieldset-amenities-option-radio-selected');
                                if (selImg) selImg.style.display = ((isYes && valStr === '1') || (!isYes && valStr === '0')) ? 'block' : 'none';
                            });
                        }
                    });
                    updateCompleteFromDom();
                };
                
                fieldset.appendChild(amenitiesGrid);
                break;
            
            case 'age-rating':
                fieldset.appendChild(buildLabel(name, tooltip, null, null, instruction));
                var ageMenu = buildAgeRatingMenu(container);
                fieldset.appendChild(ageMenu);
                fieldset._setValue = function(val) {
                    if (ageMenu && typeof ageMenu._ageRatingSetValue === 'function') {
                        ageMenu._ageRatingSetValue(val || null);
                    }
                };
                break;
                
            case 'item-pricing':
                // Item Name, Currency, Item Price (full width), then list of variants
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));

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
                itemNameSub.className = 'fieldset-sublabel fieldset-itempricing-sublabel-itemname';
                itemNameSub.textContent = 'Item Name';
                itemNameSub.style.marginBottom = '6px'; // 10-12-6 rule: 6px label-element
                fieldset.appendChild(itemNameSub);
                
                // Item Name input
                var itemNameInput = document.createElement('input');
                itemNameInput.type = 'text';
                itemNameInput.className = 'fieldset-input fieldset-itempricing-input-itemname input-class-1';
                applyPlaceholder(itemNameInput, getSubfieldPlaceholder('item-name'));
                itemNameInput.style.marginBottom = '10px'; // 10-12-6 rule: 10px element-element
                fieldset.appendChild(itemNameInput);
                
                // Currency + Item Price row
                var itemPriceRow = document.createElement('div');
                itemPriceRow.className = 'fieldset-row fieldset-itempricing-row-itemprice';
                itemPriceRow.style.marginBottom = '10px'; // 10-12-6 rule: 10px element-element
                
                // Currency column (fixed width 100px)
                var itemCurrencyCol = document.createElement('div');
                itemCurrencyCol.style.flex = '0 0 100px';
                
                // Currency sublabel
                var itemCurrencySub = document.createElement('div');
                itemCurrencySub.className = 'fieldset-sublabel fieldset-itempricing-sublabel-currency';
                itemCurrencySub.textContent = 'Currency';
                itemCurrencySub.style.marginBottom = '6px'; // 10-12-6 rule: 6px label-element
                itemCurrencyCol.appendChild(itemCurrencySub);
                
                // Build currency menu for item (no default - user must select if required)
                var ipSelectedCurrency = null;
                var ipCurrencyMenu = null;
                
                // Helper to get currently selected currency code
                function ipGetSelectedCurrencyCode() {
                    return ipSelectedCurrency;
                }
                
                if (typeof CurrencyComponent === 'undefined') {
                    console.error('[FieldsetBuilder] CurrencyComponent not available');
                    var placeholderMenu = document.createElement('div');
                    itemCurrencyCol.appendChild(placeholderMenu);
                } else {
                    var result = CurrencyComponent.buildCompactMenu({
                        initialValue: null,
                        placeholder: 'Select',
                        onSelect: function(value, label, countryCode) {
                            var oldCurrency = ipSelectedCurrency;
                            ipSelectedCurrency = value;
                            // Update price input placeholder based on currency
                            var priceInput = fieldset.querySelector('.fieldset-itempricing-input-itemprice');
                            if (priceInput) {
                                updatePricePlaceholder(priceInput, value);
                                // Re-format existing value with new currency
                                var val = String(priceInput.value || '').trim();
                                if (val) {
                                    // Parse with old currency to get numeric value
                                    var numericValue;
                                    if (oldCurrency && CurrencyComponent.parseInput) {
                                        numericValue = CurrencyComponent.parseInput(val, oldCurrency);
                                    } else {
                                        numericValue = parseFloat(val.replace(/[^0-9.-]/g, ''));
                                    }
                                    // Format with new currency
                                    if (Number.isFinite(numericValue) && CurrencyComponent.formatWithSymbol) {
                                        priceInput.value = CurrencyComponent.formatWithSymbol(numericValue.toString(), value);
                                    }
                                }
                            }
                        }
                    });
                    ipCurrencyMenu = result;
                    result.element.classList.add('fieldset-itempricing-menu-currency');
                    itemCurrencyCol.appendChild(result.element);
                }
                itemPriceRow.appendChild(itemCurrencyCol);
                
                // Item Price column (flexible width)
                var itemPriceCol = document.createElement('div');
                itemPriceCol.style.flex = '1';
                
                // Item Price sublabel
                var itemPriceSub = document.createElement('div');
                itemPriceSub.className = 'fieldset-sublabel fieldset-itempricing-sublabel-itemprice';
                itemPriceSub.textContent = 'Item Price';
                itemPriceSub.style.marginBottom = '6px'; // 10-12-6 rule: 6px label-element
                itemPriceCol.appendChild(itemPriceSub);
                
                // Item Price input - linked to currency selection
                var itemPriceInput = document.createElement('input');
                itemPriceInput.type = 'text';
                itemPriceInput.className = 'fieldset-input fieldset-itempricing-input-itemprice input-class-1';
                itemPriceInput.placeholder = '0.00';
                attachMoneyInputBehavior(itemPriceInput, ipGetSelectedCurrencyCode);
                itemPriceCol.appendChild(itemPriceInput);
                itemPriceRow.appendChild(itemPriceCol);
                applyFieldsetRowItemClasses(itemPriceRow);
                
                fieldset.appendChild(itemPriceRow);

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    
                    if (itemNameInput) itemNameInput.value = val.item_name || '';
                    
                    // Set raw price first (same as Create Post form)
                    if (itemPriceInput) {
                        itemPriceInput.value = val.item_price || '';
                    }
                    
                    // Set currency and format price (same logic as onSelect callback)
                    if (ipCurrencyMenu && typeof ipCurrencyMenu.setValue === 'function') {
                        ipCurrencyMenu.setValue(val.currency || null);
                        ipSelectedCurrency = val.currency || null;
                        
                        // Format price with currency symbol (same as onSelect does)
                        if (itemPriceInput && val.currency) {
                            updatePricePlaceholder(itemPriceInput, val.currency);
                            var priceStr = String(itemPriceInput.value || '').trim();
                            if (priceStr) {
                                var numericValue = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));
                                if (Number.isFinite(numericValue) && CurrencyComponent.formatWithSymbol) {
                                    itemPriceInput.value = CurrencyComponent.formatWithSymbol(numericValue.toString(), val.currency);
                                }
                            }
                        }
                    }
                    
                    // Variants
                    if (itemVariantsContainer) {
                        itemVariantsContainer.innerHTML = '';
                        if (Array.isArray(val.item_variants)) {
                            val.item_variants.forEach(function(v) {
                                var row = createItemVariantRow();
                                var inp = row.querySelector('.fieldset-itempricing-input-itemvariantname');
                                if (inp) inp.value = v;
                                itemVariantsContainer.appendChild(row);
                            });
                        }
                        if (itemVariantsContainer.children.length === 0) {
                            itemVariantsContainer.appendChild(createItemVariantRow());
                        }
                        updateItemVariantButtons();
                    }
                    
                    if (itemNameInput) itemNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                    // Note: Don't dispatch input on itemPriceInput - it would strip the currency symbol
                    updateCompleteFromDom();
                };
                
                // Variants section sublabel
                var variantsSectionLabel = document.createElement('div');
                variantsSectionLabel.className = 'fieldset-sublabel fieldset-itempricing-sublabel-itemvariants';
                variantsSectionLabel.textContent = 'Item Variants';
                variantsSectionLabel.style.marginBottom = '6px'; // 10-12-6 rule: 6px label-element
                fieldset.appendChild(variantsSectionLabel);
                
                // Variants container
                var itemVariantsContainer = document.createElement('div');
                itemVariantsContainer.className = 'fieldset-itempricing-container-itemvariants';
                // Spacing is handled by last child rule in invisible container
                fieldset.appendChild(itemVariantsContainer);
                
                function createItemVariantRow() {
                    // Single row element (no separate block wrapper)
                    var variantRow = document.createElement('div');
                    variantRow.className = 'fieldset-row fieldset-itempricing-row-itemvariant';
                    variantRow.style.marginBottom = '10px'; // 10-12-6 rule: 10px element-element
                    
                    // Variant name input
                    var variantInput = document.createElement('input');
                    variantInput.type = 'text';
                    variantInput.className = 'fieldset-input fieldset-itempricing-input-itemvariantname input-class-1';
                    applyPlaceholder(variantInput, getSubfieldPlaceholder('item-variant'));
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
                        var newRow = createItemVariantRow();
                        itemVariantsContainer.appendChild(newRow);
                        updateItemVariantButtons();
                        
                        var input = newRow.querySelector('.fieldset-itempricing-input-itemvariantname');
                        if (input) input.focus();
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
                    rows.forEach(function(row, idx) {
                        // 10-12-6 rule: last child of invisible container gets margin-bottom 0
                        row.style.marginBottom = (idx === rows.length - 1) ? '0' : '10px';

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
                              
            case 'ticket-pricing':
                // TICKET PRICING FIELDSET
                // Ticket groups (A, B, C...) with age rating, currency, ticket areas, and pricing tiers.
                // This fieldset exists ONCE in the primary container (above the line).
                // Sessions fieldset reads ticket group keys from this fieldset.
                
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));

                // Ticket group state
                var tpTicketGroups = {}; // { A: itemEl, B: itemEl, ... }
                var tpTicketGroupList = null; // container element for group list
                
                function tpGetSystemTicketIconUrl() {
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

                function tpGetSystemPlusIconUrl() {
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

                function tpGetSystemMinusIconUrl() {
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

                function tpFirstUnusedLetter() {
                    for (var i = 0; i < 26; i++) {
                        var key = String.fromCharCode(65 + i);
                        if (!tpTicketGroups[key]) return key;
                    }
                    return 'G' + (Object.keys(tpTicketGroups).length + 1);
                }

                function tpEnsureDefaultGroup() {
                    if (!tpTicketGroups['A']) tpEnsureTicketGroup('A');
                }

                // Shared currency state across all pricing editors in this fieldset
                var tpInitialCurrencyCode = defaultCurrency || null;
                var tpInitialCurrency = null;
                if (tpInitialCurrencyCode && CurrencyComponent.isLoaded()) {
                    var tpFound = CurrencyComponent.getData().find(function(item) { return item.value === tpInitialCurrencyCode; });
                    if (tpFound) {
                        var tpCountryCode = tpFound.filename ? tpFound.filename.replace('.svg', '') : null;
                        tpInitialCurrency = { flag: tpCountryCode, code: tpInitialCurrencyCode };
                    }
                }
                var tpTicketCurrencyState = tpInitialCurrency || { flag: null, code: null };
                var tpTicketCurrencyMenus = [];

                function tpGetTicketCurrencyCode() {
                    return tpTicketCurrencyState.code || null;
                }
                
                function tpSyncAllTicketCurrencies() {
                    tpTicketCurrencyMenus.forEach(function(menuObj) {
                        try {
                            if (!menuObj || typeof menuObj.setValue !== 'function') return;
                            menuObj.setValue(tpTicketCurrencyState.code || null);
                        } catch (e0) {}
                    });
                    tpUpdateAllPricePlaceholders();
                }
                
                function tpUpdateAllPricePlaceholders() {
                    var priceInputs = fieldset.querySelectorAll('.fieldset-ticketpricing-input-price');
                    priceInputs.forEach(function(inp) {
                        var groupEl = inp.closest('.fieldset-ticketpricing-ticketgroup-item');
                        var currencyCode = tpGetTicketCurrencyCode();
                        if (groupEl) {
                            var currencyInput = groupEl.querySelector('.component-currencyfull-menu-button-input');
                            var val = currencyInput ? String(currencyInput.value || '').trim() : '';
                            if (val.indexOf(' - ') !== -1) val = val.split(' - ')[0].trim();
                            if (val) currencyCode = val;
                        }
                        updatePricePlaceholder(inp, currencyCode);
                    });
                }
                
                function tpReformatAllPriceValues(oldCurrencyCode, newCurrencyCode) {
                    if (!newCurrencyCode) return;
                    var priceInputs = fieldset.querySelectorAll('.fieldset-ticketpricing-input-price');
                    priceInputs.forEach(function(inp) {
                        var groupEl = inp.closest('.fieldset-ticketpricing-ticketgroup-item');
                        var activeNewCode = newCurrencyCode;
                        if (groupEl) {
                            var currencyInput = groupEl.querySelector('.component-currencyfull-menu-button-input');
                            var val = currencyInput ? String(currencyInput.value || '').trim() : '';
                            if (val.indexOf(' - ') !== -1) val = val.split(' - ')[0].trim();
                            if (val) activeNewCode = val;
                        }

                        var val = String(inp.value || '').trim();
                        if (val === '') return;
                        
                        var numericValue;
                        if (oldCurrencyCode && typeof CurrencyComponent !== 'undefined' && CurrencyComponent.parseInput) {
                            numericValue = CurrencyComponent.parseInput(val, oldCurrencyCode);
                        } else {
                            numericValue = parseFloat(val.replace(/[^0-9.-]/g, ''));
                        }
                        
                        if (!Number.isFinite(numericValue)) return;
                        
                        if (typeof CurrencyComponent !== 'undefined' && CurrencyComponent.formatWithSymbol) {
                            inp.value = CurrencyComponent.formatWithSymbol(numericValue.toString(), activeNewCode);
                        }
                    });
                }
                
                function tpBuildTicketCurrencyMenu(options) {
                    if (typeof CurrencyComponent === 'undefined') {
                        console.error('[FieldsetBuilder] CurrencyComponent not available');
                        return { element: document.createElement('div') };
                    }
                    var result = CurrencyComponent.buildFullMenu({
                        initialValue: options && options.initialValue !== undefined ? options.initialValue : tpTicketCurrencyState.code,
                        placeholder: 'Select',
                        onSelect: function(value, label, countryCode) {
                            var oldCode = tpTicketCurrencyState.code;
                            tpTicketCurrencyState.flag = countryCode;
                            tpTicketCurrencyState.code = value;
                            tpSyncAllTicketCurrencies();
                            tpReformatAllPriceValues(oldCode, value);
                            if (options && typeof options.onSelect === 'function') {
                                options.onSelect(value, label, countryCode);
                            }
                            try {
                                result.element.dispatchEvent(new Event('change', { bubbles: true }));
                            } catch (e) {}
                        }
                    });
                    tpTicketCurrencyMenus.push(result);
                    return result;
                }

                function tpAttachMoneyInputBehavior(inputEl) {
                    if (!inputEl) return;
                    
                    inputEl.addEventListener('input', function() {
                        var currencyCode = tpGetTicketCurrencyCode();
                        var groupEl = this.closest('.fieldset-ticketpricing-ticketgroup-item');
                        if (groupEl) {
                            var currencyInput = groupEl.querySelector('.component-currencyfull-menu-button-input');
                            var val = currencyInput ? String(currencyInput.value || '').trim() : '';
                            if (val.indexOf(' - ') !== -1) val = val.split(' - ')[0].trim();
                            if (val) currencyCode = val;
                        }
                        
                        if (currencyCode) {
                            if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.sanitizeInput) {
                                throw new Error('[FieldsetBuilder] CurrencyComponent.sanitizeInput is required');
                            }
                            this.value = CurrencyComponent.sanitizeInput(this.value, currencyCode);
                            return;
                        }
                        
                        var raw = String(this.value || '').replace(/[^0-9.]/g, '');
                        var parts = raw.split('.');
                        if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
                        this.value = raw;
                    });
                    
                    inputEl.addEventListener('focus', function() {
                        var v = String(this.value || '').trim();
                        if (v === '') return;
                        
                        var currencyCode = tpGetTicketCurrencyCode();
                        var groupEl = this.closest('.fieldset-ticketpricing-ticketgroup-item');
                        if (groupEl) {
                            var currencyInput = groupEl.querySelector('.component-currencyfull-menu-button-input');
                            var val = currencyInput ? String(currencyInput.value || '').trim() : '';
                            if (val.indexOf(' - ') !== -1) val = val.split(' - ')[0].trim();
                            if (val) currencyCode = val;
                        }
                        
                        if (currencyCode && typeof CurrencyComponent !== 'undefined' && CurrencyComponent.stripSymbol) {
                            this.value = CurrencyComponent.stripSymbol(v, currencyCode);
                        }
                    });
                    
                    inputEl.addEventListener('blur', function() {
                        var v = String(this.value || '').trim();
                        if (v === '') return;
                        
                        var currencyCode = tpGetTicketCurrencyCode();
                        var groupEl = this.closest('.fieldset-ticketpricing-ticketgroup-item');
                        if (groupEl) {
                            var currencyInput = groupEl.querySelector('.component-currencyfull-menu-button-input');
                            var val = currencyInput ? String(currencyInput.value || '').trim() : '';
                            if (val.indexOf(' - ') !== -1) val = val.split(' - ')[0].trim();
                            if (val) currencyCode = val;
                        }
                        
                        if (currencyCode) {
                            if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.formatWithSymbol) {
                                throw new Error('[FieldsetBuilder] CurrencyComponent.formatWithSymbol is required');
                            }
                            var formatted = CurrencyComponent.formatWithSymbol(v, currencyCode);
                            if (formatted !== '') {
                                this.value = formatted;
                                return;
                            }
                        }
                        
                        var num = parseFloat(v);
                        if (isNaN(num)) { this.value = ''; return; }
                        this.value = num.toFixed(2);
                    });
                }

                // --- Pricing editor builders ---
                function tpCreatePricingTierBlock(tiersContainer, yesRadio, groupKey) {
                    var block = document.createElement('div');
                    block.className = 'fieldset-ticketpricing-pricing-tier-block';
                    block.style.marginBottom = '8px';

                    var inputRow = document.createElement('div');
                    inputRow.className = 'fieldset-row fieldset-ticketpricing-tier-input-row';
                    inputRow.style.display = 'flex';
                    inputRow.style.gap = '8px';
                    inputRow.style.marginBottom = '0'; 

                    var tierInput = document.createElement('input');
                    tierInput.className = 'fieldset-input input-class-1';
                    applyPlaceholder(tierInput, getSubfieldPlaceholder('pricing-tier'));
                    tierInput.style.flex = '3';
                    inputRow.appendChild(tierInput);

                    var priceInput = document.createElement('input');
                    priceInput.className = 'fieldset-ticketpricing-input-price fieldset-input input-class-1';
                    priceInput.style.flex = '1.5';
                    priceInput.style.padding = '0 12px';
                    updatePricePlaceholder(priceInput, tpTicketCurrencyState.code);
                    tpAttachMoneyInputBehavior(priceInput);
                    inputRow.appendChild(priceInput);

                    function updateTierCompleteness() {
                        var areaBlock = tiersContainer.closest('.fieldset-ticketpricing-pricing-ticketarea-block');
                        if (!areaBlock) return;
                        var labelsRow = areaBlock.querySelector('.fieldset-ticketpricing-tier-label-row');
                        if (!labelsRow) return;
                        var tReq = labelsRow.querySelector('.fieldset-label-required-tier');
                        var pReq = labelsRow.querySelector('.fieldset-label-required-price');
                        
                        var allTiers = tiersContainer.querySelectorAll('.fieldset-ticketpricing-pricing-tier-block');
                        var tComplete = true;
                        var pComplete = true;
                        allTiers.forEach(function(tb) {
                            var ti = tb.querySelector('.fieldset-ticketpricing-tier-input-row input.fieldset-input');
                            var pi = tb.querySelector('.fieldset-ticketpricing-input-price');
                            if (!ti || !String(ti.value || '').trim()) tComplete = false;
                            if (!pi || !String(pi.value || '').trim()) pComplete = false;
                        });
                        
                        if (tReq) tReq.classList.toggle('fieldset-label-required--complete', tComplete);
                        if (pReq) pReq.classList.toggle('fieldset-label-required--complete', pComplete);
                    }

                    function capitalize(val) {
                        if (!val) return '';
                        return val.charAt(0).toUpperCase() + val.slice(1);
                    }

                    tierInput.addEventListener('input', function() {
                        var cursor = this.selectionStart;
                        this.value = capitalize(this.value);
                        this.setSelectionRange(cursor, cursor);
                        updateTierCompleteness();
                    });
                    tierInput.addEventListener('change', function() {
                        this.dataset.manuallyEdited = 'true';
                        // Track manual edit for ticket areas (covers tier name edits)
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'ticketAreas');
                        }
                    });

                    priceInput.addEventListener('input', updateTierCompleteness);

                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-ticketpricing-pricing-button-add fieldset-row-item--no-flex';
                    var plusIconUrl = tpGetSystemPlusIconUrl();
                    if (plusIconUrl) {
                        var plusImg = document.createElement('img');
                        plusImg.className = 'fieldset-ticketpricing-pricing-button-icon fieldset-ticketpricing-pricing-button-icon--plus';
                        plusImg.alt = '';
                        plusImg.src = plusIconUrl;
                        addBtn.appendChild(plusImg);
                    }
                    addBtn.addEventListener('click', function() {
                        tiersContainer.appendChild(tpCreatePricingTierBlock(tiersContainer, yesRadio, groupKey));
                        tpUpdateTierButtons(tiersContainer);
                        updateTierCompleteness();
                        // Track manual edit when adding tiers
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'ticketAreas');
                        }
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    inputRow.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-ticketpricing-pricing-button-remove fieldset-row-item--no-flex';
                    var minusIconUrl = tpGetSystemMinusIconUrl();
                    if (minusIconUrl) {
                        var minusImg = document.createElement('img');
                        minusImg.className = 'fieldset-ticketpricing-pricing-button-icon fieldset-ticketpricing-pricing-button-icon--minus';
                        minusImg.alt = '';
                        minusImg.src = minusIconUrl;
                        removeBtn.appendChild(minusImg);
                    }
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        tpUpdateTierButtons(tiersContainer);
                        updateTierCompleteness();
                        // Track manual edit when removing tiers
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'ticketAreas');
                        }
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    inputRow.appendChild(removeBtn);

                    applyFieldsetRowItemClasses(inputRow);
                    block.appendChild(inputRow);
                    return block;
                }

                function tpUpdateTierButtons(tiersContainer) {
                    var blocks = tiersContainer.querySelectorAll('.fieldset-ticketpricing-pricing-tier-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block) {
                        var addBtn = block.querySelector('.fieldset-ticketpricing-pricing-button-add');
                        var removeBtn = block.querySelector('.fieldset-ticketpricing-pricing-button-remove');
                        if (atMax) { addBtn.style.opacity = '0.3'; addBtn.style.cursor = 'not-allowed'; addBtn.disabled = true; }
                        else { addBtn.style.opacity = '1'; addBtn.style.cursor = 'pointer'; addBtn.disabled = false; }
                        if (blocks.length === 1) { removeBtn.style.opacity = '0.3'; removeBtn.style.cursor = 'not-allowed'; removeBtn.disabled = true; }
                        else { removeBtn.style.opacity = '1'; removeBtn.style.cursor = 'pointer'; removeBtn.disabled = false; }
                    });
                }

                function tpCreateTicketAreaBlock(ticketAreasContainer, yesRadio, groupKey) {
                    var block = document.createElement('div');
                    block.className = 'fieldset-ticketpricing-pricing-ticketarea-block';
                    block.style.marginBottom = '12px'; 
                    block.style.padding = '0';

                    // Ticket Area Label Row
                    var seatLabelRow = document.createElement('div');
                    seatLabelRow.className = 'fieldset-row fieldset-ticketpricing-ticketarea-label-row';
                    seatLabelRow.style.marginBottom = '6px';
                    seatLabelRow.style.display = 'flex';
                    seatLabelRow.style.gap = '8px';

                    var seatSub = document.createElement('div');
                    seatSub.className = 'fieldset-sublabel';
                    seatSub.textContent = 'Ticket Area';
                    seatSub.style.marginBottom = '0';
                    seatSub.style.flex = '1';
                    
                    var seatReq = document.createElement('span');
                    seatReq.className = 'fieldset-label-required fieldset-label-required-area';
                    seatReq.textContent = '●';
                    seatSub.appendChild(seatReq);
                    seatLabelRow.appendChild(seatSub);

                    var areaBtnSpacer = document.createElement('div');
                    areaBtnSpacer.style.width = '80px';
                    areaBtnSpacer.style.flex = '0 0 80px';
                    seatLabelRow.appendChild(areaBtnSpacer);
                    block.appendChild(seatLabelRow);

                    // Ticket Area Input Row
                    var seatInputRow = document.createElement('div');
                    seatInputRow.className = 'fieldset-row fieldset-ticketpricing-ticketarea-input-row';
                    seatInputRow.style.display = 'flex';
                    seatInputRow.style.gap = '8px';
                    seatInputRow.style.marginBottom = '10px';

                    var seatInput = document.createElement('input');
                    seatInput.type = 'text';
                    seatInput.className = 'fieldset-input input-class-1 fieldset-ticketpricing-input-ticketarea';
                    applyPlaceholder(seatInput, getSubfieldPlaceholder('ticket-area'));
                    seatInput.style.flex = '1';

                    function capitalize(val) {
                        if (!val) return '';
                        return val.charAt(0).toUpperCase() + val.slice(1);
                    }

                    seatInput.addEventListener('input', function() {
                        var cursor = this.selectionStart;
                        this.value = capitalize(this.value);
                        this.setSelectionRange(cursor, cursor);
                        var hasVal = !!String(this.value || '').trim();
                        seatReq.classList.toggle('fieldset-label-required--complete', hasVal);
                    });

                    seatInput.addEventListener('change', function() {
                        this.dataset.manuallyEdited = 'true';
                        // Track manual edit for ticket areas
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'ticketAreas');
                        }
                    });
                    seatInputRow.appendChild(seatInput);

                    // Add/Remove ticket area block buttons
                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-ticketpricing-pricing-button-add fieldset-row-item--no-flex';
                    var plusIconUrl2 = tpGetSystemPlusIconUrl();
                    if (plusIconUrl2) {
                        var plusImg2 = document.createElement('img');
                        plusImg2.className = 'fieldset-ticketpricing-pricing-button-icon fieldset-ticketpricing-pricing-button-icon--plus';
                        plusImg2.alt = '';
                        plusImg2.src = plusIconUrl2;
                        addBtn.appendChild(plusImg2);
                    }
                    addBtn.addEventListener('click', function() {
                        ticketAreasContainer.appendChild(tpCreateTicketAreaBlock(ticketAreasContainer, yesRadio, groupKey));
                        tpUpdateTicketAreaButtons(ticketAreasContainer, true);
                        // Track manual edit when adding ticket areas
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'ticketAreas');
                        }
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    seatInputRow.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-ticketpricing-pricing-button-remove fieldset-row-item--no-flex';
                    var minusIconUrl2 = tpGetSystemMinusIconUrl();
                    if (minusIconUrl2) {
                        var minusImg2 = document.createElement('img');
                        minusImg2.className = 'fieldset-ticketpricing-pricing-button-icon fieldset-ticketpricing-pricing-button-icon--minus';
                        minusImg2.alt = '';
                        minusImg2.src = minusIconUrl2;
                        removeBtn.appendChild(minusImg2);
                    }
                    removeBtn.addEventListener('click', function() {
                        block.remove();
                        tpUpdateTicketAreaButtons(ticketAreasContainer, true);
                        // Track manual edit when removing ticket areas
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'ticketAreas');
                        }
                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                    });
                    seatInputRow.appendChild(removeBtn);

                    applyFieldsetRowItemClasses(seatInputRow);
                    block.appendChild(seatInputRow);

                    // Pricing Tiers container
                    var tiersContainer = document.createElement('div');
                    tiersContainer.className = 'fieldset-ticketpricing-pricing-tiers-container';

                    // Add Pricing Tier labels ONCE per ticket area block
                    var tierLabelRow = document.createElement('div');
                    tierLabelRow.className = 'fieldset-row fieldset-ticketpricing-tier-label-row';
                    tierLabelRow.style.marginBottom = '6px';
                    tierLabelRow.style.display = 'flex';
                    tierLabelRow.style.gap = '8px';

                    var tLabel = document.createElement('div');
                    tLabel.className = 'fieldset-sublabel';
                    tLabel.style.flex = '3';
                    tLabel.style.marginBottom = '0';
                    tLabel.innerHTML = 'Pricing Tier';
                    var tReq = document.createElement('span');
                    tReq.className = 'fieldset-label-required fieldset-label-required-tier';
                    tReq.textContent = '●';
                    tLabel.appendChild(tReq);
                    tierLabelRow.appendChild(tLabel);

                    var pLabel = document.createElement('div');
                    pLabel.className = 'fieldset-sublabel';
                    pLabel.style.flex = '1.5';
                    pLabel.style.marginBottom = '0';
                    pLabel.innerHTML = 'Price';
                    var pReq = document.createElement('span');
                    pReq.className = 'fieldset-label-required fieldset-label-required-price';
                    pReq.textContent = '●';
                    pLabel.appendChild(pReq);
                    tierLabelRow.appendChild(pLabel);

                    var btnSpacer = document.createElement('div');
                    btnSpacer.style.width = '80px';
                    btnSpacer.style.flex = '0 0 80px';
                    tierLabelRow.appendChild(btnSpacer);
                    tiersContainer.appendChild(tierLabelRow);

                    tiersContainer.appendChild(tpCreatePricingTierBlock(tiersContainer, yesRadio, groupKey));
                    block.appendChild(tiersContainer);

                    return block;
                }

                function tpUpdateTicketAreaButtons(ticketAreasContainer, isVisible) {
                    var blocks = ticketAreasContainer.querySelectorAll('.fieldset-ticketpricing-pricing-ticketarea-block');
                    var atMax = blocks.length >= 10;
                    blocks.forEach(function(block, idx) {
                        // 10-12-6 rule: last child of invisible container gets margin-bottom 0
                        block.style.marginBottom = (idx === blocks.length - 1) ? '0' : '12px';
                        if (blocks.length > 1 && isVisible) {
                            block.style.borderBottom = (idx < blocks.length - 1) ? '1px solid #333' : 'none';
                            block.style.paddingBottom = (idx < blocks.length - 1) ? '12px' : '0';
                        } else {
                            block.style.borderBottom = 'none';
                            block.style.paddingBottom = '0';
                        }
                        var addBtn = block.querySelector('.fieldset-ticketpricing-pricing-button-add');
                        var removeBtn = block.querySelector('.fieldset-ticketpricing-pricing-button-remove');
                        if (!addBtn) addBtn = block.querySelectorAll('.fieldset-ticketpricing-pricing-button-add')[0];
                        if (!removeBtn) removeBtn = block.querySelectorAll('.fieldset-ticketpricing-pricing-button-remove')[0];
                        if (addBtn) {
                            addBtn.disabled = atMax || !isVisible;
                            addBtn.style.opacity = (atMax || !isVisible) ? '0.3' : '1';
                        }
                        if (removeBtn) {
                            removeBtn.disabled = blocks.length <= 1 || !isVisible;
                            removeBtn.style.opacity = (blocks.length <= 1 || !isVisible) ? '0.3' : '1';
                        }
                    });
                }

                function tpExtractPricingFromEditor(editorEl) {
                    if (!editorEl) return [];
                    try {
                        var allocatedVal = 1;
                        var yesRadio = editorEl.querySelector('input[type="radio"][value="1"]');
                        if (yesRadio) allocatedVal = yesRadio.checked ? 1 : 0;

                        var ticketAreaBlocks = editorEl.querySelectorAll('.fieldset-ticketpricing-pricing-ticketarea-block');
                        var seatOut = [];
                        ticketAreaBlocks.forEach(function(block) {
                            if (allocatedVal === 0 && seatOut.length > 0) return;

                            var ticketArea = '';
                            var seatInput = block.querySelector('.fieldset-ticketpricing-input-ticketarea');
                            if (seatInput) ticketArea = String(seatInput.value || '').trim();
                            
                            var tiers = [];
                            block.querySelectorAll('.fieldset-ticketpricing-pricing-tier-block').forEach(function(tier) {
                                var tierName = '';
                                var tierInput = tier.querySelector('.fieldset-ticketpricing-tier-input-row input.fieldset-input');
                                if (tierInput) tierName = String(tierInput.value || '').trim();
                                
                                var currencyInput = editorEl.querySelector('.component-currencyfull-menu-button-input');
                                var curr = currencyInput ? String(currencyInput.value || '').trim() : '';
                                if (curr.indexOf(' - ') !== -1) curr = curr.split(' - ')[0].trim();
                                
                                var priceInput = tier.querySelector('.fieldset-ticketpricing-input-price');
                                var price = priceInput ? String(priceInput.value || '').trim() : '';
                                
                                tiers.push({ pricing_tier: tierName, currency: curr, price: price });
                            });
                            
                            seatOut.push({ 
                                allocated_areas: allocatedVal,
                                ticket_area: ticketArea, 
                                tiers: tiers 
                            });
                        });
                        return seatOut;
                    } catch (e) {
                        return [];
                    }
                }

                function tpReplaceEditorFromPricing(editorEl, pricingArr, groupKey, autofillState) {
                    if (!editorEl) return;
                    editorEl.innerHTML = '';
                    
                    // Determine if we should use autofill (non-A group, no existing data, autofill state exists)
                    var useAutofill = groupKey && groupKey !== 'A' && (!pricingArr || pricingArr.length === 0) && autofillState;
                    
                    // Row 1 & 2: Age Rating
                    var ageLabel = buildLabel('Age Rating', '', null, null);
                    ageLabel.style.marginBottom = '6px';
                    var ageDot = ageLabel.querySelector('.fieldset-label-required');
                    editorEl.appendChild(ageLabel);
                    
                    // Determine initial age rating value
                    var initialAgeValue = null;
                    if (pricingArr && pricingArr[0] && pricingArr[0].age_rating) {
                        initialAgeValue = pricingArr[0].age_rating;
                    } else if (useAutofill && autofillState.ageRating && !tpIsManuallyEdited(groupKey, 'ageRating')) {
                        initialAgeValue = autofillState.ageRating;
                    }
                    
                    var ageMenu = buildAgeRatingMenu(fieldset, {
                        initialValue: initialAgeValue,
                        onSelect: function(val) {
                            if (ageDot) ageDot.classList.toggle('fieldset-label-required--complete', !!String(val || '').trim());
                            // Track manual edit for non-A groups
                            if (groupKey && groupKey !== 'A') {
                                tpMarkAsManuallyEdited(groupKey, 'ageRating');
                            }
                        }
                    });
                    ageMenu.style.width = '100%';
                    ageMenu.style.marginBottom = '10px';
                    editorEl.appendChild(ageMenu);
                    
                    if (ageDot) {
                        ageDot.classList.toggle('fieldset-label-required--complete', !!String(initialAgeValue || '').trim());
                    }

                    // Row 3 & 4: Currency
                    var currLabel = buildLabel('Currency', '', null, null);
                    currLabel.style.marginBottom = '6px';
                    var currDot = currLabel.querySelector('.fieldset-label-required');
                    editorEl.appendChild(currLabel);
                    
                    // Determine initial currency value
                    var initialCurrValue = tpTicketCurrencyState.code;
                    if (pricingArr && pricingArr[0] && pricingArr[0].currency) {
                        initialCurrValue = pricingArr[0].currency;
                    } else if (useAutofill && autofillState.currency && !tpIsManuallyEdited(groupKey, 'currency')) {
                        initialCurrValue = autofillState.currency;
                    }
                    
                    var currResult = tpBuildTicketCurrencyMenu({
                        initialValue: initialCurrValue,
                        onSelect: function(val) {
                            if (currDot) currDot.classList.toggle('fieldset-label-required--complete', !!String(val || '').trim());
                            // Track manual edit for non-A groups
                            if (groupKey && groupKey !== 'A') {
                                tpMarkAsManuallyEdited(groupKey, 'currency');
                            }
                        }
                    });
                    var currMenu = currResult.element;
                    currMenu.style.width = '100%';
                    currMenu.style.marginBottom = '10px';
                    editorEl.appendChild(currMenu);
                    
                    if (currDot) {
                        currDot.classList.toggle('fieldset-label-required--complete', !!String(initialCurrValue || '').trim());
                    }

                    // Row 5: Allocated Ticket Areas
                    var allocatedRow = document.createElement('div');
                    allocatedRow.className = 'fieldset-row';
                    allocatedRow.style.display = 'flex';
                    allocatedRow.style.alignItems = 'center';
                    allocatedRow.style.justifyContent = 'space-between';
                    allocatedRow.style.marginBottom = '10px';
                    allocatedRow.style.height = '36px';
                    
                    var allocatedLabel = document.createElement('div');
                    allocatedLabel.className = 'fieldset-label';
                    allocatedLabel.style.marginBottom = '0'; 
                    allocatedLabel.innerHTML = '<span class="fieldset-label-text">Allocated Ticket Areas</span>';
                    allocatedRow.appendChild(allocatedLabel);
                    
                    var radioWrapper = document.createElement('div');
                    radioWrapper.className = 'fieldset-radio-wrapper';
                    radioWrapper.style.display = 'flex';
                    radioWrapper.style.gap = '20px';
                    radioWrapper.style.height = '36px';
                    
                    var radioName = 'allocated_' + Math.random().toString(36).substr(2, 9);
                    
                    var yesLabel = document.createElement('label');
                    yesLabel.style.display = 'flex';
                    yesLabel.style.alignItems = 'center';
                    yesLabel.style.gap = '5px';
                    yesLabel.style.cursor = 'pointer';
                    yesLabel.style.color = '#fff';
                    yesLabel.style.fontSize = '13px';
                    yesLabel.style.height = '36px';
                    yesLabel.style.paddingRight = '5px';
                    var yesRadio = document.createElement('input');
                    yesRadio.type = 'radio';
                    yesRadio.name = radioName;
                    yesRadio.value = '1';
                    yesRadio.checked = true;
                    yesLabel.appendChild(yesRadio);
                    yesLabel.appendChild(document.createTextNode('Yes'));
                    
                    var noLabel = document.createElement('label');
                    noLabel.style.display = 'flex';
                    noLabel.style.alignItems = 'center';
                    noLabel.style.gap = '5px';
                    noLabel.style.cursor = 'pointer';
                    noLabel.style.color = '#fff';
                    noLabel.style.fontSize = '13px';
                    noLabel.style.height = '36px';
                    noLabel.style.paddingRight = '5px';
                    var noRadio = document.createElement('input');
                    noRadio.type = 'radio';
                    noRadio.name = radioName;
                    noRadio.value = '0';
                    noLabel.appendChild(noRadio);
                    noLabel.appendChild(document.createTextNode('No'));
                    
                    radioWrapper.appendChild(yesLabel);
                    radioWrapper.appendChild(noLabel);
                    allocatedRow.appendChild(radioWrapper);
                    editorEl.appendChild(allocatedRow);
                    
                    var ticketAreasContainer = document.createElement('div');
                    ticketAreasContainer.className = 'fieldset-ticketpricing-pricing-ticketareas-container';
                    editorEl.appendChild(ticketAreasContainer);

                    function updateAllVisibility() {
                        var isYes = yesRadio.checked;
                        var blocks = ticketAreasContainer.querySelectorAll('.fieldset-ticketpricing-pricing-ticketarea-block');
                        blocks.forEach(function(block, idx) {
                            var labelRow = block.querySelector('.fieldset-ticketpricing-ticketarea-label-row');
                            var inputRow = block.querySelector('.fieldset-ticketpricing-ticketarea-input-row');
                            
                            if (labelRow) labelRow.style.display = isYes ? 'flex' : 'none';
                            if (inputRow) inputRow.style.display = isYes ? 'flex' : 'none';
                            
                            if (!isYes && idx > 0) {
                                block.remove();
                            }
                        });
                        tpUpdateTicketAreaButtons(ticketAreasContainer, isYes);
                    }
                    yesRadio.addEventListener('change', function() {
                        updateAllVisibility();
                        // Track manual edit for non-A groups
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'allocatedAreas');
                        }
                    });
                    noRadio.addEventListener('change', function() {
                        updateAllVisibility();
                        // Track manual edit for non-A groups
                        if (groupKey && groupKey !== 'A') {
                            tpMarkAsManuallyEdited(groupKey, 'allocatedAreas');
                        }
                    });

                    // Determine seats/ticket areas data source
                    var seats = Array.isArray(pricingArr) ? pricingArr : [];
                    var isAllocated = true;
                    
                    // Use autofill for ticket areas if applicable and not manually edited
                    if (useAutofill && autofillState.ticketAreas && autofillState.ticketAreas.length > 0 && !tpIsManuallyEdited(groupKey, 'ticketAreas')) {
                        // Convert autofill state to seats format (without prices)
                        seats = autofillState.ticketAreas.map(function(area) {
                            return {
                                ticket_area: area.ticketArea || '',
                                tiers: (area.tiers || []).map(function(tier) {
                                    return { pricing_tier: tier.pricing_tier || '', price: '' }; // Price always blank
                                }),
                                allocated_areas: autofillState.allocatedAreas ? 1 : 0
                            };
                        });
                        isAllocated = autofillState.allocatedAreas;
                    } else if (seats.length === 0) {
                        seats = [{}];
                    }
                    
                    if (seats.length > 0 && seats[0] && seats[0].allocated_areas !== undefined) {
                        isAllocated = parseInt(seats[0].allocated_areas) === 1;
                    }
                    
                    if (isAllocated) yesRadio.checked = true;
                    else noRadio.checked = true;

                    seats.forEach(function(seat, seatIdx) {
                        var block = tpCreateTicketAreaBlock(ticketAreasContainer, yesRadio, groupKey);
                        ticketAreasContainer.appendChild(block);
                        
                        var seatInput = block.querySelector('.fieldset-ticketpricing-input-ticketarea');
                        if (seatInput) seatInput.value = String((seat && (seat.ticket_area || seat.seating_area)) || '');
                        if (seatInput) seatInput.dispatchEvent(new Event('input'));
                        
                        var tiersContainer = block.querySelector('.fieldset-ticketpricing-pricing-tiers-container');
                        if (tiersContainer) {
                            var existingTierBlocks = tiersContainer.querySelectorAll('.fieldset-ticketpricing-pricing-tier-block');
                            existingTierBlocks.forEach(function(tb) { tb.remove(); });
                            
                            var tiers = (seat && Array.isArray(seat.tiers)) ? seat.tiers : [];
                            if (tiers.length === 0) tiers = [{}];
                            tiers.forEach(function(tierObj) {
                                var tierBlock = tpCreatePricingTierBlock(tiersContainer, yesRadio, groupKey);
                                tiersContainer.appendChild(tierBlock);
                                var tierNameInput = tierBlock.querySelector('.fieldset-ticketpricing-tier-input-row input.fieldset-input');
                                if (tierNameInput) {
                                    tierNameInput.value = String((tierObj && tierObj.pricing_tier) || '');
                                    tierNameInput.dispatchEvent(new Event('input'));
                                }
                                
                                // Price is always blank for autofilled groups
                                var priceInput = tierBlock.querySelector('.fieldset-ticketpricing-input-price');
                                if (priceInput) {
                                    var priceValue = (tierObj && tierObj.price) || '';
                                    priceInput.value = String(priceValue);
                                    priceInput.dispatchEvent(new Event('input'));
                                }
                            });
                            tpUpdateTierButtons(tiersContainer);
                        }
                    });
                    
                    tpUpdateTicketAreaButtons(ticketAreasContainer, isAllocated);
                    updateAllVisibility();
                    
                    // Format price values with currency symbol (same as when user selects currency)
                    if (initialCurrValue) {
                        var priceInputs = editorEl.querySelectorAll('.fieldset-ticketpricing-input-price');
                        priceInputs.forEach(function(inp) {
                            var val = String(inp.value || '').trim();
                            if (val === '') return;
                            var numericValue = parseFloat(val.replace(/[^0-9.-]/g, ''));
                            if (!Number.isFinite(numericValue)) return;
                            if (typeof CurrencyComponent !== 'undefined' && CurrencyComponent.formatWithSymbol) {
                                inp.value = CurrencyComponent.formatWithSymbol(numericValue.toString(), initialCurrValue);
                            }
                        });
                    }
                }

                var tpMaxTicketGroups = 10;
                
                // Track manual edits per group per element
                // Structure: { 'B': { ageRating: true, currency: true }, 'C': { currency: true } }
                var tpManualEditTracking = {};
                
                // Extract current state from group A (first group) for autofill
                function tpGetGroupAState() {
                    var groupA = tpTicketGroups['A'];
                    if (!groupA) return null;
                    
                    var editor = groupA.querySelector('.fieldset-ticketpricing-pricing-editor');
                    if (!editor) return null;
                    
                    var state = {
                        ageRating: null,
                        currency: null,
                        allocatedAreas: true,
                        ticketAreas: []
                    };
                    
                    // Get age rating
                    var ageMenu = editor.querySelector('.component-ageratingpicker-menu');
                    if (ageMenu && ageMenu.dataset && ageMenu.dataset.value) {
                        state.ageRating = ageMenu.dataset.value;
                    }
                    
                    // Get currency (extract just the code, not "USD - US Dollar")
                    var currInput = editor.querySelector('.component-currencyfull-menu-button-input');
                    if (currInput) {
                        var currVal = String(currInput.value || '').trim();
                        if (currVal.indexOf(' - ') !== -1) {
                            currVal = currVal.split(' - ')[0].trim();
                        }
                        state.currency = currVal;
                    }
                    
                    // Get allocated areas radio state
                    var yesRadio = editor.querySelector('input[type="radio"][value="1"]');
                    state.allocatedAreas = yesRadio ? yesRadio.checked : true;
                    
                    // Get ticket areas and tiers (without prices)
                    var ticketAreaBlocks = editor.querySelectorAll('.fieldset-ticketpricing-pricing-ticketarea-block');
                    ticketAreaBlocks.forEach(function(block) {
                        var areaData = {
                            ticketArea: '',
                            tiers: []
                        };
                        
                        var ticketAreaInput = block.querySelector('.fieldset-ticketpricing-input-ticketarea');
                        if (ticketAreaInput) {
                            areaData.ticketArea = ticketAreaInput.value || '';
                        }
                        
                        var tierBlocks = block.querySelectorAll('.fieldset-ticketpricing-pricing-tier-block');
                        tierBlocks.forEach(function(tierBlock) {
                            var tierNameInput = tierBlock.querySelector('.fieldset-ticketpricing-tier-input-row input.fieldset-input');
                            var tierName = tierNameInput ? (tierNameInput.value || '') : '';
                            // Note: price is intentionally NOT copied
                            areaData.tiers.push({ pricing_tier: tierName, price: '' });
                        });
                        
                        state.ticketAreas.push(areaData);
                    });
                    
                    return state;
                }
                
                // Reset manual edit tracking (called when reduced to 1 group)
                function tpResetManualEditTracking() {
                    tpManualEditTracking = {};
                }
                
                // Check if a specific element in a group has been manually edited
                function tpIsManuallyEdited(groupKey, elementKey) {
                    return tpManualEditTracking[groupKey] && tpManualEditTracking[groupKey][elementKey] === true;
                }
                
                // Mark an element as manually edited
                function tpMarkAsManuallyEdited(groupKey, elementKey) {
                    if (!tpManualEditTracking[groupKey]) {
                        tpManualEditTracking[groupKey] = {};
                    }
                    tpManualEditTracking[groupKey][elementKey] = true;
                }

                function tpAddTicketGroup() {
                    var keys = Object.keys(tpTicketGroups).sort();
                    if (keys.length >= tpMaxTicketGroups) return;
                    var newKey = tpFirstUnusedLetter();
                    
                    // Get state from group A to autofill the new group
                    var autofillState = tpGetGroupAState();
                    
                    tpEnsureTicketGroup(newKey, autofillState);
                    tpUpdateAllGroupButtons();
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                }

                async function tpRemoveTicketGroup(keyToRemove) {
                    var keys = Object.keys(tpTicketGroups).sort();
                    if (keys.length <= 1) return;
                    
                    try {
                        if (typeof ConfirmDialogComponent === 'undefined' || !ConfirmDialogComponent || typeof ConfirmDialogComponent.show !== 'function') {
                            console.error('[ticket_pricing] ConfirmDialogComponent not available');
                            return;
                        }
                    } catch (eCheck) { return; }
                    
                    var confirmed = false;
                    try {
                        confirmed = await ConfirmDialogComponent.show({
                            titleText: 'Delete Ticket Group ' + keyToRemove,
                            messageText: 'Are you sure?',
                            confirmLabel: 'Delete',
                            confirmClass: 'danger',
                            focusCancel: true
                        });
                    } catch (eDlg) { confirmed = false; }
                    if (!confirmed) return;
                    
                    var oldKeys = Object.keys(tpTicketGroups).sort();
                    var keyMap = {};
                    var newIdx = 0;
                    for (var i = 0; i < oldKeys.length; i++) {
                        if (oldKeys[i] === keyToRemove) continue;
                        var newKey = String.fromCharCode(65 + newIdx);
                        keyMap[oldKeys[i]] = newKey;
                        newIdx++;
                    }
                    
                    var g = tpTicketGroups[keyToRemove];
                    if (g) try { g.remove(); } catch (e1) {}
                    delete tpTicketGroups[keyToRemove];
                    
                    // Remap manual edit tracking to match new group letters
                    var newTracking = {};
                    Object.keys(tpManualEditTracking).forEach(function(oldKey) {
                        if (keyMap[oldKey]) {
                            newTracking[keyMap[oldKey]] = tpManualEditTracking[oldKey];
                        }
                    });
                    tpManualEditTracking = newTracking;
                    
                    var newGroups = {};
                    Object.keys(tpTicketGroups).sort().forEach(function(oldKey) {
                        var newKey = keyMap[oldKey];
                        var groupEl = tpTicketGroups[oldKey];
                        groupEl.dataset.ticketGroupKey = newKey;
                        var headerLabel = groupEl.querySelector('.fieldset-ticketpricing-ticketgroup-header-label');
                        if (headerLabel) headerLabel.textContent = 'Ticket Group ' + newKey;
                        newGroups[newKey] = groupEl;
                    });
                    tpTicketGroups = newGroups;
                    
                    // Reset manual edit tracking when reduced to 1 group
                    if (Object.keys(tpTicketGroups).length === 1) {
                        tpResetManualEditTracking();
                    }
                    
                    tpUpdateAllGroupButtons();
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
                }

                function tpUpdateAllGroupButtons() {
                    var keys = Object.keys(tpTicketGroups).sort();
                    var count = keys.length;
                    var atMax = count >= tpMaxTicketGroups;
                    var atMin = count <= 1;
                    
                    keys.forEach(function(k) {
                        var g = tpTicketGroups[k];
                        if (!g) return;
                        var addBtn = g.querySelector('.fieldset-ticketpricing-ticketgroup-button-add');
                        var removeBtn = g.querySelector('.fieldset-ticketpricing-ticketgroup-button-remove');
                        
                        if (addBtn) {
                            addBtn.disabled = atMax;
                            addBtn.style.opacity = atMax ? '0.3' : '1';
                            addBtn.style.cursor = atMax ? 'not-allowed' : 'pointer';
                        }
                        if (removeBtn) {
                            removeBtn.disabled = atMin;
                            removeBtn.style.opacity = atMin ? '0.3' : '1';
                            removeBtn.style.cursor = atMin ? 'not-allowed' : 'pointer';
                        }
                    });
                }

                function tpEnsureTicketGroup(groupKey, autofillState) {
                    var key = String(groupKey || '').trim();
                    if (!key) return null;
                    if (tpTicketGroups[key]) return tpTicketGroups[key];

                    var group = document.createElement('div');
                    group.className = 'fieldset-ticketpricing-ticketgroup-item accordion-class-1 accordion-class-1--open';
                    group.dataset.ticketGroupKey = key;

                    var header = document.createElement('div');
                    header.className = 'fieldset-ticketpricing-ticketgroup-item-header';

                    var headerContent = document.createElement('div');
                    headerContent.className = 'fieldset-ticketpricing-ticketgroup-item-header-content accordion-header';
                    headerContent.style.cursor = 'pointer';
                    
                    headerContent.addEventListener('click', function(e) {
                        group.classList.toggle('accordion-class-1--open');
                    });

                    var headerLabel = document.createElement('span');
                    headerLabel.className = 'fieldset-ticketpricing-ticketgroup-header-label';
                    headerLabel.textContent = 'Ticket Group ' + key;
                    headerContent.appendChild(headerLabel);

                    var arrowWrap = document.createElement('div');
                    arrowWrap.className = 'fieldset-ticketpricing-ticketgroup-arrow';
                    var arrowIcon = document.createElement('span');
                    arrowIcon.className = 'fieldset-ticketpricing-ticketgroup-arrow-icon';
                    arrowWrap.appendChild(arrowIcon);
                    headerContent.appendChild(arrowWrap);

                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'fieldset-ticketpricing-ticketgroup-button-add';
                    var addIconUrl = tpGetSystemPlusIconUrl();
                    if (addIconUrl) {
                        var addImg = document.createElement('img');
                        addImg.className = 'fieldset-ticketpricing-ticketgroup-button-icon';
                        addImg.alt = '';
                        addImg.src = addIconUrl;
                        addBtn.appendChild(addImg);
                    }
                    addBtn.title = 'Add Ticket Group';
                    addBtn.setAttribute('aria-label', 'Add Ticket Group');
                    addBtn.addEventListener('click', function(e) {
                        try { e.preventDefault(); e.stopPropagation(); } catch (e0) {}
                        tpAddTicketGroup();
                    });
                    headerContent.appendChild(addBtn);

                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'fieldset-ticketpricing-ticketgroup-button-remove';
                    var removeIconUrl = tpGetSystemMinusIconUrl();
                    if (removeIconUrl) {
                        var removeImg = document.createElement('img');
                        removeImg.className = 'fieldset-ticketpricing-ticketgroup-button-icon';
                        removeImg.alt = '';
                        removeImg.src = removeIconUrl;
                        removeBtn.appendChild(removeImg);
                    }
                    removeBtn.title = 'Remove Ticket Group';
                    removeBtn.setAttribute('aria-label', 'Remove Ticket Group');
                    removeBtn.addEventListener('click', function(e) {
                        try { e.preventDefault(); e.stopPropagation(); } catch (e0) {}
                        var currentKey = group.dataset.ticketGroupKey;
                        tpRemoveTicketGroup(currentKey);
                    });
                    headerContent.appendChild(removeBtn);

                    header.appendChild(headerContent);
                    group.appendChild(header);

                    var editorWrap = document.createElement('div');
                    editorWrap.className = 'fieldset-ticketpricing-ticketgroup-item-editorwrap accordion-body';

                    var editor = document.createElement('div');
                    editor.className = 'fieldset-ticketpricing-pricing-editor';
                    editorWrap.appendChild(editor);
                    
                    // Pass autofill state and group key for autofill and manual edit tracking
                    tpReplaceEditorFromPricing(editor, [], key, autofillState);
                    group.appendChild(editorWrap);

                    group.addEventListener('click', function(e) {
                        fieldset.querySelectorAll('.fieldset-ticketpricing-ticketgroup-item--active').forEach(function(g) {
                            if (g !== group) g.classList.remove('fieldset-ticketpricing-ticketgroup-item--active');
                        });
                        group.classList.add('fieldset-ticketpricing-ticketgroup-item--active');
                    });

                    tpTicketGroups[key] = group;
                    if (tpTicketGroupList) tpTicketGroupList.appendChild(group);
                    tpUpdateAllGroupButtons();
                    return group;
                }

                document.addEventListener('click', function(e) {
                    var clickedInGroup = e.target.closest('.fieldset-ticketpricing-ticketgroup-item');
                    if (!clickedInGroup || !fieldset.contains(clickedInGroup)) {
                        fieldset.querySelectorAll('.fieldset-ticketpricing-ticketgroup-item--active').forEach(function(g) {
                            g.classList.remove('fieldset-ticketpricing-ticketgroup-item--active');
                        });
                    }
                });

                // Ticket groups container
                var tpPricingGroupsWrap = document.createElement('div');
                tpPricingGroupsWrap.className = 'fieldset-ticketpricing-ticketgroups-container container-class-2';
                tpTicketGroupList = tpPricingGroupsWrap;
                fieldset.appendChild(tpPricingGroupsWrap);
                
                tpEnsureDefaultGroup();

                // Expose function to get ticket group keys for sessions fieldset
                fieldset._getTicketGroupKeys = function() {
                    return Object.keys(tpTicketGroups).sort();
                };

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    
                    tpTicketGroups = {};
                    tpTicketGroupList.innerHTML = '';
                    
                    if (val.pricing_groups && typeof val.pricing_groups === 'object') {
                        Object.keys(val.pricing_groups).forEach(function(gk) {
                            var pricing = val.pricing_groups[gk];
                            var ageRating = (val.age_ratings && val.age_ratings[gk]) || '';
                            tpEnsureTicketGroup(gk);
                            var grpEl = tpTicketGroups[gk];
                            if (grpEl) {
                                var editorEl = grpEl.querySelector('.fieldset-ticketpricing-pricing-editor');
                                if (editorEl) {
                                    tpReplaceEditorFromPricing(editorEl, pricing || []);
                                    var ageMenu = editorEl.querySelector('.component-ageratingpicker-menu');
                                    if (ageMenu && typeof ageMenu._ageRatingSetValue === 'function') {
                                        ageMenu._ageRatingSetValue(ageRating || null);
                                    }
                                }
                            }
                        });
                    }
                    
                    tpEnsureDefaultGroup();
                    updateCompleteFromDom();
                };

                fieldset._getValue = function() {
                    var result = {
                        pricing_groups: {},
                        age_ratings: {}
                    };
                    
                    Object.keys(tpTicketGroups).sort().forEach(function(gk) {
                        var grpEl = tpTicketGroups[gk];
                        if (!grpEl) return;
                        var editorEl = grpEl.querySelector('.fieldset-ticketpricing-pricing-editor');
                        if (editorEl) {
                            result.pricing_groups[gk] = tpExtractPricingFromEditor(editorEl);
                            var ageMenu = editorEl.querySelector('.component-ageratingpicker-menu');
                            if (ageMenu) {
                                result.age_ratings[gk] = String(ageMenu.dataset.value || '').trim();
                            }
                        }
                    });
                    
                    return result;
                };

                break;
                
            case 'sessions':
                // SESSIONS FIELDSET
                // Calendar date picker with session times.
                // This fieldset exists in location containers (below the line).
                // Reads ticket group keys from ticket_pricing fieldset.
                
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));

                // Track selected dates
                var sessSessionData = {};

                function sessGetSystemTicketIconUrl() {
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

                function sessGetSystemPlusIconUrl() {
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

                function sessGetSystemMinusIconUrl() {
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

                // Get ticket group keys from ticket_pricing fieldset
                function sessGetTicketGroupKeys() {
                    try {
                        var form = fieldset.closest('form') || fieldset.closest('.member-post-form') || document.body;
                        var tpFieldset = form.querySelector('.fieldset[data-fieldset-key="ticket-pricing"]');
                        if (tpFieldset && typeof tpFieldset._getTicketGroupKeys === 'function') {
                            return tpFieldset._getTicketGroupKeys();
                        }
                    } catch (e) {}
                    return ['A'];
                }

                function sessGetDayOfWeek(dateStr) { return new Date(dateStr + 'T00:00:00').getDay(); }

                function sessApplyDraft() {
                    if (!sessDateDraft) return;
                    var draftKeys = Array.from(sessDateDraft).sort();
                    var currentKeys = Object.keys(sessSessionData).sort();
                    
                    currentKeys.forEach(function(k) {
                        if (!sessDateDraft.has(k)) delete sessSessionData[k];
                    });
                    
                    draftKeys.forEach(function(k) {
                        if (!sessSessionData[k]) {
                            var autofillVal = sessGetAutofillForSlot(k, 0);
                            sessSessionData[k] = { times: [autofillVal], edited: [false], groups: ['A'] };
                        }
                    });
                    
                    sessRenderSessions();
                    try { 
                        fieldset.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true })); 
                        fieldset.dispatchEvent(new Event('change', { bubbles: true }));
                    } catch (e1) {}
                }

                var sessCalContainer = document.createElement('div');
                sessCalContainer.className = 'calendar-container fieldset-sessions-calendar-container';
                var sessCalendarInstance = CalendarComponent.create(sessCalContainer, {
                    monthsPast: 0,
                    monthsFuture: 24,
                    allowPast: false
                });
                
                var sessSelectedDates = new Set();
                
                function sessUpdateMultiSelection() {
                    var days = sessCalendarInstance.calendar.querySelectorAll('.calendar-day[data-iso]');
                    days.forEach(function(cell) {
                        cell.classList.remove('selected', 'range-start', 'range-end', 'in-range');
                        var iso = String(cell.dataset.iso || '');
                        if (!iso) return;
                        if (sessSelectedDates.has(iso)) {
                            cell.classList.add('selected');
                        }
                    });
                }
                
                var sessDays = sessCalendarInstance.calendar.querySelectorAll('.calendar-day[data-iso]');
                sessDays.forEach(function(cell) {
                    var dateObj = new Date(cell.dataset.iso);
                    if (dateObj >= sessCalendarInstance.today) {
                        cell.addEventListener('click', function() {
                            var clickedDate = String(this.dataset.iso || '');
                            if (!clickedDate) return;
                            
                            if (sessSelectedDates.has(clickedDate)) sessSelectedDates.delete(clickedDate);
                            else sessSelectedDates.add(clickedDate);
                            
                            sessUpdateMultiSelection();
                            
                            if (!sessDatePickerOpen) return;
                            try {
                                sessDateDraft = new Set(Array.from(sessSelectedDates));
                            } catch (e0) {
                                sessDateDraft = new Set();
                            }
                            sessApplyDraft();
                        });
                    }
                });

                var sessDatePickerOpen = false;
                var sessDateDraft = null;
                var sessDatePickerDocHandler = null;
                var sessDatePickerAnchorEl = null;

                var sessDatePickerPopover = document.createElement('div');
                sessDatePickerPopover.className = 'fieldset-sessions-calendar-popover';

                var sessDatePickerBody = document.createElement('div');
                sessDatePickerBody.className = 'fieldset-sessions-calendar-popover-body';
                sessDatePickerBody.appendChild(sessCalContainer);

                sessDatePickerPopover.appendChild(sessDatePickerBody);
                fieldset.appendChild(sessDatePickerPopover);

                var sessSessionsContainer = document.createElement('div');
                sessSessionsContainer.className = 'fieldset-sessions-sessions-container';
                fieldset.appendChild(sessSessionsContainer);

                var sessDatePickerRow = document.createElement('div');
                sessDatePickerRow.className = 'fieldset-row fieldset-sessions-session-row fieldset-sessions-session-row--picker';
                sessDatePickerRow.style.marginBottom = '10px';
                var sessDatePickerBox = document.createElement('div');
                sessDatePickerBox.className = 'fieldset-sessions-session-field-label fieldset-sessions-session-field-label--picker button-class-4';
                sessDatePickerBox.setAttribute('role', 'button');
                sessDatePickerBox.setAttribute('tabindex', '0');
                sessDatePickerBox.setAttribute('aria-haspopup', 'dialog');
                sessDatePickerBox.setAttribute('aria-expanded', 'false');
                sessDatePickerBox.textContent = 'Select Date';
                sessDatePickerRow.appendChild(sessDatePickerBox);
                
                var sessPickerTimeWrap = document.createElement('div');
                sessPickerTimeWrap.className = 'fieldset-sessions-session-field-time';
                var sessPickerTimeInput = document.createElement('input');
                sessPickerTimeInput.type = 'text';
                sessPickerTimeInput.className = 'fieldset-sessions-session-field-time-input input-class-1';
                sessPickerTimeInput.placeholder = 'HH:MM';
                sessPickerTimeInput.maxLength = 5;
                sessPickerTimeInput.disabled = true;
                sessPickerTimeWrap.appendChild(sessPickerTimeInput);
                sessDatePickerRow.appendChild(sessPickerTimeWrap);
                
                var sessPickerAddBtn = document.createElement('button');
                sessPickerAddBtn.type = 'button';
                sessPickerAddBtn.className = 'fieldset-sessions-session-button-add';
                var sessPickerPlusIconUrl = sessGetSystemPlusIconUrl();
                if (sessPickerPlusIconUrl) {
                    var sessPickerPlusImg = document.createElement('img');
                    sessPickerPlusImg.className = 'fieldset-sessions-session-button-icon fieldset-sessions-session-button-icon--plus';
                    sessPickerPlusImg.alt = '';
                    sessPickerPlusImg.src = sessPickerPlusIconUrl;
                    sessPickerAddBtn.appendChild(sessPickerPlusImg);
                }
                sessPickerAddBtn.disabled = true;
                sessPickerAddBtn.style.opacity = '0.3';
                sessPickerAddBtn.style.cursor = 'not-allowed';
                sessDatePickerRow.appendChild(sessPickerAddBtn);
                
                var sessPickerRemoveBtn = document.createElement('button');
                sessPickerRemoveBtn.type = 'button';
                sessPickerRemoveBtn.className = 'fieldset-sessions-session-button-remove';
                var sessPickerMinusIconUrl = sessGetSystemMinusIconUrl();
                if (sessPickerMinusIconUrl) {
                    var sessPickerMinusImg = document.createElement('img');
                    sessPickerMinusImg.className = 'fieldset-sessions-session-button-icon fieldset-sessions-session-button-icon--minus';
                    sessPickerMinusImg.alt = '';
                    sessPickerMinusImg.src = sessPickerMinusIconUrl;
                    sessPickerRemoveBtn.appendChild(sessPickerMinusImg);
                }
                sessPickerRemoveBtn.disabled = true;
                sessPickerRemoveBtn.style.opacity = '0.3';
                sessPickerRemoveBtn.style.cursor = 'not-allowed';
                sessDatePickerRow.appendChild(sessPickerRemoveBtn);

                var sessPickerTicketBtn = document.createElement('button');
                sessPickerTicketBtn.type = 'button';
                sessPickerTicketBtn.className = 'fieldset-sessions-ticketgroup-button-toggle button-class-2';
                sessPickerTicketBtn.title = 'Ticket Group';
                sessPickerTicketBtn.disabled = true;
                sessPickerTicketBtn.style.opacity = '0.3';
                sessPickerTicketBtn.style.cursor = 'not-allowed';
                var sessPickerIconUrl = sessGetSystemTicketIconUrl();
                if (sessPickerIconUrl) {
                    var sessPImg = document.createElement('img');
                    sessPImg.className = 'fieldset-sessions-ticketgroup-button-icon';
                    sessPImg.alt = '';
                    sessPImg.src = sessPickerIconUrl;
                    sessPickerTicketBtn.appendChild(sessPImg);
                }
                var sessPLetter = document.createElement('div');
                sessPLetter.className = 'fieldset-sessions-ticketgroup-button-label';
                sessPLetter.textContent = 'A';
                sessPickerTicketBtn.appendChild(sessPLetter);
                sessDatePickerRow.appendChild(sessPickerTicketBtn);

                var sessGodSetForSlot = {};
                function sessAutofillTimes(changedDateStr, changedSlotIdx, newTime) {
                    var sortedDates = Object.keys(sessSessionData).sort();
                    var changedDow = sessGetDayOfWeek(changedDateStr);
                    if (!sessGodSetForSlot[changedSlotIdx]) {
                        sessGodSetForSlot[changedSlotIdx] = true;
                        for (var i = 0; i < sortedDates.length; i++) {
                            var dateStr = sortedDates[i];
                            if (dateStr === changedDateStr) continue;
                            var data = sessSessionData[dateStr];
                            if (data.times.length > changedSlotIdx && !data.edited[changedSlotIdx]) data.times[changedSlotIdx] = newTime;
                        }
                    } else {
                        for (var i = 0; i < sortedDates.length; i++) {
                            var dateStr = sortedDates[i];
                            if (dateStr === changedDateStr) continue;
                            if (sessGetDayOfWeek(dateStr) !== changedDow) continue;
                            var data = sessSessionData[dateStr];
                            if (data.times.length > changedSlotIdx && !data.edited[changedSlotIdx]) data.times[changedSlotIdx] = newTime;
                        }
                    }
                }
                function sessGetAutofillForSlot(dateStr, slotIdx) {
                    var dow = sessGetDayOfWeek(dateStr);
                    var sortedDates = Object.keys(sessSessionData).sort();
                    for (var i = 0; i < sortedDates.length; i++) {
                        var d = sortedDates[i];
                        if (d === dateStr) continue;
                        if (sessGetDayOfWeek(d) === dow && sessSessionData[d].times.length > slotIdx && sessSessionData[d].times[slotIdx]) return sessSessionData[d].times[slotIdx];
                    }
                    for (var i = 0; i < sortedDates.length; i++) {
                        var d = sortedDates[i];
                        if (d === dateStr) continue;
                        if (sessSessionData[d].times.length > slotIdx && sessSessionData[d].times[slotIdx]) return sessSessionData[d].times[slotIdx];
                    }
                    return '';
                }

                function sessApplyDraftToCalendar() {
                    try {
                        if (!sessCalendarInstance) return;
                        sessSelectedDates = new Set(sessDateDraft ? Array.from(sessDateDraft) : []);
                        sessUpdateMultiSelection();
                    } catch (e0) {}
                }

                function sessCloseDatePicker() {
                    if (!sessDatePickerOpen) return;
                    sessDatePickerOpen = false;
                    sessDatePickerPopover.classList.remove('fieldset-sessions-calendar-popover--open');
                    sessDatePickerBox.setAttribute('aria-expanded', 'false');
                    try {
                        if (sessDatePickerAnchorEl) {
                            sessDatePickerAnchorEl.classList.remove('fieldset-sessions-session-field-label--open');
                        }
                    } catch (e0) {}
                    sessDatePickerAnchorEl = null;
                    sessDateDraft = null;
                    if (sessDatePickerDocHandler) {
                        try { document.removeEventListener('click', sessDatePickerDocHandler, true); } catch (e1) {}
                        sessDatePickerDocHandler = null;
                    }
                }

                function sessOpenDatePicker(anchorEl) {
                    if (!anchorEl) return;
                    if (sessDatePickerOpen) {
                        sessCloseDatePicker();
                        return;
                    }
                    sessDatePickerOpen = true;
                    sessDateDraft = new Set(Object.keys(sessSessionData || {}));
                    sessApplyDraftToCalendar();
                    sessDatePickerAnchorEl = anchorEl;
                    try { anchorEl.classList.add('fieldset-sessions-session-field-label--open'); } catch (eOpen2) {}

                    try {
                        if (fieldset && fieldset.style) fieldset.style.position = 'relative';
                        var fsRect = fieldset.getBoundingClientRect();
                        var anchorRect = anchorEl.getBoundingClientRect();
                        
                        sessDatePickerPopover.style.visibility = 'hidden';
                        sessDatePickerPopover.style.display = 'block';
                        sessDatePickerPopover.classList.add('fieldset-sessions-calendar-popover--open');
                        var popHeight = sessDatePickerPopover.offsetHeight;
                        sessDatePickerPopover.classList.remove('fieldset-sessions-calendar-popover--open');
                        sessDatePickerPopover.style.display = '';
                        sessDatePickerPopover.style.visibility = '';
                        
                        var top = (anchorRect.top - fsRect.top) - popHeight - 10;
                        sessDatePickerPopover.style.top = top + 'px';
                    } catch (eTop) {}

                    sessDatePickerPopover.classList.add('fieldset-sessions-calendar-popover--open');
                    sessDatePickerBox.setAttribute('aria-expanded', 'true');

                    sessDatePickerDocHandler = function(ev) {
                        try {
                            if (ev.target && ev.target.closest && ev.target.closest('.fieldset-sessions-session-field-label')) return;
                            if (!sessDatePickerPopover.contains(ev.target) && !(sessDatePickerAnchorEl && sessDatePickerAnchorEl.contains(ev.target))) {
                                sessCloseDatePicker();
                            }
                        } catch (e2) {}
                    };
                    try { document.addEventListener('click', sessDatePickerDocHandler, true); } catch (e3) {}
                }

                sessDatePickerBox.addEventListener('click', function(e) {
                    try { e.preventDefault(); } catch (e0) {}
                    sessOpenDatePicker(sessDatePickerBox);
                });
                sessDatePickerBox.addEventListener('keydown', function(e) {
                    if (!e) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        sessOpenDatePicker(sessDatePickerBox);
                    }
                });

                function sessRenderSessions() {
                    fieldset.querySelectorAll('.fieldset-sessions-ticketgroup-menu--open').forEach(function(m) {
                        m.classList.remove('fieldset-sessions-ticketgroup-menu--open');
                        var b = m.querySelector('.menu-button');
                        var o = m.querySelector('.menu-options');
                        if (b) b.classList.remove('menu-button--open');
                        if (o) o.classList.remove('menu-options--open');
                    });
                    sessSessionsContainer.innerHTML = '';
                    var sortedDates = Object.keys(sessSessionData).sort();
                    
                    fieldset.dataset.selectedIsos = sortedDates.join(',');

                    if (sortedDates.length === 0) {
                        sessSessionsContainer.appendChild(sessDatePickerRow);
                        sessDatePickerBox.textContent = 'Select Dates';
                        try {
                            sessPickerTimeInput.disabled = true;
                            sessPickerAddBtn.disabled = true;
                            sessPickerRemoveBtn.disabled = true;
                            sessPickerTicketBtn.disabled = true;
                            sessPickerTimeInput.style.opacity = '0.3';
                            sessPickerTicketBtn.style.opacity = '0.3';
                        } catch (e0) {}
                    } else {
                        try {
                            sessDatePickerBox.textContent = App.formatDateShort(sortedDates[0]);
                        } catch (eFmt0) {
                            sessDatePickerBox.textContent = sortedDates[0];
                        }
                    }
                    sortedDates.forEach(function(dateStr, dateIdx) {
                        var data = sessSessionData[dateStr];
                        var group = document.createElement('div');
                        group.className = 'fieldset-sessions-session-container-item';
                        data.times.forEach(function(timeVal, idx) {
                            var row = document.createElement('div');
                            row.className = 'fieldset-row fieldset-sessions-session-row';
                            var isLastDate = (dateIdx === sortedDates.length - 1);
                            var isLastTime = (idx === data.times.length - 1);
                            row.style.marginBottom = (isLastDate && isLastTime) ? '0' : '8px';

                            if (idx === 0) {
                                var dateDisplay = document.createElement('div');
                                dateDisplay.className = 'fieldset-sessions-session-field-label fieldset-sessions-session-field-label--selected button-class-4';
                                dateDisplay.dataset.iso = dateStr;
                                try {
                                    dateDisplay.textContent = App.formatDateShort(dateStr);
                                } catch (eFmt) {
                                    dateDisplay.textContent = dateStr;
                                }
                                try {
                                    dateDisplay.setAttribute('role', 'button');
                                    dateDisplay.setAttribute('tabindex', '0');
                                    dateDisplay.addEventListener('click', function(ev) {
                                        try { ev.preventDefault(); } catch (e0) {}
                                        sessOpenDatePicker(dateDisplay);
                                    });
                                } catch (ePick) {}
                                row.appendChild(dateDisplay);
                            } else {
                                var spacer = document.createElement('div');
                                spacer.className = 'fieldset-sessions-session-field-label-spacer';
                                row.appendChild(spacer);
                            }
                            var timeWrapper = document.createElement('div');
                            timeWrapper.className = 'fieldset-sessions-session-field-time';
                            var timeInput = document.createElement('input');
                            timeInput.type = 'text';
                            timeInput.className = 'fieldset-sessions-session-field-time-input input-class-1';
                            timeInput.placeholder = 'HH:MM';
                            timeInput.maxLength = 5;
                            timeInput.value = timeVal;
                            timeInput.dataset.date = dateStr;
                            timeInput.dataset.idx = idx;
                            if (!Array.isArray(data.groups)) data.groups = [];
                            if (typeof data.groups[idx] !== 'string') data.groups[idx] = 'A';
                            timeInput.dataset.ticketGroupKey = String(data.groups[idx] || '').trim();
                            timeInput.addEventListener('focus', function() {
                                var input = this;
                                setTimeout(function() { input.select(); }, 0);
                            });
                            (function(input) {
                                var lastValue = input.value || '';
                                input.addEventListener('input', function() {
                                    var raw = String(this.value || '');
                                    var digits = raw.replace(/[^0-9]/g, '');
                                    var isDeleting = raw.length < lastValue.length;
                                    
                                    if (isDeleting) {
                                        this.value = digits;
                                    } else {
                                        if (digits.length > 2) {
                                            this.value = digits.substring(0, 2) + ':' + digits.substring(2, 4);
                                        } else {
                                            this.value = digits;
                                        }
                                    }
                                    lastValue = this.value;
                                });
                            })(timeInput);
                            function sessTimeToMinutes(timeStr) {
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
                            function sessSortTimesForDate(dateKey) {
                                try {
                                    var ds = String(dateKey || '');
                                    var d = sessSessionData[ds];
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

                                    items.sort(function(a, b) {
                                        var am = sessTimeToMinutes(a.time);
                                        var bm = sessTimeToMinutes(b.time);
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
                                        sessSessionData[dateStr].times[idx] = '';
                                        if (sessSortTimesForDate(dateStr)) sessRenderSessions();
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
                                        sessSessionData[dateStr].times[idx] = newTime;
                                        sessSessionData[dateStr].edited[idx] = true;
                                        sessAutofillTimes(dateStr, idx, newTime);
                                        if (sessSortTimesForDate(dateStr)) {
                                            sessRenderSessions();
                                        } else {
                                            sessSessionsContainer.querySelectorAll('.fieldset-sessions-session-field-time-input').forEach(function(input) {
                                                var d0 = input.dataset.date;
                                                var i0 = parseInt(input.dataset.idx, 10);
                                                if (d0 && sessSessionData[d0] && sessSessionData[d0].times[i0] !== undefined) input.value = sessSessionData[d0].times[i0];
                                            });
                                        }
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                    } else {
                                        this.value = '';
                                        sessSessionData[dateStr].times[idx] = '';
                                        if (sessSortTimesForDate(dateStr)) sessRenderSessions();
                                        try { this.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
                                    }
                                });
                            })(dateStr, idx);
                            timeWrapper.appendChild(timeInput);
                            row.appendChild(timeWrapper);

                            var sessMaxTimesPerDate = 10;
                            var addBtn = document.createElement('button');
                            addBtn.type = 'button';
                            addBtn.className = 'fieldset-sessions-session-button-add';
                            var rowPlusIconUrl = sessGetSystemPlusIconUrl();
                            if (rowPlusIconUrl) {
                                var rowPlusImg = document.createElement('img');
                                rowPlusImg.className = 'fieldset-sessions-session-button-icon fieldset-sessions-session-button-icon--plus';
                                rowPlusImg.alt = '';
                                rowPlusImg.src = rowPlusIconUrl;
                                addBtn.appendChild(rowPlusImg);
                            }
                            if (data.times.length >= sessMaxTimesPerDate) {
                                addBtn.disabled = true;
                                addBtn.style.opacity = '0.3';
                                addBtn.style.cursor = 'not-allowed';
                            } else {
                                (function(dateStr, idx) {
                                    addBtn.addEventListener('click', function() {
                                        var newSlotIdx = idx + 1;
                                        var autofillVal = sessGetAutofillForSlot(dateStr, newSlotIdx);
                                        sessSessionData[dateStr].times.splice(newSlotIdx, 0, autofillVal);
                                        sessSessionData[dateStr].edited.splice(newSlotIdx, 0, false);
                                        if (!Array.isArray(sessSessionData[dateStr].groups)) sessSessionData[dateStr].groups = [];
                                        var inheritKey = String(sessSessionData[dateStr].groups[idx] || '').trim();
                                        if (!inheritKey) inheritKey = 'A';
                                        sessSessionData[dateStr].groups.splice(newSlotIdx, 0, inheritKey);
                                        sessRenderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(addBtn);

                            var removeBtn = document.createElement('button');
                            removeBtn.type = 'button';
                            removeBtn.className = 'fieldset-sessions-session-button-remove';
                            var rowMinusIconUrl = sessGetSystemMinusIconUrl();
                            if (rowMinusIconUrl) {
                                var rowMinusImg = document.createElement('img');
                                rowMinusImg.className = 'fieldset-sessions-session-button-icon fieldset-sessions-session-button-icon--minus';
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
                                        sessSessionData[dateStr].times.splice(idx, 1);
                                        sessSessionData[dateStr].edited.splice(idx, 1);
                                        if (Array.isArray(sessSessionData[dateStr].groups)) sessSessionData[dateStr].groups.splice(idx, 1);
                                        sessRenderSessions();
                                    });
                                })(dateStr, idx);
                            }
                            row.appendChild(removeBtn);

                            // Ticket group dropdown menu
                            var ticketMenu = document.createElement('div');
                            ticketMenu.className = 'fieldset-sessions-ticketgroup-menu menu-class-3';
                            
                            var ticketBtn = document.createElement('button');
                            ticketBtn.type = 'button';
                            ticketBtn.className = 'fieldset-sessions-ticketgroup-button-toggle menu-button';
                            ticketBtn.title = 'Ticket Group';

                            var iconUrl = sessGetSystemTicketIconUrl();
                            if (iconUrl) {
                                var img = document.createElement('img');
                                img.className = 'fieldset-sessions-ticketgroup-button-icon menu-image';
                                img.alt = '';
                                img.src = iconUrl;
                                ticketBtn.appendChild(img);
                            }
                            var letter = document.createElement('div');
                            letter.className = 'fieldset-sessions-ticketgroup-button-label menu-text';
                            letter.textContent = String(data.groups[idx] || '').trim() ? String(data.groups[idx] || '').trim() : 'A';
                            ticketBtn.appendChild(letter);
                            ticketMenu.appendChild(ticketBtn);
                            
                            var ticketOpts = document.createElement('div');
                            ticketOpts.className = 'fieldset-sessions-ticketgroup-menu-options menu-options';
                            ticketMenu.appendChild(ticketOpts);
                            
                            function sessRebuildTicketDropdown(optsEl, dateStr, idx, timeInput, letterEl) {
                                optsEl.innerHTML = '';
                                var keys = sessGetTicketGroupKeys();
                                if (keys.length === 0) keys = ['A'];
                                var optIconUrl = sessGetSystemTicketIconUrl();
                                keys.forEach(function(gk) {
                                    var opt = document.createElement('button');
                                    opt.type = 'button';
                                    opt.className = 'fieldset-sessions-ticketgroup-menu-option menu-option';
                                    if (optIconUrl) {
                                        var optImg = document.createElement('img');
                                        optImg.className = 'fieldset-sessions-ticketgroup-menu-option-icon';
                                        optImg.alt = '';
                                        optImg.src = optIconUrl;
                                        opt.appendChild(optImg);
                                    }
                                    var optLetter = document.createElement('span');
                                    optLetter.className = 'fieldset-sessions-ticketgroup-menu-option-label';
                                    optLetter.textContent = gk;
                                    opt.appendChild(optLetter);
                                    opt.dataset.value = gk;
                                    opt.addEventListener('click', function(e) {
                                        try { e.stopPropagation(); } catch (e0) {}
                                        var d = sessSessionData[dateStr];
                                        if (d) {
                                            if (!Array.isArray(d.groups)) d.groups = [];
                                            d.groups[idx] = gk;
                                        }
                                        timeInput.dataset.ticketGroupKey = gk;
                                        letterEl.textContent = gk;
                                        ticketMenu.classList.remove('fieldset-sessions-ticketgroup-menu--open');
                                        ticketBtn.classList.remove('menu-button--open');
                                        ticketOpts.classList.remove('menu-options--open');
                                        try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                    });
                                    optsEl.appendChild(opt);
                                });
                            }
                            
                            (function(dateStr, idx, timeInput, ticketBtn, ticketMenu, ticketOpts, letter) {
                                ticketBtn.addEventListener('click', function(e) {
                                    try { e.preventDefault(); e.stopPropagation(); } catch (e0) {}
                                    var isOpen = ticketMenu.classList.contains('fieldset-sessions-ticketgroup-menu--open');
                                    fieldset.querySelectorAll('.fieldset-sessions-ticketgroup-menu--open').forEach(function(m) {
                                        m.classList.remove('fieldset-sessions-ticketgroup-menu--open');
                                        var b = m.querySelector('.menu-button');
                                        var o = m.querySelector('.menu-options');
                                        if (b) b.classList.remove('menu-button--open');
                                        if (o) o.classList.remove('menu-options--open');
                                    });
                                    if (!isOpen) {
                                        sessRebuildTicketDropdown(ticketOpts, dateStr, idx, timeInput, letter);
                                        ticketMenu.classList.add('fieldset-sessions-ticketgroup-menu--open');
                                        ticketBtn.classList.add('menu-button--open');
                                        ticketOpts.classList.add('menu-options--open');
                                    }
                                });
                            })(dateStr, idx, timeInput, ticketBtn, ticketMenu, ticketOpts, letter);
                            row.appendChild(ticketMenu);

                            group.appendChild(row);
                        });
                        sessSessionsContainer.appendChild(group);
                    });
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e0) {}
                }

                sessRenderSessions();

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    
                    sessSessionData = {};
                    
                    if (Array.isArray(val.sessions)) {
                        val.sessions.forEach(function(s) {
                            var date = s.date;
                            if (!date) return;
                            var times = [];
                            var groups = [];
                            if (Array.isArray(s.times)) {
                                s.times.forEach(function(t) {
                                    // Strip seconds from time if present (HH:MM:SS -> HH:MM)
                                    var timeStr = t.time || '';
                                    if (timeStr && timeStr.length > 5) {
                                        timeStr = timeStr.substring(0, 5);
                                    }
                                    times.push(timeStr);
                                    groups.push(t.ticket_group_key || 'A');
                                });
                            }
                            sessSessionData[date] = { times: times, groups: groups, edited: times.map(function(){return false;}) };
                        });
                    }
                    
                    sessRenderSessions();
                    updateCompleteFromDom();
                };

                fieldset._getValue = function() {
                    var result = {
                        sessions: []
                    };
                    
                    var sortedDates = Object.keys(sessSessionData).sort();
                    sortedDates.forEach(function(dateStr) {
                        var data = sessSessionData[dateStr];
                        var sessionEntry = {
                            date: dateStr,
                            times: []
                        };
                        data.times.forEach(function(timeVal, idx) {
                            sessionEntry.times.push({
                                time: timeVal,
                                ticket_group_key: data.groups[idx] || 'A'
                            });
                        });
                        result.sessions.push(sessionEntry);
                    });
                    
                    return result;
                };

                break;
                
            case 'venue':
                // SMART VENUE FIELDSET
                // - Both inputs have Google Places (unrestricted)
                // - Auto-fill ONLY empty boxes
                // - User edits are protected
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                
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
                smartVenueInput.className = 'fieldset-input input-class-1';
                smartVenueInput.placeholder = 'Search or type venue name...';
                var smartVenueWrap = document.createElement('div');
                smartVenueWrap.className = 'fieldset-location-inputwrap';
                smartVenueWrap.appendChild(smartVenueInput);
                smartVenueWrap.style.marginBottom = '10px';
                fieldset.appendChild(smartVenueWrap);
                
                // Address row
                var smartAddrSub = document.createElement('div');
                smartAddrSub.className = 'fieldset-sublabel';
                smartAddrSub.textContent = 'Address';
                fieldset.appendChild(smartAddrSub);
                var smartAddrInput = document.createElement('input');
                smartAddrInput.type = 'text';
                smartAddrInput.className = 'fieldset-input input-class-1';
                smartAddrInput.placeholder = 'Search or type address...';
                var smartAddrWrap = document.createElement('div');
                smartAddrWrap.className = 'fieldset-location-inputwrap';
                smartAddrWrap.setAttribute('role', 'button');
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

                fieldset._setValue = function(val) {
                    if (!val || typeof val !== 'object') return;
                    smartVenueInput.value = val.venue_name || '';
                    smartAddrInput.value = val.address_line || '';
                    smartLatInput.value = val.latitude || '';
                    smartLngInput.value = val.longitude || '';
                    smartCountryInput.value = val.country_code || '';
                    
                    // Mark as confirmed if we have coordinates
                    if (val.latitude && val.longitude) {
                        smartAddrInput.dataset.placesConfirmed = 'true';
                    }
                    
                    syncSmartAddrDisplay();
                    // Don't trigger input event to avoid opening the dropdown during population
                    // but we do need to notify the fieldset of the change for validation
                    try { fieldset.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                };

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
                    // menu-class-2 supplies appearance; component CSS supplies layout only.
                    var parent = inputEl.parentNode;
                    var dropdown = parent ? parent.querySelector('.fieldset-location-dropdown') : null;
                    if (!dropdown && parent) {
                        dropdown = document.createElement('div');
                        dropdown.className = 'fieldset-location-dropdown menu-class-2 menu-dropdown';
                        dropdown.style.display = 'none';
                        parent.appendChild(dropdown);
                    }
                    if (dropdown) dropdown.innerHTML = ''; // Clear any existing items
                    
                    var kb = installLocationDropdownKeyboard(inputEl, dropdown, parent);
                    
                    // Fetch suggestions using new API (unrestricted - finds both venues and addresses)
                    var debounceTimer = null;
                    async function fetchSuggestions(query) {
                        if (!query || query.length < 2) {
                            kb.close();
                            return;
                        }
                        
                        try {
                            // Use same API call as map controls (no type restrictions)
                            var response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                                input: query
                            });
                            
                            dropdown.innerHTML = '';
                            
                            if (!response || !response.suggestions || response.suggestions.length === 0) {
                                kb.close();
                                return;
                            }
                            
                            response.suggestions.forEach(function(suggestion) {
                                var prediction = suggestion.placePrediction;
                                if (!prediction) return;
                                
                                var item = document.createElement('button');
                                item.type = 'button';
                                item.className = 'fieldset-location-dropdown-item menu-item';
                                
                                var mainText = prediction.mainText ? prediction.mainText.text : (prediction.text ? prediction.text.text : '');
                                var secondaryText = prediction.secondaryText ? prediction.secondaryText.text : '';
                                
                                item.innerHTML = 
                                    '<div class="fieldset-location-dropdown-item-main menu-item-main">' + mainText + '</div>' +
                                    (secondaryText ? '<div class="fieldset-location-dropdown-item-secondary menu-item-secondary">' + secondaryText + '</div>' : '');
                                
                                item.addEventListener('click', async function(e) {
                                    e.stopPropagation();
                                    clearTimeout(debounceTimer);
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
                                            // Venue name: fill if empty (use venue name if available, otherwise address)
                                            if (!smartVenueInput.value.trim()) {
                                                smartVenueInput.value = (isEstablishment && venueName) ? venueName : address;
                                            }
                                        }
                                        
                                        inputEl.value = isVenueBox ? (isEstablishment ? venueName : address) : address;
                                        kb.close();
                                        
                                        // After a confirmed selection, return address to display-mode.
                                        if (!isVenueBox) {
                                            syncSmartAddrDisplay();
                                            smartAddrDisplay.classList.remove('fieldset-venue-address-display--hidden');
                                            smartAddrInput.classList.add('fieldset-venue-address-input--hidden');
                                        }

                                        // Mark address as Places-confirmed (required for completion)
                                        try { smartAddrInput.dataset.placesConfirmed = 'true'; } catch (e0) {}
                                        // Dispatch change events (not input) to avoid triggering the input handler
                                        try { smartVenueInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) {}
                                        try { smartAddrInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
                                        
                                        // Update status
                                        smartStatus.textContent = '✓ Location set: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                                        smartStatus.className = 'fieldset-location-status success';
                                    } catch (err) {
                                        console.error('Place details error:', err);
                                    }
                                });
                                
                                dropdown.appendChild(item);
                            });
                            
                            kb.open();
                        } catch (err) {
                            console.error('Autocomplete error:', err);
                            kb.close();
                        }
                    }
                    
                    // Input event handler with debounce
                    inputEl.addEventListener('input', function() {
                        // Manual typing invalidates Places confirmation for the address field ONLY.
                        // Venue name can be typed freely without affecting address confirmation.
                        if (!isVenueBox) {
                            // Any typing in address field invalidates the confirmed location
                            try { smartAddrInput.dataset.placesConfirmed = 'false'; } catch (e2) {}
                            smartLatInput.value = '';
                            smartLngInput.value = '';
                        }
                        clearTimeout(debounceTimer);
                        var query = inputEl.value.trim();
                        
                        if (query.length < 2) {
                            kb.close();
                            return;
                        }
                        
                        debounceTimer = setTimeout(function() {
                            fetchSuggestions(query);
                        }, 300);
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', function(e) {
                        if (!inputEl.contains(e.target) && !dropdown.contains(e.target)) {
                            kb.close();
                        }
                    });
                }
                
                // Init both inputs with smart autofill
                initSmartVenueAutocomplete(smartVenueInput, smartAddrInput, true);
                initSmartVenueAutocomplete(smartAddrInput, smartVenueInput, false);
                break;
                
            default:
                // Unknown field type - use generic text input
                fieldset.appendChild(buildLabel(name, tooltip, minLength, maxLength, instruction));
                var input = document.createElement('input');
                input.type = 'text';
                input.className = 'fieldset-input input-class-1';
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
                        case 'custom-radio': {
                            var radioGrp = fieldset.querySelector('.fieldset-radio-group');
                            return !!(radioGrp && String(radioGrp.dataset.value || '').trim());
                        }
                        case 'custom-dropdown': {
                            var menu = fieldset.querySelector('.fieldset-customdropdown');
                            return !!(menu && String(menu.dataset.value || '').trim());
                        }
                        case 'custom-checklist': {
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
                            // Check if any amenity row has a value set (button-based, uses data-value)
                            return !!fieldset.querySelector('.fieldset-amenities-row[data-value="1"], .fieldset-amenities-row[data-value="0"]');
                        case 'age-rating': {
                            var ageRatingMenu = fieldset.querySelector('.component-ageratingpicker-menu');
                            return !!(ageRatingMenu && String(ageRatingMenu.dataset.value || '').trim());
                        }
                        case 'public-phone': {
                            // Only check the phone number input, NOT the prefix selector
                            // Selecting a prefix alone should not trigger incomplete state
                            var tel = fieldset.querySelector('input[type="tel"].fieldset-input');
                            if (tel && String(tel.value || '').trim()) return true;
                            return false;
                        }
                        case 'item-pricing': {
                            // Only check item name, price, and variant inputs
                            // Selecting a currency alone should not trigger incomplete state
                            var itemName = fieldset.querySelector('.fieldset-itempricing-input-itemname');
                            var itemPrice = fieldset.querySelector('.fieldset-itempricing-input-itemprice');
                            if (itemName && String(itemName.value || '').trim()) return true;
                            if (itemPrice && String(itemPrice.value || '').trim()) return true;
                            // Check variant inputs
                            var variantInputs = fieldset.querySelectorAll('.fieldset-itempricing-input-itemvariantname');
                            for (var i = 0; i < variantInputs.length; i++) {
                                if (variantInputs[i] && String(variantInputs[i].value || '').trim()) return true;
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
                case 'custom-text':
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
                case 'custom-textarea':
                {
                    var ta = fieldset.querySelector('textarea');
                    return ta ? strLenOk(ta.value, minLength, maxLength) : false;
                }
                case 'email':
                case 'account-email':
                case 'public-email': {
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
                case 'custom-dropdown': {
                    var menu = fieldset.querySelector('.fieldset-customdropdown');
                    var v = menu ? String(menu.dataset.value || '').trim() : '';
                    return !!v;
                }
                case 'custom-checklist': {
                    var list = fieldset.querySelector('.fieldset-customchecklist');
                    if (!list) return false;
                    try {
                        var arr = JSON.parse(String(list.dataset.value || '[]'));
                        return Array.isArray(arr) && arr.length > 0;
                    } catch (eC2) {
                        return false;
                    }
                }
                case 'custom-radio': {
                    var radioGrp2 = fieldset.querySelector('.fieldset-radio-group');
                    return !!(radioGrp2 && String(radioGrp2.dataset.value || '').trim());
                }
                case 'public-phone': {
                    var prefixInput = fieldset.querySelector('.component-phoneprefixcompact-menu-button-input');
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
                    // Required amenities: every row needs Yes/No selected (button-based, uses data-value).
                    var rows = fieldset.querySelectorAll('.fieldset-amenities-row');
                    if (!rows || rows.length === 0) return false;
                    for (var i = 0; i < rows.length; i++) {
                        var val = rows[i].dataset.value;
                        if (val !== '1' && val !== '0') return false;
                    }
                    return true;
                }
                case 'age-rating': {
                    // Required age rating: must have a value selected (not "Select rating")
                    var ageRatingMenu = fieldset.querySelector('.component-ageratingpicker-menu');
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

        // Browser autofill detection handled by global initGlobalAutofillHandler() in index.js

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
