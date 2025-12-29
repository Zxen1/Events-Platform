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
   - Mascot illustration (recents panel)
   
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
  var recentsPanelEl = null;
  var recentsPanelContentEl = null;

  var currentMode = 'map';
  var lastZoom = null;
  var postsEnabled = false;

  var modeButtonsBound = false;

  // Panel motion state (kept in-module for cleanliness; no DOM-stashed handlers).
  var panelMotion = {
    post: { token: 0, hideHandler: null, hideTimeoutId: 0 },
    recents: { token: 0, hideHandler: null, hideTimeoutId: 0 }
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
    recentsPanelEl = panelsContainerEl.querySelector('.recents-panel');
    if (!recentsPanelEl) {
      recentsPanelEl = document.createElement('aside');
      recentsPanelEl.className = 'recents-panel';
      recentsPanelEl.setAttribute('aria-hidden', 'true');
      recentsPanelEl.setAttribute('role', 'dialog');
      panelsContainerEl.appendChild(recentsPanelEl);
    }

    recentsPanelContentEl = recentsPanelEl.querySelector('.recents-panel-content');
    if (!recentsPanelContentEl) {
      recentsPanelContentEl = document.createElement('div');
      recentsPanelContentEl.className = 'recents-panel-content recents-panel-content--side-left recents-panel-content--hidden';
      recentsPanelEl.appendChild(recentsPanelContentEl);
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
    var recentsBtn = getModeButton('recents');
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
    if (recentsBtn && mapBtn) {
      recentsBtn.addEventListener('click', function(e) {
        if (currentMode !== 'recents') return;
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
        renderPostsEmptyState();
      }
    }

    if (recentsPanelEl && recentsPanelContentEl) {
      var showRecents = (mode === 'recents');
      togglePanel(recentsPanelEl, recentsPanelContentEl, 'recents', showRecents);
      if (showRecents) {
        renderRecentsEmptyState();
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
      // Should never happen (only "post" and "recents"), but keep it safe.
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
    img.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
    img.alt = 'Cute little monkey in red cape pointing up';
    img.className = 'post-panel-empty-image';
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

  function renderRecentsEmptyState() {
    if (!recentsPanelContentEl) return;

    // Always empty (no posts exist), but show the login reminder (like live site).
    recentsPanelContentEl.innerHTML = '';

    var reminderWrap = document.createElement('div');
    reminderWrap.className = 'recents-panel-reminder';

    var reminderImg = document.createElement('img');
    reminderImg.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
    reminderImg.alt = 'Cute little monkey in red cape pointing up';
    reminderImg.className = 'recents-panel-reminder-image';
    reminderWrap.appendChild(reminderImg);

    var reminderMsg = document.createElement('p');
    reminderMsg.className = 'recents-panel-reminder-text';
    reminderMsg.dataset.messageKey = 'msg_member_login_reminder';
    reminderMsg.textContent = '';
    reminderWrap.appendChild(reminderMsg);

    if (typeof window.getMessage === 'function') {
      window.getMessage('msg_member_login_reminder', {}, false).then(function(text) {
        if (typeof text === 'string') {
          reminderMsg.textContent = text;
        }
      }).catch(function() {
        // ignore
      });
    }

    recentsPanelContentEl.appendChild(reminderWrap);
  }

  /* --------------------------------------------------------------------------
     BUTTON ANCHORS (Anti-jank)
     Attach to scroll containers so clicked controls don't "fly away"
     -------------------------------------------------------------------------- */

  function attachButtonAnchors() {
    if (!postPanelContentEl || !recentsPanelContentEl) return;
    if (!window.ButtonAnchorBottom || !window.ButtonAnchorTop) {
      throw new Error('[Post] ButtonAnchorBottom and ButtonAnchorTop are required (components-new.js).');
    }

    // Same options used elsewhere (keep site-wide feel consistent).
    var options = { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 };
    ButtonAnchorBottom.attach(postPanelContentEl, options);
    ButtonAnchorTop.attach(postPanelContentEl, options);
    ButtonAnchorBottom.attach(recentsPanelContentEl, options);
    ButtonAnchorTop.attach(recentsPanelContentEl, options);
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
     PUBLIC API (minimal for now)
     -------------------------------------------------------------------------- */

  return {
    init: init
  };

})();

// Register with App
App.registerModule('post', PostModule);

// Expose globally for consistency with other modules
window.PostModule = PostModule;

