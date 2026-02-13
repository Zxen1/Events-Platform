/* ============================================================================
   INDEX.JS - BACKBONE / COORDINATOR
   ============================================================================
   
   Minimal foundation for module communication and initialization.
   Utilities added here only when needed by 2+ modules.
   
   ============================================================================
   IMAGE SYNC SYSTEM - HOW IT WORKS
   ============================================================================
   
   The image sync system ensures System Images and Category Icons menus load
   instantly while keeping database "baskets" synced with Bunny CDN (or any online
   storage). The system uses a "basket" approach: database tables store all
   available filenames for instant menu loading, then sync in the background.
   
   FILES INVOLVED:
   
   1. components.js
      - IconPickerComponent: Category icon picker menu
      - SystemImagePickerComponent: System image picker menu
      - Both components:
        * Load folder paths and basket data from get-admin-settings.php
        * Display database basket images instantly when menu opens
        * Fetch from API in background (list-files.php GET) to append new images
        * No database syncing - sync handled by admin panel
   
   2. home/funmapco/connectors/list-files.php
      - GET request: Lists filenames from local folders or Bunny CDN Storage API
      - POST request: Syncs database basket tables with API results
      - Sync process:
        * Detects and removes duplicate filenames (keeps lowest ID)
        * Adds new files from API that don't exist in database
        * Removes files from database that no longer exist in API
        * Handles renamed files (old removed, new added)
        * Returns changes array for frontend menu updates
   
   3. home/funmapco/connectors/get-admin-settings.php
      - Fetches admin_settings table (folder paths, system image assignments)
      - Fetches data from multiple tables (category_icons, system_images, amenities, currencies, phone_prefixes)
      - Returns all data needed for instant menu loading
   
   4. home/funmapco/connectors/save-admin-settings.php
      - Saves system image assignments directly to admin_settings table
      - System image assignments stored as: small_logo, big_logo, favicon, etc.
   
   5. Database Tables:
      - admin_settings: Stores folder paths (folder_system_images, folder_category_icons, etc.)
                        and system image assignments (small_logo, big_logo, etc.)
      - category_icons: Stores available category icon filenames (option_filename, option_value, option_label, sort_order, is_active)
      - system_images: Stores available system image filenames (option_filename, option_value, option_label, sort_order, is_active)
      - amenities: Stores available amenity options (option_filename, option_value, option_label, sort_order, is_active)
      - currencies: Stores currency data (option_filename, option_value, option_label, sort_order, is_active)
      - phone_prefixes: Stores phone prefix data (option_filename, option_value, option_label, sort_order, is_active)
      - categories.icon_path: Source of truth for category icon assignments
      - subcategories.icon_path: Source of truth for subcategory icon assignments
   
   HOW IT LINKS TOGETHER:
   
   1. Page Load:
      - get-admin-settings.php loads folder paths and basket data
      - Components cache basket data for instant menu loading
      - NO API calls at startup (fast page load)
   
   2. Menu Opens (System Images or Category Icons):
      - Menu opens instantly, displaying images from database basket
      - Menu is fully interactive immediately
      - API fetch happens in background (list-files.php GET)
      - New images from API are appended to menu
      - No database sync happens here - sync is handled separately
   
   3. When Admin Panel Opens (for all picklist syncs):
      - Sync runs automatically after 1.5 second delay (list-files.php POST)
      - localStorage key checked: 'picklist_synced_[option_group]_[folderPath]' for each folder
      - Also checks 'picklists_synced' for overall status
      - Syncs ALL picklist types in parallel:
        * system-image (from folder_system_images)
        * category-icon (from folder_category_icons)
        * amenity (from folder_amenities)
        * currency (from folder_currencies)
        * phone-prefix (from folder_phone_prefixes)
      - Background, non-blocking - doesn't slow down panel opening
      - Each folder syncs once per session (localStorage prevents duplicates)
   
   4. Sync Process (list-files.php POST):
      - Compares API filenames with database basket
      - Removes duplicates (keeps lowest ID)
      - Adds new files from API
      - Removes files deleted from API
      - Returns changes array
   
   LOCALSTORAGE USAGE:
   - Keys: 'picklist_synced_[option_group]_[folderPath]' for individual folders
          'picklists_synced' for overall sync status
   - Value: 'true' (string) when sync has completed for this session
   - Purpose: Ensures sync runs only once per session per folder path
   - Cleared: When browser localStorage is cleared (allows re-sync)
   
   KEY PRINCIPLES:
   - Menus load instantly from database baskets (no API delay)
   - Sync happens when admin panel opens (non-blocking background task, 1.5 second delay)
   - Sync runs only once per session (localStorage prevents duplicates)
   - Database baskets are source of truth for available filenames
   - Actual assignments stored in admin_settings (system images) or
     categories/subcategories.icon_path (category icons)
   - Sync handles duplicates, new files, deleted files, and renamed files
   
   ============================================================================ */

