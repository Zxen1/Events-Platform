/* ============================================================================
   POST EDITOR MODULE - Member Panel > My Posts Tab
   Post listing, editing, and management for member's own posts.
   ============================================================================
   
   PATTERN:
   This module follows the FormbuilderModule pattern - it owns an entire tab
   within a parent panel. MemberModule calls PostEditorModule.init() when
   the My Posts tab is activated.
   
   DEPENDENCIES:
   - MemberModule: currentUser, memberCategories, ensureCategoriesLoaded,
                   getFieldsForSelection, ensureFieldDefaults, 
                   getDefaultCurrencyForForms, submitPostData,
                   extractFieldValue, showStatus, updateHeaderSaveDiscardState
   - FormbuilderModule: organizeFieldsIntoLocationContainers
   - FieldsetBuilder: buildFieldset
   - PostModule: renderPostCard, closePost
   - ToastComponent, ConfirmDialogComponent: UI feedback
   
   ============================================================================ */

(function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var container = null;  // #member-tab-myposts
    var isLoaded = false;
    var editingPostsData = {};      // { [postId]: { original: postObj, current: {}, original_extracted_fields: [] } }
    var expandedPostAccordions = {}; // { [postId]: boolean }

    /* --------------------------------------------------------------------------
       HELPERS
       -------------------------------------------------------------------------- */
    
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Strip label prefix from custom field values.
     * Database stores "Label: value" for display, but editor needs just "value".
     * Returns the portion after the first ": " or the original string if no prefix.
     */
    function stripLabelPrefix(str) {
        if (!str || typeof str !== 'string') return str;
        var colonIdx = str.indexOf(': ');
        if (colonIdx > 0 && colonIdx < 50) { // Reasonable label length limit
            return str.substring(colonIdx + 2);
        }
        return str;
    }

    /**
     * Strip label prefix from comma-separated custom field values (checklist).
     * Database stores "Label: item1, item2, item3" for display.
     * Returns array of items.
     */
    function parseChecklistValue(str) {
        if (!str || typeof str !== 'string') return [];
        var stripped = stripLabelPrefix(str);
        if (!stripped) return [];
        return stripped.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s !== ''; });
    }

    function getMember() {
        return window.MemberModule || null;
    }

    function getCurrentUser() {
        var m = getMember();
        return m && typeof m.getCurrentUser === 'function' ? m.getCurrentUser() : null;
    }

    function getMemberCategories() {
        var m = getMember();
        return m && typeof m.getMemberCategories === 'function' ? m.getMemberCategories() : [];
    }

    function ensureCategoriesLoaded() {
        var m = getMember();
        if (m && typeof m.ensureCategoriesLoaded === 'function') {
            return m.ensureCategoriesLoaded();
        }
        return Promise.resolve();
    }

    function getFieldsForSelection(categoryName, subcategoryName) {
        var m = getMember();
        if (m && typeof m.getFieldsForSelection === 'function') {
            return m.getFieldsForSelection(categoryName, subcategoryName);
        }
        return [];
    }

    function ensureFieldDefaults(fieldData) {
        var m = getMember();
        if (m && typeof m.ensureFieldDefaults === 'function') {
            return m.ensureFieldDefaults(fieldData);
        }
        return fieldData;
    }

    function getDefaultCurrencyForForms() {
        var m = getMember();
        if (m && typeof m.getDefaultCurrencyForForms === 'function') {
            return m.getDefaultCurrencyForForms();
        }
        return 'USD';
    }

    function submitPostData(payload, isNew, imageFiles, imagesMeta) {
        var m = getMember();
        if (m && typeof m.submitPostData === 'function') {
            return m.submitPostData(payload, isNew, imageFiles, imagesMeta);
        }
        return Promise.reject(new Error('MemberModule.submitPostData not available'));
    }

    function extractFieldValue(el, fieldType) {
        var m = getMember();
        if (m && typeof m.extractFieldValue === 'function') {
            return m.extractFieldValue(el, fieldType);
        }
        return '';
    }

    function showStatus(message, opts) {
        var m = getMember();
        if (m && typeof m.showStatus === 'function') {
            m.showStatus(message, opts);
        }
    }

    function updateHeaderSaveDiscardState() {
        var m = getMember();
        if (m && typeof m.updateHeaderSaveDiscardState === 'function') {
            m.updateHeaderSaveDiscardState();
        }
    }

    /* --------------------------------------------------------------------------
       LOADING PLACEHOLDER (shown while post is being created)
       -------------------------------------------------------------------------- */
    
    function showLoadingPlaceholder(payload) {
        if (!container) return;
        
        // Get title from payload fields
        var title = '';
        if (payload && payload.fields && Array.isArray(payload.fields)) {
            for (var i = 0; i < payload.fields.length; i++) {
                var f = payload.fields[i];
                if (f && f.key === 'title' && f.value) {
                    title = String(f.value);
                    break;
                }
            }
        }
        if (!title) title = 'New Post';
        
        // Create placeholder card
        var placeholder = document.createElement('div');
        placeholder.className = 'posteditor-placeholder';
        placeholder.id = 'posteditor-uploading';
        placeholder.innerHTML = 
            '<div class="posteditor-placeholder-card">' +
                '<div class="posteditor-placeholder-overlay">' +
                    '<div class="posteditor-placeholder-spinner"></div>' +
                    '<div class="posteditor-placeholder-text">Uploading...</div>' +
                '</div>' +
                '<div class="posteditor-placeholder-title">' + escapeHtml(title) + '</div>' +
            '</div>';
        
        // Insert at top of My Posts panel
        container.insertBefore(placeholder, container.firstChild);
    }
    
    function updateLoadingPlaceholder(status, result) {
        var placeholder = document.getElementById('posteditor-uploading');
        if (!placeholder) return;
        
        var overlay = placeholder.querySelector('.posteditor-placeholder-overlay');
        if (!overlay) return;
        
        if (status === 'success') {
            // Show success state briefly then remove
            overlay.innerHTML = 
                '<div class="posteditor-placeholder-check">✓</div>' +
                '<div class="posteditor-placeholder-text">Posted!</div>';
            placeholder.classList.add('posteditor-placeholder--success');
            
            // Remove after a short delay and refresh the list
            setTimeout(function() {
                if (placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }
                loadPosts();
            }, 2000);
        } else {
            // Show error state
            overlay.innerHTML = 
                '<div class="posteditor-placeholder-error">✕</div>' +
                '<div class="posteditor-placeholder-text">Failed</div>';
            placeholder.classList.add('posteditor-placeholder--error');
            
            // Remove after a longer delay so user can see the error
            setTimeout(function() {
                if (placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }
            }, 4000);
        }
    }

    /* --------------------------------------------------------------------------
       POST LIST
       -------------------------------------------------------------------------- */
    
    function loadPosts() {
        var user = getCurrentUser();
        if (!container || !user) return;
        
        // Show loading state if empty
        if (container.innerHTML === '') {
            container.innerHTML = '<p class="posteditor-status">Loading your posts...</p>';
        }
        
        var memberId = parseInt(user.id, 10);
        if (!memberId) return;

        fetch('/gateway.php?action=get-posts&member_id=' + memberId)
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res && res.success && Array.isArray(res.posts)) {
                    renderPosts(res.posts);
                } else {
                    container.innerHTML = '<p class="posteditor-status">You haven\'t created any posts yet.</p>';
                }
            })
            .catch(function(err) {
                console.error('[PostEditor] Failed to load posts:', err);
                container.innerHTML = '<p class="posteditor-status posteditor-status--error">Failed to load posts.</p>';
            });
    }

    function renderPosts(posts) {
        if (!container) return;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="posteditor-status">You haven\'t created any posts yet.</p>';
            return;
        }

        // Keep the uploading placeholder if it exists
        var placeholder = document.getElementById('posteditor-uploading');
        container.innerHTML = '';
        if (placeholder) {
            container.appendChild(placeholder);
        }

        posts.forEach(function(post) {
            var card = renderPostCard(post);
            container.appendChild(card);
        });
    }

    function refreshPostCard(postId) {
        // Find the existing post container
        var postContainer = document.querySelector('.posteditor-item[data-post-id="' + postId + '"]');
        if (!postContainer) return;
        
        // Fetch fresh post data
        fetch('/gateway.php?action=get-posts&full=1&post_id=' + postId)
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res && res.success && res.posts && res.posts.length > 0) {
                    var post = res.posts[0];
                    
                    // Find the old card element (first child that's a post-card)
                    var oldCard = postContainer.querySelector('.post-card');
                    if (!oldCard) return;
                    
                    // Create new card using PostModule
                    var newCard = null;
                    if (window.PostModule && typeof PostModule.renderPostCard === 'function') {
                        newCard = PostModule.renderPostCard(post);
                    } else {
                        newCard = document.createElement('div');
                        newCard.className = 'post-card';
                        var fallbackTitle = post.checkout_title || 'Post #' + post.id;
                        if (fallbackTitle === 'Array') fallbackTitle = 'Post #' + post.id;
                        newCard.textContent = fallbackTitle;
                    }
                    
                    // Prevent postcard from opening when edit/manage accordion is active
                    newCard.addEventListener('click', function(e) {
                        var editAcc = postContainer.querySelector('.posteditor-edit-accordion');
                        var manageAcc = postContainer.querySelector('.posteditor-manage-accordion');
                        var editActive = editAcc && !editAcc.hidden;
                        var manageActive = manageAcc && manageAcc.dataset.expanded === 'true';
                        if (editActive || manageActive) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }, true);
                    
                    // Replace old card with new one
                    oldCard.parentNode.replaceChild(newCard, oldCard);
                    
                    // Update cached data
                    if (editingPostsData[postId]) {
                        editingPostsData[postId].original = post;
                    }
                }
            })
            .catch(function(err) {
                console.warn('[PostEditor] Failed to refresh post card:', err);
            });
    }

    function renderPostCard(post) {
        // Reuse PostModule's rendering logic with buttons underneath
        var postContainer = document.createElement('div');
        postContainer.className = 'posteditor-item';
        postContainer.dataset.postId = post.id;
        
        // Use PostModule if available, otherwise fallback to simple display
        var cardEl = null;
        if (window.PostModule && typeof PostModule.renderPostCard === 'function') {
            cardEl = PostModule.renderPostCard(post);
        } else {
            cardEl = document.createElement('div');
            cardEl.className = 'post-card';
            var fallbackTitle = post.checkout_title || 'Post #' + post.id;
            if (fallbackTitle === 'Array') fallbackTitle = 'Post #' + post.id;
            cardEl.textContent = fallbackTitle;
        }

        // Prevent postcard from opening into a post when edit/manage accordion is active
        cardEl.addEventListener('click', function(e) {
            var editAcc = postContainer.querySelector('.posteditor-edit-accordion');
            var manageAcc = postContainer.querySelector('.posteditor-manage-accordion');
            var editActive = editAcc && !editAcc.hidden;
            var manageActive = manageAcc && manageAcc.dataset.expanded === 'true';
            if (editActive || manageActive) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true); // Use capture phase to intercept before PostModule's handler

        postContainer.appendChild(cardEl);

        // Create button row underneath the card
        var buttonRow = document.createElement('div');
        buttonRow.className = 'posteditor-buttons';

        // Edit Button
        var editBtn = document.createElement('button');
        editBtn.className = 'posteditor-button-edit button-class-2';
        editBtn.title = 'Edit Post Content';
        editBtn.textContent = 'Edit';
        editBtn.setAttribute('aria-selected', 'false');
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Collapse post to postcard if expanded
            if (window.PostModule && typeof PostModule.closePost === 'function') {
                PostModule.closePost(post.id);
            }
            togglePostEdit(post.id, postContainer);
        });

        // Manage Button
        var manageBtn = document.createElement('button');
        manageBtn.className = 'posteditor-button-manage button-class-2';
        manageBtn.title = 'Manage Plan & Time';
        manageBtn.textContent = 'Manage';
        manageBtn.setAttribute('aria-selected', 'false');
        manageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Collapse post to postcard if expanded
            if (window.PostModule && typeof PostModule.closePost === 'function') {
                PostModule.closePost(post.id);
            }
            togglePostManage(post.id, postContainer);
        });

        buttonRow.appendChild(editBtn);
        buttonRow.appendChild(manageBtn);
        postContainer.appendChild(buttonRow);

        // Add accordion container for editing content
        var editAccordion = document.createElement('div');
        editAccordion.className = 'posteditor-edit-accordion posteditor-edit-accordion--hidden';
        editAccordion.hidden = true;
        postContainer.appendChild(editAccordion);

        // Add accordion container for management (plans, time, etc.)
        var manageAccordion = document.createElement('div');
        manageAccordion.className = 'posteditor-manage-accordion posteditor-manage-accordion--hidden';
        manageAccordion.hidden = true;
        postContainer.appendChild(manageAccordion);

        return postContainer;
    }

    /* --------------------------------------------------------------------------
       MANAGE ACCORDION
       -------------------------------------------------------------------------- */
    
    function togglePostManage(postId, postContainer) {
        if (!postId || !postContainer) return;
        
        var accordion = postContainer.querySelector('.posteditor-manage-accordion');
        if (!accordion) return;

        var editBtn = postContainer.querySelector('.posteditor-button-edit');
        var manageBtn = postContainer.querySelector('.posteditor-button-manage');

        // Close all other posts' accordions first and reset their button states
        document.querySelectorAll('.posteditor-item').forEach(function(item) {
            if (item === postContainer) return;
            var otherEdit = item.querySelector('.posteditor-edit-accordion');
            var otherManage = item.querySelector('.posteditor-manage-accordion');
            var otherEditBtn = item.querySelector('.posteditor-button-edit');
            var otherManageBtn = item.querySelector('.posteditor-button-manage');
            if (otherEdit && !otherEdit.hidden) {
                otherEdit.hidden = true;
                otherEdit.classList.add('posteditor-edit-accordion--hidden');
                item.classList.remove('posteditor-item--editing');
                if (otherEditBtn) otherEditBtn.setAttribute('aria-selected', 'false');
                var otherId = item.dataset.postId;
                if (otherId) expandedPostAccordions[otherId] = false;
            }
            if (otherManage && !otherManage.hidden) {
                otherManage.hidden = true;
                otherManage.classList.add('posteditor-manage-accordion--hidden');
                otherManage.dataset.expanded = 'false';
                item.classList.remove('posteditor-item--managing');
                if (otherManageBtn) otherManageBtn.setAttribute('aria-selected', 'false');
            }
        });

        // If edit accordion is open, close it and reset edit button
        var editAcc = postContainer.querySelector('.posteditor-edit-accordion');
        if (editAcc && !editAcc.hidden) {
            editAcc.hidden = true;
            editAcc.classList.add('posteditor-edit-accordion--hidden');
            postContainer.classList.remove('posteditor-item--editing');
            expandedPostAccordions[postId] = false;
            if (editBtn) editBtn.setAttribute('aria-selected', 'false');
        }

        var isExpanded = accordion.dataset.expanded === 'true';
        
        if (isExpanded) {
            accordion.hidden = true;
            accordion.classList.add('posteditor-manage-accordion--hidden');
            accordion.dataset.expanded = 'false';
            postContainer.classList.remove('posteditor-item--managing');
            if (manageBtn) manageBtn.setAttribute('aria-selected', 'false');
        } else {
            // Render placeholder management UI if empty
            if (accordion.innerHTML === '') {
                renderManagePlaceholder(postId, accordion);
            }
            accordion.hidden = false;
            accordion.classList.remove('posteditor-manage-accordion--hidden');
            accordion.dataset.expanded = 'true';
            postContainer.classList.add('posteditor-item--managing');
            if (manageBtn) manageBtn.setAttribute('aria-selected', 'true');
        }
    }

    function renderManagePlaceholder(postId, accordionContainer) {
        accordionContainer.innerHTML = [
            '<div class="posteditor-manage-content">',
                '<div class="posteditor-manage-section">',
                    '<div class="member-panel-label">Extend Listing Time</div>',
                    '<div class="posteditor-manage-row">',
                        '<p class="member-supporter-message">Your post is currently active. You can add extra time to your listing below.</p>',
                        '<button class="button-class-2c" style="width:100%">Add 30 Days (Placeholder)</button>',
                    '</div>',
                '</div>',
                '<div class="posteditor-manage-section" style="margin-top:15px">',
                    '<div class="member-panel-label">Change Plan</div>',
                    '<div class="posteditor-manage-row">',
                        '<p class="member-supporter-message">Current Plan: Basic. Upgrade to Premium for higher visibility and map priority.</p>',
                        '<button class="button-class-2b" style="width:100%">Upgrade Plan (Placeholder)</button>',
                    '</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    /* --------------------------------------------------------------------------
       EDIT ACCORDION
       -------------------------------------------------------------------------- */
    
    function togglePostEdit(postId, postContainer) {
        if (!postId || !postContainer) return;
        
        var accordion = postContainer.querySelector('.posteditor-edit-accordion');
        if (!accordion) return;

        var editBtn = postContainer.querySelector('.posteditor-button-edit');
        var manageBtn = postContainer.querySelector('.posteditor-button-manage');
        
        var isExpanded = expandedPostAccordions[postId];
        
        // Helper to perform the collapse
        function doCollapse() {
            accordion.hidden = true;
            accordion.classList.add('posteditor-edit-accordion--hidden');
            postContainer.classList.remove('posteditor-item--editing');
            expandedPostAccordions[postId] = false;
            if (editBtn) editBtn.setAttribute('aria-selected', 'false');
            discardEdits(postId);
        }
        
        // Helper to close other posts' accordions
        function closeOtherAccordions() {
            document.querySelectorAll('.posteditor-item').forEach(function(item) {
                if (item === postContainer) return;
                var otherEdit = item.querySelector('.posteditor-edit-accordion');
                var otherManage = item.querySelector('.posteditor-manage-accordion');
                var otherEditBtn = item.querySelector('.posteditor-button-edit');
                var otherManageBtn = item.querySelector('.posteditor-button-manage');
                if (otherEdit && !otherEdit.hidden) {
                    otherEdit.hidden = true;
                    otherEdit.classList.add('posteditor-edit-accordion--hidden');
                    item.classList.remove('posteditor-item--editing');
                    if (otherEditBtn) otherEditBtn.setAttribute('aria-selected', 'false');
                    var otherId = item.dataset.postId;
                    if (otherId) {
                        expandedPostAccordions[otherId] = false;
                        discardEdits(otherId);
                    }
                }
                if (otherManage && !otherManage.hidden) {
                    otherManage.hidden = true;
                    otherManage.classList.add('posteditor-manage-accordion--hidden');
                    otherManage.dataset.expanded = 'false';
                    item.classList.remove('posteditor-item--managing');
                    if (otherManageBtn) otherManageBtn.setAttribute('aria-selected', 'false');
                }
            });
        }
        
        // Helper to close manage accordion
        function closeManageAccordion() {
            var manageAcc = postContainer.querySelector('.posteditor-manage-accordion');
            if (manageAcc && !manageAcc.hidden) {
                manageAcc.hidden = true;
                manageAcc.classList.add('posteditor-manage-accordion--hidden');
                manageAcc.dataset.expanded = 'false';
                postContainer.classList.remove('posteditor-item--managing');
                if (manageBtn) manageBtn.setAttribute('aria-selected', 'false');
            }
        }
        
        // Check if any other post has unsaved changes before closing them
        function checkOtherDirtyPosts() {
            var dirtyOtherPost = null;
            document.querySelectorAll('.posteditor-item').forEach(function(item) {
                if (item === postContainer) return;
                var otherId = item.dataset.postId;
                if (otherId && isPostDirty(otherId)) {
                    dirtyOtherPost = otherId;
                }
            });
            return dirtyOtherPost;
        }
        
        if (isExpanded) {
            // Collapsing - check for unsaved changes
            if (isPostDirty(postId)) {
                if (!window.ConfirmDialogComponent || typeof ConfirmDialogComponent.show !== 'function') {
                    doCollapse();
                    return;
                }
                ConfirmDialogComponent.show({
                    titleText: 'Discard Changes',
                    messageText: 'Are you sure you want to discard your changes?',
                    confirmLabel: 'Discard',
                    cancelLabel: 'Cancel',
                    focusCancel: true,
                    confirmClass: 'danger'
                }).then(function(confirmed) {
                    if (confirmed) {
                        doCollapse();
                    }
                });
                return;
            }
            doCollapse();
        } else {
            // Expanding - check if any other post has unsaved changes first
            var dirtyOther = checkOtherDirtyPosts();
            
            function proceedWithExpand() {
                closeOtherAccordions();
                closeManageAccordion();
                
                // Check if we need to load data first
                if (editingPostsData[postId]) {
                    accordion.hidden = false;
                    accordion.classList.remove('posteditor-edit-accordion--hidden');
                    postContainer.classList.add('posteditor-item--editing');
                    expandedPostAccordions[postId] = true;
                    if (editBtn) editBtn.setAttribute('aria-selected', 'true');
                } else {
                    showStatus('Loading post data...', { success: true });
                    
                    // Ensure categories are loaded before fetching post data
                    ensureCategoriesLoaded().then(function() {
                        return fetch('/gateway.php?action=get-posts&full=1&post_id=' + postId);
                    })
                    .then(function(r) { return r.json(); })
                    .then(function(res) {
                        if (res && res.success && res.posts && res.posts.length > 0) {
                            var post = res.posts[0];
                            editingPostsData[postId] = { original: post, current: {} };
                            renderEditForm(post, accordion);
                            accordion.hidden = false;
                            accordion.classList.remove('posteditor-edit-accordion--hidden');
                            postContainer.classList.add('posteditor-item--editing');
                            expandedPostAccordions[postId] = true;
                            if (editBtn) editBtn.setAttribute('aria-selected', 'true');
                            showStatus('Post data loaded.', { success: true });
                        } else {
                            showStatus('Failed to load post data.', { error: true });
                        }
                    })
                    .catch(function(err) {
                        console.error('[PostEditor] Failed to fetch post for edit:', err);
                        showStatus('Failed to load post data.', { error: true });
                    });
                }
            }
            
            if (dirtyOther) {
                // Another post has unsaved changes - ask before closing it
                if (!window.ConfirmDialogComponent || typeof ConfirmDialogComponent.show !== 'function') {
                    proceedWithExpand();
                    return;
                }
                ConfirmDialogComponent.show({
                    titleText: 'Discard Changes',
                    messageText: 'Another post has unsaved changes. Discard those changes?',
                    confirmLabel: 'Discard',
                    cancelLabel: 'Cancel',
                    focusCancel: true,
                    confirmClass: 'danger'
                }).then(function(confirmed) {
                    if (confirmed) {
                        proceedWithExpand();
                    }
                });
            } else {
                proceedWithExpand();
            }
        }
    }

    function renderEditForm(post, accordionContainer) {
        if (!post || !accordionContainer) return;
        
        var memberCategories = getMemberCategories();
        
        // 1. Resolve category and subcategory
        var categoryName = '';
        var subcategoryName = '';
        
        for (var i = 0; i < memberCategories.length; i++) {
            var cat = memberCategories[i];
            if (cat.subs) {
                for (var j = 0; j < cat.subs.length; j++) {
                    var sub = cat.subs[j];
                    var subKey = (typeof sub === 'string') ? sub : (sub && sub.name);
                    var feeInfo = cat && cat.subFees && cat.subFees[subKey];
                    var key = feeInfo && feeInfo.subcategory_key ? String(feeInfo.subcategory_key) : '';
                    if (key === post.subcategory_key) {
                        categoryName = cat.name;
                        subcategoryName = subKey;
                        break;
                    }
                }
            }
            if (categoryName) break;
        }
        
        if (!categoryName || !subcategoryName) {
            accordionContainer.innerHTML = '<p class="posteditor-status--error">This post uses a category that is no longer available.</p>';
            return;
        }

        // 2. Render fields into container
        var fields = getFieldsForSelection(categoryName, subcategoryName);
        accordionContainer.innerHTML = '';
        
        if (fields.length === 0) {
            accordionContainer.innerHTML = '<p class="posteditor-status">No fields configured for this subcategory yet.</p>';
            return;
        }

        // 3. Load component data FIRST, then build form structure
        // This ensures currency/age-rating/amenities menus have data when built
        var loadPromises = [];
        if (window.FieldsetBuilder && typeof FieldsetBuilder.loadFromDatabase === 'function' && !FieldsetBuilder.isLoaded()) {
            loadPromises.push(FieldsetBuilder.loadFromDatabase());
        }
        if (window.AgeRatingComponent && typeof AgeRatingComponent.loadFromDatabase === 'function' && !AgeRatingComponent.isLoaded()) {
            loadPromises.push(AgeRatingComponent.loadFromDatabase());
        }
        if (window.CurrencyComponent && typeof CurrencyComponent.loadFromDatabase === 'function' && !CurrencyComponent.isLoaded()) {
            loadPromises.push(CurrencyComponent.loadFromDatabase());
        }
        
        Promise.all(loadPromises).then(function() {
            if (!window.FormbuilderModule || typeof FormbuilderModule.organizeFieldsIntoLocationContainers !== 'function') {
                return;
            }
            
            var locationData = FormbuilderModule.organizeFieldsIntoLocationContainers({
                fields: fields,
                container: accordionContainer,
                buildFieldset: function(fieldData, options) {
                    var field = ensureFieldDefaults(fieldData);
                    return FieldsetBuilder.buildFieldset(field, {
                        idPrefix: 'editPost' + post.id,
                        fieldIndex: options.fieldIndex || 0,
                        container: options.container,
                        defaultCurrency: getDefaultCurrencyForForms(),
                        postId: post.id  // For images basket (edit mode)
                    });
                },
                initialQuantity: (post.map_cards && post.map_cards.length) || 1,
                getMessage: function(key, params, fallback) {
                    return typeof window.getMessage === 'function' ? window.getMessage(key, params, fallback) : Promise.resolve(null);
                },
                setupHeaderRenaming: true
            });
            
            // Populate with post data
            populateWithPostData(post, accordionContainer);
            
            // Renumber location containers and update headers (scoped to this post's accordion)
            renumberLocationContainersInAccordion(accordionContainer);
            
            // Store initial extracted fields for dirty checking (must happen after populate)
            editingPostsData[post.id].original_extracted_fields = collectFormData(accordionContainer, post);

            // 4. Add Save and Discard buttons at the bottom of the accordion
            var footer = document.createElement('div');
            footer.className = 'posteditor-edit-footer';
            
            // Save button (green) - left - starts disabled
            var saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'posteditor-edit-button-save button-class-2c';
            saveBtn.textContent = 'Save';
            saveBtn.disabled = true;
            saveBtn.addEventListener('click', function() {
                if (saveBtn.disabled) return;
                var postContainer = accordionContainer.closest('.posteditor-item');
                savePost(post.id).then(function() {
                    if (window.ToastComponent && typeof ToastComponent.showSuccess === 'function') {
                        ToastComponent.showSuccess('Saved');
                    }
                    updateHeaderSaveDiscardState();
                    // Close the accordion after successful save
                    discardEdits(post.id);
                    if (postContainer) {
                        var editBtn = postContainer.querySelector('.posteditor-button-edit');
                        if (editBtn) editBtn.setAttribute('aria-selected', 'false');
                    }
                }).catch(function(err) {
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError('Failed to save: ' + err.message);
                    }
                });
            });
            
            // Discard button (red) - right - starts disabled
            var discardBtn = document.createElement('button');
            discardBtn.type = 'button';
            discardBtn.className = 'posteditor-edit-button-discard button-class-2d';
            discardBtn.textContent = 'Discard';
            discardBtn.disabled = true;
            
            // Function to check if all fieldsets are complete
            function isFormComplete() {
                var fieldsetEls = accordionContainer.querySelectorAll('.fieldset[data-complete]');
                for (var i = 0; i < fieldsetEls.length; i++) {
                    var fs = fieldsetEls[i];
                    if (!fs || !fs.dataset) continue;
                    if (String(fs.dataset.complete || '') !== 'true') {
                        return false;
                    }
                }
                return true;
            }
            
            // Function to get incomplete fieldset names
            function getIncompleteFieldsetNamesList() {
                var out = [];
                var fieldsetEls = accordionContainer.querySelectorAll('.fieldset[data-complete="false"]');
                for (var i = 0; i < fieldsetEls.length; i++) {
                    var fs = fieldsetEls[i];
                    if (!fs || !fs.dataset) continue;
                    var name = '';
                    var labelTextEl = fs.querySelector('.fieldset-label-text');
                    if (labelTextEl && labelTextEl.textContent) {
                        name = labelTextEl.textContent.trim();
                    } else if (fs.dataset.fieldsetName) {
                        name = fs.dataset.fieldsetName.trim();
                    } else if (fs.dataset.fieldsetKey) {
                        name = fs.dataset.fieldsetKey.trim();
                    }
                    if (name) out.push(name);
                }
                return out;
            }
            
            // Popover content for Save button - shows "No changes" or incomplete fields
            function getSavePopoverContent() {
                var isDirty = isPostDirty(post.id);
                if (!isDirty) {
                    return { title: 'No Changes', items: ['Make changes to enable saving'] };
                }
                var incomplete = getIncompleteFieldsetNamesList();
                if (incomplete.length > 0) {
                    return { title: 'Incomplete', items: incomplete };
                }
                return { title: '', items: [] };
            }
            
            // Popover content for Discard button - shows "No changes" when not dirty
            function getDiscardPopoverContent() {
                var isDirty = isPostDirty(post.id);
                if (!isDirty) {
                    return { title: 'No Changes', items: ['Nothing to discard'] };
                }
                return { title: '', items: [] };
            }
            
            // Function to update footer button states based on dirty check AND completeness
            function updateFooterButtonState() {
                var isDirty = isPostDirty(post.id);
                var isComplete = isFormComplete();
                saveBtn.disabled = !isDirty || !isComplete;
                discardBtn.disabled = !isDirty;
            }
            
            // Attach popover to a button (posteditor-specific, not shared)
            function attachPopoverToButton(btnEl, getContentFn, alignment) {
                if (!btnEl) return;
                if (btnEl._popoverAttached) return;
                btnEl._popoverAttached = true;
                
                var pop = document.createElement('div');
                pop.className = 'posteditor-popover posteditor-popover--' + alignment;
                pop.hidden = true;
                
                var titleEl = document.createElement('div');
                titleEl.className = 'posteditor-popover-title';
                pop.appendChild(titleEl);
                
                var list = document.createElement('div');
                list.className = 'posteditor-popover-list';
                pop.appendChild(list);
                
                footer.appendChild(pop);
                
                function show() {
                    if (btnEl.hidden || btnEl.offsetParent === null) return;
                    if (!btnEl.disabled) return;
                    var content = null;
                    try { content = getContentFn(); } catch (e) { content = null; }
                    if (!content || !content.items || content.items.length === 0) return;
                    titleEl.textContent = content.title || 'Incomplete';
                    list.innerHTML = '';
                    content.items.forEach(function(item) {
                        var row = document.createElement('div');
                        row.className = 'posteditor-popover-item';
                        row.textContent = String(item);
                        list.appendChild(row);
                    });
                    pop.hidden = false;
                }
                
                function hide() {
                    pop.hidden = true;
                }
                
                btnEl.addEventListener('mouseenter', show);
                btnEl.addEventListener('mouseleave', function(e) {
                    if (e.relatedTarget && pop.contains(e.relatedTarget)) return;
                    hide();
                });
                pop.addEventListener('mouseleave', hide);
            }
            
            // Attach popovers to Save (left-aligned) and Discard (right-aligned) buttons
            attachPopoverToButton(saveBtn, getSavePopoverContent, 'left');
            attachPopoverToButton(discardBtn, getDiscardPopoverContent, 'right');

            // Attach change listener to mark global save state as dirty and update footer buttons
            accordionContainer.addEventListener('input', function() {
                updateHeaderSaveDiscardState();
                updateFooterButtonState();
            });
            accordionContainer.addEventListener('change', function() {
                updateHeaderSaveDiscardState();
                updateFooterButtonState();
            });
            // Also custom events from fieldsets
            accordionContainer.addEventListener('fieldset:sessions-change', function() {
                updateHeaderSaveDiscardState();
                updateFooterButtonState();
            });
            // Fieldset validity changes (completeness)
            accordionContainer.addEventListener('fieldset:validity-change', function() {
                updateFooterButtonState();
            });
            discardBtn.addEventListener('click', function() {
                var postContainer = accordionContainer.closest('.posteditor-item');
                if (!window.ConfirmDialogComponent || typeof ConfirmDialogComponent.show !== 'function') {
                    // Fallback if ConfirmDialogComponent not available
                    discardEdits(post.id);
                    if (postContainer) {
                        var editBtn = postContainer.querySelector('.posteditor-button-edit');
                        if (editBtn) editBtn.setAttribute('aria-selected', 'false');
                    }
                    return;
                }
                ConfirmDialogComponent.show({
                    titleText: 'Discard Changes',
                    messageText: 'Are you sure you want to discard your changes?',
                    confirmLabel: 'Discard',
                    cancelLabel: 'Cancel',
                    focusCancel: true,
                    confirmClass: 'danger'
                }).then(function(confirmed) {
                    if (confirmed) {
                        discardEdits(post.id);
                        if (postContainer) {
                            var editBtn = postContainer.querySelector('.posteditor-button-edit');
                            if (editBtn) editBtn.setAttribute('aria-selected', 'false');
                        }
                        if (window.ToastComponent && typeof ToastComponent.show === 'function') {
                            ToastComponent.show('Changes discarded');
                        }
                    }
                });
            });
            
            footer.appendChild(saveBtn);
            footer.appendChild(discardBtn);
            accordionContainer.appendChild(footer);
        });
    }

    // Renumber location containers within a specific accordion (same logic as FormbuilderModule but scoped)
    function renumberLocationContainersInAccordion(accordionContainer) {
        if (!accordionContainer) return;
        
        var allContainers = accordionContainer.querySelectorAll('.member-location-container');
        var count = allContainers.length;
        
        // Determine location type from first container's location fieldset
        var locationType = 'Venue';
        if (allContainers.length > 0) {
            var firstContainer = allContainers[0];
            var locationFieldset = firstContainer.querySelector('.fieldset[data-fieldset-key="venue"], .fieldset[data-fieldset-key="city"], .fieldset[data-fieldset-key="address"]');
            if (locationFieldset) {
                var key = locationFieldset.dataset.fieldsetKey || '';
                if (key) {
                    locationType = key.charAt(0).toUpperCase() + key.slice(1);
                }
            }
        }
        
        allContainers.forEach(function(container, index) {
            var newNumber = index + 1;
            
            // Update container data attributes
            container.dataset.venue = String(newNumber);
            container.dataset.locationNumber = String(newNumber);
            container.dataset.locationType = locationType;
            
            // Update header text with venue/city name or default
            var headerText = container.querySelector('.member-postform-location-header-text');
            if (headerText) {
                var venueFieldset = container.querySelector('.fieldset[data-fieldset-key="venue"]');
                var cityFieldset = container.querySelector('.fieldset[data-fieldset-key="city"]');
                var addressFieldset = container.querySelector('.fieldset[data-fieldset-key="address"]');
                
                var displayName = '';
                if (venueFieldset) {
                    var inputs = venueFieldset.querySelectorAll('input.fieldset-input');
                    var venueName = inputs && inputs[0] ? String(inputs[0].value || '').trim() : '';
                    displayName = venueName;
                } else if (cityFieldset) {
                    var cityInput = cityFieldset.querySelector('input.fieldset-input');
                    displayName = cityInput ? String(cityInput.value || '').trim() : '';
                } else if (addressFieldset) {
                    var addrInput = addressFieldset.querySelector('input.fieldset-input');
                    displayName = addrInput ? String(addrInput.value || '').trim() : '';
                }
                
                if (displayName) {
                    headerText.textContent = displayName;
                    headerText.title = displayName;
                } else {
                    headerText.textContent = count > 1 ? (locationType + ' ' + newNumber) : locationType;
                    headerText.title = '';
                }
            }
            
            // Update fieldset labels with location number
            var fieldsets = container.querySelectorAll('.fieldset');
            fieldsets.forEach(function(fieldset) {
                var fieldsetKey = (fieldset.dataset.fieldsetKey || '').toLowerCase();
                
                // Skip location fieldsets - handled above
                if (fieldsetKey === 'venue' || fieldsetKey === 'city' || fieldsetKey === 'address') {
                    var labelTextEl = fieldset.querySelector('.fieldset-label-text');
                    if (labelTextEl) {
                        labelTextEl.textContent = count > 1 ? (locationType + ' ' + newNumber) : locationType;
                    }
                    return;
                }
                
                var labelTextEl = fieldset.querySelector('.fieldset-label-text');
                if (labelTextEl) {
                    if (!fieldset.dataset.baseLabel) {
                        fieldset.dataset.baseLabel = (labelTextEl.textContent || '').trim();
                    }
                    var base = fieldset.dataset.baseLabel || '';
                    if (base) {
                        labelTextEl.textContent = count > 1 ? (base + ' ' + newNumber) : base;
                    }
                }
            });
        });
    }

    function populateWithPostData(post, accordionContainer) {
        if (!post || !post.map_cards || post.map_cards.length === 0 || !accordionContainer) {
            console.warn('[PostEditor] populateWithPostData: Missing data');
            return;
        }
        
        // 1. Populate non-repeating fieldsets (title, description, etc.)
        // These are in .form-primary-container
        var primaryMapCard = post.map_cards[0];
        var primaryContainer = accordionContainer.querySelector('.form-primary-container');
        
        if (primaryContainer) {
            populateFieldsetsInContainer(primaryContainer, primaryMapCard);
        }

        // 2. Populate location containers (repeating fieldsets)
        post.map_cards.forEach(function(mapCard, idx) {
            var locationNum = idx + 1;
            var locContainer = accordionContainer.querySelector('.member-location-container[data-location-number="' + locationNum + '"]');
            if (locContainer) {
                populateFieldsetsInContainer(locContainer, mapCard);
            }
        });
    }

    function populateFieldsetsInContainer(containerEl, mapCard) {
        if (!containerEl || !mapCard) return;

        // Find all fieldsets IN THIS CONTAINER only
        var fieldsetEls = containerEl.querySelectorAll('.fieldset[data-fieldset-key]');
        
        fieldsetEls.forEach(function(fs) {
            // Ensure this fieldset belongs directly to this container (not a nested one)
            if (fs.parentElement.closest('.fieldset')) return;

            var key = fs.dataset.fieldsetKey;
            var type = fs.dataset.fieldsetType || key;
            var baseType = type.replace(/-locked$/, '').replace(/-hidden$/, '');
            
            // If the fieldset has a custom _setValue, use it
            if (typeof fs._setValue === 'function') {
                var val = null;
                
                // Map common fields from mapCard
                switch (baseType) {
                    case 'title': val = mapCard.title; break;
                    case 'description': val = mapCard.description; break;
                    case 'venue':
                        val = {
                            venue_name: mapCard.venue_name,
                            address_line: mapCard.address_line,
                            latitude: mapCard.latitude,
                            longitude: mapCard.longitude,
                            country_code: mapCard.country_code
                        };
                        break;
                    case 'address':
                    case 'city':
                    case 'location':
                        val = {
                            address_line: mapCard.address_line,
                            latitude: mapCard.latitude,
                            longitude: mapCard.longitude,
                            country_code: mapCard.country_code
                        };
                        break;
                    case 'public-email': val = mapCard.public_email; break;
                    case 'public-phone':
                        val = {
                            phone_prefix: mapCard.phone_prefix || null,
                            public_phone: mapCard.public_phone || ''
                        };
                        break;
                    case 'website_url':
                    case 'website-url':
                    case 'url':
                        val = mapCard.website_url;
                        break;
                    case 'tickets_url':
                    case 'tickets-url':
                        val = mapCard.tickets_url;
                        break;
                    case 'coupon': val = mapCard.coupon_code; break;
                    case 'custom-text': val = stripLabelPrefix(mapCard.custom_text); break;
                    case 'custom-textarea': val = stripLabelPrefix(mapCard.custom_textarea); break;
                    case 'custom-dropdown': val = stripLabelPrefix(mapCard.custom_dropdown); break;
                    case 'custom-checklist': 
                        // Stored as "Label: item1, item2, item3" - parse to array
                        val = parseChecklistValue(mapCard.custom_checklist);
                        break;
                    case 'custom-radio': val = stripLabelPrefix(mapCard.custom_radio); break;
                    case 'age-rating': val = mapCard.age_rating; break;
                    
                    case 'session-pricing':
                        val = {
                            sessions: mapCard.sessions || [],
                            pricing_groups: mapCard.pricing_groups || {},
                            age_ratings: mapCard.age_ratings || {}
                        };
                        break;
                    
                    case 'ticket-pricing':
                        var apiPricingGroups = mapCard.pricing_groups || {};
                        var apiAgeRatings = mapCard.age_ratings || {};
                        var convertedPricingGroups = {};
                        
                        Object.keys(apiPricingGroups).forEach(function(groupKey) {
                            var ticketAreasObj = apiPricingGroups[groupKey];
                            if (ticketAreasObj && typeof ticketAreasObj === 'object') {
                                var groupCurrency = '';
                                var firstTicketAreaKey = Object.keys(ticketAreasObj)[0];
                                if (firstTicketAreaKey) {
                                    var firstArea = ticketAreasObj[firstTicketAreaKey];
                                    if (firstArea && firstArea.tiers && firstArea.tiers[0]) {
                                        groupCurrency = firstArea.tiers[0].currency || '';
                                    }
                                }
                                
                                var groupAgeRating = apiAgeRatings[groupKey] || '';
                                
                                convertedPricingGroups[groupKey] = Object.keys(ticketAreasObj).map(function(ticketAreaKey, idx) {
                                    var ticketArea = ticketAreasObj[ticketAreaKey];
                                    return {
                                        ticket_area: ticketArea.ticket_area,
                                        tiers: ticketArea.tiers || [],
                                        currency: idx === 0 ? groupCurrency : '',
                                        age_rating: idx === 0 ? groupAgeRating : ''
                                    };
                                });
                            }
                        });
                        val = {
                            pricing_groups: convertedPricingGroups,
                            age_ratings: apiAgeRatings
                        };
                        break;
                    
                    case 'sessions':
                        val = {
                            sessions: mapCard.sessions || []
                        };
                        break;
                        
                    case 'item-pricing':
                        val = {
                            item_name: mapCard.item_name,
                            item_price: mapCard.item_price,
                            currency: mapCard.currency,
                            item_variants: mapCard.item_variants || []
                        };
                        break;
                        
                    case 'amenities':
                        try {
                            val = JSON.parse(mapCard.amenities || '[]');
                        } catch (e) { val = []; }
                        break;
                        
                    case 'images':
                        var urls = mapCard.media_urls || [];
                        var metas = mapCard.media_meta || [];
                        val = urls.map(function(url, idx) {
                            var meta = metas[idx];
                            return { 
                                url: url, 
                                crop: meta ? meta.cropRect : null, 
                                id: meta ? meta.media_id : null 
                            };
                        });
                        break;
                    
                    default:
                        var keyUnderscore = key.replace(/-/g, '_');
                        var baseTypeUnderscore = baseType.replace(/-/g, '_');
                        
                        if (mapCard.hasOwnProperty(key)) {
                            val = mapCard[key];
                        } else if (mapCard.hasOwnProperty(keyUnderscore)) {
                            val = mapCard[keyUnderscore];
                        } else if (mapCard.hasOwnProperty(baseType)) {
                            val = mapCard[baseType];
                        } else if (mapCard.hasOwnProperty(baseTypeUnderscore)) {
                            val = mapCard[baseTypeUnderscore];
                        }
                        break;
                }
                
                if (val !== undefined) {
                    fs._setValue(val);
                }
            } else {
                // Fallback for simple inputs if _setValue not present
                var input = fs.querySelector('input:not([type="hidden"]), textarea, select');
                if (input) {
                    var simpleVal = mapCard[key] || '';
                    if (simpleVal !== null && simpleVal !== undefined) {
                        input.value = simpleVal;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }
        });
    }

    /* --------------------------------------------------------------------------
       DIRTY CHECKING & SAVE/DISCARD
       -------------------------------------------------------------------------- */
    
    function isAnyPostDirty() {
        var anyDirty = false;
        Object.keys(expandedPostAccordions).forEach(function(postId) {
            if (expandedPostAccordions[postId] === true) {
                if (isPostDirty(postId)) {
                    anyDirty = true;
                }
            }
        });
        return anyDirty;
    }

    function isPostDirty(postId) {
        var data = editingPostsData[postId];
        if (!data) return false;
        
        // Guard: if original_extracted_fields not set yet, can't be dirty
        if (!data.original_extracted_fields) return false;
        
        var accordion = document.querySelector('.posteditor-item[data-post-id="' + postId + '"] .posteditor-edit-accordion');
        if (!accordion) return false;

        // Collect current form data and compare with original
        var current = collectFormData(accordion, data.original);
        return JSON.stringify(current) !== JSON.stringify(data.original_extracted_fields);
    }

    function collectFormData(accordion, originalPost) {
        var fields = [];
        var fieldsetEls = accordion.querySelectorAll('[data-fieldset-key]');
        
        for (var i = 0; i < fieldsetEls.length; i++) {
            var el = fieldsetEls[i];
            var key = el.dataset.fieldsetKey;
            var type = el.dataset.fieldsetType || '';
            var name = el.dataset.fieldsetName || key;
            var baseType = type.replace(/-locked$/, '').replace(/-hidden$/, '');
            
            // Determine location number from parent container
            var locationNumber = 1;
            try {
                var locWrap = el.closest ? el.closest('.member-location-container[data-location-number]') : null;
                if (locWrap && locWrap.dataset && locWrap.dataset.locationNumber) {
                    locationNumber = parseInt(locWrap.dataset.locationNumber, 10) || 1;
                }
            } catch (e) {}
            
            var value = extractFieldValue(el, baseType);
            fields.push({
                key: key,
                type: type,
                name: name,
                value: value,
                location_number: locationNumber
            });
        }
        return fields;
    }

    function savePost(postId) {
        var data = editingPostsData[postId];
        var accordion = document.querySelector('.posteditor-item[data-post-id="' + postId + '"] .posteditor-edit-accordion');
        if (!data || !accordion) return Promise.resolve();

        var memberCategories = getMemberCategories();
        
        // Collect current fields from form
        var fields = collectFormData(accordion, data.original);
        
        // Collect image files from the accordion
        var imageFiles = [];
        var imagesMeta = '[]';
        var imagesFs = accordion.querySelector('.fieldset[data-fieldset-type="images"], .fieldset[data-fieldset-key="images"]');
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
        
        // Resolve category name
        var categoryName = '';
        for (var i = 0; i < memberCategories.length; i++) {
            var cat = memberCategories[i];
            if (cat.subs) {
                for (var j = 0; j < cat.subs.length; j++) {
                    var sub = cat.subs[j];
                    var subKey = (typeof sub === 'string') ? sub : (sub && sub.name);
                    var feeInfo = cat && cat.subFees && cat.subFees[subKey];
                    var key = feeInfo && feeInfo.subcategory_key ? String(feeInfo.subcategory_key) : '';
                    if (key === data.original.subcategory_key) {
                        categoryName = cat.name;
                        break;
                    }
                }
            }
            if (categoryName) break;
        }

        // Determine location count from the edit form
        var locationContainers = accordion.querySelectorAll('.member-location-container[data-location-number]');
        var locQty = locationContainers.length > 0 ? locationContainers.length : 1;
        
        var payload = {
            post_id: postId,
            category: categoryName,
            subcategory: data.original.subcategory_name || data.original.subcategory_key,
            fields: fields,
            loc_qty: locQty
        };

        return submitPostData(payload, false, imageFiles, imagesMeta)
            .then(function(res) {
                if (res && res.success) {
                    // Update original data so it's no longer dirty
                    data.original_extracted_fields = fields;
                    App.emit('post:updated', { post_id: postId });
                    return res;
                } else {
                    var errorMsg = (res && res.error) ? res.error : 'Failed to save post ' + postId;
                    throw new Error(errorMsg);
                }
            });
    }

    function discardEdits(postId) {
        var data = editingPostsData[postId];
        var postContainer = document.querySelector('.posteditor-item[data-post-id="' + postId + '"]');
        var accordion = postContainer ? postContainer.querySelector('.posteditor-edit-accordion') : null;
        var editBtn = postContainer ? postContainer.querySelector('.posteditor-button-edit') : null;
        
        if (accordion) {
            // Close accordion and reset to original
            accordion.hidden = true;
            accordion.classList.add('posteditor-edit-accordion--hidden');
            if (postContainer) postContainer.classList.remove('posteditor-item--editing');
            if (editBtn) editBtn.setAttribute('aria-selected', 'false');
            expandedPostAccordions[postId] = false;
            
            // Clear data so it's re-loaded if opened again
            accordion.innerHTML = '';
        }
        
        // Clear cached data
        if (data) {
            delete editingPostsData[postId];
        }
        
        updateHeaderSaveDiscardState();
    }

    function discardAllEdits() {
        Object.keys(expandedPostAccordions).forEach(function(postId) {
            if (expandedPostAccordions[postId] === true) {
                discardEdits(postId);
            }
        });
    }

    function getDirtyPostIds() {
        var dirtyIds = [];
        Object.keys(expandedPostAccordions).forEach(function(postId) {
            if (expandedPostAccordions[postId] === true && isPostDirty(postId)) {
                dirtyIds.push(postId);
            }
        });
        return dirtyIds;
    }

    function saveAllDirtyPosts() {
        var dirtyIds = getDirtyPostIds();
        var savePromises = dirtyIds.map(function(postId) {
            return savePost(postId);
        });
        return Promise.all(savePromises);
    }

    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init(containerEl) {
        if (!containerEl) {
            containerEl = document.getElementById('member-tab-myposts');
        }
        if (!containerEl) {
            console.warn('[PostEditor] Container not found');
            return;
        }
        
        container = containerEl;
        isLoaded = true;
        
        // Load posts
        loadPosts();
    }

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    window.PostEditorModule = {
        init: init,
        loadPosts: loadPosts,
        refreshPostCard: refreshPostCard,
        isAnyPostDirty: isAnyPostDirty,
        isPostDirty: isPostDirty,
        getDirtyPostIds: getDirtyPostIds,
        discardEdits: discardEdits,
        discardAllEdits: discardAllEdits,
        savePost: savePost,
        saveAllDirtyPosts: saveAllDirtyPosts,
        showLoadingPlaceholder: showLoadingPlaceholder,
        updateLoadingPlaceholder: updateLoadingPlaceholder
    };

    // Register with App
    if (typeof App !== 'undefined' && typeof App.registerModule === 'function') {
        App.registerModule('posteditor', window.PostEditorModule);
    }

})();
