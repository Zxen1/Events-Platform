/* ============================================================================
   MEMBER.JS - MEMBER SECTION
   ============================================================================
   
   Controls the member panel (right side).
   
   CONTAINS:
   - Tab buttons (Profile, Create Post, Post Editor)
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
   - Post Editor tab:
     - User's posts list (not yet coded)
   
   DEPENDENCIES:
   - index.js (backbone - App object)
   - components.js (fieldsets for create post form)
   
   COMMUNICATES WITH:
   - header.js (member button state, avatar display)
   - post.js (created posts appear in posts)
   
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
    var isEditingPostId = null; // Still used for "Create Post" tab if we ever use it for edits again
    var isSubmittingPost = false;

    // DOM references
    var panel = null;
    var panelContent = null;
    var panelDragged = false;
    var panelHome    = 'right'; // 'left' | 'right' — which edge the panel is currently locked to
    var panelLastLeft = null;   // last desktop x-position to restore on reopen
    var closeTimer = null;      // pending close finalize timer
    var closeToken = 0;         // invalidates stale close finalizers
    var closeBtn = null;
    var tabButtons = null;
    var tabPanels = null;
    var createTabBtn = null;
    
    // Create post elements
    var submitBtn = null;
    var adminSubmitBtn = null;
    var termsAgreed = false;
    var selectedCategory = '';
    var selectedSubcategory = '';
    var formWrapper = null;
    var formFields = null;
    
    // Auth elements
    var authForm = null;
    var loginFormContainer = null;
    var profilePanel = null;
    var registerTabBtn = null;
    var registerTabPanel = null;
    var posteditorTabBtn = null;
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
    var registerSubmitBtn = null;
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
    var profileFooterContainer = null;
    var profileFooterSaveBtn = null;
    var profileFooterDiscardBtn = null;
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
    
    // Profile form toggle and container
    var profileFormToggle = null;
    var profileFormContainer = null;
    
    // Profile more menu (3-dot button)
    var profileMoreBtn = null;
    var profileMoreMenu = null;
    var profileHideSwitch = null;
    var profileDeleteBtn = null;
    var refreshPreferencesBtn = null;
    var refreshTooltipText = null;
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

    // Create Post inline auth container (under the Create Post form)
    // IMPORTANT: must be mounted/unmounted on demand (should not exist in DOM when logged in).
    var createAuthWrapper = null;
    var createAuthLoginTab = null;
    var createAuthRegisterTab = null;
    var createAuthLoginContainer = null;
    var createAuthRegisterContainer = null;
    var createAuthLoginForm = null;
    var createAuthRegisterForm = null;
    var createAuthLoginEmailInput = null;
    var createAuthLoginPasswordInput = null;
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

    // Unsaved prompt uses ThreeButtonDialogComponent (components.js)
    
    // Terms modal elements
    var termsModalContainer = null;

    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        // Preload data to prevent layout jerk when Register tab loads
        // These are all small payloads that cache after first fetch
        if (typeof window.preloadMessages === 'function') {
            window.preloadMessages();
        }
        if (window.MemberAuthFieldsetsComponent && typeof MemberAuthFieldsetsComponent.loadFromDatabase === 'function') {
            MemberAuthFieldsetsComponent.loadFromDatabase();
        }
        if (window.CountryComponent && typeof CountryComponent.loadFromDatabase === 'function') {
            CountryComponent.loadFromDatabase();
        }
        if (window.CurrencyComponent && typeof CurrencyComponent.loadFromDatabase === 'function') {
            CurrencyComponent.loadFromDatabase().then(function() {
                syncSupporterCurrencyUi();
            });
        }
        
        // Preload categories/forms for Post Editor and Create Post tabs
        ensureCategoriesLoaded();
        
        // Avatar filenames are loaded via ensureSiteAvatarFilenames() which is already called in showPanel()
        
        cacheElements();
        if (!panel) {
            console.warn('[Member] Member panel not found');
            return;
        }
        
        bindEvents();
        initHeaderDrag();
        loadStoredSession();
        render();
        
        // Listen for post updates to refresh Post Editor cards
        if (window.App && typeof App.on === 'function') {
            App.on('post:updated', function(data) {
                if (data && data.post_id && window.PostEditorModule) {
                    PostEditorModule.refreshPostCard(data.post_id);
                }
            });
        }
    }

    var categoriesLoadingPromise = null;
    function ensureCategoriesLoaded() {
        if (categoriesLoadingPromise) return categoriesLoadingPromise;
        if (formpickerLoaded) return Promise.resolve();

        categoriesLoadingPromise = Promise.all([
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
                    if (opt.hidden === true || opt.hidden === 1 || opt.hidden === '1') return false;
                    if (opt.admin_only === true || opt.admin_only === 1 || opt.admin_only === '1') return false;
                    return true;
                });
            }
            if (settingsResponse && settingsResponse.settings && settingsResponse.settings.website_currency) {
                siteCurrency = settingsResponse.settings.website_currency;
            }

            // Note: formpickerLoaded is only set to true by loadFormpicker after UI is rendered.
            // But we have the data now.
            return results;
        }).catch(function(err) {
            console.error('[Member] Failed to preload categories:', err);
            categoriesLoadingPromise = null;
            throw err;
        });

        return categoriesLoadingPromise;
    }
    
    function initHeaderDrag() {
        var headerEl = panel.querySelector('.member-panel-header');
        if (!headerEl || !panelContent) return;

        function setPanelSideClass(side) {
            var useRight = side === 'right';
            panelContent.classList.toggle('member-panel-contents--side-right', useRight);
            panelContent.classList.toggle('member-panel-contents--side-left', !useRight);
        }
        
        // ---- Panel Drag ----
        // Moves the panel freely within the viewport. Left transition is suppressed
        // during drag for instant response, then restored on release.
        // Panel is clamped to stay fully on screen at all times.
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            e.preventDefault();
            
            var rect = panelContent.getBoundingClientRect();
            var startX = e.clientX;
            var startLeft = rect.left;
            var moved = false;
            
            panelContent.style.transitionProperty = 'transform';
            
            function onMove(ev) {
                moved = true;
                panelDragged = true;
                var dx = ev.clientX - startX;
                var newLeft = startLeft + dx;
                if (newLeft < 0) newLeft = 0;
                if (newLeft > window.innerWidth - rect.width) newLeft = window.innerWidth - rect.width;
                panelContent.style.left = newLeft + 'px';
                panelContent.style.right = 'auto';
            }
            
            function onUp() {
                panelContent.style.transitionProperty = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (!moved) return;

                var currentLeft = parseFloat(panelContent.style.left) || 0;
                var atRightEdge = currentLeft >= window.innerWidth - panelContent.offsetWidth - 20;
                var atLeftEdge  = currentLeft <= 20;

                if (atRightEdge) {
                    panelHome    = 'right';
                    panelDragged = false;
                    setPanelSideClass('right');
                    panelContent.style.left  = '';
                    panelContent.style.right = '';
                } else if (atLeftEdge) {
                    panelHome    = 'left';
                    panelDragged = false;
                    setPanelSideClass('left');
                    panelContent.style.left  = '0px';
                    panelContent.style.right = 'auto';
                }
            }
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // ---- Resize Modes ----
        // Controlled via Admin Settings → Resize Anti-Jitter (window._resizeAntiJitter).
        // Values: 'off' | 'smoothing' | 'teleport' | 'blur'
        // Position snap always runs regardless of mode.
        var resizeTimer  = null;
        var resizeFading = false;
        var resizeFadeTimer = null;

        window.addEventListener('resize', function() {
            if (!panelContent || !panel.classList.contains('member-panel--show')) return;
            if (window.innerWidth <= 530) return;

            var mode = window._resizeAntiJitter || 'off';

            // Off / Blur: instant update on every resize event — mimics CSS right:0 gripping
            // Blur adds a full-screen overlay on top (handled by index.js) to hide the jitter
            if (mode === 'off' || mode === 'blur') {
                if (resizeFadeTimer) {
                    clearTimeout(resizeFadeTimer);
                    resizeFadeTimer = null;
                }
                resizeFading = false;
                panelContent.style.opacity = '1';
                var newLeft = panelDragged
                    ? Math.min(parseFloat(panelContent.style.left) || 0, window.innerWidth - 40)
                    : panelHome === 'left' ? 0 : window.innerWidth - panelContent.offsetWidth;
                panelContent.style.transition = 'none';
                panelContent.style.left = newLeft + 'px';
                void panelContent.offsetWidth;
                panelContent.style.transition = '';
                return;
            }

            if (mode === 'teleport' && !resizeFading) {
                resizeFading = true;
                panelContent.style.transition = 'none';
                panelContent.style.opacity = '0';
            }

            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                var newLeft = panelDragged
                    ? Math.min(parseFloat(panelContent.style.left) || 0, window.innerWidth - 40)
                    : panelHome === 'left' ? 0 : window.innerWidth - panelContent.offsetWidth;

                if (mode !== 'smoothing') {
                    panelContent.style.transition = 'none';
                }
                panelContent.style.left = newLeft + 'px';
                if (mode !== 'smoothing') {
                    void panelContent.offsetWidth;
                    panelContent.style.transition = '';
                }

                if (mode === 'teleport') {
                    if (resizeFadeTimer) {
                        clearTimeout(resizeFadeTimer);
                        resizeFadeTimer = null;
                    }
                    panelContent.style.transition = 'opacity 0.3s ease';
                    void panelContent.offsetWidth;
                    panelContent.style.opacity = '1';
                    resizeFadeTimer = setTimeout(function() {
                        panelContent.style.transition = '';
                        resizeFading = false;
                        resizeFadeTimer = null;
                    }, 300);
                }
            }, mode === 'smoothing' ? 0 : 100);
        });
    }

    function cacheElements() {
        panel = document.querySelector('.member-panel');
        if (!panel) return;
        
        panelContent = panel.querySelector('.member-panel-contents');
        memberPanelBody = panel.querySelector('.member-panel-body');
        closeBtn = panel.querySelector('.member-panel-actions-icon-btn--close');
        tabButtons = panel.querySelectorAll('.member-tab-bar > .button-class-2');
        tabPanels = panel.querySelectorAll('.member-tab-contents');
        
        // Tab button for Create Post (needed for renaming during Edit)
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                if (btn.dataset.tab === 'create') createTabBtn = btn;
            });
        }
        
        // Auth elements (Profile tab only). NOTE: Create Post also contains a .member-auth (inline auth container),
        // so scope this to the profile tab to avoid ambiguous selectors.
        authForm = document.querySelector('#member-tab-profile .member-auth');
        // Login form is now dynamically created - don't look for it in DOM
        loginFormEl = null;
        loginFormContainer = null;
        loginInputs = [];
        registerFormEl = document.getElementById('memberAuthFormRegister');
        profilePanel = document.getElementById('member-profile-container');
        registerTabBtn = document.getElementById('member-tab-register-btn');
        registerTabPanel = document.getElementById('member-tab-register');
        posteditorTabBtn = document.getElementById('member-tab-posteditor-btn');
        if (registerTabPanel) {
            registerInputs = Array.from(registerTabPanel.querySelectorAll('input'));
        }

        // Supporter UI (register tab)
        supporterMessageEl = document.getElementById('member-supporter-message');
        supporterJoinFieldsEl = document.getElementById('member-registrationform-container');
        registerFieldsetsContainer = document.getElementById('member-registrationform-fieldsets');
        supporterCustomAmountInput = document.getElementById('member-supporter-payment-custom');
        supporterAmountHiddenInput = document.getElementById('member-supporter-payment-amount');
        supporterPresetButtons = Array.from(panel.querySelectorAll('.member-supporterpayment-button'));
        supporterCountryMenuContainer = document.getElementById('member-supporter-country-menu');
        supporterCountryHiddenInput = document.getElementById('member-supporter-country');
        
        // Registration payment button via shared component
        var registerPaymentContainer = document.getElementById('member-register-payment-container');
        if (registerPaymentContainer) {
            var regPaymentRefs = PaymentSubmitComponent.create({
                baseLabel: 'Register & Pay',
                isAdmin: false,
                onSubmitClick: function(e) {
                    e.preventDefault();
                    handleRegister();
                }
            });
            registerPaymentContainer.appendChild(regPaymentRefs.container);
            registerSubmitBtn = regPaymentRefs.submitBtn;
            registerSubmitBtn.type = 'submit';
        }
        
        profileAvatar = document.getElementById('member-profile-avatar');
        profileName = document.getElementById('member-profile-name');
        profileEmail = document.getElementById('member-profile-email');
        logoutBtn = document.getElementById('member-logout-btn');
        refreshPreferencesBtn = document.getElementById('member-refresh-preferences-btn');
        refreshTooltipText = document.getElementById('member-refresh-tooltip-text');
        profileTabBtn = document.getElementById('member-tab-profile-btn');
        profileTabPanel = document.getElementById('member-tab-profile');

        headerSaveBtn = panel.querySelector('#member-panel-save-btn');
        headerDiscardBtn = panel.querySelector('#member-panel-discard-btn');
        
        profileFieldsetsContainer = document.getElementById('member-profileform-fieldsets');
        profileEditNameInput = null;
        profileEditPasswordInput = null;
        profileEditConfirmInput = null;
        profileEditForm = document.getElementById('memberProfileEditForm');
        profileSaveBtn = document.getElementById('member-profile-save-btn'); // legacy (removed in HTML; may be null)
        
        // Profile form toggle button and container
        profileFormToggle = document.getElementById('member-profileform-toggle');
        profileFormContainer = document.getElementById('member-profileform-container');
        
        // Profile more menu
        profileMoreBtn = document.getElementById('member-profile-more-btn');
        profileMoreMenu = document.getElementById('member-profile-more-menu');
        profileHideSwitch = document.getElementById('member-profile-hide-switch');
        profileDeleteBtn = document.getElementById('member-profile-delete-btn');

        // Avatar UI
        avatarGridRegister = document.getElementById('member-avatar-grid-register');
        avatarGridProfile = document.getElementById('member-avatar-grid-profile');

        // Create Post inline auth container is mounted on demand (not in HTML).
        createAuthWrapper = null;
        createAuthLoginTab = null;
        createAuthRegisterTab = null;
        createAuthLoginContainer = null;
        createAuthRegisterContainer = null;
        createAuthLoginForm = null;
        createAuthRegisterForm = null;
        createAuthLoginEmailInput = null;
        createAuthLoginPasswordInput = null;
        createAuthRegisterFieldsets = null;
        avatarGridCreate = null;
        createCountryMenuContainer = null;
        createCountryHiddenInput = null;

        // Note: Avatar cropper is now handled by AvatarCropperComponent (components.js)
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
        
        // Main tab switching (Profile / Create Post / Post Editor)
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    requestTabSwitch(btn.dataset.tab);
                });
            });
        }
        
        // Register tab is now a main tab, not a subtab - no special click handler needed

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
            function getSupporterSymbolInfo() {
                var code = getSiteCurrencyCode();
                if (!code) return null;
                var cur = CurrencyComponent.getCurrencyByCode(code);
                if (!cur || !cur.symbol) return null;
                return { code: code, symbol: cur.symbol, right: cur.symbolPosition === 'right' };
            }

            function buildCustomDisplay(raw, info) {
                if (!info) return raw;
                if (info.right) return raw + ' ' + info.symbol;
                return info.symbol + raw;
            }

            function stripCustomDisplay(val, info) {
                if (!info) return val;
                if (info.right) {
                    var suffix = ' ' + info.symbol;
                    if (val.length > suffix.length && val.slice(-suffix.length) === suffix) {
                        return val.slice(0, -suffix.length);
                    }
                } else {
                    var prefix = info.symbol;
                    if (val.indexOf(prefix) === 0) {
                        return val.slice(prefix.length);
                    }
                }
                return val;
            }

            function getCustomEditableRange(info) {
                var val = String(supporterCustomAmountInput.value || '');
                if (!info) return { min: 0, max: val.length };
                if (info.right) {
                    var suffixLen = info.symbol.length + 1;
                    return { min: 0, max: Math.max(0, val.length - suffixLen) };
                }
                return { min: info.symbol.length, max: val.length };
            }

            function lockSupporterCurrencyCaret() {
                try {
                    var info = getSupporterSymbolInfo();
                    if (!info) return;
                    var range = getCustomEditableRange(info);
                    var s = supporterCustomAmountInput.selectionStart;
                    var e = supporterCustomAmountInput.selectionEnd;
                    if (typeof s !== 'number' || typeof e !== 'number') return;
                    var ns = Math.min(Math.max(range.min, s), range.max);
                    var ne = Math.min(Math.max(range.min, e), range.max);
                    if (ns !== s || ne !== e) {
                        supporterCustomAmountInput.setSelectionRange(ns, ne);
                    }
                } catch (e) {
                    // ignore
                }
            }

            supporterCustomAmountInput.addEventListener('keydown', function(e) {
                try {
                    var info = getSupporterSymbolInfo();
                    if (!info) return;
                    var range = getCustomEditableRange(info);
                    var s = supporterCustomAmountInput.selectionStart;
                    var end = supporterCustomAmountInput.selectionEnd;
                    if (typeof s !== 'number' || typeof end !== 'number') return;

                    if (e.key === 'Backspace') {
                        if (s <= range.min && end <= range.min) {
                            e.preventDefault();
                            supporterCustomAmountInput.setSelectionRange(range.min, range.min);
                        }
                        return;
                    }
                    if (e.key === 'Delete') {
                        if (s >= range.max && end >= range.max) {
                            e.preventDefault();
                            supporterCustomAmountInput.setSelectionRange(range.max, range.max);
                        }
                        return;
                    }
                    if (e.key === 'ArrowLeft') {
                        if (s <= range.min) {
                            e.preventDefault();
                            supporterCustomAmountInput.setSelectionRange(range.min, range.min);
                        }
                        return;
                    }
                    if (e.key === 'ArrowRight') {
                        if (s >= range.max) {
                            e.preventDefault();
                            supporterCustomAmountInput.setSelectionRange(range.max, range.max);
                        }
                        return;
                    }
                    if (e.key === 'Home') {
                        e.preventDefault();
                        supporterCustomAmountInput.setSelectionRange(range.min, range.min);
                        return;
                    }
                    if (e.key === 'End') {
                        e.preventDefault();
                        supporterCustomAmountInput.setSelectionRange(range.max, range.max);
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
                var info = getSupporterSymbolInfo();
                var raw = String(supporterCustomAmountInput.value || '');

                if (info) {
                    raw = stripCustomDisplay(raw, info);
                }

                raw = raw.replace(/[^0-9.]/g, '');
                var parts = raw.split('.');
                if (parts.length > 2) {
                    raw = parts[0] + '.' + parts.slice(1).join('');
                }

                var displayValue = info ? buildCustomDisplay(raw, info) : raw;
                if (displayValue !== supporterCustomAmountInput.value) {
                    supporterCustomAmountInput.value = displayValue;
                    try {
                        var range = getCustomEditableRange(info);
                        var caret = info && info.right ? raw.length : (info ? info.symbol.length + raw.length : raw.length);
                        caret = Math.min(caret, range.max);
                        supporterCustomAmountInput.setSelectionRange(caret, caret);
                    } catch (e) {
                        // ignore
                    }
                }

                setSupporterAmount(raw, { fromCustom: true, allowUnderMin: true });
            });
            supporterCustomAmountInput.addEventListener('blur', function() {
                var info = getSupporterSymbolInfo();
                var raw = String(supporterCustomAmountInput.value || '').trim();
                if (info) {
                    raw = stripCustomDisplay(raw, info);
                }
                raw = raw.replace(/[^0-9.]/g, '');
                setSupporterAmount(raw, { fromCustom: true });
            });
        }
        
        // Form submit handlers (for Enter key support)
        // Login form is now created dynamically - handler attached in mountProfileLoginForm()
        var registerForm = document.getElementById('memberAuthFormRegister');
        if (registerForm) {
            registerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleRegister();
            });
        }

        // Create Post inline auth container is mounted on demand (after the create form is shown),
        // so its events are attached inside ensureCreateAuthMounted().
        
        // Login button click
        var loginBtn = panel.querySelector('.member-login[data-action="login"]');
        if (loginBtn) {
            loginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleLogin();
            });
        }
        
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                requestLogout();
            });
        }
        
        // Refresh Preferences button (cross-device sync)
        if (refreshPreferencesBtn) {
            refreshPreferencesBtn.addEventListener('click', function(e) {
                e.preventDefault();
                refreshPreferencesFromDb();
            });
        }
        
        // Load Refresh Preferences tooltip text from admin_messages
        loadRefreshPreferencesTooltip();
        
        // Inline save removed; profile save is via header buttons
        // Profile edit inputs are rendered from DB fieldsets at runtime; listeners are attached after renderProfileFieldsets().
        if (profileEditForm) {
            profileEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleHeaderSave();
            });
        }
        
        // Profile form toggle button
        if (profileFormToggle) {
            profileFormToggle.addEventListener('click', function() {
                toggleProfileForm();
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
            var profileHideInput = profileHideSwitch.querySelector('.component-switch-input');
            var profileHideSlider = profileHideSwitch.querySelector('.component-switch-slider');
            profileHideSwitch.addEventListener('click', function(e) {
                e.preventDefault();
                profileHideInput.checked = !profileHideInput.checked;
                profileHideSlider.classList.toggle('component-switch-slider--on-default');
                // Save to database
                if (currentUser && currentUser.id) {
                    saveProfileHiddenState(profileHideInput.checked);
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

        // Note: Avatar picker/cropper UI is handled by AvatarPickerComponent + AvatarCropperComponent (components.js)
        // Note: unsaved changes dialogs are controlled from components.
        
        // Map Lighting buttons
        initMapLightingButtons();
        
        // Map Style buttons
        initMapStyleButtons();
        
        // Wallpaper Animation buttons
        initWallpaperButtons();
        
        // Panel toggle is handled by lazy init wrapper outside module
    }
    
    function initMapLightingButtons() {
        var lightingButtons = panel.querySelectorAll('.member-lighting-button');
        if (!lightingButtons.length) return;
        
        // Apply lighting icons from system images
        var sys = (window.App && typeof App.getState === 'function') ? (App.getState('system_images') || {}) : {};
        lightingButtons.forEach(function(btn) {
            var iconEl = btn.querySelector('.member-lighting-button-icon');
            if (!iconEl) return;
            var key = iconEl.dataset.iconKey;
            if (key && sys[key] && window.App && typeof App.getImageUrl === 'function') {
                var url = App.getImageUrl('systemImages', sys[key]);
                iconEl.style.webkitMaskImage = 'url(' + url + ')';
                iconEl.style.maskImage = 'url(' + url + ')';
                iconEl.style.opacity = '1';
            }
        });
        
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
            
            btn.addEventListener('click', function() {
                if (btn.getAttribute('aria-pressed') === 'true') return;
                
                lightingButtons.forEach(function(b) {
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.setAttribute('aria-pressed', 'true');
                
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
            
            btn.addEventListener('click', function() {
                if (btn.getAttribute('aria-pressed') === 'true') return;
                
                styleButtons.forEach(function(b) {
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.setAttribute('aria-pressed', 'true');
                
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
    
    function initWallpaperButtons() {
        var wallpaperButtons = panel.querySelectorAll('.member-wallpaper-button');
        if (!wallpaperButtons.length) return;
        
        // Load from member data (logged in) or localStorage (guest) or default
        var currentWallpaper = 'basic';
        if (currentUser) {
            currentWallpaper = currentUser.animation_preference || 'basic';
        } else {
            var storedWallpaper = localStorage.getItem('animation_preference');
            if (storedWallpaper) {
                currentWallpaper = storedWallpaper;
            }
        }
        
        wallpaperButtons.forEach(function(btn) {
            var wallpaper = btn.dataset.wallpaper;
            var isActive = wallpaper === currentWallpaper;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            
            btn.addEventListener('click', function() {
                if (btn.getAttribute('aria-pressed') === 'true') return;
                
                wallpaperButtons.forEach(function(b) {
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.setAttribute('aria-pressed', 'true');
                
                // Save to localStorage (guests) or database (members)
                if (currentUser) {
                    saveMemberSetting('animation_preference', wallpaper);
                } else {
                    localStorage.setItem('animation_preference', wallpaper);
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
                'account-email': currentUser.account_email,
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
            
            // Also update the stored auth payload so other modules see the change immediately
            try {
                localStorage.setItem('member-auth-current', JSON.stringify(currentUser));
            } catch (_e) {}
        }
    }

    function syncLocalProfilePrefsFromUser(user) {
        try {
            if (!user) return;
            if (user.country_code) localStorage.setItem('member_country_code', String(user.country_code));
            if (user.timezone) localStorage.setItem('member_timezone', String(user.timezone));
            // Filters: DB-first snapshot mirrored to localStorage so map can load correctly before filter panel opens.
            if (user.filters_json && typeof user.filters_json === 'string') {
                localStorage.setItem('funmap_filters', String(user.filters_json));
                // Sync filter panel UI, header, counts, and map from localStorage
                try {
                    if (window.FilterModule && typeof FilterModule.refreshFromStorage === 'function') {
                        FilterModule.refreshFromStorage();
                    }
                } catch (_eSync) {}
            }
            // Favorites: DB overwrites localStorage on login (no merging).
            // DB format may be array [123,456] or object {"123":ts}; normalize to object for localStorage.
            if (user.favorites !== null && user.favorites !== undefined) {
                try {
                    var favRaw = typeof user.favorites === 'string' ? user.favorites : JSON.stringify(user.favorites);
                    var favParsed = JSON.parse(favRaw);
                    if (Array.isArray(favParsed)) {
                        // Legacy array format → convert to {id: timestamp} object
                        var favObj = {};
                        var now = Date.now();
                        for (var fi = 0; fi < favParsed.length; fi++) {
                            favObj[String(favParsed[fi])] = now;
                        }
                        localStorage.setItem('postFavorites', JSON.stringify(favObj));
                    } else if (favParsed && typeof favParsed === 'object') {
                        // Already in {id: timestamp} format
                        localStorage.setItem('postFavorites', favRaw);
                    }
                } catch (_eFav) {}
            }
            // Recent history: DB overwrites localStorage on login (no merging).
            if (user.recent !== null && user.recent !== undefined) {
                try {
                    var recentRaw = typeof user.recent === 'string' ? user.recent : JSON.stringify(user.recent);
                    var recentParsed = JSON.parse(recentRaw);
                    if (Array.isArray(recentParsed)) {
                        localStorage.setItem('recentPosts', recentRaw);
                    }
                } catch (_eRecent) {}
            }
        } catch (e) {
            // ignore
        }
    }

    /**
     * Refresh Preferences: pull latest favorites, recents, and filters from DB.
     * Used by the "Refresh Preferences" button for cross-device sync.
     */
    function refreshPreferencesFromDb() {
        if (!currentUser) return;
        var memberId = parseInt(currentUser.id, 10);
        if (!memberId || memberId <= 0 || !currentUser.account_email) return;

        // Disable button during fetch
        if (refreshPreferencesBtn) {
            refreshPreferencesBtn.disabled = true;
            refreshPreferencesBtn.textContent = 'Refreshing…';
        }

        fetch('/gateway.php?action=' + getEditUserAction(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                'account-email': currentUser.account_email,
                return_preferences: true
            })
        }).then(function(response) {
            if (!response.ok) throw new Error('Server returned ' + response.status);
            return response.json();
        }).then(function(result) {
            if (!result || !result.success) throw new Error(result && result.message ? result.message : 'Unknown error');

            // Overwrite localStorage with DB data, then sync the full filter UI
            // Filters
            if (result.filters_json && typeof result.filters_json === 'string') {
                localStorage.setItem('funmap_filters', result.filters_json);
                // Update in-memory user object
                currentUser.filters_json = result.filters_json;
                currentUser.filters_hash = result.filters_hash || null;
                currentUser.filters_version = result.filters_version || null;
                currentUser.filters_updated_at = result.filters_updated_at || null;
                // Sync filter panel UI, header, counts, and map from localStorage
                try {
                    if (window.FilterModule && typeof FilterModule.refreshFromStorage === 'function') {
                        FilterModule.refreshFromStorage();
                    }
                } catch (_e) {}
            }

            // Favorites
            if (result.favorites !== null && result.favorites !== undefined) {
                try {
                    var favRaw = typeof result.favorites === 'string' ? result.favorites : JSON.stringify(result.favorites);
                    var favParsed = JSON.parse(favRaw);
                    if (Array.isArray(favParsed)) {
                        var favObj = {};
                        var now = Date.now();
                        for (var fi = 0; fi < favParsed.length; fi++) {
                            favObj[String(favParsed[fi])] = now;
                        }
                        localStorage.setItem('postFavorites', JSON.stringify(favObj));
                    } else if (favParsed && typeof favParsed === 'object') {
                        localStorage.setItem('postFavorites', favRaw);
                    }
                } catch (_e) {}
                currentUser.favorites = result.favorites;
            }

            // Recents
            if (result.recent !== null && result.recent !== undefined) {
                try {
                    var recentRaw = typeof result.recent === 'string' ? result.recent : JSON.stringify(result.recent);
                    var recentParsed = JSON.parse(recentRaw);
                    if (Array.isArray(recentParsed)) {
                        localStorage.setItem('recentPosts', recentRaw);
                    }
                } catch (_e) {}
                currentUser.recent = result.recent;
            }

            // Update stored session
            storeCurrent(currentUser);

            // Show success toast
            try {
                getMessage('msg_member_preferences_refreshed', {}, false).then(function(message) {
                    if (message && window.ToastComponent) ToastComponent.showSuccess(message);
                });
            } catch (_eToast) {}

            // Re-enable button
            if (refreshPreferencesBtn) {
                refreshPreferencesBtn.disabled = false;
                refreshPreferencesBtn.textContent = 'Refresh Preferences';
            }
        }).catch(function(err) {
            console.error('[Member] Refresh preferences failed:', err);
            try {
                getMessage('msg_member_preferences_refresh_failed', {}, false).then(function(message) {
                    if (message && window.ToastComponent) ToastComponent.showError(message);
                });
            } catch (_eToast) {}
            if (refreshPreferencesBtn) {
                refreshPreferencesBtn.disabled = false;
                refreshPreferencesBtn.textContent = 'Refresh Preferences';
            }
        });
    }

    /**
     * Load the Refresh Preferences tooltip text from admin_messages.
     */
    function loadRefreshPreferencesTooltip() {
        if (!refreshTooltipText) return;
        try {
            if (typeof getMessage === 'function') {
                getMessage('msg_member_refresh_preferences_info', {}, false).then(function(message) {
                    if (message && refreshTooltipText) {
                        refreshTooltipText.textContent = message;
                    }
                });
            }
        } catch (_e) {}
    }

    /**
     * Background sync: non-blocking fetch of preferences from DB on page load.
     * Compares DB data with what's in localStorage and updates only if different.
     * Called once in loadStoredSession() — never blocks rendering.
     */
    function backgroundSyncPreferences(user) {
        if (!user || !user.id || !user.account_email) return;
        var editAction = (user.isAdmin === true) ? 'edit-admin' : 'edit-member';

        // Snapshot local filter state BEFORE the request. If the user changes
        // filters while the request is in flight, we must NOT overwrite their
        // changes with stale DB data when the response arrives.
        var filtersAtRequest = localStorage.getItem('funmap_filters') || '';

        fetch('/gateway.php?action=' + editAction, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: user.id,
                'account-email': user.account_email,
                return_preferences: true
            })
        }).then(function(response) {
            if (!response.ok) return;
            return response.json();
        }).then(function(result) {
            if (!result || !result.success) return;

            var changed = false;

            // Filters
            if (result.filters_json && typeof result.filters_json === 'string') {
                var localFilters = localStorage.getItem('funmap_filters');
                // Only overwrite if local state has NOT changed since the request
                // was sent. If the user modified filters while the request was in
                // flight, the local state is newer than the DB response.
                if (localFilters === filtersAtRequest && localFilters !== result.filters_json) {
                    localStorage.setItem('funmap_filters', result.filters_json);
                    if (currentUser) {
                        currentUser.filters_json = result.filters_json;
                        currentUser.filters_hash = result.filters_hash || null;
                        currentUser.filters_version = result.filters_version || null;
                        currentUser.filters_updated_at = result.filters_updated_at || null;
                    }
                    // Sync filter panel UI, header, counts, and map from localStorage
                    try {
                        if (window.FilterModule && typeof FilterModule.refreshFromStorage === 'function') {
                            FilterModule.refreshFromStorage();
                        }
                    } catch (_e) {}
                    changed = true;
                }
            }

            // Favorites
            if (result.favorites !== null && result.favorites !== undefined) {
                try {
                    var favRaw = typeof result.favorites === 'string' ? result.favorites : JSON.stringify(result.favorites);
                    var localFavs = localStorage.getItem('postFavorites');
                    // Normalize DB format for comparison
                    var favParsed = JSON.parse(favRaw);
                    var normalizedFavJson;
                    if (Array.isArray(favParsed)) {
                        var favObj = {};
                        var now = Date.now();
                        for (var fi = 0; fi < favParsed.length; fi++) {
                            favObj[String(favParsed[fi])] = now;
                        }
                        normalizedFavJson = JSON.stringify(favObj);
                    } else {
                        normalizedFavJson = favRaw;
                    }
                    if (localFavs !== normalizedFavJson) {
                        localStorage.setItem('postFavorites', normalizedFavJson);
                        if (currentUser) currentUser.favorites = result.favorites;
                        changed = true;
                    }
                } catch (_e) {}
            }

            // Recents
            if (result.recent !== null && result.recent !== undefined) {
                try {
                    var recentRaw = typeof result.recent === 'string' ? result.recent : JSON.stringify(result.recent);
                    var localRecent = localStorage.getItem('recentPosts');
                    if (localRecent !== recentRaw) {
                        var recentParsed = JSON.parse(recentRaw);
                        if (Array.isArray(recentParsed)) {
                            localStorage.setItem('recentPosts', recentRaw);
                            if (currentUser) currentUser.recent = result.recent;
                            changed = true;
                        }
                    }
                } catch (_e) {}
            }

            // Persist updated user object if anything changed
            if (changed && currentUser) {
                storeCurrent(currentUser);
            }
        }).catch(function(_err) {
            // Silent fail — background sync should never disrupt the user
        });
    }

    function getDefaultCurrencyForForms() {
        // Use member's preferred currency from their last post (if logged in)
        try {
            var raw = localStorage.getItem('member-auth-current');
            if (raw) {
                var user = JSON.parse(raw);
                if (user && user.preferred_currency && typeof user.preferred_currency === 'string') {
                    return user.preferred_currency.trim() || null;
                }
            }
        } catch (e) {}
        return null;
    }
    
    function extractCurrencyFromPayload(payload) {
        // Extract first currency found in the payload (session_pricing, ticket_pricing, or item-pricing)
        if (!payload || !Array.isArray(payload.fields)) return null;
        for (var i = 0; i < payload.fields.length; i++) {
            var f = payload.fields[i];
            if (!f || !f.value) continue;
            var t = f.type || f.key || '';
            if ((t === 'session-pricing' || t === 'ticket-pricing') && f.value.pricing_groups) {
                var groups = f.value.pricing_groups;
                for (var gk in groups) {
                    if (!groups.hasOwnProperty(gk)) continue;
                    var seats = groups[gk];
                    if (!Array.isArray(seats)) continue;
                    for (var s = 0; s < seats.length; s++) {
                        var tiers = seats[s] && seats[s].tiers;
                        if (!Array.isArray(tiers)) continue;
                        for (var ti = 0; ti < tiers.length; ti++) {
                            var curr = tiers[ti] && tiers[ti].currency;
                            if (curr && typeof curr === 'string' && curr.trim()) {
                                return curr.trim().toUpperCase();
                            }
                        }
                    }
                }
            }
            if (t === 'item-pricing' && f.value.currency) {
                var c = f.value.currency;
                if (c && typeof c === 'string' && c.trim()) {
                    return c.trim().toUpperCase();
                }
            }
        }
        return null;
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

    function ensureProfileFooterButtons() {
        if (!profileFormContainer) return;
        if (profileFooterContainer && profileFooterContainer.parentNode) return;

        var existingFooter = profileFormContainer.querySelector('.member-profile-edit-footer');
        if (existingFooter) {
            profileFooterContainer = existingFooter;
            profileFooterSaveBtn = existingFooter.querySelector('.member-profile-edit-button-save');
            profileFooterDiscardBtn = existingFooter.querySelector('.member-profile-edit-button-discard');
            return;
        }

        var footer = document.createElement('div');
        footer.className = 'member-profile-edit-footer';

        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'member-profile-edit-button-save button-class-2c';
        saveBtn.textContent = 'Save';
        saveBtn.disabled = true;
        saveBtn.addEventListener('click', function() {
            if (saveBtn.disabled) return;
            handleHeaderSave();
        });

        var discardBtn = document.createElement('button');
        discardBtn.type = 'button';
        discardBtn.className = 'member-profile-edit-button-discard button-class-2d';
        discardBtn.textContent = 'Discard';
        discardBtn.disabled = true;
        discardBtn.addEventListener('click', function() {
            if (discardBtn.disabled) return;
            handleHeaderDiscard();
        });

        footer.appendChild(saveBtn);
        footer.appendChild(discardBtn);
        profileFormContainer.appendChild(footer);

        profileFooterContainer = footer;
        profileFooterSaveBtn = saveBtn;
        profileFooterDiscardBtn = discardBtn;
    }

    function updateProfileFooterButtonState() {
        if (!profileFooterSaveBtn || !profileFooterDiscardBtn) return;
        var canSave = isProfileDirty();
        profileFooterSaveBtn.disabled = !canSave;
        profileFooterDiscardBtn.disabled = !canSave;
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
        var enabled = isProfileDirty() || isAnyPostDirty();
        setHeaderButtonsEnabled(enabled);
        updateProfileFooterButtonState();
    }

    function isAnyPostDirty() {
        // Delegate to PostEditorModule
        if (window.PostEditorModule && typeof PostEditorModule.isAnyPostDirty === 'function') {
            return PostEditorModule.isAnyPostDirty();
        }
        return false;
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
        
        var payload = { id: currentUser.id, 'account-email': currentUser.account_email };
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
        if (!currentUser) return;

        var profileDirty = isProfileDirty();
        var hasPostEdits = window.PostEditorModule && typeof PostEditorModule.isAnyPostDirty === 'function' && PostEditorModule.isAnyPostDirty();

        if (!profileDirty && !hasPostEdits) return;

        showStatus('Saving changes...', { success: true });
        setHeaderButtonsEnabled(false);

        var savePromises = [];

        // 1. Profile save logic (including site avatar preparation)
        if (profileDirty) {
            savePromises.push(new Promise(function(resolve) {
                if (pendingProfileSiteUrl && !pendingProfileAvatarBlob) {
                    var url = String(pendingProfileSiteUrl);
                    fetch(url)
                        .then(function(r) { return r.blob(); })
                        .then(function(blob) {
                            return new Promise(function(resSq) {
                                squarePngFromImageBlob(blob, function(out) { resSq(out); });
                            });
                        })
                        .then(function(squareBlob) {
                            if (!squareBlob) throw new Error('Could not prepare avatar image');
                            pendingProfileAvatarBlob = squareBlob;
                            pendingProfileSiteUrl = '';
                            handleProfileSave(function() { resolve(); });
                        })
                        .catch(function(err) {
                            console.warn('[Member] Failed to prepare site avatar', err);
                            handleProfileSave(function() { resolve(); }); // Save profile anyway
                        });
                } else {
                    handleProfileSave(function() { resolve(); });
                }
            }));
        }

        // 2. Posts save via PostEditorModule
        if (hasPostEdits && window.PostEditorModule && typeof PostEditorModule.saveAllDirtyPosts === 'function') {
            savePromises.push(PostEditorModule.saveAllDirtyPosts());
        }

        Promise.all(savePromises)
            .then(function() {
                showStatus('All changes saved.', { success: true });
                updateHeaderSaveDiscardState();
            })
            .catch(function(err) {
                console.error('[Member] Global save failed:', err);
                showStatus('Some changes could not be saved.', { error: true });
                updateHeaderSaveDiscardState();
            });
    }

    function handleHeaderDiscard() {
        if (isProfileDirty()) {
            discardProfileEdits();
        }

        // Discard all post edits via PostEditorModule
        if (window.PostEditorModule && typeof PostEditorModule.discardAllEdits === 'function') {
            PostEditorModule.discardAllEdits();
        }

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
    
    function toggleProfileForm() {
        if (!profileFormContainer) return;
        var isOpen = !profileFormContainer.hidden;
        profileFormContainer.hidden = isOpen;
        if (profileFormToggle) {
            profileFormToggle.textContent = isOpen ? 'Update Profile' : 'Hide Profile Form';
            profileFormToggle.setAttribute('aria-expanded', (!isOpen).toString());
        }
    }
    
    function saveProfileHiddenState(hidden) {
        if (!currentUser || !currentUser.id || !currentUser.account_email) return;
        
        fetch('/gateway.php?action=edit-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                'account-email': currentUser.account_email,
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
                'account-email': currentUser.account_email
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
        // IMPORTANT:
        // Do NOT reset panel DOM/state on tab switches.
        // Users expect the browser to preserve in-progress input when they leave and return.
        // The Create Post form is only reset on explicit actions (e.g. successful submit, explicit reset).

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
        closeToken++;
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        
        panel.classList.add('member-panel--show');
        panel.setAttribute('aria-hidden', 'false');

        // Show (force a frame between "off-screen" and "visible" so slide-in
        // always transitions at the same speed as slide-out)
        panelContent.classList.remove('member-panel-contents--visible');
        panelContent.classList.add('member-panel-contents--hidden');
        try { void panelContent.offsetWidth; } catch (e) {}
        if (!panelDragged && window.innerWidth > 530) {
            var maxLeft = Math.max(0, window.innerWidth - panelContent.offsetWidth);
            var openLeftRaw = (panelLastLeft === null || panelLastLeft === undefined) ? maxLeft : panelLastLeft;
            var openLeft = Math.max(0, Math.min(maxLeft, openLeftRaw));
            var openSide = panelHome === 'left' ? 'left' : 'right';
            if (openLeft <= 20) {
                openSide = 'left';
            } else if (openLeft >= (maxLeft - 20)) {
                openSide = 'right';
            }
            panelHome = openSide;
            panelContent.classList.toggle('member-panel-contents--side-right', openSide === 'right');
            panelContent.classList.toggle('member-panel-contents--side-left', openSide === 'left');
            panelContent.style.left = openLeft + 'px';
            panelContent.style.right = 'auto';
            panelDragged = !(openLeft <= 20 || openLeft >= (maxLeft - 20));
        }
        requestAnimationFrame(function() {
            panelContent.classList.remove('member-panel-contents--hidden');
            panelContent.classList.add('member-panel-contents--visible');
        });
        
        // Refresh map settings buttons (in case member logged in/out)
        initMapLightingButtons();
        initMapStyleButtons();
        initWallpaperButtons();
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
        
        closeToken++;
        var myCloseToken = closeToken;
        
        var rect = panelContent.getBoundingClientRect();
        var currentLeft = Math.max(0, rect && isFinite(rect.left) ? rect.left : (parseFloat(panelContent.style.left) || 0));
        panelLastLeft = currentLeft;
        var distLeft = Math.max(0, currentLeft);
        var distRight = Math.max(0, window.innerWidth - (currentLeft + panelContent.offsetWidth));
        var closeSide = distLeft <= distRight ? 'left' : 'right';

        panelContent.classList.toggle('member-panel-contents--side-right', closeSide === 'right');
        panelContent.classList.toggle('member-panel-contents--side-left', closeSide === 'left');

        if (window.innerWidth > 530) {
            var maxLeft = Math.max(0, window.innerWidth - panelContent.offsetWidth);
            var edgeLeft = closeSide === 'right' ? maxLeft : 0;
            panelContent.style.left = edgeLeft + 'px';
            panelContent.style.right = 'auto';
        }

        var wasVisible = panelContent.classList.contains('member-panel-contents--visible');
        panelContent.classList.remove('member-panel-contents--visible');
        panelContent.classList.add('member-panel-contents--hidden');
        
        function finalizeClose() {
            if (myCloseToken !== closeToken) return;
            if (panelContent.classList.contains('member-panel-contents--visible')) return;
            panel.classList.remove('member-panel--show');
            if (document.activeElement && panel.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (_eBlur) {}
            }
            panel.setAttribute('aria-hidden', 'true');
            panelHome = closeSide;
            panelDragged = false;
            panelContent.classList.toggle('member-panel-contents--side-right', panelHome === 'right');
            panelContent.classList.toggle('member-panel-contents--side-left', panelHome === 'left');
            panelContent.style.left  = '';
            panelContent.style.right = '';
            closeTimer = null;
            try { App.removeFromStack(panel); } catch (_eStack) {}
        }
        
        var closeMs = 0;
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(panelContent) : null;
            var dur = cs ? String(cs.transitionDuration || '0s').split(',')[0].trim() : '0s';
            if (dur.endsWith('ms')) closeMs = Math.max(0, parseFloat(dur) || 0);
            else if (dur.endsWith('s')) closeMs = Math.max(0, (parseFloat(dur) || 0) * 1000);
        } catch (_eDur) {}

        if (!wasVisible || closeMs === 0) {
            finalizeClose();
        } else {
            closeTimer = setTimeout(finalizeClose, Math.ceil(closeMs));
        }
        
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
            // Button Class 2 uses aria-selected for styling - no class toggle needed
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
        
        // Update tab panels
        tabPanels.forEach(function(panel) {
            var isActive = panel.id === 'member-tab-' + tabName;
            panel.classList.toggle('member-tab-contents--active', isActive);
            panel.hidden = !isActive;
        });

        // Reset editing state if we leave the create tab
        if (tabName !== 'create' && isEditingPostId !== null) {
            isEditingPostId = null;
            if (createTabBtn) createTabBtn.textContent = 'Create Post';
        }
        
        // Lazy load Create Post tab content
        if (tabName === 'create') {
            loadFormpicker();
        }
        
        // Load user's posts when Post Editor tab is activated
        if (tabName === 'posteditor') {
            if (window.PostEditorModule && typeof PostEditorModule.init === 'function') {
                PostEditorModule.init(document.getElementById('member-tab-posteditor'));
            }
        }
        
        // Initialize Register tab content when activated
        if (tabName === 'register') {
            initRegisterTab();
        }
    }

    /* --------------------------------------------------------------------------
       FORMPICKER (Category/Subcategory selection)
       -------------------------------------------------------------------------- */
    
    var formpickerLoaded = false;
    var memberCategories = [];
    var memberCategoryIconPaths = {};
    var memberSubcategoryIconPaths = {};
    var checkoutOptions = [];
    var siteCurrency = null;
    var checkoutInstance = null;
    var appliedCoupon = null;
    var couponInputEl = null;
    var couponMsgEl = null;
    
    function loadFormpicker() {
        if (formpickerLoaded) return;
        
        var container = document.getElementById('member-formpicker-cats');
        if (!container) return;
        
        formWrapper = document.querySelector('.member-postform-container');
        formFields = document.getElementById('member-postform-fieldsets');
        
        container.innerHTML = '<p class="member-create-intro">Loading categories...</p>';
        
        // Fetch form data and checkout options from database
        ensureCategoriesLoaded().then(function() {
            if (memberCategories.length > 0) {
                renderFormpicker(container);
                formpickerLoaded = true;
            } else {
                container.innerHTML = '<p class="member-create-intro member-create-intro--error">Failed to load categories.</p>';
            }
        }).catch(function(err) {
            console.error('[Member] loadFormpicker error:', err);
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
        appliedCoupon = null;
        couponInputEl = null;
        couponMsgEl = null;
        
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
        subcategoryMenu.className = 'member-formpicker-menu menu-class-3';
        
        var subcategoryBtn = document.createElement('button');
        subcategoryBtn.type = 'button';
        subcategoryBtn.className = 'member-formpicker-menu-button menu-button';
        subcategoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text menu-text">Select a subcategory</span><span class="member-formpicker-menu-button-arrow menu-arrow"></span>';
        
        var subcategoryOpts = document.createElement('div');
        subcategoryOpts.className = 'member-formpicker-menu-options menu-options';
        
        subcategoryMenu.appendChild(subcategoryBtn);
        subcategoryMenu.appendChild(subcategoryOpts);
        subcategoryWrapper.appendChild(subcategoryMenu);
        
        // Category dropdown
        var categoryWrapper = document.createElement('div');
        categoryWrapper.className = 'member-panel-field';
        
        var categoryLabel = document.createElement('label');
        categoryLabel.className = 'member-panel-field-label';
        categoryLabel.textContent = 'Category / Subcategory';
        
        var categoryMenu = document.createElement('div');
        categoryMenu.className = 'member-formpicker-menu menu-class-3';
        
        var categoryBtn = document.createElement('button');
        categoryBtn.type = 'button';
        categoryBtn.className = 'member-formpicker-menu-button menu-button';
        categoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text menu-text">Select a category</span><span class="member-formpicker-menu-button-arrow menu-arrow"></span>';
        
        var categoryOpts = document.createElement('div');
        categoryOpts.className = 'member-formpicker-menu-options menu-options';

        function applyFormpickerMenuOpenState(menuEl, isOpen) {
            if (!menuEl) return;
            menuEl.classList.toggle('member-formpicker-menu--open', !!isOpen);
            var btnEl = menuEl.querySelector('.member-formpicker-menu-button');
            var arrowEl = menuEl.querySelector('.member-formpicker-menu-button-arrow');
            var optsEl = menuEl.querySelector('.member-formpicker-menu-options');
            if (btnEl) {
                btnEl.classList.toggle('member-formpicker-menu-button--open', !!isOpen);
                btnEl.classList.toggle('menu-button--open', !!isOpen);
            }
            if (arrowEl) {
                arrowEl.classList.toggle('member-formpicker-menu-button-arrow--open', !!isOpen);
                arrowEl.classList.toggle('menu-arrow--open', !!isOpen);
            }
            if (optsEl) {
                optsEl.classList.toggle('member-formpicker-menu-options--open', !!isOpen);
                optsEl.classList.toggle('menu-options--open', !!isOpen);
            }
            // When opening: reset highlight (keyboard nav handled by MenuManager at document level)
            if (isOpen && optsEl) {
                var opts = optsEl.querySelectorAll('.menu-option');
                opts.forEach(function(o) { o.classList.remove('menu-option--highlighted'); });
                if (opts.length > 0) opts[0].classList.add('menu-option--highlighted');
            }
        }
        
        // Setup MenuManager integration for a formpicker menu
        function setupFormpickerMenu(menuEl, btnEl) {
            // MenuManager requires these methods
            menuEl.__menuIsOpen = function() {
                return menuEl.classList.contains('member-formpicker-menu--open');
            };
            menuEl.__menuApplyOpenState = function(isOpen) {
                applyFormpickerMenuOpenState(menuEl, isOpen);
            };
            // Required for MenuManager document-level keyboard nav (works without button focus)
            menuEl.__menuGetOptionsEl = function() {
                return menuEl.querySelector('.member-formpicker-menu-options');
            };
            
            // Register with MenuManager
            try {
                if (window.MenuManager && typeof window.MenuManager.register === 'function') {
                    window.MenuManager.register(menuEl);
                }
            } catch (e) {}
            
            // Keyboard navigation using shared menuArrowKeyNav
            btnEl.addEventListener('keydown', function(e) {
                var key = e.key;
                var isOpen = menuEl.__menuIsOpen();
                
                // Open menu on ArrowDown/Enter/Space when closed
                if (!isOpen && (key === 'ArrowDown' || key === 'Enter' || key === ' ')) {
                    e.preventDefault();
                    try {
                        if (window.MenuManager && typeof window.MenuManager.closeAll === 'function') {
                            window.MenuManager.closeAll(menuEl);
                        }
                    } catch (e0) {}
                    menuEl.__menuApplyOpenState(true);
                    return;
                }
                
                if (!isOpen) return;
                
                // Query optsEl fresh each time (options may be rebuilt dynamically)
                var optsEl = menuEl.querySelector('.member-formpicker-menu-options');
                if (!optsEl) return;
                
                // Use shared menuArrowKeyNav for arrow/enter
                if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') {
                    if (typeof window.menuArrowKeyNav === 'function') {
                        var handled = window.menuArrowKeyNav(e, optsEl, '.menu-option', null);
                        if (handled) {
                            e.stopPropagation();
                            return;
                        }
                    }
                }
                
                // Escape closes menu
                if (key === 'Escape') {
                    e.preventDefault();
                    menuEl.__menuApplyOpenState(false);
                    return;
                }
                
                // Tab closes menu
                if (key === 'Tab') {
                    menuEl.__menuApplyOpenState(false);
                    return;
                }
            });
        }
        
        // Populate category options
        memberCategories.forEach(function(cat) {
            if (!cat || typeof cat.name !== 'string') return;
            
            var optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'member-formpicker-menu-option menu-option';
            
            // Get icon path - API returns paths keyed by category name directly
            var iconPath = categoryIconPaths[cat.name] || '';
            
            if (iconPath) {
                var iconImg = document.createElement('img');
                iconImg.className = 'member-formpicker-menu-option-image menu-image';
                iconImg.src = iconPath;
                iconImg.alt = '';
                optionBtn.appendChild(iconImg);
            }
            
            var textSpan = document.createElement('span');
            textSpan.className = 'member-formpicker-menu-option-text menu-option-text';
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
                    btnIcon.className = 'member-formpicker-menu-button-image menu-image';
                    btnIcon.src = iconPath;
                    btnIcon.alt = '';
                    categoryBtn.appendChild(btnIcon);
                }
                var btnText = document.createElement('span');
                btnText.className = 'member-formpicker-menu-button-text menu-text';
                btnText.textContent = cat.name;
                categoryBtn.appendChild(btnText);
                var btnArrow = document.createElement('span');
                btnArrow.className = 'member-formpicker-menu-button-arrow menu-arrow';
                categoryBtn.appendChild(btnArrow);
                
                categoryMenu.__menuApplyOpenState(false);
                selectedCategory = cat.name;
                selectedSubcategory = '';
                
                // Populate subcategories
                subcategoryOpts.innerHTML = '';
                if (cat.subs && cat.subs.length > 0) {
                    cat.subs.forEach(function(subName) {
                        var subBtn = document.createElement('button');
                        subBtn.type = 'button';
                        subBtn.className = 'member-formpicker-menu-option menu-option';
                        
                        // Get icon path - API returns paths keyed by subcategory name directly
                        var subIconPath = subcategoryIconPaths[subName] || '';
                        
                        if (subIconPath) {
                            var subIconImg = document.createElement('img');
                            subIconImg.className = 'member-formpicker-menu-option-image menu-image';
                            subIconImg.src = subIconPath;
                            subIconImg.alt = '';
                            subBtn.appendChild(subIconImg);
                        }
                        
                        var subTextSpan = document.createElement('span');
                        subTextSpan.className = 'member-formpicker-menu-option-text menu-option-text';
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
                                subBtnIcon.className = 'member-formpicker-menu-button-image menu-image';
                                subBtnIcon.src = subIconPath;
                                subBtnIcon.alt = '';
                                subcategoryBtn.appendChild(subBtnIcon);
                            }
                            var subBtnText = document.createElement('span');
                            subBtnText.className = 'member-formpicker-menu-button-text menu-text';
                            subBtnText.textContent = subName;
                            subcategoryBtn.appendChild(subBtnText);
                            var subBtnArrow = document.createElement('span');
                            subBtnArrow.className = 'member-formpicker-menu-button-arrow menu-arrow';
                            subcategoryBtn.appendChild(subBtnArrow);
                            
                            subcategoryMenu.__menuApplyOpenState(false);
                            selectedSubcategory = subName;
                            renderConfiguredFields();
                        });
                        
                        subcategoryOpts.appendChild(subBtn);
                    });
                    
                    subcategoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text menu-text">Select a subcategory</span><span class="member-formpicker-menu-button-arrow menu-arrow"></span>';
                    subcategoryWrapper.hidden = false;

                    // Auto-open subcategory menu as soon as a category is chosen.
                    // Keep it open until a subcategory is selected.
                    categoryMenu.__menuApplyOpenState(false);
                    subcategoryMenu.__menuApplyOpenState(true);
                    // Focus the subcategory button for keyboard nav
                    try { subcategoryBtn.focus(); } catch (e) {}
                } else {
                    subcategoryWrapper.hidden = true;
                }
                
                renderConfiguredFields();
            });
            
            categoryOpts.appendChild(optionBtn);
        });
        
        // Assemble category menu structure first
        categoryMenu.appendChild(categoryBtn);
        categoryMenu.appendChild(categoryOpts);
        
        // Setup MenuManager integration (must be after structure is complete)
        setupFormpickerMenu(categoryMenu, categoryBtn);
        setupFormpickerMenu(subcategoryMenu, subcategoryBtn);
        
        // Toggle category menu
        categoryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            try {
                if (window.MenuManager && typeof window.MenuManager.closeAll === 'function') {
                    window.MenuManager.closeAll(categoryMenu);
                }
            } catch (e0) {}
            categoryMenu.__menuApplyOpenState(!categoryMenu.__menuIsOpen());
        });
        
        // Toggle subcategory menu
        subcategoryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            try {
                if (window.MenuManager && typeof window.MenuManager.closeAll === 'function') {
                    window.MenuManager.closeAll(subcategoryMenu);
                }
            } catch (e0) {}
            subcategoryMenu.__menuApplyOpenState(!subcategoryMenu.__menuIsOpen());
        });
        categoryWrapper.appendChild(categoryLabel);
        categoryWrapper.appendChild(categoryMenu);
        
        dropdownsContainer.appendChild(categoryWrapper);
        dropdownsContainer.appendChild(subcategoryWrapper);
        container.appendChild(dropdownsContainer);

        // Auto-open category menu when nothing is selected yet.
        // Subcategory auto-open is handled when a category is picked.
        // Defer to next tick so the tab click event finishes before opening
        // (otherwise MenuManager's document click handler closes it immediately).
        if (!selectedCategory) {
            setTimeout(function() {
                categoryMenu.__menuApplyOpenState(true);
                // Focus the menu button so keyboard nav works immediately
                // and focus-visible doesn't appear on the tab button
                try { categoryBtn.focus(); } catch (e) {}
            }, 0);
        }
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

        // Track location quantity
        var locationQuantity = 1;
        var locationData = null;

        if (fields.length === 0) {
            var placeholder = document.createElement('p');
            placeholder.className = 'member-create-intro';
            placeholder.textContent = 'No fields configured for this subcategory yet.';
            if (formFields) formFields.appendChild(placeholder);
        } else {
            // Use shared Form Builder infrastructure for location containers
            if (window.FormbuilderModule && typeof window.FormbuilderModule.organizeFieldsIntoLocationContainers === 'function') {
                var locationTypeName = '';
                var venue1Name = '';
                locationData = window.FormbuilderModule.organizeFieldsIntoLocationContainers({
                    fields: fields,
                    container: formFields,
                    buildFieldset: function(fieldData, options) {
                        var field = ensureFieldDefaults(fieldData);
                        return FieldsetBuilder.buildFieldset(field, {
                            idPrefix: (options && options.idPrefix && typeof options.idPrefix === 'string') ? options.idPrefix : 'memberCreate',
                            fieldIndex: options.fieldIndex || 0,
                            container: options.container,
                            defaultCurrency: getDefaultCurrencyForForms()
                        });
                    },
                    initialQuantity: locationQuantity,
                    onQuantityChange: function(quantity, isIncrease) {
                        locationQuantity = quantity;
                        window._memberLocationQuantity = quantity;
                        
                        // FormBuilder blueprint now handles container re-rendering and header updates internally
                        // Member form only handles its specific logic (checkout context, events)
                        
                        if (checkoutInstance && typeof checkoutInstance.updateContext === 'function') {
                            checkoutInstance.updateContext({ locationCount: quantity });
                            updatePayButtonLabels();
                            try { formFields.dispatchEvent(new CustomEvent('fieldset:sessions-change', { bubbles: true })); } catch (e) {}
                        }
                    },
                    getMessage: function(key, params, fallback) {
                        if (typeof window.getMessage === 'function') {
                            return window.getMessage(key, params, fallback);
                        }
                        return Promise.resolve(null);
                    },
                    setupHeaderRenaming: true,
                    onDelete: function(container, locationNumber) {
                        var venueName = '';
                        if (locationData && locationData.venue1HeaderText && locationData.venue1HeaderText.textContent) {
                            venueName = locationData.venue1HeaderText.textContent.trim();
                        }
                        if (!venueName) {
                            venueName = venue1Name;
                        }
                        // Get location number before deletion for focus after renumber
                        var deletedNum = parseInt(container.dataset.locationNumber || '0', 10);
                        if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
                            ConfirmDialogComponent.show({
                                titleText: 'Delete ' + venueName,
                                messageText: 'This cannot be undone.',
                                confirmLabel: 'Delete',
                                cancelLabel: 'Cancel',
                                confirmClass: 'danger',
                                focusCancel: true
                            }).then(function(confirmed) {
                                if (confirmed) {
                                    container.remove();
                                    if (typeof window._memberLocationQuantity === 'number' && window._memberLocationQuantity > 1) {
                                        window._memberLocationQuantity--;
                                        var qtyDisplay = document.querySelector('.member-postform-location-quantity-display');
                                        if (qtyDisplay) qtyDisplay.textContent = window._memberLocationQuantity;
                                        if (window.FormbuilderModule && typeof FormbuilderModule.updateVenueDeleteButtons === 'function') {
                                            FormbuilderModule.updateVenueDeleteButtons();
                                        }
                                        if (window.FormbuilderModule && typeof FormbuilderModule.renumberLocationContainers === 'function') {
                                            FormbuilderModule.renumberLocationContainers();
                                        }
                                        // Focus the container that took the deleted one's place
                                        if (window.FormbuilderModule && typeof FormbuilderModule.focusLocationContainerAfterDelete === 'function') {
                                            FormbuilderModule.focusLocationContainerAfterDelete(deletedNum);
                                        }
                                    }
                                }
                            });
                        }
                    },
                    onActivate: function(container, locationNumber) {
                        var tabPanel = container.parentNode;
                        if (tabPanel) {
                            tabPanel.querySelectorAll('[data-active="true"]').forEach(function(c) {
                                c.removeAttribute('data-active');
                            });
                        }
                        container.setAttribute('data-active', 'true');
                    },
                    idPrefix: 'memberCreate'
                });
                
                // Store location type name for callbacks
                if (locationData && locationData.locationFieldsetType) {
                    locationTypeName = locationData.locationFieldsetType.charAt(0).toUpperCase() + locationData.locationFieldsetType.slice(1);
                    venue1Name = locationTypeName + ' 1';
                } else {
                    locationTypeName = 'Venue';
                    venue1Name = 'Venue 1';
                }
                
                // Store references for both member and formbuilder access
                if (locationData) {
                    window._memberVenue1DeleteBtn = locationData.venue1DeleteBtn;
                    window._memberVenue1Container = locationData.venue1Container;
                    window._memberLocationQuantity = locationQuantity;
                    // Also store for formbuilder's updateVenueDeleteButtons
                    window._formbuilderVenue1DeleteBtn = locationData.venue1DeleteBtn;
                }
            } else {
                // Fallback: render fields normally if Form Builder not available
                fields.forEach(function(fieldData, index) {
                    var field = ensureFieldDefaults(fieldData);
                    var fieldset = FieldsetBuilder.buildFieldset(field, {
                        idPrefix: 'memberCreate',
                        fieldIndex: index,
                        container: formFields,
                        defaultCurrency: getDefaultCurrencyForForms()
                    });
                    if (fieldset) formFields.appendChild(fieldset);
                });
            }
            
        }
        
        // Render checkout options at the bottom of the form (member-specific)
        renderCheckoutOptionsSection();

        // Render coupon code input below checkout options
        renderCouponSection();
        
        // Render terms agreement and submit buttons after checkout options (member-specific)
        renderTermsAndSubmitSection();

        // Show the form wrapper FIRST so any dependent UI (like inline auth container) can become interactive
        // immediately (no "must click something first" sequencing bug).
        if (formWrapper) formWrapper.hidden = false;

        // Keep submit state reactive: any change inside the form recalculates readiness.
        attachCreatePostValidationListeners();
        updateSubmitButtonState();
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
        
        // Use existing centralized checkout container
        var wrapper = formFields.querySelector('.member-checkout-container');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'member-checkout-container';
            formFields.appendChild(wrapper);
        }
        
        // Add specific member wrapper class
        wrapper.classList.add('fieldset', 'member-checkout-wrapper');
        
        // Clear previous content (except if we want to preserve it, but usually we re-render)
        wrapper.innerHTML = '';
        
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
                // Source of truth in DOM: data-selected-isos attribute synced by fieldset logic
                var isoCsv = fieldsetEl.dataset.selectedIsos || '';
                if (!isoCsv) {
                    // Fallback to labels if attribute not synced yet
                    // Check both sessions (new) and sessionpricing (legacy) class names
                    var days = fieldsetEl.querySelectorAll('.fieldset-sessions-session-field-label--selected[data-iso], .fieldset-sessionpricing-session-field-label--selected[data-iso]');
                    var latest = null;
                    days.forEach(function(el) {
                        var iso = el.dataset.iso;
                        if (!iso) return;
                        if (!latest || iso > latest) latest = iso;
                    });
                    return latest;
                }
                var sorted = isoCsv.split(',').filter(Boolean).sort();
                return sorted.length > 0 ? sorted[sorted.length - 1] : null;
            }

            var result = [];

            // Location 1 sessions are in the main form (not inside .member-location-container with location > 1)
            // Check for sessions fieldset first (new split), then session_pricing (legacy)
            var mainSessions = formFields.querySelector('.fieldset[data-fieldset-key="sessions"]') || 
                               formFields.querySelector('.fieldset[data-fieldset-key="session_pricing"]');
            var mainIso = getMaxSelectedIso(mainSessions);
            result.push(mainIso ? daysToIso(mainIso) : 0);

            // Locations 2+ are in separate containers (siblings of formWrapper)
            for (var i = 2; i <= qty; i++) {
                var container = formFields.querySelector('.member-location-container[data-location-number="' + i + '"]');
                var fs = container ? (container.querySelector('.fieldset[data-fieldset-key="sessions"]') || 
                                       container.querySelector('.fieldset[data-fieldset-key="session_pricing"]')) : null;
                var iso = getMaxSelectedIso(fs);
                result.push(iso ? daysToIso(iso) : 0);
            }

            return result;
        }

        function updateCheckoutContext() {
            if (!checkoutInstance || typeof checkoutInstance.updateContext !== 'function') return;
            
            // Critical: locationCount must match the number of venueDays returned by getEventVenueDaysFromDom
            var currentQty = window._memberLocationQuantity || 1;
            var venueDays = getEventVenueDaysFromDom(currentQty);

            if (isEvent) {
                checkoutInstance.updateContext({
                    surchargePercent: surchargePercent,
                    locationCount: currentQty,
                    eventVenueDays: venueDays
                });
            } else {
                checkoutInstance.updateContext({
                    surchargePercent: surchargePercent,
                    locationCount: currentQty
                });
            }
            applyCouponToDisplay();
            updatePayButtonLabels();
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
                    updatePayButtonLabels();
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
    }
    
    /* --------------------------------------------------------------------------
       COUPON CODE SECTION
       -------------------------------------------------------------------------- */

    function renderCouponSection() {
        if (!formFields) return;
        var checkoutContainer = formFields.querySelector('.member-checkout-container');
        if (!checkoutContainer) return;

        var section = document.createElement('div');
        section.className = 'fieldset member-coupon';

        var row = document.createElement('div');
        row.className = 'member-coupon-input-row';

        couponInputEl = document.createElement('input');
        couponInputEl.type = 'text';
        couponInputEl.className = 'fieldset-input input-class-1 member-coupon-input';
        couponInputEl.placeholder = 'Coupon code';
        couponInputEl.autocomplete = 'off';
        couponInputEl.setAttribute('maxlength', '32');
        couponInputEl.addEventListener('input', function() {
            var pos = this.selectionStart;
            var cleaned = this.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
            if (cleaned !== this.value) {
                this.value = cleaned;
                this.setSelectionRange(pos, pos);
            }
            if (appliedCoupon) {
                appliedCoupon = null;
                clearCouponDisplay();
                setCouponMessage('', '');
            }
        });
        couponInputEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); }
        });

        var applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'member-coupon-apply button-class-2';
        applyBtn.textContent = 'Apply';
        applyBtn.addEventListener('click', applyCoupon);

        couponMsgEl = document.createElement('div');
        couponMsgEl.className = 'member-coupon-message';
        couponMsgEl.hidden = true;

        row.appendChild(couponInputEl);
        row.appendChild(applyBtn);
        section.appendChild(row);
        section.appendChild(couponMsgEl);
        checkoutContainer.appendChild(section);
    }

    function setCouponMessage(text, type) {
        if (!couponMsgEl) return;
        if (!text) {
            couponMsgEl.hidden = true;
            couponMsgEl.textContent = '';
            couponMsgEl.className = 'member-coupon-message';
            return;
        }
        couponMsgEl.textContent = text;
        couponMsgEl.className = 'member-coupon-message member-coupon-message--' + type;
        couponMsgEl.hidden = false;
    }

    function applyCoupon() {
        if (!couponInputEl) return;
        var code = couponInputEl.value.trim().toUpperCase();
        if (!code) { couponInputEl.focus(); return; }

        var memberId = currentUser ? (currentUser.id || 0) : 0;
        setCouponMessage('Checking\u2026', 'checking');

        fetch('/gateway.php?action=verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'coupon', code: code, member_id: memberId })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                appliedCoupon = {
                    id: data.coupon_id,
                    code: data.code,
                    discount_type: data.discount_type,
                    discount_value: data.discount_value
                };
                applyCouponToDisplay();
                updatePayButtonLabels();
                var discountStr = data.discount_type === 'percent'
                    ? data.discount_value + '%'
                    : CurrencyComponent.formatWithSymbol(String(data.discount_value), siteCurrency || null, { trimZeroDecimals: false });
                getMessage('msg_coupon_applied', { code: data.code, discount: discountStr }, false).then(function(msg) {
                    setCouponMessage(msg || (data.code + ' applied \u2014 ' + discountStr), 'success');
                });
            } else {
                appliedCoupon = null;
                clearCouponDisplay();
                updatePayButtonLabels();
                var rawKey = data.error_key || 'coupon_invalid';
                var msgKey = rawKey.indexOf('msg_') === 0 ? rawKey : 'msg_' + rawKey;
                getMessage(msgKey, {}, false).then(function(msg) {
                    setCouponMessage(msg || 'Invalid coupon code.', 'error');
                });
            }
        })
        .catch(function() {
            setCouponMessage('Unable to verify coupon. Please try again.', 'error');
        });
    }

    function computeCouponDiscount(basePrice, coupon) {
        if (!coupon) return basePrice;
        var discounted;
        if (coupon.discount_type === 'percent') {
            discounted = basePrice * (1 - coupon.discount_value / 100);
        } else {
            discounted = basePrice - coupon.discount_value;
        }
        return Math.max(discounted, 1.00);
    }

    function applyCouponToDisplay() {
        if (!checkoutInstance) return;
        var wrapper = formFields ? formFields.querySelector('.member-checkout-wrapper') : null;
        if (!wrapper) return;
        var radios = wrapper.querySelectorAll('input[type="radio"][data-price]');
        if (!radios.length) return;
        var curr = siteCurrency || null;
        radios.forEach(function(radio) {
            var basePrice = parseFloat(radio.dataset.basePrice || radio.dataset.price) || 0;
            if (!appliedCoupon) {
                if (radio.dataset.basePrice) {
                    radio.dataset.price = radio.dataset.basePrice;
                    delete radio.dataset.basePrice;
                }
                var textEl = radio.parentNode ? radio.parentNode.querySelector('.member-checkout-duration-text') : null;
                if (textEl && textEl.dataset.originalText) {
                    textEl.textContent = textEl.dataset.originalText;
                    delete textEl.dataset.originalText;
                }
                return;
            }
            if (!radio.dataset.basePrice) radio.dataset.basePrice = radio.dataset.price;
            var discounted = computeCouponDiscount(basePrice, appliedCoupon);
            radio.dataset.price = discounted.toFixed(2);
            var textEl = radio.parentNode ? radio.parentNode.querySelector('.member-checkout-duration-text') : null;
            if (textEl) {
                if (!textEl.dataset.originalText) textEl.dataset.originalText = textEl.textContent;
                var parts = textEl.dataset.originalText.split(' \u2014 ');
                var summary = parts[0] || '';
                var origFormatted = CurrencyComponent.formatWithSymbol(basePrice.toFixed(2), curr, { trimZeroDecimals: false });
                var newFormatted = CurrencyComponent.formatWithSymbol(discounted.toFixed(2), curr, { trimZeroDecimals: false });
                textEl.innerHTML = summary + ' \u2014 <s>' + origFormatted + '</s> ' + newFormatted;
            }
        });
    }

    function clearCouponDisplay() {
        applyCouponToDisplay();
    }

    // Form terms agreement row element
    var formTermsCheckbox = null;
    
    function renderTermsAndSubmitSection() {
        if (!formFields) return;
        
        // Find centralized checkout container to append terms and actions inside it
        // Create it if it doesn't exist (e.g., when checkoutOptions is empty for events)
        var checkoutContainer = formFields.querySelector('.member-checkout-container');
        if (!checkoutContainer) {
            checkoutContainer = document.createElement('div');
            checkoutContainer.className = 'member-checkout-container fieldset member-checkout-wrapper';
            formFields.appendChild(checkoutContainer);
        }
        
        // Terms container
        var termsWrapper = document.createElement('div');
        termsWrapper.className = 'fieldset member-terms';
        
        var checkboxWrapper = document.createElement('label');
        checkboxWrapper.className = 'member-terms-label';
        
        formTermsCheckbox = document.createElement('input');
        formTermsCheckbox.type = 'checkbox';
        formTermsCheckbox.className = 'member-terms-checkbox';
        formTermsCheckbox.checked = termsAgreed;
        formTermsCheckbox.addEventListener('change', function() {
            termsAgreed = formTermsCheckbox.checked;
            updateSubmitButtonState();
        });
        
        var labelText = document.createElement('span');
        labelText.className = 'member-terms-text';
        labelText.textContent = 'I agree to the ';
        
        var termsLinkInline = document.createElement('a');
        termsLinkInline.href = '#';
        termsLinkInline.className = 'member-terms-link';
        termsLinkInline.textContent = 'Terms and Conditions';
        termsLinkInline.addEventListener('click', function(e) {
            e.preventDefault();
            openTermsModal();
        });
        
        checkboxWrapper.appendChild(formTermsCheckbox);
        checkboxWrapper.appendChild(labelText);
        checkboxWrapper.appendChild(termsLinkInline);
        termsWrapper.appendChild(checkboxWrapper);
        checkoutContainer.appendChild(termsWrapper);
        
        // Submit buttons via shared component
        var paymentRefs = PaymentSubmitComponent.create({
            baseLabel: 'Pay',
            isAdmin: currentUser && currentUser.isAdmin,
            onSubmitClick: function(e) {
                e.preventDefault();
                var loggedIn = hasValidLoggedInUser();
                if (loggedIn) {
                    handleCreatePostSubmit(false);
                } else {
                    var active = createAuthWrapper ? String(createAuthWrapper.dataset.active || 'login') : 'login';
                    if (active === 'register') {
                        handleCreateAuthRegister();
                    } else {
                        handleCreateAuthLogin();
                    }
                }
            },
            onAdminClick: function(e) {
                e.preventDefault();
                handleCreatePostSubmit(true);
            }
        });
        submitBtn = paymentRefs.submitBtn;
        adminSubmitBtn = paymentRefs.adminBtn;
        
        checkoutContainer.appendChild(paymentRefs.container);
        
        // Hover popover listing all missing items (no toasts; button stays truly disabled)
        attachMissingPopoverToButton(submitBtn, function() {
            var loggedIn = hasValidLoggedInUser();
            if (loggedIn) return getCreatePostMissingList({ mode: null });
            var active = createAuthWrapper ? String(createAuthWrapper.dataset.active || 'login') : 'login';
            return getCreatePostMissingList({ mode: active });
        });
        if (adminSubmitBtn) {
            attachMissingPopoverToButton(adminSubmitBtn, function() { return getCreatePostMissingList({ mode: null }); });
        }

        // Now that the submit buttons exist, compute their real enabled/disabled state.
        updateSubmitButtonState();
        updatePayButtonLabels();
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
            var name = '';
            if (fs.dataset && fs.dataset.fieldsetName && typeof fs.dataset.fieldsetName === 'string') {
                name = fs.dataset.fieldsetName.trim();
            } else if (fs.dataset && fs.dataset.fieldsetKey && typeof fs.dataset.fieldsetKey === 'string') {
                name = fs.dataset.fieldsetKey.trim();
            }
            if (!name) {
                name = 'Field';
            }
            var type = String(fs.dataset.fieldsetType || '').trim();
            var baseType = type.replace(/-locked$/, '').replace(/-hidden$/, '');

            // Choose the most appropriate existing message key.
            var msgKey = 'msg_post_validation_required';
            if (baseType === 'custom-dropdown') msgKey = 'msg_post_validation_select';
            if (baseType === 'custom-checklist') msgKey = 'msg_post_validation_choose';
            if (baseType === 'custom-radio' || baseType === 'checkout') msgKey = 'msg_post_validation_choose';
            if (baseType === 'images') msgKey = 'msg_post_validation_file_required';
            if (baseType === 'item-pricing' || baseType === 'session-pricing' || baseType === 'ticket-pricing' || baseType === 'sessions') msgKey = 'msg_post_validation_pricing';
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
        if (!formFields) return out;

        // Incomplete/invalid items in on-screen order (DOM order).
        // - Fieldsets own their own completeness via data-complete
        // - Checkout uses .member-checkout-group[data-complete]
        // - Skip auth container fieldsets (handled separately below)
        var fieldsets = formFields.querySelectorAll('.fieldset[data-complete="false"], .member-checkout-group[data-complete="false"]');
        for (var i = 0; i < fieldsets.length; i++) {
            var fs = fieldsets[i];
            if (!fs || !fs.dataset) continue;
            // Skip fieldsets inside auth container (we add those separately after terms)
            if (fs.closest('.member-auth-container')) continue;
            if (fs.classList.contains('member-checkout-group')) {
                out.push('Checkout Options');
                continue;
            }
            // Get name from label text (includes location number if applicable)
            var name = '';
            var labelTextEl = fs.querySelector('.fieldset-label-text');
            if (labelTextEl && labelTextEl.textContent) {
                name = labelTextEl.textContent.trim();
            } else if (fs.dataset && fs.dataset.fieldsetName && typeof fs.dataset.fieldsetName === 'string') {
                name = fs.dataset.fieldsetName.trim();
            } else if (fs.dataset && fs.dataset.fieldsetKey && typeof fs.dataset.fieldsetKey === 'string') {
                name = fs.dataset.fieldsetKey.trim();
            }
            if (name) out.push(name);
        }
        
        // Terms appear before auth fields.
        if (!termsAgreed) out.push('Terms and Conditions');

        // Auth fields (login/register) appear after Terms.
        if (mode === 'login') {
            try {
                if (createAuthLoginEmailInput && String(createAuthLoginEmailInput.value || '').trim() === '') {
                    var lbl = createAuthLoginContainer ? createAuthLoginContainer.querySelector('label[for="memberCreateLoginEmail"]') : null;
                    var txt = lbl ? String(lbl.textContent || '').trim() : '';
                    out.push(txt || 'Email');
                }
                if (createAuthLoginPasswordInput && String(createAuthLoginPasswordInput.value || '').trim() === '') {
                    var lbl2 = createAuthLoginContainer ? createAuthLoginContainer.querySelector('label[for="memberCreateLoginPassword"]') : null;
                    var txt2 = lbl2 ? String(lbl2.textContent || '').trim() : '';
                    out.push(txt2 || 'Password');
                }
            } catch (e1) {}
        } else if (mode === 'register') {
            try {
                if (createAuthRegisterContainer) {
                    var req = createAuthRegisterContainer.querySelectorAll('.fieldset[data-required="true"][data-complete="false"]');
                    for (var j = 0; j < req.length; j++) {
                        var fs2 = req[j];
                        if (!fs2 || !fs2.dataset) continue;
                        var nm = '';
                        if (fs2.dataset && fs2.dataset.fieldsetName && typeof fs2.dataset.fieldsetName === 'string') {
                            nm = fs2.dataset.fieldsetName.trim();
                        } else if (fs2.dataset && fs2.dataset.fieldsetKey && typeof fs2.dataset.fieldsetKey === 'string') {
                            nm = fs2.dataset.fieldsetKey.trim();
                        }
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

        var titleEl = document.createElement('div');
        titleEl.className = 'member-missing-popover-title';
        titleEl.textContent = 'Incomplete';
        pop.appendChild(titleEl);

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
            
            // getItemsFn can return:
            // - An array of strings (backward compatible, title defaults to "Incomplete")
            // - An object { title: string, items: string[] } for custom title
            var result = null;
            try { result = (typeof getItemsFn === 'function') ? getItemsFn() : null; } catch (e0) { result = null; }
            
            var items = [];
            var popTitle = 'Incomplete';
            
            if (Array.isArray(result)) {
                items = result;
            } else if (result && typeof result === 'object') {
                items = Array.isArray(result.items) ? result.items : [];
                if (result.title && typeof result.title === 'string') {
                    popTitle = result.title;
                }
            }
            
            if (!items || items.length === 0) return;
            titleEl.textContent = popTitle;
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

        // Admin button: dynamically create when admin logs in, remove when non-admin
        if (loggedIn && currentUser && currentUser.isAdmin) {
            if (!adminSubmitBtn && submitBtn && submitBtn.parentNode) {
                adminSubmitBtn = document.createElement('button');
                adminSubmitBtn.type = 'button';
                adminSubmitBtn.className = 'component-paymentsubmit-admin button-class-2c';
                adminSubmitBtn.textContent = 'Admin: Submit Free';
                adminSubmitBtn.disabled = true;
                submitBtn.parentNode.appendChild(adminSubmitBtn);
                attachMissingPopoverToButton(adminSubmitBtn, function() { return getCreatePostMissingList({ mode: null }); });
                adminSubmitBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    handleCreatePostSubmit(true);
                });
            }
            if (adminSubmitBtn) {
                adminSubmitBtn.hidden = false;
                adminSubmitBtn.disabled = !ready;
            }
        } else {
            if (adminSubmitBtn) {
                try { adminSubmitBtn.remove(); } catch (e) {}
                adminSubmitBtn = null;
            }
        }

        // Logged-out users: mount/unmount inline auth UI on demand.
        var showAuth = (!loggedIn && formWrapper && formWrapper.hidden === false);
        if (showAuth) {
            ensureCreateAuthMounted();
        } else {
            if (createAuthWrapper) unmountCreateAuth();
        }

        // Single submitBtn — label and disabled state change based on auth state.
        if (submitBtn) {
            var baseLabel;
            if (loggedIn) {
                submitBtn.disabled = !ready;
                baseLabel = 'Pay';
            } else {
                var active = createAuthWrapper ? String(createAuthWrapper.dataset.active || 'login') : 'login';
                if (active === 'register') {
                    submitBtn.disabled = (!ready || !isCreateAuthRegisterComplete());
                    baseLabel = 'Register & Pay';
                } else {
                    var loginFilled = !!(createAuthLoginEmailInput && String(createAuthLoginEmailInput.value || '').trim() && createAuthLoginPasswordInput && String(createAuthLoginPasswordInput.value || '').trim());
                    submitBtn.disabled = (!ready || !loginFilled);
                    baseLabel = 'Log In & Pay';
                }
            }
            submitBtn.setAttribute('data-base-label', baseLabel);
            updatePayButtonLabels();
        }
    }

    function updatePayButtonLabels() {
        if (!submitBtn) return;
        var baseLabel = submitBtn.getAttribute('data-base-label');
        if (!baseLabel) return;

        var price = null;
        var currencyCode = siteCurrency || null;
        if (checkoutInstance && typeof checkoutInstance.getSelected === 'function') {
            var sel = checkoutInstance.getSelected();
            if (sel && sel.price !== null && sel.price !== undefined && isFinite(sel.price)) {
                price = sel.price;
            }
        }

        var suffix = '';
        if (price !== null) {
            suffix = ' ' + CurrencyComponent.formatWithSymbol(price.toFixed(2), currencyCode, { trimZeroDecimals: false });
        }

        var textEl = submitBtn.querySelector('.component-paymentsubmit-button-text');
        if (textEl) {
            textEl.textContent = baseLabel + suffix;
        }
    }
    
    /* --------------------------------------------------------------------------
       POST SUBMISSION
       -------------------------------------------------------------------------- */
    
    function handleCreatePostSubmit(isAdminFree, _transactionId) {
        if (isSubmittingPost) return;

        // Posting requires a real member session (posts.member_id is NOT NULL).
        // When logged out, show inline Login/Register under the form so drafts are not lost.
        if (!hasValidLoggedInUser()) {
            showCreateAuth(isAdminFree);
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

        // Payment intercept: required for non-admin, non-free submissions
        // _transactionId is set when re-entering after successful PayPal payment
        if (!isAdminFree && !_transactionId) {
            var sel = checkoutInstance && typeof checkoutInstance.getSelected === 'function'
                ? checkoutInstance.getSelected() : null;
            var chargeAmount = sel && sel.price !== null && isFinite(sel.price) ? parseFloat(sel.price) : 0;
            
            // Guard: never submit a paid create-post without a transaction id.
            // If checkout isn't selected / priced yet, block and prompt the user instead of triggering backend 402.
            if (!sel || sel.price === null || !isFinite(sel.price) || !(chargeAmount > 0)) {
                if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                    getMessage('msg_post_validation_choose', {}, false).then(function(msg) {
                        if (msg) ToastComponent.showError(msg);
                    });
                }
                try {
                    var checkoutFs = formFields ? formFields.querySelector('.member-checkout-wrapper') : null;
                    if (checkoutFs && typeof checkoutFs.scrollIntoView === 'function') {
                        checkoutFs.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } catch (e0) {}
                return;
            }
            if (chargeAmount > 0) {
                var chargeCurrency = siteCurrency || 'USD';
                // Extract checkout_key from the validated fields
                var chargeCheckoutKey = null;
                if (validation.payload && Array.isArray(validation.payload.fields)) {
                    validation.payload.fields.forEach(function(f) {
                        if (f && f.key === 'checkout' && f.value && f.value.checkout_key) {
                            chargeCheckoutKey = f.value.checkout_key;
                        }
                    });
                }
                if (window.PaymentModule && typeof PaymentModule.charge === 'function') {
                    if (submitBtn) PaymentSubmitComponent.setLoading(submitBtn, true);
                    PaymentModule.charge({
                        amount:          chargeAmount,
                        currency:        chargeCurrency,
                        description:     'New post',
                        memberId:        currentUser ? currentUser.id : null,
                        postId:          null,
                        transactionType: 'new_post',
                        checkoutKey:     chargeCheckoutKey,
                        lineItems:       [{ type: 'new_post', checkout_key: chargeCheckoutKey, days: sel ? sel.days : null, amount: chargeAmount }],
                        onReady: function() {
                            if (submitBtn) PaymentSubmitComponent.setLoading(submitBtn, false);
                        },
                        onSuccess: function(result) {
                            handleCreatePostSubmit(isAdminFree, result.transactionId);
                        },
                        onCancel: function() {
                            if (submitBtn) { PaymentSubmitComponent.setLoading(submitBtn, false); submitBtn.disabled = false; }
                            if (adminSubmitBtn) adminSubmitBtn.disabled = false;
                        },
                        onError: function() {
                            if (submitBtn) { PaymentSubmitComponent.setLoading(submitBtn, false); submitBtn.disabled = false; }
                            if (adminSubmitBtn) adminSubmitBtn.disabled = false;
                        }
                    });
                }
                return;
            }
        }

        // Start submission
        isSubmittingPost = true;
        if (submitBtn) submitBtn.disabled = true;
        if (adminSubmitBtn) adminSubmitBtn.disabled = true;
        
        // Extract images from validation (collected before form clears)
        var imageFiles = validation.imageFiles || [];
        var imagesMeta = validation.imagesMeta || '[]';
        
        // Immediately switch to Post Editor with loading placeholder (no delay)
        resetCreatePostForm();
        try { requestTabSwitch('posteditor'); } catch (e0) {}
        if (window.PostEditorModule && typeof PostEditorModule.showLoadingPlaceholder === 'function') {
            PostEditorModule.showLoadingPlaceholder(validation.payload);
        }
        
        // Collect map images for final locations (runs while loading shows)
        var finalLocations = extractLocationsFromPayload(validation.payload);
        console.log('[TRACK] Final locations for map images:', finalLocations.length, finalLocations);
        captureMapImagesForLocations(finalLocations).then(function(mapImageData) {
            console.log('[TRACK] Map images collected:', mapImageData.files.length);
            
            submitPostData(validation.payload, isAdminFree, imageFiles, imagesMeta, mapImageData, _transactionId)
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
                    // Update placeholder to show success
                    if (window.PostEditorModule && typeof PostEditorModule.updateLoadingPlaceholder === 'function') {
                        PostEditorModule.updateLoadingPlaceholder('success', result);
                    }

                    // Notify the rest of the app that a post was created so it appears on the map/list immediately.
                    if (isEditingPostId) {
                        App.emit('post:updated', { post_id: isEditingPostId });
                    } else {
                        App.emit('post:created', { post_id: result.insert_id });
                    }
                    
                    // Update local storage with detected currency (so next post pre-fills)
                    try {
                        var detectedCurr = extractCurrencyFromPayload(validation.payload);
                        if (detectedCurr) {
                            var rawU = localStorage.getItem('member-auth-current');
                            if (rawU) {
                                var userObj = JSON.parse(rawU);
                                if (userObj) {
                                    userObj.preferred_currency = detectedCurr;
                                    localStorage.setItem('member-auth-current', JSON.stringify(userObj));
                                }
                            }
                        }
                    } catch (_eCurr) {}
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
                    // Update placeholder to show error
                    if (window.PostEditorModule && typeof PostEditorModule.updateLoadingPlaceholder === 'function') {
                        PostEditorModule.updateLoadingPlaceholder('error', result);
                    }
                }
            })
            .catch(function(err) {
                console.error('[Member] Post submission failed:', err);
                isSubmittingPost = false;
                updateSubmitButtonState();
                
                // Update placeholder to show error
                if (window.PostEditorModule && typeof PostEditorModule.updateLoadingPlaceholder === 'function') {
                    PostEditorModule.updateLoadingPlaceholder('error', err);
                }
                
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
        }); // End captureMapImagesForLocations.then
    }
    
    function updateFormpickerSelections(catName, subName) {
        var catBtn = document.querySelector('#member-formpicker-cats .member-formpicker-menu-button');
        var subBtn = document.querySelector('#member-formpicker-cats div[hidden=""] .member-formpicker-menu-button') 
                  || document.querySelector('#member-formpicker-cats .member-formpicker-menu:last-child .member-formpicker-menu-button');
        
        if (catBtn) {
            var text = catBtn.querySelector('.menu-text');
            if (text) text.textContent = catName;
        }
        
        if (subBtn) {
            var text = subBtn.querySelector('.menu-text');
            if (text) text.textContent = subName;
            // Ensure subcategory wrapper is visible
            var wrapper = subBtn.closest('.member-panel-field');
            if (wrapper) wrapper.hidden = false;
        }
    }

    function renderConfiguredFieldsWithData(post) {
        if (!selectedCategory || !selectedSubcategory) return;

        // Ensure FieldsetBuilder is ready
        if (window.FieldsetBuilder && typeof FieldsetBuilder.loadFromDatabase === 'function') {
            if (!renderConfiguredFields._fieldsetLoadPromise) {
                renderConfiguredFields._fieldsetLoadPromise = FieldsetBuilder.loadFromDatabase();
            }
            renderConfiguredFields._fieldsetLoadPromise.then(function() {
                renderConfiguredFields._renderBodyWithData(post);
            });
            return;
        }

        renderConfiguredFields._renderBodyWithData(post);
    }

    renderConfiguredFields._renderBodyWithData = function(post) {
        // First render the normal empty fields
        renderConfiguredFields._renderBody();
        
        // Then populate them with post data
        populateFormWithPostData(post);
        
        // Update submit button text
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        if (adminSubmitBtn) adminSubmitBtn.textContent = 'Save Changes';
    };

    function populateFormWithPostData(post) {
        if (!post || !post.map_cards || post.map_cards.length === 0) return;
        
        var mapCard = post.map_cards[0]; // Currently supporting single map card edit
        
        // Map card fields
        var fields = [
            { key: 'title', value: mapCard.title },
            { key: 'description', value: mapCard.description },
            { key: 'venue_name', value: mapCard.venue_name },
            { key: 'address_line', value: mapCard.address_line },
            { key: 'city', value: mapCard.city },
            { key: 'public-email', value: mapCard.public_email },
            { key: 'public-phone', value: mapCard.public_phone },
            { key: 'ticket_url', value: mapCard.ticket_url },
            { key: 'coupon_code', value: mapCard.coupon_code },
            { key: 'custom-text', value: mapCard.custom_text },
            { key: 'custom-textarea', value: mapCard.custom_textarea }
        ];

        fields.forEach(function(f) {
            if (f.value !== null && f.value !== undefined) {
                var input = formFields.querySelector('[data-fieldset-key="' + f.key + '"] input, [data-fieldset-key="' + f.key + '"] textarea');
                if (input) {
                    input.value = f.value;
                    // Trigger input event for character counts etc.
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });

        // TODO: Handle complex fieldsets (images, sessions, pricing, checkout)
        // This will require more specific logic for each field type.
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Extract lat/lng from final locations in payload
    function extractLocationsFromPayload(payload) {
        var locations = [];
        if (!payload || !Array.isArray(payload.fields)) return locations;
        
        payload.fields.forEach(function(field) {
            // Look for venue, city, or address fieldsets with latitude/longitude
            if (field.key === 'venue' || field.key === 'city' || field.key === 'address') {
                var lat = null, lng = null, locNum = field.location_number || 1;
                var venueName = '';
                if (field.value && typeof field.value === 'object') {
                    lat = parseFloat(field.value.latitude);
                    lng = parseFloat(field.value.longitude);
                    // Get venue/location name for filename
                    venueName = field.value.venue_name || field.value.address_line || '';
                }
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    var exists = locations.some(function(loc) {
                        return loc.lat === lat && loc.lng === lng;
                    });
                    if (!exists) {
                        locations.push({ lat: lat, lng: lng, location_number: locNum, venue_name: venueName });
                    }
                }
            }
        });
        
        return locations;
    }
    
    // Convert dataUrl to File for upload
    // Naming convention: slug__lat_lng__Z18-P75-{N/E/S/W}.webp
    function dataUrlToFile(dataUrl, lat, lng, bearing, venueName) {
        try {
            var parts = dataUrl.split(',');
            var mime = parts[0].match(/:(.*?);/)[1];
            var bstr = atob(parts[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            var blob = new Blob([u8arr], { type: mime });
            
            // Bearing to direction letter
            var bearingMap = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
            var dir = bearingMap[bearing] || 'N';
            
            // Slugify venue name or use 'location'
            var slug = 'location';
            if (venueName && typeof venueName === 'string' && venueName.trim()) {
                slug = venueName.toLowerCase().trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')
                    .substring(0, 50) || 'location';
            }
            
            var filename = slug + '__' + lat.toFixed(6) + '_' + lng.toFixed(6) + '__Z18-P75-' + dir + '.webp';
            return new File([blob], filename, { type: 'image/webp' });
        } catch (e) {
            return null;
        }
    }
    
    // Collect map images from browser cache for final locations
    function captureMapImagesForLocations(locations) {
        return new Promise(function(resolve) {
            var result = { files: [], meta: [] };
            if (!locations || !locations.length) { resolve(result); return; }
            
            var bearings = [0, 90, 180, 270];
            var pending = locations.length;
            
            function addToResult(file, loc, bearing) {
                if (file) {
                    result.files.push(file);
                    result.meta.push({ lat: loc.lat, lng: loc.lng, bearing: bearing, location_number: loc.location_number });
                }
            }
            
            locations.forEach(function(loc) {
                fetch('/gateway.php?action=get-map-wallpapers&lat=' + encodeURIComponent(loc.lat) + '&lng=' + encodeURIComponent(loc.lng))
                    .then(function(r) { return r.json(); })
                    .then(function(resp) {
                        if (resp && resp.success && resp.wallpapers && Object.keys(resp.wallpapers).length === 4) {
                            console.log('[TRACK] Map images already on server for', loc.lat, loc.lng);
                            pending--;
                            if (pending === 0) resolve(result);
                            return;
                        }
                        
                        if (!window.WallpaperCache || typeof WallpaperCache.getAll !== 'function') {
                            pending--;
                            if (pending === 0) resolve(result);
                            return;
                        }
                        
                        WallpaperCache.getAll(loc.lat, loc.lng, bearings, function(cachedUrls) {
                            var foundCount = cachedUrls.filter(function(u) { return !!u; }).length;
                            console.log('[TRACK] Found', foundCount, '/4 in browser cache for', loc.lat, loc.lng);
                            
                            if (foundCount === 4) {
                                bearings.forEach(function(bearing, idx) {
                                    addToResult(dataUrlToFile(cachedUrls[idx], loc.lat, loc.lng, bearing, loc.venue_name), loc, bearing);
                                });
                                pending--;
                                if (pending === 0) resolve(result);
                            } else {
                                console.log('[TRACK] Capturing missing images for', loc.lat, loc.lng);
                                collectWithFallbackCapture(loc, bearings, cachedUrls, result, addToResult, function() {
                                    pending--;
                                    if (pending === 0) resolve(result);
                                });
                            }
                        });
                    })
                    .catch(function() {
                        pending--;
                        if (pending === 0) resolve(result);
                    });
            });
        });
    }
    
    // Collect from cache, capture any missing
    function collectWithFallbackCapture(loc, bearings, cachedUrls, result, addToResult, done) {
        var capturedCount = 0;
        bearings.forEach(function(bearing, idx) {
            if (cachedUrls[idx]) {
                addToResult(dataUrlToFile(cachedUrls[idx], loc.lat, loc.lng, bearing, loc.venue_name), loc, bearing);
                capturedCount++;
                if (capturedCount === 4) done();
            } else if (window.SecondaryMap && typeof SecondaryMap.capture === 'function') {
                var camera = { center: [loc.lng, loc.lat], zoom: 18, pitch: 75, bearing: bearing };
                SecondaryMap.capture(camera, 700, 2500, function(dataUrl) {
                    if (dataUrl) addToResult(dataUrlToFile(dataUrl, loc.lat, loc.lng, bearing, loc.venue_name), loc, bearing);
                    capturedCount++;
                    if (capturedCount === 4) done();
                });
            } else {
                capturedCount++;
                if (capturedCount === 4) done();
            }
        });
    }
    
    // Convert dataUrl to Blob (legacy, kept for compatibility)
    function dataUrlToBlob(dataUrl) {
        try {
            var parts = dataUrl.split(',');
            var mime = parts[0].match(/:(.*?);/)[1];
            var bstr = atob(parts[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            return new Blob([u8arr], { type: mime });
        } catch (e) {
            return null;
        }
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
                var locWrap = el.closest ? el.closest('.member-location-container[data-location-number]') : null;
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
        
        // Collect image files BEFORE form is cleared (form clears before submitPostData runs)
        var imageFiles = [];
        var imagesMeta = '[]';
        var imagesFs = formFields ? formFields.querySelector('.fieldset[data-fieldset-type="images"], .fieldset[data-fieldset-key="images"]') : null;
        if (imagesFs) {
            var fileInput = imagesFs.querySelector('input[type="file"]');
            var metaInput = imagesFs.querySelector('input.fieldset-images-meta');
            if (fileInput && Array.isArray(fileInput._imageFiles)) {
                imageFiles = fileInput._imageFiles.slice();
            }
            if (metaInput) {
                imagesMeta = String(metaInput.value || '[]');
            }
        }
        
        console.log('[TRACK] validateAndCollectFormData complete. imageFiles:', imageFiles.length, 'payload fields:', Object.keys(payload));
        return { payload: payload, imageFiles: imageFiles, imagesMeta: imagesMeta };
    }
    
    function extractFieldValue(el, fieldType) {
        var baseType = fieldType.replace(/-locked$/, '').replace(/-hidden$/, '');
        
        switch (baseType) {
            case 'text':
            case 'text-short':
            case 'text-medium':
            case 'text-long':
            case 'email':
            case 'account-email':
            case 'public-email':
            case 'url':
                var input = el.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"]');
                return input ? input.value.trim() : '';
                
            case 'custom-textarea':
            case 'description':
                var textarea = el.querySelector('textarea');
                return textarea ? textarea.value.trim() : '';
                
            case 'number':
                var numInput = el.querySelector('input[type="number"], input[type="text"]');
                return numInput ? numInput.value.trim() : '';
                
            case 'custom-dropdown':
                var menuBtn = el.querySelector('button.form-preview-select');
                var select = el.querySelector('select');
                if (menuBtn) return menuBtn.dataset.value || '';
                if (select) return select.value || '';
                return '';
                
            case 'custom-checklist': {
                var list = el.querySelector('.fieldset-customchecklist');
                if (!list) return [];
                try {
                    var arr = JSON.parse(String(list.dataset.value || '[]'));
                    return Array.isArray(arr) ? arr : [];
                } catch (eC) {
                    return [];
                }
            }
                
            case 'custom-radio':
                var radioGroup = el.querySelector('.fieldset-radio-group');
                return radioGroup ? String(radioGroup.dataset.value || '').trim() : '';

            case 'age-rating':
                var ageRatingMenu = el.querySelector('.component-ageratingpicker-menu');
                return ageRatingMenu ? String(ageRatingMenu.dataset.value || '').trim() : '';

            case 'links':
                try {
                    var rows = el.querySelectorAll('.fieldset-links-row');
                    if (!rows || rows.length === 0) return [];
                    var out = [];
                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        if (!row) continue;
                        var menu = row.querySelector('.component-linkpicker-menu');
                        var typeVal = menu ? String(menu.dataset.value || '').trim() : '';
                        var inp = row.querySelector('input.fieldset-links-url');
                        var urlVal = inp ? String(inp.value || '').trim() : '';
                        if (!typeVal && !urlVal) continue;
                        // Only store complete rows.
                        if (!typeVal || !urlVal) continue;
                        out.push({ link_type: typeVal, external_url: urlVal });
                    }
                    return out;
                } catch (eL) {
                    return [];
                }

            case 'public-phone':
                // Store atomically (DB has phone_prefix + public_phone).
                // No fallbacks: if either part is missing, return empty so required validation blocks submit.
                try {
                    var pfxInput = el.querySelector('.component-phoneprefixcompact-menu-button-input');
                    var telInput = el.querySelector('input[type="tel"].fieldset-input');
                    var pfx = pfxInput ? String(pfxInput.value || '').trim() : '';
                    var num = telInput ? String(telInput.value || '').trim() : '';
                    if (!pfx || !num) return '';
                    return { phone_prefix: pfx, public_phone: num };
                } catch (eP) {
                    return '';
                }

            case 'custom-text':
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
                try {
                    var addr = el.querySelector('input.fieldset-input');
                    var lat = el.querySelector('input.fieldset-lat');
                    var lng = el.querySelector('input.fieldset-lng');
                    var cc = el.querySelector('input.fieldset-country');
                    var addrCity = el.querySelector('input.fieldset-city');
                    var addrSuburb = el.querySelector('input.fieldset-suburb');
                    var addrCN = el.querySelector('input.fieldset-country-name');
                    var addrState = el.querySelector('input.fieldset-state');
                    var addrPC = el.querySelector('input.fieldset-postcode');
                    return {
                        address_line: addr ? String(addr.value || '').trim() : '',
                        suburb: addrSuburb ? String(addrSuburb.value || '').trim() : '',
                        city: addrCity ? String(addrCity.value || '').trim() : '',
                        state: addrState ? String(addrState.value || '').trim() : '',
                        postcode: addrPC ? String(addrPC.value || '').trim() : '',
                        country_name: addrCN ? String(addrCN.value || '').trim() : '',
                        country_code: cc ? String(cc.value || '').trim() : '',
                        latitude: lat ? String(lat.value || '').trim() : '',
                        longitude: lng ? String(lng.value || '').trim() : ''
                    };
                } catch (e1) {
                    return { address_line: '', suburb: '', city: '', state: '', postcode: '', country_name: '', country_code: '', latitude: '', longitude: '' };
                }

            case 'city':
                try {
                    var cityIn = el.querySelector('input.fieldset-input');
                    var cityLat = el.querySelector('input.fieldset-lat');
                    var cityLng = el.querySelector('input.fieldset-lng');
                    var cityCc = el.querySelector('input.fieldset-country');
                    var citySub = el.querySelector('input.fieldset-suburb');
                    var cityCN = el.querySelector('input.fieldset-country-name');
                    var citySt = el.querySelector('input.fieldset-state');
                    var cityPC = el.querySelector('input.fieldset-postcode');
                    return {
                        suburb: citySub ? String(citySub.value || '').trim() : '',
                        city: cityIn ? String(cityIn.value || '').trim() : '',
                        state: citySt ? String(citySt.value || '').trim() : '',
                        postcode: cityPC ? String(cityPC.value || '').trim() : '',
                        country_name: cityCN ? String(cityCN.value || '').trim() : '',
                        country_code: cityCc ? String(cityCc.value || '').trim() : '',
                        latitude: cityLat ? String(cityLat.value || '').trim() : '',
                        longitude: cityLng ? String(cityLng.value || '').trim() : ''
                    };
                } catch (e1c) {
                    return { suburb: '', city: '', state: '', postcode: '', country_name: '', country_code: '', latitude: '', longitude: '' };
                }

            case 'venue':
                try {
                    var inputs = el.querySelectorAll('input.fieldset-input');
                    var venueName = inputs && inputs[0] ? String(inputs[0].value || '').trim() : '';
                    var venueAddr = inputs && inputs[1] ? String(inputs[1].value || '').trim() : '';
                    var vLat = el.querySelector('input.fieldset-lat');
                    var vLng = el.querySelector('input.fieldset-lng');
                    var vCc = el.querySelector('input.fieldset-country');
                    var vCity = el.querySelector('input.fieldset-city');
                    var vSuburb = el.querySelector('input.fieldset-suburb');
                    var vCN = el.querySelector('input.fieldset-country-name');
                    var vState = el.querySelector('input.fieldset-state');
                    var vPC = el.querySelector('input.fieldset-postcode');
                    return {
                        venue_name: venueName,
                        address_line: venueAddr,
                        suburb: vSuburb ? String(vSuburb.value || '').trim() : '',
                        city: vCity ? String(vCity.value || '').trim() : '',
                        state: vState ? String(vState.value || '').trim() : '',
                        postcode: vPC ? String(vPC.value || '').trim() : '',
                        country_name: vCN ? String(vCN.value || '').trim() : '',
                        country_code: vCc ? String(vCc.value || '').trim() : '',
                        latitude: vLat ? String(vLat.value || '').trim() : '',
                        longitude: vLng ? String(vLng.value || '').trim() : ''
                    };
                } catch (e2) {
                    return { venue_name: '', address_line: '', suburb: '', city: '', state: '', postcode: '', country_name: '', country_code: '', latitude: '', longitude: '' };
                }

                case 'session_pricing':
                try {
                    // Sessions portion: each time includes ticket_group_key
                    // Source of truth in DOM: data-selected-isos attribute synced by fieldset logic
                    var isoCsv2 = el.dataset.selectedIsos || '';
                    var dates2 = [];
                    if (isoCsv2) {
                        dates2 = isoCsv2.split(',').filter(Boolean);
                    } else {
                        // Fallback to labels
                        var selectedDays2 = el.querySelectorAll('.fieldset-sessionpricing-session-field-label--selected[data-iso]');
                        selectedDays2.forEach(function(d) {
                            var iso = d.dataset.iso;
                            if (iso) dates2.push(String(iso));
                        });
                    }
                    dates2.sort();
                    
                    var sessionsOut = [];
                    for (var i2 = 0; i2 < dates2.length; i2++) {
                        var dateStr2 = dates2[i2];
                        var times2 = [];
                        // Source of truth for times: input.fieldset-sessionpricing-session-field-time-input
                        el.querySelectorAll('input.fieldset-sessionpricing-session-field-time-input[data-date="' + dateStr2 + '"]').forEach(function(t) {
                            if (!t) return;
                            var v = String(t.value || '').trim();
                            var tgk = t.dataset ? String(t.dataset.ticketGroupKey || '').trim() : '';
                            times2.push({ time: v, ticket_group_key: tgk });
                        });
                        sessionsOut.push({ date: dateStr2, times: times2 });
                    }

                    // Generate pre-formatted session_summary for fast display (Mon 1 Jan format)
                    var sessionSummary = '';
                    if (dates2.length > 0) {
                        var firstDate = dates2[0];
                        var lastDate = dates2[dates2.length - 1];
                        if (firstDate === lastDate) {
                            sessionSummary = App.formatDateShort(firstDate);
                        } else {
                            sessionSummary = App.formatDateShort(firstDate) + ' - ' + App.formatDateShort(lastDate);
                        }
                    }

                    // Ticket pricing groups: { [ticket_group_key]: [ { seating_area, tiers:[...] } ] }
                    // Age ratings per group: { [ticket_group_key]: 'rating_value' }
                    var pricingGroups = {};
                    var ageRatings = {};
                    var allPrices = [];
                    var sharedCurrency = '';
                    var groupsWrap = el.querySelector('.fieldset-sessionpricing-ticketgroups-container');
                    if (groupsWrap) {
                        groupsWrap.querySelectorAll('.fieldset-sessionpricing-ticketgroup-item').forEach(function(groupEl) {
                            if (!groupEl) return;
                            var gk = groupEl.dataset ? String(groupEl.dataset.ticketGroupKey || '').trim() : '';
                            if (!gk) return;
                            var editorEl = groupEl.querySelector('.fieldset-sessionpricing-pricing-editor') || groupEl;
                            
                            // Extract age rating for this ticket group
                            var ageRatingMenu = editorEl.querySelector('.component-ageratingpicker-menu');
                            if (ageRatingMenu) {
                                ageRatings[gk] = String(ageRatingMenu.dataset.value || '').trim();
                            }
                            
                            var allocatedVal = 1;
                            var yesRadio = editorEl.querySelector('input[type="radio"][value="1"]');
                            if (yesRadio) allocatedVal = yesRadio.checked ? 1 : 0;

                            var seatingBlocks2 = editorEl.querySelectorAll('.fieldset-sessionpricing-pricing-seating-block');
                            var seatOut2 = [];
                            seatingBlocks2.forEach(function(block) {
                                if (allocatedVal === 0 && seatOut2.length > 0) return;

                                var ticketArea = '';
                                var seatInput = block.querySelector('.fieldset-sessionpricing-input-ticketarea');
                                if (seatInput) ticketArea = String(seatInput.value || '').trim();

                                var tiers = [];
                                block.querySelectorAll('.fieldset-sessionpricing-pricing-tier-block').forEach(function(tier) {
                                    var tierName = '';
                                    var tierInput = tier.querySelector('.fieldset-sessionpricing-tier-input-row input.fieldset-input');
                                    if (tierInput) tierName = String(tierInput.value || '').trim();
                                    
                                    // Currency is now shared for the group, look in the editorEl (header area)
                                    var currInput = editorEl.querySelector('.component-currencyfull-menu-button-input');
                                    var curr = currInput ? String(currInput.value || '').trim() : '';
                                    
                                    // Handle "VALUE - LABEL" format from full menu
                                    if (curr.indexOf(' - ') !== -1) curr = curr.split(' - ')[0].trim();
                                    
                                    if (curr && !sharedCurrency) sharedCurrency = curr;

                                    var priceInput = tier.querySelector('.fieldset-sessionpricing-input-price');
                                    var rawPrice = priceInput ? String(priceInput.value || '').trim() : '';
                                    
                                    // Convert displayed price to standard numeric format for database
                                    var price = '';
                                    if (rawPrice) {
                                        if (curr) {
                                            // Currency selected - use CurrencyComponent to parse
                                            if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.parseInput) {
                                                throw new Error('[Member] CurrencyComponent.parseInput is required');
                                            }
                                            var numericValue = CurrencyComponent.parseInput(rawPrice, curr);
                                            if (Number.isFinite(numericValue)) {
                                                price = numericValue.toString();
                                                allPrices.push(numericValue);
                                            }
                                        } else {
                                            // No currency selected - support both dot and comma
                                            var normalized = rawPrice.replace(/,/g, '.');
                                            var numericValue = parseFloat(normalized.replace(/[^0-9.-]/g, ''));
                                            if (Number.isFinite(numericValue)) {
                                                price = numericValue.toString();
                                                allPrices.push(numericValue);
                                            }
                                        }
                                    }
                                    
                                    tiers.push({ pricing_tier: tierName, currency: curr, price: price });
                                });
                                seatOut2.push({ 
                                    allocated_areas: allocatedVal,
                                    ticket_area: ticketArea, 
                                    tiers: tiers 
                                });
                            });
                            pricingGroups[gk] = seatOut2;
                        });
                    }

                    // Generate pre-formatted price_summary for fast display
                    var priceSummary = '';
                    if (allPrices.length > 0 && sharedCurrency) {
                        var min = Math.min.apply(null, allPrices);
                        var max = Math.max.apply(null, allPrices);
                        
                        if (typeof CurrencyComponent !== 'undefined' && CurrencyComponent.formatWithSymbol) {
                            var countryCode = '';
                            if (typeof CurrencyComponent.getCurrencyByCode === 'function') {
                                var currData = CurrencyComponent.getCurrencyByCode(sharedCurrency);
                                if (currData && currData.filename) {
                                    countryCode = currData.filename.replace('.svg', '');
                                }
                            }

                            var prefix = countryCode ? '[' + countryCode + '] ' : '';
                            if (min === max) {
                                priceSummary = prefix + CurrencyComponent.formatWithSymbol(min.toString(), sharedCurrency);
                            } else {
                                priceSummary = prefix + CurrencyComponent.formatWithSymbol(min.toString(), sharedCurrency) + ' - ' + CurrencyComponent.formatWithSymbol(max.toString(), sharedCurrency);
                            }
                        }
                    }

                    return {
                        sessions: sessionsOut,
                        pricing_groups: pricingGroups,
                        age_ratings: ageRatings,
                        session_summary: sessionSummary,
                        price_summary: priceSummary
                    };
                } catch (e33) {
                    throw e33; // Do not swallow errors
                }

            case 'ticket-pricing':
                try {
                    // Ticket pricing groups: { [ticket_group_key]: [ { allocated_areas, ticket_area, tiers:[...] } ] }
                    // Age ratings per group: { [ticket_group_key]: 'rating_value' }
                    var tpPricingGroups = {};
                    var tpAgeRatings = {};
                    var tpAllPrices = [];
                    var tpSharedCurrency = '';
                    var tpGroupsWrap = el.querySelector('.fieldset-ticketpricing-ticketgroups-container');
                    if (tpGroupsWrap) {
                        tpGroupsWrap.querySelectorAll('.fieldset-ticketpricing-ticketgroup-item').forEach(function(groupEl) {
                            if (!groupEl) return;
                            var gk = groupEl.dataset ? String(groupEl.dataset.ticketGroupKey || '').trim() : '';
                            if (!gk) return;
                            var editorEl = groupEl.querySelector('.fieldset-ticketpricing-pricing-editor') || groupEl;
                            
                            // Extract age rating for this ticket group
                            var ageRatingMenu = editorEl.querySelector('.component-ageratingpicker-menu');
                            if (ageRatingMenu) {
                                tpAgeRatings[gk] = String(ageRatingMenu.dataset.value || '').trim();
                            }
                            
                            // Extract promo fields for this ticket group
                            var tpPromoOption = 'none';
                            var tpPromoCode = '';
                            var tpPromoType = 'percent';
                            var tpPromoValue = '';
                            
                            var tpPromoNoneRadio = editorEl.querySelector('.fieldset-ticketpricing-promo-option-row input[value="none"]');
                            var tpPromoPersonalRadio = editorEl.querySelector('.fieldset-ticketpricing-promo-option-row input[value="personal"]');
                            var tpPromoFunmapRadio = editorEl.querySelector('.fieldset-ticketpricing-promo-option-row input[value="funmap"]');
                            
                            if (tpPromoNoneRadio && tpPromoNoneRadio.checked) tpPromoOption = 'none';
                            else if (tpPromoPersonalRadio && tpPromoPersonalRadio.checked) tpPromoOption = 'personal';
                            else if (tpPromoFunmapRadio && tpPromoFunmapRadio.checked) tpPromoOption = 'funmap';
                            
                            if (tpPromoOption !== 'none') {
                                var tpPromoCodeInput = editorEl.querySelector('.fieldset-ticketpricing-promo-code-input');
                                if (tpPromoCodeInput) {
                                    tpPromoCode = String(tpPromoCodeInput.value || '').trim();
                                    // Prepend FUNMAP for funmap option
                                    if (tpPromoOption === 'funmap' && tpPromoCode) {
                                        tpPromoCode = 'FUNMAP' + tpPromoCode;
                                    }
                                }
                                
                                // Get promo type
                                var tpPromoTypeActiveBtn = editorEl.querySelector('.fieldset-ticketpricing-promo-type-btn--active');
                                if (tpPromoTypeActiveBtn) {
                                    tpPromoType = tpPromoTypeActiveBtn.textContent === '%' ? 'percent' : 'fixed';
                                }
                                
                                // Get promo value
                                var tpPromoValueInput = editorEl.querySelector('.fieldset-ticketpricing-promo-value-input');
                                if (tpPromoValueInput) {
                                    tpPromoValue = String(tpPromoValueInput.value || '').trim();
                                }
                            }
                            
                            var allocatedVal = 1;
                            var yesRadio = editorEl.querySelector('input[type="radio"][value="1"]');
                            if (yesRadio) allocatedVal = yesRadio.checked ? 1 : 0;

                            var ticketAreaBlocks = editorEl.querySelectorAll('.fieldset-ticketpricing-pricing-ticketarea-block');
                            var tpSeatOut = [];
                            ticketAreaBlocks.forEach(function(block) {
                                if (allocatedVal === 0 && tpSeatOut.length > 0) return;

                                var ticketArea = '';
                                var seatInput = block.querySelector('.fieldset-ticketpricing-input-ticketarea');
                                if (seatInput) ticketArea = String(seatInput.value || '').trim();

                                var tiers = [];
                                block.querySelectorAll('.fieldset-ticketpricing-pricing-tier-block').forEach(function(tier) {
                                    var tierName = '';
                                    var tierInput = tier.querySelector('.fieldset-ticketpricing-tier-input-row input.fieldset-input');
                                    if (tierInput) tierName = String(tierInput.value || '').trim();
                                    
                                    var currInput = editorEl.querySelector('.component-currencyfull-menu-button-input');
                                    var curr = currInput ? String(currInput.value || '').trim() : '';
                                    
                                    if (curr.indexOf(' - ') !== -1) curr = curr.split(' - ')[0].trim();
                                    
                                    if (curr && !tpSharedCurrency) tpSharedCurrency = curr;

                                    var priceInput = tier.querySelector('.fieldset-ticketpricing-input-price');
                                    var rawPrice = priceInput ? String(priceInput.value || '').trim() : '';
                                    
                                    var price = '';
                                    if (rawPrice) {
                                        if (curr) {
                                            if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.parseInput) {
                                                throw new Error('[Member] CurrencyComponent.parseInput is required');
                                            }
                                            var numericValue = CurrencyComponent.parseInput(rawPrice, curr);
                                            if (Number.isFinite(numericValue)) {
                                                price = numericValue.toString();
                                                tpAllPrices.push(numericValue);
                                            }
                                        } else {
                                            var normalized = rawPrice.replace(/,/g, '.');
                                            var numericValue = parseFloat(normalized.replace(/[^0-9.-]/g, ''));
                                            if (Number.isFinite(numericValue)) {
                                                price = numericValue.toString();
                                                tpAllPrices.push(numericValue);
                                            }
                                        }
                                    }
                                    
                                    // Calculate promo_price if promo is active and we have price + promo_value
                                    var tierPromoPrice = '';
                                    if (tpPromoOption !== 'none' && price && tpPromoValue) {
                                        var numericTierPrice = parseFloat(price);
                                        var numericPromoVal = parseFloat(tpPromoValue);
                                        if (Number.isFinite(numericTierPrice) && Number.isFinite(numericPromoVal) && numericPromoVal > 0) {
                                            var discounted;
                                            if (tpPromoType === 'percent') {
                                                discounted = numericTierPrice - (numericTierPrice * numericPromoVal / 100);
                                            } else {
                                                discounted = numericTierPrice - numericPromoVal;
                                            }
                                            discounted = Math.max(0, Math.round(discounted * 100) / 100);
                                            tierPromoPrice = discounted.toString();
                                        }
                                    }
                                    
                                    tiers.push({ 
                                        pricing_tier: tierName, 
                                        currency: curr, 
                                        price: price,
                                        promo_option: tpPromoOption,
                                        promo_code: tpPromoCode,
                                        promo_type: tpPromoType,
                                        promo_value: tpPromoValue,
                                        promo_price: tierPromoPrice
                                    });
                                });
                                tpSeatOut.push({ 
                                    allocated_areas: allocatedVal,
                                    ticket_area: ticketArea, 
                                    tiers: tiers 
                                });
                            });
                            tpPricingGroups[gk] = tpSeatOut;
                        });
                    }

                    // Generate pre-formatted price_summary for fast display
                    var tpPriceSummary = '';
                    if (tpAllPrices.length > 0 && tpSharedCurrency) {
                        var min = Math.min.apply(null, tpAllPrices);
                        var max = Math.max.apply(null, tpAllPrices);
                        
                        if (typeof CurrencyComponent !== 'undefined' && CurrencyComponent.formatWithSymbol) {
                            var countryCode = '';
                            if (typeof CurrencyComponent.getCurrencyByCode === 'function') {
                                var currData = CurrencyComponent.getCurrencyByCode(tpSharedCurrency);
                                if (currData && currData.filename) {
                                    countryCode = currData.filename.replace('.svg', '');
                                }
                            }

                            var prefix = countryCode ? '[' + countryCode + '] ' : '';
                            if (min === max) {
                                tpPriceSummary = prefix + CurrencyComponent.formatWithSymbol(min.toString(), tpSharedCurrency);
                            } else {
                                tpPriceSummary = prefix + CurrencyComponent.formatWithSymbol(min.toString(), tpSharedCurrency) + ' - ' + CurrencyComponent.formatWithSymbol(max.toString(), tpSharedCurrency);
                            }
                        }
                    }

                    return {
                        pricing_groups: tpPricingGroups,
                        age_ratings: tpAgeRatings,
                        price_summary: tpPriceSummary
                    };
                } catch (e34) {
                    throw e34;
                }

            case 'sessions':
                try {
                    // Sessions portion: each time includes ticket_group_key
                    var sessIsoCsv = el.dataset.selectedIsos || '';
                    var sessDates = [];
                    if (sessIsoCsv) {
                        sessDates = sessIsoCsv.split(',').filter(Boolean);
                    } else {
                        var selectedDays = el.querySelectorAll('.fieldset-sessions-session-field-label--selected[data-iso]');
                        selectedDays.forEach(function(d) {
                            var iso = d.dataset.iso;
                            if (iso) sessDates.push(String(iso));
                        });
                    }
                    sessDates.sort();
                    
                    var sessSessionsOut = [];
                    for (var si = 0; si < sessDates.length; si++) {
                        var dateStr = sessDates[si];
                        var times = [];
                        el.querySelectorAll('input.fieldset-sessions-session-field-time-input[data-date="' + dateStr + '"]').forEach(function(t) {
                            if (!t) return;
                            var v = String(t.value || '').trim();
                            var tgk = t.dataset ? String(t.dataset.ticketGroupKey || '').trim() : '';
                            times.push({ time: v, ticket_group_key: tgk });
                        });
                        sessSessionsOut.push({ date: dateStr, times: times });
                    }

                    // Generate pre-formatted session_summary for fast display
                    var sessSessionSummary = '';
                    if (sessDates.length > 0) {
                        var firstDate = sessDates[0];
                        var lastDate = sessDates[sessDates.length - 1];
                        if (firstDate === lastDate) {
                            sessSessionSummary = App.formatDateShort(firstDate);
                        } else {
                            sessSessionSummary = App.formatDateShort(firstDate) + ' - ' + App.formatDateShort(lastDate);
                        }
                    }

                    return {
                        sessions: sessSessionsOut,
                        session_summary: sessSessionSummary
                    };
                } catch (e35) {
                    throw e35;
                }

            case 'item-pricing':
                try {
                    var itemNameInput = el.querySelector('input.fieldset-itempricing-input-itemname');
                    var item_name = itemNameInput ? String(itemNameInput.value || '').trim() : '';
                    var currencyInput = el.querySelector('input.component-currencycompact-menu-button-input');
                    var currency = currencyInput ? String(currencyInput.value || '').trim() : '';
                    var priceInput = el.querySelector('input.fieldset-itempricing-input-itemprice');
                    var rawPrice = priceInput ? String(priceInput.value || '').trim() : '';
                    
                    // Convert displayed price to standard numeric format for database
                    var item_price = '';
                    if (rawPrice) {
                        if (currency) {
                            // Currency selected - use CurrencyComponent to parse
                            if (typeof CurrencyComponent === 'undefined' || !CurrencyComponent.parseInput) {
                                throw new Error('[Member] CurrencyComponent.parseInput is required');
                            }
                            var numericValue = CurrencyComponent.parseInput(rawPrice, currency);
                            item_price = Number.isFinite(numericValue) ? numericValue.toString() : '';
                        } else {
                            // No currency selected - support both dot and comma
                            var normalized = rawPrice.replace(/,/g, '.');
                            item_price = normalized.replace(/[^0-9.-]/g, '');
                        }
                    }
                    
                    var item_variants = [];
                    el.querySelectorAll('.fieldset-itempricing-row-itemvariant').forEach(function(row) {
                        var variantInput = row.querySelector('input.fieldset-itempricing-input-itemvariantname');
                        var variantName = variantInput ? String(variantInput.value || '').trim() : '';
                        item_variants.push(variantName);
                    });

                    // Extract promo fields
                    var promo_option = 'none';
                    var promo_code = '';
                    var promo_type = 'percent';
                    var promo_value = '';
                    var promo_price = '';
                    
                    var promoNoneRadio = el.querySelector('.fieldset-itempricing-promo-option-row input[value="none"]');
                    var promoPersonalRadio = el.querySelector('.fieldset-itempricing-promo-option-row input[value="personal"]');
                    var promoFunmapRadio = el.querySelector('.fieldset-itempricing-promo-option-row input[value="funmap"]');
                    
                    if (promoNoneRadio && promoNoneRadio.checked) promo_option = 'none';
                    else if (promoPersonalRadio && promoPersonalRadio.checked) promo_option = 'personal';
                    else if (promoFunmapRadio && promoFunmapRadio.checked) promo_option = 'funmap';
                    
                    if (promo_option !== 'none') {
                        var promoCodeInput = el.querySelector('.fieldset-itempricing-promo-code-input');
                        if (promoCodeInput) {
                            promo_code = String(promoCodeInput.value || '').trim();
                            // Prepend FUNMAP for funmap option
                            if (promo_option === 'funmap' && promo_code) {
                                promo_code = 'FUNMAP' + promo_code;
                            }
                        }
                        
                        // Get promo type
                        var promoTypePercentBtn = el.querySelector('.fieldset-itempricing-promo-type-btn--active');
                        if (promoTypePercentBtn) {
                            promo_type = promoTypePercentBtn.textContent === '%' ? 'percent' : 'fixed';
                        }
                        
                        // Get promo value
                        var promoValueInput = el.querySelector('.fieldset-itempricing-promo-value-input');
                        if (promoValueInput) {
                            promo_value = String(promoValueInput.value || '').trim();
                        }
                        
                        // Calculate promo_price
                        if (item_price && promo_value) {
                            var numericItemPrice = parseFloat(item_price);
                            var numericPromoValue = parseFloat(promo_value);
                            if (Number.isFinite(numericItemPrice) && Number.isFinite(numericPromoValue) && numericPromoValue > 0) {
                                var discounted;
                                if (promo_type === 'percent') {
                                    discounted = numericItemPrice - (numericItemPrice * numericPromoValue / 100);
                                } else {
                                    discounted = numericItemPrice - numericPromoValue;
                                }
                                discounted = Math.max(0, Math.round(discounted * 100) / 100);
                                promo_price = discounted.toString();
                            }
                        }
                    }

                    // Generate pre-formatted price_summary for fast display
                    var priceSummary = '';
                    if (item_price && currency) {
                        if (typeof CurrencyComponent !== 'undefined' && CurrencyComponent.formatWithSymbol) {
                            var countryCode = '';
                            if (typeof CurrencyComponent.getCurrencyByCode === 'function') {
                                var currData = CurrencyComponent.getCurrencyByCode(currency);
                                if (currData && currData.filename) {
                                    countryCode = currData.filename.replace('.svg', '');
                                }
                            }

                            var prefix = countryCode ? '[' + countryCode + '] ' : '';
                            priceSummary = prefix + CurrencyComponent.formatWithSymbol(item_price, currency);
                        }
                    }

                    // Extract age rating
                    var age_rating = '';
                    var ageRatingMenu = el.querySelector('.component-ageratingpicker-menu');
                    if (ageRatingMenu) {
                        age_rating = String(ageRatingMenu.dataset.value || '').trim();
                    }

                    return { item_name: item_name, age_rating: age_rating, currency: currency, item_price: item_price, item_variants: item_variants, price_summary: priceSummary, promo_option: promo_option, promo_code: promo_code, promo_type: promo_type, promo_value: promo_value, promo_price: promo_price };
                } catch (e5) {
                    throw e5; // Do not swallow errors
                }
                
            case 'currency':
                var currBtn = el.querySelector('button[data-currency-value]');
                return currBtn ? currBtn.dataset.currencyValue || '' : '';
                
            case 'amenities':
                // Button-based amenities use data-value on each row ('1' = Yes, '0' = No, '' = unset).
                // Return a stable array of answers so required validation works and backend can consume it.
                try {
                    var rows = el.querySelectorAll('.fieldset-amenities-row');
                    if (!rows || rows.length === 0) return [];
                    var out = [];
                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        if (!row) return [];
                        var amenityName = row.dataset.amenity || '';
                        var val = row.dataset.value;
                        if (val !== '1' && val !== '0') return []; // incomplete
                        out.push({
                            amenity: amenityName,
                            value: val
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
    
    function submitPostData(payload, isAdminFree, imageFiles, imagesMeta, mapImageData, transactionId) {
        return new Promise(function(resolve, reject) {
            // Submit as multipart so we can include image files and keep the whole publish flow server-side.
            // This avoids "draft" uploads and prevents unused Bunny files.
            // Note: imageFiles and imagesMeta are collected BEFORE form clears, passed in as params.
            
            // Look up the actual subcategory_key from memberCategories
            var actualSubcategoryKey = payload.subcategory; // fallback to display name
            if (memberCategories && memberCategories.length > 0) {
                var category = memberCategories.find(function(c) {
                    return c.name === payload.category;
                });
                if (category && category.subFees && category.subFees[payload.subcategory]) {
                    var subData = category.subFees[payload.subcategory];
                    if (subData.subcategory_key) {
                        actualSubcategoryKey = subData.subcategory_key;
                    }
                }
            }
            
            var effectivePostId = payload.post_id || isEditingPostId;

            var postData = {
                subcategory_key: actualSubcategoryKey,
                member_id: currentUser ? currentUser.id : null,
                member_name: currentUser ? (currentUser.username || currentUser.name || '') : '',
                member_type: currentUser && currentUser.isAdmin ? 'admin' : 'member',
                skip_payment: isAdminFree,
                transaction_id: transactionId || null,
                coupon_id: appliedCoupon ? appliedCoupon.id : null,
                loc_qty: payload.loc_qty || window._memberLocationQuantity || 1,
                fields: payload.fields
            };
            
            // Include post_id if editing
            if (effectivePostId) {
                postData.post_id = effectivePostId;
            }

            var fd = new FormData();
            console.log('[TRACK] Creating FormData. postData:', JSON.stringify(postData).substring(0,500));
            fd.set('payload', JSON.stringify(postData));

            // Attach image files (passed from validateAndCollectFormData, collected before form cleared)
            if (imageFiles && imageFiles.length > 0) {
                console.log('[TRACK] Attaching', imageFiles.length, 'image files');
                imageFiles.forEach(function(file, idx) {
                    console.log('[TRACK] Image', idx, ':', file ? file.name : 'null', file ? file.size : 0);
                    if (file) fd.append('images[]', file, file.name || 'image');
                });
            }
            fd.set('images_meta', imagesMeta || '[]');
            console.log('[TRACK] images_meta:', imagesMeta);
            
            // Attach map images (captured at submission time for final locations)
            if (mapImageData && mapImageData.files && mapImageData.files.length > 0) {
                console.log('[TRACK] Attaching', mapImageData.files.length, 'map images');
                mapImageData.files.forEach(function(file, idx) {
                    console.log('[TRACK] Map image', idx, ':', file ? file.name : 'null', file ? file.size : 0);
                    if (file) fd.append('map_images[]', file, file.name || 'map_image');
                });
                fd.set('map_images_meta', JSON.stringify(mapImageData.meta || []));
                console.log('[TRACK] map_images_meta:', JSON.stringify(mapImageData.meta));
            }

            var action = effectivePostId ? 'edit-post' : 'add-post';
            fetch('/gateway.php?action=' + action, {
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
        isEditingPostId = null;
        appliedCoupon = null;
        couponInputEl = null;
        couponMsgEl = null;
        
        // Reset tab label and buttons
        if (createTabBtn) createTabBtn.textContent = 'Create Post';
        
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
        if (window.App && typeof App.emit === 'function') {
            App.emit('terms:agreed');
        }
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
                // Canonical DB-driven strings (tooltip/instruction from fieldsets table)
                fieldset_tooltip: '',
                fieldset_instruction: '',
                
                // Editable overrides from fieldset_mods
                customPlaceholder: '',
                customTooltip: '',
                customInstruction: '',
                
                // Main values (placeholder from field_placeholder, or custom override)
                placeholder: '',
                tooltip: '',
                instruction: '',
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
                location_specific: false,

                // Multi-field fieldsets (e.g. ticket-pricing, item-pricing) include sub-fields here.
                // Preserve this so FieldsetBuilder can apply sub-field placeholders/tooltips correctly.
                fields: null,
                fieldset_fields: null
            };
        }
        var result = {
            name: '',
            // Canonical DB-driven strings (tooltip/instruction from fieldsets table)
            fieldset_tooltip: '',
            fieldset_instruction: '',
            
            // Editable overrides from fieldset_mods
            customPlaceholder: '',
            customTooltip: '',
            customInstruction: '',
            
            // Main values (placeholder from field_placeholder, or custom override)
            placeholder: '',
            tooltip: '',
            instruction: '',
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
            location_specific: false,

            // Multi-field fieldsets (e.g. ticket-pricing, item-pricing) include sub-fields here.
            // Preserve this so FieldsetBuilder can apply sub-field placeholders/tooltips correctly.
            fields: null,
            fieldset_fields: null
        };
        
        if (field.name && typeof field.name === 'string') {
            result.name = field.name;
        }
        
        // Canonical fieldset tooltip/instruction from DB
        if (field.fieldset_tooltip && typeof field.fieldset_tooltip === 'string') {
            result.fieldset_tooltip = field.fieldset_tooltip;
        }
        if (field.fieldset_instruction && typeof field.fieldset_instruction === 'string') {
            result.fieldset_instruction = field.fieldset_instruction;
        }
        
        // Editable overrides from fieldset_mods JSON
        if (field.customPlaceholder && typeof field.customPlaceholder === 'string') {
            result.customPlaceholder = field.customPlaceholder;
        }
        if (field.customTooltip && typeof field.customTooltip === 'string') {
            result.customTooltip = field.customTooltip;
        }
        if (field.customInstruction && typeof field.customInstruction === 'string') {
            result.customInstruction = field.customInstruction;
        }
        
        // Legacy/compat (do not rely on these for new-site behavior)
        if (typeof field.placeholder === 'string') {
            result.placeholder = field.placeholder;
        }
        if (typeof field.tooltip === 'string') {
            result.tooltip = field.tooltip;
        }
        if (typeof field.instruction === 'string') {
            result.instruction = field.instruction;
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

        // Preserve multi-field sub-field descriptors (from get-form.php).
        // FieldsetBuilder handles string/array/object normalization internally.
        if (field.fields !== undefined) {
            result.fields = field.fields;
        }
        if (field.fieldset_fields !== undefined) {
            result.fieldset_fields = field.fieldset_fields;
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
        if (typeof field.location_specific === 'boolean') {
            result.location_specific = field.location_specific;
        } else if (typeof field.locationSpecific === 'boolean') {
            result.location_specific = field.locationSpecific;
        } else if (field.location_specific === 1 || field.location_specific === '1') {
            result.location_specific = true;
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
    
    // Called when the Register tab becomes active
    function initRegisterTab() {
        if (authForm && authForm.dataset.state === 'logged-in') return;
        
        // Initialize Register tab content
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
        if (!CurrencyComponent.isLoaded()) return;
        if (supporterCustomAmountInput) {
            supporterCustomAmountInput.placeholder = CurrencyComponent.formatWithSymbol(0, code, { trimZeroDecimals: false });
        }
        if (supporterPresetButtons && supporterPresetButtons.length) {
            supporterPresetButtons.forEach(function(btn) {
                var amt = String(btn.getAttribute('data-amount') || '').trim();
                if (!amt) return;
                var n = parseFloat(amt);
                if (!isFinite(n)) return;
                btn.textContent = CurrencyComponent.formatWithSymbol(n, code, { trimZeroDecimals: false });
            });
        }

        // Refresh custom input display with currency symbol if an amount is already selected
        if (supporterCustomAmountInput && supporterAmountHiddenInput) {
            var rawAmt = String(supporterAmountHiddenInput.value || '').trim();
            var nAmt = parseFloat(rawAmt);
            if (isFinite(nAmt) && nAmt > 0) {
                supporterCustomAmountInput.value = CurrencyComponent.formatWithSymbol(nAmt, code, { trimZeroDecimals: false });
            }
        }

        // Ensure the submit button always shows currency context.
        try {
            if (!registerSubmitBtn) return;
            var submitBtn = registerSubmitBtn;
            var baseLabel = submitBtn.getAttribute('data-base-label');
            if (!baseLabel) {
                baseLabel = String(submitBtn.querySelector('.component-paymentsubmit-button-text').textContent || '').trim();
                submitBtn.setAttribute('data-base-label', baseLabel);
            }
            var textEl = submitBtn.querySelector('.component-paymentsubmit-button-text');
            if (!textEl) return;
            var rawAmt = supporterAmountHiddenInput ? String(supporterAmountHiddenInput.value || '').trim() : '';
            var nAmt = parseFloat(rawAmt);
            if (isFinite(nAmt) && nAmt > 0) {
                textEl.textContent = baseLabel + ' ' + CurrencyComponent.formatWithSymbol(nAmt, code, { trimZeroDecimals: false });
            } else {
                textEl.textContent = baseLabel;
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

    function getRegisterMissingFieldsetNames() {
        var out = [];
        if (!registerFieldsetsContainer) return out;
        var required = registerFieldsetsContainer.querySelectorAll('.fieldset[data-required="true"]');
        if (!required || required.length === 0) return out;
        for (var i = 0; i < required.length; i++) {
            var fs = required[i];
            if (!fs || !fs.dataset) continue;
            if (String(fs.dataset.complete || '') !== 'true') {
                var nm = '';
                if (fs.dataset && fs.dataset.fieldsetName && typeof fs.dataset.fieldsetName === 'string') {
                    nm = fs.dataset.fieldsetName.trim();
                } else if (fs.dataset && fs.dataset.fieldsetKey && typeof fs.dataset.fieldsetKey === 'string') {
                    nm = fs.dataset.fieldsetKey.trim();
                }
                if (nm) out.push(nm);
            }
        }
        return out;
    }

    function updateRegisterSubmitButtonState() {
        try {
            if (!registerSubmitBtn) return;
            var btn = registerSubmitBtn;
            var complete = isRegisterFormComplete();
            btn.disabled = !complete;
            // Attach missing popover on first call
            attachMissingPopoverToButton(btn, getRegisterMissingFieldsetNames);
        } catch (e) {
            // ignore
        }
    }

    function renderRegisterFieldsets() {
        if (!registerTabPanel || !registerFieldsetsContainer) return;
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
                registerInputs = Array.from(registerTabPanel.querySelectorAll('input, textarea, select'));
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
                ensureProfileFooterButtons();
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
            if (!options.fromCustom || (!options.allowUnderMin)) {
                var code = getSiteCurrencyCode();
                if (code && value) {
                    supporterCustomAmountInput.value = CurrencyComponent.formatWithSymbol(value, code, { trimZeroDecimals: false });
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
            if (!registerSubmitBtn) return;
            var submitBtn = registerSubmitBtn;
            var baseLabel = submitBtn.getAttribute('data-base-label');
            if (!baseLabel) {
                baseLabel = String(submitBtn.querySelector('.component-paymentsubmit-button-text').textContent || '').trim();
                submitBtn.setAttribute('data-base-label', baseLabel);
            }
            var textEl = submitBtn.querySelector('.component-paymentsubmit-button-text');
            if (!textEl) return;
            var code = getSiteCurrencyCode();
            if (!code) {
                textEl.textContent = baseLabel;
                return;
            }
            var nAmt = parseFloat(value);
            if (isFinite(nAmt) && nAmt > 0) {
                textEl.textContent = baseLabel + ' ' + CurrencyComponent.formatWithSymbol(nAmt, code, { trimZeroDecimals: false });
            } else {
                textEl.textContent = baseLabel;
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
       CREATE POST INLINE AUTH CONTAINER (Login/Register under create form)
       -------------------------------------------------------------------------- */

    function hasValidLoggedInUser() {
        var idNum = currentUser ? parseInt(currentUser.id, 10) : 0;
        return !!(currentUser && isFinite(idNum) && idNum > 0);
    }

    function setCreateAuthPanel(target) {
        if (!createAuthWrapper) return;
        target = (target === 'register') ? 'register' : 'login';
        var isLogin = target === 'login';

        // toggle-class-1 uses aria-pressed for the active button state
        if (createAuthLoginTab) createAuthLoginTab.setAttribute('aria-pressed', isLogin ? 'true' : 'false');
        if (createAuthRegisterTab) createAuthRegisterTab.setAttribute('aria-pressed', !isLogin ? 'true' : 'false');

        if (createAuthLoginContainer) {
            createAuthLoginContainer.hidden = !isLogin;
        }
        if (createAuthRegisterContainer) {
            createAuthRegisterContainer.hidden = isLogin;
        }

        createAuthWrapper.dataset.active = target;

        if (!isLogin) {
            ensureCreateAuthRegisterReady();
        }
        updateSubmitButtonState();
    }

    function unmountCreateAuth() {
        try {
            if (createAuthWrapper && createAuthWrapper.parentNode) {
                createAuthWrapper.parentNode.removeChild(createAuthWrapper);
            }
        } catch (e0) {}
        createAuthWrapper = null;
        createAuthLoginTab = null;
        createAuthRegisterTab = null;
        createAuthLoginContainer = null;
        createAuthRegisterContainer = null;
        createAuthLoginForm = null;
        createAuthRegisterForm = null;
        createAuthLoginEmailInput = null;
        createAuthLoginPasswordInput = null;
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

    // ========================================================================
    // PROFILE TAB LOGIN FORM (dynamically created when logged out)
    // ========================================================================

    function mountProfileLoginForm() {
        if (loginFormContainer) return; // Already mounted
        if (hasValidLoggedInUser()) return; // Don't mount if logged in

        var authWrapper = document.querySelector('#member-tab-profile .member-auth');
        if (!authWrapper) return;

        // Create container
        var container = document.createElement('div');
        container.className = 'member-loginform-container';

        // Create form
        var form = document.createElement('form');
        form.id = 'memberAuthFormLogin';
        form.autocomplete = 'off';

        // Fieldsets wrapper
        var fieldsets = document.createElement('div');
        fieldsets.className = 'member-loginform-fieldsets';

        // Email field
        var emailField = document.createElement('div');
        emailField.className = 'member-panel-field';
        var emailLabel = document.createElement('label');
        emailLabel.className = 'member-panel-field-label';
        emailLabel.setAttribute('for', 'memberLoginEmail');
        emailLabel.textContent = 'Account Email';
        var emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'memberLoginEmail';
        emailInput.className = 'member-panel-field-input';
        emailInput.name = 'loginEmail';
        emailInput.autocomplete = 'username';
        emailField.appendChild(emailLabel);
        emailField.appendChild(emailInput);

        // Password field
        var passField = document.createElement('div');
        passField.className = 'member-panel-field';
        var passLabel = document.createElement('label');
        passLabel.className = 'member-panel-field-label';
        passLabel.setAttribute('for', 'memberLoginPassword');
        passLabel.textContent = 'Password';
        var passInput = document.createElement('input');
        passInput.type = 'password';
        passInput.id = 'memberLoginPassword';
        passInput.className = 'member-panel-field-input';
        passInput.name = 'loginPassword';
        passInput.autocomplete = 'current-password';
        passField.appendChild(passLabel);
        passField.appendChild(passInput);

        fieldsets.appendChild(emailField);
        fieldsets.appendChild(passField);

        // Submit button
        var submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'member-login button-class-2b';
        submitBtn.dataset.action = 'login';
        submitBtn.textContent = 'Log In';

        form.appendChild(fieldsets);
        form.appendChild(submitBtn);
        container.appendChild(form);

        // Forgot password link
        var forgotBtn = document.createElement('button');
        forgotBtn.type = 'button';
        forgotBtn.className = 'member-login-forgot button-class-2b';
        forgotBtn.textContent = 'Forgot Password?';
        forgotBtn.addEventListener('click', function() { handleForgotPassword(); });
        container.appendChild(forgotBtn);

        // Insert into auth wrapper
        authWrapper.appendChild(container);

        // Store references
        loginFormContainer = container;
        loginFormEl = form;
        loginInputs = [emailInput, passInput];

        // Attach submit handler
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }

    function unmountProfileLoginForm() {
        if (loginFormContainer && loginFormContainer.parentNode) {
            loginFormContainer.parentNode.removeChild(loginFormContainer);
        }
        loginFormContainer = null;
        loginFormEl = null;
        loginInputs = [];
    }

    function ensureCreateAuthMounted() {
        if (createAuthWrapper) return true;
        if (!formWrapper) return false;
        if (!formFields) return false;
        if (hasValidLoggedInUser()) return false;

        // Build DOM - member-auth-container (invisible wrapper, no padding)
        var wrap = document.createElement('div');
        wrap.id = 'member-auth-container';
        wrap.className = 'member-auth-container';
        wrap.dataset.active = 'login';

        // Header (tab buttons — toggle-class-1 pill slider)
        var header = document.createElement('div');
        header.className = 'member-auth-header toggle-class-1';
        header.setAttribute('role', 'group');
        header.setAttribute('aria-label', 'Continue to submit');

        var btnLogin = document.createElement('button');
        btnLogin.type = 'button';
        btnLogin.className = 'member-auth-login toggle-button';
        btnLogin.dataset.target = 'login';
        btnLogin.setAttribute('aria-pressed', 'true');
        btnLogin.textContent = 'Log In';

        var btnRegister = document.createElement('button');
        btnRegister.type = 'button';
        btnRegister.className = 'member-auth-register toggle-button';
        btnRegister.dataset.target = 'register';
        btnRegister.setAttribute('aria-pressed', 'false');
        btnRegister.textContent = 'Register';

        header.appendChild(btnLogin);
        header.appendChild(btnRegister);
        wrap.appendChild(header);
        
        // Body (forms area)
        var body = document.createElement('div');
        body.className = 'member-auth-body';

        // Login form
        var loginForm = document.createElement('form');
        loginForm.className = 'member-auth-form';
        loginForm.setAttribute('autocomplete', 'off');

        var loginContainer = document.createElement('section');

        var emailField = document.createElement('div');
        emailField.className = 'member-panel-field';
        var loginLabelEmail = document.createElement('label');
        loginLabelEmail.className = 'member-panel-field-label';
        loginLabelEmail.setAttribute('for', 'memberCreateLoginEmail');
        loginLabelEmail.textContent = 'Account Email';
        var loginEmail = document.createElement('input');
        loginEmail.type = 'email';
        loginEmail.id = 'memberCreateLoginEmail';
        loginEmail.className = 'member-panel-field-input';
        loginEmail.name = 'loginEmail';
        loginEmail.autocomplete = 'username';
        emailField.appendChild(loginLabelEmail);
        emailField.appendChild(loginEmail);

        var passField = document.createElement('div');
        passField.className = 'member-panel-field';
        var loginLabelPass = document.createElement('label');
        loginLabelPass.className = 'member-panel-field-label';
        loginLabelPass.setAttribute('for', 'memberCreateLoginPassword');
        loginLabelPass.textContent = 'Password';
        var loginPass = document.createElement('input');
        loginPass.type = 'password';
        loginPass.id = 'memberCreateLoginPassword';
        loginPass.className = 'member-panel-field-input';
        loginPass.name = 'loginPassword';
        loginPass.autocomplete = 'current-password';
        passField.appendChild(loginLabelPass);
        passField.appendChild(loginPass);

        loginContainer.appendChild(emailField);
        loginContainer.appendChild(passField);
        loginForm.appendChild(loginContainer);
        body.appendChild(loginForm);

        // Register form
        var registerForm = document.createElement('form');
        registerForm.className = 'member-auth-form';
        registerForm.setAttribute('autocomplete', 'off');

        var registerContainer = document.createElement('section');
        registerContainer.hidden = true;

        var fsContainer = document.createElement('div');
        fsContainer.className = 'member-postform-fieldsets';

        var avatarHost = document.createElement('div');
        avatarHost.setAttribute('aria-label', 'Avatar choices');

        var countryMenu = document.createElement('div');
        var countryHidden = document.createElement('input');
        countryHidden.type = 'hidden';
        countryHidden.name = 'country';
        countryHidden.value = '';

        registerContainer.appendChild(fsContainer);
        registerContainer.appendChild(avatarHost);
        registerContainer.appendChild(countryMenu);
        registerContainer.appendChild(countryHidden);
        registerForm.appendChild(registerContainer);
        body.appendChild(registerForm);
        
        // Add body to container
        wrap.appendChild(body);

        // Insert into checkout container (or fallback to formWrapper)
        var checkoutContainer = document.querySelector('.member-checkout-container');
        if (checkoutContainer) {
            // Insert before the submit buttons (component-paymentsubmit)
            var actionsEl = checkoutContainer.querySelector('.component-paymentsubmit');
            if (actionsEl) {
                checkoutContainer.insertBefore(wrap, actionsEl);
            } else {
                checkoutContainer.appendChild(wrap);
            }
        } else {
            formWrapper.appendChild(wrap);
        }

        // Wire refs
        createAuthWrapper = wrap;
        createAuthLoginTab = btnLogin;
        createAuthRegisterTab = btnRegister;
        createAuthLoginForm = loginForm;
        createAuthRegisterForm = registerForm;
        createAuthLoginContainer = loginContainer;
        createAuthRegisterContainer = registerContainer;
        createAuthLoginEmailInput = loginEmail;
        createAuthLoginPasswordInput = loginPass;
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

        return true;
    }

    function isCreateAuthRegisterComplete() {
        if (!createAuthRegisterContainer) return false;
        // Component-owned validity: require ALL required fieldsets to be complete.
        var req = createAuthRegisterContainer.querySelectorAll('.fieldset[data-required="true"][data-complete]');
        if (!req || !req.length) return false;
        for (var i = 0; i < req.length; i++) {
            var fs = req[i];
            if (!fs || !fs.dataset) continue;
            if (String(fs.dataset.complete || '') !== 'true') return false;
        }
        return true;
    }

    function showCreateAuth(isAdminFree) {
        if (!ensureCreateAuthMounted()) return;
        createAuthPendingSubmit = true;
        createAuthPendingSubmitIsAdminFree = !!isAdminFree;
        setCreateAuthPanel('login');
        try { createAuthWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e0) {}
    }

    function hideCreateAuth() {
        // Remove the auth container entirely (no hidden auth subtree allowed).
        unmountCreateAuth();
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
            
            // Issue auth token cookie for API authentication (used by get-posts privacy)
            fetch('/gateway.php?action=issue-token').catch(function(e) { console.error('[MemberModule] Token issue failed:', e); });
            
            render();

            var shouldSubmit = createAuthPendingSubmit;
            var isAdminFree = createAuthPendingSubmitIsAdminFree;
            // Disarm immediately so a later auth cannot "surprise-submit".
            createAuthPendingSubmit = false;
            createAuthPendingSubmitIsAdminFree = false;
            hideCreateAuth();
            updateSubmitButtonState();

            // Toast: login success (message system)
            try {
                var displayName = currentUser.name || currentUser.account_email || currentUser.username;
                getMessage('msg_auth_login_success', { name: displayName }, false).then(function(message) {
                    if (message && window.ToastComponent) ToastComponent.showSuccess(message);
                });
                // Brief follow-up: let user know their preferences were loaded from their account
                setTimeout(function() {
                    try {
                        getMessage('msg_member_preferences_restored', {}, false).then(function(message) {
                            if (message && window.ToastComponent) ToastComponent.showSuccess(message);
                        });
                    } catch (_e) {}
                }, 1200);
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
                formData.set('account-email', email);
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
                hideCreateAuth();
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
        var submitBtn = panelEl.querySelector('.component-paymentsubmit-button');
        if (submitBtn) {
            submitBtn.disabled = !isActive;
        }
        
        // Show/hide section
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
            
            // Issue auth token cookie for API authentication (used by get-posts privacy)
            fetch('/gateway.php?action=issue-token').catch(function(e) { console.error('[MemberModule] Token issue failed:', e); });
            
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
            initWallpaperButtons();
            
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
            // Brief follow-up: let user know their preferences were loaded from their account
            setTimeout(function() {
                try {
                    getMessage('msg_member_preferences_restored', {}, false).then(function(message) {
                        if (message && window.ToastComponent) ToastComponent.showSuccess(message);
                    });
                } catch (_e) {}
            }, 1200);
            
        }).catch(function(err) {
            console.error('Login failed', err);
            getMessage('msg_auth_login_failed', {}, false).then(function(message) {
                if (message) {
                    ToastComponent.showError(message);
                }
            });
        });
    }

    function handleForgotPassword() {
        var emailInput = document.getElementById('memberLoginEmail');
        var email = emailInput ? String(emailInput.value || '').trim() : '';
        if (!email) {
            if (emailInput) emailInput.focus();
            return;
        }
        fetch('/gateway.php?action=verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'request-password-reset', email: email })
        }).then(function() {
            try { if (window.ToastComponent) ToastComponent.showSuccess('If that email is registered, a reset link has been sent.'); } catch (_e) {}
        }).catch(function() {
            getMessage('msg_auth_reset_failed', {}, false).then(function(message) {
                try { if (message && window.ToastComponent) ToastComponent.showError(message); } catch (_e) {}
            });
        });
    }

    function handleRegister(_transactionId, _dismissPaymentOverlay) {
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
        var supporterAmount   = parseFloat(supporterAmountHiddenInput ? supporterAmountHiddenInput.value : '0') || 0;
        var supporterCurrency = siteCurrency || 'USD';

        if (supporterAmount > 0 && !_transactionId) {
            if (window.PaymentModule && typeof PaymentModule.charge === 'function') {
                if (registerSubmitBtn) PaymentSubmitComponent.setLoading(registerSubmitBtn, true);
                PaymentModule.charge({
                    amount:          supporterAmount,
                    currency:        supporterCurrency,
                    description:     'New member',
                    memberId:        null,
                    transactionType: 'donation',
                    onReady: function() {
                        if (registerSubmitBtn) PaymentSubmitComponent.setLoading(registerSubmitBtn, false);
                    },
                    onSuccess: function(result, dismiss) {
                        handleRegister(result.transactionId, dismiss);
                    },
                    onCancel: function() {
                        if (registerSubmitBtn) { PaymentSubmitComponent.setLoading(registerSubmitBtn, false); registerSubmitBtn.disabled = false; }
                    },
                    onError: function() {
                        if (registerSubmitBtn) { PaymentSubmitComponent.setLoading(registerSubmitBtn, false); registerSubmitBtn.disabled = false; }
                    }
                });
            }
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
            formData.set('account-email', email);
            formData.set('password', password);
            formData.set('confirm', confirm);
            if (supporterCountryHiddenInput && String(supporterCountryHiddenInput.value || '').trim() !== '') {
                formData.set('country', String(supporterCountryHiddenInput.value || '').trim());
            }
            if (avatarBlob) {
                formData.append('avatar_file', avatarBlob, 'avatar.png');
            }
            if (_transactionId) {
                formData.set('transaction_id', _transactionId);
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
                var placeholders = payload && payload.placeholders ? payload.placeholders : {};
                if (key) {
                    getMessage(key, placeholders, false).then(function(message) {
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
            currentUser = buildUserObject(payload, email);
            
            storeCurrent(currentUser);
            if (typeof _dismissPaymentOverlay === 'function') _dismissPaymentOverlay();
            render();
            
            getMessage('msg_auth_register_success', { name: name }, false).then(function(message) {
                if (message) {
                    ToastComponent.showSuccess(message);
                }
            });
            
        }).catch(function(err) {
            if (typeof _dismissPaymentOverlay === 'function') _dismissPaymentOverlay();
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

        // Clear private user data from localStorage
        try {
            localStorage.removeItem('recentPosts');
            localStorage.removeItem('postFavorites');
            localStorage.removeItem('member_country_code');
            localStorage.removeItem('member_timezone');
            localStorage.removeItem('funmap_filters');
        } catch (_eLsClr) {}

        render();
        
        // Revert to localStorage (guest) or admin settings (site default)
        var lighting = localStorage.getItem('map_lighting');
        if (!lighting) {
            if (window.App && typeof App.getState === 'function') {
                var settings = App.getState('settings') || {};
                lighting = settings.map_lighting || 'day';
            } else {
                lighting = 'day';
            }
        }
        var style = localStorage.getItem('map_style');
        if (!style) {
            if (window.App && typeof App.getState === 'function') {
                var settings = App.getState('settings') || {};
                style = settings.map_style || 'standard';
            } else {
                style = 'standard';
            }
        }
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
        initWallpaperButtons();
        
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
        return fetch('/gateway.php?action=verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'login', username: username, password: password })
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
            ,
            // Filters (DB-first; localStorage is secondary)
            filters_json: (payload.filters_json !== undefined) ? payload.filters_json : null,
            filters_hash: (payload.filters_hash !== undefined) ? payload.filters_hash : null,
            filters_version: (payload.filters_version !== undefined) ? payload.filters_version : null,
            filters_updated_at: (payload.filters_updated_at !== undefined) ? payload.filters_updated_at : null,
            // Favorites & recent history (DB → localStorage on login)
            favorites: (payload.favorites !== undefined) ? payload.favorites : null,
            recent: (payload.recent !== undefined) ? payload.recent : null
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

    /**
     * Lightweight session check — runs at page load (before panel opens).
     * Sets currentUser from localStorage and issues the auth token cookie.
     * No database reads, no UI work, no background sync. This ensures
     * saveSetting() works immediately for filters, favourites, and recents.
     */
    function loadEarlySession() {
        try {
            var raw = localStorage.getItem(CURRENT_KEY);
            if (!raw) return;
            
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.account_email) {
                var idNum = parseInt(parsed.id, 10);
                if (!isFinite(idNum) || idNum <= 0) {
                    currentUser = null;
                    try { localStorage.removeItem(CURRENT_KEY); } catch (e0) {}
                    return;
                }
                parsed.id = idNum;
                currentUser = parsed;
                
                // Issue auth token cookie for API authentication (used by get-posts privacy)
                fetch('/gateway.php?action=issue-token').catch(function(e) { console.error('[MemberModule] Token issue failed:', e); });
                
                // Notify admin auth if user is admin
                if (currentUser.isAdmin && window.adminAuthManager) {
                    window.adminAuthManager.setAuthenticated(true, currentUser.username || currentUser.account_email);
                }
            }
        } catch (e) {
            console.warn('Failed to load early session', e);
        }
    }

    /**
     * Full session load — runs when member panel first opens.
     * currentUser is already set by loadEarlySession(). This adds the
     * background sync for cross-device preference updates.
     */
    function loadStoredSession() {
        // Early session already set currentUser; if not logged in, nothing to do.
        if (!currentUser) return;
        
        // Background sync: pull latest preferences from DB (non-blocking).
        // Page already loaded instantly from localStorage; this silently updates if anything changed
        // (e.g. cross-device edits). No visible delay — only updates localStorage if DB differs.
        backgroundSyncPreferences(currentUser);
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
            try { hideCreateAuth(); } catch (e00) {}
            
            // Remove login form from profile tab (it's dynamically created)
            unmountProfileLoginForm();
            
            // Clear inputs
            clearInputs(loginInputs);
            clearInputs(registerInputs);
            
            // Hide the Register tab button when logged in
            if (registerTabBtn) registerTabBtn.hidden = true;
            
            // Show the Post Editor tab button when logged in
            if (posteditorTabBtn) posteditorTabBtn.hidden = false;
            
            // Show profile content
            if (profilePanel) {
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
                var hideInput = profileHideSwitch.querySelector('.component-switch-input');
                var hideSlider = profileHideSwitch.querySelector('.component-switch-slider');
                if (hideInput) hideInput.checked = isHidden;
                if (hideSlider) hideSlider.classList.toggle('component-switch-slider--on-default', isHidden);
            }
            pendingProfileAvatarBlob = null;
            updateProfileSaveState();
            renderAvatarPickers();
            
            // If user is on Register tab when they log in, switch to Profile tab
            if (registerTabPanel && !registerTabPanel.hidden) {
                switchTab('profile');
            }
            
            // Update header avatar
            updateHeaderAvatar(currentUser);
            
            // Profile tab label is always "Profile" (never changes to "Log In")
            if (profileTabBtn) profileTabBtn.textContent = 'Profile';

            updateHeaderSaveDiscardState();

            // Also refresh create-tab submit visibility state after login.
            try { updateSubmitButtonState(); } catch (e01) {}
            // Post Editor tab must not show stale logged-out UI after login.
            try { refreshAuthDependentTabs(); } catch (e02) {}
            
        } else {
            // Logged out state
            authForm.dataset.state = 'logged-out';
            
            // Profile tab label is always "Profile" (never changes to "Log In")
            if (profileTabBtn) profileTabBtn.textContent = 'Profile';
            
            // Hide profile content
            if (profilePanel) {
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
            
            // Show the Register tab button (only visible when logged out)
            if (registerTabBtn) registerTabBtn.hidden = false;
            
            // Hide the Post Editor tab button when logged out
            if (posteditorTabBtn) posteditorTabBtn.hidden = true;

            // Mount login form in profile tab (dynamically created)
            mountProfileLoginForm();
            
            // Update header (no avatar)
            updateHeaderAvatar(null);

            updateHeaderSaveDiscardState();
            // Create Post + Post Editor must not show stale logged-in UI after logout.
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
        try { unmountCreateAuth(); } catch (e0) {}
        try { updateSubmitButtonState(); } catch (e1) {}

        // Post Editor: Clear content on logout (PostEditorModule will reload on tab switch)
        var postEditorEl = document.getElementById('member-tab-posteditor');
        if (postEditorEl) {
            postEditorEl.innerHTML = '';
            try {
                if (postEditorEl.dataset) delete postEditorEl.dataset.posteditorInitialized;
            } catch (_eFlag) {}
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
        var memberBtn = document.querySelector('.header-access-member');
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
       DEEP LINK
       -------------------------------------------------------------------------- */

    function handleDeepLink() {
        var isRegister = false;
        var isPostEditor = false;
        var postEditorKey = null;
        var isProfileForm = false;
        var isProfile = false;
        var resetToken = null;
        try {
            var path = String(window.location.pathname || '');
            var qs = new URLSearchParams(window.location.search || '');
            if (path === '/register' || path === '/register/') isRegister = true;
            if (!isRegister && qs.get('register') !== null) isRegister = true;
            // /post-editor={key} — specific post
            var keyMatch = path.match(/^\/post-editor=([^/?#]+)\/?$/);
            if (keyMatch) {
                isPostEditor = true;
                postEditorKey = decodeURIComponent(keyMatch[1]);
            }
            if (!isPostEditor && qs.get('post-editor-key') !== null) {
                isPostEditor = true;
                postEditorKey = qs.get('post-editor-key');
            }
            // /post-editor — plain tab (no specific post)
            if (!isPostEditor) {
                if (path === '/post-editor' || path === '/post-editor/') isPostEditor = true;
                if (!isPostEditor && qs.get('post-editor') !== null) isPostEditor = true;
            }
            // /reset-password=TOKEN (path) or ?reset-password=TOKEN (after htaccess redirect)
            var resetMatch = path.match(/^\/reset-password=([^/?#]+)\/?$/);
            if (resetMatch) {
                resetToken = decodeURIComponent(resetMatch[1]);
                isProfileForm = true;
            }
            if (!resetToken && qs.get('reset-password') !== null) {
                resetToken = qs.get('reset-password');
                isProfileForm = true;
            }
            // /profile-form or ?profile-form
            if (!isProfileForm && (path === '/profile-form' || path === '/profile-form/')) isProfileForm = true;
            if (!isProfileForm && qs.get('profile-form') !== null) isProfileForm = true;
            // /profile or ?profile
            if (path === '/profile' || path === '/profile/') isProfile = true;
            if (!isProfile && qs.get('profile') !== null) isProfile = true;
        } catch (_eDL) {}
        if (!isRegister && !isPostEditor && !isProfileForm && !isProfile) return;

        // Clean URL before anything renders with the param
        try { window.history.replaceState({}, document.title, '/'); } catch (_eUrl) {}

        // Prime PostEditorModule with the key BEFORE init runs so loadPosts() picks it up
        if (isPostEditor && postEditorKey && window.PostEditorModule && typeof PostEditorModule.openPostByKey === 'function') {
            try { PostEditorModule.openPostByKey(postEditorKey); } catch (_ePEK) {}
        }

        // Emit panel:toggle — this initialises the module on first call
        if (window.App && typeof App.emit === 'function') {
            App.emit('panel:toggle', { panel: 'member', show: true });
        }

        // After emit, init() has run so tab button refs are assigned.
        // Register tab: only available to logged-out users.
        // Post Editor tab: only available to logged-in users.
        // If the target tab is unavailable, panel opens to the default (profile) tab.
        if (isRegister && registerTabBtn && !registerTabBtn.hidden) {
            requestTabSwitch('register');
        } else if (isPostEditor && posteditorTabBtn && !posteditorTabBtn.hidden) {
            requestTabSwitch('posteditor');
        } else if (isProfile && profileTabBtn && !profileTabBtn.hidden) {
            requestTabSwitch('profile');
        }

        // Profile form deep link
        if (isProfileForm) {
            if (resetToken) {
                fetch('/gateway.php?action=verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'reset-token', token: resetToken })
                }).then(function(r) { return r.json(); }).then(function(result) {
                    if (!result || result.success !== true) {
                        getMessage('msg_auth_reset_invalid', {}, false).then(function(message) {
                            try { if (message && window.ToastComponent) ToastComponent.showError(message); } catch (_e) {}
                        });
                        return;
                    }
                    var payload = result.user || {};
                    payload.role = result.role;
                    currentUser = buildUserObject(payload, payload.account_email || '');
                    syncLocalProfilePrefsFromUser(currentUser);
                    storeCurrent(currentUser);
                    fetch('/gateway.php?action=issue-token').catch(function() {});
                    render();
                    if (currentUser.map_lighting && window.MapModule && window.MapModule.setMapLighting) {
                        window.MapModule.setMapLighting(currentUser.map_lighting);
                    }
                    if (currentUser.map_style && window.MapModule && window.MapModule.setMapStyle) {
                        window.MapModule.setMapStyle(currentUser.map_style);
                    }
                    if (profileFormContainer && profileFormContainer.hidden) {
                        toggleProfileForm();
                    }
                }).catch(function() {
                    getMessage('msg_auth_reset_failed', {}, false).then(function(message) {
                        try { if (message && window.ToastComponent) ToastComponent.showError(message); } catch (_e) {}
                    });
                });
            } else if (currentUser) {
                if (profileFormContainer && profileFormContainer.hidden) {
                    toggleProfileForm();
                }
            }
        }
    }

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        loadEarlySession: loadEarlySession,
        openPanel: openPanel,
        closePanel: closePanel,
        isPanelDragged: function() { return panelDragged || panelHome !== 'right'; },
        resetToDefault: function() {
            panelHome    = 'right';
            panelDragged = false;
            panelLastLeft = null;
            if (panelContent) {
                panelContent.classList.add('member-panel-contents--side-right');
                panelContent.classList.remove('member-panel-contents--side-left');
                if (!panel || !panel.classList.contains('member-panel--show') || window.innerWidth <= 530) {
                    panelContent.style.left  = '';
                    panelContent.style.right = '';
                } else {
                    var maxLeft = Math.max(0, window.innerWidth - panelContent.offsetWidth);
                    var currentLeft = parseFloat(panelContent.style.left);
                    if (!isFinite(currentLeft)) {
                        var rect = panelContent.getBoundingClientRect();
                        currentLeft = rect && isFinite(rect.left) ? rect.left : maxLeft;
                    }
                    currentLeft = Math.max(0, Math.min(maxLeft, currentLeft));
                    panelContent.style.left = currentLeft + 'px';
                    panelContent.style.right = 'auto';
                    try { void panelContent.offsetWidth; } catch (_eFlush) {}
                    panelContent.style.left = maxLeft + 'px';
                }
            }
        },
        getCurrentUser: function() { return currentUser; },
        isLoggedIn: function() { return !!currentUser; },
        isAdmin: function() { return currentUser && currentUser.isAdmin === true; },
        saveSetting: function(key, value) { return saveMemberSetting(key, value); },
        showStatus: showStatus,
        // Exposed for PostEditorModule
        getMemberCategories: function() { return memberCategories; },
        ensureCategoriesLoaded: ensureCategoriesLoaded,
        getFieldsForSelection: getFieldsForSelection,
        ensureFieldDefaults: ensureFieldDefaults,
        getDefaultCurrencyForForms: getDefaultCurrencyForForms,
        submitPostData: submitPostData,
        extractFieldValue: extractFieldValue,
        updateHeaderSaveDiscardState: updateHeaderSaveDiscardState,
        openTermsModal: openTermsModal,
        getCheckoutOptions: function() { return checkoutOptions; },
        handleDeepLink: handleDeepLink
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
            
            var memberBtn = document.querySelector('.header-access-member');
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
            var adminBtn = document.querySelector('.header-access-admin');
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

// Early session: set currentUser from localStorage immediately so saveSetting()
// works for filters/favourites/recents before the member panel is ever opened.
// No database reads, no UI work — just one localStorage read + auth token fetch.
MemberModule.loadEarlySession();

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