const App = (function() {
  'use strict';

  /* --------------------------------------------------------------------------
     MODULE REGISTRY
     Sections register themselves, others can find them
     -------------------------------------------------------------------------- */
  const modules = {};

  function registerModule(name, module) {
    modules[name] = module;
    // Module registered
  }

  function getModule(name) {
    if (!modules[name]) {
      throw new Error(`[App] Module "${name}" not found. Register it with registerModule() first.`);
    }
    return modules[name];
  }


  /* --------------------------------------------------------------------------
     EVENT BUS
     Simple pub/sub for cross-module communication
     -------------------------------------------------------------------------- */
  const eventListeners = {};

  function on(event, callback) {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    eventListeners[event].push(callback);
  }

  function off(event, callback) {
    if (!eventListeners[event]) return;
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
  }

  function emit(event, data) {
    if (!eventListeners[event]) return;
    eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[App] Event handler error for "${event}":`, err);
      }
    });
  }


  /* --------------------------------------------------------------------------
     API COMMUNICATION
     Gateway.php wrapper
     -------------------------------------------------------------------------- */
  async function api(action, data = {}) {
    try {
      const formData = new FormData();
      formData.append('action', action);
      
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          formData.append(key, data[key]);
        }
      }

      const response = await fetch('gateway.php', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[App] API error for "${action}":`, err);
      throw err;
    }
  }


  /* --------------------------------------------------------------------------
     CONFIG
     Centralized configuration - change values here, not in individual modules
     -------------------------------------------------------------------------- */
  const config = {
    postsLoadZoom: 8,      // Posts and marquee only load when map zoom > this value
    flyToZoom: 12,         // Fly-to zoom level (synced from DB: flyto_zoom_desktop / flyto_zoom_mobile)
    marqueeWidthThreshold: 1920, // Minimum screen width required to display the marquee
    maxMapCards: 50,       // Threshold for switching to high-density mode
    markerDotSize: 8,      // Diameter of standard listing dots
    markerDotStroke: 2,    // Stroke width for dots and icons
    markerIconSize: 30     // Diameter of featured icon landmarks
  };

  function getConfig(key) {
    return config[key];
  }

  function setConfig(key, value) {
    config[key] = value;
  }


  /* --------------------------------------------------------------------------
     IMAGE FOLDER PATHS
     Folder paths are controlled by admin settings in database
     Admin can use any CDN or local paths - no hardcoding
     -------------------------------------------------------------------------- */
  
  // Folder key to database setting key mapping
  const folderSettingKeys = {
    ageRatings: 'folder_age_ratings',
    amenities: 'folder_amenities',
    avatars: 'folder_avatars',
    categoryIcons: 'folder_category_icons',
    countries: 'folder_countries',
    dummyImages: 'folder_dummy_images',
    currencies: 'folder_currencies',
    phonePrefixes: 'folder_phone_prefixes',
    postImages: 'folder_post_images',
    postSystemImages: 'folder_post_system_images',
    recentSystemImages: 'folder_recent_system_images',
    siteAvatars: 'folder_site_avatars',
    siteImages: 'folder_site_images',
    systemImages: 'folder_system_images'
  };

  /**
   * Get full URL for an image using folder path from admin settings
   * @param {string} folder - Folder key (amenities, avatars, etc.)
   * @param {string} filename - Image filename
   * @param {string} [resizeClass] - Optional resize class (imagebox, thumbnail, minithumb)
   * @returns {string} Full URL
   */
  function getImageUrl(folder, filename, resizeClass) {
    var settingKey = folderSettingKeys[folder];
    if (!settingKey) {
      console.warn(`[App] Unknown folder: ${folder}`);
      return '';
    }
    
    var folderPath = state.settings[settingKey];
    if (!folderPath) {
      console.warn(`[App] Folder path not set in admin settings: ${settingKey}`);
      return '';
    }
    
    // Use folder path directly from admin settings (can be full URL or relative path)
    var url;
    if (folderPath.startsWith('http://') || folderPath.startsWith('https://')) {
      // Full URL provided - use directly
      if (!folderPath.endsWith('/')) {
        folderPath += '/';
      }
      url = folderPath + filename;
    } else {
      // Relative path - use as-is (admin controls the path structure)
      if (!folderPath.endsWith('/')) {
        folderPath += '/';
      }
      url = folderPath + filename;
    }
    
    if (resizeClass) {
      url += '?class=' + resizeClass;
    }
    
    return url;
  }

  /**
   * Get image folder path (for building URLs manually if needed)
   * @param {string} folder - Folder key (amenities, avatars, etc.)
   * @returns {string} Folder path
   */
  function getImageFolder(folder) {
    var settingKey = folderSettingKeys[folder];
    if (!settingKey) return '';
    
    var folderPath = state.settings[settingKey] || '';
    // Return as-is (could be full URL or folder path)
    if (folderPath && !folderPath.endsWith('/')) {
      folderPath += '/';
    }
    return folderPath;
  }

  /**
   * Format a date string into "Sun 16 Jan" format.
   * Includes year only if it's not the current year.
   * @param {string} dateStr - YYYY-MM-DD format
   * @returns {string} Formatted date
   */
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      // If only date provided (YYYY-MM-DD), append time to avoid UTC shift
      var d = (typeof dateStr === 'string' && dateStr.length === 10) ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var formatted = days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
      
      var currentYear = new Date().getFullYear();
      if (d.getFullYear() !== currentYear) {
        formatted += ', ' + d.getFullYear();
      }
      return formatted;
    } catch (e) {
      return dateStr;
    }
  }


  /* --------------------------------------------------------------------------
     SHARED STATE
     Things multiple modules need access to
     -------------------------------------------------------------------------- */
  const state = {
    user: null,           // Current logged-in user (or null)
    isAdmin: false,       // Admin status
    settings: {},         // Site settings from database
    system_images: {},    // System image slot assignments from database
    mapBounds: null,      // Current map viewport (for filtering)
    activePanel: null     // Which panel is open (filter/member/admin)
  };

  function getState(key) {
    return state[key];
  }

  function setState(key, value) {
    const oldValue = state[key];
    state[key] = value;
    emit(`state:${key}`, { key, value, oldValue });
  }


  /* --------------------------------------------------------------------------
     MESSAGE UTILITIES
     Fetch messages from database by key
     -------------------------------------------------------------------------- */
  const messagesCache = {
    user: null,
    admin: null
  };

  async function loadMessagesFromDatabase(includeAdmin = false) {
    try {
      const cacheKey = includeAdmin ? 'admin' : 'user';
      
      // Cache permanently - messages don't change during a session
      if (messagesCache[cacheKey]) {
        return messagesCache[cacheKey];
      }
      
      const response = await fetch('/gateway.php?action=get-admin-settings&include_messages=true');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      if (!result.success || !result.messages) {
        console.warn('Failed to load messages from database:', result.message || result.messages_error);
        return {};
      }
      
      const messagesMap = {};
      result.messages.forEach(container => {
        if (!container.messages || !Array.isArray(container.messages)) return;
        
        container.messages.forEach(message => {
          if (!includeAdmin) {
            const visibleContainers = ['msg_user', 'msg_member'];
            if (!visibleContainers.includes(message.container_key || container.container_key)) {
              return;
            }
            if (message.is_visible === false || message.is_visible === 0) {
              return;
            }
          }
          
          if (message.is_active !== false && message.is_active !== 0) {
            messagesMap[message.message_key] = message;
          }
        });
      });
      
      messagesCache[cacheKey] = messagesMap;
      return messagesMap;
    } catch (error) {
      console.error('Error loading messages from database:', error);
      return {};
    }
  }

  function replacePlaceholders(text, placeholders = {}) {
    if (!text || typeof text !== 'string') {
      return text || '';
    }
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return placeholders[key] !== undefined ? String(placeholders[key]) : match;
    });
  }

  async function getMessage(messageKey, placeholders = {}, includeAdmin = false) {
    if (!messageKey || typeof messageKey !== 'string') {
      return '';
    }
    
    const messages = await loadMessagesFromDatabase(includeAdmin);
    const message = messages[messageKey];
    
    if (!message) {
      console.warn(`Message not found: ${messageKey}`);
      return '';
    }
    
    return replacePlaceholders(message.message_text || '', placeholders);
  }

  // Make getMessage globally available
  window.getMessage = getMessage;
  
  // Expose preload function for early cache priming
  window.preloadMessages = function() {
    loadMessagesFromDatabase(false);
  };


  /* --------------------------------------------------------------------------
     FAVICON
     -------------------------------------------------------------------------- */
  function setFavicon(imagePath) {
    if (!imagePath) return;
    var faviconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    faviconLinks.forEach(function(link) {
      link.href = imagePath;
    });
  }


  /* --------------------------------------------------------------------------
     STARTUP SETTINGS
     Load settings needed at startup: favicon, big_logo, welcome_enabled
     -------------------------------------------------------------------------- */
  let startupSettingsPromise = null;

  function loadStartupSettings() {
    if (startupSettingsPromise) return startupSettingsPromise;

    // Use prefetched promise from HTML head if available, otherwise fetch now
    var fetchPromise = window.__settingsPromise || fetch('/gateway.php?action=get-admin-settings&lite=1')
      .then(function(response) { return response.json(); });
    
    startupSettingsPromise = fetchPromise
      .then(function(data) {
        if (!data.success || !data.settings) return;
        
        var settings = data.settings;
        
        // Update document title with website name and tagline
        if (settings.website_name) {
          var pageTitle = settings.website_name;
          if (settings.website_tagline) {
            pageTitle += ' - ' + settings.website_tagline;
          }
          document.title = pageTitle;
        }
        
        // Store settings in state FIRST so getImageUrl can access them
        // Use setState to emit events so listeners (like early avatar update) are notified
        setState('settings', settings);
        setState('system_images', data.system_images || {});

        // Sync Map Card Breakpoint from database to application config
        if (settings.map_card_breakpoint !== undefined) {
          setConfig('postsLoadZoom', parseFloat(settings.map_card_breakpoint));
        }

        // Sync Fly-To Zoom from database (desktop or mobile based on viewport)
        var isMobile = window.innerWidth <= 530;
        var flyToKey = isMobile ? 'flyto_zoom_mobile' : 'flyto_zoom_desktop';
        if (settings[flyToKey] !== undefined) {
          setConfig('flyToZoom', parseFloat(settings[flyToKey]));
        }

        // Apply Devtools Console Filter (database source of truth; no localStorage dependency)
        try {
          window._consoleFilterEnabled = settings.console_filter === true || settings.console_filter === 'true' || settings.console_filter === '1';
          if (window.ConsoleFilter && typeof window.ConsoleFilter.enable === 'function' && typeof window.ConsoleFilter.disable === 'function') {
            if (window._consoleFilterEnabled) {
              window.ConsoleFilter.enable();
            } else {
              window.ConsoleFilter.disable();
            }
          }
        } catch (e) {
          // ignore
        }

        // Store a few system icon URLs as CSS variables (used by mask-based UI icons)
        try {
          var sys = state.system_images || {};
          function setCssVarUrl(varName, filename) {
            if (!filename) return;
            var url = App.getImageUrl('systemImages', filename);
            document.documentElement.style.setProperty(varName, 'url("' + url + '")');
          }
          setCssVarUrl('--ui-icon-save', sys.icon_save);
          setCssVarUrl('--ui-icon-discard', sys.icon_discard);
          setCssVarUrl('--ui-icon-close', sys.icon_close);
          setCssVarUrl('--ui-icon-clear', sys.icon_clear);
          setCssVarUrl('--ui-icon-favourites', sys.icon_favourites);
          setCssVarUrl('--ui-icon-add-image', sys.icon_add_image);
          setCssVarUrl('--ui-icon-plus', sys.icon_plus);
          setCssVarUrl('--ui-icon-minus', sys.icon_minus);
          setCssVarUrl('--ui-icon-arrow-down', sys.icon_arrow_down);
          setCssVarUrl('--ui-icon-edit', sys.icon_edit);
          setCssVarUrl('--ui-icon-info', sys.icon_info);
          setCssVarUrl('--ui-icon-share', sys.icon_share);
          setCssVarUrl('--ui-icon-drag-handle', sys.icon_drag_handle);
          setCssVarUrl('--ui-icon-more-dots', sys.icon_more_dots);
          setCssVarUrl('--ui-icon-search', sys.icon_search);
          setCssVarUrl('--ui-icon-reactivate', sys.icon_reactivate);
          setCssVarUrl('--ui-icon-trash', sys.icon_trash);
          setCssVarUrl('--ui-icon-flag', sys.icon_flag);
          setCssVarUrl('--ui-icon-tick', sys.icon_tick);
          setCssVarUrl('--ui-icon-hide', sys.icon_hide);
          setCssVarUrl('--ui-icon-show', sys.icon_show);
        } catch (e) {
          // ignore
        }
        
        // Apply favicon from system_images
        if (data.system_images && data.system_images.favicon) {
          var faviconFilename = data.system_images.favicon;
          var faviconUrl = App.getImageUrl('systemImages', faviconFilename);
          setFavicon(faviconUrl);
        }
        
        // Apply big logo to welcome modal from system_images
        if (data.system_images && data.system_images.big_logo && window.WelcomeModalComponent) {
          var bigLogoFilename = data.system_images.big_logo;
          var bigLogoUrl = App.getImageUrl('systemImages', bigLogoFilename);
          WelcomeModalComponent.setLogo(bigLogoUrl);
        }
        
        // Apply welcome title and message
        if (window.WelcomeModalComponent && WelcomeModalComponent.setWelcome) {
          WelcomeModalComponent.setWelcome(settings.welcome_title, settings.welcome_message);
        }
        
        // Show welcome modal if enabled
        if (settings.welcome_enabled && window.WelcomeModalComponent) {
          // Check welcome_load_type: 'everyone' or 'new_users'
          var showWelcome = true;
          if (settings.welcome_load_type === 'new_users') {
            // Only show to brand new visitors (never seen the site before)
            try {
              var hasVisited = localStorage.getItem('funmap-visited');
              if (hasVisited) {
                showWelcome = false;
              }
            } catch (e) {
              // localStorage error - show welcome anyway
            }
          }
          if (showWelcome) {
            WelcomeModalComponent.open();
            // Mark that they've visited (for new_users mode)
            try {
              localStorage.setItem('funmap-visited', '1');
            } catch (e) {}
          }
        }
      })
      .catch(function(err) {
        console.error('[App] Failed to load startup settings:', err);
      });

    return startupSettingsPromise;
  }


  /* --------------------------------------------------------------------------
     INITIALIZATION
     Called on DOMContentLoaded
     -------------------------------------------------------------------------- */
  /* --------------------------------------------------------------------------
     BUTTON ANCHOR CONFIG
     
     Controls which tabs have top/bottom anchors enabled.
     Tabs not listed here default to both anchors ON.
     
     OPTIONS:
       top: false    - Disable top anchor (use for short tabs)
       bottom: false - Disable bottom anchor (rarely needed)
     
     TO ADD A TAB:
       'element-id': { top: false }
       'element-id': { bottom: false }
       'element-id': { top: false, bottom: false }
     
     TO REMOVE A TAB:
       Delete its line (defaults to both anchors ON)
     
     WHEN TO DISABLE TOP ANCHOR:
       Short tabs that don't have expandable content above clickable elements.
       Prevents the "pushed to bottom of screen" issue on small content.
     
     WHEN TO DISABLE BOTTOM ANCHOR:
       Rarely needed. Only if a tab has no expandable content below clicks.
     -------------------------------------------------------------------------- */
  var SLACK_CONFIG = {
    'admin-tab-moderation':  { top: false }
  };

  function applySlackConfig() {
    Object.keys(SLACK_CONFIG).forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var cfg = SLACK_CONFIG[id];
      if (cfg.top === false) el.setAttribute('data-topslack', 'false');
      if (cfg.bottom === false) el.setAttribute('data-bottomslack', 'false');
    });
  }

  /* --------------------------------------------------------------------------
     BUTTON ANCHOR INIT
     Implemented as reusable components in `components.js`.
  */
  function initSlack() {
    // Apply per-tab config first
    applySlackConfig();
    
    var selectors = ['.filter-panel-body', '.admin-panel-body', '.member-panel-body'];
    var isMobile = false;
    try {
      isMobile = (window.matchMedia && window.matchMedia('(max-width: 530px)').matches) || (window.innerWidth <= 530);
    } catch (_eMob) { isMobile = false; }

    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        // Safety cleanup: if a top slack element was previously attached in an older session/build,
        // remove its injected element and clear its CSS var so it cannot cause 4000px "jump" effects.
        try {
          el.style.setProperty('--topSlack', '0px');
          el.style.setProperty('--bottomSlack', '0px');
          var topSlack = el.querySelector('.topSlack');
          if (topSlack && topSlack.parentNode) topSlack.parentNode.removeChild(topSlack);
        } catch (e) {}

        // iOS: nudge scroll position off boundaries to prevent scroll lock.
        try { fixIOSScrollBoundary(el); } catch (_eIOSFix) {}

        // Mobile: DO NOT attach slack systems.
        // They can block scroll direction at edges (the exact bug Paul described).
        if (isMobile) return;

        // Desktop: Attach both slack systems - they check data attributes internally
        BottomSlack.attach(el, { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 });
        TopSlack.attach(el, { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 });
      });
    });
  }

  function init() {
    // App initializing...

    // Load startup settings (favicon, welcome modal)
    loadStartupSettings();

    // Initialize modules in order (they register themselves on load)
    // Map is FIRST for fastest possible tile loading
    // Filter is lazy-loaded on first use (not in this list)
    // Each module's init is called if it exists
    const initOrder = [
      'map',     // First - start tile loading immediately
      'header',
      'filter',  // After header (filter button DOM exists), before post (needs count data)
      'post'
    ];

    initOrder.forEach(name => {
      const module = modules[name];
      if (module && typeof module.init === 'function') {
        try {
          module.init();
          // App module initialized
        } catch (err) {
          console.error(`[App] Init error for "${name}":`, err);
        }
      }
    });

    // Anti-jank: Slack (top & bottom, per-tab config)
    initSlack();
    
    // Global Escape key handler - closes modals, menus, panels in order of focus
    // Priority: Dialogs (capture phase) > Menus (MenuManager) > Panels (panelStack)
    initGlobalEscapeHandler();
    
    // Global autofill compliance - detect browser autofill and trigger validation
    initGlobalAutofillHandler();

    // App initialization complete
  }
  
  /**
   * Global autofill handler
   * Detects browser autofill via animation and triggers input/change events for validation
   */
  function initGlobalAutofillHandler() {
    document.addEventListener('animationstart', function(e) {
      if (e.animationName === 'global-autofill-detected') {
        var input = e.target;
        if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA' || input.tagName === 'SELECT')) {
          // Dispatch input and change events to trigger validation
          try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (err) {
            // IE fallback
            var evt = document.createEvent('Event');
            evt.initEvent('input', true, true);
            input.dispatchEvent(evt);
          }
        }
      }
    }, true);
  }
  
  /**
   * Global Escape key handler
   * Closes the topmost open element in focus order:
   * 1. Dialogs/Modals (handled by their own capture listeners with stopPropagation)
   * 2. Menus (handled by MenuManager which calls preventDefault)
   * 3. Image modal (lightbox)
   * 4. Post modal
   * 5. Welcome modal
   * 6. Panels (topmost first via panelStack)
   */
  function initGlobalEscapeHandler() {
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      
      // If a dialog/menu already handled this, skip
      if (e.defaultPrevented) return;
      
      // 1. Check for image modal (lightbox)
      if (window.ImageModalComponent && ImageModalComponent.isVisible()) {
        ImageModalComponent.close();
        e.preventDefault();
        return;
      }
      // Fallback: check DOM directly for backwards compatibility
      var imageModal = document.querySelector('.image-modal.show');
      if (imageModal) {
        imageModal.classList.remove('show');
        imageModal.setAttribute('aria-hidden', 'true');
        var content = imageModal.querySelector('.image-modal-content');
        if (content) content.innerHTML = '';
        e.preventDefault();
        return;
      }
      
      // 2. Check for post modal
      var postModal = document.querySelector('#post-modal-container:not(.hidden)');
      if (postModal) {
        postModal.classList.add('hidden');
        e.preventDefault();
        return;
      }
      
      // 3. Check for welcome modal
      var welcomeModal = document.querySelector('#welcome-modal.show');
      if (welcomeModal) {
        if (window.WelcomeModalComponent && typeof WelcomeModalComponent.close === 'function') {
          WelcomeModalComponent.close();
        } else {
          welcomeModal.classList.remove('show');
          welcomeModal.setAttribute('aria-hidden', 'true');
        }
        e.preventDefault();
        return;
      }
      
      // 4. Check panelStack for topmost panel
      var top = panelStack[panelStack.length - 1];
      if (!top) return;
      
      // Handle Element panels
      if (top instanceof Element) {
        // Admin panel - module handles unsaved changes internally
        if (top.classList.contains('admin-panel')) {
          if (window.AdminModule && typeof AdminModule.closePanel === 'function') {
            AdminModule.closePanel();
            e.preventDefault();
          }
          return;
        }
        
        // Member panel - module handles unsaved changes internally  
        if (top.classList.contains('member-panel')) {
          if (window.MemberModule && typeof MemberModule.closePanel === 'function') {
            MemberModule.closePanel();
            e.preventDefault();
          }
          return;
        }
        
        // Filter panel
        if (top.classList.contains('filter-panel')) {
          if (window.FilterModule && typeof FilterModule.closePanel === 'function') {
            FilterModule.closePanel();
            e.preventDefault();
          }
          return;
        }
      }
      
      // Handle cleanup callbacks (objects with remove function)
      if (top && typeof top.remove === 'function') {
        panelStack.pop();
        top.remove();
        e.preventDefault();
      }
    }, false);
  }


  /* --------------------------------------------------------------------------
     PANEL STACK - Z-INDEX MANAGEMENT
     Tracks open panels and brings clicked/opened panels to front
     
     Uses CSS variable layers from base.css:
       --layer-panel: 60 (member/admin/filter panels)
       --layer-modal: 90 (modals)
     
     Panels within same layer use small increments (0-9) to stack
     -------------------------------------------------------------------------- */
  const panelStack = [];

  function bringToTop(panelEl) {
    if (!panelEl) return;
    
    // Remove from current position if exists
    const idx = panelStack.indexOf(panelEl);
    if (idx !== -1) panelStack.splice(idx, 1);
    
    // Add to top of stack
    panelStack.push(panelEl);
    
    // Update z-index for all panels in stack
    // Use small increments within the layer (max 9 panels stacked)
    panelStack.forEach(function(p, i) {
      if (p instanceof Element) {
        // Increment within layer: 60, 61, 62... (max 69 for panels)
        // This keeps panels below menus (85), dialogs (86), modals (90)
        var increment = Math.min(i, 9);
        p.style.zIndex = String(60 + increment);
      }
    });
  }

  function removeFromStack(panelEl) {
    if (!panelEl) return;
    const idx = panelStack.indexOf(panelEl);
    if (idx !== -1) panelStack.splice(idx, 1);
  }

  function getTopPanel() {
    for (var i = panelStack.length - 1; i >= 0; i--) {
      var p = panelStack[i];
      if (p instanceof Element && (p.classList.contains('show') || p.classList.contains('admin-panel--show') || p.classList.contains('member-panel--show') || p.classList.contains('filter-panel--show'))) {
        return p;
      }
    }
    return null;
  }


  /* --------------------------------------------------------------------------
     DOM READY
     -------------------------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }


  /* --------------------------------------------------------------------------
     PUBLIC API
     -------------------------------------------------------------------------- */
  return {
    // Module registry
    registerModule,
    getModule,
    // Startup settings (shared admin_settings call)
    whenStartupSettingsReady: function() {
      return loadStartupSettings();
    },
    
    // Event bus
    on,
    off,
    emit,
    
    // API
    api,
    
    // Config
    getConfig,
    setConfig,
    
    // State
    getState,
    setState,
    
    // Panel stack
    bringToTop,
    removeFromStack,
    getTopPanel,
    
    // Favicon
    setFavicon,
    
    // Image URL helpers
    getImageUrl,
    getImageFolder,
    formatDateShort
  };

})();

// Expose App globally so modules can check window.App
window.App = App;
