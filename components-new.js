/* ============================================================================
   COMPONENTS.JS - Reusable UI Components
   ============================================================================
   
   Shared components used across multiple sections.
   
   STRUCTURE:
   - ICONS               - (removed) no hard-coded SVG icons allowed in new site
   - MENU MANAGER        - Global manager for closing menus
   - CLEAR BUTTON        - Reusable X/clear button
   - SWITCH              - Toggle switch (has size variants)
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
   Global manager to close all open menus when clicking outside or opening another.
   
   HOW TO CREATE A NEW MENU:
   -------------------------
   1. Create your menu HTML structure with these bridge classes:
      - Container: add your component class + menu-class-1/2/3
      - Button: add .menu-button
      - Arrow: add .menu-arrow  
      - Options panel: add .menu-options
      - Each option: add .menu-option
      - Text elements: add .menu-text, .menu-option-text
   
   2. Implement required methods on the menu container element:
      menuEl.__menuIsOpen = function that returns true or false
      menuEl.__menuApplyOpenState = function(isOpen) that toggles open classes
      menuEl.__menuOnClose = optional function called when menu closes
   
   3. Register with MenuManager:
      MenuManager.register(menuEl);
   
   4. On button click, close others and toggle:
      MenuManager.closeAll(menuEl);
      menuEl.__menuApplyOpenState(!menuEl.__menuIsOpen());
   
   5. For keyboard navigation, call menuArrowKeyNav(e, optsEl, '.menu-option', null)
      in your keydown handler when the menu is open.
   
   MENU CLASSES (in base-new.css):
   - menu-class-1: Standard menus (translucent, type-to-filter support)
   - menu-class-2: Location dropdowns (no button trigger, two-line items)
   - menu-class-3: Category pickers (solid blue hover, icon+text options)
   
   STATE CLASSES (toggled by __menuApplyOpenState):
   - .menu-button--open, .menu-arrow--open, .menu-options--open
   - .menu-option--highlighted (for keyboard navigation)
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
                menu.querySelector('input.component-phoneprefixcompact-menu-button-input') ||
                menu.querySelector('input.component-country-menu-button-input') ||
                menu.querySelector('input.component-languagefull-menu-button-input') ||
                menu.querySelector('input.component-iconpicker-menu-button-input') ||
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

            // Arrow/Enter navigation should work even when the menu "button" is a <div>
            // (no focus). Route these keys to the open menu options list.
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
                try {
                    var opts = getOptionsEl(menu);
                    var sel = null;
                    try {
                        if (typeof menu.__menuGetOptionSelector === 'function') sel = menu.__menuGetOptionSelector();
                    } catch (eSel0) {}
                    if (!sel && typeof menu.__menuOptionSelector === 'string') sel = menu.__menuOptionSelector;
                    if (!sel) sel = '.menu-option';
                    if (opts) {
                        // Uses shared helper (also used by input-driven menus)
                        menuArrowKeyNav(e, opts, sel, function(opt) { opt.click(); });
                        // Stop propagation so component-level keydown handlers don't double-fire
                        if (typeof e.stopPropagation === 'function') e.stopPropagation();
                    }
                } catch (eNav0) {}
                return;
            }

            var input = getMenuTypingInput(menu);
            if (!input) return;
            applyTypingKeyToInput(input, e);
        } catch (e0) {}
    }, true);
    
    // Find the currently-open menu that contains a given target element.
    // This is used by shared behaviors (eg. anchor scroll routing) so we avoid selector lists.
    function findOpenMenuForTarget(target) {
        if (!target || !(target instanceof Element)) return null;
        for (var i = 0; i < openMenus.length; i++) {
            var m = openMenus[i];
            try {
                if (!m || !isMenuOpen(m)) continue;
                if (m.contains(target)) return m;
            } catch (e0) {}
        }
        return null;
    }
    
    // Standard menu hook: return the options container element (dropdown list).
    function getOptionsEl(menu) {
        if (!menu) return null;
        try {
            if (typeof menu.__menuGetOptionsEl === 'function') return menu.__menuGetOptionsEl() || null;
        } catch (e0) {}
        return null;
    }
    
    return {
        closeAll: closeAll,
        register: register,
        isOpen: isMenuOpen,
        setOpen: setMenuOpen,
        findOpenMenuForTarget: findOpenMenuForTarget,
        getOptionsEl: getOptionsEl
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
    
    // ArrowUp / ArrowDown - stop at boundaries, don't loop
    e.preventDefault();
    var nextIdx;
    if (key === 'ArrowDown') {
        if (currentIdx < 0) {
            nextIdx = 0; // Nothing selected, go to first
        } else if (currentIdx >= visibleOpts.length - 1) {
            nextIdx = currentIdx; // Already at bottom, stay there
        } else {
            nextIdx = currentIdx + 1;
        }
    } else {
        if (currentIdx <= 0) {
            nextIdx = 0; // Already at top (or nothing selected), stay at first
        } else {
            nextIdx = currentIdx - 1;
        }
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

// Expose for use by other modules (member-new.js formpicker)
window.menuArrowKeyNav = menuArrowKeyNav;


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
        
        var size = options.size || 'medium';
        var checked = options.checked;
        
        // Build class prefix based on size
        // Supported sizes: 'small', 'big'
        var prefix = 'component-' + size + '-switch';
        
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
        var selectionMode = String(options.selectionMode || 'range').trim();
        
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
        var selectedDates = new Set(); // used in multi mode
        
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
                            var clickedDate = String(this.dataset.iso || '');
                            if (!clickedDate) return;

                            if (selectionMode === 'multi') {
                                if (selectedDates.has(clickedDate)) selectedDates.delete(clickedDate);
                                else selectedDates.add(clickedDate);
                                // Range values are not meaningful in multi mode.
                                selectedStart = null;
                                selectedEnd = null;
                                updateSelection(calendar);
                                if (onChange) onChange(null, null, Array.from(selectedDates));
                                if (!showActions && onSelect) onSelect(null, null, Array.from(selectedDates));
                                return;
                            }

                            // Default: range selection
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
        
        var markerContainer = document.createElement('div');
        markerContainer.className = 'calendar-marker-container';
        markerContainer.appendChild(marker);
        scrollWrapper.appendChild(markerContainer);
        
        containerEl.appendChild(scrollWrapper);

        // Add action buttons if showActions is true
        var actionsEl = null;
        if (showActions) {
            actionsEl = document.createElement('div');
            actionsEl.className = 'calendar-actions';
            
            var cancelBtn = document.createElement('button');
            cancelBtn.className = 'calendar-cancel button-class-2';
            cancelBtn.type = 'button';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                selectedStart = null;
                selectedEnd = null;
                updateSelection(calendar);
                if (onChange) onChange(selectedStart, selectedEnd);
                if (onSelect) onSelect(null, null);
            });
            
            var okBtn = document.createElement('button');
            okBtn.className = 'calendar-ok button-class-2';
            okBtn.type = 'button';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', function(e) {
                e.stopPropagation();
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
            });

            if (selectionMode === 'multi') {
                // Mark all selected dates and compute per-row joins (no week-wrap joins).
                var months = calendarEl.querySelectorAll('.calendar-month');
                months.forEach(function(monthEl) {
                    var monthCells = Array.from(monthEl.querySelectorAll('.calendar-day[data-iso]'));
                    monthCells.forEach(function(cell, idx) {
                        var iso = String(cell.dataset.iso || '');
                        if (!iso) return;
                        if (!selectedDates.has(iso)) return;
                        cell.classList.add('selected');

                        var col = idx % 7;
                        var leftSel = false;
                        var rightSel = false;
                        if (col > 0) {
                            var left = monthCells[idx - 1];
                            leftSel = !!(left && selectedDates.has(String(left.dataset.iso || '')));
                        }
                        if (col < 6) {
                            var right = monthCells[idx + 1];
                            rightSel = !!(right && selectedDates.has(String(right.dataset.iso || '')));
                        }

                        if (leftSel || rightSel) {
                            if (!leftSel && rightSel) cell.classList.add('range-start');
                            else if (leftSel && !rightSel) cell.classList.add('range-end');
                            else if (leftSel && rightSel) cell.classList.add('in-range');
                        }
                    });
                });
                return;
            }

            // Range mode
            days.forEach(function(d) {
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
                selectedDates = new Set();
                updateSelection(calendar);
            },
            getSelection: function() {
                if (selectionMode === 'multi') {
                    return { start: null, end: null, dates: Array.from(selectedDates).sort() };
                }
                return { start: selectedStart, end: selectedEnd, dates: null };
            },
            setSelectedDates: function(dates) {
                if (selectionMode !== 'multi') return;
                try {
                    selectedDates = new Set(Array.isArray(dates) ? dates : []);
                } catch (e0) {
                    selectedDates = new Set();
                }
                // Keep range values empty in multi mode.
                selectedStart = null;
                selectedEnd = null;
                updateSelection(calendar);
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
    var loadPromise = null;
    
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
    
    // Look up formatting properties for a currency code
    function getFormatting(currencyCode) {
        if (!currencyCode) {
            throw new Error('[CurrencyComponent] getFormatting requires a currency code');
        }
        var found = currencyData.find(function(item) {
            return item.value === currencyCode;
        });
        if (!found) {
            throw new Error('[CurrencyComponent] Currency not found: ' + currencyCode);
        }
        return {
            symbol: found.symbol,
            symbolPosition: found.symbolPosition,
            decimalSeparator: found.decimalSeparator,
            decimalPlaces: found.decimalPlaces,
            thousandsSeparator: found.thousandsSeparator
        };
    }
    
    // Load currency data from database via gateway
    function loadFromDatabase() {
        if (loadPromise) return loadPromise;
        loadPromise = fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.dropdown_options && res.dropdown_options.currency) {
                    currencyData = res.dropdown_options.currency;
                    dataLoaded = true;
                }
                return currencyData;
            })
            .catch(function(err) {
                // Allow retry after failure.
                loadPromise = null;
                throw err;
            });
        return loadPromise;
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
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-currencycompact-menu menu-class-1';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-currencycompact-menu-button menu-button" role="button"><img class="component-currencycompact-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="component-currencycompact-menu-button-input menu-input" placeholder="Select" autocomplete="off"><span class="component-currencycompact-menu-button-arrow menu-arrow">▼</span></div><div class="component-currencycompact-menu-options menu-options"></div>';

        var btn = menu.querySelector('.component-currencycompact-menu-button');
        var opts = menu.querySelector('.component-currencycompact-menu-options');
        var btnImg = menu.querySelector('.component-currencycompact-menu-button-image');
        var btnInput = menu.querySelector('.component-currencycompact-menu-button-input');
        var arrow = menu.querySelector('.component-currencycompact-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-currencycompact-menu--open', !!isOpen);
            if (btn) {
                btn.classList.toggle('component-currencycompact-menu-button--open', !!isOpen);
                btn.classList.toggle('menu-button--open', !!isOpen);
            }
            if (arrow) {
                arrow.classList.toggle('component-currencycompact-menu-button-arrow--open', !!isOpen);
                arrow.classList.toggle('menu-arrow--open', !!isOpen);
            }
            if (opts) {
                opts.classList.toggle('component-currencycompact-menu-options--open', !!isOpen);
                opts.classList.toggle('menu-options--open', !!isOpen);
            }
        }

        // Required by MenuManager (strict)
        menu.__menuIsOpen = function() {
            return menu.classList.contains('component-currencycompact-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;
        menu.__menuGetOptionsEl = function() { return opts; };
        menu.__menuOptionSelector = '.component-currencycompact-menu-option';

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set value
        function setValue(code) {
            if (!code) {
                btnImg.src = '';
                btnImg.style.display = 'none';
                btnInput.value = '';
                btnInput.placeholder = 'Select';
                selectedCode = null;
                try { menu.dataset.value = ''; } catch (e0) {}
                return;
            }
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
                btnInput.placeholder = 'Search';
                selectedCode = code;
                try { menu.dataset.value = String(code || '').trim(); } catch (e1) {}
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

        function renderOptions() {
            try { opts.innerHTML = ''; } catch (e0) {}
            allOptions = [];
            currencyData.forEach(function(item) {
                var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
                var displayText = item.value + ' - ' + item.label;

                var op = document.createElement('button');
                op.type = 'button';
                op.className = 'component-currencycompact-menu-option menu-option';
                var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
                op.innerHTML = '<img class="component-currencycompact-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-currencycompact-menu-option-text menu-text">' + displayText + '</span>';
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
                    try { menu.dataset.value = String(item.value || '').trim(); } catch (e1) {}
                    applyOpenState(false);
                    filterOptions('');
                    // Pass formatting properties: symbol, position, separators, decimal places
                    var formatting = {
                        symbol: item.symbol,
                        symbolPosition: item.symbolPosition,
                        decimalSeparator: item.decimalSeparator,
                        decimalPlaces: item.decimalPlaces,
                        thousandsSeparator: item.thousandsSeparator
                    };
                    onSelect(item.value, item.label, countryCode, formatting);
                    try { menu.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
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
        }

        // Build options (lazy: if data isn't loaded yet, menu will populate when it arrives)
        renderOptions();
        if ((!dataLoaded || currencyData.length === 0) && typeof loadFromDatabase === 'function') {
            loadFromDatabase().then(function() {
                renderOptions();
                // Re-apply current selection if any
                if (selectedCode) setValue(selectedCode);
            }).catch(function() {});
        }

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
            if (menu.classList.contains('component-currencycompact-menu--open')) {
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
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-currencyfull-menu menu-class-1';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-currencyfull-menu-button menu-button" role="button"><img class="component-currencyfull-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="component-currencyfull-menu-button-input menu-input" placeholder="Select currency" autocomplete="off"><span class="component-currencyfull-menu-button-arrow menu-arrow">▼</span></div><div class="component-currencyfull-menu-options menu-options"></div>';
        
        var btn = menu.querySelector('.component-currencyfull-menu-button');
        var opts = menu.querySelector('.component-currencyfull-menu-options');
        var btnImg = menu.querySelector('.component-currencyfull-menu-button-image');
        var btnInput = menu.querySelector('.component-currencyfull-menu-button-input');
        var arrow = menu.querySelector('.component-currencyfull-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-currencyfull-menu--open', !!isOpen);
            btn.classList.toggle('component-currencyfull-menu-button--open', !!isOpen);
            btn.classList.toggle('menu-button--open', !!isOpen);
            arrow.classList.toggle('component-currencyfull-menu-button-arrow--open', !!isOpen);
            arrow.classList.toggle('menu-arrow--open', !!isOpen);
            opts.classList.toggle('component-currencyfull-menu-options--open', !!isOpen);
            opts.classList.toggle('menu-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('component-currencyfull-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;
        menu.__menuGetOptionsEl = function() { return opts; };
        menu.__menuOptionSelector = '.component-currencyfull-menu-option';

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set initial value
        function setValue(code) {
            if (!code) {
                btnImg.src = '';
                btnImg.style.display = 'none';
                btnInput.value = '';
                btnInput.placeholder = 'Select';
                selectedCode = null;
                try { menu.dataset.value = ''; } catch (e0) {}
                return;
            }
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
                btnInput.placeholder = 'Search';
                selectedCode = code;
                try { menu.dataset.value = String(code || '').trim(); } catch (e1) {}
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

        function renderOptions() {
            try { opts.innerHTML = ''; } catch (e0) {}
            allOptions = [];
            var currencies = currencyData;
            currencies.forEach(function(item) {
                var countryCode = item.filename ? item.filename.replace('.svg', '') : null;
                var displayText = item.value + ' - ' + item.label;
                
                var op = document.createElement('button');
                op.type = 'button';
                op.className = 'component-currencyfull-menu-option menu-option';
                var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
                op.innerHTML = '<img class="component-currencyfull-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-currencyfull-menu-option-text menu-text">' + displayText + '</span>';
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
                    try { menu.dataset.value = String(item.value || '').trim(); } catch (e1) {}
                    applyOpenState(false);
                    filterOptions(''); // Reset filter
                    onSelect(item.value, item.label, countryCode);
                    try { menu.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
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
        }

        // Build options (lazy: if data isn't loaded yet, menu will populate when it arrives)
        renderOptions();
        if ((!dataLoaded || currencyData.length === 0) && typeof loadFromDatabase === 'function') {
            loadFromDatabase().then(function() {
                renderOptions();
                if (selectedCode) setValue(selectedCode);
            }).catch(function() {});
        }

        // Set initial value (only if provided)
        if (initialValue) {
            setValue(initialValue);
        }

        // Register with MenuManager
        MenuManager.register(menu);

        // Clicking anywhere on the button opens the menu (if closed)
        if (btn) {
            btn.addEventListener('click', function(e) {
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
        parseCurrencyValue: parseCurrencyValue,
        getFormatting: getFormatting
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
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-languagefull-menu menu-class-1';
        // No default flag - leave empty until user selects
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-languagefull-menu-button menu-button" role="button"><img class="component-languagefull-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="component-languagefull-menu-button-input menu-input" placeholder="Select language" autocomplete="off"><span class="component-languagefull-menu-button-arrow menu-arrow">▼</span></div><div class="component-languagefull-menu-options menu-options"></div>';
        
        var btn = menu.querySelector('.component-languagefull-menu-button');
        var opts = menu.querySelector('.component-languagefull-menu-options');
        var btnImg = menu.querySelector('.component-languagefull-menu-button-image');
        var btnInput = menu.querySelector('.component-languagefull-menu-button-input');
        var arrow = menu.querySelector('.component-languagefull-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-languagefull-menu--open', !!isOpen);
            btn.classList.toggle('component-languagefull-menu-button--open', !!isOpen);
            btn.classList.toggle('menu-button--open', !!isOpen);
            arrow.classList.toggle('component-languagefull-menu-button-arrow--open', !!isOpen);
            arrow.classList.toggle('menu-arrow--open', !!isOpen);
            opts.classList.toggle('component-languagefull-menu-options--open', !!isOpen);
            opts.classList.toggle('menu-options--open', !!isOpen);
        }

        menu.__menuIsOpen = function() {
            return menu.classList.contains('component-languagefull-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;
        menu.__menuGetOptionsEl = function() { return opts; };
        menu.__menuOptionSelector = '.component-languagefull-menu-option';

        // Store all option elements for filtering
        var allOptions = [];

        // Find and set initial value
        function setValue(code) {
            // Handle null/empty - revert to placeholder state
            if (!code) {
                btnImg.src = '';
                btnImg.style.display = 'none';
                btnInput.value = '';
                btnInput.placeholder = 'Select';
                selectedCode = null;
                try { menu.dataset.value = ''; } catch (e0) {}
                return;
            }
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
                btnInput.placeholder = 'Search';
                selectedCode = code;
                try { menu.dataset.value = String(code || '').trim(); } catch (e1) {}
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
            
            var op = document.createElement('button');
            op.type = 'button';
            op.className = 'component-languagefull-menu-option menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('currencies', countryCode + '.svg') : '';
            op.innerHTML = '<img class="component-languagefull-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-languagefull-menu-option-text menu-text">' + displayText + '</span>';
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
                if (!menu.classList.contains('component-languagefull-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }

        // Input events
        btnInput.addEventListener('focus', function(e) {
            MenuManager.closeAll(menu);
            applyOpenState(true);
            // Select all text for easy replacement
            this.select();
        });

        btnInput.addEventListener('input', function(e) {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('component-languagefull-menu--open')) applyOpenState(true);
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
            if (menu.classList.contains('component-languagefull-menu--open')) {
                menuArrowKeyNav(e, opts, '.component-languagefull-menu-option', function(opt) { opt.click(); });
            }
        });
        
        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            // Small delay to allow option click to fire first
            setTimeout(function() {
                if (!menu.classList.contains('component-languagefull-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('component-languagefull-menu--open')) {
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

        // Match the Currency compact menu pattern (component-* menu system)
        var menu = document.createElement('div');
        // Opt-in skin test: menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-phoneprefixcompact-menu menu-class-1';

        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-phoneprefixcompact-menu-button menu-button"><img class="component-phoneprefixcompact-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: none;"><input type="text" class="component-phoneprefixcompact-menu-button-input menu-input" placeholder="Select" autocomplete="off"><span class="component-phoneprefixcompact-menu-button-arrow menu-arrow">▼</span></div><div class="component-phoneprefixcompact-menu-options menu-options"></div>';

        var btn = menu.querySelector('.component-phoneprefixcompact-menu-button');
        var opts = menu.querySelector('.component-phoneprefixcompact-menu-options');
        var btnImg = menu.querySelector('.component-phoneprefixcompact-menu-button-image');
        var btnInput = menu.querySelector('.component-phoneprefixcompact-menu-button-input');
        var arrow = menu.querySelector('.component-phoneprefixcompact-menu-button-arrow');

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-phoneprefixcompact-menu--open', !!isOpen);
            if (btn) btn.classList.toggle('component-phoneprefixcompact-menu-button--open', !!isOpen);
            if (arrow) arrow.classList.toggle('component-phoneprefixcompact-menu-button-arrow--open', !!isOpen);
            if (opts) opts.classList.toggle('component-phoneprefixcompact-menu-options--open', !!isOpen);
            // Generic hooks for base menu skins
            if (btn) btn.classList.toggle('menu-button--open', !!isOpen);
            if (arrow) arrow.classList.toggle('menu-arrow--open', !!isOpen);
            if (opts) opts.classList.toggle('menu-options--open', !!isOpen);
        }

        // Required by MenuManager (strict)
        menu.__menuIsOpen = function() { return menu.classList.contains('component-phoneprefixcompact-menu--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        menu.__menuGetOptionsEl = function() { return opts; };
        menu.__menuOptionSelector = '.component-phoneprefixcompact-menu-option';

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
            // Handle null/empty - revert to placeholder state
            if (!code) {
                btnImg.src = '';
                btnImg.style.display = 'none';
                btnInput.value = '';
                btnInput.placeholder = 'Select';
                selectedCode = null;
                try { menu.dataset.value = ''; } catch (e0) {}
                return;
            }
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
                btnInput.placeholder = 'Search';
                selectedCode = code;
                try { menu.dataset.value = String(code || '').trim(); } catch (e1) {}
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
            op.className = 'component-phoneprefixcompact-menu-option menu-option';
            var flagUrl = countryCode ? window.App.getImageUrl('phonePrefixes', countryCode + '.svg') : '';
            op.innerHTML = '<img class="component-phoneprefixcompact-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-phoneprefixcompact-menu-option-text menu-text">' + displayText + '</span>';
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
                if (!menu.classList.contains('component-phoneprefixcompact-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }

        btnInput.addEventListener('focus', function(e) {
            MenuManager.closeAll(menu);
            applyOpenState(true);
            this.select();
        });

        btnInput.addEventListener('input', function() {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('component-phoneprefixcompact-menu--open')) applyOpenState(true);
        });

        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('component-phoneprefixcompact-menu--open')) {
                menuArrowKeyNav(e, opts, '.component-phoneprefixcompact-menu-option', function(opt) { opt.click(); });
            }
        });

        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('component-phoneprefixcompact-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });

        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('component-phoneprefixcompact-menu--open')) {
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
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-country-menu menu-class-1';
        var initialFlagUrl = '';
        menu.innerHTML = '<div class="component-country-menu-button menu-button" role="button"><img class="component-country-menu-button-image" src="' + initialFlagUrl + '" alt="" style="display: ' + (initialFlagUrl ? 'block' : 'none') + ';"><input type="text" class="component-country-menu-button-input menu-input" placeholder="Select country" autocomplete="off"><span class="component-country-menu-button-arrow menu-arrow">▼</span></div><div class="component-country-menu-options menu-options"></div>';
        
        var btn = menu.querySelector('.component-country-menu-button');
        var opts = menu.querySelector('.component-country-menu-options');
        var btnImg = menu.querySelector('.component-country-menu-button-image');
        var btnInput = menu.querySelector('.component-country-menu-button-input');
        var arrow = menu.querySelector('.component-country-menu-button-arrow');
        
        function applyOpenState(isOpen) {
            menu.classList.toggle('component-country-menu--open', !!isOpen);
            if (btn) {
                btn.classList.toggle('component-country-menu-button--open', !!isOpen);
                btn.classList.toggle('menu-button--open', !!isOpen);
            }
            if (arrow) {
                arrow.classList.toggle('component-country-menu-button-arrow--open', !!isOpen);
                arrow.classList.toggle('menu-arrow--open', !!isOpen);
            }
            if (opts) {
                opts.classList.toggle('component-country-menu-options--open', !!isOpen);
                opts.classList.toggle('menu-options--open', !!isOpen);
            }
        }
        
        // Required by MenuManager (strict)
        menu.__menuIsOpen = function() {
            return menu.classList.contains('component-country-menu--open');
        };
        menu.__menuApplyOpenState = applyOpenState;
        menu.__menuGetOptionsEl = function() { return opts; };
        menu.__menuOptionSelector = '.component-country-menu-option';
        
        // Store all option elements for filtering
        var allOptions = [];
        
        function setValue(code) {
            // Handle null/empty - revert to placeholder state
            if (!code) {
                btnImg.src = '';
                btnImg.style.display = 'none';
                btnInput.value = '';
                btnInput.placeholder = 'Select';
                selectedCode = null;
                try { menu.dataset.value = ''; } catch (e0) {}
                return;
            }
            var found = countryData.find(function(item) {
                return item.value === code;
            });
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
                btnInput.placeholder = 'Search';
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
            
            var op = document.createElement('button');
            op.type = 'button';
            op.className = 'component-country-menu-option menu-option';
            var flagUrl = window.App.getImageUrl('countries', item.filename);
            op.innerHTML = '<img class="component-country-menu-option-image" src="' + flagUrl + '" alt=""><span class="component-country-menu-option-text menu-text">' + displayText + '</span>';
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
                if (!menu.classList.contains('component-country-menu--open')) {
                    MenuManager.closeAll(menu);
                    applyOpenState(true);
                } else {
                    applyOpenState(false);
                }
            });
        }
        
        btnInput.addEventListener('focus', function(e) {
            MenuManager.closeAll(menu);
            applyOpenState(true);
            this.select();
        });
        
        btnInput.addEventListener('input', function() {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('component-country-menu--open')) applyOpenState(true);
        });
        
        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                setValue(selectedCode);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('component-country-menu--open')) {
                menuArrowKeyNav(e, opts, '.component-country-menu-option', function(opt) { opt.click(); });
            }
        });
        
        btnInput.addEventListener('blur', function() {
            setTimeout(function() {
                if (!menu.classList.contains('component-country-menu--open')) {
                    setValue(selectedCode);
                    filterOptions('');
                }
            }, 150);
        });
        
        arrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('component-country-menu--open')) {
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
    var passwordSettings = null;
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
                // Store password settings
                passwordSettings = res && res.formData && res.formData.password_settings ? res.formData.password_settings : null;
                return fieldsetMap;
            })
            .catch(function(err) {
                console.warn('[MemberAuthFieldsetsComponent] Failed to load fieldsets', err);
                fieldsetMap = {};
                return fieldsetMap;
            });
        return loadPromise;
    }

    function getPasswordSettings() {
        return passwordSettings;
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
        
        // For avatar fieldset, append dynamic requirements from admin_settings
        if (fieldsetKey === 'avatar') {
            var avatarMinWidth = 1000;
            var avatarMinHeight = 1000;
            var avatarMaxSize = 5242880;
            try {
                if (window.adminSettings) {
                    if (window.adminSettings.avatar_min_width) avatarMinWidth = parseInt(window.adminSettings.avatar_min_width, 10) || 1000;
                    if (window.adminSettings.avatar_min_height) avatarMinHeight = parseInt(window.adminSettings.avatar_min_height, 10) || 1000;
                    if (window.adminSettings.avatar_max_size) avatarMaxSize = parseInt(window.adminSettings.avatar_max_size, 10) || 5242880;
                }
            } catch (e) {}
            var avatarMaxMB = (avatarMaxSize / 1024 / 1024).toFixed(0);
            var avatarRequirements = 'Min ' + avatarMinWidth + '×' + avatarMinHeight + ' pixels\nMax ' + avatarMaxMB + 'MB';
            if (tooltip) {
                tooltip += '\n\n———\n' + avatarRequirements;
            } else {
                tooltip = avatarRequirements;
            }
        }

        var wrap = document.createElement('div');
        wrap.className = 'fieldset';
        if (typeof fieldsetKey === 'string' && fieldsetKey) wrap.dataset.fieldsetKey = fieldsetKey;
        if (typeof name === 'string' && name) wrap.dataset.fieldsetName = name;
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
                var menu = wrap.querySelector('.component-country-menu');
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
                var buildOptions = {
                    idPrefix: 'memberRegister',
                    fieldIndex: 0,
                    container: containerEl
                };
                // Pass password settings for password fieldsets
                var isPasswordField = (fieldsetKey === 'password' || fieldsetKey === 'confirm-password' || fieldsetKey === 'new-password');
                if (isPasswordField && passwordSettings) {
                    buildOptions.passwordSettings = passwordSettings;
                }
                var fieldset = FieldsetBuilder.buildFieldset(fdReq, buildOptions);
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
            // Preserve the more button/menu before clearing (they may have been moved into the container)
            var moreBtnPreserve = document.getElementById('member-profile-more-btn');
            var moreMenuPreserve = document.getElementById('member-profile-more-menu');
            var tempFragment = null;
            if (moreBtnPreserve && containerEl.contains(moreBtnPreserve)) {
                tempFragment = document.createDocumentFragment();
                tempFragment.appendChild(moreBtnPreserve);
                if (moreMenuPreserve) tempFragment.appendChild(moreMenuPreserve);
            }

            containerEl.innerHTML = '';

            // Restore the button/menu to the form (they'll be repositioned after username fieldset is built)
            if (tempFragment && moreBtnPreserve) {
                var form = containerEl.closest('form');
                if (form) form.appendChild(tempFragment);
            }

            function addFieldset(fieldsetKey, patchInput) {
                var fd = getFieldset(fieldsetKey);
                if (!fd) return null;
                var buildOptions = {
                    idPrefix: 'memberProfile',
                    fieldIndex: 0,
                    container: containerEl
                };
                // Pass password settings for password fieldsets
                var isPasswordField = (fieldsetKey === 'password' || fieldsetKey === 'confirm-password' || fieldsetKey === 'new-password');
                if (isPasswordField && passwordSettings) {
                    buildOptions.passwordSettings = passwordSettings;
                }
                var fieldset = FieldsetBuilder.buildFieldset(fd, buildOptions);
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
        var selectedIcon = currentIcon; // Track confirmed selection for Escape revert
        
        var menu = document.createElement('div');
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-iconpicker-menu menu-class-1';
        
        // Button (div with role=button to contain input)
        var btn = document.createElement('div');
        btn.className = 'component-iconpicker-menu-button menu-button';
        btn.setAttribute('role', 'button');
        
        var buttonImage = document.createElement('img');
        buttonImage.className = 'component-iconpicker-menu-button-image';
        buttonImage.src = currentIcon || '';
        buttonImage.alt = '';
        if (!currentIcon) buttonImage.style.display = 'none';
        
        // Input for type-to-filter (replaces span)
        var btnInput = document.createElement('input');
        btnInput.type = 'text';
        btnInput.className = 'component-iconpicker-menu-button-input menu-input';
        btnInput.placeholder = 'Select icon';
        btnInput.autocomplete = 'off';
        if (currentIcon) btnInput.value = getFilename(currentIcon);
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-iconpicker-menu-button-arrow menu-arrow';
        buttonArrow.textContent = '▼';
        
        btn.appendChild(buttonImage);
        btn.appendChild(btnInput);
        btn.appendChild(buttonArrow);
        menu.appendChild(btn);
        
        // Options dropdown
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-iconpicker-menu-options menu-options';
        menu.appendChild(optionsDiv);

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-iconpicker-menu--open', !!isOpen);
            btn.classList.toggle('component-iconpicker-menu-button--open', !!isOpen);
            btn.classList.toggle('menu-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-iconpicker-menu-button-arrow--open', !!isOpen);
            buttonArrow.classList.toggle('menu-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-iconpicker-menu-options--open', !!isOpen);
            optionsDiv.classList.toggle('menu-options--open', !!isOpen);
        }
        menu.__menuIsOpen = function() { return menu.classList.contains('component-iconpicker-menu--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Register with MenuManager
        MenuManager.register(menu);
        menu.__menuGetOptionsEl = function() { return optionsDiv; };
        menu.__menuOptionSelector = '.component-iconpicker-menu-option';
        
        // Store all option elements for filtering
        var allOptions = [];
        
        // Filter options based on search text
        function filterOptions(searchText) {
            var search = String(searchText || '').toLowerCase();
            allOptions.forEach(function(optData) {
                var matches = menuFilterMatch(optData, search);
                optData.element.style.display = matches ? '' : 'none';
            });
        }
        
        // Set value (for init and revert)
        function setValue(iconPath) {
            currentIcon = iconPath;
            selectedIcon = iconPath;
            if (iconPath) {
                buttonImage.src = iconPath;
                buttonImage.style.display = '';
                btnInput.value = getFilename(iconPath);
            } else {
                buttonImage.src = '';
                buttonImage.style.display = 'none';
                btnInput.value = '';
            }
        }
        
        // Render icon options
        function renderIconOptions(iconList, isInitial) {
            optionsDiv.innerHTML = '';
            allOptions = [];
            if (iconList.length === 0) {
                var msg = document.createElement('div');
                msg.className = 'component-iconpicker-menu-error';
                msg.innerHTML = 'No icons found.<br>Please set icon folder in Admin Settings.';
                optionsDiv.appendChild(msg);
            } else {
                iconList.forEach(function(iconPath) {
                    var filename = getFilename(iconPath);
                    
                    var option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'component-iconpicker-menu-option menu-option';
                    
                    var optImg = document.createElement('img');
                    optImg.className = 'component-iconpicker-menu-option-image';
                    optImg.src = iconPath;
                    optImg.alt = '';
                    
                    var optText = document.createElement('span');
                    optText.className = 'component-iconpicker-menu-option-text menu-text';
                    optText.textContent = filename;
                    
                    option.appendChild(optImg);
                    option.appendChild(optText);
                    
                    option.onclick = function(ev) {
                        ev.stopPropagation();
                        currentIcon = iconPath;
                        selectedIcon = iconPath;
                        buttonImage.src = iconPath;
                        buttonImage.style.display = '';
                        btnInput.value = filename;
                        filterOptions('');
                        applyOpenState(false);
                        onSelect(iconPath);
                    };
                    optionsDiv.appendChild(option);
                    
                    // Store for filtering
                    allOptions.push({
                        element: option,
                        valueLower: filename.toLowerCase(),
                        labelLower: filename.toLowerCase(),
                        labelWords: filename.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
                    });
                });
            }
        }
        
        function openMenu() {
            // Close all other menus first
            MenuManager.closeAll(menu);
            // Open menu immediately
            applyOpenState(true);
            btnInput.focus();
            btnInput.select();
            
            // Show database icons instantly (menu is now open and interactive)
            if (!categoryIconsBasket) {
                loadFolderFromSettings().then(function() {
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
        
        // Clicking anywhere on the button opens the menu (if closed)
        btn.addEventListener('click', function(e) {
            if (!menu.classList.contains('component-iconpicker-menu--open')) {
                openMenu();
            } else {
                applyOpenState(false);
            }
        });

        // Input focus opens menu and selects text
        btnInput.addEventListener('focus', function(e) {
            openMenu();
        });

        // Input typing filters options
        btnInput.addEventListener('input', function(e) {
            filterOptions(this.value);
            if (document.activeElement !== this) return;
            if (!menu.classList.contains('component-iconpicker-menu--open')) openMenu();
        });
        
        btnInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                applyOpenState(false);
                // Revert to previous selection
                setValue(selectedIcon);
                filterOptions('');
                return;
            }
            // Arrow key navigation
            if (menu.classList.contains('component-iconpicker-menu--open')) {
                menuArrowKeyNav(e, optionsDiv, '.component-iconpicker-menu-option', function(opt) { opt.click(); });
            }
        });
        
        // Blur - restore selected value when clicking away
        btnInput.addEventListener('blur', function() {
            // Small delay to allow option click to fire first
            setTimeout(function() {
                if (!menu.classList.contains('component-iconpicker-menu--open')) {
                    setValue(selectedIcon);
                    filterOptions('');
                }
            }, 150);
        });

        // Arrow click opens/closes
        buttonArrow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (menu.classList.contains('component-iconpicker-menu--open')) {
                applyOpenState(false);
            } else {
                MenuManager.closeAll(menu);
                applyOpenState(true);
            }
        });
        
        // Disable input pointer when closed (like currency menu)
        menu.classList.add('component-iconpicker-menu--closed');
        
        return {
            element: menu,
            setIcon: function(iconPath) {
                setValue(iconPath);
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
            if (inst.row) {
                var rowBase = inst.rowBaseClass;
                inst.row.classList.add(rowBase + '--loading');
            }
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
            if (inst.row) {
                var rowBase = inst.rowBaseClass;
                inst.row.classList.remove(rowBase + '--loading');
            }
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
            if (inst.row) {
                var rowBase = inst.rowBaseClass;
                inst.row.classList.remove(rowBase + '--loading');
            }
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
            rowBaseClass: prefix + '-row',
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
        
        // Dropdown keyboard navigation
        var dropdownItems = [];
        var activeIndex = -1;
        function dropdownIsOpen() {
            return dropdown && dropdown.style && dropdown.style.display !== 'none';
        }
        function closeDropdown() {
            if (!dropdown) return;
            dropdown.style.display = 'none';
            dropdownItems = [];
            activeIndex = -1;
        }
        function setActiveIndex(nextIdx) {
            if (!dropdownItems || dropdownItems.length === 0) {
                activeIndex = -1;
                return;
            }
            var i = nextIdx;
            if (i < 0) i = 0; // Stop at top, don't loop
            if (i >= dropdownItems.length) i = dropdownItems.length - 1; // Stop at bottom, don't loop
            activeIndex = i;
            dropdownItems.forEach(function(el, idx) {
                try {
                    el.classList.toggle(prefix + '-geocoder-dropdown-item--active', idx === activeIndex);
                } catch (e) {}
            });
            try {
                var el0 = dropdownItems[activeIndex];
                if (el0 && typeof el0.scrollIntoView === 'function') {
                    el0.scrollIntoView({ block: 'nearest' });
                }
            } catch (e2) {}
        }
        function selectActive() {
            if (!dropdownItems || dropdownItems.length === 0) return false;
            if (activeIndex < 0) setActiveIndex(0);
            var el = dropdownItems[activeIndex];
            if (!el) return false;
            try { el.click(); return true; } catch (e) { return false; }
        }
        
        // Fetch and display suggestions using new Google Places API
        async function fetchSuggestions(query) {
            if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
            
            try {
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
                    item.className = prefix + '-geocoder-dropdown-item';
                    item.addEventListener('mouseenter', function() {
                        var idx = dropdownItems.indexOf(item);
                        if (idx >= 0) setActiveIndex(idx);
                    });
                    
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
                                closeDropdown();
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
                    dropdownItems.push(item);
                });
                
                dropdown.style.display = 'block';
                setActiveIndex(0);
            } catch (err) {
                console.error('Autocomplete error:', err);
                closeDropdown();
            }
        }
        
        // Input events
        var debounceTimer = null;
        input.addEventListener('input', function() {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            
            clearTimeout(debounceTimer);
            if (input.value.length < 2) {
                closeDropdown();
                return;
            }
            
            debounceTimer = setTimeout(function() {
                fetchSuggestions(input.value);
            }, 300);
        });
        
        input.addEventListener('keydown', function(e) {
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
                // Prevent submit when dropdown is open; choose active item instead.
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
        
        clearBtn.addEventListener('click', function() {
            input.value = '';
            clearBtn.style.display = 'none';
            closeDropdown();
            input.focus();
        });
        
        // Map dim on search focus (only for map variant)
        if (prefix === 'map-mapcontrol') {
            var mapSearchDim = document.querySelector('.map-search-dim');
            if (!mapSearchDim) {
                // Create dim overlay if it doesn't exist
                var mapContainer = document.querySelector('.map-container');
                if (mapContainer) {
                    mapSearchDim = document.createElement('div');
                    mapSearchDim.className = 'map-search-dim';
                    mapContainer.appendChild(mapSearchDim);
                }
            }
            if (mapSearchDim) {
                input.addEventListener('focus', function() {
                    mapSearchDim.classList.add('map-search-dim--active');
                });
                input.addEventListener('blur', function() {
                    // Delay to allow click on dropdown items
                    setTimeout(function() {
                        if (document.activeElement !== input) {
                            mapSearchDim.classList.remove('map-search-dim--active');
                        }
                    }, 150);
                });
            }
        }
        
        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (!geocoderEl.contains(e.target)) {
                closeDropdown();
            }
        });
        
        // Helper to get current map (allows late binding for welcome modal)
        function getMapInstance() {
            // First check instance.map (may have been set at creation)
            if (instance.map) return instance.map;
            // Fallback to MapModule for welcome modal case
            if (window.MapModule && MapModule.getMap) return MapModule.getMap();
            return null;
        }
        
        // Geolocate button
        geolocateBtn.addEventListener('click', function() {
            var currentMap = getMapInstance();
            
            // If we already have cached location, use it instantly
            if (cachedLocation) {
                if (currentMap) {
                    currentMap.flyTo({ center: [cachedLocation.lng, cachedLocation.lat], zoom: 14 });
                    updateUserLocationMarker(cachedLocation.lat, cachedLocation.lng, currentMap);
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
                    
                    var mapForFly = getMapInstance();
                    if (mapForFly) {
                        mapForFly.flyTo({ center: [lng, lat], zoom: 14 });
                        updateUserLocationMarker(lat, lng, mapForFly);
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
            var currentMap = getMapInstance();
            if (currentMap) {
                currentMap.easeTo({ bearing: 0, pitch: 0, duration: 300 });
            }
        });
        
        // Sync compass rotation with map bearing and pitch
        var compassIcon = compassBtn.querySelector('.' + prefix + '-compass-icon, .' + prefix + '-compass-img');
        function updateCompass() {
            var currentMap = getMapInstance();
            if (compassIcon && currentMap) {
                var bearing = currentMap.getBearing();
                var pitch = currentMap.getPitch();
                compassIcon.style.transform = 'rotateX(' + pitch + 'deg) rotateZ(' + (-bearing) + 'deg)';
            }
        }
        
        // Bind to map events if map is available now
        if (map) {
            map.on('rotate', updateCompass);
            map.on('pitch', updateCompass);
            map.on('load', updateCompass);
            updateCompass();
        } else {
            // For welcome modal, listen for map:ready event
            if (window.App && App.on) {
                App.on('map:ready', function(data) {
                    if (data && data.map) {
                        instance.map = data.map;
                        data.map.on('rotate', updateCompass);
                        data.map.on('pitch', updateCompass);
                        updateCompass();
                    }
                });
            }
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
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-systemimagepicker-menu menu-class-1';
        
        // Button
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-systemimagepicker-menu-button menu-button';
        
        var buttonImage = document.createElement('img');
        buttonImage.className = 'component-systemimagepicker-menu-button-image';
        buttonImage.src = '';
        buttonImage.alt = '';
        buttonImage.style.display = 'none';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-systemimagepicker-menu-button-text menu-text';
        buttonText.textContent = 'Select...';
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-systemimagepicker-menu-button-arrow menu-arrow';
        buttonArrow.textContent = '▼';
        
        button.appendChild(buttonImage);
        button.appendChild(buttonText);
        button.appendChild(buttonArrow);
        menu.appendChild(button);
        
        // Options dropdown
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-systemimagepicker-menu-options menu-options';
        menu.appendChild(optionsDiv);

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-systemimagepicker-menu--open', !!isOpen);
            button.classList.toggle('component-systemimagepicker-menu-button--open', !!isOpen);
            button.classList.toggle('menu-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-systemimagepicker-menu-button-arrow--open', !!isOpen);
            buttonArrow.classList.toggle('menu-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-systemimagepicker-menu-options--open', !!isOpen);
            optionsDiv.classList.toggle('menu-options--open', !!isOpen);
        }
        menu.__menuIsOpen = function() { return menu.classList.contains('component-systemimagepicker-menu--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Register with MenuManager
        MenuManager.register(menu);
        menu.__menuGetOptionsEl = function() { return optionsDiv; };
        menu.__menuOptionSelector = '.component-systemimagepicker-menu-option';
        
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
                    msg.className = 'component-systemimagepicker-menu-error';
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
                    option.className = 'component-systemimagepicker-menu-option menu-option';
                    option.setAttribute('data-image-path', imagePath);
                    
                    var optImg = document.createElement('img');
                    optImg.className = 'component-systemimagepicker-menu-option-image';
                    optImg.src = imagePath;
                    optImg.alt = '';
                    
                    var optText = document.createElement('span');
                    optText.className = 'component-systemimagepicker-menu-option-text menu-text';
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

        function openMenu() {
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
        
        function closeMenu() {
            applyOpenState(false);
        }
        
        // Keyboard: arrows + enter + escape
        function onKeyDown(e) {
            if (!e) return;
            var key = e.key;
            var isOpen = menu.classList.contains('component-systemimagepicker-menu--open');
            
            if (key === 'Escape') {
                if (isOpen) {
                    closeMenu();
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
                if (!isOpen) {
                    openMenu();
                    e.preventDefault();
                    e.stopPropagation();
                }
                menuArrowKeyNav(e, optionsDiv, '.component-systemimagepicker-menu-option', function(opt) { opt.click(); });
            }
        }
        menu.addEventListener('keydown', onKeyDown, true);
        
        // Toggle menu (mouse)
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('component-systemimagepicker-menu--open');
            if (isOpen) closeMenu();
            else openMenu();
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
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-amenitiespicker-menu menu-class-1';
        
        // Button - EXACT same structure as SystemImagePickerComponent
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-amenitiespicker-menu-button menu-button';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-amenitiespicker-menu-button-text menu-text';
        buttonText.textContent = 'Select amenities...';
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-amenitiespicker-menu-button-arrow menu-arrow';
        buttonArrow.textContent = '▼';
        
        button.appendChild(buttonText);
        button.appendChild(buttonArrow);
        menu.appendChild(button);
        
        // Options dropdown - EXACT same structure
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-amenitiespicker-menu-options menu-options';
        menu.appendChild(optionsDiv);

        function applyOpenState(isOpen) {
            menu.classList.toggle('component-amenitiespicker-menu--open', !!isOpen);
            button.classList.toggle('component-amenitiespicker-menu-button--open', !!isOpen);
            button.classList.toggle('menu-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-amenitiespicker-menu-button-arrow--open', !!isOpen);
            buttonArrow.classList.toggle('menu-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-amenitiespicker-menu-options--open', !!isOpen);
            optionsDiv.classList.toggle('menu-options--open', !!isOpen);
        }
        menu.__menuIsOpen = function() { return menu.classList.contains('component-amenitiespicker-menu--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Register with MenuManager
        MenuManager.register(menu);
        menu.__menuGetOptionsEl = function() { return optionsDiv; };
        menu.__menuOptionSelector = '.component-amenitiespicker-menu-option';
        
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
                msg.className = 'component-amenitiespicker-menu-error';
                msg.innerHTML = 'No amenities found.<br>Please set amenities folder in Admin Settings.';
                optionsDiv.appendChild(msg);
                return;
            }
            
            amenities.forEach(function(amenity) {
                var option = document.createElement('button');
                option.type = 'button';
                option.className = 'component-amenitiespicker-menu-option menu-option';
                option.setAttribute('data-amenity-value', amenity.value || '');
                
                // Checkbox - added to match amenities requirement
                var checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'component-amenitiespicker-menu-option-checkbox';
                checkbox.checked = selectedAmenities.indexOf(amenity.value) !== -1;
                
                // Icon - EXACT same structure as SystemImagePickerComponent
                var optImg = document.createElement('img');
                optImg.className = 'component-amenitiespicker-menu-option-image';
                if (amenity.filename && window.App) {
                    var iconUrl = window.App.getImageUrl('amenities', amenity.filename);
                    optImg.src = iconUrl;
                }
                optImg.alt = '';
                
                // Text - EXACT same structure as SystemImagePickerComponent
                var optText = document.createElement('span');
                optText.className = 'component-amenitiespicker-menu-option-text menu-text';
                optText.textContent = amenity.value || amenity.label || '';
                
                option.appendChild(checkbox);
                option.appendChild(optImg);
                option.appendChild(optText);
                
                // Make checkbox display-only (non-interactive)
                checkbox.style.pointerEvents = 'none';
                
                // Update visual state based on checkbox
                function updateOptionState() {
                    optImg.classList.toggle('component-amenitiespicker-menu-option-image--selected', !!checkbox.checked);
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
        
        function openMenu() {
            MenuManager.closeAll(menu);
            applyOpenState(true);
            loadAmenities().then(function(amenities) {
                renderAmenityOptions(amenities);
            });
        }
        
        function closeMenu() {
            applyOpenState(false);
        }
        
        // Keyboard: arrows + enter + escape
        function onKeyDown(e) {
            if (!e) return;
            var key = e.key;
            var isOpen = menu.classList.contains('component-amenitiespicker-menu--open');
            
            if (key === 'Escape') {
                if (isOpen) {
                    closeMenu();
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
                if (!isOpen) {
                    openMenu();
                    e.preventDefault();
                    e.stopPropagation();
                }
                menuArrowKeyNav(e, optionsDiv, '.component-amenitiespicker-menu-option', function(opt) { opt.click(); });
            }
        }
        menu.addEventListener('keydown', onKeyDown, true);
        
        // Toggle menu (mouse)
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('component-amenitiespicker-menu--open');
            if (isOpen) closeMenu();
            else openMenu();
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
                if (menu.classList.contains('component-amenitiespicker-menu--open')) {
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
                '<div class="welcome-modal-controls"></div>' +
                '</div>' +
                '</div>';
            
            document.body.appendChild(modal);
        }
        
        logoElement = modal.querySelector('.welcome-modal-logo');
        controlsElement = modal.querySelector('.welcome-modal-controls');
        
        // Create map controls using MapControlRowComponent if available
        if (controlsElement && window.MapControlRowComponent) {
            controlsElement.innerHTML = '';
            
            // Map instance will be fetched dynamically by the component
            MapControlRowComponent.create(controlsElement, {
                variant: 'welcome',
                placeholder: 'Search location...',
                map: null, // Component will get map dynamically via MapModule.getMap()
                onResult: function(result) {
                    if (result && result.center) {
                        var map = window.MapModule && MapModule.getMap ? MapModule.getMap() : null;
                        if (map) {
                            map.flyTo({ center: result.center, zoom: 14 });
                        }
                    }
                    close();
                }
            });
        }
        
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
        // Move focus out before hiding to avoid aria-hidden violation
        if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
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
                
                // If the wheel event happens within an open menu, route the scroll to the menu's
                // options list when it can actually scroll in that direction.
                // This prevents the anchor from "eating" the first scroll.
                try {
                    var t = e && e.target;
                    var m = (window.MenuManager && typeof MenuManager.findOpenMenuForTarget === 'function') ? MenuManager.findOpenMenuForTarget(t) : null;
                    var opts = m && window.MenuManager && typeof MenuManager.getOptionsEl === 'function' ? MenuManager.getOptionsEl(m) : null;
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

                // Route touch scrolling to open menu options when possible (same reason as wheel routing).
                // dy is finger movement; scroll intent is the opposite direction.
                try {
                    var deltaY = -dy;
                    var targ = e && e.target;
                    var m = (window.MenuManager && typeof MenuManager.findOpenMenuForTarget === 'function') ? MenuManager.findOpenMenuForTarget(targ) : null;
                    var opts = m && window.MenuManager && typeof MenuManager.getOptionsEl === 'function' ? MenuManager.getOptionsEl(m) : null;
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
                } catch (_eMenuTouch) {}

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

                // If the wheel event happens within an open menu, route the scroll to the menu's
                // options list when it can actually scroll in that direction.
                // This prevents the anchor from "eating" the first scroll.
                try {
                    var t = e && e.target;
                    var m = (window.MenuManager && typeof MenuManager.findOpenMenuForTarget === 'function') ? MenuManager.findOpenMenuForTarget(t) : null;
                    var opts = m && window.MenuManager && typeof MenuManager.getOptionsEl === 'function' ? MenuManager.getOptionsEl(m) : null;
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
                } catch (_eMenu) {}

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

                // Route touch scrolling to open menu options when possible.
                // dy is finger movement; scroll intent is the opposite direction.
                try {
                    var deltaY = -dy;
                    var targ = e && e.target;
                    var m = (window.MenuManager && typeof MenuManager.findOpenMenuForTarget === 'function') ? MenuManager.findOpenMenuForTarget(targ) : null;
                    var opts = m && window.MenuManager && typeof MenuManager.getOptionsEl === 'function' ? MenuManager.getOptionsEl(m) : null;
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
                } catch (_eMenuTouch) {}

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
        canvas.width = 1000;
        canvas.height = 1000;
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
        // Move focus out before hiding to avoid aria-hidden violation
        if (document.activeElement && overlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }
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

        // Avatar validation settings (from admin_settings 403-405)
        var avatarMinWidth = 1000;
        var avatarMinHeight = 1000;
        var avatarMaxSize = 5242880; // 5MB
        try {
            if (window.adminSettings) {
                if (window.adminSettings.avatar_min_width) avatarMinWidth = parseInt(window.adminSettings.avatar_min_width, 10) || 1000;
                if (window.adminSettings.avatar_min_height) avatarMinHeight = parseInt(window.adminSettings.avatar_min_height, 10) || 1000;
                if (window.adminSettings.avatar_max_size) avatarMaxSize = parseInt(window.adminSettings.avatar_max_size, 10) || 5242880;
            }
        } catch (e) {}
        
        function validateAvatarFile(file) {
            return new Promise(function(resolve, reject) {
                // Check file size first
                if (file.size > avatarMaxSize) {
                    var maxMB = (avatarMaxSize / 1024 / 1024).toFixed(1);
                    reject('Avatar must be smaller than ' + maxMB + 'MB');
                    return;
                }
                
                // Check dimensions
                var img = new Image();
                var objectUrl = URL.createObjectURL(file);
                img.onload = function() {
                    URL.revokeObjectURL(objectUrl);
                    if (img.naturalWidth < avatarMinWidth || img.naturalHeight < avatarMinHeight) {
                        reject('Avatar must be at least ' + avatarMinWidth + 'x' + avatarMinHeight + ' pixels');
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
        
        function openCropperForFile(file) {
            if (!allowUpload) return;
            if (!window.AvatarCropperComponent || typeof AvatarCropperComponent.open !== 'function') {
                throw new Error('[AvatarPickerComponent] AvatarCropperComponent is required.');
            }
            
            // Validate before opening cropper
            validateAvatarFile(file).then(function() {
                AvatarCropperComponent.open(file, function(result) {
                    setSelfFromCropResult(result);
                });
            }).catch(function(errorMsg) {
                if (window.ToastComponent && ToastComponent.showError) {
                    ToastComponent.showError(errorMsg);
                }
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
        // Move focus out before hiding to avoid aria-hidden violation
        if (document.activeElement && overlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }
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


/* ============================================================================
   AGE RATING COMPONENT
   
   Dropdown menu for selecting age ratings (All Ages, 7+, 12+, 15+, 18+, 21+).
   Data loaded from list_age_ratings table via get-admin-settings API.
   ============================================================================ */

