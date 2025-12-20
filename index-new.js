/* ============================================================================
   INDEX.JS - BACKBONE / COORDINATOR
   ============================================================================
   
   Minimal foundation for module communication and initialization.
   Utilities added here only when needed by 2+ modules.
   
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
    console.log(`[App] Module registered: ${name}`);
  }

  function getModule(name) {
    return modules[name] || null;
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
    postsLoadZoom: 8      // Posts and marquee only load when map zoom > this value
  };

  function getConfig(key) {
    return config[key];
  }

  function setConfig(key, value) {
    config[key] = value;
  }


  /* --------------------------------------------------------------------------
     BUNNY.NET CDN FOLDER REGISTRY
     Centralized folder paths for all Bunny.net CDN images
     -------------------------------------------------------------------------- */
  const BUNNY_CDN_BASE = 'https://cdn.funmap.com/';
  
  const bunnyFolders = {
    amenities: 'amenities/',
    avatars: 'avatars/',
    categoryIcons: 'category-icons/',
    dummyImages: 'dummy-images/',
    flags: 'flags/',
    postImages: 'post-images/',
    siteAvatars: 'site-avatars/',
    siteImages: 'site-images/',
    systemImages: 'system-images/'
  };

  /**
   * Get full Bunny CDN URL for an image
   * @param {string} folder - Folder key from bunnyFolders
   * @param {string} filename - Image filename
   * @param {string} [class] - Optional Bunny class for resizing (imagebox, thumbnail, minithumb)
   * @returns {string} Full CDN URL
   */
  function getBunnyUrl(folder, filename, resizeClass) {
    if (!bunnyFolders[folder]) {
      console.warn(`[App] Unknown Bunny folder: ${folder}`);
      return '';
    }
    
    let url = BUNNY_CDN_BASE + bunnyFolders[folder] + filename;
    
    if (resizeClass) {
      url += '?class=' + resizeClass;
    }
    
    return url;
  }

  /**
   * Get Bunny folder path (for building URLs manually if needed)
   * @param {string} folder - Folder key from bunnyFolders
   * @returns {string} Folder path
   */
  function getBunnyFolder(folder) {
    return bunnyFolders[folder] || '';
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
        
        // Apply favicon
        if (settings.favicon) {
          setFavicon(settings.favicon);
        }
        
        // Apply big logo to welcome modal
        if (settings.big_logo && window.WelcomeModalComponent) {
          WelcomeModalComponent.setLogo(settings.big_logo);
        }
        
        // Show welcome modal if enabled
        if (settings.welcome_enabled && window.WelcomeModalComponent) {
          WelcomeModalComponent.open();
        }
        
        // Store settings in state
        state.settings = settings;
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
    console.log('[App] Initializing...');

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
          console.log(`[App] Initialized: ${name}`);
        } catch (err) {
          console.error(`[App] Init error for "${name}":`, err);
        }
      }
    });

    console.log('[App] Initialization complete');
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
    
    // Bunny CDN
    getBunnyUrl,
    getBunnyFolder,
    BUNNY_CDN_BASE
  };

})();

// Expose App globally so modules can check window.App
window.App = App;
