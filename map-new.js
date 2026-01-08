/* ============================================================================
   MAP.JS - MAP SECTION
   ============================================================================
   
   Controls the Mapbox map and all map-related functionality.
   
   STRUCTURE:
   1. CONSTANTS & STATE
   2. MAPBOX - Map initialization, controls, events
   3. GOOGLE PLACES - Geocoder result handling
   4. MAPBOX GEOCODER - Admin starting location (Mapbox-only)
   5. CLUSTERS - Marker clustering
   6. MARKERS - Map card markers
   7. SPIN - Globe spin animation
   8. ZOOM INDICATOR
   9. POST MINI-MAPS
   10. SETTINGS
   11. PUBLIC API
   
   EXTERNAL DEPENDENCIES:
   - Mapbox GL JS (mapboxgl)
   - Google Places API (google.maps.places) - via MapControlRowComponent
   - Mapbox Geocoder (MapboxGeocoder) - admin only
   
   INTERNAL DEPENDENCIES:
   - index-new.js (App backbone)
   - components-new.js (MapControlRowComponent)
   
   ============================================================================ */

const MapModule = (function() {
  'use strict';

  /* ==========================================================================
     SECTION 1: CONSTANTS & STATE
     ========================================================================== */
  
  // Mapbox access token
  const MAPBOX_TOKEN = "pk.eyJ1IjoienhlbiIsImEiOiJjbWViaDRibXEwM2NrMm1wcDhjODg4em5iIn0.2A9teACgwpiCy33uO4WZJQ";
  
  // Zoom thresholds
  const MARKER_ZOOM_THRESHOLD = 8;
  const CLUSTER_ZOOM_MAX = 8;
  
  // Pill dimensions
  const SMALL_PILL_WIDTH = 150;
  const SMALL_PILL_HEIGHT = 40;
  const BIG_PILL_WIDTH = 225;
  const BIG_PILL_HEIGHT = 60;
  
  // Icon sizes
  const SMALL_ICON_SIZE = 30;
  const BIG_ICON_SIZE = 50;
  
  // Spin defaults
  const DEFAULT_SPIN_SPEED = 0.015;
  const DEFAULT_SPIN_ZOOM_MAX = 5;
  const DEFAULT_PITCH = 0;
  
  // Text settings
  const MARKER_LABEL_TEXT_SIZE = 11;
  const MARKER_LABEL_MAX_WIDTH_SMALL = 95;
  const MARKER_LABEL_MAX_WIDTH_BIG = 145;


  /* State */
  
  let map = null;                    // Main Mapbox map instance
  let postMaps = new Map();          // Post mini-maps: postId -> map instance

  // Location container wallpaper maps (backgrounds inside Create Post location containers)
  // Keyed by the `.member-location-wallpaper-map` DOM element.
  let locationWallpaperMaps = new Map(); // el -> { map, spinning, orbiting, spinHandler, orbitHandler }
  let locationWallpaperEventsBound = false;
  
  // Geocoders
  let geocoders = {
    map: null,
    filter: null,
    welcome: null,
    adminStarting: null
  };
  
  // Spin state
  let spinning = false;
  let spinEnabled = false;
  let spinSpeed = DEFAULT_SPIN_SPEED;
  let spinZoomMax = DEFAULT_SPIN_ZOOM_MAX;
  let spinLoadStart = false;
  let spinLoadType = 'everyone';     // 'everyone' | 'new_users'
  let spinLogoClick = true;
  
  // Map state
  let startCenter = [0, 0];
  let startZoom = 1.5;
  let startPitch = DEFAULT_PITCH;
  let startBearing = 0;
  let waitForMapTiles = false; // Default false = show immediately; database can override
  
  // Markers
  let mapCardMarkers = new Map();    // postId -> { marker, element, state }
  let clusterLayerVisible = true;
  
  // Settings cache
  let adminSettings = {};
  
  // Debug logging (set to false for production)
  const DEBUG_MAP = false;
  function logDebug(...args) {
    if (DEBUG_MAP) console.log(...args);
  }


  /* ==========================================================================
     SECTION 2: MAPBOX - Map Initialization
     ========================================================================== */
  
  /**
   * Initialize the main wallpaper map
   */
  function initMap() {
    const container = document.querySelector('.map-container');
    if (!container) {
      console.error('[Map] No map container found');
      return;
    }

    // Wait for Mapbox to be ready
    if (!window.mapboxgl) {
      console.error('[Map] Mapbox GL JS not loaded');
      return;
    }

    // Set access token
    if (!MAPBOX_TOKEN || typeof MAPBOX_TOKEN !== 'string') {
      console.error('[Map] Mapbox token is missing or invalid');
      return;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Try to get settings synchronously if already loaded (non-blocking)
    // Prefetch started in HTML head, so it may already be resolved
    try {
      if (window.App && typeof App.getState === 'function') {
        var cached = App.getState('settings');
        if (cached) {
          adminSettings = cached;
          adminSettings.system_images = App.getState('system_images') || {};
          applySettings(adminSettings);
        }
      }
    } catch (_e) {}
    
    // Start async settings load (will apply later if not yet available)
    loadSettings();
    
    // Determine initial style
    // Priority: member setting > localStorage (guest's choice) > admin setting > default
    var initialStyle = 'standard';
    var member = null;
    if (window.MemberModule && window.MemberModule.getCurrentUser) {
      member = window.MemberModule.getCurrentUser();
      if (member && member.map_style) {
        initialStyle = member.map_style;
      }
    }
    if (initialStyle === 'standard') {
      // Guest: localStorage first (their previous choice), then admin setting (site default)
      var storedStyle = localStorage.getItem('map_style');
      if (storedStyle) {
        initialStyle = storedStyle;
      } else if (adminSettings.map_style) {
        initialStyle = adminSettings.map_style;
      }
      // else stays 'standard' default
    }
    var styleUrl = initialStyle === 'standard-satellite' 
      ? 'mapbox://styles/mapbox/standard-satellite'
      : 'mapbox://styles/mapbox/standard';
    
    // Determine initial lighting BEFORE map creation
    // Priority: member setting > localStorage (guest's choice) > admin setting > default
    // This prevents the "flash" of default lighting before switching to the correct value
    var initialLighting = 'day';
    if (member && member.map_lighting) {
      // Logged-in member: use their saved setting
      initialLighting = member.map_lighting;
    } else {
      // Guest: localStorage first (their previous choice), then admin setting (site default)
      var storedLighting = localStorage.getItem('map_lighting');
      if (storedLighting) {
        initialLighting = storedLighting;
      } else if (adminSettings.map_lighting) {
        initialLighting = adminSettings.map_lighting;
      }
      // else stays 'day' default
    }

    // CSS starts map at opacity: 0 to prevent flash
    // The reveal (instant or fade) happens in onMapLoad after tiles are ready
    // This ensures waitForMapTiles setting has time to load from server

    // Create map (pass DOM element directly, not ID)
    // Performance optimizations: renderWorldCopies=false reduces initial load, preserveDrawingBuffer only if needed
    // attributionControl: false - Disabled to prevent "Cannot read properties of null" errors
    // Mapbox attribution control has mutation observers that fail when DOM elements are manipulated
    map = new mapboxgl.Map({
      container: container,
      style: styleUrl,
      projection: 'globe',
      center: startCenter,
      zoom: startZoom,
      pitch: startPitch,
      bearing: startBearing,
      attributionControl: false, // Disabled to fix null dataset errors
      renderWorldCopies: false, // Reduce initial rendering load
      antialias: false // Disable antialiasing for better performance (can enable if quality needed)
    });

    // Apply lighting and start spin on style.load (BEFORE tiles finish loading)
    // This means the map is already spinning while tiles load in the background
    // Note: We call setConfigProperty directly here because setMapLighting() 
    // checks isStyleLoaded() which can cause issues when called from style.load
    map.once('style.load', function() {
      // Apply lighting immediately
      if (initialLighting) {
        try {
          if (typeof map.setConfigProperty === 'function') {
            map.setConfigProperty('basemap', 'lightPreset', initialLighting);
          }
        } catch (e) {
          console.warn('[Map] Initial lighting failed:', e);
        }
      }
      
      // Start spin immediately (while tiles are still loading)
      // This way the map appears already spinning when first visible
      if (spinEnabled) {
        startSpin();
      }
    });

    // Handle map load (tiles finished)
    map.once('load', onMapLoad);
    
    // Handle errors
    map.on('error', onMapError);

    // Map initialized
  }

  /**
   * Called when map finishes loading
   * Optimized: Defer non-critical operations to reduce requestAnimationFrame violations
   */
  function onMapLoad() {
    // Map loaded - reveal the map
    const mapEl = document.querySelector('.map-container');
    if (mapEl) {
      if (waitForMapTiles) {
        // Fade in smoothly
        mapEl.style.transition = 'opacity 0.8s ease-in';
        mapEl.style.opacity = '1';
      } else {
        // Show instantly
        mapEl.style.opacity = '1';
      }
    }
    
    // Emit ready event immediately (other modules may depend on this)
    App.emit('map:ready', { map });
    
    // Defer non-critical operations to next frame to avoid blocking render loop
    requestAnimationFrame(function() {
      // Initialize controls (deferred)
      initControls();
      
      // Initialize clusters (deferred)
      initClusters();
      
      // Bind map events (deferred)
      bindMapEvents();
      
      // Update zoom indicator (deferred)
      map.on('zoom', updateZoomIndicator);
      map.on('pitch', updateZoomIndicator);
      updateZoomIndicator();
      
      // Spin is now started earlier on style.load (before tiles finish)
      // so the map appears already spinning when first visible
      
      // Lighting is now applied earlier on style.load (before tiles finish)
      // This prevents the "flash" of default lighting before switching to correct value
    });
  }

  /**
   * Clear Mapbox tile cache (IndexedDB)
   * Call this after upgrading Mapbox version to get fresh tiles
   */
  function clearMapboxCache() {
    return new Promise(function(resolve, reject) {
      if (!window.indexedDB) {
        resolve(); // No IndexedDB support, nothing to clear
        return;
      }

      // Mapbox stores tiles in IndexedDB databases
      // We need to delete all databases that start with 'mapbox-'
      var deletePromises = [];
      
      // Get list of all databases
      indexedDB.databases().then(function(databases) {
        databases.forEach(function(db) {
          if (db.name && db.name.indexOf('mapbox') !== -1) {
            var deleteReq = indexedDB.deleteDatabase(db.name);
            deletePromises.push(new Promise(function(res, rej) {
              deleteReq.onsuccess = function() { res(); };
              deleteReq.onerror = function() { rej(deleteReq.error); };
              deleteReq.onblocked = function() { res(); }; // Continue even if blocked
            }));
          }
        });
        
        Promise.all(deletePromises).then(function() {
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        // If databases() is not supported, try to delete known Mapbox DB names
        var knownDbs = ['mapbox-tiles', 'mapbox-cache'];
        var fallbackPromises = knownDbs.map(function(dbName) {
          return new Promise(function(res) {
            var deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = function() { res(); };
            deleteReq.onerror = function() { res(); }; // Ignore errors
            deleteReq.onblocked = function() { res(); };
          });
        });
        Promise.all(fallbackPromises).then(function() {
          resolve();
        });
      });
    });
  }

  /**
   * Handle map errors
   */
  function onMapError(e) {
    if (e && e.error) {
      const msg = e.error.message || '';
      if (msg.includes('token') || msg.includes('Unauthorized')) {
        console.error('[Map] Authentication error:', e.error);
      }
    }
  }


  /* ==========================================================================
     SECTION 10: SETTINGS
     ========================================================================== */
  
  /**
   * Load admin settings from server
   */
  async function loadSettings() {
    try {
      // Use shared startup settings (single request). No extra fetch here.
      if (window.App && typeof App.whenStartupSettingsReady === 'function') {
        await App.whenStartupSettingsReady();
      }
      if (window.App && typeof App.getState === 'function') {
        adminSettings = App.getState('settings') || {};
        adminSettings.system_images = App.getState('system_images') || {};
        logDebug('[Map] loadSettings: map_lighting =', adminSettings.map_lighting, 'map_style =', adminSettings.map_style, 'spin_on_load =', adminSettings.spin_on_load);
        applySettings(adminSettings);
        
        // If map already exists, apply settings that weren't available at creation time
        if (map) {
          // Apply starting position if map was at default (0,0)
          // applySettings() already updated startCenter, startZoom, startPitch from admin settings
          var currentCenter = map.getCenter();
          if (currentCenter && Math.abs(currentCenter.lng) < 0.01 && Math.abs(currentCenter.lat) < 0.01) {
            // Map is at default 0,0 - jump to admin starting position
            if (startCenter[0] !== 0 || startCenter[1] !== 0) {
              logDebug('[Map] loadSettings: Jumping to starting position:', startCenter, 'zoom:', startZoom);
              map.jumpTo({
                center: startCenter,
                zoom: startZoom,
                pitch: startPitch
              });
            }
          }
          
          // Determine lighting and style from priority chain
          var member = (window.MemberModule && window.MemberModule.getCurrentUser) ? window.MemberModule.getCurrentUser() : null;
          
          // Lighting: member > localStorage > admin > default
          var lighting = 'day';
          if (member && member.map_lighting) {
            lighting = member.map_lighting;
            logDebug('[Map] loadSettings: Using member lighting:', lighting);
          } else {
            var storedLighting = localStorage.getItem('map_lighting');
            if (storedLighting) {
              lighting = storedLighting;
              logDebug('[Map] loadSettings: Using localStorage lighting:', lighting);
            } else if (adminSettings.map_lighting) {
              lighting = adminSettings.map_lighting;
              logDebug('[Map] loadSettings: Using admin lighting:', lighting);
            }
          }
          
          // Style: member > localStorage > admin > default
          var style = 'standard';
          if (member && member.map_style) {
            style = member.map_style;
            logDebug('[Map] loadSettings: Using member style:', style);
          } else {
            var storedStyle = localStorage.getItem('map_style');
            if (storedStyle) {
              style = storedStyle;
              logDebug('[Map] loadSettings: Using localStorage style:', style);
            } else if (adminSettings.map_style) {
              style = adminSettings.map_style;
              logDebug('[Map] loadSettings: Using admin style:', style);
            }
          }
          
          // Apply style FIRST (if different from default), then lighting AFTER style loads
          // This prevents race conditions where lighting is applied then immediately lost
          if (style !== 'standard') {
            logDebug('[Map] loadSettings: Applying style:', style, 'then lighting:', lighting);
            var styleUrl = style === 'standard-satellite' 
              ? 'mapbox://styles/mapbox/standard-satellite'
              : 'mapbox://styles/mapbox/standard';
            map.setStyle(styleUrl);
            // Apply lighting after new style loads
            map.once('style.load', function() {
              logDebug('[Map] loadSettings: Style loaded, now applying lighting:', lighting);
              applyLightingDirect(lighting);
            });
          } else {
            // Standard style - just apply lighting
            logDebug('[Map] loadSettings: Applying lighting:', lighting);
            setMapLighting(lighting);
          }
          
          // Start spin if enabled (updateSpinEnabled was called in applySettings)
          logDebug('[Map] loadSettings: spinEnabled =', spinEnabled, 'spinning =', spinning);
          if (spinEnabled && !spinning) {
            logDebug('[Map] loadSettings: Starting spin');
            startSpin();
          }
        }
      }
    } catch (err) {
      console.warn('[Map] Failed to load settings:', err);
    }
  }

  /**
   * Apply settings to map state
   */
  function applySettings(settings) {
    // Starting position
    if (settings.starting_lat && settings.starting_lng) {
      const lat = parseFloat(settings.starting_lat);
      const lng = parseFloat(settings.starting_lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        startCenter = [lng, lat];
        logDebug('[Map] applySettings: startCenter =', startCenter);
      }
    }
    
    if (settings.starting_zoom) {
      const zoom = parseFloat(settings.starting_zoom);
      if (Number.isFinite(zoom)) {
        startZoom = zoom;
        logDebug('[Map] applySettings: startZoom =', startZoom);
      }
    }
    
    if (settings.starting_pitch !== undefined) {
      const pitch = parseFloat(settings.starting_pitch);
      if (Number.isFinite(pitch)) {
        startPitch = pitch;
        logDebug('[Map] applySettings: startPitch =', startPitch);
      }
    }
    
    // Spin settings (database stores as string 'true'/'false' or '1'/'0')
    if (settings.spin_on_load !== undefined) {
      var val = settings.spin_on_load;
      spinLoadStart = val === '1' || val === 'true' || val === true;
      logDebug('[Map] applySettings: spin_on_load =', val, '→ spinLoadStart =', spinLoadStart);
    }
    if (settings.spin_load_type) {
      spinLoadType = settings.spin_load_type;
      logDebug('[Map] applySettings: spin_load_type =', spinLoadType);
    }
    if (settings.spin_on_logo !== undefined) {
      var val2 = settings.spin_on_logo;
      spinLogoClick = val2 === '1' || val2 === 'true' || val2 === true;
    }
    if (settings.spin_zoom_max) {
      const max = parseFloat(settings.spin_zoom_max);
      if (Number.isFinite(max)) {
        spinZoomMax = max;
      }
    }
    if (settings.spin_speed) {
      const speed = parseFloat(settings.spin_speed);
      if (Number.isFinite(speed)) {
        spinSpeed = speed;
      }
    }
    
    // Wait for tiles (database stores as string 'true'/'false')
    if (settings.wait_for_map_tiles !== undefined) {
      const val = settings.wait_for_map_tiles;
      waitForMapTiles = val === '1' || val === 'true' || val === true;
    }
    
    // Update spin enabled state
    updateSpinEnabled();
  }


  /* ==========================================================================
     SECTION 3: GOOGLE PLACES - Geocoder Controls
     Uses MapControlRowComponent from components-new.js
     ========================================================================== */
  
  // Store control instances
  let mapControls = null;
  let mapControlsEl = null;
  let mapControlsHomeParent = null;
  let mapControlsHomeNextSibling = null;
  let mapControlsResizeTimer = null;
  const HEADER_CONTROLS_BREAKPOINT_PX = 900;
  
  /**
   * Initialize map controls (Google Places geocoder + Mapbox geolocate/compass)
   */
  function initControls() {
    // Wait for Google Places API
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      setTimeout(initControls, 100);
      return;
    }
    
    // Wait for MapControlRowComponent
    if (typeof MapControlRowComponent === 'undefined') {
      setTimeout(initControls, 100);
      return;
    }

    // Map area controls (Google Places + Mapbox geolocate/compass)
    const mapControlsContainer = document.querySelector('.map-controls');
    if (mapControlsContainer) {
      // Cache home position so we can restore on narrow screens
      if (!mapControlsEl) {
        mapControlsEl = mapControlsContainer;
        mapControlsHomeParent = mapControlsEl.parentElement || null;
        mapControlsHomeNextSibling = mapControlsEl.nextSibling || null;
      }
      mapControls = MapControlRowComponent.create(mapControlsContainer, {
        variant: 'map',
        placeholder: 'Search venues or places',
        map: map,
        onResult: function(result) {
          handleGeocoderResult(result, 'map');
        }
      });
      
      geocoders.map = mapControls.geocoder;
    }

    // Admin starting location uses Mapbox geocoder (separate)
    initAdminStartingGeocoder();

    // Map controls initialized
    syncMapControlsPlacement();
    bindMapControlsResize();
  }

  function isWideEnoughForHeaderControls() {
    return window.innerWidth >= HEADER_CONTROLS_BREAKPOINT_PX;
  }

  function bindMapControlsResize() {
    if (bindMapControlsResize._bound) return;
    bindMapControlsResize._bound = true;
    window.addEventListener('resize', function() {
      if (mapControlsResizeTimer) clearTimeout(mapControlsResizeTimer);
      mapControlsResizeTimer = setTimeout(syncMapControlsPlacement, 50);
    });
  }

  function syncMapControlsPlacement() {
    if (!mapControlsEl) mapControlsEl = document.querySelector('.map-controls');
    if (!mapControlsEl) return;

    const headerSlot = document.getElementById('header-map-controls');
    const shouldBeInHeader = !!headerSlot && isWideEnoughForHeaderControls();

    if (shouldBeInHeader) {
      if (mapControlsEl.parentElement !== headerSlot) {
        headerSlot.appendChild(mapControlsEl);
      }
      mapControlsEl.classList.add('map-controls--in-header');
      return;
    }

    // Restore to map area
    mapControlsEl.classList.remove('map-controls--in-header');
    if (mapControlsHomeParent && mapControlsEl.parentElement !== mapControlsHomeParent) {
      if (mapControlsHomeNextSibling && mapControlsHomeNextSibling.parentElement === mapControlsHomeParent) {
        mapControlsHomeParent.insertBefore(mapControlsEl, mapControlsHomeNextSibling);
      } else {
        mapControlsHomeParent.insertBefore(mapControlsEl, mapControlsHomeParent.firstChild);
      }
    }
  }

  /**
   * Handle Google Places geocoder result (from MapControlRowComponent)
   */
  function handleGeocoderResult(result, geocoderKey) {
    // Geocoder result received
    if (!result || !result.center) return;

    const lng = result.center[0];
    const lat = result.center[1];

    // Close welcome modal on search
    if (window.WelcomeModalComponent) {
      WelcomeModalComponent.close();
    }

    // Stop spin on interaction
    stopSpin();

    // Fly to location (Mapbox)
    if (map) {
      // Use viewport bounds if available
      if (result.bbox && result.bbox.length === 4) {
        map.fitBounds([
          [result.bbox[0], result.bbox[1]],
          [result.bbox[2], result.bbox[3]]
        ], {
          padding: 50,
          maxZoom: 15
        });
      } else {
        map.flyTo({
          center: [lng, lat],
          zoom: 14,
          essential: true
        });
      }
    }

    // Emit event
    App.emit('map:placeSelected', {
      geocoder: geocoderKey,
      lat: lat,
      lng: lng,
      name: result.text || '',
      address: result.place_name || ''
    });
  }


  /* ==========================================================================
     SECTION 4: MAPBOX GEOCODER - Admin Starting Location Only
     Uses Mapbox Geocoder (not Google Places)
     ========================================================================== */

  /**
   * Initialize admin starting location geocoder (Mapbox only, not Google)
   */
  function initAdminStartingGeocoder() {
    const container = document.getElementById('admin-geocoder-starting');
    if (!container || !window.MapboxGeocoder) return;

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Set starting location'
    });

    geocoder.addTo(container);

    // Apply explicit classes for styling (avoid structural CSS selectors)
    const geocoderRoot = container.querySelector('.mapboxgl-ctrl-geocoder');
    if (geocoderRoot) {
      geocoderRoot.classList.add('admin-mapbox-geocoder--starting');
      const input = geocoderRoot.querySelector('input.mapboxgl-ctrl-geocoder--input') || geocoderRoot.querySelector('input');
      if (input) input.classList.add('admin-mapbox-geocoder-input--starting');

      const icons = geocoderRoot.querySelectorAll('.mapboxgl-ctrl-geocoder--icon, .mapboxgl-ctrl-geocoder--icon-loading, .mapboxgl-ctrl-geocoder--icon-search');
      icons.forEach((el) => el.classList.add('admin-mapbox-geocoder-icon--starting'));

      const btn = geocoderRoot.querySelector('.mapboxgl-ctrl-geocoder--button');
      if (btn) btn.classList.add('admin-mapbox-geocoder-button--starting');

      const pinRight = geocoderRoot.querySelector('.mapboxgl-ctrl-geocoder--pin-right');
      if (pinRight) pinRight.classList.add('admin-mapbox-geocoder-pinright--starting');

      // Suggestions are dynamic; keep their classes synced (debounced to avoid typing freezes).
      const syncSuggestions = () => {
        const suggestions = geocoderRoot.querySelector('.suggestions');
        if (!suggestions) return;
        suggestions.classList.add('admin-mapbox-geocoder-suggestions--starting');
        suggestions.querySelectorAll('li').forEach((li) => {
          const a = li.querySelector('a');
          if (!a) return;
          a.classList.add('admin-mapbox-geocoder-suggestion-link--starting');
          a.classList.toggle('admin-mapbox-geocoder-suggestion-link--active', li.classList.contains('active'));
        });
      };

      let suggestionsSyncScheduled = false;
      const scheduleSyncSuggestions = () => {
        if (suggestionsSyncScheduled) return;
        suggestionsSyncScheduled = true;
        requestAnimationFrame(() => {
          suggestionsSyncScheduled = false;
          syncSuggestions();
        });
      };

      scheduleSyncSuggestions();
      try {
        const observer = new MutationObserver(scheduleSyncSuggestions);
        observer.observe(geocoderRoot, { subtree: true, childList: true });
      } catch (e) {
        // ignore
      }
    }

    geocoder.on('result', (e) => {
      if (e.result && e.result.center) {
        App.emit('map:startingLocationChanged', {
          lng: e.result.center[0],
          lat: e.result.center[1],
          address: e.result.place_name
        });
      }
    });

    geocoders.adminStarting = geocoder;
  }


  /* ==========================================================================
     SECTION 2B: MAPBOX - Map Events
     ========================================================================== */
  
  /**
   * Bind map interaction events
   */
  function bindMapEvents() {
    if (!map) return;

    // Bounds change events
    ['moveend', 'zoomend'].forEach(event => {
      map.on(event, () => {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        
        App.emit('map:boundsChanged', {
          bounds: bounds,
          zoom: zoom,
          center: map.getCenter()
        });
        
        // Update cluster visibility
        updateClusterVisibility(zoom);
        
        // Update markers visibility
        updateMarkersVisibility(zoom);
      });
    });

    // Stop spin on user interaction
    ['dragstart', 'zoomstart', 'rotatestart'].forEach(event => {
      map.on(event, () => {
        if (spinning) stopSpin();
        // Close welcome modal on map interaction
        if (window.WelcomeModalComponent && WelcomeModalComponent.isVisible()) {
          WelcomeModalComponent.close();
        }
      });
    });

    // Click to stop spin and close welcome modal
    map.on('click', () => {
      if (spinning) stopSpin();
      if (window.WelcomeModalComponent && WelcomeModalComponent.isVisible()) {
        WelcomeModalComponent.close();
      }
    });
  }


  /* ==========================================================================
     SECTION 7: SPIN - Globe Spin Animation (Mapbox)
     ========================================================================== */
  
  /**
   * Update spin enabled state based on settings
   */
  function updateSpinEnabled() {
    const isFirstVisit = !localStorage.getItem('funmap_visited');
    const shouldSpin = spinLoadStart && (spinLoadType === 'everyone' || (spinLoadType === 'new_users' && isFirstVisit));
    spinEnabled = shouldSpin;
    logDebug('[Map] updateSpinEnabled: spinLoadStart =', spinLoadStart, 'spinLoadType =', spinLoadType, 'isFirstVisit =', isFirstVisit, '→ spinEnabled =', spinEnabled);
  }

  /**
   * Spin globe one step (called on moveend to chain animations)
   */
  function spinGlobeStep() {
    if (!spinning || !map) return;
    
    const center = map.getCenter();
    const newLng = center.lng + spinSpeed * 10; // Larger step since easeTo handles interpolation
    
    map.easeTo({
      center: [newLng, center.lat],
      duration: 200, // Smooth 200ms animation per step
      easing: (t) => t // Linear easing for constant speed
    });
  }

  /**
   * Start the globe spin animation (uses Mapbox's easeTo for smooth GPU-accelerated rotation)
   */
  function startSpin(fromCurrent = false) {
    if (!spinEnabled || spinning || !map) return;
    if (map.getZoom() >= spinZoomMax) return;

    spinning = true;
    App.emit('map:spinStarted');

    // Chain animations - when one ends, start next
    map.on('moveend', spinGlobeStep);

    if (fromCurrent) {
      spinGlobeStep();
    } else {
      // Ease to starting position first, then start spinning
      map.easeTo({
        center: startCenter,
        zoom: startZoom,
        pitch: startPitch,
        duration: 1000,
        essential: true
      });
    }
  }

  /**
   * Stop the globe spin animation
   */
  function stopSpin() {
    if (!spinning) return;
    spinning = false;
    spinEnabled = false;
    // Remove the moveend listener to stop the chain
    map.off('moveend', spinGlobeStep);
    App.emit('map:spinStopped');
  }

  /**
   * Trigger spin from logo click
   */
  function triggerLogoSpin() {
    if (!spinLogoClick || !map) return;
    spinEnabled = true;
    // Spin from the current view (no reposition) if below zoom threshold.
    startSpin(true);
  }


  /* ==========================================================================
     SECTION 5: CLUSTERS - Marker Clustering (Mapbox)
     ========================================================================== */
  
  const CLUSTER_LAYER_ID = 'post-clusters';
  const CLUSTER_COUNT_LAYER_ID = 'post-cluster-count';

  /**
   * Initialize cluster layers
   */
  function initClusters() {
    if (!map) return;

    // Clusters are created when post source is added
    // This sets up the layer configuration
    // Cluster system ready
  }

  /**
   * Create cluster layers for posts source
   */
  function createClusterLayers() {
    if (!map || !map.getSource('posts')) return;

    // Remove existing layers if present
    if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) map.removeLayer(CLUSTER_COUNT_LAYER_ID);
    if (map.getLayer(CLUSTER_LAYER_ID)) map.removeLayer(CLUSTER_LAYER_ID);

    // Cluster circles
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'circle',
      source: 'posts',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2f3b73',
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,    // radius for count < 100
          100, 30,  // radius for count >= 100
          750, 40   // radius for count >= 750
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Cluster count labels
    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: 'posts',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Cluster click handler
    map.on('click', CLUSTER_LAYER_ID, handleClusterClick);
    map.on('mouseenter', CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'grab';
    });
  }

  /**
   * Handle cluster click - zoom in
   */
  function handleClusterClick(e) {
    const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER_ID] });
    if (!features.length) return;

    const clusterId = features[0].properties.cluster_id;
    const source = map.getSource('posts');

    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom
      });
    });
  }

  /**
   * Update cluster layer visibility based on zoom
   */
  function updateClusterVisibility(zoom) {
    if (!map) return;
    
    const shouldShow = zoom < CLUSTER_ZOOM_MAX;
    if (shouldShow !== clusterLayerVisible) {
      clusterLayerVisible = shouldShow;
      
      if (map.getLayer(CLUSTER_LAYER_ID)) {
        map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', shouldShow ? 'visible' : 'none');
      }
      if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
        map.setLayoutProperty(CLUSTER_COUNT_LAYER_ID, 'visibility', shouldShow ? 'visible' : 'none');
      }
    }
  }


  /* --------------------------------------------------------------------------
     MAP CARDS (Markers)
     -------------------------------------------------------------------------- */
  
  /**
   * Update markers visibility based on zoom
   */
  function updateMarkersVisibility(zoom) {
    const shouldShow = zoom >= MARKER_ZOOM_THRESHOLD;
    
    mapCardMarkers.forEach((entry) => {
      if (entry.element) {
        entry.element.style.display = shouldShow ? '' : 'none';
      }
    });
  }

  /**
   * Create a map card marker for a post
   */
  function createMapCardMarker(post, lng, lat) {
    if (!map || !post || !post.id) return null;

    // Remove existing marker for this post
    removeMapCardMarker(post.id);

    // Create marker element
    const el = document.createElement('div');
    el.className = 'map-card-container';
    el.innerHTML = buildMapCardHTML(post, 'small');

    // Create Mapbox marker
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center'
    })
      .setLngLat([lng, lat])
      .addTo(map);

    // Store reference
    const entry = {
      marker: marker,
      element: el,
      post: post,
      state: 'small',
      lng: lng,
      lat: lat
    };
    mapCardMarkers.set(post.id, entry);

    // Bind events
    el.addEventListener('mouseenter', () => onMapCardHover(post.id, true));
    el.addEventListener('mouseleave', () => onMapCardHover(post.id, false));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onMapCardClick(post.id);
    });

    return entry;
  }

  /**
   * Build map card HTML
   */
  function buildMapCardHTML(post, state) {
    const isActive = state === 'big';
    const iconSize = isActive ? BIG_ICON_SIZE : SMALL_ICON_SIZE;
    const pillClass = `map-card-${state}`;
    
    // Get icon URL from post or database setting (no hardcoded fallback)
    // Get multi_post_icon from system_images and convert to full URL
    let iconUrl = post.iconUrl;
    if (!iconUrl && adminSettings.system_images && adminSettings.system_images.multi_post_icon) {
      const filename = adminSettings.system_images.multi_post_icon;
      iconUrl = window.App.getImageUrl('systemImages', filename);
    }
    
    // Truncate title for label
    const title = post.title || '';
    const maxWidth = isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL;
    
    return `
      <img class="map-card-icon" src="${iconUrl}" width="${iconSize}" height="${iconSize}" alt="">
      <div class="map-card-pill ${pillClass}" data-id="${post.id}" data-state="${state}">
        <div class="map-card-labels">
          <div class="map-card-title">${escapeHtml(title)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Handle map card hover
   */
  function onMapCardHover(postId, isHovering) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state === 'big') return;

    if (isHovering) {
      entry.element.classList.add('is-hovered');
      updateMapCardState(postId, 'hover');
    } else {
      entry.element.classList.remove('is-hovered');
      updateMapCardState(postId, 'small');
    }

    App.emit('map:cardHover', { postId, isHovering });
  }

  /**
   * Handle map card click
   */
  function onMapCardClick(postId) {
    // Set this card to active
    setActiveMapCard(postId);
    
    // Stop spin
    stopSpin();
    
    // Emit event for post module to open the post
    App.emit('map:cardClicked', { postId });
  }

  /**
   * Set a map card to active (big) state
   */
  function setActiveMapCard(postId) {
    // Deactivate all other cards
    mapCardMarkers.forEach((entry, id) => {
      if (id !== postId && entry.state === 'big') {
        updateMapCardState(id, 'small');
        entry.element.classList.remove('is-active');
      }
    });

    // Activate this card
    const entry = mapCardMarkers.get(postId);
    if (entry) {
      updateMapCardState(postId, 'big');
      entry.element.classList.add('is-active');
    }
  }

  /**
   * Update map card visual state
   */
  function updateMapCardState(postId, newState) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state === newState) return;

    entry.state = newState;
    entry.element.innerHTML = buildMapCardHTML(entry.post, newState);
  }

  /**
   * Remove a map card marker
   */
  function removeMapCardMarker(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry) return;

    entry.marker.remove();
    mapCardMarkers.delete(postId);
  }

  /**
   * Clear all map card markers
   */
  function clearAllMapCardMarkers() {
    mapCardMarkers.forEach(entry => entry.marker.remove());
    mapCardMarkers.clear();
  }


  /* --------------------------------------------------------------------------
     POST MINI-MAPS
     -------------------------------------------------------------------------- */
  
  /**
   * Create a mini-map for a post's venue menu
   * @param {HTMLElement|string} containerEl - DOM element or class selector
   * @param {Array} locations - Array of location objects with lng/lat
   */
  function createPostMap(containerEl, locations) {
    const container = typeof containerEl === 'string' 
      ? document.querySelector(containerEl) 
      : containerEl;
    if (!container || !locations || !locations.length) return null;

    // Calculate bounds from locations
    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach(loc => {
      if (loc.lng && loc.lat) {
        bounds.extend([loc.lng, loc.lat]);
      }
    });

    // Create mini-map (pass DOM element directly)
    const postMap = new mapboxgl.Map({
      container: container,
      style: 'mapbox://styles/mapbox/streets-v12',
      bounds: bounds,
      fitBoundsOptions: { padding: 50, maxZoom: 15 },
      interactive: true,
      attributionControl: false
    });

    // Add markers for each location
    postMap.on('load', () => {
      locations.forEach((loc) => {
        if (!loc.lng || !loc.lat) return;

        const el = document.createElement('div');
        el.className = 'map-post-location-marker';
        
        new mapboxgl.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .addTo(postMap);
      });
    });

    // Store reference using the container element
    postMaps.set(container, postMap);
    
    return postMap;
  }

  /**
   * Remove a post mini-map
   * @param {HTMLElement|string} containerEl - DOM element or class selector
   */
  function removePostMap(containerEl) {
    const container = typeof containerEl === 'string' 
      ? document.querySelector(containerEl) 
      : containerEl;
    const postMap = postMaps.get(container);
    if (postMap) {
      postMap.remove();
      postMaps.delete(container);
    }
  }


  /* --------------------------------------------------------------------------
     LOCATION CONTAINER WALLPAPER MAPS (background)
     -------------------------------------------------------------------------- */

  const LOCATION_WALLPAPER_DEFAULT_CENTER = [0, 0];
  const LOCATION_WALLPAPER_DEFAULT_ZOOM = 1.5;
  const LOCATION_WALLPAPER_DEFAULT_PITCH = 0;
  const LOCATION_WALLPAPER_DEFAULT_BEARING = 0;
  const LOCATION_WALLPAPER_TARGET_ZOOM = 18;
  const LOCATION_WALLPAPER_TARGET_PITCH = 70; // Full Mapbox GL map supports > 60

  function getWallpaperLightingPreset() {
    // Use the site's current lighting preference when available; otherwise default to dusk.
    try {
      var v = localStorage.getItem('map_lighting');
      if (v && typeof v === 'string' && v.trim()) return v.trim();
    } catch (e) {}
    return 'dusk';
  }

  function applyLightingToMapInstance(m, preset) {
    if (!m || !preset) return;
    try {
      if (typeof m.setConfigProperty === 'function') {
        m.setConfigProperty('basemap', 'lightPreset', preset);
      } else if (typeof m.setConfig === 'function') {
        m.setConfig({ basemap: { lightPreset: preset } });
      }
    } catch (e) {
      // ignore
    }
  }

  function stopLocationWallpaperAnimations(state) {
    if (!state || !state.map) return;
    try { state.map.stop(); } catch (e) {}

    if (state.spinning && state.spinHandler) {
      try { state.map.off('moveend', state.spinHandler); } catch (e) {}
    }
    if (state.orbiting && state.orbitHandler) {
      try { state.map.off('moveend', state.orbitHandler); } catch (e) {}
    }
    state.spinning = false;
    state.orbiting = false;
  }

  function startLocationWallpaperSpin(state) {
    if (!state || !state.map) return;
    stopLocationWallpaperAnimations(state);

    state.spinning = true;
    state.spinHandler = function() {
      if (!state.spinning || !state.map) return;
      // Rotate bearing in small steps (does not require loading new tiles).
      var b = 0;
      try { b = state.map.getBearing(); } catch (e) { b = 0; }
      var next = (b + 1) % 360;
      try {
        state.map.easeTo({
          bearing: next,
          duration: 200,
          easing: function(t) { return t; }
        });
      } catch (e2) {}
    };

    try { state.map.on('moveend', state.spinHandler); } catch (e3) {}
    try { state.spinHandler(); } catch (e4) {}
  }

  function startLocationWallpaperOrbit(state) {
    if (!state || !state.map) return;
    stopLocationWallpaperAnimations(state);

    state.orbiting = true;
    state.orbitHandler = function() {
      if (!state.orbiting || !state.map) return;
      var b = 0;
      try { b = state.map.getBearing(); } catch (e) { b = 0; }
      var next = (b + 2) % 360;
      try {
        state.map.easeTo({
          bearing: next,
          duration: 250,
          easing: function(t) { return t; }
        });
      } catch (e2) {}
    };

    try { state.map.on('moveend', state.orbitHandler); } catch (e3) {}
    try { state.orbitHandler(); } catch (e4) {}
  }

  function flyLocationWallpaperTo(state, lng, lat) {
    if (!state || !state.map) return;
    stopLocationWallpaperAnimations(state);

    // Ensure dusk-style lighting for the "wow" moment.
    applyLightingToMapInstance(state.map, getWallpaperLightingPreset());

    try {
      state.map.easeTo({
        center: [lng, lat],
        zoom: LOCATION_WALLPAPER_TARGET_ZOOM,
        pitch: LOCATION_WALLPAPER_TARGET_PITCH,
        bearing: 0,
        duration: 2200,
        essential: true
      });
      state.map.once('moveend', function() {
        startLocationWallpaperOrbit(state);
      });
    } catch (e) {}
  }

  function ensureLocationWallpaperMap(mapEl) {
    if (!mapEl) return null;
    if (locationWallpaperMaps.has(mapEl)) return locationWallpaperMaps.get(mapEl);
    if (!window.mapboxgl) return null;

    // Ensure token is set (main map init usually does this, but keep this standalone).
    if (MAPBOX_TOKEN && typeof MAPBOX_TOKEN === 'string') {
      try { mapboxgl.accessToken = MAPBOX_TOKEN; } catch (e) {}
    }

    const m = new mapboxgl.Map({
      container: mapEl,
      style: 'mapbox://styles/mapbox/standard',
      projection: 'globe',
      center: LOCATION_WALLPAPER_DEFAULT_CENTER,
      zoom: LOCATION_WALLPAPER_DEFAULT_ZOOM,
      pitch: LOCATION_WALLPAPER_DEFAULT_PITCH,
      bearing: LOCATION_WALLPAPER_DEFAULT_BEARING,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: false,
      antialias: false
    });

    const state = { map: m, spinning: false, orbiting: false, spinHandler: null, orbitHandler: null };
    locationWallpaperMaps.set(mapEl, state);

    // Apply lighting once style is available, then start spinning.
    m.once('style.load', function() {
      applyLightingToMapInstance(m, getWallpaperLightingPreset());
    });
    m.once('load', function() {
      startLocationWallpaperSpin(state);
    });

    // If the DOM node is removed, clean up the Mapbox instance.
    try {
      const obs = new MutationObserver(function() {
        if (!document.body.contains(mapEl)) {
          try { stopLocationWallpaperAnimations(state); } catch (e) {}
          try { m.remove(); } catch (e2) {}
          try { locationWallpaperMaps.delete(mapEl); } catch (e3) {}
          try { obs.disconnect(); } catch (e4) {}
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e5) {}

    return state;
  }

  function bindLocationWallpaperEventsOnce() {
    if (locationWallpaperEventsBound) return;
    locationWallpaperEventsBound = true;

    // Typing inside the location container stops the wallpaper motion immediately.
    document.addEventListener('locationwallpaper:typing', function(e) {
      try {
        var container = e && e.detail ? e.detail.container : null;
        if (!container) return;
        var mapEl = container.querySelector('.member-location-wallpaper-map');
        if (!mapEl) return;
        var state = locationWallpaperMaps.get(mapEl);
        if (!state) return;
        stopLocationWallpaperAnimations(state);
      } catch (err) {}
    });

    // When Google Places confirms coordinates, fly to them then orbit.
    document.addEventListener('locationwallpaper:confirmed', function(e) {
      try {
        var detail = e && e.detail ? e.detail : null;
        if (!detail) return;
        var container = detail.container;
        var lat = detail.lat;
        var lng = detail.lng;
        if (!container || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        var mapEl = container.querySelector('.member-location-wallpaper-map');
        if (!mapEl) return;
        var state = ensureLocationWallpaperMap(mapEl);
        if (!state) return;
        flyLocationWallpaperTo(state, lng, lat);
      } catch (err) {}
    });
  }

  /**
   * Initialize (or re-scan) wallpaper maps inside location containers.
   * Call this after location containers are rendered.
   */
  function initLocationContainerWallpapers(rootEl) {
    if (!rootEl) return;
    if (!window.mapboxgl) return;
    bindLocationWallpaperEventsOnce();

    var mapEls = rootEl.querySelectorAll('.member-location-wallpaper-map');
    mapEls.forEach(function(el) {
      ensureLocationWallpaperMap(el);
    });
  }


  /* ==========================================================================
     SECTION 8: ZOOM INDICATOR (Mapbox)
     ========================================================================== */
  
  /**
   * Update the zoom indicator display
   */
  function updateZoomIndicator() {
    const indicator = document.querySelector('.map-zoom-indicator');
    if (!indicator || !map) return;

    const zoom = map.getZoom().toFixed(1);
    const pitch = Math.round(map.getPitch());
    indicator.textContent = `Zoom ${zoom} • Pitch ${pitch}°`;
  }


  /* --------------------------------------------------------------------------
     UTILITIES
     -------------------------------------------------------------------------- */
  
  /**
   * Escape HTML for safe rendering
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get current map bounds
   */
  function getBounds() {
    return map ? map.getBounds() : null;
  }

  /**
   * Fly to a location
   */
  function flyTo(lng, lat, zoom = 14) {
    if (!map) return;
    stopSpin();
    map.flyTo({
      center: [lng, lat],
      zoom: zoom,
      essential: true
    });
  }


  /* --------------------------------------------------------------------------
     MODULE INITIALIZATION
     -------------------------------------------------------------------------- */
  
  /**
   * Initialize the map module
   */
  function init() {
    // Map initializing...
    
    // Mark first visit
    if (!localStorage.getItem('funmap_visited')) {
      localStorage.setItem('funmap_visited', 'true');
    }
    
    // Initialize map
    initMap();
  }


  /* ==========================================================================
     SECTION 11: PUBLIC API
     ========================================================================== */
  
  /**
   * Update map style (standard or standard-satellite)
   */
  function setMapStyle(style) {
    if (!map) {
      console.warn('[Map] setMapStyle: Map not initialized');
      return;
    }
    var styleUrl = style === 'standard-satellite' 
      ? 'mapbox://styles/mapbox/standard-satellite'
      : 'mapbox://styles/mapbox/standard';
    logDebug('[Map] Setting style to:', styleUrl);
    
    // Store current lighting to re-apply after style loads
    var currentLighting = adminSettings.map_lighting || localStorage.getItem('map_lighting') || 'day';
    if (window.MemberModule && window.MemberModule.getCurrentUser) {
      var member = window.MemberModule.getCurrentUser();
      if (member && member.map_lighting) {
        currentLighting = member.map_lighting;
      }
    }
    
    map.setStyle(styleUrl);
    
    // Re-apply lighting after style loads
    map.once('style.load', function() {
      logDebug('[Map] Style loaded, re-applying lighting:', currentLighting);
      applyLightingDirect(currentLighting);
    });
  }

  /**
   * Apply lighting directly without checking isStyleLoaded
   * Use this when you know the style just loaded (e.g., from style.load callback)
   */
  function applyLightingDirect(preset) {
    if (!map) return;
    try {
      if (typeof map.setConfigProperty === 'function') {
        map.setConfigProperty('basemap', 'lightPreset', preset);
        logDebug('[Map] Lighting preset applied:', preset);
      } else if (typeof map.setConfig === 'function') {
        map.setConfig({ basemap: { lightPreset: preset } });
        logDebug('[Map] Lighting preset applied via setConfig:', preset);
      }
    } catch (e) {
      console.warn('[Map] Failed to apply lighting:', e);
    }
  }

  /**
   * Update map lighting preset
   */
  function setMapLighting(preset) {
    if (!map) {
      console.warn('[Map] setMapLighting: Map not initialized');
      return;
    }
    
    logDebug('[Map] Setting lighting to:', preset);
    
    if (!map.isStyleLoaded()) {
      logDebug('[Map] Style not loaded yet, waiting...');
      map.once('style.load', function() {
        applyLightingDirect(preset);
      });
      return;
    }
    
    // Style is loaded, apply directly
    applyLightingDirect(preset);
  }

  /**
   * Get current map state for persistence (center, zoom, pitch, bearing)
   */
  function getMapState() {
    if (!map) return null;
    try {
      var center = map.getCenter();
      return {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing()
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Restore map state from persistence
   */
  function setMapState(state) {
    if (!map || !state) return;
    try {
      map.jumpTo({
        center: state.center,
        zoom: state.zoom,
        pitch: state.pitch || 0,
        bearing: state.bearing || 0
      });
    } catch (e) {
      console.warn('[Map] Failed to restore map state:', e);
    }
  }

  return {
    init,
    
    // Map instance
    getMap: () => map,
    getMapState,
    setMapState,
    getBounds,
    flyTo,
    handleGeocoderResult,
    setMapStyle,
    setMapLighting,
    
    // Geocoders
    getGeocoder: (key) => geocoders[key],
    clearGeocoder: (key) => {
      if (geocoders[key] && geocoders[key].clear) {
        geocoders[key].clear();
      }
    },
    
    // Spin
    startSpin,
    stopSpin,
    triggerLogoSpin,
    isSpinning: () => spinning,
    
    // Map cards
    createMapCardMarker,
    removeMapCardMarker,
    clearAllMapCardMarkers,
    setActiveMapCard,
    
    // Clusters
    createClusterLayers,
    
    // Post maps
    createPostMap,
    removePostMap,

    // Location container wallpaper maps
    initLocationContainerWallpapers,
    
    // Zoom indicator
    updateZoomIndicator,
    
    // Cache management
    clearMapboxCache
  };

})();

// Register module with App
App.registerModule('map', MapModule);

// Expose globally for consistency with other modules
window.MapModule = MapModule;
