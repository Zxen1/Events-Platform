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
     IMPORTANT (Developer Note): TWO FILTERING PIPELINES EXIST
     --------------------------------------------------------------------------
     This file (`map-new.js`) owns the LOW-ZOOM filtering pipeline (clusters).
     It is designed to stay fast at worldwide zoom levels by fetching AGGREGATED data.
     
     - Source of truth for current filters is `localStorage['funmap_filters']`
     - Cluster requests include those filter params and return grouped counts
       via `/gateway.php?action=get-clusters`
     
     At HIGH ZOOM (zoom >= postsLoadZoom; default 8), the app switches to the
     detailed pipeline in `post-new.js`:
     - Fetches actual posts/map-cards "in this map area" using `bounds`
       via `/gateway.php?action=get-posts`
     
     So: clusters = worldwide aggregated; posts/map-cards = in-area detailed.
     ========================================================================== */

  /* ==========================================================================
     SECTION 1: CONSTANTS & STATE
     ========================================================================== */
  
  // Mapbox access token
  const MAPBOX_TOKEN = "pk.eyJ1IjoienhlbiIsImEiOiJjbWViaDRibXEwM2NrMm1wcDhjODg4em5iIn0.2A9teACgwpiCy33uO4WZJQ";
  
  // Zoom thresholds
  function getMarkerZoomThreshold() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('postsLoadZoom') : 8;
  }
  function getClusterZoomMax() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('postsLoadZoom') : 8;
  }
  
  // High-Density Layers
  let highDensityData = { type: 'FeatureCollection', features: [] };
  const loadedIcons = new Set();
  
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

  // High-Density Settings
  function getMaxMapCards() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('maxMapCards') : 50;
  }
  function getDotSize() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('markerDotSize') : 8;
  }
  function getDotStrokeWidth() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('markerDotStroke') : 2;
  }
  function getIconDotSize() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('markerIconSize') : 30;
  }
  const DOT_SOURCE_ID = 'high-density-source';
  const DOT_LAYER_ID = 'standard-dots';
  const ICON_LAYER_ID = 'featured-icons';
  const GLOW_LAYER_ID = 'marker-glow';


  /* State */
  
  let map = null;                    // Main Mapbox map instance
  let currentStyleUrl = '';          // Track active style URL to avoid unnecessary reload/flicker
  let styleChangeToken = 0;          // Increment to cancel stale async callbacks
  
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

  // Persist/restore the user's last map viewport so refresh/return doesn't snap back to world view.
  // This is the map equivalent of saved filters.
  const MAP_VIEW_STORAGE_KEY = 'mapView';
  let hasSavedMapView = false;
  let saveMapViewTimer = null;
  let hoveredPostId = null; // Track currently hovered post for map effects

  function loadSavedMapView() {
    try {
      const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.center) || parsed.center.length !== 2) return null;
      const lng = Number(parsed.center[0]);
      const lat = Number(parsed.center[1]);
      const zoom = Number(parsed.zoom);
      const pitch = (parsed.pitch === undefined || parsed.pitch === null) ? null : Number(parsed.pitch);
      const bearing = (parsed.bearing === undefined || parsed.bearing === null) ? null : Number(parsed.bearing);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) return null;
      return {
        center: [lng, lat],
        zoom: zoom,
        pitch: Number.isFinite(pitch) ? pitch : null,
        bearing: Number.isFinite(bearing) ? bearing : null
      };
    } catch (e) {
      return null;
    }
  }

  function getLoggedInUserFiltersJson() {
    try {
      // DB-first without fallback chains: read the stored auth payload directly so map init
      // never depends on module load order and logged-in users are never influenced by mapView.
      const raw = localStorage.getItem('member-auth-current');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.id || !parsed.account_email) return null;
      if (!parsed.filters_json || typeof parsed.filters_json !== 'string') return null;
      return parsed.filters_json;
    } catch (e) {
      return null;
    }
  }

  function loadMapViewFromFiltersJson(filtersJsonStr) {
    try {
      if (!filtersJsonStr || typeof filtersJsonStr !== 'string') return null;
      const parsed = JSON.parse(filtersJsonStr);
      if (!parsed || typeof parsed !== 'object') return null;
      const m = parsed.map;
      if (!m || typeof m !== 'object') return null;
      // map state is { center: [lng,lat], zoom, pitch, bearing }
      if (!Array.isArray(m.center) || m.center.length !== 2) return null;
      const lng = Number(m.center[0]);
      const lat = Number(m.center[1]);
      const zoom = Number(m.zoom);
      const pitch = (m.pitch === undefined || m.pitch === null) ? null : Number(m.pitch);
      const bearing = (m.bearing === undefined || m.bearing === null) ? null : Number(m.bearing);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) return null;
      return {
        center: [lng, lat],
        zoom: zoom,
        pitch: Number.isFinite(pitch) ? pitch : null,
        bearing: Number.isFinite(bearing) ? bearing : null
      };
    } catch (e) {
      return null;
    }
  }

  function applySavedMapViewToStart(view) {
    if (!view) return false;
    // Only restore (and therefore "persist") a user viewport when they last used the site at or above postsLoadZoom.
    // If their last view was zoomed out below threshold, we treat it as "world view" and use admin starting/spin logic.
    if (!Number.isFinite(view.zoom) || view.zoom < getMarkerZoomThreshold()) {
      try { localStorage.removeItem(MAP_VIEW_STORAGE_KEY); } catch (_eRm) {}
      hasSavedMapView = false;
      return false;
    }
    try {
      startCenter = view.center.slice();
      startZoom = view.zoom;
      if (view.pitch !== null) startPitch = view.pitch;
      if (view.bearing !== null) startBearing = view.bearing;
      hasSavedMapView = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function scheduleSaveMapView() {
    if (!map) return;
    if (saveMapViewTimer) clearTimeout(saveMapViewTimer);
    saveMapViewTimer = setTimeout(function() {
      try {
        if (!map) return;
        const zoom = map.getZoom();

        // Rule: if the user leaves while zoomed out below postsLoadZoom, do NOT persist their view.
        // We clear the memory so it reverts to the default worldwide view on next load.
        if (!Number.isFinite(zoom) || zoom < getMarkerZoomThreshold()) {
          try {
            localStorage.removeItem(MAP_VIEW_STORAGE_KEY);
            hasSavedMapView = false;
            
            // Also clear from account memory if logged in
            const rawUser = localStorage.getItem('member-auth-current');
            if (rawUser) {
              const u = JSON.parse(rawUser);
              if (u && u.filters_json && typeof u.filters_json === 'string') {
                const filters = JSON.parse(u.filters_json);
                if (filters && filters.map) {
                  delete filters.map;
                  const nextFiltersJson = JSON.stringify(filters);
                  u.filters_json = nextFiltersJson;
                  localStorage.setItem('member-auth-current', JSON.stringify(u));
                  if (window.MemberModule && typeof MemberModule.saveSetting === 'function') {
                    MemberModule.saveSetting('filters_json', nextFiltersJson);
                  }
                }
              }
            }
          } catch (_eClear) {}
          return;
        }

        const c = map.getCenter();
        const center = c && typeof c.toArray === 'function' ? c.toArray() : [startCenter[0], startCenter[1]];
        const pitch = typeof map.getPitch === 'function' ? map.getPitch() : startPitch;
        const bearing = typeof map.getBearing === 'function' ? map.getBearing() : startBearing;
        const viewState = { center, zoom, pitch, bearing };

        // Device memory (everyone)
        localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(viewState));
        hasSavedMapView = true;

        // Account memory (members/admins): persist viewport into filters_json.map so it follows the account.
        try {
          const rawUser = localStorage.getItem('member-auth-current');
          if (rawUser) {
            const u = JSON.parse(rawUser);
            if (u && u.id && u.account_email) {
              // Ensure filters_json exists as an object
              let filters = {};
              if (typeof u.filters_json === 'string' && u.filters_json) {
                try { filters = JSON.parse(u.filters_json); } catch(_e) { filters = {}; }
              }
              
              if (filters && typeof filters === 'object') {
                filters.map = viewState;
                const nextFiltersJson = JSON.stringify(filters);
                if (nextFiltersJson !== u.filters_json) {
                  u.filters_json = nextFiltersJson;
                  localStorage.setItem('member-auth-current', JSON.stringify(u));
                  if (window.MemberModule && typeof MemberModule.saveSetting === 'function') {
                    MemberModule.saveSetting('filters_json', nextFiltersJson);
                  }
                }
              }
            }
          }
        } catch (_ePersistAccount) {}
      } catch (e) {
        // ignore
      }
    }, 250);
  }
  
  // Markers
  let mapCardMarkers = new Map();    // postId -> { marker, element, state }
  let clusterLayerVisible = true;
  let lastMapZoom = 0;               // Track zoom for threshold crossing detection
  
  // Track which specific marker (venueKey) was last made active for a given postId
  // (Needed for multi-location posts: one post can have multiple markers.)
  const lastActiveVenueKeyByPostId = new Map(); // postId(string) -> venueKey(string)
  
  // Hover state coordination (prevents flicker when moving between markers)
  let hoverToken = 0;
  let currentHoverPostIds = [];
  
  // Live-site-style hover/click manager (adapted for DOM markers):
  // - Hover is driven by pointer hit-testing (not per-marker mouseenter/mouseleave)
  // - Hover clears immediately (no linger); any fade-out should be CSS-only
  // - Click is resolved on pointerup with a tiny movement threshold (works during fly/drag)
  let hoverManagerBound = false;
  let hoveredVenueKey = '';
  let hoverClearTimerId = 0;
  let pointerDownActive = false;
  let pointerDownVenueKey = '';
  let pointerDownClientX = 0;
  let pointerDownClientY = 0;
  let lastMapCardPointerType = '';
  // Keep hover clear effectively instant; avoids "sticky" hover feeling.
  const HOVER_CLEAR_DELAY_MS = 0;
  const CLICK_MOVE_THRESHOLD_PX = 6;
  
  // Settings cache
  let adminSettings = {};
  
  // Debug logging (set to false for production)
  const DEBUG_MAP = false;
  function logDebug(...args) {
    if (DEBUG_MAP) console.log(...args);
  }

  // Text measurement context
  let measureContext = null;
  const ELLIPSIS_CHAR = '\u2026';


  /* ==========================================================================
     SECTION 1B: TEXT UTILITIES
     ========================================================================== */
  
  /**
   * Get or create canvas context for text measurement
   */
  function ensureMeasureContext() {
    if (measureContext) return measureContext;
    const canvas = document.createElement('canvas');
    measureContext = canvas.getContext('2d');
    return measureContext;
  }
  
  /**
   * Get font string for text measurement (matches global font from base-new.css)
   */
  function measureFont() {
    return `${MARKER_LABEL_TEXT_SIZE}px system-ui, sans-serif`;
  }
  
  /**
   * Shorten text to fit within maxWidth pixels, adding ellipsis
   */
  function shortenText(text, maxWidth) {
    const raw = (text ?? '').toString().trim();
    if (!raw) return '';
    
    const ctx = ensureMeasureContext();
    if (!ctx) return raw;
    
    ctx.font = measureFont();
    if (ctx.measureText(raw).width <= maxWidth) return raw;
    
    let low = 0;
    let high = raw.length;
    let best = ELLIPSIS_CHAR;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (mid <= 0) {
        high = mid - 1;
        continue;
      }
      const candidate = raw.slice(0, mid).trimEnd() + ELLIPSIS_CHAR;
      if (ctx.measureText(candidate).width <= maxWidth) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }
  
  /**
   * Split text into multiple lines that fit within maxWidth
   */
  function splitTextLines(text, maxWidth, maxLines = 2) {
    const normalized = (text ?? '').toString().replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (!Number.isFinite(maxWidth) || maxWidth <= 0 || maxLines <= 0) return [normalized];
    
    const ctx = ensureMeasureContext();
    if (!ctx) return [normalized];
    
    ctx.font = measureFont();
    if (ctx.measureText(normalized).width <= maxWidth) return [normalized];
    
    const lines = [];
    let remaining = normalized;
    
    // First line: don't break words
    const words = remaining.split(/\s+/);
    let firstLine = '';
    let firstLineWords = [];
    
    for (let i = 0; i < words.length; i++) {
      const testLine = firstLineWords.length > 0 
        ? firstLineWords.join(' ') + ' ' + words[i]
        : words[i];
      if (ctx.measureText(testLine).width <= maxWidth) {
        firstLineWords.push(words[i]);
        firstLine = testLine;
      } else {
        break;
      }
    }
    
    if (firstLineWords.length > 0) {
      lines.push(firstLine);
      remaining = words.slice(firstLineWords.length).join(' ');
    }
    
    // Second line: truncate with ellipsis if needed
    if (lines.length < maxLines && remaining) {
      if (ctx.measureText(remaining).width <= maxWidth) {
        lines.push(remaining);
      } else {
        lines.push(shortenText(remaining, maxWidth));
      }
    }
    
    return lines;
  }
  
  /**
   * Get marker label lines for a post
   * Big card: Title (1 line if venue, 2 lines if no venue) + Venue + City
   * Small card: Title (2 lines)
   */
  function getMarkerLabelLines(post, isActive = false) {
    const title = post && post.title ? post.title : '';
    const maxWidth = isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL;
    
    const venueName = post.venue || '';
    const cityName = post.city || '';
    
    // For big cards: if venue exists, title gets 1 line; if no venue, title gets 2 lines
    const titleMaxLines = (isActive && venueName) ? 1 : 2;
    const titleLines = splitTextLines(title, maxWidth, titleMaxLines);
    
    while (titleLines.length < 2) titleLines.push('');
    
    const venueLine = venueName ? shortenText(venueName, maxWidth) : '';
    const cityLine = cityName ? shortenText(cityName, maxWidth) : '';
    
    return {
      line1: titleLines[0] || '',
      line2: titleLines[1] || '',
      venueLine,
      cityLine
    };
  }


  /* ==========================================================================
     SECTION 1C: MAP CARD URLS
     ========================================================================== */
  
  /**
   * Get pill image URL based on state
   * Uses folder_system_images + filename from admin_settings (same pattern as cluster icon)
   */
  function getPillUrl(state) {
    var baseUrl = adminSettings.folder_system_images;
    if (!baseUrl) {
      console.error('[Map] folder_system_images not configured in admin_settings');
      return '';
    }
    
    var filename;
    switch (state) {
      case 'big':
        filename = adminSettings.big_map_card_pill;
        break;
      case 'hover':
        filename = adminSettings.hover_map_card_pill || adminSettings.small_map_card_pill;
        break;
      default:
        filename = adminSettings.small_map_card_pill;
    }
    
    if (!filename) {
      console.error('[Map] Pill image not configured in Admin > Map tab for state:', state);
      return '';
    }
    
    return baseUrl + '/' + filename;
  }
  
  /**
   * Get multi-post icon URL from admin settings
   */
  function getMultiPostIconUrl() {
    var baseUrl = adminSettings.folder_system_images;
    var filename = adminSettings.multi_post_icon;
    
    if (baseUrl && filename) {
      return baseUrl + '/' + filename;
    }

    // Agent Essentials: NO FALLBACKS. Missing required config must be loud.
    throw new Error('[Map] multi_post_icon not configured in Admin > Map tab');
  }
  
  /**
   * Get icon URL for small state (subcategory icon or multi-post icon)
   * Multi-post markers use multi_post_icon, single posts use subcategory icon
   */
  function getSmallIconUrl(post) {
    // Multi-post markers use the multi-post icon
    if (post.isMultiPost) {
      return getMultiPostIconUrl();
    }
    
    // Single post: subcategory icon from post data is REQUIRED.
    if (post.iconUrl) return post.iconUrl;

    // Agent Essentials: NO FALLBACKS. Missing subcategory icon must be loud.
    throw new Error('[Map] Missing subcategory iconUrl for map card marker (single post).');
  }
  
  /**
   * Get icon URL for big state (thumbnail for single posts, multi-post icon for multi)
   */
  function getBigIconUrl(post) {
    // Multi-post markers keep the multi-post icon
    if (post.isMultiPost) {
      return getSmallIconUrl(post);
    }
    // Single posts show thumbnail
    if (post.thumbnailUrl) return post.thumbnailUrl;
    // Fall back to subcategory icon
    return getSmallIconUrl(post);
  }
  
  /**
   * Get icon URL based on state
   */
  function getIconUrl(post, state = 'small') {
    return state === 'big' ? getBigIconUrl(post) : getSmallIconUrl(post);
  }


  /* ==========================================================================
     SECTION 1D: MAP CARD CSS INJECTION
     ========================================================================== */
  
  /**
   * Inject map card CSS styles dynamically
   * Called on init and when admin settings change
   */
  function injectMapCardStyles() {
    if (document.getElementById('map-card-styles-dynamic')) return;
    
    const smallPillUrl = getPillUrl('small');
    const hoverPillUrl = getPillUrl('hover');
    const bigPillUrl = getPillUrl('big');
    
    const css = `
      /* Container = lat/lng point (0,0) - zero size anchor */
      .map-card-container {
        position: relative;
        width: 0;
        height: 0;
        cursor: pointer;
        z-index: 1;
      }
      /* IMPORTANT: On touch devices, :hover causes "two tap" behavior.
         Only include hover selectors on hover-capable devices. */
      @media (hover: hover) and (pointer: fine) {
        .map-card-container:hover { z-index: 5; }
      }
      .map-card-container.is-active { z-index: 6; }
      
      /* Blue border for hover/active states */
      .map-card-container.is-active .map-card-pill {
        outline: 2px solid var(--blue-500);
        outline-offset: -2px;
        border-radius: 30px;
      }
      @media (hover: hover) and (pointer: fine) {
        .map-card-container:hover .map-card-pill {
          outline: 2px solid var(--blue-500);
          outline-offset: -2px;
          border-radius: 30px;
        }
      }
      
      @media (hover: hover) and (pointer: fine) {
        .map-card-container:not(.is-active):hover .map-card-pill {
          border-radius: 20px;
        }
      }
      
      /* Icon - center at lat/lng (0,0) */
      .map-card-icon {
        position: absolute;
        left: -${SMALL_ICON_SIZE / 2}px;
        top: -${SMALL_ICON_SIZE / 2}px;
        border-radius: 50%;
        z-index: 2;
        transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease;
      }
      .map-card-container.is-active .map-card-icon {
        left: -${BIG_ICON_SIZE / 2}px;
        top: -${BIG_ICON_SIZE / 2}px;
      }
      
      /* Pill - all positions from lat/lng (0,0) */
      .map-card-pill {
        position: absolute;
        display: flex;
        align-items: center;
        background-repeat: no-repeat;
        transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease, background-image 0.2s ease;
      }
      
      /* Small pill: left at -20, labels at +20 */
      .map-card-small {
        left: -20px;
        top: -${SMALL_PILL_HEIGHT / 2}px;
        width: ${SMALL_PILL_WIDTH}px;
        height: ${SMALL_PILL_HEIGHT}px;
        padding-left: 40px;
        background-image: url('${smallPillUrl}');
        background-size: ${SMALL_PILL_WIDTH}px ${SMALL_PILL_HEIGHT}px;
      }
      
      /* Hover pill: same size, different background */
      .map-card-hover {
        left: -20px;
        top: -${SMALL_PILL_HEIGHT / 2}px;
        width: ${SMALL_PILL_WIDTH}px;
        height: ${SMALL_PILL_HEIGHT}px;
        padding-left: 40px;
        background-image: url('${hoverPillUrl}');
        background-size: ${SMALL_PILL_WIDTH}px ${SMALL_PILL_HEIGHT}px;
      }
      
      /* Big pill: left at -30, labels at +30 */
      .map-card-big {
        left: -30px;
        top: -${BIG_PILL_HEIGHT / 2}px;
        width: ${BIG_PILL_WIDTH}px;
        height: ${BIG_PILL_HEIGHT}px;
        padding-left: 60px;
        background-image: url('${bigPillUrl}');
        background-size: ${BIG_PILL_WIDTH}px ${BIG_PILL_HEIGHT}px;
      }
      
      /* Labels */
      .map-card-labels {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      /* Hover Only Mode - hide pill, keep icon */
      body[data-map-card-display="hover_only"] .map-card-pill {
        display: none;
      }
      body[data-map-card-display="hover_only"] .map-card-container.is-active .map-card-pill,
      body[data-map-card-display="hover_only"] .map-card-container.is-hovered .map-card-pill {
        display: flex;
      }
      @media (hover: hover) and (pointer: fine) {
        body[data-map-card-display="hover_only"] .map-card-container:hover .map-card-pill {
          display: flex;
        }
      }
      
      /* Text styling - inherits global font from base-new.css */
      .map-card-title {
        color: #fff;
        font-family: inherit;
        font-size: ${MARKER_LABEL_TEXT_SIZE}px;
        line-height: 1.3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      
      /* Venue Text (big cards only) */
      .map-card-venue {
        color: rgba(255,255,255,0.7);
        font-family: inherit;
        font-size: ${MARKER_LABEL_TEXT_SIZE - 1}px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      
      /* City Text (big cards only) */
      .map-card-city {
        color: rgba(255,255,255,0.5);
        font-family: inherit;
        font-size: ${MARKER_LABEL_TEXT_SIZE - 1}px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
    `;
    
    const style = document.createElement('style');
    style.id = 'map-card-styles-dynamic';
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  /**
   * Refresh CSS with updated pill URLs (after admin settings change)
   */
  function refreshMapCardStyles() {
    const existing = document.getElementById('map-card-styles-dynamic');
    if (existing) existing.remove();
    injectMapCardStyles();
    
    // Update inline styles on existing markers
    const smallPillUrl = getPillUrl('small');
    const hoverPillUrl = getPillUrl('hover');
    const bigPillUrl = getPillUrl('big');
    
    mapCardMarkers.forEach((entry) => {
      const pillEl = entry.element.querySelector('.map-card-pill');
      if (pillEl) {
        switch (entry.state) {
          case 'big':
            pillEl.style.backgroundImage = `url('${bigPillUrl}')`;
            break;
          case 'hover':
            pillEl.style.backgroundImage = `url('${hoverPillUrl}')`;
            break;
          default:
            pillEl.style.backgroundImage = `url('${smallPillUrl}')`;
        }
      }
    });
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

    // DB-first viewport restore:
    // - If logged in, restore from the user's DB snapshot (filters_json.map) so localStorage cannot override them.
    // - If logged out, restore from localStorage mapView (device-only).
    // Admin starting location is only used when there is no eligible saved view.
    const filtersJsonStr = getLoggedInUserFiltersJson();
    if (filtersJsonStr) {
      applySavedMapViewToStart(loadMapViewFromFiltersJson(filtersJsonStr));
    } else {
      applySavedMapViewToStart(loadSavedMapView());
    }

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
    currentStyleUrl = styleUrl;
    
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
      
      // Initialize systems that depend on admin settings/breakpoint
      App.whenStartupSettingsReady().then(function() {
        // Inject map card CSS AFTER settings are ready (needs pill image URLs)
        injectMapCardStyles();
        
        // Initialize clusters
        initClusters();
        
        // Initialize high-density layers (dots/icons)
        initHighDensityLayers();
      });
      
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
          if (!hasSavedMapView && currentCenter && Math.abs(currentCenter.lng) < 0.01 && Math.abs(currentCenter.lat) < 0.01) {
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
          
          // Apply style using setMapStyle (handles cluster reload properly)
          // Then apply lighting after style is ready
          var styleUrl = style === 'standard-satellite' 
            ? 'mapbox://styles/mapbox/standard-satellite'
            : 'mapbox://styles/mapbox/standard';
          
          if (currentStyleUrl !== styleUrl) {
            logDebug('[Map] loadSettings: Applying style:', style, 'then lighting:', lighting);
            setMapStyle(style);
            // Lighting will be applied after style loads (setMapStyle handles this)
          } else {
            // Style already correct - just apply lighting
            logDebug('[Map] loadSettings: Style already correct, applying lighting:', lighting);
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
    if (!hasSavedMapView) {
      if (settings.starting_lat && settings.starting_lng) {
        const lat = parseFloat(settings.starting_lat);
        const lng = parseFloat(settings.starting_lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          startCenter = [lng, lat];
          logDebug('[Map] applySettings: startCenter =', startCenter);
        }
      }
      
      var isMobile = window.innerWidth <= 530;
      
      var zoomKey = isMobile ? 'starting_zoom_mobile' : 'starting_zoom_desktop';
      if (settings[zoomKey] !== undefined) {
        const zoom = parseFloat(settings[zoomKey]);
        if (Number.isFinite(zoom)) {
          startZoom = zoom;
          logDebug('[Map] applySettings: startZoom =', startZoom, '(' + (isMobile ? 'mobile' : 'desktop') + ')');
        }
      }
      
      var pitchKey = isMobile ? 'starting_pitch_mobile' : 'starting_pitch_desktop';
      if (settings[pitchKey] !== undefined) {
        const pitch = parseFloat(settings[pitchKey]);
        if (Number.isFinite(pitch)) {
          startPitch = pitch;
          logDebug('[Map] applySettings: startPitch =', startPitch, '(' + (isMobile ? 'mobile' : 'desktop') + ')');
        }
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

    // Initialize lastMapZoom to current zoom
    lastMapZoom = map.getZoom();

    // Zoom event - fires continuously during animation
    // Triggers immediate marker rendering when crossing threshold 8
    map.on('zoom', () => {
      const zoom = map.getZoom();
      const threshold = getMarkerZoomThreshold();
      const crossedUp = lastMapZoom < threshold && zoom >= threshold;
      
      if (crossedUp) {
        // Immediately emit boundsChanged when crossing threshold upward
        App.emit('map:boundsChanged', {
          bounds: map.getBounds(),
          zoom: zoom,
          center: map.getCenter()
        });
        
        // Update visibility immediately
        updateClusterVisibility(zoom);
        updateMarkersVisibility(zoom);
      }
      
      lastMapZoom = zoom;
    });

    // Bounds change events (moveend/zoomend - fires when animation completes)
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
        
        // Keep lastMapZoom in sync
        lastMapZoom = zoom;

        // Persist viewport so refresh/return stays in the same area/zoom.
        scheduleSaveMapView();
      });
    });

    // Persist camera-only changes too (e.g. rotate/pitch without moving).
    ['rotateend', 'pitchend'].forEach(event => {
      map.on(event, () => {
        scheduleSaveMapView();
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
     SECTION 5: CLUSTERS - Marker Clustering
     ========================================================================== */
  
  // Cluster constants
  const CLUSTER_SOURCE_ID = 'post-cluster-source';
  const CLUSTER_LAYER_ID = 'post-clusters';
  const CLUSTER_ICON_ID = 'cluster-icon';
  const CLUSTER_MIN_ZOOM = 0;
  
  // Cluster state
  let clusterIconLoaded = false;
  let lastClusterBucketKey = null;
  let lastClusterRequestKey = null;
  let clusterRequestToken = 0;
  let clusterInFlightKey = null;
  let clusterAbort = null;

  /**
   * Get cluster grid size based on zoom level
   * Smaller grids at higher zoom = more granular clustering
   */
  function getClusterGridSize(zoom) {
    const z = Number.isFinite(zoom) ? zoom : 0;
    if (z >= 7.5) return 0.5;
    if (z >= 6) return 1;
    if (z >= 4) return 2.5;
    if (z >= 2) return 5;
    return 10;
  }

  /**
   * Get bucket key for caching (prevents refetch when grid size unchanged)
   */
  function getClusterBucketKey(zoom) {
    return getClusterGridSize(zoom).toFixed(2);
  }

  /**
   * Load cluster icon from admin settings
   */
  function loadClusterIcon() {
    return new Promise(function(resolve) {
      if (!map || clusterIconLoaded) {
        resolve();
        return;
      }
      
      var iconFilename = adminSettings.marker_cluster_icon;
      if (!iconFilename) {
        console.error('[Map] marker_cluster_icon not configured in Admin > Map tab');
        resolve();
        return;
      }
      
      var iconUrl = adminSettings.folder_system_images + '/' + iconFilename;
      
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        var pixelRatio = img.width >= 256 ? 2 : 1;
        map.addImage(CLUSTER_ICON_ID, img, { pixelRatio: pixelRatio });
        clusterIconLoaded = true;
        resolve();
      };
      img.onerror = function() {
        console.error('[Map] Failed to load cluster icon:', iconUrl);
        resolve();
      };
      img.src = iconUrl;
    });
  }

  /**
   * Initialize high-density layers (dots and icons)
   */
  function initHighDensityLayers() {
    if (!map) return;
    
    // Create source
    if (!map.getSource(DOT_SOURCE_ID)) {
      map.addSource(DOT_SOURCE_ID, {
        type: 'geojson',
        data: highDensityData,
        generateId: true
      });
    }

    // 1. Glow Layer (behind dots/icons)
    if (!map.getLayer(GLOW_LAYER_ID)) {
      map.addLayer({
        id: GLOW_LAYER_ID,
        type: 'circle',
        source: DOT_SOURCE_ID,
        minzoom: getMarkerZoomThreshold(),
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            ['case', ['==', ['get', 'type'], 'icon'], 25, 12],
            0
          ],
          'circle-color': '#ffffff',
          'circle-opacity': 0.3,
          'circle-blur': 0.8
        }
      });
    }

    // 2. Standard Dots Layer
    if (!map.getLayer(DOT_LAYER_ID)) {
      map.addLayer({
        id: DOT_LAYER_ID,
        type: 'circle',
        source: DOT_SOURCE_ID,
        minzoom: getMarkerZoomThreshold(),
        filter: ['==', ['get', 'type'], 'dot'],
        paint: {
          'circle-radius': getDotSize() / 2,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': 'rgba(0,0,0,0.7)',
          'circle-stroke-width': getDotStrokeWidth()
        }
      });
    }

      // 3. Featured Icons Layer (symbol)
      if (!map.getLayer(ICON_LAYER_ID)) {
        // Background for Icons (the 0.7 black ring)
        // Agent Rules: Black ring at 0.7 opacity, fill at 0.4 for visibility
        map.addLayer({
          id: ICON_LAYER_ID + '-bg',
          type: 'circle',
          source: DOT_SOURCE_ID,
          minzoom: getMarkerZoomThreshold(),
          filter: ['==', ['get', 'type'], 'icon'],
          paint: {
            'circle-radius': getIconDotSize() / 2,
            'circle-color': ['get', 'color'], // Use subcategory color for background too
            'circle-opacity': 0.4,
            'circle-stroke-color': 'rgba(0,0,0,0.7)',
            'circle-stroke-width': getDotStrokeWidth()
          }
        });

      map.addLayer({
        id: ICON_LAYER_ID,
        type: 'symbol',
        source: DOT_SOURCE_ID,
        minzoom: getMarkerZoomThreshold(),
        filter: ['==', ['get', 'type'], 'icon'],
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-size': 0.8, // Adjust to fit 30px well
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }

    // Interaction handlers
    [DOT_LAYER_ID, ICON_LAYER_ID].forEach(layerId => {
      map.on('mouseenter', layerId, function(e) {
        // Performance/Interaction Rule: Never trigger if below threshold
        if (map.getZoom() < getMarkerZoomThreshold()) return;
        
        if (!e.features.length) return;
        map.getCanvas().style.cursor = 'pointer';
        
        const feature = e.features[0];
        const postId = feature.properties.postId;
        
        if (hoveredPostId !== null) {
          map.setFeatureState({ source: DOT_SOURCE_ID, id: hoveredPostId }, { hover: false });
        }
        
        hoveredPostId = feature.id;
        map.setFeatureState({ source: DOT_SOURCE_ID, id: feature.id }, { hover: true });
        
        App.emit('map:markerHover', { postId: postId });
      });

      map.on('mouseleave', layerId, function() {
        map.getCanvas().style.cursor = '';
        if (hoveredPostId !== null) {
          map.setFeatureState({ source: DOT_SOURCE_ID, id: hoveredPostId }, { hover: false });
          hoveredPostId = null;
        }
        App.emit('map:markerLeave');
      });

      map.on('click', layerId, function(e) {
        if (!e.features.length) return;
        const postId = e.features[0].properties.postId;
        App.emit('post:open', { id: postId, source: 'map_dot' });
      });
    });
  }

  /**
   * Update the high-density data source
   * @param {Object} geojson - FeatureCollection of dots and icons
   */
  function updateHighDensityData(geojson) {
    highDensityData = geojson || { type: 'FeatureCollection', features: [] };
    
    if (!map) return;
    const source = map.getSource(DOT_SOURCE_ID);
    if (source) {
      source.setData(highDensityData);
    }

    // Pre-load icons for symbol layer
    if (highDensityData.features) {
      highDensityData.features.forEach(f => {
        if (f.properties.type === 'icon' && f.properties.iconId && f.properties.iconUrl) {
          ensureIconLoaded(f.properties.iconId, f.properties.iconUrl);
        }
      });
    }
  }

  /**
   * Ensure an icon is loaded in Mapbox for symbol layers
   */
  function ensureIconLoaded(iconId, iconUrl) {
    if (loadedIcons.has(iconId) || (map && map.hasImage(iconId))) return Promise.resolve(iconId);
    
    return new Promise(function(resolve) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        if (map && !map.hasImage(iconId)) {
          map.addImage(iconId, img);
        }
        loadedIcons.add(iconId);
        
        // Force a redraw of the high-density layer now that the image is ready
        const source = map.getSource(DOT_SOURCE_ID);
        if (source && typeof source.setData === 'function') {
          source.setData(highDensityData);
        }
        
        resolve(iconId);
      };
      img.onerror = function() {
        console.warn('[Map] Failed to load icon for high-density layer:', iconUrl);
        resolve(null);
      };
      img.src = iconUrl;
    });
  }

  /**
   * Initialize cluster system
   */
  function initClusters() {
    if (!map) return;
    
    // adminSettings should be available via App.getState('settings')
    // because this is called inside whenStartupSettingsReady.
    adminSettings = App.getState('settings') || {};

    loadClusterIcon().then(function() {
      setupClusterLayers();
    });

    // Filters can change while the user stays at low zoom; clusters must refresh even if grid bucket is unchanged.
    App.on('filter:changed', function() {
      refreshClusters();
    });
  }

  /**
   * Set up cluster source and layer
   * Requires marker_cluster_icon to be configured in admin settings
   */
  function setupClusterLayers() {
    if (!map) return;
    
    // Cluster icon is required - if not loaded, clusters won't appear
    if (!clusterIconLoaded || !map.hasImage(CLUSTER_ICON_ID)) {
      console.error('[Map] Cluster icon not loaded. Configure marker_cluster_icon in Admin > Map tab.');
      return;
    }
    
    // Remove existing layer if present
    if (map.getLayer(CLUSTER_LAYER_ID)) {
      map.removeLayer(CLUSTER_LAYER_ID);
    }
    
    // Remove existing source if present
    if (map.getSource(CLUSTER_SOURCE_ID)) {
      map.removeSource(CLUSTER_SOURCE_ID);
    }
    
    // Create empty source
    var emptyData = { type: 'FeatureCollection', features: [] };
    map.addSource(CLUSTER_SOURCE_ID, { type: 'geojson', data: emptyData });
    
    // Create cluster layer with icon
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'symbol',
      source: CLUSTER_SOURCE_ID,
      minzoom: CLUSTER_MIN_ZOOM,
      maxzoom: getClusterZoomMax(),
      layout: {
        'icon-image': CLUSTER_ICON_ID,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 7.5, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'bottom',
        'text-field': ['to-string', ['coalesce', ['get', 'label'], ['get', 'count']]],
        'text-size': 12,
        'text-offset': [0, -1.35],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'symbol-z-order': 'viewport-y',
        'symbol-sort-key': 900
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.45)',
        'text-halo-width': 1.2,
        'icon-opacity': 0.95
      }
    });
    
    // Bind click handler
    map.on('click', CLUSTER_LAYER_ID, handleClusterClick);
    map.on('mouseenter', CLUSTER_LAYER_ID, function() {
      // Performance/Interaction Rule: Never trigger if past threshold (clusters hidden)
      if (map.getZoom() >= getClusterZoomMax()) return;
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', CLUSTER_LAYER_ID, function() {
      map.getCanvas().style.cursor = 'grab';
    });
    
    // Initial update
    var currentZoom = map.getZoom();
    updateClusterData(currentZoom);
    updateClusterVisibility(currentZoom);
  }

  /**
   * Update cluster source data for current zoom level
   * Fetches aggregated data from server (lightweight, no individual posts)
   */
  function updateClusterData(zoom) {
    if (!map) return;
    
    var source = map.getSource(CLUSTER_SOURCE_ID);
    if (!source || typeof source.setData !== 'function') return;
    
    var zoomValue = Number.isFinite(zoom) ? zoom : (map.getZoom() || 0);
    var bucketKey = getClusterBucketKey(zoomValue);
    var filterKey = getClusterFilterKey();
    var requestKey = bucketKey + '|' + filterKey;
    
    // Skip only if BOTH bucket AND filter key match
    if (lastClusterRequestKey === requestKey) return;

    // If the same request is already in-flight, don't start another.
    if (clusterInFlightKey === requestKey) return;
    
    clusterRequestToken++;
    var myToken = clusterRequestToken;
    clusterInFlightKey = requestKey;

    // Cancel any in-flight request (map moves / filter changes can happen quickly).
    try { if (clusterAbort) clusterAbort.abort(); } catch (_eAbort) {}
    clusterAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    // Keep existing clusters visible until new correct data arrives (no flashing).
    fetchClusterData(zoomValue, clusterAbort ? clusterAbort.signal : null)
      .then(function(result) {
        if (myToken !== clusterRequestToken) return;
        if (clusterInFlightKey !== requestKey) return;

        var data = buildClusterFeatureCollectionFromServer(result.clusters);
        source.setData(data);
        lastClusterBucketKey = bucketKey;
        lastClusterRequestKey = requestKey;

        // Emit cluster count for header badge (fast initial load)
        if (typeof result.totalCount === 'number') {
          App.emit('clusters:countUpdated', { total: result.totalCount });
        }
      })
      .catch(function(err) {
        // Abort is expected during rapid interactions; ignore.
        try {
          if (err && (err.name === 'AbortError' || String(err.message || '').toLowerCase().indexOf('abort') !== -1)) {
            return;
          }
        } catch (_eName) {}
        console.error('[Map] Cluster fetch failed:', err);
      })
      .finally(function() {
        if (myToken === clusterRequestToken && clusterInFlightKey === requestKey) {
          clusterInFlightKey = null;
        }
      });
  }

  function getClusterFilterKey() {
    try {
      // localStorage value is the current filter snapshot. Use raw string as a stable key.
      return String(localStorage.getItem('funmap_filters') || '');
    } catch (_e) {
      return '';
    }
  }

  /**
   * Fetch cluster data from server
   * Returns { clusters: Array, totalCount: number }
   */
  function fetchClusterData(zoom, signal) {
    // Include current filters so clusters are never wrong.
    // Filters are loaded from localStorage so they apply before the filter panel is opened.
    var qs = new URLSearchParams();
    qs.set('action', 'get-clusters');
    qs.set('zoom', String(zoom));
    try {
      var raw = localStorage.getItem('funmap_filters');
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (saved.keyword) qs.set('keyword', String(saved.keyword));
          if (saved.minPrice) qs.set('min_price', String(saved.minPrice));
          if (saved.maxPrice) qs.set('max_price', String(saved.maxPrice));
          if (saved.dateStart) qs.set('date_start', String(saved.dateStart));
          if (saved.dateEnd) qs.set('date_end', String(saved.dateEnd));
          if (saved.expired) qs.set('expired', '1');
          // Subcategory selection: send list of enabled subcategory keys if present
          if (Array.isArray(saved.subcategoryKeys) && saved.subcategoryKeys.length) {
            qs.set('subcategory_keys', saved.subcategoryKeys.map(String).join(','));
          }
        }
      }
    } catch (_e) {}

    return fetch('/gateway.php?' + qs.toString(), signal ? { signal: signal } : undefined)
      .then(function(response) { return response.json(); })
      .then(function(data) {
        return {
          clusters: (data.success && Array.isArray(data.clusters)) ? data.clusters : [],
          totalCount: (data.success && typeof data.total_count === 'number') ? data.total_count : 0
        };
      });
  }

  /**
   * Build GeoJSON FeatureCollection from server cluster data
   */
  function buildClusterFeatureCollectionFromServer(clusters) {
    if (!Array.isArray(clusters) || clusters.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    var features = clusters.map(function(c) {
      return {
        type: 'Feature',
        properties: {
          count: c.count,
          label: c.label
        },
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] }
      };
    });
    
    return { type: 'FeatureCollection', features: features };
  }

  /**
   * Handle cluster click
   * - From below zoom 7.5: fly to cluster center, stop at 7.5 (shows finest cluster breakdown)
   * - From zoom 7.5+: fly straight to zoom 12 (map card territory)
   * This prevents landing in empty space when clicking large clusters from far out.
   */
  function handleClusterClick(e) {
    // Performance/Interaction Rule: Never trigger if past threshold (clusters hidden)
    if (map.getZoom() >= getClusterZoomMax()) return;
    
    if (!e || !e.features || !e.features[0]) return;
    
    var coords = e.features[0].geometry.coordinates;
    var currentZoom = map.getZoom();
    
    // Below 7.5: stop at 7.5 to show finest cluster breakdown
    // At 7.5+: go straight to zoom 12 (map cards)
    var FINEST_CLUSTER_ZOOM = 7.5;
    var MAP_CARD_ZOOM = 12;
    var targetZoom = currentZoom < FINEST_CLUSTER_ZOOM ? FINEST_CLUSTER_ZOOM : MAP_CARD_ZOOM;
    
    map.flyTo({
      center: coords,
      zoom: targetZoom,
      pitch: map.getPitch(),
      speed: 1.35,
      curve: 1.5,
      easing: function(t) { return 1 - Math.pow(1 - t, 3); }
    });
  }

  /**
   * Update cluster layer visibility based on zoom
   */
  function updateClusterVisibility(zoom) {
    if (!map) return;
    
    var shouldShow = zoom < getClusterZoomMax();
    if (shouldShow !== clusterLayerVisible) {
      clusterLayerVisible = shouldShow;
      
      if (map.getLayer(CLUSTER_LAYER_ID)) {
        map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', shouldShow ? 'visible' : 'none');
      }
    }
    
    // Update cluster data when visible
    if (shouldShow) {
      updateClusterData(zoom);
    }
  }

  /**
   * Refresh clusters with new post data
   * Called by PostModule when posts are loaded/updated
   */
  function refreshClusters() {
    if (!map) return;
    
    // Performance Rule: Never fetch clusters if we are in the Map Card zone.
    var zoom = map.getZoom() || 0;
    if (zoom >= getClusterZoomMax()) return;

    lastClusterBucketKey = null; // Force refresh
    lastClusterRequestKey = null; // Force refresh (filters may have changed)
    updateClusterData(zoom);
  }

  /**
   * Create cluster layers (public API for PostModule)
   */
  function createClusterLayers() {
    setupClusterLayers();
  }


  /* --------------------------------------------------------------------------
     MAP CARDS (Markers)
     -------------------------------------------------------------------------- */
  
  /**
   * Update markers visibility based on zoom
   */
  function updateMarkersVisibility(zoom) {
    const shouldShow = zoom >= getMarkerZoomThreshold();
    
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

    // Note: We don't call removeMapCardMarker here because renderMapMarkers
    // already clears all markers at the start. Calling it here would break
    // multi-post venues where different venues share the same post ID.

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

    // Store reference by venue coordinates (prevents duplicate entries for multi-post venues)
    const venueKey = lng.toFixed(6) + ',' + lat.toFixed(6);
    el.dataset.venueKey = venueKey;
    const entry = {
      marker: marker,
      element: el,
      post: post,
      state: 'small',
      lng: lng,
      lat: lat,
      venueKey: venueKey,
      // IMPORTANT: store IDs as STRINGS (matches live-site behavior and avoids number/string mismatches)
      postIds: post.isMultiPost && Array.isArray(post.venuePostIds)
        ? post.venuePostIds.map(function(pid) { return String(pid); })
        : [String(post.id)]
    };
    
    // Store by venue key to avoid duplicates
    mapCardMarkers.set(venueKey, entry);

    // Bind hover/click manager once (centralized, live-site style).
    bindMapCardPointerManager();

    return entry;
  }

  /**
   * Build map card HTML
   */
  function buildMapCardHTML(post, state) {
    const isActive = state === 'big';
    const iconSize = isActive ? BIG_ICON_SIZE : SMALL_ICON_SIZE;
    const pillClass = `map-card-${state}`;
    
    // Get icon URL based on state (thumbnail for big, subcategory icon for small/hover)
    const iconUrl = getIconUrl(post, state);
    
    // Build label HTML based on whether this is a multi-post venue
    let labelHTML = '';
    
    if (post.isMultiPost && post.venuePostCount > 1) {
      // Multi-post venue: show "X posts here" and venue name
      const countLabel = post.venuePostCount + ' posts here';
      const venueName = post.venue || '';
      const truncatedVenue = venueName ? shortenText(venueName, isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL) : '';
      
      labelHTML = `
        <div class="map-card-title">${escapeHtml(countLabel)}</div>
        ${truncatedVenue ? `<div class="map-card-venue">${escapeHtml(truncatedVenue)}</div>` : ''}
      `;
    } else {
      // Single post: show title, venue, and city
      const labels = getMarkerLabelLines(post, isActive);
      
      if (isActive) {
        // Big card: Title (1 line if venue, 2 lines if no venue) + Venue + City
        if (labels.venueLine) {
          // With venue: Title (1 line) + Venue + City
          labelHTML = `
            <div class="map-card-title">${escapeHtml(labels.line1)}</div>
            <div class="map-card-venue">${escapeHtml(labels.venueLine)}</div>
            ${labels.cityLine ? `<div class="map-card-city">${escapeHtml(labels.cityLine)}</div>` : ''}
          `;
        } else {
          // Without venue: Title (2 lines) + City
          labelHTML = `
            <div class="map-card-title">${escapeHtml(labels.line1)}</div>
            ${labels.line2 ? `<div class="map-card-title">${escapeHtml(labels.line2)}</div>` : ''}
            ${labels.cityLine ? `<div class="map-card-city">${escapeHtml(labels.cityLine)}</div>` : ''}
          `;
        }
      } else {
        // Small/hover card: show title only (2 lines)
        labelHTML = `
          <div class="map-card-title">${escapeHtml(labels.line1)}</div>
          ${labels.line2 ? `<div class="map-card-title">${escapeHtml(labels.line2)}</div>` : ''}
        `;
      }
    }
    
    // Icon is at center (0,0 = lat/lng), pill extends to the right
    return `
      <img class="map-card-icon" src="${iconUrl}" width="${iconSize}" height="${iconSize}" alt="">
      <div class="map-card-pill ${pillClass}" data-id="${post.id}" data-state="${state}">
        <div class="map-card-labels">
          ${labelHTML}
        </div>
      </div>
    `;
  }

  /**
   * Find marker entry by post ID (searches through venue-keyed entries)
   */
  function findMarkerByPostId(postId) {
    const target = String(postId);
    for (const [key, entry] of mapCardMarkers) {
      if (entry.postIds && entry.postIds.includes(target)) {
        return entry;
      }
    }
    return null;
  }
  
  function findMarkersByPostId(postId) {
    const target = String(postId);
    const out = [];
    for (const [key, entry] of mapCardMarkers) {
      if (entry.postIds && entry.postIds.includes(target)) {
        out.push(entry);
      }
    }
    return out;
  }
  
  function findMarkerByVenueKey(venueKey) {
    return mapCardMarkers.get(venueKey) || null;
  }
  
  function setMarkerHoverState(entry, isHovering) {
    if (!entry || !entry.element) return;
    // Never override the active/big state on hover (matches live-site expectation)
    if (entry.state === 'big') return;
    
    if (isHovering) {
      entry.element.classList.add('is-hovered');
      updateMapCardStateByKey(entry.venueKey, 'hover');
    } else {
      entry.element.classList.remove('is-hovered');
      updateMapCardStateByKey(entry.venueKey, 'small');
    }
  }
  
  function setHoverGroupForPostIds(postIds, isHovering) {
    const ids = Array.isArray(postIds) ? postIds.map(String) : [];
    // Apply hover to all markers for each postId (multi-location posts)
    ids.forEach((pid) => {
      findMarkersByPostId(pid).forEach((entry) => {
        setMarkerHoverState(entry, isHovering);
      });
    });
  }
  
  function setCurrentHoverPostIds(postIds) {
    currentHoverPostIds = Array.isArray(postIds) ? postIds.map(String) : [];
  }

  /**
   * Handle map card hover
   */
  function onMapCardHoverByVenueKey(venueKey, isHovering) {
    const entry = findMarkerByVenueKey(venueKey);
    if (!entry) return;
    
    // Determine the hover group:
    // - Multi-post venues: all post IDs at this venue
    // - Single/multi-location post: hover applies to all markers for that postId
    const postIds = Array.isArray(entry.postIds) ? entry.postIds.slice() : [];
    
    // Tokenize to avoid hover flicker when moving between markers quickly
    const token = ++hoverToken;
    
    if (isHovering) {
      // Clear previous hover group (immediate)
      if (currentHoverPostIds && currentHoverPostIds.length) {
        setHoverGroupForPostIds(currentHoverPostIds, false);
      }
      setCurrentHoverPostIds(postIds);
      setHoverGroupForPostIds(postIds, true);
      
      // Emit to PostModule to highlight corresponding post cards
      App.emit('map:cardHover', { postId: entry.post && entry.post.id ? String(entry.post.id) : '', postIds, isHovering: true });
      return;
    }
    
    // Hover end: clear immediately (no linger).
    if (token !== hoverToken) return;
    if (currentHoverPostIds && currentHoverPostIds.length) {
      setHoverGroupForPostIds(currentHoverPostIds, false);
    }
    setCurrentHoverPostIds([]);
    App.emit('map:cardHover', { postId: entry.post && entry.post.id ? String(entry.post.id) : '', postIds, isHovering: false });
  }
  
  // Hover coming from PostModule (post card hover): apply hover to all markers for that postId.
  // This should NOT emit map:cardHover back to PostModule (prevents event loops / double work).
  function onMapCardHoverByPostId(postId, isHovering) {
    const pid = String(postId);
    const token = ++hoverToken;
    
    // High-Density Glow: Apply highlight to dots/icons layers
    if (map && map.getSource(DOT_SOURCE_ID)) {
      const featureId = Number(pid);
      if (!isNaN(featureId)) {
        map.setFeatureState(
          { source: DOT_SOURCE_ID, id: featureId },
          { hover: isHovering }
        );
      }
    }

    if (isHovering) {
      if (currentHoverPostIds && currentHoverPostIds.length) {
        setHoverGroupForPostIds(currentHoverPostIds, false);
      }
      setCurrentHoverPostIds([pid]);
      setHoverGroupForPostIds([pid], true);
      return;
    }
    
    if (token !== hoverToken) return;
    if (currentHoverPostIds && currentHoverPostIds.length) {
      setHoverGroupForPostIds(currentHoverPostIds, false);
    }
    setCurrentHoverPostIds([]);
  }

  /**
   * Clear ALL active (big) map cards.
   * Requirement: no map card should remain active if there is no open post context.
   */
  function clearActiveMapCards() {
    try {
      // Clear active marker visuals
      mapCardMarkers.forEach((entry, venueKey) => {
        if (!entry || !entry.element) return;
        if (entry.state === 'big') {
          updateMapCardStateByKey(venueKey, 'small');
        }
        entry.element.classList.remove('is-active');
      });
      // Clear hover group too (avoid sticky hover feeling)
      if (currentHoverPostIds && currentHoverPostIds.length) {
        setHoverGroupForPostIds(currentHoverPostIds, false);
      }
      setCurrentHoverPostIds([]);
      hoveredVenueKey = '';
      clearHoverClearTimer();
      // Clear remembered active associations
      lastActiveVenueKeyByPostId.clear();
    } catch (_e) {}
  }

  /**
   * Handle map card click
   */
  function onMapCardClick(venueKey) {
    const entry = findMarkerByVenueKey(venueKey);
    if (!entry) return;
    
    // Touch devices: first tap activates (brings to surface), second tap opens the post.
    // Desktop: single click opens (existing behavior), active click toggles close.
    let isTouch = false;
    try {
      isTouch = (lastMapCardPointerType === 'touch') ||
        (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    } catch (_eTouch) { isTouch = false; }

    if (isTouch) {
      // First tap: activate only.
      if (entry.state !== 'big') {
        setActiveMapCard(entry.post && entry.post.id ? String(entry.post.id) : '', { venueKey: entry.venueKey });
        stopSpin();
        return;
      }
      // Second tap (already active): open.
      stopSpin();
      App.emit('map:cardClicked', { postId: entry.post && entry.post.id ? entry.post.id : null });
      return;
    }

    // Desktop behavior: If map card is already active, close the post (toggle behavior)
    if (entry.state === 'big') {
      if (window.PostModule && typeof PostModule.closePost === 'function') {
        PostModule.closePost(entry.post && entry.post.id ? entry.post.id : '');
      }
      return;
    }

    // Set this specific marker to active (do not guess by postId)
    setActiveMapCard(entry.post && entry.post.id ? String(entry.post.id) : '', { venueKey: entry.venueKey });

    // Stop spin
    stopSpin();

    // Emit event for post module to open the post
    App.emit('map:cardClicked', { postId: entry.post && entry.post.id ? entry.post.id : null });
  }

  function clearHoverClearTimer() {
    if (hoverClearTimerId) {
      clearTimeout(hoverClearTimerId);
      hoverClearTimerId = 0;
    }
  }

  function getVenueKeyFromTarget(target) {
    if (!target || typeof target.closest !== 'function') return '';
    const container = target.closest('.map-card-container');
    if (!container || !container.dataset) return '';
    return container.dataset.venueKey ? String(container.dataset.venueKey) : '';
  }

  function getVenueKeyFromPoint(clientX, clientY) {
    try {
      const el = document.elementFromPoint(clientX, clientY);
      return getVenueKeyFromTarget(el);
    } catch (_e) {
      return '';
    }
  }

  function setHoveredVenueKey(nextVenueKey) {
    const nextKey = nextVenueKey ? String(nextVenueKey) : '';
    if (nextKey === hoveredVenueKey) return;

    // End previous hover (if any)
    if (hoveredVenueKey) {
      onMapCardHoverByVenueKey(hoveredVenueKey, false);
    }
    hoveredVenueKey = nextKey;
    if (hoveredVenueKey) {
      onMapCardHoverByVenueKey(hoveredVenueKey, true);
    }
  }

  function scheduleHoverClear(clientX, clientY) {
    clearHoverClearTimer();
    hoverClearTimerId = setTimeout(() => {
      // Recheck under pointer before clearing (matches live-site behavior)
      const stillKey = getVenueKeyFromPoint(clientX, clientY);
      if (stillKey) {
        setHoveredVenueKey(stillKey);
        return;
      }
      setHoveredVenueKey('');
    }, HOVER_CLEAR_DELAY_MS);
  }

  function bindMapCardPointerManager() {
    if (hoverManagerBound) return;
    if (!map || typeof map.getContainer !== 'function') return;
    const container = map.getContainer();
    if (!container) return;

    hoverManagerBound = true;

    container.addEventListener('pointermove', (e) => {
      if (!e) return;
      if (pointerDownActive) {
        // Keep hover stable while pressed (prevents hover->inactive while mouse is down)
        return;
      }
      clearHoverClearTimer();
      const key = getVenueKeyFromPoint(e.clientX, e.clientY);
      if (key) {
        setHoveredVenueKey(key);
      } else {
        // Clear immediately when not over a marker (no linger).
        setHoveredVenueKey('');
      }
    }, { passive: true });

    container.addEventListener('pointerleave', (e) => {
      if (pointerDownActive) return;
      // Leaving the map container should clear hover immediately.
      clearHoverClearTimer();
      setHoveredVenueKey('');
    }, { passive: true });

    // Resolve click based on pointerup (works during fly/drag; no waiting for map to stop).
    document.addEventListener('pointerdown', (e) => {
      const key = getVenueKeyFromTarget(e && e.target);
      if (!key) return;
      try { lastMapCardPointerType = e && e.pointerType ? String(e.pointerType) : ''; } catch (_ePT) { lastMapCardPointerType = ''; }
      pointerDownActive = true;
      pointerDownVenueKey = key;
      pointerDownClientX = e.clientX || 0;
      pointerDownClientY = e.clientY || 0;
      clearHoverClearTimer();
      setHoveredVenueKey(key);
    }, true);

    document.addEventListener('pointerup', (e) => {
      if (!pointerDownActive) return;
      const upX = e && typeof e.clientX === 'number' ? e.clientX : 0;
      const upY = e && typeof e.clientY === 'number' ? e.clientY : 0;
      const keyUp = getVenueKeyFromPoint(upX, upY);
      const dx = upX - pointerDownClientX;
      const dy = upY - pointerDownClientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const clickedKey = pointerDownVenueKey;
      pointerDownActive = false;
      pointerDownVenueKey = '';

      if (clickedKey && keyUp === clickedKey && dist <= CLICK_MOVE_THRESHOLD_PX) {
        onMapCardClick(clickedKey);
      }
    }, true);

    document.addEventListener('pointercancel', () => {
      pointerDownActive = false;
      pointerDownVenueKey = '';
    }, true);
  }

  /**
   * Set a map card to active (big) state
   */
  function setActiveMapCard(postId, options) {
    const pid = String(postId);
    const venueKey = options && options.venueKey ? String(options.venueKey) : '';
    
    // Prefer an explicit venueKey (clicked marker), then the last active marker for this postId, else first match.
    let targetEntry = null;
    if (venueKey) {
      targetEntry = findMarkerByVenueKey(venueKey);
    }
    if (!targetEntry && lastActiveVenueKeyByPostId.has(pid)) {
      targetEntry = findMarkerByVenueKey(lastActiveVenueKeyByPostId.get(pid));
    }
    if (!targetEntry) {
      targetEntry = findMarkerByPostId(pid);
    }
    const targetKey = targetEntry ? targetEntry.venueKey : null;
    
    // Deactivate all other cards
    mapCardMarkers.forEach((entry, venueKey) => {
      if (venueKey !== targetKey && entry.state === 'big') {
        updateMapCardStateByKey(venueKey, 'small');
        entry.element.classList.remove('is-active');
      }
    });

    // Activate this card
    if (targetEntry) {
      // Remember which marker is active for this post (multi-location posts)
      lastActiveVenueKeyByPostId.set(pid, targetKey);
      updateMapCardStateByKey(targetKey, 'big');
      targetEntry.element.classList.add('is-active');
    }
  }

  /**
   * Update map card visual state by venue key
   */
  function updateMapCardStateByKey(venueKey, newState) {
    const entry = mapCardMarkers.get(venueKey);
    if (!entry || entry.state === newState) return;

    entry.state = newState;
    
    // Update pill element classes and background
    const pillEl = entry.element.querySelector('.map-card-pill');
    if (pillEl) {
      pillEl.classList.remove('map-card-small', 'map-card-hover', 'map-card-big');
      pillEl.classList.add(`map-card-${newState}`);
      pillEl.setAttribute('data-state', newState);
      
      // Update background-image inline to match new state
      const pillUrl = getPillUrl(newState);
      pillEl.style.backgroundImage = `url('${pillUrl}')`;
    }
    
    // Update icon (size and image - thumbnail for big, category icon for small/hover)
    const iconEl = entry.element.querySelector('.map-card-icon');
    if (iconEl) {
      const isActive = newState === 'big';
      const iconSize = isActive ? BIG_ICON_SIZE : SMALL_ICON_SIZE;
      iconEl.width = iconSize;
      iconEl.height = iconSize;
      iconEl.src = getIconUrl(entry.post, newState);
    }
    
    // Update labels
    const labelsEl = entry.element.querySelector('.map-card-labels');
    if (labelsEl) {
      const isActive = newState === 'big';
      const post = entry.post;
      
      if (post.isMultiPost && post.venuePostCount > 1) {
        // Multi-post venue: show "X posts here" and venue name
        const countLabel = post.venuePostCount + ' posts here';
        const venueName = post.venue || '';
        const truncatedVenue = venueName ? shortenText(venueName, isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL) : '';
        
        labelsEl.innerHTML = `
          <div class="map-card-title">${escapeHtml(countLabel)}</div>
          ${truncatedVenue ? `<div class="map-card-venue">${escapeHtml(truncatedVenue)}</div>` : ''}
        `;
      } else {
        // Single post: show title, venue, and city
        const labels = getMarkerLabelLines(post, isActive);
        if (isActive) {
          // Big card: Title (1 line if venue, 2 lines if no venue) + Venue + City
          if (labels.venueLine) {
            // With venue: Title (1 line) + Venue + City
            labelsEl.innerHTML = `
              <div class="map-card-title">${escapeHtml(labels.line1)}</div>
              <div class="map-card-venue">${escapeHtml(labels.venueLine)}</div>
              ${labels.cityLine ? `<div class="map-card-city">${escapeHtml(labels.cityLine)}</div>` : ''}
            `;
          } else {
            // Without venue: Title (2 lines) + City
            labelsEl.innerHTML = `
              <div class="map-card-title">${escapeHtml(labels.line1)}</div>
              ${labels.line2 ? `<div class="map-card-title">${escapeHtml(labels.line2)}</div>` : ''}
              ${labels.cityLine ? `<div class="map-card-city">${escapeHtml(labels.cityLine)}</div>` : ''}
            `;
          }
        } else {
          labelsEl.innerHTML = `
            <div class="map-card-title">${escapeHtml(labels.line1)}</div>
            ${labels.line2 ? `<div class="map-card-title">${escapeHtml(labels.line2)}</div>` : ''}
          `;
        }
      }
    }
  }

  /**
   * Remove a map card marker by venue key
   */
  function removeMapCardMarker(venueKey) {
    const entry = mapCardMarkers.get(venueKey);
    if (!entry) return;

    entry.marker.remove();
    mapCardMarkers.delete(venueKey);
  }
  
  /**
   * Remove a map card marker by post ID
   */
  function removeMapCardMarkerByPostId(postId) {
    const entry = findMarkerByPostId(postId);
    if (!entry) return;

    entry.marker.remove();
    mapCardMarkers.delete(entry.venueKey);
  }

  /**
   * Clear all map card markers
   */
  function clearAllMapCardMarkers() {
    mapCardMarkers.forEach(entry => entry.marker.remove());
    mapCardMarkers.clear();
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
    console.log('[Map] setMapStyle called with:', style);
    if (!map) {
      console.warn('[Map] setMapStyle: Map not initialized');
      return;
    }
    var styleUrl = style === 'standard-satellite' 
      ? 'mapbox://styles/mapbox/standard-satellite'
      : 'mapbox://styles/mapbox/standard';
    console.log('[Map] Setting style to:', styleUrl, 'currentStyleUrl:', currentStyleUrl);

    // If the requested style is already active, do nothing (prevents flicker).
    if (currentStyleUrl === styleUrl) {
      logDebug('[Map] setMapStyle: style already active, skipping reload');
      return;
    }
    
    // Store current lighting to re-apply after style loads
    var currentLighting = adminSettings.map_lighting || localStorage.getItem('map_lighting') || 'day';
    if (window.MemberModule && window.MemberModule.getCurrentUser) {
      var member = window.MemberModule.getCurrentUser();
      if (member && member.map_lighting) {
        currentLighting = member.map_lighting;
      }
    }
    
    // Fade out only if we're actually changing styles.
    var mapEl = document.querySelector('.map-container');
    if (mapEl) {
      try {
        mapEl.style.transition = 'opacity 0.25s ease';
        mapEl.style.opacity = '0';
      } catch (_eFadeOut) {}
    }

    // Update style tracking + token (cancels stale callbacks if style changes again quickly)
    currentStyleUrl = styleUrl;
    styleChangeToken++;
    var token = styleChangeToken;

    // Swap the style after fade-out completes (no flash).
    setTimeout(function() {
      if (!map) return;
      if (token !== styleChangeToken) return;
      
      // Register style.load handler BEFORE calling setStyle
      map.once('style.load', function() {
        console.log('[Map] STYLE.LOAD EVENT FIRED - token:', token, 'styleChangeToken:', styleChangeToken);
        if (token !== styleChangeToken) {
          console.log('[Map] Token mismatch, aborting');
          return;
        }
        console.log('[Map] Re-applying lighting:', currentLighting);
        applyLightingDirect(currentLighting);
        
        // Style change removes all images/sources/layers - must reload clusters
        // Also reset cluster cache keys so updateClusterData will fetch fresh data
        console.log('[Map] Resetting cluster state and reloading icon...');
        clusterIconLoaded = false;
        lastClusterBucketKey = null;
        lastClusterRequestKey = null;
        loadClusterIcon().then(function() {
          console.log('[Map] loadClusterIcon resolved, clusterIconLoaded =', clusterIconLoaded);
          if (token !== styleChangeToken) {
            console.log('[Map] Token mismatch after icon load, aborting');
            return;
          }
          console.log('[Map] Calling setupClusterLayers...');
          setupClusterLayers();
          console.log('[Map] Cluster layers re-added after style change');
        }).catch(function(err) {
          console.error('[Map] loadClusterIcon failed:', err);
        });
        
        // Fade back in on first render of the new style
        try {
          map.once('render', function() {
            if (token !== styleChangeToken) return;
            var el = document.querySelector('.map-container');
            if (el) {
              el.style.transition = 'opacity 0.8s ease-in';
              el.style.opacity = '1';
            }
          });
        } catch (_eFadeIn) {
          var el2 = document.querySelector('.map-container');
          if (el2) {
            el2.style.transition = 'opacity 0.8s ease-in';
            el2.style.opacity = '1';
          }
        }
      });
      
      // Now call setStyle
      map.setStyle(styleUrl);
    }, 260);
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
    clearActiveMapCards,
    setActiveMapCard,
    // Expose current marker keys so PostModule can remove stale markers without "drift".
    getMapCardMarkerVenueKeys: () => Array.from(mapCardMarkers.keys()),
    // MapCards-style hover API (compat layer for PostModule)
    setMapCardHover: (postId) => onMapCardHoverByPostId(postId, true),
    removeMapCardHover: (postId) => onMapCardHoverByPostId(postId, false),
    refreshMapCardStyles,
    updateHighDensityData,
    
    // Map card utilities (for PostModule)
    getMarkerLabelLines,
    getPillUrl,
    getIconUrl,
    
    // Clusters
    createClusterLayers,
    refreshClusters,
    
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

// Live-site compatibility shim: PostModule expects window.MapCards for hover syncing.
// Keep it thin: delegate to MapModule.
window.MapCards = window.MapCards || {
  setMapCardHover: (postId) => MapModule.setMapCardHover(postId),
  removeMapCardHover: (postId) => MapModule.removeMapCardHover(postId),
  setMapCardActive: (postId) => MapModule.setActiveMapCard(postId)
};
