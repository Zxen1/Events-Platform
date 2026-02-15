/* ============================================================================
   POST EDITOR MODULE - Member Panel > Post Editor Tab
   Post listing, editing, and management for member's own posts.
   ============================================================================
   
   PATTERN:
   This module follows the FormbuilderModule pattern - it owns an entire tab
   within a parent panel. MemberModule calls PostEditorModule.init() when
   the Post Editor tab is activated.
   
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
    
    var container = null;  // #member-tab-posteditor
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
     * Layout: [STATUS tier] (left) | countdown (center) | date (right)
     * Three flex items with space-between. Status and tier share the first item.
     * Color: green (7+ days), yellow (3-7 days), red (<3 days), darkgray (hidden), black (expired/deleted).
     * @param {Object} post - Post object with visibility, expires_at, deleted_at, checkout_title
     * @returns {HTMLElement} Status bar div
     */
    function buildStatusBar(post) {
        var bar = document.createElement('div');
        bar.className = 'posteditor-status-bar';

        var leftSpan = document.createElement('span');
        leftSpan.className = 'posteditor-status-bar-left';
        var statusSpan = document.createElement('span');
        statusSpan.className = 'posteditor-status-bar-status';
        var tierSpan = document.createElement('span');
        tierSpan.className = 'posteditor-status-bar-tier';
        var countdownSpan = document.createElement('span');
        countdownSpan.className = 'posteditor-status-bar-countdown';
        var dateSpan = document.createElement('span');
        dateSpan.className = 'posteditor-status-bar-date';

        // Determine status and color
        var status = '';
        var colorClass = '';
        var isDeleted = post.deleted_at && post.deleted_at !== '' && post.deleted_at !== null;
        var visibility = post.visibility || 'active';
        var expiresAt = post.expires_at ? new Date(post.expires_at) : null;
        var now = new Date();

        // Expired always wins — check expiry before hidden
        var isExpiredByDb = visibility === 'expired';
        var isExpiredByTime = expiresAt && expiresAt.getTime() <= now.getTime();

        if (isDeleted) {
            status = 'DELETED';
            colorClass = 'posteditor-status-bar--black';
            dateSpan.textContent = formatStatusDate(new Date(post.deleted_at));
        } else if (isExpiredByDb || isExpiredByTime) {
            status = 'EXPIRED';
            colorClass = 'posteditor-status-bar--black';
            if (expiresAt) {
                dateSpan.textContent = formatStatusDate(expiresAt);
            }
        } else if (visibility === 'hidden') {
            status = 'HIDDEN';
            colorClass = 'posteditor-status-bar--darkgray';
            if (expiresAt) {
                dateSpan.textContent = formatStatusDate(expiresAt);
                countdownSpan.textContent = formatCountdown(expiresAt, now);
            }
        } else {
            // Active
            if (expiresAt) {
                var msRemaining = expiresAt.getTime() - now.getTime();
                var daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
                status = 'ACTIVE';
                if (daysRemaining >= 7) {
                    colorClass = 'posteditor-status-bar--green';
                } else if (daysRemaining >= 3) {
                    colorClass = 'posteditor-status-bar--yellow';
                } else {
                    colorClass = 'posteditor-status-bar--red';
                }
                dateSpan.textContent = formatStatusDate(expiresAt);
                countdownSpan.textContent = formatCountdown(expiresAt, now);
            } else {
                status = 'ACTIVE';
                colorClass = 'posteditor-status-bar--green';
            }
        }

        bar.classList.add(colorClass);
        statusSpan.textContent = status;
        tierSpan.textContent = post.checkout_title || '';

        leftSpan.appendChild(statusSpan);
        leftSpan.appendChild(tierSpan);
        bar.appendChild(leftSpan);
        bar.appendChild(countdownSpan);
        bar.appendChild(dateSpan);

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
        
        // Insert at top of Post Editor panel
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
    function getPostTier(post) {
        var isDeleted = post.deleted_at && post.deleted_at !== '' && post.deleted_at !== null;
        if (isDeleted) return 2;
        var vis = post.visibility || 'active';
        if (vis === 'expired') return 1;
        var expiresAt = post.expires_at ? new Date(post.expires_at) : null;
        if (expiresAt && expiresAt.getTime() <= Date.now()) return 1;
        return 0; // active or hidden
    }

    function sortPostsWithFavorites(posts) {
        return posts.slice().sort(function(a, b) {
            // Tier: 0 = active/hidden, 1 = expired, 2 = deleted
            var aTier = getPostTier(a);
            var bTier = getPostTier(b);
            if (aTier !== bTier) return aTier - bTier;

            // Within tier 0, favorites come first
            if (aTier === 0) {
                var aFav = isFavorite(a.id);
                var bFav = isFavorite(b.id);
                if (aFav && !bFav) return -1;
                if (!aFav && bFav) return 1;
            }
            
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

        var anchor = document.createElement('div');
        anchor.setAttribute('data-slack-anchor', '');
        anchor.appendChild(cardEl);
        editHeader.appendChild(anchor);
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
                if (moreBtn) moreBtn.style.display = 'none';
                editTopSaveBtn.style.display = '';
                editTopCloseBtn.style.display = '';
                editAccordionContent.classList.remove('posteditor-manage-edit-content--hidden');
            } else {
                editToggleBtn.style.display = '';
                if (moreBtn) moreBtn.style.display = '';
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
            // Refresh revision list (a save may have created a new snapshot)
            loadRevisions();
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

        // --- Summary data ---
        var summaryNow = new Date();
        var summaryVisibility = post.visibility || 'active';
        var summaryExpiresAt = post.expires_at ? new Date(post.expires_at) : null;
        var summaryIsDeleted = post.deleted_at && post.deleted_at !== '' && post.deleted_at !== null;
        var summaryIsExpiredByDb = summaryVisibility === 'expired';
        var summaryIsExpiredByTime = summaryExpiresAt && summaryExpiresAt.getTime() <= summaryNow.getTime();
        var isExpired = summaryIsExpiredByDb || summaryIsExpiredByTime;

        // 1. Status
        var statusText = 'Active';
        if (summaryIsDeleted || summaryVisibility === 'deleted') statusText = 'Deleted';
        else if (isExpired) statusText = 'Expired';
        else if (summaryVisibility === 'hidden') statusText = 'Hidden';

        // 2. Tier
        var tierText = post.checkout_title || post.checkout_key || '—';

        // 3. Locations
        var locText = String(post.loc_qty || 0) + (post.loc_qty === 1 ? ' Location' : ' Locations');

        // 4. Time Remaining
        var timeText = '—';
        if (summaryIsDeleted || summaryVisibility === 'deleted') {
            timeText = 'Deleted';
        } else if (isExpired) {
            timeText = 'Expired';
        } else if (summaryExpiresAt) {
            timeText = formatCountdown(summaryExpiresAt, summaryNow);
        }

        // 5. Expiry date
        var expiryText = summaryExpiresAt ? formatStatusDate(summaryExpiresAt) : '—';

        // 6. Created
        var createdText = post.created_at ? formatStatusDate(new Date(post.created_at)) : '—';

        // --- Helper: build a labelled 36px row ---
        function buildManageRow(labelText, valueText, extraClass) {
            var group = document.createElement('div');
            group.className = 'posteditor-manage-field';
            var lbl = document.createElement('div');
            lbl.className = 'posteditor-manage-field-label';
            lbl.textContent = labelText;
            var row = document.createElement('div');
            row.className = 'posteditor-manage-field-row' + (extraClass ? ' ' + extraClass : '');
            var val = document.createElement('span');
            val.className = 'posteditor-manage-field-value';
            val.textContent = valueText;
            row.appendChild(val);
            group.appendChild(lbl);
            group.appendChild(row);
            return { group: group, row: row, value: val };
        }

        // --- Status row (with three-dot button for Hide / Delete) ---
        var statusField = buildManageRow('Status', statusText);

        // Status three-dot button
        var statusMoreBtn = document.createElement('div');
        statusMoreBtn.className = 'posteditor-manage-more';
        statusMoreBtn.innerHTML = '<div class="posteditor-manage-more-icon"></div>';

        var statusMoreMenu = document.createElement('div');
        statusMoreMenu.className = 'posteditor-manage-more-menu';

        // Hide row (toggle switch) — disabled for expired posts
        var hideRow = document.createElement('div');
        hideRow.className = 'posteditor-manage-more-item' + (isExpired ? ' posteditor-manage-more-item--disabled' : '');
        hideRow.innerHTML = '<span class="posteditor-manage-more-item-text">Hide Post</span>';
        var hideSwitch = document.createElement('label');
        hideSwitch.className = 'component-switch' + (isExpired ? ' component-switch--disabled' : '');
        var hideSwitchInput = document.createElement('input');
        hideSwitchInput.className = 'component-switch-input';
        hideSwitchInput.type = 'checkbox';
        hideSwitchInput.checked = post.visibility === 'hidden';
        var hideSwitchSlider = document.createElement('span');
        hideSwitchSlider.className = 'component-switch-slider' + (post.visibility === 'hidden' ? ' component-switch-slider--on-default' : '');
        hideSwitch.appendChild(hideSwitchInput);
        hideSwitch.appendChild(hideSwitchSlider);
        hideRow.appendChild(hideSwitch);
        statusMoreMenu.appendChild(hideRow);

        // Divider before delete
        var deleteDivider = document.createElement('div');
        deleteDivider.className = 'posteditor-manage-more-divider';
        statusMoreMenu.appendChild(deleteDivider);

        // Delete row
        var deleteRow = document.createElement('div');
        deleteRow.className = 'posteditor-manage-more-item posteditor-manage-more-delete';
        deleteRow.innerHTML = '<span class="posteditor-manage-more-item-text">Delete Post</span>';
        statusMoreMenu.appendChild(deleteRow);

        statusMoreBtn.appendChild(statusMoreMenu);
        statusField.row.appendChild(statusMoreBtn);
        body.appendChild(statusField.group);

        // Status menu toggle
        var statusMenuOpen = false;
        function setStatusMenuOpen(open) {
            statusMenuOpen = open;
            if (open) {
                statusMoreMenu.classList.add('posteditor-manage-more-menu--open');
            } else {
                statusMoreMenu.classList.remove('posteditor-manage-more-menu--open');
            }
        }

        statusMoreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (e.target.closest('.posteditor-manage-more-item') || e.target.closest('.component-switch')) return;
            setStatusMenuOpen(!statusMenuOpen);
        });

        // Close status menu when clicking outside
        var statusOutsideHandler = function(e) {
            if (!backdrop.parentNode) {
                document.removeEventListener('click', statusOutsideHandler);
                return;
            }
            if (statusMenuOpen && !statusMoreBtn.contains(e.target)) {
                setStatusMenuOpen(false);
            }
        };
        document.addEventListener('click', statusOutsideHandler);

        // Hide toggle handler — instant, no dialog
        hideRow.addEventListener('click', function(e) {
            e.stopPropagation();
            if (e.target.classList.contains('component-switch-input')) return;
            if (isExpired) return;
            var willHide = !hideSwitchSlider.classList.contains('component-switch-slider--on-default');
            var user = getCurrentUser();
            var mId = user ? parseInt(user.id, 10) : 0;
            var mType = user ? (user.type || 'member') : 'member';
            var newVisibility = willHide ? 'hidden' : 'active';
            fetch('/gateway.php?action=edit-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    member_id: mId,
                    member_type: mType,
                    manage_action: 'toggle_visibility',
                    visibility: newVisibility
                })
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res && res.success) {
                    hideSwitchInput.checked = !hideSwitchInput.checked;
                    hideSwitchSlider.classList.toggle('component-switch-slider--on-default');
                    post.visibility = newVisibility;
                    if (editingPostsData[postId] && editingPostsData[postId].original) {
                        editingPostsData[postId].original.visibility = newVisibility;
                    }
                    // Update status text
                    statusField.value.textContent = newVisibility === 'hidden' ? 'Hidden' : 'Active';
                    // Rebuild modal status bar
                    var oldModalBar = modalContainer.querySelector('.posteditor-status-bar');
                    if (oldModalBar) {
                        var newModalBar = buildStatusBar(post);
                        oldModalBar.parentNode.replaceChild(newModalBar, oldModalBar);
                    }
                    // Rebuild Post Editor card status bar
                    var postItem = document.querySelector('.posteditor-item[data-post-id="' + postId + '"]');
                    if (postItem) {
                        var oldBar = postItem.querySelector('.posteditor-status-bar');
                        if (oldBar) {
                            var newBar = buildStatusBar(post);
                            oldBar.parentNode.replaceChild(newBar, oldBar);
                        }
                    }
                    App.emit('post:updated', { post_id: postId });
                }
            });
        });

        // Delete handler
        deleteRow.addEventListener('click', function(e) {
            e.stopPropagation();
            setStatusMenuOpen(false);
            if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function' && typeof window.getMessage === 'function') {
                window.getMessage('msg_posteditor_confirm_delete', {}, false).then(function(msg) {
                    if (!msg) return;
                    ConfirmDialogComponent.show({
                        titleText: 'Delete Post',
                        messageText: msg,
                        confirmLabel: 'Delete',
                        cancelLabel: 'Cancel',
                        confirmClass: 'danger',
                        focusCancel: true
                    }).then(function(confirmed) {
                        if (confirmed) {
                            // TODO: call backend to soft-delete post
                        }
                    });
                });
            }
        });

        // --- Tier row ---
        var tierField = buildManageRow('Tier', tierText);
        body.appendChild(tierField.group);

        // --- Locations row ---
        var locField = buildManageRow('Locations', locText);
        body.appendChild(locField.group);

        // --- Time Remaining row ---
        var timeField = buildManageRow('Time Remaining', timeText);
        body.appendChild(timeField.group);

        // --- Expires row ---
        var expiryField = buildManageRow('Expires', expiryText);
        body.appendChild(expiryField.group);

        // --- Created row ---
        var createdField = buildManageRow('Created', createdText);
        body.appendChild(createdField.group);

        // --- Restore three-dot button (beside Edit) ---
        var moreBtn = document.createElement('div');
        moreBtn.className = 'posteditor-manage-more';
        moreBtn.innerHTML = '<div class="posteditor-manage-more-icon"></div>';

        var moreMenu = document.createElement('div');
        moreMenu.className = 'posteditor-manage-more-menu';

        // Restore heading
        var restoreHeading = document.createElement('div');
        restoreHeading.className = 'posteditor-manage-more-heading';
        restoreHeading.textContent = 'Restore';
        moreMenu.appendChild(restoreHeading);

        // Placeholder for restore items (populated async)
        var restoreContainer = document.createElement('div');
        restoreContainer.className = 'posteditor-manage-more-restore-list';
        restoreContainer.innerHTML = '<div class="posteditor-manage-more-item posteditor-manage-more-item--loading"><span class="posteditor-manage-more-item-text">Loading...</span></div>';
        moreMenu.appendChild(restoreContainer);

        moreBtn.appendChild(moreMenu);
        editAccordionRow.appendChild(moreBtn);

        // Restore menu toggle
        var moreMenuOpen = false;
        function setMoreMenuOpen(open) {
            moreMenuOpen = open;
            if (open) {
                moreMenu.classList.add('posteditor-manage-more-menu--open');
            } else {
                moreMenu.classList.remove('posteditor-manage-more-menu--open');
            }
        }

        moreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (e.target.closest('.posteditor-manage-more-item')) return;
            setMoreMenuOpen(!moreMenuOpen);
        });

        // Close restore menu when clicking outside
        var outsideClickHandler = function(e) {
            if (!backdrop.parentNode) {
                document.removeEventListener('click', outsideClickHandler);
                return;
            }
            if (moreMenuOpen && !moreBtn.contains(e.target)) {
                setMoreMenuOpen(false);
            }
        };
        document.addEventListener('click', outsideClickHandler);

        // Fetch and populate restore items
        function loadRevisions() {
            var user = getCurrentUser();
            var mId = user ? parseInt(user.id, 10) : 0;
            var mType = user ? (user.type || 'member') : 'member';
            fetch('/gateway.php?action=restore-post&post_id=' + postId + '&member_id=' + mId + '&member_type=' + encodeURIComponent(mType))
                .then(function(r) { return r.json(); })
                .then(function(res) {
                    restoreContainer.innerHTML = '';
                    if (!res || !res.success || !res.revisions || res.revisions.length === 0) {
                        var emptyRow = document.createElement('div');
                        emptyRow.className = 'posteditor-manage-more-item posteditor-manage-more-item--disabled';
                        emptyRow.innerHTML = '<span class="posteditor-manage-more-item-text">No restore points</span>';
                        restoreContainer.appendChild(emptyRow);
                        return;
                    }
                    res.revisions.forEach(function(rev) {
                        var typeLabel = rev.change_type === 'create' ? 'Original' : 'Save';
                        var dateStr = rev.created_at || '';
                        try {
                            var d = new Date(dateStr.replace(' ', 'T') + 'Z');
                            dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                        } catch (e) { /* keep raw */ }

                        var revRow = document.createElement('div');
                        revRow.className = 'posteditor-manage-more-item posteditor-manage-more-restore';
                        revRow.innerHTML = '<span class="posteditor-manage-more-item-text">' + typeLabel + ' — ' + dateStr + '</span>';
                        revRow.addEventListener('click', (function(revData, revDateStr) {
                            return function(e) {
                                e.stopPropagation();
                                var msgKey = revData.change_type === 'create' ? 'msg_posteditor_confirm_restore_original' : 'msg_posteditor_confirm_restore_snapshot';
                                var msgParams = revData.change_type === 'create' ? {} : { date: revDateStr };
                                setMoreMenuOpen(false);
                                if (window.ConfirmDialogComponent && typeof ConfirmDialogComponent.show === 'function' && typeof window.getMessage === 'function') {
                                    window.getMessage(msgKey, msgParams, false).then(function(msg) {
                                        if (!msg) return;
                                        ConfirmDialogComponent.show({
                                            titleText: 'Restore Post',
                                            messageText: msg,
                                            confirmLabel: 'Restore',
                                            cancelLabel: 'Cancel',
                                            confirmClass: 'danger',
                                            focusCancel: true
                                        }).then(function(confirmed) {
                                            if (confirmed) {
                                                performRestore(revData.id);
                                            }
                                        });
                                    });
                                }
                            };
                        })(rev, dateStr));
                        restoreContainer.appendChild(revRow);
                    });
                })
                .catch(function() {
                    restoreContainer.innerHTML = '';
                    var errRow = document.createElement('div');
                    errRow.className = 'posteditor-manage-more-item posteditor-manage-more-item--disabled';
                    errRow.innerHTML = '<span class="posteditor-manage-more-item-text">Failed to load</span>';
                    restoreContainer.appendChild(errRow);
                });
        }
        loadRevisions();

        function performRestore(revisionId) {
            var user = getCurrentUser();
            var mId = user ? parseInt(user.id, 10) : 0;
            var mType = user ? (user.type || 'member') : 'member';
            setMoreMenuOpen(false);
            fetch('/gateway.php?action=restore-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revision_id: revisionId, member_id: mId, member_type: mType })
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res && res.success) {
                    if (window.ToastComponent && typeof ToastComponent.showSuccess === 'function') {
                        var msg = res.message || 'Post restored successfully.';
                        if (res.skipped_columns && res.skipped_columns.length > 0) {
                            msg += ' (' + res.skipped_columns.length + ' column(s) skipped)';
                        }
                        ToastComponent.showSuccess(msg);
                    }
                    refreshPostCard(postId);
                    editFormLoaded = false;
                    editAccordionContent.innerHTML = '';
                    setAccordionExpanded(false);
                } else {
                    var errMsg = (res && res.message) ? res.message : 'Restore failed.';
                    if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                        ToastComponent.showError(errMsg);
                    } else {
                        alert(errMsg);
                    }
                }
            })
            .catch(function() {
                if (window.ToastComponent && typeof ToastComponent.showError === 'function') {
                    ToastComponent.showError('Network error during restore.');
                } else {
                    alert('Network error during restore.');
                }
            });
        }

        // --- Terms and Conditions row ---
        var termsWrapper = document.createElement('div');
        termsWrapper.className = 'fieldset posteditor-manage-terms';

        var checkboxWrapper = document.createElement('label');
        checkboxWrapper.className = 'posteditor-manage-terms-label';

        var termsCheckbox = document.createElement('input');
        termsCheckbox.type = 'checkbox';
        termsCheckbox.className = 'posteditor-manage-terms-checkbox';

        var termsLabelText = document.createElement('span');
        termsLabelText.className = 'posteditor-manage-terms-text';
        termsLabelText.textContent = 'I agree to the ';

        var termsLink = document.createElement('a');
        termsLink.href = '#';
        termsLink.className = 'posteditor-manage-terms-link';
        termsLink.textContent = 'Terms and Conditions';
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.MemberModule && typeof MemberModule.openTermsModal === 'function') {
                MemberModule.openTermsModal();
            }
        });

        checkboxWrapper.appendChild(termsCheckbox);
        checkboxWrapper.appendChild(termsLabelText);
        checkboxWrapper.appendChild(termsLink);
        termsWrapper.appendChild(checkboxWrapper);
        body.appendChild(termsWrapper);

        // Check the checkbox when user clicks Agree in the terms modal
        var termsAgreedHandler = function() {
            termsCheckbox.checked = true;
        };
        if (window.App && typeof App.on === 'function') {
            App.on('terms:agreed', termsAgreedHandler);
        }

        // --- Submit buttons ---
        var manageActionsWrapper = document.createElement('div');
        manageActionsWrapper.className = 'posteditor-manage-actions';

        var manageSubmitBtn = document.createElement('button');
        manageSubmitBtn.type = 'button';
        manageSubmitBtn.className = 'posteditor-manage-submit button-class-2b';
        manageSubmitBtn.textContent = 'Submit';
        manageSubmitBtn.disabled = true;
        manageActionsWrapper.appendChild(manageSubmitBtn);

        var user = getCurrentUser();
        if (user && user.isAdmin) {
            var manageAdminSubmitBtn = document.createElement('button');
            manageAdminSubmitBtn.type = 'button';
            manageAdminSubmitBtn.className = 'posteditor-manage-admin-submit button-class-2c';
            manageAdminSubmitBtn.textContent = 'Admin: Submit Free';
            manageAdminSubmitBtn.disabled = true;
            manageActionsWrapper.appendChild(manageAdminSubmitBtn);
        }

        body.appendChild(manageActionsWrapper);

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
            if (window.App && typeof App.off === 'function') {
                App.off('terms:agreed', termsAgreedHandler);
            }
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
                        if (typeof window.getMessage === 'function') {
                            window.getMessage('msg_member_saved', {}, false).then(function(msg) {
                                if (msg && window.ToastComponent && typeof ToastComponent.showSuccess === 'function') ToastComponent.showSuccess(msg);
                            });
                        }
                        discardEdits(postId); closeModal(); refreshPostCard(postId);
                    }).catch(function(err) {
                        if (typeof window.getMessage === 'function') {
                            window.getMessage('msg_admin_save_error_response', {}, false).then(function(msg) {
                                if (msg && window.ToastComponent && typeof ToastComponent.showError === 'function') ToastComponent.showError(msg);
                            });
                        }
                    });
                } else if (choice === 'discard') {
                    discardEdits(postId); closeModal();
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
                                // Update quantity display as fraction (active / paid)
                                var allContainers = formContainer.querySelectorAll('.member-location-container');
                                var qtyDisplay = formContainer.querySelector('.member-postform-location-quantity-display');
                                if (qtyDisplay) qtyDisplay.textContent = allContainers.length + '/' + (post.loc_paid || 1);
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

            // Show location fraction in quantity display (edit mode only)
            var qtyDisplay = formContainer.querySelector('.member-postform-location-quantity-display');
            if (qtyDisplay) {
                var activeCount = formContainer.querySelectorAll('.member-location-container').length;
                var paidCount = post.loc_paid || 1;
                qtyDisplay.textContent = activeCount + '/' + paidCount;
            }
            
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
            
            // Handle save — overlay covers entire modal container
            function handleSave() {
                var overlay = document.createElement('div');
                overlay.className = 'posteditor-saving-overlay';
                overlay.innerHTML =
                    '<div class="posteditor-placeholder-spinner"></div>' +
                    '<div class="posteditor-placeholder-text">Saving...</div>';
                var modalEl = formContainer.closest('.posteditor-modal-container') || formContainer;
                modalEl.appendChild(overlay);

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
                    // Success toast (message system)
                    if (typeof window.getMessage === 'function') {
                        window.getMessage('msg_member_saved', {}, false).then(function(msg) {
                            if (msg && window.ToastComponent && typeof ToastComponent.showSuccess === 'function') {
                                ToastComponent.showSuccess(msg);
                            }
                        });
                    }
                }).catch(function(err) {
                    // Remove overlay — form is still visible so user can retry
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    updateFooterButtonState();
                    if (typeof window.getMessage === 'function') {
                        window.getMessage('msg_admin_save_error_response', {}, false).then(function(msg) {
                            if (msg && window.ToastComponent && typeof ToastComponent.showError === 'function') {
                                ToastComponent.showError(msg);
                            }
                        });
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
                            suburb: mapCard.suburb,
                            city: mapCard.city,
                            state: mapCard.state,
                            postcode: mapCard.postcode,
                            country_name: mapCard.country_name,
                            country_code: mapCard.country_code,
                            latitude: mapCard.latitude,
                            longitude: mapCard.longitude
                        };
                        break;
                    case 'city':
                        val = {
                            suburb: mapCard.suburb,
                            city: mapCard.city,
                            state: mapCard.state,
                            postcode: mapCard.postcode,
                            country_name: mapCard.country_name,
                            country_code: mapCard.country_code,
                            latitude: mapCard.latitude,
                            longitude: mapCard.longitude
                        };
                        break;
                    case 'address':
                    case 'location':
                        val = {
                            address_line: mapCard.address_line,
                            suburb: mapCard.suburb,
                            city: mapCard.city,
                            state: mapCard.state,
                            postcode: mapCard.postcode,
                            country_name: mapCard.country_name,
                            country_code: mapCard.country_code,
                            latitude: mapCard.latitude,
                            longitude: mapCard.longitude
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
            containerEl = document.getElementById('member-tab-posteditor');
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
        
        // Listen for postcard clicks — fly to location (active) or show toast (hidden/expired/deleted)
        container.addEventListener('click', function(e) {
            // Skip clicks on buttons (manage, fav, etc.)
            if (e.target.closest('.posteditor-button-manage') || e.target.closest('.post-card-button-fav')) return;
            
            var postCard = e.target.closest('.post-card');
            if (!postCard) return;
            
            var postItem = postCard.closest('.posteditor-item');
            if (!postItem) return;
            
            var postId = postItem.dataset.postId;
            if (!postId) return;
            
            // Find post in current data
            var post = null;
            for (var i = 0; i < currentPosts.length; i++) {
                if (String(currentPosts[i].id) === String(postId)) {
                    post = currentPosts[i];
                    break;
                }
            }
            if (!post) return;
            
            // Determine post state
            var isDeleted = post.deleted_at && post.deleted_at !== '' && post.deleted_at !== null;
            var visibility = post.visibility || 'active';
            var expiresAt = post.expires_at ? new Date(post.expires_at) : null;
            var now = new Date();
            var isExpiredByDb = visibility === 'expired';
            var isExpiredByTime = expiresAt && expiresAt.getTime() <= now.getTime();
            
            if (isDeleted) {
                // Toast: deleted
                if (typeof window.getMessage === 'function') {
                    window.getMessage('msg_posteditor_toast_deleted', {}, false).then(function(msg) {
                        if (msg && window.ToastComponent) ToastComponent.showWarning(msg);
                    });
                }
            } else if (isExpiredByDb || isExpiredByTime) {
                // Toast: expired
                if (typeof window.getMessage === 'function') {
                    window.getMessage('msg_posteditor_toast_expired', {}, false).then(function(msg) {
                        if (msg && window.ToastComponent) ToastComponent.showWarning(msg);
                    });
                }
            } else if (visibility === 'hidden') {
                // Toast: hidden
                if (typeof window.getMessage === 'function') {
                    window.getMessage('msg_posteditor_toast_hidden', {}, false).then(function(msg) {
                        if (msg && window.ToastComponent) ToastComponent.showWarning(msg);
                    });
                }
            } else {
                // Active — open the post synchronously so TopSlack can anchor.
                // Fly-to is handled by the location menu inside the post instead.
                if (window.PostModule && typeof PostModule.openPost === 'function') {
                    PostModule.openPost(post, { source: 'posteditor', originEl: postCard });
                }
            }
        });
        
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
