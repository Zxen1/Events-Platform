/* ============================================================================
   HEADER.JS - HEADER SECTION
   ============================================================================
   
   Controls the header bar at the top of the page.
   
   CURRENTLY IMPLEMENTED:
   - Filter button (opens/closes filter panel, shows active filter count)
   - Member button (opens/closes member panel)
   - Admin button (hidden until admin logged in)
   - Fullscreen button (toggles fullscreen mode)
   
   NOT YET IMPLEMENTED (dependencies needed):
   - Logo button (needs admin settings)
   - Mode switch (needs post module)
   
   ============================================================================ */

const HeaderModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var filterPanelOpen = false;
    var filterBtn = null;
    var memberBtn = null;
    var adminBtn = null;
    var fullscreenBtn = null;
    var logoBtn = null;
    var headerResizeTimer = null;
    var headerTeleportFadeTimer = null;
    var headerResizeFading = false;
    var headerSmoothingFreezeItems = [];

    /* --------------------------------------------------------------------------
       FILTER ACTIVE VISUAL
       -------------------------------------------------------------------------- */
    
    function getCurrentMapZoomSafe() {
        try {
            if (window.MapModule && typeof MapModule.getMap === 'function') {
                var m = MapModule.getMap();
                if (m && typeof m.getZoom === 'function') return m.getZoom();
            }
        } catch (_e) {}
        return null;
    }
    
    function isMapAreaFilterActive() {
        // In this app, "map area" is a filter at zoom >= postsLoadZoom (server queries use bounds).
        var z = getCurrentMapZoomSafe();
        // postsLoadZoom is set by index.js from database settings (no hardcoded fallback here)
        if (!window.App || typeof window.App.getConfig !== 'function') {
            throw new Error('[Header] App.getConfig is required for postsLoadZoom.');
        }
        var threshold = window.App.getConfig('postsLoadZoom');
        if (typeof threshold !== 'number' || !isFinite(threshold)) {
            throw new Error('[Header] postsLoadZoom config is missing or invalid.');
        }
        return (typeof z === 'number' && isFinite(z) && z >= threshold);
    }
    
    function loadSavedFiltersSnapshot() {
        try {
            var raw = localStorage.getItem('funmap_filters');
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (_e) {
            return null;
        }
    }
    
    function hasAnyCategoryOrSubcategoryTogglesOff(categoriesObj) {
        if (!categoriesObj || typeof categoriesObj !== 'object') return false;
        try {
            var keys = Object.keys(categoriesObj);
            for (var i = 0; i < keys.length; i++) {
                var cat = categoriesObj[keys[i]];
                if (!cat || typeof cat !== 'object') continue;
                if (cat.enabled === false) return true;
                var subs = cat.subs;
                if (subs && typeof subs === 'object') {
                    var subKeys = Object.keys(subs);
                    for (var j = 0; j < subKeys.length; j++) {
                        if (subs[subKeys[j]] === false) return true;
                    }
                }
            }
        } catch (_e2) {}
        return false;
    }
    
    function areAnyFiltersActiveNow() {
        // This is a *UI signal*, not an authoritative filter engine:
        // - Must be fast
        // - Must not require loading the filter module
        // - Must not do any network work
        var st = loadSavedFiltersSnapshot() || {};
        
        // Text/date/expired/price filters (EXACTLY matches FilterModule "Reset Filters" active logic)
        var hasKeyword = !!(st.keyword && String(st.keyword).trim() !== '');
        var hasMinPrice = !!(st.minPrice && String(st.minPrice).trim() !== '');
        var hasMaxPrice = !!(st.maxPrice && String(st.maxPrice).trim() !== '');
        var hasDate = !!(
            (st.dateStart && String(st.dateStart).trim() !== '') ||
            (st.dateEnd && String(st.dateEnd).trim() !== '')
        );
        // Be strict: localStorage can contain strings ("false"/"0") depending on DB snapshots.
        // Only treat expired as active when it is truthy in a boolean sense.
        var exp = st.expired;
        var hasExpired = (exp === true || exp === 1 || exp === '1' || String(exp).toLowerCase() === 'true');

        // Category/subcategory toggles also affect orange icon state (any toggle OFF = orange).
        var hasCategoryOff = hasAnyCategoryOrSubcategoryTogglesOff(st.categories);

        return hasKeyword || hasMinPrice || hasMaxPrice || hasDate || hasExpired || hasCategoryOff;
    }
    
    function setHeaderFilterIconActive(active) {
        var filterIcon = document.querySelector('.header-filter-button-icon');
        if (!filterIcon) return;
        if (active) {
            // Color is intentionally inline so it stays correct even if filter module is never loaded.
            // Paul may change this color later; this is the single place to do it.
            // Use the platform variable (base.css) instead of hardcoding.
            filterIcon.style.backgroundColor = 'var(--filter-active-color)';
        } else {
            filterIcon.style.backgroundColor = '';
        }
    }
    
    function refreshHeaderFilterActiveVisual() {
        try {
            setHeaderFilterIconActive(areAnyFiltersActiveNow());
        } catch (_e) {}
    }

    function setAccessButtonActiveVisual(btn, isActive) {
        if (!btn) return;
        btn.classList.toggle('button--active', !!isActive);
        // Icon uses currentColor - inherits from button, no class needed
        var avatar = btn.querySelector('.header-access-button-avatar');
        if (avatar) avatar.classList.toggle('header-access-button-avatar--active', !!isActive);
    }


    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        initLogoButton();
        initFilterButton();
        initModeSwitch();
        initMemberButton();
        initAdminButton();
        initFullscreenButton();
        initHeaderRightResizeAntiJitter();
        
        // Load logo from settings on startup
        loadLogoFromSettings();
    }

    function getHeaderRightResizeTargets() {
        return [memberBtn, adminBtn, fullscreenBtn].filter(function(el) {
            return !!(el && el.offsetParent !== null);
        });
    }

    function clearHeaderSmoothingFreeze() {
        while (headerSmoothingFreezeItems.length) {
            var item = headerSmoothingFreezeItems.pop();
            try {
                if (item.clone && item.clone.parentNode) item.clone.parentNode.removeChild(item.clone);
            } catch (_eClone) {}
            try {
                if (item.el) item.el.style.opacity = '';
            } catch (_eEl) {}
        }
    }

    function startHeaderSmoothingFreeze(targets) {
        if (headerSmoothingFreezeItems.length || !targets || !targets.length) return;
        targets.forEach(function(el) {
            var rect = el.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) return;
            var clone = el.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.style.position = 'fixed';
            clone.style.left = rect.left + 'px';
            clone.style.top = rect.top + 'px';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            clone.style.margin = '0';
            clone.style.transform = 'none';
            clone.style.pointerEvents = 'none';
            clone.style.zIndex = '65';
            document.body.appendChild(clone);
            el.style.opacity = '0';
            headerSmoothingFreezeItems.push({ el: el, clone: clone });
        });
    }

    function initHeaderRightResizeAntiJitter() {
        if (initHeaderRightResizeAntiJitter._bound) return;
        initHeaderRightResizeAntiJitter._bound = true;

        window.addEventListener('resize', function() {
            var mode = window._resizeAntiJitter || 'off';
            var targets = getHeaderRightResizeTargets();
            if (!targets.length) return;

            if (mode === 'off' || mode === 'blur') {
                if (headerTeleportFadeTimer) {
                    clearTimeout(headerTeleportFadeTimer);
                    headerTeleportFadeTimer = null;
                }
                headerResizeFading = false;
                clearHeaderSmoothingFreeze();
                targets.forEach(function(el) {
                    el.style.transition = '';
                    el.style.opacity = '1';
                });
                return;
            }

            if (mode === 'teleport' && !headerResizeFading) {
                clearHeaderSmoothingFreeze();
                headerResizeFading = true;
                targets.forEach(function(el) {
                    el.style.transition = 'none';
                    el.style.opacity = '0';
                });
            }

            if (mode === 'smoothing') {
                startHeaderSmoothingFreeze(targets);
                if (headerResizeTimer) clearTimeout(headerResizeTimer);
                headerResizeTimer = setTimeout(function() {
                    clearHeaderSmoothingFreeze();
                }, 100);
                return;
            }

            if (headerResizeTimer) clearTimeout(headerResizeTimer);
            headerResizeTimer = setTimeout(function() {
                if (headerTeleportFadeTimer) {
                    clearTimeout(headerTeleportFadeTimer);
                    headerTeleportFadeTimer = null;
                }
                if (mode === 'teleport') {
                    targets.forEach(function(el) {
                        el.style.transition = 'opacity 0.3s ease';
                        void el.offsetWidth;
                        el.style.opacity = '1';
                    });
                    headerTeleportFadeTimer = setTimeout(function() {
                        targets.forEach(function(el) {
                            el.style.transition = '';
                        });
                        headerResizeFading = false;
                        headerTeleportFadeTimer = null;
                    }, 300);
                }
            }, mode === 'smoothing' ? 0 : 100);
        });
    }
    
    
    /* --------------------------------------------------------------------------
       LOGO BUTTON
       -------------------------------------------------------------------------- */
    
    function initLogoButton() {
        logoBtn = document.querySelector('.header-logo-button');
        if (!logoBtn) return;
        
        logoBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Toggle welcome modal
            if (window.WelcomeModalComponent) {
                WelcomeModalComponent.toggle();
            }
            // Trigger spin if map module supports it
            var mapModule = App.getModule('map');
            if (mapModule && mapModule.triggerLogoSpin) {
                mapModule.triggerLogoSpin();
            }
        });
    }
    
    function loadLogoFromSettings() {
        if (typeof window.App === 'undefined') {
            setTimeout(loadLogoFromSettings, 50);
            return;
        }

        var waitFn = (typeof window.App.whenStartupSettingsReady === 'function')
            ? window.App.whenStartupSettingsReady
            : null;

        // Ensure startup settings have been loaded (shared single request)
        if (waitFn) {
            waitFn().then(function() {
                var sys = window.App.getState('system_images') || {};
                if (sys.small_logo && typeof window.App.getImageUrl === 'function') {
                    setLogo(window.App.getImageUrl('systemImages', sys.small_logo));
                }
                loadHeaderIcons(sys);
            });
            return;
        }

        throw new Error('[Header] App.whenStartupSettingsReady() is required.');
    }
    
    function loadHeaderIcons(systemImages) {
        // Ensure App.getImageUrl is available
        if (typeof window.App === 'undefined' || typeof window.App.getImageUrl !== 'function') {
            return;
        }

        // Icons are rendered via CSS masks; before the mask-image URL exists the element can appear
        // as a solid grey box. Keep icons hidden by default and only reveal once a mask-image is present.
        function syncIconVisibility(el) {
            if (!el) return;
            try {
                var cs = window.getComputedStyle(el);
                var mask = (cs && (cs.webkitMaskImage || cs.maskImage)) || '';
                var hasMask = !!mask && mask !== 'none';
                el.style.opacity = hasMask ? '1' : '0';
            } catch (e) {
                // ignore
            }
        }
        
        function setHeaderCssVar(name, url) {
            try {
                document.documentElement.style.setProperty(name, url ? ('url("' + url + '")') : '');
            } catch (e) {
                // ignore
            }
        }
        
        // Filter icon - use mask-image like admin buttons
        var filterIcon = document.querySelector('.header-filter-button-icon');
        if (filterIcon && systemImages.icon_filter) {
            var iconUrl = window.App.getImageUrl('systemImages', systemImages.icon_filter);
            filterIcon.style.webkitMaskImage = 'url(' + iconUrl + ')';
            filterIcon.style.maskImage = 'url(' + iconUrl + ')';
            // Let CSS control the background-color for proper state styling
            syncIconVisibility(filterIcon);
        }
        
        // Header access button icons (Member / Admin / Fullscreen)
        if (systemImages.icon_member) {
            setHeaderCssVar('--header-icon-member', window.App.getImageUrl('systemImages', systemImages.icon_member));
        }
        if (systemImages.icon_admin) {
            setHeaderCssVar('--header-icon-admin', window.App.getImageUrl('systemImages', systemImages.icon_admin));
        }
        if (systemImages.icon_fullscreen) {
            setHeaderCssVar('--header-icon-fullscreen', window.App.getImageUrl('systemImages', systemImages.icon_fullscreen));
        }
        if (systemImages.icon_fullscreen_exit) {
            setHeaderCssVar('--header-icon-fullscreen-exit', window.App.getImageUrl('systemImages', systemImages.icon_fullscreen_exit));
        }
        
        // Mode switch icons (NO FALLBACKS)
        if (systemImages.icon_recent) {
            setHeaderCssVar('--header-icon-recent', window.App.getImageUrl('systemImages', systemImages.icon_recent));
        }
        if (systemImages.icon_posts) {
            setHeaderCssVar('--header-icon-posts', window.App.getImageUrl('systemImages', systemImages.icon_posts));
        }
        if (systemImages.icon_map) {
            setHeaderCssVar('--header-icon-map', window.App.getImageUrl('systemImages', systemImages.icon_map));
        }

        // Reveal icons only if/when their CSS mask-image is present
        try {
            document.querySelectorAll('.header-modeswitch-button-icon, .header-access-button-icon').forEach(function(el) {
                syncIconVisibility(el);
            });
        } catch (e) {
            // ignore
        }
    }
    
    function setLogo(imagePath) {
        var logoEl = document.querySelector('.header-logo-button-image');
        if (!logoEl) return;
        
        // Use background-image (prevents broken-image placeholders)
        try {
            logoEl.style.backgroundImage = imagePath ? ('url("' + imagePath + '")') : '';
        } catch (e) {
            // ignore
        }
    }


    /* --------------------------------------------------------------------------
       MODE SWITCH (Recents / Posts / Map)
       -------------------------------------------------------------------------- */
    
    var modeSwitchButtons = null;
    var currentMode = 'map'; // Default mode
    
    // Close all open panels (filter, member, admin)
    // options.keepMember: if truthy, skip closing the member panel
    function closePanels(options) {
        try {
            var keep = options || {};

            var filterPanel = document.querySelector('.filter-panel');
            if (filterPanel && filterPanel.classList.contains('show')) {
                if (window.FilterModule && typeof window.FilterModule.closePanel === 'function') {
                    window.FilterModule.closePanel();
                } else {
                    var filterClose = document.querySelector('.filter-panel-actions-icon-btn--close');
                    if (filterClose) filterClose.click();
                }
            }
            
            if (!keep.keepMember) {
                var memberPanel = document.querySelector('.member-panel');
                if (memberPanel && memberPanel.classList.contains('member-panel--show')) {
                    if (window.MemberModule && typeof window.MemberModule.closePanel === 'function') {
                        window.MemberModule.closePanel();
                    } else {
                        var memberClose = document.querySelector('.member-panel-actions-icon-btn--close');
                        if (memberClose) memberClose.click();
                    }
                }
            }
            
            var adminPanel = document.querySelector('.admin-panel');
            if (adminPanel && adminPanel.classList.contains('admin-panel--show')) {
                if (window.AdminModule && typeof window.AdminModule.closePanel === 'function') {
                    window.AdminModule.closePanel();
                } else {
                    var adminClose = document.querySelector('.admin-panel-actions-icon-btn--close');
                    if (adminClose) adminClose.click();
                }
            }
        } catch (e) {
            // ignore
        }
    }

    function initModeSwitch() {
        modeSwitchButtons = document.querySelectorAll('.header-modeswitch > .button-class-1');
        if (!modeSwitchButtons.length) return;
        
        modeSwitchButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = btn.dataset.mode;
                if (!mode) return;
                
                // Close any open panels (always - cleans screen on small devices)
                closePanels();
                
                // Skip mode change if already in this mode
                if (mode === currentMode) return;
                
                // Change mode
                setMode(mode);
            });
        });
        
        // Set initial mode (map is default)
        setMode('map');
    }
    
    function setMode(mode) {
        currentMode = mode;
        
        // Update button states
        modeSwitchButtons.forEach(function(btn) {
            var isActive = btn.dataset.mode === mode;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.classList.toggle('header-modeswitch-button--active', isActive);
        });
        
        // Emit event for other modules
        App.emit('mode:changed', { mode: mode });
    }


    /* --------------------------------------------------------------------------
       FILTER BUTTON
       -------------------------------------------------------------------------- */
    
    function initFilterButton() {
        filterBtn = document.querySelector('.header-filter');
        if (!filterBtn) return;
        
        // Set the correct visual state on boot.
        refreshHeaderFilterActiveVisual();
        
        // Keep it updated as filters/scope change.
        App.on('filter:changed', function(state) {
            if (state && state.categories && hasAnyCategoryOrSubcategoryTogglesOff(state.categories)) {
                setHeaderFilterIconActive(true);
            } else {
                refreshHeaderFilterActiveVisual();
            }
        });
        App.on('filter:resetAll', function() { refreshHeaderFilterActiveVisual(); });
        App.on('filter:resetCategories', function() { refreshHeaderFilterActiveVisual(); });
        App.on('member:stateChanged', function() {
            refreshHeaderFilterActiveVisual();
        });
        
        filterBtn.addEventListener('click', function() {
            // Close other panels if on mobile
            if (window.innerWidth <= 530) {
                try {
                    if (window.MemberModule && typeof window.MemberModule.closePanel === 'function') {
                        window.MemberModule.closePanel();
                    }
                    if (window.AdminModule && typeof window.AdminModule.closePanel === 'function') {
                        window.AdminModule.closePanel();
                    }
                } catch (e) {}
            }

            // Read open/closed state from the DOM to avoid stale booleans.
            var filterPanelEl = document.querySelector('.filter-panel');
            var filterPanelContentEl = document.querySelector('.filter-panel-content');
            var isOpenNow = !!(
                filterPanelEl &&
                filterPanelEl.classList.contains('show') &&
                filterPanelContentEl &&
                filterPanelContentEl.classList.contains('panel-visible')
            );

            // If open and dragged from default: reset position (don't close)
            if (isOpenNow && window.FilterModule && window.FilterModule.isPanelDragged()) {
                window.FilterModule.resetToDefault();
                return;
            }

            filterPanelOpen = !isOpenNow;
            filterBtn.setAttribute('aria-expanded', filterPanelOpen ? 'true' : 'false');
            App.emit('panel:toggle', {
                panel: 'filter',
                show: filterPanelOpen
            });
        });
        
        // Listen for filter panel close events
        App.on('filter:closed', function() {
            filterPanelOpen = false;
            if (filterBtn) {
                filterBtn.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Listen for filter active state changes (show orange icon when filters active)
        App.on('filter:activeState', function(data) {
            if (data && data.active === true) {
                setHeaderFilterIconActive(true);
            } else {
                refreshHeaderFilterActiveVisual();
            }
        });

    }

    /* --------------------------------------------------------------------------
       MEMBER BUTTON
       -------------------------------------------------------------------------- */
    
    function initMemberButton() {
        memberBtn = document.querySelector('.header-access-member');
        if (!memberBtn) return;
        
        // Click only opens panel (like live site) - close via panel's close button
        memberBtn.addEventListener('click', function() {
            // Close other panels if on mobile
            if (window.innerWidth <= 530) {
                try {
                    if (window.FilterModule && typeof window.FilterModule.closePanel === 'function') {
                        window.FilterModule.closePanel();
                    }
                    if (window.AdminModule && typeof window.AdminModule.closePanel === 'function') {
                        window.AdminModule.closePanel();
                    }
                } catch (e) {}
            }

            var memberPanelEl = document.querySelector('.member-panel');
            var memberPanelContentEl = document.querySelector('.member-panel-contents');
            var memberIsOpen = !!(
                memberPanelEl &&
                memberPanelEl.classList.contains('member-panel--show') &&
                memberPanelContentEl &&
                memberPanelContentEl.classList.contains('member-panel-contents--visible')
            );

            // If open and dragged: reset position (don't close)
            if (memberIsOpen && window.MemberModule && window.MemberModule.isPanelDragged()) {
                window.MemberModule.resetToDefault();
                return;
            }

            // If open and at default: close
            if (memberIsOpen) {
                App.emit('panel:toggle', { panel: 'member', show: false });
                return;
            }

            // Closed: open
            App.emit('panel:toggle', { panel: 'member', show: true });
        });
        
        // Listen for member panel close events
        App.on('member:closed', function() {
            if (memberBtn) {
                memberBtn.setAttribute('aria-expanded', 'false');
                setAccessButtonActiveVisual(memberBtn, false);
            }
        });
        
        App.on('member:opened', function() {
            if (memberBtn) {
                memberBtn.setAttribute('aria-expanded', 'true');
                setAccessButtonActiveVisual(memberBtn, true);
            }
        });
    }


    /* --------------------------------------------------------------------------
       ADMIN BUTTON
       -------------------------------------------------------------------------- */
    
    function initAdminButton() {
        adminBtn = document.querySelector('.header-access-admin');
        if (!adminBtn) return;
        
        // Click only opens panel (like live site) - close via panel's close button
        adminBtn.addEventListener('click', function() {
            // Close other panels if on mobile
            if (window.innerWidth <= 530) {
                try {
                    if (window.FilterModule && typeof window.FilterModule.closePanel === 'function') {
                        window.FilterModule.closePanel();
                    }
                    if (window.MemberModule && typeof window.MemberModule.closePanel === 'function') {
                        window.MemberModule.closePanel();
                    }
                } catch (e) {}
            }

            var adminPanelEl = document.querySelector('.admin-panel');
            var adminPanelContentEl = document.querySelector('.admin-panel-contents');
            var adminIsOpen = !!(
                adminPanelEl &&
                adminPanelEl.classList.contains('admin-panel--show') &&
                adminPanelContentEl &&
                adminPanelContentEl.classList.contains('admin-panel-contents--visible')
            );

            // If open and dragged: reset position (never close)
            if (adminIsOpen && window.AdminModule && window.AdminModule.isPanelDragged()) {
                window.AdminModule.resetToDefault();
                return;
            }

            // If open and at default: no action (admin button never closes)
            if (adminIsOpen) return;

            // Closed: open
            App.emit('panel:toggle', { panel: 'admin', show: true });
        });
        
        // Listen for admin panel close events
        App.on('admin:closed', function() {
            if (adminBtn) {
                adminBtn.setAttribute('aria-expanded', 'false');
                setAccessButtonActiveVisual(adminBtn, false);
            }
        });
        
        App.on('admin:opened', function() {
            if (adminBtn) {
                adminBtn.setAttribute('aria-expanded', 'true');
                setAccessButtonActiveVisual(adminBtn, true);
            }
        });
        
        // Listen for member state changes to show/hide admin button
        App.on('member:stateChanged', function(data) {
            var user = data && data.user;
            if (user && user.isAdmin === true) {
                showAdminButton();
            } else {
                hideAdminButton();
            }
        });
    }
    
    function showAdminButton() {
        if (!adminBtn) return;
        adminBtn.classList.remove('header-access-button--hidden');
        adminBtn.removeAttribute('hidden');
        adminBtn.setAttribute('aria-hidden', 'false');
    }
    
    function hideAdminButton() {
        if (!adminBtn) return;
        adminBtn.classList.add('header-access-button--hidden');
        adminBtn.setAttribute('hidden', '');
        adminBtn.setAttribute('aria-hidden', 'true');
    }


    /* --------------------------------------------------------------------------
       FULLSCREEN BUTTON
       -------------------------------------------------------------------------- */
    
    function initFullscreenButton() {
        fullscreenBtn = document.querySelector('.header-access-fullscreen');
        if (!fullscreenBtn) return;
        
        var docEl = document.documentElement;
        var canFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        var enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;
        
        // Hide button if fullscreen not supported
        if (!canFS || enabled === false) {
            fullscreenBtn.classList.add('header-access-button--hidden');
            return;
        }
        
        // Initial state
        updateFullscreenState();
        
        // Listen for fullscreen changes (cross-browser)
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function(evt) {
            document.addEventListener(evt, updateFullscreenState);
        });
        
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    function getFullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }
    
    function toggleFullscreen() {
        var docEl = document.documentElement;
        var isFull = getFullscreenElement();
        
        if (!isFull) {
            var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (req) {
                req.call(docEl);
            }
        } else {
            var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) {
                exit.call(document);
            }
        }
    }
    
    function updateFullscreenState() {
        if (!fullscreenBtn) return;
        
        var isFull = getFullscreenElement();
        fullscreenBtn.setAttribute('aria-pressed', isFull ? 'true' : 'false');
        fullscreenBtn.classList.toggle('btn--active', !!isFull);
        var icon = fullscreenBtn.querySelector('.header-access-button-icon');
        if (icon) {
            icon.classList.toggle('header-access-button-icon--fullscreen-exit', !!isFull);
            // If the exit icon isn't configured, don't show a grey placeholder when fullscreen toggles.
            try { 
                var cs = window.getComputedStyle(icon);
                var mask = (cs && (cs.webkitMaskImage || cs.maskImage)) || '';
                var hasMask = !!mask && mask !== 'none';
                icon.style.opacity = hasMask ? '1' : '0';
            } catch (e) {
                // ignore
            }
        }
    }


    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        setLogo: setLogo,
        closePanels: closePanels,
        setMode: setMode,
        refreshFilterButton: function() {
            refreshHeaderFilterActiveVisual();
        }
    };

})();

// Register module with App
App.registerModule('header', HeaderModule);
