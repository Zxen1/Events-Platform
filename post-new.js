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

  /* ==========================================================================
     IMPORTANT (Developer Note): TWO FILTERING PIPELINES EXIST
     --------------------------------------------------------------------------
     This file (`post-new.js`) owns the HIGH-ZOOM filtering pipeline:
       zoom >= postsLoadZoom (default 8)
     
     High zoom is "in this map area" mode:
     - We listen for `App.emit('filter:changed', state)` from `filter-new.js`
     - We also listen for `App.emit('map:boundsChanged', { zoom, ... })` from `map-new.js`
     - We fetch detailed posts via `/gateway.php?action=get-posts` using:
         - saved filter params (keyword/date/price/subcategory keys/etc.)
         - `bounds` (the map area filter)
     - We render Post cards + Map cards (detailed payload)
     
     Low zoom (< postsLoadZoom) does NOT load detailed posts worldwide.
     That mode is handled by clusters in `map-new.js` via `/gateway.php?action=get-clusters`.
     ========================================================================== */

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

  // NOTE: We intentionally do NOT keep an in-memory cache of post responses.
  // We render directly from the latest server response and keep the DOM as the source of truth.
  // (Agent Essentials: No Snapshots / no caching during development.)
  var postsLoading = false;
  var postsError = null;
  var postsRequestToken = 0;
  var postsAbort = null;

  // Panel motion state (kept in-module for cleanliness; no DOM-stashed handlers).
  var panelMotion = {
    post: { token: 0, hideHandler: null, hideTimeoutId: 0 },
    recent: { token: 0, hideHandler: null, hideTimeoutId: 0 }
  };

  /* --------------------------------------------------------------------------
     UI PERSISTENCE (panel mode + scroll positions)
     -------------------------------------------------------------------------- */

  var UI_STATE_STORAGE_KEY = 'funmap_ui_state';
  var uiScrollSaveTimers = { post: 0, recent: 0 };
  var uiRestoreApplied = { post: false, recent: false };
  var pendingModeRestore = ''; // 'map' | 'posts' | 'recent' | ''

  function loadUiState() {
    try {
      var raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  function writeUiState(next) {
    try {
      var clean = next && typeof next === 'object' ? next : {};
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(clean));
    } catch (_e) {}
  }

  function mergeUiState(patch) {
    var prev = loadUiState() || {};
    var next = Object.assign({}, prev, patch || {});
    // Always include a timestamp for debugging / future migrations.
    next.updated_at = Date.now();
    writeUiState(next);
    return next;
  }

  function scheduleSavePanelScroll(panelKey) {
    if (!panelKey) return;
    if (uiScrollSaveTimers[panelKey]) {
      clearTimeout(uiScrollSaveTimers[panelKey]);
      uiScrollSaveTimers[panelKey] = 0;
    }
    uiScrollSaveTimers[panelKey] = setTimeout(function() {
      uiScrollSaveTimers[panelKey] = 0;
      try {
        if (panelKey === 'post' && postListEl) {
          mergeUiState({ postScrollTop: postListEl.scrollTop || 0 });
        }
        if (panelKey === 'recent' && recentPanelContentEl) {
          mergeUiState({ recentScrollTop: recentPanelContentEl.scrollTop || 0 });
        }
      } catch (_e) {}
    }, 180);
  }

  function bindUiPersistence() {
    // Scroll positions (always-save, regardless of which mode is active).
    try {
      if (postListEl) {
        postListEl.addEventListener('scroll', function() { scheduleSavePanelScroll('post'); }, { passive: true });
      }
    } catch (_ePostScroll) {}
    try {
      if (recentPanelContentEl) {
        recentPanelContentEl.addEventListener('scroll', function() { scheduleSavePanelScroll('recent'); }, { passive: true });
      }
    } catch (_eRecentScroll) {}
  }

  function applySavedPanelScroll(panelKey) {
    if (!panelKey) return;
    if (uiRestoreApplied[panelKey]) return;

    var st = loadUiState() || {};
    try {
      if (panelKey === 'post' && postListEl && typeof st.postScrollTop === 'number') {
        postListEl.scrollTop = Math.max(0, st.postScrollTop);
        uiRestoreApplied.post = true;
      }
      if (panelKey === 'recent' && recentPanelContentEl && typeof st.recentScrollTop === 'number') {
        recentPanelContentEl.scrollTop = Math.max(0, st.recentScrollTop);
        uiRestoreApplied.recent = true;
      }
    } catch (_e) {}
  }

  function maybeRestoreModeOnBoot() {
    // Deep links are authoritative: they decide the mode (recent) and scroll to top.
    // Do not override that with a prior saved UI state.
    try {
      if (getDeepLinkKeyFromUrl()) return;
    } catch (_eDLKey) {}

    var st = loadUiState() || {};
    var savedMode = st && st.mode ? String(st.mode) : '';
    if (!savedMode) return;
    if (savedMode !== 'map' && savedMode !== 'posts' && savedMode !== 'recent') return;

    // If we can't restore posts yet (zoom gating), defer until map:ready updates postsEnabled.
    pendingModeRestore = savedMode;
    tryRestorePendingMode();
  }

  function tryRestorePendingMode() {
    var m = pendingModeRestore;
    if (!m) return;

    if (m === 'posts' && !postsEnabled) {
      return; // wait until postsEnabled is true
    }

    // Avoid click-toggles ("already active returns to map").
    if (currentMode === m) {
      pendingModeRestore = '';
      return;
    }

    var btn = getModeButton(m);
    if (!btn) return;
    try { btn.click(); } catch (_eClick) {}
    pendingModeRestore = '';
  }

  /* --------------------------------------------------------------------------
     INIT
     -------------------------------------------------------------------------- */

  function init() {
    // Preload currency data for price summary parsing (handles old data flags)
    if (window.CurrencyComponent && typeof CurrencyComponent.loadFromDatabase === 'function') {
      CurrencyComponent.loadFromDatabase().catch(function() {});
    }

    panelsContainerEl = document.querySelector('.post-mode-panels');
    if (!panelsContainerEl) {
      throw new Error('[Post] .post-mode-panels container not found.');
    }

    ensurePanelsDom();
    bindUiPersistence();
    attachButtonAnchors();
    bindAppEvents();
    bindModeButtons();

    // DB-first/localStorage filter state is stored in localStorage by MemberModule on login.
    // PostModule needs it even if the filter panel hasn't been opened yet.
    currentFilters = loadSavedFiltersFromLocalStorage();

    // Capture initial mode (HeaderModule already ran, but PostModule may have missed the event).
    currentMode = inferCurrentModeFromHeader() || 'map';
    applyMode(currentMode);
    // Restore panel mode + scroll position from last session (guest + logged-in).
    // (Account-wide persistence can be layered later; for now this is fast and robust.)
    try { maybeRestoreModeOnBoot(); } catch (_eUiRestore) {}

    // Initialize zoom gating if we can.
    primeZoomFromMapIfAvailable();
    updatePostsButtonState();

    // Deep link: allow shared URLs like `/?post=<post_key>` or `/post/<post_key>` to open in Recent panel.
    // NOTE: `/post/*` requires server routing to reach index page; `?post=` works without rewrites.
    try { setTimeout(maybeOpenDeepLinkedPost, 0); } catch (_eDL) {}
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
      // Persist last used mode so refresh returns to the same panel.
      try { mergeUiState({ mode: currentMode }); } catch (_eModeStore) {}

      // Requirement: no map card should remain active when panels are closed / no open post is visible.
      // When we return to Map mode, clear active/big markers.
      try {
        if (currentMode === 'map' && window.MapModule && typeof MapModule.clearActiveMapCards === 'function') {
          MapModule.clearActiveMapCards();
        }
      } catch (_eClearActive) {}
    });

    // When a post is closed, clear active/big markers (there is no longer an "open post" context).
    App.on('post:closed', function() {
      try {
        if (window.MapModule && typeof MapModule.clearActiveMapCards === 'function') {
          MapModule.clearActiveMapCards();
        }
      } catch (_eClearOnClose) {}
    });

    // Refresh posts when a new one is created or an existing one is updated
    App.on('post:created', function() {
      refreshPosts();
    });
    App.on('post:updated', function() {
      refreshPosts();
    });

    App.on('map:ready', function(data) {
      try {
        var map = data && data.map;
        if (map && typeof map.getZoom === 'function') {
          lastZoom = map.getZoom();
          updatePostsButtonState();
        }
        // If we were waiting for zoom gating to allow restoring Posts mode, try now.
        try { tryRestorePendingMode(); } catch (_eModeRestore) {}
        // If the page loads directly into a saved zoom>=threshold view, Mapbox may not emit a
        // boundsChanged/move event on its own. That would leave posts/map-cards empty until the user nudges the map.
        // Fix: kick an initial in-area load once on map:ready when we're already above threshold.
        try {
          var threshold0 = getPostsMinZoom();
          if (typeof lastZoom === 'number' && lastZoom >= threshold0) {
            var bInit = getMapBounds();
            var boundsKeyInit = bInit ? boundsToKey(bInit, 2) : '';
            if (boundsKeyInit && boundsKeyInit !== lastLoadedBoundsKey && !postsLoading) {
              lastLoadedBoundsKey = boundsKeyInit;
              applyFilters(currentFilters || loadSavedFiltersFromLocalStorage() || {});
            }
          }
        } catch (_eInitLoad) {}
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
          if (boundsKey && boundsKey !== lastLoadedBoundsKey) {
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

    // No in-memory cache: always load the post fresh by ID.
    // This keeps development honest (no stale snapshots masking filter/category bugs).
    loadPostById(postId).then(function(post) {
      if (!post) {
        console.warn('[Post] Post not found:', postId);
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
        // IMPORTANT:
        // At zoom >= threshold, Posts are an "in this map area" view (bounds-filtered).
        // Do NOT load worldwide posts on open/refresh — that causes the "whole world" flash
        // until the user moves the map and triggers boundsChanged.
        var threshold = getPostsMinZoom();
        if (typeof lastZoom === 'number' && lastZoom >= threshold) {
          applyFilters(currentFilters || loadSavedFiltersFromLocalStorage() || {});
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

        // Restore the last scroll position for this panel (once per page load).
        // This makes refresh feel like "nothing moved" for users browsing long lists.
        try { applySavedPanelScroll(panelKey); } catch (_eScrollRestore) {}
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
    // Agent Essentials: NO HARDCODE.
    // postsLoadZoom must be configured (admin setting / config) for every deployment.
    if (!window.App || typeof App.getConfig !== 'function') {
      throw new Error('[Post] App.getConfig is required for postsLoadZoom (no hardcoded fallback).');
    }
    var v = App.getConfig('postsLoadZoom');
    var n = Number(v);
    if (!Number.isFinite(n)) {
      throw new Error('[Post] postsLoadZoom config is missing/invalid (no hardcoded fallback).');
    }
    return n;
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
      if (Array.isArray(f.subcategoryKeys)) {
        // IMPORTANT: empty array means "no subcategories selected" → show nothing (don't fetch worldwide).
        if (f.subcategoryKeys.length === 0) {
          // Cancel any in-flight request and invalidate stale responses.
          postsRequestToken++;
          try { if (postsAbort) postsAbort.abort(); } catch (_eAbort0) {}
          postsAbort = null;
          postsLoading = false;
          renderPostsEmptyState();
          App.emit('filter:countsUpdated', { total: 0, filtered: 0 });
          return Promise.resolve([]);
        }
        params.append('subcategory_keys', f.subcategoryKeys.map(String).join(','));
      }
    } else if (options && options.subcategory_key) {
      // Legacy
      params.append('subcategory_key', options.subcategory_key);
    }

    var requestKey = params.toString();

    // New request: abort any in-flight request so category toggles / map moves take effect immediately.
    postsRequestToken++;
    var myToken = postsRequestToken;
    try { if (postsAbort) postsAbort.abort(); } catch (_eAbort) {}
    postsAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    postsLoading = true;

    return fetch('/gateway.php?action=get-posts&' + requestKey, postsAbort ? { signal: postsAbort.signal } : undefined)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to load posts: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        // Ignore stale responses
        if (myToken !== postsRequestToken) return [];
        postsLoading = false;
        if (data.success && Array.isArray(data.posts)) {
          renderPostList(data.posts);
          // Emit counts for the current viewport (server-filtered)
          emitFilterCounts(data.posts);
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
        // Abort is expected when filters/map change quickly.
        try {
          if (err && (err.name === 'AbortError' || String(err.message || '').toLowerCase().indexOf('abort') !== -1)) {
            // Only clear loading if this request is still the latest.
            if (myToken === postsRequestToken) postsLoading = false;
            return [];
          }
        } catch (_eAbortName) {}
        if (myToken !== postsRequestToken) return [];
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
   * Pick a safe postcard thumbnail src.
   * @param {string} rawUrl - Full raw image URL
   * @returns {string} URL to use for <img src>
   */
  function getCardThumbSrc(rawUrl) {
    if (!rawUrl) return '';
    return addImageClass(rawUrl, 'thumbnail');
  }

  /**
   * Attach a robust loader to a postcard thumbnail image.
   * Agent Essentials: NO FALLBACKS.
   * If Bunny presets are misconfigured, we want to SEE it (broken image + console error),
   * not silently retry with a different URL.
   * @param {HTMLImageElement} imgEl
   * @param {string} rawUrl
   */
  function wireCardThumbImage(imgEl, rawUrl) {
    if (!imgEl || !rawUrl) return;

    // Only wire once per element.
    if (imgEl.dataset && imgEl.dataset.wiredThumb === '1') return;
    if (imgEl.dataset) imgEl.dataset.wiredThumb = '1';

    var primarySrc = addImageClass(rawUrl, 'thumbnail');

    // Set initial src if caller didn't.
    if (!imgEl.getAttribute('src')) {
      imgEl.src = primarySrc;
    }
    
    // If the image fails to load, do not retry. Make it loud for debugging.
    imgEl.addEventListener('error', function onErr() {
      try { if (imgEl.dataset) imgEl.dataset.thumbLoadError = '1'; } catch (_eDs) {}
      var srcNow = '';
      try { srcNow = String(imgEl.currentSrc || imgEl.src || ''); } catch (_eSrc) {}
      console.error('[Post] Thumbnail failed to load (no fallback). Check Bunny preset "thumbnail":', srcNow, 'raw:', rawUrl);
      // Throwing here surfaces the problem clearly in devtools without masking it.
      throw new Error('[Post] Thumbnail failed to load (no fallback). Bunny preset "thumbnail" may be misconfigured.');
    });
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
    // 1. Try pre-formatted session_summary from first map card (fast display)
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
    if (mapCard && mapCard.session_summary && typeof mapCard.session_summary === 'string' && mapCard.session_summary.trim() !== '' && mapCard.session_summary.indexOf('{') !== 0) {
      return mapCard.session_summary;
    }

    // 2. Fallback to sessions array (backwards compatibility / initial load)
    if (!mapCard) return '';
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
    // Format: "Sun 16 Jan - Fri 20 Jan" or just "Sun 16 Jan" if same/single
    if (firstDate === lastDate || sortedSessions.length === 1) {
      return App.formatDateShort(firstDate);
    }
    return App.formatDateShort(firstDate) + ' - ' + App.formatDateShort(lastDate);
  }

  /**
   * Format a single date string for display
   * @param {string} dateStr - Date string (YYYY-MM-DD or similar)
   * @returns {string} Formatted date like "Jan 1"
   */
  function formatDateShort(dateStr) {
    return App.formatDateShort(dateStr);
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
    if (title === 'Array') title = 'Post #' + post.id;
    var venueName = (mapCard && mapCard.venue_name) || '';
    var city = (mapCard && mapCard.city) || '';
    var locationDisplay = venueName || city || '';

    // Get subcategory info
    var subcategoryKey = post.subcategory_key || (mapCard && mapCard.subcategory_key) || '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = post.subcategory_icon_url || getSubcategoryIconUrl(subcategoryKey);

    // Format dates (if sessions exist)
    var datesText = formatPostDates(post);

    // Format price summary
    var priceParts = parsePriceSummary(mapCard ? mapCard.price_summary : '');

    // Store small, per-card sort metadata on the element itself (DOM is the source of truth).
    // This avoids keeping an in-memory posts snapshot while still allowing the sort menu to work.
    try {
      el.dataset.sortTitle = String(title || '').toLowerCase();
      el.dataset.sortCreatedAt = String(new Date(post.created_at || 0).getTime() || 0);
      el.dataset.sortPrice = String(extractPrice(mapCard) || 0);
      el.dataset.sortSoonTs = String(getPostSoonestTimestamp(post) || '');
      if (mapCard && Number.isFinite(Number(mapCard.longitude)) && Number.isFinite(Number(mapCard.latitude))) {
        el.dataset.sortLng = String(mapCard.longitude);
        el.dataset.sortLat = String(mapCard.latitude);
      } else {
        el.dataset.sortLng = '';
        el.dataset.sortLat = '';
      }
    } catch (_eSortMeta) {}

    // Postcard thumbnail (100x100 in CSS). We try ?class=thumbnail if supported, otherwise raw URL.
    var rawThumbUrl = getPostThumbnailUrl(post);
    var thumbUrl = getCardThumbSrc(rawThumbUrl);

    // Build HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbHtml = rawThumbUrl
      ? '<img class="post-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="post-card-image post-card-image--empty" aria-hidden="true"></div>';

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
          priceParts.text ? (function() {
            var badge = priceParts.flagUrl 
              ? '<img class="post-card-badge" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 5px; object-fit: contain;">'
              : '<span class="post-card-badge" title="Price">💰</span>';
            return '<div class="post-card-row-price">' + badge + '<span>' + escapeHtml(priceParts.text) + '</span></div>';
          })() : '',
        '</div>',
      '</div>',
      '<div class="post-card-container-actions">',
        '<button class="post-card-button-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
          '<svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>',
        '</button>',
      '</div>'
    ].join('');

    // Robust thumbnail loader (prevents broken/missing thumbnails if class=thumbnail isn't supported).
    if (rawThumbUrl) {
      wireCardThumbImage(el.querySelector('.post-card-image'), rawThumbUrl);
    }

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

      // CRITICAL SYNC RULE:
      // At zoom >= postsLoadZoom, map cards MUST reflect the same result set as the Postcards.
      // If the server returns 0 results (e.g., category/subcategory switched off), we must clear
      // any existing map card markers immediately (otherwise old markers "stick" and appear unfiltered).
      try {
        var threshold0 = getPostsMinZoom();
        if (typeof lastZoom === 'number' && lastZoom >= threshold0) {
          if (window.MapModule && typeof MapModule.clearAllMapCardMarkers === 'function') {
            MapModule.clearAllMapCardMarkers();
          }
          lastRenderedVenueMarkerSigByKey = {};
        }
      } catch (_eClear0) {}

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
    // Prefer map-card key (mc.subcategory_key) — it's the server-side filter key at zoom>=postsLoadZoom.
    var subcategoryKey = mapCard.subcategory_key || post.subcategory_key || '';

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
    
    // Category/Subcategory filtering for map cards:
    // At zoom>=postsLoadZoom, the server filters POSTS by map-card subcategory keys (mc.subcategory_key).
    // However, a post can contain multiple map cards; we must also filter the *map cards* we render so
    // toggling category switches affects map markers exactly like it affects visible results.
    var allowedSubKeys = null;
    try {
      if (currentFilters && Array.isArray(currentFilters.subcategoryKeys)) {
        allowedSubKeys = new Set(currentFilters.subcategoryKeys.map(function(v) { return String(v); }));
      }
    } catch (_eAllowed) {
      allowedSubKeys = null;
    }

    posts.forEach(function(post) {
      if (!post.map_cards || !post.map_cards.length) return;
      
      post.map_cards.forEach(function(mapCard, index) {
        if (!mapCard) return;

        // If category/subcategory filtering is active, only render map cards whose subcategory_key is allowed.
        // Prefer the map-card key (mc.subcategory_key), fall back to post key only if map-card key is missing.
        if (allowedSubKeys) {
          var mcKey = (mapCard.subcategory_key !== undefined && mapCard.subcategory_key !== null)
            ? String(mapCard.subcategory_key)
            : String(post.subcategory_key || '');
          if (!mcKey || !allowedSubKeys.has(mcKey)) return;
        }

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
      // IMPORTANT: removals must be based on what markers actually exist on the map,
      // not only on PostModule's lastRenderedVenueMarkerSigByKey (which can drift after refresh/rebuilds).
      var existingKeys = [];
      try {
        if (typeof mapModule.getMapCardMarkerVenueKeys === 'function') {
          existingKeys = mapModule.getMapCardMarkerVenueKeys() || [];
        } else {
          existingKeys = Object.keys(lastRenderedVenueMarkerSigByKey || {});
        }
      } catch (_eKeys) {
        existingKeys = Object.keys(lastRenderedVenueMarkerSigByKey || {});
      }

      existingKeys.forEach(function(venueKey) {
        if (!nextSigByKey[venueKey]) mapModule.removeMapCardMarker(venueKey);
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
  function emitFilterCounts(posts) {
    var list = Array.isArray(posts) ? posts : [];
    // At zoom>=threshold, `list` is already server-filtered.
    // We still emit counts so the filter UI can reflect the current viewport result size.
    var totalInArea = countMapCardsInView(list);
    var filteredCount = totalInArea;

    App.emit('filter:countsUpdated', {
      total: totalInArea,
      filtered: filteredCount
    });

    // Notify marquee and other subscribers
    App.emit('filter:applied', {
      marqueePosts: list.slice(0, 10) // Show top 10 in marquee
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
      loadPosts({ bounds: boundsParam, limit: 200, offset: 0, filters: filterState || {} }).then(function(posts) {
        // Server returned filtered posts; renderMapMarkers is called by loadPosts->renderPostList path.
        // Keep active state synced if open post still exists.
        emitFilterCounts(posts);
        restoreActiveMapCardFromOpenPost();
      });
      return;
    }

    // Below threshold: no posts list should be shown; keep counts/clusters updated elsewhere.
    App.emit('filter:countsUpdated', { total: 0, filtered: 0 });
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
    // Agent Essentials: no post response caching.
    // Sorting is applied to the CURRENT rendered cards (DOM), not an in-memory snapshot.
    if (!postListEl) return;

    // Preserve summary + open-post wrapper positions.
    var summaryEl = postListEl.querySelector('.post-panel-summary');
    var openWrap = postListEl.querySelector('.open-post');

    var cards = [];
    try {
      // Direct children only (avoid grabbing the embedded open-post header card).
      cards = Array.prototype.slice.call(postListEl.querySelectorAll(':scope > .post-card'));
    } catch (_eScope) {
      cards = Array.prototype.slice.call(postListEl.querySelectorAll('.post-card'));
      // Filter out cards that live inside an open-post wrapper.
      cards = cards.filter(function(el) {
        var p = el && el.parentElement;
        while (p) {
          if (p.classList && p.classList.contains('open-post')) return false;
          if (p === postListEl) break;
          p = p.parentElement;
        }
        return true;
      });
    }
    if (!cards.length) return;

    var center = getMapCenter();
    function distanceToCenterKm(cardEl) {
      if (!center || !cardEl || !cardEl.dataset) return Number.POSITIVE_INFINITY;
      var lng = Number(cardEl.dataset.sortLng);
      var lat = Number(cardEl.dataset.sortLat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Number.POSITIVE_INFINITY;
      return distKm({ lng: lng, lat: lat }, { lng: Number(center.lng), lat: Number(center.lat) });
    }

    cards.sort(function(aEl, bEl) {
      // Live-site behavior: "Favourites on top" only applies when not dirty.
      if (favToTop && !favSortDirty) {
        var favA = isFavorite(aEl && aEl.dataset ? aEl.dataset.id : '');
        var favB = isFavorite(bEl && bEl.dataset ? bEl.dataset.id : '');
        if (favA !== favB) return (favB ? 1 : 0) - (favA ? 1 : 0);
      }

      var a = aEl && aEl.dataset ? aEl.dataset : {};
      var b = bEl && bEl.dataset ? bEl.dataset : {};

      switch (sortKey) {
        case 'az':
          return String(a.sortTitle || '').localeCompare(String(b.sortTitle || ''));
        case 'za':
          return String(b.sortTitle || '').localeCompare(String(a.sortTitle || ''));
        case 'newest':
          return (Number(b.sortCreatedAt) || 0) - (Number(a.sortCreatedAt) || 0);
        case 'oldest':
          return (Number(a.sortCreatedAt) || 0) - (Number(b.sortCreatedAt) || 0);
        case 'price-low':
          return (Number(a.sortPrice) || 0) - (Number(b.sortPrice) || 0);
        case 'price-high':
          return (Number(b.sortPrice) || 0) - (Number(a.sortPrice) || 0);
        case 'nearest':
          return distanceToCenterKm(aEl) - distanceToCenterKm(bEl);
        case 'soon':
          return (Number(a.sortSoonTs) || Number.POSITIVE_INFINITY) - (Number(b.sortSoonTs) || Number.POSITIVE_INFINITY);
        default:
          return 0;
      }
    });

    // Re-append in sorted order (DOM is the source of truth).
    cards.forEach(function(card) {
      try { postListEl.appendChild(card); } catch (_eAppend) {}
    });

    // Keep summary at the top if present.
    if (summaryEl) {
      try { postListEl.insertBefore(summaryEl, postListEl.firstChild); } catch (_eSum) {}
    }
    // Keep open post at the top if present.
    if (openWrap) {
      try { postListEl.insertBefore(openWrap, postListEl.firstChild); } catch (_eOpen) {}
    }
  }

  /**
   * Extract price from map card
   * @param {Object} mapCard - Map card data
   * @returns {number} Price or 0
   */
  function extractPrice(mapCard) {
    if (!mapCard || !mapCard.price_summary) return 0;
    // Pattern matches numbers with decimals or commas.
    // Skips any leading [cc] flag pattern.
    var match = mapCard.price_summary.match(/[\d,.]+/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
  }

  /**
   * Parse price summary into parts (flag and text)
   * @param {string} priceSummary - Raw price summary string
   * @returns {Object} { flagUrl, countryCode, text }
   */
  function parsePriceSummary(priceSummary) {
    var raw = (priceSummary === null || priceSummary === undefined) ? '' : String(priceSummary).trim();
    if (!raw) return { flagUrl: '', countryCode: '', text: '' };

    var countryCode = '';
    var displayText = raw;

    // 1. Detect [cc] pattern (e.g., "[us] $10.00")
    var match = raw.match(/^\[([a-z0-9_-]+)\]\s*(.*)$/i);
    if (match) {
      countryCode = match[1].toLowerCase();
      displayText = match[2].trim();
    } else {
      // 2. Fallback: Detect ISO code at the end (e.g., "$10.00 USD" or "10.00USD")
      // This handles old data and cases where prefix wasn't saved.
      var isoMatch = raw.match(/\s*([A-Z]{3})$/);
      if (isoMatch) {
        var isoCode = isoMatch[1];
        // Look up country code from CurrencyComponent if available
        if (window.CurrencyComponent && typeof CurrencyComponent.getCurrencyByCode === 'function') {
          // We might need to try both the raw ISO and variants like ISO-L/ISO-R
          var variants = [isoCode, isoCode + '-L', isoCode + '-R'];
          var currData = null;
          for (var i = 0; i < variants.length; i++) {
            currData = CurrencyComponent.getCurrencyByCode(variants[i]);
            if (currData) break;
          }

          if (currData && currData.filename) {
            countryCode = currData.filename.replace('.svg', '').toLowerCase();
            // Remove the ISO code from the display text as requested
            displayText = raw.substring(0, isoMatch.index).trim();
          }
        }
      }
    }

    var flagUrl = '';
    if (countryCode && window.App && typeof App.getImageUrl === 'function') {
      flagUrl = App.getImageUrl('currencies', countryCode + '.svg');
    }

    return { flagUrl: flagUrl, countryCode: countryCode, text: displayText };
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
    // No-op: legacy hook. Sorting now reorders the DOM directly (no cached arrays).
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
    try {
      // Post panel scrolls in postListEl; recent panel scrolls in recentPanelContentEl.
      if (fromRecent && recentPanelContentEl) recentPanelContentEl.scrollTop = 0;
      if (!fromRecent && postListEl) postListEl.scrollTop = 0;
    } catch (_eScrollTop) {}

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

    // Restore the original card element (recent-card stays recent-card).
    // This prevents Recents from accumulating post-cards and avoids "duplicate-looking" entries.
    try {
      var cardEl = openPost.querySelector('.post-card, .recent-card');
      if (cardEl && openPost.parentElement) {
        openPost.parentElement.replaceChild(cardEl, openPost);
      } else {
        openPost.remove();
      }
    } catch (_eRestore) {
      try { openPost.remove(); } catch (_eRemove) {}
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
    var avatarSrc = resolveAvatarSrcForUser(post.member_avatar || '', post.member_id);

    // Default session info display
    var priceParts = parsePriceSummary(loc0.price_summary || '');
    var priceHtml = '';
    if (priceParts.text) {
      var badge = priceParts.flagUrl 
        ? '<img src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 5px; object-fit: contain;">'
        : '💰 ';
      priceHtml = '<span>' + badge + escapeHtml(priceParts.text) + '</span>';
    }

    var defaultInfo = datesText
      ? ((priceHtml ? (priceHtml + ' | ') : '') + '📅 ' + datesText)
      : (priceHtml ? priceHtml : '');

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
          '<div class="open-post-row-member">',
            (avatarSrc ? '<img class="open-post-image-avatar" src="' + escapeHtml(avatarSrc) + '" alt="">' : ''),
            '<span class="open-post-text-postedby">' + escapeHtml(postedMeta) + '</span>',
          '</div>',
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

  // price_summary is now stored as a pre-formatted display string in post_map_cards.
  // e.g., "$12.00 - $34.50 USD" or "12,00 € EUR"
  // Just return it directly - no parsing needed.
  function formatPriceSummaryText(priceSummary) {
    var raw = (priceSummary === null || priceSummary === undefined) ? '' : String(priceSummary).trim();
    return raw;
  }

  // Avatar values are stored as filenames (preferred) or occasionally absolute URLs (legacy).
  // Resolve to a usable src based on folder settings:
  // - user uploads: {id}-avatar.ext -> folder_avatars
  // - library picks: any other filename -> folder_site_avatars
  function resolveAvatarSrcForUser(value, userId) {
    var v = (value || '').trim();
    if (!v) return '';
    if (v.indexOf('data:') === 0) return v;
    if (v.indexOf('http://') === 0 || v.indexOf('https://') === 0) return v;
    if (v.indexOf('/') === 0) return v;
    if (!window.App || typeof App.getImageUrl !== 'function') {
      throw new Error('[Post] App.getImageUrl is required to resolve avatar filenames.');
    }
    if (/^\d+-avatar\./.test(v)) {
      return App.getImageUrl('avatars', v);
    }
    return App.getImageUrl('siteAvatars', v);
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

    // Restore the original card element (recent-card stays recent-card).
    try {
      var cardEl = openPost.querySelector('.post-card, .recent-card');
      if (cardEl && openPost.parentElement) {
        openPost.parentElement.replaceChild(cardEl, openPost);
      } else {
        openPost.remove();
      }
    } catch (_eRestore) {
      try { openPost.remove(); } catch (_eRemove) {}
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
    // Share the "pretty" link. Root .htaccess redirects it to `/?post=<key>` for the SPA deep-link.
    var key = post.post_key || post.id;
    var url = window.location.origin + '/post/' + encodeURIComponent(String(key));

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
      if (!Array.isArray(history)) history = [];

      var now = Date.now();
      var targetId = (post && post.id !== undefined && post.id !== null) ? String(post.id) : '';
      if (!targetId) return;

      // Store key display fields directly in recent history so Recents can render without any in-memory caching.
      var rawThumbUrl = getPostThumbnailUrl(post);
      var mapCard0 = (post && post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
      var subKey0 = (mapCard0 && mapCard0.subcategory_key) ? String(mapCard0.subcategory_key) : String(post.subcategory_key || '');
      var iconUrl0 = post.subcategory_icon_url || getSubcategoryIconUrl(subKey0);
      var loc0 = (mapCard0 && (mapCard0.city || mapCard0.venue_name)) ? String(mapCard0.city || mapCard0.venue_name) : '';

      // Deduplicate (string-safe) and update "last seen" timestamp if already present.
      var seen = {};
      var next = [];

      // 1) Insert/refresh this post at the top.
      next.push({
        id: targetId,
        post_key: post.post_key,
        title: (post.map_cards && post.map_cards[0] && post.map_cards[0].title) || post.checkout_title || '',
        thumb_url: rawThumbUrl || '',
        subcategory_key: subKey0 || '',
        subcategory_icon_url: iconUrl0 || '',
        location_text: loc0 || '',
        timestamp: now
      });
      seen[targetId] = true;

      // 2) Carry over existing entries (skip duplicates + skip this id).
      for (var i = 0; i < history.length; i++) {
        var h = history[i];
        if (!h) continue;
        var hid = (h.id !== undefined && h.id !== null) ? String(h.id) : '';
        if (!hid) continue;
        if (seen[hid]) continue;
        seen[hid] = true;
        next.push(h);
      }

      // Keep only last 50
      next = next.slice(0, 50);
      localStorage.setItem('recentPosts', JSON.stringify(next));
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
    // Hide until loaded so we don't show a broken image icon during refresh/startup.
    try { img.style.opacity = '0'; } catch (_eOp0) {}
    try {
      img.addEventListener('load', function() { try { img.style.opacity = '1'; } catch (_eOp1) {} }, { once: true });
      img.addEventListener('error', function() { try { img.style.opacity = '0'; } catch (_eOp2) {} }, { once: true });
    } catch (_eEvt0) {}
    // Load only after startup settings are ready (Agent Essentials: no retries/fallbacks in applySystemImage).
    if (!window.App || typeof App.whenStartupSettingsReady !== 'function') {
      throw new Error('[Post] App.whenStartupSettingsReady is required before loading system images.');
    }
    App.whenStartupSettingsReady().then(function() {
      try { applySystemImage(img, 'postSystemImages', 'post_panel_empty_image'); } catch (e) { console.error(e); }
    });
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
    // Hide until loaded so we don't show a broken image icon during refresh/startup.
    try { reminderImg.style.opacity = '0'; } catch (_eOp0) {}
    try {
      reminderImg.addEventListener('load', function() { try { reminderImg.style.opacity = '1'; } catch (_eOp1) {} }, { once: true });
      reminderImg.addEventListener('error', function() { try { reminderImg.style.opacity = '0'; } catch (_eOp2) {} }, { once: true });
    } catch (_eEvt0) {}
    if (!window.App || typeof App.whenStartupSettingsReady !== 'function') {
      throw new Error('[Post] App.whenStartupSettingsReady is required before loading system images.');
    }
    App.whenStartupSettingsReady().then(function() {
      try { applySystemImage(reminderImg, 'recentSystemImages', 'recent_panel_footer_image'); } catch (e) { console.error(e); }
    });
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
      if (!Array.isArray(history)) return [];

      // Defensive: de-dup by id (string-safe), keeping the most recent timestamp.
      var bestById = {};
      for (var i = 0; i < history.length; i++) {
        var h = history[i];
        if (!h) continue;
        var hid = (h.id !== undefined && h.id !== null) ? String(h.id) : '';
        if (!hid) continue;
        var ts = Number(h.timestamp) || 0;
        if (!bestById[hid] || ts > (Number(bestById[hid].timestamp) || 0)) {
          bestById[hid] = h;
        }
      }

      // Return newest-first list (matches UI expectation).
      var out = Object.keys(bestById).map(function(id) { return bestById[id]; });
      out.sort(function(a, b) { return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0); });
      return out.slice(0, 50);
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
        // Robust hydration: if this entry was stored without a thumb_url (older data),
        // fetch the post once and persist thumb_url so future refreshes always have images.
        hydrateRecentCardIfNeeded(card, entry);
      }
    });

    recentPanelContentEl.appendChild(listEl);

    // Add footer reminder
    var reminderWrap = document.createElement('div');
    reminderWrap.className = 'recent-panel-reminder';

    var reminderImg = document.createElement('img');
    reminderImg.alt = 'Recents reminder image';
    reminderImg.className = 'recent-panel-reminder-image';
    // Hide until loaded so we don't show a broken image icon during refresh/startup.
    try { reminderImg.style.opacity = '0'; } catch (_eOp0) {}
    try {
      reminderImg.addEventListener('load', function() { try { reminderImg.style.opacity = '1'; } catch (_eOp1) {} }, { once: true });
      reminderImg.addEventListener('error', function() { try { reminderImg.style.opacity = '0'; } catch (_eOp2) {} }, { once: true });
    } catch (_eEvt0) {}
    if (!window.App || typeof App.whenStartupSettingsReady !== 'function') {
      throw new Error('[Post] App.whenStartupSettingsReady is required before loading system images.');
    }
    App.whenStartupSettingsReady().then(function() {
      try { applySystemImage(reminderImg, 'recentSystemImages', 'recent_panel_footer_image'); } catch (e) { console.error(e); }
    });
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

    var el = document.createElement('article');
    el.className = 'recent-card';
    el.dataset.id = String(entry.id);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    // Recents store lightweight display fields in localStorage (not full post payload).
    var title = entry.title || '';
    var rawThumbUrl = entry.thumb_url || '';
    var thumbUrl = getCardThumbSrc(rawThumbUrl);
    var city = entry.location_text || '';

    // Get subcategory info
    var subcategoryKey = entry.subcategory_key || '';
    var subInfo = getSubcategoryInfo(subcategoryKey);
    var iconUrl = entry.subcategory_icon_url || (subcategoryKey ? getSubcategoryIconUrl(subcategoryKey) : '');

    // Format last opened time
    var lastOpenedText = formatLastOpened(entry.timestamp);

    // Build card HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbHtml = rawThumbUrl
      ? '<img class="recent-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="recent-card-image recent-card-image--empty" aria-hidden="true"></div>';

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

    // Robust thumbnail loader (prevents broken/missing thumbnails if class=thumbnail isn't supported).
    if (rawThumbUrl) {
      wireCardThumbImage(el.querySelector('.recent-card-image'), rawThumbUrl);
    }

    // Click handler
    el.addEventListener('click', function(e) {
      if (e.target.closest('.recent-card-button-fav')) return;
      // No in-memory post cache: always fetch the post payload before opening.
      loadPostById(entry.id).then(function(fetchedPost) {
        if (!fetchedPost) return;
        openPost(fetchedPost, { fromRecent: true, originEl: el });
      });
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
   * Hydrate a recent card from the database if the stored history entry is missing key fields
   * (most importantly thumb_url). This fixes "missing thumbnail on refresh" for older stored entries.
   * @param {HTMLElement} cardEl
   * @param {Object} entry
   */
  function hydrateRecentCardIfNeeded(cardEl, entry) {
    try {
      if (!cardEl || !entry || !entry.id) return;
      if (entry.thumb_url) return;
      if (cardEl.dataset && cardEl.dataset.hydrating === '1') return;
      if (cardEl.dataset) cardEl.dataset.hydrating = '1';

      loadPostById(entry.id).then(function(post) {
        if (!post) return;

        var rawThumb = getPostThumbnailUrl(post);
        if (rawThumb) {
          // 1) Update DOM thumbnail
          try {
            var img = cardEl.querySelector('.recent-card-image');
            if (img && img.tagName === 'IMG') {
              img.src = getCardThumbSrc(rawThumb);
              wireCardThumbImage(img, rawThumb);
            } else {
              var holder = cardEl.querySelector('.recent-card-image--empty');
              if (holder) {
                var newImg = document.createElement('img');
                newImg.className = 'recent-card-image';
                newImg.alt = '';
                newImg.loading = 'lazy';
                newImg.setAttribute('referrerpolicy', 'no-referrer');
                newImg.src = getCardThumbSrc(rawThumb);
                holder.replaceWith(newImg);
                wireCardThumbImage(newImg, rawThumb);
              }
            }
          } catch (eThumb) {
            // ignore
          }

          // 2) Persist thumb_url back into localStorage so refreshes always have it.
          try {
            var history = JSON.parse(localStorage.getItem('recentPosts') || '[]');
            if (!Array.isArray(history)) history = [];
            var targetId = String(entry.id);
            for (var i = 0; i < history.length; i++) {
              if (!history[i]) continue;
              if (String(history[i].id) !== targetId) continue;
              history[i].thumb_url = rawThumb;
              // Keep title fresh too (safe improvement).
              history[i].title = history[i].title || (post.map_cards && post.map_cards[0] && post.map_cards[0].title) || post.checkout_title || '';
              break;
            }
            localStorage.setItem('recentPosts', JSON.stringify(history));
          } catch (eStore) {
            // ignore
          }
        }
      }).catch(function() {
        // ignore
      });
    } catch (e) {
      // ignore
    }
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

  function loadPostByKey(postKey) {
    var key = (postKey === null || postKey === undefined) ? '' : String(postKey).trim();
    if (!key) return Promise.resolve(null);
    return fetch('/gateway.php?action=get-posts&limit=1&post_key=' + encodeURIComponent(key))
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

  function getDeepLinkKeyFromUrl() {
    // Accept either:
    // - `/?post=<post_key>` (works without server rewrites)
    // - `/post/<post_key>` (requires server routing to index page)
    try {
      var qs = new URLSearchParams(window.location.search || '');
      var q = String(qs.get('post') || qs.get('post_key') || '').trim();
      if (q) return q;
    } catch (_eQs) {}

    try {
      var path = String(window.location.pathname || '');
      var idx = path.indexOf('/post/');
      if (idx !== -1) {
        var rest = path.slice(idx + '/post/'.length);
        rest = rest.split('?')[0].split('#')[0].split('/')[0];
        return String(rest || '').trim();
      }
    } catch (_ePath) {}

    return '';
  }

  function maybeOpenDeepLinkedPost() {
    var key = getDeepLinkKeyFromUrl();
    if (!key) return;

    // Only act once per page load.
    if (maybeOpenDeepLinkedPost._ran) return;
    maybeOpenDeepLinkedPost._ran = true;

    // Open in Recent panel (per requirement).
    var recentBtn = getModeButton('recent');
    if (recentBtn) {
      try { recentBtn.click(); } catch (_eClick) {}
    }

    // If the key starts with a numeric id (e.g. "1-test"), prefer loading by id.
    var m = String(key).match(/^(\d+)/);
    var id = m ? m[1] : '';
    var loader = id ? loadPostById(id) : loadPostByKey(key);

    loader.then(function(post) {
      if (!post) {
        console.error('[Post] Deep link post not found:', key);
        return;
      }
      openPost(post, { fromRecent: true, originEl: null });

      // Clean the address bar after we’ve used the deep link so the URL doesn’t stay “stuck”.
      // (One-page app UX: keep it looking like the homepage.)
      try {
        var path = String(window.location.pathname || '/');
        // If the server routed /post/<key> to index.html directly, normalize back to "/".
        if (path.indexOf('/post/') !== -1) {
          path = path.split('/post/')[0] || '/';
          if (!path.endsWith('/')) path += '/';
        }
        window.history.replaceState({}, document.title, path);
      } catch (_eUrl) {}
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

    // Agent Essentials: NO FALLBACKS / NO RETRY CHAINS.
    // Callers must only call this after startup settings are ready.
    var sys = App.getState('system_images');
    if (!sys || typeof sys !== 'object') {
      throw new Error('[Post] system_images not loaded. Ensure App.whenStartupSettingsReady() has resolved before calling applySystemImage().');
    }
    sys = sys || {};
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

  /**
   * Get the URL for a post
   * @param {Object} post - Post object
   * @returns {string} Post URL
   */
  function getPostUrl(post) {
    if (!post) return '';
    var key = post.post_key || post.id;
    if (!key) return '';
    return window.location.origin + '/post/' + encodeURIComponent(String(key));
  }

  /**
   * Get the hero image URL for a post
   * @param {Object} post - Post object
   * @returns {string} Hero image URL
   */
  function getHeroUrl(post) {
    return getPostThumbnailUrl(post);
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
    // No cache to clear. Re-apply filters for the current viewport (zoom>=threshold).
    // This avoids accidental worldwide loads.
    try { applyFilters(currentFilters || loadSavedFiltersFromLocalStorage() || {}); } catch (_e) {}
    return Promise.resolve([]);
  }

  return {
    init: init,
    loadPosts: loadPosts,
    refreshPosts: refreshPosts,
    openPost: openPost,
    openPostById: openPostById,
    closePost: closePost,
    renderPostCard: renderPostCard,
    renderMapMarkers: renderMapMarkers,
    highlightMapMarker: highlightMapMarker,
    getPostUrl: getPostUrl,
    getHeroUrl: getHeroUrl,
    getSubcategoryInfo: getSubcategoryInfo,
    getSubcategoryIconUrl: getSubcategoryIconUrl,
    formatPostDates: formatPostDates,
    formatPriceSummaryText: formatPriceSummaryText,
    parsePriceSummary: parsePriceSummary
  };

})();

// Register with App
App.registerModule('post', PostModule);

// Expose globally for consistency with other modules
window.PostModule = PostModule;

