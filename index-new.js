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
   
   1. components-new.js
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
        throw err;
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
    postsLoadZoom: 8      // Posts and marquee only load when map zoom > this value
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
    amenities: 'folder_amenities',
    avatars: 'folder_avatars',
    categoryIcons: 'folder_category_icons',
    dummyImages: 'folder_dummy_images',
    currencies: 'folder_currencies',
    phonePrefixes: 'folder_phone_prefixes',
    postImages: 'folder_post_images',
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


  /* --------------------------------------------------------------------------
     SHARED STATE
     Things multiple modules need access to
     -------------------------------------------------------------------------- */
  const state = {
    user: null,           // Current logged-in user (or null)
    isAdmin: false,       // Admin status
    settings: {},         // Site settings from database
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
    admin: null,
    lastFetch: 0,
    maxAge: 60000
  };

  async function loadMessagesFromDatabase(includeAdmin = false) {
    try {
      const cacheKey = includeAdmin ? 'admin' : 'user';
      const now = Date.now();
      
      if (messagesCache[cacheKey] && (now - messagesCache.lastFetch) < messagesCache.maxAge) {
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
      messagesCache.lastFetch = now;
      
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
  function loadStartupSettings() {
    fetch('/gateway.php?action=get-admin-settings')
      .then(function(response) { return response.json(); })
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
        state.settings = settings;
        
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
        
        // Show welcome modal if enabled
        if (settings.welcome_enabled && window.WelcomeModalComponent) {
          WelcomeModalComponent.open();
        }
      })
      .catch(function(err) {
        console.error('[App] Failed to load startup settings:', err);
      });
  }


  /* --------------------------------------------------------------------------
     INITIALIZATION
     Called on DOMContentLoaded
     -------------------------------------------------------------------------- */
  function init() {
    // App initializing...

    // Load startup settings (favicon, welcome modal)
    loadStartupSettings();

    // Initialize modules in order (they register themselves on load)
    // Each module's init is called if it exists
    const initOrder = [
      'header',
      'filter', 
      'map',
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

    // App initialization complete
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
    getImageFolder
  };

})();

// Expose App globally so modules can check window.App
window.App = App;

/* ============================================================================
   SCROLL BUFFER SYSTEM
   Simple system: Add buffer space at top, stop scrolling at header
   ============================================================================ */

var ScrollBufferModule = {
    buffers: new Map(), // Map of container -> buffer data
    BUFFER_SIZE: 10000, // Large invisible buffer space (off-screen)
    
    /**
     * Initialize scroll buffer for a container
     * @param {HTMLElement} container - Scrollable container element
     * @param {Object} options - Configuration options
     */
    init: function(container, options) {
        if (!container) return;
        
        options = options || {};
        var bufferSize = options.bufferSize || this.BUFFER_SIZE;
        
        // Store buffer data
        var bufferData = {
            container: container,
            bufferSize: bufferSize,
            previousScrollTop: container.scrollTop
        };
        
        this.buffers.set(container, bufferData);
        
        // Add buffer padding
        container.style.setProperty('--scroll-buffer-size', bufferSize + 'px');
        container.style.paddingTop = 'var(--scroll-buffer-size, ' + bufferSize + 'px)';
        
        // Set initial scroll position to buffer start (so content is visible)
        // Wait for next frame to ensure padding is applied and content is measured
        requestAnimationFrame(function() {
            // Only set scrollTop to bufferSize if content is taller than buffer
            // Otherwise content might be shorter and we'd scroll past it
            var currentScrollHeight = container.scrollHeight;
            if (currentScrollHeight > bufferSize) {
                container.scrollTop = bufferSize;
                bufferData.previousScrollTop = bufferSize;
            } else {
                // Content is shorter than buffer, stay at top (scrollTop = 0)
                container.scrollTop = 0;
                bufferData.previousScrollTop = 0;
            }
        });
        
        // Watch for scroll events - stop at header when scrolling up
        container.addEventListener('scroll', this.handleScroll.bind(this, container), { passive: true });
    },
    
    /**
     * Handle scroll events - stop at header when scrolling up
     */
    handleScroll: function(container) {
        var bufferData = this.buffers.get(container);
        if (!bufferData) return;
        
        var scrollTop = container.scrollTop;
        
        // If user scrolls up past the buffer (where content starts), stop at header
        // Only prevent scrolling UP past bufferSize, don't force on initial load
        if (scrollTop < bufferData.bufferSize && scrollTop < bufferData.previousScrollTop) {
            container.scrollTop = bufferData.bufferSize;
        }
        
        bufferData.previousScrollTop = scrollTop;
    },
    
    /**
     * Remove scroll buffer from container
     */
    remove: function(container) {
        var bufferData = this.buffers.get(container);
        if (!bufferData) return;
        
        // Remove padding
        container.style.paddingTop = '';
        container.style.removeProperty('--scroll-buffer-size');
        
        // Remove from map
        this.buffers.delete(container);
    }
};

// Expose globally
window.ScrollBufferModule = ScrollBufferModule;
