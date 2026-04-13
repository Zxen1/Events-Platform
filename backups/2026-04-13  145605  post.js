/* ============================================================================
   POST.JS - POST SECTION (includes Recent)
   ============================================================================
   
   Controls the Post panel and Recent panel.
   
   USES COMPONENTS (from components.js):
   - PostLocationComponent - Location picker with minimap
   - PostSessionComponent - Session/dates picker with calendar
   - PostItemComponent - Item pricing display (name, variants, price, promo)
   - PostPriceComponent - Price display
   
   DEPENDENCIES:
   - index.js (backbone)
   - components.js (PostLocationComponent, PostSessionComponent, PostItemComponent, PostPriceComponent)
   
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
    This file (`post.js`) owns the HIGH-ZOOM filtering pipeline:
       zoom >= postsLoadZoom (default 8)
     
     High zoom is "in this map area" mode:
    - We listen for `App.emit('filter:changed', state)` from `filter.js`
    - We also listen for `App.emit('map:boundsChanged', { zoom, ... })` from `map.js`
     - We fetch detailed posts via `/gateway.php?action=get-posts` using:
         - saved filter params (keyword/date/price/subcategory keys/etc.)
         - `bounds` (the map area filter)
     - We render Post cards + Map cards (detailed payload)
     
     Low zoom (< postsLoadZoom) does NOT load detailed posts worldwide.
    That mode is handled by clusters in `map.js` via `/gateway.php?action=get-clusters`.
     ========================================================================== */

  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */

  var panelsContainerEl = null;
  // ── ANIMATION MASTER CONTROLS ────────────────────────────────────────────────
  // _POST_ANIMATE  : false = all five animation paths disabled instantly (open, close, storefront open, See More, See Less)
  // _POST_ANIM_DUR : duration in seconds — every sub-timing scales proportionally from this one value
  //
  // Animation entry points (search these labels to find each animation):
  //   OPEN ANIMATION: PRE-CAPTURE      ~line 3096  openPost()       card bg + clone captured before close
  //   OPEN ANIMATION: CARD EXIT        ~line 3183  openPost()       card clone slides up into clip
  //   OPEN ANIMATION: POST ENTER       ~line 3222  openPost()       post slides down from clip
  //   STOREFRONT OPEN ANIMATION        ~line 3232  openPost()       deferred until first fetch completes
  //   CLOSE ANIMATION: CARD ENTER      ~line 3368  closePost()      clone slides down from clip
  //   CLOSE ANIMATION: POST EXIT       ~line 5425  closePost()      post slides up into clip
  //   SEE MORE ANIMATION               ~line 5161  _animateExpand() post expands to full height
  //   SEE LESS ANIMATION               ~line 5047  _animateCollapse() post collapses back to card
  //
  // Panels covered: Post panel, Recent panel, Post Editor (all four animations)
  // Excluded from animation: fromMap opens, marquee opens, deeplink opens
  // ─────────────────────────────────────────────────────────────────────────────
  var _POST_ANIMATE  = true;
  var _POST_ANIM_DUR = 0.3;

  function getEffectiveThemePresetKey(themeActive) {
    var active = themeActive || 'theme_auto';
    if (active === 'theme_auto') {
      if (!window.matchMedia) {
        throw new Error('[Post] window.matchMedia is required for theme_auto.');
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'theme_dark' : 'theme_light';
    }
    if (active === 'theme_light' || active === 'theme_dark') {
      return active;
    }
    throw new Error('[Post] Invalid theme_active "' + String(active) + '".');
  }

  function getThemePresetFromSettings() {
    var settings = (window.App && typeof App.getState === 'function') ? App.getState('settings') : null;
    if (!settings || settings.theme_presets === undefined) {
      throw new Error('[Post] settings.theme_presets must be loaded before resolving post interaction settings.');
    }
    var presets = settings.theme_presets;
    if (!presets || typeof presets !== 'object' || Array.isArray(presets)) {
      throw new Error('[Post] settings.theme_presets must be a JSON object.');
    }
    var presetKey = getEffectiveThemePresetKey(localStorage.getItem('theme_active') || 'theme_auto');
    var preset = presets[presetKey];
    if (!preset) {
      throw new Error('[Post] Missing theme preset "' + String(presetKey) + '".');
    }
    return preset;
  }

  function getPostInteractionMode() {
    var mode = null;
    if (window.MemberModule && typeof MemberModule.getCurrentUser === 'function') {
      var user = MemberModule.getCurrentUser();
      if (user && user.post_interaction) {
        mode = String(user.post_interaction).trim().toLowerCase();
      }
    }
    if (!mode) {
      var stored = localStorage.getItem('post_interaction');
      if (stored) {
        mode = String(stored).trim().toLowerCase();
      }
    }
    if (!mode) {
      var preset = getThemePresetFromSettings();
      if (preset.post_interaction === undefined) {
        throw new Error('[Post] Missing post_interaction in theme preset.');
      }
      mode = String(preset.post_interaction).trim().toLowerCase();
    }
    if (mode === 'instant' || mode === 'fast' || mode === 'smooth' || mode === 'slow') return mode;
    throw new Error('[Post] No valid post interaction mode found in theme settings.');
  }

  function applyPostInteractionSettings() {
    var mode = getPostInteractionMode();
    if (mode === 'instant') {
      _POST_ANIMATE = false;
      _POST_ANIM_DUR = 0.3;
      return;
    }
    _POST_ANIMATE = true;
    if (mode === 'fast') {
      _POST_ANIM_DUR = 0.3;
      return;
    }
    if (mode === 'smooth') {
      _POST_ANIM_DUR = 0.6;
      return;
    }
    _POST_ANIM_DUR = 0.9;
  }

  var postPanelEl = null;
  var postPanelContentEl = null;
  var postListEl = null;
  var recentPanelEl = null;
  var recentPanelContentEl = null;

  var currentMode = 'map';
  var lastZoom = null;
  var postsEnabled = false;
  var currentSortKey = 'recommended';
  var currentSortGeoLocation = null;
  var favToTop = false; // matches live site: "Favourites on top" is a sort behavior, not a filter
  var favSortDirty = true; // live-site behavior: fav changes don't reorder until user presses the toggle again

  var modeButtonsBound = false;
  var lastMemberAuthState = null;

  // NOTE: We intentionally do NOT keep an in-memory cache of post responses.
  // We render directly from the latest server response and keep the DOM as the source of truth.
  // (Agent Essentials: No Snapshots / no caching during development.)
  var postsLoading = false;
  var postsError = null;
  var postsRequestToken = 0;
  var postsAbort = null;
  var _sfGroupsByPostId = {};

  // Panel motion state (kept in-module for cleanliness; no DOM-stashed handlers).
  var panelMotion = {
    post: { token: 0, hideHandler: null, hideTimeoutId: 0 },
    recent: { token: 0, hideHandler: null, hideTimeoutId: 0 }
  };

  // Multipost modal state
  var _multipostModalEl = null;
  var _multipostModalKeydownHandler = null;
  var _multipostModalPostIds = null; // post IDs known at open time — used to refresh on filter change
  var _multipostModalLocationKey = null; // locationKey of the active multi-post marker
  var _multipostVirtPosts = [];        // current posts array for modal virtualised scroll
  var _multipostVirtStart = 0;         // window start index within modal
  var _multipostBodyEl = null;         // reference to the modal body scroll container
  var _multipostAboveEl = null;        // ghost container above real window in modal
  var _multipostBelowEl = null;        // ghost container below real window in modal
  var _multipostScrollListener = null; // modal scroll listener (for cleanup on refresh/close)
  var _multipostScrollTicking = false;
  var _multipostSettleTimer = null;

  // Virtualised scrolling state
  // Only ~50 real postcard DOM elements exist at any time. Ghost postcards fill remaining space.
  var _virtPosts = [];            // full sorted/filtered array — source of truth for the scroll window
  var _virtStart = 0;             // index of the first real card in the DOM window
  var _virtAboveEl = null;        // div containing ghost postcards above the real window
  var _virtBelowEl = null;        // div containing ghost postcards below the real window
  var _virtScrollListener = null; // current scroll listener reference (for cleanup on re-render)
  var _virtPostsMeta = {};        // sort metadata keyed by String(post.id), built during renderPostList
  var _virtScrollTicking = false; // rAF throttle flag
  var _virtSettleTimer = null;    // debounce timer for post-fling settle
  var _VIRT_WINDOW = 50;          // real postcard DOM elements in window at once
  var _virtDirty = false;         // true after sort/filter changes array while window start stays the same
  var _sfEffectiveLead = {};      // String(post.id) -> true if this post is the first of its storefront group in _virtPosts order

  /* --------------------------------------------------------------------------
     INIT
     -------------------------------------------------------------------------- */

  function init() {
    panelsContainerEl = document.querySelector('.post-mode-panels');
    if (!panelsContainerEl) {
      throw new Error('[Post] .post-mode-panels container not found.');
    }

    ensurePanelsDom();
    bindAppEvents();
    bindModeButtons();

    // DB-first/localStorage filter state is stored in localStorage by MemberModule on login.
    // PostModule needs it even if the filter panel hasn't been opened yet.
    currentFilters = loadSavedFiltersFromLocalStorage();

    // Capture initial mode (HeaderModule already ran, but PostModule may have missed the event).
    currentMode = inferCurrentModeFromHeader() || 'map';
    applyMode(currentMode);

    // Theme presets load asynchronously during startup.
    // Apply post interaction settings only after startup settings are ready.
    if (window.App && typeof App.whenStartupSettingsReady === 'function') {
      App.whenStartupSettingsReady().then(function() {
        applyPostInteractionSettings();
      });
    }

    // Initialize zoom gating if we can.
    primeZoomFromMapIfAvailable();
    updatePostsButtonState();

    // Deep link handling is dispatched centrally from index.js after all modules load.
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

    // Keep BottomSlack/TopSlack enabled here so click anchors can hold position
    // when open/close operations change content height above or below the click target.

    // iOS: nudge scroll position off boundaries to prevent scroll lock.
    try { fixIOSScrollBoundary(postListEl); } catch (_eIOSFix0) {}
    try { fixIOSScrollBoundary(recentPanelContentEl); } catch (_eIOSFix1) {}

    // data-tooltip-dir is set at render time: right for first 75%, left for final 25%.
  }

  function bindAppEvents() {
    if (!window.App || typeof App.on !== 'function') {
      throw new Error('[Post] App event bus is required.');
    }

    App.on('mode:changed', function(data) {
      if (!data || !data.mode) return;
      currentMode = data.mode;
      applyMode(currentMode);

      // Close multipost modal on any mode switch (post panel is leaving view)
      closeMultipostModal();

      // Requirement: no map card should remain active when panels are closed / no open post is visible.
      // When we return to Map mode, clear active/big markers.
      try {
        if (currentMode === 'map' && window.MapModule && typeof MapModule.clearActiveMapCards === 'function') {
          MapModule.clearActiveMapCards();
        }
      } catch (_eClearActive) {}
    });

    try {
      if (window.MemberModule && typeof MemberModule.isLoggedIn === 'function') {
        lastMemberAuthState = !!MemberModule.isLoggedIn();
      } else {
        lastMemberAuthState = false;
      }
    } catch (_eAuthInit) {
      lastMemberAuthState = false;
    }

    // Login/logout refresh rule:
    // If Posts or Recent is open, close then reopen so list state is refreshed
    // for auth-dependent data (favorites, sort order, recents, etc.).
    App.on('member:stateChanged', function(data) {
      var nextAuthState = !!(data && data.user);
      if (lastMemberAuthState === nextAuthState) return;
      lastMemberAuthState = nextAuthState;
      refreshOpenModePanelForAuthChange();
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
    App.on('post:created', function(data) {
      refreshPosts();
    });
    App.on('post:updated', function() {
      refreshPosts();
    });

    // Map hover events (sync from high-density dots/icons)
    App.on('map:markerHover', function(data) {
      if (!data || !data.postId) return;
      var selector = '[data-id="' + data.postId + '"]';
      var cards = document.querySelectorAll('.post-card' + selector + ', .recent-card' + selector);
      cards.forEach(function(c) { c.classList.add('post-card--map-highlight'); });
    });

    App.on('map:markerLeave', function() {
      document.querySelectorAll('.post-card--map-highlight').forEach(function(el) {
        el.classList.remove('post-card--map-highlight');
      });
    });

    App.on('map:ready', function(data) {
      try {
        var map = data && data.map;
        if (map && typeof map.getZoom === 'function') {
          lastZoom = map.getZoom();
          updatePostsButtonState();
        }
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

    App.on('groundBubbles:toggled', function(data) {
      var wasActive = _groundBubblesActive;
      _groundBubblesActive = !!(data && data.active);
      if (_groundBubblesActive !== wasActive && _lastRenderedPosts) {
        renderMapMarkers(_lastRenderedPosts);
      }
    });

    App.on('map:boundsChanged', function(data) {
      if (!data) return;
      
      // ========================================================================
      // MOBILE VIEWPORT WORKAROUND (530px breakpoint)
      // ========================================================================
      // PROBLEM: On iOS Safari and Android Chrome, the browser toolbar (address bar,
      // navigation buttons) shows/hides dynamically as the user scrolls content.
      // This changes the viewport height, which causes the map to resize, which
      // triggers Mapbox to emit boundsChanged events - even though the user hasn't
      // actually moved the map.
      //
      // SYMPTOM: When scrolling the posts panel on mobile, the post list would
      // constantly reload and flicker because each toolbar show/hide triggered
      // a "new viewport" detection.
      //
      // ROOT CAUSE (UNSOLVED): We cannot prevent the map from resizing without
      // losing edge-to-edge display, which causes black bars on iOS. The map
      // MUST resize with the viewport to look correct.
      //
      // WORKAROUND: On mobile (<=530px), when the posts panel is open, we ignore
      // boundsChanged events entirely. Posts are loaded once when the panel opens
      // and don't update until the user closes and reopens the panel.
      //
      // TRADE-OFF: Mobile users cannot see real-time post updates while panning
      // the map with the posts panel open. They must close the panel, pan to a
      // new area, then reopen it. Desktop/tablet users (>530px) are unaffected
      // and get real-time updates.
      //
      // RISK: If a device incorrectly matches/doesn't match the 530px breakpoint,
      // it may get the wrong behavior. Test on actual devices, not just DevTools.
      // ========================================================================
      var isMobile = window.matchMedia && window.matchMedia('(max-width: 530px)').matches;
      if (isMobile && currentMode === 'posts') {
        // Still track zoom so threshold detection works (panel closes when zooming out)
        if (typeof data.zoom === 'number') {
          lastZoom = data.zoom;
          updatePostsButtonState();
        }
        return;
      }
      
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
          // BELOW BREAKPOINT: Clusters only.
          // Only clear if map is NOT animating (avoid clearing mid-flyTo)
          var mapInstance = window.MapModule && MapModule.getMap ? MapModule.getMap() : null;
          var isAnimating = mapInstance && (
            (typeof mapInstance.isMoving === 'function' && mapInstance.isMoving()) ||
            (typeof mapInstance.isEasing === 'function' && mapInstance.isEasing())
          );
          
          if (!isAnimating) {
            // 1. Close any open post
            var allOpenPosts = document.querySelectorAll('.post[data-id]');
            allOpenPosts.forEach(function(openEl) {
              var pid = openEl.getAttribute('data-id');
              if (pid) closePost(pid);
            });
            
            // 2. Force map mode (closes posts panel with animation)
            if (currentMode === 'posts') {
              forceMapMode();
            }
            
            // 3. Close recent panel if open
            if (recentPanelEl && recentPanelContentEl) {
              togglePanel(recentPanelEl, recentPanelContentEl, 'recent', false);
            }
            
            // 4. Clear map data
            if (window.MapModule) {
              if (typeof MapModule.clearAllMapCardMarkers === 'function') {
                MapModule.clearAllMapCardMarkers();
              }
            }
            lastRenderedLocationMarkerSigByKey = {};
            
            // 5. Clear side panel list
            renderPostList([]);
            
            // 6. Reset bounds key
            lastLoadedBoundsKey = '';
          }
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
      if (data.isMultiPost && Array.isArray(data.postIds) && data.postIds.length > 1) {
        openMultipostModal(data);
        return;
      }
      closeMultipostModal();
      openPostById(data.postId, { fromMap: true, postMapCardId: data.post_map_card_id ? String(data.post_map_card_id) : '' });
    });

    // Listen for marquee slide clicks
    App.on('post:open', function(data) {
      if (!data || !data.id) return;
      openPostById(data.id, { source: data.source || 'external' });
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
      currentSortKey = String(data.sort || 'recommended');
      currentSortGeoLocation = data.userGeoLocation || null;
      sortPosts(currentSortKey, currentSortGeoLocation);
    });

    App.on('filter:favouritesToggle', function(data) {
      if (!data) return;
      favToTop = !!data.enabled;
      // Live-site behavior: enabling favToTop makes ordering "clean" (applies immediately).
      // Any subsequent favourite toggles mark it dirty again until the user presses the toggle.
      favSortDirty = favToTop ? false : true;
      // Re-apply sorting/rendering without filtering out non-favourites.
      // Keep the active sort inputs, including the stored geolocation for "nearest".
      sortPosts(currentSortKey || 'recommended', currentSortGeoLocation);
    });

    // Initialize favToTop from restored filter state (persisted in filters_json).
    // restoreFilters() sets the UI button but doesn't emit an event, so post.js must read it.
    try {
      if (window.FilterModule && typeof FilterModule.getFilterState === 'function') {
        var restoredFs = FilterModule.getFilterState();
        if (restoredFs && restoredFs.favourites) {
          favToTop = true;
          favSortDirty = false;
        }
        if (restoredFs && restoredFs.sort) {
          currentSortKey = String(restoredFs.sort || 'recommended');
        }
      }
    } catch (_eInitFavToTop) {}

    // Update post panel summary background when filters are active
    App.on('filter:activeState', function(data) {
      var isActive = !!(data && data.active);
      var summaryEl = postPanelContentEl ? postPanelContentEl.querySelector('.post-panel-header') : null;
      if (summaryEl) {
        summaryEl.classList.toggle('post-panel-header--active', isActive);
      }
      var emptySummaryEl = postPanelContentEl ? postPanelContentEl.querySelector('.post-panel-empty-header') : null;
      if (emptySummaryEl) {
        emptySummaryEl.classList.toggle('post-panel-empty-header--active', isActive);
      }
    });

    // Panel-level keyboard behavior (Post/Recent):
    // - Escape closes open post first, then returns to map mode
    // Note: index.js global Escape handler does not manage Post/Recent panels.
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
        var open = container.querySelector('.post[data-id]');
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
    // Post cards in lists
    var cards = document.querySelectorAll('.post-card[data-id="' + postId + '"], .recent-card[data-id="' + postId + '"]');
    cards.forEach(function(el) {
      el.classList.toggle('post-card--map-highlight', !!on);
    });
    // Open post wrapper
    var openWrap = document.querySelector('.post[data-id="' + postId + '"]');
    if (openWrap) {
      openWrap.classList.toggle('post--map-highlight', !!on);
    }
  }

  /**
   * Open a post by ID (looks up in cache)
   * @param {number|string} postId - Post ID
   * @param {Object} options - Options
   */
  function openPostById(postId, options) {
    options = options || {};
    var shouldOpenPostsPanel = !!options.fromMap || options.source === 'marquee';

    // Storefront: if this post belongs to a group, open the storefront instead
    // Post Editor always opens posts individually — never as a storefront
    var sfGroup = _sfGroupsByPostId[String(postId)];
    if (sfGroup && sfGroup.length > 1 && !options.storefrontPosts && options.source !== 'posteditor') {
      options.storefrontPosts = sfGroup;
      options.sfOpenPostId = String(postId);
      var leadPost = sfGroup[0];
      var pick = pickMapCardInCurrentBounds(leadPost);
      if (pick && pick.mapCard && pick.mapCard.id !== undefined && pick.mapCard.id !== null) {
        options.postMapCardId = String(pick.mapCard.id);
      }
      if (shouldOpenPostsPanel && currentMode !== 'posts') {
        var postsBtn = getModeButton('posts');
        if (postsBtn && postsEnabled) {
          postsBtn.click();
          setTimeout(function() { openPost(leadPost, options); }, 50);
          return;
        }
      }
      openPost(leadPost, options);
      return;
    }

    // Normal single-post path: load fresh by ID
    loadPostById(postId).then(function(post) {
      if (!post) {
        console.warn('[Post] Post not found:', postId);
        return;
      }

      if (!options.postMapCardId) {
        try {
          var pick = pickMapCardInCurrentBounds(post);
          if (pick && pick.mapCard && pick.mapCard.id !== undefined && pick.mapCard.id !== null) {
            options.postMapCardId = String(pick.mapCard.id);
          }
        } catch (_ePick) {}
      }

      if (shouldOpenPostsPanel && currentMode !== 'posts') {
        var postsBtn = getModeButton('posts');
        if (postsBtn && postsEnabled) {
          postsBtn.click();
          setTimeout(function() { openPost(post, options); }, 50);
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
      panelEl.removeAttribute('aria-hidden');

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

    // Move focus out before hiding to avoid aria-hidden violation
    if (document.activeElement && panelEl.contains(document.activeElement)) {
      document.activeElement.blur();
    }

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

  function refreshOpenModePanelForAuthChange() {
    var openMode = (currentMode === 'posts' || currentMode === 'recent') ? currentMode : '';
    if (!openMode) return;

    // Close any open post so auth-gated data (email, phone, promos) is not preserved with stale values.
    var openPostEl = postListEl && postListEl.querySelector('.post');
    if (openPostEl && openPostEl.dataset && openPostEl.dataset.id) {
      closePost(openPostEl.dataset.id);
    }

    var openContentEl = openMode === 'posts' ? postPanelContentEl : recentPanelContentEl;
    if (openMode === 'posts') {
      if (!postPanelEl || !postPanelContentEl) return;
      togglePanel(postPanelEl, postPanelContentEl, 'post', false);
    } else {
      if (!recentPanelEl || !recentPanelContentEl) return;
      togglePanel(recentPanelEl, recentPanelContentEl, 'recent', false);
    }

    // Respect real slide animation duration before reopening.
    var reopenDelayMs = getContentTransitionDurationMs(openContentEl) + 60;
    setTimeout(function() {
      try {
        if (openMode === 'posts') {
          togglePanel(postPanelEl, postPanelContentEl, 'post', true);
          var threshold = getPostsMinZoom();
          if (typeof lastZoom === 'number' && lastZoom >= threshold) {
            applyFilters(currentFilters || loadSavedFiltersFromLocalStorage() || {});
          }
        } else {
          togglePanel(recentPanelEl, recentPanelContentEl, 'recent', true);
          renderRecentPanel();
        }
      } catch (_eReopen) {}
    }, reopenDelayMs);
  }

  function getContentTransitionDurationMs(contentEl) {
    var durationMs = 300;
    try {
      if (!contentEl || !window.getComputedStyle) return durationMs;
      var cs = window.getComputedStyle(contentEl);
      var dur = (cs && cs.transitionDuration) ? String(cs.transitionDuration).split(',')[0].trim() : '';
      if (dur.endsWith('ms')) durationMs = Math.max(0, parseFloat(dur) || 0);
      else if (dur.endsWith('s')) durationMs = Math.max(0, (parseFloat(dur) || 0) * 1000);
    } catch (_eDur) {}
    return Math.max(0, Math.ceil(durationMs));
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
    // Agent Essentials: Never load if not required.
    var threshold = getPostsMinZoom();
    if (typeof lastZoom !== 'number' || lastZoom < threshold) {
      return Promise.resolve([]);
    }
    if (!window.App || typeof App.whenStartupSettingsReady !== 'function') {
      throw new Error('[Post] App.whenStartupSettingsReady is required before rendering postcard icons.');
    }
    var settingsReadyPromise = App.whenStartupSettingsReady();

    postsError = null;

    var params = new URLSearchParams();
    if (options && options.limit) {
      params.append('limit', String(options.limit));
    }
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
      if (f.show18Plus) params.append('show18_plus', '1');
      if (f.amenities && typeof f.amenities === 'object' && Object.keys(f.amenities).length > 0) {
        params.append('amenities', JSON.stringify(f.amenities));
      }
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

    // Lazy-load currency data if needed for price summary parsing
    if (window.CurrencyComponent && typeof CurrencyComponent.loadFromDatabase === 'function') {
      CurrencyComponent.loadFromDatabase().catch(function() {});
    }

    postsLoading = true;

    var fetchOpts = {};
    if (postsAbort) fetchOpts.signal = postsAbort.signal;
    if (window.MemberModule && typeof MemberModule.isLoggedIn === 'function' && MemberModule.isLoggedIn()) {
      fetchOpts.headers = { 'X-Member-Auth': '1' };
    }
    return fetch('/gateway.php?action=get-posts&' + requestKey, fetchOpts)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to load posts: ' + response.status);
        }
        // Get text first to diagnose empty/invalid responses
        return response.text().then(function(text) {
          if (!text || text.trim() === '') {
            console.error('[Post] Server returned empty response for:', requestKey.substring(0, 100));
            throw new Error('Server returned empty response');
          }
          try {
            return JSON.parse(text);
          } catch (parseErr) {
            console.error('[Post] JSON parse failed. Response text (first 500 chars):', text.substring(0, 500));
            throw parseErr;
          }
        });
      })
      .then(function(data) {
        // Ignore stale responses
        if (myToken !== postsRequestToken) return [];
        postsLoading = false;
        if (data.success && Array.isArray(data.posts)) {
          return settingsReadyPromise.then(function() {
            // Request may have gone stale while waiting for startup settings.
            if (myToken !== postsRequestToken) return [];
            // Pre-compute ground bubble state from the post data so renderMapMarkers
            // hides non-card markers immediately (avoids flash before cluster fetch).
            var mapCardCount = 0;
            for (var pi = 0; pi < data.posts.length; pi++) {
              var mc = data.posts[pi].map_cards;
              if (mc) mapCardCount += mc.length;
            }
            if (!window.MapModule || typeof MapModule.getGroundBubbleThreshold !== 'function') {
              throw new Error('[Post] MapModule.getGroundBubbleThreshold is required for ground bubble pre-check.');
            }
            _groundBubblesActive = mapCardCount >= MapModule.getGroundBubbleThreshold();
            renderPostList(data.posts);
            // Re-apply current UI sort after each fresh render (prevents server order from overriding UI sort).
            sortPosts(currentSortKey, currentSortGeoLocation);
            // Emit counts for the current viewport (server-filtered)
            emitFilterCounts(data.posts);
            // Refresh map clusters with new post data
            if (window.MapModule && MapModule.refreshClusters) {
              MapModule.refreshClusters();
            }
            return data.posts;
          });
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
   * Append Bunny Optimizer sizing to image URL.
   * Cropped images (URL contains crop=) get explicit width/height from admin settings
   * because Bunny's ?class= overrides the crop parameter. Uncropped images use ?class=.
   * @param {string} url - Image URL (may already have ?crop= parameter)
   * @param {string} className - Bunny class name (thumbnail, minithumb, imagebox)
   * @returns {string} URL with sizing parameters appended
   */
  function addImageClass(url, className) {
    if (!url || !className) return url || '';
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    if (url.indexOf('crop=') !== -1) {
      var sizeMap = { minithumb: 'image_crop_minithumb', thumbnail: 'image_crop_thumbnail', imagebox: 'image_crop_imagebox' };
      var settingKey = sizeMap[className];
      var sett = (window.App && App.getState) ? App.getState('settings') : null;
      var size = (sett && settingKey && sett[settingKey]) ? sett[settingKey] : null;
      if (size) return url + separator + 'width=' + size + '&height=' + size;
    }
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
  function pickMapCardInCurrentBounds(post) {
    var cards = (post && Array.isArray(post.map_cards)) ? post.map_cards : [];
    if (!cards.length) return { mapCard: null, index: 0 };
    var bounds = getMapBounds();
    if (!bounds) return { mapCard: cards[0], index: 0 };
    for (var i = 0; i < cards.length; i++) {
      var mc = cards[i];
      if (!mc) continue;
      var lng = Number(mc.longitude);
      var lat = Number(mc.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (pointWithinBounds(lng, lat, bounds)) {
        return { mapCard: mc, index: i };
      }
    }
    return { mapCard: cards[0], index: 0 };
  }

  function getPostThumbnailUrl(post) {
    // Use the in-area map card if available (keeps postcards aligned to the current map view).
    var pick = pickMapCardInCurrentBounds(post);
    var mapCard = pick.mapCard;
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
  /**
   * Format dates display for a post.
   * Required for instant rendering. Throws error if pre-formatted summary is missing.
   * @param {Object} post - Post data from API
   * @returns {string} Formatted date string or empty
   */
  function formatSessionDateRange(start, end) {
    if (!start) return '';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var s = new Date(start + 'T00:00:00');
    var sd = s.getDate() + ' ' + months[s.getMonth()] + ' ' + s.getFullYear();
    if (!end || start === end) return sd;
    var e = new Date(end + 'T00:00:00');
    var ed = e.getDate() + ' ' + months[e.getMonth()] + ' ' + e.getFullYear();
    return sd + ' - ' + ed;
  }

  function formatPostDates(post) {
    var pick = pickMapCardInCurrentBounds(post);
    var mapCard = pick.mapCard;
    var src = mapCard || post;
    return formatSessionDateRange(src.start_date, src.end_date);
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
   * @param {string} subcategoryKey - Subcategory key (e.g., 'live-music')
   * @returns {string} Icon URL or empty string
   */
  /**
   * Get icon URL for a subcategory.
  /**
   * Get subcategory display info (category name, subcategory name)
   * @param {string} subcategoryKey - Subcategory key
   * @returns {Object} { category: string, subcategory: string }
   */
  /**
   * Resolve subcategory and category names for display.
   * @param {string} subcategoryKey 
   * @returns {Object} { category, subcategory }
   */
  /**
   * Resolve subcategory and category names for display.
   * Required for instant rendering. Throws error if subcategory name is missing.
   * @param {string} subcategoryKey 
   * @param {string} [subNameFromDb] - Optional name from database JOIN
   * @returns {Object} { category, subcategory }
   */
  /**
   * Build card info rows HTML (shared by postcards and recent cards)
   * Single source of truth for what info to display and how.
   * @param {Object} data - Display data
   * @param {string} data.subcategoryName - Subcategory display name
   * @param {string} data.subcategoryIconUrl - Subcategory icon URL
   * @param {string} data.locationText - Location display text (venue or city)
   * @param {string} data.datesText - Formatted dates text
   * @param {Object} data.priceParts - From parsePriceSummary: { flagUrl, countryCode, text }
   * @param {boolean} data.hasPromo - Whether this card has a promo
   * @param {string} classPrefix - CSS class prefix ('post-card' or 'recent-card')
   * @returns {string} HTML string for the info rows
   */
  function buildCardInfoRowsHtml(data, classPrefix) {
    var html = [];
    
    // Category row
    var iconHtml = data.subcategoryIconUrl
      ? '<span class="' + classPrefix + '-icon-sub"><img class="' + classPrefix + '-image-sub" src="' + data.subcategoryIconUrl + '" alt="" /></span>'
      : '';
    html.push('<div class="' + classPrefix + '-row-cat">' + iconHtml + ' ' + (data.subcategoryName || '') + '</div>');
    
    // Location row
    if (data.locationText) {
      var sett = App.getState('settings') || {};
      var locIconUrl = sett.badge_icon_location ? App.getImageUrl('fieldsetIcons', sett.badge_icon_location) : '';
      var locBadge = locIconUrl ? '<img class="' + classPrefix + '-image-badge" src="' + locIconUrl + '" alt="" title="Venue">' : '';
      html.push('<div class="' + classPrefix + '-row-loc"><span class="' + classPrefix + '-badge">' + locBadge + '</span><span>' + escapeHtml(data.locationText) + '</span></div>');
    }
    
    // Dates row
    if (data.datesText) {
      var sett = App.getState('settings') || {};
      var dateIconUrl = sett.badge_icon_sessions ? App.getImageUrl('fieldsetIcons', sett.badge_icon_sessions) : '';
      var dateBadge = dateIconUrl ? '<img class="' + classPrefix + '-image-badge" src="' + dateIconUrl + '" alt="" title="Dates">' : '';
      html.push('<div class="' + classPrefix + '-row-date"><span class="' + classPrefix + '-badge">' + dateBadge + '</span><span>' + escapeHtml(data.datesText) + '</span></div>');
    }
    
    // Price row
    if (data.priceParts && data.priceParts.text) {
      var badgeHtml = data.priceParts.flagUrl 
        ? '<img class="' + classPrefix + '-image-badge" src="' + data.priceParts.flagUrl + '" alt="' + data.priceParts.countryCode + '" title="Currency: ' + data.priceParts.countryCode.toUpperCase() + '">'
        : '';
      var promoTagHtml = data.hasPromo ? '<span class="' + classPrefix + '-tag-promo">Promo</span>' : '';
      html.push('<div class="' + classPrefix + '-row-price"><span class="' + classPrefix + '-badge" title="Price">' + badgeHtml + '</span><span>' + escapeHtml(data.priceParts.text) + '</span>' + promoTagHtml + '</div>');
    }
    
    return html.join('');
  }

  /**
   * Render a single post card
   * Structure: .post-card-image, .post-card-meta, .post-card-text-title, .post-card-container-info
   * @param {Object} post - Post data from API
   * @returns {HTMLElement} Post card element
   */
  function renderPostCard(post, options) {
    options = options || {};
    var el = document.createElement('article');
    el.className = 'post-card';
    el.dataset.id = String(post.id);
    el.dataset.postKey = post.post_key || '';
    el.setAttribute('tabindex', '0');

    if (post.subcategory_color) {
      var _hex = post.subcategory_color.replace('#', '');
      var _r = parseInt(_hex.substring(0, 2), 16);
      var _g = parseInt(_hex.substring(2, 4), 16);
      var _b = parseInt(_hex.substring(4, 6), 16);
      el.style.setProperty('--subcat-hover-bg', 'rgba(' + _r + ',' + _g + ',' + _b + ',1)');
    }

    // Use the in-area map card for display (location context must match the current map view).
    var pick = pickMapCardInCurrentBounds(post);
    var mapCard = pick.mapCard;
    // Store post_map_card_id on the card so opening is unambiguous.
    try { if (mapCard && mapCard.id !== undefined && mapCard.id !== null) el.dataset.postMapCardId = String(mapCard.id); } catch (_ePmc) {}

    // Get display data
    var title = (mapCard && mapCard.title) || post.checkout_title || post.title || '';
    if (title === 'Array') title = 'Post #' + post.id;
    var venueName = (mapCard && mapCard.venue_name) || '';
    var suburb = (mapCard && mapCard.suburb) || '';
    var city = (mapCard && mapCard.city) || '';
    var state = (mapCard && mapCard.state) || '';
    var countryName = (mapCard && mapCard.country_name) || '';
    var locationType = (mapCard && mapCard.location_type) || '';
    var locationCount = (post.map_cards && post.map_cards.length) ? post.map_cards.length : 1;
    var locationDisplay = '';
    if (locationCount > 1) {
      // Multi-location posts show count instead of a single location name
      locationDisplay = locationCount + ' Locations';
    } else if (locationType === 'venue') {
      var venueSecond = suburb || city || '';
      locationDisplay = (venueName && venueSecond) ? venueName + ', ' + venueSecond : (venueName || venueSecond || '');
    } else if (locationType === 'city') {
      var citySecond = state || countryName || '';
      locationDisplay = (city && citySecond) ? city + ', ' + citySecond : (city || citySecond || '');
    } else {
      var addrSecond = state || countryName || '';
      var addrLocal = suburb || city || '';
      locationDisplay = (addrLocal && addrSecond) ? addrLocal + ', ' + addrSecond : (addrLocal || addrSecond || '');
    }

    // Get subcategory info
    var displayName = post.subcategory_name || '';
    if (!displayName) {
      throw new Error('[Post] Subcategory name missing for key: ' + (post.subcategory_key || 'unknown'));
    }
    var iconUrl = post.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Post] Subcategory icon missing for key: ' + (post.subcategory_key || 'unknown'));
    }

    var datesText = formatPostDates(post);

    // Format price summary
    var priceParts = parsePriceSummary(mapCard ? mapCard.price_summary : post.price_summary || '');

    // Store small, per-card sort metadata on the element itself (DOM is the source of truth).
    // This avoids keeping an in-memory posts snapshot while still allowing the sort menu to work.
    try {
      el.dataset.sortCheckoutOrder = String(post.checkout_sort_order || 0);
      el.dataset.sortTitle = String(title || '').toLowerCase();
      el.dataset.sortCreatedAt = String(new Date(post.created_at || 0).getTime() || 0);
      el.dataset.sortPrice = String(extractPrice(mapCard) || 0);
      el.dataset.sortSoonTs = String(getMapCardSoonestTimestamp(mapCard) || '');
      if (mapCard && Number.isFinite(Number(mapCard.longitude)) && Number.isFinite(Number(mapCard.latitude))) {
        el.dataset.sortLng = String(mapCard.longitude);
        el.dataset.sortLat = String(mapCard.latitude);
      } else {
        el.dataset.sortLng = '';
        el.dataset.sortLat = '';
      }
    } catch (_eSortMeta) {}

    // Postcard thumbnail. Standard design uses thumbnail.
    var rawThumbUrl = getPostThumbnailUrl(post);
    var thumbUrl = getCardThumbSrc(rawThumbUrl);

    // Build HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbHtml = rawThumbUrl
      ? '<img class="post-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="post-card-image post-card-image--empty" aria-hidden="true"></div>';

    var isFav = isFavorite(post.id);

    // Build info rows using shared function (single source of truth)
    var infoRowsHtml = buildCardInfoRowsHtml({
      subcategoryName: displayName,
      subcategoryIconUrl: iconUrl,
      locationText: locationDisplay,
      datesText: datesText,
      priceParts: priceParts,
      hasPromo: mapCardHasPromo(mapCard)
    }, 'post-card');

    // Standard Design
    el.innerHTML = [
      thumbHtml,
      '<div class="post-card-meta">',
        '<div class="post-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="post-card-container-info">',
          infoRowsHtml,
        '</div>',
      '</div>',
      '<div class="post-card-container-actions">',
      '<button class="post-card-button-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
      '<span class="post-card-icon-fav" aria-hidden="true"></span>',
      '</button>',
      '</div>'
    ].join('');

    // Robust thumbnail loader (prevents broken/missing thumbnails if class=thumbnail isn't supported).
    if (rawThumbUrl) {
      wireCardThumbImage(el.querySelector('.post-card-image'), rawThumbUrl);
    }

    if (!options.skipDefaultOpenHandlers) {
      // Click handler for opening/closing post (toggle)
      el.addEventListener('click', function(e) {
        // Don't toggle if clicking favorite button
        if (e.target.closest('.post-card-button-fav')) return;
        
        // If this card is already inside a .post section, click means "close"
        if (el.closest('.post')) {
          closePost(post.id);
        } else {
          openPost(post, { originEl: el, postMapCardId: (el.dataset && el.dataset.postMapCardId) ? String(el.dataset.postMapCardId) : '' });
        }
      });

      // Keyboard: Enter/Space opens card (matches button behavior)
      el.addEventListener('keydown', function(e) {
        if (!e) return;
        var k = String(e.key || e.code || '');
        if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar' && k !== 'Space') return;
        if (e.target && e.target.closest && e.target.closest('.post-card-button-fav')) return;
        e.preventDefault();
        openPost(post, { originEl: el, postMapCardId: (el.dataset && el.dataset.postMapCardId) ? String(el.dataset.postMapCardId) : '' });
      });
    }

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
   * Render a storefront postcard (grouped general posts from same member at same location)
   */
  function renderStorefrontCard(sfPosts) {
    var lead = sfPosts[0];
    var el = document.createElement('article');
    el.className = 'post-card';
    el.dataset.id = String(lead.id);
    el.dataset.postKey = lead.post_key || '';
    el.dataset.storefront = '1';
    el.setAttribute('tabindex', '0');
    el.style.setProperty('--subcat-hover-bg', 'transparent');
    // Storefront hover background image uses the same system icon as the map marker.
    try {
      var sfSettings = App.getState('settings') || {};
      if (sfSettings.folder_system_images && sfSettings.multi_post_icon) {
        el.style.setProperty('--card-bg-icon', 'url(' + sfSettings.folder_system_images + '/' + sfSettings.multi_post_icon + ')');
      }
    } catch (_eSfBgIcon) {}

    var pick = pickMapCardInCurrentBounds(lead);
    var mapCard = pick.mapCard;
    if (mapCard && mapCard.id !== undefined && mapCard.id !== null) el.dataset.postMapCardId = String(mapCard.id);

    var title = 'Storefront: ' + (lead.member_name || '');

    // Avatar as postcard thumbnail
    var avatarUrl = resolveAvatarSrcForUser(lead.member_avatar, lead.member_id);
    var thumbUrl = avatarUrl ? addImageClass(avatarUrl, 'thumbnail') : '';
    var thumbHtml = thumbUrl
      ? '<img class="post-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="post-card-image post-card-image--empty" aria-hidden="true"></div>';

    // Storefront row: 42px circular post thumbnails (favourites first)
    var sfSorted = sfPosts.slice().sort(function(a, b) {
      var aTs = getFavoriteTimestamp(a.id);
      var bTs = getFavoriteTimestamp(b.id);
      var aFav = aTs ? 0 : 1;
      var bFav = bTs ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      if (aTs && bTs) return bTs - aTs;
      return 0;
    });
    var sfRowHtml = '<div class="post-card-row-storefront">';
    sfSorted.forEach(function(p) {
      var rawUrl = getPostThumbnailUrl(p);
      var miniUrl = rawUrl ? addImageClass(rawUrl, 'minithumb') : '';
      if (miniUrl) {
        var pFav = isFavorite(p.id);
        sfRowHtml += '<span class="post-card-row-storefront-wrap" data-post-id="' + p.id + '">';
        sfRowHtml += '<img class="post-card-row-storefront-thumb" src="' + miniUrl + '" alt="" />';
        if (pFav) sfRowHtml += '<span class="post-card-row-storefront-favstar" aria-hidden="true"></span>';
        sfRowHtml += '</span>';
      }
    });
    sfRowHtml += '</div>';

    // Location from the in-bounds map card (storefronts exist at one specific location)
    var locationDisplay = '';
    var venueName = (mapCard && mapCard.venue_name) || '';
    var suburb = (mapCard && mapCard.suburb) || '';
    var city = (mapCard && mapCard.city) || '';
    var stateName = (mapCard && mapCard.state) || '';
    var countryName = (mapCard && mapCard.country_name) || '';
    var locationType = (mapCard && mapCard.location_type) || '';
    if (locationType === 'venue') {
      var venueSecond = suburb || city || '';
      locationDisplay = (venueName && venueSecond) ? venueName + ', ' + venueSecond : (venueName || venueSecond || '');
    } else if (locationType === 'city') {
      var citySecond = stateName || countryName || '';
      locationDisplay = (city && citySecond) ? city + ', ' + citySecond : (city || citySecond || '');
    } else {
      var addrSecond = stateName || countryName || '';
      var addrLocal = suburb || city || '';
      locationDisplay = (addrLocal && addrSecond) ? addrLocal + ', ' + addrSecond : (addrLocal || addrSecond || '');
    }

    // Price range across all posts
    var sfPriceMin = Infinity, sfPriceMax = -Infinity;
    var sfHasPromo = false;
    var leadPriceParts = parsePriceSummary(mapCard ? mapCard.price_summary : '');
    sfPosts.forEach(function(p) {
      var mc = pickMapCardInCurrentBounds(p).mapCard;
      var price = extractPrice(mc);
      if (price > 0) {
        if (price < sfPriceMin) sfPriceMin = price;
        if (price > sfPriceMax) sfPriceMax = price;
      }
      if (mapCardHasPromo(mc)) sfHasPromo = true;
    });
    if (sfPriceMin !== Infinity && sfPriceMax !== -Infinity && sfPriceMin !== sfPriceMax) {
      leadPriceParts.text = sfPriceMin + ' – ' + sfPriceMax;
    }

    // Build location row
    var sett = App.getState('settings') || {};
    var locIconUrl = sett.badge_icon_location ? App.getImageUrl('fieldsetIcons', sett.badge_icon_location) : '';
    var locBadge = locIconUrl ? '<img class="post-card-image-badge" src="' + locIconUrl + '" alt="" title="Venue">' : '';
    var locRowHtml = locationDisplay ? '<div class="post-card-row-loc"><span class="post-card-badge">' + locBadge + '</span><span>' + escapeHtml(locationDisplay) + '</span></div>' : '';

    // Build price row
    var priceRowHtml = '';
    if (leadPriceParts && leadPriceParts.text) {
      var badgeHtml = leadPriceParts.flagUrl
        ? '<img class="post-card-image-badge" src="' + leadPriceParts.flagUrl + '" alt="' + leadPriceParts.countryCode + '" title="Currency: ' + leadPriceParts.countryCode.toUpperCase() + '">'
        : '';
      var promoTagHtml = sfHasPromo ? '<span class="post-card-tag-promo">Promo</span>' : '';
      priceRowHtml = '<div class="post-card-row-price"><span class="post-card-badge" title="Price">' + badgeHtml + '</span><span>' + escapeHtml(leadPriceParts.text) + '</span>' + promoTagHtml + '</div>';
    }

    // Sort metadata: use highest-tier post in the group so the storefront ranks correctly.
    var sfHighestTier = sfPosts.reduce(function(best, p) {
      return (p.checkout_sort_order || 0) > (best.checkout_sort_order || 0) ? p : best;
    }, sfPosts[0]);
    try {
      el.dataset.sortCheckoutOrder = String(sfHighestTier.checkout_sort_order || 0);
      el.dataset.sortTitle = String(title || '').toLowerCase();
      el.dataset.sortCreatedAt = String(new Date(lead.created_at || 0).getTime() || 0);
      el.dataset.sortPrice = String(extractPrice(mapCard) || 0);
      el.dataset.sortSoonTs = '';
      if (mapCard && Number.isFinite(Number(mapCard.longitude)) && Number.isFinite(Number(mapCard.latitude))) {
        el.dataset.sortLng = String(mapCard.longitude);
        el.dataset.sortLat = String(mapCard.latitude);
      } else {
        el.dataset.sortLng = '';
        el.dataset.sortLat = '';
      }
    } catch (_eSortMeta) {}

    var sfHasFav = sfPosts.some(function(p) { return isFavorite(p.id); });

    el.innerHTML = [
      thumbHtml,
      '<div class="post-card-meta">',
        '<div class="post-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="post-card-container-info">',
          sfRowHtml,
          locRowHtml,
          priceRowHtml,
        '</div>',
      '</div>',
      '<div class="post-card-container-actions">',
        '<span class="post-card-button-fav post-card-button-fav--passive" aria-pressed="' + (sfHasFav ? 'true' : 'false') + '" aria-label="Contains favourites">',
          '<span class="post-card-icon-fav" aria-hidden="true"></span>',
        '</span>',
      '</div>'
    ].join('');

    if (thumbUrl) {
      wireCardThumbImage(el.querySelector('.post-card-image'), avatarUrl);
    }

    el.addEventListener('click', function(e) {
      if (e.target.closest('.post-card-button-fav')) return;
      if (el.closest('.post')) {
        closePost(lead.id);
      } else {
        openPostById(lead.id, { originEl: el, postMapCardId: (el.dataset && el.dataset.postMapCardId) ? String(el.dataset.postMapCardId) : '', storefrontPosts: sfPosts });
      }
    });

    el.addEventListener('keydown', function(e) {
      if (!e) return;
      var k = String(e.key || e.code || '');
      if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar' && k !== 'Space') return;
      if (e.target && e.target.closest && e.target.closest('.post-card-button-fav')) return;
      e.preventDefault();
      openPostById(lead.id, { originEl: el, postMapCardId: (el.dataset && el.dataset.postMapCardId) ? String(el.dataset.postMapCardId) : '', storefrontPosts: sfPosts });
    });

    el.addEventListener('mouseenter', function() {
      el.classList.add('post-card--map-highlight');
      syncMapMarkerHover(lead.id, true);
    });
    el.addEventListener('mouseleave', function() {
      el.classList.remove('post-card--map-highlight');
      syncMapMarkerHover(lead.id, false);
    });

    return el;
  }

  /**
   * Render the post list
   * @param {Array} posts - Array of post data
   */
  function renderPostList(posts) {
    if (!postListEl) return;
    
    // Low-opacity hint during re-render (stale responses).
    // This allows the user to see that data is updating without a blank flicker.
    if (postListEl) {
      postListEl.style.opacity = '0.6';
      postListEl.style.pointerEvents = 'none';
    }
    
    // Preserve an open post's slot across re-renders (map moves trigger filter refreshes).
    // If the open post is still in the filtered results, keep it open (do NOT close just because the map moved).
    var preservedOpenPostEl = postListEl.querySelector('.post');
    var preservedOpenSlot = preservedOpenPostEl ? preservedOpenPostEl.closest('.post-main-container') : null;
    var preservedOpenPostId = preservedOpenSlot && preservedOpenSlot.dataset ? String(preservedOpenSlot.dataset.id || '') : '';
    if (preservedOpenSlot && preservedOpenSlot.parentElement === postListEl) {
      try { postListEl.removeChild(preservedOpenSlot); } catch (_eDetach) {}
    }
    
    var oldHeaderWrap = postPanelContentEl.querySelector('.post-panel-header-wrap');
    if (oldHeaderWrap) oldHeaderWrap.parentNode.removeChild(oldHeaderWrap);
    var oldSummary = postPanelContentEl.querySelector('.post-panel-header');
    if (oldSummary) oldSummary.parentNode.removeChild(oldSummary);
    var oldEmptySummary = postPanelContentEl.querySelector('.post-panel-empty-header');
    if (oldEmptySummary) oldEmptySummary.parentNode.removeChild(oldEmptySummary);

    // Clear existing list content (cards), preserving slack elements.
    var _topS = postListEl.querySelector('.topSlack');
    var _botS = postListEl.querySelector('.bottomSlack');
    postListEl.innerHTML = '';
    if (_topS) postListEl.appendChild(_topS);

    // Final paint: restore full opacity once DOM is swapped.
    function finalizeRender() {
      if (postListEl) {
        postListEl.style.opacity = '1';
        postListEl.style.pointerEvents = 'auto';
      }
    }

    // Show empty state if no posts
    if (!posts || !posts.length) {
      renderPostsEmptyState();
      // _botS was saved before innerHTML='' but renderPostsEmptyState can't find it
      // (it was already detached). Re-append it here so BottomSlack survives empty renders.
      if (_botS) postListEl.appendChild(_botS);
      finalizeRender();

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
          lastRenderedLocationMarkerSigByKey = {};
        }
      } catch (_eClear0) {}

      return;
    }

    var headerWrap = renderPostPanelHeader('post-panel-header');
    if (headerWrap) postListEl.appendChild(headerWrap);

    // Storefront grouping: group posts by member + coordinates when enabled
    var _sfEnabled = !!(window.App && App.getState && App.getState('settings') && App.getState('settings').storefront_enabled);
    var _sfLookup = {};
    var _sfGroups = {};
    if (_sfEnabled) {
      posts.forEach(function(p) {
        if (p.subcategory_type === 'Events') return;
        var pick = pickMapCardInCurrentBounds(p);
        if (!pick.mapCard) return;
        var key = p.member_id + ':' + pick.mapCard.latitude + ':' + pick.mapCard.longitude;
        if (!_sfGroups[key]) _sfGroups[key] = [];
        _sfGroups[key].push(p);
      });
      Object.keys(_sfGroups).forEach(function(key) {
        if (_sfGroups[key].length < 2) { delete _sfGroups[key]; return; }
        _sfGroups[key].forEach(function(p) { _sfLookup[p.id] = key; });
      });
    }
    _sfGroupsByPostId = {};
    Object.keys(_sfGroups).forEach(function(key) {
      _sfGroups[key].forEach(function(p) { _sfGroupsByPostId[String(p.id)] = _sfGroups[key]; });
    });

    // Detach any existing scroll listener before building new one
    if (_virtScrollListener && postListEl) {
      postListEl.removeEventListener('scroll', _virtScrollListener);
      _virtScrollListener = null;
    }
    clearTimeout(_virtSettleTimer);
    _virtSettleTimer = null;
    _virtScrollTicking = false;

    // Store full sorted array and compute sort metadata for in-memory sorting
    _virtPosts = posts;
    _virtPostsMeta = {};
    posts.forEach(function(p) {
      var _mPick = pickMapCardInCurrentBounds(p);
      var _mc = _mPick.mapCard;
      var _mTitle = (_mc && _mc.title) || p.checkout_title || p.title || '';
      if (_mTitle === 'Array') _mTitle = 'Post #' + p.id;
      _virtPostsMeta[String(p.id)] = {
        sortCheckoutOrder: Number(p.checkout_sort_order) || 0,
        sortTitle: String(_mTitle).toLowerCase(),
        sortCreatedAt: new Date(p.created_at || 0).getTime() || 0,
        sortPrice: extractPrice(_mc) || 0,
        sortSoonTs: getMapCardSoonestTimestamp(_mc) || Infinity,
        sortLng: (_mc && Number.isFinite(Number(_mc.longitude))) ? Number(_mc.longitude) : null,
        sortLat: (_mc && Number.isFinite(Number(_mc.latitude))) ? Number(_mc.latitude) : null
      };
    });

    // Compute effective storefront leads based on current _virtPosts order
    _virtComputeEffectiveLeads();

    // Determine initial window start.
    // If a post is open, center the window on it so it remains in the DOM.
    _virtStart = 0;
    if (preservedOpenPostId) {
      for (var _opiIdx = 0; _opiIdx < posts.length; _opiIdx++) {
        if (String(posts[_opiIdx].id) === preservedOpenPostId) {
          _virtStart = Math.max(0, _opiIdx - 10);
          break;
        }
      }
    }
    var _virtEnd = Math.min(_virtStart + _VIRT_WINDOW, posts.length);
    console.error('[VIRT DEBUG] posts=' + posts.length + ' preservedId=' + preservedOpenPostId + ' _virtStart=' + _virtStart + ' _virtEnd=' + _virtEnd);

    // Above ghost container: ghost postcards for all posts before the window
    _virtAboveEl = document.createElement('div');
    _virtAboveEl.className = 'post-virt-above';
    if (_virtStart > 0) {
      _virtAboveEl.appendChild(BackdropComponent.createFragment(_virtStart));
    }
    postListEl.appendChild(_virtAboveEl);

    // Render real postcard DOM elements for the window slice only
    var _wCardSett = (window.App && typeof App.getState === 'function') ? (App.getState('settings') || {}) : {};
    for (var _wIdx = _virtStart; _wIdx < _virtEnd; _wIdx++) {
      var _wPost = posts[_wIdx];

      // Preserved open slot: reinsert instead of recreating (same logic as before, no DOM rebuild)
      if (preservedOpenSlot && preservedOpenPostId && String(_wPost.id) === preservedOpenPostId) {
        var _wSlotWasSF = !!preservedOpenSlot.querySelector('.post-storefront-menu-container');
        var _wSlotNowSF = !!(_sfGroupsByPostId[String(_wPost.id)] && _sfGroupsByPostId[String(_wPost.id)].length >= 2);
        var _wSfGroupChanged = false;
        if (_wSlotWasSF && _wSlotNowSF) {
          var _wOldIds = preservedOpenSlot.dataset.sfIds || '';
          var _wNewGroupArr = _sfGroupsByPostId[String(_wPost.id)] || [];
          var _wNewIds = _wNewGroupArr.map(function(p) { return String(p.id); }).join(',');
          if (_wOldIds !== _wNewIds) _wSfGroupChanged = true;
        }
        if (_wSlotWasSF !== _wSlotNowSF || _wSfGroupChanged) {
          preservedOpenSlot = null;
          preservedOpenPostId = '';
        }
      }
      if (preservedOpenSlot && preservedOpenPostId && String(_wPost.id) === preservedOpenPostId) {
        preservedOpenSlot.style.display = '';
        var _wPreservedOuter = (preservedOpenSlot.parentElement && preservedOpenSlot.parentElement.classList.contains('post-outer-container')) ? preservedOpenSlot.parentElement : preservedOpenSlot;
        postListEl.appendChild(_wPreservedOuter);
        try {
          var _wOpenWrap = preservedOpenSlot.querySelector('.post');
          var _wStoredList = _wOpenWrap ? _wOpenWrap.__postLocationList : null;
          if (_wStoredList && _wPost.map_cards) {
            var _wFreshById = {};
            _wPost.map_cards.forEach(function(mc) { if (mc && mc.id != null) _wFreshById[mc.id] = mc; });
            _wStoredList.forEach(function(loc) {
              var fresh = _wFreshById[loc.id];
              if (fresh) loc.passes_filter = fresh.passes_filter;
            });
          }
          var _wLocContainer = _wOpenWrap ? _wOpenWrap.querySelector('.post-location-container') : null;
          if (_wLocContainer) {
            _wLocContainer.querySelectorAll('.post-location-option').forEach(function(opt) {
              var idx = parseInt(opt.dataset.index, 10);
              var loc = _wStoredList && _wStoredList[idx];
              if (!loc) return;
              if (loc.passes_filter === 0) {
                opt.classList.add('post-location-option--filtered');
              } else {
                opt.classList.remove('post-location-option--filtered');
              }
            });
          }
        } catch (_wSyncErr) {}
        continue;
      }

      // Storefront: skip non-lead posts, render storefront card for the effective lead only
      var _wSfGroup = _sfGroupsByPostId[String(_wPost.id)];
      var _wIsSfMember = _wSfGroup && _wSfGroup.length >= 2;
      if (_wIsSfMember && !_sfEffectiveLead[String(_wPost.id)]) continue;

      var _wCard;
      if (_wIsSfMember) {
        _wCard = renderStorefrontCard(_wSfGroup);
      } else {
        _wCard = renderPostCard(_wPost);
      }

      var _wAnchor = document.createElement('div');
      _wAnchor.setAttribute('data-slack-anchor', '');
      _wAnchor.appendChild(_wCard);
      var _wSlot = document.createElement('div');
      _wSlot.className = 'post-main-container';
      _wSlot.dataset.id = String(_wPost.id);
      if (_wIsSfMember) {
        _wSlot.dataset.sfIds = _wSfGroup.map(function(p) { return String(p.id); }).join(',');
      }
      _wSlot.appendChild(_wAnchor);
      var _wPostOuter = document.createElement('div');
      _wPostOuter.className = 'post-outer-container';
      if (!_wIsSfMember && _wCardSett.countdown_postcards) {
        var _wCardPick = pickMapCardInCurrentBounds(_wPost);
        var _wBarResult = buildCountdownStatusBar(_wPost, _wCardPick.mapCard);
        if (_wBarResult) {
          _wBarResult.bar.classList.add('post-statusbar--slot-card');
          if (_wCardSett.countdown_postcards_mode === 'soonest_only') {
            _wBarResult.bar.classList.add('post-statusbar--modesoonest');
          }
          _wCard.classList.add('post-card--countdown' + _wBarResult.state);
          var _wStatusCont = document.createElement('div');
          _wStatusCont.className = 'post-status-container';
          _wStatusCont.appendChild(_wBarResult.bar);
          _wPostOuter.appendChild(_wStatusCont);
        }
      }
      _wPostOuter.appendChild(_wSlot);
      postListEl.appendChild(_wPostOuter);
    }

    // Below ghost container: ghost postcards for all posts after the window
    _virtBelowEl = document.createElement('div');
    _virtBelowEl.className = 'post-virt-below';
    var _wBelowCount = posts.length - _virtEnd;
    if (_wBelowCount > 0) {
      _virtBelowEl.appendChild(BackdropComponent.createFragment(_wBelowCount));
    }
    postListEl.appendChild(_virtBelowEl);

    // If the open post is no longer in the filtered list, it is not reinserted (filtered out — expected).

    // Render markers on the map (only if above zoom threshold)
    var threshold = getPostsMinZoom();
    if (lastZoom >= threshold) {
      renderMapMarkers(posts);
    }

    if (_botS) postListEl.appendChild(_botS);
    BackdropComponent.populate(_topS);
    BackdropComponent.populate(_botS);

    // Attach scroll listener for virtual window recycling
    _virtScrollListener = function() { _virtOnScroll(); };
    postListEl.addEventListener('scroll', _virtScrollListener, { passive: true });

    finalizeRender();
  }

  /**
   * Compute which post is the effective lead for each storefront group, based on the current
   * _virtPosts order. The first member of a group encountered in _virtPosts is the lead.
   * Must be called any time _virtPosts order changes (renderPostList, sortPosts).
   */
  function _virtComputeEffectiveLeads() {
    _sfEffectiveLead = {};
    var _seenGroups = [];
    for (var _eli = 0; _eli < _virtPosts.length; _eli++) {
      var _elGroup = _sfGroupsByPostId[String(_virtPosts[_eli].id)];
      if (!_elGroup || _elGroup.length < 2) continue;
      if (_seenGroups.indexOf(_elGroup) === -1) {
        _seenGroups.push(_elGroup);
        _sfEffectiveLead[String(_virtPosts[_eli].id)] = true;
      }
    }
  }

  /**
   * Shift the virtual window to a new start index, recycling the 50 real postcard DOM elements.
   * Called from the scroll listener when the user scrolls into ghost-card territory.
   * Never called while a post is open (open post pins the window until closed).
   * @param {number} newStart - desired index for the first real card in the window
   * @param {Object} [options] - optional: { noScrollCorrect: true } to skip scrollTop correction
   */
  function _virtShiftWindow(newStart, options) {
    if (!postListEl || !_virtPosts || !_virtPosts.length) return;
    if (postListEl.querySelector('.post')) { console.error('[VIRT DEBUG] _virtShiftWindow blocked by open post, newStart=' + newStart); return; }

    newStart = Math.max(0, Math.min(newStart, Math.max(0, _virtPosts.length - _VIRT_WINDOW)));
    if (!_virtDirty && newStart === _virtStart) return;
    console.error('[VIRT DEBUG] _virtShiftWindow newStart=' + newStart + ' from=' + _virtStart);
    _virtDirty = false;

    var newEnd = Math.min(newStart + _VIRT_WINDOW, _virtPosts.length);

    // Measure current above height for scroll correction (before any DOM changes)
    var savedScroll = postListEl.scrollTop;
    var oldAboveH = (_virtAboveEl && _virtAboveEl.parentNode === postListEl) ? _virtAboveEl.offsetHeight : 0;

    // Build new above ghost container
    var newAboveEl = document.createElement('div');
    newAboveEl.className = 'post-virt-above';
    if (newStart > 0) {
      newAboveEl.appendChild(BackdropComponent.createFragment(newStart));
    }

    // Build real cards for new window slice
    var _sCardSett = (window.App && typeof App.getState === 'function') ? (App.getState('settings') || {}) : {};
    var newCardsFrag = document.createDocumentFragment();
    for (var _si = newStart; _si < newEnd; _si++) {
      var _sPost = _virtPosts[_si];
      var _sSfGroup = _sfGroupsByPostId[String(_sPost.id)];
      var _sIsSfMember = _sSfGroup && _sSfGroup.length >= 2;
      if (_sIsSfMember && !_sfEffectiveLead[String(_sPost.id)]) continue;

      var _sCard;
      if (_sIsSfMember) {
        _sCard = renderStorefrontCard(_sSfGroup);
      } else {
        _sCard = renderPostCard(_sPost);
      }

      var _sAnchor = document.createElement('div');
      _sAnchor.setAttribute('data-slack-anchor', '');
      _sAnchor.appendChild(_sCard);
      var _sSlot = document.createElement('div');
      _sSlot.className = 'post-main-container';
      _sSlot.dataset.id = String(_sPost.id);
      if (_sIsSfMember) {
        _sSlot.dataset.sfIds = _sSfGroup.map(function(p) { return String(p.id); }).join(',');
      }
      _sSlot.appendChild(_sAnchor);
      var _sPostOuter = document.createElement('div');
      _sPostOuter.className = 'post-outer-container';
      if (!_sIsSfMember && _sCardSett.countdown_postcards) {
        var _sCardPick = pickMapCardInCurrentBounds(_sPost);
        var _sBarResult = buildCountdownStatusBar(_sPost, _sCardPick.mapCard);
        if (_sBarResult) {
          _sBarResult.bar.classList.add('post-statusbar--slot-card');
          if (_sCardSett.countdown_postcards_mode === 'soonest_only') {
            _sBarResult.bar.classList.add('post-statusbar--modesoonest');
          }
          _sCard.classList.add('post-card--countdown' + _sBarResult.state);
          var _sStatusCont = document.createElement('div');
          _sStatusCont.className = 'post-status-container';
          _sStatusCont.appendChild(_sBarResult.bar);
          _sPostOuter.appendChild(_sStatusCont);
        }
      }
      _sPostOuter.appendChild(_sSlot);
      newCardsFrag.appendChild(_sPostOuter);
    }

    // Build new below ghost container
    var newBelowEl = document.createElement('div');
    newBelowEl.className = 'post-virt-below';
    var _sBelowCount = _virtPosts.length - newEnd;
    if (_sBelowCount > 0) {
      newBelowEl.appendChild(BackdropComponent.createFragment(_sBelowCount));
    }

    // Swap above container
    if (_virtAboveEl && _virtAboveEl.parentNode === postListEl) {
      postListEl.replaceChild(newAboveEl, _virtAboveEl);
    }
    _virtAboveEl = newAboveEl;

    // Remove old real cards (everything between _virtAboveEl and _virtBelowEl)
    if (_virtBelowEl && _virtBelowEl.parentNode === postListEl) {
      var _sToRemove = [];
      var _sCur = _virtAboveEl.nextSibling;
      while (_sCur && _sCur !== _virtBelowEl) {
        _sToRemove.push(_sCur);
        _sCur = _sCur.nextSibling;
      }
      for (var _sRi = 0; _sRi < _sToRemove.length; _sRi++) {
        if (_sToRemove[_sRi].parentNode === postListEl) postListEl.removeChild(_sToRemove[_sRi]);
      }
      // Insert new cards before the below container
      postListEl.insertBefore(newCardsFrag, _virtBelowEl);
      // Swap below container
      postListEl.replaceChild(newBelowEl, _virtBelowEl);
    }
    _virtBelowEl = newBelowEl;

    _virtStart = newStart;

    // Correct scrollTop to compensate for above ghost height change
    if (!options || !options.noScrollCorrect) {
      var newAboveH = _virtAboveEl.offsetHeight;
      var _sDelta = newAboveH - oldAboveH;
      if (_sDelta !== 0) postListEl.scrollTop = savedScroll + _sDelta;
    }
  }

  /**
   * rAF-throttled scroll handler: shifts window when user scrolls far into ghost territory.
   */
  function _virtOnScroll() {
    if (!_virtScrollTicking) {
      _virtScrollTicking = true;
      requestAnimationFrame(function() {
        _virtScrollTicking = false;
        _virtCheckScrollBoundary();
      });
    }
    clearTimeout(_virtSettleTimer);
    _virtSettleTimer = setTimeout(_virtSettle, 150);
  }

  /**
   * Checks if the scroll position has moved far enough into ghost territory to warrant a shift.
   * Uses scroll percentage to estimate the visible array index without pixel math.
   */
  function _virtCheckScrollBoundary() {
    if (!postListEl || !_virtPosts || _virtPosts.length <= _VIRT_WINDOW) return;
    if (postListEl.querySelector('.post')) return;
    var scrollH = postListEl.scrollHeight;
    var clientH = postListEl.clientHeight;
    if (scrollH <= clientH) return;
    var pct = postListEl.scrollTop / (scrollH - clientH);
    var approxIdx = Math.round(pct * (_virtPosts.length - 1));
    var targetStart = Math.max(0, approxIdx - 20);
    if (Math.abs(targetStart - _virtStart) > 15) {
      _virtShiftWindow(targetStart);
    }
  }

  /**
   * Debounced settle: after scrolling stops, snap the window precisely to the visible position.
   */
  function _virtSettle() {
    if (!postListEl || !_virtPosts || _virtPosts.length <= _VIRT_WINDOW) return;
    if (postListEl.querySelector('.post')) return;
    var scrollH = postListEl.scrollHeight;
    var clientH = postListEl.clientHeight;
    if (scrollH <= clientH) return;
    var pct = postListEl.scrollTop / (scrollH - clientH);
    var approxIdx = Math.round(pct * (_virtPosts.length - 1));
    var targetStart = Math.max(0, approxIdx - 20);
    if (Math.abs(targetStart - _virtStart) > 5) {
      _virtShiftWindow(targetStart);
    }
  }

  function postPanelHasActiveFilter() {
    try {
      var savedFilters = JSON.parse(localStorage.getItem('funmap_filters') || '{}');
      var hasActiveFilter = !!(
        (savedFilters.keyword && savedFilters.keyword.trim()) ||
        (savedFilters.minPrice && savedFilters.minPrice.trim()) ||
        (savedFilters.maxPrice && savedFilters.maxPrice.trim()) ||
        savedFilters.dateStart || savedFilters.dateEnd ||
        savedFilters.expired
      );
      if (!hasActiveFilter && savedFilters.categories) {
        var cats = savedFilters.categories;
        var catKeys = Object.keys(cats);
        for (var ci = 0; ci < catKeys.length; ci++) {
          var cat = cats[catKeys[ci]];
          if (cat && cat.enabled === false) { hasActiveFilter = true; break; }
          if (cat && cat.subs) {
            var subKeys = Object.keys(cat.subs);
            for (var si = 0; si < subKeys.length; si++) {
              if (cat.subs[subKeys[si]] === false) { hasActiveFilter = true; break; }
            }
          }
          if (hasActiveFilter) break;
        }
      }
      return hasActiveFilter;
    } catch (_eHasActive) {
      return false;
    }
  }

  function createPostSortMenu() {
    var menuEl = document.createElement('div');
    menuEl.className = 'filter-sort-menu menu-class-1';
    menuEl.innerHTML = [
      '<div class="filter-sort-menu-button menu-button">',
        '<span class="filter-sort-menu-button-text menu-text">Sort by Recommended</span>',
        '<span class="filter-sort-geolocate-icon filter-sort-geolocate-icon--button" aria-hidden="true"></span>',
        '<span class="filter-sort-menu-button-arrow menu-arrow"></span>',
      '</div>',
      '<div class="filter-sort-menu-options menu-options">',
        '<div class="filter-sort-menu-option menu-option" data-sort="recommended">Sort by Recommended</div>',
        '<div class="filter-sort-menu-option menu-option" data-sort="az">Sort by Title A-Z</div>',
        '<div class="filter-sort-menu-option menu-option" data-sort="nearest">Sort by Distance<span class="filter-sort-geolocate-icon" aria-hidden="true"></span></div>',
        '<div class="filter-sort-menu-option menu-option" data-sort="soon">Sort by Soonest</div>',
      '</div>'
    ].join('');
    return menuEl;
  }

  function createPostFavouritesButton() {
    var buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'post-panel-favourites-btn button-class-9';
    buttonEl.setAttribute('aria-pressed', 'false');
    buttonEl.setAttribute('aria-label', 'Favourites first');
    buttonEl.innerHTML = [
      '<span class="filter-favourites-icon" aria-hidden="true"></span>',
      '<span class="post-panel-favourites-btn-text">Favourites first</span>'
    ].join('');
    return buttonEl;
  }

  function renderPostPanelHeader(headerClassName) {
    var summaryText = getFilterSummaryText();
    if (!summaryText) return null;
    var hasActiveFilter = postPanelHasActiveFilter();

    var wrap = document.createElement('div');
    wrap.className = 'post-panel-header-wrap';
    if (hasActiveFilter) wrap.classList.add('post-panel-header-wrap--active');

    var summaryEl = document.createElement('div');
    summaryEl.className = 'msg--summary ' + headerClassName;
    if (hasActiveFilter) {
      summaryEl.classList.add(headerClassName + '--active');
    }
    summaryEl.textContent = summaryText;
    wrap.appendChild(summaryEl);

    var sortRow = document.createElement('div');
    sortRow.className = 'post-panel-controls-row';
    var sortMenuEl = createPostSortMenu();
    var favouritesBtnEl = createPostFavouritesButton();
    sortRow.appendChild(sortMenuEl);
    sortRow.appendChild(favouritesBtnEl);
    wrap.appendChild(sortRow);

    try {
      if (window.FilterModule && typeof FilterModule.bindSortMenu === 'function') {
        FilterModule.bindSortMenu(sortMenuEl);
      }
      if (window.FilterModule && typeof FilterModule.bindFavouritesButton === 'function') {
        FilterModule.bindFavouritesButton(favouritesBtnEl);
      }
    } catch (_eBindSortMenu) {}

    return wrap;
  }


  /* --------------------------------------------------------------------------
     MAP MARKER INTEGRATION
     -------------------------------------------------------------------------- */

  // Track which venue markers are currently rendered so we can update in-place
  // (matches live-site behavior: don't clear everything on every refresh).
  var lastRenderedLocationMarkerSigByKey = {};

  // --- Map Card Priority System ---
  // Cached random scores for each venue key, persisted between renders.
  // Only regenerated on zoom changes exceeding the reshuffle threshold.
  var priorityScoreCache = {};        // locationKey -> random score (0-1)

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
    var iconUrl = post.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Map] Missing subcategory iconUrl for map card marker (single post). Post ID: ' + post.id);
    }

    // Get thumbnail URL - use 'minithumb' class (50x50) for map card markers
    var rawUrl = (mapCard.media_urls && mapCard.media_urls.length) ? mapCard.media_urls[0] : '';
    var thumbnailUrl = addImageClass(rawUrl, 'minithumb');

    // Check if this post has multiple locations
    var isMultiLocation = post.map_cards && post.map_cards.length > 1;

    return {
      id: post.id,
      post_key: post.post_key,
      post_map_card_id: mapCard.id,
      map_card_index: mapCardIndex,
      title: title,
      venue: venueName,
      suburb: mapCard.suburb || '',
      city: mapCard.city || '',
      state: mapCard.state || '',
      country_name: mapCard.country_name || '',
      sub: subcategoryKey,
      iconUrl: iconUrl,
      thumbnailUrl: thumbnailUrl,
      subcategory_color: post.subcategory_color || '',
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
    _lastRenderedPosts = posts || _lastRenderedPosts;
    // Agent Essentials: Never load or process if not required.
    var threshold = getPostsMinZoom();
    if (typeof lastZoom !== 'number' || lastZoom < threshold) {
      // We are below the breakpoint. Wipe everything and exit.
      if (window.MapModule) {
        if (typeof MapModule.clearAllMapCardMarkers === 'function') {
          MapModule.clearAllMapCardMarkers();
        }
      }
      lastRenderedLocationMarkerSigByKey = {};
      return;
    }

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

    // Live-site style: update markers in-place (diff by locationKey) to avoid flashing.

    // Only render map cards within the fetch viewport — out-of-bounds map cards on
    // multi-location posts must not consume card slots or create DOM markers.
    // Use _lastFetchBounds (captured at fetch time) not getMapBounds() (live viewport),
    // because the map can drift between when posts are fetched and when markers are rendered.
    var _renderBounds = _lastFetchBounds || getMapBounds();

    // First pass: collect all map cards and group by venue coordinates
    // Multi-post venues (same location, different posts) use multi_post_icon
    var COORD_PRECISION = 6;
    var locationGroups = {}; // key: "lng,lat" -> array of {post, mapCard, index}
    
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
        if (_renderBounds && !pointWithinBounds(lng, lat, _renderBounds)) return;

        var locationKey = lng.toFixed(COORD_PRECISION) + ',' + lat.toFixed(COORD_PRECISION);
        if (!locationGroups[locationKey]) {
          locationGroups[locationKey] = [];
        }
        locationGroups[locationKey].push({ post: post, mapCard: mapCard, index: index });
      });
    });

    function buildMarkerSignature(markerData) {
      // Only include fields that affect marker visuals/behavior.
      // Keep this stable to avoid unnecessary remove/recreate cycles.
      var ids = [];
      if (markerData && (markerData.isMultiPost || markerData.isStorefront) && Array.isArray(markerData.locationPostIds)) {
        ids = markerData.locationPostIds.map(String).slice().sort();
      } else if (markerData && markerData.id !== undefined && markerData.id !== null) {
        ids = [String(markerData.id)];
      }
      return [
        markerData && markerData.isMultiPost ? '1' : '0',
        markerData && markerData.isStorefront ? '1' : '0',
        ids.join(','),
        markerData && markerData.storefrontTitle ? String(markerData.storefrontTitle) : '',
        markerData && markerData.title ? String(markerData.title) : '',
        markerData && markerData.venue ? String(markerData.venue) : '',
        markerData && markerData.sub ? String(markerData.sub) : '',
        markerData && markerData.iconUrl ? String(markerData.iconUrl) : '',
        markerData && markerData.thumbnailUrl ? String(markerData.thumbnailUrl) : '',
        markerData && markerData.markerAppearance ? String(markerData.markerAppearance) : 'card'
      ].join('|');
    }

    // Second pass: build desired markers (one per locationKey), then diff-update.
    var nextSigByKey = {};
    var nextMarkerDataByKey = {};

    var allMarkerData = [];
    Object.keys(locationGroups).forEach(function(locationKey) {
      var group = locationGroups[locationKey];
      if (!group.length) return;

      var uniquePostIds = {};
      group.forEach(function(item) { uniquePostIds[item.post.id] = true; });
      var uniquePostCount = Object.keys(uniquePostIds).length;

      // Storefront detection: 2+ posts, same member, all general (not events).
      // Mutually exclusive with isMultiPostLocation.
      // Gated on storefront_enabled admin setting.
      var storefrontEnabled = !!(window.App && App.getState && App.getState('settings') && App.getState('settings').storefront_enabled);
      var isStorefront = false;
      var isMultiPostLocation = false;
      if (uniquePostCount > 1) {
        if (storefrontEnabled) {
          var firstMemberId = group[0].post.member_id;
          var allSameMember = group.every(function(item) { return item.post.member_id === firstMemberId; });
          var allGeneral = group.every(function(item) { return item.post.subcategory_type !== 'Events'; });
          if (allSameMember && allGeneral) {
            isStorefront = true;
          } else {
            isMultiPostLocation = true;
          }
        } else {
          isMultiPostLocation = true;
        }
      }

      var firstItem = group[0];
      var markerData = convertMapCardToMarker(firstItem.post, firstItem.mapCard, firstItem.index);
      if (!markerData) return;

      if (isStorefront) {
        var sfPost = firstItem.post;
        markerData.isStorefront = true;
        markerData.locationPostIds = Object.keys(uniquePostIds);
        markerData.locationPostCount = Object.keys(uniquePostIds).length;
        markerData.storefrontTitle = 'Storefront: ' + (sfPost.member_name || '');
        markerData.storefrontAvatarUrl = resolveAvatarSrcForUser(sfPost.member_avatar, sfPost.member_id);
      } else if (isMultiPostLocation) {
        markerData.isMultiPost = true;
        markerData.locationPostIds = Object.keys(uniquePostIds);
        markerData.locationPostCount = markerData.locationPostIds.length;
        // Dominant subcategory colour: whichever colour appears most across all posts at this venue.
        var _mpColourCounts = {};
        group.forEach(function(gi) {
          var _c = gi.post.subcategory_color || '';
          if (_c) _mpColourCounts[_c] = (_mpColourCounts[_c] || 0) + 1;
        });
        var _mpDomColour = markerData.subcategory_color || '';
        var _mpDomMax = 0;
        Object.keys(_mpColourCounts).forEach(function(_c) {
          if (_mpColourCounts[_c] > _mpDomMax) { _mpDomMax = _mpColourCounts[_c]; _mpDomColour = _c; }
        });
        markerData.subcategory_color = _mpDomColour;
        // Use the icon from the first post whose colour matches the dominant colour
        var _mpDomIcon = markerData.iconUrl || '';
        for (var _mpi = 0; _mpi < group.length; _mpi++) {
          if ((group[_mpi].post.subcategory_color || '') === _mpDomColour && group[_mpi].post.iconUrl) {
            _mpDomIcon = group[_mpi].post.iconUrl;
            break;
          }
        }
        markerData.iconUrl = _mpDomIcon;
        // Collect thumbnails keyed by post ID (used for big-card cycling and post-selection lock)
        var _mpThumbs = {};
        group.forEach(function(gi) {
          var _rawUrl = (gi.mapCard && gi.mapCard.media_urls && gi.mapCard.media_urls.length) ? gi.mapCard.media_urls[0] : '';
          if (_rawUrl) _mpThumbs[String(gi.post.id)] = addImageClass(_rawUrl, 'minithumb');
        });
        markerData.locationThumbnails = _mpThumbs;
      }

      // Store all map card IDs in this location group so activation lookup can match
      // any individual post's map card ID (not just the first item's).
      if (isStorefront || isMultiPostLocation) {
        markerData.locationMapCardIds = group.map(function(item) { return String(item.mapCard.id); });
      }
      
      markerData.locationKey = locationKey;

      // For location groups: use the highest checkout_sort_order among all posts in the group.
      // Single-post markers use their own checkout_sort_order directly.
      // Highest sort_order = highest priority (premium = highest number)
      markerData._groupMaxSortOrder = group.reduce(function(max, item) {
        return Math.max(max, item.post.checkout_sort_order || 0);
      }, 0);

      // If any post in the group has checkout_featured = 1, the group is featured.
      // Featured groups are never dots — only non-featured groups can become dots.
      markerData._groupIsFeatured = group.some(function(item) {
        return (item.post.featured || 0) === 1;
      });

      allMarkerData.push(markerData);
    });

    // --- Map Card Priority System ---
    // Ranked by checkout_sort_order (higher = better). Any number of tiers supported.
    // Within each tier: randomized for fair exposure.
    // Fairness rule: one map card per post before any post gets a second.
    // Only the lowest tier (tierStandard) can become dots.
    var MAX_MAP_CARDS = (window.App && typeof App.getConfig === 'function') ? App.getConfig('maxMapCards') : 50;
    var totalResultCount = allMarkerData.length;
    var isHighDensity = totalResultCount > MAX_MAP_CARDS;

    // Assign random scores once per venue key — new venues get a score on first appearance,
    // existing venues keep theirs. Scores never reshuffle on zoom to prevent erratic switching.
    allMarkerData.forEach(function(item) {
      if (priorityScoreCache[item.locationKey] === undefined) {
        priorityScoreCache[item.locationKey] = Math.random();
      }
    });

    // checkout_featured = 1 means the tier is featured or above — never a dot.
    // checkout_featured = 0 means the tier can become a dot when max map cards is exceeded.

    // Sort directly by checkout_sort_order descending, random score as tiebreaker.
    // Higher sort_order = higher priority. Fairness: one card per post before extras.
    var seenPostIds = {};
    var firstPass = [];
    var secondPass = [];

    allMarkerData.slice().sort(function(a, b) {
      var diff = (b._groupMaxSortOrder || 0) - (a._groupMaxSortOrder || 0);
      if (diff !== 0) return diff;
      return (priorityScoreCache[b.locationKey] || 0) - (priorityScoreCache[a.locationKey] || 0);
    }).forEach(function(item) {
      var postId = String(item.id);
      if (!seenPostIds[postId]) {
        seenPostIds[postId] = true;
        firstPass.push(item);
      } else {
        secondPass.push(item);
      }
    });

    var priorityList = firstPass.concat(secondPass);

    // Assign appearance: top MAX_MAP_CARDS become cards, rest become icons or dots.
    // Only the lowest checkout_sort_order can become dots — all others become icons.
    // All are the same map card marker — appearance is CSS only.
    var appearanceByKey = {};
    var dotColorByKey = {};

    priorityList.forEach(function(item, idx) {
      var post = item._originalPost;
      var hasCardSlot = idx < MAX_MAP_CARDS;

      var appearance = 'card';
      if (isHighDensity && !hasCardSlot) {
        if (_groundBubblesActive) {
          appearance = 'hidden';
        } else {
          appearance = item._groupIsFeatured ? 'icon' : 'dot';
        }
      }

      if (appearance === 'dot' && !item.isMultiPost && !item.isStorefront) {
        var subColor = post.subcategory_color;
        if (!subColor) throw new Error('[Map] Subcategory color missing for post ID ' + item.id);
        dotColorByKey[item.locationKey] = subColor;
      }

      appearanceByKey[item.locationKey] = appearance;
    });

    // If a post is open, its active map card location must always appear as a card.
    var _openPostEl = null;
    try { _openPostEl = document.querySelector('.post[data-id]'); } catch (_eOpEl) {}
    if (_openPostEl) {
      var _openPostId = _openPostEl.getAttribute('data-id') || '';
      var _openCardId = _openPostEl.getAttribute('data-post-map-card-id') || '';
      for (var _opi = 0; _opi < allMarkerData.length; _opi++) {
        var _opItem = allMarkerData[_opi];
        if (String(_opItem.id) === _openPostId && String(_opItem.post_map_card_id) === _openCardId) {
          appearanceByKey[_opItem.locationKey] = 'card';
          delete dotColorByKey[_opItem.locationKey];
          break;
        }
      }
    }

    // All marker types — assign appearance and build sig/data maps.
    allMarkerData.forEach(function(markerData) {
      markerData.markerAppearance = appearanceByKey[markerData.locationKey] || 'card';
      markerData.dotColor = dotColorByKey[markerData.locationKey] || '';
      if (markerData.markerAppearance === 'hidden') return;
      nextMarkerDataByKey[markerData.locationKey] = markerData;
      nextSigByKey[markerData.locationKey] = buildMarkerSignature(markerData);
    });

    // ── NATIVE CIRCLE SPLIT ───────────────────────────────────────────────
    // Single-post icon/dot markers → native Mapbox circle layer (no DOM, GPU only).
    // Multi-post, cards, storefronts → DOM markers (z-order control, count badge).
    //
    // ★ SWITCH: set to false to revert to DOM icon/dot markers (old behaviour).
    var USE_NATIVE_CIRCLES = true;
    //
    var _circleFeatures  = [];
    var _circleDataByKey = {};

    Object.keys(nextMarkerDataByKey).forEach(function(locationKey) {
      var md = nextMarkerDataByKey[locationKey];
      var isNativeCircle = USE_NATIVE_CIRCLES
                           && (md.markerAppearance === 'icon' || md.markerAppearance === 'dot')
                           && !md.isMultiPost && !md.isStorefront;
      if (!isNativeCircle) return;
      _circleFeatures.push({
        type: 'Feature',
        id: Number(md.post_map_card_id) || 0, // stable numeric ID for setFeatureState
        geometry: { type: 'Point', coordinates: [md.lng, md.lat] },
        properties: (function() {
          var _col = md.subcategory_color || '#888888';
          var _hx  = _col.replace('#', '');
          var _dr  = Math.round(parseInt(_hx.substring(0,2), 16) * 0.45);
          var _dg  = Math.round(parseInt(_hx.substring(2,4), 16) * 0.45);
          var _db  = Math.round(parseInt(_hx.substring(4,6), 16) * 0.45);
          var _dark = 'rgb(' + _dr + ',' + _dg + ',' + _db + ')';
          return {
            locationKey:   locationKey,
            color:         _col,
            darkColor:     _dark,
            postId:        String(md.id),
            postMapCardId: String(md.post_map_card_id || ''),
            count:         md.isMultiPost ? (md.locationPostCount || 1) : 1
          };
        })()
      });
      _circleDataByKey[locationKey] = md;
    });

    if (mapModule.updateNativeCircleLayer) {
      mapModule.updateNativeCircleLayer(_circleFeatures, _circleDataByKey);
    }
    // ─────────────────────────────────────────────────────────────────────

    // Remove markers that are no longer needed (including those that switched to dots/icons)
    if (mapModule.removeMapCardMarker) {
      // IMPORTANT: removals must be based on what markers actually exist on the map,
      // not only on PostModule's lastRenderedLocationMarkerSigByKey (which can drift after refresh/rebuilds).
      var existingKeys = [];
      try {
        if (typeof mapModule.getMapCardMarkerLocationKeys === 'function') {
          existingKeys = mapModule.getMapCardMarkerLocationKeys() || [];
        } else {
          existingKeys = Object.keys(lastRenderedLocationMarkerSigByKey || {});
        }
      } catch (_eKeys) {
        existingKeys = Object.keys(lastRenderedLocationMarkerSigByKey || {});
      }

      existingKeys.forEach(function(locationKey) {
        if (!nextSigByKey[locationKey]) mapModule.removeMapCardMarker(locationKey);
      });
    }

    // Create/update markers that are new or changed
    Object.keys(nextMarkerDataByKey).forEach(function(locationKey) {
      var markerData = nextMarkerDataByKey[locationKey];
      var nextSig = nextSigByKey[locationKey];
      var prevSig = lastRenderedLocationMarkerSigByKey ? lastRenderedLocationMarkerSigByKey[locationKey] : null;

      if (prevSig && prevSig === nextSig) {
        return; // keep existing marker as-is
      }

      // Changed: remove old DOM marker then recreate if still a DOM marker type.
      if (prevSig && mapModule.removeMapCardMarker) {
        mapModule.removeMapCardMarker(locationKey);
      }

      // ── NATIVE CIRCLES: skip DOM creation for single-post icon/dot markers ──
      // [RESTORE] To revert to DOM icon/dot markers, remove the isNativeCircle guard
      // below and uncomment the original createMapCardMarker call.
      //
      // ORIGINAL (DOM icon/dot — commented out):
      // if (mapModule.createMapCardMarker) {
      //   mapModule.createMapCardMarker(markerData, markerData.lng, markerData.lat, markerData.markerAppearance, markerData.dotColor);
      // }
      //
      // NATIVE (active when USE_NATIVE_CIRCLES = true):
      var _isNativeCircle = USE_NATIVE_CIRCLES
                            && (markerData.markerAppearance === 'icon' || markerData.markerAppearance === 'dot')
                            && !markerData.isMultiPost && !markerData.isStorefront;
      if (!_isNativeCircle && markerData.markerAppearance !== 'hidden' && mapModule.createMapCardMarker) {
        mapModule.createMapCardMarker(markerData, markerData.lng, markerData.lat, markerData.markerAppearance, markerData.dotColor);
      }
      // ─────────────────────────────────────────────────────────────────────
    });

    lastRenderedLocationMarkerSigByKey = nextSigByKey;
    
    // Preserve the active (big) state for the currently open post (if any).
    // Markers may have been updated above, so we re-apply the association here.
    restoreActiveMapCardFromOpenPost();

    // Refresh multipost modal if open (post list DOM is fully updated at this point)
    if (_multipostModalEl) {
      _refreshMultipostModal();
    }
  }

  function getOpenPostIdFromDom() {
    try {
      var openEl = document.querySelector('.post[data-id]');
      if (!openEl) return null;
      var id = openEl.getAttribute('data-id');
      return id ? id : null;
    } catch (_e) {
      return null;
    }
  }

  function restoreActiveMapCardFromOpenPost() {
    var openEl = null;
    try { openEl = document.querySelector('.post[data-id]'); } catch (_eEl) { openEl = null; }
    if (!openEl) return;
    var postId = openEl.getAttribute('data-id');
    if (!postId) return;
    var postMapCardId = '';
    try { postMapCardId = openEl.getAttribute('data-post-map-card-id') || ''; } catch (_ePmc) { postMapCardId = ''; }
    highlightMapMarker(postId, postMapCardId);
  }

  /**
   * Highlight a post's marker on the map
   * @param {number|string} postId - Post ID
   */
  function highlightMapMarker(postId, postMapCardId) {
    if (!window.MapModule) return;
    var pid = String(postId || '');
    var pmc = String(postMapCardId || '');
    if (!pid) return;
    if (pmc && typeof MapModule.setActiveMapCardByPostMapCardId === 'function') {
      try {
        var ok = MapModule.setActiveMapCardByPostMapCardId(pid, pmc);
        if (ok) {
          if (typeof MapModule.lockMultiPostThumbByPostId === 'function') {
            MapModule.lockMultiPostThumbByPostId(pid);
          }
          return;
        }
      } catch (_eSetByPmc) {}
    }
    if (typeof MapModule.setActiveMapCard === 'function') {
      MapModule.setActiveMapCard(pid);
    }
    if (typeof MapModule.lockMultiPostThumbByPostId === 'function') {
      MapModule.lockMultiPostThumbByPostId(pid);
    }
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
  var _groundBubblesActive = false;

  // Bounds captured at fetch time — used by renderMapMarkers to filter map cards consistently.
  // Must match the bounds sent to the server, not the live viewport at render time.
  var _lastFetchBounds = null;

  // Last posts array passed to renderMapMarkers — used to re-run marker promotion when a post opens.
  var _lastRenderedPosts = null;

  /* --------------------------------------------------------------------------
     MULTIPOST MODAL
     -------------------------------------------------------------------------- */

  /**
   * Lock the map marker thumbnail to the selected post's image.
   * Called just before the multipost modal closes so the marker shows the chosen post.
   */
  function _lockMultiPostThumbForPost(data, post) {
    if (!window.MapModule || typeof MapModule.lockMultiPostThumbForPostId !== 'function') return;
    var locationKey = (data && data.locationKey) ? data.locationKey : _multipostModalLocationKey;
    if (!locationKey) return;
    MapModule.lockMultiPostThumbForPostId(locationKey, String(post.id));
  }

  /**
   * Open the multipost modal over the post panel, showing all posts at a multi-post location.
   * @param {Object} data - map:cardClicked event data (isMultiPost, postIds, venue, suburb, city, state)
   */
  function openMultipostModal(data) {
    if (!postPanelContentEl || !postListEl) return;

    var postIds = (data.postIds || []).map(String);
    if (!postIds.length) return;

    // If not in posts mode, open posts panel first, then re-invoke
    if (currentMode !== 'posts') {
      var postsBtn = getModeButton('posts');
      if (postsBtn && postsEnabled) {
        postsBtn.click();
        setTimeout(function() { openMultipostModal(data); }, 100);
        return;
      }
    }

    // Collect matching posts from the in-memory sorted array (_virtPosts respects current sort + filters)
    var orderedPosts = [];
    (_virtPosts || []).forEach(function(post) {
      if (postIds.indexOf(String(post.id)) !== -1) orderedPosts.push(post);
    });

    closeMultipostModal({ skipClearMapCards: true }); // Remove any existing modal (keep marker active)
    _multipostModalPostIds = postIds; // Store for filter-driven refresh
    _multipostModalLocationKey = data.locationKey || '';

    // Build header strings
    var locationName = data.venue || '';
    var locationStr = '';
    if (data.suburb && data.city) {
      locationStr = data.suburb + ', ' + data.city;
    } else {
      locationStr = data.suburb || data.city || data.state || '';
    }
    if (!locationName) locationName = locationStr || 'Multiple Events';

    var filteredCount = orderedPosts.length;
    var totalCount    = postIds.length;
    var countStr = filteredCount + ' result' + (filteredCount !== 1 ? 's' : '') + ' showing of ' + totalCount + ' at this location';

    // Build overlay (covers full panel content, dims background)
    var overlay = document.createElement('div');
    overlay.className = 'multipost-modal-overlay';

    // Build modal container (positioned within overlay by JS)
    var modal = document.createElement('div');
    modal.className = 'multipost-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', locationName);

    // Position: 20px from top; max-height caps at 20px from bottom; shrinks to fit if content is shorter
    modal.style.top       = '20px';
    modal.style.maxHeight = 'calc(100% - 40px)';

    // ── Header ──
    var header = document.createElement('div');
    header.className = 'multipost-modal-header';

    var headerTop = document.createElement('div');
    headerTop.className = 'multipost-modal-header-top';

    var headerMeta = document.createElement('div');
    headerMeta.className = 'multipost-modal-header-meta';

    var nameEl = document.createElement('div');
    nameEl.className = 'multipost-modal-header-name';
    nameEl.textContent = locationName;
    headerMeta.appendChild(nameEl);

    if (locationStr) {
      var locEl = document.createElement('div');
      locEl.className = 'multipost-modal-header-location';
      locEl.textContent = locationStr;
      headerMeta.appendChild(locEl);
    }

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'multipost-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    var closeIcon = document.createElement('span');
    closeIcon.className = 'multipost-modal-close-icon';
    closeIcon.setAttribute('aria-hidden', 'true');
    closeBtn.appendChild(closeIcon);

    headerTop.appendChild(headerMeta);
    headerTop.appendChild(closeBtn);
    header.appendChild(headerTop);

    var countEl = document.createElement('div');
    countEl.className = 'multipost-modal-header-count';
    countEl.textContent = countStr;
    header.appendChild(countEl);

    // ── Body (post cards) ──
    var body = document.createElement('div');
    body.className = 'multipost-modal-body';

    _buildMultipostModalBody(body, orderedPosts);

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    postPanelContentEl.appendChild(overlay);
    _multipostModalEl = overlay;

    // Start thumbnail cycling on the map marker now that the modal is showing
    if (window.MapModule && typeof MapModule.startMultiPostCycleByLocationKey === 'function' && data.locationKey) {
      MapModule.startMultiPostCycleByLocationKey(data.locationKey);
    }

    // ── Close behaviors ──
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      closeMultipostModal();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeMultipostModal();
    });

    _multipostModalKeydownHandler = function(e) {
      if (e.key === 'Escape') closeMultipostModal();
    };
    document.addEventListener('keydown', _multipostModalKeydownHandler);
  }

  /**
   * Close and remove the multipost modal (if open).
   */
  function closeMultipostModal(options) {
    var wasOpen = !!_multipostModalEl;
    if (_multipostScrollListener && _multipostBodyEl) {
      _multipostBodyEl.removeEventListener('scroll', _multipostScrollListener);
      _multipostScrollListener = null;
    }
    if (_multipostSettleTimer) {
      clearTimeout(_multipostSettleTimer);
      _multipostSettleTimer = null;
    }
    _multipostBodyEl = null;
    _multipostAboveEl = null;
    _multipostBelowEl = null;
    _multipostVirtPosts = [];
    _multipostVirtStart = 0;
    _multipostScrollTicking = false;
    if (_multipostModalEl) {
      if (_multipostModalEl.parentNode) {
        _multipostModalEl.parentNode.removeChild(_multipostModalEl);
      }
      _multipostModalEl = null;
    }
    if (_multipostModalKeydownHandler) {
      document.removeEventListener('keydown', _multipostModalKeydownHandler);
      _multipostModalKeydownHandler = null;
    }
    _multipostModalPostIds = null;
    _multipostModalLocationKey = null;
    var skipClear = options && options.skipClearMapCards;
    if (wasOpen && !skipClear && window.MapModule && typeof MapModule.clearActiveMapCards === 'function') {
      MapModule.clearActiveMapCards();
    }
  }

  /**
   * Refresh the multipost modal body to reflect the current filter state.
   * Called from renderMapMarkers after each new post render cycle.
   */
  function _refreshMultipostModal() {
    if (!_multipostModalEl || !_multipostModalPostIds || !postListEl) return;

    // Collect posts at this location from the in-memory sorted array (_virtPosts respects active sort + filters)
    var orderedPosts = [];
    (_virtPosts || []).forEach(function(post) {
      if (_multipostModalPostIds.indexOf(String(post.id)) !== -1) orderedPosts.push(post);
    });

    // Rebuild body
    var body = _multipostModalEl.querySelector('.multipost-modal-body');
    if (!body) return;
    body.innerHTML = '';

    _buildMultipostModalBody(body, orderedPosts);

    // Update the result count in the header
    var countEl = _multipostModalEl.querySelector('.multipost-modal-header-count');
    if (countEl) {
      var filteredCount = orderedPosts.length;
      var totalCount = _multipostModalPostIds.length;
      countEl.textContent = filteredCount + ' result' + (filteredCount !== 1 ? 's' : '') + ' showing of ' + totalCount + ' at this location';
    }
  }

  /**
   * Build (or rebuild) the multipost modal body with virtualised scrolling.
   * Uses the same ghost-card technique as the main post list.
   * @param {HTMLElement} body - The .multipost-modal-body scroll container
   * @param {Array} orderedPosts - Posts to display (already filtered/sorted)
   */
  function _buildMultipostModalBody(body, orderedPosts) {
    if (_multipostScrollListener && _multipostBodyEl) {
      _multipostBodyEl.removeEventListener('scroll', _multipostScrollListener);
      _multipostScrollListener = null;
    }
    if (_multipostSettleTimer) {
      clearTimeout(_multipostSettleTimer);
      _multipostSettleTimer = null;
    }

    _multipostBodyEl = body;
    _multipostVirtPosts = orderedPosts;
    _multipostVirtStart = 0;
    _multipostScrollTicking = false;
    body.innerHTML = '';

    if (!orderedPosts.length) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'multipost-modal-empty';
      emptyEl.textContent = 'No results match current filters.';
      body.appendChild(emptyEl);
      return;
    }

    var total = orderedPosts.length;
    var wEnd = Math.min(_VIRT_WINDOW, total);

    var aboveEl = document.createElement('div');
    aboveEl.className = 'multipost-modal-virt-above';
    body.appendChild(aboveEl);
    _multipostAboveEl = aboveEl;

    for (var i = 0; i < wEnd; i++) {
      body.appendChild(_buildMultipostCard(orderedPosts[i]));
    }

    var belowEl = document.createElement('div');
    belowEl.className = 'multipost-modal-virt-below';
    var belowCount = total - wEnd;
    if (belowCount > 0) {
      belowEl.appendChild(BackdropComponent.createFragment(belowCount));
    }
    body.appendChild(belowEl);
    _multipostBelowEl = belowEl;

    if (total > _VIRT_WINDOW) {
      _multipostScrollListener = function() { _multipostOnScroll(); };
      body.addEventListener('scroll', _multipostScrollListener);
    }
  }

  /**
   * Build a single postcard element for the multipost modal with its event handlers.
   */
  function _buildMultipostCard(post) {
    var card = renderPostCard(post, { skipDefaultOpenHandlers: true });
    var _postMapCardId = (card.dataset && card.dataset.postMapCardId) ? String(card.dataset.postMapCardId) : '';
    card.addEventListener('click', function(e) {
      if (e.target.closest && e.target.closest('.post-card-button-fav')) return;
      _lockMultiPostThumbForPost(null, post);
      closeMultipostModal({ skipClearMapCards: true });
      openPostById(post.id, { fromMap: true, postMapCardId: _postMapCardId });
    });
    card.addEventListener('keydown', function(e) {
      var k = String(e.key || '');
      if (k !== 'Enter' && k !== ' ' && k !== 'Spacebar') return;
      if (e.target && e.target.closest && e.target.closest('.post-card-button-fav')) return;
      e.preventDefault();
      _lockMultiPostThumbForPost(null, post);
      closeMultipostModal({ skipClearMapCards: true });
      openPostById(post.id, { fromMap: true, postMapCardId: _postMapCardId });
    });
    return card;
  }

  /**
   * Shift the modal virtual window to a new start index.
   */
  function _multipostShiftWindow(newStart) {
    if (!_multipostBodyEl || !_multipostVirtPosts.length) return;
    var total = _multipostVirtPosts.length;
    var clampedStart = Math.max(0, Math.min(newStart, Math.max(0, total - _VIRT_WINDOW)));
    if (clampedStart === _multipostVirtStart) return;

    var wEnd = Math.min(clampedStart + _VIRT_WINDOW, total);

    if (_multipostAboveEl) {
      _multipostAboveEl.innerHTML = '';
      if (clampedStart > 0) {
        _multipostAboveEl.appendChild(BackdropComponent.createFragment(clampedStart));
      }
    }

    var child = _multipostAboveEl ? _multipostAboveEl.nextSibling : _multipostBodyEl.firstChild;
    while (child && child !== _multipostBelowEl) {
      var nextSib = child.nextSibling;
      _multipostBodyEl.removeChild(child);
      child = nextSib;
    }

    var frag = document.createDocumentFragment();
    for (var i = clampedStart; i < wEnd; i++) {
      frag.appendChild(_buildMultipostCard(_multipostVirtPosts[i]));
    }
    _multipostBodyEl.insertBefore(frag, _multipostBelowEl);

    if (_multipostBelowEl) {
      _multipostBelowEl.innerHTML = '';
      var belowCount = total - wEnd;
      if (belowCount > 0) {
        _multipostBelowEl.appendChild(BackdropComponent.createFragment(belowCount));
      }
    }

    _multipostVirtStart = clampedStart;
  }

  function _multipostOnScroll() {
    if (_multipostScrollTicking) return;
    _multipostScrollTicking = true;
    requestAnimationFrame(function() {
      _multipostScrollTicking = false;
      _multipostCheckScrollBoundary();
    });
  }

  function _multipostCheckScrollBoundary() {
    if (!_multipostBodyEl || _multipostVirtPosts.length <= _VIRT_WINDOW) return;
    var GHOST_HEIGHT = 127;
    var scrollTop = _multipostBodyEl.scrollTop;
    var clientHeight = _multipostBodyEl.clientHeight;
    var aboveHeight = _multipostVirtStart * GHOST_HEIGHT;
    var scrolledIntoWindow = scrollTop - aboveHeight;
    var windowHeight = _VIRT_WINDOW * GHOST_HEIGHT;
    var TRIGGER = Math.floor(_VIRT_WINDOW * 0.25) * GHOST_HEIGHT;

    if (scrolledIntoWindow > windowHeight - clientHeight - TRIGGER) {
      _multipostShiftWindow(_multipostVirtStart + Math.floor(_VIRT_WINDOW * 0.25));
    } else if (scrolledIntoWindow < TRIGGER) {
      _multipostShiftWindow(_multipostVirtStart - Math.floor(_VIRT_WINDOW * 0.25));
    }

    if (_multipostSettleTimer) clearTimeout(_multipostSettleTimer);
    _multipostSettleTimer = setTimeout(function() {
      _multipostSettleTimer = null;
      _multipostSettle();
    }, 150);
  }

  function _multipostSettle() {
    if (!_multipostBodyEl || _multipostVirtPosts.length <= _VIRT_WINDOW) return;
    var GHOST_HEIGHT = 127;
    var scrollTop = _multipostBodyEl.scrollTop;
    var idealStart = Math.floor(scrollTop / GHOST_HEIGHT);
    var centeredStart = Math.max(0, idealStart - Math.floor(_VIRT_WINDOW * 0.5));
    _multipostShiftWindow(centeredStart);
  }

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
    // Build individual map card entries for premium posts (sidebar_ad === 1)
    // that are within the visible map area.
    // Each entry is { post, mapCard } so the marquee can display specific location info.
    var bounds = getMapBounds();
    var marqueeMapCards = [];
    list.forEach(function(p) {
      if (p.sidebar_ad !== 1) return;
      if (!p.map_cards || !p.map_cards.length) return;
      p.map_cards.forEach(function(mc) {
        if (!mc || !Number.isFinite(mc.latitude) || !Number.isFinite(mc.longitude)) return;
        // Only include map cards visible in the current map viewport
        if (!pointWithinBounds(mc.longitude, mc.latitude, bounds)) return;
        marqueeMapCards.push({ post: p, mapCard: mc });
      });
    });

    // Interleave entries so the same post's map cards are spread apart.
    // Group by post ID, then round-robin across groups.
    var groupsByPost = {};
    var postOrder = [];
    marqueeMapCards.forEach(function(entry) {
      var pid = entry.post.id;
      if (!groupsByPost[pid]) {
        groupsByPost[pid] = [];
        postOrder.push(pid);
      }
      groupsByPost[pid].push(entry);
    });
    var interleaved = [];
    var maxRounds = 0;
    postOrder.forEach(function(pid) {
      if (groupsByPost[pid].length > maxRounds) maxRounds = groupsByPost[pid].length;
    });
    for (var round = 0; round < maxRounds; round++) {
      for (var g = 0; g < postOrder.length; g++) {
        var group = groupsByPost[postOrder[g]];
        if (round < group.length) {
          interleaved.push(group[round]);
        }
      }
    }

    // Limit to max map card slots
    var maxCards = (window.App && typeof App.getConfig === 'function') ? App.getConfig('maxMapCards') : 50;
    interleaved = interleaved.slice(0, maxCards);

    App.emit('filter:applied', {
      marqueeMapCards: interleaved
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
      _lastFetchBounds = b || null;
      var boundsParam = b ? boundsToApiParam(b) : '';
      // Live-site behavior: keep current cards/markers visible while the server recalculates,
      // then swap to the new results when they arrive (avoids flashing).
      loadPosts({ bounds: boundsParam, offset: 0, filters: filterState || {} }).then(function(posts) {
        // Server returned filtered posts; renderMapMarkers is called by loadPosts->renderPostList path.
        // Keep active state synced if open post still exists.
        emitFilterCounts(posts);
        restoreActiveMapCardFromOpenPost();
      });
      return;
    }

    // Below threshold: no posts list should be shown; purge everything.
    if (window.MapModule) {
      if (typeof MapModule.clearAllMapCardMarkers === 'function') {
        MapModule.clearAllMapCardMarkers();
      }
    }
    lastRenderedLocationMarkerSigByKey = {};
    renderPostList([]); // Clear UI panel
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

    // Get current map bounds for viewport filtering (only at or above postsLoadZoom)
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

      return true;
    });
  }

  /**
   * Sort posts by the given sort key
   * @param {string} sortKey - Sort key (az, za, newest, oldest, price-low, price-high)
   */
  function sortPosts(sortKey, userGeoLocation) {
    if (!postListEl || !_virtPosts || !_virtPosts.length) return;

    var nearestOrigin = userGeoLocation || null;
    function distToUser(meta) {
      if (!nearestOrigin || meta.sortLng === null || meta.sortLat === null) return Number.POSITIVE_INFINITY;
      return distKm({ lng: meta.sortLng, lat: meta.sortLat }, { lng: nearestOrigin.lng, lat: nearestOrigin.lat });
    }

    _virtPosts.sort(function(postA, postB) {
      var idA = String(postA.id);
      var idB = String(postB.id);
      var a = _virtPostsMeta[idA] || {};
      var b = _virtPostsMeta[idB] || {};

      // Live-site behavior: "Favourites on top" only applies when not dirty.
      // Storefronts: check if ANY post in the group is favourited.
      if (favToTop && !favSortDirty) {
        var sfGroupA = _sfGroupsByPostId[idA];
        var sfGroupB = _sfGroupsByPostId[idB];
        var favA = sfGroupA && sfGroupA.length >= 2
          ? sfGroupA.some(function(p) { return isFavorite(p.id); })
          : isFavorite(idA);
        var favB = sfGroupB && sfGroupB.length >= 2
          ? sfGroupB.some(function(p) { return isFavorite(p.id); })
          : isFavorite(idB);
        if (favA !== favB) return (favB ? 1 : 0) - (favA ? 1 : 0);
      }

      switch (sortKey) {
        case 'recommended':
          var orderDiff = (b.sortCheckoutOrder || 0) - (a.sortCheckoutOrder || 0);
          if (orderDiff !== 0) return orderDiff;
          return (b.sortCreatedAt || 0) - (a.sortCreatedAt || 0);
        case 'az':
          return String(a.sortTitle || '').localeCompare(String(b.sortTitle || ''));
        case 'za':
          return String(b.sortTitle || '').localeCompare(String(a.sortTitle || ''));
        case 'newest':
          return (b.sortCreatedAt || 0) - (a.sortCreatedAt || 0);
        case 'oldest':
          return (a.sortCreatedAt || 0) - (b.sortCreatedAt || 0);
        case 'price-low':
          return (a.sortPrice || 0) - (b.sortPrice || 0);
        case 'price-high':
          return (b.sortPrice || 0) - (a.sortPrice || 0);
        case 'nearest':
          return distToUser(a) - distToUser(b);
        case 'soon':
          var tsA = (a.sortSoonTs !== undefined && a.sortSoonTs !== null) ? a.sortSoonTs : Infinity;
          var tsB = (b.sortSoonTs !== undefined && b.sortSoonTs !== null) ? b.sortSoonTs : Infinity;
          return tsA - tsB;
        default:
          return 0;
      }
    });

    // Recompute storefront leads since sort order changed
    _virtComputeEffectiveLeads();

    // Re-render window from top in new sort order (scroll resets to top on manual sort change).
    // _virtDirty forces _virtShiftWindow to rebuild even when newStart === _virtStart === 0.
    _virtDirty = true;
    postListEl.scrollTop = 0;
    _virtShiftWindow(0, { noScrollCorrect: true });

    if (sortKey === 'soon') {
      postListEl.classList.add('post-list--sortsoon');
    } else {
      postListEl.classList.remove('post-list--sortsoon');
    }
  }

  /**
   * Build a countdown status bar element for event posts.
   * Uses first_session_date (mapCard) as start and expires_at (post) as end.
   * @param {Object} post - Post data (needs expires_at)
   * @param {Object} mapCard - Map card data (needs first_session_date)
   * @returns {{ bar: HTMLElement, state: string }|null}
   */
  function buildCountdownStatusBar(post, mapCard) {
    var firstSessionDate = mapCard && mapCard.first_session_date;
    var expiresAt = post && post.expires_at;
    if (!firstSessionDate || !expiresAt) return null;

    var now = new Date();
    var startDate = new Date(firstSessionDate);
    var endDate = new Date(expiresAt);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

    var twentyFourHoursBefore = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    var state, label;
    if (now < twentyFourHoursBefore) {
      state = 'comingsoon';
      label = 'Coming Soon';
    } else if (now <= endDate) {
      state = 'nowshowing';
      label = 'Now Showing';
    } else {
      state = 'finished';
      label = 'Event Ended';
    }

    var bar = document.createElement('div');
    bar.className = 'post-statusbar post-statusbar--' + state;
    bar.textContent = label;
    return { bar: bar, state: state };
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
  /**
   * Parse a pre-formatted price summary string.
   * Expected format: "[cc] $10.00" where cc is the currency flag code.
   * Throws error if format is invalid.
   * @param {string} priceSummary 
   * @returns {Object} { flagUrl, countryCode, text }
   */
  function parsePriceSummary(priceSummary) {
    var raw = (priceSummary === null || priceSummary === undefined) ? '' : String(priceSummary).trim();
    if (!raw) return { flagUrl: '', countryCode: '', text: '' };

    var countryCode = '';
    var displayText = raw;

    // Detect [cc] pattern (e.g., "[us] $10.00")
    var match = raw.match(/^\[([a-z0-9_-]+)\]\s*(.*)$/i);
    if (match) {
      countryCode = match[1].toLowerCase();
      displayText = match[2].trim();
    } else {
      // Agent Essentials: NO FALLBACKS. Legacy formats are ignored.
      // If no [cc] prefix, we treat the whole string as text without a flag.
    }

    var flagUrl = '';
    if (countryCode && window.App && typeof App.getImageUrl === 'function') {
      flagUrl = App.getImageUrl('currencies', countryCode + '.svg');
    }

    return { flagUrl: flagUrl, countryCode: countryCode, text: displayText };
  }
  
  /**
   * Check if a mapCard has any promo pricing available.
   * Checks both ticket pricing (pricing_groups) and item pricing (promo_option field).
   * @param {Object} mapCard - The map card object
   * @returns {boolean} True if any promo exists
   */
  function mapCardHasPromo(mapCard) {
    if (!mapCard) return false;
    
    // Check lightweight flag from API (available without full=1)
    if (mapCard.has_promo) return true;
    
    // Check ticket pricing (pricing_groups)
    var pricingGroups = mapCard.pricing_groups;
    if (pricingGroups && typeof pricingGroups === 'object') {
      var groupKeys = Object.keys(pricingGroups);
      for (var i = 0; i < groupKeys.length; i++) {
        var areas = pricingGroups[groupKeys[i]];
        if (!areas || typeof areas !== 'object') continue;
        var areaKeys = Object.keys(areas);
        for (var j = 0; j < areaKeys.length; j++) {
          var area = areas[areaKeys[j]];
          if (!area || !area.tiers) continue;
          for (var k = 0; k < area.tiers.length; k++) {
            var tier = area.tiers[k];
            if (tier && tier.promo_option && tier.promo_option !== 'none') {
              return true;
            }
          }
        }
      }
    }
    
    // Check item pricing (promo_option field directly on mapCard)
    if (mapCard.promo_option && mapCard.promo_option !== 'none') {
      return true;
    }
    
    return false;
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

  function getMapCardSoonestTimestamp(mapCard) {
    if (!mapCard || typeof mapCard !== 'object') return Number.POSITIVE_INFINITY;
    var best = Number.POSITIVE_INFINITY;
    var sessions = Array.isArray(mapCard.sessions) ? mapCard.sessions : [];
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s) continue;
      var dt = null;
      var dateStr = s.date || s.session_date || '';
      var timeStr = s.time || s.session_time || '';
      if (dateStr) {
        dt = new Date(String(dateStr) + (timeStr ? ('T' + String(timeStr)) : 'T00:00:00'));
      }
      var t = dt ? dt.getTime() : NaN;
      if (Number.isFinite(t) && t < best) best = t;
    }
    if (best !== Number.POSITIVE_INFINITY) return best;
    // Lightweight get-posts payload often provides first_session_date without full sessions.
    if (mapCard.first_session_date) {
      var first = new Date(String(mapCard.first_session_date));
      var firstTs = first.getTime();
      if (Number.isFinite(firstTs)) return firstTs;
    }
    return Number.POSITIVE_INFINITY;
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
    sortPosts(currentSortKey || 'recommended', currentSortGeoLocation);
  }

  /**
   * Render filtered posts (used after sort)
   */
  function renderFilteredPosts() {
    // No-op: legacy hook. Sorting now operates on _virtPosts in-memory array.
  }

  /* --------------------------------------------------------------------------
     POST - Post Detail View
     --------------------------------------------------------------------------
     When a post card is clicked, it expands to show the full post details.
     Structure: .post > .post-header + .post-body
     States: --collapsed, --expanded
     
     Contains sub-sections that are COMPONENT PLACEHOLDERS:
     - Image Gallery (hero + thumbnails)
     -------------------------------------------------------------------------- */

  /**
   * Open a post (show detail view)
   * @param {Object} post - Post data
   * @param {Object} options - { fromRecent: boolean, originEl: HTMLElement, postMapCardId: string }
   */
  function openPost(post, options) {
    applyPostInteractionSettings();
    options = options || {};
    var fromRecent = options.fromRecent || false;
    var originEl = options.originEl || null;
    var postMapCardId = options.postMapCardId;
    var autoExpand = !!options.autoExpand;

    // If post is not in the current DOM window, shift the window to bring it into view.
    // This handles map marker clicks, marquee clicks, and deeplinks where the target
    // card may be outside the currently rendered ~50 cards.
    if (!fromRecent && post && post.id !== undefined && postListEl && _virtPosts && _virtPosts.length > _VIRT_WINDOW) {
      var _openPostInDom = postListEl.querySelector('[data-id="' + post.id + '"]');
      if (!_openPostInDom) {
        var _openPostIdx = -1;
        for (var _opi2 = 0; _opi2 < _virtPosts.length; _opi2++) {
          if (String(_virtPosts[_opi2].id) === String(post.id)) { _openPostIdx = _opi2; break; }
        }
        if (_openPostIdx >= 0) {
          var _openTargetStart = Math.max(0, _openPostIdx - 10);
          _virtShiftWindow(_openTargetStart);
          // Scroll to bring the post into view
          var _openCardEl = postListEl.querySelector('[data-id="' + post.id + '"]');
          if (_openCardEl) {
            try {
              var _openCardOuter = _openCardEl.closest('.post-outer-container') || _openCardEl;
              var _openListRect = postListEl.getBoundingClientRect();
              var _openCardRect = _openCardOuter.getBoundingClientRect();
              postListEl.scrollTop += (_openCardRect.top - _openListRect.top) - 60;
            } catch (_eScroll) {}
          }
        }
      }
    }

    if (!postMapCardId) {
      // Source of truth: MapModule active map card selection (no DOM scraping, no heuristics).
      try {
        if (window.MapModule && typeof MapModule.getActivePostMapCardId === 'function') {
          var inferred = MapModule.getActivePostMapCardId(post && post.id !== undefined && post.id !== null ? post.id : '');
          if (inferred) postMapCardId = inferred;
        }
      } catch (_eInfer) {}
    }

    // Find the map card index from post_map_card_id
    var mapCardIndex = 0;
    if (postMapCardId && post.map_cards) {
      for (var i = 0; i < post.map_cards.length; i++) {
        if (String(post.map_cards[i].id) === String(postMapCardId)) {
          mapCardIndex = i;
          break;
        }
      }
    }

    // Add to recent history
    addToRecentHistory(post, mapCardIndex);

    // Determine container
    var container = fromRecent ? recentPanelContentEl : postListEl;
    // When originEl is outside the standard panels (e.g. Post Editor tab), use its list ancestor.
    // Must be the full list container (parent of .posteditor-outer-container) so closeOpenPost()
    // can find any currently-open post — not just the one inside the clicked card's outer container.
    if (originEl && (!container || !container.contains(originEl))) {
      var posteditorItem = originEl.closest('.posteditor-main-container');
      if (posteditorItem && posteditorItem.parentElement && posteditorItem.parentElement.parentElement) {
        container = posteditorItem.parentElement.parentElement;
      } else if (posteditorItem && posteditorItem.parentElement) {
        container = posteditorItem.parentElement;
      }
    }
    if (!container) return;
    var isMobileViewport = window.innerWidth <= 530;
    var shouldScrollToOpenHeaderTop = (!isMobileViewport && !fromRecent && !originEl && (container === postListEl) && (!!options.fromMap || options.source === 'marquee'));

    // ── OPEN ANIMATION: PRE-CAPTURE ──────────────────────────────────────────────
    // Must run before closeOpenPost() shifts the layout.
    // Captures the card's rect, background, and a hovered-state clone for later use.
    // Clone is stored on the slot and consumed by the close animation (card enter).
    // Master switch: _POST_ANIMATE — set false to disable all open/close animation.
    var _preCloseExitRect = null;
    var _preCloseCardBg = null;
    if (originEl) {
      var _preCloseSlot = originEl.closest('.post-main-container') || originEl.closest('.recent-main-container') || originEl.closest('.posteditor-main-container');
      if (_preCloseSlot) {
        var _preCloseCard = _preCloseSlot.querySelector('.post-card, .recent-card');
        if (_preCloseCard) {
          _preCloseExitRect = _preCloseCard.getBoundingClientRect();
          // Force hover state before capture so --subcat-hover-bg is active in computed style.
          // Skip for storefront slots — their wallpaper handles the visual; forcing the highlight
          // class captures the subcategory color and bakes it over the wallpaper image.
          var _preCloseIsRecent = _preCloseCard.classList.contains('recent-card');
          var _preCloseIsSf = !!_preCloseSlot.dataset.sfIds;
          if (_preCloseIsRecent) _preCloseCard.classList.add('recent-card--active');
          else if (!_preCloseIsSf) _preCloseCard.classList.add('post-card--map-highlight');
          _preCloseCardBg = window.getComputedStyle(_preCloseCard).backgroundColor;
          if (_preCloseIsRecent) _preCloseCard.classList.remove('recent-card--active');
          else if (!_preCloseIsSf) _preCloseCard.classList.remove('post-card--map-highlight');
          _preCloseSlot.__cardBg = _preCloseCardBg;
          // Clone while card is fully visible and hovered — reused as-is for close enter animation
          if (_preCloseIsRecent) _preCloseCard.classList.add('recent-card--active');
          else if (!_preCloseIsSf) _preCloseCard.classList.add('post-card--map-highlight');
          var _storedClone = _preCloseCard.cloneNode(true);
          if (_preCloseIsRecent) _preCloseCard.classList.remove('recent-card--active');
          else if (!_preCloseIsSf) _preCloseCard.classList.remove('post-card--map-highlight');
          _storedClone.style.display = '';
          _storedClone.style.margin = '0';
          _storedClone.style.transition = 'none';
          var _scEls = _storedClone.querySelectorAll('*');
          for (var _sci = 0; _sci < _scEls.length; _sci++) { _scEls[_sci].style.transition = 'none'; }
          if (_preCloseCardBg && _preCloseCardBg !== 'rgba(0, 0, 0, 0)' && _preCloseCardBg !== 'transparent') {
            _storedClone.style.backgroundColor = _preCloseCardBg;
          }
          _preCloseSlot.__cardEnterClone = _storedClone;
        }
      }
    }
    // ── END OPEN ANIMATION: PRE-CAPTURE ──────────────────────────────────────────

    // Close any existing open post in this container
    closeOpenPost(container);

    // Find the slot wrapper that holds the clicked card.
    // Post panel: .post-main-container | Recent panel: .recent-main-container | Post Editor: .posteditor-main-container
    var slot = null;
    if (originEl) {
      slot = originEl.closest('.post-main-container') || originEl.closest('.recent-main-container') || originEl.closest('.posteditor-main-container');
    }
    if (!slot) {
      // Fallback: find slot by post ID in the container
      var cardInContainer = container.querySelector('[data-id="' + post.id + '"]');
      if (cardInContainer) {
        slot = cardInContainer.closest('.post-main-container') || cardInContainer.closest('.recent-main-container') || cardInContainer.closest('.posteditor-main-container');
      }
    }

    // Build the detail view with a fresh card (original stays hidden in the slot).
    var _sfOnFirstLoadRef = { fn: null };
    var detail = buildPostDetail(post, null, fromRecent, mapCardIndex, options.storefrontPosts, options.sfOpenPostId, _sfOnFirstLoadRef);

    if (slot) {
      // Expand in place: hide only the card, insert detail at the card's position.
      // The slot stays in the DOM — TopSlack anchor remains connected.
      // If open-post countdown is enabled, hide the slot countdown bar to avoid duplicates.
      var cardToHide = slot.querySelector('.post-card, .recent-card');
      var cardStatusBar = null;
      var _slotOuter = (slot.parentElement && (slot.parentElement.classList.contains('post-outer-container') || slot.parentElement.classList.contains('recent-outer-container') || slot.parentElement.classList.contains('posteditor-outer-container'))) ? slot.parentElement : slot;
      cardStatusBar = _slotOuter.querySelector('.post-statusbar--slot-card');
      var openHeaderBar = null;
      try { openHeaderBar = detail.querySelector('.post-header .post-statusbar'); } catch (_eOpenHeaderBar) { openHeaderBar = null; }
      if (cardStatusBar && openHeaderBar) {
        // The bar above the postcard stays in place. Hide the duplicate inside the post.
        openHeaderBar.style.display = 'none';
      }
      if (cardToHide) {
        var _isPostEditorSlot = slot.classList.contains('posteditor-main-container');
        if (_isPostEditorSlot) {
          var _posteditorExitRect = _preCloseExitRect || cardToHide.getBoundingClientRect();
          var _posteditorShouldAnimate = _POST_ANIMATE && !options.fromMap && options.source !== 'marquee' && options.source !== 'deeplink';
          slot.__openedFromExternal = !!(options.fromMap || (options.source && options.source !== 'posteditor'));

          if (_posteditorShouldAnimate) {
            cardToHide.classList.add('post-card--map-highlight');
            var _posteditorExitClone = cardToHide.cloneNode(true);
            cardToHide.classList.remove('post-card--map-highlight');
            _posteditorExitClone.style.position = 'absolute';
            _posteditorExitClone.style.top = '0';
            _posteditorExitClone.style.left = '0';
            _posteditorExitClone.style.width = '100%';
            _posteditorExitClone.style.margin = '0';
            _posteditorExitClone.style.pointerEvents = 'none';
            _posteditorExitClone.style.transition = 'none';
            if (_preCloseCardBg && _preCloseCardBg !== 'rgba(0, 0, 0, 0)' && _preCloseCardBg !== 'transparent') {
              _posteditorExitClone.style.backgroundColor = _preCloseCardBg;
            }
            var _posteditorCloneEls = _posteditorExitClone.querySelectorAll('*');
            for (var _peci = 0; _peci < _posteditorCloneEls.length; _peci++) { _posteditorCloneEls[_peci].style.transition = 'none'; }
            slot.style.position = 'relative';
            slot.style.overflow = 'hidden';
            slot.appendChild(_posteditorExitClone);
            slot.__exitClone = _posteditorExitClone;
            _posteditorExitClone.getBoundingClientRect();
            _posteditorExitClone.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
            _posteditorExitClone.style.transform = 'translateY(-' + _posteditorExitRect.height + 'px)';
            setTimeout(function() {
              if (_posteditorExitClone.parentNode) _posteditorExitClone.parentNode.removeChild(_posteditorExitClone);
              if (slot && slot.__exitClone === _posteditorExitClone) slot.__exitClone = null;
            }, Math.round(_POST_ANIM_DUR * 1000) + 20);
          }

          cardToHide.style.display = 'none';
          var _posteditorInsertAfterEl = cardToHide;
          while (_posteditorInsertAfterEl && _posteditorInsertAfterEl.parentElement !== slot) {
            _posteditorInsertAfterEl = _posteditorInsertAfterEl.parentElement;
          }
          if (_posteditorInsertAfterEl) {
            slot.insertBefore(detail, _posteditorInsertAfterEl.nextSibling);
          } else {
            slot.appendChild(detail);
          }

          var _posteditorCardH = Math.round(_posteditorExitRect.height);
          slot.__cardH = _posteditorCardH;

          if (_posteditorShouldAnimate) {
            var _posteditorPostH = detail.offsetHeight;
            var _posteditorOffset = _posteditorPostH - _posteditorCardH;
            var _posteditorSiblings = [];
            var _posteditorSibStart = (slot.parentElement && slot.parentElement.classList.contains('posteditor-outer-container')) ? slot.parentElement : slot;
            var _posteditorActionsEl = slot.nextElementSibling && slot.nextElementSibling.classList.contains('posteditor-actions-container') ? slot.nextElementSibling : null;
            if (_posteditorActionsEl) _posteditorSiblings.push(_posteditorActionsEl);
            var _posteditorSib = _posteditorSibStart.nextElementSibling;
            while (_posteditorSib) { _posteditorSiblings.push(_posteditorSib); _posteditorSib = _posteditorSib.nextElementSibling; }
            slot.style.overflow = 'hidden';
            detail.style.transition = 'none';
            detail.style.transform = 'translateY(-' + _posteditorOffset + 'px)';
            for (var _peoi = 0; _peoi < _posteditorSiblings.length; _peoi++) {
              _posteditorSiblings[_peoi].style.transition = 'none';
              _posteditorSiblings[_peoi].style.transform = 'translateY(-' + _posteditorOffset + 'px)';
            }
            slot.__animDetail = detail;
            slot.__animSiblings = _posteditorSiblings;
            slot.getBoundingClientRect();
            detail.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
            detail.style.transform = 'translateY(0)';
            for (var _peoi2 = 0; _peoi2 < _posteditorSiblings.length; _peoi2++) {
              _posteditorSiblings[_peoi2].style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
              _posteditorSiblings[_peoi2].style.transform = 'translateY(0)';
            }
            slot.__animTimer = setTimeout(function() {
              detail.style.transform = '';
              detail.style.transition = '';
              for (var _peoi3 = 0; _peoi3 < _posteditorSiblings.length; _peoi3++) {
                _posteditorSiblings[_peoi3].style.transform = '';
                _posteditorSiblings[_peoi3].style.transition = '';
              }
              slot.style.overflow = '';
              slot.style.position = '';
              slot.__animDetail = null;
              slot.__animSiblings = null;
              slot.__animTimer = null;
            }, Math.round(_POST_ANIM_DUR * 1000) + 20);
          }
        } else {
        var _exitRect = _preCloseExitRect || cardToHide.getBoundingClientRect();
        var _shouldAnimate = _POST_ANIMATE && !options.fromMap && options.source !== 'marquee' && options.source !== 'deeplink' && !slot.dataset.sfIds;
        // Storefront open animation: card exit plays immediately; post enter is deferred until
        // the initial post fetch completes (content height is unknown until then).
        var _sfShouldAnimate = _POST_ANIMATE && !options.fromMap && options.source !== 'marquee' && options.source !== 'deeplink' && !!slot.dataset.sfIds;
        slot.__openedFromExternal = !!(options.fromMap || (options.source && options.source !== 'posteditor'));

        // ── OPEN ANIMATION: CARD EXIT ───────────────────────────────────────────
        // Card clone slides up into the invisibility shield (clip) and disappears.
        // Real card is hidden underneath without visual disruption.
        if (_shouldAnimate || _sfShouldAnimate) {
          var _cloneAsRecent = cardToHide.classList.contains('recent-card');
          var _cloneAsSf = !!slot.dataset.sfIds;
          if (_cloneAsRecent) cardToHide.classList.add('recent-card--active');
          else if (!_cloneAsSf) cardToHide.classList.add('post-card--map-highlight');
          var _exitClone = cardToHide.cloneNode(true);
          if (_cloneAsRecent) cardToHide.classList.remove('recent-card--active');
          else if (!_cloneAsSf) cardToHide.classList.remove('post-card--map-highlight');
          _exitClone.style.position = 'absolute';
          _exitClone.style.top = '0';
          _exitClone.style.left = '0';
          _exitClone.style.width = '100%';
          _exitClone.style.margin = '0';
          _exitClone.style.pointerEvents = 'none';
          _exitClone.style.transition = 'none';
          if (_preCloseCardBg && _preCloseCardBg !== 'rgba(0, 0, 0, 0)' && _preCloseCardBg !== 'transparent') {
            _exitClone.style.backgroundColor = _preCloseCardBg;
          }
          var _cloneEls = _exitClone.querySelectorAll('*');
          for (var _ci = 0; _ci < _cloneEls.length; _ci++) { _cloneEls[_ci].style.transition = 'none'; }
          slot.style.position = 'relative';
          slot.style.overflow = 'hidden';
          slot.appendChild(_exitClone);
          slot.__exitClone = _exitClone;
          _exitClone.getBoundingClientRect(); // force reflow
          _exitClone.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
          _exitClone.style.transform = 'translateY(-' + _exitRect.height + 'px)';
          setTimeout(function() {
            if (_exitClone.parentNode) _exitClone.parentNode.removeChild(_exitClone);
            if (slot && slot.__exitClone === _exitClone) slot.__exitClone = null;
          }, Math.round(_POST_ANIM_DUR * 1000) + 20);
        }
        // ── END OPEN ANIMATION: CARD EXIT ───────────────────────────────────────

        cardToHide.style.display = 'none';
        var insertAfterEl = cardToHide;
        while (insertAfterEl && insertAfterEl.parentElement !== slot) {
          insertAfterEl = insertAfterEl.parentElement;
        }
        if (insertAfterEl) {
          slot.insertBefore(detail, insertAfterEl.nextSibling);
        } else {
          slot.appendChild(detail);
        }

        // ── OPEN ANIMATION: POST ENTER ──────────────────────────────────────────
        // Post slides down from the invisibility shield into its final position.
        // All siblings below move as one unit with the post — same transform, same timing.
        // Bottom pixel of post starts and ends at the same point as the postcard bottom.
        var _openCardH = Math.round(_exitRect.height);
        slot.__cardH = _openCardH; // stored for close animation — card is display:none by then

        // Storefront wait state: lock slot to card height and hide detail until the initial
        // post fetch completes. _sfOnFirstLoad is called by setupPostDetailEvents once done.
        var _sfOnFirstLoad = null;
        if (_sfShouldAnimate) {
          slot.style.overflow = 'hidden';
          slot.style.height = _openCardH + 'px';
          detail.style.visibility = 'hidden';
          _sfOnFirstLoad = function() {
            if (!detail.parentNode) return; // storefront closed before fetch completed
            slot.style.height = '';
            detail.style.visibility = '';
            var _sfPostH = detail.offsetHeight;
            var _sfOffset = _sfPostH - _openCardH;
            if (_sfOffset <= 0) { slot.style.overflow = ''; return; }
            var _sfSiblings = [];
            var _sfSibStart = (slot.parentElement && (slot.parentElement.classList.contains('post-outer-container') || slot.parentElement.classList.contains('recent-outer-container'))) ? slot.parentElement : slot;
            var _sfSib = _sfSibStart.nextElementSibling;
            while (_sfSib) { _sfSiblings.push(_sfSib); _sfSib = _sfSib.nextElementSibling; }
            var _sfSibList = _sfSibStart.parentElement;
            if (_sfSibList && (_sfSibList.classList.contains('post-list') || _sfSibList.classList.contains('recent-list'))) {
              var _sfListSib = _sfSibList.nextElementSibling;
              while (_sfListSib) { _sfSiblings.push(_sfListSib); _sfListSib = _sfListSib.nextElementSibling; }
            }
            slot.style.overflow = 'hidden';
            detail.style.transition = 'none';
            detail.style.transform = 'translateY(-' + _sfOffset + 'px)';
            for (var _sfi = 0; _sfi < _sfSiblings.length; _sfi++) {
              _sfSiblings[_sfi].style.transition = 'none';
              _sfSiblings[_sfi].style.transform = 'translateY(-' + _sfOffset + 'px)';
            }
            slot.__animDetail = detail;
            slot.__animSiblings = _sfSiblings;
            slot.getBoundingClientRect(); // force reflow
            detail.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
            detail.style.transform = 'translateY(0)';
            for (var _sfi2 = 0; _sfi2 < _sfSiblings.length; _sfi2++) {
              _sfSiblings[_sfi2].style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
              _sfSiblings[_sfi2].style.transform = 'translateY(0)';
            }
            slot.__animTimer = setTimeout(function() {
              detail.style.transform = '';
              detail.style.transition = '';
              for (var _sfi3 = 0; _sfi3 < _sfSiblings.length; _sfi3++) {
                _sfSiblings[_sfi3].style.transform = '';
                _sfSiblings[_sfi3].style.transition = '';
              }
              slot.style.overflow = '';
              slot.style.position = '';
              slot.__animDetail = null;
              slot.__animSiblings = null;
              slot.__animTimer = null;
            }, Math.round(_POST_ANIM_DUR * 1000) + 20);
          };
          // Assign to ref so setupPostDetailEvents can invoke it after the fetch completes.
          // This assignment is always synchronous before any .then() callback can fire.
          _sfOnFirstLoadRef.fn = _sfOnFirstLoad;
        }

        if (_shouldAnimate) {
          var _openPostH = detail.offsetHeight;
          var _openOffset = _openPostH - _openCardH;
          var _openSiblings = [];
          var _openSibStart = (slot.parentElement && (slot.parentElement.classList.contains('post-outer-container') || slot.parentElement.classList.contains('recent-outer-container'))) ? slot.parentElement : slot;
          var _openSib = _openSibStart.nextElementSibling;
          while (_openSib) { _openSiblings.push(_openSib); _openSib = _openSib.nextElementSibling; }
          var _openSibList = _openSibStart.parentElement;
          if (_openSibList && (_openSibList.classList.contains('post-list') || _openSibList.classList.contains('recent-list'))) {
            var _listSib = _openSibList.nextElementSibling;
            while (_listSib) { _openSiblings.push(_listSib); _listSib = _listSib.nextElementSibling; }
          }
          slot.style.overflow = 'hidden';
          detail.style.transition = 'none';
          detail.style.transform = 'translateY(-' + _openOffset + 'px)';
          for (var _osi = 0; _osi < _openSiblings.length; _osi++) {
            _openSiblings[_osi].style.transition = 'none';
            _openSiblings[_osi].style.transform = 'translateY(-' + _openOffset + 'px)';
          }
          slot.__animDetail = detail;
          slot.__animSiblings = _openSiblings;
          slot.getBoundingClientRect(); // force reflow
          detail.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
          detail.style.transform = 'translateY(0)';
          for (var _osi2 = 0; _osi2 < _openSiblings.length; _osi2++) {
            _openSiblings[_osi2].style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
            _openSiblings[_osi2].style.transform = 'translateY(0)';
          }
          slot.__animTimer = setTimeout(function() {
            detail.style.transform = '';
            detail.style.transition = '';
            for (var _osi3 = 0; _osi3 < _openSiblings.length; _osi3++) {
              _openSiblings[_osi3].style.transform = '';
              _openSiblings[_osi3].style.transition = '';
            }
            slot.style.overflow = '';
            slot.style.position = '';
            slot.__animDetail = null;
            slot.__animSiblings = null;
            slot.__animTimer = null;
            try {
              var _scrollParent = slot.closest('.post-panel-content') || slot.closest('.recent-panel-content');
              if (_scrollParent && window.BottomSlack && typeof BottomSlack.get === 'function') {
                var _bsCtrl = BottomSlack.get(_scrollParent);
                if (_bsCtrl && typeof _bsCtrl.trim === 'function') _bsCtrl.trim();
              }
            } catch (_eBs) {}
          }, Math.round(_POST_ANIM_DUR * 1000) + 20);
        }
        // ── END OPEN ANIMATION: POST ENTER ─────────────────────────────────────
        }

      } else {
        slot.appendChild(detail);
      }
    } else {
      // No slot found (e.g. opened from map, card not in the list): create a temp slot.
      slot = document.createElement('div');
      slot.className = 'post-main-container';
      slot.dataset.id = String(post.id);
      if (options.storefrontPosts && options.storefrontPosts.length > 1) {
        slot.dataset.sfIds = options.storefrontPosts.map(function(p) { return String(p.id); }).join(',');
      }
      slot.appendChild(detail);
      var topSlack = null;
      try { topSlack = container.querySelector('.topSlack'); } catch (_eTopSlack) { topSlack = null; }
      var insertBeforeNode = topSlack ? topSlack.nextSibling : container.firstChild;
      container.insertBefore(slot, insertBeforeNode);
    }

    // Promote the open post's native circle dot to a DOM card marker now that the
    // post element is in the DOM and data-post-map-card-id is set.
    if (_lastRenderedPosts) {
      renderMapMarkers(_lastRenderedPosts);
    }

    // Wallpaper: activate now that the element is in the DOM.
    // Must happen after insertion so the component can measure dimensions.
    if (detail.classList.contains('component-locationwallpaper-container')) {
      detail.setAttribute('data-active', 'true');
      (function(el) {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            if (!document.contains(el)) return;
            if (window.LocationWallpaperComponent &&
                typeof LocationWallpaperComponent.install === 'function' &&
                typeof LocationWallpaperComponent.handleActiveContainerChange === 'function') {
              LocationWallpaperComponent.install(el);
              LocationWallpaperComponent.handleActiveContainerChange(el, el);
            }
          });
        });
      })(detail);
    }

    if (shouldScrollToOpenHeaderTop && detail) {
      try {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            try {
              // Align the opened post (header starts at top of .post) to the top of the Posts panel viewport.
              container.scrollTo({
                top: Math.max(0, detail.offsetTop || 0),
                behavior: 'smooth'
              });
            } catch (_eScrollOpenTop0) {}
          });
        });
      } catch (_eScrollOpenTop1) {}
    }

    // Mobile: scroll window so the opened post is at the top of the screen
    if (isMobileViewport && !fromRecent && !!options.fromMap && detail) {
      try {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            try {
              var rect = detail.getBoundingClientRect();
              var scrollY = window.pageYOffset || document.documentElement.scrollTop;
              window.scrollTo({ top: scrollY + rect.top, behavior: 'smooth' });
            } catch (_eMobileScrollTop0) {}
          });
        });
      } catch (_eMobileScrollTop1) {}
    }

    // Highlight the exact map marker for this location context
    highlightMapMarker(post.id, postMapCardId || '');

    // Keep the hidden postcard's postMapCardId in sync with the selected location.
    // When renderPostList preserves a slot across a fly-to, the hidden postcard retains
    // the departure location's id. Syncing here ensures re-click uses the correct location.
    if (slot && postMapCardId) {
      var _syncHiddenCard = slot.querySelector('.post-card');
      if (_syncHiddenCard) _syncHiddenCard.dataset.postMapCardId = postMapCardId;
    }

    // If requested (fly destination), open the post in expanded mode.
    // IMPORTANT: The description truncation initializes on requestAnimationFrame; expand after that runs
    // to avoid applyTruncation overwriting the expanded DOM.
    if (autoExpand && detail) {
      try {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            try {
              var descEl = detail.querySelector('.post-description-text');
              if (descEl && typeof descEl.click === 'function') {
                descEl.click();
              }
            } catch (_eExp0) {}
          });
        });
      } catch (_eExp1) {}
    }

    // Emit event for map highlighting
    if (window.App && typeof App.emit === 'function') {
      App.emit('post:opened', { post: post });
    }
  }

  /**
   * Cancel any in-progress open/close animation on a slot.
   * Clears timers, removes floating clones, strips inline animation styles.
   */
  function _cancelSlotAnimation(slot) {
    if (!slot) return;
    if (slot.__animTimer) { clearTimeout(slot.__animTimer); slot.__animTimer = null; }
    if (slot.__exitClone && slot.__exitClone.parentNode) slot.__exitClone.parentNode.removeChild(slot.__exitClone);
    slot.__exitClone = null;
    if (slot.__animEnterClone && slot.__animEnterClone.parentNode) slot.__animEnterClone.parentNode.removeChild(slot.__animEnterClone);
    slot.__animEnterClone = null;
    slot.style.height = '';
    slot.style.transition = '';
    slot.style.overflow = '';
    slot.style.position = '';
    if (slot.__animDetail) { slot.__animDetail.style.transform = ''; slot.__animDetail.style.transition = ''; slot.__animDetail = null; }
    if (slot.__animCard) { slot.__animCard.style.transform = ''; slot.__animCard.style.transition = ''; slot.__animCard = null; }
    if (slot.__animSiblings) {
      for (var _csi = 0; _csi < slot.__animSiblings.length; _csi++) {
        slot.__animSiblings[_csi].style.transform = '';
        slot.__animSiblings[_csi].style.transition = '';
      }
      slot.__animSiblings = null;
    }
    slot.__cardEnterClone = null;
    slot.__cardBg = null;
  }

  /**
   * Close any open post in a container.
   * Removes the detail view from the slot and restores hidden children (card, status bar, etc.).
   * @param {HTMLElement} container - Container element
   */
  function closeOpenPost(container) {
    var openPostEl = container.querySelector('.post');
    if (!openPostEl) return;

    var postId = openPostEl.dataset.id;

    // Find the slot wrapper (post-main-container, recent-main-container, or posteditor-main-container)
    var slot = openPostEl.closest('.post-main-container') || openPostEl.closest('.recent-main-container') || openPostEl.closest('.posteditor-main-container');

    if (slot) {
      // Cancel any in-progress animation before making DOM changes
      _cancelSlotAnimation(slot);
      // Remove the detail view from the slot
      openPostEl.remove();
      // Restore the hidden card
      var hiddenCard = slot.querySelector('.post-card, .recent-card');
      if (hiddenCard) hiddenCard.style.display = '';
      // If slot is now empty (was a temp slot for map-opened posts), remove it
      if (!slot.children.length) slot.remove();
    } else {
      try { openPostEl.remove(); } catch (_eRemove) {}
    }

    // Emit close event
    if (window.App && typeof App.emit === 'function') {
      App.emit('post:closed', { postId: postId });
    }
  }

  /**
   * Build the post detail view
   * Structure: .post > .post-header + .post-body
   * @param {Object} post - Post data
   * @param {HTMLElement} existingCard - Existing card element (optional)
   * @param {boolean} fromRecent - Whether opened from recent panel
   * @param {number} [activeMapCardIndex] - Which map card/location should be active for this open view
   * @returns {HTMLElement} Detail view element
   */

  function setTooltipDirs(wrap) {
    wrap.querySelectorAll('.post-links-item[data-tooltip], .post-amenities-item[data-tooltip], .post-contact-item[data-tooltip]').forEach(function(item) {
      var c = item.closest('.post-links-container, .post-amenities-container, .post-contact-strip'), cr = c && c.getBoundingClientRect();
      item.setAttribute('data-tooltip-dir', cr && (item.getBoundingClientRect().left - cr.left) > cr.width * 0.60 ? 'left' : 'right');
    });
  }

  function buildPostDetail(post, existingCard, fromRecent, activeMapCardIndex, storefrontPosts, sfOpenPostId, sfOnFirstLoadRef) {
    // Get all map cards (locations)
    var locationListAll = post.map_cards || [];
    var idx = (typeof activeMapCardIndex === 'number' && isFinite(activeMapCardIndex)) ? activeMapCardIndex : 0;
    if (idx < 0) idx = 0;
    if (idx >= locationListAll.length) idx = 0;

    // Active location (the user's current context)
    var activeLoc = locationListAll[idx] || locationListAll[0] || {};

    // LOCATION MENU ORDER RULE:
    // 1) Locations currently shown on the map (in-area) come first.
    // 2) All other locations come after.
    // 3) Active location becomes the button (top of the list) without removing any locations.
    var locationList = locationListAll;
    try {
      var bounds = getMapBounds();
      if (bounds && locationListAll.length > 1) {
        var inArea = [];
        var outArea = [];
        for (var ii = 0; ii < locationListAll.length; ii++) {
          var mc0 = locationListAll[ii];
          if (!mc0) continue;
          var lng0 = Number(mc0.longitude);
          var lat0 = Number(mc0.latitude);
          var ok0 = Number.isFinite(lng0) && Number.isFinite(lat0) && pointWithinBounds(lng0, lat0, bounds);
          if (ok0) inArea.push(mc0);
          else outArea.push(mc0);
        }

        // Default grouped order: all in-area first, then out-of-area (preserve original relative ordering).
        locationList = inArea.concat(outArea);
      }
    } catch (_eBounds) {
      locationList = locationListAll;
    }

    // Ensure active location is at index 0 (button), without disturbing the in-area-first grouping.
    // If bounds are unknown, this still makes the active location first.
    if (locationList && locationList.length > 1 && activeLoc && (activeLoc.id !== undefined && activeLoc.id !== null)) {
      var activeId = String(activeLoc.id);
      var rest = [];
      for (var rr = 0; rr < locationList.length; rr++) {
        var mcR = locationList[rr];
        if (!mcR) continue;
        if (String(mcR.id) === activeId) continue;
        rest.push(mcR);
      }
      locationList = [activeLoc].concat(rest);
    }

    function isLocationFiltered(loc) {
      return loc.passes_filter === 0;
    }

    // Get display data from first location
    var title = activeLoc.title || post.checkout_title || '';
    var description = activeLoc.description || '';
    var venueName = activeLoc.venue_name || '';
    var addressLine = activeLoc.address_line || '';
    var mediaUrls = activeLoc.media_urls || [];
    var mediaMeta = activeLoc.media_meta || [];
    // Hero image uses 'imagebox' class (530x530)
    var heroUrl = addImageClass(mediaUrls[0] || '', 'imagebox');

    // Get subcategory info
    var displayName = post.subcategory_name || '';
    if (!displayName) {
      throw new Error('[Post] Subcategory name missing for key: ' + (post.subcategory_key || 'unknown'));
    }
    var iconUrl = post.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Post] Subcategory icon missing for key: ' + (post.subcategory_key || 'unknown'));
    }

    var src = activeLoc || post;
    var datesText = formatSessionDateRange(src.start_date, src.end_date);

    // Posted by info
    var posterName = post.member_name || 'Anonymous';
    var postedTime = formatPostTimestamp(post.created_at);
    var postedMeta = postedTime ? 'Posted by ' + posterName + ' · ' + postedTime : 'Posted by ' + posterName;
    var avatarSrc = resolveAvatarSrcForUser(post.member_avatar || '', post.member_id);

    // Default session info display
    var priceParts = parsePriceSummary(activeLoc.price_summary || '');
    var priceHtml = '';
    if (priceParts.text) {
      var badgeHtml = priceParts.flagUrl 
        ? '<img class="post-image-badge post-image-badge--inline" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '">'
        : '💰 ';
      priceHtml = '<span>' + badgeHtml + escapeHtml(priceParts.text) + '</span>';
    }

    // Sort postcards/marquee/info text order: Date range comes BEFORE Price range.
    var defaultInfo = datesText
      ? ('📅 ' + datesText + (priceHtml ? (' | ' + priceHtml) : ''))
      : (priceHtml ? priceHtml : '');

    // Additional info fields from map card
    var city = activeLoc.city || '';
    var ticketsUrl = activeLoc.ticket_url || '';
    var itemUrl = activeLoc.item_url || '';
    var linksArr = (activeLoc && Array.isArray(activeLoc.links)) ? activeLoc.links : [];
    var publicEmail = activeLoc.public_email || '';
    var phonePrefix = activeLoc.phone_prefix || '';
    var publicPhone = activeLoc.public_phone || '';
    var ageRating = activeLoc.age_rating || '';
    var couponCode = activeLoc.coupon_code || '';
    var customText = activeLoc.custom_text || '';
    var customTextarea = activeLoc.custom_textarea || '';
    var customDropdown = activeLoc.custom_dropdown || '';
    var customChecklist = activeLoc.custom_checklist || '';
    var customRadio = activeLoc.custom_radio || '';
    var amenitySummary = activeLoc.amenity_summary || '';
    var amenitiesList = (activeLoc && Array.isArray(activeLoc.amenities_list)) ? activeLoc.amenities_list : [];
    var hasMultipleLocations = locationList.length > 1;

    function linkTypeToLabel(t) {
      var raw = (t === null || t === undefined) ? '' : String(t).trim();
      if (!raw) return 'Link';
      var lower = raw.toLowerCase();
      if (lower === 'x') return 'X';
      var words = lower.replace(/[-_]+/g, ' ').split(' ').filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        words[i] = w ? (w.charAt(0).toUpperCase() + w.slice(1)) : w;
      }
      return words.join(' ');
    }

    var hasWebsiteLink = false;
    var linkData = [];
    if (linksArr && linksArr.length) {
      var sortedLinks = linksArr.slice().filter(function(l) { return !!l; }).sort(function(a, b) {
        var am = (a && a.menu_sort_order !== null && a.menu_sort_order !== undefined && isFinite(a.menu_sort_order)) ? parseInt(a.menu_sort_order, 10) : 9999;
        var bm = (b && b.menu_sort_order !== null && b.menu_sort_order !== undefined && isFinite(b.menu_sort_order)) ? parseInt(b.menu_sort_order, 10) : 9999;
        if (am !== bm) return am - bm;
        var au = (a && a.external_url !== null && a.external_url !== undefined) ? String(a.external_url).trim().toLowerCase() : '';
        var bu = (b && b.external_url !== null && b.external_url !== undefined) ? String(b.external_url).trim().toLowerCase() : '';
        if (au < bu) return -1;
        if (au > bu) return 1;
        return 0;
      });

      sortedLinks.forEach(function(l) {
        var type = (l.link_type === null || l.link_type === undefined) ? '' : String(l.link_type).trim();
        var url = (l.external_url === null || l.external_url === undefined) ? '' : String(l.external_url).trim();
        if (!type && !url) return;
        if (type.toLowerCase() === 'website' && url) hasWebsiteLink = true;
        if (!url) return;
        var label = (l.label === null || l.label === undefined) ? '' : String(l.label).trim();
        if (!label) label = linkTypeToLabel(type);
        var filename = (l.filename === null || l.filename === undefined) ? '' : String(l.filename).trim();
        if (!filename) return;
        var iconUrl = '';
        if (window.App && typeof App.getImageUrl === 'function') {
          iconUrl = App.getImageUrl('links', filename);
        }
        if (!iconUrl) return;
        linkData.push({ url: url, label: label, iconUrl: iconUrl, linkType: type });
      });
    }

    // === Unified Contact Section (links, email, phone) ===
    var contactItems = [];
    var sett = App.getState('settings') || {};

    if (linkData.length) {
      var websiteItems = [];
      var otherLinkItems = [];
      linkData.forEach(function(d) {
        var item = {
          type: 'link',
          iconUrl: d.iconUrl,
          label: d.label,
          href: d.url,
          tooltipLabel: d.label,
          isRestricted: false
        };
        if (d.linkType && d.linkType.toLowerCase() === 'website') {
          websiteItems.push(item);
        } else {
          otherLinkItems.push(item);
        }
      });
      contactItems = websiteItems.concat(otherLinkItems);
    }

    if (publicEmail) {
      var emailIconUrl = sett.badge_icon_email ? App.getImageUrl('fieldsetIcons', sett.badge_icon_email) : '';
      if (emailIconUrl) {
        var emailRestricted = publicEmail.toLowerCase() === 'members only';
        if (emailRestricted) publicEmail = 'Members Only';
        contactItems.push({
          type: 'email',
          iconUrl: emailIconUrl,
          label: emailRestricted ? 'Members Only' : publicEmail,
          href: emailRestricted ? '' : 'mailto:' + publicEmail,
          tooltipLabel: emailRestricted ? 'Members Only' : 'Email',
          isRestricted: emailRestricted
        });
      }
    }

    if (phonePrefix || publicPhone) {
      var phoneIconUrl = sett.badge_icon_phone ? App.getImageUrl('fieldsetIcons', sett.badge_icon_phone) : '';
      if (phoneIconUrl) {
        var phoneRestricted = publicPhone.toLowerCase() === 'members only';
        if (phoneRestricted) publicPhone = 'Members Only';
        var phoneDisplay = phoneRestricted ? 'Members Only' : (phonePrefix + ' ' + publicPhone).trim();
        contactItems.push({
          type: 'phone',
          iconUrl: phoneIconUrl,
          label: phoneDisplay,
          href: phoneRestricted ? '' : 'tel:' + phonePrefix + publicPhone,
          tooltipLabel: phoneRestricted ? 'Members Only' : phoneDisplay,
          isRestricted: phoneRestricted
        });
      }
    }

    var contactHtml = '';
    if (contactItems.length) {
      if (contactItems.length <= 3) {
        var contactRows = [];
        contactItems.forEach(function(item) {
          var iconSpan = '<span class="post-contact-icon" style="--post-contact-mask:url(' + escapeHtml(item.iconUrl) + ')"></span>';
          if (item.isRestricted) {
            contactRows.push(
              '<div class="post-contact-row post-contact-row--restricted">' +
                iconSpan +
                '<span class="post-contact-label post-contact-label--restricted">' + escapeHtml(item.label) + '</span>' +
              '</div>'
            );
          } else {
            var target = item.type === 'link' ? ' target="_blank" rel="noopener noreferrer"' : '';
            contactRows.push(
              '<div class="post-contact-row">' +
                '<a class="post-contact-link" href="' + escapeHtml(item.href) + '"' + target + '>' +
                  iconSpan +
                  '<span class="post-contact-label">' + escapeHtml(item.label) + '</span>' +
                '</a>' +
              '</div>'
            );
          }
        });
        contactHtml = '<div class="post-contact-container">' + contactRows.join('') + '</div>';
      } else {
        var contactIcons = [];
        contactItems.forEach(function(item) {
          var iconSpan = '<span class="post-contact-icon" style="--post-contact-mask:url(' + escapeHtml(item.iconUrl) + ')"></span>';
          if (item.isRestricted) {
            contactIcons.push(
              '<span class="post-contact-item post-contact-item--restricted" data-tooltip="' + escapeHtml(item.tooltipLabel) + '">' +
                iconSpan +
              '</span>'
            );
          } else {
            var target = item.type === 'link' ? ' target="_blank" rel="noopener noreferrer"' : '';
            contactIcons.push(
              '<a class="post-contact-link" href="' + escapeHtml(item.href) + '"' + target + ' aria-label="' + escapeHtml(item.tooltipLabel) + '">' +
                '<span class="post-contact-item" data-tooltip="' + escapeHtml(item.tooltipLabel) + '">' +
                  iconSpan +
                '</span>' +
              '</a>'
            );
          }
        });
        contactHtml = '<div class="post-contact-container post-contact-container--strip"><div class="post-contact-strip">' + contactIcons.join('') + '</div></div>';
      }
    }

    // Amenities (show only amenities for this post/location; grey inactive, white active)
    var amenitiesStripRowHtml = '';
    if (amenitiesList && amenitiesList.length) {
      var amenData = [];
      amenitiesList.forEach(function(a) {
        if (!a) return;
        var key = (a.key === null || a.key === undefined) ? '' : String(a.key).trim();
        if (!key) return;
        var label = (a.label === null || a.label === undefined) ? '' : String(a.label).trim();
        if (!label) label = key;
        var filename = (a.filename === null || a.filename === undefined) ? '' : String(a.filename).trim();
        if (!filename) return;
        var iconUrl = '';
        if (window.App && typeof App.getImageUrl === 'function') {
          iconUrl = App.getImageUrl('amenities', filename);
        }
        if (!iconUrl) return;
        var active = false;
        try { active = !!(a.value === 1 || a.value === '1' || a.value === true); } catch (_eAct) { active = false; }
        amenData.push({ label: label, iconUrl: iconUrl, active: active });
      });

      var partsAmen = [];
      amenData.forEach(function(d, idx) {
        var dir = 'right';
        var yn = d.active ? 'Yes' : 'No';
        partsAmen.push(
          '<span class="post-amenities-item' + (d.active ? ' post-amenities-item--active' : '') + '" aria-label="' + escapeHtml(d.label + ': ' + yn) + '" data-tooltip="' + escapeHtml(d.active ? d.label : 'No ' + d.label) + '" data-tooltip-dir="' + dir + '">' +
            '<span class="post-amenities-icon" style="--post-amenities-mask:url(' + escapeHtml(d.iconUrl) + ')"></span>' +
          '</span>'
        );
      });

      if (partsAmen.length) {
        amenitiesStripRowHtml =
          '<div class="post-info-row post-info-row-amenities">' +
            '<div class="post-amenities-container">' + partsAmen.join('') + '</div>' +
          '</div>';
      }
    }

    // Check favorite status
    var isFav = isFavorite(post.id);

    // Create wrapper - proper class naming: .post
    var wrap = document.createElement('div');
    wrap.className = 'post';
    wrap.setAttribute('data-slack-anchor', '');
    wrap.dataset.id = String(post.id);
    wrap.dataset.postKey = post.post_key || '';
    if (post.subcategory_color) {
      var _pHex = post.subcategory_color.replace('#', '');
      var _pR = parseInt(_pHex.substring(0, 2), 16);
      var _pG = parseInt(_pHex.substring(2, 4), 16);
      var _pB = parseInt(_pHex.substring(4, 6), 16);
      wrap.style.setProperty('--post-subcat-overlay', 'rgba(' + _pR + ',' + _pG + ',' + _pB + ',1)');
    }
    // Track the active location context for this open post (source-of-truth: post_map_card_id).
    try { wrap.setAttribute('data-post-map-card-id', String(activeLoc && activeLoc.id !== undefined && activeLoc.id !== null ? activeLoc.id : '')); } catch (_eAttr) {}
    // Store reference to post data for LocationWallpaperComponent library lookup
    wrap.__mapCardData = activeLoc;
    // Store the ordered location list used by the UI so event handlers use the same index mapping.
    wrap.__postLocationList = locationList;

    // Location wallpaper integration (reuses LocationWallpaperComponent pattern):
    // - Only activates when post is expanded (handled in setupPostDetailEvents)
    // - Uses lat/lng from first map card (already provided by API)
    // - Must not block interactions (component uses pointer-events: none)
    var lat = null;
    var lng = null;
    try {
      lat = (activeLoc && activeLoc.latitude !== undefined && activeLoc.latitude !== null) ? Number(activeLoc.latitude) : null;
      lng = (activeLoc && activeLoc.longitude !== undefined && activeLoc.longitude !== null) ? Number(activeLoc.longitude) : null;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { lat = null; lng = null; }
    } catch (_eLL) { lat = null; lng = null; }

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

    // Build post header (unified header for both collapsed and expanded states)
    var postHeader = document.createElement('div');
    postHeader.className = 'post-header';
    
    // Thumbnail for header uses minithumb size
    var rawThumbUrl = getPostThumbnailUrl(post);
    var miniThumbUrl = rawThumbUrl ? addImageClass(rawThumbUrl, 'minithumb') : '';
    
    var thumbHtml = miniThumbUrl
      ? '<img class="post-header-image-minithumb" loading="lazy" src="' + miniThumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="post-header-image-minithumb post-header-image-minithumb--empty" aria-hidden="true"></div>';
    
    // Location display (expanded post header — same rules as postcards)
    var locType = (activeLoc && activeLoc.location_type) || '';
    var suburb = (activeLoc && activeLoc.suburb) || '';
    var state = (activeLoc && activeLoc.state) || '';
    var countryName = (activeLoc && activeLoc.country_name) || '';
    var locationDisplay = '';
    if (locType === 'venue') {
      var venueSecond = suburb || city || '';
      locationDisplay = (venueName && venueSecond) ? venueName + ', ' + venueSecond : (venueName || venueSecond || '');
    } else if (locType === 'city') {
      var citySecond = state || countryName || '';
      locationDisplay = (city && citySecond) ? city + ', ' + citySecond : (city || citySecond || '');
    } else {
      var addrSecond = state || countryName || '';
      var addrLocal = suburb || city || '';
      locationDisplay = (addrLocal && addrSecond) ? addrLocal + ', ' + addrSecond : (addrLocal || addrSecond || '');
    }
    
    // Icon HTML for info section (subcategory icon)
    var infoIconHtml = iconUrl
      ? '<span class="post-info-icon"><img class="post-info-image-sub" src="' + iconUrl + '" alt="" /></span>'
      : '';
    
    // Price badge for info section
    var infoPriceBadgeHtml = priceParts.flagUrl 
      ? '<img class="post-info-image-badge" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '">'
      : '💰';
    
    // Storefront header override
    if (storefrontPosts && storefrontPosts.length > 1) {
      var sfAvatarUrl = resolveAvatarSrcForUser(post.member_avatar, post.member_id);
      var sfMiniAvatar = sfAvatarUrl ? addImageClass(sfAvatarUrl, 'minithumb') : '';
      thumbHtml = sfMiniAvatar
        ? '<img class="post-header-image-minithumb" loading="lazy" src="' + sfMiniAvatar + '" alt="" referrerpolicy="no-referrer" />'
        : '<div class="post-header-image-minithumb post-header-image-minithumb--empty" aria-hidden="true"></div>';
      title = 'Storefront: ' + (post.member_name || '');
      var sfHeaderSorted = storefrontPosts.slice().sort(function(a, b) {
        var aTs = getFavoriteTimestamp(a.id);
        var bTs = getFavoriteTimestamp(b.id);
        var aFav = aTs ? 0 : 1;
        var bFav = bTs ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        if (aTs && bTs) return bTs - aTs;
        return 0;
      });
      var sfThumbRowHtml = '<div class="post-header-row-storefront">';
      sfHeaderSorted.forEach(function(p) {
        var rawUrl = getPostThumbnailUrl(p);
        var miniUrl = rawUrl ? addImageClass(rawUrl, 'minithumb') : '';
        if (miniUrl) {
          var pFav = isFavorite(p.id);
          sfThumbRowHtml += '<span class="post-header-row-storefront-wrap" data-post-id="' + p.id + '">';
          sfThumbRowHtml += '<img class="post-header-row-storefront-thumb" src="' + miniUrl + '" alt="" />';
          if (pFav) sfThumbRowHtml += '<span class="post-header-row-storefront-favdot" aria-hidden="true"></span>';
          sfThumbRowHtml += '</span>';
        }
      });
      sfThumbRowHtml += '<span class="post-header-row-storefront-overflow" style="display:none"></span>';
      sfThumbRowHtml += '</div>';
      infoIconHtml = '';
      displayName = '';
    }

    // Post header: thumbnail, title + category (or storefront thumbs), actions
    var sfHeaderInfoRow = (storefrontPosts && storefrontPosts.length > 1)
      ? sfThumbRowHtml
      : '<div class="post-info-row post-info-row-cat">' + infoIconHtml + '<span class="post-info-text">' + escapeHtml(displayName) + '</span></div>';

    var sfActionsDisabled = (storefrontPosts && storefrontPosts.length > 1);
    if (sfActionsDisabled) {
      postHeader.classList.add('post-header--storefront');
      try {
        var sfHeaderSettings = App.getState('settings') || {};
        if (sfHeaderSettings.folder_system_images && sfHeaderSettings.multi_post_icon) {
          postHeader.style.setProperty('--storefront-bg-icon', 'url(' + sfHeaderSettings.folder_system_images + '/' + sfHeaderSettings.multi_post_icon + ')');
        }
      } catch (_eSfHeaderBgIcon) {}
    }

    var actionsHtml = sfActionsDisabled ? '' : [
      '<div class="post-header-actions">',
        '<button class="post-button-share" aria-label="Share post">',
          '<div class="post-icon-share"></div>',
        '</button>',
        '<button class="post-header-button-fav" aria-label="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '" aria-pressed="' + (isFav ? 'true' : 'false') + '" data-post-id="' + post.id + '">',
          '<div class="post-header-icon-fav"></div>',
        '</button>',
      '</div>'
    ].join('');

    postHeader.innerHTML = [
      thumbHtml,
      '<div class="post-header-meta">',
        '<div class="post-header-text-title">' + escapeHtml(title) + '</div>',
        sfHeaderInfoRow,
      '</div>',
      actionsHtml
    ].join('');

    // Storefront header thumb row overflow
    if (storefrontPosts && storefrontPosts.length > 1) {
      requestAnimationFrame(function() {
        var row = postHeader.querySelector('.post-header-row-storefront');
        if (!row) return;
        var overflowEl = row.querySelector('.post-header-row-storefront-overflow');
        if (!overflowEl) return;
        var thumbs = row.querySelectorAll('.post-header-row-storefront-thumb');
        var rowRight = row.getBoundingClientRect().right;
        var hiddenCount = 0;
        for (var i = 0; i < thumbs.length; i++) {
          if (thumbs[i].getBoundingClientRect().right > rowRight) hiddenCount++;
        }
        if (hiddenCount > 0) {
          overflowEl.textContent = '+' + hiddenCount;
          overflowEl.style.display = '';
        }
      });
    }

    // Create post body - proper class naming
    var postBody = document.createElement('div');
    postBody.className = 'post-body';
    postBody.innerHTML = [
      '<div class="post-details">',
      '<div class="post-info-container">',
        // Location component (dropdown with all locations)
        PostLocationComponent.render({
          postId: post.id,
          memberId: post.member_id,
          locationList: locationList,
          escapeHtml: escapeHtml,
          isLocationFiltered: isLocationFiltered
        }),
        // Amenities icons — location-specific, so it sits under the location menu
        amenitiesStripRowHtml || '',
        // Session component (dates button + ticket container)
        PostSessionComponent.render({
          postId: post.id,
          datesText: datesText,
          ageRatings: activeLoc.age_ratings || {},
          sessions: Array.isArray(activeLoc.sessions) ? activeLoc.sessions : [],
          priceSummary: activeLoc.price_summary || '',
          escapeHtml: escapeHtml
        }),
        // Item pricing component (name, variants, price, promo, age rating)
        PostItemComponent.render({
          postId: post.id,
          mapCard: activeLoc,
          escapeHtml: escapeHtml
        }),
        // CTA buttons
        ticketsUrl ? '<a href="' + escapeHtml(ticketsUrl) + '" target="_blank" rel="noopener noreferrer" class="post-cta-button button-class-8">Get Tickets</a>' : '',
        itemUrl ? '<a href="' + escapeHtml(itemUrl) + '" target="_blank" rel="noopener noreferrer" class="post-cta-button button-class-8">Shop Now</a>' : '',
        // Unified contact section (links, email, phone)
        contactHtml,
        // Amenities summary is no longer rendered here; amenities display uses the icon container only.
        // Coupon code
        couponCode ? '<div class="post-info-row post-info-row-coupon">' +
          '🏷️ ' + escapeHtml(couponCode) +
        '</div>' : '',
        // Custom fields
        customText ? '<div class="post-info-row post-info-row-custom">' + escapeHtml(customText) + '</div>' : '',
        customTextarea ? '<div class="post-info-row post-info-row-custom">' + escapeHtml(customTextarea) + '</div>' : '',
        customDropdown ? '<div class="post-info-row post-info-row-custom">' + escapeHtml(customDropdown) + '</div>' : '',
        customChecklist ? '<div class="post-info-row post-info-row-custom">' + escapeHtml(customChecklist) + '</div>' : '',
        customRadio ? '<div class="post-info-row post-info-row-custom">' + escapeHtml(customRadio) + '</div>' : '',
      '</div>',
      '<div class="post-description-container">',
        '<div class="post-description-text" tabindex="0" aria-expanded="false" data-full-text="' + escapeHtml(description) + '"></div>',
        '<div class="post-description-member">',
          (avatarSrc ? '<img class="post-description-avatar" src="' + escapeHtml(avatarSrc) + '" alt="">' : ''),
          '<span class="post-description-postedby">' + escapeHtml(postedMeta) + '</span>',
        '</div>',
      '</div>',
      '</div>',
      '<div class="post-images-container">',
        '<div class="post-hero">',
          '<div class="post-track-hero">',
            '<img class="post-image-hero post-image-hero--loading" src="' + heroUrl + '" data-full="' + (mediaUrls[0] || '') + '" data-raw="' + ((mediaMeta[0] && mediaMeta[0].raw_url) || mediaUrls[0] || '') + '" alt="" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" />',
          '</div>',
        '</div>',
        '<div class="post-thumbs"></div>',
      '</div>'
    ].join('');

    // Build thumbnails - use 'minithumb' class (50x50) for small previews
    if (mediaUrls.length > 1) {
      var thumbRow = postBody.querySelector('.post-thumbs');
      if (thumbRow) {
        mediaUrls.forEach(function(url, i) {
          var img = document.createElement('img');
          img.className = 'post-image-thumb' + (i === 0 ? ' post-image-thumb--active' : '');
          img.src = addImageClass(url, 'minithumb');
          img.alt = '';
          img.dataset.index = String(i);
          img.dataset.fullUrl = url;
          var meta = mediaMeta[i];
          img.dataset.rawUrl = (meta && meta.raw_url) ? meta.raw_url : url;
          thumbRow.appendChild(img);
        });
      }
    }

    // Assemble structure
    // Wrap content in a container compatible with LocationWallpaperComponent.
    var contentWrap = document.createElement('div');
    contentWrap.className = 'component-locationwallpaper-content';
    wrap.appendChild(contentWrap);

    // Hidden lat/lng inputs for LocationWallpaperComponent to read
    if (lat !== null && lng !== null) {
      wrap.classList.add('component-locationwallpaper-container');
      
      // Store post ID for missing wallpaper flagging
      if (post && post.id) {
        wrap.dataset.postId = String(post.id);
      }
      // Store location type so self-healing can determine correct zoom level
      if (locType) {
        wrap.dataset.locationType = locType;
      }
      var latEl = document.createElement('input');
      latEl.type = 'hidden';
      latEl.className = 'fieldset-lat';
      latEl.value = String(lat);
      var lngEl = document.createElement('input');
      lngEl.type = 'hidden';
      lngEl.className = 'fieldset-lng';
      lngEl.value = String(lng);
      wrap.appendChild(latEl);
      wrap.appendChild(lngEl);
    }

    // Append header and body (unified header for both collapsed and expanded states)
    // Note: cardEl is kept for restoration when closing, but header is used for display
    contentWrap.appendChild(cardEl);
    contentWrap.appendChild(postHeader);

    // Countdown status bar for open post (inside sticky header, at top row).
    var _postSett = App.getState('settings') || {};
    if (_postSett.countdown_posts) {
      var _postBarResult = buildCountdownStatusBar(post, activeLoc);
      if (_postBarResult) {
        postHeader.insertBefore(_postBarResult.bar, postHeader.firstChild);
      }
    }

    // Storefront: inject menu between header and body, replace body with empty content slot
    var sfMenuPosts = null;
    if (storefrontPosts && storefrontPosts.length > 1) {
      sfMenuPosts = storefrontPosts.map(function(p) {
        var pick = pickMapCardInCurrentBounds(p);
        var mc = pick.mapCard;
        var rawUrl = getPostThumbnailUrl(p);
        var subcatHoverBg = '';
        if (p.subcategory_color) {
          var _sfHexMenu = p.subcategory_color.replace('#', '');
          var _sfMenuR = parseInt(_sfHexMenu.substring(0, 2), 16);
          var _sfMenuG = parseInt(_sfHexMenu.substring(2, 4), 16);
          var _sfMenuB = parseInt(_sfHexMenu.substring(4, 6), 16);
          subcatHoverBg = 'rgba(' + _sfMenuR + ',' + _sfMenuG + ',' + _sfMenuB + ', var(--subcat-hover-alpha, 0.5))';
        }
        return {
          _post: p,
          _thumbUrl: rawUrl ? addImageClass(rawUrl, 'minithumb') : '',
          _title: (mc && mc.title) || p.checkout_title || '',
          _subcategory: p.subcategory_name || '',
          _subcatHoverBg: subcatHoverBg,
          _isFav: isFavorite(p.id),
          _postId: String(p.id)
        };
      });
      sfMenuPosts.sort(function(a, b) {
        var aTs = getFavoriteTimestamp(a._postId);
        var bTs = getFavoriteTimestamp(b._postId);
        var aFav = aTs ? 0 : 1;
        var bFav = bTs ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        if (aTs && bTs) return bTs - aTs;
        return 0;
      });
      var sfMenuDiv = document.createElement('div');
      sfMenuDiv.innerHTML = StorefrontMenuComponent.render(sfMenuPosts);
      while (sfMenuDiv.firstChild) contentWrap.appendChild(sfMenuDiv.firstChild);
    } else {
      contentWrap.appendChild(postBody);
    }

    // Event handlers
    setupPostDetailEvents(wrap, post, isLocationFiltered, sfMenuPosts, sfOpenPostId, sfOnFirstLoadRef);

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
  function setupPostDetailEvents(wrap, post, isLocationFiltered, sfMenuPosts, sfOpenPostId, sfOnFirstLoadRef) {
    var _sfFirstLoadFired = false;
    // Get card element (first child)
    var cardEl = wrap.querySelector('.post-card, .recent-card');

    function setFavoriteButtonState(button, isOn) {
      if (!button) return;
      button.setAttribute('aria-pressed', String(isOn));
      button.setAttribute('aria-label', isOn ? 'Remove from favorites' : 'Add to favorites');
    }

    function syncCardFavoriteButtons(pid, isOn) {
      document.querySelectorAll('[data-id="' + pid + '"] .post-card-button-fav, [data-id="' + pid + '"] .recent-card-button-fav').forEach(function(otherBtn) {
        setFavoriteButtonState(otherBtn, isOn);
      });
    }

    function updateStorefrontFavoriteDecorators(pid, isOn) {
      var menuStar = wrap.querySelector('.post-storefront-menu-item-favstar[data-post-id="' + pid + '"]');
      if (!isOn && menuStar) {
        menuStar.remove();
      } else if (isOn && !menuStar) {
        var selItem = wrap.querySelector('.post-storefront-menu-item--selected');
        if (selItem) {
          var ms = document.createElement('span');
          ms.className = 'post-storefront-menu-item-favstar';
          ms.setAttribute('aria-pressed', 'true');
          ms.setAttribute('data-post-id', pid);
          ms.setAttribute('aria-hidden', 'true');
          var mt = selItem.querySelector('.post-storefront-menu-thumb');
          if (mt) mt.insertAdjacentElement('afterend', ms);
        }
      }

      var hdrWrap = wrap.querySelector('.post-header-row-storefront-wrap[data-post-id="' + pid + '"]');
      if (hdrWrap) {
        var hdrDot = hdrWrap.querySelector('.post-header-row-storefront-favdot');
        if (!isOn && hdrDot) {
          hdrDot.remove();
        } else if (isOn && !hdrDot) {
          var dot = document.createElement('span');
          dot.className = 'post-header-row-storefront-favdot';
          dot.setAttribute('aria-hidden', 'true');
          hdrWrap.appendChild(dot);
        }
      }

      var slot = wrap.closest('.post-main-container');
      if (slot) {
        var cardWrap = slot.querySelector('.post-card-row-storefront-wrap[data-post-id="' + pid + '"]');
        if (cardWrap) {
          var cardStar = cardWrap.querySelector('.post-card-row-storefront-favstar');
          if (!isOn && cardStar) {
            cardStar.remove();
          } else if (isOn && !cardStar) {
            var cs = document.createElement('span');
            cs.className = 'post-card-row-storefront-favstar';
            cs.setAttribute('aria-hidden', 'true');
            cardWrap.appendChild(cs);
          }
        }
      }
    }

    function sortStorefrontFavoriteRows() {
      function sortByFavTs(a, b) {
        var aTs = getFavoriteTimestamp(a.dataset.postId || '');
        var bTs = getFavoriteTimestamp(b.dataset.postId || '');
        var aF = aTs ? 0 : 1;
        var bF = bTs ? 0 : 1;
        if (aF !== bF) return aF - bF;
        if (aTs && bTs) return bTs - aTs;
        return 0;
      }

      var menuEl = wrap.querySelector('.post-storefront-menu');
      if (menuEl) {
        var menuItems = Array.prototype.slice.call(menuEl.querySelectorAll('.post-storefront-menu-item'));
        menuItems.sort(sortByFavTs);
        menuItems.forEach(function(item) { menuEl.appendChild(item); });
      }

      var hdrRow = wrap.querySelector('.post-header-row-storefront');
      if (hdrRow) {
        var hdrWraps = Array.prototype.slice.call(hdrRow.querySelectorAll('.post-header-row-storefront-wrap'));
        hdrWraps.sort(sortByFavTs);
        var hdrOverflow = hdrRow.querySelector('.post-header-row-storefront-overflow');
        hdrWraps.forEach(function(item) { hdrRow.insertBefore(item, hdrOverflow); });
      }

      var slot = wrap.closest('.post-main-container');
      if (slot) {
        var pcRow = slot.querySelector('.post-card-row-storefront');
        if (pcRow) {
          var pcWraps = Array.prototype.slice.call(pcRow.querySelectorAll('.post-card-row-storefront-wrap'));
          pcWraps.sort(sortByFavTs);
          pcWraps.forEach(function(item) { pcRow.appendChild(item); });
        }
      }
    }

    function syncStorefrontPassiveFavoriteButtons() {
      if (!sfMenuPosts || sfMenuPosts.length < 2) return;

      var sfInd = wrap.querySelector('.post-header-fav-indicator[data-sf-ids]');
      if (sfInd) {
        var ids = (sfInd.dataset.sfIds || '').split(',');
        var anyFav = ids.some(function(id) { return isFavorite(id); });
        sfInd.setAttribute('aria-pressed', anyFav ? 'true' : 'false');
      }

      var slot = wrap.closest('.post-main-container');
      if (slot) {
        var pcIds = slot.querySelectorAll('.post-card-row-storefront-wrap[data-post-id]');
        if (pcIds.length) {
          var pcFav = slot.querySelector('.post-card-button-fav');
          if (pcFav) {
            var pcAny = false;
            pcIds.forEach(function(item) { if (isFavorite(item.dataset.postId)) pcAny = true; });
            pcFav.setAttribute('aria-pressed', pcAny ? 'true' : 'false');
          }
        }
      }
    }

    // Storefront menu init
    if (sfMenuPosts && sfMenuPosts.length > 1) {
      StorefrontMenuComponent.init(wrap, sfMenuPosts, {
        onPostSelected: function(menuPost, idx, contentEl) {
          var selectedPost = menuPost._post;
          addToRecentHistory(selectedPost, 0);

          // ── Cancel any in-progress swap animation ──
          if (contentEl.__sfSwapTimer) {
            clearTimeout(contentEl.__sfSwapTimer);
            contentEl.__sfSwapTimer = null;
          }
          if (contentEl.__sfSwapSiblings) {
            for (var _cssi = 0; _cssi < contentEl.__sfSwapSiblings.length; _cssi++) {
              contentEl.__sfSwapSiblings[_cssi].style.transform = '';
              contentEl.__sfSwapSiblings[_cssi].style.transition = '';
            }
            contentEl.__sfSwapSiblings = null;
          }
          var _keptSub = null;
          var _child = contentEl.firstElementChild;
          while (_child) {
            var _next = _child.nextElementSibling;
            if (_child.dataset.sfSwapId) {
              _child.style.overflow = '';
              _child.style.transition = '';
              _child.style.transform = '';
              var _cTrack = _child.firstChild;
              if (_cTrack) { _cTrack.style.transition = ''; _cTrack.style.transform = ''; }
              if (!_keptSub && _cTrack && _cTrack.children.length > 0) {
                _keptSub = _child;
              } else {
                _child.remove();
              }
            }
            _child = _next;
          }

          var outgoingSub = _keptSub;
          var outgoingTrack = outgoingSub ? outgoingSub.firstChild : null;

          var incomingSub = document.createElement('div');
          incomingSub.dataset.sfSwapId = String(selectedPost.id);
          var incomingTrack = document.createElement('div');
          incomingSub.appendChild(incomingTrack);

          if (outgoingSub) {
            contentEl.insertBefore(incomingSub, outgoingSub);
          } else {
            contentEl.appendChild(incomingSub);
          }

          var _swapGen = (contentEl.__sfSwapGen = (contentEl.__sfSwapGen || 0) + 1);

          loadPostById(selectedPost.id).then(function(fullPost) {
            if (contentEl.__sfSwapGen !== _swapGen) return;
            if (!fullPost) { incomingSub.remove(); return; }
            if (!incomingSub.parentNode) return;

            if (fullPost.subcategory_color) {
              var _sfHex = fullPost.subcategory_color.replace('#', '');
              var _sfR = parseInt(_sfHex.substring(0, 2), 16);
              var _sfG = parseInt(_sfHex.substring(2, 4), 16);
              var _sfB = parseInt(_sfHex.substring(4, 6), 16);
              wrap.style.setProperty('--post-subcat-overlay', 'rgba(' + _sfR + ',' + _sfG + ',' + _sfB + ',1)');
            } else {
              wrap.style.removeProperty('--post-subcat-overlay');
            }
            var pick = pickMapCardInCurrentBounds(fullPost);
            var mcIdx = 0;
            if (pick && pick.mapCard && fullPost.map_cards) {
              for (var mi = 0; mi < fullPost.map_cards.length; mi++) {
                if (String(fullPost.map_cards[mi].id) === String(pick.mapCard.id)) { mcIdx = mi; break; }
              }
            }
            var tempDetail = buildPostDetail(fullPost, null, false, mcIdx);
            tempDetail.classList.remove('component-locationwallpaper-container');
            var postHeader = tempDetail.querySelector('.post-header');
            var postBody = tempDetail.querySelector('.post-body');

            wrap.classList.remove('post--expanded');

            if (postHeader) {
              incomingTrack.appendChild(postHeader);
              var sfFavBtn = postHeader.querySelector('.post-header-button-fav');
              if (sfFavBtn) {
                var sfFavBtnClean = sfFavBtn.cloneNode(true);
                sfFavBtn.parentNode.replaceChild(sfFavBtnClean, sfFavBtn);
                sfFavBtnClean.addEventListener('click', function(e) {
                  e.stopPropagation();
                  var pid = String(fullPost.id);
                  var nowPressed = sfFavBtnClean.getAttribute('aria-pressed') !== 'true';
                  setFavoriteButtonState(sfFavBtnClean, nowPressed);
                  syncCardFavoriteButtons(pid, nowPressed);
                  saveFavorite(pid, nowPressed);
                  updateStorefrontFavoriteDecorators(pid, nowPressed);
                  sortStorefrontFavoriteRows();
                  syncStorefrontPassiveFavoriteButtons();
                  if (favToTop) {
                    favSortDirty = true;
                  }
                });
              }
              var sfShareBtn = postHeader.querySelector('.post-button-share');
              if (sfShareBtn) {
                sfShareBtn.addEventListener('click', function(e) {
                  e.stopPropagation();
                  sharePost(fullPost);
                });
              }
            }
            if (postBody) incomingTrack.appendChild(postBody);

            if (!_sfFirstLoadFired && sfOnFirstLoadRef && typeof sfOnFirstLoadRef.fn === 'function') {
              _sfFirstLoadFired = true;
              if (outgoingSub && outgoingSub.parentNode) outgoingSub.remove();
              sfOnFirstLoadRef.fn();
            } else if (outgoingSub && outgoingSub.parentNode && outgoingTrack && _POST_ANIMATE) {
              // ── STOREFRONT SWAP ANIMATION ──────────────────────────────────────
              // Incoming: open pattern (content slides down, overflow hidden on sub).
              // Outgoing: close pattern (content slides up, overflow hidden on sub).
              // Siblings follow the outgoing — same transform, same timing.
              var _inH = incomingSub.offsetHeight;
              var _outH = outgoingSub.offsetHeight;

              var _swapSlot = contentEl.closest('.post-main-container') || contentEl.closest('.recent-main-container');
              if (_swapSlot) _cancelSlotAnimation(_swapSlot);

              // Collect siblings (same pattern as close animation)
              var _swapSiblings = [];
              if (_swapSlot) {
                var _swapSibStart = (_swapSlot.parentElement && (_swapSlot.parentElement.classList.contains('post-outer-container') || _swapSlot.parentElement.classList.contains('recent-outer-container'))) ? _swapSlot.parentElement : _swapSlot;
                var _swapSib = _swapSibStart.nextElementSibling;
                while (_swapSib) { _swapSiblings.push(_swapSib); _swapSib = _swapSib.nextElementSibling; }
                var _swapSibList = _swapSibStart.parentElement;
                if (_swapSibList && (_swapSibList.classList.contains('post-list') || _swapSibList.classList.contains('recent-list'))) {
                  var _swapListSib = _swapSibList.nextElementSibling;
                  while (_swapListSib) { _swapSiblings.push(_swapListSib); _swapListSib = _swapListSib.nextElementSibling; }
                }
              }

              var _swapScrollEl = _swapSlot ? (_swapSlot.closest('.post-list') || _swapSlot.closest('.recent-panel-content')) : null;
              if (_swapScrollEl && window.BottomSlack && typeof BottomSlack.get === 'function') {
                var _swapBsCtrl = BottomSlack.get(_swapScrollEl);
                if (_swapBsCtrl && typeof _swapBsCtrl.hold === 'function') _swapBsCtrl.hold(Math.round(_POST_ANIM_DUR * 1000) + 40);
              }

              // ── INCOMING: open pattern — content hidden above clip, slides down ──
              incomingSub.style.overflow = 'hidden';
              incomingTrack.style.transition = 'none';
              incomingTrack.style.transform = 'translateY(-' + _inH + 'px)';

              // ── OUTGOING: close pattern — content visible, will slide up ──
              // translateY(-inH) compensates for incoming sub pushing it down in flow
              outgoingSub.style.overflow = 'hidden';
              outgoingSub.style.transition = 'none';
              outgoingSub.style.transform = 'translateY(-' + _inH + 'px)';
              outgoingTrack.style.transition = 'none';
              outgoingTrack.style.transform = 'translateY(0)';

              // Siblings: translateY(-inH) compensates for incoming sub's DOM height
              for (var _swi = 0; _swi < _swapSiblings.length; _swi++) {
                _swapSiblings[_swi].style.transition = 'none';
                _swapSiblings[_swi].style.transform = 'translateY(-' + _inH + 'px)';
              }
              contentEl.__sfSwapSiblings = _swapSiblings;

              contentEl.getBoundingClientRect();

              var _swapTrans = 'transform ' + _POST_ANIM_DUR + 's ease';

              // Incoming: content slides down into view
              incomingTrack.style.transition = _swapTrans;
              incomingTrack.style.transform = 'translateY(0)';

              // Outgoing sub returns to natural DOM position as incoming grows
              outgoingSub.style.transition = _swapTrans;
              outgoingSub.style.transform = 'translateY(0)';

              // Outgoing content slides up (close pattern)
              outgoingTrack.style.transition = _swapTrans;
              outgoingTrack.style.transform = 'translateY(-' + _outH + 'px)';

              // Siblings end at translateY(-outH) — when outgoing is removed at
              // cleanup, they shift up by outH naturally, cancelling the translateY
              for (var _swi2 = 0; _swi2 < _swapSiblings.length; _swi2++) {
                _swapSiblings[_swi2].style.transition = _swapTrans;
                _swapSiblings[_swi2].style.transform = 'translateY(-' + _outH + 'px)';
              }

              contentEl.__sfSwapTimer = setTimeout(function() {
                outgoingSub.remove();
                incomingSub.style.overflow = '';
                incomingTrack.style.transition = '';
                incomingTrack.style.transform = '';
                for (var _swi3 = 0; _swi3 < _swapSiblings.length; _swi3++) {
                  _swapSiblings[_swi3].style.transform = '';
                  _swapSiblings[_swi3].style.transition = '';
                }
                contentEl.__sfSwapSiblings = null;
                contentEl.__sfSwapTimer = null;
              }, Math.round(_POST_ANIM_DUR * 1000) + 20);
              // ── END STOREFRONT SWAP ANIMATION ──────────────────────────────────
            } else if (outgoingSub && outgoingSub.parentNode) {
              outgoingSub.remove();
            }

            new MutationObserver(function() {
              wrap.classList.toggle('post--expanded', tempDetail.classList.contains('post--expanded'));
            }).observe(tempDetail, { attributes: true, attributeFilter: ['class'] });

            if (postHeader) {
              postHeader.addEventListener('click', function(e) {
                if (e.target.closest('button, a')) return;
                var seeLess = contentEl.querySelector('.post-description-seeless');
                if (seeLess) {
                  seeLess.click();
                } else {
                  tempDetail.classList.remove('post--expanded');
                }
              });
            }
          });
        }
      });

      // Auto-open the requested post (from marquee/map click) or first in the menu
      var targetItem = sfOpenPostId ? wrap.querySelector('.post-storefront-menu-item[data-post-id="' + sfOpenPostId + '"]') : null;
      if (!targetItem) targetItem = wrap.querySelector('.post-storefront-menu-item');
      if (targetItem) targetItem.click();
    }

    // Post header click closes the post. Storefronts close from the storefront header only.
    var isStorefront = sfMenuPosts && sfMenuPosts.length > 1;
    var closeHeader = isStorefront
      ? wrap.querySelector('.post-header--storefront')
      : wrap.querySelector('.post-header');
    if (closeHeader) {
      closeHeader.addEventListener('click', function(e) {
        if (e.target.closest('button, a')) return;
        var parentPost = closeHeader.closest('.post');
        if (parentPost && parentPost.querySelector('.post-header--storefront') && !closeHeader.classList.contains('post-header--storefront')) return;
        closePost(post.id);
      });
    }

    // Favorite button on card:
    // IMPORTANT: do not bind a second handler to the card's fav button.
    // The reused `cardEl` already has its own favourite handler from `renderPostCard` / `renderRecentCard`.
    // Double-binding causes a double-toggle (appears "not working") when the post is open.

    // Favorite button on post header (separate element, needs its own handler)
    var headerFavBtn = wrap.querySelector('.post-header-button-fav');
    if (headerFavBtn) {
      headerFavBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var postId = post.id;
        var pid = String(postId);
        var nowPressed = headerFavBtn.getAttribute('aria-pressed') !== 'true';
        setFavoriteButtonState(headerFavBtn, nowPressed);
        syncCardFavoriteButtons(pid, nowPressed);
        saveFavorite(postId, nowPressed);
        updateStorefrontFavoriteDecorators(pid, nowPressed);
        syncStorefrontPassiveFavoriteButtons();
        if (favToTop) {
          favSortDirty = true;
        }
      });
    }

    // Share button (in post header)
    var shareBtn = wrap.querySelector('.post-button-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sharePost(post);
      });
    }

    // Location component initialization
    var locationApi = PostLocationComponent.init(wrap, post, {
      getLocationListForUi: function() {
        var list = null;
        try { list = wrap.__postLocationList; } catch (_e) { list = null; }
        if (Array.isArray(list) && list.length) return list;
        return post.map_cards || [];
      },
      getMapCardIndexById: function(postObj, mapCardId) {
        if (!postObj || !mapCardId || !postObj.map_cards) return 0;
        for (var i = 0; i < postObj.map_cards.length; i++) {
          if (String(postObj.map_cards[i].id) === String(mapCardId)) return i;
        }
        return 0;
      },
      isLocationFiltered: isLocationFiltered,
      buildPostDetail: buildPostDetail,
      addToRecentHistory: addToRecentHistory,
      openPost: openPost,
      openPostById: openPostById,
      loadPostById: loadPostById,
      getModeButton: getModeButton,
      getCurrentMode: function() { return currentMode; },
      isPostsEnabled: function() { return postsEnabled; }
    });

    // Session component initialization
    var locationSelectedIndex = 0;
    var sessionApi = PostSessionComponent.init(wrap, post, {
      escapeHtml: escapeHtml,
      getLocationListForUi: function() {
        var list = null;
        try { list = wrap.__postLocationList; } catch (_e) { list = null; }
        if (Array.isArray(list) && list.length) return list;
        return post.map_cards || [];
      },
      getLocationSelectedIndex: function() { return locationSelectedIndex; },
      closeLocationDropdown: function() {
        if (locationApi && locationApi.close) locationApi.close();
      }
    });

    // Item pricing component initialization (async message loading)
    PostItemComponent.init(wrap);

    // IMPORTANT:
    // Menu buttons stopPropagation() to avoid unwanted post-close/selection clicks.
    // That prevents bubble-phase "click-outside" handlers from running when you click INSIDE
    // another menu, leaving the first menu open.
    //
    // Fix: capture-phase handler closes OTHER open menus before any target handlers run.
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !target.closest) return;

      var clickedMenu = target.closest('.post-location-container, .post-session-container, .post-price-container');

      function safeCloseLocation() {
        try {
          if (locationApi && locationApi.close) locationApi.close();
        } catch (_e0) {}
      }
      function safeCloseSession() {
        try {
          if (sessionApi && sessionApi.close) sessionApi.close();
        } catch (_e1) {}
      }

      // Clicked outside all post menus: close any open menus.
      if (!clickedMenu) {
        safeCloseLocation();
        safeCloseSession();
        return;
      }

      // Clicked inside one menu: close the others.
      if (clickedMenu.classList.contains('post-location-container')) {
        safeCloseSession();
        return;
      }
      if (clickedMenu.classList.contains('post-session-container')) {
        safeCloseLocation();
        return;
      }
      if (clickedMenu.classList.contains('post-price-container')) {
        safeCloseLocation();
        safeCloseSession();
        return;
      }
    }, true); // capture

    // Old session code removed - now handled by PostSessionComponent.init()

    /* ........................................................................
       REMOVED: POST SESSION MENU
       Now handled by PostSessionComponent in components.js
       ........................................................................ */

    /* Session code moved to PostSessionComponent - see components.js
       All session logic is now in PostSessionComponent.init() in components.js
       Removed ~800 lines of dead code from here */

    /* Session code END - all moved to PostSessionComponent */

    /* ........................................................................
       IMAGE GALLERY [COMPONENT PLACEHOLDER: ImageGalleryComponent]
       Hero image + thumbnail row with click-to-swap + lightbox
       Future: Will become ImageGalleryComponent with swipe, zoom
       ........................................................................ */

    var thumbnails = wrap.querySelectorAll('.post-thumbs img');
    var heroContainer = wrap.querySelector('.post-hero');
    var trackEl = wrap.querySelector('.post-track-hero');
    var baseImg = trackEl ? trackEl.querySelector('img') : null;
    
    // Gather all full-size image URLs for the gallery
    var galleryImages = [];
    var galleryRawImages = [];
    thumbnails.forEach(function(thumb) {
      var fullUrl = thumb.dataset.fullUrl || '';
      var rawUrl = thumb.dataset.rawUrl || fullUrl;
      if (fullUrl) {
        galleryImages.push(fullUrl);
        galleryRawImages.push(rawUrl);
      }
    });
    
    // If no thumbnails but hero has an image, use that
    if (galleryImages.length === 0 && baseImg && baseImg.dataset.full) {
      galleryImages.push(baseImg.dataset.full);
      galleryRawImages.push(baseImg.dataset.raw || baseImg.dataset.full);
    }
    
    // Slides array - sparse, populated on-demand when user swipes
    var slides = [];
    if (baseImg && trackEl) {
      baseImg.dataset.index = '0';
      baseImg.dataset.full = galleryImages[0] || '';
      baseImg.style.left = '0';
      slides[0] = baseImg;
      trackEl.style.transform = 'translateX(0)';
    }
    
    // Create slide on-demand (only when user swipes)
    function ensureSlide(idx) {
      if (!trackEl || idx < 0 || idx >= galleryImages.length) return null;
      if (slides[idx]) return slides[idx];
      
      var slide = document.createElement('img');
      slide.className = 'post-image-hero';
      slide.dataset.index = String(idx);
      slide.dataset.full = galleryImages[idx];
      slide.style.left = (idx * 100) + '%';
      slide.alt = '';
      slide.decoding = 'async';
      slide.src = addImageClass(galleryImages[idx], 'imagebox');
      trackEl.appendChild(slide);
      slides[idx] = slide;
      return slide;
    }
    
    // Track current gallery index
    var currentGalleryIndex = 0;
    
    // Clamp index to valid range
    function clampIdx(idx) {
      return Math.min(Math.max(idx, 0), galleryImages.length - 1);
    }
    
    // Move track to show specific image index
    function moveTo(idx, options) {
      if (!trackEl) return;
      var instant = options && options.instant;
      if (instant) {
        trackEl.style.transition = 'none';
        trackEl.style.transform = 'translateX(-' + (idx * 100) + '%)';
        // Force reflow then restore CSS transition
        trackEl.offsetHeight;
        trackEl.style.transition = '';
      } else {
        // Let CSS handle the transition (0.3s cubic-bezier)
        trackEl.style.transition = '';
        trackEl.style.transform = 'translateX(-' + (idx * 100) + '%)';
      }
    }
    
    // Show image at index
    function show(idx, options) {
      idx = clampIdx(idx);
      var instant = options && options.instant;
      var prevIdx = currentGalleryIndex;
      currentGalleryIndex = idx;
      
      if (prevIdx !== idx || instant) {
        moveTo(idx, { instant: instant });
      }
      
      // Update active states
      slides.forEach(function(img, i) {
        if (img) img.classList.toggle('active', i === idx);
      });
      thumbnails.forEach(function(t, i) {
        t.classList.toggle('post-image-thumb--active', i === idx);
      });
      
      // Scroll thumbnail into view
      var thumbRow = wrap.querySelector('.post-thumbs');
      var activeThumb = thumbRow ? thumbRow.querySelector('img[data-index="' + idx + '"]') : null;
      if (thumbRow && activeThumb) {
        var rowRect = thumbRow.getBoundingClientRect();
        var tRect = activeThumb.getBoundingClientRect();
        if (tRect.left < rowRect.left) {
          thumbRow.scrollBy({ left: tRect.left - rowRect.left - 8, behavior: 'smooth' });
        } else if (tRect.right > rowRect.right) {
          thumbRow.scrollBy({ left: tRect.right - rowRect.right + 8, behavior: 'smooth' });
        }
      }
    }
    
    // Initialize first slide
    show(0, { instant: true });
    
    // Thumbnail clicks
    thumbnails.forEach(function(thumb, idx) {
      thumb.addEventListener('click', function() {
        ensureSlide(idx);
        show(idx);
      });
    });
    
    // Variant chip clicks switch to linked image
    wrap.querySelectorAll('.post-item-variant[data-image-index]').forEach(function(chip) {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', function() {
        var idx = parseInt(chip.dataset.imageIndex, 10);
        if (Number.isFinite(idx) && idx >= 0 && idx < galleryImages.length) {
          ensureSlide(idx);
          show(idx);
        }
      });
    });
    
    // Enable horizontal mousewheel scrolling on thumbnail row
    var thumbRow = wrap.querySelector('.post-thumbs');
    if (thumbRow) {
      thumbRow.addEventListener('wheel', function(e) {
        if (e.deltaY !== 0 && thumbRow.scrollWidth > thumbRow.clientWidth) {
          e.preventDefault();
          thumbRow.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
    
    // Hero image click opens lightbox
    if (heroContainer && galleryImages.length > 0) {
      heroContainer.classList.add('post-hero--clickable');
      heroContainer.addEventListener('click', function(e) {
        // Prevent click right after drag
        if (e.target.closest('.post-track-hero') && lastDragTime && Date.now() - lastDragTime < 400) {
          e.preventDefault();
          return;
        }
        if (window.ImageModalComponent) {
          var currentRaw = galleryRawImages[currentGalleryIndex] || galleryRawImages[0];
          ImageModalComponent.open(currentRaw, {
            images: galleryRawImages,
            startIndex: currentGalleryIndex
          });
        }
      });
    }
    
    // Touch swipe support - drag the entire track (like old site)
    var dragStartX = null;
    var dragStartY = null;
    var dragActive = false;
    var lastDragTime = 0;
    
    function resetDragState() {
      dragStartX = null;
      dragStartY = null;
      dragActive = false;
    }
    
    if (heroContainer && galleryImages.length > 1) {
      var wrapClone = null;
      
      heroContainer.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragActive = false;
        
        // Create adjacent slides on-demand when user starts touching
        ensureSlide(currentGalleryIndex - 1);
        ensureSlide(currentGalleryIndex + 1);
        
        // Pre-create wrap clones so they're ready when dragging
        if (wrapClone && wrapClone.parentNode) {
          wrapClone.parentNode.removeChild(wrapClone);
          wrapClone = null;
        }
        
        var len = galleryImages.length;
        if (len > 1 && trackEl) {
          // At last image - create clone of first at position len*100%
          // At first image - create clone of last at position -100%
          if (currentGalleryIndex === len - 1) {
            ensureSlide(0);
            wrapClone = document.createElement('img');
            wrapClone.className = 'post-image-hero';
            wrapClone.src = slides[0] ? slides[0].src : addImageClass(galleryImages[0], 'imagebox');
            wrapClone.style.left = (len * 100) + '%';
            wrapClone.alt = '';
            trackEl.appendChild(wrapClone);
          } else if (currentGalleryIndex === 0) {
            ensureSlide(len - 1);
            wrapClone = document.createElement('img');
            wrapClone.className = 'post-image-hero';
            wrapClone.src = slides[len - 1] ? slides[len - 1].src : addImageClass(galleryImages[len - 1], 'imagebox');
            wrapClone.style.left = '-100%';
            wrapClone.alt = '';
            trackEl.appendChild(wrapClone);
          }
        }
      }, { passive: true });
      
      heroContainer.addEventListener('touchmove', function(e) {
        if (dragStartX === null || !trackEl) return;
        var touch = e.touches[0];
        var deltaX = touch.clientX - dragStartX;
        var deltaY = touch.clientY - dragStartY;
        
        if (!dragActive) {
          if (Math.abs(deltaX) < 5) return;
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            resetDragState();
            return;
          }
          dragActive = true;
          trackEl.style.transition = 'none';
        }
        
        var width = heroContainer.clientWidth || 1;
        var deltaPercent = (deltaX / width) * 100;
        var basePercent = -currentGalleryIndex * 100;
        trackEl.style.transform = 'translateX(' + (basePercent + deltaPercent) + '%)';
        e.preventDefault();
      }, { passive: false });
      
      heroContainer.addEventListener('touchend', function(e) {
        if (dragStartX === null) {
          resetDragState();
          return;
        }
        var deltaX = e.changedTouches[0].clientX - dragStartX;
        if (dragActive) {
          var prevIdx = currentGalleryIndex;
          var targetIdx = prevIdx;
          var threshold = (heroContainer.clientWidth || 1) * 0.15;
          var len = galleryImages.length;
          var isWrap = false;
          var wrapPos = 0;
          
          if (deltaX <= -threshold) {
            // Swipe left - next
            if (prevIdx === len - 1) {
              targetIdx = 0;
              isWrap = true;
              wrapPos = len * 100; // Clone is at this position
            } else {
              targetIdx = prevIdx + 1;
            }
          } else if (deltaX >= threshold) {
            // Swipe right - prev
            if (prevIdx === 0) {
              targetIdx = len - 1;
              isWrap = true;
              wrapPos = -100; // Clone is at this position
            } else {
              targetIdx = prevIdx - 1;
            }
          }
          
          lastDragTime = Date.now();
          
          if (isWrap && trackEl && wrapClone) {
            // Animate to the pre-created clone position
            trackEl.style.transition = '';
            trackEl.style.transform = 'translateX(' + (-wrapPos) + '%)';
            
            setTimeout(function() {
              // Reset to actual position and remove clone
              trackEl.style.transition = 'none';
              trackEl.style.transform = 'translateX(-' + (targetIdx * 100) + '%)';
              if (wrapClone && wrapClone.parentNode) {
                wrapClone.parentNode.removeChild(wrapClone);
                wrapClone = null;
              }
              trackEl.offsetHeight;
              trackEl.style.transition = '';
              
              currentGalleryIndex = targetIdx;
              slides.forEach(function(img, i) {
                if (img) img.classList.toggle('active', i === targetIdx);
              });
              thumbnails.forEach(function(t, i) {
                t.classList.toggle('post-image-thumb--active', i === targetIdx);
              });
            }, 300);
          } else {
            // Clean up clone if not wrapping
            if (wrapClone && wrapClone.parentNode) {
              wrapClone.parentNode.removeChild(wrapClone);
              wrapClone = null;
            }
            ensureSlide(targetIdx);
            show(targetIdx);
          }
        } else {
          // No drag happened - clean up clone
          if (wrapClone && wrapClone.parentNode) {
            wrapClone.parentNode.removeChild(wrapClone);
            wrapClone = null;
          }
        }
        resetDragState();
      }, { passive: true });
      
      heroContainer.addEventListener('touchcancel', function() {
        if (wrapClone && wrapClone.parentNode) {
          wrapClone.parentNode.removeChild(wrapClone);
          wrapClone = null;
        }
        if (dragActive) {
          show(currentGalleryIndex);
        }
        resetDragState();
      }, { passive: true });
    }

    /* ........................................................................
       DESCRIPTION EXPAND (Facebook-style inline "See more")
       Click/keyboard to toggle post detail expansion
       ........................................................................ */

    var descEl = wrap.querySelector('.post-description-text');
    if (descEl) {
      var fullText = descEl.getAttribute('data-full-text') || '';
      var truncatedText = '';
      var needsTruncation = false;

      // Apply truncation after element is in DOM (needs to measure)
      function applyTruncation() {
        var result = truncateTextToLines(descEl, fullText, '... See more', 2);
        truncatedText = result.truncated;
        needsTruncation = result.needsTruncation;
        
        if (needsTruncation) {
          // Show truncated text with inline "See more" link
          var textPart = truncatedText.replace(/\.\.\. See more$/, '');
          descEl.innerHTML = escapeHtml(textPart).replace(/\n/g, '<br>') + '<span class="post-description-seemore">... See more</span>';
        } else {
          // Text fits but still show "See more" (expands to show member info)
          descEl.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br>') + ' <span class="post-description-seemore">See more</span>';
        }
      }

      // Show expanded text with inline "See less" link
      function showExpanded() {
        descEl.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br>') + ' <span class="post-description-seeless">See less</span>';
        
        // Re-attach See less click handler
        var seeLessEl = descEl.querySelector('.post-description-seeless');
        if (seeLessEl) {
          seeLessEl.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            _animateCollapse();
          });
        }
      }

      // Show collapsed/truncated text
      function showCollapsed() {
        if (needsTruncation) {
          var textPart = truncatedText.replace(/\.\.\. See more$/, '');
          descEl.innerHTML = escapeHtml(textPart).replace(/\n/g, '<br>') + '<span class="post-description-seemore">... See more</span>';
        } else {
          // Text fits but still show "See more" (expands to show member info)
          descEl.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br>') + ' <span class="post-description-seemore">See more</span>';
        }
      }

      function syncLocationWallpaper(isExpandedNow) {
        
        // Only for .post wrappers that were wired with lat/lng (component-locationwallpaper-container class added in buildPostDetail).
        if (!wrap || !(wrap instanceof Element)) return;
        if (!wrap.classList || !wrap.classList.contains('component-locationwallpaper-container')) return;

        try {
          if (isExpandedNow) {
            // Activate and refresh wallpaper
            wrap.setAttribute('data-active', 'true');
            if (wrap.__locationWallpaperCtrl && typeof wrap.__locationWallpaperCtrl.refresh === 'function') {
              wrap.__locationWallpaperCtrl.refresh();
              return;
            }
            if (window.LocationWallpaperComponent &&
                typeof LocationWallpaperComponent.install === 'function' &&
                typeof LocationWallpaperComponent.handleActiveContainerChange === 'function') {
              LocationWallpaperComponent.install(wrap);
              LocationWallpaperComponent.handleActiveContainerChange(wrap, wrap);
            }
          } else {
            // Destroy wallpaper when post closes (post is no longer visible)
            wrap.removeAttribute('data-active');
            if (wrap.__locationWallpaperCtrl && typeof wrap.__locationWallpaperCtrl.destroy === 'function') {
              wrap.__locationWallpaperCtrl.destroy();
            }
          }
        } catch (_eLWPost) {}
      }

      // Apply truncation once element is in DOM and has width
      requestAnimationFrame(function() {
        applyTruncation();
      });

      function _animateCollapse() {
        applyPostInteractionSettings();
        // For storefront sub-posts, wrap is a detached tempDetail node; resolve the real DOM wrap.
        var _realWrap = descEl.closest('.post') || wrap;
        var _bodyEl   = _realWrap.querySelector('.post-body');
        var _imgEl    = _realWrap.querySelector('.post-images-container');
        var _thumbsEl = _imgEl ? _imgEl.querySelector('.post-thumbs') : null;
        var _infoEl   = _realWrap.querySelector('.post-info-container');
        var _memberEl = _realWrap.querySelector('.post-description-member');

        if (!_POST_ANIMATE) {
          _realWrap.classList.remove('post--expanded');
          descEl.setAttribute('aria-expanded', 'false');
          showCollapsed();
          syncLocationWallpaper(false);
          return;
        }

        // Capture expanded positions
        var _bodyExpandedH   = _bodyEl ? _bodyEl.offsetHeight : 0;
        var _imgExpandedRect = _imgEl ? _imgEl.getBoundingClientRect() : null;

        // Silent measurement pass: temporarily collapse AND call showCollapsed() so the description
        // is truncated during measurement. Without this, _bodyCollapsedH includes the full description
        // text, making _delta far too small and causing the animation to only cover a fraction of the
        // real distance before the class removal snaps the rest.
        var _savedDescHtml = descEl.innerHTML;
        _realWrap.classList.remove('post--expanded');
        showCollapsed();
        if (_bodyEl) _bodyEl.getBoundingClientRect();
        var _bodyCollapsedH   = _bodyEl ? _bodyEl.offsetHeight : 0;
        var _imgCollapsedRect = _imgEl ? _imgEl.getBoundingClientRect() : null;
        // Restore expanded state for the animation
        descEl.innerHTML = _savedDescHtml;
        _realWrap.classList.add('post--expanded');
        if (_bodyEl) _bodyEl.getBoundingClientRect();

        var _imgOffset = (_imgExpandedRect && _imgCollapsedRect) ? (_imgExpandedRect.top - _imgCollapsedRect.top) : (_bodyExpandedH - _bodyCollapsedH);

        descEl.setAttribute('aria-expanded', 'false');

        var _delta = _bodyExpandedH - _bodyCollapsedH;
        // Thumbs travel the same internal distance as in expand (D_body - D_img)
        var _thumbsOffset = (_thumbsEl && _thumbsEl.offsetHeight > 0) ? (_delta - _imgOffset) : 0;

        if (_imgOffset > 0) {
          // Collect siblings below this post
          var _expSlot = _realWrap.closest('.post-main-container') || _realWrap.closest('.recent-main-container') || _realWrap.closest('.posteditor-main-container');
          var _expSiblings = [];
          if (_expSlot) {
            var _expSibStart = (_expSlot.parentElement && (_expSlot.parentElement.classList.contains('post-outer-container') || _expSlot.parentElement.classList.contains('recent-outer-container') || _expSlot.parentElement.classList.contains('posteditor-outer-container'))) ? _expSlot.parentElement : _expSlot;
            var _expActionsEl = _expSlot.nextElementSibling && _expSlot.nextElementSibling.classList.contains('posteditor-actions-container') ? _expSlot.nextElementSibling : null;
            if (_expActionsEl) _expSiblings.push(_expActionsEl);
            var _expSib = _expSibStart.nextElementSibling;
            while (_expSib) { _expSiblings.push(_expSib); _expSib = _expSib.nextElementSibling; }
            var _expSibList = _expSibStart.parentElement;
            if (_expSibList && (_expSibList.classList.contains('post-list') || _expSibList.classList.contains('recent-list'))) {
              var _expListSib = _expSibList.nextElementSibling;
              while (_expListSib) { _expSiblings.push(_expListSib); _expListSib = _expListSib.nextElementSibling; }
            }
          }

          // Fade out expanded content over full 1s — content stays visible throughout the animation
          if (_infoEl)   { _infoEl.style.transition   = 'opacity ' + _POST_ANIM_DUR + 's ease'; _infoEl.style.opacity   = '0'; }
          if (_memberEl) { _memberEl.style.transition  = 'opacity ' + _POST_ANIM_DUR + 's ease'; _memberEl.style.opacity = '0'; }
          descEl.style.transition = 'opacity ' + _POST_ANIM_DUR + 's ease';
          descEl.style.opacity    = '0';

          // Clip body so empty space below the rising image doesn't show
          if (_bodyEl) _bodyEl.style.overflow = 'hidden';

          // Force reflow to commit starting state before transitions fire
          if (_imgEl) _imgEl.getBoundingClientRect();

          // Animate image container, thumbs, and siblings UP — all locked to same duration.
          // Container travels _imgOffset, thumbs travel an additional _thumbsOffset within the container,
          // so thumbs total screen travel = _imgOffset + _thumbsOffset = _delta = same as siblings.
          if (_imgEl) { _imgEl.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease'; _imgEl.style.transform = 'translateY(-' + _imgOffset + 'px)'; }
          if (_thumbsOffset > 0) { _thumbsEl.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease'; _thumbsEl.style.transform = 'translateY(-' + _thumbsOffset + 'px)'; }
          for (var _ei = 0; _ei < _expSiblings.length; _ei++) {
            _expSiblings[_ei].style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
            _expSiblings[_ei].style.transform  = 'translateY(-' + _delta + 'px)';
          }

          setTimeout(function() {
            _realWrap.classList.remove('post--expanded');

            if (_imgEl)            { _imgEl.style.transform    = ''; _imgEl.style.transition    = ''; }
            if (_thumbsOffset > 0) { _thumbsEl.style.transform = ''; _thumbsEl.style.transition = ''; }
            if (_bodyEl)           { _bodyEl.style.overflow    = ''; }
            if (_infoEl)           { _infoEl.style.opacity     = ''; _infoEl.style.transition   = ''; }
            if (_memberEl)         { _memberEl.style.opacity   = ''; _memberEl.style.transition = ''; }
            for (var _ei2 = 0; _ei2 < _expSiblings.length; _ei2++) {
              _expSiblings[_ei2].style.transform  = '';
              _expSiblings[_ei2].style.transition = '';
            }

            showCollapsed();
            descEl.style.opacity    = '0';
            descEl.style.transition = 'none';
            descEl.getBoundingClientRect();
            descEl.style.transition = 'opacity ' + (_POST_ANIM_DUR * 0.2) + 's linear';
            descEl.style.opacity    = '1';
            setTimeout(function() { descEl.style.opacity = ''; descEl.style.transition = ''; }, Math.round(_POST_ANIM_DUR * 200) + 20);
          }, Math.round(_POST_ANIM_DUR * 1000) + 20);
        } else {
          _realWrap.classList.remove('post--expanded');
          showCollapsed();
        }

        syncLocationWallpaper(false);
        setTooltipDirs(_realWrap);
      }

      function _animateExpand() {
        applyPostInteractionSettings();
        // For storefront sub-posts, wrap is a detached tempDetail node; resolve the real DOM wrap.
        var _realWrap = descEl.closest('.post') || wrap;
        var _bodyEl   = _realWrap.querySelector('.post-body');
        var _imgEl    = _realWrap.querySelector('.post-images-container');
        var _thumbsEl = _imgEl ? _imgEl.querySelector('.post-thumbs') : null;
        var _infoEl   = _realWrap.querySelector('.post-info-container');
        var _memberEl = _realWrap.querySelector('.post-description-member');

        // Capture pre-swap image position and body height
        var _imgFirstRect = _imgEl ? _imgEl.getBoundingClientRect() : null;
        var _bodyFirstH   = _bodyEl ? _bodyEl.offsetHeight : 0;

        // Fade out the current description before swapping content
        descEl.style.transition = 'opacity ' + (_POST_ANIM_DUR * 0.2) + 's linear';
        descEl.style.opacity    = '0';

        // DOM swap
        _realWrap.classList.add('post--expanded');
        descEl.setAttribute('aria-expanded', 'true');
        showExpanded();

        if (!_POST_ANIMATE) {
          descEl.style.transition = '';
          descEl.style.opacity    = '';
          syncLocationWallpaper(true);
          setTooltipDirs(_realWrap);
          return;
        }

        // Force layout so post-swap measurements are accurate
        if (_bodyEl) _bodyEl.getBoundingClientRect();
        var _bodyLastH  = _bodyEl ? _bodyEl.offsetHeight : 0;
        var _delta      = _bodyLastH - _bodyFirstH;
        var _imgLastRect = _imgEl ? _imgEl.getBoundingClientRect() : null;
        var _imgOffset  = (_imgFirstRect && _imgLastRect) ? (_imgFirstRect.top - _imgLastRect.top) : 0;

        if (_delta > 0) {
          // Collect siblings below this post
          var _expSlot = _realWrap.closest('.post-main-container') || _realWrap.closest('.recent-main-container') || _realWrap.closest('.posteditor-main-container');
          var _expSiblings = [];
          if (_expSlot) {
            var _expSibStart = (_expSlot.parentElement && (_expSlot.parentElement.classList.contains('post-outer-container') || _expSlot.parentElement.classList.contains('recent-outer-container') || _expSlot.parentElement.classList.contains('posteditor-outer-container'))) ? _expSlot.parentElement : _expSlot;
            var _expActionsEl2 = _expSlot.nextElementSibling && _expSlot.nextElementSibling.classList.contains('posteditor-actions-container') ? _expSlot.nextElementSibling : null;
            if (_expActionsEl2) _expSiblings.push(_expActionsEl2);
            var _expSib = _expSibStart.nextElementSibling;
            while (_expSib) { _expSiblings.push(_expSib); _expSib = _expSib.nextElementSibling; }
            var _expSibList = _expSibStart.parentElement;
            if (_expSibList && (_expSibList.classList.contains('post-list') || _expSibList.classList.contains('recent-list'))) {
              var _expListSib = _expSibList.nextElementSibling;
              while (_expListSib) { _expSiblings.push(_expListSib); _expListSib = _expListSib.nextElementSibling; }
            }
          }

          // _thumbsOffset: the distance thumbs must travel WITHIN the container to reach their
          // expanded position. The container moves _imgOffset (negative = up) and the body grows
          // _delta total, so thumbs must cover the remaining _delta + _imgOffset on their own.
          // Together, container + thumbs travel exactly _delta on screen — same as siblings.
          var _thumbsOffset = (_thumbsEl && _thumbsEl.offsetHeight > 0) ? (_delta + _imgOffset) : 0;

          // Set starting state — no transitions yet
          // Image container: FLIP to its collapsed position
          if (_imgEl && _imgOffset !== 0) { _imgEl.style.transition = 'none'; _imgEl.style.transform = 'translateY(' + _imgOffset + 'px)'; }
          // Thumbs: FLIP to their collapsed overlay position (on top of the container FLIP above)
          if (_thumbsOffset > 0) { _thumbsEl.style.transition = 'none'; _thumbsEl.style.transform = 'translateY(-' + _thumbsOffset + 'px)'; }
          // New content starts invisible — fades in behind the sliding image
          if (_infoEl)   { _infoEl.style.transition   = 'none'; _infoEl.style.opacity   = '0'; }
          if (_memberEl) { _memberEl.style.transition  = 'none'; _memberEl.style.opacity = '0'; }
          // descEl is already opacity:0 from the fade-out above; keep it there until we fade in
          descEl.style.transition = 'none';
          // Siblings held at their collapsed positions (full body delta — same total screen travel as thumbs)
          for (var _ei = 0; _ei < _expSiblings.length; _ei++) {
            _expSiblings[_ei].style.transition = 'none';
            _expSiblings[_ei].style.transform  = 'translateY(-' + _delta + 'px)';
          }

          // Force reflow to commit all starting states before transitions fire
          if (_imgEl) _imgEl.getBoundingClientRect();

          // Animate everything to final positions over 1s — all locked to same duration
          if (_imgEl && _imgOffset !== 0) { _imgEl.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease'; _imgEl.style.transform = 'translateY(0)'; }
          if (_thumbsOffset > 0) { _thumbsEl.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease'; _thumbsEl.style.transform = 'translateY(0)'; }
          if (_infoEl)   { _infoEl.style.transition   = 'opacity ' + _POST_ANIM_DUR + 's ease'; _infoEl.style.opacity   = '1'; }
          if (_memberEl) { _memberEl.style.transition  = 'opacity ' + _POST_ANIM_DUR + 's ease'; _memberEl.style.opacity = '1'; }
          descEl.style.transition = 'opacity ' + _POST_ANIM_DUR + 's ease';
          descEl.style.opacity    = '1';
          for (var _ei2 = 0; _ei2 < _expSiblings.length; _ei2++) {
            _expSiblings[_ei2].style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
            _expSiblings[_ei2].style.transform  = 'translateY(0)';
          }

          setTimeout(function() {
            if (_imgEl)         { _imgEl.style.transform    = ''; _imgEl.style.transition    = ''; }
            if (_thumbsOffset > 0) { _thumbsEl.style.transform = ''; _thumbsEl.style.transition = ''; }
            if (_infoEl)        { _infoEl.style.opacity     = ''; _infoEl.style.transition   = ''; }
            if (_memberEl)      { _memberEl.style.opacity   = ''; _memberEl.style.transition = ''; }
            descEl.style.opacity    = '';
            descEl.style.transition = '';
            for (var _ei3 = 0; _ei3 < _expSiblings.length; _ei3++) {
              _expSiblings[_ei3].style.transform  = '';
              _expSiblings[_ei3].style.transition = '';
            }
          }, Math.round(_POST_ANIM_DUR * 1000) + 20);
        } else {
          // No height change — just restore description opacity
          descEl.style.transition = 'opacity ' + (_POST_ANIM_DUR * 0.3) + 's linear';
          descEl.style.opacity    = '1';
          setTimeout(function() { descEl.style.transition = ''; }, Math.round(_POST_ANIM_DUR * 300) + 20);
        }

        syncLocationWallpaper(true);
        setTooltipDirs(_realWrap);
      }

      descEl.addEventListener('click', function(e) {
        if ((descEl.closest('.post') || wrap).classList.contains('post--expanded')) {
          syncLocationWallpaper(true);
          return;
        }
        e.preventDefault();
        _animateExpand();
      });

      // Also handle keyboard for accessibility (only expand, not collapse)
      descEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if ((descEl.closest('.post') || wrap).classList.contains('post--expanded')) return;
          e.preventDefault();
          _animateExpand();
        }
      });
    }

    /* ........................................................................
       PROGRESSIVE IMAGE LOADING
       Swap low-quality placeholder with full image after load
       ........................................................................ */

    (function() {
      var img = wrap.querySelector('.post-image-hero');
      if (img) {
        var full = img.getAttribute('data-full');
        if (full) {
          var hi = new Image();
          hi.referrerPolicy = 'no-referrer';
          hi.fetchPriority = 'high';
          hi.onload = function() {
            var swap = function() {
              img.src = full;
              img.classList.remove('post-image-hero--loading');
              img.classList.add('post-image-hero--ready');
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
   * Close a post by ID.
   * Removes the detail view from its slot and restores hidden children.
   * @param {string|number} postId - Post ID
   */
  function closePost(postId) {
    applyPostInteractionSettings();
    var openPostEl = document.querySelector('.post[data-id="' + postId + '"]');
    if (!openPostEl) return;

    // Tear down locked wallpaper (storefronts) before removing the element
    try {
      if (openPostEl.__locationWallpaperCtrl && typeof openPostEl.__locationWallpaperCtrl.destroy === 'function') {
        openPostEl.__locationWallpaperCtrl.destroy();
      }
      if (openPostEl.__wallpaperLocked && window.LocationWallpaperComponent &&
          typeof LocationWallpaperComponent.handleActiveContainerChange === 'function') {
        LocationWallpaperComponent.handleActiveContainerChange(null, null);
      }
    } catch (_eWp) {}

    // Find the slot wrapper
    var slot = openPostEl.closest('.post-main-container') || openPostEl.closest('.recent-main-container') || openPostEl.closest('.posteditor-main-container');
    
    if (slot) {
      // Preserve the stored card clone across animation cancel — it was captured at open time
      var _savedCardEnterClone = slot.__cardEnterClone || null;
      var _savedOpenedFromExternal = slot.__openedFromExternal || false;
      // Cancel any in-progress animation before starting close
      _cancelSlotAnimation(slot);
      slot.__cardEnterClone = _savedCardEnterClone;
      slot.__openedFromExternal = _savedOpenedFromExternal;

      var hiddenCard = slot.querySelector('.post-card, .recent-card');

      // [Close animation] Post slides up, card slides down via fixed clone, slot shrinks
      var _closeStartH = slot.offsetHeight; // = post height (card is display:none)
      var _cardH = 0;
      var _closeCardBg = slot.__cardBg || null;
      var _cardOffsetTop = 0;
      if (hiddenCard) { hiddenCard.style.display = ''; var _cardMarginBottom = parseInt(window.getComputedStyle(hiddenCard).marginBottom) || 0; _cardH = hiddenCard.offsetHeight + _cardMarginBottom; _cardOffsetTop = Math.round(hiddenCard.getBoundingClientRect().top - slot.getBoundingClientRect().top); hiddenCard.style.display = 'none'; }
      var _closeAnimate = _POST_ANIMATE;
      if (!_closeAnimate) {
        openPostEl.remove();
        if (hiddenCard) hiddenCard.style.display = '';
        if (!slot.children.length) slot.remove();
      } else {

        // Expand and hold BottomSlack for the full animation duration so the floor
        // doesn't collapse mid-animation and throw content off the screen.
        try {
          var _bsHoldEl = slot.closest('.post-list') || slot.closest('.recent-panel-content');
          if (_bsHoldEl && window.BottomSlack && typeof BottomSlack.get === 'function') {
            var _bsHoldCtrl = BottomSlack.get(_bsHoldEl);
            if (_bsHoldCtrl && typeof _bsHoldCtrl.hold === 'function') _bsHoldCtrl.hold(Math.round(_POST_ANIM_DUR * 1000) + 20);
          }
        } catch (_eBsHold) {}

        // ── CLOSE ANIMATION: CARD ENTER ──────────────────────────────────────────
        // Stored hovered-state clone (captured at open time) slides down from the
        // invisibility shield into the card's resting position.
        // Clone lives inside slot — scrolls naturally with the panel. No coordinates needed.
        var _cardEnterClone = null;
        if (hiddenCard && _cardH > 0) {
          _cardEnterClone = slot.__cardEnterClone || null;
          slot.__cardEnterClone = null;
          if (!_cardEnterClone) {
            hiddenCard.style.display = '';
            var _isRecent = hiddenCard.classList.contains('recent-card');
            if (_isRecent) hiddenCard.classList.add('recent-card--active');
            else hiddenCard.classList.add('post-card--map-highlight');
            var _clBg = _closeCardBg || window.getComputedStyle(hiddenCard).backgroundColor;
            _cardEnterClone = hiddenCard.cloneNode(true);
            if (_isRecent) hiddenCard.classList.remove('recent-card--active');
            else hiddenCard.classList.remove('post-card--map-highlight');
            hiddenCard.style.display = 'none';
            _cardEnterClone.style.display = '';
            _cardEnterClone.style.margin = '0';
            _cardEnterClone.style.transition = 'none';
            var _clEls = _cardEnterClone.querySelectorAll('*');
            for (var _cli = 0; _cli < _clEls.length; _cli++) { _clEls[_cli].style.transition = 'none'; }
            if (_clBg && _clBg !== 'rgba(0, 0, 0, 0)' && _clBg !== 'transparent') {
              _cardEnterClone.style.backgroundColor = _clBg;
            }
          }
          if (_cardEnterClone) {
            slot.style.position = 'relative';
            _cardEnterClone.style.position = 'absolute';
            _cardEnterClone.style.top = _cardOffsetTop + 'px';
            _cardEnterClone.style.left = '0';
            _cardEnterClone.style.width = '100%';
            _cardEnterClone.style.margin = '0';
            _cardEnterClone.style.pointerEvents = 'none';
            _cardEnterClone.style.transition = 'none';
            _cardEnterClone.style.transform = 'translateY(-' + _cardH + 'px)';
            slot.appendChild(_cardEnterClone);
            slot.__animEnterClone = _cardEnterClone;
          }
        }
        // ── END CLOSE ANIMATION: CARD ENTER ─────────────────────────────────────

        // ── CLOSE ANIMATION: POST EXIT ───────────────────────────────────────────
        // Post slides up into the invisibility shield.
        // All siblings below move as one unit with the post — same transform, same timing.
        // When post is removed at end, layout is already in its final state — no snap.
        var _closeSiblings = [];
        var _closeSibStart = (slot.parentElement && (slot.parentElement.classList.contains('post-outer-container') || slot.parentElement.classList.contains('recent-outer-container') || slot.parentElement.classList.contains('posteditor-outer-container'))) ? slot.parentElement : slot;
        var _closeActionsEl = slot.nextElementSibling && slot.nextElementSibling.classList.contains('posteditor-actions-container') ? slot.nextElementSibling : null;
        if (_closeActionsEl) _closeSiblings.push(_closeActionsEl);
        var _closeSib = _closeSibStart.nextElementSibling;
        while (_closeSib) { _closeSiblings.push(_closeSib); _closeSib = _closeSib.nextElementSibling; }
        var _closeSibList = _closeSibStart.parentElement;
        if (_closeSibList && (_closeSibList.classList.contains('post-list') || _closeSibList.classList.contains('recent-list'))) {
          var _listSib = _closeSibList.nextElementSibling;
          while (_listSib) { _closeSiblings.push(_listSib); _listSib = _listSib.nextElementSibling; }
        }
        slot.style.overflow = 'hidden';
        openPostEl.style.transition = 'none';
        openPostEl.style.transform = 'translateY(0)';
        for (var _csi = 0; _csi < _closeSiblings.length; _csi++) {
          _closeSiblings[_csi].style.transition = 'none';
          _closeSiblings[_csi].style.transform = 'translateY(0)';
        }
        slot.__animCard = hiddenCard || null;
        slot.__animSiblings = _closeSiblings;

        slot.getBoundingClientRect(); // force reflow

        var _closeOffset = _closeStartH - _cardH;
        openPostEl.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
        openPostEl.style.transform = 'translateY(-' + _closeOffset + 'px)';
        for (var _csi2 = 0; _csi2 < _closeSiblings.length; _csi2++) {
          _closeSiblings[_csi2].style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
          _closeSiblings[_csi2].style.transform = 'translateY(-' + _closeOffset + 'px)';
        }
        if (_cardEnterClone) {
          _cardEnterClone.style.transition = 'transform ' + _POST_ANIM_DUR + 's ease';
          _cardEnterClone.style.transform = 'translateY(0)';
        }

        slot.__animTimer = setTimeout(function() {
          if (_cardEnterClone && _cardEnterClone.parentNode) _cardEnterClone.parentNode.removeChild(_cardEnterClone);
          slot.__animEnterClone = null;
          openPostEl.remove();
          if (hiddenCard) {
            // Suppress transitions for one frame so CSS :hover snaps instantly — no flash on reveal.
            // Storefront cards also get post-card--noanim to suppress their ::after pseudo-element transition,
            // which is not reachable via inline style.
            var _isSfCard = !!(hiddenCard.dataset && hiddenCard.dataset.storefront === '1');
            if (_isSfCard) hiddenCard.classList.add('post-card--noanim');
            hiddenCard.style.transition = 'none';
            var _hcChildren = hiddenCard.querySelectorAll('*');
            for (var _hci = 0; _hci < _hcChildren.length; _hci++) { _hcChildren[_hci].style.transition = 'none'; }
            hiddenCard.style.display = '';
            requestAnimationFrame(function() {
              if (_isSfCard) hiddenCard.classList.remove('post-card--noanim');
              hiddenCard.style.transition = '';
              for (var _hci2 = 0; _hci2 < _hcChildren.length; _hci2++) { _hcChildren[_hci2].style.transition = ''; }
            });
          }
          for (var _csi3 = 0; _csi3 < _closeSiblings.length; _csi3++) {
            _closeSiblings[_csi3].style.transform = '';
            _closeSiblings[_csi3].style.transition = '';
          }
          slot.style.overflow = '';
          slot.style.position = '';
          slot.__animCard = null;
          slot.__animSiblings = null;
          slot.__animTimer = null;
          if (!slot.children.length) slot.remove();
        }, Math.round(_POST_ANIM_DUR * 1000) + 20);
        // ── END CLOSE ANIMATION: POST EXIT ──────────────────────────────────────

      } // end if (_closeAnimate)
    } else {
      try { openPostEl.remove(); } catch (_eRemove) {}
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

    copyToClipboard(url);
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
      var favJson = JSON.stringify(favs);
      localStorage.setItem('postFavorites', favJson);
      // Background DB save for logged-in users (non-blocking)
      try {
        if (window.MemberModule && typeof MemberModule.saveSetting === 'function' && typeof MemberModule.isLoggedIn === 'function' && MemberModule.isLoggedIn()) {
          MemberModule.saveSetting('favorites', favJson);
        }
      } catch (_eDbFav) {}
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

  function getFavoriteTimestamp(postId) {
    try {
      var favs = JSON.parse(localStorage.getItem('postFavorites') || '{}');
      return Number(favs[postId]) || 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Add post to recent history
   * Tracks specific locations (post_map_card_id) so multi-location posts can have
   * separate history entries for each visited location (e.g., world tours, hotel chains).
   * @param {Object} post - Post data
   * @param {number} mapCardIndex - Index of the specific map card/location (default 0)
   */
  function addToRecentHistory(post, mapCardIndex) {
    try {
      var history = JSON.parse(localStorage.getItem('recentPosts') || '[]');
      if (!Array.isArray(history)) history = [];

      var now = Date.now();
      var postId = (post && post.id !== undefined && post.id !== null) ? String(post.id) : '';
      if (!postId) return;

      // Get the specific map card for this location
      var cardIndex = (typeof mapCardIndex === 'number' && mapCardIndex >= 0) ? mapCardIndex : 0;
      var mapCards = (post && post.map_cards && post.map_cards.length) ? post.map_cards : [];
      var mapCard = mapCards[cardIndex] || mapCards[0] || null;
      
      // Get post_map_card_id for this specific location
      var postMapCardId = (mapCard && mapCard.id) ? String(mapCard.id) : '';
      if (!postMapCardId) return; // Cannot track without post_map_card_id
      
      // Use post_map_card_id as the deduplication key (tracks specific locations)
      var dedupeKey = postMapCardId;

      // Store key display fields directly in recent history so Recents can render without any in-memory caching.
      var rawThumbUrl = getPostThumbnailUrl(post);
      var subKey = (mapCard && mapCard.subcategory_key) ? String(mapCard.subcategory_key) : String(post.subcategory_key || '');
      var subName = post.subcategory_name || (mapCard && mapCard.subcategory_name) || '';
      var iconUrl = post.subcategory_icon_url || '';
      
      // Location text from the specific map card (same formula as postcards)
      var locText = '';
      if (mapCard) {
        var locVenue = mapCard.venue_name || '';
        var locSuburb = mapCard.suburb || '';
        var locCity = mapCard.city || '';
        var locState = mapCard.state || '';
        var locCountry = mapCard.country_name || '';
        var locType = mapCard.location_type || '';
        if (locType === 'venue') {
          var locVenueSecond = locSuburb || locCity || '';
          locText = (locVenue && locVenueSecond) ? locVenue + ', ' + locVenueSecond : (locVenue || locVenueSecond || '');
        } else if (locType === 'city') {
          var locCitySecond = locState || locCountry || '';
          locText = (locCity && locCitySecond) ? locCity + ', ' + locCitySecond : (locCity || locCitySecond || '');
        } else {
          var locAddrSecond = locState || locCountry || '';
          var locAddrLocal = locSuburb || locCity || '';
          locText = (locAddrLocal && locAddrSecond) ? locAddrLocal + ', ' + locAddrSecond : (locAddrLocal || locAddrSecond || '');
        }
      }

      // Deduplicate by post_map_card_id (string-safe)
      var seen = {};
      var next = [];

      // 1) Insert/refresh this location at the top.
      var title = (mapCard && mapCard.title) || post.checkout_title || post.title || '';
      if (title === 'Array') title = 'Post #' + postId;

      // Get dates and price info (same as postcards)
      var datesText = formatPostDates(post);
      var priceSummary = (mapCard && mapCard.price_summary) ? mapCard.price_summary : (post.price_summary || '');
      var hasPromo = mapCardHasPromo(mapCard);

      next.push({
        id: postId,
        post_map_card_id: postMapCardId,
        post_key: post.post_key,
        title: title,
        thumb_url: rawThumbUrl || '',
        subcategory_key: subKey || '',
        subcategory_name: subName,
        subcategory_color: post.subcategory_color || '',
        subcategory_icon_url: iconUrl,
        location_text: locText || '',
        dates_text: datesText || '',
        price_summary: priceSummary || '',
        has_promo: hasPromo,
        first_session_date: (mapCard && mapCard.first_session_date) || '',
        expires_at: post.expires_at || '',
        timestamp: now
      });
      seen[dedupeKey] = true;

      // 2) Carry over existing entries (skip duplicates by post_map_card_id).
      for (var i = 0; i < history.length; i++) {
        var h = history[i];
        if (!h) continue;
        // Skip entries without post_map_card_id (old data will age out)
        if (!h.post_map_card_id) continue;
        if (seen[h.post_map_card_id]) continue;
        seen[h.post_map_card_id] = true;
        next.push(h);
      }

      // Keep only last 50
      next = next.slice(0, 50);
      var recentJson = JSON.stringify(next);
      localStorage.setItem('recentPosts', recentJson);
      // Background DB save for logged-in users (non-blocking)
      try {
        if (window.MemberModule && typeof MemberModule.saveSetting === 'function' && typeof MemberModule.isLoggedIn === 'function' && MemberModule.isLoggedIn()) {
          MemberModule.saveSetting('recent', recentJson);
        }
      } catch (_eDbRecent) {}
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
     FACEBOOK-STYLE TEXT TRUNCATION
     --------------------------------------------------------------------------
     
     WHAT: Truncates text to exactly N lines with "... See more" inline at the end.
     
     WHY: CSS line-clamp truncates with "..." but can't append custom text like
          "See more" inline. The old approach used an absolutely-positioned
          "See more" with a gradient fade - it looked bad because the gradient
          color often didn't match the background.
     
     HOW: 
     1. Create a hidden div with identical styles to measure text height
     2. Binary search to find the exact character where line N ends
     3. Append "... See more" and verify it still fits on line N
     4. Clean up partial words (back up to previous space)
     
     RESULT: "This is the description text that gets cut off... See more"
             appears exactly at the end of line 2, just like Facebook.
     
     -------------------------------------------------------------------------- */

  /**
   * @param {HTMLElement} container - The container element to measure against
   * @param {string} fullText - The full text to truncate
   * @param {string} suffix - The suffix to append (e.g. "... See more")
   * @param {number} maxLines - Maximum number of lines (default 2)
   * @returns {Object} { truncated: string, needsTruncation: boolean }
   */
  function truncateTextToLines(container, fullText, suffix, maxLines) {
    if (!container || !fullText) return { truncated: fullText || '', needsTruncation: false };
    maxLines = maxLines || 2;
    suffix = suffix || '... See more';

    // Safety check: if container has no width, can't measure
    var containerWidth = container.offsetWidth;
    if (!containerWidth || containerWidth < 50) {
      return { truncated: fullText, needsTruncation: false };
    }

    // Get computed styles from container
    var styles = window.getComputedStyle(container);
    var lineHeight = parseFloat(styles.lineHeight);
    
    // If line-height is 'normal', estimate it from font-size
    if (isNaN(lineHeight)) {
      lineHeight = parseFloat(styles.fontSize) * 1.4;
    }
    
    var maxHeight = lineHeight * maxLines;

    // Create a hidden measuring element with identical styles
    var measurer = document.createElement('div');
    measurer.style.cssText = [
      'position: absolute',
      'visibility: hidden',
      'white-space: pre-line',
      'word-wrap: break-word',
      'overflow-wrap: break-word',
      'width: ' + containerWidth + 'px',
      'font-family: ' + styles.fontFamily,
      'font-size: ' + styles.fontSize,
      'font-weight: ' + styles.fontWeight,
      'line-height: ' + styles.lineHeight,
      'letter-spacing: ' + styles.letterSpacing
    ].join(';');
    document.body.appendChild(measurer);

    // Check if full text fits
    measurer.textContent = fullText;
    if (measurer.offsetHeight <= maxHeight) {
      document.body.removeChild(measurer);
      return { truncated: fullText, needsTruncation: false };
    }

    // Binary search to find the cutoff point
    var low = 0;
    var high = fullText.length;
    var result = '';

    while (low < high) {
      var mid = Math.floor((low + high + 1) / 2);
      var testText = fullText.substring(0, mid).trimEnd() + suffix;
      measurer.textContent = testText;
      
      if (measurer.offsetHeight <= maxHeight) {
        low = mid;
        result = testText;
      } else {
        high = mid - 1;
      }
    }

    // Clean up - remove partial words if possible
    if (result) {
      // Find the text part (without suffix)
      var textPart = result.substring(0, result.length - suffix.length);
      
      // If we cut in the middle of a word, back up to the previous space
      if (textPart.length < fullText.length && fullText[textPart.length] && !/\s/.test(fullText[textPart.length])) {
        var lastSpace = textPart.lastIndexOf(' ');
        if (lastSpace > textPart.length * 0.5) {
          textPart = textPart.substring(0, lastSpace);
        }
      }
      
      result = textPart.trimEnd() + suffix;
    }

    document.body.removeChild(measurer);
    return { truncated: result || suffix, needsTruncation: true };
  }

  /* --------------------------------------------------------------------------
     EMPTY STATES (No posts exist yet)
     -------------------------------------------------------------------------- */

  function renderPostsEmptyState() {
    if (!postListEl) return;

    // Remove any existing panel headers from the content container
    var _oldHW = postPanelContentEl.querySelector('.post-panel-header-wrap');
    if (_oldHW) _oldHW.parentNode.removeChild(_oldHW);
    var _oldH = postPanelContentEl.querySelector('.post-panel-header');
    if (_oldH) _oldH.parentNode.removeChild(_oldH);
    var _oldEH = postPanelContentEl.querySelector('.post-panel-empty-header');
    if (_oldEH) _oldEH.parentNode.removeChild(_oldEH);

    // Always empty (no posts in this site yet), preserving slack elements.
    var _topS = postListEl.querySelector('.topSlack');
    var _botS = postListEl.querySelector('.bottomSlack');
    postListEl.innerHTML = '';
    if (_topS) postListEl.appendChild(_topS);
    
    // Ensure full opacity if we reach empty state (avoids getting stuck at 0.6 from renderPostList).
    postListEl.style.opacity = '1';
    postListEl.style.pointerEvents = 'auto';

    var wrap = document.createElement('div');
    wrap.className = 'post-panel-empty';

    var headerWrap = renderPostPanelHeader('post-panel-empty-header');
    if (headerWrap) postListEl.appendChild(headerWrap);

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
      try { applySystemImage(img, 'postSystemImages', 'post_panel_empty_image', 'imagebox'); } catch (e) { console.error(e); }
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
    if (_botS) postListEl.appendChild(_botS);
  }

  function renderRecentEmptyState() {
    if (!recentPanelContentEl) return;

    var _topS = recentPanelContentEl.querySelector('.topSlack');
    var _botS = recentPanelContentEl.querySelector('.bottomSlack');
    recentPanelContentEl.innerHTML = '';
    if (_topS) recentPanelContentEl.appendChild(_topS);

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
      try { applySystemImage(reminderImg, 'recentSystemImages', 'recent_panel_footer_image', 'imagebox'); } catch (e) { console.error(e); }
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
    if (_botS) recentPanelContentEl.appendChild(_botS);
    BackdropComponent.populate(_topS);
    BackdropComponent.populate(_botS);
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

      // Defensive: de-dup by post_map_card_id when available (location-specific),
      // falling back to post id for legacy entries.
      var bestByKey = {};
      for (var i = 0; i < history.length; i++) {
        var h = history[i];
        if (!h) continue;
        var key = '';
        if (h.post_map_card_id !== undefined && h.post_map_card_id !== null && String(h.post_map_card_id) !== '') {
          key = String(h.post_map_card_id);
        } else if (h.id !== undefined && h.id !== null) {
          key = String(h.id);
        }
        if (!key) continue;
        var ts = Number(h.timestamp) || 0;
        if (!bestByKey[key] || ts > (Number(bestByKey[key].timestamp) || 0)) {
          bestByKey[key] = h;
        }
      }

      // Return newest-first list (matches UI expectation).
      var out = Object.keys(bestByKey).map(function(k) { return bestByKey[k]; });
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

    var _topS = recentPanelContentEl.querySelector('.topSlack');
    var _botS = recentPanelContentEl.querySelector('.bottomSlack');
    recentPanelContentEl.innerHTML = '';
    if (_topS) recentPanelContentEl.appendChild(_topS);

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
      try { applySystemImage(reminderImg, 'recentSystemImages', 'recent_panel_footer_image', 'imagebox'); } catch (e) { console.error(e); }
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
    if (_botS) recentPanelContentEl.appendChild(_botS);
    BackdropComponent.populate(_topS);
    BackdropComponent.populate(_botS);
  }

  /**
   * Render a recent card.
   * Visually identical to a postcard, but represents a specific LOCATION of a post
   * (tracked by post_map_card_id), not the post as a whole. This means:
   * - A multi-location post produces separate recent cards per visited location
   * - The location line always shows the specific location name, never "X Locations"
   * Structure: .recent-main-container > .recent-statusbar + .recent-card
   * @param {Object} entry - Recent history entry { id, post_key, title, timestamp }
   * @returns {HTMLElement|null} Recent card wrapper element
   */
  function renderRecentCard(entry) {
    if (!entry || !entry.id) return null;

    // Create wrapper to hold timestamp + card
    var wrapper = document.createElement('div');
    wrapper.className = 'recent-main-container';

    var el = document.createElement('article');
    el.className = 'recent-card';
    if (entry.unavailable) {
      el.classList.add('recent-card--unavailable');
    }
    if (entry.subcategory_color) {
      var _recentHex = entry.subcategory_color.replace('#', '');
      var _recentR = parseInt(_recentHex.substring(0, 2), 16);
      var _recentG = parseInt(_recentHex.substring(2, 4), 16);
      var _recentB = parseInt(_recentHex.substring(4, 6), 16);
      el.style.setProperty('--subcat-hover-bg', 'rgba(' + _recentR + ',' + _recentG + ',' + _recentB + ',1)');
    }
    el.dataset.id = String(entry.id);
    // Store post_map_card_id for location-specific tracking
    if (entry.post_map_card_id) {
      el.dataset.postMapCardId = String(entry.post_map_card_id);
    }
    // Unavailable cards are not interactive
    if (!entry.unavailable) {
      el.setAttribute('tabindex', '0');
    }

    // Recents store lightweight display fields in localStorage (not full post payload).
    var title = entry.title || '';
    var rawThumbUrl = entry.thumb_url || '';
    var city = entry.location_text || '';

    // Get subcategory info
    var displayName = entry.subcategory_name || '';
    if (!displayName) {
      throw new Error('[Recent] Subcategory name missing for entry: ' + (entry.id || 'unknown'));
    }
    var iconUrl = entry.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Recent] Subcategory icon missing for entry: ' + (entry.id || 'unknown'));
    }

    // Format last opened time
    var lastOpenedText = formatLastOpened(entry.timestamp);

    // Build card HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbUrl = getCardThumbSrc(rawThumbUrl);

    var thumbHtml = rawThumbUrl
      ? '<img class="recent-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="recent-card-image recent-card-image--empty" aria-hidden="true"></div>';

    // Check favorite status (unavailable posts are always unfavorited)
    var isFav = entry.unavailable ? false : isFavorite(entry.id);

    // Build info rows using shared function (single source of truth)
    var infoRowsHtml = buildCardInfoRowsHtml({
      subcategoryName: displayName,
      subcategoryIconUrl: iconUrl,
      locationText: city,
      datesText: entry.dates_text || '',
      priceParts: parsePriceSummary(entry.price_summary || ''),
      hasPromo: entry.has_promo || false
    }, 'recent-card');

    // Standard Design (uses same info rows as postcards)
    el.innerHTML = [
      thumbHtml,
      '<div class="recent-card-meta">',
        '<div class="recent-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="recent-card-container-info">',
          infoRowsHtml,
        '</div>',
      '</div>',
      '<div class="recent-card-container-actions">',
      '<button class="recent-card-button-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
      '<span class="recent-card-icon-fav" aria-hidden="true"></span>',
      '</button>',
      '</div>'
    ].join('');

    var recentStatusCont = document.createElement('div');
    recentStatusCont.className = 'recent-status-container';

    // Timestamp / unavailable status bar
    if (lastOpenedText || entry.unavailable) {
      var statusBar = document.createElement('div');
      statusBar.className = 'recent-statusbar';
      if (entry.unavailable) {
        statusBar.classList.add('recent-statusbar--unavailable');
      }
      if (lastOpenedText) {
        var timestampSpan = document.createElement('span');
        timestampSpan.className = 'recent-statusbar-timestamp';
        timestampSpan.textContent = lastOpenedText;
        statusBar.appendChild(timestampSpan);
      }
      if (entry.unavailable) {
        var statusSpan = document.createElement('span');
        statusSpan.className = 'recent-statusbar-status';
        statusSpan.textContent = 'unavailable';
        statusBar.appendChild(statusSpan);
      }
      recentStatusCont.appendChild(statusBar);
    }

    // Countdown status bar
    if (entry.first_session_date && entry.expires_at) {
      var _recentSett = App.getState('settings') || {};
      if (_recentSett.countdown_postcards) {
        var _recentBarResult = buildCountdownStatusBar(
          { expires_at: entry.expires_at },
          { first_session_date: entry.first_session_date }
        );
        if (_recentBarResult) {
          _recentBarResult.bar.classList.add('post-statusbar--slot-card');
          if (_recentSett.countdown_postcards_mode === 'soonest_only') {
            _recentBarResult.bar.classList.add('post-statusbar--modesoonest');
          }
          recentStatusCont.appendChild(_recentBarResult.bar);
        }
      }
    }


    var anchor = document.createElement('div');
    anchor.setAttribute('data-slack-anchor', '');
    anchor.appendChild(el);
    wrapper.appendChild(anchor);

    // Robust thumbnail loader (prevents broken/missing thumbnails if class=thumbnail isn't supported).
    if (rawThumbUrl) {
      wireCardThumbImage(el.querySelector('.recent-card-image'), rawThumbUrl);
    }

    // Click handler for opening/closing post (toggle)
    el.addEventListener('click', function(e) {
      if (e.target.closest('.recent-card-button-fav')) return;
      
      // Unavailable posts cannot be opened
      if (entry.unavailable) return;
      
      // If this card is already inside a .post section, click means "close"
      if (el.closest('.post')) {
        closePost(entry.id);
        return;
      }

      // Close any existing open post synchronously so TopSlack catches the vacuum.
      // The new post opens downward — only the close causes upward shift.
      closeOpenPost(recentPanelContentEl);

      // Fetch full post data, then open (opens downward from the card).
      loadPostById(entry.id).then(function(fetchedPost) {
        if (!fetchedPost) return;
        openPost(fetchedPost, { fromRecent: true, originEl: el, postMapCardId: entry.post_map_card_id });
      });
    });

    // Keyboard: Enter/Space opens card (matches button behavior)
    el.addEventListener('keydown', function(e) {
      if (!e) return;
      if (entry.unavailable) return;
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

    var recentOuter = document.createElement('div');
    recentOuter.className = 'recent-outer-container';
    if (recentStatusCont.children.length) recentOuter.appendChild(recentStatusCont);
    recentOuter.appendChild(wrapper);
    return recentOuter;
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
      if (entry.thumb_url && entry.subcategory_color) return;
      if (cardEl.dataset && cardEl.dataset.hydrating === '1') return;
      if (cardEl.dataset) cardEl.dataset.hydrating = '1';

      loadPostById(entry.id).then(function(post) {
        if (!post) return;

        if (post.subcategory_color) {
          try {
            var recentCardEl = (cardEl.classList && cardEl.classList.contains('recent-card'))
              ? cardEl
              : cardEl.querySelector('.recent-card');
            if (recentCardEl) {
              var _hydrHex = post.subcategory_color.replace('#', '');
              var _hydrR = parseInt(_hydrHex.substring(0, 2), 16);
              var _hydrG = parseInt(_hydrHex.substring(2, 4), 16);
              var _hydrB = parseInt(_hydrHex.substring(4, 6), 16);
              recentCardEl.style.setProperty('--subcat-hover-bg', 'rgba(' + _hydrR + ',' + _hydrG + ',' + _hydrB + ',1)');
            }
          } catch (_eRecentTint) {
            // ignore
          }
        }
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
            var targetMapCardId = (entry.post_map_card_id !== undefined && entry.post_map_card_id !== null) ? String(entry.post_map_card_id) : '';
            for (var i = 0; i < history.length; i++) {
              if (!history[i]) continue;
              if (String(history[i].id) !== targetId) continue;
              if (targetMapCardId) {
                if (String(history[i].post_map_card_id || '') !== targetMapCardId) continue;
              }
              history[i].thumb_url = rawThumb;
              history[i].subcategory_color = post.subcategory_color || '';
              // Keep title fresh too (safe improvement).
              if (!history[i].title) {
                var mcTitle = '';
                if (targetMapCardId && post.map_cards && post.map_cards.length) {
                  for (var j = 0; j < post.map_cards.length; j++) {
                    if (String(post.map_cards[j].id) === targetMapCardId) {
                      mcTitle = post.map_cards[j].title || '';
                      break;
                    }
                  }
                }
                history[i].title = mcTitle || (post.map_cards && post.map_cards[0] && post.map_cards[0].title) || post.checkout_title || '';
              }
              break;
            }
            localStorage.setItem('recentPosts', JSON.stringify(history));
          } catch (eStore) {
            // ignore
          }
        } else {
          try {
            var historyNoThumb = JSON.parse(localStorage.getItem('recentPosts') || '[]');
            if (!Array.isArray(historyNoThumb)) historyNoThumb = [];
            var targetIdNoThumb = String(entry.id);
            var targetMapCardIdNoThumb = (entry.post_map_card_id !== undefined && entry.post_map_card_id !== null) ? String(entry.post_map_card_id) : '';
            for (var k = 0; k < historyNoThumb.length; k++) {
              if (!historyNoThumb[k]) continue;
              if (String(historyNoThumb[k].id) !== targetIdNoThumb) continue;
              if (targetMapCardIdNoThumb && String(historyNoThumb[k].post_map_card_id || '') !== targetMapCardIdNoThumb) continue;
              historyNoThumb[k].subcategory_color = post.subcategory_color || '';
              break;
            }
            localStorage.setItem('recentPosts', JSON.stringify(historyNoThumb));
          } catch (_eStoreTintOnly) {
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

    // Format full date (matches live site)
    var d = new Date(timestamp);
    var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var weekday = weekdays[d.getDay()];
    var day = d.getDate();
    var month = months[d.getMonth()];
    var year = d.getFullYear();
    var hour = String(d.getHours()).padStart(2, '0');
    var minute = String(d.getMinutes()).padStart(2, '0');

    return 'Last opened ' + ago + ' ago - ' + weekday + ' ' + day + ' ' + month + ', ' + year + ' ' + hour + ':' + minute;
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
    var authOpts = {};
    if (window.MemberModule && typeof MemberModule.isLoggedIn === 'function' && MemberModule.isLoggedIn()) {
      authOpts.headers = { 'X-Member-Auth': '1' };
    }
    var params = new URLSearchParams();
    params.append('limit', '1');
    params.append('post_id', String(postId));
    params.append('full', '1');
    var f = currentFilters;
    if (f) {
      if (f.keyword) params.append('keyword', String(f.keyword));
      if (f.minPrice) params.append('min_price', String(f.minPrice));
      if (f.maxPrice) params.append('max_price', String(f.maxPrice));
      if (f.dateStart) params.append('date_start', String(f.dateStart));
      if (f.dateEnd) params.append('date_end', String(f.dateEnd));
      if (f.expired) params.append('expired', '1');
      if (f.show18Plus) params.append('show18_plus', '1');
      if (Array.isArray(f.subcategoryKeys) && f.subcategoryKeys.length) {
        params.append('subcategory_keys', f.subcategoryKeys.map(String).join(','));
      }
    }
    return fetch('/gateway.php?action=get-posts&' + params.toString(), authOpts)
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
    var authOpts = {};
    if (window.MemberModule && typeof MemberModule.isLoggedIn === 'function' && MemberModule.isLoggedIn()) {
      authOpts.headers = { 'X-Member-Auth': '1' };
    }
    return fetch('/gateway.php?action=get-posts&limit=1&post_key=' + encodeURIComponent(key), authOpts)
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
      openPost(post, { fromRecent: true, originEl: null, source: 'deeplink' });

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

  function getFilterSummaryText() {
    try {
      // Read from FilterModule's counting system (no filter panel DOM dependency).
      if (window.FilterModule && typeof FilterModule.getFilterSummaryText === 'function') {
        var moduleText = FilterModule.getFilterSummaryText();
        if (moduleText) return moduleText;
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function applySystemImage(imgEl, folderKey, systemImageKey, resizeClass) {
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

    var url = App.getImageUrl(folderKey, filename, resizeClass);
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

  function showZoomToast() {
    if (typeof window.getMessage === 'function') {
      window.getMessage('msg_map_zoom_required', {}, false).then(function(text) {
        if (text) ToastComponent.show(text);
      }).catch(function() {});
      return;
    }
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
   * Get the hero image URL for a post (with imagebox sizing)
   * @param {Object} post - Post object
   * @returns {string} Hero image URL
   */
  function getHeroUrl(post) {
    var rawUrl = getPostThumbnailUrl(post);
    return addImageClass(rawUrl, 'imagebox');
  }

  /**
   * Get the raw image URL for a post (full resolution, no Bunny class)
   * @param {Object} post - Post object
   * @returns {string} Raw image URL
   */
  function getRawImageUrl(post) {
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
    closeMultipostModal: closeMultipostModal,
    renderPostCard: renderPostCard,
    renderMapMarkers: renderMapMarkers,
    highlightMapMarker: highlightMapMarker,
    getPostUrl: getPostUrl,
    getHeroUrl: getHeroUrl,
    getRawImageUrl: getRawImageUrl,
    formatPostDates: formatPostDates,
    formatPriceSummaryText: formatPriceSummaryText,
    parsePriceSummary: parsePriceSummary,
    mapCardHasPromo: mapCardHasPromo,
    loadPostById: loadPostById,
    handleDeepLink: maybeOpenDeepLinkedPost,
    buildCountdownStatusBar: buildCountdownStatusBar
  };

})();

// Register with App
App.registerModule('post', PostModule);

// Expose globally for consistency with other modules
window.PostModule = PostModule;

