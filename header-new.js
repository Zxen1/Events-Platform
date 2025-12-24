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
        // Ensure App.getImageUrl is available before making request
        if (typeof window.App === 'undefined' || typeof window.App.getImageUrl !== 'function') {
            // Retry after a short delay if App not ready
            setTimeout(loadLogoFromSettings, 50);
            return;
        }
        
        fetch('/gateway.php?action=get-admin-settings')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success) {
                    // CRITICAL: Store settings in App state BEFORE calling getImageUrl
                    // This ensures getImageUrl has the folder paths it needs
                    if (data.settings && window.App && typeof window.App.setState === 'function') {
                        // Merge settings into App state (don't overwrite, in case other modules set things)
                        var currentSettings = window.App.getState('settings') || {};
                        var mergedSettings = Object.assign({}, currentSettings, data.settings);
                        window.App.setState('settings', mergedSettings);
                    }
                    
                    // Load logo from system_images
                    if (data.system_images && data.system_images.small_logo) {
                        var logoFilename = data.system_images.small_logo;
                        if (typeof window.App !== 'undefined' && typeof window.App.getImageUrl === 'function') {
                            var logoUrl = window.App.getImageUrl('systemImages', logoFilename);
                            setLogo(logoUrl);
                        }
                    }
                    // Load header icons from system_images
                    if (data.system_images) {
                        loadHeaderIcons(data.system_images);
                    }
                }
            })
            .catch(function(err) {
                console.error('[Header] Failed to load settings:', err);
            });
    }
    
    function loadHeaderIcons(systemImages) {
        // Ensure App.getImageUrl is available
        if (typeof window.App === 'undefined' || typeof window.App.getImageUrl !== 'function') {
            return;
        }
        
        function rememberFallbackSrc(imgEl) {
            if (!imgEl) return;
            if (!imgEl.dataset) return;
            if (!imgEl.dataset.fallbackSrc) {
                // Preserve whatever was in the HTML initially (eg. inline SVG data URI)
                imgEl.dataset.fallbackSrc = imgEl.getAttribute('src') || '';
            }
        }
        
        function setImgSrcIfLoads(imgEl, nextSrc) {
            if (!imgEl || !nextSrc) return;
            rememberFallbackSrc(imgEl);
            
            // If it's already set, skip churn
            if (imgEl.getAttribute('src') === nextSrc) return;
            
            // Preload first; only swap if it loads successfully
            var testImg = new Image();
            testImg.onload = function() {
                imgEl.src = nextSrc;
            };
            testImg.onerror = function() {
                // Keep fallback instead of replacing with a broken image
                if (imgEl.dataset && imgEl.dataset.fallbackSrc) {
                    imgEl.src = imgEl.dataset.fallbackSrc;
                }
            };
            testImg.src = nextSrc;
        }
        
        // Filter icon - use mask-image like admin buttons
        var filterIcon = document.querySelector('.header-filter-button-icon');
        if (filterIcon && systemImages.icon_filter) {
            var iconUrl = window.App.getImageUrl('systemImages', systemImages.icon_filter);
            filterIcon.style.webkitMaskImage = 'url(' + iconUrl + ')';
            filterIcon.style.maskImage = 'url(' + iconUrl + ')';
            filterIcon.style.webkitMaskSize = 'contain';
            filterIcon.style.maskSize = 'contain';
            filterIcon.style.webkitMaskRepeat = 'no-repeat';
            filterIcon.style.maskRepeat = 'no-repeat';
            filterIcon.style.webkitMaskPosition = 'center';
            filterIcon.style.maskPosition = 'center';
            filterIcon.style.backgroundColor = '#ffffff';
        }
        
        // Mode switch icons
        var recentsIcon = document.querySelector('.header-modeswitch-button[data-mode="recents"] .header-modeswitch-button-icon');
        if (recentsIcon && systemImages.icon_recents) {
            setImgSrcIfLoads(recentsIcon, window.App.getImageUrl('systemImages', systemImages.icon_recents));
        }
        
        var postsIcon = document.querySelector('.header-modeswitch-button[data-mode="posts"] .header-modeswitch-button-icon');
        if (postsIcon && systemImages.icon_posts) {
            setImgSrcIfLoads(postsIcon, window.App.getImageUrl('systemImages', systemImages.icon_posts));
        }
        
        var mapIcon = document.querySelector('.header-modeswitch-button[data-mode="map"] .header-modeswitch-button-icon');
        if (mapIcon && systemImages.icon_map) {
            setImgSrcIfLoads(mapIcon, window.App.getImageUrl('systemImages', systemImages.icon_map));
        }
    }
    
    function setLogo(imagePath) {
        var logoImg = document.querySelector('.header-logo-button-image');
        if (logoImg && imagePath) {
            logoImg.onload = function() { logoImg.classList.add('loaded'); };
            logoImg.src = imagePath;
            if (logoImg.complete) logoImg.classList.add('loaded');
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
        filterBtn = document.querySelector('.header-filter-button');
        if (!filterBtn) return;
        
        filterBtn.addEventListener('click', function() {
            filterPanelOpen = !filterPanelOpen;
            
            // Update aria state
            filterBtn.setAttribute('aria-expanded', filterPanelOpen ? 'true' : 'false');
            
            // Emit event to filter module
            App.emit('panel:toggle', {
                panel: 'filter',
                show: filterPanelOpen
            });
        });
        
        // Listen for filter state changes to update counter
        App.on('filter:changed', updateFilterCounter);
        
        // Listen for filter panel close events
        App.on('filter:closed', function() {
            filterPanelOpen = false;
            if (filterBtn) {
                filterBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    
    function updateFilterCounter(filterState) {
        if (!filterBtn) return;
        
        // Count active filters
        var count = 0;
        
        if (filterState.keywords) count++;
        if (filterState.priceMin !== null || filterState.priceMax !== null) count++;
        if (filterState.dateStart || filterState.dateEnd) count++;
        if (filterState.showExpired) count++;
        if (filterState.favouritesOnly) count++;
        
        // Count disabled categories
        if (filterState.categories) {
            Object.keys(filterState.categories).forEach(function(catName) {
                if (!filterState.categories[catName].enabled) count++;
                Object.keys(filterState.categories[catName].subs).forEach(function(subName) {
                    if (!filterState.categories[catName].subs[subName]) count++;
                });
            });
        }
        
        // Update or create counter badge
        var counter = filterBtn.querySelector('.header-filter-button-counter');
        
        if (count > 0) {
            if (!counter) {
                counter = document.createElement('span');
                counter.className = 'header-filter-button-counter';
                filterBtn.appendChild(counter);
            }
            counter.textContent = count;
            filterBtn.classList.add('header-filter-button--active');
        } else {
            if (counter) counter.remove();
            filterBtn.classList.remove('header-filter-button--active');
        }
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
                memberBtn.classList.remove('header-access-button--active');
            }
        });
        
        App.on('member:opened', function() {
            if (memberBtn) {
                memberBtn.setAttribute('aria-expanded', 'true');
                memberBtn.classList.add('header-access-button--active');
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
            }
        });
        
        App.on('admin:opened', function() {
            if (adminBtn) {
                adminBtn.setAttribute('aria-expanded', 'true');
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
                try {
                    var result = req.call(docEl);
                    if (result && typeof result.catch === 'function') result.catch(function() {});
                } catch (err) {
                    updateFullscreenState();
                }
            }
        } else {
            var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) {
                try {
                    var result = exit.call(document);
                    if (result && typeof result.catch === 'function') result.catch(function() {});
                } catch (err) {
                    updateFullscreenState();
                }
            }
        }
    }
    
    function updateFullscreenState() {
        if (!fullscreenBtn) return;
        
        var isFull = getFullscreenElement();
        fullscreenBtn.setAttribute('aria-pressed', isFull ? 'true' : 'false');
        fullscreenBtn.classList.toggle('is-fullscreen', !!isFull);
    }


    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        updateFilterCounter: updateFilterCounter,
        setLogo: setLogo
    };

})();

// Register module with App
App.registerModule('header', HeaderModule);
