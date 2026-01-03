/* ============================================================================
   MEMBER.JS - MEMBER SECTION
   ============================================================================
   
   Controls the member panel (right side).
   
   CONTAINS:
   - Tab buttons (Profile, Create Post, My Posts)
   - Profile tab (logged out):
     - Login subtab (email, password, login button)
     - Register subtab (name, email, password, confirm, avatar, create button)
   - Profile tab (logged in):
     - Avatar display
     - Name/email display
     - Log out button
   - Create Post tab:
     - Form picker (category/subcategory selection)
     - Dynamic form (uses components fieldsets)
     - Checkout options
     - Terms agreement
     - Submit button
   - My Posts tab:
     - User's posts list (not yet coded)
   
   DEPENDENCIES:
   - index-new.js (backbone - App object)
   - components-new.js (fieldsets for create post form)
   
   COMMUNICATES WITH:
   - header-new.js (member button state, avatar display)
   - post-new.js (created posts appear in posts)
   
   ============================================================================ */

const MemberModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       CONSTANTS
       -------------------------------------------------------------------------- */
    
    var CURRENT_KEY = 'member-auth-current';
    
    /* --------------------------------------------------------------------------
       ICONS
       No hard-coded SVG icons allowed in new site.
       -------------------------------------------------------------------------- */
    
    var icons = {
        plus: '+',
        minus: '−'
    };

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var currentUser = null;

    // DOM references
    var panel = null;
    var panelContent = null;
    var closeBtn = null;
    var tabButtons = null;
    var tabPanels = null;
    var myPostsPanel = null;
    
    // Auth elements
    var authForm = null;
    var authTabs = null;
    var loginTab = null;
    var registerTab = null;
    var loginPanel = null;
    var registerPanel = null;
    var profilePanel = null;
    var loginInputs = [];
    var registerInputs = [];
    var supporterMessageEl = null;
    var supporterJoinFieldsEl = null;
    var supporterPresetButtons = [];
    var supporterCustomAmountInput = null;
    var supporterAmountHiddenInput = null;
    var supporterCountryMenuContainer = null;
    var supporterCountryHiddenInput = null;
    var supporterCountryMenuInstance = null;
    var registerFieldsetsContainer = null;
    var profileFieldsetsContainer = null;
    var registerUsernameInput = null;
    var registerEmailInput = null;
    var registerPasswordInput = null;
    var registerConfirmInput = null;
    var profileTabPanel = null;
    var memberPanelBody = null;
    var profileAvatar = null;
    var profileName = null;
    var profileEmail = null;
    var logoutBtn = null;
    var profileTabBtn = null;
    var headerSaveBtn = null;
    var headerDiscardBtn = null;

    // Cache auth forms to hide them when logged in (removes large gap)
    var loginFormEl = null;
    var registerFormEl = null;
    
    // Preferences pickers (Profile tab) - removed (no language/currency filters)
    
    // Profile edit (inputs are created from fieldsets at runtime)
    var profileEditNameInput = null;
    var profileEditPasswordInput = null;
    var profileEditConfirmInput = null;
    // Legacy inline save button (removed from HTML). Keep var to avoid strict-mode ReferenceError.
    var profileSaveBtn = null;
    var profileEditForm = null;
    var profileOriginalName = '';
    
    // Profile drawer (accordion)
    var profileDrawer = null;
    var profileDrawerHeader = null;
    var profileDrawerArrow = null;
    var profileDrawerBody = null;
    
    // Profile more menu (3-dot button)
    var profileMoreBtn = null;
    var profileMoreMenu = null;
    var profileHideSwitch = null;
    var profileDeleteBtn = null;
    var profileOriginalAvatarUrl = '';
    var pendingAvatarUrl = '';
    var pendingRegisterAvatarBlob = null;
    var pendingProfileAvatarBlob = null;

    // Avatar (register + profile) - reusable component instances
    var avatarGridRegister = null; // host element (div)
    var avatarGridProfile = null;  // host element (div)
    var avatarPickerRegister = null;
    var avatarPickerProfile = null;

    // Staged selection values used by register/profile save flows
    var pendingRegisterSiteUrl = '';
    var pendingProfileSiteUrl = '';
    var pendingRegisterAvatarPreviewUrl = ''; // objectURL for showing staged crop in UI
    var pendingProfileAvatarPreviewUrl = '';  // objectURL for showing staged crop in UI
    var siteAvatarFilesPromise = null;
    var siteAvatarFolder = '';
    var siteAvatarFilenames = [];  // all filenames in site avatars folder
    var siteAvatarChoices = [];    // 3 picked: [{ filename, url }]

    // Create Post inline auth gate (under the Create Post form)
    // IMPORTANT: must be mounted/unmounted on demand (should not exist in DOM when logged in).
    var createAuthWrapper = null;
    var createAuthLoginTab = null;
    var createAuthRegisterTab = null;
    var createAuthLoginPanel = null;
    var createAuthRegisterPanel = null;
    var createAuthLoginForm = null;
    var createAuthRegisterForm = null;
    var createAuthLoginEmailInput = null;
    var createAuthLoginPasswordInput = null;
    var createAuthLoginSubmitBtn = null;
    var createAuthRegisterSubmitBtn = null;
    var createAuthRegisterFieldsets = null;
    var avatarGridCreate = null;
    var avatarPickerCreate = null;
    var createCountryMenuContainer = null;
    var createCountryHiddenInput = null;
    var createAuthRegisterRendered = false;
    var createAuthRegisterUsernameInput = null;
    var createAuthRegisterEmailInput = null;
    var createAuthRegisterPasswordInput = null;
    var createAuthRegisterConfirmInput = null;
    var pendingCreateAuthAvatarBlob = null;
    var pendingCreateAuthSiteUrl = '';
    var pendingCreateAuthAvatarPreviewUrl = '';
    var createAuthPendingSubmit = false;
    var createAuthPendingSubmitIsAdminFree = false;

    // Unsaved prompt uses ThreeButtonDialogComponent (components-new.js)
    
    // Create post elements
    var submitBtn = null;
    var adminSubmitBtn = null;
    var termsAgreed = false;
    
    // Terms modal elements
    var termsModalContainer = null;

    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        cacheElements();
        if (!panel) {
            console.warn('[Member] Member panel not found');
            return;
        }
        
        bindEvents();
        initHeaderDrag();
        loadStoredSession();
        render();
    }
    
    function initHeaderDrag() {
        var headerEl = panel.querySelector('.member-panel-header');
        if (!headerEl || !panelContent) return;
        
        // Drag via header
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            
            var rect = panelContent.getBoundingClientRect();
            var startX = e.clientX;
            var startLeft = rect.left;
            
            function onMove(ev) {
                var dx = ev.clientX - startX;
                var newLeft = startLeft + dx;
                var maxLeft = window.innerWidth - rect.width;
                if (newLeft < 0) newLeft = 0;
                if (newLeft > maxLeft) newLeft = maxLeft;
                panelContent.style.left = newLeft + 'px';
                panelContent.style.right = 'auto';
            }
            
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function cacheElements() {
        panel = document.querySelector('.member-panel');
        if (!panel) return;
        
        panelContent = panel.querySelector('.member-panel-content');
        memberPanelBody = panel.querySelector('.member-panel-body');
        closeBtn = panel.querySelector('.member-panel-actions-icon-btn--close');
        tabButtons = panel.querySelectorAll('.member-tab-bar-button');
        tabPanels = panel.querySelectorAll('.member-tab-panel');
        myPostsPanel = document.getElementById('member-tab-myposts');
        
        // Auth elements (Profile tab only). NOTE: Create Post also contains a .member-auth (inline gate),
        // so scope this to the profile tab to avoid ambiguous selectors.
        authForm = document.querySelector('#member-tab-profile .member-auth');
        loginFormEl = document.getElementById('memberAuthFormLogin');
        registerFormEl = document.getElementById('memberAuthFormRegister');
        authTabs = authForm ? authForm.querySelector('.member-auth-tabs') : null;
        loginTab = authForm ? authForm.querySelector('.member-auth-tab[data-target="login"]') : null;
        registerTab = authForm ? authForm.querySelector('.member-auth-tab[data-target="register"]') : null;
        loginPanel = document.getElementById('member-auth-login');
        registerPanel = document.getElementById('member-auth-register');
        profilePanel = document.getElementById('member-auth-profile');
        
        if (loginPanel) {
            loginInputs = Array.from(loginPanel.querySelectorAll('input'));
        }
        if (registerPanel) {
            registerInputs = Array.from(registerPanel.querySelectorAll('input'));
        }

        // Supporter UI (register tab)
        supporterMessageEl = document.getElementById('member-supporter-message');
        supporterJoinFieldsEl = document.getElementById('member-supporter-join-fields');
        registerFieldsetsContainer = document.getElementById('member-register-fieldsets');
        supporterCustomAmountInput = document.getElementById('member-supporter-payment-custom');
        supporterAmountHiddenInput = document.getElementById('member-supporter-payment-amount');
        supporterPresetButtons = Array.from(panel.querySelectorAll('.member-supporterpayment-button'));
        supporterCountryMenuContainer = document.getElementById('member-supporter-country-menu');
        supporterCountryHiddenInput = document.getElementById('member-supporter-country');
        
        profileAvatar = document.getElementById('member-profile-avatar');
        profileName = document.getElementById('member-profile-name');
        profileEmail = document.getElementById('member-profile-email');
        logoutBtn = document.getElementById('member-logout-btn');
        profileTabBtn = document.getElementById('member-tab-profile-btn');
        profileTabPanel = document.getElementById('member-tab-profile');

        headerSaveBtn = panel.querySelector('#member-panel-save-btn');
        headerDiscardBtn = panel.querySelector('#member-panel-discard-btn');
        
        profileFieldsetsContainer = document.getElementById('member-profile-fieldsets');
        profileEditNameInput = null;
        profileEditPasswordInput = null;
        profileEditConfirmInput = null;
        profileEditForm = document.getElementById('memberProfileEditForm');
        profileSaveBtn = document.getElementById('member-profile-save-btn'); // legacy (removed in HTML; may be null)
        
        // Profile drawer (accordion)
        profileDrawer = document.getElementById('member-profile-drawer');
        profileDrawerHeader = document.getElementById('member-profile-drawer-header');
        profileDrawerArrow = profileDrawer ? profileDrawer.querySelector('.member-profile-drawer-arrow') : null;
        profileDrawerBody = profileDrawer ? profileDrawer.querySelector('.member-profile-drawer-body') : null;
        
        // Profile more menu
        profileMoreBtn = document.getElementById('member-profile-more-btn');
        profileMoreMenu = document.getElementById('member-profile-more-menu');
        profileHideSwitch = document.getElementById('member-profile-hide-switch');
        profileDeleteBtn = document.getElementById('member-profile-delete-btn');

        // Avatar UI
        avatarGridRegister = document.getElementById('member-avatar-grid-register');
        avatarGridProfile = document.getElementById('member-avatar-grid-profile');

        // Create Post inline auth gate is mounted on demand (not in HTML).
        createAuthWrapper = null;
        createAuthLoginTab = null;
        createAuthRegisterTab = null;
        createAuthLoginPanel = null;
        createAuthRegisterPanel = null;
        createAuthLoginForm = null;
        createAuthRegisterForm = null;
        createAuthLoginEmailInput = null;
        createAuthLoginPasswordInput = null;
        createAuthLoginSubmitBtn = null;
        createAuthRegisterSubmitBtn = null;
        createAuthRegisterFieldsets = null;
        avatarGridCreate = null;
        createCountryMenuContainer = null;
        createCountryHiddenInput = null;

        // Note: Avatar cropper is now handled by AvatarCropperComponent (components-new.js)
        // Note: we do NOT wire #member-unsaved-prompt directly; dialogs are controlled from components.
    }

    function forceOffMemberButtonAnchors() {
        try {
            if (!memberPanelBody) return;
            if (window.BottomSlack && typeof BottomSlack.attach === 'function') {
                try { BottomSlack.attach(memberPanelBody, {}).forceOff(); } catch (e0) {}
            }
            if (window.TopSlack && typeof TopSlack.attach === 'function') {
                try { TopSlack.attach(memberPanelBody, {}).forceOff(); } catch (e1) {}
            }
        } catch (e) {
            // ignore
        }
    }

    // NOTE: Temporary bottom spacer workaround removed (per Paul request). Keep code clean.

    function bindEvents() {
        // Bring to front when panel is clicked
        if (panel) {
            panel.addEventListener('mousedown', function() {
                App.bringToTop(panel);
            });
        }
        
        // Panel open/close
        if (closeBtn) {
            closeBtn.addEventListener('click', closePanel);
        }

        // Header save/discard (like admin)
        if (headerSaveBtn) {
            headerSaveBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleHeaderSave();
            });
        }
        if (headerDiscardBtn) {
            headerDiscardBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleHeaderDiscard();
            });
        }
        
        // Main tab switching (Profile / Create Post / My Posts)
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    requestTabSwitch(btn.dataset.tab);
                });
            });
        }
        
        // Auth subtab switching (Login / Register)
        if (loginTab) {
            loginTab.addEventListener('click', function() {
                setAuthPanel('login');
            });
        }
        if (registerTab) {
            registerTab.addEventListener('click', function() {
                setAuthPanel('register');
            });
        }

        if (supporterPresetButtons && supporterPresetButtons.length) {
            supporterPresetButtons.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    var amount = btn.getAttribute('data-amount') || '';
                    setSupporterAmount(amount);
                });
            });
        }
        if (supporterCustomAmountInput) {
            function lockSupporterCurrencyCaret() {
                try {
                    var code = getSiteCurrencyCode();
                    if (!code) return;
                    var prefix = code + ' ';
                    var v = String(supporterCustomAmountInput.value || '');
                    if (v.indexOf(prefix) !== 0) return;
                    var min = prefix.length;
                    var s = supporterCustomAmountInput.selectionStart;
                    var e = supporterCustomAmountInput.selectionEnd;
                    if (typeof s !== 'number' || typeof e !== 'number') return;
                    if (s < min || e < min) {
                        var ns = Math.max(min, s);
                        var ne = Math.max(min, e);
                        supporterCustomAmountInput.setSelectionRange(ns, ne);
                    }
                } catch (e) {
                    // ignore
                }
            }

            supporterCustomAmountInput.addEventListener('keydown', function(e) {
                try {
                    var code = getSiteCurrencyCode();
                    if (!code) return;
                    var prefix = code + ' ';
                    var v = String(supporterCustomAmountInput.value || '');
                    if (v.indexOf(prefix) !== 0) return;
                    var min = prefix.length;
                    var s = supporterCustomAmountInput.selectionStart;
                    var end = supporterCustomAmountInput.selectionEnd;
                    if (typeof s !== 'number' || typeof end !== 'number') return;

                    if (e.key === 'Backspace') {
                        // Don't let backspace delete into the prefix.
                        if (s <= min && end <= min) {
                            e.preventDefault();
                            supporterCustomAmountInput.setSelectionRange(min, min);
                        }
                        return;
                    }
                    if (e.key === 'ArrowLeft') {
                        if (s <= min) {
                            e.preventDefault();
                            supporterCustomAmountInput.setSelectionRange(min, min);
                        }
                        return;
                    }
                    if (e.key === 'Home') {
                        e.preventDefault();
                        supporterCustomAmountInput.setSelectionRange(min, min);
                        return;
                    }
                } catch (err) {
                    // ignore
                }
            });

            supporterCustomAmountInput.addEventListener('focus', lockSupporterCurrencyCaret);
            supporterCustomAmountInput.addEventListener('click', lockSupporterCurrencyCaret);
            supporterCustomAmountInput.addEventListener('mouseup', lockSupporterCurrencyCaret);
            supporterCustomAmountInput.addEventListener('select', lockSupporterCurrencyCaret);

            supporterCustomAmountInput.addEventListener('input', function() {
                var code = getSiteCurrencyCode();
                var raw = String(supporterCustomAmountInput.value || '');

                // If the currency prefix is present, strip it for numeric processing.
                if (code) {
                    var prefix = code + ' ';
                    if (raw.indexOf(prefix) === 0) {
                        raw = raw.slice(prefix.length);
                    }
                }

                // Keep only numbers + decimal point (no formatting/libraries)
                raw = raw.replace(/[^0-9.]/g, '');
                // Allow only first decimal point
                var parts = raw.split('.');
                if (parts.length > 2) {
                    raw = parts[0] + '.' + parts.slice(1).join('');
                }

                // Show currency in the visible input (button-like layout).
                var displayValue = code ? (code + ' ' + raw) : raw;
                if (displayValue !== supporterCustomAmountInput.value) {
                    supporterCustomAmountInput.value = displayValue;
                    try {
                        // Keep caret on the digits, never inside the currency prefix.
                        var prefixLen = code ? (String(code).length + 1) : 0;
                        var caret = prefixLen + raw.length;
                        supporterCustomAmountInput.setSelectionRange(caret, caret);
                    } catch (e) {
                        // ignore
                    }
                }

                // Allow under-min values while typing; clamp happens on blur/finalize.
                setSupporterAmount(raw, { fromCustom: true, allowUnderMin: true });
            });
            supporterCustomAmountInput.addEventListener('blur', function() {
                var code = getSiteCurrencyCode();
                var raw = String(supporterCustomAmountInput.value || '').trim();
                if (code) {
                    var prefix = code + ' ';
                    if (raw.indexOf(prefix) === 0) {
                        raw = raw.slice(prefix.length);
                    }
                }
                raw = raw.replace(/[^0-9.]/g, '');
                setSupporterAmount(raw, { fromCustom: true });
            });
        }
        
        // Form submit handlers (for Enter key support)
        var loginForm = document.getElementById('memberAuthFormLogin');
        var registerForm = document.getElementById('memberAuthFormRegister');
        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleLogin();
            });
        }
        if (registerForm) {
            registerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleRegister();
            });
        }

        // Create Post inline auth gate is mounted on demand (after the create form is shown),
        // so its events are attached inside ensureCreateAuthGateMounted().
        
        // Login button click
        var loginBtn = panel.querySelector('.member-auth-submit[data-action="login"]');
        if (loginBtn) {
            loginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleLogin();
            });
        }
        
        // Register button click
        var registerBtn = panel.querySelector('.member-auth-submit[data-action="register"]');
        if (registerBtn) {
            registerBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleRegister();
            });
        }
        
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                requestLogout();
            });
        }
        
        // Inline save removed; profile save is via header buttons
        // Profile edit inputs are rendered from DB fieldsets at runtime; listeners are attached after renderProfileFieldsets().
        if (profileEditForm) {
            profileEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleHeaderSave();
            });
        }
        
        // Profile drawer toggle (accordion)
        if (profileDrawerHeader) {
            profileDrawerHeader.addEventListener('click', function() {
                toggleProfileDrawer();
            });
        }
        
        // Profile more menu (3-dot button)
        if (profileMoreBtn && profileMoreMenu) {
            profileMoreBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var isOpen = !profileMoreMenu.hidden;
                closeAllProfileMenus();
                if (!isOpen) {
                    profileMoreMenu.hidden = false;
                    profileMoreBtn.setAttribute('aria-expanded', 'true');
                }
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', function(e) {
                if (profileMoreMenu && !profileMoreMenu.hidden) {
                    if (!profileMoreBtn.contains(e.target) && !profileMoreMenu.contains(e.target)) {
                        closeAllProfileMenus();
                    }
                }
            });
        }
        
        // Hide Account switch
        if (profileHideSwitch) {
            profileHideSwitch.addEventListener('click', function() {
                var isHidden = profileHideSwitch.getAttribute('aria-checked') === 'true';
                profileHideSwitch.setAttribute('aria-checked', !isHidden ? 'true' : 'false');
                // Save to database
                if (currentUser && currentUser.id) {
                    saveProfileHiddenState(!isHidden);
                }
            });
            profileHideSwitch.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    profileHideSwitch.click();
                }
            });
        }
        
        // Delete Account button
        if (profileDeleteBtn) {
            profileDeleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeAllProfileMenus();
                confirmDeleteAccount();
            });
        }

        // Note: Avatar picker/cropper UI is handled by AvatarPickerComponent + AvatarCropperComponent (components-new.js)
        // Note: unsaved changes dialogs are controlled from components.
        
        // Map Lighting buttons
        initMapLightingButtons();
        
        // Map Style buttons
        initMapStyleButtons();
        
        // Panel toggle is handled by lazy init wrapper outside module
    }
    
    function initMapLightingButtons() {
        var lightingButtons = panel.querySelectorAll('.member-lighting-button');
        if (!lightingButtons.length) return;
        
        // Apply lighting icons from system_images (admin_settings keys)
        (function applyLightingIcons() {
            try {
                if (!window.App || typeof App.getImageUrl !== 'function' || typeof App.getState !== 'function') return;
                var sys = App.getState('system_images') || {};
                lightingButtons.forEach(function(btn) {
                    var preset = btn.dataset.lighting || '';
                    var key = preset ? ('icon_lighting_' + preset) : '';
                    var filename = key && sys[key] ? sys[key] : '';
                    var iconEl = btn.querySelector('.member-lighting-button-icon');
                    if (iconEl && filename) {
                        var url = App.getImageUrl('systemImages', filename);
                        iconEl.style.webkitMaskImage = 'url(' + url + ')';
                        iconEl.style.maskImage = 'url(' + url + ')';
                    }
                });
            } catch (e) {
                // ignore
            }
        })();
        
        // Load from member data (logged in) or localStorage (guest) or admin settings (fresh visitor)
        var currentLighting = 'day';
        if (currentUser) {
            currentLighting = currentUser.map_lighting || 'day';
        } else {
            // For guests: check localStorage first, then admin settings, then default
            var storedLighting = localStorage.getItem('map_lighting');
            if (storedLighting) {
                currentLighting = storedLighting;
            } else if (window.App && typeof App.getState === 'function') {
                var settings = App.getState('settings') || {};
                currentLighting = settings.map_lighting || 'day';
            }
        }
        
        lightingButtons.forEach(function(btn) {
            var lighting = btn.dataset.lighting;
            var isActive = lighting === currentLighting;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.classList.toggle('member-lighting-button--active', isActive);
            
            btn.addEventListener('click', function() {
                if (btn.getAttribute('aria-pressed') === 'true') return;
                
                lightingButtons.forEach(function(b) {
                    b.setAttribute('aria-pressed', 'false');
                    b.classList.remove('member-lighting-button--active');
                });
                btn.setAttribute('aria-pressed', 'true');
                btn.classList.add('member-lighting-button--active');
                
                // Update map
                if (window.MapModule && window.MapModule.setMapLighting) {
                    window.MapModule.setMapLighting(lighting);
                }
                
                // Save to localStorage (guests) or database (members)
                if (currentUser) {
                    saveMemberSetting('map_lighting', lighting);
                } else {
                    localStorage.setItem('map_lighting', lighting);
                }
            });
        });
    }
    
    function initMapStyleButtons() {
        var styleButtons = panel.querySelectorAll('.member-style-button');
        if (!styleButtons.length) return;
        
        // Load from member data (logged in) or localStorage (guest) or admin settings (fresh visitor)
        var currentStyle = 'standard';
        if (currentUser) {
            currentStyle = currentUser.map_style || 'standard';
        } else {
            // For guests: check localStorage first, then admin settings, then default
            var storedStyle = localStorage.getItem('map_style');
            if (storedStyle) {
                currentStyle = storedStyle;
            } else if (window.App && typeof App.getState === 'function') {
                var settings = App.getState('settings') || {};
                currentStyle = settings.map_style || 'standard';
            }
        }
        
        styleButtons.forEach(function(btn) {
            var style = btn.dataset.style;
            var isActive = style === currentStyle;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.classList.toggle('member-style-button--active', isActive);
            
            btn.addEventListener('click', function() {
                if (btn.getAttribute('aria-pressed') === 'true') return;
                
                styleButtons.forEach(function(b) {
                    b.setAttribute('aria-pressed', 'false');
                    b.classList.remove('member-style-button--active');
                });
                btn.setAttribute('aria-pressed', 'true');
                btn.classList.add('member-style-button--active');
                
                // Update map
                if (window.MapModule && window.MapModule.setMapStyle) {
                    window.MapModule.setMapStyle(style);
                }
                
                // Save to localStorage (guests) or database (members)
                if (currentUser) {
                    saveMemberSetting('map_style', style);
                } else {
                    localStorage.setItem('map_style', style);
                }
            });
        });
    }
    
    function saveMemberSetting(key, value) {
        if (!currentUser) return;
        
        // Guard: Only save if we have a valid member id (positive integer) and account_email
        // (prevents 400 errors from stale localStorage sessions without id, or id=0)
        var memberId = parseInt(currentUser.id, 10);
        if (!memberId || memberId <= 0 || !currentUser.account_email) {
            console.warn('[Member] Cannot save setting - missing or invalid id/account_email in session');
            return;
        }
        
        // Save to database via API
        fetch('/gateway.php?action=' + getEditUserAction(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                account_email: currentUser.account_email,
                [key]: value
            })
        }).then(function(response) {
            if (!response.ok) {
                console.warn('[Member] Failed to save setting:', key, '- server returned', response.status);
            }
        }).catch(function(err) {
            console.error('[Member] Failed to save setting:', err);
        });
        
        // Update local state
        if (currentUser) {
            currentUser[key] = value;
        }
    }

    function syncLocalProfilePrefsFromUser(user) {
        try {
            if (!user) return;
            if (user.country_code) localStorage.setItem('member_country_code', String(user.country_code));
            if (user.timezone) localStorage.setItem('member_timezone', String(user.timezone));
        } catch (e) {
            // ignore
        }
    }

    function getDefaultCurrencyForForms() {
        // Default currency for all forms comes from admin settings (website_currency), not profile pickers.
        if (siteCurrency && typeof siteCurrency === 'string' && siteCurrency.trim()) return siteCurrency.trim();
        try {
            if (!window.App || typeof App.getState !== 'function') return null;
            var settings = App.getState('settings') || {};
            var code = settings.website_currency || settings.site_currency || settings.siteCurrency || null;
            if (!code) return null;
            code = String(code).trim();
            return code ? code : null;
        } catch (e) {
            return null;
        }
    }

    function setAvatarForTarget(target, url) {
        target = target === 'register' ? 'register' : 'profile';
        url = url || '';

        if (target === 'register') {
            // Registration stores avatar via final upload on submit (no immediate upload here)
            pendingRegisterSiteUrl = '';
            pendingRegisterAvatarBlob = null;
            pendingRegisterAvatarPreviewUrl = resolveAvatarSrc(url) || '';
            if (avatarPickerRegister && typeof avatarPickerRegister.setSelfValue === 'function') {
                if (typeof avatarPickerRegister.setSelfBlob === 'function') {
                    avatarPickerRegister.setSelfBlob(null);
                }
                avatarPickerRegister.setSelfValue(url);
                avatarPickerRegister.setSelectedKey('self');
            } else {
                renderAvatarPickers();
            }
            return;
        }

        // profile
        // Bump cache bust if this is a real avatar filename overwrite (same filename, new bytes)
        if (currentUser && currentUser.id && /^\d+-avatar\./.test(String(url || ''))) {
            bumpAvatarCacheBust(currentUser.id);
        }

        pendingAvatarUrl = url;
        // Also update the main avatar + header immediately for feedback (even before saving)
        if (profileAvatar) {
            setImgOrHide(profileAvatar, resolveAvatarSrc(url) || getAvatarSource(currentUser));
        }
        if (currentUser) {
            currentUser.avatar = url; // filename (or URL) staged; persists only after save
            updateHeaderAvatar(currentUser);
        }
        pendingProfileAvatarBlob = null;
        pendingProfileSiteUrl = '';
        pendingProfileAvatarPreviewUrl = '';
        if (avatarPickerProfile && typeof avatarPickerProfile.setSelfValue === 'function') {
            if (typeof avatarPickerProfile.setSelfBlob === 'function') {
                avatarPickerProfile.setSelfBlob(null);
            }
            avatarPickerProfile.setSelfValue(url);
            avatarPickerProfile.setSelectedKey('self');
        } else {
            renderAvatarPickers();
        }
        updateHeaderSaveDiscardState();
    }

    // Avatar values are stored as filenames (preferred) or occasionally absolute URLs (legacy).
    // Resolve to a usable src based on folder settings:
    // - user uploads: {id}-avatar.ext -> folder_avatars
    // - library picks: any other filename -> folder_site_avatars
    function getAvatarCacheBustKey(userId) {
        return 'avatar_cache_bust_' + String(userId || '');
    }

    function getAvatarCacheBust(userId) {
        try {
            if (!userId) return '';
            return String(localStorage.getItem(getAvatarCacheBustKey(userId)) || '');
        } catch (e) {
            return '';
        }
    }

    function bumpAvatarCacheBust(userId) {
        try {
            if (!userId) return;
            localStorage.setItem(getAvatarCacheBustKey(userId), String(Date.now()));
        } catch (e) {}
    }

    function appendCacheBust(url, bust) {
        if (!url || !bust) return url || '';
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(String(bust));
    }

    function resolveAvatarSrc(value) {
        var v = (value || '').trim();
        if (!v) return '';
        if (v.indexOf('data:') === 0) return v;
        if (v.indexOf('http://') === 0 || v.indexOf('https://') === 0) return v;
        if (v.indexOf('/') === 0) return v;
        // Filename-only
        if (window.App && typeof App.getImageUrl === 'function') {
            if (/^\d+-avatar\./.test(v)) {
                var url = App.getImageUrl('avatars', v);
                var bust = currentUser && currentUser.id ? getAvatarCacheBust(currentUser.id) : '';
                return appendCacheBust(url, bust);
            }
            return App.getImageUrl('siteAvatars', v);
        }
        return v;
    }

    function ensureSiteAvatarFilenames() {
        if (siteAvatarFilesPromise) return siteAvatarFilesPromise;
        siteAvatarFilesPromise = fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                var folder = (res && res.settings && res.settings.folder_site_avatars) ? String(res.settings.folder_site_avatars) : '';
                if (folder && !folder.endsWith('/')) folder += '/';
                siteAvatarFolder = folder;
                
                // If no folder configured, skip the list-files call
                if (!folder || folder === '/') {
                    console.warn('[Member] No site avatar folder configured');
                    return [];
                }
                
                return fetch('/gateway.php?action=list-files&folder=' + encodeURIComponent(folder))
                    .then(function(r) {
                        // Handle HTTP errors gracefully
                        if (!r.ok) {
                            console.warn('[Member] list-files returned HTTP', r.status);
                            return { success: false, icons: [] };
                        }
                        return r.json();
                    })
                    .then(function(list) {
                        // list-files returns `icons` array for historical reasons
                        if (!list || list.success !== true || !Array.isArray(list.icons)) return [];
                        return list.icons.filter(function(fn) { return typeof fn === 'string' && fn.trim() !== ''; });
                    })
                    .catch(function(listErr) {
                        console.warn('[Member] Failed to fetch site avatar list', listErr);
                        return [];
                    });
            })
            .then(function(filenames) {
                siteAvatarFilenames = Array.isArray(filenames) ? filenames.slice() : [];
                return siteAvatarFilenames;
            })
            .catch(function(err) {
                console.warn('[Member] Failed to load site avatar filenames', err);
                siteAvatarFilenames = [];
                return [];
            });
        return siteAvatarFilesPromise;
    }

    function pickRandomSiteAvatarChoices(count) {
        count = count || 3;
        var arr = Array.isArray(siteAvatarFilenames) ? siteAvatarFilenames.slice() : [];
        // Fisher-Yates shuffle (partial)
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        var picked = arr.slice(0, Math.min(count, arr.length));
        siteAvatarChoices = picked.map(function(fn) {
            return { filename: fn, url: (siteAvatarFolder || '') + fn };
        });
    }

    function ensureAvatarChoicesReady() {
        return ensureSiteAvatarFilenames().then(function() {
            // We always show a 4-tile grid:
            // - Register: self(add/upload) + 3 site avatars
            // - Profile:  self + (optional upload tile) + 2 or 3 site avatars
            pickRandomSiteAvatarChoices(3);

            // Default: if register has no staged avatar yet, select first site avatar.
            if (!pendingRegisterAvatarBlob && !pendingRegisterSiteUrl) {
                if (Array.isArray(siteAvatarChoices) && siteAvatarChoices[0] && siteAvatarChoices[0].url) {
                    pendingRegisterSiteUrl = String(siteAvatarChoices[0].url);
                }
            }

            renderAvatarPickers();
        });
    }
    function renderAvatarPickers() {
        if (!window.AvatarPickerComponent || typeof AvatarPickerComponent.attach !== 'function') {
            console.error('[Member] AvatarPickerComponent not available');
            return;
        }

        // AvatarPickerComponent enforces the 4-tile rule itself:
        // - No self avatar yet: [upload/self] + 3 site avatars
        // - Has self avatar: [self] + [upload] + 2 site avatars
        if (avatarGridRegister) {
            var registerChoices = Array.isArray(siteAvatarChoices) ? siteAvatarChoices.slice(0, 3) : [];

            if (avatarPickerRegister && typeof avatarPickerRegister.destroy === 'function') {
                avatarPickerRegister.destroy();
            }

            avatarPickerRegister = AvatarPickerComponent.attach(avatarGridRegister, {
                siteAvatars: registerChoices,
                allowUpload: true,
                resolveSrc: resolveAvatarSrc,
                selfValue: '',
                onChange: function(state) {
                    pendingRegisterAvatarPreviewUrl = state && state.selfPreviewUrl ? String(state.selfPreviewUrl) : '';
                    if (!state) return;

                    if (state.selectedKey && String(state.selectedKey).indexOf('site-') === 0) {
                        pendingRegisterSiteUrl = (state.selectedSite && state.selectedSite.url) ? String(state.selectedSite.url) : '';
                        pendingRegisterAvatarBlob = null;
                        pendingRegisterAvatarPreviewUrl = '';
                        return;
                    }

                    // self/upload path
                    pendingRegisterSiteUrl = '';
                    pendingRegisterAvatarBlob = state.selfBlob || null;
                }
            });

            // Default: if register has no staged blob, prefer selecting first site avatar.
            if (!pendingRegisterAvatarBlob && pendingRegisterSiteUrl && typeof avatarPickerRegister.setSelectedKey === 'function') {
                avatarPickerRegister.setSelectedKey('site-0');
            }
        }

        // Profile picker: same component + same rules; pass 3 site avatars and it will show 2 when self exists.
        if (avatarGridProfile) {
            if (!currentUser) {
                avatarGridProfile.innerHTML = '';
                avatarPickerProfile = null;
                return;
            }

            var profileChoices = Array.isArray(siteAvatarChoices) ? siteAvatarChoices.slice(0, 3) : [];

            if (avatarPickerProfile && typeof avatarPickerProfile.destroy === 'function') {
                avatarPickerProfile.destroy();
            }

            avatarPickerProfile = AvatarPickerComponent.attach(avatarGridProfile, {
                siteAvatars: profileChoices,
                allowUpload: true,
                resolveSrc: resolveAvatarSrc,
                selfValue: currentUser && currentUser.avatar ? String(currentUser.avatar) : '',
                onChange: function(state) {
                    pendingProfileAvatarPreviewUrl = state && state.selfPreviewUrl ? String(state.selfPreviewUrl) : '';
                    if (!state) return;

                    if (state.selectedKey && String(state.selectedKey).indexOf('site-') === 0) {
                        pendingProfileSiteUrl = (state.selectedSite && state.selectedSite.url) ? String(state.selectedSite.url) : '';
                        pendingProfileAvatarBlob = null;
                        pendingProfileAvatarPreviewUrl = '';
                        updateHeaderSaveDiscardState();
                        return;
                    }

                    // self path
                    pendingProfileSiteUrl = '';
                    pendingProfileAvatarBlob = state.selfBlob || null;
                    if (profileAvatar && pendingProfileAvatarPreviewUrl) {
                        profileAvatar.src = pendingProfileAvatarPreviewUrl;
                    }
                    updateHeaderSaveDiscardState();
                }
            });
        }
    }

    function squarePngFromImageBlob(blob, cb) {
        try {
            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function() {
                try { URL.revokeObjectURL(url); } catch (e) {}
                var canvas = document.createElement('canvas');
                canvas.width = 530;
                canvas.height = 530;
                var ctx = canvas.getContext('2d');
                if (!ctx) return cb(null);

                var cw = canvas.width, ch = canvas.height;
                var iw = img.naturalWidth || img.width;
                var ih = img.naturalHeight || img.height;
                if (!iw || !ih) return cb(null);
                var cover = Math.max(cw / iw, ch / ih);
                var drawW = iw * cover;
                var drawH = ih * cover;
                var x = (cw - drawW) / 2;
                var y = (ch - drawH) / 2;
                ctx.clearRect(0, 0, cw, ch);
                ctx.drawImage(img, x, y, drawW, drawH);
                canvas.toBlob(function(out) {
                    cb(out || null);
                }, 'image/png', 0.92);
            };
            img.onerror = function() {
                try { URL.revokeObjectURL(url); } catch (e) {}
                cb(null);
            };
            img.src = url;
        } catch (e) {
            cb(null);
        }
    }

    function uploadAvatarBlob(blob) {
        var fd = new FormData();
        fd.append('file', blob, 'avatar.png');
        // Require final naming on server (rules file): {memberId}-avatar.{ext}
        if (currentUser && currentUser.id) {
            fd.append('user_id', String(currentUser.id));
        }
        return fetch('/gateway.php?action=upload-avatar', {
            method: 'POST',
            body: fd
        }).then(function(r) {
            // Try JSON first; fall back to text so we can display server errors
            return r.text().then(function(text) {
                var json = null;
                try { json = JSON.parse(text); } catch (e) {}
                return { ok: r.ok, status: r.status, text: text, json: json };
            });
        }).then(function(result) {
            var res = result.json;
            if (!result.ok) {
                var msg = (res && (res.message || res.error)) ? (res.message || res.error) : ('Upload failed (HTTP ' + result.status + ')');
                throw new Error(msg);
            }
            if (!res || res.success !== true || !res.url) {
                throw new Error((res && (res.message || res.error)) || 'Upload failed');
            }
            // Prefer filename-only storage (rules file)
            var avatarValue = (res && res.filename) ? String(res.filename) : String(res.url);
            // The filename is stable (overwrite), so bump cache-bust to force the latest bytes after save/refresh.
            if (currentUser && currentUser.id) {
                bumpAvatarCacheBust(currentUser.id);
            }
            setAvatarForTarget('profile', avatarValue);
            // Note: Cropper is now handled by AvatarCropperComponent which auto-closes on save
            if (window.ToastComponent && ToastComponent.showSuccess) {
                ToastComponent.showSuccess('Avatar uploaded');
            } else {
                showStatus('Avatar uploaded');
            }
        }).catch(function(err) {
            console.error('[Member] Avatar upload failed', err);
            var msg = (err && err.message) ? err.message : 'Avatar upload failed';
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError(msg);
            } else {
                showStatus(msg, { error: true });
            }
        });
    }

    function updateProfileSaveState() {
        if (!currentUser) {
            if (profileSaveBtn) {
                profileSaveBtn.disabled = true;
                profileSaveBtn.classList.add('member-button-auth--disabled');
            }
            updateHeaderSaveDiscardState();
            return;
        }
        
        var name = profileEditNameInput ? profileEditNameInput.value.trim() : '';
        var pw = profileEditPasswordInput ? profileEditPasswordInput.value : '';
        var confirm = profileEditConfirmInput ? profileEditConfirmInput.value : '';
        
        var nameChanged = name !== '' && name !== (profileOriginalName || '');
        var pwChanged = pw !== '' || confirm !== '';
        var canSave = nameChanged || pwChanged;
        
        if (profileSaveBtn) {
            profileSaveBtn.disabled = !canSave;
            profileSaveBtn.classList.toggle('member-button-auth--disabled', !canSave);
        }
        updateHeaderSaveDiscardState();
    }

    function setHeaderButtonsEnabled(enabled) {
        if (!headerSaveBtn || !headerDiscardBtn) return;

        headerSaveBtn.disabled = !enabled;
        headerDiscardBtn.disabled = !enabled;
        headerSaveBtn.classList.toggle('member-panel-actions-icon-btn--disabled', !enabled);
        headerDiscardBtn.classList.toggle('member-panel-actions-icon-btn--disabled', !enabled);

        var saveIcon = headerSaveBtn.querySelector('.member-panel-actions-icon-btn-icon--save');
        var discardIcon = headerDiscardBtn.querySelector('.member-panel-actions-icon-btn-icon--discard');

        if (saveIcon) {
            saveIcon.classList.toggle('member-panel-actions-icon-btn-icon--disabled', !enabled);
            saveIcon.classList.toggle('member-panel-actions-icon-btn-icon--save-enabled', enabled);
        }
        if (discardIcon) {
            discardIcon.classList.toggle('member-panel-actions-icon-btn-icon--disabled', !enabled);
            discardIcon.classList.toggle('member-panel-actions-icon-btn-icon--discard-enabled', enabled);
        }
    }

    function updateHeaderSaveDiscardState() {
        // For now: header buttons mirror profile edit dirty state
        // (we can expand later to include other profile preferences)
        var enabled = isProfileDirty();
        setHeaderButtonsEnabled(enabled);
    }

    function getEditUserAction() {
        return (currentUser && currentUser.isAdmin === true) ? 'edit-admin' : 'edit-member';
    }

    function handleProfileSave(onSuccessNext) {
        if (!currentUser) return;
        
        // Guard: session must have valid id (positive integer) and account_email to save
        // (stale localStorage sessions may be missing these fields, or id=0 is invalid)
        var memberId = parseInt(currentUser.id, 10);
        if (!memberId || memberId <= 0 || !currentUser.account_email) {
            console.warn('[Member] Cannot save profile - invalid/missing id or account_email, needs re-login');
            getMessage('msg_auth_session_expired', {}, false).then(function(message) {
                if (message) {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(message);
                    } else {
                        showStatus(message, { error: true });
                    }
                }
            });
            // Force logout to clear stale session
            handleLogout();
            return;
        }
        
        var name = profileEditNameInput ? profileEditNameInput.value.trim() : '';
        var pw = profileEditPasswordInput ? profileEditPasswordInput.value : '';
        var confirm = profileEditConfirmInput ? profileEditConfirmInput.value : '';

        // Validation warnings using existing component (Toast)
        if ((pw || confirm) && (!pw || !confirm)) {
            getMessage('msg_auth_register_empty', {}, false).then(function(message) {
                if (message) {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(message);
                    } else {
                        showStatus(message, { error: true });
                    }
                }
            });
            return;
        }
        if (pw && confirm && pw !== confirm) {
            getMessage('msg_auth_register_password_mismatch', {}, false).then(function(message) {
                if (message) {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(message);
                    } else {
                        showStatus(message, { error: true });
                    }
                }
            });
            return;
        }
        
        var payload = { id: currentUser.id, account_email: currentUser.account_email };
        if (name && name !== profileOriginalName) payload.username = name;
        if (pw || confirm) { payload.password = pw; payload.confirm = confirm; }
        // avatar_file (filename) will be set after uploading pendingProfileAvatarBlob (if any) OR from pendingAvatarUrl

        var wantsAvatarChange = !!pendingProfileAvatarBlob || ((pendingAvatarUrl || '') !== (profileOriginalAvatarUrl || ''));
        
        // Nothing to do
        if (!payload.username && !payload.password && !wantsAvatarChange) {
            if (typeof onSuccessNext === 'function') onSuccessNext();
            return;
        }
        
        // Disable header buttons while saving
        setHeaderButtonsEnabled(false);
        if (profileSaveBtn) {
            profileSaveBtn.disabled = true;
            profileSaveBtn.classList.add('member-button-auth--disabled');
        }

        function doSave() {
            fetch('/gateway.php?action=' + getEditUserAction(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(function(r) { return r.json(); })
              .then(function(res) {
                  if (!res || res.success !== true) {
                      var err = new Error((res && res.message) ? String(res.message) : 'Save failed');
                      if (res && res.message_key) err.message_key = String(res.message_key);
                      throw err;
                  }
                  
                  if (payload.username) {
                      currentUser.name = payload.username;
                      profileOriginalName = payload.username;
                      if (profileName) profileName.textContent = currentUser.name || 'Member';
                  }
                  
                  if (profileEditPasswordInput) profileEditPasswordInput.value = '';
                  if (profileEditConfirmInput) profileEditConfirmInput.value = '';

                  if (payload.avatar_file !== undefined) {
                      currentUser.avatar = payload.avatar_file;
                      profileOriginalAvatarUrl = payload.avatar_file;
                      pendingAvatarUrl = payload.avatar_file;
                      pendingProfileAvatarBlob = null;
                  }
                  
                  updateProfileSaveState();
                  updateHeaderSaveDiscardState();
                  // Always show GREEN feedback on successful save
                  if (window.ToastComponent && typeof ToastComponent.showSuccess === 'function') {
                      ToastComponent.showSuccess('Saved');
                  } else if (window.ToastComponent && typeof ToastComponent.show === 'function') {
                      ToastComponent.show('Saved', 'success');
                  } else {
                      showStatus('Saved', { success: true });
                  }

                  if (typeof onSuccessNext === 'function') {
                      onSuccessNext();
                  }
              })
              .catch(function(err) {
                  console.error('[Member] Profile save failed', err);
                  updateProfileSaveState();
                  updateHeaderSaveDiscardState();
                  if (err && err.message_key) {
                      getMessage(String(err.message_key), {}, false).then(function(message) {
                          if (message) {
                              if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                                  ToastComponent.showError(message);
                              } else {
                                  showStatus(message, { error: true });
                              }
                              return;
                          }
                          // No hardcoded fallback: use a known generic register-failed message.
                          getMessage('msg_auth_register_failed', {}, false).then(function(fallbackMsg) {
                              if (!fallbackMsg) return;
                              if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                                  ToastComponent.showError(fallbackMsg);
                              } else {
                                  showStatus(fallbackMsg, { error: true });
                              }
                          });
                      });
                      return;
                  }
                  getMessage('msg_admin_save_error_response', {}, false).then(function(message) {
                      if (message) {
                          if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                              ToastComponent.showError(message);
                          } else {
                              showStatus(message, { error: true });
                          }
                      }
                  });
              });
        }
        
        function proceedAfterAvatarPrepared() {
            if ((pendingAvatarUrl || '') !== (profileOriginalAvatarUrl || '')) {
                payload.avatar_file = pendingAvatarUrl || '';
            }
            doSave();
        }

        // If a new avatar blob is staged, upload it FIRST (final filename), then save profile.
        if (pendingProfileAvatarBlob) {
            uploadAvatarBlob(pendingProfileAvatarBlob).then(function() {
                // uploadAvatarBlob calls setAvatarForTarget(url), which sets pendingAvatarUrl
                proceedAfterAvatarPrepared();
            }).catch(function(err) {
                console.error('[Member] Avatar upload failed', err);
                updateProfileSaveState();
                updateHeaderSaveDiscardState();
            });
            return;
        }

        // Confirm password changes using existing component dialog
        if (payload.password && window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
            ConfirmDialogComponent.show({
                titleText: 'Change Password',
                messageText: 'Are you sure you want to change your password?',
                confirmLabel: 'Save',
                cancelLabel: 'Cancel',
                focusCancel: true
            }).then(function(confirmed) {
                if (!confirmed) {
                    updateHeaderSaveDiscardState();
                    return;
                }
                proceedAfterAvatarPrepared();
            });
            return;
        }

        proceedAfterAvatarPrepared();
    }

    function handleHeaderSave() {
        // If a site avatar is selected, copy it into the user's avatar file (as a square PNG)
        // so it follows the same naming/overwrite rules as uploads.
        if (pendingProfileSiteUrl && !pendingProfileAvatarBlob) {
            var url = String(pendingProfileSiteUrl);
            fetch(url)
                .then(function(r) { return r.blob(); })
                .then(function(blob) {
                    return new Promise(function(resolve) {
                        squarePngFromImageBlob(blob, function(out) { resolve(out); });
                    });
                })
                .then(function(squareBlob) {
                    if (!squareBlob) throw new Error('Could not prepare avatar image');
                    pendingProfileAvatarBlob = squareBlob;
                    pendingProfileSiteUrl = '';
                    try { pendingProfileAvatarPreviewUrl = URL.createObjectURL(squareBlob); } catch (e) { pendingProfileAvatarPreviewUrl = ''; }
                    if (profileAvatar && pendingProfileAvatarPreviewUrl) profileAvatar.src = pendingProfileAvatarPreviewUrl;
                    if (avatarPickerProfile && typeof avatarPickerProfile.setSelfBlob === 'function') {
                        avatarPickerProfile.setSelfBlob(squareBlob, pendingProfileAvatarPreviewUrl);
                    } else {
                        renderAvatarPickers();
                    }
                    handleProfileSave(function() { updateHeaderSaveDiscardState(); });
                })
                .catch(function(err) {
                    console.warn('[Member] Failed to prepare site avatar', err);
                    if (window.ToastComponent && ToastComponent.showError) {
                        ToastComponent.showError('Could not use that avatar.');
                    }
                });
            return;
        }

        // Header save should save profile edits if any
        handleProfileSave(function() {
            updateHeaderSaveDiscardState();
        });
    }

    function handleHeaderDiscard() {
        discardProfileEdits();
        updateHeaderSaveDiscardState();
    }

    function isProfileDirty() {
        if (!currentUser) return false;
        var name = profileEditNameInput ? profileEditNameInput.value.trim() : '';
        var pw = profileEditPasswordInput ? profileEditPasswordInput.value : '';
        var confirm = profileEditConfirmInput ? profileEditConfirmInput.value : '';
        var nameChanged = name !== '' && name !== (profileOriginalName || '');
        var pwChanged = pw !== '' || confirm !== '';
        var avatarChanged = (pendingAvatarUrl || '') !== (profileOriginalAvatarUrl || '') || !!pendingProfileAvatarBlob || !!pendingProfileSiteUrl;
        return nameChanged || pwChanged || avatarChanged;
    }

    function discardProfileEdits() {
        if (profileEditNameInput) profileEditNameInput.value = profileOriginalName || '';
        if (profileEditPasswordInput) profileEditPasswordInput.value = '';
        if (profileEditConfirmInput) profileEditConfirmInput.value = '';
        pendingAvatarUrl = profileOriginalAvatarUrl || '';
        pendingProfileAvatarBlob = null;
        pendingProfileSiteUrl = '';
        pendingProfileAvatarPreviewUrl = '';
        if (profileAvatar) setImgOrHide(profileAvatar, getAvatarSource(currentUser));
        renderAvatarPickers();
        updateProfileSaveState();
    }

    function confirmUnsavedProfileEdits(nextAction) {
        if (!window.ThreeButtonDialogComponent || typeof ThreeButtonDialogComponent.show !== 'function') {
            throw new Error('[Member] ThreeButtonDialogComponent is required for confirmUnsavedProfileEdits().');
        }
        
        ThreeButtonDialogComponent.show({
            titleText: 'Unsaved Changes',
            messageText: 'You have unsaved changes. What would you like to do?',
            cancelLabel: 'Cancel',
            saveLabel: 'Save',
            discardLabel: 'Discard',
            focusCancel: true
        }).then(function(choice) {
            if (choice === 'discard') {
                discardProfileEdits();
                if (typeof nextAction === 'function') nextAction();
            } else if (choice === 'save') {
                handleProfileSave(function() {
                    if (typeof nextAction === 'function') nextAction();
                });
            } else {
                // cancel
            }
        });
    }

    function requestLogout() {
        if (isProfileDirty()) {
            confirmUnsavedProfileEdits(function() { handleLogout(); });
            return;
        }
        handleLogout();
    }
    
    function closeAllProfileMenus() {
        if (profileMoreMenu) {
            profileMoreMenu.hidden = true;
        }
        if (profileMoreBtn) {
            profileMoreBtn.setAttribute('aria-expanded', 'false');
        }
    }
    
    function toggleProfileDrawer() {
        if (!profileDrawer) return;
        var isOpen = profileDrawer.classList.contains('member-profile-drawer--open');
        profileDrawer.classList.toggle('member-profile-drawer--open', !isOpen);
        if (profileDrawerHeader) profileDrawerHeader.classList.toggle('member-profile-drawer-header--open', !isOpen);
        if (profileDrawerArrow) profileDrawerArrow.classList.toggle('member-profile-drawer-arrow--open', !isOpen);
        if (profileDrawerBody) profileDrawerBody.classList.toggle('member-profile-drawer-body--open', !isOpen);
    }
    
    function saveProfileHiddenState(hidden) {
        if (!currentUser || !currentUser.id || !currentUser.account_email) return;
        
        fetch('/gateway.php?action=edit-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                account_email: currentUser.account_email,
                hidden: hidden ? 1 : 0
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                currentUser.hidden = hidden;
                storeCurrent(currentUser);
                getMessage('msg_profile_hidden_updated', {}, false).then(function(msg) {
                    if (msg && window.ToastComponent) ToastComponent.showSuccess(msg);
                });
            }
        })
        .catch(function(err) {
            console.error('[Member] Failed to update hidden state:', err);
        });
    }
    
    function confirmDeleteAccount() {
        if (!currentUser || !currentUser.id) return;
        
        // First check if member has active posts
        fetch('/gateway.php?action=check-member-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: currentUser.id })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data.success) {
                if (window.ToastComponent) ToastComponent.showError('Unable to check account status.');
                return;
            }
            
            if (!data.can_delete) {
                // Has active posts - show blocking message
                getMessage('msg_delete_blocked_active_posts', { count: data.active_post_count }, false).then(function(msg) {
                    if (window.ToastComponent) ToastComponent.showError(msg);
                });
                return;
            }
            
            // No active posts - proceed with confirmation
            var displayName = currentUser.name || currentUser.username || currentUser.account_email || 'your account';
            
            getMessage('msg_confirm_delete_account', { name: displayName }, false).then(function(message) {
                var text = message;
                
                if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
                    ConfirmDialogComponent.show({
                        titleText: 'Delete Account',
                        messageText: text,
                        confirmLabel: 'Delete Account',
                        cancelLabel: 'Cancel',
                        confirmClass: 'danger',
                        focusCancel: true
                    }).then(function(confirmed) {
                        if (confirmed) {
                            performDeleteAccount();
                        }
                    });
                }
            });
        })
        .catch(function(err) {
            console.error('[Member] Failed to check active posts:', err);
            if (window.ToastComponent) ToastComponent.showError('Unable to check account status.');
        });
    }
    
    function performDeleteAccount() {
        if (!currentUser || !currentUser.id || !currentUser.account_email) return;
        
        fetch('/gateway.php?action=delete-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                account_email: currentUser.account_email
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                // Show scheduled deletion message (soft delete with 30-day grace period)
                getMessage('msg_account_scheduled_delete', {}, false).then(function(msg) {
                    if (msg && window.ToastComponent) ToastComponent.showSuccess(msg);
                });
                handleLogout();
            } else {
                getMessage('msg_account_delete_failed', {}, false).then(function(msg) {
                    if (msg && window.ToastComponent) ToastComponent.showError(msg);
                });
            }
        })
        .catch(function(err) {
            console.error('[Member] Failed to delete account:', err);
            getMessage('msg_account_delete_failed', {}, false).then(function(msg) {
                if (msg && window.ToastComponent) ToastComponent.showError(msg);
            });
        });
    }

    function requestTabSwitch(tabName) {
        // Only guard when leaving Profile tab with dirty edits
        var leavingProfile = false;
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                if (btn.dataset.tab === 'profile' && btn.getAttribute('aria-selected') === 'true') {
                    leavingProfile = tabName !== 'profile';
                }
            });
        }

        if (leavingProfile && isProfileDirty()) {
            confirmUnsavedProfileEdits(function() { switchTab(tabName); });
            return;
        }
        switchTab(tabName);
    }

    /* --------------------------------------------------------------------------
       PANEL OPEN/CLOSE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panel || !panelContent) return;
        
        panel.classList.add('member-panel--show');
        panel.setAttribute('aria-hidden', 'false');

        // Show (force a frame between "off-screen" and "visible" so slide-in
        // always transitions at the same speed as slide-out)
        panelContent.classList.remove('member-panel-content--visible');
        panelContent.classList.add('member-panel-content--hidden');
        try { void panelContent.offsetWidth; } catch (e) {}
        requestAnimationFrame(function() {
            panelContent.classList.remove('member-panel-content--hidden');
            panelContent.classList.add('member-panel-content--visible');
        });
        
        // Refresh map settings buttons (in case member logged in/out)
        initMapLightingButtons();
        initMapStyleButtons();
        // Load 3 random site avatars for the 4-tile picker (lazy: only when panel is opened)
        ensureAvatarChoicesReady();
        
        // Bring panel to front of stack
        App.bringToTop(panel);
        
        // Update header button
        App.emit('member:opened');
    }

    function closePanel() {
        if (!panel || !panelContent) return;

        if (isProfileDirty()) {
            confirmUnsavedProfileEdits(function() { closePanel(); });
            return;
        }
        
        // Remove focus from close button before hiding (fixes aria-hidden warning)
        if (closeBtn && document.activeElement === closeBtn) {
            closeBtn.blur();
        }
        
        panelContent.classList.remove('member-panel-content--visible');
        panelContent.classList.add('member-panel-content--hidden');
        
        // Wait for transition to complete before hiding
        panelContent.addEventListener('transitionend', function handler() {
            panelContent.removeEventListener('transitionend', handler);
            panel.classList.remove('member-panel--show');
            // Move focus out before hiding to avoid aria-hidden violation
            if (document.activeElement && panel.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            panel.setAttribute('aria-hidden', 'true');
            
            // Remove from panel stack
            App.removeFromStack(panel);
        }, { once: true });
        
        // Update header button
        App.emit('member:closed');
    }
    

    /* --------------------------------------------------------------------------
       TAB SWITCHING
       -------------------------------------------------------------------------- */
    
    function switchTab(tabName) {
        if (!tabButtons || !tabPanels) return;
        
        // Update tab buttons
        tabButtons.forEach(function(btn) {
            var isSelected = btn.dataset.tab === tabName;
            btn.classList.toggle('member-tab-bar-button--selected', isSelected);
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
        
        // Update tab panels
        tabPanels.forEach(function(panel) {
            var isActive = panel.id === 'member-tab-' + tabName;
            panel.classList.toggle('member-tab-panel--active', isActive);
            panel.hidden = !isActive;
        });
        
        // Lazy load Create Post tab content
        if (tabName === 'create') {
            loadFormpicker();
        }
    }

    /* --------------------------------------------------------------------------
       FORMPICKER (Category/Subcategory selection)
       Copied from forms.js, using member-formpicker-menu classes from member-new.css
       -------------------------------------------------------------------------- */
    
    var formpickerLoaded = false;
    var memberCategories = [];
    var memberCategoryIconPaths = {};
    var memberSubcategoryIconPaths = {};
    var selectedCategory = '';
    var selectedSubcategory = '';
    var formWrapper = null;
    var formFields = null;
    var checkoutOptions = [];
    var siteCurrency = null;
    var checkoutInstance = null;
    
    function loadFormpicker() {
        if (formpickerLoaded) return;
        
        var container = document.getElementById('member-formpicker-cats');
        if (!container) return;
        
        formWrapper = document.getElementById('member-create-form-wrapper');
        formFields = document.getElementById('member-create-fields');
        
        container.innerHTML = '<p class="member-create-intro">Loading categories...</p>';
        
        // Fetch form data and checkout options from database
        Promise.all([
            fetch('/gateway.php?action=get-form', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }).then(function(r) { return r.json(); }),
            fetch('/gateway.php?action=get-admin-settings', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }).then(function(r) { return r.json(); })
        ]).then(function(results) {
            var formResponse = results[0];
            var settingsResponse = results[1];
            
            if (formResponse && formResponse.success && formResponse.formData) {
                memberCategories = formResponse.formData.categories || [];
                memberCategoryIconPaths = formResponse.formData.categoryIconPaths || {};
                memberSubcategoryIconPaths = formResponse.formData.subcategoryIconPaths || {};
            }
            
            // Get checkout options, currency, and dropdown options from admin settings
            if (settingsResponse && settingsResponse.checkout_options) {
                checkoutOptions = (settingsResponse.checkout_options || []).filter(function(opt) {
                    if (!opt) {
                        throw new Error('[Member] Invalid checkout option entry (null/undefined) in get-admin-settings response.');
                    }
                    // get-admin-settings.php provides: hidden (bool), admin_only (bool)
                    if (opt.hidden === true || opt.hidden === 1 || opt.hidden === '1') return false;
                    if (opt.admin_only === true || opt.admin_only === 1 || opt.admin_only === '1') return false;
                    return true;
                });
            }
            if (settingsResponse && settingsResponse.settings && settingsResponse.settings.website_currency) {
                siteCurrency = settingsResponse.settings.website_currency;
            }

            if (memberCategories.length > 0) {
                renderFormpicker(container);
                formpickerLoaded = true;
            } else {
                container.innerHTML = '<p class="member-create-intro member-create-intro--error">Failed to load categories.</p>';
            }
        }).catch(function(err) {
            console.error('[Member] Failed to load form data:', err);
            container.innerHTML = '<p class="member-create-intro member-create-intro--error">Failed to load categories.</p>';
        });
    }
    
    function renderFormpicker(container) {
        container.innerHTML = '';
        selectedCategory = '';
        selectedSubcategory = '';
        
        if (formWrapper) formWrapper.hidden = true;
        if (formFields) formFields.innerHTML = '';
        // Reset state
        submitBtn = null;
        adminSubmitBtn = null;
        termsAgreed = false;
        
        var categoryIconPaths = memberCategoryIconPaths;
        var subcategoryIconPaths = memberSubcategoryIconPaths;
        
        // Container for dropdowns
        var dropdownsContainer = document.createElement('div');
        dropdownsContainer.className = 'member-formpicker-dropdowns';
        
        // Subcategory dropdown (created first, shown after category selection)
        var subcategoryWrapper = document.createElement('div');
        subcategoryWrapper.className = 'member-panel-field';
        subcategoryWrapper.hidden = true;
        
        var subcategoryMenu = document.createElement('div');
        subcategoryMenu.className = 'member-formpicker-menu';
        
        var subcategoryBtn = document.createElement('button');
        subcategoryBtn.type = 'button';
        subcategoryBtn.className = 'member-formpicker-menu-button';
        subcategoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text">Select a subcategory</span><span class="member-formpicker-menu-button-arrow">▼</span>';
        
        var subcategoryOpts = document.createElement('div');
        subcategoryOpts.className = 'member-formpicker-menu-options';
        
        subcategoryMenu.appendChild(subcategoryBtn);
        subcategoryMenu.appendChild(subcategoryOpts);
        subcategoryWrapper.appendChild(subcategoryMenu);
        
        // Category dropdown
        var categoryWrapper = document.createElement('div');
        categoryWrapper.className = 'member-panel-field';
        
        var categoryLabel = document.createElement('label');
        categoryLabel.className = 'member-panel-field-label';
        categoryLabel.textContent = 'Category/Subcategory';
        
        var categoryMenu = document.createElement('div');
        categoryMenu.className = 'member-formpicker-menu';
        
        var categoryBtn = document.createElement('button');
        categoryBtn.type = 'button';
        categoryBtn.className = 'member-formpicker-menu-button';
        categoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text">Select a category</span><span class="member-formpicker-menu-button-arrow">▼</span>';
        
        var categoryOpts = document.createElement('div');
        categoryOpts.className = 'member-formpicker-menu-options';

        function setFormpickerMenuOpen(menuEl, isOpen) {
            if (!menuEl) return;
            menuEl.classList.toggle('member-formpicker-menu--open', !!isOpen);
            var btnEl = menuEl.querySelector('.member-formpicker-menu-button');
            var arrowEl = menuEl.querySelector('.member-formpicker-menu-button-arrow');
            var optsEl = menuEl.querySelector('.member-formpicker-menu-options');
            if (btnEl) btnEl.classList.toggle('member-formpicker-menu-button--open', !!isOpen);
            if (arrowEl) arrowEl.classList.toggle('member-formpicker-menu-button-arrow--open', !!isOpen);
            if (optsEl) optsEl.classList.toggle('member-formpicker-menu-options--open', !!isOpen);
        }
        
        // Populate category options
        memberCategories.forEach(function(cat) {
            if (!cat || typeof cat.name !== 'string') return;
            
            var optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'member-formpicker-menu-option';
            
            // Get icon path - API returns paths keyed by category name directly
            var iconPath = categoryIconPaths[cat.name] || '';
            
            if (iconPath) {
                var iconImg = document.createElement('img');
                iconImg.className = 'member-formpicker-menu-option-image';
                iconImg.src = iconPath;
                iconImg.alt = '';
                optionBtn.appendChild(iconImg);
            }
            
            var textSpan = document.createElement('span');
            textSpan.className = 'member-formpicker-menu-option-text';
            textSpan.textContent = cat.name;
            optionBtn.appendChild(textSpan);
            optionBtn.dataset.value = cat.name;
            optionBtn.dataset.icon = iconPath;
            
            optionBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                
                // Update button
                categoryBtn.innerHTML = '';
                if (iconPath) {
                    var btnIcon = document.createElement('img');
                    btnIcon.className = 'member-formpicker-menu-button-image';
                    btnIcon.src = iconPath;
                    btnIcon.alt = '';
                    categoryBtn.appendChild(btnIcon);
                }
                var btnText = document.createElement('span');
                btnText.className = 'member-formpicker-menu-button-text';
                btnText.textContent = cat.name;
                categoryBtn.appendChild(btnText);
                var btnArrow = document.createElement('span');
                btnArrow.className = 'member-formpicker-menu-button-arrow';
                btnArrow.textContent = '▼';
                categoryBtn.appendChild(btnArrow);
                
                setFormpickerMenuOpen(categoryMenu, false);
                selectedCategory = cat.name;
                selectedSubcategory = '';
                
                // Populate subcategories
                subcategoryOpts.innerHTML = '';
                if (cat.subs && cat.subs.length > 0) {
                    cat.subs.forEach(function(subName) {
                        var subBtn = document.createElement('button');
                        subBtn.type = 'button';
                        subBtn.className = 'member-formpicker-menu-option';
                        
                        // Get icon path - API returns paths keyed by subcategory name directly
                        var subIconPath = subcategoryIconPaths[subName] || '';
                        
                        if (subIconPath) {
                            var subIconImg = document.createElement('img');
                            subIconImg.className = 'member-formpicker-menu-option-image';
                            subIconImg.src = subIconPath;
                            subIconImg.alt = '';
                            subBtn.appendChild(subIconImg);
                        }
                        
                        var subTextSpan = document.createElement('span');
                        subTextSpan.className = 'member-formpicker-menu-option-text';
                        subTextSpan.textContent = subName;
                        subBtn.appendChild(subTextSpan);
                        subBtn.dataset.value = subName;
                        subBtn.dataset.icon = subIconPath;
                        
                        subBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            
                            // Update subcategory button
                            subcategoryBtn.innerHTML = '';
                            if (subIconPath) {
                                var subBtnIcon = document.createElement('img');
                                subBtnIcon.className = 'member-formpicker-menu-button-image';
                                subBtnIcon.src = subIconPath;
                                subBtnIcon.alt = '';
                                subcategoryBtn.appendChild(subBtnIcon);
                            }
                            var subBtnText = document.createElement('span');
                            subBtnText.className = 'member-formpicker-menu-button-text';
                            subBtnText.textContent = subName;
                            subcategoryBtn.appendChild(subBtnText);
                            var subBtnArrow = document.createElement('span');
                            subBtnArrow.className = 'member-formpicker-menu-button-arrow';
                            subBtnArrow.textContent = '▼';
                            subcategoryBtn.appendChild(subBtnArrow);
                            
                            setFormpickerMenuOpen(subcategoryMenu, false);
                            selectedSubcategory = subName;
                            renderConfiguredFields();
                        });
                        
                        subcategoryOpts.appendChild(subBtn);
                    });
                    
                    subcategoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text">Select a subcategory</span><span class="member-formpicker-menu-button-arrow">▼</span>';
                    subcategoryWrapper.hidden = false;

                    // Auto-open subcategory menu as soon as a category is chosen.
                    // Keep it open until a subcategory is selected.
                    setFormpickerMenuOpen(categoryMenu, false);
                    setFormpickerMenuOpen(subcategoryMenu, true);
                } else {
                    subcategoryWrapper.hidden = true;
                }
                
                renderConfiguredFields();
            });
            
            categoryOpts.appendChild(optionBtn);
        });
        
        // Toggle category menu
        categoryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            setFormpickerMenuOpen(subcategoryMenu, false);
            setFormpickerMenuOpen(categoryMenu, !categoryMenu.classList.contains('member-formpicker-menu--open'));
        });
        
        // Toggle subcategory menu
        subcategoryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            setFormpickerMenuOpen(categoryMenu, false);
            setFormpickerMenuOpen(subcategoryMenu, !subcategoryMenu.classList.contains('member-formpicker-menu--open'));
        });
        
        // Close menus on outside click
        document.addEventListener('click', function(e) {
            if (!categoryMenu.contains(e.target)) setFormpickerMenuOpen(categoryMenu, false);
            if (!subcategoryMenu.contains(e.target)) {
                // Keep subcategory menu open until user has picked a subcategory.
                if (!(selectedCategory && !selectedSubcategory)) {
                    setFormpickerMenuOpen(subcategoryMenu, false);
                }
            }
        });
        
        categoryMenu.appendChild(categoryBtn);
        categoryMenu.appendChild(categoryOpts);
        categoryWrapper.appendChild(categoryLabel);
        categoryWrapper.appendChild(categoryMenu);
        
        dropdownsContainer.appendChild(categoryWrapper);
        dropdownsContainer.appendChild(subcategoryWrapper);
        container.appendChild(dropdownsContainer);

        // Auto-open category menu when nothing is selected yet.
        // Subcategory auto-open is handled when a category is picked.
        if (!selectedCategory) setFormpickerMenuOpen(categoryMenu, true);
    }
    
    function renderConfiguredFields() {
        if (!selectedCategory || !selectedSubcategory) {
            if (formWrapper) formWrapper.hidden = true;
            if (formFields) formFields.innerHTML = '';
            return;
        }

        // Ensure FieldsetBuilder has its picklists (currencies, phone prefixes, amenities) loaded
        // before we build fieldsets. This is intentionally NOT done at site startup for performance.
        if (window.FieldsetBuilder && typeof FieldsetBuilder.loadFromDatabase === 'function') {
            if (!renderConfiguredFields._fieldsetLoadPromise) {
                renderConfiguredFields._fieldsetLoadPromise = FieldsetBuilder.loadFromDatabase();
            }
            renderConfiguredFields._fieldsetLoadPromise.then(function() {
                renderConfiguredFields._renderBody();
            });
            return;
        }

        renderConfiguredFields._renderBody();
    }

    // Extracted body so we can wait for FieldsetBuilder.loadFromDatabase() when needed
    renderConfiguredFields._renderBody = function() {
        
        // Get fields for this category/subcategory
        var fields = getFieldsForSelection(selectedCategory, selectedSubcategory);

        if (formFields) formFields.innerHTML = '';

        // Track location quantity and repeat fieldsets
        var locationQuantity = 1;
        var locationFieldset = null;
        var locationFieldsetType = null;
        var mustRepeatFieldsets = [];
        var autofillRepeatFieldsets = [];

        if (fields.length === 0) {
            var placeholder = document.createElement('p');
            placeholder.className = 'member-create-intro';
            placeholder.textContent = 'No fields configured for this subcategory yet.';
            if (formFields) formFields.appendChild(placeholder);
        } else {
            // First pass: identify location fieldset and collect repeat fieldsets
            // Also get subcategory data to check for must-repeat and autofill-repeat CSV strings
            var subcategoryData = null;
            if (selectedCategory && selectedSubcategory) {
                var category = memberCategories.find(function(c) {
                    return c.name === selectedCategory;
                });
                if (category && category.subFields && category.subFields[selectedSubcategory]) {
                    // Get subcategory metadata from category data
                    var subcats = category.subcategories || [];
                    subcategoryData = subcats.find(function(sub) {
                        return sub.name === selectedSubcategory || sub.subcategory_key === selectedSubcategory;
                    });
                }
            }
            
            // Parse must_repeat and autofill_repeat CSV strings if available
            var mustRepeatIndices = [];
            var autofillRepeatIndices = [];
            if (subcategoryData) {
                if (subcategoryData.must_repeat && typeof subcategoryData.must_repeat === 'string') {
                    mustRepeatIndices = subcategoryData.must_repeat.split(',').map(function(s) {
                        return parseInt(s.trim(), 10);
                    }).filter(function(n) {
                        return !isNaN(n);
                    });
                }
                if (subcategoryData.autofill_repeat && typeof subcategoryData.autofill_repeat === 'string') {
                    autofillRepeatIndices = subcategoryData.autofill_repeat.split(',').map(function(s) {
                        return parseInt(s.trim(), 10);
                    }).filter(function(n) {
                        return !isNaN(n);
                    });
                }
            }
            
            fields.forEach(function(fieldData, index) {
                var field = ensureFieldDefaults(fieldData);
                
                // Get fieldset key - check fieldData first (source of truth)
                var fieldsetKey = '';
                if (fieldData && typeof fieldData === 'object') {
                    if (fieldData.fieldset_key && typeof fieldData.fieldset_key === 'string') {
                        fieldsetKey = fieldData.fieldset_key.toLowerCase();
                    } else if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                        fieldsetKey = fieldData.fieldsetKey.toLowerCase();
                    } else if (fieldData.key && typeof fieldData.key === 'string') {
                        fieldsetKey = fieldData.key.toLowerCase();
                    }
                }
                
                // Checking field
                
                // Check if this is a location fieldset (venue, city, address, location)
                // 'location' is legacy support for 'address'
                if (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location') {
                    if (!locationFieldset) {
                        locationFieldset = fieldData;
                        locationFieldsetType = fieldsetKey === 'location' ? 'address' : fieldsetKey;
                        // Found location fieldset
                    }
                }
                
                // Check for must-repeat and autofill-repeat flags
                // Check field data properties first, then CSV indices
                var isMustRepeat = field.must_repeat || field.mustRepeat || mustRepeatIndices.indexOf(index) !== -1;
                var isAutofillRepeat = field.autofill_repeat || field.autofillRepeat || autofillRepeatIndices.indexOf(index) !== -1;
                
                // IMPORTANT:
                // Location fieldset is ALWAYS repeated via its own dedicated location slot.
                // Do NOT include any location-type fieldset in mustRepeatFieldsets or it can be duplicated.
                var isLocationKey = (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location');
                if (isMustRepeat && !isLocationKey) {
                    mustRepeatFieldsets.push(field);
                }
                if (isAutofillRepeat) {
                    autofillRepeatFieldsets.push(field);
                }
            });
            
            function setFieldsetLabelNumber(fieldsetEl, numberOrNull) {
                if (!fieldsetEl) return;
                var labelTextEl = fieldsetEl.querySelector('.fieldset-label-text');
                if (!labelTextEl) return;
                if (!fieldsetEl.dataset.baseLabel) {
                    fieldsetEl.dataset.baseLabel = (labelTextEl.textContent || '').trim();
                }
                var base = fieldsetEl.dataset.baseLabel || '';
                if (!base) return;
                if (numberOrNull && numberOrNull > 0) {
                    labelTextEl.textContent = base + ' ' + numberOrNull;
                } else {
                    labelTextEl.textContent = base;
                }
            }

            function applyMustRepeatNumberingForMainForm() {
                if (!formFields) return;
                var shouldNumber = (locationQuantity > 1);

                var mustKeys = {};
                mustRepeatFieldsets.forEach(function(f) {
                    var k = (f && (f.fieldsetKey || f.key || f.type)) ? String(f.fieldsetKey || f.key || f.type).toLowerCase() : '';
                    if (k) mustKeys[k] = true;
                });

                var all = formFields.querySelectorAll('.fieldset');
                all.forEach(function(fs) {
                    if (!fs || (fs.closest && fs.closest('.member-additional-location'))) return;
                    var k = (fs.dataset && fs.dataset.fieldsetKey) ? String(fs.dataset.fieldsetKey).toLowerCase() : '';
                    if (!k) return;
                    if (k === 'venue' || k === 'city' || k === 'address' || k === 'location') return;
                    if (!mustKeys[k]) return;
                    setFieldsetLabelNumber(fs, shouldNumber ? 1 : null);
                });
            }
            
            // Second pass: render fields with location quantity selector
            fields.forEach(function(fieldData, index) {
                var field = ensureFieldDefaults(fieldData);
                
                // Get fieldset key - check fieldData first (source of truth)
                var fieldsetKey = '';
                if (fieldData && typeof fieldData === 'object') {
                    if (fieldData.fieldset_key && typeof fieldData.fieldset_key === 'string') {
                        fieldsetKey = fieldData.fieldset_key.toLowerCase();
                    } else if (fieldData.fieldsetKey && typeof fieldData.fieldsetKey === 'string') {
                        fieldsetKey = fieldData.fieldsetKey.toLowerCase();
                    } else if (fieldData.key && typeof fieldData.key === 'string') {
                        fieldsetKey = fieldData.key.toLowerCase();
                    }
                }
                
                // Compare using original fieldData, not normalized field
                var isLocationFieldset = false;
                if (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address' || fieldsetKey === 'location') {
                    if (fieldData === locationFieldset) {
                        isLocationFieldset = true;
                    }
                }
                
                if (isLocationFieldset) {
                    // Rendering location fieldset with quantity selector
                }

                var fieldset = FieldsetBuilder.buildFieldset(field, {
                    idPrefix: 'memberCreate',
                    fieldIndex: index,
                    container: formFields,
                    defaultCurrency: getDefaultCurrencyForForms()
                });

                // Carry validation metadata onto the rendered DOM so submit-state can be computed
                // without guessing: required flag + fieldset type are part of the form configuration.
                // Fieldset validity UI is component-owned (FieldsetBuilder sets dataset flags + required star state).
                
                // Add location quantity selector to location fieldset
                if (isLocationFieldset) {
                    // Adding quantity selector to location fieldset
                    // Find the label element - it should be the first child with class fieldset-label
                    var labelEl = fieldset.querySelector('.fieldset-label');
                    if (labelEl) {
                        // Found label element, adding quantity controls
                        // Create quantity selector row
                        var quantityRow = document.createElement('div');
                        quantityRow.className = 'member-location-quantity-row';
                        
                        var quantityLabel = document.createElement('span');
                        quantityLabel.className = 'member-location-quantity-label';
                        quantityLabel.textContent = 'Number of locations:';
                        
                        var quantityControls = document.createElement('div');
                        quantityControls.className = 'member-location-quantity-controls';
                        
                        var minusBtn = document.createElement('button');
                        minusBtn.type = 'button';
                        minusBtn.className = 'member-location-quantity-btn member-location-quantity-btn--minus';
                        minusBtn.innerHTML = icons.minus;
                        minusBtn.setAttribute('aria-label', 'Decrease location quantity');
                        
                        var quantityDisplay = document.createElement('span');
                        quantityDisplay.className = 'member-location-quantity-display';
                        quantityDisplay.textContent = locationQuantity;
                        
                        var plusBtn = document.createElement('button');
                        plusBtn.type = 'button';
                        plusBtn.className = 'member-location-quantity-btn member-location-quantity-btn--plus';
                        plusBtn.innerHTML = icons.plus;
                        plusBtn.setAttribute('aria-label', 'Increase location quantity');
                        
                        quantityControls.appendChild(minusBtn);
                        quantityControls.appendChild(quantityDisplay);
                        quantityControls.appendChild(plusBtn);
                        
                        quantityRow.appendChild(quantityLabel);
                        quantityRow.appendChild(quantityControls);
                        
                        // Place the quantity row ABOVE the location fieldset (not inside it)
                        if (formFields) {
                            formFields.appendChild(quantityRow);
                        }
                        
                        // Update label text if quantity > 1
                        if (locationQuantity > 1) {
                            var labelTextEl = labelEl.querySelector('.fieldset-label-text');
                            if (labelTextEl) {
                                var baseName = locationFieldsetType.charAt(0).toUpperCase() + locationFieldsetType.slice(1);
                                labelTextEl.textContent = baseName + ' 1';
                            }
                            applyMustRepeatNumberingForMainForm();
                        }
                        
                        // Quantity button handlers
                        minusBtn.addEventListener('click', function() {
                            if (locationQuantity > 1) {
                                locationQuantity--;
                                quantityDisplay.textContent = locationQuantity;
                                window._memberLocationQuantity = locationQuantity;
                                
                                // Update label
                                var labelTextEl = labelEl.querySelector('.fieldset-label-text');
                                if (labelTextEl) {
                                    var baseName = locationFieldsetType.charAt(0).toUpperCase() + locationFieldsetType.slice(1);
                                    if (locationQuantity === 1) {
                                        labelTextEl.textContent = baseName;
                                    } else {
                                        labelTextEl.textContent = baseName + ' 1';
                                    }
                                }
                                applyMustRepeatNumberingForMainForm();
                                
                                // Re-render additional locations (after checkout section)
                                // Minus clicked
                                setTimeout(function() {
                                    renderAdditionalLocations(locationQuantity, locationFieldsetType, locationFieldset, mustRepeatFieldsets, autofillRepeatFieldsets);
                                    if (checkoutInstance && typeof checkoutInstance.updateContext === 'function') {
                                        setTimeout(function() {
                                            checkoutInstance.updateContext({ locationCount: locationQuantity });
                                            try { formFields.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true })); } catch (e) {}
                                        }, 50);
                                    }
                                }, 100);
                            }
                        });
                        
                        plusBtn.addEventListener('click', function() {
                            locationQuantity++;
                            quantityDisplay.textContent = locationQuantity;
                            window._memberLocationQuantity = locationQuantity;
                            
                            // Update label
                            var labelTextEl = labelEl.querySelector('.fieldset-label-text');
                            if (labelTextEl) {
                                var baseName = locationFieldsetType.charAt(0).toUpperCase() + locationFieldsetType.slice(1);
                                labelTextEl.textContent = baseName + ' 1';
                            }
                            applyMustRepeatNumberingForMainForm();
                            
                            // Re-render additional locations (after checkout section)
                            // Plus clicked
                            setTimeout(function() {
                                renderAdditionalLocations(locationQuantity, locationFieldsetType, locationFieldset, mustRepeatFieldsets, autofillRepeatFieldsets);
                                if (checkoutInstance && typeof checkoutInstance.updateContext === 'function') {
                                    setTimeout(function() {
                                        checkoutInstance.updateContext({ locationCount: locationQuantity });
                                        try { formFields.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true })); } catch (e) {}
                                    }, 50);
                                }
                            }, 100);
                        });
                    } else {
                        console.warn('[Member] Could not find label element in location fieldset. Fieldset children:', fieldset.children);
                    }
                }
                
                formFields.appendChild(fieldset);
            });
            
        }
        
        // Render checkout options at the bottom of the form
        renderCheckoutOptionsSection();
        
        // Render additional locations if quantity > 1 (after checkout section is rendered)
        if (locationQuantity > 1 && locationFieldset) {
            setTimeout(function() {
                renderAdditionalLocations(locationQuantity, locationFieldsetType, locationFieldset, mustRepeatFieldsets, autofillRepeatFieldsets);
            }, 100);
        }
        
        // Render terms agreement and submit buttons after checkout options
        renderTermsAndSubmitSection();

        // Show the form wrapper FIRST so any dependent UI (like inline auth gate) can become interactive
        // immediately (no "must click something first" sequencing bug).
        if (formWrapper) formWrapper.hidden = false;

        // Keep submit state reactive: any change inside the form recalculates readiness.
        attachCreatePostValidationListeners();
        updateSubmitButtonState();
    }
    
    function renderAdditionalLocations(quantity, locationType, locationFieldsetData, mustRepeatFieldsets, autofillRepeatFieldsets) {
        // renderAdditionalLocations called
        
        // Remove existing additional locations
        var existingLocations = formFields.querySelectorAll('.member-additional-location');
        existingLocations.forEach(function(el) {
            el.remove();
        });
        
        // Don't render if quantity is 1 or less
        if (quantity <= 1) {
            // Quantity is 1 or less, not rendering additional locations
            return;
        }
        
        // Find insertion point - before checkout options section
        var checkoutSection = formFields.querySelector('.member-checkout-wrapper');
        if (!checkoutSection) {
            console.warn('[Member] Checkout section not found, cannot render additional locations');
            return;
        }
        
        if (!locationFieldsetData) {
            console.warn('[Member] locationFieldsetData is not set, cannot render additional locations');
            return;
        }
        
        // Render locations 2, 3, 4, etc.
        for (var i = 2; i <= quantity; i++) {
            var locationSection = document.createElement('div');
            locationSection.className = 'member-additional-location';
            locationSection.dataset.locationNumber = i;
            
            // Location header
            var locationHeader = document.createElement('h3');
            locationHeader.className = 'member-additional-location-header';
            var locationName = locationType.charAt(0).toUpperCase() + locationType.slice(1) + ' ' + i;
            locationHeader.textContent = locationName;
            locationSection.appendChild(locationHeader);
            
            // First, render the location fieldset again (venue/city/address)
            // Rendering location
            
            // Create a copy of the field data with updated name
            var locationFieldData = {};
            for (var prop in locationFieldsetData) {
                if (locationFieldsetData.hasOwnProperty(prop)) {
                    locationFieldData[prop] = locationFieldsetData[prop];
                }
            }
            locationFieldData.name = locationName;
            
            // Building fieldset for location
            
            var locationFieldsetClone = FieldsetBuilder.buildFieldset(locationFieldData, {
                idPrefix: 'memberCreate',
                fieldIndex: 0,
                locationNumber: i,
                container: locationSection,
                defaultCurrency: getDefaultCurrencyForForms()
            });
            
            try {
                // Fieldset validity UI is component-owned (FieldsetBuilder sets dataset flags + required star state).
            } catch (e) {}
            
            // Built fieldset for location
            locationSection.appendChild(locationFieldsetClone);
            
            // Then, render must-repeat fieldsets
            mustRepeatFieldsets.forEach(function(fieldData, fieldIndex) {
                // Defensive: location fieldset is rendered separately above; never render it again here.
                var key = (fieldData && (fieldData.fieldsetKey || fieldData.key || fieldData.type)) ? String(fieldData.fieldsetKey || fieldData.key || fieldData.type).toLowerCase() : '';
                if (key === 'venue' || key === 'city' || key === 'address' || key === 'location') {
                    return;
                }
                var fieldset = FieldsetBuilder.buildFieldset(fieldData, {
                    idPrefix: 'memberCreate',
                    fieldIndex: fieldIndex,
                    locationNumber: i,
                    container: locationSection,
                    defaultCurrency: getDefaultCurrencyForForms()
                });
                
                try {
                    // Fieldset validity UI is component-owned (FieldsetBuilder sets dataset flags + required star state).
                } catch (e) {}
                
                locationSection.appendChild(fieldset);

                // Number repeated fieldsets by location number (2, 3, 4...)
                var labelTextEl = fieldset.querySelector('.fieldset-label-text');
                if (labelTextEl) {
                    if (!fieldset.dataset.baseLabel) {
                        fieldset.dataset.baseLabel = (labelTextEl.textContent || '').trim();
                    }
                    var base = fieldset.dataset.baseLabel || '';
                    if (base) {
                        labelTextEl.textContent = base + ' ' + i;
                    }
                }
                
                // If autofill-repeat, copy values from first location
                var isAutofill = autofillRepeatFieldsets.indexOf(fieldData) !== -1;
                if (isAutofill) {
                    // Copy from location 1
                    setTimeout(function() {
                        copyFieldsetValues(fieldset, fieldData, 1, i);
                    }, 100);
                }
            });
            
            // Insert before checkout options
            // Inserting location section before checkout section
            formFields.insertBefore(locationSection, checkoutSection);
        }
        
        // Finished rendering additional locations
    }
    
    function copyFieldsetValues(targetFieldset, fieldData, sourceLocation, targetLocation) {
        if (!formFields) throw new Error('[Member] copyFieldsetValues: formFields not available.');
        if (!targetFieldset) throw new Error('[Member] copyFieldsetValues: targetFieldset is required.');
        if (!fieldData) throw new Error('[Member] copyFieldsetValues: fieldData is required.');
        
        var fieldsetKeyLower = String(fieldData.key || fieldData.fieldset_key || fieldData.fieldsetKey || '').toLowerCase();
        if (!fieldsetKeyLower) throw new Error('[Member] copyFieldsetValues: fieldset key is required.');
        
        // Find the location-1 fieldset by its canonical key (set by FieldsetBuilder)
        var sourceFieldset = null;
        var allFieldsets = formFields.querySelectorAll('.fieldset');
        for (var i = 0; i < allFieldsets.length; i++) {
            var fs = allFieldsets[i];
            if (!fs || !fs.dataset) continue;
            if (fs.closest('.member-additional-location')) continue;
            var k = String(fs.dataset.fieldsetKey || '').toLowerCase();
            if (k === fieldsetKeyLower) {
                sourceFieldset = fs;
                break;
            }
        }
        
        if (!sourceFieldset) {
            throw new Error('[Member] copyFieldsetValues: could not find source fieldset for key "' + fieldsetKeyLower + '".');
        }
        
        var sourceInputs = sourceFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
        var targetInputs = targetFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
        if (sourceInputs.length !== targetInputs.length) {
            throw new Error('[Member] copyFieldsetValues: input count mismatch for key "' + fieldsetKeyLower + '" (source ' + sourceInputs.length + ', target ' + targetInputs.length + ').');
        }
        
        sourceInputs.forEach(function(sourceInput, index) {
            targetInputs[index].value = sourceInput.value;
            var event = new Event('input', { bubbles: true });
            targetInputs[index].dispatchEvent(event);
        });
    }
    
    function renderCheckoutOptionsSection() {
        if (!formFields || checkoutOptions.length === 0) return;
        
        // Get subcategory data for surcharge and type
        var surchargePercent = 0;
        var subcategoryType = 'General';
        if (memberCategories && memberCategories.length > 0) {
            var category = memberCategories.find(function(c) {
                return c.name === selectedCategory;
            });
            if (category && category.subFees && category.subFees[selectedSubcategory]) {
                var subData = category.subFees[selectedSubcategory];
                if (subData.checkout_surcharge !== null && subData.checkout_surcharge !== undefined) {
                    var parsedSurcharge = parseFloat(subData.checkout_surcharge);
                    if (!isNaN(parsedSurcharge)) surchargePercent = parsedSurcharge;
                }
                if (subData.subcategory_type) {
                    subcategoryType = subData.subcategory_type;
                }
            }
        }
        
        var isEvent = subcategoryType === 'Events';
        
        // Create checkout options wrapper
        var wrapper = document.createElement('div');
        wrapper.className = 'fieldset member-checkout-wrapper';
        
        // Label
        var label = document.createElement('div');
        label.className = 'fieldset-label';
        var labelText = surchargePercent !== 0
            ? ('Checkout Options (' + (surchargePercent > 0 ? '+' : '') + surchargePercent.toFixed(2) + '% surcharge)')
            : 'Checkout Options';
        label.innerHTML = '<span class="fieldset-label-text">' + labelText + '</span><span class="fieldset-label-required">*</span>';
        wrapper.appendChild(label);
        
        function getEventVenueDaysFromDom(locationQty) {
            var qty = parseInt(locationQty, 10) || 1;
            if (qty < 1) qty = 1;
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            function daysToIso(iso) {
                if (!iso || typeof iso !== 'string') return null;
                var d = new Date(iso.trim() + 'T00:00:00');
                if (!d || isNaN(d.getTime())) return null;
                d.setHours(0, 0, 0, 0);
                var diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays > 0 ? diffDays : 1;
            }

            function getMaxSelectedIso(fieldsetEl) {
                if (!fieldsetEl) return null;
                var isSessionPricing = false;
                try { isSessionPricing = String(fieldsetEl.dataset.fieldsetKey || '') === 'session_pricing'; } catch (e0) { isSessionPricing = false; }
                var selector = isSessionPricing
                    ? '.fieldset-sessionpricing-calendar-day--selected[data-iso]'
                    : '.fieldset-calendar-day.selected[data-iso]';
                var days = fieldsetEl.querySelectorAll(selector);
                var latest = null;
                days.forEach(function(el) {
                    var iso = el.dataset.iso;
                    if (!iso) return;
                    if (!latest || iso > latest) latest = iso;
                });
                return latest;
            }

            var result = [];

            // Location 1 sessions are in the main form (not inside .member-additional-location)
            // Use session_pricing fieldset.
            var mainSessions = formFields.querySelector('.fieldset[data-fieldset-key="session_pricing"]');
            var mainIso = getMaxSelectedIso(mainSessions);
            result.push(mainIso ? daysToIso(mainIso) : 0);

            // Locations 2+ are inside .member-additional-location sections
            for (var i = 2; i <= qty; i++) {
                var section = formFields.querySelector('.member-additional-location[data-location-number="' + i + '"]');
                var fs = section ? section.querySelector('.fieldset[data-fieldset-key="session_pricing"]') : null;
                var iso = getMaxSelectedIso(fs);
                result.push(iso ? daysToIso(iso) : 0);
            }

            return result;
        }

        function updateCheckoutContext() {
            if (!checkoutInstance || typeof checkoutInstance.updateContext !== 'function') return;
            if (isEvent) {
                checkoutInstance.updateContext({
                    surchargePercent: surchargePercent,
                    locationCount: window._memberLocationQuantity || 1,
                    eventVenueDays: getEventVenueDaysFromDom(window._memberLocationQuantity || 1)
                });
            } else {
                checkoutInstance.updateContext({
                    surchargePercent: surchargePercent,
                    locationCount: window._memberLocationQuantity || 1
                });
            }
        }

        // Always point the module-level sessions-change listener at the latest updater.
        renderCheckoutOptionsSection._updateCheckoutContext = updateCheckoutContext;
        
        // Create checkout options using CheckoutOptionsComponent
        if (typeof CheckoutOptionsComponent !== 'undefined') {
            // Location quantity is tracked outside checkout; store globally so updates can read it.
            if (!window._memberLocationQuantity) window._memberLocationQuantity = 1;
            checkoutInstance = CheckoutOptionsComponent.create(wrapper, {
                checkoutOptions: checkoutOptions,
                currency: siteCurrency,
                surchargePercent: surchargePercent,
                isEvent: isEvent,
                locationCount: window._memberLocationQuantity || 1,
                eventVenueDays: isEvent ? getEventVenueDaysFromDom(window._memberLocationQuantity || 1) : null,
                baseId: 'member-create',
                groupName: 'member-create-checkout-option',
                onSelect: function(optionId, days, price) {
                    // Selection handler - can be used for validation
                }
            });

            // Live updates for events when session dates change
            if (formFields) {
                var needsAttach = (!renderCheckoutOptionsSection._listenersAttached) || (renderCheckoutOptionsSection._listenerTarget !== formFields);
                if (needsAttach) {
                    // If we ever re-create the form root, detach from the old one first.
                    if (renderCheckoutOptionsSection._listenerTarget && renderCheckoutOptionsSection._listenerHandler) {
                        try {
                            renderCheckoutOptionsSection._listenerTarget.removeEventListener('fieldset:sessions-change', renderCheckoutOptionsSection._listenerHandler);
                        } catch (e) {}
                    }
                    renderCheckoutOptionsSection._listenerTarget = formFields;
                    renderCheckoutOptionsSection._listenerHandler = function() {
                        if (typeof renderCheckoutOptionsSection._updateCheckoutContext === 'function') {
                            renderCheckoutOptionsSection._updateCheckoutContext();
                        }
                    };
                    formFields.addEventListener('fieldset:sessions-change', renderCheckoutOptionsSection._listenerHandler);
                    renderCheckoutOptionsSection._listenersAttached = true;
                }
            }
            // Apply initial context (ensures prices reflect current locations + dates)
            updateCheckoutContext();
        }
        
        formFields.appendChild(wrapper);
    }
    
    // Form terms agreement row element
    var formTermsCheckbox = null;
    
    function renderTermsAndSubmitSection() {
        if (!formFields) return;
        
        // Terms agreement row
        var termsWrapper = document.createElement('div');
        termsWrapper.className = 'fieldset member-terms-agreement';
        
        var checkboxWrapper = document.createElement('label');
        checkboxWrapper.className = 'member-terms-agreement-label';
        
        formTermsCheckbox = document.createElement('input');
        formTermsCheckbox.type = 'checkbox';
        formTermsCheckbox.className = 'member-terms-agreement-checkbox';
        formTermsCheckbox.checked = termsAgreed;
        formTermsCheckbox.addEventListener('change', function() {
            termsAgreed = formTermsCheckbox.checked;
            updateSubmitButtonState();
        });
        
        var labelText = document.createElement('span');
        labelText.className = 'member-terms-agreement-text';
        labelText.textContent = 'I agree to the ';
        
        var termsLinkInline = document.createElement('a');
        termsLinkInline.href = '#';
        termsLinkInline.className = 'member-terms-agreement-link';
        termsLinkInline.textContent = 'Terms and Conditions';
        termsLinkInline.addEventListener('click', function(e) {
            e.preventDefault();
            openTermsModal();
        });
        
        checkboxWrapper.appendChild(formTermsCheckbox);
        checkboxWrapper.appendChild(labelText);
        checkboxWrapper.appendChild(termsLinkInline);
        termsWrapper.appendChild(checkboxWrapper);
        formFields.appendChild(termsWrapper);
        
        // Submit buttons container
        var actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'member-create-actions';
        
        // Main submit button
        submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'member-button-submit';
        submitBtn.textContent = 'Submit';
        submitBtn.disabled = true;
        actionsWrapper.appendChild(submitBtn);
        
        // Admin submit button (hidden by default)
        adminSubmitBtn = document.createElement('button');
        adminSubmitBtn.type = 'button';
        adminSubmitBtn.className = 'member-button-admin-submit';
        adminSubmitBtn.textContent = 'Admin: Submit Free';
        adminSubmitBtn.disabled = true;
        adminSubmitBtn.hidden = true;
        
        // Show admin button if user is admin
        if (currentUser && currentUser.isAdmin) {
            adminSubmitBtn.hidden = false;
        }
        
        actionsWrapper.appendChild(adminSubmitBtn);
        formFields.appendChild(actionsWrapper);
        // Hover popover listing all missing items (no toasts; button stays truly disabled)
        attachMissingPopoverToButton(submitBtn, function() { return getCreatePostMissingList({ mode: null }); });
        attachMissingPopoverToButton(adminSubmitBtn, function() { return getCreatePostMissingList({ mode: null }); });
        
        // Attach click handlers for submit buttons
        submitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleCreatePostSubmit(false);
        });
        
        adminSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleCreatePostSubmit(true);
        });

        // Now that the submit buttons exist, compute their real enabled/disabled state.
        updateSubmitButtonState();
    }
    
    function getCreatePostDisabledReason() {
        // Returns { key, placeholders } or null if no reason.
        if (isSubmittingPost) return null;
        if (!termsAgreed) return { key: 'msg_post_terms_required', placeholders: {} };
        if (!selectedCategory || !selectedSubcategory) return { key: 'msg_post_create_no_category', placeholders: {} };
        if (!formFields) return { key: 'msg_post_create_error', placeholders: {} };

        var fieldsetEls = formFields.querySelectorAll('.fieldset[data-complete="false"]');
        for (var i = 0; i < fieldsetEls.length; i++) {
            var fs = fieldsetEls[i];
            if (!fs || !fs.dataset) continue;
            var name = String(fs.dataset.fieldsetName || fs.dataset.fieldsetKey || '').trim() || 'Field';
            var type = String(fs.dataset.fieldsetType || '').trim();
            var baseType = type.replace(/-locked$/, '').replace(/-hidden$/, '');

            // Choose the most appropriate existing message key.
            var msgKey = 'msg_post_validation_required';
            if (baseType === 'custom_dropdown') msgKey = 'msg_post_validation_select';
            if (baseType === 'custom_radio' || baseType === 'checkout') msgKey = 'msg_post_validation_choose';
            if (baseType === 'images') msgKey = 'msg_post_validation_file_required';
            if (baseType === 'item-pricing' || baseType === 'session_pricing') msgKey = 'msg_post_validation_pricing';
            if (baseType === 'address' || baseType === 'city' || baseType === 'venue') msgKey = 'msg_post_validation_location';

            return { key: msgKey, placeholders: { field: name } };
        }
        return { key: 'msg_post_create_error', placeholders: {} };
    }

    function getCreatePostMissingList(options) {
        options = options || {};
        var mode = options.mode || null; // 'login' | 'register' | null
        var out = [];
        if (isSubmittingPost) return out;
        if (!selectedCategory || !selectedSubcategory) out.push('Category / Subcategory');
        if (!formFields) return out;

        // Incomplete/invalid items in on-screen order (DOM order).
        // - Fieldsets own their own completeness via data-complete
        // - Checkout uses .member-checkout-group[data-complete]
        var fieldsets = formFields.querySelectorAll('.fieldset[data-complete="false"], .member-checkout-group[data-complete="false"]');
        for (var i = 0; i < fieldsets.length; i++) {
            var fs = fieldsets[i];
            if (!fs || !fs.dataset) continue;
            if (fs.classList.contains('member-checkout-group')) {
                out.push('Checkout Options');
                continue;
            }
            var name = String(fs.dataset.fieldsetName || fs.dataset.fieldsetKey || '').trim();
            if (name) out.push(name);
        }
        
        // Terms appear near the bottom of the form, just before the submit buttons.
        if (!termsAgreed) out.push('Terms and Conditions');

        // Auth fields (login/register) appear AFTER Terms when those panels are in the submit flow.
        if (mode === 'login') {
            try {
                if (createAuthLoginEmailInput && String(createAuthLoginEmailInput.value || '').trim() === '') {
                    var lbl = createAuthLoginPanel ? createAuthLoginPanel.querySelector('label[for="memberCreateLoginEmail"]') : null;
                    var txt = lbl ? String(lbl.textContent || '').trim() : '';
                    out.push(txt || 'Email');
                }
                if (createAuthLoginPasswordInput && String(createAuthLoginPasswordInput.value || '').trim() === '') {
                    var lbl2 = createAuthLoginPanel ? createAuthLoginPanel.querySelector('label[for="memberCreateLoginPassword"]') : null;
                    var txt2 = lbl2 ? String(lbl2.textContent || '').trim() : '';
                    out.push(txt2 || 'Password');
                }
            } catch (e1) {}
        } else if (mode === 'register') {
            try {
                if (createAuthRegisterPanel) {
                    var req = createAuthRegisterPanel.querySelectorAll('.fieldset[data-required="true"][data-complete="false"]');
                    for (var j = 0; j < req.length; j++) {
                        var fs2 = req[j];
                        if (!fs2 || !fs2.dataset) continue;
                        var nm = String(fs2.dataset.fieldsetName || fs2.dataset.fieldsetKey || '').trim();
                        if (nm) out.push(nm);
                    }
                }
            } catch (e2) {}
        }

        // Dedupe (stable order)
        var seen = {};
        var uniq = [];
        out.forEach(function(v) {
            var k = String(v || '').trim();
            if (!k) return;
            if (seen[k]) return;
            seen[k] = true;
            uniq.push(k);
        });
        return uniq;
    }

    function attachMissingPopoverToButton(btnEl, getItemsFn) {
        if (!btnEl) return;
        if (btnEl._missingPopoverAttached) return;
        btnEl._missingPopoverAttached = true;
        
        // Anchor popover in the nearest container so it appears next to the button.
        var anchorEl = btnEl.parentElement || btnEl;
        try {
            if (anchorEl && anchorEl.style && !anchorEl.style.position) {
                anchorEl.style.position = 'relative';
            }
        } catch (e0) {}
        
        var pop = document.createElement('div');
        pop.className = 'member-missing-popover';
        pop.hidden = true;

        var title = document.createElement('div');
        title.className = 'member-missing-popover-title';
        title.textContent = 'Missing';
        pop.appendChild(title);

        var list = document.createElement('div');
        list.className = 'member-missing-popover-list';
        pop.appendChild(list);

        anchorEl.appendChild(pop);

        function renderItems(items) {
            list.innerHTML = '';
            if (!items || !items.length) return;
            items.forEach(function(item) {
                var row = document.createElement('div');
                row.className = 'member-missing-popover-item';
                row.textContent = String(item);
                list.appendChild(row);
            });
        }

        function show() {
            // Never show for hidden/non-rendered buttons (prevents any premature triggers).
            try {
                if (btnEl.hidden) return;
                if (btnEl.offsetParent === null) return; // display:none or detached
            } catch (e0) {}
            if (!btnEl.disabled) return;
            var items = [];
            try { items = (typeof getItemsFn === 'function') ? (getItemsFn() || []) : []; } catch (e0) { items = []; }
            if (!items || items.length === 0) return;
            renderItems(items);
            pop.hidden = false;
        }
        function hide() {
            pop.hidden = true;
        }
        
        // Trigger ONLY when hovering directly over the button.
        btnEl.addEventListener('mouseenter', function() { show(); });
        btnEl.addEventListener('mouseleave', function(e) {
            var rt = e && e.relatedTarget;
            if (rt && pop.contains(rt)) return;
            hide();
        });
        pop.addEventListener('mouseleave', function() { hide(); });

        // Tap/click anywhere else closes it (non-persistent)
        document.addEventListener('pointerdown', function(e) {
            if (pop.hidden) return;
            var t = e && e.target;
            if (!t) return;
            if (btnEl.contains(t) || pop.contains(t)) return;
            hide();
        }, true);
    }

    function isCreatePostFormReadyForSubmit() {
        if (isSubmittingPost) return false;
        if (!termsAgreed) return false;
        if (!selectedCategory || !selectedSubcategory) return false;
        if (!formFields) return false;

        // Component-owned validity: do not submit if ANY fieldset is incomplete (required or optional-but-invalid).
        var fieldsetEls = formFields.querySelectorAll('.fieldset[data-complete]');
        for (var i = 0; i < fieldsetEls.length; i++) {
            var fs = fieldsetEls[i];
            if (!fs || !fs.dataset) continue;
            if (String(fs.dataset.complete || '') !== 'true') {
                return false;
            }
        }
        return true;
    }

    function updateSubmitButtonState() {
        var ready = isCreatePostFormReadyForSubmit();
        var loggedIn = hasValidLoggedInUser();

        // Logged-in users: use the normal submit buttons.
        if (submitBtn) {
            submitBtn.hidden = !loggedIn;
            submitBtn.disabled = (!ready || !loggedIn);
        }
        if (adminSubmitBtn) {
            // Admin button only relevant when logged in as admin (never when logged out).
            adminSubmitBtn.hidden = !(loggedIn && currentUser && currentUser.isAdmin);
            adminSubmitBtn.disabled = (!ready || !(loggedIn && currentUser && currentUser.isAdmin));
        }

        // Logged-out users: mount/unmount inline auth submit UI on demand (no hidden subtree).
        // Only mount once the create form exists/visible.
        var showGate = (!loggedIn && formWrapper && formWrapper.hidden === false);
        if (showGate) {
            ensureCreateAuthGateMounted();
        } else {
            if (createAuthWrapper) unmountCreateAuthGate();
        }

        var active = createAuthWrapper ? String(createAuthWrapper.dataset.active || 'login') : 'login';
        var isLoginActive = active !== 'register';
        var isRegisterActive = active === 'register';

        var loginFilled = !!(createAuthLoginEmailInput && String(createAuthLoginEmailInput.value || '').trim() && createAuthLoginPasswordInput && String(createAuthLoginPasswordInput.value || '').trim());
        if (createAuthLoginSubmitBtn) {
            // Three-button rule: this is a submit action, so it must stay disabled until the post form is complete.
            createAuthLoginSubmitBtn.disabled = (loggedIn || !isLoginActive || !loginFilled || !ready);
        }
        if (createAuthRegisterSubmitBtn) {
            // Three-button rule: this is a submit action, so it must stay disabled until the post form is complete.
            createAuthRegisterSubmitBtn.disabled = (loggedIn || !isRegisterActive || !isCreateAuthRegisterComplete() || !ready);
        }
    }
    
    /* --------------------------------------------------------------------------
       POST SUBMISSION
       -------------------------------------------------------------------------- */
    
    var isSubmittingPost = false;
    
    function handleCreatePostSubmit(isAdminFree) {
        if (isSubmittingPost) return;

        // Posting requires a real member session (posts.member_id is NOT NULL).
        // When logged out, show inline Login/Register under the form so drafts are not lost.
        if (!hasValidLoggedInUser()) {
            showCreateAuthGate(isAdminFree);
            return;
        }
        
        // Validate terms agreed
        if (!termsAgreed) {
            if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                getMessage('msg_post_terms_required', {}, false).then(function(msg) {
                    if (msg) ToastComponent.showError(msg);
                });
            }
            return;
        }
        
        // Validate category/subcategory selected
        if (!selectedCategory || !selectedSubcategory) {
            if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                getMessage('msg_post_create_no_category', {}, false).then(function(msg) {
                    if (msg) ToastComponent.showError(msg);
                });
            }
            return;
        }
        
        // Collect and validate form fields
        var validation = validateAndCollectFormData();
        if (validation.errorKey) {
            if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                getMessage(validation.errorKey, validation.errorPlaceholders || {}, false).then(function(msg) {
                    if (msg) ToastComponent.showError(msg);
                });
            }
            if (validation.focusElement && typeof validation.focusElement.focus === 'function') {
                validation.focusElement.focus();
            }
            return;
        }
        
        // Start submission
        isSubmittingPost = true;
        if (submitBtn) submitBtn.disabled = true;
        if (adminSubmitBtn) adminSubmitBtn.disabled = true;
        
        // Submit the post
        submitPostData(validation.payload, isAdminFree)
            .then(function(result) {
                isSubmittingPost = false;
                updateSubmitButtonState();
                
                if (result && (result.success === true || result.success === 1 || result.success === '1')) {
                    if (window.ToastComponent && typeof ToastComponent.showSuccess === 'function') {
                        // Prefer backend message key if provided (message system only).
                        var key = (result && result.message_key) ? String(result.message_key) : 'msg_post_create_success';
                        getMessage(key, {}, false).then(function(msg) {
                            if (msg) ToastComponent.showSuccess(msg);
                        });
                    }
                    // Reset form
                    resetCreatePostForm();
                    // Land on My Posts after successful post.
                    try { requestTabSwitch('myposts'); } catch (e0) {}
                } else {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        // Prefer message system keys from backend (no hardcoded server strings).
                        if (result && result.message_key) {
                            var ph = (result.placeholders && typeof result.placeholders === 'object') ? result.placeholders : {};
                            getMessage(String(result.message_key), ph, false).then(function(msg) {
                                if (msg) ToastComponent.showError(msg);
                                else {
                                    getMessage('msg_post_create_error', {}, false).then(function(fallback) {
                                        if (fallback) ToastComponent.showError(fallback);
                                    });
                                }
                            });
                        } else {
                            getMessage('msg_post_create_error', {}, false).then(function(msg) {
                                if (msg) ToastComponent.showError(msg);
                            });
                        }
                    }
                }
            })
            .catch(function(err) {
                console.error('[Member] Post submission failed:', err);
                isSubmittingPost = false;
                updateSubmitButtonState();
                
                if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                    if (err && err.message_key) {
                        getMessage(String(err.message_key), {}, false).then(function(msg) {
                            if (msg) ToastComponent.showError(msg);
                            else {
                                getMessage('msg_post_create_error', {}, false).then(function(fallback) {
                                    if (fallback) ToastComponent.showError(fallback);
                                });
                            }
                        });
                    } else {
                        getMessage('msg_post_create_error', {}, false).then(function(msg) {
                            if (msg) ToastComponent.showError(msg);
                        });
                    }
                }
            });
    }
    
    function validateAndCollectFormData() {
        var payload = {
            category: selectedCategory,
            subcategory: selectedSubcategory,
            fields: []
        };
        
        // Get all rendered fieldsets
        var fieldsetEls = formFields ? formFields.querySelectorAll('[data-fieldset-key]') : [];
        
        for (var i = 0; i < fieldsetEls.length; i++) {
            var el = fieldsetEls[i];
            var fieldsetKey = el.dataset.fieldsetKey;
            var fieldType = el.dataset.fieldsetType || '';
            var fieldName = el.dataset.fieldsetName || fieldsetKey;
            var required = el.dataset.required === 'true';
            // Location grouping: main form = 1, additional locations have a wrapper with data-location-number.
            var locationNumber = 1;
            try {
                var locWrap = el.closest ? el.closest('.member-additional-location[data-location-number]') : null;
                if (locWrap && locWrap.dataset && locWrap.dataset.locationNumber) {
                    locationNumber = parseInt(locWrap.dataset.locationNumber, 10) || 1;
                }
            } catch (e0) {}
            
            var value = extractFieldValue(el, fieldType);
            
            // Validate required fields
            if (required && isEmptyValue(value, fieldType)) {
                return {
                    errorKey: 'msg_post_validation_required',
                    errorPlaceholders: { field: fieldName },
                    focusElement: findFocusableInFieldset(el, fieldType)
                };
            }
            
            payload.fields.push({
                key: fieldsetKey,
                type: fieldType,
                name: fieldName,
                value: value,
                location_number: locationNumber
            });
        }

        // Checkout Options are rendered as a fieldset wrapper but were not DB-driven; include explicitly.
        try {
            var checkoutEl = formFields ? formFields.querySelector('.member-checkout-wrapper') : null;
            if (checkoutEl) {
                payload.fields.push({
                    key: 'checkout',
                    type: 'checkout',
                    name: 'Checkout Options',
                    value: extractFieldValue(checkoutEl, 'checkout'),
                    location_number: 1
                });
            }
        } catch (e1) {}
        
        return { payload: payload };
    }
    
    function extractFieldValue(el, fieldType) {
        var baseType = fieldType.replace(/-locked$/, '').replace(/-hidden$/, '');
        
        switch (baseType) {
            case 'text':
            case 'text-short':
            case 'text-medium':
            case 'text-long':
            case 'email':
            case 'account_email':
            case 'public_email':
            case 'url':
                var input = el.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"]');
                return input ? input.value.trim() : '';
                
            case 'custom_textarea':
            case 'description':
                var textarea = el.querySelector('textarea');
                return textarea ? textarea.value.trim() : '';
                
            case 'number':
                var numInput = el.querySelector('input[type="number"], input[type="text"]');
                return numInput ? numInput.value.trim() : '';
                
            case 'custom_dropdown':
                var menuBtn = el.querySelector('button.form-preview-select');
                var select = el.querySelector('select');
                if (menuBtn) return menuBtn.dataset.value || '';
                if (select) return select.value || '';
                return '';
                
            case 'custom_radio':
                var checked = el.querySelector('input[type="radio"]:checked');
                return checked ? checked.value : '';

            case 'public_phone':
                // Store atomically (DB has phone_prefix + public_phone).
                // No fallbacks: if either part is missing, return empty so required validation blocks submit.
                try {
                    var pfxInput = el.querySelector('.fieldset-menu-button-input');
                    var telInput = el.querySelector('input[type="tel"].fieldset-input');
                    var pfx = pfxInput ? String(pfxInput.value || '').trim() : '';
                    var num = telInput ? String(telInput.value || '').trim() : '';
                    if (!pfx || !num) return '';
                    return { phone_prefix: pfx, public_phone: num };
                } catch (eP) {
                    return '';
                }

            case 'custom_text':
                var txt = el.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"]');
                return txt ? txt.value.trim() : '';
                
            case 'checkbox':
                var cb = el.querySelector('input[type="checkbox"]');
                return cb ? cb.checked : false;
                
            case 'switch':
                var sw = el.querySelector('input[type="checkbox"]');
                return sw ? sw.checked : false;
                
            case 'date':
            case 'date-time':
                var dateInput = el.querySelector('input[type="date"], input[type="datetime-local"], input[type="text"]');
                return dateInput ? dateInput.value.trim() : '';
                
            case 'images':
                // New-site Images fieldset stores selection/crop metadata in a hidden JSON input.
                // The create-post flow submits JSON (not multipart), so we validate against the meta payload.
                var meta = el.querySelector('input.fieldset-images-meta');
                if (meta) {
                    var raw = String(meta.value || '').trim();
                    if (!raw) return [];
                    try {
                        var arr = JSON.parse(raw);
                        return Array.isArray(arr) ? arr : [];
                    } catch (e) {
                        return [];
                    }
                }
                // Legacy fallback: file input based extraction.
                var fileInput = el.querySelector('input[type="file"]');
                if (fileInput && fileInput._imageFiles) return fileInput._imageFiles.slice();
                if (fileInput && fileInput.files) return Array.from(fileInput.files);
                return [];

            case 'checkout':
                try {
                    // Capture the checked radio; store option_id + days + price when available.
                    var checked = el.querySelector('input[type="radio"]:checked');
                    if (!checked) return null;
                    return {
                        value: String(checked.value || ''),
                        option_id: checked.dataset ? (checked.dataset.optionId || '') : '',
                        days: checked.dataset && checked.dataset.days ? (parseInt(checked.dataset.days, 10) || null) : null,
                        price: checked.dataset && checked.dataset.price ? (parseFloat(checked.dataset.price) || null) : null
                    };
                } catch (e0) {
                    return null;
                }

            case 'address':
            case 'city':
                try {
                    var addr = el.querySelector('input.fieldset-input');
                    var lat = el.querySelector('input.fieldset-lat');
                    var lng = el.querySelector('input.fieldset-lng');
                    var cc = el.querySelector('input.fieldset-country');
                    return {
                        address_line: addr ? String(addr.value || '').trim() : '',
                        latitude: lat ? String(lat.value || '').trim() : '',
                        longitude: lng ? String(lng.value || '').trim() : '',
                        country_code: cc ? String(cc.value || '').trim() : ''
                    };
                } catch (e1) {
                    return { address_line: '', latitude: '', longitude: '', country_code: '' };
                }

            case 'venue':
                try {
                    var inputs = el.querySelectorAll('input.fieldset-input');
                    var venueName = inputs && inputs[0] ? String(inputs[0].value || '').trim() : '';
                    var venueAddr = inputs && inputs[1] ? String(inputs[1].value || '').trim() : '';
                    var vLat = el.querySelector('input.fieldset-lat');
                    var vLng = el.querySelector('input.fieldset-lng');
                    var vCc = el.querySelector('input.fieldset-country');
                    return {
                        venue_name: venueName,
                        address_line: venueAddr,
                        latitude: vLat ? String(vLat.value || '').trim() : '',
                        longitude: vLng ? String(vLng.value || '').trim() : '',
                        country_code: vCc ? String(vCc.value || '').trim() : ''
                    };
                } catch (e2) {
                    return { venue_name: '', address_line: '', latitude: '', longitude: '', country_code: '' };
                }

                case 'session_pricing':
                try {
                    // Sessions portion: each time includes ticket_group_key
                    var selectedDays2 = el.querySelectorAll('.fieldset-sessionpricing-session-field-label--selected[data-iso]');
                    var dates2 = [];
                    selectedDays2.forEach(function(d) {
                        var iso = d.dataset.iso;
                        if (iso) dates2.push(String(iso));
                    });
                    dates2.sort();
                    var sessionsOut = [];
                    for (var i2 = 0; i2 < dates2.length; i2++) {
                        var dateStr2 = dates2[i2];
                        var times2 = [];
                        el.querySelectorAll('input.fieldset-sessionpricing-session-field-time-input[data-date="' + dateStr2 + '"]').forEach(function(t) {
                            if (!t) return;
                            var v = String(t.value || '').trim();
                            var tgk = t.dataset ? String(t.dataset.ticketGroupKey || '').trim() : '';
                            times2.push({ time: v, ticket_group_key: tgk });
                        });
                        sessionsOut.push({ date: dateStr2, times: times2 });
                    }

                    // Ticket pricing groups: { [ticket_group_key]: [ { seating_area, tiers:[...] } ] }
                    var pricingGroups = {};
                    var groupsWrap = el.querySelector('.fieldset-sessionpricing-ticketgroups-container');
                    if (groupsWrap) {
                        groupsWrap.querySelectorAll('.fieldset-sessionpricing-ticketgroup-item').forEach(function(groupEl) {
                            if (!groupEl) return;
                            var gk = groupEl.dataset ? String(groupEl.dataset.ticketGroupKey || '').trim() : '';
                            if (!gk) return;
                            var editorEl = groupEl.querySelector('.fieldset-sessionpricing-pricing-editor') || groupEl;
                            var seatingBlocks2 = editorEl.querySelectorAll('.fieldset-sessionpricing-pricing-seating-block');
                            var seatOut2 = [];
                            seatingBlocks2.forEach(function(block) {
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
                                seatOut2.push({ seating_area: seatName, tiers: tiers });
                            });
                            pricingGroups[gk] = seatOut2;
                        });
                    }

                    return {
                        sessions: sessionsOut,
                        pricing_groups: pricingGroups
                    };
                } catch (e33) {
                    return { sessions: [], pricing_groups: {} };
                }

            case 'item-pricing':
                try {
                    var itemNameInput = el.querySelector('input.fieldset-itempricing-input-itemname');
                    var item_name = itemNameInput ? String(itemNameInput.value || '').trim() : '';
                    var currencyInput = el.querySelector('input.component-currencycompact-menu-button-input');
                    var currency = currencyInput ? String(currencyInput.value || '').trim() : '';
                    var priceInput = el.querySelector('input.fieldset-itempricing-input-itemprice');
                    var item_price = priceInput ? String(priceInput.value || '').trim() : '';
                    var item_variants = [];
                    el.querySelectorAll('.fieldset-itempricing-row-itemvariant').forEach(function(row) {
                        var variantInput = row.querySelector('input.fieldset-itempricing-input-itemvariantname');
                        var variantName = variantInput ? String(variantInput.value || '').trim() : '';
                        item_variants.push(variantName);
                    });
                    return { item_name: item_name, currency: currency, item_price: item_price, item_variants: item_variants };
                } catch (e5) {
                    return { item_name: '', currency: '', item_price: '', item_variants: [] };
                }
                
            case 'currency':
                var currBtn = el.querySelector('button[data-currency-value]');
                return currBtn ? currBtn.dataset.currencyValue || '' : '';
                
            case 'amenities':
                // New-site amenities are rendered as rows with Yes/No radios (no dataset payload).
                // Return a stable array of answers so required validation works and backend can consume it.
                try {
                    var rows = el.querySelectorAll('.fieldset-amenities-row');
                    if (!rows || rows.length === 0) return [];
                    var out = [];
                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        if (!row) return [];
                        var nameEl = row.querySelector('.fieldset-amenities-row-text');
                        var amenityName = nameEl ? String(nameEl.textContent || '').trim() : '';
                        var checked = row.querySelector('input[type="radio"]:checked');
                        if (!checked) return []; // incomplete
                        out.push({
                            amenity: amenityName,
                            value: String(checked.value || '')
                        });
                    }
                    return out;
                } catch (e) {
                    return [];
                }
                
            default:
                // Try to get value from any input
                var anyInput = el.querySelector('input, select, textarea');
                if (anyInput) {
                    if (anyInput.type === 'checkbox') return anyInput.checked;
                    return anyInput.value || '';
                }
                return '';
        }
    }
    
    function isEmptyValue(value, fieldType) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (typeof value === 'boolean') return false; // booleans are never "empty"
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }
    
    function findFocusableInFieldset(el, fieldType) {
        var selectors = ['input:not([type="hidden"])', 'select', 'textarea', 'button'];
        for (var i = 0; i < selectors.length; i++) {
            var found = el.querySelector(selectors[i]);
            if (found) return found;
        }
        return null;
    }
    
    function submitPostData(payload, isAdminFree) {
        return new Promise(function(resolve, reject) {
            // Submit as multipart so we can include image files and keep the whole publish flow server-side.
            // This avoids "draft" uploads and prevents unused Bunny files.
            var postData = {
                subcategory_key: payload.subcategory,
                member_id: currentUser ? currentUser.id : null,
                member_name: currentUser ? (currentUser.username || currentUser.name || '') : '',
                member_type: currentUser && currentUser.isAdmin ? 'admin' : 'member',
                skip_payment: isAdminFree,
                loc_qty: window._memberLocationQuantity || 1,
                fields: payload.fields
            };

            var fd = new FormData();
            fd.set('payload', JSON.stringify(postData));

            // Attach image files (if any) from the Images fieldset (stored as fileInput._imageFiles).
            try {
                var imagesFs = formFields ? formFields.querySelector('.fieldset[data-fieldset-type="images"], .fieldset[data-fieldset-key="images"]') : null;
                var fileInput = imagesFs ? imagesFs.querySelector('input[type="file"]') : null;
                var metaInput = imagesFs ? imagesFs.querySelector('input.fieldset-images-meta') : null;
                var files = [];
                if (fileInput && Array.isArray(fileInput._imageFiles)) {
                    files = fileInput._imageFiles.slice();
                }
                files.forEach(function(file) {
                    if (file) fd.append('images[]', file, file.name || 'image');
                });
                if (metaInput) {
                    fd.set('images_meta', String(metaInput.value || '[]'));
                }
            } catch (e0) {}

            fetch('/gateway.php?action=add-post', {
                method: 'POST',
                body: fd
            })
            .then(function(response) {
                return response.text().then(function(text) {
                    var parsed = null;
                    try {
                        parsed = text ? JSON.parse(text) : null;
                    } catch (e) {
                        // Server responded with non-JSON (PHP error, HTML error page, etc.)
                        var err = new Error('add-post returned non-JSON response (HTTP ' + response.status + ')');
                        err.http_status = response.status;
                        err.body = text;
                        throw err;
                    }
                    if (parsed && typeof parsed === 'object') {
                        parsed.http_status = response.status;
                    }
                    return parsed;
                });
            })
            .then(function(data) {
                resolve(data);
            })
            .catch(function(err) {
                reject(err);
            });
        });
    }
    
    function resetCreatePostForm() {
        // Reset selections
        selectedCategory = '';
        selectedSubcategory = '';
        termsAgreed = false;
        
        // Hide form wrapper
        if (formWrapper) formWrapper.hidden = true;
        if (formFields) formFields.innerHTML = '';
        
        // Reset state
        submitBtn = null;
        adminSubmitBtn = null;
        
        // Re-render formpicker (category/subcategory dropdowns)
        renderFormpicker(document.getElementById('member-formpicker-cats'));
    }
    
    /* --------------------------------------------------------------------------
       TERMS AND CONDITIONS MODAL
       -------------------------------------------------------------------------- */
    
    async function openTermsModal() {
        if (!termsModalContainer) {
            await createTermsModal();
        }
        termsModalContainer.classList.remove('terms-modal-container--hidden');
    }
    
    function closeTermsModal() {
        if (termsModalContainer) {
            termsModalContainer.classList.add('terms-modal-container--hidden');
        }
    }
    
    function agreeAndCloseModal() {
        termsAgreed = true;
        if (formTermsCheckbox) {
            formTermsCheckbox.checked = true;
        }
        updateSubmitButtonState();
        closeTermsModal();
    }
    
    async function createTermsModal() {
        termsModalContainer = document.createElement('div');
        termsModalContainer.className = 'terms-modal-container terms-modal-container--hidden';
        
        var modal = document.createElement('div');
        modal.className = 'terms-modal';
        
        // Header
        var header = document.createElement('div');
        header.className = 'terms-modal-header';
        
        var title = document.createElement('h2');
        title.className = 'terms-modal-title';
        title.textContent = 'Terms and Conditions';
        
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'terms-modal-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeTermsModal);
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Content
        var content = document.createElement('div');
        content.className = 'terms-modal-content';
        
        var termsText = document.createElement('div');
        termsText.className = 'terms-modal-text';
        
        // Fetch terms from database
        if (typeof window.getMessage === 'function') {
            var msg = await window.getMessage('msg-terms-conditions', {}, false);
            if (msg) {
                termsText.innerHTML = msg;
            }
        }
        content.appendChild(termsText);
        
        // Footer
        var footer = document.createElement('div');
        footer.className = 'terms-modal-footer';
        
        var agreeButton = document.createElement('button');
        agreeButton.type = 'button';
        agreeButton.className = 'terms-modal-agree-btn';
        agreeButton.textContent = 'Agree';
        agreeButton.addEventListener('click', agreeAndCloseModal);
        
        footer.appendChild(agreeButton);
        
        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(footer);
        termsModalContainer.appendChild(modal);
        
        // Close on background click
        termsModalContainer.addEventListener('click', function(e) {
            if (e.target === termsModalContainer) {
                closeTermsModal();
            }
        });
        
        document.body.appendChild(termsModalContainer);
    }
    
    // Ensure field has safe defaults
    function ensureFieldDefaults(field) {
        if (!field || typeof field !== 'object') {
            return {
                name: '',
                // Canonical DB-driven strings
                fieldset_placeholder: '',
                fieldset_tooltip: '',
                
                // Editable overrides from fieldset_mods
                customPlaceholder: '',
                customTooltip: '',
                
                // Legacy/compat (do not rely on these for new-site behavior)
                placeholder: '',
                tooltip: '',
                options: [],
                selectedAmenities: null,
                fieldsetKey: '',
                key: '',
                type: '',
                // min/max are DB-driven; do not hardcode defaults here.
                // For multi-field fieldsets, these are often null and should remain null.
                min_length: null,
                max_length: null,
                required: false,
                location_repeat: false,
                must_repeat: false,
                autofill_repeat: false
            };
        }
        var result = {
            name: '',
            // Canonical DB-driven strings
            fieldset_placeholder: '',
            fieldset_tooltip: '',
            
            // Editable overrides from fieldset_mods
            customPlaceholder: '',
            customTooltip: '',
            
            // Legacy/compat (do not rely on these for new-site behavior)
            placeholder: '',
            tooltip: '',
            options: [],
            selectedAmenities: null,
            fieldsetKey: '',
            key: '',
            type: '',
            // min/max are DB-driven; do not hardcode defaults here.
            // For multi-field fieldsets, these are often null and should remain null.
            min_length: null,
            max_length: null,
            required: false,
            location_repeat: false,
            must_repeat: false,
            autofill_repeat: false
        };
        
        if (field.name && typeof field.name === 'string') {
            result.name = field.name;
        }
        
        // Canonical fieldset placeholder/tooltip from DB
        if (field.fieldset_placeholder && typeof field.fieldset_placeholder === 'string') {
            result.fieldset_placeholder = field.fieldset_placeholder;
        }
        if (field.fieldset_tooltip && typeof field.fieldset_tooltip === 'string') {
            result.fieldset_tooltip = field.fieldset_tooltip;
        }
        
        // Editable overrides from fieldset_mods JSON
        if (field.customPlaceholder && typeof field.customPlaceholder === 'string') {
            result.customPlaceholder = field.customPlaceholder;
        }
        if (field.customTooltip && typeof field.customTooltip === 'string') {
            result.customTooltip = field.customTooltip;
        }
        
        // Legacy/compat (do not rely on these for new-site behavior)
        if (field.placeholder && typeof field.placeholder === 'string') {
            result.placeholder = field.placeholder;
        }
        if (field.tooltip && typeof field.tooltip === 'string') {
            result.tooltip = field.tooltip;
        }
        if (Array.isArray(field.options)) {
            result.options = field.options;
        }

        // Preserve amenities limiter from subcategories.fieldset_mods (loaded by get-form.php)
        // Expected shape: field.selectedAmenities = ["Parking", "Wheelchair Access", ...]
        // Development strictness: if present but invalid, throw (no silent fallback).
        if (field.selectedAmenities !== undefined && field.selectedAmenities !== null && !Array.isArray(field.selectedAmenities)) {
            throw new Error('Member form: field.selectedAmenities must be an array when provided.');
        }
        if (Array.isArray(field.selectedAmenities)) {
            var safeAmenities = field.selectedAmenities.filter(function(v) {
                return typeof v === 'string' && v.trim() !== '';
            });
            if (safeAmenities.length !== field.selectedAmenities.length) {
                throw new Error('Member form: field.selectedAmenities must contain only non-empty strings.');
            }
            result.selectedAmenities = safeAmenities;
        }
        if (field.fieldsetKey && typeof field.fieldsetKey === 'string') {
            result.fieldsetKey = field.fieldsetKey;
        } else if (field.key && typeof field.key === 'string') {
            result.fieldsetKey = field.key;
        } else if (field.type && typeof field.type === 'string') {
            result.fieldsetKey = field.type;
        }
        if (field.key && typeof field.key === 'string') {
            result.key = field.key;
        }
        if (field.type && typeof field.type === 'string') {
            result.type = field.type;
        }
        if (typeof field.min_length === 'number') {
            result.min_length = field.min_length;
        }
        if (typeof field.max_length === 'number') {
            result.max_length = field.max_length;
        }

        // Preserve required flag from backend/formbuilder
        if (typeof field.required === 'boolean') {
            result.required = field.required;
        } else if (field.required === 1 || field.required === '1') {
            result.required = true;
        } else if (field.required === 'true') {
            result.required = true;
        } else if (typeof field.is_required === 'boolean') {
            result.required = field.is_required;
        } else if (field.is_required === 1 || field.is_required === '1') {
            result.required = true;
        } else if (field.is_required === 'true') {
            result.required = true;
        }

        // Preserve repeat flags if provided by backend/formbuilder
        if (typeof field.location_repeat === 'boolean') {
            result.location_repeat = field.location_repeat;
        } else if (typeof field.locationRepeat === 'boolean') {
            result.location_repeat = field.locationRepeat;
        } else if (field.location_repeat === 1 || field.location_repeat === '1') {
            result.location_repeat = true;
        }

        if (typeof field.must_repeat === 'boolean') {
            result.must_repeat = field.must_repeat;
        } else if (typeof field.mustRepeat === 'boolean') {
            result.must_repeat = field.mustRepeat;
        } else if (field.must_repeat === 1 || field.must_repeat === '1') {
            result.must_repeat = true;
        }

        if (typeof field.autofill_repeat === 'boolean') {
            result.autofill_repeat = field.autofill_repeat;
        } else if (typeof field.autofillRepeat === 'boolean') {
            result.autofill_repeat = field.autofillRepeat;
        } else if (field.autofill_repeat === 1 || field.autofill_repeat === '1') {
            result.autofill_repeat = true;
        }
        
        return result;
    }
    
    function getFieldsForSelection(categoryName, subcategoryName) {
        if (!memberCategories || memberCategories.length === 0) return [];
        
        var category = memberCategories.find(function(c) {
            return c.name === categoryName;
        });
        
        if (!category || !category.subFields) return [];
        
        return category.subFields[subcategoryName] || [];
    }

    /* --------------------------------------------------------------------------
       AUTH PANEL SWITCHING (Login/Register)
       -------------------------------------------------------------------------- */
    
    function setAuthPanel(target) {
        if (!authForm || authForm.dataset.state === 'logged-in') return;
        
        var isLogin = target === 'login';
        
        // Update subtab buttons
        if (loginTab) loginTab.classList.toggle('member-auth-tab--selected', isLogin);
        if (registerTab) registerTab.classList.toggle('member-auth-tab--selected', !isLogin);
        if (loginTab) loginTab.setAttribute('aria-selected', isLogin ? 'true' : 'false');
        if (registerTab) registerTab.setAttribute('aria-selected', !isLogin ? 'true' : 'false');
        
        // Update panels
        setAuthPanelState(loginPanel, isLogin, loginInputs);
        setAuthPanelState(registerPanel, !isLogin, registerInputs);

        if (!isLogin) {
            // Support tab opened
            loadSupporterMessage();
            syncSupporterCurrencyUi();
            initSupporterCountryMenu();
            // Ensure avatar grid is rendered with first avatar selected
            ensureAvatarChoicesReady();
            renderRegisterFieldsets();
            // Default to the first preset amount if none selected yet (no hardcoding).
            try {
                if (supporterAmountHiddenInput && String(supporterAmountHiddenInput.value || '').trim() === '') {
                    if (supporterPresetButtons && supporterPresetButtons.length) {
                        var firstAmt = String(supporterPresetButtons[0].getAttribute('data-amount') || '').trim();
                        if (firstAmt) setSupporterAmount(firstAmt);
                    }
                }
            } catch (e) {
                // ignore
            }

            // Focus first payment option (first preset button)
            try {
                if (supporterPresetButtons && supporterPresetButtons.length && supporterPresetButtons[0]) {
                    requestAnimationFrame(function() {
                        try {
                            supporterPresetButtons[0].focus();
                        } catch (e) {
                            // ignore
                        }
                    });
                }
            } catch (e) {
                // ignore
            }
        }
        
        authForm.dataset.active = target;
        
        // Focus behavior:
        // - Login: focus first input
        // - Support FunMap: focus first payment option (avoid caret in the custom amount input)
        if (isLogin) {
            focusFirstField(loginPanel);
        } else {
            try {
                if (supporterPresetButtons && supporterPresetButtons.length && supporterPresetButtons[0]) {
                    requestAnimationFrame(function() {
                        try {
                            supporterPresetButtons[0].focus();
                        } catch (e) {
                            // ignore
                        }
                    });
                }
            } catch (e) {
                // ignore
            }
        }
    }

    function getSiteCurrencyCode() {
        try {
            if (!window.App || typeof App.getState !== 'function') return null;
            var settings = App.getState('settings') || {};
            var code = settings.website_currency || settings.site_currency || settings.siteCurrency || null;
            if (!code) return null;
            code = String(code).trim();
            return code ? code : null;
        } catch (e) {
            return null;
        }
    }

    function syncSupporterCurrencyUi() {
        var code = getSiteCurrencyCode();
        if (!code) return;
        if (supporterCustomAmountInput) {
            supporterCustomAmountInput.placeholder = code + ' 0.00';
        }
        if (supporterPresetButtons && supporterPresetButtons.length) {
            supporterPresetButtons.forEach(function(btn) {
                var amt = String(btn.getAttribute('data-amount') || '').trim();
                if (!amt) return;
                // Match site-wide formatting used in checkout options: "USD 2.00"
                var n = parseFloat(amt);
                var formatted = isFinite(n) ? n.toFixed(2) : amt;
                btn.textContent = code + ' ' + formatted;
            });
        }

        // Ensure the submit button always shows currency context.
        try {
            if (!registerPanel) return;
            var submitBtn = registerPanel.querySelector('.member-auth-submit[data-action="register"]');
            if (!submitBtn) return;
            var baseLabel = submitBtn.getAttribute('data-base-label');
            if (!baseLabel) {
                baseLabel = String(submitBtn.textContent || '').trim();
                submitBtn.setAttribute('data-base-label', baseLabel);
            }
            var rawAmt = supporterAmountHiddenInput ? String(supporterAmountHiddenInput.value || '').trim() : '';
            var nAmt = parseFloat(rawAmt);
            var formattedAmt = isFinite(nAmt) ? nAmt.toFixed(2) : '';
            if (formattedAmt) {
                submitBtn.textContent = baseLabel + ' — ' + code + ' ' + formattedAmt;
            } else {
                submitBtn.textContent = baseLabel;
            }
        } catch (e) {
            // ignore
        }
    }

    function initSupporterCountryMenu() {
        try {
            if (!supporterCountryMenuContainer || !supporterCountryHiddenInput) return;
            if (!window.CountryComponent || typeof CountryComponent.loadFromDatabase !== 'function') return;
            if (supporterCountryMenuInstance) return;
            
            CountryComponent.loadFromDatabase().then(function() {
                supporterCountryMenuContainer.innerHTML = '';
                supporterCountryMenuInstance = CountryComponent.buildMenu({
                    initialValue: (supporterCountryHiddenInput.value || '').toLowerCase() || null,
                    onSelect: function(code) {
                        supporterCountryHiddenInput.value = String(code || '').toLowerCase();
                    }
                });
                if (supporterCountryMenuInstance && supporterCountryMenuInstance.element) {
                    supporterCountryMenuContainer.appendChild(supporterCountryMenuInstance.element);
                }
            });
        } catch (e) {
            console.warn('[Member] Failed to init supporter country menu', e);
        }
    }

    /* --------------------------------------------------------------------------
       AUTH FIELDSETS (Register + Profile)
       Rendered via MemberAuthFieldsetsComponent (components file).
       -------------------------------------------------------------------------- */

    var authFieldsetsReady = false;
    var authFieldsetsPromise = null;
    var registerValidityListenerAttached = false;

    function findFirstIncompleteRegisterFieldset() {
        if (!registerFieldsetsContainer) return null;
        var required = registerFieldsetsContainer.querySelectorAll('.fieldset[data-required="true"]');
        if (!required || required.length === 0) return null;
        for (var i = 0; i < required.length; i++) {
            var fs = required[i];
            if (!fs || !fs.dataset) continue;
            if (String(fs.dataset.complete || '') !== 'true') return fs;
        }
        return null;
    }

    function isRegisterFormComplete() {
        // Registration rule: all fieldsets in this section are required and must be complete.
        var incomplete = findFirstIncompleteRegisterFieldset();
        return !incomplete;
    }

    function updateRegisterSubmitButtonState() {
        try {
            if (!registerPanel) return;
            var btn = registerPanel.querySelector('.member-auth-submit[data-action="register"]');
            if (!btn) return;
            var complete = isRegisterFormComplete();
            btn.disabled = !complete;
        } catch (e) {
            // ignore
        }
    }

    function renderRegisterFieldsets() {
        if (!registerPanel || !registerFieldsetsContainer) return;
        if (!window.MemberAuthFieldsetsComponent || typeof MemberAuthFieldsetsComponent.renderRegister !== 'function') return;
        if (authFieldsetsReady) return;

        authFieldsetsPromise = MemberAuthFieldsetsComponent.renderRegister(registerFieldsetsContainer, {
            avatarHost: avatarGridRegister,
            countryHost: supporterCountryMenuContainer
        }).then(function(refs) {
            authFieldsetsReady = true;
            registerUsernameInput = refs ? refs.usernameInput : null;
            registerEmailInput = refs ? refs.emailInput : null;
            registerPasswordInput = refs ? refs.passwordInput : null;
            registerConfirmInput = refs ? refs.confirmInput : null;

            // Refresh registerInputs list (used for enable/disable + clearing)
            try {
                registerInputs = Array.from(registerPanel.querySelectorAll('input, textarea, select'));
            } catch (e) {}

            // Registration submit button is disabled until all required fieldsets are complete.
            // Drive state purely from component-owned dataset flags + events.
            if (!registerValidityListenerAttached) {
                try {
                    registerFieldsetsContainer.addEventListener('fieldset:validity-change', function() {
                        updateRegisterSubmitButtonState();
                    });
                    registerValidityListenerAttached = true;
                } catch (e2) {}
            }
            updateRegisterSubmitButtonState();
        });
    }

    function renderProfileFieldsets() {
        if (!profilePanel || !profileFieldsetsContainer) return;
        if (!currentUser) return;
        if (!window.MemberAuthFieldsetsComponent || typeof MemberAuthFieldsetsComponent.renderProfile !== 'function') return;

        MemberAuthFieldsetsComponent.renderProfile(profileFieldsetsContainer, {
            avatarHost: avatarGridProfile,
            usernameValue: profileOriginalName || ''
        }).then(function(refs) {
            profileEditNameInput = refs ? refs.usernameInput : null;
            profileEditPasswordInput = refs ? refs.newPasswordInput : null;
            profileEditConfirmInput = refs ? refs.confirmInput : null;

            // Input listeners (now that inputs exist)
            try {
                if (profileEditNameInput) profileEditNameInput.addEventListener('input', updateProfileSaveState);
                if (profileEditPasswordInput) profileEditPasswordInput.addEventListener('input', updateProfileSaveState);
                if (profileEditConfirmInput) profileEditConfirmInput.addEventListener('input', updateProfileSaveState);
            } catch (e) {}

            try {
                updateProfileSaveState();
                updateHeaderSaveDiscardState();
            } catch (e) {}
        });
    }

    function setSupporterAmount(amount, options) {
        options = options || {};
        var value = String(amount || '').trim();

        // Enforce minimum $1 for custom amounts (and any other non-empty value).
        // Allow under-min values only while the user is typing.
        if (!options.allowUnderMin && value !== '') {
            var n = parseFloat(value);
            if (isFinite(n) && n < 1) {
                value = '1';
            }
            // Format to 2 decimals when it's a valid number (so it reads like money).
            if (isFinite(n)) {
                var nn = parseFloat(value);
                if (isFinite(nn)) value = nn.toFixed(2);
            }
        }
        if (supporterAmountHiddenInput) supporterAmountHiddenInput.value = value;

        if (supporterCustomAmountInput) {
            // If the value was clamped/formatted, write it back so the UI matches the hidden value.
            if (!options.fromCustom || (!options.allowUnderMin)) {
                var code = getSiteCurrencyCode();
                if (code && value) {
                    supporterCustomAmountInput.value = code + ' ' + value;
                } else {
                    supporterCustomAmountInput.value = value ? value : '';
                }
            }
        }

        if (supporterPresetButtons && supporterPresetButtons.length) {
            var vNum = parseFloat(value);
            var vFixed = isFinite(vNum) ? vNum.toFixed(2) : null;
            supporterPresetButtons.forEach(function(btn) {
                var btnAmount = String(btn.getAttribute('data-amount') || '');
                var bNum = parseFloat(btnAmount);
                var bFixed = isFinite(bNum) ? bNum.toFixed(2) : null;
                var isSelected = (vFixed !== null && bFixed !== null && vFixed === bFixed);
                btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            });
        }

        // Keep submit button label in sync with the current amount.
        try {
            if (!registerPanel) return;
            var submitBtn = registerPanel.querySelector('.member-auth-submit[data-action="register"]');
            if (!submitBtn) return;
            var baseLabel = submitBtn.getAttribute('data-base-label');
            if (!baseLabel) {
                baseLabel = String(submitBtn.textContent || '').trim();
                submitBtn.setAttribute('data-base-label', baseLabel);
            }
            var code = getSiteCurrencyCode();
            if (!code) {
                submitBtn.textContent = baseLabel;
                return;
            }
            var nAmt = parseFloat(value);
            var formattedAmt = isFinite(nAmt) ? nAmt.toFixed(2) : '';
            if (formattedAmt) {
                submitBtn.textContent = baseLabel + ' — ' + code + ' ' + formattedAmt;
            } else {
                submitBtn.textContent = baseLabel;
            }
        } catch (e) {
            // ignore
        }
    }

    function loadSupporterMessage() {
        try {
            if (!supporterMessageEl) return;
            var key = supporterMessageEl.getAttribute('data-message-key') || '';
            key = String(key || '').trim();
            if (!key) return;
            if (typeof window.getMessage !== 'function') return;
            window.getMessage(key, {}, false).then(function(message) {
                if (!message) return;
                supporterMessageEl.innerHTML = message;
            }).catch(function() {
                // no fallback text (rules)
            });
        } catch (e) {
            // ignore
        }
    }

    /* --------------------------------------------------------------------------
       CREATE POST INLINE AUTH GATE (Login/Register under create form)
       -------------------------------------------------------------------------- */

    function hasValidLoggedInUser() {
        var idNum = currentUser ? parseInt(currentUser.id, 10) : 0;
        return !!(currentUser && isFinite(idNum) && idNum > 0);
    }

    function setCreateAuthPanel(target) {
        if (!createAuthWrapper) return;
        target = (target === 'register') ? 'register' : 'login';
        var isLogin = target === 'login';

        if (createAuthLoginTab) createAuthLoginTab.classList.toggle('member-auth-tab--selected', isLogin);
        if (createAuthRegisterTab) createAuthRegisterTab.classList.toggle('member-auth-tab--selected', !isLogin);
        // These are not role="tab" (to allow click-hold bottom slack), so use aria-pressed for toggle state.
        if (createAuthLoginTab) createAuthLoginTab.setAttribute('aria-pressed', isLogin ? 'true' : 'false');
        if (createAuthRegisterTab) createAuthRegisterTab.setAttribute('aria-pressed', !isLogin ? 'true' : 'false');

        if (createAuthLoginPanel) {
            createAuthLoginPanel.classList.toggle('member-auth-panel--hidden', !isLogin);
            createAuthLoginPanel.hidden = !isLogin;
        }
        if (createAuthRegisterPanel) {
            createAuthRegisterPanel.classList.toggle('member-auth-panel--hidden', isLogin);
            createAuthRegisterPanel.hidden = isLogin;
        }

        createAuthWrapper.dataset.active = target;

        if (!isLogin) {
            ensureCreateAuthRegisterReady();
        }
        updateSubmitButtonState();
    }

    function unmountCreateAuthGate() {
        try {
            if (createAuthWrapper && createAuthWrapper.parentNode) {
                createAuthWrapper.parentNode.removeChild(createAuthWrapper);
            }
        } catch (e0) {}
        createAuthWrapper = null;
        createAuthLoginTab = null;
        createAuthRegisterTab = null;
        createAuthLoginPanel = null;
        createAuthRegisterPanel = null;
        createAuthLoginForm = null;
        createAuthRegisterForm = null;
        createAuthLoginEmailInput = null;
        createAuthLoginPasswordInput = null;
        createAuthLoginSubmitBtn = null;
        createAuthRegisterSubmitBtn = null;
        createAuthRegisterFieldsets = null;
        avatarGridCreate = null;
        createCountryMenuContainer = null;
        createCountryHiddenInput = null;
        avatarPickerCreate = null;
        createAuthRegisterRendered = false;
        createAuthRegisterUsernameInput = null;
        createAuthRegisterEmailInput = null;
        createAuthRegisterPasswordInput = null;
        createAuthRegisterConfirmInput = null;
        pendingCreateAuthAvatarBlob = null;
        pendingCreateAuthSiteUrl = '';
        pendingCreateAuthAvatarPreviewUrl = '';
    }

    function ensureCreateAuthGateMounted() {
        if (createAuthWrapper) return true;
        if (!formWrapper) return false;
        if (!formFields) return false;
        if (hasValidLoggedInUser()) return false;

        // Build DOM
        var wrap = document.createElement('div');
        wrap.id = 'member-create-auth';
        wrap.className = 'member-auth member-create-auth';
        wrap.dataset.active = 'login';

        var tabs = document.createElement('div');
        tabs.className = 'member-auth-tabs';
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Continue to submit');

        var btnLogin = document.createElement('button');
        btnLogin.type = 'button';
        btnLogin.className = 'member-auth-tab member-auth-tab--selected';
        btnLogin.dataset.target = 'login';
        btnLogin.setAttribute('role', 'button');
        btnLogin.setAttribute('aria-pressed', 'true');
        btnLogin.textContent = 'Log In';

        var btnRegister = document.createElement('button');
        btnRegister.type = 'button';
        btnRegister.className = 'member-auth-tab';
        btnRegister.dataset.target = 'register';
        btnRegister.setAttribute('role', 'button');
        btnRegister.setAttribute('aria-pressed', 'false');
        btnRegister.textContent = 'Register';

        tabs.appendChild(btnLogin);
        tabs.appendChild(btnRegister);
        wrap.appendChild(tabs);

        // Login form
        var loginForm = document.createElement('form');
        loginForm.className = 'member-auth-form';
        loginForm.setAttribute('autocomplete', 'off');

        var loginPanel = document.createElement('section');
        loginPanel.className = 'member-auth-panel';

        var loginLabelEmail = document.createElement('label');
        loginLabelEmail.className = 'member-auth-panel-label';
        loginLabelEmail.setAttribute('for', 'memberCreateLoginEmail');
        loginLabelEmail.textContent = 'Account Email';

        var loginEmail = document.createElement('input');
        loginEmail.type = 'email';
        loginEmail.id = 'memberCreateLoginEmail';
        loginEmail.className = 'member-auth-panel-input';
        loginEmail.name = 'loginEmail';
        loginEmail.autocomplete = 'username';

        var loginLabelPass = document.createElement('label');
        loginLabelPass.className = 'member-auth-panel-label';
        loginLabelPass.setAttribute('for', 'memberCreateLoginPassword');
        loginLabelPass.textContent = 'Password';

        var loginPass = document.createElement('input');
        loginPass.type = 'password';
        loginPass.id = 'memberCreateLoginPassword';
        loginPass.className = 'member-auth-panel-input';
        loginPass.name = 'loginPassword';
        loginPass.autocomplete = 'current-password';

        var loginSubmit = document.createElement('button');
        loginSubmit.type = 'submit';
        loginSubmit.className = 'member-button-submit member-auth-submit';
        loginSubmit.dataset.action = 'create-auth-login';
        loginSubmit.textContent = 'Log In & Submit';

        loginPanel.appendChild(loginLabelEmail);
        loginPanel.appendChild(loginEmail);
        loginPanel.appendChild(loginLabelPass);
        loginPanel.appendChild(loginPass);
        loginPanel.appendChild(loginSubmit);
        loginForm.appendChild(loginPanel);
        wrap.appendChild(loginForm);

        // Register form
        var registerForm = document.createElement('form');
        registerForm.className = 'member-auth-form';
        registerForm.setAttribute('autocomplete', 'off');

        var registerPanel = document.createElement('section');
        registerPanel.className = 'member-auth-panel member-auth-panel--hidden';
        registerPanel.hidden = true;

        var fsContainer = document.createElement('div');
        fsContainer.className = 'fieldset-container';

        var avatarHost = document.createElement('div');
        avatarHost.setAttribute('aria-label', 'Avatar choices');

        var countryMenu = document.createElement('div');
        var countryHidden = document.createElement('input');
        countryHidden.type = 'hidden';
        countryHidden.name = 'country';
        countryHidden.value = '';

        var registerSubmit = document.createElement('button');
        registerSubmit.type = 'submit';
        registerSubmit.className = 'member-button-submit member-auth-submit';
        registerSubmit.dataset.action = 'create-auth-register';
        registerSubmit.textContent = 'Register & Submit';

        registerPanel.appendChild(fsContainer);
        registerPanel.appendChild(avatarHost);
        registerPanel.appendChild(countryMenu);
        registerPanel.appendChild(countryHidden);
        registerPanel.appendChild(registerSubmit);
        registerForm.appendChild(registerPanel);
        wrap.appendChild(registerForm);

        // Insert at bottom of the create form wrapper (after fields)
        formWrapper.appendChild(wrap);

        // Wire refs
        createAuthWrapper = wrap;
        createAuthLoginTab = btnLogin;
        createAuthRegisterTab = btnRegister;
        createAuthLoginForm = loginForm;
        createAuthRegisterForm = registerForm;
        createAuthLoginPanel = loginPanel;
        createAuthRegisterPanel = registerPanel;
        createAuthLoginEmailInput = loginEmail;
        createAuthLoginPasswordInput = loginPass;
        createAuthLoginSubmitBtn = loginSubmit;
        createAuthRegisterSubmitBtn = registerSubmit;
        createAuthRegisterFieldsets = fsContainer;
        avatarGridCreate = avatarHost;
        createCountryMenuContainer = countryMenu;
        createCountryHiddenInput = countryHidden;

        // Events
        createAuthLoginTab.addEventListener('click', function() { setCreateAuthPanel('login'); });
        createAuthRegisterTab.addEventListener('click', function() { setCreateAuthPanel('register'); });
        createAuthLoginForm.addEventListener('submit', function(e) { e.preventDefault(); handleCreateAuthLogin(); });
        createAuthRegisterForm.addEventListener('submit', function(e) { e.preventDefault(); handleCreateAuthRegister(); });
        createAuthWrapper.addEventListener('input', function() { updateSubmitButtonState(); }, true);
        createAuthWrapper.addEventListener('change', function() { updateSubmitButtonState(); }, true);

        // Hover popover listing all missing items (no toasts; button stays truly disabled)
        attachMissingPopoverToButton(createAuthLoginSubmitBtn, function() { return getCreatePostMissingList({ mode: 'login' }); });
        attachMissingPopoverToButton(createAuthRegisterSubmitBtn, function() { return getCreatePostMissingList({ mode: 'register' }); });

        return true;
    }

    function isCreateAuthRegisterComplete() {
        if (!createAuthRegisterPanel) return false;
        // Component-owned validity: require ALL required fieldsets to be complete.
        var req = createAuthRegisterPanel.querySelectorAll('.fieldset[data-required="true"][data-complete]');
        if (!req || !req.length) return false;
        for (var i = 0; i < req.length; i++) {
            var fs = req[i];
            if (!fs || !fs.dataset) continue;
            if (String(fs.dataset.complete || '') !== 'true') return false;
        }
        return true;
    }

    function showCreateAuthGate(isAdminFree) {
        if (!ensureCreateAuthGateMounted()) return;
        createAuthPendingSubmit = true;
        createAuthPendingSubmitIsAdminFree = !!isAdminFree;
        setCreateAuthPanel('login');
        try { createAuthWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e0) {}
    }

    function hideCreateAuthGate() {
        // Remove the gate entirely (no hidden auth subtree allowed).
        unmountCreateAuthGate();
    }

    function ensureCreateAuthRegisterReady() {
        if (createAuthRegisterRendered) return Promise.resolve(true);
        if (!createAuthRegisterFieldsets) return Promise.resolve(false);
        if (!window.MemberAuthFieldsetsComponent || typeof MemberAuthFieldsetsComponent.renderRegister !== 'function') return Promise.resolve(false);
        if (!window.CountryComponent || typeof CountryComponent.loadFromDatabase !== 'function') return Promise.resolve(false);

        // Ensure avatar options are available for the avatar picker.
        ensureAvatarChoicesReady();

        return MemberAuthFieldsetsComponent.renderRegister(createAuthRegisterFieldsets, {
            avatarHost: avatarGridCreate,
            countryHost: createCountryMenuContainer
        }).then(function(refs) {
            createAuthRegisterRendered = true;
            createAuthRegisterUsernameInput = refs ? refs.usernameInput : null;
            createAuthRegisterEmailInput = refs ? refs.emailInput : null;
            createAuthRegisterPasswordInput = refs ? refs.passwordInput : null;
            createAuthRegisterConfirmInput = refs ? refs.confirmInput : null;

            // Country menu (no default; must be selected)
            try {
                CountryComponent.loadFromDatabase().then(function() {
                    if (!createCountryMenuContainer || !createCountryHiddenInput) return;
                    createCountryMenuContainer.innerHTML = '';
                    var inst = CountryComponent.buildMenu({
                        initialValue: (createCountryHiddenInput.value || '').toLowerCase() || null,
                        onSelect: function(code) {
                            createCountryHiddenInput.value = String(code || '').toLowerCase();
                        }
                    });
                    if (inst && inst.element) createCountryMenuContainer.appendChild(inst.element);
                });
            } catch (e1) {}

            // Avatar picker (separate staged state from supporter register)
            try {
                if (avatarGridCreate && window.AvatarPickerComponent && typeof AvatarPickerComponent.attach === 'function') {
                    var choices = Array.isArray(siteAvatarChoices) ? siteAvatarChoices.slice(0, 3) : [];
                    if (avatarPickerCreate && typeof avatarPickerCreate.destroy === 'function') {
                        avatarPickerCreate.destroy();
                    }
                    avatarPickerCreate = AvatarPickerComponent.attach(avatarGridCreate, {
                        siteAvatars: choices,
                        allowUpload: true,
                        resolveSrc: resolveAvatarSrc,
                        selfValue: '',
                        onChange: function(state) {
                            pendingCreateAuthAvatarPreviewUrl = state && state.selfPreviewUrl ? String(state.selfPreviewUrl) : '';
                            if (!state) return;
                            if (state.selectedKey && String(state.selectedKey).indexOf('site-') === 0) {
                                pendingCreateAuthSiteUrl = (state.selectedSite && state.selectedSite.url) ? String(state.selectedSite.url) : '';
                                pendingCreateAuthAvatarBlob = null;
                                pendingCreateAuthAvatarPreviewUrl = '';
                                return;
                            }
                            pendingCreateAuthSiteUrl = '';
                            pendingCreateAuthAvatarBlob = state.selfBlob || null;
                        }
                    });
                    if (!pendingCreateAuthAvatarBlob && !pendingCreateAuthSiteUrl && choices[0] && choices[0].url) {
                        pendingCreateAuthSiteUrl = String(choices[0].url);
                        if (avatarPickerCreate && typeof avatarPickerCreate.setSelectedKey === 'function') {
                            avatarPickerCreate.setSelectedKey('site-0');
                        }
                    }
                }
            } catch (e2) {}

            return true;
        });
    }

    function handleCreateAuthLogin() {
        var emailInput = document.getElementById('memberCreateLoginEmail');
        var passwordInput = document.getElementById('memberCreateLoginPassword');
        var username = emailInput ? String(emailInput.value || '').trim() : '';
        var password = passwordInput ? String(passwordInput.value || '') : '';
        if (!username || !password) return;

        // Three-button rule: "Log In & Submit" is always a submit action.
        createAuthPendingSubmit = true;
        createAuthPendingSubmitIsAdminFree = false;

        verifyLogin(username, password).then(function(result) {
            if (!result || result.success !== true) {
                // Never leave a pending submit armed if auth fails.
                createAuthPendingSubmit = false;
                createAuthPendingSubmitIsAdminFree = false;
                getMessage('msg_auth_login_incorrect', {}, false).then(function(message) {
                    if (message && window.ToastComponent) ToastComponent.showError(message);
                });
                return;
            }
            var payload = result.user || {};
            payload.role = result.role;
            currentUser = buildUserObject(payload, username);
            syncLocalProfilePrefsFromUser(currentUser);
            storeCurrent(currentUser);
            render();

            var shouldSubmit = createAuthPendingSubmit;
            var isAdminFree = createAuthPendingSubmitIsAdminFree;
            // Disarm immediately so a later auth cannot "surprise-submit".
            createAuthPendingSubmit = false;
            createAuthPendingSubmitIsAdminFree = false;
            hideCreateAuthGate();
            updateSubmitButtonState();

            // Toast: login success (message system)
            try {
                var displayName = currentUser.name || currentUser.account_email || currentUser.username;
                getMessage('msg_auth_login_success', { name: displayName }, false).then(function(message) {
                    if (message && window.ToastComponent) ToastComponent.showSuccess(message);
                });
            } catch (e0) {}

            if (shouldSubmit) {
                // Resume the original submit attempt without losing draft.
                setTimeout(function() {
                    handleCreatePostSubmit(isAdminFree);
                }, 0);
            }
        });
    }

    function handleCreateAuthRegister() {
        // Ensure register UI is present
        ensureCreateAuthRegisterReady().then(function() {
            var nameInput = createAuthRegisterUsernameInput;
            var emailInput = createAuthRegisterEmailInput;
            var passwordInput = createAuthRegisterPasswordInput;
            var confirmInput = createAuthRegisterConfirmInput;

            if (!nameInput || !emailInput || !passwordInput || !confirmInput) return;

            var name = String(nameInput.value || '').trim();
            var email = String(emailInput.value || '').trim();
            var password = String(passwordInput.value || '');
            var confirm = String(confirmInput.value || '');
            var countryCode = createCountryHiddenInput ? String(createCountryHiddenInput.value || '').trim() : '';

            if (!name || !email || !password || !confirm || !countryCode) return;
            if (!pendingCreateAuthAvatarBlob && !pendingCreateAuthSiteUrl) return;
            if (password !== confirm) return;

            // Three-button rule: "Register & Submit" is always a submit action.
            createAuthPendingSubmit = true;
            createAuthPendingSubmitIsAdminFree = false;

            function prepareAvatarBlob() {
                if (pendingCreateAuthAvatarBlob) return Promise.resolve(pendingCreateAuthAvatarBlob);
                if (pendingCreateAuthSiteUrl) {
                    return fetch(String(pendingCreateAuthSiteUrl))
                        .then(function(r) { return r.blob(); })
                        .then(function(blob) {
                            return new Promise(function(resolve) {
                                squarePngFromImageBlob(blob, function(out) { resolve(out); });
                            });
                        });
                }
                return Promise.resolve(null);
            }

            prepareAvatarBlob().then(function(avatarBlob) {
                var formData = new FormData();
                formData.set('username', name);
                formData.set('account_email', email);
                formData.set('password', password);
                formData.set('confirm', confirm);
                formData.set('country', countryCode);
                if (avatarBlob) formData.append('avatar_file', avatarBlob, 'avatar.png');

                return fetch('/gateway.php?action=add-member', { method: 'POST', body: formData }).then(function(r) { return r.text(); });
            }).then(function(text) {
                var payload = null;
                try { payload = JSON.parse(text); } catch (e) { payload = null; }
                if (!payload || payload.success === false || payload.error) {
                    // Never leave a pending submit armed if auth fails.
                    createAuthPendingSubmit = false;
                    createAuthPendingSubmitIsAdminFree = false;
                    var key = payload && payload.message_key ? String(payload.message_key) : 'msg_post_create_error';
                    getMessage(key, {}, false).then(function(msg) {
                        if (msg && window.ToastComponent) ToastComponent.showError(msg);
                    });
                    return;
                }

                // Logged in after registration
                payload.role = 'member';
                currentUser = buildUserObject(payload, email);
                storeCurrent(currentUser);
                render();

                var shouldSubmit = createAuthPendingSubmit;
                var isAdminFree = createAuthPendingSubmitIsAdminFree;
                // Disarm immediately so a later auth cannot "surprise-submit".
                createAuthPendingSubmit = false;
                createAuthPendingSubmitIsAdminFree = false;
                hideCreateAuthGate();
                updateSubmitButtonState();

                // Toast: registration success (message system)
                try {
                    getMessage('msg_auth_register_success', { name: name }, false).then(function(message) {
                        if (message && window.ToastComponent) ToastComponent.showSuccess(message);
                    });
                } catch (e0) {}

                if (shouldSubmit) {
                    setTimeout(function() {
                        handleCreatePostSubmit(isAdminFree);
                    }, 0);
                }
            });
        });
    }

    function setAuthPanelState(panelEl, isActive, inputs) {
        if (!panelEl) return;
        
        // Enable/disable inputs
        if (Array.isArray(inputs)) {
            inputs.forEach(function(input) {
                input.disabled = !isActive;
            });
        }
        
        // Enable/disable submit button
        var submitBtn = panelEl.querySelector('.member-auth-submit');
        if (submitBtn) {
            submitBtn.disabled = !isActive;
        }
        
        // Show/hide panel
        panelEl.classList.toggle('member-auth-panel--hidden', !isActive);
        panelEl.hidden = !isActive;
        panelEl.setAttribute('aria-hidden', (!isActive).toString());
        
        if (!isActive) {
            panelEl.setAttribute('inert', '');
        } else {
            panelEl.removeAttribute('inert');
        }
    }

    function focusFirstField(panelEl) {
        if (!panelEl || panelEl.hidden) return;
        
        var target = panelEl.querySelector('input:not([type="hidden"]):not([disabled])');
        if (target && typeof target.focus === 'function') {
            requestAnimationFrame(function() {
                target.focus();
            });
        }
    }

    function attachCreatePostValidationListeners() {
        if (!formFields) return;
        if (attachCreatePostValidationListeners._attachedTo === formFields) return;
        
        // Detach from any previous form root (in case the panel was rebuilt).
        if (attachCreatePostValidationListeners._attachedTo && attachCreatePostValidationListeners._handler) {
            try {
                attachCreatePostValidationListeners._attachedTo.removeEventListener('input', attachCreatePostValidationListeners._handler, true);
                attachCreatePostValidationListeners._attachedTo.removeEventListener('change', attachCreatePostValidationListeners._handler, true);
                attachCreatePostValidationListeners._attachedTo.removeEventListener('blur', attachCreatePostValidationListeners._handler, true);
                attachCreatePostValidationListeners._attachedTo.removeEventListener('fieldset:sessions-change', attachCreatePostValidationListeners._handler, true);
            } catch (e) {}
        }
        
        attachCreatePostValidationListeners._attachedTo = formFields;
        attachCreatePostValidationListeners._handler = function() {
            updateSubmitButtonState();
        };
        
        // Capture phase so we catch events from nested components reliably.
        formFields.addEventListener('input', attachCreatePostValidationListeners._handler, true);
        formFields.addEventListener('change', attachCreatePostValidationListeners._handler, true);
        formFields.addEventListener('blur', attachCreatePostValidationListeners._handler, true);
        formFields.addEventListener('fieldset:sessions-change', attachCreatePostValidationListeners._handler, true);
    }

    /* --------------------------------------------------------------------------
       AUTHENTICATION HANDLERS
       -------------------------------------------------------------------------- */
    
    function handleLogin() {
        var emailInput = document.getElementById('memberLoginEmail');
        var passwordInput = document.getElementById('memberLoginPassword');
        
        var username = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        
        if (!username || !password) {
            getMessage('msg_auth_login_empty', {}, false).then(function(message) {
                if (message) {
                    ToastComponent.showError(message);
                }
            });
            if (!username && emailInput) {
                emailInput.focus();
            } else if (passwordInput) {
                passwordInput.focus();
            }
            return;
        }
        
        // Call backend verification
        verifyLogin(username, password).then(function(result) {
            if (!result || result.success !== true) {
                getMessage('msg_auth_login_incorrect', {}, false).then(function(message) {
                    if (message) {
                        ToastComponent.showError(message);
                    }
                });
                if (passwordInput) {
                    passwordInput.focus();
                    passwordInput.select();
                }
                return;
            }
            
            // Build user object from response
            // API returns { success, role, user } - role is at top level
            var payload = result.user || {};
            payload.role = result.role; // Merge role from top level into payload
            currentUser = buildUserObject(payload, username);
            syncLocalProfilePrefsFromUser(currentUser);
            
            storeCurrent(currentUser);
            render();
            
            // Apply member map settings
            if (currentUser.map_lighting && window.MapModule && window.MapModule.setMapLighting) {
                window.MapModule.setMapLighting(currentUser.map_lighting);
            }
            if (currentUser.map_style && window.MapModule && window.MapModule.setMapStyle) {
                window.MapModule.setMapStyle(currentUser.map_style);
            }
            
            // Refresh map settings buttons
            initMapLightingButtons();
            initMapStyleButtons();
            
            var displayName = currentUser.name || currentUser.account_email || currentUser.username;
            
            // Check if account was reactivated (soft-deleted member logging back in)
            if (result.reactivated === true) {
                getMessage('msg_account_reactivated', {}, false).then(function(message) {
                    if (message && window.ToastComponent) {
                        ToastComponent.showSuccess(message);
                    }
                });
            } else {
                getMessage('msg_auth_login_success', { name: displayName }, false).then(function(message) {
                    if (message) {
                        ToastComponent.showSuccess(message);
                    }
                });
            }
            
        }).catch(function(err) {
            console.error('Login failed', err);
            getMessage('msg_auth_login_failed', {}, false).then(function(message) {
                if (message) {
                    ToastComponent.showError(message);
                }
            });
        });
    }

    function handleRegister() {
        // Hard block register submit until all required registration fieldsets are complete
        // (also prevents Enter-key submit from bypassing the disabled button).
        if (!isRegisterFormComplete()) {
            var first = findFirstIncompleteRegisterFieldset();
            if (first) {
                var focusEl = first.querySelector('input:not([type="hidden"]), select, textarea, button');
                if (focusEl && typeof focusEl.focus === 'function') {
                    focusEl.focus();
                    if (typeof focusEl.select === 'function') focusEl.select();
                }
            }
            updateRegisterSubmitButtonState();
            return;
        }

        var nameInput = registerUsernameInput || document.getElementById('member-register-name');
        var emailInput = registerEmailInput || document.getElementById('member-register-email');
        var passwordInput = registerPasswordInput || document.getElementById('member-register-password');
        var confirmInput = registerConfirmInput || document.getElementById('member-register-confirm');

        // If fieldsets haven't finished rendering yet, don't validate empty values.
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            renderRegisterFieldsets();
            if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                ToastComponent.showError('Please wait, loading the registration fields...');
            }
            return;
        }
        
        var name = nameInput ? nameInput.value.trim() : '';
        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        var confirm = confirmInput ? confirmInput.value : '';
        // Avatar is selected via 4-tile grid:
        // - pendingRegisterAvatarBlob: cropped/uploaded (preferred)
        // - pendingRegisterSiteUrl: chosen site avatar (we copy it into user's avatar file on submit)
        
        function showFieldError(messageKey, placeholders, focusEl) {
            getMessage(messageKey, placeholders || {}, false).then(function(message) {
                if (message) {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(message);
                    } else {
                        showStatus(message, { error: true });
                    }
                    return;
                }
                // No hardcoded fallback: use a known generic register-failed message.
                getMessage('msg_auth_register_failed', {}, false).then(function(fallbackMsg) {
                    if (!fallbackMsg) return;
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(fallbackMsg);
                    } else {
                        showStatus(fallbackMsg, { error: true });
                    }
                });
            });
            if (focusEl && typeof focusEl.focus === 'function') {
                focusEl.focus();
                if (typeof focusEl.select === 'function') focusEl.select();
            }
        }

        // Validation (field-specific using existing DB key with {field} placeholder)
        if (!name) { showFieldError('msg_post_validation_required', { field: 'Username' }, nameInput); return; }
        if (!email) { showFieldError('msg_post_validation_required', { field: 'Email' }, emailInput); return; }
        if (!password) { showFieldError('msg_post_validation_required', { field: 'Password' }, passwordInput); return; }
        if (!confirm) { showFieldError('msg_post_validation_required', { field: 'Confirm Password' }, confirmInput); return; }

        // Avatar is REQUIRED to register
        if (!pendingRegisterAvatarBlob && !pendingRegisterSiteUrl) {
            showFieldError('msg_post_validation_required', { field: 'Avatar' }, null);
            return;
        }
        
        // Country is REQUIRED to register
        try {
            var countryCode = supporterCountryHiddenInput ? String(supporterCountryHiddenInput.value || '').trim() : '';
            if (!countryCode) {
                var focusEl = null;
                if (supporterCountryMenuContainer) {
                    focusEl = supporterCountryMenuContainer.querySelector('input') || supporterCountryMenuContainer.querySelector('button') || null;
                }
                showFieldError('msg_post_validation_required', { field: 'Country' }, focusEl);
                return;
            }
        } catch (e) {
            showFieldError('msg_post_validation_required', { field: 'Country' }, null);
            return;
        }

        // Basic email format check (server still validates too)
        if (emailInput && typeof emailInput.checkValidity === 'function' && !emailInput.checkValidity()) {
            showFieldError('msg_auth_register_email_invalid', {}, emailInput);
            return;
        }
        
        if (password.length < 4) {
            getMessage('msg_auth_register_password_short', {}, false).then(function(message) {
                if (message) {
                    ToastComponent.showError(message);
                }
            });
            if (passwordInput) passwordInput.focus();
            return;
        }
        
        if (password !== confirm) {
            getMessage('msg_auth_register_password_mismatch', {}, false).then(function(message) {
                if (message) {
                    ToastComponent.showError(message);
                }
            });
            if (confirmInput) {
                confirmInput.focus();
                confirmInput.select();
            }
            return;
        }

        // IMPORTANT: Do not store ANY registration data (including avatar uploads) unless payment has gone through.
        // For now, allow free testing ONLY for admins (payment gateway placeholder).
        if (!isSupporterPaymentApprovedForTesting()) {
            showSupporterPaymentRequiredMessage();
            return;
        }
        
        function prepareRegisterAvatarBlob() {
            if (pendingRegisterAvatarBlob) return Promise.resolve(pendingRegisterAvatarBlob);
            if (pendingRegisterSiteUrl) {
                var url = String(pendingRegisterSiteUrl);
                return fetch(url)
                    .then(function(r) { return r.blob(); })
                    .then(function(blob) {
                        return new Promise(function(resolve) {
                            squarePngFromImageBlob(blob, function(out) { resolve(out); });
                        });
                    });
            }
            return Promise.resolve(null);
        }

        prepareRegisterAvatarBlob().then(function(avatarBlob) {
            // Send registration request
            var formData = new FormData();
            formData.set('username', name);
            formData.set('account_email', email);
            formData.set('password', password);
            formData.set('confirm', confirm);
            if (supporterCountryHiddenInput && String(supporterCountryHiddenInput.value || '').trim() !== '') {
                formData.set('country', String(supporterCountryHiddenInput.value || '').trim());
            }
            if (avatarBlob) {
                formData.append('avatar_file', avatarBlob, 'avatar.png');
            }

            return fetch('/gateway.php?action=add-member', {
                method: 'POST',
                body: formData
            }).then(function(response) {
                return response.text();
            });
        }).then(function(text) {
            var payload = null;
            try {
                payload = JSON.parse(text);
            } catch (e) {
                payload = null;
            }
            
            if (!payload || payload.success === false || payload.error) {
                var key = payload && payload.message_key ? String(payload.message_key) : '';
                if (key) {
                    getMessage(key, {}, false).then(function(message) {
                        if (message) {
                            if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                                ToastComponent.showError(message);
                            } else {
                                showStatus(message, { error: true });
                            }
                            return;
                        }
                        // No hardcoded fallback: use a known generic register-failed message.
                        getMessage('msg_auth_register_failed', {}, false).then(function(fallbackMsg) {
                            if (!fallbackMsg) return;
                            if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                                ToastComponent.showError(fallbackMsg);
                            } else {
                                showStatus(fallbackMsg, { error: true });
                            }
                        });
                    });
                    return;
                }
                
                // Treat missing message_key as corrupt response; fail loudly (no silent fallback).
                throw new Error('[Member] Registration failed but response did not include message_key.');
            }
            
            // Build user object
            currentUser = {
                id: payload.id || null,
                name: name,
                email: email,
                emailNormalized: email.toLowerCase(),
                username: email,
                avatar: payload.avatar_file || '',
                type: 'member',
                isAdmin: false
            };
            
            storeCurrent(currentUser);
            render();
            
            getMessage('msg_auth_register_success', { name: name }, false).then(function(message) {
                if (message) {
                    ToastComponent.showSuccess(message);
                }
            });
            
        }).catch(function(err) {
            console.error('Registration failed', err);
            getMessage('msg_auth_register_failed', {}, false).then(function(message) {
                if (message) {
                    ToastComponent.showError(message);
                }
            });
        });
    }

    function isSupporterPaymentApprovedForTesting() {
        // TEMPORARY: Allow all registrations without payment for testing
        // TODO: Revert this when payment gateway is ready
        return true;
        
        /* ORIGINAL CODE - uncomment when done testing:
        try {
            // If payments are enabled, we require a real gateway success signal (not implemented yet).
            // This prevents uploads/emails/DB rows until payment is actually wired.
            var settings = (window.App && typeof App.getState === 'function') ? (App.getState('settings') || {}) : {};
            var paypalEnabled = settings && (settings.paypal_enabled === true || settings.paypal_enabled === 'true');
            if (paypalEnabled) return false;

            // Free testing mode: admin only
            return !!(currentUser && currentUser.isAdmin);
        } catch (e) {
            return false;
        }
        */
    }

    function showSupporterPaymentRequiredMessage() {
        // No hardcoded fallback copy. Use DB message keys where possible.
        var key = 'msg_supporter_payment_required';
        if (typeof window.getMessage === 'function') {
            window.getMessage(key, {}, false).then(function(message) {
                if (message) {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(message);
                    } else {
                        showStatus(message, { error: true });
                    }
                }
            }).catch(function() {
                // Intentionally no fallback text.
            });
        }
    }

    function handleLogout() {
        currentUser = null;
        storeCurrent(null);
        render();
        
        // Revert to admin/localStorage settings
        var lighting = localStorage.getItem('map_lighting') || 'day';
        var style = localStorage.getItem('map_style') || 'standard';
        if (window.MapModule) {
            if (window.MapModule.setMapLighting) {
                window.MapModule.setMapLighting(lighting);
            }
            if (window.MapModule.setMapStyle) {
                window.MapModule.setMapStyle(style);
            }
        }
        
        // Refresh map settings buttons
        initMapLightingButtons();
        initMapStyleButtons();
        
        getMessage('msg_auth_logout_success', {}, false).then(function(message) {
            if (message) {
                ToastComponent.show(message);
            }
        });
        
        // Notify admin auth manager if it exists
        if (window.adminAuthManager && typeof window.adminAuthManager.setAuthenticated === 'function') {
            window.adminAuthManager.setAuthenticated(false);
        }
        
        App.emit('member:logout');
    }

    /* --------------------------------------------------------------------------
       BACKEND VERIFICATION
       -------------------------------------------------------------------------- */
    
    function verifyLogin(username, password) {
        return fetch('/gateway.php?action=verify-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        }).then(function(response) {
            return response.text();
        }).then(function(text) {
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('verifyLogin failed: invalid JSON response', text);
                return { success: false };
            }
        });
    }

    /* --------------------------------------------------------------------------
       USER OBJECT HELPERS
       -------------------------------------------------------------------------- */
    
    function buildUserObject(payload, loginEmail) {
        var emailRaw = typeof payload.account_email === 'string' ? payload.account_email.trim() : '';
        var email = emailRaw || loginEmail || '';
        if (!email) {
            throw new Error('[Member] buildUserObject: account_email is required (payload.account_email or loginEmail).');
        }
        var normalized = email.toLowerCase();
        var username = payload.username || email;
        
        // Check for admin status from API response
        var isAdmin = false;
        if (payload.isAdmin === true) {
            isAdmin = true;
        } else if (payload.role === 'admin') {
            isAdmin = true;
        } else if (Array.isArray(payload.roles) && payload.roles.includes('admin')) {
            isAdmin = true;
        }
        
        return {
            id: payload.id || payload.user_id || null,
            name: payload.username || payload.name || '',
            account_email: email,
            emailNormalized: normalized,
            username: username,
            avatar: payload.avatar || payload.avatar_file || '',
            username_key: payload.username_key || '',
            type: isAdmin ? 'admin' : (payload.type || 'member'),
            isAdmin: isAdmin,
            // Preferences (may be null)
            language: (payload.language !== undefined) ? payload.language : null,
            currency: (payload.currency !== undefined) ? payload.currency : null,
            country_code: (payload.country_code !== undefined) ? payload.country_code : null,
            map_lighting: (payload.map_lighting !== undefined) ? payload.map_lighting : null,
            map_style: (payload.map_style !== undefined) ? payload.map_style : null,
            timezone: (payload.timezone !== undefined) ? payload.timezone : null
        };
    }

    /* --------------------------------------------------------------------------
       SESSION STORAGE
       -------------------------------------------------------------------------- */
    
    function storeCurrent(user) {
        try {
            if (user) {
                localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(CURRENT_KEY);
            }
        } catch (e) {
            console.warn('Failed to store session', e);
        }
    }

    function loadStoredSession() {
        try {
            var raw = localStorage.getItem(CURRENT_KEY);
            if (!raw) return;
            
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.account_email) {
                // Session must include a usable numeric user id; otherwise treat as logged-out.
                // This prevents "looks logged in" states that can't submit posts (member_id missing).
                var idNum = parseInt(parsed.id, 10);
                if (!isFinite(idNum) || idNum <= 0) {
                    currentUser = null;
                    try { localStorage.removeItem(CURRENT_KEY); } catch (e0) {}
                    return;
                }
                parsed.id = idNum;
                currentUser = parsed;
                
                // Notify admin auth if user is admin
                if (currentUser.isAdmin && window.adminAuthManager) {
                    window.adminAuthManager.setAuthenticated(true, currentUser.username || currentUser.account_email);
                }
            }
        } catch (e) {
            console.warn('Failed to load session', e);
        }
    }

    /* --------------------------------------------------------------------------
       AVATAR HELPERS
       -------------------------------------------------------------------------- */
    
    // NOTE: No hard-coded SVG fallbacks allowed.
    // If user has no avatar_file, we hide avatar UI and show the normal member icon in the header.
    function getAvatarSource(user) {
        if (!user) return '';
        var raw = user.avatar ? String(user.avatar).trim() : '';
        if (!raw) return '';
        return resolveAvatarSrc(raw) || raw;
    }

    function setImgOrHide(imgEl, src) {
        if (!imgEl) return;
        if (src) {
            imgEl.hidden = false;
            imgEl.style.display = '';
            imgEl.src = src;
        } else {
            imgEl.hidden = true;
            imgEl.style.display = 'none';
            imgEl.removeAttribute('src');
        }
    }

    /* --------------------------------------------------------------------------
       RENDER
       -------------------------------------------------------------------------- */
    
    function render() {
        if (!authForm) return;
        
        // When auth mode flips (logged-in <-> logged-out), force anchors OFF so no slack leaks between modes.
        // This prevents "short content shoved to footer" and "magnetize to header" behavior caused by leftover slack.
        try {
            var nextState = currentUser ? 'logged-in' : 'logged-out';
            var prevState = authForm.dataset.state || '';
            if (prevState && prevState !== nextState) {
                forceOffMemberButtonAnchors();
            }
        } catch (e0) {}
        
        // Notify admin auth manager
        if (window.adminAuthManager) {
            if (currentUser && currentUser.isAdmin) {
                window.adminAuthManager.setAuthenticated(true, currentUser.username || currentUser.account_email || 'admin');
            } else {
                window.adminAuthManager.setAuthenticated(false);
            }
        }
        
        if (currentUser) {
            // Logged in state
            authForm.dataset.state = 'logged-in';

            // Create Post inline auth must never be visible while logged in.
            // (Login can happen via Profile tab too, so don't rely on updateSubmitButtonState being called.)
            try { hideCreateAuthGate(); } catch (e00) {}
            
            // Hide login/register panels
            setAuthPanelState(loginPanel, false, loginInputs);
            setAuthPanelState(registerPanel, false, registerInputs);

            // Hide the forms themselves to remove the large blank gap
            if (loginFormEl) loginFormEl.hidden = true;
            if (registerFormEl) registerFormEl.hidden = true;
            
            // Clear inputs
            clearInputs(loginInputs);
            clearInputs(registerInputs);
            
            // Show profile panel
            if (profilePanel) {
                profilePanel.classList.remove('member-auth-panel--hidden');
                profilePanel.hidden = false;
                profilePanel.removeAttribute('inert');
            }
            
            // Update profile display
            if (profileAvatar) {
                var descriptor = currentUser.name || currentUser.account_email || 'Member';
                profileAvatar.onerror = null;
                setImgOrHide(profileAvatar, getAvatarSource(currentUser));
                profileAvatar.alt = descriptor + "'s avatar";
            }
            if (profileName) profileName.textContent = currentUser.name || 'Member';
            if (profileEmail) profileEmail.textContent = currentUser.account_email || '';
            
            // Profile edit defaults
            profileOriginalName = currentUser.name || '';
            renderProfileFieldsets();
            profileOriginalAvatarUrl = currentUser.avatar ? String(currentUser.avatar) : '';
            pendingAvatarUrl = profileOriginalAvatarUrl;
            pendingProfileSiteUrl = '';
            pendingProfileAvatarPreviewUrl = '';
            
            // Set hide account switch state
            if (profileHideSwitch) {
                var isHidden = currentUser.hidden === true || currentUser.hidden === 1 || currentUser.hidden === '1';
                profileHideSwitch.setAttribute('aria-checked', isHidden ? 'true' : 'false');
            }
            pendingProfileAvatarBlob = null;
            updateProfileSaveState();
            renderAvatarPickers();
            
            // Hide auth tabs when logged in
            if (authTabs) authTabs.classList.add('member-auth-tabs--logged-in');
            
            // Update header avatar
            updateHeaderAvatar(currentUser);
            
            // Profile tab label is always "Profile" (never changes to "Log In")
            if (profileTabBtn) profileTabBtn.textContent = 'Profile';

            updateHeaderSaveDiscardState();

            // Also refresh create-tab submit visibility state after login.
            try { updateSubmitButtonState(); } catch (e01) {}
            // My Posts tab must not show stale logged-out UI after login.
            try { refreshAuthDependentTabs(); } catch (e02) {}
            
        } else {
            // Logged out state
            authForm.dataset.state = 'logged-out';
            
            // Profile tab label is always "Profile" (never changes to "Log In")
            if (profileTabBtn) profileTabBtn.textContent = 'Profile';
            
            // Hide profile panel
            if (profilePanel) {
                profilePanel.classList.add('member-auth-panel--hidden');
                profilePanel.hidden = true;
                profilePanel.setAttribute('inert', '');
            }
            
            // Clear profile display
            if (profileAvatar) {
                profileAvatar.onerror = null;
                profileAvatar.removeAttribute('src');
                profileAvatar.alt = '';
            }
            if (profileName) profileName.textContent = '';
            if (profileEmail) profileEmail.textContent = '';
            
            profileOriginalName = '';
            if (profileEditNameInput) profileEditNameInput.value = '';
            if (profileEditPasswordInput) profileEditPasswordInput.value = '';
            if (profileEditConfirmInput) profileEditConfirmInput.value = '';
            profileOriginalAvatarUrl = '';
            pendingAvatarUrl = '';
            pendingProfileSiteUrl = '';
            pendingProfileAvatarPreviewUrl = '';
            pendingProfileAvatarBlob = null;
            pendingRegisterSiteUrl = '';
            pendingRegisterAvatarPreviewUrl = '';
            pendingRegisterAvatarBlob = null;
            updateProfileSaveState();
            renderAvatarPickers();
            
            // Show auth tabs
            if (authTabs) authTabs.classList.remove('member-auth-tabs--logged-in');

            if (loginFormEl) loginFormEl.hidden = false;
            if (registerFormEl) registerFormEl.hidden = false;
            
            // Show appropriate auth panel
            var active = authForm.dataset.active === 'register' ? 'register' : 'login';
            setAuthPanel(active);
            
            // Update header (no avatar)
            updateHeaderAvatar(null);

            updateHeaderSaveDiscardState();
            // Create Post + My Posts must not show stale logged-in UI after logout.
            try { refreshAuthDependentTabs(); } catch (e03) {}
        }
        
        // Update App state
        App.setState('user', currentUser);
        App.setState('isAdmin', currentUser ? currentUser.isAdmin === true : false);
        App.emit('member:stateChanged', { user: currentUser });
    }

    function refreshAuthDependentTabs() {
        // Create Post:
        // - Ensure we don't leave stale inline auth UI or stale submit buttons around when auth changes.
        try { unmountCreateAuthGate(); } catch (e0) {}
        try { updateSubmitButtonState(); } catch (e1) {}

        // My Posts:
        // - Until the full My Posts UI is implemented, ensure it never shows stale content from the prior auth state.
        if (myPostsPanel) {
            myPostsPanel.innerHTML = '';
        }
    }

    function clearInputs(inputs) {
        if (!Array.isArray(inputs)) return;
        inputs.forEach(function(input) {
            if ('value' in input) {
                input.value = '';
            }
        });
    }

    function updateHeaderAvatar(user) {
        var memberBtn = document.querySelector('.header-access-button[data-panel="member"]');
        if (!memberBtn) return;
        
        var avatarImg = memberBtn.querySelector('.header-access-button-avatar');
        var iconSpan = memberBtn.querySelector('.header-access-button-icon--member');
        
        if (user) {
            var src = getAvatarSource(user);
            if (src) {
                // Preload first so we never show a broken-image placeholder in the header.
                var pre = new Image();
                pre.onload = function() {
                    if (avatarImg) {
                        avatarImg.src = src;
                        avatarImg.classList.remove('header-access-button-avatar--hidden');
                    }
                    if (iconSpan) {
                        iconSpan.classList.add('header-access-button-icon--hidden');
                    }
                    memberBtn.classList.add('has-avatar');
                };
                pre.onerror = function() {
                    if (avatarImg) {
                        avatarImg.removeAttribute('src');
                        avatarImg.classList.add('header-access-button-avatar--hidden');
                    }
                    if (iconSpan) {
                        iconSpan.classList.remove('header-access-button-icon--hidden');
                    }
                    memberBtn.classList.remove('has-avatar');
                };
                pre.src = src;
            } else {
                // No avatar_file: hide avatar, show icon (no generated placeholders)
                if (avatarImg) {
                    avatarImg.removeAttribute('src');
                    avatarImg.classList.add('header-access-button-avatar--hidden');
                }
                if (iconSpan) {
                    iconSpan.classList.remove('header-access-button-icon--hidden');
                }
                memberBtn.classList.remove('has-avatar');
            }
        } else {
            // Hide avatar, show icon
            if (avatarImg) {
                avatarImg.removeAttribute('src');
                avatarImg.classList.add('header-access-button-avatar--hidden');
            }
            if (iconSpan) {
                iconSpan.classList.remove('header-access-button-icon--hidden');
            }
            memberBtn.classList.remove('has-avatar');
        }
    }

    /* --------------------------------------------------------------------------
       STATUS MESSAGES
       -------------------------------------------------------------------------- */
    
    var statusMessage = null;
    var statusTimer = null;
    
    function ensureStatusElement() {
        if (!statusMessage) {
            statusMessage = document.getElementById('memberStatusMessage');
        }
        return statusMessage;
    }
    
    function showStatus(message, options) {
        options = options || {};
        if (!ensureStatusElement()) return;
        
        statusMessage.textContent = message || '';
        statusMessage.setAttribute('aria-hidden', 'false');
        statusMessage.classList.remove('member-status-message--error', 'member-status-message--success', 'member-status-message--show');
        
        if (options.error) {
            statusMessage.classList.add('member-status-message--error');
        } else if (options.success) {
            statusMessage.classList.add('member-status-message--success');
        }
        
        if (statusTimer) {
            clearTimeout(statusTimer);
        }
        
        statusMessage.classList.add('member-status-message--show');
        statusTimer = setTimeout(function() {
            statusMessage.classList.remove('member-status-message--show');
            statusMessage.setAttribute('aria-hidden', 'true');
        }, 2000);
    }

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        openPanel: openPanel,
        closePanel: closePanel,
        getCurrentUser: function() { return currentUser; },
        isLoggedIn: function() { return !!currentUser; },
        isAdmin: function() { return currentUser && currentUser.isAdmin === true; },
        saveSetting: function(key, value) { return saveMemberSetting(key, value); },
        showStatus: showStatus
    };

})();

