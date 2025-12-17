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
       STATE
       -------------------------------------------------------------------------- */
    
    var currentUser = null;
    var lastAction = 'login';

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

    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        console.log('[Member] Initializing member module...');
        
        cacheElements();
        if (!panel) {
            console.warn('[Member] Member panel not found');
            return;
        }
        
        bindEvents();
        loadStoredSession();
        render();
        
        console.log('[Member] Member module initialized');
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
    }

    function bindEvents() {
        // Panel open/close
        if (closeBtn) {
            closeBtn.addEventListener('click', closePanel);
        }
        
        // Main tab switching (Profile / Create Post / My Posts)
        if (tabButtons) {
            tabButtons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    switchTab(btn.dataset.tab);
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
        
        // Form submission
        if (authForm) {
            authForm.addEventListener('submit', function(e) {
                e.preventDefault();
                var submitter = e.submitter || null;
                if (!submitter) {
                    var active = document.activeElement;
                    if (active && authForm.contains(active)) {
                        submitter = active;
                    }
                }
                var action = submitter && submitter.dataset.action ? submitter.dataset.action : lastAction;
                if (action === 'register') {
                    handleRegister();
                } else {
                    handleLogin();
                }
            });
        }
        
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleLogout();
            });
        }
        
        // Listen for header button click
        App.on('panel:toggle', function(data) {
            if (data.panel === 'member') {
                if (data.show) {
                    openPanel();
                } else {
                    closePanel();
                }
            }
        });
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
        
        // Update header button
        App.emit('member:opened');
    }

    function closePanel() {
        if (!panel || !panelContent) return;
        
        panelContent.classList.remove('member-panel-content--visible');
        panelContent.classList.add('member-panel-content--hidden');
        
        // Wait for transition to complete before hiding
        setTimeout(function() {
            if (panelContent.classList.contains('member-panel-content--hidden')) {
                panel.classList.remove('member-panel--show');
                panel.setAttribute('aria-hidden', 'true');
            }
        }, 300);
        
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
       -------------------------------------------------------------------------- */
    
    var formpickerLoaded = false;
    var categories = [];
    var selectedCategory = null;
    var selectedSubcategory = null;
    
    function loadFormpicker() {
        if (formpickerLoaded) return;
        
        var container = document.getElementById('member-formpicker-cats');
        if (!container) return;
        
        // Show loading
        container.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Loading categories...</p>';
        
        // Fetch categories from database
        App.api('get-categories').then(function(response) {
            if (response && response.categories) {
                categories = response.categories;
                renderFormpicker(container);
                formpickerLoaded = true;
            } else {
                container.innerHTML = '<p style="color: #ff6b6b;">Failed to load categories.</p>';
            }
        }).catch(function(err) {
            console.error('[Member] Failed to load categories:', err);
            container.innerHTML = '<p style="color: #ff6b6b;">Failed to load categories.</p>';
        });
    }
    
    function renderFormpicker(container) {
        container.innerHTML = '';
        
        // Category dropdown
        var catField = document.createElement('div');
        catField.className = 'member-panel-field';
        
        var catLabel = document.createElement('label');
        catLabel.className = 'member-panel-field-label';
        catLabel.textContent = 'Category';
        catField.appendChild(catLabel);
        
        var catMenu = createMenu({
            placeholder: 'Select a category...',
            options: categories.map(function(cat) {
                return {
                    value: cat.category_key || cat.id,
                    label: cat.category_name || cat.name,
                    image: cat.icon_path ? 'assets/icons-30/' + cat.icon_path : null
                };
            }),
            onSelect: function(value) {
                selectedCategory = categories.find(function(c) {
                    return (c.category_key || c.id) === value;
                });
                selectedSubcategory = null;
                updateSubcategoryMenu();
            }
        });
        catField.appendChild(catMenu);
        container.appendChild(catField);
        
        // Subcategory dropdown (initially hidden)
        var subField = document.createElement('div');
        subField.className = 'member-panel-field';
        subField.id = 'member-formpicker-sub-field';
        subField.style.display = 'none';
        
        var subLabel = document.createElement('label');
        subLabel.className = 'member-panel-field-label';
        subLabel.textContent = 'Subcategory';
        subField.appendChild(subLabel);
        
        var subMenuContainer = document.createElement('div');
        subMenuContainer.id = 'member-formpicker-sub-menu';
        subField.appendChild(subMenuContainer);
        container.appendChild(subField);
    }
    
    function updateSubcategoryMenu() {
        var subField = document.getElementById('member-formpicker-sub-field');
        var subMenuContainer = document.getElementById('member-formpicker-sub-menu');
        if (!subField || !subMenuContainer) return;
        
        if (!selectedCategory || !selectedCategory.subcategories || selectedCategory.subcategories.length === 0) {
            subField.style.display = 'none';
            return;
        }
        
        subMenuContainer.innerHTML = '';
        
        var subMenu = createMenu({
            placeholder: 'Select a subcategory...',
            options: selectedCategory.subcategories.map(function(sub) {
                return {
                    value: sub.subcategory_key || sub.id,
                    label: sub.subcategory_name || sub.name,
                    image: sub.icon_path ? 'assets/icons-30/' + sub.icon_path : null
                };
            }),
            onSelect: function(value) {
                selectedSubcategory = selectedCategory.subcategories.find(function(s) {
                    return (s.subcategory_key || s.id) === value;
                });
                loadSubcategoryForm();
            }
        });
        
        subMenuContainer.appendChild(subMenu);
        subField.style.display = '';
    }
    
    function loadSubcategoryForm() {
        var formWrapper = document.getElementById('member-create-form-wrapper');
        var fieldsContainer = document.getElementById('member-create-fields');
        if (!formWrapper || !fieldsContainer) return;
        
        if (!selectedSubcategory) {
            formWrapper.hidden = true;
            return;
        }
        
        // Show form wrapper
        formWrapper.hidden = false;
        fieldsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Loading form fields...</p>';
        
        // TODO: Load form fields from database using selectedSubcategory
        // For now, show placeholder
        fieldsContainer.innerHTML = '<p>Form for: ' + (selectedSubcategory.subcategory_name || selectedSubcategory.name) + '</p><p style="color: rgba(255,255,255,0.6);">(Form fields will be loaded here)</p>';
    }
    
    function createMenu(options) {
        var menu = document.createElement('div');
        menu.className = 'member-menu';
        
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'member-menu-button';
        
        var btnText = document.createElement('span');
        btnText.className = 'member-menu-button-text';
        btnText.textContent = options.placeholder || 'Select...';
        
        var btnArrow = document.createElement('span');
        btnArrow.className = 'member-menu-button-arrow';
        btnArrow.textContent = '▼';
        
        button.appendChild(btnText);
        button.appendChild(btnArrow);
        menu.appendChild(button);
        
        var optionsContainer = document.createElement('div');
        optionsContainer.className = 'member-menu-options';
        
        options.options.forEach(function(opt) {
            var option = document.createElement('button');
            option.type = 'button';
            option.className = 'member-menu-option';
            option.dataset.value = opt.value;
            
            if (opt.image) {
                var img = document.createElement('img');
                img.className = 'member-menu-option-image';
                img.src = opt.image;
                img.alt = '';
                option.appendChild(img);
            }
            
            var text = document.createElement('span');
            text.className = 'member-menu-option-text';
            text.textContent = opt.label;
            option.appendChild(text);
            
            option.addEventListener('click', function() {
                // Update button text
                btnText.textContent = opt.label;
                
                // Close menu
                menu.classList.remove('member-menu--open');
                
                // Mark selected
                optionsContainer.querySelectorAll('.member-menu-option').forEach(function(o) {
                    o.classList.remove('member-menu-option--selected');
                });
                option.classList.add('member-menu-option--selected');
                
                // Callback
                if (typeof options.onSelect === 'function') {
                    options.onSelect(opt.value);
                }
            });
            
            optionsContainer.appendChild(option);
        });
        
        menu.appendChild(optionsContainer);
        
        // Toggle menu on button click
        button.addEventListener('click', function(e) {
            e.preventDefault();
            menu.classList.toggle('member-menu--open');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) {
                menu.classList.remove('member-menu--open');
            }
        });
        
        return menu;
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
        lastAction = target;
        
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
        var emailInput = document.getElementById('member-login-email');
        var passwordInput = document.getElementById('member-login-password');
        
        var username = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        
        if (!username || !password) {
            showStatus('Please enter email and password', { error: true });
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
                showStatus('Invalid email or password', { error: true });
                if (passwordInput) {
                    passwordInput.focus();
                    passwordInput.select();
                }
                return;
            }
            
            // Build user object from response
            var payload = result.user || {};
            currentUser = buildUserObject(payload, username);
            
            storeCurrent(currentUser);
            render();
            
            var displayName = currentUser.name || currentUser.email || currentUser.username;
            showStatus('Welcome back, ' + displayName);
            
        }).catch(function(err) {
            console.error('Login failed', err);
            showStatus('Login failed. Please try again.', { error: true });
        });
    }

    function handleRegister() {
        var nameInput = document.getElementById('member-register-name');
        var emailInput = document.getElementById('member-register-email');
        var passwordInput = document.getElementById('member-register-password');
        var confirmInput = document.getElementById('member-register-confirm');
        var avatarInput = document.getElementById('member-register-avatar');
        
        var name = nameInput ? nameInput.value.trim() : '';
        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';
        var confirm = confirmInput ? confirmInput.value : '';
        var avatar = avatarInput ? avatarInput.value.trim() : '';
        
        // Validation
        if (!name || !email || !password) {
            showStatus('Please fill in all required fields', { error: true });
            if (!name && nameInput) { nameInput.focus(); return; }
            if (!email && emailInput) { emailInput.focus(); return; }
            if (!password && passwordInput) { passwordInput.focus(); return; }
            return;
        }
        
        if (password.length < 4) {
            showStatus('Password must be at least 4 characters', { error: true });
            if (passwordInput) passwordInput.focus();
            return;
        }
        
        if (password !== confirm) {
            showStatus('Passwords do not match', { error: true });
            if (confirmInput) {
                confirmInput.focus();
                confirmInput.select();
            }
            return;
        }
        
        // Send registration request
        var formData = new FormData();
        formData.set('display_name', name);
        formData.set('email', email);
        formData.set('password', password);
        formData.set('confirm', confirm);
        formData.set('avatar_url', avatar);
        
        fetch('/gateway.php?action=add-member', {
            method: 'POST',
            body: formData
        }).then(function(response) {
            return response.text();
        }).then(function(text) {
            var payload = null;
            try {
                payload = JSON.parse(text);
            } catch (e) {
                payload = null;
            }
            
            if (!payload || payload.error) {
                var errorMsg = payload && payload.message ? payload.message : 'Registration failed';
                showStatus(errorMsg, { error: true });
                return;
            }
            
            // Build user object
            currentUser = {
                id: payload.id || null,
                name: name,
                email: email,
                emailNormalized: email.toLowerCase(),
                username: email,
                avatar: avatar,
                type: 'member',
                isAdmin: false
            };
            
            storeCurrent(currentUser);
            render();
            showStatus('Account created! Welcome, ' + name);
            
        }).catch(function(err) {
            console.error('Registration failed', err);
            showStatus('Registration failed. Please try again.', { error: true });
        });
    }

    function handleLogout() {
        currentUser = null;
        storeCurrent(null);
        render();
        showStatus('You have been logged out');
        
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
        var formData = new FormData();
        formData.set('username', username);
        formData.set('password', password);
        
        return fetch('/gateway.php?action=verify-login', {
            method: 'POST',
            body: formData
        }).then(function(response) {
            return response.json();
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
        
        // Check for admin status
        var isAdmin = false;
        if (payload.isAdmin === true) {
            isAdmin = true;
        } else if (payload.role === 'admin') {
            isAdmin = true;
        } else if (Array.isArray(payload.roles) && payload.roles.includes('admin')) {
            isAdmin = true;
        } else if (normalized === 'admin' || username.toLowerCase() === 'admin') {
            isAdmin = true;
        }
        
        return {
            id: payload.id || payload.user_id || null,
            name: payload.name || payload.display_name || '',
            email: email,
            emailNormalized: normalized,
            username: username,
            avatar: payload.avatar || payload.avatar_url || '',
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
        if (raw) return raw;
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
            
            // Hide auth tabs when logged in
            if (authTabs) authTabs.classList.add('member-auth-tabs--logged-in');
            
            // Update header avatar
            updateHeaderAvatar(currentUser);
            
            lastAction = 'login';
            
        } else {
            // Logged out state
            authForm.dataset.state = 'logged-out';
            
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
            
            // Show auth tabs
            if (authTabs) authTabs.classList.remove('member-auth-tabs--logged-in');
            
            // Show appropriate auth panel
            var active = authForm.dataset.active === 'register' ? 'register' : 'login';
            setAuthPanel(active);
            
            // Clear inputs
            clearInputs(loginInputs);
            clearInputs(registerInputs);
            
            // Update header (no avatar)
            updateHeaderAvatar(null);
        }
        
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
                iconSpan.style.display = 'none';
            }
            memberBtn.classList.add('has-avatar');
        } else {
            // Hide avatar, show icon
            if (avatarImg) {
                avatarImg.removeAttribute('src');
                avatarImg.classList.add('header-access-button-avatar--hidden');
            }
            if (iconSpan) {
                iconSpan.style.display = '';
            }
            memberBtn.classList.remove('has-avatar');
        }
    }

    /* --------------------------------------------------------------------------
       STATUS MESSAGES
       -------------------------------------------------------------------------- */
    
    function showStatus(message, options) {
        options = options || {};
        // TODO: Implement status message display
        console.log('[Member]', options.error ? 'Error:' : 'Status:', message);
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
        isAdmin: function() { return currentUser && currentUser.isAdmin === true; }
    };

})();

// Register module with App
App.registerModule('member', MemberModule);
