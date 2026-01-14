/* ============================================================================
   POST.JS - POST SECTION (includes Recent)
   ============================================================================
   
   Controls the Post panel and Recent panel.
   
   FUTURE COMPONENTS (to be extracted):
   - VenueMenuComponent - Map + venue selection dropdown
   - SessionMenuComponent - Calendar + session selection
   - ImageGalleryComponent - Hero image + thumbnails + swipe
   - ImageModalComponent - Full-screen image lightbox
   
   DEPENDENCIES:
   - index.js (backbone)
   - CalendarComponent (for session menu)
   - mapboxgl (for venue map)
   
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
  var favToTop = false; // matches live site: "Favourites on top" is a sort behavior, not a filter
  var favSortDirty = true; // live-site behavior: fav changes don't reorder until user presses the toggle again

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

    // DB-first/localStorage filter state is stored in localStorage by MemberModule on login.
    // PostModule needs it even if the filter panel hasn't been opened yet.
    currentFilters = loadSavedFiltersFromLocalStorage();

    // Capture initial mode (HeaderModule already ran, but PostModule may have missed the event).
    currentMode = inferCurrentModeFromHeader() || 'map';
    applyMode(currentMode);

    // Initialize zoom gating if we can.
    primeZoomFromMapIfAvailable();
    updatePostsButtonState();
  }

  function loadSavedFiltersFromLocalStorage() {
    try {
      var raw = localStorage.getItem('funmap_filters');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) {
      return null;
    }
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

    // Ensure panels are keyboard-focusable so arrow keys / PageUp/Down can scroll.
    // (Divs are not focusable by default.)
    try { postListEl.setAttribute('tabindex', '0'); } catch (_eTab0) {}
    try { recentPanelContentEl.setAttribute('tabindex', '0'); } catch (_eTab1) {}

    // Disable BottomSlack click-hold behavior inside these panels (it can block scrolling).
    // The filter/admin/member panels are where the anti-jank spacer is actually needed.
    try { postListEl.setAttribute('data-bottomslack', 'false'); } catch (_eSlack0) {}
    try { recentPanelContentEl.setAttribute('data-bottomslack', 'false'); } catch (_eSlack1) {}
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
        // Re-render markers if we have cached posts AND above zoom threshold
        var threshold = getPostsMinZoom();
        if (cachedPosts && cachedPosts.length && lastZoom >= threshold) {
          renderMapMarkers(cachedPosts);
        }
      } catch (e) {
        // ignore
      }
    });

    App.on('map:boundsChanged', function(data) {
      if (!data) return;
      var prevZoom = lastZoom;
      if (typeof data.zoom === 'number') {
        lastZoom = data.zoom;
        updatePostsButtonState();
        
        var threshold = getPostsMinZoom();
        var crossedUp = prevZoom < threshold && lastZoom >= threshold;
        
        // At zoom >= threshold, posts are server-filtered within the current bounds.
        // Reload when crossing threshold, or when viewport changes enough to matter.
        if (crossedUp) {
          var b0 = getMapBounds();
          var boundsKey0 = b0 ? boundsToKey(b0, 2) : '';
          if (boundsKey0) {
            lastLoadedBoundsKey = boundsKey0;
          }
          applyFilters(currentFilters || loadSavedFiltersFromLocalStorage() || {});
        }
        if (lastZoom >= threshold) {
          var b = getMapBounds();
          var boundsKey = b ? boundsToKey(b, 2) : '';
          if (boundsKey && boundsKey !== lastLoadedBoundsKey && !postsLoading) {
            lastLoadedBoundsKey = boundsKey;
            applyFilters(currentFilters || loadSavedFiltersFromLocalStorage() || {});
          }
        } else {
          // Below threshold: clusters handle the map; clear high-zoom markers.
          if (window.MapModule && MapModule.clearAllMapCardMarkers) {
            MapModule.clearAllMapCardMarkers();
          }
          lastRenderedVenueMarkerSigByKey = {};
        }
      }
    });

    // Hover sync from map → post cards (and open post header).
    // MapModule emits this when a map card is hovered.
    App.on('map:cardHover', function(data) {
      if (!data) return;
      var isHovering = !!data.isHovering;
      var ids = [];
      if (Array.isArray(data.postIds)) {
        ids = data.postIds.map(function(v) { return String(v); }).filter(Boolean);
      } else if (data.postId !== undefined && data.postId !== null) {
        ids = [String(data.postId)];
      }
      syncPostCardHoverFromMap(ids, isHovering);
    });

    // Listen for map marker clicks
    App.on('map:cardClicked', function(data) {
      if (!data || !data.postId) return;
      openPostById(data.postId, { fromMap: true });
    });

    // Listen for filter changes
    App.on('filter:changed', function(filterState) {
      applyFilters(filterState);
    });

    App.on('filter:resetAll', function() {
      applyFilters(null);
    });

    App.on('filter:resetCategories', function() {
      // Reload posts with current filters (categories are now reset)
      refreshPosts();
    });

    App.on('filter:sortChanged', function(data) {
      if (!data || !data.sort) return;
      sortPosts(data.sort);
    });

    App.on('filter:favouritesToggle', function(data) {
      if (!data) return;
      favToTop = !!data.enabled;
      // Live-site behavior: enabling favToTop makes ordering "clean" (applies immediately).
      // Any subsequent favourite toggles mark it dirty again until the user presses the toggle.
      favSortDirty = favToTop ? false : true;
      // Re-apply sorting/rendering without filtering out non-favourites.
      // Keep existing sort key if available; default to 'az'.
      sortPosts((window.FilterModule && FilterModule.getFilterState) ? (FilterModule.getFilterState().sort || 'az') : 'az');
    });

    // Panel-level keyboard behavior (Post/Recent):
    // - Escape closes open post first, then returns to map mode
    // Note: index-new.js global Escape handler does not manage Post/Recent panels.
    document.addEventListener('keydown', function(e) {
      try {
        if (!e || (e.key !== 'Escape')) return;
        if (e.defaultPrevented) return;
        if (currentMode !== 'posts' && currentMode !== 'recent') return;

        var container = (currentMode === 'recent') ? recentPanelContentEl : postListEl;
        if (!container) return;

        // Only handle if the event originated inside the panel (avoid closing while typing elsewhere).
        var t = e.target;
        if (!t || !container.contains(t)) return;

        // 1) Close an open post if present
        var open = container.querySelector('.open-post[data-id]');
        if (open) {
          var pid = open.getAttribute('data-id');
          if (pid) {
            closePost(pid);
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        // 2) Otherwise return to map mode
        forceMapMode();
        e.preventDefault();
        e.stopPropagation();
      } catch (_e) {}
    }, true);
  }

  var lastMapHoverPostIds = [];

  function syncPostCardHoverFromMap(postIds, isHovering) {
    if (!postListEl) return;
    var ids = Array.isArray(postIds) ? postIds : [];
    
    // Clear previous hover highlights if we are starting a new hover group
    if (isHovering) {
      lastMapHoverPostIds.forEach(function(pid) {
        togglePostCardHoverClass(pid, false);
      });
      lastMapHoverPostIds = ids.slice();
      ids.forEach(function(pid) {
        togglePostCardHoverClass(pid, true);
      });
      return;
    }
    
    // Hover end: clear the current group
    lastMapHoverPostIds.forEach(function(pid) {
      togglePostCardHoverClass(pid, false);
    });
    lastMapHoverPostIds = [];
  }

  function togglePostCardHoverClass(postId, on) {
    if (!postId) return;
    // Includes open-post header card too (it remains .post-card with data-id)
    var cards = document.querySelectorAll('.post-card[data-id="' + postId + '"], .recent-card[data-id="' + postId + '"]');
    cards.forEach(function(el) {
      el.classList.toggle('post-card--map-highlight', !!on);
    });
    var openWrap = document.querySelector('.open-post[data-id="' + postId + '"]');
    if (openWrap) {
      openWrap.classList.toggle('open-post--map-highlight', !!on);
    }
  }

  /**
   * Open a post by ID (looks up in cache)
   * @param {number|string} postId - Post ID
   * @param {Object} options - Options
   */
  function openPostById(postId, options) {
    options = options || {};

    // Find post in cache
    var post = null;
    if (cachedPosts) {
      for (var i = 0; i < cachedPosts.length; i++) {
        if (String(cachedPosts[i].id) === String(postId)) {
          post = cachedPosts[i];
          break;
        }
      }
    }

    if (!post) {
      console.warn('[Post] Post not found in cache:', postId);
      return;
    }

    // Switch to posts mode if coming from map
    if (options.fromMap && currentMode !== 'posts') {
      var postsBtn = getModeButton('posts');
      if (postsBtn && postsEnabled) {
        postsBtn.click();
        // Wait for mode change then open
        setTimeout(function() {
          openPost(post, options);
        }, 50);
        return;
      }
    }

    openPost(post, options);
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
        renderRecentPanel();
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

        // Focus the scroll container so wheel + arrow keys target the panel immediately.
        try {
          var focusEl = (panelKey === 'post') ? postListEl : contentEl;
          if (focusEl && typeof focusEl.focus === 'function') {
            focusEl.focus({ preventScroll: true });
          }
        } catch (_eFocus) {
          try {
            var focusEl2 = (panelKey === 'post') ? postListEl : contentEl;
            if (focusEl2 && typeof focusEl2.focus === 'function') focusEl2.focus();
          } catch (_eFocus2) {}
        }
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
    // Server-side filters (correct source-of-truth tables, not summaries)
    if (options && options.filters && typeof options.filters === 'object') {
      var f = options.filters;
      if (f.keyword) params.append('keyword', String(f.keyword));
      if (f.minPrice) params.append('min_price', String(f.minPrice));
      if (f.maxPrice) params.append('max_price', String(f.maxPrice));
      if (f.dateStart) params.append('date_start', String(f.dateStart));
      if (f.dateEnd) params.append('date_end', String(f.dateEnd));
      if (f.expired) params.append('expired', '1');
      if (Array.isArray(f.subcategoryKeys) && f.subcategoryKeys.length) {
        params.append('subcategory_keys', f.subcategoryKeys.map(String).join(','));
      }
    } else if (options && options.subcategory_key) {
      // Legacy
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
          filteredPosts = null; // Reset filtered posts on fresh load
          renderPostList(data.posts);
          // Emit initial filter counts
          emitFilterCounts();
          // Refresh map clusters with new post data
          if (window.MapModule && MapModule.refreshClusters) {
            MapModule.refreshClusters();
          }
          return data.posts;
        } else {
          postsError = data.message || 'Unknown error';
          renderPostsEmptyState();
          App.emit('filter:countsUpdated', { total: 0, filtered: 0 });
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
     POST CARDS
     --------------------------------------------------------------------------
     Post card rendering for the post panel list.
     Structure: .post-card > .post-card-image + .post-card-meta + .post-card-container-actions
     -------------------------------------------------------------------------- */

  /**
   * Append Bunny Optimizer class to image URL for size optimization.
   * This is a progressive enhancement - if the CDN doesn't support ?class=,
   * the parameter is simply ignored and CSS handles display sizing.
   * @param {string} url - Image URL (may already have ?crop= parameter)
   * @param {string} className - Bunny class name (thumbnail, minithumb, imagebox)
   * @returns {string} URL with class parameter appended
   */
  function addImageClass(url, className) {
    if (!url || !className) return url || '';
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'class=' + className;
  }

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

    return '';
  }

  /**
   * Format dates display for a post (matches live site formatDates)
   * @param {Object} post - Post data from API
   * @returns {string} Formatted date string or empty
   */
  function formatPostDates(post) {
    // Get sessions from first map card
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
    if (!mapCard) return '';

    // Try sessions array
    var sessions = mapCard.sessions;
    if (!Array.isArray(sessions) || !sessions.length) return '';

    // Sort by date
    var sortedSessions = sessions.slice().sort(function(a, b) {
      var dateA = a.date || a.full || '';
      var dateB = b.date || b.full || '';
      return dateA.localeCompare(dateB);
    });

    // Get first and last dates
    var first = sortedSessions[0];
    var last = sortedSessions[sortedSessions.length - 1];

    var firstDate = first.date || first.full || '';
    var lastDate = last.date || last.full || '';

    if (!firstDate) return '';

    // Format: "Jan 1 - Jan 15" or just "Jan 1" if same/single
    if (firstDate === lastDate || sortedSessions.length === 1) {
      return formatDateShort(firstDate);
    }
    return formatDateShort(firstDate) + ' - ' + formatDateShort(lastDate);
  }

  /**
   * Format a single date string for display
   * @param {string} dateStr - Date string (YYYY-MM-DD or similar)
   * @returns {string} Formatted date like "Jan 1"
   */
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[d.getMonth()] + ' ' + d.getDate();
    } catch (e) {
      return dateStr;
    }
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
   * Structure: .post-card-image, .post-card-meta, .post-card-text-title, .post-card-container-info
   * @param {Object} post - Post data from API
   * @returns {HTMLElement} Post card element
   */
  function renderPostCard(post) {
    var el = document.createElement('article');
    el.className = 'post-card';
    el.dataset.id = String(post.id);
    el.dataset.postKey = post.post_key || '';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    // Get first map card data
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;

    // Get display data
    var title = (mapCard && mapCard.title) || post.checkout_title || '';
    var venueName = (mapCard && mapCard.venue_name) || '';
    var city = (mapCard && mapCard.city) || '';
    var locationDisplay = venueName || city || '';

    // Get subcategory info
    var subcategoryKey = post.subcategory_key || (mapCard && mapCard.subcategory_key) || '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = post.subcategory_icon_url || getSubcategoryIconUrl(subcategoryKey);

    // Format dates (if sessions exist)
    var datesText = formatPostDates(post);

    // Get thumbnail - use 'thumbnail' class (100x100) for post cards
    var thumbUrl = addImageClass(getPostThumbnailUrl(post), 'thumbnail');

    // Build HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbHtml = '<img class="post-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />';

    var iconHtml = iconUrl
      ? '<span class="post-card-icon-sub"><img src="' + iconUrl + '" alt="" /></span>'
      : '';

    var catLineText = subInfo.category && subInfo.subcategory
      ? subInfo.category + ' &gt; ' + subInfo.subcategory
      : subInfo.subcategory || subcategoryKey;

    var isFav = isFavorite(post.id);

    el.innerHTML = [
      thumbHtml,
      '<div class="post-card-meta">',
        '<div class="post-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="post-card-container-info">',
          '<div class="post-card-row-cat">' + iconHtml + ' ' + catLineText + '</div>',
          locationDisplay ? '<div class="post-card-row-loc"><span class="post-card-badge" title="Venue">📍</span><span>' + escapeHtml(locationDisplay) + '</span></div>' : '',
          datesText ? '<div class="post-card-row-date"><span class="post-card-badge" title="Dates">📅</span><span>' + escapeHtml(datesText) + '</span></div>' : '',
        '</div>',
      '</div>',
      '<div class="post-card-container-actions">',
        '<button class="post-card-button-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
          '<svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>',
        '</button>',
      '</div>'
    ].join('');

    // Click handler for opening post
    el.addEventListener('click', function(e) {
      // Don't open if clicking favorite button
      if (e.target.closest('.post-card-button-fav')) return;
      openPost(post, { originEl: el });
    });

    // Keyboard: Enter/Space opens card (matches button behavior)
    el.addEventListener('keydown', function(e) {
      if (!e) return;
      var k = String(e.key || e.code || '');
      if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar' && k !== 'Space') return;
      if (e.target && e.target.closest && e.target.closest('.post-card-button-fav')) return;
      e.preventDefault();
      openPost(post, { originEl: el });
    });

    // Favorite toggle handler
    var favBtn = el.querySelector('.post-card-button-fav');
    if (favBtn) {
      favBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleFavorite(post, favBtn);
      });
    }

    // Hover sync with map markers
    el.addEventListener('mouseenter', function() {
      el.classList.add('post-card--map-highlight');
      syncMapMarkerHover(post.id, true);
    });

    el.addEventListener('mouseleave', function() {
      el.classList.remove('post-card--map-highlight');
      syncMapMarkerHover(post.id, false);
    });

    return el;
  }

  /**
   * Sync hover state between post card and map marker
   * @param {number|string} postId - Post ID
   * @param {boolean} isHovering - Whether hovering
   */
  function syncMapMarkerHover(postId, isHovering) {
    // Use MapCards API if available (from map.js)
    if (window.MapCards) {
      if (isHovering && MapCards.setMapCardHover) {
        MapCards.setMapCardHover(postId);
      } else if (!isHovering && MapCards.removeMapCardHover) {
        MapCards.removeMapCardHover(postId);
      }
      return;
    }
  }

  /**
   * Render the post list
   * @param {Array} posts - Array of post data
   */
  function renderPostList(posts) {
    if (!postListEl) return;
    
    // Preserve an open post across re-renders (map moves trigger filter refreshes).
    // If the open post is still in the filtered results, keep it open (do NOT close just because the map moved).
    var preservedOpenPost = postListEl.querySelector('.open-post');
    var preservedOpenPostId = preservedOpenPost && preservedOpenPost.dataset ? String(preservedOpenPost.dataset.id || '') : '';
    if (preservedOpenPost && preservedOpenPost.parentElement === postListEl) {
      try { postListEl.removeChild(preservedOpenPost); } catch (_eDetach) {}
    }
    
    // Clear existing list content (cards + summary)
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
      // If this post is currently open, reinsert the existing open-post wrapper instead of recreating.
      if (preservedOpenPost && preservedOpenPostId && String(post.id) === preservedOpenPostId) {
        // Ensure it stays visible (if it was previously hidden)
        preservedOpenPost.style.display = '';
        postListEl.appendChild(preservedOpenPost);
        return;
      }
      var card = renderPostCard(post);
      postListEl.appendChild(card);
    });
    
    // If there was an open post but it is no longer in the filtered list, do not reinsert it.
    // That means it disappears because it's filtered out (expected).

    // Render markers on the map (only if above zoom threshold)
    var threshold = getPostsMinZoom();
    if (lastZoom >= threshold) {
      renderMapMarkers(posts);
    }
  }

  /* --------------------------------------------------------------------------
     MAP MARKER INTEGRATION
     -------------------------------------------------------------------------- */

  // Track which venue markers are currently rendered so we can update in-place
  // (matches live-site behavior: don't clear everything on every refresh).
  var lastRenderedVenueMarkerSigByKey = {};

  /**
   * Convert a map card to marker-friendly format
   * @param {Object} post - Parent post data
   * @param {Object} mapCard - Map card data
   * @param {number} mapCardIndex - Index of this map card within the post
   * @returns {Object} Marker-friendly object
   */
  function convertMapCardToMarker(post, mapCard, mapCardIndex) {
    if (!mapCard) return null;

    var lat = mapCard.latitude;
    var lng = mapCard.longitude;

    // Skip if no valid coordinates
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    var title = mapCard.title || post.checkout_title || '';
    var venueName = mapCard.venue_name || '';
    var subcategoryKey = post.subcategory_key || mapCard.subcategory_key || '';

    // Get icon URL from API response (subcategory_icon_url) - primary source
    // Falls back to global subcategoryIconPaths lookup if not in response
    var iconUrl = post.subcategory_icon_url || getSubcategoryIconUrl(subcategoryKey);

    // Get thumbnail URL - use 'minithumb' class (50x50) for map card markers
    var rawUrl = (mapCard.media_urls && mapCard.media_urls.length) ? mapCard.media_urls[0] : '';
    var thumbnailUrl = addImageClass(rawUrl, 'minithumb');

    // Check if this post has multiple locations
    var isMultiLocation = post.map_cards && post.map_cards.length > 1;

    return {
      id: post.id,
      post_key: post.post_key,
      map_card_id: mapCard.id,
      map_card_index: mapCardIndex,
      title: title,
      venue: venueName,
      sub: subcategoryKey,
      iconUrl: iconUrl,
      thumbnailUrl: thumbnailUrl,
      lat: lat,
      lng: lng,
      isMultiLocation: isMultiLocation,
      // Keep reference to original post and map card
      _originalPost: post,
      _mapCard: mapCard
    };
  }

  /**
   * Render map markers for all posts
   * @param {Array} posts - Array of post data from API
   */
  function renderMapMarkers(posts) {
    // Check if MapModule is available
    if (!window.MapModule) {
      console.warn('[Post] MapModule not available for marker rendering');
      return;
    }

    var mapModule = window.MapModule;

    // Check if map is ready
    var map = mapModule.getMap ? mapModule.getMap() : null;
    if (!map) {
      // Map not ready yet - listen for map:ready event
      if (window.App && typeof App.on === 'function') {
        App.on('map:ready', function() {
          renderMapMarkers(posts);
        });
      }
      return;
    }

    // Live-site style: update markers in-place (diff by venueKey) to avoid flashing.

    // First pass: collect all map cards and group by venue coordinates
    // Multi-post venues (same location, different posts) use multi_post_icon
    var COORD_PRECISION = 6;
    var venueGroups = {}; // key: "lng,lat" -> array of {post, mapCard, index}
    
    posts.forEach(function(post) {
      if (!post.map_cards || !post.map_cards.length) return;
      
      post.map_cards.forEach(function(mapCard, index) {
        if (!mapCard) return;
        var lat = mapCard.latitude;
        var lng = mapCard.longitude;
        if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        
        var venueKey = lng.toFixed(COORD_PRECISION) + ',' + lat.toFixed(COORD_PRECISION);
        if (!venueGroups[venueKey]) {
          venueGroups[venueKey] = [];
        }
        venueGroups[venueKey].push({ post: post, mapCard: mapCard, index: index });
      });
    });

    function buildMarkerSignature(markerData) {
      // Only include fields that affect marker visuals/behavior.
      // Keep this stable to avoid unnecessary remove/recreate cycles.
      var ids = [];
      if (markerData && markerData.isMultiPost && Array.isArray(markerData.venuePostIds)) {
        ids = markerData.venuePostIds.map(String).slice().sort();
      } else if (markerData && markerData.id !== undefined && markerData.id !== null) {
        ids = [String(markerData.id)];
      }
      return [
        markerData && markerData.isMultiPost ? '1' : '0',
        ids.join(','),
        markerData && markerData.title ? String(markerData.title) : '',
        markerData && markerData.venue ? String(markerData.venue) : '',
        markerData && markerData.sub ? String(markerData.sub) : '',
        markerData && markerData.iconUrl ? String(markerData.iconUrl) : '',
        markerData && markerData.thumbnailUrl ? String(markerData.thumbnailUrl) : ''
      ].join('|');
    }

    // Second pass: build desired markers (one per venueKey), then diff-update.
    var nextSigByKey = {};
    var nextMarkerDataByKey = {};

    Object.keys(venueGroups).forEach(function(venueKey) {
      var group = venueGroups[venueKey];
      if (!group.length) return;

      // Check if this venue has multiple posts (different post IDs)
      var uniquePostIds = {};
      group.forEach(function(item) { uniquePostIds[item.post.id] = true; });
      var isMultiPostVenue = Object.keys(uniquePostIds).length > 1;

      // Use the first item for the marker, but store all post IDs for the venue
      var firstItem = group[0];
      var markerData = convertMapCardToMarker(firstItem.post, firstItem.mapCard, firstItem.index);
      if (!markerData) return;

      if (isMultiPostVenue) {
        // Multi-post venue: use multi-post icon and store all post IDs
        markerData.isMultiPost = true;
        markerData.venuePostIds = Object.keys(uniquePostIds);
        markerData.venuePostCount = markerData.venuePostIds.length;
      }

      nextMarkerDataByKey[venueKey] = markerData;
      nextSigByKey[venueKey] = buildMarkerSignature(markerData);
    });

    // Remove markers that are no longer needed
    if (mapModule.removeMapCardMarker) {
      Object.keys(lastRenderedVenueMarkerSigByKey || {}).forEach(function(venueKey) {
        if (!nextSigByKey[venueKey]) {
          mapModule.removeMapCardMarker(venueKey);
        }
      });
    }

    // Create/update markers that are new or changed
    Object.keys(nextMarkerDataByKey).forEach(function(venueKey) {
      var markerData = nextMarkerDataByKey[venueKey];
      var nextSig = nextSigByKey[venueKey];
      var prevSig = lastRenderedVenueMarkerSigByKey ? lastRenderedVenueMarkerSigByKey[venueKey] : null;

      if (prevSig && prevSig === nextSig) {
        return; // keep existing marker as-is
      }

      // Changed: remove then recreate (MapModule does not expose an update-by-key API)
      if (prevSig && mapModule.removeMapCardMarker) {
        mapModule.removeMapCardMarker(venueKey);
      }
      if (mapModule.createMapCardMarker) {
        mapModule.createMapCardMarker(markerData, markerData.lng, markerData.lat);
      }
    });

    lastRenderedVenueMarkerSigByKey = nextSigByKey;
    
    // Preserve the active (big) state for the currently open post (if any).
    // Markers may have been updated above, so we re-apply the association here.
    restoreActiveMapCardFromOpenPost();
  }

  function getOpenPostIdFromDom() {
    try {
      var openEl = document.querySelector('.open-post[data-id]');
      if (!openEl) return null;
      var id = openEl.getAttribute('data-id');
      return id ? id : null;
    } catch (_e) {
      return null;
    }
  }

  function restoreActiveMapCardFromOpenPost() {
    var postId = getOpenPostIdFromDom();
    if (!postId) return;
    if (!window.MapModule || !MapModule.setActiveMapCard) return;
    MapModule.setActiveMapCard(postId);
  }

  /**
   * Highlight a post's marker on the map
   * @param {number|string} postId - Post ID
   */
  function highlightMapMarker(postId) {
    if (!window.MapModule || !MapModule.setActiveMapCard) return;
    MapModule.setActiveMapCard(postId);
  }

  /**
   * Clear marker highlight
   * @param {number|string} postId - Post ID (optional, clears all if not provided)
   */
  function clearMapMarkerHighlight(postId) {
    if (!window.MapModule) return;
    // MapModule doesn't have a direct "deactivate" - setActiveMapCard handles toggling
  }

  /* --------------------------------------------------------------------------
     FILTER INTEGRATION
     -------------------------------------------------------------------------- */

  // Current filter state
  var currentFilters = null;
  var filteredPosts = null;
  
  // Track last viewport used for server-side post loads (prevents refetch on same bounds)
  var lastLoadedBoundsKey = '';

  /**
   * Count map cards in visible map area (for filter counts)
   * @param {Array} posts - Array of posts to count
   * @returns {number} Total map cards in visible area
   */
  function countMapCardsInView(posts) {
    if (!posts || !posts.length) return 0;
    
    var bounds = getMapBounds();
    var count = 0;
    
    for (var i = 0; i < posts.length; i++) {
      var mapCards = posts[i].map_cards;
      if (!Array.isArray(mapCards)) continue;
      
      for (var j = 0; j < mapCards.length; j++) {
        var mc = mapCards[j];
        if (!mc) continue;
        
        // If no bounds or map area filter is off, count all
        if (!bounds) {
          count++;
        } else if (pointWithinBounds(mc.longitude, mc.latitude, bounds)) {
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * Emit filter count updates to the filter panel
   */
  function emitFilterCounts() {
    var totalInArea = countMapCardsInView(cachedPosts);
    var filteredCount = countMapCardsInView(filteredPosts || cachedPosts);
    
    App.emit('filter:countsUpdated', {
      total: totalInArea,
      filtered: filteredCount
    });
  }

  /**
   * Apply filters to the cached posts
   * @param {Object} filterState - Filter state from FilterModule
   */
  function applyFilters(filterState) {
    currentFilters = filterState;
    // Persist to localStorage so map clusters (which read localStorage) update even if filter panel closes.
    try {
      localStorage.setItem('funmap_filters', JSON.stringify(filterState || {}));
    } catch (_eStore) {}

    // At zoom >= threshold, results must be filtered server-side (correct tables: sessions/pricing/etc).
    var threshold = getPostsMinZoom();
    if (typeof lastZoom === 'number' && lastZoom >= threshold) {
      var b = getMapBounds();
      var boundsParam = b ? boundsToApiParam(b) : '';
      // Live-site behavior: keep current cards/markers visible while the server recalculates,
      // then swap to the new results when they arrive (avoids flashing).
      loadPosts({ bounds: boundsParam, limit: 200, offset: 0, filters: filterState || {} }).then(function() {
        // Server returned filtered posts; renderMapMarkers is called by loadPosts->renderPostList path.
        // Keep active state synced if open post still exists.
        restoreActiveMapCardFromOpenPost();
      });
      return;
    }

    // Below threshold: no posts list should be shown; keep counts/clusters updated elsewhere.
    filteredPosts = cachedPosts;
    emitFilterCounts();
  }

  /**
   * Filter posts based on filter state
   * @param {Array} posts - Array of posts
   * @param {Object} filters - Filter state
   * @returns {Array} Filtered posts
   */
  /**
   * Check if a point is within bounds
   */
  function pointWithinBounds(lng, lat, bounds) {
    if (!bounds) return true;
    var withinLat = lat >= bounds.south && lat <= bounds.north;
    if (!withinLat) return false;
    if (bounds.west <= bounds.east) {
      return lng >= bounds.west && lng <= bounds.east;
    }
    // Handle antimeridian crossing
    return lng >= bounds.west || lng <= bounds.east;
  }

  /**
   * Get current map bounds
   */
  function getMapBounds() {
    if (!window.MapModule || !MapModule.getBounds) return null;
    return normalizeBounds(MapModule.getBounds());
  }

  /**
   * Normalize Mapbox LngLatBounds into a simple POJO:
   * { west, east, south, north }
   * (Matches live site logic to keep bounds math consistent.)
   */
  function normalizeBounds(bounds) {
    if (!bounds) return null;
    if (typeof bounds.getWest === 'function') {
      return {
        west: bounds.getWest(),
        east: bounds.getEast(),
        south: bounds.getSouth(),
        north: bounds.getNorth()
      };
    }
    var west = bounds.west;
    var east = bounds.east;
    var south = bounds.south;
    var north = bounds.north;
    if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
      return null;
    }
    return { west: west, east: east, south: south, north: north };
  }

  function boundsToKey(bounds, precision) {
    var b = normalizeBounds(bounds);
    if (!b) return '';
    var p = Number.isFinite(precision) ? precision : 2;
    var fmt = function(v) { return Number.isFinite(v) ? v.toFixed(p) : 'nan'; };
    return [b.west, b.south, b.east, b.north].map(fmt).join('|');
  }

  // API expects: sw_lng,sw_lat,ne_lng,ne_lat
  function boundsToApiParam(bounds) {
    var b = normalizeBounds(bounds);
    if (!b) return '';
    return [b.west, b.south, b.east, b.north].join(',');
  }

  function filterPosts(posts, filters) {
    if (!filters) return posts;

    // Get current map bounds for viewport filtering (only at zoom 8+)
    var threshold = getPostsMinZoom();
    var bounds = (lastZoom >= threshold) ? getMapBounds() : null;

    return posts.filter(function(post) {
      var mapCards = post.map_cards || [];
      if (!mapCards.length) return false;

      // Category/Subcategory filter (matches live-site category selection behavior).
      // FilterModule provides `subcategoryKeys` based on the get-form reference data.
      if (filters.subcategoryKeys && Array.isArray(filters.subcategoryKeys)) {
        if (filters.subcategoryKeys.length === 0) return false;
        var postSubKey = String(post.subcategory_key || '');
        if (!postSubKey) return false;
        if (filters.subcategoryKeys.indexOf(postSubKey) === -1) return false;
      }

      // Map area filter (viewport bounds) - include post if ANY map card is in bounds
      if (bounds) {
        var anyInBounds = mapCards.some(function(mc) {
          return mc && pointWithinBounds(mc.longitude, mc.latitude, bounds);
        });
        if (!anyInBounds) return false;
      }

      // Keyword filter - match against ANY map card's content
      if (filters.keyword) {
        var kw = filters.keyword.toLowerCase();
        var checkoutTitle = (post.checkout_title || '').toLowerCase();
        
        var keywordMatch = mapCards.some(function(mc) {
          if (!mc) return false;
          var title = (mc.title || '').toLowerCase();
          var description = (mc.description || '').toLowerCase();
          var venue = (mc.venue_name || '').toLowerCase();
          return title.indexOf(kw) !== -1 || description.indexOf(kw) !== -1 || 
                 venue.indexOf(kw) !== -1 || checkoutTitle.indexOf(kw) !== -1;
        });
        
        if (!keywordMatch) return false;
      }

      // Price filter (if price_summary contains a number)
      if (filters.minPrice || filters.maxPrice) {
        var priceSummary = (mapCard && mapCard.price_summary) || '';
        var priceMatch = priceSummary.match(/[\d,.]+/);
        var price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

        if (price !== null) {
          if (filters.minPrice && price < parseFloat(filters.minPrice)) {
            return false;
          }
          if (filters.maxPrice && price > parseFloat(filters.maxPrice)) {
            return false;
          }
        }
      }

      // Favorites filter
      if (filters.favourites) {
        if (!isFavorite(post.id)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort posts by the given sort key
   * @param {string} sortKey - Sort key (az, za, newest, oldest, price-low, price-high)
   */
  function sortPosts(sortKey) {
    var posts = filteredPosts || cachedPosts;
    if (!posts || !posts.length) return;

    var sorted = posts.slice().sort(function(a, b) {
      var mcA = (a.map_cards && a.map_cards.length) ? a.map_cards[0] : null;
      var mcB = (b.map_cards && b.map_cards.length) ? b.map_cards[0] : null;
      
      // Live-site behavior: "Favourites on top" only applies when not dirty.
      if (favToTop && !favSortDirty) {
        var favA = isFavorite(a.id) ? 1 : 0;
        var favB = isFavorite(b.id) ? 1 : 0;
        if (favA !== favB) return favB - favA;
      }

      switch (sortKey) {
        case 'az':
          var titleA = ((mcA && mcA.title) || a.checkout_title || '').toLowerCase();
          var titleB = ((mcB && mcB.title) || b.checkout_title || '').toLowerCase();
          return titleA.localeCompare(titleB);

        case 'nearest':
          return compareNearestToMapCenter(a, b);

        case 'soon':
          return compareSoonest(a, b);

        case 'newest':
          var dateA = new Date(a.created_at || 0).getTime();
          var dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;

        case 'oldest':
          var dateA2 = new Date(a.created_at || 0).getTime();
          var dateB2 = new Date(b.created_at || 0).getTime();
          return dateA2 - dateB2;

        case 'price-low':
          var priceA = extractPrice(mcA);
          var priceB = extractPrice(mcB);
          return priceA - priceB;

        case 'price-high':
          var priceA2 = extractPrice(mcA);
          var priceB2 = extractPrice(mcB);
          return priceB2 - priceA2;

        default:
          return 0;
      }
    });

    filteredPosts = sorted;
    renderFilteredPosts();
  }

  /**
   * Extract price from map card
   * @param {Object} mapCard - Map card data
   * @returns {number} Price or 0
   */
  function extractPrice(mapCard) {
    if (!mapCard || !mapCard.price_summary) return 0;
    var match = mapCard.price_summary.match(/[\d,.]+/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
  }
  
  function getMapCenter() {
    try {
      if (window.MapModule && typeof MapModule.getMap === 'function') {
        var map = MapModule.getMap();
        if (map && typeof map.getCenter === 'function') {
          return map.getCenter();
        }
      }
    } catch (_e) {}
    return null;
  }
  
  function distKm(a, b) {
    // Haversine
    var R = 6371;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLng = (b.lng - a.lng) * Math.PI / 180;
    var lat1 = a.lat * Math.PI / 180;
    var lat2 = b.lat * Math.PI / 180;
    var s1 = Math.sin(dLat / 2);
    var s2 = Math.sin(dLng / 2);
    var h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  
  function getPostMinDistanceKmToCenter(post, center) {
    if (!post || !center) return Number.POSITIVE_INFINITY;
    var centerPt = { lng: Number(center.lng), lat: Number(center.lat) };
    if (!Number.isFinite(centerPt.lng) || !Number.isFinite(centerPt.lat)) return Number.POSITIVE_INFINITY;
    
    var cards = Array.isArray(post.map_cards) ? post.map_cards : [];
    var best = Number.POSITIVE_INFINITY;
    for (var i = 0; i < cards.length; i++) {
      var mc = cards[i];
      if (!mc) continue;
      var lng = Number(mc.longitude);
      var lat = Number(mc.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      var d = distKm({ lng: lng, lat: lat }, centerPt);
      if (d < best) best = d;
    }
    return best;
  }
  
  function compareNearestToMapCenter(a, b) {
    var center = getMapCenter();
    if (!center) return 0;
    var dA = getPostMinDistanceKmToCenter(a, center);
    var dB = getPostMinDistanceKmToCenter(b, center);
    if (dA === dB) return 0;
    return dA - dB;
  }
  
  function getPostSoonestTimestamp(post) {
    var cards = Array.isArray(post && post.map_cards) ? post.map_cards : [];
    var best = Number.POSITIVE_INFINITY;
    for (var i = 0; i < cards.length; i++) {
      var mc = cards[i];
      var sessions = mc && Array.isArray(mc.sessions) ? mc.sessions : [];
      for (var j = 0; j < sessions.length; j++) {
        var s = sessions[j];
        if (!s) continue;
        var dt = null;
        // Support both {date,time} and {session_date,session_time}
        var dateStr = s.date || s.session_date || '';
        var timeStr = s.time || s.session_time || '';
        if (dateStr) {
          dt = new Date(String(dateStr) + (timeStr ? ('T' + String(timeStr)) : 'T00:00:00'));
        }
        var t = dt ? dt.getTime() : NaN;
        if (Number.isFinite(t) && t < best) best = t;
      }
    }
    return best;
  }
  
  function compareSoonest(a, b) {
    var tA = getPostSoonestTimestamp(a);
    var tB = getPostSoonestTimestamp(b);
    var aHas = Number.isFinite(tA) && tA !== Number.POSITIVE_INFINITY;
    var bHas = Number.isFinite(tB) && tB !== Number.POSITIVE_INFINITY;
    if (aHas && bHas) return tA - tB;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return 0;
  }

  /**
   * Filter to show only favourites
   * @param {boolean} showFavouritesOnly - Whether to show only favourites
   */
  // Backwards-compat: this used to mean "favourites only" filtering, but the UI is "Favourites on top".
  // Keep it as a no-op wrapper that toggles favToTop (do not hide non-favourites).
  function filterFavourites(favouritesOnTop) {
    favToTop = !!favouritesOnTop;
    favSortDirty = favToTop ? false : true;
    sortPosts((window.FilterModule && FilterModule.getFilterState) ? (FilterModule.getFilterState().sort || 'az') : 'az');
  }

  /**
   * Render filtered posts (used after sort)
   */
  function renderFilteredPosts() {
    var posts = filteredPosts || cachedPosts;
    if (!posts) return;
    // Use the standard renderer so open posts are preserved correctly
    renderPostList(posts);
  }

  /* --------------------------------------------------------------------------
     OPEN POST - Post Detail View
     --------------------------------------------------------------------------
     When a post card is clicked, it expands to show the full post details.
     Structure: .open-post > .post-card + .open-post-body
     
     Contains sub-sections that are COMPONENT PLACEHOLDERS:
     - Venue Menu (map + venue selection)
     - Session Menu (calendar + session selection)
     - Image Gallery (hero + thumbnails)
     -------------------------------------------------------------------------- */

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

    // Store parent reference and remove target from DOM before building detail
    // (buildPostDetail will move the card inside the detail wrapper)
    var targetParent = target ? target.parentElement : null;
    var targetNextSibling = target ? target.nextSibling : null;
    if (target && targetParent) {
      targetParent.removeChild(target);
    }

    // Build the detail view (may reuse the removed target element)
    var detail = buildPostDetail(post, target, fromRecent);

    // Insert detail at original position, or at top of container
    if (targetParent && targetNextSibling) {
      targetParent.insertBefore(detail, targetNextSibling);
    } else if (targetParent) {
      targetParent.appendChild(detail);
    } else {
      container.insertBefore(detail, container.firstChild);
    }

    // Scroll to top
    if (postPanelContentEl) {
      postPanelContentEl.scrollTop = 0;
    }

    // Highlight the map marker
    highlightMapMarker(post.id);

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
    var openPost = container.querySelector('.open-post');
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
   * Structure: .open-post > .post-card + .open-post-body
   * @param {Object} post - Post data
   * @param {HTMLElement} existingCard - Existing card element (optional)
   * @param {boolean} fromRecent - Whether opened from recent panel
   * @returns {HTMLElement} Detail view element
   */
  function buildPostDetail(post, existingCard, fromRecent) {
    // Get all map cards (locations)
    var locationList = post.map_cards || [];
    var loc0 = locationList[0] || {};

    // Get display data from first location
    var title = loc0.title || post.checkout_title || '';
    var description = loc0.description || '';
    var venueName = loc0.venue_name || '';
    var addressLine = loc0.address_line || '';
    var mediaUrls = loc0.media_urls || [];
    // Hero image uses 'imagebox' class (530x530)
    var heroUrl = addImageClass(mediaUrls[0] || '', 'imagebox');

    // Get subcategory info
    var subcategoryKey = post.subcategory_key || loc0.subcategory_key || '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = post.subcategory_icon_url || getSubcategoryIconUrl(subcategoryKey);

    // Format dates
    var datesText = formatPostDates(post);

    // Posted by info
    var posterName = post.member_name || 'Anonymous';
    var postedTime = formatPostTimestamp(post.created_at);
    var postedMeta = postedTime ? 'Posted by ' + posterName + ' · ' + postedTime : 'Posted by ' + posterName;

    // Default session info display
    var basePrice = loc0.price_summary || '';
    var defaultInfo = datesText
      ? '💲 ' + basePrice + ' | 📅 ' + datesText
      : '💲 ' + basePrice;

    // Check favorite status
    var isFav = isFavorite(post.id);

    // Create wrapper - proper class naming: .open-post
    var wrap = document.createElement('div');
    wrap.className = 'open-post';
    wrap.dataset.id = String(post.id);
    wrap.dataset.postKey = post.post_key || '';

    // Use existing card or create new one
    var cardEl = existingCard;
    var isValidCard = cardEl && (cardEl.classList.contains('post-card') || cardEl.classList.contains('recent-card'));
    if (!isValidCard) {
      cardEl = renderPostCard(post);
    }

    // Remove hover highlight - CSS handles the open post background
    if (cardEl) {
      cardEl.classList.remove('post-card--map-highlight');
    }

    // Add share button if not present
    if (cardEl && !cardEl.querySelector('.open-post-button-share')) {
      var cardActions = cardEl.querySelector('.post-card-container-actions, .recent-card-container-actions');
      if (cardActions) {
        var shareBtn = document.createElement('button');
        shareBtn.className = 'open-post-button-share';
        shareBtn.setAttribute('aria-label', 'Share post');
        shareBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.06-.23.09-.46.09-.7s-.03-.47-.09-.7l7.13-4.17A2.99 2.99 0 0 0 18 9a3 3 0 1 0-3-3c0 .24.03.47.09.7L7.96 10.87A3.003 3.003 0 0 0 6 10a3 3 0 1 0 3 3c0-.24-.03-.47-.09-.7l7.13 4.17c.53-.5 1.23-.81 1.96-.81a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>';
        cardActions.appendChild(shareBtn);
      }
    }

    // Build venue dropdown options
    var venueOptionsHtml = locationList.map(function(loc, i) {
      return '<button data-index="' + i + '"><span class="open-post-text-venuename">' + escapeHtml(loc.venue_name || '') + '</span><span class="open-post-text-address">' + escapeHtml(loc.address_line || '') + '</span></button>';
    }).join('');

    // Create post body - proper class naming
    var postBody = document.createElement('div');
    postBody.className = 'open-post-body';
    postBody.innerHTML = [
      '<div class="open-post-container-nav">',
        '<button class="open-post-button-venue" type="button" aria-label="View Map" aria-haspopup="true" aria-expanded="false" data-nav="map">',
          '<div class="open-post-image-navpreview open-post-image-navpreview--map"></div>',
          '<span class="open-post-text-venuename">' + escapeHtml(venueName) + '</span>',
          '<span class="open-post-text-address">' + escapeHtml(addressLine) + '</span>',
          locationList.length > 1 ? '<span class="open-post-icon-arrow" aria-hidden="true"></span>' : '',
        '</button>',
        '<button class="open-post-button-session" type="button" aria-label="View Calendar" aria-haspopup="true" aria-expanded="false" data-nav="calendar">',
          '<div class="open-post-image-navpreview open-post-image-navpreview--calendar"></div>',
        '</button>',
      '</div>',
      '<div id="venue-' + post.id + '" class="open-post-dropdown-venue">',
        '<div class="open-post-menu-venue" hidden>',
          '<div class="open-post-container-map"><div id="map-' + post.id + '" class="open-post-map"></div></div>',
          '<div class="open-post-container-venueopts">' + venueOptionsHtml + '</div>',
        '</div>',
      '</div>',
      '<div id="sess-' + post.id + '" class="open-post-dropdown-session">',
        '<div class="open-post-menu-session" hidden>',
          '<div class="open-post-container-calendar"><div class="open-post-scroll-calendar"><div id="cal-' + post.id + '" class="open-post-calendar"></div></div></div>',
          '<div class="open-post-container-sessionopts"></div>',
        '</div>',
      '</div>',
      '<div class="open-post-container-details">',
        '<div class="open-post-container-venueselect"></div>',
        '<div class="open-post-container-sessionselect"></div>',
        '<div class="open-post-container-info">',
          '<div id="venue-info-' + post.id + '" class="open-post-text-venueinfo"></div>',
          '<div id="session-info-' + post.id + '" class="open-post-text-sessioninfo"><div>' + defaultInfo + '</div></div>',
        '</div>',
        '<div class="open-post-container-desc">',
          '<div class="open-post-text-desc" tabindex="0" aria-expanded="false">' + escapeHtml(description) + '</div>',
          '<div class="open-post-row-member"><span>' + escapeHtml(postedMeta) + '</span></div>',
        '</div>',
      '</div>',
      '<div class="open-post-container-images">',
        '<div class="open-post-container-hero">',
          '<div class="open-post-track-hero">',
            '<img class="open-post-image-hero open-post-image-hero--loading" src="' + heroUrl + '" data-full="' + (mediaUrls[0] || '') + '" alt="" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" />',
          '</div>',
        '</div>',
        '<div class="open-post-container-thumbs"></div>',
      '</div>'
    ].join('');

    // Build thumbnails - use 'minithumb' class (50x50) for small previews
    if (mediaUrls.length > 1) {
      var thumbRow = postBody.querySelector('.open-post-container-thumbs');
      if (thumbRow) {
        mediaUrls.forEach(function(url, i) {
          var img = document.createElement('img');
          img.className = 'open-post-image-thumb' + (i === 0 ? ' open-post-image-thumb--active' : '');
          img.src = addImageClass(url, 'minithumb');
          img.alt = '';
          img.dataset.index = String(i);
          img.dataset.fullUrl = url; // Store original URL for hero switching
          thumbRow.appendChild(img);
        });
      }
    }

    // Assemble structure
    wrap.appendChild(cardEl);
    wrap.appendChild(postBody);

    // Event handlers
    setupPostDetailEvents(wrap, post);

    return wrap;
  }

  /**
   * Format post creation timestamp
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted time like "2 hours ago"
   */
  function formatPostTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
      var date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      var diff = Date.now() - date.getTime();
      var mins = Math.floor(diff / 60000);
      if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
      var hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
      var days = Math.floor(hrs / 24);
      if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
      var months = Math.floor(days / 30);
      return months + ' month' + (months === 1 ? '' : 's') + ' ago';
    } catch (e) {
      return '';
    }
  }

  /**
   * Set up event handlers for post detail view
   * @param {HTMLElement} wrap - Detail view element
   * @param {Object} post - Post data
   */
  function setupPostDetailEvents(wrap, post) {
    // Get card element (first child)
    var cardEl = wrap.querySelector('.post-card, .recent-card');

    // Card click does not close post (removed per user request)

    // Favorite button:
    // IMPORTANT: do not bind a second handler here.
    // The reused `cardEl` already has its own favourite handler from `renderPostCard` / `renderRecentCard`.
    // Double-binding causes a double-toggle (appears "not working") when the post is open.

    // Share button
    var shareBtn = wrap.querySelector('.open-post-button-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sharePost(post);
      });
    }

    /* ........................................................................
       IMAGE GALLERY [COMPONENT PLACEHOLDER: ImageGalleryComponent]
       Hero image + thumbnail row with click-to-swap
       Future: Will become ImageGalleryComponent with swipe, zoom, lightbox
       ........................................................................ */

    var thumbnails = wrap.querySelectorAll('.open-post-container-thumbs img');
    var heroImg = wrap.querySelector('.open-post-image-hero');
    thumbnails.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        // Use stored full URL from data attribute, apply imagebox class for hero display
        var fullUrl = thumb.dataset.fullUrl || '';
        if (fullUrl && heroImg) {
          heroImg.src = addImageClass(fullUrl, 'imagebox');
          // Update active state
          thumbnails.forEach(function(t) { t.classList.remove('open-post-image-thumb--active'); });
          thumb.classList.add('open-post-image-thumb--active');
        }
      });
    });

    /* ........................................................................
       VENUE MENU [COMPONENT PLACEHOLDER: VenueMenuComponent]
       Map display + venue selection dropdown
       Future: Will become VenueMenuComponent with full map interaction
       ........................................................................ */
    var venueBtn = wrap.querySelector('.open-post-button-venue');
    var venueDropdown = wrap.querySelector('.open-post-dropdown-venue .open-post-menu-venue');
    var venueMapContainer = wrap.querySelector('.open-post-map');
    var venueMapInitialized = false;
    
    if (venueBtn && venueDropdown) {
      venueBtn.addEventListener('click', function() {
        var isExpanded = venueBtn.getAttribute('aria-expanded') === 'true';
        venueBtn.setAttribute('aria-expanded', !isExpanded);
        venueDropdown.hidden = isExpanded;
        
        // Initialize venue map on first open
        if (!isExpanded && !venueMapInitialized && venueMapContainer && window.mapboxgl) {
          var loc = post.map_cards && post.map_cards[0];
          if (loc && loc.longitude && loc.latitude) {
            var venueMap = new mapboxgl.Map({
              container: venueMapContainer,
              style: 'mapbox://styles/mapbox/streets-v12',
              center: [loc.longitude, loc.latitude],
              zoom: 15,
              interactive: true
            });
            
            // Add marker for venue
            new mapboxgl.Marker()
              .setLngLat([loc.longitude, loc.latitude])
              .addTo(venueMap);
            
            venueMapInitialized = true;
          }
        }
      });
    }

    /* ........................................................................
       SESSION MENU [COMPONENT PLACEHOLDER: SessionMenuComponent]
       CalendarComponent + session selection list
       Future: Will become SessionMenuComponent with date highlighting
       ........................................................................ */

    var sessionBtn = wrap.querySelector('.open-post-button-session');
    var sessionDropdown = wrap.querySelector('.open-post-dropdown-session .open-post-menu-session');
    var calendarContainer = wrap.querySelector('.open-post-calendar');
    var calendarInitialized = false;
    
    if (sessionBtn && sessionDropdown) {
      sessionBtn.addEventListener('click', function() {
        var isExpanded = sessionBtn.getAttribute('aria-expanded') === 'true';
        sessionBtn.setAttribute('aria-expanded', !isExpanded);
        sessionDropdown.hidden = isExpanded;
        
        // Initialize CalendarComponent and session options on first open
        if (!isExpanded && !calendarInitialized && calendarContainer && window.CalendarComponent) {
          // Gather session dates from all map cards
          var sessionDates = [];
          if (post.map_cards) {
            post.map_cards.forEach(function(mc) {
              if (mc.sessions && Array.isArray(mc.sessions)) {
                mc.sessions.forEach(function(s) {
                  if (s.date) sessionDates.push(s.date);
                });
              }
            });
          }
          
          CalendarComponent.create(calendarContainer, {
            monthsPast: 0,
            monthsFuture: 12,
            allowPast: false,
            selectionMode: 'single',
            onSelect: function(date) {
              // Update session info display when date selected
              var sessionInfo = wrap.querySelector('.open-post-text-sessioninfo');
              if (sessionInfo && date) {
                sessionInfo.innerHTML = '<div>📅 ' + formatDateShort(date) + '</div>';
              }
              // Close the session dropdown after selection
              sessionBtn.setAttribute('aria-expanded', 'false');
              sessionDropdown.hidden = true;
            }
          });
          
          // Build session options list
          var sessionOptsContainer = wrap.querySelector('.open-post-container-sessionopts');
          if (sessionOptsContainer && sessionDates.length > 0) {
            var uniqueDates = sessionDates.filter(function(d, i, arr) { return arr.indexOf(d) === i; }).sort();
            uniqueDates.forEach(function(dateStr) {
              var btn = document.createElement('button');
              btn.className = 'open-post-button-sessionopt';
              btn.textContent = formatDateShort(dateStr);
              btn.addEventListener('click', function() {
                var sessionInfo = wrap.querySelector('.open-post-text-sessioninfo');
                if (sessionInfo) {
                  sessionInfo.innerHTML = '<div>📅 ' + formatDateShort(dateStr) + '</div>';
                }
                sessionBtn.setAttribute('aria-expanded', 'false');
                sessionDropdown.hidden = true;
              });
              sessionOptsContainer.appendChild(btn);
            });
          }
          
          calendarInitialized = true;
        }
      });
    }

    // Venue option clicks
    var venueOptions = wrap.querySelectorAll('.open-post-container-venueopts button');
    venueOptions.forEach(function(optBtn) {
      optBtn.addEventListener('click', function() {
        var index = parseInt(optBtn.dataset.index, 10);
        var loc = post.map_cards && post.map_cards[index];
        if (loc) {
          // Update venue display
          var venueNameEl = venueBtn.querySelector('.open-post-text-venuename');
          var addressEl = venueBtn.querySelector('.open-post-text-address');
          if (venueNameEl) venueNameEl.textContent = loc.venue_name || '';
          if (addressEl) addressEl.textContent = loc.address_line || '';
          // Close dropdown
          venueBtn.setAttribute('aria-expanded', 'false');
          venueDropdown.hidden = true;
        }
      });
    });

    /* ........................................................................
       DESCRIPTION EXPAND
       Click/keyboard to toggle post detail expansion
       ........................................................................ */

    var descEl = wrap.querySelector('.open-post-text-desc');
    if (descEl) {
      descEl.addEventListener('click', function(e) {
        e.preventDefault();
        var isExpanded = wrap.classList.contains('open-post--desc-expanded');
        wrap.classList.toggle('open-post--desc-expanded', !isExpanded);
        descEl.setAttribute('aria-expanded', !isExpanded ? 'true' : 'false');
      });
      
      // Also handle keyboard for accessibility
      descEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var isExpanded = wrap.classList.contains('open-post--desc-expanded');
          wrap.classList.toggle('open-post--desc-expanded', !isExpanded);
          descEl.setAttribute('aria-expanded', !isExpanded ? 'true' : 'false');
        }
      });
    }

    /* ........................................................................
       PROGRESSIVE IMAGE LOADING
       Swap low-quality placeholder with full image after load
       ........................................................................ */

    (function() {
      var img = wrap.querySelector('.open-post-image-hero');
      if (img) {
        var full = img.getAttribute('data-full');
        if (full) {
          var hi = new Image();
          hi.referrerPolicy = 'no-referrer';
          hi.fetchPriority = 'high';
          hi.onload = function() {
            var swap = function() {
              img.src = full;
              img.classList.remove('open-post-image-hero--loading');
              img.classList.add('open-post-image-hero--ready');
            };
            if (hi.decode) {
              hi.decode().then(swap).catch(swap);
            } else {
              swap();
            }
          };
          hi.src = full;
        }
      }
    })();
  }

  /**
   * Close a post by ID
   * @param {string|number} postId - Post ID
   */
  function closePost(postId) {
    var openPost = document.querySelector('.open-post[data-id="' + postId + '"]');
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

  /* --------------------------------------------------------------------------
     SHARE
     -------------------------------------------------------------------------- */

  /**
   * Share a post
   * @param {Object} post - Post data
   */
  function sharePost(post) {
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
    var title = (mapCard && mapCard.title) || post.checkout_title || '';
    var url = window.location.origin + '/post/' + (post.post_key || post.id);

    // Use Web Share API if available, otherwise copy to clipboard
    if (navigator.share) {
      navigator.share({
        title: title,
        url: url
      }).catch(function() {
        // Share cancelled or failed - copy instead
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
      });
    } else {
      // Legacy browser method (pre-Clipboard API)
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard');
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
      // ToastComponent not loaded - log for visibility
      console.log('[Post] ' + message);
    }
  }

  /* --------------------------------------------------------------------------
     FAVORITES
     -------------------------------------------------------------------------- */

  function getCurrentSortKeyForPosts() {
    try {
      if (window.FilterModule && typeof FilterModule.getFilterState === 'function') {
        var st = FilterModule.getFilterState();
        if (st && st.sort) return String(st.sort);
      }
    } catch (_e) {}
    return 'az';
  }

  /**
   * Toggle favorite status
   * Uses aria-pressed and CSS attribute selectors for styling
   * @param {Object} post - Post data
   * @param {HTMLElement} btn - Favorite button element
   */
  function toggleFavorite(post, btn) {
    var isFav = btn.getAttribute('aria-pressed') === 'true';
    var newFav = !isFav;

    btn.setAttribute('aria-pressed', newFav ? 'true' : 'false');

    // Update all instances of this post's fav button (both post-card and recent-card)
    document.querySelectorAll('[data-id="' + post.id + '"] .post-card-button-fav, [data-id="' + post.id + '"] .recent-card-button-fav').forEach(function(otherBtn) {
      if (otherBtn === btn) return;
      otherBtn.setAttribute('aria-pressed', newFav ? 'true' : 'false');
    });

    // Save to localStorage
    saveFavorite(post.id, newFav);
    // Live-site behavior: do NOT reorder immediately on star/unstar.
    if (favToTop) {
      favSortDirty = true;
    }
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
     RECENT PANEL
     -------------------------------------------------------------------------- */

  /**
   * Get recent history from localStorage
   * @returns {Array} Array of { id, post_key, title, timestamp }
   */
  function getRecentHistory() {
    try {
      var history = JSON.parse(localStorage.getItem('recentPosts') || '[]');
      return Array.isArray(history) ? history : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Render the recent panel with history entries
   */
  function renderRecentPanel() {
    if (!recentPanelContentEl) return;

    var history = getRecentHistory();

    // Show empty state if no history
    if (!history.length) {
      renderRecentEmptyState();
      return;
    }

    recentPanelContentEl.innerHTML = '';

    // Create list container
    var listEl = document.createElement('div');
    listEl.className = 'recent-list';

    // Render each recent entry
    history.forEach(function(entry) {
      var card = renderRecentCard(entry);
      if (card) {
        listEl.appendChild(card);
      }
    });

    recentPanelContentEl.appendChild(listEl);

    // Add footer reminder
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

  /**
   * Render a recent card
   * Structure: .recent-card-image, .recent-card-meta, .recent-card-text-title, .recent-card-container-info
   * @param {Object} entry - Recent history entry { id, post_key, title, timestamp }
   * @returns {HTMLElement|null} Recent card element
   */
  function renderRecentCard(entry) {
    if (!entry || !entry.id) return null;

    // Try to find full post data in cache
    var post = null;
    if (cachedPosts) {
      for (var i = 0; i < cachedPosts.length; i++) {
        if (String(cachedPosts[i].id) === String(entry.id)) {
          post = cachedPosts[i];
          break;
        }
      }
    }

    var el = document.createElement('article');
    el.className = 'recent-card';
    el.dataset.id = String(entry.id);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    // Get data from post or entry
    var title = entry.title || (post && post.checkout_title) || '';
    var mapCard = post && post.map_cards && post.map_cards.length ? post.map_cards[0] : null;
    // Use 'thumbnail' class (100x100) for recent cards
    var thumbUrl = addImageClass(mapCard && mapCard.media_urls && mapCard.media_urls.length ? mapCard.media_urls[0] : '', 'thumbnail');
    var city = mapCard ? (mapCard.city || mapCard.venue_name || '') : '';

    // Get subcategory info
    var subcategoryKey = post ? (post.subcategory_key || '') : '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = post ? (post.subcategory_icon_url || getSubcategoryIconUrl(subcategoryKey)) : '';

    // Format last opened time
    var lastOpenedText = formatLastOpened(entry.timestamp);

    // Build card HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbHtml = '<img class="recent-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />';

    var iconHtml = iconUrl
      ? '<span class="recent-card-icon-sub"><img src="' + iconUrl + '" alt="" /></span>'
      : '';

    var catLineText = subInfo.category && subInfo.subcategory
      ? subInfo.category + ' &gt; ' + subInfo.subcategory
      : subInfo.subcategory || subcategoryKey;

    // Check favorite status
    var isFav = isFavorite(entry.id);

    el.innerHTML = [
      thumbHtml,
      '<div class="recent-card-meta">',
        '<div class="recent-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="recent-card-container-info">',
          catLineText ? '<div class="recent-card-row-cat">' + iconHtml + ' ' + catLineText + '</div>' : '',
          city ? '<div class="recent-card-row-loc"><span class="recent-card-badge" title="Venue">📍</span><span>' + escapeHtml(city) + '</span></div>' : '',
          lastOpenedText ? '<div class="recent-card-row-date"><span class="recent-card-badge" title="Last opened">🕒</span><span>' + escapeHtml(lastOpenedText) + '</span></div>' : '',
        '</div>',
      '</div>',
      '<div class="recent-card-container-actions">',
        '<button class="recent-card-button-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
          '<svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>',
        '</button>',
      '</div>'
    ].join('');

    // Click handler
    el.addEventListener('click', function(e) {
      if (e.target.closest('.recent-card-button-fav')) return;

      // If we have full post data, open it
      if (post) {
        openPost(post, { fromRecent: true, originEl: el });
      } else {
        // Need to fetch the post
        loadPostById(entry.id).then(function(fetchedPost) {
          if (fetchedPost) {
            openPost(fetchedPost, { fromRecent: true, originEl: el });
          }
        });
      }
    });

    // Keyboard: Enter/Space opens card (matches button behavior)
    el.addEventListener('keydown', function(e) {
      if (!e) return;
      var k = String(e.key || e.code || '');
      if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar' && k !== 'Space') return;
      if (e.target && e.target.closest && e.target.closest('.recent-card-button-fav')) return;
      e.preventDefault();
      // Reuse click logic path
      try { el.click(); } catch (_eClick) {}
    });

    // Favorite toggle
    var favBtn = el.querySelector('.recent-card-button-fav');
    if (favBtn) {
      favBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleFavoriteById(entry.id, favBtn);
      });
    }

    return el;
  }

  /**
   * Format last opened timestamp
   * @param {number} timestamp - Unix timestamp in ms
   * @returns {string} Formatted string like "Last opened 5 minutes ago"
   */
  function formatLastOpened(timestamp) {
    if (!timestamp) return '';

    var diff = Date.now() - timestamp;
    var mins = Math.floor(diff / 60000);
    var ago;

    if (mins < 60) {
      ago = mins + ' minute' + (mins === 1 ? '' : 's');
    } else if (mins < 1440) {
      var hrs = Math.floor(mins / 60);
      ago = hrs + ' hour' + (hrs === 1 ? '' : 's');
    } else {
      var days = Math.floor(mins / 1440);
      ago = days + ' day' + (days === 1 ? '' : 's');
    }

    return 'Last opened ' + ago + ' ago';
  }

  /**
   * Toggle favorite by ID (when full post data not available)
   * Uses aria-pressed and CSS attribute selectors for styling
   * @param {number|string} postId - Post ID
   * @param {HTMLElement} btn - Favorite button element
   */
  function toggleFavoriteById(postId, btn) {
    var isFav = btn.getAttribute('aria-pressed') === 'true';
    var newFav = !isFav;

    btn.setAttribute('aria-pressed', newFav ? 'true' : 'false');

    // Save to localStorage
    saveFavorite(postId, newFav);

    // Update other instances (both post-card and recent-card)
    document.querySelectorAll('[data-id="' + postId + '"] .post-card-button-fav, [data-id="' + postId + '"] .recent-card-button-fav').forEach(function(otherBtn) {
      if (otherBtn === btn) return;
      otherBtn.setAttribute('aria-pressed', newFav ? 'true' : 'false');
    });

    if (favToTop) {
      favSortDirty = true;
    }
  }

  /**
   * Load a single post by ID
   * @param {number|string} postId - Post ID
   * @returns {Promise<Object|null>} Post data or null
   */
  function loadPostById(postId) {
    return fetch('/gateway.php?action=get-posts&limit=1&post_id=' + postId)
      .then(function(response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function(data) {
        if (data && data.success && data.posts && data.posts.length) {
          return data.posts[0];
        }
        return null;
      })
      .catch(function() {
        return null;
      });
  }

  /* --------------------------------------------------------------------------
     BUTTON ANCHORS (Anti-jank)
     Attach to scroll containers so clicked controls don't "fly away"
     -------------------------------------------------------------------------- */

  function attachButtonAnchors() {
    if (!postListEl || !recentPanelContentEl) return;
    if (!window.BottomSlack) {
      throw new Error('[Post] BottomSlack is required (components-new.js).');
    }

    // Same options used elsewhere (keep site-wide feel consistent).
    var options = { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 };
    // Attach to the actual scroll containers.
    BottomSlack.attach(postListEl, options);
    BottomSlack.attach(recentPanelContentEl, options);
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
    return document.querySelector('.header-modeswitch > .button-class-1[data-mode="' + mode + '"]');
  }

  function inferCurrentModeFromHeader() {
    try {
      var active = document.querySelector('.header-modeswitch > .button-class-1[aria-pressed="true"]');
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
    getCachedPosts: function() { return cachedPosts; },
    getVisiblePosts: function() { return filteredPosts || cachedPosts; },
    getVisibleMapCardCount: function() {
      var posts = filteredPosts || cachedPosts || [];
      var count = 0;
      for (var i = 0; i < posts.length; i++) {
        var mc = posts[i].map_cards;
        count += (Array.isArray(mc) ? mc.length : 0);
      }
      return count;
    },
    openPost: openPost,
    openPostById: openPostById,
    closePost: closePost,
    renderMapMarkers: renderMapMarkers,
    highlightMapMarker: highlightMapMarker
  };

})();

// Register with App
App.registerModule('post', PostModule);

// Expose globally for consistency with other modules
window.PostModule = PostModule;

