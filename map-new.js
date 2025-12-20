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
  let waitForMapTiles = true;
  
  // Markers
  let mapCardMarkers = new Map();    // postId -> { marker, element, state }
  let clusterLayerVisible = true;
  
  // Settings cache
  let adminSettings = {};


  /* ==========================================================================
     SECTION 2: MAPBOX - Map Initialization
     ========================================================================== */
  
  /**
   * Initialize the main wallpaper map
   */
  async function initMap() {
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

    // Load admin settings for starting position
    await loadSettings();

    // Create map (pass DOM element directly, not ID)
    map = new mapboxgl.Map({
      container: container,
      style: 'mapbox://styles/mapbox/standard',
      projection: 'globe',
      center: startCenter,
      zoom: startZoom,
      pitch: startPitch,
      bearing: startBearing,
      attributionControl: true,
      fadeDuration: 0,           // Disable fade animations for better performance
      antialias: false,          // Disable antialiasing for better performance
      refreshExpiredTiles: false // Don't refresh expired tiles during animation
    });

    // Handle map load
    map.once('load', onMapLoad);
    
    // Handle errors
    map.on('error', onMapError);

    console.log('[Map] Map initialized');
  }

  /**
   * Called when map finishes loading
   */
  function onMapLoad() {
    console.log('[Map] Map loaded');
    
    // Show the map (fade in)
    const mapEl = document.querySelector('.map-container');
    if (mapEl) {
      mapEl.style.opacity = '1';
    }
    
    // Initialize controls
    initControls();
    
    // Initialize clusters
    initClusters();
    
    // Bind map events
    bindMapEvents();
    
    // Update zoom indicator
    map.on('zoom', updateZoomIndicator);
    map.on('pitch', updateZoomIndicator);
    updateZoomIndicator();
    
    // Start spin if enabled
    if (spinEnabled) {
      startSpin();
    }
    
    // Emit ready event
    App.emit('map:ready', { map });
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
      // Use GET request (same as admin panel) - POST is blocked by server
      const response = await fetch('/gateway.php?action=get-admin-settings');
      const result = await response.json();
      if (result && result.success && result.settings) {
        adminSettings = result.settings;
        applySettings(result.settings);
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
      }
    }
    
    if (settings.starting_zoom) {
      const zoom = parseFloat(settings.starting_zoom);
      if (Number.isFinite(zoom)) {
        startZoom = zoom;
      }
    }
    
    if (settings.starting_pitch !== undefined) {
      const pitch = parseFloat(settings.starting_pitch);
      if (Number.isFinite(pitch)) {
        startPitch = pitch;
      }
    }
    
    // Spin settings
    if (settings.spin_on_load !== undefined) {
      spinLoadStart = settings.spin_on_load === '1' || settings.spin_on_load === true;
    }
    if (settings.spin_load_type) {
      spinLoadType = settings.spin_load_type;
    }
    if (settings.spin_on_logo !== undefined) {
      spinLogoClick = settings.spin_on_logo === '1' || settings.spin_on_logo === true;
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

    console.log('[Map] Controls initialized');
  }

  /**
   * Handle Google Places geocoder result (from MapControlRowComponent)
   */
  function handleGeocoderResult(result, geocoderKey) {
    console.log('[Map] Geocoder result:', result, geocoderKey);
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
    const container = document.querySelector('.admin-map-geocoder');
    if (!container || !window.MapboxGeocoder) return;

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Set starting location'
    });

    geocoder.addTo(container);

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
  }

  /**
   * Start the globe spin animation
   */
  function startSpin(fromCurrent = false) {
    if (!spinEnabled || spinning || !map) return;
    if (map.getZoom() >= spinZoomMax) return;

    spinning = true;
    App.emit('map:spinStarted');

    function step() {
      if (!spinning || !map) return;

      // Only wait for tiles if setting enabled (skip isMoving check - it causes micro-stutters)
      if (waitForMapTiles && map.areTilesLoaded && !map.areTilesLoaded()) {
        requestAnimationFrame(step);
        return;
      }

      // Rotate globe
      const center = map.getCenter();
      map.setCenter([center.lng + spinSpeed, center.lat]);
      requestAnimationFrame(step);
    }

    if (fromCurrent) {
      requestAnimationFrame(step);
    } else {
      // Ease to starting position first
      map.easeTo({
        center: startCenter,
        zoom: startZoom,
        pitch: startPitch,
        essential: true
      });
      map.once('moveend', () => requestAnimationFrame(step));
    }
  }

  /**
   * Stop the globe spin animation
   */
  function stopSpin() {
    if (!spinning) return;
    spinning = false;
    spinEnabled = false;
    App.emit('map:spinStopped');
  }

  /**
   * Trigger spin from logo click
   */
  function triggerLogoSpin() {
    if (!spinLogoClick || !map) return;
    spinEnabled = true;
    startSpin();
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
    console.log('[Map] Cluster system ready');
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
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
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
    
    // Get icon URL (would come from subcategory or default)
    const iconUrl = post.iconUrl || 'assets/system-images/multi-post-icon-30.webp';
    
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
    console.log('[Map] Initializing map module...');
    
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
  
  return {
    init,
    
    // Map instance
    getMap: () => map,
    getBounds,
    flyTo,
    handleGeocoderResult,
    
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
    
    // Zoom indicator
    updateZoomIndicator
  };

})();

// Register module with App
App.registerModule('map', MapModule);
