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
        modeSwitchButtons = document.querySelectorAll('.header-modeswitch-button');
        if (!modeSwitchButtons.length) return;
        
        modeSwitchButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = btn.dataset.mode;
                if (!mode || mode === currentMode) return;
                
                // Change mode immediately - no waiting
                setMode(mode);
                
                // Close any open panels in parallel (non-blocking)
                try {
                    var filterPanel = document.querySelector('.filter-panel');
                    if (filterPanel && filterPanel.classList.contains('show')) {
                        var filterClose = document.querySelector('.filter-panel-actions-icon-btn--close');
                        if (filterClose) filterClose.click();
                    }
                    
                    var memberPanel = document.querySelector('.member-panel');
                    if (memberPanel && memberPanel.classList.contains('member-panel--show')) {
                        var memberClose = document.querySelector('.member-panel-actions-icon-btn--close');
                        if (memberClose) memberClose.click();
                    }
                    
                    var adminPanel = document.querySelector('.admin-panel');
                    if (adminPanel && adminPanel.classList.contains('admin-panel--show')) {
                        var adminClose = document.querySelector('.admin-panel-actions-icon-btn--close');
                        if (adminClose) adminClose.click();
                    }
                } catch (e) {
                    // ignore
                }
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
        filterBtn = document.querySelector('.header-filter-button');
        if (!filterBtn) return;
        
        filterBtn.addEventListener('click', function() {
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
        
        // Listen for filter panel close events
        App.on('filter:closed', function() {
            filterPanelOpen = false;
            if (filterBtn) {
                filterBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    /* --------------------------------------------------------------------------
       MEMBER BUTTON
       -------------------------------------------------------------------------- */
    
    function initMemberButton() {
        memberBtn = document.querySelector('.header-access-button[data-panel="member"]');
        if (!memberBtn) return;
        
        // Click only opens panel (like live site) - close via panel's close button
        memberBtn.addEventListener('click', function() {
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
        adminBtn = document.querySelector('.header-access-button[data-panel="admin"]');
        if (!adminBtn) return;
        
        // Click only opens panel (like live site) - close via panel's close button
        adminBtn.addEventListener('click', function() {
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
        fullscreenBtn = document.querySelector('.header-access-button[data-action="fullscreen"]');
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
