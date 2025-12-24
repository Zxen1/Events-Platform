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
       SVG ICONS
       -------------------------------------------------------------------------- */
    
    var icons = {
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        minus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
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
    
    // Preferences pickers (Profile tab)
    var languageMenuContainer = null;
    var currencyMenuContainer = null;
    var languageMenuInstance = null;
    var currencyMenuInstance = null;
    
    // Profile edit
    var profileEditNameInput = null;
    var profileEditPasswordInput = null;
    var profileEditConfirmInput = null;
    // Legacy inline save button (removed from HTML). Keep var to avoid strict-mode ReferenceError.
    var profileSaveBtn = null;
    var profileEditForm = null;
    var profileOriginalName = '';
    var profileOriginalAvatarUrl = '';
    var pendingAvatarUrl = '';
    var pendingRegisterAvatarBlob = null;
    var pendingProfileAvatarBlob = null;

    // Avatar (register + profile) - 4-tile picker (self/upload + 3 random site avatars)
    var avatarGridRegister = null;
    var avatarGridProfile = null;
    var activeAvatarTarget = null; // 'register' | 'profile' (used by cropper/file picker)
    var avatarSelection = { register: 'self', profile: 'self' };
    var pendingRegisterSiteUrl = '';
    var pendingProfileSiteUrl = '';
    var pendingRegisterAvatarPreviewUrl = ''; // objectURL for showing staged crop in grid
    var pendingProfileAvatarPreviewUrl = '';  // objectURL for showing staged crop in grid
    var siteAvatarFilesPromise = null;
    var siteAvatarFolder = '';
    var siteAvatarFilenames = [];  // all filenames in site avatars folder
    var siteAvatarChoices = [];    // 3 picked: [{ filename, url }]

    // Avatar upload + crop
    var avatarFileInput = null;
    var cropperOverlay = null;
    var cropperCanvas = null;
    var cropperZoom = null;
    var cropperCancelBtn = null;
    var cropperSaveBtn = null;
    var cropImg = null;
    // Cropper zoom is "cover-only": zoom=1 is the minimum (image always fills the square; no blank areas).
    var cropState = { zoom: 1, minZoom: 1, offsetX: 0, offsetY: 0, dragging: false, lastX: 0, lastY: 0 };

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
        closeBtn = panel.querySelector('.member-panel-actions-icon-btn--close');
        tabButtons = panel.querySelectorAll('.member-tab-bar-button');
        tabPanels = panel.querySelectorAll('.member-tab-panel');
        
        // Auth elements
        authForm = panel.querySelector('.member-auth');
        loginFormEl = document.getElementById('memberAuthFormLogin');
        registerFormEl = document.getElementById('memberAuthFormRegister');
        authTabs = panel.querySelector('.member-auth-tabs');
        loginTab = panel.querySelector('.member-auth-tab[data-target="login"]');
        registerTab = panel.querySelector('.member-auth-tab[data-target="register"]');
        loginPanel = document.getElementById('member-auth-login');
        registerPanel = document.getElementById('member-auth-register');
        profilePanel = document.getElementById('member-auth-profile');
        
        if (loginPanel) {
            loginInputs = Array.from(loginPanel.querySelectorAll('input'));
        }
        if (registerPanel) {
            registerInputs = Array.from(registerPanel.querySelectorAll('input'));
        }
        
        profileAvatar = document.getElementById('member-profile-avatar');
        profileName = document.getElementById('member-profile-name');
        profileEmail = document.getElementById('member-profile-email');
        logoutBtn = document.getElementById('member-logout-btn');
        profileTabBtn = document.getElementById('member-tab-profile-btn');

        headerSaveBtn = panel.querySelector('#member-panel-save-btn');
        headerDiscardBtn = panel.querySelector('#member-panel-discard-btn');
        
        languageMenuContainer = document.getElementById('memberLanguageMenu');
        currencyMenuContainer = document.getElementById('memberCurrencyMenu');
        
        profileEditNameInput = document.getElementById('member-profile-edit-name');
        profileEditPasswordInput = document.getElementById('member-profile-edit-password');
        profileEditConfirmInput = document.getElementById('member-profile-edit-confirm');
        profileEditForm = document.getElementById('memberProfileEditForm');
        profileSaveBtn = document.getElementById('member-profile-save-btn'); // legacy (removed in HTML; may be null)

        // Avatar UI
        avatarGridRegister = document.getElementById('member-avatar-grid-register');
        avatarGridProfile = document.getElementById('member-avatar-grid-profile');
        avatarFileInput = document.getElementById('member-avatar-file-input');
        cropperOverlay = document.getElementById('member-avatar-cropper');
        cropperCanvas = document.getElementById('member-avatar-cropper-canvas');
        cropperZoom = document.getElementById('member-avatar-cropper-zoom');
        cropperCancelBtn = document.getElementById('member-avatar-cropper-cancel');
        cropperSaveBtn = document.getElementById('member-avatar-cropper-save');

        // Note: we do NOT wire #member-unsaved-prompt directly; dialogs are controlled from components.
    }

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
        if (profileEditNameInput) profileEditNameInput.addEventListener('input', updateProfileSaveState);
        if (profileEditPasswordInput) profileEditPasswordInput.addEventListener('input', updateProfileSaveState);
        if (profileEditConfirmInput) profileEditConfirmInput.addEventListener('input', updateProfileSaveState);
        if (profileEditForm) {
            profileEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleHeaderSave();
            });
        }

        // Avatar grid interactions (Register + Profile)
        if (avatarGridRegister) {
            avatarGridRegister.addEventListener('click', function(e) {
                onAvatarGridClick('register', e);
            });
        }
        if (avatarGridProfile) {
            avatarGridProfile.addEventListener('click', function(e) {
                onAvatarGridClick('profile', e);
            });
        }
        if (avatarFileInput) {
            avatarFileInput.addEventListener('change', function() {
                var file = avatarFileInput.files && avatarFileInput.files[0];
                if (!file) return;
                openCropperForFile(file);
            });
        }
        if (cropperCancelBtn) {
            cropperCancelBtn.addEventListener('click', function() {
                closeCropper();
            });
        }
        if (cropperSaveBtn) {
            cropperSaveBtn.addEventListener('click', function() {
                saveCroppedAvatar();
            });
        }
        if (cropperZoom) {
            cropperZoom.addEventListener('input', function() {
                var z = parseFloat(cropperZoom.value || '1');
                if (!isFinite(z) || z <= 0) z = 1;
                var minZ = (cropState && cropState.minZoom) ? cropState.minZoom : 1;
                if (z < minZ) z = minZ;
                cropState.zoom = z;
                drawCropper();
            });
        }
        if (cropperCanvas) {
            cropperCanvas.addEventListener('mousedown', function(e) {
                cropState.dragging = true;
                cropState.lastX = e.clientX;
                cropState.lastY = e.clientY;
            });
            window.addEventListener('mousemove', function(e) {
                if (!cropState.dragging) return;
                var dx = e.clientX - cropState.lastX;
                var dy = e.clientY - cropState.lastY;
                cropState.lastX = e.clientX;
                cropState.lastY = e.clientY;
                
                // Scale mouse delta to canvas pixel coords (canvas may be displayed smaller than its internal size)
                var rect = cropperCanvas.getBoundingClientRect();
                var scaleX = rect.width ? (cropperCanvas.width / rect.width) : 1;
                var scaleY = rect.height ? (cropperCanvas.height / rect.height) : 1;
                cropState.offsetX += dx * scaleX;
                cropState.offsetY += dy * scaleY;
                drawCropper();
            });
            window.addEventListener('mouseup', function() {
                cropState.dragging = false;
            });
        }

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
        
        // Load from localStorage (guests) or database (members)
        var currentLighting = 'day';
        if (currentUser) {
            // Load from member data (will be set when member data loads)
            currentLighting = currentUser.map_lighting || 'day';
        } else {
            currentLighting = localStorage.getItem('map_lighting') || 'day';
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
        
        // Load from localStorage (guests) or database (members)
        var currentStyle = 'standard';
        if (currentUser) {
            currentStyle = currentUser.map_style || 'standard';
        } else {
            currentStyle = localStorage.getItem('map_style') || 'standard';
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
        
        // Save to database via API
        fetch('/gateway.php?action=' + getEditUserAction(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                email: currentUser.email,
                [key]: value
            })
        }).catch(function(err) {
            console.error('[Member] Failed to save setting:', err);
        });
        
        // Update local state
        if (currentUser) {
            currentUser[key] = value;
        }
    }

    function initProfilePickers() {
        if (!languageMenuContainer || !currencyMenuContainer) return;
        if (!window.CurrencyComponent || typeof CurrencyComponent.loadFromDatabase !== 'function') return;

        function getSettingsDefaultCurrency() {
            try {
                if (!window.App || typeof App.getState !== 'function') return null;
                var settings = App.getState('settings') || {};
                return settings.website_currency || settings.site_currency || settings.siteCurrency || null;
            } catch (e) {
                return null;
            }
        }
        
        CurrencyComponent.loadFromDatabase().then(function() {
            // Language (TEMP: this is intentionally the same as Currency menu for now)
            languageMenuContainer.innerHTML = '';
            languageMenuInstance = CurrencyComponent.buildFullMenu({
                container: panelContent,
                initialValue: localStorage.getItem('member_language') || getSettingsDefaultCurrency() || null,
                onSelect: function(code) {
                    localStorage.setItem('member_language', code);
                }
            });
            if (languageMenuInstance && languageMenuInstance.element) {
                languageMenuContainer.appendChild(languageMenuInstance.element);
            }
            
            // Currency
            currencyMenuContainer.innerHTML = '';
            currencyMenuInstance = CurrencyComponent.buildFullMenu({
                container: panelContent,
                initialValue: localStorage.getItem('member_currency') || getSettingsDefaultCurrency() || null,
                onSelect: function(code) {
                    localStorage.setItem('member_currency', code);
                }
            });
            if (currencyMenuInstance && currencyMenuInstance.element) {
                currencyMenuContainer.appendChild(currencyMenuInstance.element);
            }
        }).catch(function(err) {
            console.warn('[Member] Failed to load currency data for pickers', err);
        });
    }

    function setAvatarForTarget(url) {
        url = url || '';
        if (activeAvatarTarget === 'register') {
            // Registration stores avatar via final upload on submit (no immediate upload here)
            // Keep compatibility: treat this as "select self tile with a preview url" if needed.
            pendingRegisterSiteUrl = '';
            avatarSelection.register = 'self';
            pendingRegisterAvatarPreviewUrl = resolveAvatarSrc(url) || '';
            pendingRegisterAvatarBlob = null;
            renderAvatarGrids();
        } else if (activeAvatarTarget === 'profile') {
            pendingAvatarUrl = url;
            // Also update the main avatar + header immediately for feedback (even before saving)
            if (profileAvatar) {
                profileAvatar.src = resolveAvatarSrc(url) || getAvatarSource(currentUser);
            }
            if (currentUser) {
                currentUser.avatar = url; // filename (or URL) staged; persists only after save
                updateHeaderAvatar(currentUser);
            }
            pendingProfileAvatarBlob = null;
            pendingProfileSiteUrl = '';
            pendingProfileAvatarPreviewUrl = '';
            avatarSelection.profile = 'self';
            renderAvatarGrids();
            updateHeaderSaveDiscardState();
        }
    }

    // Avatar values are stored as filenames (preferred) or occasionally absolute URLs (legacy).
    // Resolve to a usable src based on folder settings:
    // - user uploads: {id}-avatar.ext -> folder_avatars
    // - library picks: any other filename -> folder_site_avatars
    function resolveAvatarSrc(value) {
        var v = (value || '').trim();
        if (!v) return '';
        if (v.indexOf('data:') === 0) return v;
        if (v.indexOf('http://') === 0 || v.indexOf('https://') === 0) return v;
        if (v.indexOf('/') === 0) return v;
        // Filename-only
        if (window.App && typeof App.getImageUrl === 'function') {
            if (/^\d+-avatar\./.test(v)) {
                return App.getImageUrl('avatars', v);
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
                var folder = (res && res.settings && res.settings.folder_site_avatars) ? String(res.settings.folder_site_avatars) : 'https://cdn.funmap.com/site-avatars/';
                if (folder && !folder.endsWith('/')) folder += '/';
                siteAvatarFolder = folder;
                return fetch('/gateway.php?action=list-files&folder=' + encodeURIComponent(folder))
                    .then(function(r) { return r.json(); })
                    .then(function(list) {
                        // list-files returns `icons` array for historical reasons
                        if (!list || list.success !== true || !Array.isArray(list.icons)) return [];
                        return list.icons.filter(function(fn) { return typeof fn === 'string' && fn.trim() !== ''; });
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
            pickRandomSiteAvatarChoices(3);
            renderAvatarGrids();
        });
    }

    function cameraSvgMarkup() {
        // Simple inline camera icon
        return (
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="currentColor" d="M9 4.5h6l1.2 2H20c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-10c0-1.1.9-2 2-2h3.8L9 4.5zm3 5.2a4.3 4.3 0 1 0 0 8.6a4.3 4.3 0 0 0 0-8.6zm0 1.8a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5z"/>' +
            '</svg>'
        );
    }

    function getSelfTileSrc(target) {
        if (target === 'register') {
            return pendingRegisterAvatarPreviewUrl || '';
        }
        // profile
        if (pendingProfileAvatarPreviewUrl) return pendingProfileAvatarPreviewUrl;
        if (currentUser && currentUser.avatar) {
            return resolveAvatarSrc(String(currentUser.avatar));
        }
        return '';
    }

    function renderAvatarGrids() {
        renderAvatarGrid('register', avatarGridRegister);
        renderAvatarGrid('profile', avatarGridProfile);
    }

    function renderAvatarGrid(target, container) {
        if (!container) return;

        // If profile grid is present but user is logged out, keep it empty
        if (target === 'profile' && !currentUser) {
            container.innerHTML = '';
            return;
        }

        // Site choices:
        // - Register: 3 random site avatars
        // - Profile: if user already has an avatar, only show 2 random site avatars (plus an extra Upload tile)
        var hasExistingProfileAvatar = (target === 'profile' && currentUser && currentUser.avatar);
        var siteCount = hasExistingProfileAvatar ? 2 : 3;
        var choices = Array.isArray(siteAvatarChoices) ? siteAvatarChoices.slice(0, siteCount) : [];

        // Default selection
        if (!avatarSelection[target]) avatarSelection[target] = 'self';

        container.innerHTML = '';

        // Tile 0: self (current avatar if exists, otherwise Add)
        (function() {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'member-avatar-choice';
            btn.dataset.choiceKey = 'self';
            btn.setAttribute('aria-pressed', avatarSelection[target] === 'self' ? 'true' : 'false');
            if (avatarSelection[target] === 'self') btn.classList.add('member-avatar-choice--selected');

            var src = getSelfTileSrc(target);
            if (src) {
                btn.innerHTML = '<img src="' + src + '" alt="">';
            } else {
                btn.innerHTML = '<div class="member-avatar-choice-add">' + cameraSvgMarkup() + '<div class="member-avatar-choice-add-text">Add</div></div>';
            }

            container.appendChild(btn);
        })();

        // Profile-only tile 1: Upload (only when user already has an avatar)
        if (hasExistingProfileAvatar) {
            var up = document.createElement('button');
            up.type = 'button';
            up.className = 'member-avatar-choice';
            up.dataset.choiceKey = 'upload';
            up.setAttribute('aria-pressed', avatarSelection[target] === 'upload' ? 'true' : 'false');
            if (avatarSelection[target] === 'upload') up.classList.add('member-avatar-choice--selected');
            up.innerHTML = '<div class="member-avatar-choice-add">' + cameraSvgMarkup() + '<div class="member-avatar-choice-add-text">Add</div></div>';
            container.appendChild(up);
        }

        // Remaining tiles: site avatars
        for (var i = 0; i < siteCount; i++) {
            var c = choices[i] || null;
            var key = 'site-' + i;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'member-avatar-choice';
            b.dataset.choiceKey = key;
            b.dataset.siteIndex = String(i);
            b.setAttribute('aria-pressed', avatarSelection[target] === key ? 'true' : 'false');
            if (avatarSelection[target] === key) b.classList.add('member-avatar-choice--selected');
            if (c && c.url) {
                b.innerHTML = '<img src="' + c.url + '" alt="">';
            } else {
                b.innerHTML = '<div class="member-avatar-choice-add"><div class="member-avatar-choice-add-text">...</div></div>';
            }
            container.appendChild(b);
        }
    }

    function onAvatarGridClick(target, e) {
        var btn = e.target && e.target.closest ? e.target.closest('.member-avatar-choice') : null;
        if (!btn) return;
        var key = btn.dataset.choiceKey || '';
        if (!key) return;

        // Second click on the selected tile opens crop editor
        if (avatarSelection[target] === key) {
            openCropperForAvatarChoice(target, key);
            return;
        }

        // Otherwise just select it
        selectAvatarChoice(target, key);
    }

    function selectAvatarChoice(target, key) {
        avatarSelection[target] = key;

        if (target === 'register') {
            if (key.indexOf('site-') === 0) {
                var idx = parseInt(key.split('-')[1] || '0', 10);
                var c = siteAvatarChoices[idx];
                pendingRegisterSiteUrl = c && c.url ? String(c.url) : '';
                // Selecting site avatar overwrites any staged upload/crop
                pendingRegisterAvatarBlob = null;
                pendingRegisterAvatarPreviewUrl = '';
            } else {
                // self/upload tile
                pendingRegisterSiteUrl = '';
            }
        } else if (target === 'profile') {
            if (key === 'upload') {
                // Upload tile (always overwrites user's avatar when saved)
                pendingProfileSiteUrl = '';
                pendingProfileAvatarBlob = null;
                pendingProfileAvatarPreviewUrl = '';
            } else
            if (key.indexOf('site-') === 0) {
                var pIdx = parseInt(key.split('-')[1] || '0', 10);
                var pC = siteAvatarChoices[pIdx];
                pendingProfileSiteUrl = pC && pC.url ? String(pC.url) : '';
                // Selecting site avatar overwrites any staged upload/crop
                pendingProfileAvatarBlob = null;
                pendingProfileAvatarPreviewUrl = '';
            } else {
                // self/upload tile (keep current avatar as-is unless user crops/uploads)
                pendingProfileSiteUrl = '';
            }
            updateHeaderSaveDiscardState();
        }

        renderAvatarGrids();
    }

    function openCropperForAvatarChoice(target, key) {
        activeAvatarTarget = target;

        if (target === 'profile' && key === 'upload') {
            // Second-click on Upload tile opens file picker -> crop modal
            openAvatarFilePicker();
            return;
        }

        if (key === 'self') {
            // If we already have a staged blob, reopen cropper with it
            if (target === 'register' && pendingRegisterAvatarBlob) {
                openCropperForBlob(pendingRegisterAvatarBlob, 'avatar.png');
                return;
            }
            if (target === 'profile' && pendingProfileAvatarBlob) {
                openCropperForBlob(pendingProfileAvatarBlob, 'avatar.png');
                return;
            }

            // If profile has an existing avatar, open cropper on it; otherwise open file picker
            if (target === 'profile' && currentUser && currentUser.avatar) {
                var src = resolveAvatarSrc(String(currentUser.avatar));
                if (src) {
                    openCropperForUrl(src, 'avatar.png');
                    return;
                }
            }

            // No avatar yet -> pick a file
            openAvatarFilePicker();
            return;
        }

        if (key.indexOf('site-') === 0) {
            var idx = parseInt(key.split('-')[1] || '0', 10);
            var c = siteAvatarChoices[idx];
            if (c && c.url) {
                openCropperForUrl(c.url, 'avatar.png');
            }
        }
    }

    function openCropperForBlob(blob, filename) {
        if (!blob) return;
        filename = filename || 'avatar.png';
        var file = null;
        try {
            file = new File([blob], filename, { type: blob.type || 'image/png' });
        } catch (e) {
            // IE/older fallback
            file = blob;
            file.name = filename;
            file.type = blob.type || 'image/png';
        }
        openCropperForFile(file);
    }

    function openCropperForUrl(url, filename) {
        filename = filename || (url ? (String(url).split('/').pop() || 'avatar.png') : 'avatar.png');
        // Fetch as blob first to avoid tainted canvas
        fetch(url)
            .then(function(r) { return r.blob(); })
            .then(function(blob) {
                openCropperForBlob(blob, filename);
            })
            .catch(function(err) {
                console.warn('[Member] Failed to load avatar for cropping', err);
                if (window.ToastComponent && ToastComponent.showError) {
                    ToastComponent.showError('Could not load that avatar image.');
                }
            });
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

    function openAvatarFilePicker() {
        if (!avatarFileInput) return;
        avatarFileInput.value = '';
        avatarFileInput.click();
    }

    function openCropperForFile(file) {
        if (!cropperOverlay || !cropperCanvas) return;
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError('Please select an image file.');
            }
            return;
        }

        var url = URL.createObjectURL(file);
        cropImg = new Image();
        cropImg.onload = function() {
            // Reset crop state
            cropState.zoom = 1;
            cropState.offsetX = 0;
            cropState.offsetY = 0;

            // Cover-only zoom (no blank areas)
            cropState.minZoom = 1;
            if (cropperZoom) {
                cropperZoom.min = '1';
                cropperZoom.value = '1';
            }

            drawCropper();
            cropperOverlay.hidden = false;
            cropperOverlay.setAttribute('aria-hidden', 'false');
        };
        cropImg.src = url;
        cropImg.dataset.objectUrl = url;
    }

    function closeCropper() {
        if (!cropperOverlay) return;
        cropperOverlay.hidden = true;
        cropperOverlay.setAttribute('aria-hidden', 'true');
        if (cropImg && cropImg.dataset && cropImg.dataset.objectUrl) {
            try { URL.revokeObjectURL(cropImg.dataset.objectUrl); } catch(e) {}
        }
        cropImg = null;
    }

    function drawCropper() {
        if (!cropImg || !cropperCanvas) return;
        var ctx = cropperCanvas.getContext('2d');
        if (!ctx) return;

        var cw = cropperCanvas.width;
        var ch = cropperCanvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // Fit image to cover canvas, then apply zoom/offset
        var iw = cropImg.naturalWidth || cropImg.width;
        var ih = cropImg.naturalHeight || cropImg.height;
        if (!iw || !ih) return;

        var cover = Math.max(cw / iw, ch / ih);
        var scale = cover * (cropState.zoom || 1);
        var drawW = iw * scale;
        var drawH = ih * scale;
        // Clamp offsets so the image always fully covers the crop square (no blank areas)
        // Allowed x range is [cw - drawW, 0], same for y.
        var baseX = (cw - drawW) / 2;
        var baseY = (ch - drawH) / 2;
        var offX = cropState.offsetX || 0;
        var offY = cropState.offsetY || 0;
        if (drawW <= cw) {
            offX = 0;
        } else {
            var minOffX = baseX;   // cw-drawW - baseX
            var maxOffX = -baseX;  // 0 - baseX
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
        // Persist clamped values so dragging can't "escape" and stay escaped.
        cropState.offsetX = offX;
        cropState.offsetY = offY;

        var x = baseX + offX;
        var y = baseY + offY;
        ctx.drawImage(cropImg, x, y, drawW, drawH);
    }

    function saveCroppedAvatar() {
        try {
            if (!cropperCanvas) return;
            
            // Always show some feedback (toast if available, otherwise member status)
            if (window.ToastComponent && ToastComponent.show) {
                ToastComponent.show('Uploading avatar...');
            } else {
                showStatus('Uploading avatar...');
            }
            
            if (cropperSaveBtn) {
                cropperSaveBtn.disabled = true;
                cropperSaveBtn.classList.add('member-button-auth--disabled');
            }
            
            var toBlobFn = cropperCanvas.toBlob;
            if (typeof toBlobFn !== 'function') {
                // Fallback: convert dataURL to Blob
                var dataUrl = cropperCanvas.toDataURL('image/png', 0.92);
                var parts = dataUrl.split(',');
                var byteString = atob(parts[1] || '');
                var ab = new ArrayBuffer(byteString.length);
                var ia = new Uint8Array(ab);
                for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                var blob = new Blob([ab], { type: 'image/png' });
                return uploadAvatarBlob(blob).finally(function() {
                    if (cropperSaveBtn) {
                        cropperSaveBtn.disabled = false;
                        cropperSaveBtn.classList.remove('member-button-auth--disabled');
                    }
                });
            }
            
            cropperCanvas.toBlob(function(blob) {
                if (!blob) {
                    if (cropperSaveBtn) {
                        cropperSaveBtn.disabled = false;
                        cropperSaveBtn.classList.remove('member-button-auth--disabled');
                    }
                    if (window.ToastComponent && ToastComponent.showError) {
                        ToastComponent.showError('Could not create avatar image.');
                    } else {
                        showStatus('Could not create avatar image.', { error: true });
                    }
                    return;
                }
                
                // Do NOT upload immediately. Store blob and only upload on registration submit / header save.
                if (activeAvatarTarget === 'register') {
                    pendingRegisterAvatarBlob = blob;
                    pendingRegisterSiteUrl = '';
                    avatarSelection.register = 'self';
                    try {
                        pendingRegisterAvatarPreviewUrl = URL.createObjectURL(blob);
                    } catch (e) {
                        pendingRegisterAvatarPreviewUrl = '';
                    }
                    renderAvatarGrids();
                    closeCropper();
                    if (window.ToastComponent && ToastComponent.showSuccess) {
                        ToastComponent.showSuccess('Avatar selected');
                    } else {
                        showStatus('Avatar selected');
                    }
                } else if (activeAvatarTarget === 'profile') {
                    pendingProfileAvatarBlob = blob;
                    pendingProfileSiteUrl = '';
                    avatarSelection.profile = 'self';
                    try {
                        pendingProfileAvatarPreviewUrl = URL.createObjectURL(blob);
                    } catch (e) {
                        pendingProfileAvatarPreviewUrl = '';
                    }
                    if (profileAvatar && pendingProfileAvatarPreviewUrl) {
                        profileAvatar.src = pendingProfileAvatarPreviewUrl;
                    }
                    renderAvatarGrids();
                    // Mark dirty so header Save lights up
                    updateHeaderSaveDiscardState();
                    closeCropper();
                    if (window.ToastComponent && ToastComponent.showSuccess) {
                        ToastComponent.showSuccess('Avatar ready to save');
                    } else {
                        showStatus('Avatar ready to save');
                    }
                }
                
                if (cropperSaveBtn) {
                    cropperSaveBtn.disabled = false;
                    cropperSaveBtn.classList.remove('member-button-auth--disabled');
                }
            }, 'image/png', 0.92);
        } catch (e) {
            console.error('[Member] saveCroppedAvatar error', e);
            if (cropperSaveBtn) {
                cropperSaveBtn.disabled = false;
                cropperSaveBtn.classList.remove('member-button-auth--disabled');
            }
            var msg = (e && e.message) ? e.message : 'Avatar upload failed';
            if (window.ToastComponent && ToastComponent.showError) {
                ToastComponent.showError(msg);
            } else {
                showStatus(msg, { error: true });
            }
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
            setAvatarForTarget(avatarValue);
            closeCropper();
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
        
        var name = profileEditNameInput ? profileEditNameInput.value.trim() : '';
        var pw = profileEditPasswordInput ? profileEditPasswordInput.value : '';
        var confirm = profileEditConfirmInput ? profileEditConfirmInput.value : '';

        // Validation warnings using existing component (Toast)
        if ((pw || confirm) && (!pw || !confirm)) {
            getMessage('msg_auth_register_empty', {}, false).then(function(message) {
                var text = message || 'Please enter and confirm your new password.';
                if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                    ToastComponent.showError(text);
                } else {
                    showStatus(text, { error: true });
                }
            });
            return;
        }
        if (pw && confirm && pw !== confirm) {
            getMessage('msg_auth_register_password_mismatch', {}, false).then(function(message) {
                var text = message || 'Passwords do not match.';
                if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                    ToastComponent.showError(text);
                } else {
                    showStatus(text, { error: true });
                }
            });
            return;
        }
        
        var payload = { id: currentUser.id, email: currentUser.email };
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
                  if (window.ToastComponent && ToastComponent.showSuccess) {
                      ToastComponent.showSuccess('Saved');
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
                          var text = message || ('Missing message: ' + String(err.message_key));
                          if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                              ToastComponent.showError(text);
                          } else {
                              showStatus(text, { error: true });
                          }
                      });
                      return;
                  }
                  getMessage('msg_admin_save_error_response', {}, false).then(function(message) {
                      var text = message || 'Save failed';
                      if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                          ToastComponent.showError(text);
                      } else {
                          showStatus(text, { error: true });
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
                    avatarSelection.profile = 'self';
                    try { pendingProfileAvatarPreviewUrl = URL.createObjectURL(squareBlob); } catch (e) { pendingProfileAvatarPreviewUrl = ''; }
                    if (profileAvatar && pendingProfileAvatarPreviewUrl) profileAvatar.src = pendingProfileAvatarPreviewUrl;
                    renderAvatarGrids();
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
        avatarSelection.profile = 'self';
        if (profileAvatar) profileAvatar.src = getAvatarSource(currentUser);
        renderAvatarGrids();
        updateProfileSaveState();
    }

    function confirmUnsavedProfileEdits(nextAction) {
        if (!window.ThreeButtonDialogComponent || typeof ThreeButtonDialogComponent.show !== 'function') {
            // Fallback: do nothing if dialog component isn't available
            return;
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
        panelContent.classList.remove('member-panel-content--hidden');
        panelContent.classList.add('member-panel-content--visible');
        
        // Refresh map settings buttons (in case member logged in/out)
        initMapLightingButtons();
        initMapStyleButtons();
        initProfilePickers();
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
                    return opt.is_active !== false && opt.is_active !== 0;
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
                
                categoryMenu.classList.remove('open');
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
                            
                            subcategoryMenu.classList.remove('open');
                            selectedSubcategory = subName;
                            renderConfiguredFields();
                        });
                        
                        subcategoryOpts.appendChild(subBtn);
                    });
                    
                    subcategoryBtn.innerHTML = '<span class="member-formpicker-menu-button-text">Select a subcategory</span><span class="member-formpicker-menu-button-arrow">▼</span>';
                    subcategoryWrapper.hidden = false;
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
            subcategoryMenu.classList.remove('open');
            categoryMenu.classList.toggle('open');
        });
        
        // Toggle subcategory menu
        subcategoryBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            categoryMenu.classList.remove('open');
            subcategoryMenu.classList.toggle('open');
        });
        
        // Close menus on outside click
        document.addEventListener('click', function(e) {
            if (!categoryMenu.contains(e.target)) categoryMenu.classList.remove('open');
            if (!subcategoryMenu.contains(e.target)) subcategoryMenu.classList.remove('open');
        });
        
        categoryMenu.appendChild(categoryBtn);
        categoryMenu.appendChild(categoryOpts);
        categoryWrapper.appendChild(categoryLabel);
        categoryWrapper.appendChild(categoryMenu);
        
        dropdownsContainer.appendChild(categoryWrapper);
        dropdownsContainer.appendChild(subcategoryWrapper);
        container.appendChild(dropdownsContainer);
    }
    
    function renderConfiguredFields() {
        if (!selectedCategory || !selectedSubcategory) {
            if (formWrapper) formWrapper.hidden = true;
            if (formFields) formFields.innerHTML = '';
            return;
        }
        
        // Get fields for this category/subcategory
        var fields = getFieldsForSelection(selectedCategory, selectedSubcategory);

        if (formFields) formFields.innerHTML = '';

        // Track location quantity and repeat fieldsets
        var locationQuantity = 1;
        var locationFieldset = null;
        var locationFieldsetType = null;
        var mustRepeatFieldsets = [];
        var autofillRepeatFieldsets = [];

        // FieldsetComponent auto-loads its own picklist data
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
                
                if (isMustRepeat) {
                    mustRepeatFieldsets.push(field);
                }
                if (isAutofillRepeat) {
                    autofillRepeatFieldsets.push(field);
                }
            });
            
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

                var fieldset = FieldsetComponent.buildFieldset(field, {
                    idPrefix: 'memberCreate',
                    fieldIndex: index,
                    container: formFields,
                    defaultCurrency: null
                });
                
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
                        
                        // Insert after label
                        labelEl.parentNode.insertBefore(quantityRow, labelEl.nextSibling);
                        
                        // Update label text if quantity > 1
                        if (locationQuantity > 1) {
                            var labelTextEl = labelEl.querySelector('.fieldset-label-text');
                            if (labelTextEl) {
                                var baseName = locationFieldsetType.charAt(0).toUpperCase() + locationFieldsetType.slice(1);
                                labelTextEl.textContent = baseName + ' 1';
                            }
                        }
                        
                        // Quantity button handlers
                        minusBtn.addEventListener('click', function() {
                            if (locationQuantity > 1) {
                                locationQuantity--;
                                quantityDisplay.textContent = locationQuantity;
                                
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
                                
                                // Re-render additional locations (after checkout section)
                                // Minus clicked
                                setTimeout(function() {
                                    renderAdditionalLocations(locationQuantity, locationFieldsetType, locationFieldset, mustRepeatFieldsets, autofillRepeatFieldsets);
                                }, 100);
                            }
                        });
                        
                        plusBtn.addEventListener('click', function() {
                            locationQuantity++;
                            quantityDisplay.textContent = locationQuantity;
                            
                            // Update label
                            var labelTextEl = labelEl.querySelector('.fieldset-label-text');
                            if (labelTextEl) {
                                var baseName = locationFieldsetType.charAt(0).toUpperCase() + locationFieldsetType.slice(1);
                                labelTextEl.textContent = baseName + ' 1';
                            }
                            
                            // Re-render additional locations (after checkout section)
                            // Plus clicked
                            setTimeout(function() {
                                renderAdditionalLocations(locationQuantity, locationFieldsetType, locationFieldset, mustRepeatFieldsets, autofillRepeatFieldsets);
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
        
        if (formWrapper) formWrapper.hidden = false;
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
            
            var locationFieldsetClone = FieldsetComponent.buildFieldset(locationFieldData, {
                idPrefix: 'memberCreate',
                fieldIndex: 0,
                locationNumber: i,
                container: locationSection,
                defaultCurrency: null
            });
            
            // Built fieldset for location
            locationSection.appendChild(locationFieldsetClone);
            
            // Then, render must-repeat fieldsets
            mustRepeatFieldsets.forEach(function(fieldData, fieldIndex) {
                var fieldset = FieldsetComponent.buildFieldset(fieldData, {
                    idPrefix: 'memberCreate',
                    fieldIndex: fieldIndex,
                    locationNumber: i,
                    container: locationSection,
                    defaultCurrency: null
                });
                
                locationSection.appendChild(fieldset);
                
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
        // Find source fieldset (location 1 is the main fieldset, not in additional-location)
        // We need to find the fieldset with the same fieldset key in the main form
        var fieldsetKey = (fieldData.key || fieldData.fieldset_key || '').toLowerCase();
        var sourceFieldset = null;
        
        // Find the first occurrence of this fieldset type in the main form
        var allFieldsets = formFields.querySelectorAll('.fieldset');
        for (var i = 0; i < allFieldsets.length; i++) {
            var fs = allFieldsets[i];
            // Check if this fieldset matches by looking at its structure or data attributes
            // For now, match by fieldset type (venue, city, address have specific structures)
            if (fieldsetKey === 'venue' && fs.querySelector('.fieldset-sublabel') && fs.querySelector('.fieldset-sublabel').textContent === 'Venue Name') {
                sourceFieldset = fs;
                break;
            } else if (fieldsetKey === 'city' && fs.querySelector('.fieldset-input[placeholder*="city"]')) {
                sourceFieldset = fs;
                break;
            } else if ((fieldsetKey === 'address' || fieldsetKey === 'location') && fs.querySelector('.fieldset-input[placeholder*="address"]')) {
                sourceFieldset = fs;
                break;
            }
        }
        
        if (!sourceFieldset) {
            // Fallback: use first fieldset of same type by matching input structure
            var targetInputs = targetFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
            if (targetInputs.length > 0) {
                // Find fieldset with similar structure
                for (var j = 0; j < allFieldsets.length; j++) {
                    var fs2 = allFieldsets[j];
                    var fs2Inputs = fs2.querySelectorAll('input:not([type="hidden"]), textarea, select');
                    if (fs2Inputs.length === targetInputs.length && !fs2.closest('.member-additional-location')) {
                        sourceFieldset = fs2;
                        break;
                    }
                }
            }
        }
        
        if (sourceFieldset) {
            var sourceInputs = sourceFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
            var targetInputs = targetFieldset.querySelectorAll('input:not([type="hidden"]), textarea, select');
            
            // Match inputs by position and copy values
            sourceInputs.forEach(function(sourceInput, index) {
                if (targetInputs[index]) {
                    targetInputs[index].value = sourceInput.value;
                    // Trigger change event
                    var event = new Event('input', { bubbles: true });
                    targetInputs[index].dispatchEvent(event);
                }
            });
        }
    }
    
    function renderCheckoutOptionsSection() {
        if (!formFields || checkoutOptions.length === 0) return;
        
        // Get subcategory data for surcharge and type
        var surcharge = 0;
        var subcategoryType = 'General';
        if (memberCategories && memberCategories.length > 0) {
            var category = memberCategories.find(function(c) {
                return c.name === selectedCategory;
            });
            if (category && category.subFees && category.subFees[selectedSubcategory]) {
                var subData = category.subFees[selectedSubcategory];
                if (subData.checkout_surcharge !== null && subData.checkout_surcharge !== undefined) {
                    var parsedSurcharge = parseFloat(subData.checkout_surcharge);
                    if (!isNaN(parsedSurcharge)) {
                        surcharge = parsedSurcharge;
                    }
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
        var labelText = surcharge > 0 
            ? 'Checkout Options (+' + surcharge.toFixed(2) + ' surcharge)' 
            : 'Checkout Options';
        label.innerHTML = '<span class="fieldset-label-text">' + labelText + '</span><span class="fieldset-label-required">*</span>';
        wrapper.appendChild(label);
        
        // Create checkout options using CheckoutOptionsComponent
        if (typeof CheckoutOptionsComponent !== 'undefined') {
            checkoutInstance = CheckoutOptionsComponent.create(wrapper, {
                checkoutOptions: checkoutOptions,
                currency: siteCurrency,
                surcharge: surcharge,
                isEvent: isEvent,
                calculatedDays: isEvent ? null : null, // Events: will update when dates selected
                baseId: 'member-create',
                groupName: 'member-create-checkout-option',
                onSelect: function(optionId, days, price) {
                    // Selection handler - can be used for validation
                }
            });
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
        submitBtn.disabled = !termsAgreed;
        actionsWrapper.appendChild(submitBtn);
        
        // Admin submit button (hidden by default)
        adminSubmitBtn = document.createElement('button');
        adminSubmitBtn.type = 'button';
        adminSubmitBtn.className = 'member-button-admin-submit';
        adminSubmitBtn.textContent = 'Admin: Submit Free';
        adminSubmitBtn.disabled = !termsAgreed;
        adminSubmitBtn.hidden = true;
        
        // Show admin button if user is admin
        if (currentUser && currentUser.isAdmin) {
            adminSubmitBtn.hidden = false;
        }
        
        actionsWrapper.appendChild(adminSubmitBtn);
        formFields.appendChild(actionsWrapper);
    }
    
    function updateSubmitButtonState() {
        var ready = termsAgreed;
        if (submitBtn) {
            submitBtn.disabled = !ready;
        }
        if (adminSubmitBtn) {
            adminSubmitBtn.disabled = !ready;
        }
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
            return { name: '', placeholder: '', options: [], fieldsetKey: '', key: '', type: '', min_length: 0, max_length: 500 };
        }
        var result = {
            name: '',
            placeholder: '',
            tooltip: '',
            options: [],
            fieldsetKey: '',
            key: '',
            type: '',
            min_length: 0,
            max_length: 500
        };
        
        if (field.name && typeof field.name === 'string') {
            result.name = field.name;
        }
        if (field.placeholder && typeof field.placeholder === 'string') {
            result.placeholder = field.placeholder;
        }
        if (field.tooltip && typeof field.tooltip === 'string') {
            result.tooltip = field.tooltip;
        } else if (field.fieldset_tooltip && typeof field.fieldset_tooltip === 'string') {
            result.tooltip = field.fieldset_tooltip;
        }
        if (Array.isArray(field.options)) {
            result.options = field.options;
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
        
        authForm.dataset.active = target;
        
        // Focus first field
        focusFirstField(isLogin ? loginPanel : registerPanel);
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
            
            var displayName = currentUser.name || currentUser.email || currentUser.username;
            getMessage('msg_auth_login_success', { name: displayName }, false).then(function(message) {
                if (message) {
                    ToastComponent.showSuccess(message);
                }
            });
            
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
        var nameInput = document.getElementById('member-register-name');
        var emailInput = document.getElementById('member-register-email');
        var passwordInput = document.getElementById('member-register-password');
        var confirmInput = document.getElementById('member-register-confirm');
        
        var name = nameInput ? nameInput.value.trim() : '';
        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        var confirm = confirmInput ? confirmInput.value : '';
        // Avatar is selected via 4-tile grid:
        // - pendingRegisterAvatarBlob: cropped/uploaded (preferred)
        // - pendingRegisterSiteUrl: chosen site avatar (we copy it into user's avatar file on submit)
        
        function showFieldError(messageKey, placeholders, focusEl) {
            getMessage(messageKey, placeholders || {}, false).then(function(message) {
                var text = message || ('Missing message: ' + messageKey);
                if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                    ToastComponent.showError(text);
                } else {
                    showStatus(text, { error: true });
                }
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

        // Basic email format check (server still validates too)
        if (email.indexOf('@') === -1 || email.indexOf('.') === -1) {
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
            formData.set('email', email);
            formData.set('password', password);
            formData.set('confirm', confirm);
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
                        var text = message || ('Missing message: ' + key);
                        if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                            ToastComponent.showError(text);
                        } else {
                            showStatus(text, { error: true });
                        }
                    });
                    return;
                }

                // Fallback only for unexpected server responses (should not happen once DB messages exist)
                getMessage('msg_auth_register_failed', {}, false).then(function(message) {
                    var text = message || 'Missing message: msg_auth_register_failed';
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(text);
                    } else {
                        showStatus(text, { error: true });
                    }
                });
                return;
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
    
    function buildUserObject(payload, fallbackEmail) {
        var emailRaw = typeof payload.email === 'string' ? payload.email.trim() : '';
        var email = emailRaw || fallbackEmail;
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
            email: email,
            emailNormalized: normalized,
            username: username,
            avatar: payload.avatar || payload.avatar_file || '',
            username_key: payload.username_key || '',
            type: isAdmin ? 'admin' : (payload.type || 'member'),
            isAdmin: isAdmin
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
            if (parsed && typeof parsed === 'object' && parsed.email) {
                currentUser = parsed;
                
                // Notify admin auth if user is admin
                if (currentUser.isAdmin && window.adminAuthManager) {
                    window.adminAuthManager.setAuthenticated(true, currentUser.username || currentUser.email);
                }
            }
        } catch (e) {
            console.warn('Failed to load session', e);
        }
    }

    /* --------------------------------------------------------------------------
       AVATAR HELPERS
       -------------------------------------------------------------------------- */
    
    function svgPlaceholder(letter) {
        var palette = ['#2e3a72', '#0ea5e9', '#f97316', '#14b8a6', '#a855f7'];
        var color = palette[letter.charCodeAt(0) % palette.length];
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="' + color + '"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="36" font-family="system-ui, sans-serif" fill="#ffffff">' + letter + '</text></svg>';
        try {
            return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        } catch (e) {
            return 'data:image/svg+xml;base64,' + btoa(svg);
        }
    }

    function createPlaceholder(name) {
        var trimmed = (name || '').trim();
        var initial = trimmed ? trimmed[0].toUpperCase() : 'U';
        return svgPlaceholder(initial);
    }

    function getAvatarSource(user) {
        if (!user) return createPlaceholder('');
        var raw = user.avatar ? String(user.avatar).trim() : '';
        if (raw) return resolveAvatarSrc(raw) || raw;
        return createPlaceholder(user.name || user.email || 'U');
    }

    /* --------------------------------------------------------------------------
       RENDER
       -------------------------------------------------------------------------- */
    
    function render() {
        if (!authForm) return;
        
        // Notify admin auth manager
        if (window.adminAuthManager) {
            if (currentUser && currentUser.isAdmin) {
                window.adminAuthManager.setAuthenticated(true, currentUser.username || currentUser.email || 'admin');
            } else {
                window.adminAuthManager.setAuthenticated(false);
            }
        }
        
        if (currentUser) {
            // Logged in state
            authForm.dataset.state = 'logged-in';
            
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
                var descriptor = currentUser.name || currentUser.email || 'Member';
                profileAvatar.dataset.fallbackApplied = '';
                profileAvatar.onerror = function() {
                    if (profileAvatar.dataset.fallbackApplied === '1') return;
                    profileAvatar.dataset.fallbackApplied = '1';
                    profileAvatar.src = createPlaceholder(descriptor);
                };
                profileAvatar.src = getAvatarSource(currentUser);
                profileAvatar.alt = descriptor + "'s avatar";
            }
            if (profileName) profileName.textContent = currentUser.name || 'Member';
            if (profileEmail) profileEmail.textContent = currentUser.email || '';
            
            // Profile edit defaults
            profileOriginalName = currentUser.name || '';
            if (profileEditNameInput) profileEditNameInput.value = profileOriginalName;
            if (profileEditPasswordInput) profileEditPasswordInput.value = '';
            if (profileEditConfirmInput) profileEditConfirmInput.value = '';
            profileOriginalAvatarUrl = currentUser.avatar ? String(currentUser.avatar) : '';
            pendingAvatarUrl = profileOriginalAvatarUrl;
            pendingProfileSiteUrl = '';
            pendingProfileAvatarPreviewUrl = '';
            pendingProfileAvatarBlob = null;
            avatarSelection.profile = 'self';
            updateProfileSaveState();
            renderAvatarGrids();
            
            // Hide auth tabs when logged in
            if (authTabs) authTabs.classList.add('member-auth-tabs--logged-in');
            
            // Update header avatar
            updateHeaderAvatar(currentUser);
            
            // Update profile tab label
            if (profileTabBtn) {
                profileTabBtn.textContent = 'Profile';
            }

            updateHeaderSaveDiscardState();
            
        } else {
            // Logged out state
            authForm.dataset.state = 'logged-out';
            
            // Update profile tab label
            if (profileTabBtn) {
                profileTabBtn.textContent = 'Log In';
            }
            
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
            avatarSelection.register = 'self';
            avatarSelection.profile = 'self';
            updateProfileSaveState();
            renderAvatarGrids();
            
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
        }
        
        // Update App state
        App.setState('user', currentUser);
        App.setState('isAdmin', currentUser ? currentUser.isAdmin === true : false);
        App.emit('member:stateChanged', { user: currentUser });
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
            // Show avatar, hide icon
            if (avatarImg) {
                avatarImg.src = getAvatarSource(user);
                avatarImg.classList.remove('header-access-button-avatar--hidden');
            }
            if (iconSpan) {
                iconSpan.classList.add('header-access-button-icon--hidden');
            }
            memberBtn.classList.add('has-avatar');
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
        statusMessage.classList.remove('member-status-message--error', 'member-status-message--show');
        
        if (options.error) {
            statusMessage.classList.add('member-status-message--error');
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
        showStatus: showStatus
    };

})();

// Register module with App
App.registerModule('member', MemberModule);

// Expose globally for consistency with other modules
window.MemberModule = MemberModule;

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
