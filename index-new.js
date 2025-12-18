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
     INITIALIZATION
     Called on DOMContentLoaded
     -------------------------------------------------------------------------- */
  function init() {
    console.log('[App] Initializing...');

    // Initialize modules in order (they register themselves on load)
    // Each module's init is called if it exists
    const initOrder = [
      'header',
      'filter', 
      'map',
      'post',
      'admin',
      'member',
      'marquee',
      'components'
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
    
    // State
    getState,
    setState
  };

})();
