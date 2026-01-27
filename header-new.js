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
    var filterModuleLoaded = false;
    var filterModuleLoading = false;

    /* --------------------------------------------------------------------------
       FILTER ACTIVE VISUAL (no lazy-load required)
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
        var threshold = 8;
        try {
            if (window.App && typeof window.App.getConfig === 'function') {
                var t = window.App.getConfig('postsLoadZoom');
                if (typeof t === 'number' && isFinite(t)) threshold = t;
            }
        } catch (_eCfg) {}
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

        // IMPORTANT:
        // Category/subcategory toggles must NOT affect the orange icon state.
        // The orange icon indicates only "active filters" (keyword/price/date/expired).
        return hasKeyword || hasMinPrice || hasMaxPrice || hasDate || hasExpired;
    }
    
    function setHeaderFilterIconActive(active) {
        var filterIcon = document.querySelector('.header-filter-button-icon');
        if (!filterIcon) return;
        if (active) {
            // Color is intentionally inline so it stays correct even if filter module is never loaded.
            // Paul may change this color later; this is the single place to do it.
            // Use the platform variable (base-new.css) instead of hardcoding.
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
        
        // Load logo from settings on startup
        loadLogoFromSettings();
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
    
    function initModeSwitch() {
        modeSwitchButtons = document.querySelectorAll('.header-modeswitch > .button-class-1');
        if (!modeSwitchButtons.length) return;
        
        modeSwitchButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = btn.dataset.mode;
                if (!mode) return;
                
                // Close any open panels (always - cleans screen on small devices)
                try {
                    var filterPanel = document.querySelector('.filter-panel');
                    if (filterPanel && filterPanel.classList.contains('show')) {
                        // Use module if available, fallback to click
                        if (window.FilterModule && typeof window.FilterModule.closePanel === 'function') {
                            window.FilterModule.closePanel();
                        } else {
                            var filterClose = document.querySelector('.filter-panel-actions-icon-btn--close');
                            if (filterClose) filterClose.click();
                        }
                    }
                    
                    var memberPanel = document.querySelector('.member-panel');
                    if (memberPanel && memberPanel.classList.contains('member-panel--show')) {
                        if (window.MemberModule && typeof window.MemberModule.closePanel === 'function') {
                            window.MemberModule.closePanel();
                        } else {
                            var memberClose = document.querySelector('.member-panel-actions-icon-btn--close');
                            if (memberClose) memberClose.click();
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
       FILTER BUTTON (Lazy Loading)
       -------------------------------------------------------------------------- */
    
    function loadFilterModule() {
        if (filterModuleLoaded) return Promise.resolve();
        if (filterModuleLoading) return filterModuleLoading;
        
        filterModuleLoading = new Promise(function(resolve, reject) {
            // Load CSS
            var cssLoaded = false;
            var jsLoaded = false;
            
            function checkDone() {
                if (cssLoaded && jsLoaded) {
                    filterModuleLoaded = true;
                    filterModuleLoading = false;
                    // Small delay to ensure script has executed
                    setTimeout(function() {
                        if (window.FilterModule && typeof window.FilterModule.init === 'function') {
                            window.FilterModule.init();
                        }
                        resolve();
                    }, 10);
                }
            }
            
            // Load CSS
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'filter-new.css?v=' + (window.APP_VERSION || Date.now());
            link.onload = function() {
                cssLoaded = true;
                checkDone();
            };
            link.onerror = function() {
                console.error('[Header] Failed to load filter CSS');
                cssLoaded = true; // Continue anyway
                checkDone();
            };
            document.head.appendChild(link);
            
            // Load JS
            var script = document.createElement('script');
            script.src = 'filter-new.js?v=' + (window.APP_VERSION || Date.now());
            script.onload = function() {
                jsLoaded = true;
                checkDone();
            };
            script.onerror = function() {
                console.error('[Header] Failed to load filter JS');
                reject(new Error('Failed to load filter module'));
            };
            document.body.appendChild(script);
        });
        
        return filterModuleLoading;
    }
    
    function initFilterButton() {
        filterBtn = document.querySelector('.header-filter');
        if (!filterBtn) return;
        
        // Set the correct visual state on boot without loading filter-new.js.
        refreshHeaderFilterActiveVisual();
        
        // Keep it updated as filters/scope change.
        App.on('filter:changed', function() { refreshHeaderFilterActiveVisual(); });
        App.on('filter:resetAll', function() { refreshHeaderFilterActiveVisual(); });
        App.on('filter:resetCategories', function() { refreshHeaderFilterActiveVisual(); });
        
        filterBtn.addEventListener('click', function() {
            // Close other panels if on mobile
            if (window.innerWidth <= 530) {
                try {
                    // Use module close methods to ensure state is updated
                    if (window.MemberModule && typeof window.MemberModule.closePanel === 'function') {
                        window.MemberModule.closePanel();
                    }
                    if (window.AdminModule && typeof window.AdminModule.closePanel === 'function') {
                        window.AdminModule.closePanel();
                    }
                    
                    // Force immediate removal of classes to prevent stacking in relative flow
                    var mPanel = document.querySelector('.member-panel');
                    if (mPanel) {
                        mPanel.classList.remove('member-panel--show');
                        mPanel.style.display = 'none'; // Force hide
                    }
                    var aPanel = document.querySelector('.admin-panel');
                    if (aPanel) {
                        aPanel.classList.remove('admin-panel--show');
                        aPanel.style.display = 'none'; // Force hide
                    }
                    var pPanel = document.querySelector('.post-panel');
                    if (pPanel) {
                        pPanel.classList.remove('post-panel--show');
                        pPanel.style.display = 'none'; // Force hide
                    }
                    var rPanel = document.querySelector('.recent-panel');
                    if (rPanel) {
                        rPanel.classList.remove('recent-panel--show');
                        rPanel.style.display = 'none'; // Force hide
                    }
                } catch (e) {}
            }

            filterPanelOpen = !filterPanelOpen;
            
            // Update aria state
            filterBtn.setAttribute('aria-expanded', filterPanelOpen ? 'true' : 'false');
            
            if (!filterModuleLoaded) {
                // First click - load the module then toggle
                loadFilterModule().then(function() {
                    App.emit('panel:toggle', {
                        panel: 'filter',
                        show: filterPanelOpen
                    });
                }).catch(function(err) {
                    console.error('[Header] Filter load failed:', err);
                    filterPanelOpen = false;
                    filterBtn.setAttribute('aria-expanded', 'false');
                });
            } else {
                // Module already loaded - just toggle
                App.emit('panel:toggle', {
                    panel: 'filter',
                    show: filterPanelOpen
                });
            }
        });

        // Ensure filter state is reset when other panels open
        App.on('member:opened', function() { filterPanelOpen = false; if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false'); });
        App.on('admin:opened', function() { filterPanelOpen = false; if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false'); });
        
        // Listen for filter panel close events
        App.on('filter:closed', function() {
            filterPanelOpen = false;
            if (filterBtn) {
                filterBtn.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Listen for filter active state changes (show orange icon when filters active)
        App.on('filter:activeState', function(data) {
            // Keep this hook for the FilterModule (when loaded), but also allow HeaderModule
            // to compute active state without lazy-loading the filter panel.
            if (data && typeof data.active === 'boolean') {
                setHeaderFilterIconActive(!!data.active);
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

                    // Force immediate removal of classes to prevent stacking in relative flow
                    var fPanel = document.querySelector('.filter-panel');
                    if (fPanel) {
                        fPanel.classList.remove('show');
                        fPanel.style.display = 'none'; // Force hide
                    }
                    var aPanel = document.querySelector('.admin-panel');
                    if (aPanel) {
                        aPanel.classList.remove('admin-panel--show');
                        aPanel.style.display = 'none'; // Force hide
                    }
                    var pPanel = document.querySelector('.post-panel');
                    if (pPanel) {
                        pPanel.classList.remove('post-panel--show');
                        pPanel.style.display = 'none'; // Force hide
                    }
                    var rPanel = document.querySelector('.recent-panel');
                    if (rPanel) {
                        rPanel.classList.remove('recent-panel--show');
                        rPanel.style.display = 'none'; // Force hide
                    }
                } catch (e) {}
            }

            // Always open, never close via header button
            App.emit('panel:toggle', {
                panel: 'member',
                show: true
            });
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

                    // Force immediate removal of classes to prevent stacking in relative flow
                    var fPanel = document.querySelector('.filter-panel');
                    if (fPanel) {
                        fPanel.classList.remove('show');
                        fPanel.style.display = 'none'; // Force hide
                    }
                    var mPanel = document.querySelector('.member-panel');
                    if (mPanel) {
                        mPanel.classList.remove('member-panel--show');
                        mPanel.style.display = 'none'; // Force hide
                    }
                    var pPanel = document.querySelector('.post-panel');
                    if (pPanel) {
                        pPanel.classList.remove('post-panel--show');
                        pPanel.style.display = 'none'; // Force hide
                    }
                    var rPanel = document.querySelector('.recent-panel');
                    if (rPanel) {
                        rPanel.classList.remove('recent-panel--show');
                        rPanel.style.display = 'none'; // Force hide
                    }
                } catch (e) {}
            }

            // Always open, never close via header button
            App.emit('panel:toggle', {
                panel: 'admin',
                show: true
            });
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
        setLogo: setLogo
    };

})();

// Register module with App
App.registerModule('header', HeaderModule);
