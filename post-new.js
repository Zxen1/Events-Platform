/* ============================================================================
   POST.JS - POST SECTION (includes Recent)
   ============================================================================
   
   Controls the Post panel and Recent panel.
   
   CONTAINS:
   - Post cards (thumbnail, title, category, location, dates, favourite)
   - Recent cards (with "last opened" timestamps)
   - Open post view:
     - Sticky header
     - Venue menu
     - Session menu
     - Post details (location, price, dates)
     - Description (see more/less)
     - Posted by section
     - Images gallery
   - Share button
   - Favourite star
   - Mascot illustration (recent panel)
   
   CONTAINERS:
   - (TBD - need to name all post containers)
   
   DEPENDENCIES:
   - index.js (backbone)
   
   COMMUNICATES WITH:
   - map.js (clicking cards highlights markers)
   - filter.js (filters affect visible posts)
   - header.js (mode switch)
   
   ============================================================================ */

const PostModule = (function() {
  'use strict';

  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */

  var panelsContainerEl = null;
  var postPanelEl = null;
  var postPanelContentEl = null;
  var postListEl = null;
  var recentPanelEl = null;
  var recentPanelContentEl = null;

  var currentMode = 'map';
  var lastZoom = null;
  var postsEnabled = false;

  var modeButtonsBound = false;

  // Post data cache
  var cachedPosts = null;
  var postsLoading = false;
  var postsError = null;

  // Panel motion state (kept in-module for cleanliness; no DOM-stashed handlers).
  var panelMotion = {
    post: { token: 0, hideHandler: null, hideTimeoutId: 0 },
    recent: { token: 0, hideHandler: null, hideTimeoutId: 0 }
  };

  /* --------------------------------------------------------------------------
     INIT
     -------------------------------------------------------------------------- */

  function init() {
    panelsContainerEl = document.querySelector('.post-mode-panels');
    if (!panelsContainerEl) {
      throw new Error('[Post] .post-mode-panels container not found.');
    }

    ensurePanelsDom();
    attachButtonAnchors();
    bindAppEvents();
    bindModeButtons();

    // Capture initial mode (HeaderModule already ran, but PostModule may have missed the event).
    currentMode = inferCurrentModeFromHeader() || 'map';
    applyMode(currentMode);

    // Initialize zoom gating if we can.
    primeZoomFromMapIfAvailable();
    updatePostsButtonState();
  }

  function ensurePanelsDom() {
    // Recent panel
    recentPanelEl = panelsContainerEl.querySelector('.recent-panel');
    if (!recentPanelEl) {
      recentPanelEl = document.createElement('aside');
      recentPanelEl.className = 'recent-panel';
      recentPanelEl.setAttribute('aria-hidden', 'true');
      recentPanelEl.setAttribute('role', 'dialog');
      panelsContainerEl.appendChild(recentPanelEl);
    }

    recentPanelContentEl = recentPanelEl.querySelector('.recent-panel-content');
    if (!recentPanelContentEl) {
      recentPanelContentEl = document.createElement('div');
      recentPanelContentEl.className = 'recent-panel-content recent-panel-content--side-left recent-panel-content--hidden';
      recentPanelEl.appendChild(recentPanelContentEl);
    }

    // Posts panel
    postPanelEl = panelsContainerEl.querySelector('.post-panel');
    if (!postPanelEl) {
      postPanelEl = document.createElement('aside');
      postPanelEl.className = 'post-panel';
      postPanelEl.setAttribute('aria-hidden', 'true');
      postPanelEl.setAttribute('role', 'dialog');
      panelsContainerEl.appendChild(postPanelEl);
    }

    postPanelContentEl = postPanelEl.querySelector('.post-panel-content');
    if (!postPanelContentEl) {
      postPanelContentEl = document.createElement('div');
      postPanelContentEl.className = 'post-panel-content post-panel-content--side-left post-panel-content--hidden';
      postPanelEl.appendChild(postPanelContentEl);
    }

    postListEl = postPanelContentEl.querySelector('.post-list');
    if (!postListEl) {
      postListEl = document.createElement('div');
      postListEl.className = 'post-list';
      postPanelContentEl.appendChild(postListEl);
    }
  }

  function bindAppEvents() {
    if (!window.App || typeof App.on !== 'function') {
      throw new Error('[Post] App event bus is required.');
    }

    App.on('mode:changed', function(data) {
      if (!data || !data.mode) return;
      currentMode = data.mode;
      applyMode(currentMode);
    });

    App.on('map:ready', function(data) {
      try {
        var map = data && data.map;
        if (map && typeof map.getZoom === 'function') {
          lastZoom = map.getZoom();
          updatePostsButtonState();
        }
      } catch (e) {
        // ignore
      }
    });

    App.on('map:boundsChanged', function(data) {
      if (!data) return;
      if (typeof data.zoom === 'number') {
        lastZoom = data.zoom;
        updatePostsButtonState();
      }
    });
  }

  function bindModeButtons() {
    if (modeButtonsBound) return;
    modeButtonsBound = true;

    var postsBtn = getModeButton('posts');
    var recentBtn = getModeButton('recent');
    var mapBtn = getModeButton('map');

    // Posts lockout + "toggle back to map" behavior (capture so HeaderModule doesn't eat it).
    if (postsBtn) {
      postsBtn.addEventListener('click', function(e) {
        // If posts is locked out, block mode switch and show zoom toast.
        if (!postsEnabled) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          }
          showZoomToast();
          return false;
        }

        // If already in posts mode, clicking posts returns to map (like live site).
        if (currentMode === 'posts' && mapBtn) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          }
          mapBtn.click();
          return false;
        }
      }, true);
    }

    // Recent is always allowed, but clicking when already active returns to map (like live site).
    if (recentBtn && mapBtn) {
      recentBtn.addEventListener('click', function(e) {
        if (currentMode !== 'recent') return;
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
        mapBtn.click();
        return false;
      }, true);
    }
  }

  /* --------------------------------------------------------------------------
     MODE / VISIBILITY
     -------------------------------------------------------------------------- */

  function applyMode(mode) {
    // Enforce posts zoom lock (if we drop below threshold while in posts mode).
    if (mode === 'posts' && !postsEnabled) {
      forceMapMode();
      return;
    }

    if (postPanelEl && postPanelContentEl) {
      var showPosts = (mode === 'posts');
      togglePanel(postPanelEl, postPanelContentEl, 'post', showPosts);
      if (showPosts) {
        // Load posts from API (or use cached data)
        if (cachedPosts && cachedPosts.length) {
          renderPostList(cachedPosts);
        } else {
          loadPosts();
        }
      }
    }

    if (recentPanelEl && recentPanelContentEl) {
      var showRecent = (mode === 'recent');
      togglePanel(recentPanelEl, recentPanelContentEl, 'recent', showRecent);
      if (showRecent) {
        renderRecentEmptyState();
      }
    }
  }

  function togglePanel(panelEl, contentEl, panelKey, shouldShow) {
    if (!panelEl || !contentEl) return;

    var panelShowClass = panelKey + '-panel--show';
    var visibleClass = panelKey + '-panel-content--visible';
    var hiddenClass = panelKey + '-panel-content--hidden';
    var m = panelMotion[panelKey];
    if (!m) {
      // Should never happen (only "post" and "recent"), but keep it safe.
      m = { token: 0, hideHandler: null, hideTimeoutId: 0 };
      panelMotion[panelKey] = m;
    }

    function clearPendingHide() {
      if (m.hideHandler) {
        contentEl.removeEventListener('transitionend', m.hideHandler);
        m.hideHandler = null;
      }
      if (m.hideTimeoutId) {
        clearTimeout(m.hideTimeoutId);
        m.hideTimeoutId = 0;
      }
    }

    function getTransitionDurationMs() {
      var durationMs = 300;
      try {
        var cs = window.getComputedStyle(contentEl);
        var dur = (cs && cs.transitionDuration) ? String(cs.transitionDuration).split(',')[0].trim() : '';
        if (dur.endsWith('ms')) durationMs = Math.max(0, parseFloat(dur) || 0);
        else if (dur.endsWith('s')) durationMs = Math.max(0, (parseFloat(dur) || 0) * 1000);
      } catch (e) {
        // ignore
      }
      return Math.max(0, Math.ceil(durationMs));
    }

    if (shouldShow) {
      clearPendingHide();
      m.token += 1;
      var token = m.token;

      // Show (force a frame between "off-screen" and "visible" so the slide-in
      // always transitions at the same speed as slide-out)
      panelEl.classList.add(panelShowClass);
      panelEl.setAttribute('aria-hidden', 'false');

      // Ensure we start from the hidden/off-screen state.
      contentEl.classList.remove(visibleClass);
      contentEl.classList.add(hiddenClass);

      // Force the browser to apply the initial transform before we switch to visible.
      try { void contentEl.offsetWidth; } catch (e) {}

      requestAnimationFrame(function() {
        if (m.token !== token) return;
        contentEl.classList.remove(hiddenClass);
        contentEl.classList.add(visibleClass);
      });
      return;
    }

    // Hide (slide out, then remove from display)
    m.token += 1; // invalidates any pending open RAF
    clearPendingHide();

    var isShown = panelEl.classList.contains(panelShowClass);
    var isVisible = contentEl.classList.contains(visibleClass);

    panelEl.setAttribute('aria-hidden', 'true');

    // If not shown/visible, there's nothing to animate (already off-screen).
    if (!isShown || !isVisible) {
      contentEl.classList.remove(visibleClass);
      contentEl.classList.add(hiddenClass);
      panelEl.classList.remove(panelShowClass);
      return;
    }

    // Start slide-out.
    contentEl.classList.remove(visibleClass);
    contentEl.classList.add(hiddenClass);

    var durationMs2 = getTransitionDurationMs();
    var finalized2 = false;
    function finalizeHide2() {
      if (finalized2) return;
      finalized2 = true;
      clearPendingHide();
      panelEl.classList.remove(panelShowClass);
    }

    m.hideHandler = function(e) {
      if (e && e.target !== contentEl) return;
      if (!contentEl.classList.contains(hiddenClass)) return;
      finalizeHide2();
    };
    contentEl.addEventListener('transitionend', m.hideHandler, { once: true });
    m.hideTimeoutId = setTimeout(finalizeHide2, durationMs2 + 50);
  }

  function forceMapMode() {
    var mapBtn = getModeButton('map');
    if (mapBtn) {
      mapBtn.click();
    }
  }

  /* --------------------------------------------------------------------------
     POSTS ENABLED STATE (Zoom gate)
     -------------------------------------------------------------------------- */

  function getPostsMinZoom() {
    if (window.App && typeof App.getConfig === 'function') {
      return App.getConfig('postsLoadZoom');
    }
    return 8;
  }

  function updatePostsButtonState() {
    var threshold = getPostsMinZoom();
    postsEnabled = (typeof lastZoom === 'number') ? (lastZoom >= threshold) : false;

    var postsBtn = getModeButton('posts');
    if (postsBtn) {
      postsBtn.setAttribute('aria-disabled', postsEnabled ? 'false' : 'true');
    }

    if (!postsEnabled && currentMode === 'posts') {
      forceMapMode();
    }
  }

  function primeZoomFromMapIfAvailable() {
    try {
      if (window.MapModule && typeof MapModule.getMap === 'function') {
        var map = MapModule.getMap();
        if (map && typeof map.getZoom === 'function') {
          lastZoom = map.getZoom();
        }
      }
    } catch (e) {
      // ignore
    }
  }

  /* --------------------------------------------------------------------------
     POST LOADING
     -------------------------------------------------------------------------- */

  /**
   * Load posts from the API
   * @param {Object} options - Optional filters (bounds, subcategory_key, limit, offset)
   * @returns {Promise}
   */
  function loadPosts(options) {
    if (postsLoading) return Promise.resolve(cachedPosts);

    postsLoading = true;
    postsError = null;

    var params = new URLSearchParams();
    params.append('limit', String((options && options.limit) || 50));
    params.append('offset', String((options && options.offset) || 0));

    if (options && options.bounds) {
      params.append('bounds', options.bounds);
    }
    if (options && options.subcategory_key) {
      params.append('subcategory_key', options.subcategory_key);
    }

    return fetch('/gateway.php?action=get-posts&' + params.toString())
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to load posts: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        postsLoading = false;
        if (data.success && Array.isArray(data.posts)) {
          cachedPosts = data.posts;
          renderPostList(data.posts);
          return data.posts;
        } else {
          postsError = data.message || 'Unknown error';
          renderPostsEmptyState();
          return [];
        }
      })
      .catch(function(err) {
        postsLoading = false;
        postsError = err.message || 'Network error';
        console.error('[Post] loadPosts error:', err);
        renderPostsEmptyState();
        return [];
      });
  }

  /* --------------------------------------------------------------------------
     POST RENDERING
     -------------------------------------------------------------------------- */

  /**
   * Get thumbnail URL for a post
   * Uses first image from first map card's media_urls
   * @param {Object} post - Post data from API
   * @returns {string} Image URL or empty string
   */
  function getPostThumbnailUrl(post) {
    // Get first map card
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
    if (!mapCard) return '';

    // Use media_urls array (populated by backend)
    var mediaUrls = mapCard.media_urls;
    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      return mediaUrls[0];
    }

    // Fallback: return empty (CSS will show placeholder background)
    return '';
  }

  /**
   * Get subcategory icon URL
   * @param {string} subcategoryKey - Subcategory key (e.g., 'live-gigs')
   * @returns {string} Icon URL or empty string
   */
  function getSubcategoryIconUrl(subcategoryKey) {
    if (!subcategoryKey) return '';

    // Check global subcategoryIconPaths (populated by form loader)
    var iconPaths = window.subcategoryIconPaths || {};

    // Try direct key match first
    if (iconPaths[subcategoryKey]) {
      return iconPaths[subcategoryKey];
    }

    // Try lowercase name key format
    var nameKey = 'name:' + subcategoryKey.toLowerCase();
    if (iconPaths[nameKey]) {
      return iconPaths[nameKey];
    }

    return '';
  }

  /**
   * Get subcategory display info (category name, subcategory name)
   * @param {string} subcategoryKey - Subcategory key
   * @returns {Object} { category: string, subcategory: string }
   */
  function getSubcategoryInfo(subcategoryKey) {
    var result = { category: '', subcategory: '' };
    if (!subcategoryKey) return result;

    // Check global categories array
    var categories = window.categories;
    if (!Array.isArray(categories)) return result;

    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      if (!cat || !cat.name) continue;

      // Check if any sub matches the key
      var subs = cat.subs || [];
      for (var j = 0; j < subs.length; j++) {
        var sub = subs[j];
        var subName = (typeof sub === 'string') ? sub : (sub && sub.name);
        if (!subName) continue;

        // Convert subcategory name to key format for comparison
        var keyFromName = subName.toLowerCase().replace(/\s+/g, '-');
        if (keyFromName === subcategoryKey) {
          result.category = cat.name;
          result.subcategory = subName;
          return result;
        }
      }
    }

    // If not found, use key as display name
    result.subcategory = subcategoryKey.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    return result;
  }

  /**
   * Render a single post card
   * @param {Object} post - Post data from API
   * @returns {HTMLElement} Post card element
   */
  function renderPostCard(post) {
    var el = document.createElement('article');
    el.className = 'post-card';
    el.dataset.id = String(post.id);
    el.dataset.postKey = post.post_key || '';

    // Get first map card data
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;

    // Get display data
    var title = (mapCard && mapCard.title) || post.checkout_title || '';
    var venueName = (mapCard && mapCard.venue_name) || '';
    var addressLine = (mapCard && mapCard.address_line) || '';
    var location = venueName || addressLine || '';
    var sessionSummary = (mapCard && mapCard.session_summary) || '';
    var priceSummary = (mapCard && mapCard.price_summary) || '';

    // Get subcategory info
    var subcategoryKey = post.subcategory_key || (mapCard && mapCard.subcategory_key) || '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = getSubcategoryIconUrl(subcategoryKey);

    // Get thumbnail
    var thumbUrl = getPostThumbnailUrl(post);

    // Build HTML
    var thumbHtml = thumbUrl
      ? '<img class="post-card-thumb" loading="lazy" src="' + thumbUrl + '" alt="" />'
      : '<div class="post-card-thumb post-card-thumb--empty"></div>';

    var iconHtml = iconUrl
      ? '<span class="post-card-subicon"><img class="post-card-subicon-image" src="' + iconUrl + '" alt="" /></span>'
      : '';

    var catLineText = subInfo.category && subInfo.subcategory
      ? subInfo.category + ' &gt; ' + subInfo.subcategory
      : subInfo.subcategory || subcategoryKey;

    el.innerHTML = [
      thumbHtml,
      '<div class="post-card-meta">',
        '<div class="post-card-catline">' + iconHtml + '<span>' + catLineText + '</span></div>',
        '<h3 class="post-card-title">' + escapeHtml(title) + '</h3>',
        '<div class="post-card-info">',
          location ? '<div class="post-card-info-row"><span class="post-card-badge">📍</span><span>' + escapeHtml(location) + '</span></div>' : '',
          sessionSummary ? '<div class="post-card-info-row"><span class="post-card-badge">📅</span><span>' + escapeHtml(sessionSummary) + '</span></div>' : '',
          priceSummary ? '<div class="post-card-info-row"><span class="post-card-badge">💰</span><span>' + escapeHtml(priceSummary) + '</span></div>' : '',
        '</div>',
      '</div>',
      '<div class="post-card-actions">',
        '<button class="post-card-fav" aria-pressed="false" aria-label="Toggle favourite">',
          '<svg class="post-card-fav-icon" viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>',
        '</button>',
      '</div>'
    ].join('');

    // Click handler for opening post
    el.addEventListener('click', function(e) {
      // Don't open if clicking favorite button
      if (e.target.closest('.post-card-fav')) return;
      openPost(post);
    });

    // Favorite toggle handler
    var favBtn = el.querySelector('.post-card-fav');
    if (favBtn) {
      favBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleFavorite(post, favBtn);
      });
    }

    return el;
  }

  /**
   * Render the post list
   * @param {Array} posts - Array of post data
   */
  function renderPostList(posts) {
    if (!postListEl) return;

    // Clear existing
    postListEl.innerHTML = '';

    // Show empty state if no posts
    if (!posts || !posts.length) {
      renderPostsEmptyState();
      return;
    }

    // Add filter summary if available
    var summaryText = getFilterSummaryText();
    if (summaryText) {
      var summaryEl = document.createElement('div');
      summaryEl.className = 'msg--summary post-panel-summary';
      summaryEl.textContent = summaryText;
      postListEl.appendChild(summaryEl);
    }

    // Render each post card
    posts.forEach(function(post) {
      var card = renderPostCard(post);
      postListEl.appendChild(card);
    });
  }

  /**
   * Open a post (show detail view)
   * @param {Object} post - Post data
   * @param {Object} options - { fromRecent: boolean, originEl: HTMLElement }
   */
  function openPost(post, options) {
    options = options || {};
    var fromRecent = options.fromRecent || false;
    var originEl = options.originEl || null;

    // Add to recent history
    addToRecentHistory(post);

    // Determine container
    var container = fromRecent ? recentPanelContentEl : postListEl;
    if (!container) return;

    // Close any existing open post
    closeOpenPost(container);

    // Find or create the target element
    var target = originEl || container.querySelector('[data-id="' + post.id + '"]');

    // Build the detail view
    var detail = buildPostDetail(post, target, fromRecent);

    // Replace target with detail, or append if no target
    if (target && target.parentElement) {
      target.parentElement.replaceChild(detail, target);
    } else {
      container.insertBefore(detail, container.firstChild);
    }

    // Scroll to top
    if (postPanelContentEl) {
      postPanelContentEl.scrollTop = 0;
    }

    // Emit event for map highlighting
    if (window.App && typeof App.emit === 'function') {
      App.emit('post:opened', { post: post });
    }
  }

  /**
   * Close any open post in a container
   * @param {HTMLElement} container - Container element
   */
  function closeOpenPost(container) {
    var openPost = container.querySelector('.post-open');
    if (!openPost) return;

    var postId = openPost.dataset.id;

    // Find the original post data
    var post = null;
    if (cachedPosts) {
      for (var i = 0; i < cachedPosts.length; i++) {
        if (String(cachedPosts[i].id) === postId) {
          post = cachedPosts[i];
          break;
        }
      }
    }

    // Replace with card, or remove
    if (post) {
      var card = renderPostCard(post);
      openPost.parentElement.replaceChild(card, openPost);
    } else {
      openPost.remove();
    }

    // Emit close event
    if (window.App && typeof App.emit === 'function') {
      App.emit('post:closed', { postId: postId });
    }
  }

  /**
   * Build the post detail view
   * @param {Object} post - Post data
   * @param {HTMLElement} existingCard - Existing card element (optional)
   * @param {boolean} fromRecent - Whether opened from recent panel
   * @returns {HTMLElement} Detail view element
   */
  function buildPostDetail(post, existingCard, fromRecent) {
    var wrap = document.createElement('article');
    wrap.className = 'post-open';
    wrap.dataset.id = String(post.id);
    wrap.dataset.postKey = post.post_key || '';

    // Get first map card data
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;

    // Get display data
    var title = (mapCard && mapCard.title) || post.checkout_title || '';
    var description = (mapCard && mapCard.description) || '';
    var venueName = (mapCard && mapCard.venue_name) || '';
    var addressLine = (mapCard && mapCard.address_line) || '';
    var sessionSummary = (mapCard && mapCard.session_summary) || '';
    var priceSummary = (mapCard && mapCard.price_summary) || '';
    var email = (mapCard && mapCard.email) || '';
    var phone = (mapCard && mapCard.phone) || '';
    var websiteUrl = (mapCard && mapCard.website_url) || '';
    var ticketsUrl = (mapCard && mapCard.tickets_url) || '';
    var mediaUrls = (mapCard && mapCard.media_urls) || [];

    // Get subcategory info
    var subcategoryKey = post.subcategory_key || (mapCard && mapCard.subcategory_key) || '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = getSubcategoryIconUrl(subcategoryKey);

    // Get thumbnail
    var thumbUrl = mediaUrls.length ? mediaUrls[0] : '';

    // Check favorite status
    var isFav = isFavorite(post.id);

    // Build header (sticky card)
    var header = document.createElement('header');
    header.className = 'post-open-header';

    var thumbHtml = thumbUrl
      ? '<img class="post-card-thumb" src="' + thumbUrl + '" alt="" />'
      : '<div class="post-card-thumb post-card-thumb--empty"></div>';

    var iconHtml = iconUrl
      ? '<span class="post-card-subicon"><img class="post-card-subicon-image" src="' + iconUrl + '" alt="" /></span>'
      : '';

    var catLineText = subInfo.category && subInfo.subcategory
      ? subInfo.category + ' &gt; ' + subInfo.subcategory
      : subInfo.subcategory || subcategoryKey;

    header.innerHTML = [
      thumbHtml,
      '<div class="post-card-meta">',
        '<div class="post-card-catline">' + iconHtml + '<span>' + catLineText + '</span></div>',
        '<h3 class="post-card-title">' + escapeHtml(title) + '</h3>',
      '</div>',
      '<div class="post-open-actions">',
        '<button class="post-card-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
          '<svg class="post-card-fav-icon' + (isFav ? ' post-card-fav-icon--active' : '') + '" viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>',
        '</button>',
        '<button class="post-card-share" aria-label="Share post">',
          '<svg class="post-card-share-icon" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.06-.23.09-.46.09-.7s-.03-.47-.09-.7l7.13-4.17A2.99 2.99 0 0 0 18 9a3 3 0 1 0-3-3c0 .24.03.47.09.7L7.96 10.87A3.003 3.003 0 0 0 6 10a3 3 0 1 0 3 3c0-.24-.03-.47-.09-.7l7.13 4.17c.53-.5 1.23-.81 1.96-.81a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
        '</button>',
      '</div>'
    ].join('');

    // Build body
    var body = document.createElement('div');
    body.className = 'post-open-body';

    // Images section
    var imagesHtml = '';
    if (mediaUrls.length > 0) {
      var heroImg = '<div class="post-open-image-box"><div class="post-open-image-track">';
      heroImg += '<img class="post-open-image" src="' + mediaUrls[0] + '" alt="" loading="eager" />';
      heroImg += '</div></div>';

      var thumbs = '';
      if (mediaUrls.length > 1) {
        thumbs = '<div class="post-open-thumbnails">';
        for (var i = 0; i < mediaUrls.length; i++) {
          thumbs += '<img class="post-open-thumbnail' + (i === 0 ? ' post-open-thumbnail--active' : '') + '" src="' + mediaUrls[i] + '" data-index="' + i + '" alt="" />';
        }
        thumbs += '</div>';
      }

      imagesHtml = '<div class="post-open-images">' + heroImg + thumbs + '</div>';
    }

    // Details section
    var detailsHtml = '<div class="post-open-details">';

    // Venue/location
    if (venueName || addressLine) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">📍</span>';
      detailsHtml += '<div class="post-open-detail-content">';
      if (venueName) detailsHtml += '<strong>' + escapeHtml(venueName) + '</strong>';
      if (addressLine) detailsHtml += '<div>' + escapeHtml(addressLine) + '</div>';
      detailsHtml += '</div></div>';
    }

    // Dates/sessions
    if (sessionSummary) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">📅</span>';
      detailsHtml += '<div class="post-open-detail-content">' + escapeHtml(sessionSummary) + '</div>';
      detailsHtml += '</div>';
    }

    // Price
    if (priceSummary) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">💰</span>';
      detailsHtml += '<div class="post-open-detail-content">' + escapeHtml(priceSummary) + '</div>';
      detailsHtml += '</div>';
    }

    // Contact info
    if (phone) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">📞</span>';
      detailsHtml += '<div class="post-open-detail-content"><a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a></div>';
      detailsHtml += '</div>';
    }
    if (email) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">✉️</span>';
      detailsHtml += '<div class="post-open-detail-content"><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></div>';
      detailsHtml += '</div>';
    }

    // Links
    if (websiteUrl) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">🌐</span>';
      detailsHtml += '<div class="post-open-detail-content"><a href="' + escapeHtml(websiteUrl) + '" target="_blank" rel="noopener">Website</a></div>';
      detailsHtml += '</div>';
    }
    if (ticketsUrl) {
      detailsHtml += '<div class="post-open-detail-row">';
      detailsHtml += '<span class="post-card-badge">🎟️</span>';
      detailsHtml += '<div class="post-open-detail-content"><a href="' + escapeHtml(ticketsUrl) + '" target="_blank" rel="noopener">Get Tickets</a></div>';
      detailsHtml += '</div>';
    }

    detailsHtml += '</div>';

    // Description
    var descHtml = '';
    if (description) {
      descHtml = '<div class="post-open-description">';
      descHtml += '<div class="post-description-wrap"><div class="post-description">' + escapeHtml(description) + '</div></div>';
      descHtml += '</div>';
    }

    // Posted by
    var memberHtml = '<div class="post-member-avatar post-member-avatar--visible">';
    memberHtml += '<span class="post-member-avatar-name">Posted by ' + escapeHtml(post.member_name || 'Anonymous') + '</span>';
    memberHtml += '</div>';

    body.innerHTML = imagesHtml + '<div class="post-open-body-main">' + detailsHtml + descHtml + memberHtml + '</div>';

    // Assemble
    wrap.appendChild(header);
    wrap.appendChild(body);

    // Event handlers
    setupPostDetailEvents(wrap, post);

    return wrap;
  }

  /**
   * Set up event handlers for post detail view
   * @param {HTMLElement} wrap - Detail view element
   * @param {Object} post - Post data
   */
  function setupPostDetailEvents(wrap, post) {
    // Header click to close
    var header = wrap.querySelector('.post-open-header');
    if (header) {
      header.addEventListener('click', function(e) {
        // Don't close if clicking buttons
        if (e.target.closest('.post-card-fav') || e.target.closest('.post-card-share')) return;
        closePost(post.id);
      });
    }

    // Favorite button
    var favBtn = wrap.querySelector('.post-card-fav');
    if (favBtn) {
      favBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleFavorite(post, favBtn);
      });
    }

    // Share button
    var shareBtn = wrap.querySelector('.post-card-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sharePost(post);
      });
    }

    // Thumbnail clicks
    var thumbnails = wrap.querySelectorAll('.post-open-thumbnail');
    var heroImg = wrap.querySelector('.post-open-image');
    thumbnails.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        var index = parseInt(thumb.dataset.index, 10);
        var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
        var mediaUrls = (mapCard && mapCard.media_urls) || [];
        if (mediaUrls[index] && heroImg) {
          heroImg.src = mediaUrls[index];
          // Update active state
          thumbnails.forEach(function(t) { t.classList.remove('post-open-thumbnail--active'); });
          thumb.classList.add('post-open-thumbnail--active');
        }
      });
    });
  }

  /**
   * Close a post by ID
   * @param {string|number} postId - Post ID
   */
  function closePost(postId) {
    var openPost = document.querySelector('.post-open[data-id="' + postId + '"]');
    if (!openPost) return;

    var container = openPost.parentElement;

    // Find the original post data
    var post = null;
    if (cachedPosts) {
      for (var i = 0; i < cachedPosts.length; i++) {
        if (String(cachedPosts[i].id) === String(postId)) {
          post = cachedPosts[i];
          break;
        }
      }
    }

    // Replace with card, or remove
    if (post) {
      var card = renderPostCard(post);
      openPost.parentElement.replaceChild(card, openPost);
    } else {
      openPost.remove();
    }

    // Emit close event
    if (window.App && typeof App.emit === 'function') {
      App.emit('post:closed', { postId: String(postId) });
    }
  }

  /**
   * Share a post
   * @param {Object} post - Post data
   */
  function sharePost(post) {
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
    var title = (mapCard && mapCard.title) || post.checkout_title || '';
    var url = window.location.origin + '/post/' + (post.post_key || post.id);

    // Use Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: title,
        url: url
      }).catch(function() {
        // Fallback to clipboard
        copyToClipboard(url);
      });
    } else {
      copyToClipboard(url);
    }
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Link copied to clipboard');
      }).catch(function() {
        // Silent fail
      });
    } else {
      // Fallback for older browsers
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('Link copied to clipboard');
      } catch (e) {
        // Silent fail
      }
      document.body.removeChild(textarea);
    }
  }

  /**
   * Show a toast message
   * @param {string} message - Message to display
   */
  function showToast(message) {
    if (window.ToastComponent && typeof ToastComponent.show === 'function') {
      ToastComponent.show(message);
    } else {
      // Fallback: use console
      console.log('[Post] ' + message);
    }
  }

  /**
   * Toggle favorite status
   * @param {Object} post - Post data
   * @param {HTMLElement} btn - Favorite button element
   */
  function toggleFavorite(post, btn) {
    var isFav = btn.getAttribute('aria-pressed') === 'true';
    var newFav = !isFav;

    btn.setAttribute('aria-pressed', newFav ? 'true' : 'false');

    var icon = btn.querySelector('.post-card-fav-icon');
    if (icon) {
      if (newFav) {
        icon.classList.add('post-card-fav-icon--active');
      } else {
        icon.classList.remove('post-card-fav-icon--active');
      }
    }

    // Update all instances of this post's fav button
    document.querySelectorAll('[data-id="' + post.id + '"] .post-card-fav').forEach(function(otherBtn) {
      if (otherBtn === btn) return;
      otherBtn.setAttribute('aria-pressed', newFav ? 'true' : 'false');
      var otherIcon = otherBtn.querySelector('.post-card-fav-icon');
      if (otherIcon) {
        if (newFav) {
          otherIcon.classList.add('post-card-fav-icon--active');
        } else {
          otherIcon.classList.remove('post-card-fav-icon--active');
        }
      }
    });

    // Save to localStorage
    saveFavorite(post.id, newFav);
  }

  /**
   * Save favorite status to localStorage
   * @param {number|string} postId - Post ID
   * @param {boolean} isFav - Favorite status
   */
  function saveFavorite(postId, isFav) {
    try {
      var favs = JSON.parse(localStorage.getItem('postFavorites') || '{}');
      if (isFav) {
        favs[postId] = Date.now();
      } else {
        delete favs[postId];
      }
      localStorage.setItem('postFavorites', JSON.stringify(favs));
    } catch (e) {
      // ignore
    }
  }

  /**
   * Check if a post is favorited
   * @param {number|string} postId - Post ID
   * @returns {boolean}
   */
  function isFavorite(postId) {
    try {
      var favs = JSON.parse(localStorage.getItem('postFavorites') || '{}');
      return !!favs[postId];
    } catch (e) {
      return false;
    }
  }

  /**
   * Add post to recent history
   * @param {Object} post - Post data
   */
  function addToRecentHistory(post) {
    try {
      var history = JSON.parse(localStorage.getItem('recentPosts') || '[]');
      // Remove if already exists
      history = history.filter(function(h) { return h.id !== post.id; });
      // Add to front
      history.unshift({
        id: post.id,
        post_key: post.post_key,
        title: (post.map_cards && post.map_cards[0] && post.map_cards[0].title) || post.checkout_title || '',
        timestamp: Date.now()
      });
      // Keep only last 50
      history = history.slice(0, 50);
      localStorage.setItem('recentPosts', JSON.stringify(history));
    } catch (e) {
      // ignore
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* --------------------------------------------------------------------------
     EMPTY STATES (No posts exist yet)
     -------------------------------------------------------------------------- */

  function renderPostsEmptyState() {
    if (!postListEl) return;

    // Always empty (no posts in this site yet).
    postListEl.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'post-panel-empty';

    var summaryCopy = document.createElement('div');
    summaryCopy.className = 'msg--summary post-panel-empty-summary';
    summaryCopy.textContent = getFilterSummaryText();
    wrap.appendChild(summaryCopy);

    var img = document.createElement('img');
    img.alt = 'Posts empty state image';
    img.className = 'post-panel-empty-image';
    applySystemImage(img, 'postSystemImages', 'post_panel_empty_image');
    wrap.appendChild(img);

    var msg = document.createElement('p');
    msg.className = 'post-panel-empty-message';
    msg.dataset.messageKey = 'msg_posts_empty_state';
    msg.textContent = '';
    wrap.appendChild(msg);

    // Load message only when needed (panel open).
    if (typeof window.getMessage === 'function') {
      window.getMessage('msg_posts_empty_state', {}, false).then(function(text) {
        if (typeof text === 'string') {
          msg.textContent = text;
        }
      }).catch(function() {
        // ignore
      });
    }

    postListEl.appendChild(wrap);
  }

  function renderRecentEmptyState() {
    if (!recentPanelContentEl) return;

    // Always empty (no posts exist), but show the login reminder (like live site).
    recentPanelContentEl.innerHTML = '';

    var reminderWrap = document.createElement('div');
    reminderWrap.className = 'recent-panel-reminder';

    var reminderImg = document.createElement('img');
    reminderImg.alt = 'Recents reminder image';
    reminderImg.className = 'recent-panel-reminder-image';
    applySystemImage(reminderImg, 'recentSystemImages', 'recent_panel_footer_image');
    reminderWrap.appendChild(reminderImg);

    var reminderMsg = document.createElement('p');
    reminderMsg.className = 'recent-panel-reminder-text';
    reminderMsg.dataset.messageKey = 'msg_recent_footer';
    reminderMsg.textContent = '';
    reminderWrap.appendChild(reminderMsg);

    if (typeof window.getMessage === 'function') {
      window.getMessage('msg_recent_footer', {}, false).then(function(text) {
        if (typeof text === 'string') {
          reminderMsg.textContent = text;
        }
      }).catch(function() {
        // ignore
      });
    }

    recentPanelContentEl.appendChild(reminderWrap);
  }

  /* --------------------------------------------------------------------------
     BUTTON ANCHORS (Anti-jank)
     Attach to scroll containers so clicked controls don't "fly away"
     -------------------------------------------------------------------------- */

  function attachButtonAnchors() {
    if (!postPanelContentEl || !recentPanelContentEl) return;
    if (!window.ButtonAnchorBottom) {
      throw new Error('[Post] ButtonAnchorBottom is required (components-new.js).');
    }

    // Same options used elsewhere (keep site-wide feel consistent).
    var options = { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 };
    ButtonAnchorBottom.attach(postPanelContentEl, options);
    ButtonAnchorBottom.attach(recentPanelContentEl, options);
  }

  function getFilterSummaryText() {
    try {
      var el = document.querySelector('.filter-panel-summary');
      var text = el ? String(el.textContent || '').trim() : '';
      return text;
    } catch (e) {
      return '';
    }
  }

  function applySystemImage(imgEl, folderKey, systemImageKey) {
    if (!imgEl) return;
    if (!window.App || typeof App.getState !== 'function' || typeof App.getImageUrl !== 'function') {
      throw new Error('[Post] App.getState and App.getImageUrl are required to load system images.');
    }

    var sys = App.getState('system_images') || {};
    var filename = sys && sys[systemImageKey] ? String(sys[systemImageKey]) : '';
    if (!filename) {
      imgEl.dataset.missingSystemImageKey = systemImageKey;
      console.error('[Post] Missing system image setting: ' + systemImageKey);
      return;
    }

    var url = App.getImageUrl(folderKey, filename);
    if (!url) {
      imgEl.dataset.missingSystemImageUrl = systemImageKey;
      console.error('[Post] Empty system image URL for: ' + systemImageKey);
      return;
    }

    imgEl.src = url;
  }

  /* --------------------------------------------------------------------------
     ZOOM REQUIRED TOAST (Posts button disabled)
     -------------------------------------------------------------------------- */

  function ensureZoomToastEl() {
    var toast = document.querySelector('.map-zoom-toast');
    if (toast) return toast;

    toast = document.createElement('div');
    toast.className = 'map-zoom-toast';
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    return toast;
  }

  function showZoomToast() {
    var toast = ensureZoomToastEl();

    var show = function(text) {
      toast.textContent = (typeof text === 'string') ? text : '';
      toast.classList.add('map-zoom-toast--show');
      setTimeout(function() {
        toast.classList.remove('map-zoom-toast--show');
      }, 2000);
    };

    if (typeof window.getMessage === 'function') {
      window.getMessage('msg_map_zoom_required', {}, false).then(function(text) {
        show(text);
      }).catch(function() {
        show('');
      });
      return;
    }

    show('');
  }

  /* --------------------------------------------------------------------------
     HELPERS
     -------------------------------------------------------------------------- */

  function getModeButton(mode) {
    return document.querySelector('.header-modeswitch-button[data-mode="' + mode + '"]');
  }

  function inferCurrentModeFromHeader() {
    try {
      var active = document.querySelector('.header-modeswitch-button[aria-pressed="true"]');
      return active && active.dataset ? active.dataset.mode : null;
    } catch (e) {
      return null;
    }
  }

  /* --------------------------------------------------------------------------
     PUBLIC API
     -------------------------------------------------------------------------- */

  /**
   * Refresh posts (clear cache and reload)
   * @param {Object} options - Optional filters
   * @returns {Promise}
   */
  function refreshPosts(options) {
    cachedPosts = null;
    return loadPosts(options);
  }

  return {
    init: init,
    loadPosts: loadPosts,
    refreshPosts: refreshPosts,
    openPost: openPost,
    closePost: closePost
  };

})();

// Register with App
App.registerModule('post', PostModule);

// Expose globally for consistency with other modules
window.PostModule = PostModule;