// Register module with App
App.registerModule('member', MemberModule);

// Expose globally for consistency with other modules
window.MemberModule = MemberModule;

// Early header update - runs on page load BEFORE full module init
// This ensures logged-in users see their avatar AND admin button immediately on refresh
(function() {
    var CURRENT_KEY = 'member-auth-current';
    var avatarUpdated = false;
    var adminButtonUpdated = false;
    
    function getStoredUser() {
        try {
            var raw = localStorage.getItem(CURRENT_KEY);
            if (!raw) return null;
            var user = JSON.parse(raw);
            if (!user || typeof user !== 'object' || !user.account_email) return null;
            return user;
        } catch (e) {
            return null;
        }
    }
    
    function updateHeaderAvatarEarly() {
        if (avatarUpdated) return;
        
        try {
            var user = getStoredUser();
            if (!user) return;
            
            var memberBtn = document.querySelector('.header-access-button[data-panel="member"]');
            if (!memberBtn) return;
            
            var avatarImg = memberBtn.querySelector('.header-access-button-avatar');
            var iconSpan = memberBtn.querySelector('.header-access-button-icon--member');
            
            // Get avatar source
            var avatarFile = user.avatar ? String(user.avatar).trim() : '';
            if (!avatarFile) return; // No avatar, keep showing icon
            
            // Resolve avatar URL
            var src = '';
            if (avatarFile.startsWith('http://') || avatarFile.startsWith('https://') || avatarFile.startsWith('data:')) {
                src = avatarFile;
            } else if (window.App && typeof App.getState === 'function') {
                var settings = App.getState('settings') || {};
                var folder = settings.folder_avatars;
                if (!folder) return; // Settings not loaded yet, will retry when settings load
                if (!folder.endsWith('/')) folder += '/';
                src = folder + avatarFile;
            } else {
                return; // App not ready, will retry when settings load
            }
            
            if (!src) return;
            
            avatarUpdated = true;
            
            // Preload and show avatar
            var pre = new Image();
            pre.onload = function() {
                if (avatarImg) {
                    avatarImg.src = src;
                    avatarImg.classList.remove('header-access-button-avatar--hidden');
                }
                if (iconSpan) {
                    iconSpan.classList.add('header-access-button-icon--hidden');
                }
                memberBtn.classList.add('has-avatar');
            };
            pre.onerror = function() {
                avatarUpdated = false; // Allow retry
            };
            pre.src = src;
        } catch (e) {
            // Silently fail - header will show default icon
        }
    }
    
    function updateAdminButtonEarly() {
        if (adminButtonUpdated) return;
        
        try {
            var user = getStoredUser();
            var adminBtn = document.querySelector('.header-access-button[data-panel="admin"]');
            if (!adminBtn) return;
            
            adminButtonUpdated = true;
            
            if (user && user.isAdmin === true) {
                // Show admin button
                adminBtn.classList.remove('header-access-button--hidden');
                adminBtn.removeAttribute('hidden');
                adminBtn.setAttribute('aria-hidden', 'false');
            } else {
                // Hide admin button
                adminBtn.classList.add('header-access-button--hidden');
                adminBtn.setAttribute('hidden', '');
                adminBtn.setAttribute('aria-hidden', 'true');
            }
        } catch (e) {
            // Silently fail
        }
    }
    
    function updateHeaderEarly() {
        updateHeaderAvatarEarly();
        updateAdminButtonEarly();
    }
    
    // Run immediately on DOMContentLoaded
    function runOnDOMReady() {
        updateHeaderEarly();
        
        // Set up listener for settings to load (in case avatar folder wasn't available yet)
        function setupSettingsListener() {
            if (window.App && typeof App.on === 'function') {
                App.on('state:settings', function() {
                    if (!avatarUpdated) {
                        updateHeaderAvatarEarly();
                    }
                });
                return true;
            }
            return false;
        }
        
        // Try to set up listener immediately, or retry a few times
        if (!setupSettingsListener()) {
            var retries = 0;
            var retryInterval = setInterval(function() {
                retries++;
                if (setupSettingsListener() || retries >= 10) {
                    clearInterval(retryInterval);
                    // Final attempt to update avatar in case settings loaded during retries
                    if (!avatarUpdated) {
                        updateHeaderAvatarEarly();
                    }
                }
            }, 50);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runOnDOMReady);
    } else {
        runOnDOMReady();
    }
})();

// Lazy initialization - only init when panel is first opened
(function() {
    var isInitialized = false;
    
    // Listen for panel toggle to init on first open
    if (window.App && App.on) {
        App.on('panel:toggle', function(data) {
            if (data.panel === 'member' && data.show) {
                if (!isInitialized) {
                    MemberModule.init();
                    isInitialized = true;
                }
                MemberModule.openPanel();
            } else if (data.panel === 'member' && !data.show) {
                if (isInitialized) {
                    MemberModule.closePanel();
                }
            }
        });
    }
})();
