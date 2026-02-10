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
    var activeModal = null;         // { backdrop: HTMLElement, close: Function }

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
     * Build a status bar element for a post.
     * Shows countdown (or expired date) on the left, status word on the right.
     * Color: green (7+ days), yellow (3-7 days), red (<3 days), gray (not visible).
     * @param {Object} post - Post object with visibility, expires_at, deleted_at
     * @returns {HTMLElement} Status bar div
     */
    function buildStatusBar(post) {
        var bar = document.createElement('div');
        bar.className = 'posteditor-status-bar';

        var dateSpan = document.createElement('span');
        dateSpan.className = 'posteditor-status-bar-date';
        var countdownSpan = document.createElement('span');
        countdownSpan.className = 'posteditor-status-bar-countdown';
        var statusSpan = document.createElement('span');
        statusSpan.className = 'posteditor-status-bar-status';

        // Determine status and color
        var status = '';
        var colorClass = '';
        var isDeleted = post.deleted_at && post.deleted_at !== '' && post.deleted_at !== null;
        var visibility = post.visibility || 'active';
        var expiresAt = post.expires_at ? new Date(post.expires_at) : null;
        var now = new Date();

        if (isDeleted) {
            status = 'DELETED';
            colorClass = 'posteditor-status-bar--gray';
            dateSpan.textContent = 'Deleted ' + formatStatusDate(new Date(post.deleted_at));
        } else if (visibility === 'expired') {
            status = 'EXPIRED';
            colorClass = 'posteditor-status-bar--gray';
            if (expiresAt) {
                dateSpan.textContent = 'Expired ' + formatStatusDate(expiresAt);
            }
        } else if (visibility === 'paused') {
            status = 'PAUSED';
            colorClass = 'posteditor-status-bar--gray';
            if (expiresAt) {
                dateSpan.textContent = 'Expires ' + formatStatusDate(expiresAt);
                countdownSpan.textContent = formatCountdown(expiresAt, now);
            }
        } else {
            // Active (or expired but database not yet updated)
            if (expiresAt) {
                var msRemaining = expiresAt.getTime() - now.getTime();
                var daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
                if (msRemaining <= 0) {
                    // Expiry time has passed even though visibility still says active
                    status = 'EXPIRED';
                    colorClass = 'posteditor-status-bar--gray';
                    dateSpan.textContent = 'Expired ' + formatStatusDate(expiresAt);
                } else {
                    status = 'ACTIVE';
                    if (daysRemaining >= 7) {
                        colorClass = 'posteditor-status-bar--green';
                    } else if (daysRemaining >= 3) {
                        colorClass = 'posteditor-status-bar--yellow';
                    } else {
                        colorClass = 'posteditor-status-bar--red';
                    }
                    dateSpan.textContent = 'Expires ' + formatStatusDate(expiresAt);
                    countdownSpan.textContent = formatCountdown(expiresAt, now);
                }
            } else {
                status = 'ACTIVE';
                colorClass = 'posteditor-status-bar--green';
            }
        }

        bar.classList.add(colorClass);
        statusSpan.textContent = status;
        bar.appendChild(dateSpan);
        bar.appendChild(countdownSpan);
        bar.appendChild(statusSpan);

        return bar;
    }

    /**
     * Format date for status bar: "Wed 3 Mar 14:30" (omit year if current year)
     */
    function formatStatusDate(date) {
        var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var weekday = weekdays[date.getDay()];
        var day = date.getDate();
        var month = months[date.getMonth()];
        var year = date.getFullYear();
        var hour = String(date.getHours()).padStart(2, '0');
        var minute = String(date.getMinutes()).padStart(2, '0');
        var thisYear = new Date().getFullYear();
        if (year !== thisYear) {
            return weekday + ' ' + day + ' ' + month + ' ' + year + ' ' + hour + ':' + minute;
        }
        return weekday + ' ' + day + ' ' + month + ' ' + hour + ':' + minute;
    }

    /**
     * Format countdown: "30d 2h 15m"
     */
    function formatCountdown(expiresAt, now) {
        var ms = expiresAt.getTime() - now.getTime();
        if (ms <= 0) return '0d 0h 0m';
        var totalMinutes = Math.floor(ms / (1000 * 60));
        var minutes = totalMinutes % 60;
        var totalHours = Math.floor(totalMinutes / 60);
        var hours = totalHours % 24;
        var days = Math.floor(totalHours / 24);
        return days + 'd ' + hours + 'h ' + minutes + 'm';
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

    // Check if a post is favorited (same logic as PostModule)
    function isFavorite(postId) {
        try {
            var favs = JSON.parse(localStorage.getItem('postFavorites') || '{}');
            return !!favs[postId];
        } catch (e) {
            return false;
        }
    }
    
    // Sort posts: favorites first (by post date), then non-favorites (by post date)
    function sortPostsWithFavorites(posts) {
        return posts.slice().sort(function(a, b) {
            var aFav = isFavorite(a.id);
            var bFav = isFavorite(b.id);
            
            // Favorites come first
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            
            // Within same group, sort by created_at descending (newest first)
            var aDate = new Date(a.created_at || 0).getTime();
            var bDate = new Date(b.created_at || 0).getTime();
            return bDate - aDate;
        });
    }
    
    // Store posts for reordering
    var currentPosts = [];

    function renderPosts(posts) {
        if (!container) return;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="posteditor-status">You haven\'t created any posts yet.</p>';
            currentPosts = [];
            return;
        }
        
        // Store and sort posts
        currentPosts = posts;
        var sortedPosts = sortPostsWithFavorites(posts);

        // Keep the uploading placeholder if it exists
        var placeholder = document.getElementById('posteditor-uploading');
        container.innerHTML = '';
        if (placeholder) {
            container.appendChild(placeholder);
        }

        sortedPosts.forEach(function(post) {
            var card = renderPostCard(post);
            container.appendChild(card);
        });
    }
    
    // Reorder posts after favorite toggle (with animation)
    function reorderPostsAfterFavorite(postId) {
        if (!container || currentPosts.length === 0) return;
        
        // Find the post container that was just favorited
        var postContainer = container.querySelector('.posteditor-item[data-post-id="' + postId + '"]');
        var favBtn = postContainer ? postContainer.querySelector('.post-card-button-fav') : null;
        
        // Brief highlight on star
        if (favBtn) {
            favBtn.classList.add('posteditor-fav-highlight');
            setTimeout(function() {
                favBtn.classList.remove('posteditor-fav-highlight');
            }, 300);
        }
        
        // Re-sort and reorder DOM
        var sortedPosts = sortPostsWithFavorites(currentPosts);
        var placeholder = document.getElementById('posteditor-uploading');
        
        // Reorder DOM elements
        sortedPosts.forEach(function(post) {
            var el = container.querySelector('.posteditor-item[data-post-id="' + post.id + '"]');
            if (el) {
                container.appendChild(el);
            }
        });
        
        // Keep placeholder at top if exists
        if (placeholder && placeholder.parentNode === container) {
            container.insertBefore(placeholder, container.firstChild);
        }
        
        // Smooth scroll to top
        container.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function refreshPostCard(postId) {
        // Find the existing post container
        var postContainer = document.querySelector('.posteditor-item[data-post-id="' + postId + '"]');
        if (!postContainer) return;
        
        // Fetch fresh post data (include member_id to bypass contact security filtering)
        var user = getCurrentUser();
        var memberId = user ? parseInt(user.id, 10) : 0;
        fetch('/gateway.php?action=get-posts&full=1&post_id=' + postId + '&member_id=' + memberId)
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
        
        // Create edit header (sticky container for postcard + Save/Close buttons when editing)
        var editHeader = document.createElement('div');
        editHeader.className = 'posteditor-edit-header';
        
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

        // Status bar above the post card
        var statusBar = buildStatusBar(post);
        postContainer.appendChild(statusBar);

        editHeader.appendChild(cardEl);
        postContainer.appendChild(editHeader);

        // Create button row underneath the header (Manage button)
        var buttonRow = document.createElement('div');
        buttonRow.className = 'posteditor-buttons';

        // Manage Button (opens combined Edit + Manage modal)
        var manageBtn = document.createElement('button');
        manageBtn.className = 'posteditor-button-manage button-class-2';
        manageBtn.title = 'Manage Post';
        manageBtn.textContent = 'Manage';
        manageBtn.setAttribute('aria-selected', 'false');
        manageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (window.PostModule && typeof PostModule.closePost === 'function') {
                PostModule.closePost(post.id);
            }
            openManageModal(post);
        });

        buttonRow.appendChild(manageBtn);
        postContainer.appendChild(buttonRow);

        return postContainer;
    }

    /* --------------------------------------------------------------------------
       MODALS (Edit / Manage) — copies formbuilder-formpreview-modal pattern
       -------------------------------------------------------------------------- */

    function closeActiveModal() {
        if (activeModal) {
            activeModal.close();
            activeModal = null;
        }
    }

    /* openEditModal removed — edit form now lives inside the Manage modal accordion */

    function openManageModal(post) {
        var postId = post.id;
        closeActiveModal();
        var panelContents = document.querySelector('.member-panel-contents');
        if (!panelContents) {
            throw new Error('[PostEditor] Expected .member-panel-contents not found (cannot mount manage modal).');
        }

        var backdrop = document.createElement('div');
        backdrop.className = 'posteditor-modal';
        var modalContainer = document.createElement('div');
        modalContainer.className = 'posteditor-modal-container';

        // Build 70px post header (matches post-header pattern)
        var header = document.createElement('div');
        header.className = 'posteditor-modal-header';

        // Thumbnail (50x50 minithumb)
        var mapCards = post.map_cards || [];
        var firstCard = mapCards[0] || {};
        var mediaUrls = firstCard.media_urls || [];
        var rawThumbUrl = mediaUrls.length > 0 ? mediaUrls[0] : '';
        var miniThumbUrl = rawThumbUrl ? (rawThumbUrl + (rawThumbUrl.indexOf('?') === -1 ? '?' : '&') + 'class=minithumb') : '';

        if (miniThumbUrl) {
            var thumbImg = document.createElement('img');
            thumbImg.className = 'posteditor-modal-header-image';
            thumbImg.src = miniThumbUrl;
            thumbImg.alt = '';
            thumbImg.loading = 'lazy';
            thumbImg.referrerPolicy = 'no-referrer';
            header.appendChild(thumbImg);
        } else {
            var thumbEmpty = document.createElement('div');
            thumbEmpty.className = 'posteditor-modal-header-image posteditor-modal-header-image--empty';
            thumbEmpty.setAttribute('aria-hidden', 'true');
            header.appendChild(thumbEmpty);
        }

        // Meta (title + subcategory)
        var meta = document.createElement('div');
        meta.className = 'posteditor-modal-header-meta';

        var titleEl = document.createElement('div');
        titleEl.className = 'posteditor-modal-header-text-title';
        titleEl.textContent = firstCard.title || 'Post #' + postId;
        meta.appendChild(titleEl);

        // Subcategory row
        var catRow = document.createElement('div');
        catRow.className = 'posteditor-modal-header-row-cat';
        var iconUrl = post.subcategory_icon_url || '';
        if (iconUrl) {
            var iconWrap = document.createElement('span');
            iconWrap.className = 'posteditor-modal-header-icon-sub';
            var iconImg = document.createElement('img');
            iconImg.className = 'posteditor-modal-header-image-sub';
            iconImg.src = iconUrl;
            iconImg.alt = '';
            iconImg.width = 18;
            iconImg.height = 18;
            iconWrap.appendChild(iconImg);
            catRow.appendChild(iconWrap);
        }
        var catText = document.createElement('span');
        catText.className = 'posteditor-modal-header-text-cat';
        catText.textContent = post.subcategory_name || '';
        catRow.appendChild(catText);
        meta.appendChild(catRow);

        header.appendChild(meta);

        // Close button (X)
        var closeBtn = ClearButtonComponent.create({
            className: 'posteditor-modal-close',
            ariaLabel: 'Close',
            onClick: function() { handleClose(); }
        });
        header.appendChild(closeBtn);

        // Status bar above the header, inside the modal container
        var modalStatusBar = buildStatusBar(post);
        modalContainer.appendChild(modalStatusBar);

        modalContainer.appendChild(header);
        var body = document.createElement('div');
        body.className = 'posteditor-modal-body';

        // Manage intro message (from database)
        var introEl = document.createElement('p');
        introEl.className = 'posteditor-manage-intro';
        body.appendChild(introEl);
        if (typeof window.getMessage === 'function') {
            window.getMessage('msg_member_manage_intro', {}, false).then(function(msg) {
                if (msg) introEl.textContent = msg;
            });
        }

        // --- Edit Accordion (collapsed by default) ---
        var editAccordionRow = document.createElement('div');
        editAccordionRow.className = 'posteditor-manage-edit-row';

        // "Edit" button (visible when collapsed)
        var editToggleBtn = document.createElement('button');
        editToggleBtn.className = 'posteditor-manage-edit-toggle button-class-2b';
        editToggleBtn.textContent = 'Edit';
        editAccordionRow.appendChild(editToggleBtn);

        // Save + Close buttons (visible when expanded)
        var editTopSaveBtn = document.createElement('button');
        editTopSaveBtn.className = 'posteditor-manage-edit-save button-class-2c';
        editTopSaveBtn.textContent = 'Save';
        editTopSaveBtn.disabled = true;
        editTopSaveBtn.style.display = 'none';

        var editTopCloseBtn = document.createElement('button');
        editTopCloseBtn.className = 'posteditor-manage-edit-close button-class-2b';
        editTopCloseBtn.textContent = 'Close';
        editTopCloseBtn.style.display = 'none';

        editAccordionRow.appendChild(editTopSaveBtn);
        editAccordionRow.appendChild(editTopCloseBtn);

        var editAccordionContent = document.createElement('div');
        editAccordionContent.className = 'posteditor-manage-edit-content posteditor-manage-edit-content--hidden';
        var editFormLoaded = false;
        var accordionExpanded = false;

        // Delegate top Save to bottom Save button
        editTopSaveBtn.addEventListener('click', function() {
            var bottomSave = editAccordionContent.querySelector('.posteditor-edit-button-save');
            if (bottomSave && !bottomSave.disabled) bottomSave.click();
        });

        // Close collapses the edit accordion (not the modal)
        editTopCloseBtn.addEventListener('click', function() {
            var bottomClose = editAccordionContent.querySelector('.posteditor-edit-button-close');
            if (bottomClose) bottomClose.click();
        });

        function setAccordionExpanded(expand) {
            accordionExpanded = expand;
            if (expand) {
                editToggleBtn.style.display = 'none';
                editTopSaveBtn.style.display = '';
                editTopCloseBtn.style.display = '';
                editAccordionContent.classList.remove('posteditor-manage-edit-content--hidden');
            } else {
                editToggleBtn.style.display = '';
                editTopSaveBtn.style.display = 'none';
                editTopCloseBtn.style.display = 'none';
                editAccordionContent.classList.add('posteditor-manage-edit-content--hidden');
            }
        }

        // Collapse accordion (used as closeModalFn for renderEditForm)
        function collapseAccordion() {
            setAccordionExpanded(false);
            // Reset so the form reloads with fresh data on next expand
            // (discardEdits wipes editingPostsData, so the stale form would be broken)
            editFormLoaded = false;
            editAccordionContent.innerHTML = '';
            // Clear popover flag so it re-attaches with fresh closure on next expand
            try { editTopSaveBtn._popoverAttached = false; } catch (e) {}
            // Remove stale popover element from the accordion row
            var stalePopover = editAccordionRow.querySelector('.posteditor-popover');
            if (stalePopover) stalePopover.remove();
        }

        editToggleBtn.addEventListener('click', function() {
            setAccordionExpanded(true);

            // Load edit form on first expand
            if (!editFormLoaded) {
                editFormLoaded = true;
                if (editingPostsData[postId]) {
                    renderEditForm(editingPostsData[postId].original, editAccordionContent, collapseAccordion, editTopSaveBtn, editTopCloseBtn);
                } else {
                    editAccordionContent.innerHTML = '<p class="posteditor-status">Loading post data...</p>';
                    var user = getCurrentUser();
                    var memberId = user ? parseInt(user.id, 10) : 0;
                    ensureCategoriesLoaded().then(function() {
                        return fetch('/gateway.php?action=get-posts&full=1&post_id=' + postId + '&member_id=' + memberId);
                    }).then(function(r) { return r.json(); }).then(function(res) {
                        if (res && res.success && res.posts && res.posts.length > 0) {
                            var post = res.posts[0];
                            editingPostsData[postId] = { original: post, current: {} };
                            editAccordionContent.innerHTML = '';
                            renderEditForm(post, editAccordionContent, collapseAccordion, editTopSaveBtn, editTopCloseBtn);
                        } else {
                            editAccordionContent.innerHTML = '<p class="posteditor-status--error">Failed to load post data.</p>';
                        }
                    }).catch(function() {
                        editAccordionContent.innerHTML = '<p class="posteditor-status--error">Failed to load post data.</p>';
                    });
                }
            }
        });

        body.appendChild(editAccordionRow);
        body.appendChild(editAccordionContent);

        // --- Manage Content (always visible) ---
        var manageContent = document.createElement('div');
        manageContent.className = 'posteditor-manage-content';
        manageContent.innerHTML = [
            '<div class="posteditor-manage-section">',
                '<div class="member-panel-label">Extend Listing Time</div>',
                '<div class="posteditor-manage-row">',
                    '<p class="member-supporter-message">Your post is currently active. You can add extra time to your listing below.</p>',
                    '<button class="button-class-2c" style="width:100%">Add 30 Days (Placeholder)</button>',
                '</div>',
            '</div>',
            '<div class="posteditor-manage-section">',
                '<div class="member-panel-label">Change Plan</div>',
                '<div class="posteditor-manage-row">',
                    '<p class="member-supporter-message">Current Plan: Basic. Upgrade to Premium for higher visibility and map priority.</p>',
                    '<button class="button-class-2b" style="width:100%">Upgrade Plan (Placeholder)</button>',
                '</div>',
            '</div>'
        ].join('');
        body.appendChild(manageContent);

        modalContainer.appendChild(body);
        backdrop.appendChild(modalContainer);

        // Close on backdrop click
        backdrop.addEventListener('click', function(e) {
            if (e.target === backdrop) { handleClose(); }
        });

        // Close on Escape key
        var escapeHandler = function(e) {
            if (e.key === 'Escape') {
                handleClose();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        function closeModal() {
            document.removeEventListener('keydown', escapeHandler);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            activeModal = null;
        }
        function handleClose() {
            if (!isPostDirty(postId)) { discardEdits(postId); closeModal(); return; }
            if (!window.ThreeButtonDialogComponent || typeof ThreeButtonDialogComponent.show !== 'function') { discardEdits(postId); closeModal(); return; }
            ThreeButtonDialogComponent.show({
                titleText: 'Unsaved Changes',
                messageText: 'You have unsaved changes. What would you like to do?',
                cancelLabel: 'Cancel', saveLabel: 'Save', discardLabel: 'Discard', focusCancel: true
            }).then(function(choice) {
                if (choice === 'save') {
                    savePost(postId).then(function() {
                        if (window.ToastComponent && typeof ToastComponent.showSuccess === 'function') ToastComponent.showSuccess('Saved');
                        discardEdits(postId); closeModal(); refreshPostCard(postId);
                    }).catch(function(err) {
                        if (window.ToastComponent && typeof ToastComponent.showError === 'function') ToastComponent.showError('Failed to save: ' + err.message);
                    });
                } else if (choice === 'discard') {
                    discardEdits(postId); closeModal();
                    if (window.ToastComponent && typeof ToastComponent.show === 'function') ToastComponent.show('Changes discarded');
                }
            });
        }

        activeModal = { backdrop: backdrop, close: closeModal };
        panelContents.appendChild(backdrop);
    }



    function renderEditForm(post, formContainer, closeModalFn, topSaveBtn, topCloseBtn) {
        if (!post || !formContainer) return;
        
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
            formContainer.innerHTML = '<p class="posteditor-status--error">This post uses a category that is no longer available.</p>';
            return;
        }

        // 2. Render fields into container
        var fields = getFieldsForSelection(categoryName, subcategoryName);
        formContainer.innerHTML = '';
        
        if (fields.length === 0) {
            formContainer.innerHTML = '<p class="posteditor-status">No fields configured for this subcategory yet.</p>';
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
                container: formContainer,
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
                setupHeaderRenaming: true,
                onDelete: function(container, locationNumber) {
                    var headerText = container.querySelector('.member-postform-location-header-text');
                    var venueName = headerText ? headerText.textContent.trim() : ('Location ' + locationNumber);
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
                                renumberLocationContainersInAccordion(formContainer);
                                // Update quantity display
                                var allContainers = formContainer.querySelectorAll('.member-location-container');
                                var qtyDisplay = formContainer.querySelector('.member-postform-location-quantity-display');
                                if (qtyDisplay) qtyDisplay.textContent = allContainers.length;
                                // Update delete button visibility
                                if (window.FormbuilderModule && typeof FormbuilderModule.updateVenueDeleteButtons === 'function') {
                                    FormbuilderModule.updateVenueDeleteButtons();
                                }
                            }
                        });
                    }
                },
                onActivate: function(container, locationNumber) {
                    var parent = container.parentNode;
                    if (parent) {
                        parent.querySelectorAll('[data-active="true"]').forEach(function(c) {
                            c.removeAttribute('data-active');
                        });
                    }
                    container.setAttribute('data-active', 'true');
                }
            });
            
            // Populate with post data
            populateWithPostData(post, formContainer);
            
            // Renumber location containers and update headers
            renumberLocationContainersInAccordion(formContainer);
            
            // Activate first location container for wallpaper
            var firstLocContainer = formContainer.querySelector('.member-location-container');
            if (firstLocContainer) {
                firstLocContainer.setAttribute('data-active', 'true');
                // Explicitly activate wallpaper since no click event fires on form load
                try {
                    if (window.LocationWallpaperComponent && typeof LocationWallpaperComponent.handleActiveContainerChange === 'function') {
                        LocationWallpaperComponent.handleActiveContainerChange(formContainer, firstLocContainer);
                    }
                } catch (_eLW) {}
            }
            
            // Store initial extracted fields for dirty checking (must happen after populate)
            editingPostsData[post.id].original_extracted_fields = collectFormData(formContainer, post);

            // 4. Add Save and Close buttons at the bottom
            var footer = document.createElement('div');
            footer.className = 'posteditor-edit-footer';
            
            // Handle save — overlay inside the modal body, close on success
            function handleSave() {
                var overlay = document.createElement('div');
                overlay.className = 'posteditor-saving-overlay';
                overlay.innerHTML =
                    '<div class="posteditor-placeholder-spinner"></div>' +
                    '<div class="posteditor-placeholder-text">Saving...</div>';
                formContainer.appendChild(overlay);

                return savePost(post.id).then(function() {
                    overlay.innerHTML =
                        '<div class="posteditor-placeholder-check">✓</div>' +
                        '<div class="posteditor-placeholder-text">Saved!</div>';
                    setTimeout(function() {
                        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                        discardEdits(post.id);
                        if (closeModalFn) closeModalFn();
                        refreshPostCard(post.id);
                    }, 2000);
                    updateHeaderSaveDiscardState();
                }).catch(function(err) {
                    // Remove overlay — form is still visible so user can retry
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    updateFooterButtonState();
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError('Failed to save: ' + err.message);
                    }
                });
            }
            
            // Save button (green) - left - starts disabled
            var saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'posteditor-edit-button-save button-class-2c';
            saveBtn.textContent = 'Save';
            saveBtn.disabled = true;
            saveBtn.addEventListener('click', function() {
                if (saveBtn.disabled) return;
                handleSave();
            });
            
            // Close/Discard button - right - swaps based on dirty state
            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'posteditor-edit-button-close button-class-2b';
            closeBtn.textContent = 'Close';
            closeBtn.addEventListener('click', function() {
                if (isPostDirty(post.id)) {
                    // Dirty: confirm before discarding
                    if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function') {
                        ConfirmDialogComponent.show({
                            titleText: 'Discard Changes',
                            messageText: 'Are you sure you want to discard your changes?',
                            confirmLabel: 'Discard',
                            cancelLabel: 'Cancel',
                            confirmClass: 'danger',
                            focusCancel: true
                        }).then(function(confirmed) {
                            if (confirmed) {
                                discardEdits(post.id);
                                if (closeModalFn) closeModalFn();
                            }
                        });
                    } else {
                        discardEdits(post.id);
                        if (closeModalFn) closeModalFn();
                    }
                } else {
                    // Clean: just collapse
                    if (closeModalFn) closeModalFn();
                }
            });
            
            // Function to check if all fieldsets are complete
            function isFormComplete() {
                var fieldsetEls = formContainer.querySelectorAll('.fieldset[data-complete]');
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
                var fieldsetEls = formContainer.querySelectorAll('.fieldset[data-complete="false"]');
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
            
            // Function to update footer button states based on dirty check AND completeness
            function updateFooterButtonState() {
                var isDirty = isPostDirty(post.id);
                var isComplete = isFormComplete();
                var canSave = isDirty && isComplete;
                saveBtn.disabled = !canSave;
                if (topSaveBtn) topSaveBtn.disabled = !canSave;

                // Swap Close/Discard on bottom button
                if (isDirty) {
                    closeBtn.textContent = 'Discard';
                    closeBtn.className = 'posteditor-edit-button-close button-class-2d';
                } else {
                    closeBtn.textContent = 'Close';
                    closeBtn.className = 'posteditor-edit-button-close button-class-2b';
                }
                // Mirror on top button
                if (topCloseBtn) {
                    if (isDirty) {
                        topCloseBtn.textContent = 'Discard';
                        topCloseBtn.className = 'posteditor-manage-edit-close button-class-2d';
                    } else {
                        topCloseBtn.textContent = 'Close';
                        topCloseBtn.className = 'posteditor-manage-edit-close button-class-2b';
                    }
                }
            }
            
            // Attach popover to a button (posteditor-specific, not shared)
            // parentEl: element to append popover to
            // position: 'above' or 'below'
            // alignment: 'left' or 'right'
            function attachPopoverToButton(btnEl, getContentFn, parentEl, position, alignment) {
                if (!btnEl || !parentEl) return;
                if (btnEl._popoverAttached) return;
                btnEl._popoverAttached = true;
                
                var posClass = position === 'below' ? 'posteditor-popover--below' : 'posteditor-popover--above';
                var alignClass = 'posteditor-popover--' + alignment;
                
                var pop = document.createElement('div');
                pop.className = 'posteditor-popover ' + posClass + ' ' + alignClass;
                pop.hidden = true;
                
                var titleEl = document.createElement('div');
                titleEl.className = 'posteditor-popover-title';
                pop.appendChild(titleEl);
                
                var list = document.createElement('div');
                list.className = 'posteditor-popover-list';
                pop.appendChild(list);
                
                parentEl.appendChild(pop);
                
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
            
            // Attach popover to footer Save button (above, left-aligned)
            attachPopoverToButton(saveBtn, getSavePopoverContent, footer, 'above', 'left');

            // Attach identical popover to top Save button (below, left-aligned)
            if (topSaveBtn && topSaveBtn.parentNode) {
                attachPopoverToButton(topSaveBtn, getSavePopoverContent, topSaveBtn.parentNode, 'below', 'left');
            }

            // Attach change listener to mark global save state as dirty and update footer buttons
            formContainer.addEventListener('input', function() {
                updateHeaderSaveDiscardState();
                updateFooterButtonState();
            });
            formContainer.addEventListener('change', function() {
                updateHeaderSaveDiscardState();
                updateFooterButtonState();
            });
            // Also custom events from fieldsets
            formContainer.addEventListener('fieldset:sessions-change', function() {
                updateHeaderSaveDiscardState();
                updateFooterButtonState();
            });
            // Fieldset validity changes (completeness)
            formContainer.addEventListener('fieldset:validity-change', function() {
                updateFooterButtonState();
            });
            
            footer.appendChild(saveBtn);
            footer.appendChild(closeBtn);
            formContainer.appendChild(footer);
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
                            age_rating: mapCard.age_rating || 'all',
                            item_price: mapCard.item_price,
                            currency: mapCard.currency,
                            item_variants: mapCard.item_variants || [],
                            promo_option: mapCard.promo_option || 'none',
                            promo_code: mapCard.promo_code || '',
                            promo_type: mapCard.promo_type || 'percent',
                            promo_value: mapCard.promo_value || ''
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
        Object.keys(editingPostsData).forEach(function(postId) {
            if (isPostDirty(postId)) {
                anyDirty = true;
            }
        });
        return anyDirty;
    }

    function isPostDirty(postId) {
        var data = editingPostsData[postId];
        if (!data) return false;
        
        // Guard: if original_extracted_fields not set yet, can't be dirty
        if (!data.original_extracted_fields) return false;
        
        // Find form container — inside the active modal body
        var formContainer = activeModal ? activeModal.backdrop.querySelector('.posteditor-modal-body') : null;
        if (!formContainer) return false;

        // Collect current form data and compare with original
        var current = collectFormData(formContainer, data.original);
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
        var formContainer = activeModal ? activeModal.backdrop.querySelector('.posteditor-modal-body') : null;
        if (!data || !formContainer) return Promise.resolve();

        var memberCategories = getMemberCategories();
        
        // Collect current fields from form
        var fields = collectFormData(formContainer, data.original);
        
        // Collect image files from the form
        var imageFiles = [];
        var imagesMeta = '[]';
        var imagesFs = formContainer.querySelector('.fieldset[data-fieldset-type="images"], .fieldset[data-fieldset-key="images"]');
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
        var locationContainers = formContainer.querySelectorAll('.member-location-container[data-location-number]');
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
        // Clear cached data so it's re-loaded if opened again
        if (editingPostsData[postId]) {
            delete editingPostsData[postId];
        }
        updateHeaderSaveDiscardState();
    }

    function discardAllEdits() {
        Object.keys(editingPostsData).forEach(function(postId) {
            discardEdits(postId);
        });
    }

    function getDirtyPostIds() {
        var dirtyIds = [];
        Object.keys(editingPostsData).forEach(function(postId) {
            if (isPostDirty(postId)) {
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
        
        // Preserve in-progress edits when switching away and back:
        // MemberModule calls PostEditorModule.init() on tab activation.
        // If we re-init, we'd reload posts and wipe any unsaved form inputs.
        try {
            if (containerEl.dataset && containerEl.dataset.posteditorInitialized === 'true') {
                container = containerEl;
                isLoaded = true;
                return;
            }
            if (containerEl.dataset) {
                containerEl.dataset.posteditorInitialized = 'true';
            }
        } catch (_eInitFlag) {}
        
        container = containerEl;
        isLoaded = true;
        
        // Listen for favorite clicks (capture phase to fire before PostModule's stopPropagation)
        container.addEventListener('click', function(e) {
            var favBtn = e.target.closest('.post-card-button-fav');
            if (!favBtn) return;
            
            var postItem = favBtn.closest('.posteditor-item');
            if (!postItem) return;
            
            var postId = postItem.dataset.postId;
            if (!postId) return;
            
            // Small delay to let PostModule's handler update localStorage first
            setTimeout(function() {
                reorderPostsAfterFavorite(postId);
            }, 50);
        }, true); // Use capture phase
        
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
