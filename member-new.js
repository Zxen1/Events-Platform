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
       Copied from forms.js, using fieldset-menu classes from components-new.css
       -------------------------------------------------------------------------- */
    
    var formpickerLoaded = false;
    var memberSnapshot = null;
    var memberCategories = [];
    var selectedCategory = '';
    var selectedSubcategory = '';
    var formWrapper = null;
    var formFields = null;
    var postButton = null;
    var postActions = null;
    
    function loadFormpicker() {
        if (formpickerLoaded) return;
        
        var container = document.getElementById('member-formpicker-cats');
        if (!container) return;
        
        formWrapper = document.getElementById('member-create-form-wrapper');
        formFields = document.getElementById('member-create-fields');
        postButton = document.getElementById('member-create-post-btn');
        postActions = document.getElementById('member-create-actions');
        
        container.innerHTML = '<p class="member-create-intro">Loading categories...</p>';
        
        // Fetch form snapshot from database (same as forms.js)
        App.api('get-form').then(function(response) {
            if (response && response.success && response.snapshot) {
                memberSnapshot = response.snapshot;
                memberCategories = response.snapshot.categories || [];
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
        if (postButton) { postButton.disabled = true; postButton.hidden = true; }
        if (postActions) postActions.hidden = true;
        
        var categoryIconPaths = memberSnapshot.categoryIconPaths || {};
        var subcategoryIconPaths = memberSnapshot.subcategoryIconPaths || {};
        
        // Container for dropdowns
        var dropdownsContainer = document.createElement('div');
        dropdownsContainer.className = 'member-formpicker-dropdowns';
        
        // Subcategory dropdown (created first, shown after category selection)
        var subcategoryWrapper = document.createElement('div');
        subcategoryWrapper.className = 'member-panel-field';
        subcategoryWrapper.hidden = true;
        
        var subcategoryLabel = document.createElement('label');
        subcategoryLabel.className = 'member-panel-field-label';
        subcategoryLabel.textContent = 'Subcategory';
        
        var subcategoryMenu = document.createElement('div');
        subcategoryMenu.className = 'fieldset-menu';
        
        var subcategoryBtn = document.createElement('button');
        subcategoryBtn.type = 'button';
        subcategoryBtn.className = 'fieldset-menu-button';
        subcategoryBtn.innerHTML = '<span class="fieldset-menu-button-text">Select a subcategory</span><span class="fieldset-menu-button-arrow">▼</span>';
        
        var subcategoryOpts = document.createElement('div');
        subcategoryOpts.className = 'fieldset-menu-options';
        
        subcategoryMenu.appendChild(subcategoryBtn);
        subcategoryMenu.appendChild(subcategoryOpts);
        subcategoryWrapper.appendChild(subcategoryLabel);
        subcategoryWrapper.appendChild(subcategoryMenu);
        
        // Category dropdown
        var categoryWrapper = document.createElement('div');
        categoryWrapper.className = 'member-panel-field';
        
        var categoryLabel = document.createElement('label');
        categoryLabel.className = 'member-panel-field-label';
        categoryLabel.textContent = 'Category';
        
        var categoryMenu = document.createElement('div');
        categoryMenu.className = 'fieldset-menu';
        
        var categoryBtn = document.createElement('button');
        categoryBtn.type = 'button';
        categoryBtn.className = 'fieldset-menu-button';
        categoryBtn.innerHTML = '<span class="fieldset-menu-button-text">Select a category</span><span class="fieldset-menu-button-arrow">▼</span>';
        
        var categoryOpts = document.createElement('div');
        categoryOpts.className = 'fieldset-menu-options';
        
        // Populate category options
        memberCategories.forEach(function(cat) {
            if (!cat || typeof cat.name !== 'string') return;
            
            var optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'fieldset-menu-option';
            
            var iconPath = '';
            if (cat.id !== null && cat.id !== undefined) {
                var idKey = 'id:' + cat.id;
                if (categoryIconPaths[idKey]) iconPath = categoryIconPaths[idKey];
            }
            if (!iconPath && cat.name) {
                var nameKey = 'name:' + cat.name.toLowerCase();
                if (categoryIconPaths[nameKey]) iconPath = categoryIconPaths[nameKey];
            }
            
            if (iconPath) {
                var iconImg = document.createElement('img');
                iconImg.className = 'fieldset-menu-option-image';
                iconImg.src = iconPath;
                iconImg.alt = '';
                optionBtn.appendChild(iconImg);
            }
            
            var textSpan = document.createElement('span');
            textSpan.className = 'fieldset-menu-option-text';
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
                    btnIcon.className = 'fieldset-menu-button-image';
                    btnIcon.src = iconPath;
                    btnIcon.alt = '';
                    categoryBtn.appendChild(btnIcon);
                }
                var btnText = document.createElement('span');
                btnText.className = 'fieldset-menu-button-text';
                btnText.textContent = cat.name;
                categoryBtn.appendChild(btnText);
                var btnArrow = document.createElement('span');
                btnArrow.className = 'fieldset-menu-button-arrow';
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
                        subBtn.className = 'fieldset-menu-option';
                        
                        var subIconPath = '';
                        var subId = cat.subIds && cat.subIds[subName] ? cat.subIds[subName] : null;
                        if (subId !== null) {
                            var subIdKey = 'id:' + subId;
                            if (subcategoryIconPaths[subIdKey]) subIconPath = subcategoryIconPaths[subIdKey];
                        }
                        if (!subIconPath && subName) {
                            var subNameKey = 'name:' + subName.toLowerCase();
                            if (subcategoryIconPaths[subNameKey]) subIconPath = subcategoryIconPaths[subNameKey];
                        }
                        
                        if (subIconPath) {
                            var subIconImg = document.createElement('img');
                            subIconImg.className = 'fieldset-menu-option-image';
                            subIconImg.src = subIconPath;
                            subIconImg.alt = '';
                            subBtn.appendChild(subIconImg);
                        }
                        
                        var subTextSpan = document.createElement('span');
                        subTextSpan.className = 'fieldset-menu-option-text';
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
                                subBtnIcon.className = 'fieldset-menu-button-image';
                                subBtnIcon.src = subIconPath;
                                subBtnIcon.alt = '';
                                subcategoryBtn.appendChild(subBtnIcon);
                            }
                            var subBtnText = document.createElement('span');
                            subBtnText.className = 'fieldset-menu-button-text';
                            subBtnText.textContent = subName;
                            subcategoryBtn.appendChild(subBtnText);
                            var subBtnArrow = document.createElement('span');
                            subBtnArrow.className = 'fieldset-menu-button-arrow';
                            subBtnArrow.textContent = '▼';
                            subcategoryBtn.appendChild(subBtnArrow);
                            
                            subcategoryMenu.classList.remove('open');
                            selectedSubcategory = subName;
                            renderConfiguredFields();
                        });
                        
                        subcategoryOpts.appendChild(subBtn);
                    });
                    
                    subcategoryBtn.innerHTML = '<span class="fieldset-menu-button-text">Select a subcategory</span><span class="fieldset-menu-button-arrow">▼</span>';
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
            if (postButton) { postButton.disabled = true; postButton.hidden = true; }
            if (postActions) postActions.hidden = true;
            return;
        }
        
        // Get fields for this category/subcategory from snapshot
        var fields = getFieldsForSelection(selectedCategory, selectedSubcategory);
        
        if (formFields) formFields.innerHTML = '';
        
        if (fields.length === 0) {
            var placeholder = document.createElement('p');
            placeholder.className = 'member-create-intro';
            placeholder.textContent = 'No fields configured for this subcategory yet.';
            if (formFields) formFields.appendChild(placeholder);
        } else {
            // Render form using window.renderForm
            window.renderForm({
                formFields: formFields,
                formId: 'memberCreate',
                fields: fields,
                categoryName: selectedCategory,
                subcategoryName: selectedSubcategory,
                fieldIdCounter: 0,
                formLabel: 'Create Post',
                isUserForm: true
            });
        }
        
        if (formWrapper) formWrapper.hidden = false;
        if (postActions) postActions.hidden = false;
        if (postButton) { postButton.hidden = false; postButton.disabled = false; }
    }
    
    function getFieldsForSelection(categoryName, subcategoryName) {
        if (!memberSnapshot || !memberCategories) return [];
        
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
