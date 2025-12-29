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
  var backgroundEl = null;
  var postPanelEl = null;
  var postListEl = null;
  var recentsPanelEl = null;

  var currentMode = 'map';
  var lastZoom = null;
  var postsEnabled = false;

  var modeButtonsBound = false;

  /* --------------------------------------------------------------------------
     INIT
     -------------------------------------------------------------------------- */

  function init() {
    panelsContainerEl = document.querySelector('.post-mode-panels');
    if (!panelsContainerEl) {
      throw new Error('[Post] .post-mode-panels container not found.');
    }

    ensureBoardsDom();
    bindAppEvents();
    bindModeButtons();

    // Capture initial mode (HeaderModule already ran, but PostModule may have missed the event).
    currentMode = inferCurrentModeFromHeader() || 'map';
    applyMode(currentMode);

    // Initialize zoom gating if we can.
    primeZoomFromMapIfAvailable();
    updatePostsButtonState();
  }

  function ensureBoardsDom() {
    // Background (dim layer)
    backgroundEl = panelsContainerEl.querySelector('.post-mode-background');
    if (!backgroundEl) {
      backgroundEl = document.createElement('div');
      backgroundEl.className = 'post-mode-background';
      panelsContainerEl.appendChild(backgroundEl);
    }

    // Recent panel (post-prefixed section naming)
    recentsPanelEl = panelsContainerEl.querySelector('.post-recents-panel');
    if (!recentsPanelEl) {
      recentsPanelEl = document.createElement('section');
      recentsPanelEl.className = 'post-recents-panel post-recents-panel--side-left';
      recentsPanelEl.setAttribute('aria-hidden', 'true');
      panelsContainerEl.appendChild(recentsPanelEl);
    }

    // Posts panel
    postPanelEl = panelsContainerEl.querySelector('.post-panel');
    if (!postPanelEl) {
      postPanelEl = document.createElement('section');
      postPanelEl.className = 'post-panel post-panel--side-right';
      postPanelEl.setAttribute('aria-hidden', 'true');

      postListEl = document.createElement('div');
      postListEl.className = 'post-list';
      postPanelEl.appendChild(postListEl);

      panelsContainerEl.appendChild(postPanelEl);
    } else {
      postListEl = postPanelEl.querySelector('.post-list');
      if (!postListEl) {
        postListEl = document.createElement('div');
        postListEl.className = 'post-list';
        postPanelEl.appendChild(postListEl);
      }
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

    var showBoards = (mode === 'posts' || mode === 'recents');
    if (backgroundEl) {
      backgroundEl.classList.toggle('post-mode-background--visible', showBoards);
    }

    if (postPanelEl) {
      var showPosts = (mode === 'posts');
      postPanelEl.classList.toggle('post-panel--visible', showPosts);
      postPanelEl.setAttribute('aria-hidden', showPosts ? 'false' : 'true');
      if (showPosts) {
        renderPostsEmptyState();
      }
    }

    if (recentsPanelEl) {
      var showRecents = (mode === 'recents');
      recentsPanelEl.classList.toggle('post-recents-panel--visible', showRecents);
      recentsPanelEl.setAttribute('aria-hidden', showRecents ? 'false' : 'true');
      if (showRecents) {
        renderRecentsEmptyState();
      }
    }
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
    if (!recentsPanelEl) return;

    // Always empty (no posts exist), but show the login reminder (like live site).
    recentsPanelEl.innerHTML = '';

    var reminderWrap = document.createElement('div');
    reminderWrap.className = 'post-recents-panel-reminder';

    var reminderImg = document.createElement('img');
    reminderImg.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
    reminderImg.alt = 'Cute little monkey in red cape pointing up';
    reminderImg.className = 'post-recents-panel-reminder-image';
    reminderWrap.appendChild(reminderImg);

    var reminderMsg = document.createElement('p');
    reminderMsg.className = 'post-recents-panel-reminder-text';
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

    recentsPanelEl.appendChild(reminderWrap);
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