const AgeRatingComponent = (function(){
    
    var ageRatingData = [];
    var dataLoaded = false;
    
    function getData() {
        return ageRatingData;
    }
    
    function setData(data) {
        ageRatingData = data || [];
        dataLoaded = true;
    }
    
    function isLoaded() {
        return dataLoaded;
    }
    
    // Get image URL using central App registry (same pattern as PhonePrefixComponent)
    function getImageUrl(filename) {
        if (!filename) return '';
        if (window.App && typeof window.App.getImageUrl === 'function') {
            return window.App.getImageUrl('ageRatings', filename);
        }
        return '';
    }
    
    // Load age rating data from database via gateway
    function loadFromDatabase() {
        return fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.dropdown_options && res.dropdown_options['age-rating']) {
                    ageRatingData = res.dropdown_options['age-rating'];
                    dataLoaded = true;
                }
                return ageRatingData;
            });
    }
    
    // Build age rating dropdown menu
    // options: { onSelect, initialValue }
    function buildMenu(options) {
        options = options || {};
        var onSelect = options.onSelect || function() {};
        var initialValue = options.initialValue || null;
        var selectedValue = initialValue;
        
        var menu = document.createElement('div');
        // menu-class-1 supplies appearance; component CSS supplies layout only.
        menu.className = 'component-ageratingpicker-menu menu-class-1';
        // Default state is "no image" until a real selection with an icon is applied.
        // This ensures placeholder text aligns with options (only 10px left padding from the button itself).
        menu.classList.add('component-ageratingpicker-menu--noimage');
        
        // Button
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-ageratingpicker-menu-button menu-button';
        
        var buttonImage = document.createElement('img');
        buttonImage.className = 'component-ageratingpicker-menu-button-image';
        buttonImage.src = '';
        buttonImage.alt = '';
        buttonImage.style.display = 'none';
        
        var buttonText = document.createElement('span');
        buttonText.className = 'component-ageratingpicker-menu-button-text menu-text';
        buttonText.textContent = 'Select rating';
        
        var buttonArrow = document.createElement('span');
        buttonArrow.className = 'component-ageratingpicker-menu-button-arrow menu-arrow';
        buttonArrow.textContent = '▼';
        
        button.appendChild(buttonImage);
        button.appendChild(buttonText);
        button.appendChild(buttonArrow);
        menu.appendChild(button);
        
        // Options dropdown
        var optionsDiv = document.createElement('div');
        optionsDiv.className = 'component-ageratingpicker-menu-options menu-options';
        menu.appendChild(optionsDiv);
        
        function applyOpenState(isOpen) {
            menu.classList.toggle('component-ageratingpicker-menu--open', !!isOpen);
            button.classList.toggle('component-ageratingpicker-menu-button--open', !!isOpen);
            button.classList.toggle('menu-button--open', !!isOpen);
            buttonArrow.classList.toggle('component-ageratingpicker-menu-button-arrow--open', !!isOpen);
            buttonArrow.classList.toggle('menu-arrow--open', !!isOpen);
            optionsDiv.classList.toggle('component-ageratingpicker-menu-options--open', !!isOpen);
            optionsDiv.classList.toggle('menu-options--open', !!isOpen);
        }
        
        menu.__menuIsOpen = function() { return menu.classList.contains('component-ageratingpicker-menu--open'); };
        menu.__menuApplyOpenState = applyOpenState;
        
        // Register with MenuManager
        MenuManager.register(menu);
        menu.__menuGetOptionsEl = function() { return optionsDiv; };
        menu.__menuOptionSelector = '.component-ageratingpicker-menu-option';
        
        // Set button from initial value
        function setValue(value) {
            if (!value) {
                buttonImage.src = '';
                buttonImage.style.display = 'none';
                buttonText.textContent = 'Select rating';
                selectedValue = null;
                menu.dataset.value = '';
                // Placeholder state: no icon, so remove extra left padding before text
                menu.classList.add('component-ageratingpicker-menu--noimage');
                return;
            }
            var found = ageRatingData.find(function(item) {
                return item.value === value;
            });
            if (found) {
                selectedValue = value;
                buttonText.textContent = found.label;
                menu.dataset.value = value;
                var imgUrl = getImageUrl(found.filename);
                if (imgUrl) {
                    buttonImage.src = imgUrl;
                    buttonImage.style.display = '';
                    menu.classList.remove('component-ageratingpicker-menu--noimage');
                } else {
                    buttonImage.style.display = 'none';
                    menu.classList.add('component-ageratingpicker-menu--noimage');
                }
            }
        }
        
        // Render options
        function renderOptions() {
            optionsDiv.innerHTML = '';
            
            ageRatingData.forEach(function(item) {
                var option = document.createElement('button');
                option.type = 'button';
                option.className = 'component-ageratingpicker-menu-option menu-option';
                option.setAttribute('data-value', item.value);
                
                var optImg = document.createElement('img');
                optImg.className = 'component-ageratingpicker-menu-option-image';
                var itemImgUrl = getImageUrl(item.filename);
                if (itemImgUrl) {
                    optImg.src = itemImgUrl;
                }
                optImg.alt = '';
                
                var optText = document.createElement('span');
                optText.className = 'component-ageratingpicker-menu-option-text menu-text';
                optText.textContent = item.label;
                
                option.appendChild(optImg);
                option.appendChild(optText);
                
                option.onclick = function(ev) {
                    ev.stopPropagation();
                    setValue(item.value);
                    applyOpenState(false);
                    onSelect(item.value, item.label, item.filename);
                    try { menu.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                };
                
                optionsDiv.appendChild(option);
            });
        }
        
        function openMenu() {
            MenuManager.closeAll(menu);
            applyOpenState(true);
            
            // Load data if not loaded
            if (!dataLoaded || ageRatingData.length === 0) {
                loadFromDatabase().then(function() {
                    renderOptions();
                    if (initialValue) setValue(initialValue);
                });
            } else {
                renderOptions();
            }
        }
        
        function closeMenu() {
            applyOpenState(false);
        }
        
        // Keyboard: arrows + enter + escape
        function onKeyDown(e) {
            if (!e) return;
            var key = e.key;
            var isOpen = menu.classList.contains('component-ageratingpicker-menu--open');
            
            if (key === 'Escape') {
                if (isOpen) {
                    closeMenu();
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
                if (!isOpen) {
                    openMenu();
                    e.preventDefault();
                    e.stopPropagation();
                }
                menuArrowKeyNav(e, optionsDiv, '.component-ageratingpicker-menu-option', function(opt) { opt.click(); });
            }
        }
        menu.addEventListener('keydown', onKeyDown, true);
        
        // Toggle menu (mouse)
        button.onclick = function(e) {
            e.stopPropagation();
            var isOpen = menu.classList.contains('component-ageratingpicker-menu--open');
            if (isOpen) closeMenu();
            else openMenu();
        };
        
        // Initialize if data already loaded
        if (dataLoaded && ageRatingData.length > 0) {
            if (initialValue) setValue(initialValue);
        }
        
        return {
            element: menu,
            getValue: function() {
                return selectedValue;
            },
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
   LOCATION WALLPAPER (Member-only, location containers)
   ============================================================================
   Modes (admin setting: location_wallpaper_mode):
   - "off": No wallpaper shown
   - "orbit": Live orbiting map while container is active; continuous background
              captures every few seconds; on click-away, stop orbit but keep map
              running briefly, show pre-captured image, then lazy cleanup
   - "still": Show map visually while loading, wait for full render, capture
              and swap to static image
   ============================================================================ */

const LocationWallpaperComponent = (function() {
    'use strict';

    var activeCtrl = null;
    var activeContainerEl = null;
    var docListenerInstalled = false;
    var didPrewarm = false;

    // Background capture interval (ms) for orbit mode
    var CAPTURE_INTERVAL_MS = 3000;
    // Grace period before removing map after click-away (ms)
    var CLEANUP_DELAY_MS = 2000;
    // Still mode: wait this long for map to "polish" before capturing (ms)
    var STILL_POLISH_DELAY_MS = 1500;

    function safeNum(v) {
        var n = parseFloat(String(v || '').trim());
        return isFinite(n) ? n : null;
    }

    function prefersReducedMotion() {
        try {
            return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) {
            return false;
        }
    }

    function getWallpaperMode() {
        // Source of truth: admin_settings -> App state -> get-admin-settings payload
        try {
            if (window.App && typeof App.getState === 'function') {
                var s = App.getState('settings');
                var v = s ? String(s.location_wallpaper_mode || '').trim().toLowerCase() : '';
                if (v === 'orbit' || v === 'still' || v === 'off') return v;
            }
        } catch (e) {}
        return 'off';
    }

    function getLocationTypeFromContainer(containerEl) {
        if (!containerEl) return 'venue';
        try {
            if (containerEl.querySelector('.fieldset[data-fieldset-key="city"]')) return 'city';
            if (containerEl.querySelector('.fieldset[data-fieldset-key="address"], .fieldset[data-fieldset-key="location"]')) return 'address';
            if (containerEl.querySelector('.fieldset[data-fieldset-key="venue"]')) return 'venue';
        } catch (e) {}
        return 'venue';
    }

    function getDefaultCameraForType(locationType, centerLngLat) {
        var t = String(locationType || '').toLowerCase();
        var zoom = (t === 'city') ? 12 : 16;
        return {
            center: centerLngLat,
            zoom: zoom,
            pitch: 70,
            bearing: 0
        };
    }

    function readLatLng(containerEl) {
        if (!containerEl) return null;
        try {
            var latEl = containerEl.querySelector('.fieldset-lat');
            var lngEl = containerEl.querySelector('.fieldset-lng');
            var lat = latEl ? safeNum(latEl.value) : null;
            var lng = lngEl ? safeNum(lngEl.value) : null;
            if (lat === null || lng === null) return null;
            return { lat: lat, lng: lng };
        } catch (e) {
            return null;
        }
    }

    function getStyleUrlForWallpaper() {
        // Location wallpaper always uses standard style (night lighting applied separately).
        return 'mapbox://styles/mapbox/standard';
    }

    function getLightingPresetForWallpaper() {
        // Location wallpaper always uses night lighting for consistent dark aesthetic.
        return 'night';
    }

    function applyWallpaperNoTextNoRoads(map) {
        if (!map) return;
        // Hide all labels and roads for clean wallpaper appearance.
        try {
            if (typeof map.setConfigProperty === 'function') {
                try { map.setConfigProperty('basemap', 'showPlaceLabels', false); } catch (_e1) {}
                try { map.setConfigProperty('basemap', 'showRoadLabels', false); } catch (_e2) {}
                try { map.setConfigProperty('basemap', 'showPointOfInterestLabels', false); } catch (_e3) {}
                try { map.setConfigProperty('basemap', 'showTransitLabels', false); } catch (_e4) {}
                try { map.setConfigProperty('basemap', 'showRoads', false); } catch (_e5) {}
                try { map.setConfigProperty('basemap', 'showTraffic', false); } catch (_e6) {}
            }
        } catch (_eCfg) {}
    }

    function attachToLocationContainer(locationContainerEl) {
        if (!locationContainerEl) throw new Error('[LocationWallpaperComponent] locationContainerEl is required.');

        var contentEl = locationContainerEl.querySelector('.member-postform-location-content');
        if (!contentEl) throw new Error('[LocationWallpaperComponent] .member-postform-location-content not found.');

        // Root sits behind content; pointer-events none (wallpaper only).
        var root = document.createElement('div');
        root.className = 'component-locationwallpaper';
        root.setAttribute('aria-hidden', 'true');

        var mapMount = document.createElement('div');
        mapMount.className = 'component-locationwallpaper-mapmount';
        mapMount.style.opacity = '0';
        mapMount.style.transition = 'opacity 0.8s ease';

        var img = document.createElement('img');
        img.className = 'component-locationwallpaper-image';
        img.alt = '';
        img.decoding = 'sync';
        img.loading = 'eager';
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.8s ease';

        root.appendChild(mapMount);
        root.appendChild(img);

        // Apply dimmer setting from admin
        var dimmerValue = 30; // Default 30%
        try {
            var settings = App.getState('settings') || {};
            if (settings.location_wallpaper_dimmer !== undefined) {
                dimmerValue = parseInt(settings.location_wallpaper_dimmer, 10) || 30;
            }
        } catch (e) {}
        root.style.setProperty('--locationwallpaper-dimmer', (dimmerValue / 100).toString());

        // Insert as first child so z-index rules can lift everything else above it.
        contentEl.insertBefore(root, contentEl.firstChild || null);
        contentEl.classList.add('member-postform-location-content--locationwallpaper');

        var st = {
            map: null,
            orbiting: false,
            lastLat: null,
            lastLng: null,
            savedCamera: null,
            imageUrl: '',
            latestCaptureUrl: '',  // Most recent background capture (orbit mode)
            reducedMotion: prefersReducedMotion(),
            pendingRevealTimer: null,
            resizeObs: null,
            resizeRaf: 0,
            minHeightLocked: false,
            didReveal: false,
            revealTimeout: null,
            captureIntervalId: null,
            cleanupTimeoutId: null,
            mode: 'off',
            isActive: false
        };

        function clearAllTimers() {
            if (st.pendingRevealTimer) {
                clearTimeout(st.pendingRevealTimer);
                st.pendingRevealTimer = null;
            }
            if (st.revealTimeout) {
                clearTimeout(st.revealTimeout);
                st.revealTimeout = null;
            }
            if (st.captureIntervalId) {
                clearInterval(st.captureIntervalId);
                st.captureIntervalId = null;
            }
            if (st.cleanupTimeoutId) {
                clearTimeout(st.cleanupTimeoutId);
                st.cleanupTimeoutId = null;
            }
        }

        function setImageUrl(url) {
            try {
                if (st.imageUrl && st.imageUrl.indexOf('data:') === 0) {
                    // Data URLs don't need revoking
                } else if (st.imageUrl) {
                    URL.revokeObjectURL(st.imageUrl);
                }
            } catch (e) {}
            st.imageUrl = url || '';
            if (st.imageUrl) {
                img.src = st.imageUrl;
                // Ensure image is decoded and ready for display
                if (typeof img.decode === 'function') {
                    img.decode().catch(function() {});
                }
            } else {
                img.removeAttribute('src');
                img.style.opacity = '0';
            }
        }

        function showImage() {
            // Crossfade: fade image in on top of map (no black dip)
            if (!st.imageUrl) {
                img.style.opacity = '0';
                mapMount.style.opacity = '0';
                return;
            }
            // Fade in the image on top (transition already set on element)
            img.style.opacity = '1';
            // Keep map visible during transition, then fade it out
            setTimeout(function() {
                mapMount.style.opacity = '0';
            }, 100);
        }

        function showMap() {
            // Crossfade: show map, fade out image on top
            st.didReveal = true;
            // Fade in the map (transition already set on element)
            mapMount.style.opacity = '1';
            // Keep image visible during transition, then fade it out
            setTimeout(function() {
                img.style.opacity = '0';
            }, 100);
        }

        function revealMapCrossfade() {
            // Smooth crossfade from image to map
            showMap();
        }

        function getMapCamera() {
            if (!st.map) return null;
            try {
                var c = st.map.getCenter();
                return {
                    center: [c.lng, c.lat],
                    zoom: st.map.getZoom(),
                    pitch: st.map.getPitch(),
                    bearing: st.map.getBearing()
                };
            } catch (e) {
                return null;
            }
        }

        function captureMapToDataUrl() {
            if (!st.map) return null;
            var canvas = null;
            try { canvas = st.map.getCanvas(); } catch (e) { return null; }
            if (!canvas) return null;

            var dataUrl = '';
            try { dataUrl = canvas.toDataURL('image/webp', 0.85); } catch (e1) { dataUrl = ''; }
            if (!dataUrl || dataUrl.indexOf('data:image') !== 0) {
                try { dataUrl = canvas.toDataURL('image/jpeg', 0.85); } catch (e2) { dataUrl = ''; }
            }
            if (dataUrl && dataUrl.indexOf('data:image') === 0) {
                return dataUrl;
            }
            return null;
        }

        function doBackgroundCapture() {
            // Called periodically during orbit mode to keep a fresh capture ready
            if (!st.map || !st.isActive) return;
            var url = captureMapToDataUrl();
            if (url) {
                st.latestCaptureUrl = url;
            }
        }

        function startBackgroundCaptures() {
            if (st.captureIntervalId) return;
            st.captureIntervalId = setInterval(doBackgroundCapture, CAPTURE_INTERVAL_MS);
            // Do an immediate capture as well
            doBackgroundCapture();
        }

        function stopBackgroundCaptures() {
            if (st.captureIntervalId) {
                clearInterval(st.captureIntervalId);
                st.captureIntervalId = null;
            }
        }

        function stopOrbit() {
            st.orbiting = false;
            // Stop the map's current animation
            try { if (st.map && typeof st.map.stop === 'function') st.map.stop(); } catch (e) {}
        }

        function startOrbit(baseZoom) {
            if (!st.map) return;
            if (st.reducedMotion) return;
            st.orbiting = true;

            function step(firstStep) {
                if (!st.map || !st.orbiting) return;
                var b = 0;
                try { b = st.map.getBearing() || 0; } catch (e) { b = 0; }

                var opts = {
                    bearing: b + 12,
                    duration: 6500,
                    easing: function(t) { return t; },
                    essential: true
                };
                if (firstStep && typeof baseZoom === 'number') {
                    opts.zoom = baseZoom;
                }
                try {
                    st.map.easeTo(opts);
                } catch (e2) {
                    st.orbiting = false;
                    return;
                }
                st.map.once('moveend', function() {
                    if (!st.orbiting) return;
                    step(false);
                });
            }

            step(true);
        }

        function ensureResizeObserver() {
            if (st.resizeObs || !window.ResizeObserver) return;
            st.resizeObs = new ResizeObserver(function() {
                if (!st.map) return;
                if (st.resizeRaf) cancelAnimationFrame(st.resizeRaf);
                st.resizeRaf = requestAnimationFrame(function() {
                    st.resizeRaf = 0;
                    try { if (st.map) st.map.resize(); } catch (e) {}
                });
            });
            try { st.resizeObs.observe(contentEl); } catch (e) {}
        }

        function ensureMinHeightLocked() {
            if (st.minHeightLocked) return;
            var w = 0;
            try { w = contentEl.getBoundingClientRect().width || 0; } catch (e) { w = 0; }
            w = Math.max(0, Math.round(w));
            if (!w) {
                requestAnimationFrame(function() {
                    if (st.minHeightLocked) return;
                    var w2 = 0;
                    try { w2 = contentEl.getBoundingClientRect().width || 0; } catch (e2) { w2 = 0; }
                    w2 = Math.max(0, Math.round(w2));
                    if (w2) {
                        try { contentEl.style.setProperty('--locationwallpaper-minh', w2 + 'px'); } catch (e3) {}
                        st.minHeightLocked = true;
                    }
                });
                return;
            }
            try { contentEl.style.setProperty('--locationwallpaper-minh', w + 'px'); } catch (e4) {}
            st.minHeightLocked = true;
        }

        function createMap(camera) {
            if (st.map) return;
            if (!window.mapboxgl || !mapboxgl.accessToken) return;

            mapMount.innerHTML = '';
            try {
                st.map = new mapboxgl.Map({
                    container: mapMount,
                    style: getStyleUrlForWallpaper(),
                    projection: 'globe',
                    center: camera.center,
                    zoom: camera.zoom,
                    pitch: camera.pitch || 0,
                    bearing: camera.bearing || 0,
                    interactive: false,
                    attributionControl: false,
                    renderWorldCopies: false,
                    antialias: false,
                    pixelRatio: 1,
                    preserveDrawingBuffer: true
                });
            } catch (eMap) {
                st.map = null;
                return;
            }

            ensureResizeObserver();

            st.map.once('style.load', function() {
                try {
                    if (st.map && typeof st.map.setConfigProperty === 'function') {
                        st.map.setConfigProperty('basemap', 'lightPreset', getLightingPresetForWallpaper());
                    }
                } catch (eLP) {}
                try { applyWallpaperNoTextNoRoads(st.map); } catch (_eNR) {}
            });
        }

        function removeMap() {
            stopOrbit();
            stopBackgroundCaptures();
            try { if (st.map) st.map.remove(); } catch (e) {}
            st.map = null;
        }

        function lazyCleanup() {
            // Called after grace period to remove the map
            if (st.cleanupTimeoutId) {
                clearTimeout(st.cleanupTimeoutId);
                st.cleanupTimeoutId = null;
            }
            removeMap();
        }

        function scheduleLazyCleanup() {
            if (st.cleanupTimeoutId) return; // Already scheduled
            st.cleanupTimeoutId = setTimeout(lazyCleanup, CLEANUP_DELAY_MS);
        }

        function cancelLazyCleanup() {
            if (st.cleanupTimeoutId) {
                clearTimeout(st.cleanupTimeoutId);
                st.cleanupTimeoutId = null;
            }
        }

        // ============================================================
        // ORBIT MODE
        // ============================================================
        function startOrbitMode(lat, lng) {
            cancelLazyCleanup();
            st.isActive = true;

            var locationType = getLocationTypeFromContainer(locationContainerEl);
            var desired = getDefaultCameraForType(locationType, [lng, lat]);

            // Resume bearing if same location
            if (st.savedCamera && st.lastLat === lat && st.lastLng === lng) {
                if (typeof st.savedCamera.bearing === 'number') {
                    desired.bearing = st.savedCamera.bearing;
                }
            }

            // If we have a pre-captured image, show it while map loads
            if (st.latestCaptureUrl) {
                setImageUrl(st.latestCaptureUrl);
                showImage();
            }

            if (!st.map) {
                createMap(desired);
            } else {
                try { st.map.jumpTo(desired); } catch (e) {}
            }

            if (!st.map) return;

            // Reveal and start orbiting once map tiles are loaded (not just first render)
            st.didReveal = false;
            var onMapLoad = function() {
                if (!st.map || st.didReveal) return;
                revealMapCrossfade();
                stopOrbit();
                startOrbit(desired.zoom);
                startBackgroundCaptures();
            };

            // Use 'load' event like main map - fires when tiles are ready
            try { st.map.once('load', onMapLoad); } catch (e) {}
            st.revealTimeout = setTimeout(onMapLoad, 3000);
        }

        function deactivateOrbitMode() {
            st.isActive = false;
            stopOrbit();
            stopBackgroundCaptures();

            // Save camera for resume
            st.savedCamera = getMapCamera();

            // Immediately show the pre-captured image
            if (st.latestCaptureUrl) {
                setImageUrl(st.latestCaptureUrl);
            } else {
                // No capture available, do a final capture now
                var url = captureMapToDataUrl();
                if (url) {
                    setImageUrl(url);
                    st.latestCaptureUrl = url;
                }
            }
            showImage();

            // Schedule lazy cleanup - map stays alive briefly in case user clicks back
            scheduleLazyCleanup();
        }

        // ============================================================
        // STILL MODE
        // ============================================================
        function startStillMode(lat, lng) {
            cancelLazyCleanup();
            st.isActive = true;

            var locationType = getLocationTypeFromContainer(locationContainerEl);
            var desired = getDefaultCameraForType(locationType, [lng, lat]);

            // If we already have a captured image for this location, show it
            if (st.latestCaptureUrl && st.lastLat === lat && st.lastLng === lng) {
                setImageUrl(st.latestCaptureUrl);
                showImage();
                return;
            }

            // Show existing image while new one loads (smooth transition)
            if (st.latestCaptureUrl) {
                setImageUrl(st.latestCaptureUrl);
                showImage();
            }

            if (!st.map) {
                createMap(desired);
            } else {
                try { st.map.jumpTo(desired); } catch (e) {}
            }

            if (!st.map) return;

            // For still mode, wait for tiles to load then show and capture
            st.didReveal = false;
            var onMapLoad = function() {
                if (!st.map || st.didReveal) return;
                st.didReveal = true;
                
                // Tiles are ready - fade in the map
                showMap();

                // Give a moment for any final polish, then capture
                setTimeout(function() {
                    if (!st.map) return;
                    var url = captureMapToDataUrl();
                    if (url) {
                        st.latestCaptureUrl = url;
                        setImageUrl(url);
                    }
                    // Crossfade from map back to captured image
                    showImage();
                    // Wait for fade transition to complete before removing map
                    setTimeout(function() {
                        removeMap();
                    }, 600);
                }, 500); // Short delay since tiles are already loaded
            };

            // Use 'load' event like main map - fires when tiles are ready
            try { st.map.once('load', onMapLoad); } catch (e) {}
            st.revealTimeout = setTimeout(onMapLoad, 3000);
        }

        function deactivateStillMode() {
            st.isActive = false;
            // In still mode the map should already be removed after capture
            // Just ensure we're showing the image
            showImage();
            // Delay removal to allow fade transition
            setTimeout(function() {
                removeMap();
            }, 600);
        }

        // ============================================================
        // PUBLIC API
        // ============================================================
        function refresh() {
            // Called when container becomes active or lat/lng changes
            if (locationContainerEl.getAttribute('data-active') !== 'true') return;

            var mode = getWallpaperMode();
            st.mode = mode;

            if (mode === 'off') {
                // Hide everything
                clearAllTimers();
                removeMap();
                setImageUrl('');
                try { root.style.display = 'none'; } catch (e) {}
                return;
            }

            try { root.style.display = ''; } catch (e) {}
            ensureMinHeightLocked();

            var ll = readLatLng(locationContainerEl);
            if (!ll) {
                // No location yet - nothing to show
                return;
            }

            var lat = ll.lat;
            var lng = ll.lng;

            // Track if location changed
            var changed = (st.lastLat !== lat || st.lastLng !== lng);
            st.lastLat = lat;
            st.lastLng = lng;
            if (changed) {
                st.savedCamera = null;
                st.latestCaptureUrl = '';
            }

            if (mode === 'orbit') {
                startOrbitMode(lat, lng);
            } else if (mode === 'still') {
                startStillMode(lat, lng);
            }
        }

        function freeze() {
            // Called when user clicks away from container
            var mode = st.mode;
            if (mode === 'orbit') {
                deactivateOrbitMode();
            } else if (mode === 'still') {
                deactivateStillMode();
            } else {
                // Off mode - just clean up
                clearAllTimers();
                removeMap();
            }
        }

        function destroy() {
            clearAllTimers();
            removeMap();
            try {
                if (st.resizeObs) st.resizeObs.disconnect();
            } catch (e) {}
            st.resizeObs = null;
            if (st.resizeRaf) cancelAnimationFrame(st.resizeRaf);
            st.resizeRaf = 0;
            setImageUrl('');
            st.latestCaptureUrl = '';
            try { contentEl.classList.remove('member-postform-location-content--locationwallpaper'); } catch (e) {}
            try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e) {}
        }

        return {
            element: root,
            refresh: refresh,
            freeze: freeze,
            destroy: destroy
        };
    }

    function getOrCreateCtrl(locationContainerEl) {
        if (!locationContainerEl) return null;
        try {
            if (locationContainerEl.__locationWallpaperCtrl) return locationContainerEl.__locationWallpaperCtrl;
        } catch (e) {}
        var ctrl = attachToLocationContainer(locationContainerEl);
        try { locationContainerEl.__locationWallpaperCtrl = ctrl; } catch (e2) {}
        return ctrl;
    }

    function handleActiveContainerChange(rootEl, clickedContainerEl) {
        // Called from FormBuilder's centralized container click tracking.
        var mode = getWallpaperMode();
        if (mode === 'off') return;

        var nextLocationContainer = null;
        try {
            if (clickedContainerEl && clickedContainerEl.classList && clickedContainerEl.classList.contains('member-location-container')) {
                nextLocationContainer = clickedContainerEl;
            }
        } catch (e) {}

        // Clicking inside the already-active container should NOT re-refresh
        if (nextLocationContainer && activeContainerEl && nextLocationContainer === activeContainerEl && activeCtrl) {
            return;
        }

        // Freeze previous container's wallpaper
        if (activeCtrl && (!nextLocationContainer || activeCtrl !== (nextLocationContainer.__locationWallpaperCtrl || null))) {
            try { activeCtrl.freeze(); } catch (e2) {}
            activeCtrl = null;
            activeContainerEl = null;
        }

        // Activate new container's wallpaper
        if (nextLocationContainer) {
            var ctrl = getOrCreateCtrl(nextLocationContainer);
            activeCtrl = ctrl;
            activeContainerEl = nextLocationContainer;
            try { if (ctrl) ctrl.refresh(); } catch (e3) {}
        }
    }

    function install(rootEl) {
        if (!rootEl) return;
        try {
            if (rootEl.__locationWallpaperInstalled) return;
            rootEl.__locationWallpaperInstalled = true;
        } catch (e) {}

        var mode = getWallpaperMode();
        if (mode === 'off') return;

        // One-time Mapbox prewarm
        if (!didPrewarm) {
            didPrewarm = true;
            try {
                if (window.mapboxgl && typeof mapboxgl.prewarm === 'function') {
                    mapboxgl.prewarm();
                }
            } catch (_ePW) {}
        }

        // Global click handler for click-away detection
        if (!docListenerInstalled) {
            docListenerInstalled = true;
            document.addEventListener('click', function(e) {
                if (!activeCtrl || !activeContainerEl) return;
                var t = e && e.target ? e.target : null;
                if (!t || !(t instanceof Element)) return;
                if (t.closest && t.closest('.pac-container')) return;
                if (t.closest && t.closest('.fieldset-location-dropdown')) return;
                if (activeContainerEl.contains(t)) return;
                try { activeCtrl.freeze(); } catch (_eF) {}
                activeCtrl = null;
                activeContainerEl = null;
            }, true);
        }

        // Listen for lat/lng changes
        rootEl.addEventListener('change', function(e) {
            if (!activeCtrl) return;
            var t = e && e.target ? e.target : null;
            if (!t || !(t instanceof Element)) return;
            var activeContainer = t.closest('.member-location-container[data-active="true"]');
            if (!activeContainer) return;
            if (activeCtrl !== (activeContainer.__locationWallpaperCtrl || null)) return;
            if (t.classList && (t.classList.contains('fieldset-lat') || t.classList.contains('fieldset-lng'))) {
                try { activeCtrl.refresh(); } catch (e2) {}
            }
        }, true);
    }

    return {
        install: install,
        handleActiveContainerChange: handleActiveContainerChange
    };
})();


// Expose globally
window.AvatarCropperComponent = AvatarCropperComponent;
window.AvatarPickerComponent = AvatarPickerComponent;
window.PostCropperComponent = PostCropperComponent;
window.ClearButtonComponent = ClearButtonComponent;
window.SwitchComponent = SwitchComponent;
window.CalendarComponent = CalendarComponent;
window.CurrencyComponent = CurrencyComponent;
window.LanguageMenuComponent = LanguageMenuComponent;
window.PhonePrefixComponent = PhonePrefixComponent;
window.CountryComponent = CountryComponent;
window.MemberAuthFieldsetsComponent = MemberAuthFieldsetsComponent;
window.IconPickerComponent = IconPickerComponent;
window.SystemImagePickerComponent = SystemImagePickerComponent;
window.AmenitiesMenuComponent = AmenitiesMenuComponent;
window.AgeRatingComponent = AgeRatingComponent;
window.MapControlRowComponent = MapControlRowComponent;
window.CheckoutOptionsComponent = CheckoutOptionsComponent;
window.ConfirmDialogComponent = ConfirmDialogComponent;
window.ThreeButtonDialogComponent = ThreeButtonDialogComponent;
window.ToastComponent = ToastComponent;
window.WelcomeModalComponent = WelcomeModalComponent;
window.ImageAddTileComponent = ImageAddTileComponent;
window.BottomSlack = BottomSlack;
window.TopSlack = TopSlack;
window.LocationWallpaperComponent = LocationWallpaperComponent;



