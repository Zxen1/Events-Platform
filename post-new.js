/* ============================================================================
   POST.JS - POST SECTION (includes Recent)
   ============================================================================
   
   Controls the Post panel and Recent panel.
   
   FUTURE COMPONENTS (to be extracted):
   - ImageGalleryComponent - Hero image + thumbnails + swipe
   
   DEPENDENCIES:
   - index.js (backbone)
   
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
              if (typeof MapModule.updateHighDensityData === 'function') {
                MapModule.updateHighDensityData({ type: 'FeatureCollection', features: [] });
              }
              if (typeof MapModule.clearAllMapCardMarkers === 'function') {
                MapModule.clearAllMapCardMarkers();
              }
            }
            lastRenderedVenueMarkerSigByKey = {};
            
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
      openPostById(data.postId, { fromMap: true });
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
      sortPosts((window.FilterModule && FilterModule.getFilterState) ? (FilterModule.getFilterState().sort || 'recommended') : 'recommended');
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
    // Agent Essentials: Never load if not required.
    var threshold = getPostsMinZoom();
    if (typeof lastZoom !== 'number' || lastZoom < threshold) {
      return Promise.resolve([]);
    }

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

    // Lazy-load currency data if needed for price summary parsing
    if (window.CurrencyComponent && typeof CurrencyComponent.loadFromDatabase === 'function') {
      CurrencyComponent.loadFromDatabase().catch(function() {});
    }

    postsLoading = true;

    return fetch('/gateway.php?action=get-posts&' + requestKey, postsAbort ? { signal: postsAbort.signal } : undefined)
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
  /**
   * Format dates display for a post.
   * Required for instant rendering. Throws error if pre-formatted summary is missing.
   * @param {Object} post - Post data from API
   * @returns {string} Formatted date string or empty
   */
  function formatPostDates(post) {
    var mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;
    var summary = (mapCard ? mapCard.session_summary : post.session_summary) || '';
    
    // Primary source: pre-formatted string (non-JSON)
    if (summary && typeof summary === 'string' && summary.trim() !== '' && summary.indexOf('{') !== 0) {
      return summary;
    }

    // Agent Essentials: NO FALLBACKS. Legacy JSON/array support is removed.
    // Return empty if no summary exists (valid for posts without dates).
    return '';
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
    var title = (mapCard && mapCard.title) || post.checkout_title || post.title || '';
    if (title === 'Array') title = 'Post #' + post.id;
    var venueName = (mapCard && mapCard.venue_name) || '';
    var city = (mapCard && mapCard.city) || '';
    var locationDisplay = venueName || city || '';

    // Get subcategory info
    var displayName = post.subcategory_name || '';
    if (!displayName) {
      throw new Error('[Post] Subcategory name missing for key: ' + (post.subcategory_key || 'unknown'));
    }
    var iconUrl = post.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Post] Subcategory icon missing for key: ' + (post.subcategory_key || 'unknown'));
    }

    // Format dates (if sessions exist) - prioritizes pre-formatted session_summary from database
    var datesText = formatPostDates(post);

    // Format price summary
    var priceParts = parsePriceSummary(mapCard ? mapCard.price_summary : post.price_summary || '');

    // Store small, per-card sort metadata on the element itself (DOM is the source of truth).
    // This avoids keeping an in-memory posts snapshot while still allowing the sort menu to work.
    try {
      el.dataset.sortFeatured = post.featured ? '1' : '0';
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

    // Postcard thumbnail. Standard design uses thumbnail.
    var rawThumbUrl = getPostThumbnailUrl(post);
    var thumbUrl = getCardThumbSrc(rawThumbUrl);

    // Build HTML - proper class naming: .{section}-{name}-{type}-{part}
    var thumbHtml = rawThumbUrl
      ? '<img class="post-card-image" loading="lazy" src="' + thumbUrl + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="post-card-image post-card-image--empty" aria-hidden="true"></div>';

    var iconHtml = iconUrl
      ? '<span class="post-card-icon-sub"><img class="post-card-image-sub" src="' + iconUrl + '" alt="" /></span>'
      : '';

    var isFav = isFavorite(post.id);

    // Standard Design
    el.innerHTML = [
      thumbHtml,
      '<div class="post-card-meta">',
        '<div class="post-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="post-card-container-info">',
          '<div class="post-card-row-cat">' + iconHtml + ' ' + (displayName) + '</div>',
          locationDisplay ? '<div class="post-card-row-loc"><span class="post-card-badge" title="Venue">📍</span><span>' + escapeHtml(locationDisplay) + '</span></div>' : '',
          datesText ? '<div class="post-card-row-date"><span class="post-card-badge" title="Dates">📅</span><span>' + escapeHtml(datesText) + '</span></div>' : 
          (priceParts.text ? (function() {
            var badgeHtml = priceParts.flagUrl 
              ? '<img class="post-card-image-badge" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '">'
              : '💰';
            return '<div class="post-card-row-price"><span class="post-card-badge" title="Price">' + badgeHtml + '</span><span>' + escapeHtml(priceParts.text) + '</span></div>';
          })() : ''),
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

    // Click handler for opening/closing post (toggle)
    el.addEventListener('click', function(e) {
      // Don't toggle if clicking favorite button
      if (e.target.closest('.post-card-button-fav')) return;
      
      // If this card is already inside a .post section, click means "close"
      if (el.closest('.post')) {
        closePost(post.id);
      } else {
        openPost(post, { originEl: el });
      }
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
    
    // Low-opacity hint during re-render (stale responses).
    // This allows the user to see that data is updating without a blank flicker.
    if (postListEl) {
      postListEl.style.opacity = '0.6';
      postListEl.style.pointerEvents = 'none';
    }
    
    // Preserve an open post across re-renders (map moves trigger filter refreshes).
    // If the open post is still in the filtered results, keep it open (do NOT close just because the map moved).
    var preservedOpenPost = postListEl.querySelector('.post');
    var preservedOpenPostId = preservedOpenPost && preservedOpenPost.dataset ? String(preservedOpenPost.dataset.id || '') : '';
    if (preservedOpenPost && preservedOpenPost.parentElement === postListEl) {
      try { postListEl.removeChild(preservedOpenPost); } catch (_eDetach) {}
    }
    
    // Clear existing list content (cards + summary)
    postListEl.innerHTML = '';

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
      // If this post is currently open, reinsert the existing .post wrapper instead of recreating.
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

    finalizeRender();
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
      map_card_id: mapCard.id,
      map_card_index: mapCardIndex,
      title: title,
      venue: venueName,
      city: mapCard.city || '',
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
    // Agent Essentials: Never load or process if not required.
    var threshold = getPostsMinZoom();
    if (typeof lastZoom !== 'number' || lastZoom < threshold) {
      // We are below the breakpoint. Wipe everything and exit.
      if (window.MapModule) {
        if (typeof MapModule.updateHighDensityData === 'function') {
          MapModule.updateHighDensityData({ type: 'FeatureCollection', features: [] });
        }
        if (typeof MapModule.clearAllMapCardMarkers === 'function') {
          MapModule.clearAllMapCardMarkers();
        }
      }
      lastRenderedVenueMarkerSigByKey = {};
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

    var allMarkerData = [];
    Object.keys(venueGroups).forEach(function(venueKey) {
      var group = venueGroups[venueKey];
      if (!group.length) return;

      var uniquePostIds = {};
      group.forEach(function(item) { uniquePostIds[item.post.id] = true; });
      var isMultiPostVenue = Object.keys(uniquePostIds).length > 1;

      var firstItem = group[0];
      var markerData = convertMapCardToMarker(firstItem.post, firstItem.mapCard, firstItem.index);
      if (!markerData) return;

      if (isMultiPostVenue) {
        markerData.isMultiPost = true;
        markerData.venuePostIds = Object.keys(uniquePostIds);
        markerData.venuePostCount = markerData.venuePostIds.length;
      }
      
      markerData.venueKey = venueKey;
      allMarkerData.push(markerData);
    });

    // --- High-Density Logic ---
    var MAX_MAP_CARDS = (window.App && typeof App.getConfig === 'function') ? App.getConfig('maxMapCards') : 50;
    var totalResultCount = allMarkerData.length;
    var isHighDensity = totalResultCount > MAX_MAP_CARDS;
    
    // Determine which featured posts get the 50 "Card" slots
    // We sort by 'recommended' logic (Featured first, then Newest) to fill slots
    var sortedForSlots = allMarkerData.slice().sort(function(a, b) {
      var pA = a._originalPost;
      var pB = b._originalPost;
      var featA = (pA.featured === 1);
      var featB = (pB.featured === 1);
      if (featA !== featB) return featB ? 1 : -1;
      return (Number(pB.sortCreatedAt) || 0) - (Number(pA.sortCreatedAt) || 0);
    });

    var cardSlots = new Set();
    var geojsonFeatures = [];

    sortedForSlots.forEach(function(item, idx) {
      var isFeatured = item._originalPost && item._originalPost.featured === 1;
      var hasCardSlot = idx < MAX_MAP_CARDS;

      if (hasCardSlot) {
        cardSlots.add(item.venueKey);
      }

      // GeoJSON property: type = 'card' | 'icon' | 'dot'
      var type = 'card'; // Default to card
      if (isHighDensity) {
        if (!hasCardSlot) {
          type = isFeatured ? 'icon' : 'dot';
        }
      }

      // High-Density Rule: NO FALLBACKS.
      // If color or subcategory key is missing, we must identify it immediately.
      var subColor = item._originalPost.subcategory_color;
      if (!subColor) {
        throw new Error('[Map] Subcategory color missing for post ID ' + item.id + ' (required for high-density dots).');
      }
      var subKey = item.sub;
      if (!subKey) {
        throw new Error('[Map] Subcategory key missing for post ID ' + item.id + ' (required for featured icons).');
      }

      // Only add to GeoJSON if it's NOT a card. Cards are handled by DOM markers.
      if (type !== 'card') {
        geojsonFeatures.push({
          type: 'Feature',
          id: item.id, // Using post ID as numeric ID for Mapbox feature-state
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat]
          },
          properties: {
            postId: item.id,
            venueKey: item.venueKey,
            type: type,
            color: subColor,
            iconId: subKey,
            iconUrl: item.iconUrl
          }
        });
      }
    });

    // Update Mapbox high-density layers
    if (mapModule.updateHighDensityData) {
      mapModule.updateHighDensityData({
        type: 'FeatureCollection',
        features: geojsonFeatures
      });
    }

    // Prepare markers for DOM rendering (only those in cardSlots)
    allMarkerData.forEach(function(markerData) {
      if (cardSlots.has(markerData.venueKey)) {
        nextMarkerDataByKey[markerData.venueKey] = markerData;
        nextSigByKey[markerData.venueKey] = buildMarkerSignature(markerData);
      }
    });

    // Remove markers that are no longer needed (including those that switched to dots/icons)
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
      var openEl = document.querySelector('.post[data-id]');
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
    // Filter for posts with sidebar_ad flag (premium listings with marquee access)
    var marqueePosts = list.filter(function(p) {
      return p.sidebar_ad === 1;
    }).slice(0, 10);
    
    App.emit('filter:applied', {
      marqueePosts: marqueePosts
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

    // Below threshold: no posts list should be shown; purge everything.
    if (window.MapModule) {
      if (typeof MapModule.updateHighDensityData === 'function') {
        MapModule.updateHighDensityData({ type: 'FeatureCollection', features: [] });
      }
      if (typeof MapModule.clearAllMapCardMarkers === 'function') {
        MapModule.clearAllMapCardMarkers();
      }
    }
    lastRenderedVenueMarkerSigByKey = {};
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

    // Preserve summary + .post wrapper positions.
    var summaryEl = postListEl.querySelector('.post-panel-summary');
    var openWrap = postListEl.querySelector('.post');

    var cards = [];
    try {
      // Direct children only (avoid grabbing the embedded .post header card).
      cards = Array.prototype.slice.call(postListEl.querySelectorAll(':scope > .post-card'));
    } catch (_eScope) {
      cards = Array.prototype.slice.call(postListEl.querySelectorAll('.post-card'));
      // Filter out cards that live inside a .post wrapper.
      cards = cards.filter(function(el) {
        var p = el && el.parentElement;
        while (p) {
          if (p.classList && p.classList.contains('post')) return false;
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
        case 'recommended':
          // Recommended: Featured first (1 before 0), then by created_at DESC
          var featA = Number(a.sortFeatured) || 0;
          var featB = Number(b.sortFeatured) || 0;
          if (featA !== featB) return featB - featA;
          return (Number(b.sortCreatedAt) || 0) - (Number(a.sortCreatedAt) || 0);
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
    var openPost = container.querySelector('.post');
    if (!openPost) return;

    var postId = openPost.dataset.id;

    // Restore the original card element (recent-card stays recent-card).
    // This prevents Recents from accumulating post-cards and avoids "duplicate-looking" entries.
    try {
      var cardEl = openPost.querySelector('.post-card, .recent-card');
      if (cardEl) {
        if (openPost.parentElement) {
          openPost.parentElement.replaceChild(cardEl, openPost);
        } else {
          openPost.remove();
        }
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
   * Structure: .post > .post-header + .post-body
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
    var displayName = post.subcategory_name || '';
    if (!displayName) {
      throw new Error('[Post] Subcategory name missing for key: ' + (post.subcategory_key || 'unknown'));
    }
    var iconUrl = post.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Post] Subcategory icon missing for key: ' + (post.subcategory_key || 'unknown'));
    }

    // Format dates - use pre-formatted session_summary from database
    var datesText = (loc0 ? loc0.session_summary : post.session_summary) || '';

    // Posted by info
    var posterName = post.member_name || 'Anonymous';
    var postedTime = formatPostTimestamp(post.created_at);
    var postedMeta = postedTime ? 'Posted by ' + posterName + ' · ' + postedTime : 'Posted by ' + posterName;
    var avatarSrc = resolveAvatarSrcForUser(post.member_avatar || '', post.member_id);

    // Default session info display
    var priceParts = parsePriceSummary(loc0.price_summary || '');
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
    var city = loc0.city || '';
    var websiteUrl = loc0.website_url || '';
    var ticketsUrl = loc0.tickets_url || '';
    var publicEmail = loc0.public_email || '';
    var phonePrefix = loc0.phone_prefix || '';
    var publicPhone = loc0.public_phone || '';
    var ageRating = loc0.age_rating || '';
    var couponCode = loc0.coupon_code || '';
    var customText = loc0.custom_text || '';
    var customTextarea = loc0.custom_textarea || '';
    var customDropdown = loc0.custom_dropdown || '';
    var customChecklist = loc0.custom_checklist || '';
    var customRadio = loc0.custom_radio || '';
    var amenitySummary = loc0.amenity_summary || '';
    var hasMultipleLocations = locationList.length > 1;

    // Check favorite status
    var isFav = isFavorite(post.id);

    // Create wrapper - proper class naming: .post
    var wrap = document.createElement('div');
    wrap.className = 'post';
    wrap.dataset.id = String(post.id);
    wrap.dataset.postKey = post.post_key || '';
    // Store reference to post data for LocationWallpaperComponent library lookup
    wrap.__mapCardData = loc0;

    // Location wallpaper integration (reuses LocationWallpaperComponent pattern):
    // - Only activates when post is expanded (handled in setupPostDetailEvents)
    // - Uses lat/lng from first map card (already provided by API)
    // - Must not block interactions (component uses pointer-events: none)
    var lat = null;
    var lng = null;
    try {
      lat = (loc0 && loc0.latitude !== undefined && loc0.latitude !== null) ? Number(loc0.latitude) : null;
      lng = (loc0 && loc0.longitude !== undefined && loc0.longitude !== null) ? Number(loc0.longitude) : null;
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
    
    // Location display
    var locationDisplay = venueName || loc0.city || '';
    
    // Icon HTML for info section (subcategory icon)
    var infoIconHtml = iconUrl
      ? '<span class="post-info-icon"><img class="post-info-image-sub" src="' + iconUrl + '" alt="" /></span>'
      : '';
    
    // Price badge for info section
    var infoPriceBadgeHtml = priceParts.flagUrl 
      ? '<img class="post-info-image-badge" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '">'
      : '💰';
    
    // Post header: minimal - just thumbnail and title
    postHeader.innerHTML = [
      thumbHtml,
      '<div class="post-header-meta">',
        '<div class="post-header-text-title">' + escapeHtml(title) + '</div>',
      '</div>',
      '<div class="post-header-actions">',
        '<button class="post-button-share" aria-label="Share post">',
          '<div class="post-icon-share"></div>',
        '</button>',
        '<button class="post-header-button-fav" aria-label="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '" aria-pressed="' + (isFav ? 'true' : 'false') + '" data-post-id="' + post.id + '">',
          '<div class="post-header-icon-fav"></div>',
        '</button>',
      '</div>'
    ].join('');

    // Create post body - proper class naming
    var postBody = document.createElement('div');
    postBody.className = 'post-body';
    postBody.innerHTML = [
      '<div class="post-info-container">',
        // Subcategory row (static)
        '<div class="post-info-row post-info-row-cat">',
          infoIconHtml,
          '<span class="post-info-text">' + escapeHtml(displayName) + '</span>',
        '</div>',
        // Venue info (venue_name, address_line, city)
        '<div id="venue-info-' + post.id + '" class="post-info-venue">',
          '<strong>' + escapeHtml(venueName) + '</strong>' +
          (addressLine ? '<br>' + escapeHtml(addressLine) : '') +
          (city ? '<br>' + escapeHtml(city) : ''),
        '</div>',
        // Location button (if multiple locations)
        hasMultipleLocations ? '<button class="post-info-button post-info-button-location" type="button" aria-haspopup="true" aria-expanded="false">' +
          '<span class="post-info-button-text">📍 ' + locationList.length + ' locations</span>' +
          '<span class="post-info-button-arrow">▼</span>' +
        '</button>' : '',
        // Session summary button (if sessions exist)
        datesText ? '<button class="post-info-button post-info-button-session" type="button" aria-haspopup="true" aria-expanded="false" id="session-btn-' + post.id + '">' +
          '<span class="post-info-button-text">📅 ' + escapeHtml(datesText) + '</span>' +
          '<span class="post-info-button-arrow">▼</span>' +
        '</button>' : '',
        // Price summary button (if price exists)
        priceParts.text ? '<button class="post-info-button post-info-button-price" type="button" aria-haspopup="true" aria-expanded="false" id="price-btn-' + post.id + '">' +
          '<span class="post-info-button-text">' + priceHtml + '</span>' +
          '<span class="post-info-button-arrow">▼</span>' +
        '</button>' : '',
        // Website URL
        websiteUrl ? '<div class="post-info-row post-info-row-website">' +
          '<a href="' + escapeHtml(websiteUrl) + '" target="_blank" rel="noopener noreferrer">🌐 ' + escapeHtml(websiteUrl) + '</a>' +
        '</div>' : '',
        // Tickets URL
        ticketsUrl ? '<div class="post-info-row post-info-row-tickets">' +
          '<a href="' + escapeHtml(ticketsUrl) + '" target="_blank" rel="noopener noreferrer">🎟️ ' + escapeHtml(ticketsUrl) + '</a>' +
        '</div>' : '',
        // Public email
        publicEmail ? '<div class="post-info-row post-info-row-email">' +
          '<a href="mailto:' + escapeHtml(publicEmail) + '">✉️ ' + escapeHtml(publicEmail) + '</a>' +
        '</div>' : '',
        // Phone
        (phonePrefix || publicPhone) ? '<div class="post-info-row post-info-row-phone">' +
          '<a href="tel:' + escapeHtml(phonePrefix + publicPhone) + '">📞 ' + escapeHtml(phonePrefix + ' ' + publicPhone) + '</a>' +
        '</div>' : '',
        // Amenities
        amenitySummary ? '<div class="post-info-row post-info-row-amenities">' +
          escapeHtml(amenitySummary) +
        '</div>' : '',
        // Coupon code
        couponCode ? '<div class="post-info-row post-info-row-coupon">' +
          '🏷️ ' + escapeHtml(couponCode) +
        '</div>' : '',
        // Age rating
        ageRating ? '<div class="post-info-row post-info-row-age">' +
          '🔞 ' + escapeHtml(ageRating) +
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
      '<div class="post-images-container">',
        '<div class="post-hero">',
          '<div class="post-track-hero">',
            '<img class="post-image-hero post-image-hero--loading" src="' + heroUrl + '" data-full="' + (mediaUrls[0] || '') + '" alt="" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" />',
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
          img.dataset.fullUrl = url; // Store original URL for hero switching
          thumbRow.appendChild(img);
        });
      }
    }

    // Assemble structure
    // Wrap content in a container compatible with LocationWallpaperComponent, but neutralize form padding in CSS.
    var contentWrap = document.createElement('div');
    contentWrap.className = 'member-postform-location-content';
    wrap.appendChild(contentWrap);

    // Hidden lat/lng inputs for LocationWallpaperComponent to read
    if (lat !== null && lng !== null) {
      wrap.classList.add('member-location-container');
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
    contentWrap.appendChild(postBody);

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

    // Post header click closes the post (returns to post-card)
    var postHeader = wrap.querySelector('.post-header');
    if (postHeader) {
      postHeader.addEventListener('click', function(e) {
        // Don't close if clicking buttons inside the header
        if (e.target.closest('button')) return;
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
        var wasPressed = headerFavBtn.getAttribute('aria-pressed') === 'true';
        var nowPressed = !wasPressed;
        
        // Update this button
        headerFavBtn.setAttribute('aria-pressed', String(nowPressed));
        headerFavBtn.setAttribute('aria-label', nowPressed ? 'Remove from favorites' : 'Add to favorites');
        
        // Sync with card's fav button if present
        if (cardEl) {
          var cardFavBtn = cardEl.querySelector('.post-card-button-fav, .recent-card-button-fav');
          if (cardFavBtn) {
            cardFavBtn.setAttribute('aria-pressed', String(nowPressed));
            cardFavBtn.setAttribute('aria-label', nowPressed ? 'Remove from favorites' : 'Add to favorites');
          }
        }
        
        // Save favorite state to localStorage
        saveFavorite(postId, nowPressed);
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

    /* ........................................................................
       IMAGE GALLERY [COMPONENT PLACEHOLDER: ImageGalleryComponent]
       Hero image + thumbnail row with click-to-swap + lightbox
       Future: Will become ImageGalleryComponent with swipe, zoom
       ........................................................................ */

    var thumbnails = wrap.querySelectorAll('.post-thumbs img');
    var heroImg = wrap.querySelector('.post-image-hero');
    var heroContainer = wrap.querySelector('.post-hero');
    
    // Gather all full-size image URLs for the gallery
    var galleryImages = [];
    thumbnails.forEach(function(thumb) {
      var fullUrl = thumb.dataset.fullUrl || '';
      if (fullUrl) {
        galleryImages.push(fullUrl);
      }
    });
    
    // If no thumbnails but hero has an image, use that
    if (galleryImages.length === 0 && heroImg && heroImg.dataset.full) {
      galleryImages.push(heroImg.dataset.full);
    }
    
    // Track current gallery index
    var currentGalleryIndex = 0;
    
    // Helper to navigate to a specific image index with animation
    var trackEl = wrap.querySelector('.post-track-hero');
    var isAnimating = false;
    
    function navigateToImageAnimated(index, fromIndex) {
      if (index === fromIndex || isAnimating) return;
      if (index < 0) index = galleryImages.length - 1;
      if (index >= galleryImages.length) index = 0;
      
      var fullUrl = galleryImages[index];
      if (!fullUrl || !heroImg || !trackEl) {
        // Fallback: just swap image
        if (fullUrl && heroImg) {
          heroImg.src = addImageClass(fullUrl, 'imagebox');
          currentGalleryIndex = index;
          thumbnails.forEach(function(t, i) {
            t.classList.toggle('post-image-thumb--active', i === index);
          });
        }
        return;
      }
      
      isAnimating = true;
      
      // Determine direction based on index comparison
      var direction = index > fromIndex ? 'left' : 'right';
      
      // Create temporary image for the incoming slide
      var nextImg = document.createElement('img');
      nextImg.className = 'post-image-hero post-image-hero--sliding';
      nextImg.style.position = 'absolute';
      nextImg.style.top = '0';
      nextImg.style.left = direction === 'left' ? '100%' : '-100%';
      nextImg.style.width = '100%';
      nextImg.style.height = '100%';
      nextImg.style.objectFit = 'cover';
      nextImg.alt = '';
      
      // Preload the image
      var preloader = new Image();
      preloader.onload = function() {
        nextImg.src = preloader.src;
        trackEl.appendChild(nextImg);
        
        // Force reflow
        trackEl.offsetHeight;
        
        // Animate both images together
        trackEl.style.transition = 'transform 0.3s ease-out';
        trackEl.style.transform = 'translateX(' + (direction === 'left' ? '-100%' : '100%') + ')';
        
        setTimeout(function() {
          // Update main image and clean up
          heroImg.src = nextImg.src;
          currentGalleryIndex = index;
          
          // Remove temp image and reset transform
          trackEl.style.transition = 'none';
          trackEl.style.transform = 'translateX(0)';
          if (nextImg.parentNode) {
            nextImg.parentNode.removeChild(nextImg);
          }
          
          // Update thumbnail active state
          thumbnails.forEach(function(t, i) {
            t.classList.toggle('post-image-thumb--active', i === index);
          });
          
          isAnimating = false;
        }, 300);
      };
      
      preloader.onerror = function() {
        // If preload fails, just swap without animation
        heroImg.src = addImageClass(fullUrl, 'imagebox');
        currentGalleryIndex = index;
        thumbnails.forEach(function(t, i) {
          t.classList.toggle('post-image-thumb--active', i === index);
        });
        isAnimating = false;
      };
      
      preloader.src = addImageClass(fullUrl, 'imagebox');
    }
    
    thumbnails.forEach(function(thumb, idx) {
      thumb.addEventListener('click', function() {
        var fullUrl = thumb.dataset.fullUrl || '';
        if (fullUrl && heroImg) {
          navigateToImageAnimated(idx, currentGalleryIndex);
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
      heroContainer.addEventListener('click', function() {
        if (window.ImageModalComponent) {
          // Get current full-size URL (without imagebox class)
          var currentSrc = galleryImages[currentGalleryIndex] || galleryImages[0];
          ImageModalComponent.open(currentSrc, {
            images: galleryImages,
            startIndex: currentGalleryIndex
          });
        }
      });
    }
    
    // Touch swipe support for hero image gallery with visual sliding
    if (heroContainer && galleryImages.length > 1) {
      var touchStartX = 0;
      var touchStartY = 0;
      var currentTranslate = 0;
      var isDragging = false;
      var isHorizontalSwipe = false;
      var swipeThreshold = 50;
      
      // Reset position without animation
      function resetPosition() {
        if (!trackEl) return;
        trackEl.style.transition = 'transform 0.2s ease-out';
        trackEl.style.transform = 'translateX(0)';
      }
      
      heroContainer.addEventListener('touchstart', function(e) {
        if (!trackEl) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        currentTranslate = 0;
        isDragging = true;
        isHorizontalSwipe = false;
        trackEl.style.transition = 'none';
      }, { passive: true });
      
      heroContainer.addEventListener('touchmove', function(e) {
        if (!isDragging || !trackEl) return;
        
        var touchX = e.touches[0].clientX;
        var touchY = e.touches[0].clientY;
        var deltaX = touchX - touchStartX;
        var deltaY = touchY - touchStartY;
        
        // Determine if this is a horizontal swipe (only check once)
        if (!isHorizontalSwipe && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
          isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
          if (!isHorizontalSwipe) {
            isDragging = false;
            return;
          }
        }
        
        if (isHorizontalSwipe) {
          e.preventDefault();
          // Add resistance at edges
          var resistance = 0.3;
          var isAtStart = currentGalleryIndex === 0 && deltaX > 0;
          var isAtEnd = currentGalleryIndex === galleryImages.length - 1 && deltaX < 0;
          
          if (isAtStart || isAtEnd) {
            currentTranslate = deltaX * resistance;
          } else {
            currentTranslate = deltaX;
          }
          
          trackEl.style.transform = 'translateX(' + currentTranslate + 'px)';
        }
      }, { passive: false });
      
      heroContainer.addEventListener('touchend', function(e) {
        if (!isDragging || !trackEl) return;
        isDragging = false;
        
        var deltaX = currentTranslate;
        
        if (Math.abs(deltaX) > swipeThreshold && isHorizontalSwipe && !isAnimating) {
          isAnimating = true;
          var direction = deltaX < 0 ? 'left' : 'right';
          var nextIndex = deltaX < 0 
            ? (currentGalleryIndex + 1) % galleryImages.length
            : (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;
          var fullUrl = galleryImages[nextIndex];
          
          // Create incoming image positioned at edge
          var nextImg = document.createElement('img');
          nextImg.className = 'post-image-hero post-image-hero--sliding';
          nextImg.style.position = 'absolute';
          nextImg.style.top = '0';
          nextImg.style.left = direction === 'left' ? '100%' : '-100%';
          nextImg.style.width = '100%';
          nextImg.style.height = '100%';
          nextImg.style.objectFit = 'cover';
          nextImg.alt = '';
          
          // Preload and animate
          var preloader = new Image();
          preloader.onload = function() {
            nextImg.src = preloader.src;
            trackEl.appendChild(nextImg);
            
            // Continue animation from current position to full slide
            trackEl.style.transition = 'transform 0.2s ease-out';
            trackEl.style.transform = 'translateX(' + (direction === 'left' ? '-100%' : '100%') + ')';
            
            setTimeout(function() {
              heroImg.src = nextImg.src;
              currentGalleryIndex = nextIndex;
              
              trackEl.style.transition = 'none';
              trackEl.style.transform = 'translateX(0)';
              if (nextImg.parentNode) nextImg.parentNode.removeChild(nextImg);
              
              thumbnails.forEach(function(t, i) {
                t.classList.toggle('post-image-thumb--active', i === nextIndex);
              });
              isAnimating = false;
            }, 200);
          };
          
          preloader.onerror = function() {
            resetPosition();
            isAnimating = false;
          };
          
          preloader.src = addImageClass(fullUrl, 'imagebox');
        } else {
          // Snap back
          resetPosition();
        }
        
        currentTranslate = 0;
        isHorizontalSwipe = false;
      }, { passive: true });
      
      heroContainer.addEventListener('touchcancel', function() {
        isDragging = false;
        isHorizontalSwipe = false;
        resetPosition();
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
            wrap.classList.remove('post--expanded');
            descEl.setAttribute('aria-expanded', 'false');
            showCollapsed();
            syncLocationWallpaper(false);
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
        // Only for .post wrappers that were wired with lat/lng (member-location-container class added in buildPostDetail).
        if (!wrap || !(wrap instanceof Element)) return;
        if (!wrap.classList || !wrap.classList.contains('member-location-container')) return;

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
            // Freeze wallpaper (do not affect other active containers)
            wrap.removeAttribute('data-active');
            if (wrap.__locationWallpaperCtrl && typeof wrap.__locationWallpaperCtrl.freeze === 'function') {
              wrap.__locationWallpaperCtrl.freeze();
            }
          }
        } catch (_eLWPost) {}
      }

      // Apply truncation once element is in DOM and has width
      requestAnimationFrame(function() {
        applyTruncation();
      });

      descEl.addEventListener('click', function(e) {
        var isExpanded = wrap.classList.contains('post--expanded');
        if (isExpanded) {
          // Already expanded - just refresh wallpaper in case it was frozen by click-away
          syncLocationWallpaper(true);
          return;
        }
        e.preventDefault();
        wrap.classList.add('post--expanded');
        descEl.setAttribute('aria-expanded', 'true');
        showExpanded();
        syncLocationWallpaper(true);
      });
      
      // Also handle keyboard for accessibility (only expand, not collapse)
      descEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          var isExpanded = wrap.classList.contains('post--expanded');
          if (isExpanded) return;
          e.preventDefault();
          wrap.classList.add('post--expanded');
          descEl.setAttribute('aria-expanded', 'true');
          showExpanded();
          syncLocationWallpaper(true);
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
   * Close a post by ID
   * @param {string|number} postId - Post ID
   */
  function closePost(postId) {
    var openPost = document.querySelector('.post[data-id="' + postId + '"]');
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
      var subName0 = post.subcategory_name || (mapCard0 && mapCard0.subcategory_name) || '';
      var iconUrl0 = post.subcategory_icon_url || '';
      var loc0 = (mapCard0 && (mapCard0.city || mapCard0.venue_name)) ? String(mapCard0.city || mapCard0.venue_name) : '';

      // Deduplicate (string-safe) and update "last seen" timestamp if already present.
      var seen = {};
      var next = [];

      // 1) Insert/refresh this post at the top.
      var title = (post.map_cards && post.map_cards[0] && post.map_cards[0].title) || post.checkout_title || post.title || '';
      if (title === 'Array') title = 'Post #' + post.id;

      next.push({
        id: targetId,
        post_key: post.post_key,
        title: title,
        thumb_url: rawThumbUrl || '',
        subcategory_key: subKey0 || '',
        subcategory_name: subName0,
        subcategory_icon_url: iconUrl0,
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

    // Always empty (no posts in this site yet).
    postListEl.innerHTML = '';
    
    // Ensure full opacity if we reach empty state (avoids getting stuck at 0.6 from renderPostList).
    postListEl.style.opacity = '1';
    postListEl.style.pointerEvents = 'auto';

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
  }

  /**
   * Render a recent card
   * Structure: .recent-card-wrapper > .recent-card-timestamp + .recent-card
   * @param {Object} entry - Recent history entry { id, post_key, title, timestamp }
   * @returns {HTMLElement|null} Recent card wrapper element
   */
  function renderRecentCard(entry) {
    if (!entry || !entry.id) return null;

    // Create wrapper to hold timestamp + card
    var wrapper = document.createElement('div');
    wrapper.className = 'recent-card-wrapper';

    var el = document.createElement('article');
    el.className = 'recent-card';
    el.dataset.id = String(entry.id);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

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

    var iconHtml = iconUrl
      ? '<span class="recent-card-icon-sub"><img class="recent-card-image-sub" src="' + iconUrl + '" alt="" /></span>'
      : '';

    // Check favorite status
    var isFav = isFavorite(entry.id);

    // Standard Design (no date row - timestamp is above the card)
    el.innerHTML = [
      thumbHtml,
      '<div class="recent-card-meta">',
        '<div class="recent-card-text-title">' + escapeHtml(title) + '</div>',
        '<div class="recent-card-container-info">',
          '<div class="recent-card-row-cat">' + iconHtml + ' ' + (displayName) + '</div>',
          city ? '<div class="recent-card-row-loc"><span class="recent-card-badge" title="Venue">📍</span><span>' + escapeHtml(city) + '</span></div>' : '',
        '</div>',
      '</div>',
      '<div class="recent-card-container-actions">',
      '<button class="recent-card-button-fav" aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favourite">',
      '<span class="recent-card-icon-fav" aria-hidden="true"></span>',
      '</button>',
      '</div>'
    ].join('');

    // Add timestamp above card
    if (lastOpenedText) {
      var timestamp = document.createElement('div');
      timestamp.className = 'recent-card-timestamp';
      timestamp.textContent = lastOpenedText;
      wrapper.appendChild(timestamp);
    }

    wrapper.appendChild(el);

    // Robust thumbnail loader (prevents broken/missing thumbnails if class=thumbnail isn't supported).
    if (rawThumbUrl) {
      wireCardThumbImage(el.querySelector('.recent-card-image'), rawThumbUrl);
    }

    // Click handler for opening/closing post (toggle)
    el.addEventListener('click', function(e) {
      if (e.target.closest('.recent-card-button-fav')) return;
      
      // If this card is already inside a .post section, click means "close"
      if (el.closest('.post')) {
        closePost(entry.id);
        return;
      }

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

    return wrapper;
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
    renderPostCard: renderPostCard,
    renderMapMarkers: renderMapMarkers,
    highlightMapMarker: highlightMapMarker,
    getPostUrl: getPostUrl,
    getHeroUrl: getHeroUrl,
    getRawImageUrl: getRawImageUrl,
    formatPostDates: formatPostDates,
    formatPriceSummaryText: formatPriceSummaryText,
    parsePriceSummary: parsePriceSummary
  };

})();

// Register with App
App.registerModule('post', PostModule);

// Expose globally for consistency with other modules
window.PostModule = PostModule;

