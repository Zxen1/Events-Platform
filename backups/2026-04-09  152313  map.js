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
   - index.js (App backbone)
   - components.js (MapControlRowComponent)
   
   ============================================================================ */

const MapModule = (function() {
  'use strict';

  /* ==========================================================================
     IMPORTANT (Developer Note): TWO FILTERING PIPELINES EXIST
     --------------------------------------------------------------------------
     This file (`map.js`) owns the LOW-ZOOM filtering pipeline (clusters).
     It is designed to stay fast at worldwide zoom levels by fetching AGGREGATED data.
     
     - Source of truth for current filters is `localStorage['funmap_filters']`
     - Cluster requests include those filter params and return grouped counts
       via `/gateway.php?action=get-clusters`
     
     At HIGH ZOOM (zoom >= postsLoadZoom; default 8), the app switches to the
     detailed pipeline in `post.js`:
     - Fetches actual posts/map-cards "in this map area" using `bounds`
       via `/gateway.php?action=get-posts`
     
     So: clusters = worldwide aggregated; posts/map-cards = in-area detailed.
     ========================================================================== */

  /* ==========================================================================
     SECTION 1: CONSTANTS & STATE
     ========================================================================== */
  
  // Mapbox access token
  const MAPBOX_TOKEN = "pk.eyJ1IjoienhlbiIsImEiOiJjbWViaDRibXEwM2NrMm1wcDhjODg4em5iIn0.2A9teACgwpiCy33uO4WZJQ";
  
  // Zoom thresholds - postsLoadZoom from database settings (no hardcoded fallback)
  function getMarkerZoomThreshold() {
    if (!window.App || typeof App.getConfig !== 'function') {
      throw new Error('[Map] App.getConfig is required for postsLoadZoom.');
    }
    var threshold = App.getConfig('postsLoadZoom');
    if (typeof threshold !== 'number' || !isFinite(threshold)) {
      throw new Error('[Map] postsLoadZoom config is missing or invalid.');
    }
    return threshold;
  }
  function getClusterZoomMax() {
    if (!window.App || typeof App.getConfig !== 'function') {
      throw new Error('[Map] App.getConfig is required for postsLoadZoom.');
    }
    var threshold = App.getConfig('postsLoadZoom');
    if (typeof threshold !== 'number' || !isFinite(threshold)) {
      throw new Error('[Map] postsLoadZoom config is missing or invalid.');
    }
    return threshold;
  }
  
  
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

  function getEffectiveThemePresetKey(themeActive) {
    var active = themeActive || 'theme_auto';
    if (active === 'theme_auto') {
      if (!window.matchMedia) {
        throw new Error('[Map] window.matchMedia is required for theme_auto.');
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'theme_dark' : 'theme_light';
    }
    if (active === 'theme_light' || active === 'theme_dark') {
      return active;
    }
    throw new Error('[Map] Invalid theme_active "' + String(active) + '".');
  }

  function getThemePresetFromSettings() {
    if (!adminSettings || adminSettings.theme_presets === undefined) {
      throw new Error('[Map] settings.theme_presets must be loaded before resolving theme map settings.');
    }
    var presets = adminSettings.theme_presets;
    if (!presets || typeof presets !== 'object' || Array.isArray(presets)) {
      throw new Error('[Map] settings.theme_presets must be a JSON object.');
    }
    var presetKey = getEffectiveThemePresetKey(localStorage.getItem('theme_active') || 'theme_auto');
    var preset = presets[presetKey];
    if (!preset || preset.map_style === undefined || preset.map_lighting === undefined) {
      throw new Error('[Map] Missing map settings in theme preset "' + String(presetKey) + '".');
    }
    return preset;
  }

  function getResolvedThemeMapSettings() {
    var member = null;
    if (window.MemberModule && window.MemberModule.getCurrentUser) {
      member = window.MemberModule.getCurrentUser();
    }
    if (member && member.map_style && member.map_lighting) {
      return {
        map_style: member.map_style,
        map_lighting: member.map_lighting
      };
    }

    var storedStyle = localStorage.getItem('map_style');
    var storedLighting = localStorage.getItem('map_lighting');
    if (storedStyle && storedLighting) {
      return {
        map_style: storedStyle,
        map_lighting: storedLighting
      };
    }

    return {
      map_style: String(getThemePresetFromSettings().map_style),
      map_lighting: String(getThemePresetFromSettings().map_lighting)
    };
  }
  
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
              if (u && u.id && u.account_email) {
                // Read canonical filter state (updated immediately by applyFilters)
                const rawFilters = localStorage.getItem('funmap_filters');
                let filters = rawFilters ? JSON.parse(rawFilters) : null;
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
              // Read canonical filter state (updated immediately by applyFilters)
              // instead of member-auth-current.filters_json which may be stale
              // during the filter save debounce window.
              const rawFilters = localStorage.getItem('funmap_filters');
              let filters = {};
              if (rawFilters) {
                try { filters = JSON.parse(rawFilters); } catch(_e) { filters = {}; }
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
  
  // Track which specific marker (locationKey) was last made active for a given postId
  // (Needed for multi-location posts: one post can have multiple markers.)
  const lastActiveLocationKeyByPostId = new Map(); // postId(string) -> locationKey(string)
  
  // Hover state coordination (prevents flicker when moving between markers)
  let hoverToken = 0;
  let currentHoverPostIds = [];
  
  // Live-site-style hover/click manager (adapted for DOM markers):
  // - Hover is driven by pointer hit-testing (not per-marker mouseenter/mouseleave)
  // - Hover clears immediately (no linger); any fade-out should be CSS-only
  // - Click is resolved on pointerup with a tiny movement threshold (works during fly/drag)
  let hoverManagerBound = false;
  let hoveredLocationKey = '';
  let hoverClearTimerId = 0;
  let pointerDownActive = false;
  let pointerDownLocationKey = '';
  let pointerDownClientX = 0;
  let pointerDownClientY = 0;
  let lastMapCardPointerType = '';
  // Keep hover clear effectively instant; avoids "sticky" hover feeling.
  const HOVER_CLEAR_DELAY_MS = 0;
  const CLICK_MOVE_THRESHOLD_PX = 6;

  // ── NATIVE CIRCLE LAYER (icon/dot overflow markers) ──────────────────────
  const NC_SOURCE              = 'native-circles-source';
  const NC_LAYER               = 'native-circles-layer';
  const NC_HOVER_DELAY_MS      = 80; // pause before promoting to DOM hover card

  let _ncDataByKey      = {};   // locationKey → markerData (for hover card promotion)
  let _ncHoveredId      = null; // Mapbox auto-generated feature id of highlighted circle
  let _ncHoverTimer     = null; // setTimeout handle for NC_HOVER_DELAY_MS promotion
  let _ncPromoted       = null; // { marker: mapboxgl.Marker, leaveTimer } or null
  let _ncLastFeatures   = [];   // preserved across style reloads so layer can be rebuilt
  // ─────────────────────────────────────────────────────────────────────────
  
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
   * Get font string for text measurement (matches global font from base.css)
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
    const suburb = post.suburb || '';
    const cityName = post.city || '';
    const state = post.state || '';
    const countryName = post.country_name || '';
    
    // Big map card bottom line: always "Suburb, State" (fallback to Country)
    const bottomSecond = state || countryName || '';
    const bottomFirst = suburb || cityName || '';
    let cityLine = '';
    if (bottomFirst && bottomSecond) {
      cityLine = bottomFirst + ', ' + bottomSecond;
    } else {
      cityLine = bottomFirst || bottomSecond || '';
    }
    
    // For big cards: if venue exists, title gets 1 line; if no venue, title gets 2 lines
    const titleMaxLines = (isActive && venueName) ? 1 : 2;
    const titleLines = splitTextLines(title, maxWidth, titleMaxLines);
    
    while (titleLines.length < 2) titleLines.push('');
    
    const venueLine = venueName ? shortenText(venueName, maxWidth) : '';
    const cityLineShort = cityLine ? shortenText(cityLine, maxWidth) : '';
    
    return {
      line1: titleLines[0] || '',
      line2: titleLines[1] || '',
      venueLine,
      cityLine: cityLineShort
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
    // Storefront and multi-post markers both use the multi-post icon at small size
    if (post.isStorefront || post.isMultiPost) {
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
    // Storefront big card shows member avatar
    if (post.isStorefront && post.storefrontAvatarUrl) {
      return post.storefrontAvatarUrl;
    }
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
      /* =======================================================================
         MAP MARKER SYSTEM
         Shared shell, state layering, and card/icon/dot appearances.
      ======================================================================= */

      /* Shell = lat/lng point (0,0) anchor */
      .map-card-container {
        position: relative;
        width: 0;
        height: 0;
        cursor: pointer;
        z-index: calc(var(--layer-base) + 3);
      }

      /* State layering */
      /* IMPORTANT: On touch devices, :hover causes "two tap" behavior.
         Only include hover selectors on hover-capable devices. */
      @media (hover: hover) and (pointer: fine) {
        .map-card-container:hover { z-index: calc(var(--layer-base) + 5); }
      }
      .map-card-container.is-hovered { z-index: calc(var(--layer-base) + 5); }
      .map-card-container.is-active { z-index: calc(var(--layer-base) + 6); }
      
      /* Shared pill radius states */
      .map-card-container.is-active .map-card-pill {
        border-radius: 30px;
      }
      @media (hover: hover) and (pointer: fine) {
        .map-card-container:hover .map-card-pill {
          border-radius: 30px;
        }
      }
      
      @media (hover: hover) and (pointer: fine) {
        .map-card-container:not(.is-active):hover .map-card-pill {
          border-radius: 20px;
        }
      }
      
      /* Shared icon shell */
      .map-card-icon {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        z-index: 2;
        transition: width 0.2s ease, height 0.2s ease;
      }
      
      /* Shared pill shell */
      .map-card-pill {
        position: absolute;
        display: flex;
        align-items: center;
        background-repeat: no-repeat;
        transform: translateZ(0);
        transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease, background-image 0.2s ease;
      }
      
      /* Card appearance: default small, hover, active */
      .map-card-small {
        left: -20px;
        top: -${SMALL_PILL_HEIGHT / 2}px;
        width: ${SMALL_PILL_WIDTH}px;
        height: ${SMALL_PILL_HEIGHT}px;
        padding-left: 40px;
        background-image: url('${smallPillUrl}');
        background-size: ${SMALL_PILL_WIDTH}px ${SMALL_PILL_HEIGHT}px;
        clip-path: inset(0 round 20px);
      }
      
      .map-card-hover {
        left: -20px;
        top: -${SMALL_PILL_HEIGHT / 2}px;
        width: ${SMALL_PILL_WIDTH}px;
        height: ${SMALL_PILL_HEIGHT}px;
        padding-left: 40px;
        background-image: none;
        background-color: var(--pill-fill, var(--subcat-color, var(--blue-500)));
        border-radius: 20px;
        clip-path: inset(0 round 20px);
      }
      
      .map-card-big {
        left: -30px;
        top: -${BIG_PILL_HEIGHT / 2}px;
        width: ${BIG_PILL_WIDTH}px;
        height: ${BIG_PILL_HEIGHT}px;
        padding-left: 60px;
        background-image: none;
        background-color: var(--pill-fill, var(--subcat-color, var(--blue-500)));
        border-radius: 30px;
        clip-path: inset(0 round 30px);
      }
      
      /* Shared labels */
      .map-card-labels {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      /* Shared text */
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

      /* Shared multipost/storefront pill artwork
         Uses the same oversized icon treatment for hover and active pills.
      ──────────────────────────────────────────────────────────────────────────── */
      .map-card-container[data-multipost] .map-card-hover,
      .map-card-container[data-multipost] .map-card-big {
        overflow: hidden;
      }
      .map-card-container[data-multipost] .map-card-hover::before,
      .map-card-container[data-multipost] .map-card-big::before {
        content: '';
        position: absolute;
        top: 50%;
        width: var(--pill-bg-size, 0);
        height: var(--pill-bg-size, 0);
        background-image: var(--pill-bg-icon);
        background-repeat: no-repeat;
        background-position: center center;
        background-size: contain;
        transform: translate(-50%, -50%);
        filter: brightness(1);
        pointer-events: none;
        z-index: 0;
      }
      .map-card-container[data-multipost] .map-card-hover::before {
        left: 20px;
      }
      .map-card-container[data-multipost] .map-card-big::before {
        left: 30px;
      }
      .map-card-container[data-multipost] .map-card-labels {
        position: relative;
        z-index: 1;
      }

      /* ── MAP ICON appearance ──────────────────────────────────────────────────
         Compact marker with black circular backplate. Hover and active reveal
         the same pill system as the default card marker.
      ──────────────────────────────────────────────────────────────────────────── */
      .map-card-container.map-card-appearance--icon:not(.is-hovered):not(.is-active) {
        z-index: calc(var(--layer-base) + 2);
      }
      .map-card-appearance--icon .map-card-pill {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .map-card-appearance--icon.is-hovered .map-card-pill,
      .map-card-appearance--icon.is-active .map-card-pill {
        opacity: 1;
        pointer-events: auto;
      }
      .map-card-appearance--icon::before {
        content: '';
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(0,0,0,0.7);
        left: 0;
        top: 0;
        z-index: 1;
        pointer-events: none;
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
      }
      .map-card-appearance--icon.is-hovered::before,
      .map-card-appearance--icon.is-active::before {
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
      }
      @media (hover: hover) and (pointer: fine) {
        .map-card-appearance--icon:not(.is-active):hover .map-card-pill {
          opacity: 1;
          pointer-events: auto;
        }
        .map-card-appearance--icon:not(.is-active):hover::before {
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
        }
      }

      /* ── MAP DOT appearance ───────────────────────────────────────────────────
         Minimal dot marker by default. Hover and active reveal the same pill
         and subcategory icon treatment used by the other marker states.
      ──────────────────────────────────────────────────────────────────────────── */
      .map-card-container.map-card-appearance--dot:not(.is-hovered):not(.is-active) {
        z-index: calc(var(--layer-base) + 1);
      }
      .map-card-appearance--dot .map-card-pill {
        opacity: 0;
        pointer-events: none;
        transform: scale(0);
        transform-origin: left center;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .map-card-appearance--dot.is-hovered .map-card-pill,
      .map-card-appearance--dot.is-active .map-card-pill {
        opacity: 1;
        pointer-events: auto;
        transform: scale(1);
      }
      .map-card-appearance--dot:not(.is-hovered):not(.is-active) .map-card-icon {
        opacity: 0;
      }
      .map-card-appearance--dot[data-multipost]:not(.is-active)::after {
        background-image: var(--dot-icon);
        background-size: cover;
        background-color: transparent;
      }
      .map-card-appearance--dot::before {
        content: '';
        position: absolute;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(0,0,0,0.7);
        left: 0;
        top: 0;
        z-index: 1;
        pointer-events: none;
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
      }
      .map-card-appearance--dot::after {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--dot-color);
        left: 0;
        top: 0;
        z-index: 2;
        pointer-events: none;
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }
      .map-card-appearance--dot.is-hovered::before,
      .map-card-appearance--dot.is-hovered::after,
      .map-card-appearance--dot.is-active::before,
      .map-card-appearance--dot.is-active::after {
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
      }
      @media (hover: hover) and (pointer: fine) {
        .map-card-appearance--dot:not(.is-active):hover .map-card-pill {
          opacity: 1;
          pointer-events: auto;
          transform: scale(1);
        }
        .map-card-appearance--dot:not(.is-active):hover .map-card-icon {
          opacity: 1;
        }
        .map-card-appearance--dot:not(.is-active):hover::before,
        .map-card-appearance--dot:not(.is-active):hover::after {
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
        }
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
          case 'hover':
            // hover/big pills use CSS background-color (var(--subcat-color)); clear any inline override
            pillEl.style.backgroundImage = '';
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
    
    var resolvedThemeMapSettings = getResolvedThemeMapSettings();
    var initialStyle = resolvedThemeMapSettings.map_style;
    var styleUrl = initialStyle === 'standard-satellite' 
      ? 'mapbox://styles/mapbox/standard-satellite'
      : 'mapbox://styles/mapbox/standard';
    currentStyleUrl = styleUrl;
    
    // Determine initial lighting BEFORE map creation.
    // This prevents the "flash" of incorrect lighting before switching.
    var initialLighting = resolvedThemeMapSettings.map_lighting;

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

        // Initialize native circle layer (icon/dot overflow markers)
        initNativeCircleLayers();
        
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
        logDebug('[Map] loadSettings: theme_presets loaded =', !!adminSettings.theme_presets, 'spin_on_load =', adminSettings.spin_on_load);
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
          
          var resolvedThemeMapSettings = getResolvedThemeMapSettings();
          var lighting = resolvedThemeMapSettings.map_lighting;
          var style = resolvedThemeMapSettings.map_style;
          logDebug('[Map] loadSettings: Using theme lighting:', lighting);
          logDebug('[Map] loadSettings: Using theme style:', style);
          
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
     Uses MapControlRowComponent from components.js
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
    if (!result || !result.center) return;

    const lng = result.center[0];
    const lat = result.center[1];

    // Snapshot which panels/mode are active before closing (reopen after landing)
    var previousMode = '';
    var reopenFilter = false;
    var reopenMember = false;
    var reopenAdmin = false;
    try {
      var activeBtn = document.querySelector('.header-modeswitch > .button-class-1[aria-pressed="true"]');
      if (activeBtn && activeBtn.dataset && activeBtn.dataset.mode) previousMode = activeBtn.dataset.mode;
      var fp = document.querySelector('.filter-panel');
      if (fp && fp.classList.contains('show')) reopenFilter = true;
      var mp = document.querySelector('.member-panel');
      if (mp && mp.classList.contains('member-panel--show')) reopenMember = true;
      var ap = document.querySelector('.admin-panel');
      if (ap && ap.classList.contains('admin-panel--show')) reopenAdmin = true;
    } catch (_eSnap) {}

    // Capture pitch before any mode-switch resets it
    var savedPitch = map ? map.getPitch() : startPitch;

    // Close everything (same pattern as location menu: click the map button)
    var mapBtn = document.querySelector('.header-modeswitch > .button-class-1[data-mode="map"]');
    if (mapBtn) {
      mapBtn.click();
    }

    // Close welcome modal on search
    if (window.WelcomeModalComponent) {
      WelcomeModalComponent.close();
    }

    // Stop spin on interaction
    stopSpin();

    // Fly to location (Mapbox)
    if (map) {
      if (result.bbox && result.bbox.length === 4) {
        map.fitBounds([
          [result.bbox[0], result.bbox[1]],
          [result.bbox[2], result.bbox[3]]
        ], {
          padding: 50,
          maxZoom: 15,
          pitch: savedPitch
        });
      } else {
        map.flyTo({
          center: [lng, lat],
          zoom: App.getConfig('flyToZoom'),
          pitch: savedPitch,
          essential: true
        });
      }

      // Restore panels and mode after landing
      var needsRestore = previousMode === 'posts' || previousMode === 'recent' || reopenFilter || reopenMember || reopenAdmin;
      if (needsRestore) {
        map.once('moveend', function() {
          if (previousMode && previousMode !== 'map') {
            var restoreBtn = document.querySelector('.header-modeswitch > .button-class-1[data-mode="' + previousMode + '"]');
            if (restoreBtn) restoreBtn.click();
          }
          if (reopenFilter) App.emit('panel:toggle', { panel: 'filter', show: true });
          if (reopenMember) App.emit('panel:toggle', { panel: 'member', show: true });
          if (reopenAdmin) App.emit('panel:toggle', { panel: 'admin', show: true });
        });
      }
    }

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
  const CLUSTER_ICON_PREFIX = 'cluster-';
  const CLUSTER_MAX_COUNT = 999;
  const CLUSTER_MIN_ZOOM = 0;
  const BUBBLE_LAYER_ID = 'post-bubbles';
  const BUBBLE_LABEL_LAYER_ID = 'post-bubble-labels';
  const BUBBLE_ZOOM_MAX = 7;
  
  // Cluster state
  let clusterIconsLoaded = false;
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

  // Shared state for on-demand balloon stamping
  var clusterBalloonImg = null;
  var clusterBalloonCanvas = null;
  var clusterBalloonCtx = null;
  var clusterBalloonPixelRatio = 1;

  /**
   * Load the base balloon PNG. Numbered variants are stamped on-demand
   * by ensureClusterImage() as cluster data arrives.
   */
  function loadClusterIcons() {
    return new Promise(function(resolve) {
      if (!map || clusterIconsLoaded) {
        resolve();
        return;
      }
      
      // Base PNG already in memory (e.g. after style change) -- just mark ready
      if (clusterBalloonImg) {
        clusterIconsLoaded = true;
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
        clusterBalloonImg = img;
        var scale = 3;
        clusterBalloonPixelRatio = scale;
        clusterBalloonCanvas = document.createElement('canvas');
        clusterBalloonCanvas.width = img.width * scale;
        clusterBalloonCanvas.height = img.height * scale;
        clusterBalloonCtx = clusterBalloonCanvas.getContext('2d', { willReadFrequently: true });
        
        clusterIconsLoaded = true;
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
   * Stamp a number onto the balloon and register it with Mapbox (on-demand).
   * Skips if the image already exists.
   */
  function ensureClusterImage(n) {
    var imageId = CLUSTER_ICON_PREFIX + n;
    if (map.hasImage(imageId)) return;
    if (!clusterBalloonImg || !clusterBalloonCtx) return;
    
    var canvas = clusterBalloonCanvas;
    var w = canvas.width;
    var h = canvas.height;
    var ctx = clusterBalloonCtx;
    
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(clusterBalloonImg, 0, 0, w, h);
    
    var digits = String(n).length;
    var sizeRatio = digits >= 3 ? 0.36 : digits === 2 ? 0.42 : 0.48;
    var fontSize = Math.round(w * sizeRatio);
    var textCenterY = h * 0.42;
    
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.strokeStyle = 'rgba(120, 0, 0, 0.5)';
    ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.08));
    ctx.lineJoin = 'round';
    ctx.strokeText(String(n), w / 2, textCenterY);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(n), w / 2, textCenterY);
    
    var imageData = ctx.getImageData(0, 0, w, h);
    map.addImage(imageId, imageData, { pixelRatio: clusterBalloonPixelRatio });
  }

  /**
   * Initialize cluster system
   */
  function initClusters() {
    if (!map) return;
    
    // adminSettings should be available via App.getState('settings')
    // because this is called inside whenStartupSettingsReady.
    adminSettings = App.getState('settings') || {};

    loadClusterIcons().then(function() {
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
    
    if (!clusterIconsLoaded) {
      console.error('[Map] Cluster icons not loaded. Configure marker_cluster_icon in Admin > Map tab.');
      return;
    }
    
    // Remove existing layers if present
    if (map.getLayer(BUBBLE_LABEL_LAYER_ID)) {
      map.removeLayer(BUBBLE_LABEL_LAYER_ID);
    }
    if (map.getLayer(BUBBLE_LAYER_ID)) {
      map.removeLayer(BUBBLE_LAYER_ID);
    }
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

    // Proportional bubble layer — zoom 0 to 7, before balloon clusters appear
    map.addLayer({
      id: BUBBLE_LAYER_ID,
      type: 'circle',
      source: CLUSTER_SOURCE_ID,
      minzoom: CLUSTER_MIN_ZOOM,
      maxzoom: BUBBLE_ZOOM_MAX,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
          0, ['interpolate', ['linear'], ['get', 'count'], 1, 12, 20, 20, 100, 32, 500, 45],
          6, ['interpolate', ['linear'], ['get', 'count'], 1, 18, 20, 30, 100, 48, 500, 65]
        ],
        'circle-color': ['interpolate', ['linear'], ['get', 'count'],
          0,   '#00e5ff',
          25,  '#2979ff',
          100, '#651fff',
          300, '#aa00ff'
        ],
        // 'circle-emissive-strength': 0.8,
        'circle-opacity': 0.8,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 1
      }
    });

    // Count labels inside bubbles
    map.addLayer({
      id: BUBBLE_LABEL_LAYER_ID,
      type: 'symbol',
      source: CLUSTER_SOURCE_ID,
      minzoom: CLUSTER_MIN_ZOOM,
      maxzoom: BUBBLE_ZOOM_MAX,
      layout: {
        'text-field': ['case',
          ['>=', ['get', 'count'], 1000],
          ['concat', ['to-string', ['floor', ['/', ['get', 'count'], 1000]]], 'k'],
          ['to-string', ['get', 'count']]
        ],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 0, 11, 6, 14],
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Create cluster layer — each count has its own pre-rendered balloon image
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'symbol',
      source: CLUSTER_SOURCE_ID,
      minzoom: BUBBLE_ZOOM_MAX,
      maxzoom: getClusterZoomMax(),
      layout: {
        'icon-image': ['concat', CLUSTER_ICON_PREFIX, ['to-string', ['min', ['get', 'count'], CLUSTER_MAX_COUNT]]],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 7.5, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'bottom',
        'symbol-z-order': 'viewport-y',
        'symbol-sort-key': 900
      },
      paint: {
        'icon-opacity': 0.95
      }
    });
    
    // Bind click handlers for bubble layer
    map.on('click', BUBBLE_LAYER_ID, handleClusterClick);
    map.on('click', BUBBLE_LABEL_LAYER_ID, handleClusterClick);
    map.on('mouseenter', BUBBLE_LAYER_ID, function() { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', BUBBLE_LAYER_ID, function() { map.getCanvas().style.cursor = 'grab'; });
    map.on('mouseenter', BUBBLE_LABEL_LAYER_ID, function() { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', BUBBLE_LABEL_LAYER_ID, function() { map.getCanvas().style.cursor = 'grab'; });

    // Bind click handler for balloon cluster layer
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
        data.features.forEach(function(f) { ensureClusterImage(f.properties.count); });
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
    var emptySubcategorySelection = false;
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
          if (saved.show18Plus) qs.set('show18_plus', '1');
          if (Array.isArray(saved.subcategoryKeys)) {
            if (saved.subcategoryKeys.length === 0) {
              emptySubcategorySelection = true;
            } else {
              qs.set('subcategory_keys', saved.subcategoryKeys.map(String).join(','));
            }
          }
          if (saved.amenities && typeof saved.amenities === 'object' && Object.keys(saved.amenities).length > 0) {
            qs.set('amenities', JSON.stringify(saved.amenities));
          }
        }
      }
    } catch (_e) {}

    if (emptySubcategorySelection) {
      return Promise.resolve({ clusters: [], totalCount: 0 });
    }

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
      var count = Math.min(c.count, CLUSTER_MAX_COUNT);
      return {
        type: 'Feature',
        properties: {
          count: count,
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
   * - From zoom 7.5+: fly straight to configured flyToZoom (same as other fly-to flows)
   * This prevents landing in empty space when clicking large clusters from far out.
   */
  function handleClusterClick(e) {
    // Performance/Interaction Rule: Never trigger if past threshold (clusters hidden)
    if (map.getZoom() >= getClusterZoomMax()) return;
    
    if (!e || !e.features || !e.features[0]) return;
    
    var coords = e.features[0].geometry.coordinates;
    var currentZoom = map.getZoom();
    
    // Below 7.5: stop at 7.5 to show finest cluster breakdown
    // At 7.5+: go straight to configured flyToZoom (same behavior as MapModule.flyTo)
    var FINEST_CLUSTER_ZOOM = 7.6;
    var configuredFlyToZoom = null;
    if (!window.App || typeof App.getConfig !== 'function') {
      throw new Error('[Map] App.getConfig is required for flyToZoom.');
    }
    configuredFlyToZoom = App.getConfig('flyToZoom');
    if (typeof configuredFlyToZoom !== 'number' || !isFinite(configuredFlyToZoom)) {
      throw new Error('[Map] flyToZoom config is missing or invalid.');
    }
    var targetZoom = currentZoom < FINEST_CLUSTER_ZOOM - 0.3 ? FINEST_CLUSTER_ZOOM : configuredFlyToZoom;
    
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

    // Native circle layer follows the same zoom threshold as DOM markers
    if (map && map.getLayer(NC_LAYER)) {
      map.setLayoutProperty(NC_LAYER, 'visibility', shouldShow ? 'visible' : 'none');
    }
  }

  /**
   * Create a map card marker for a post
   */
  function createMapCardMarker(post, lng, lat, appearance, dotColor) {
    if (!map || !post || !post.id) return null;

    // Note: We don't call removeMapCardMarker here because renderMapMarkers
    // already clears all markers at the start. Calling it here would break
    // multi-post venues where different venues share the same post ID.

    // Create marker element
    const el = document.createElement('div');
    el.className = 'map-card-container';

    /* Marker appearance inputs
       Shared colour/icon variables feed the CSS marker system above. */
    var subcatColor = (post.isMultiPost || post.isStorefront) ? '#ffffff' : (post.subcategory_color || '');
    if (subcatColor) el.style.setProperty('--subcat-color', subcatColor);
    if (post.isMultiPost || post.isStorefront) {
      el.dataset.multipost = '1';
      el.style.setProperty('--pill-fill', '#222222');
      el.style.setProperty('--pill-bg-icon', 'url(' + getMultiPostIconUrl() + ')');
      el.style.setProperty('--pill-bg-size', '450px');
    } else if (subcatColor) {
      var _h = subcatColor.replace('#', '');
      var _r = parseInt(_h.substring(0,2), 16);
      var _g = parseInt(_h.substring(2,4), 16);
      var _b = parseInt(_h.substring(4,6), 16);
      el.style.setProperty('--pill-fill', 'rgb(' + _r + ',' + _g + ',' + _b + ')');
    }

    /* Marker appearance mode */
    if (appearance === 'icon') {
      el.classList.add('map-card-appearance--icon');
    } else if (appearance === 'dot') {
      if (!dotColor && !post.isMultiPost && !post.isStorefront) {
        throw new Error('[Map] createMapCardMarker: dotColor required for dot appearance (post ID ' + post.id + ')');
      }
      el.classList.add('map-card-appearance--dot');
      if (dotColor) el.style.setProperty('--dot-color', dotColor);
      if (post.isMultiPost || post.isStorefront) {
        el.style.setProperty('--dot-icon', 'url(' + getMultiPostIconUrl() + ')');
      }
    }
    el.innerHTML = buildMapCardHTML(post, 'small');

    // Create Mapbox marker
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center'
    })
      .setLngLat([lng, lat])
      .addTo(map);

    // Store reference by venue coordinates (prevents duplicate entries for multi-post venues)
    const locationKey = lng.toFixed(6) + ',' + lat.toFixed(6);
    el.dataset.locationKey = locationKey;
    const entry = {
      marker: marker,
      element: el,
      post: post,
      state: 'small',
      lng: lng,
      lat: lat,
      locationKey: locationKey,
      // IMPORTANT: store IDs as STRINGS (matches live-site behavior and avoids number/string mismatches)
      postIds: (post.isMultiPost || post.isStorefront) && Array.isArray(post.locationPostIds)
        ? post.locationPostIds.map(function(pid) { return String(pid); })
        : [String(post.id)]
    };
    
    // Store by venue key to avoid duplicates
    mapCardMarkers.set(locationKey, entry);

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
    
    // Build label HTML based on whether this is a storefront, multi-post venue, or single post
    let labelHTML = '';
    
    if (post.isStorefront && post.locationPostCount > 1) {
      const truncatedTitle = shortenText(post.storefrontTitle || '', isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL);
      const countLabel = post.locationPostCount + ' posts here';
      labelHTML = `
        <div class="map-card-title">${escapeHtml(truncatedTitle)}</div>
        <div class="map-card-venue">${escapeHtml(countLabel)}</div>
      `;
    } else if (post.isMultiPost && post.locationPostCount > 1) {
      const venueName = post.venue || '';
      const truncatedVenue = venueName ? shortenText(venueName, isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL) : '';
      const countLabel = post.locationPostCount + ' posts here';
      
      labelHTML = `
        ${truncatedVenue ? `<div class="map-card-title">${escapeHtml(truncatedVenue)}</div>` : ''}
        <div class="map-card-venue">${escapeHtml(countLabel)}</div>
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
  
  function findMarkerByLocationKey(locationKey) {
    return mapCardMarkers.get(locationKey) || null;
  }
  
  function setMarkerHoverState(entry, isHovering) {
    if (!entry || !entry.element) return;
    
    if (isHovering) {
      // Never override the active/big state on hover.
      if (entry.state === 'big') return;
      entry.element.classList.add('is-hovered');
      updateMapCardStateByKey(entry.locationKey, 'hover');
    } else {
      entry.element.classList.remove('is-hovered');
      // Big markers keep their active state, but must still clear stale hover classes.
      if (entry.state === 'big') return;
      updateMapCardStateByKey(entry.locationKey, 'small');
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
  function onMapCardHoverByLocationKey(locationKey, isHovering) {
    const entry = findMarkerByLocationKey(locationKey);
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
  
  // Highlight/clear a native circle feature by postId (called from panel card hover).
  function _setNativeCircleHoverByPostId(postId, isHovering) {
    var pid = String(postId);
    if (!map || !map.getSource(NC_SOURCE)) return;
    Object.keys(_ncDataByKey).forEach(function(key) {
      var md = _ncDataByKey[key];
      if (String(md.id) !== pid) return;
      var featureId = Number(md.post_map_card_id) || 0;
      try { map.setFeatureState({ source: NC_SOURCE, id: featureId }, { hovered: isHovering }); } catch (_e) {}
    });
  }

  // Hover coming from PostModule (post card hover): apply hover to all markers for that postId.
  // This should NOT emit map:cardHover back to PostModule (prevents event loops / double work).
  function onMapCardHoverByPostId(postId, isHovering) {
    const pid = String(postId);
    const token = ++hoverToken;

    if (isHovering) {
      if (currentHoverPostIds && currentHoverPostIds.length) {
        setHoverGroupForPostIds(currentHoverPostIds, false);
      }
      setCurrentHoverPostIds([pid]);
      setHoverGroupForPostIds([pid], true);
      _setNativeCircleHoverByPostId(pid, true);
      return;
    }

    if (token !== hoverToken) return;
    if (currentHoverPostIds && currentHoverPostIds.length) {
      setHoverGroupForPostIds(currentHoverPostIds, false);
    }
    setCurrentHoverPostIds([]);
    _setNativeCircleHoverByPostId(pid, false);
  }

  /**
   * Clear ALL active (big) map cards.
   * Requirement: no map card should remain active if there is no open post context.
   */
  function clearActiveMapCards() {
    try {
      // Clear active marker visuals
      mapCardMarkers.forEach((entry, locationKey) => {
        if (!entry || !entry.element) return;
        if (entry.state === 'big') {
          updateMapCardStateByKey(locationKey, 'small');
        }
        entry.element.classList.remove('is-active');
      });
      // Clear hover group too (avoid sticky hover feeling)
      if (currentHoverPostIds && currentHoverPostIds.length) {
        setHoverGroupForPostIds(currentHoverPostIds, false);
      }
      setCurrentHoverPostIds([]);
      hoveredLocationKey = '';
      clearHoverClearTimer();
      // IMPORTANT:
      // Do NOT clear lastActiveLocationKeyByPostId here.
      // We are clearing VISUAL "active/big" state (because there is no open post context),
      // but the user's last selected location for a multi-location post must remain the source-of-truth.
    } catch (_e) {}
  }

  /**
   * Handle map card click
   */
  function onMapCardClick(locationKey) {
    const entry = findMarkerByLocationKey(locationKey);
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
        setActiveMapCard(entry.post && entry.post.id ? String(entry.post.id) : '', { locationKey: entry.locationKey });
        stopSpin();
        return;
      }
      // Second tap (already active): open.
      stopSpin();
      App.emit('map:cardClicked', {
        postId: entry.post && entry.post.id ? entry.post.id : null,
        post_map_card_id: entry.post && entry.post.post_map_card_id ? entry.post.post_map_card_id : null,
        locationKey: entry.locationKey
      });
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
    setActiveMapCard(entry.post && entry.post.id ? String(entry.post.id) : '', { locationKey: entry.locationKey });

    // Stop spin
    stopSpin();

    // Emit event for post module to open the post
    App.emit('map:cardClicked', {
      postId: entry.post && entry.post.id ? entry.post.id : null,
      post_map_card_id: entry.post && entry.post.post_map_card_id ? entry.post.post_map_card_id : null,
      locationKey: entry.locationKey
    });
  }

  /**
   * Set the active marker for a specific post_map_card_id (no guessing).
   * @param {string|number} postId
   * @param {string|number} postMapCardId
   * @returns {boolean} true if set, false if not found
   */
  function setActiveMapCardByPostMapCardId(postId, postMapCardId) {
    const pid = String(postId || '');
    const pmc = String(postMapCardId || '');
    if (!pid || !pmc) return false;
    try {
      let target = null;
      for (const [key, entry] of mapCardMarkers) {
        if (!entry || !entry.post || !entry.postIds) continue;
        if (!entry.postIds.includes(pid)) continue;
        const entryPmc = String(entry.post.post_map_card_id || '');
        if (entryPmc !== pmc) {
          // For storefront/multi-post markers, the first item's map card ID is stored.
          // Check all map card IDs in the group before skipping.
          const locationMcIds = Array.isArray(entry.post.locationMapCardIds) ? entry.post.locationMapCardIds : null;
          if (!locationMcIds || locationMcIds.indexOf(pmc) === -1) continue;
        }
        target = entry;
        break;
      }
      if (!target) return false;
      setActiveMapCard(pid, { locationKey: target.locationKey });
      return true;
    } catch (_e) {
      return false;
    }
  }

  function clearHoverClearTimer() {
    if (hoverClearTimerId) {
      clearTimeout(hoverClearTimerId);
      hoverClearTimerId = 0;
    }
  }

  function getLocationKeyFromTarget(target) {
    if (!target || typeof target.closest !== 'function') return '';
    const container = target.closest('.map-card-container');
    if (!container || !container.dataset) return '';
    if (container.dataset.ncHoverCard) return ''; // promoted native circle hover card — not a DOM marker
    return container.dataset.locationKey ? String(container.dataset.locationKey) : '';
  }

  function getLocationKeyFromPoint(clientX, clientY) {
    try {
      const el = document.elementFromPoint(clientX, clientY);
      return getLocationKeyFromTarget(el);
    } catch (_e) {
      return '';
    }
  }

  function setHoveredLocationKey(nextLocationKey) {
    const nextKey = nextLocationKey ? String(nextLocationKey) : '';
    if (nextKey === hoveredLocationKey) return;

    // End previous hover (if any)
    if (hoveredLocationKey) {
      onMapCardHoverByLocationKey(hoveredLocationKey, false);
    }
    hoveredLocationKey = nextKey;
    if (hoveredLocationKey) {
      onMapCardHoverByLocationKey(hoveredLocationKey, true);
    }
  }

  function scheduleHoverClear(clientX, clientY) {
    clearHoverClearTimer();
    hoverClearTimerId = setTimeout(() => {
      // Recheck under pointer before clearing (matches live-site behavior)
      const stillKey = getLocationKeyFromPoint(clientX, clientY);
      if (stillKey) {
        setHoveredLocationKey(stillKey);
        return;
      }
      setHoveredLocationKey('');
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
      const key = getLocationKeyFromPoint(e.clientX, e.clientY);
      if (key) {
        setHoveredLocationKey(key);
      } else {
        // Clear immediately when not over a marker (no linger).
        setHoveredLocationKey('');
      }
    }, { passive: true });

    container.addEventListener('pointerleave', (e) => {
      if (pointerDownActive) return;
      // Leaving the map container should clear hover immediately.
      clearHoverClearTimer();
      setHoveredLocationKey('');
    }, { passive: true });

    // Resolve click based on pointerup (works during fly/drag; no waiting for map to stop).
    document.addEventListener('pointerdown', (e) => {
      const key = getLocationKeyFromTarget(e && e.target);
      if (!key) return;
      try { lastMapCardPointerType = e && e.pointerType ? String(e.pointerType) : ''; } catch (_ePT) { lastMapCardPointerType = ''; }
      pointerDownActive = true;
      pointerDownLocationKey = key;
      pointerDownClientX = e.clientX || 0;
      pointerDownClientY = e.clientY || 0;
      clearHoverClearTimer();
      setHoveredLocationKey(key);
    }, true);

    document.addEventListener('pointerup', (e) => {
      if (!pointerDownActive) return;
      const upX = e && typeof e.clientX === 'number' ? e.clientX : 0;
      const upY = e && typeof e.clientY === 'number' ? e.clientY : 0;
      const keyUp = getLocationKeyFromPoint(upX, upY);
      const dx = upX - pointerDownClientX;
      const dy = upY - pointerDownClientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const clickedKey = pointerDownLocationKey;
      pointerDownActive = false;
      pointerDownLocationKey = '';

      if (clickedKey && keyUp === clickedKey && dist <= CLICK_MOVE_THRESHOLD_PX) {
        onMapCardClick(clickedKey);
      }
    }, true);

    document.addEventListener('pointercancel', () => {
      pointerDownActive = false;
      pointerDownLocationKey = '';
    }, true);
  }

  /**
   * Set a map card to active (big) state
   */
  function setActiveMapCard(postId, options) {
    const pid = String(postId);
    const locationKey = options && options.locationKey ? String(options.locationKey) : '';
    
    // Prefer an explicit locationKey (clicked marker), then the last active marker for this postId, else first match.
    let targetEntry = null;
    if (locationKey) {
      targetEntry = findMarkerByLocationKey(locationKey);
    }
    if (!targetEntry && lastActiveLocationKeyByPostId.has(pid)) {
      targetEntry = findMarkerByLocationKey(lastActiveLocationKeyByPostId.get(pid));
    }
    if (!targetEntry) {
      targetEntry = findMarkerByPostId(pid);
    }
    const targetKey = targetEntry ? targetEntry.locationKey : null;
    
    // Deactivate all other cards
    mapCardMarkers.forEach((entry, locationKey) => {
      if (locationKey !== targetKey && entry.state === 'big') {
        updateMapCardStateByKey(locationKey, 'small');
        entry.element.classList.remove('is-active');
      }
    });

    // Activate this card
    if (targetEntry) {
      // Remember which marker is active for this post (multi-location posts)
      lastActiveLocationKeyByPostId.set(pid, targetKey);
      updateMapCardStateByKey(targetKey, 'big');
      targetEntry.element.classList.add('is-active');
    }
  }

  /**
   * Get the active (selected) post_map_card_id for a postId (single-post/multi-location).
   * Source-of-truth is MapModule's active marker selection (lastActiveLocationKeyByPostId).
   * This prevents other modules from guessing based on map center or DOM.
   * @param {string|number} postId
   * @returns {string} post_map_card_id or empty string if none is selected
   */
  function getActivePostMapCardId(postId) {
    const pid = String(postId || '');
    if (!pid) return '';
    try {
      if (!lastActiveLocationKeyByPostId.has(pid)) return '';
      const key = lastActiveLocationKeyByPostId.get(pid);
      const entry = key ? findMarkerByLocationKey(key) : null;
      if (!entry || !entry.post) return '';
      const pmc = entry.post.post_map_card_id;
      return (pmc !== undefined && pmc !== null) ? String(pmc) : '';
    } catch (_e) {
      return '';
    }
  }

  /**
   * Update map card visual state by venue key
   */
  function updateMapCardStateByKey(locationKey, newState) {
    const entry = mapCardMarkers.get(locationKey);
    if (!entry || entry.state === newState) return;

    entry.state = newState;
    
    // Update pill element classes and background
    const pillEl = entry.element.querySelector('.map-card-pill');
    if (pillEl) {
      pillEl.classList.remove('map-card-small', 'map-card-hover', 'map-card-big');
      pillEl.classList.add(`map-card-${newState}`);
      pillEl.setAttribute('data-state', newState);
      
      // hover/big pills use CSS background-color; only small pill uses background-image
      if (newState === 'small') {
        const pillUrl = getPillUrl(newState);
        pillEl.style.backgroundImage = `url('${pillUrl}')`;
      } else {
        pillEl.style.backgroundImage = '';
      }
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
      
      if (post.isStorefront && post.locationPostCount > 1) {
        const truncatedTitle = shortenText(post.storefrontTitle || '', isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL);
        const countLabel = post.locationPostCount + ' posts here';
        labelsEl.innerHTML = `
          <div class="map-card-title">${escapeHtml(truncatedTitle)}</div>
          <div class="map-card-venue">${escapeHtml(countLabel)}</div>
        `;
      } else if (post.isMultiPost && post.locationPostCount > 1) {
        const venueName = post.venue || '';
        const truncatedVenue = venueName ? shortenText(venueName, isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL) : '';
        const countLabel = post.locationPostCount + ' posts here';
        
        labelsEl.innerHTML = `
          ${truncatedVenue ? `<div class="map-card-title">${escapeHtml(truncatedVenue)}</div>` : ''}
          <div class="map-card-venue">${escapeHtml(countLabel)}</div>
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
  function removeMapCardMarker(locationKey) {
    const entry = mapCardMarkers.get(locationKey);
    if (!entry) return;

    entry.marker.remove();
    mapCardMarkers.delete(locationKey);
  }
  
  /**
   * Remove a map card marker by post ID
   */
  function removeMapCardMarkerByPostId(postId) {
    const entry = findMarkerByPostId(postId);
    if (!entry) return;

    entry.marker.remove();
    mapCardMarkers.delete(entry.locationKey);
  }

  /**
   * Clear all map card markers
   */
  function clearAllMapCardMarkers() {
    mapCardMarkers.forEach(entry => entry.marker.remove());
    mapCardMarkers.clear();
  }


  /* ==========================================================================
     SECTION 7B: NATIVE CIRCLE LAYER
     Replaces DOM icon/dot markers with a single GPU-rendered Mapbox circle layer.
     Cards and multi-post/storefront markers remain as DOM markers (map.js Section 6).
     ========================================================================== */

  /**
   * Create the GeoJSON source + circle layer on the main map.
   * Safe to call multiple times (no-ops if already added).
   * Must be called after map load and after every style reload.
   */
  function initNativeCircleLayers() {
    if (!map) return;

    // Remove stale layer/source from previous style load before re-adding
    try { if (map.getLayer(NC_LAYER))  map.removeLayer(NC_LAYER);  } catch (_e) {}
    try { if (map.getSource(NC_SOURCE)) map.removeSource(NC_SOURCE); } catch (_e) {}

    map.addSource(NC_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      generateId: true  // Mapbox assigns numeric IDs — required for feature-state hover
    });

    map.addLayer({
      id:     NC_LAYER,
      type:   'circle',
      source: NC_SOURCE,
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'hovered'], false], 10, 7],
        'circle-color':  ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': ['case',
          ['boolean', ['feature-state', 'hovered'], false],
          'rgba(255,255,255,0.85)',
          'rgba(0,0,0,0.35)'
        ],
        'circle-opacity': ['case', ['boolean', ['feature-state', 'hovered'], false], 1, 0.88],
        'circle-emissive-strength': 1
      }
    });

    // Re-apply last known features after style reload
    if (_ncLastFeatures.length) {
      map.getSource(NC_SOURCE).setData({ type: 'FeatureCollection', features: _ncLastFeatures });
    }

    // Set initial visibility to match current zoom threshold
    var _initZoom = map.getZoom();
    var _initShow = _initZoom >= getMarkerZoomThreshold();
    map.setLayoutProperty(NC_LAYER, 'visibility', _initShow ? 'visible' : 'none');

    _bindNativeCircleEvents();
  }

  /**
   * Replace the native circle source data with a new feature set.
   * Called by PostModule on every renderMapMarkers pass.
   * @param {Array}  features    - GeoJSON Feature array (points with color/postId properties)
   * @param {Object} dataByKey   - locationKey → markerData (for hover card promotion)
   */
  function updateNativeCircleLayer(features, dataByKey) {
    _ncLastFeatures = features || [];
    _ncDataByKey    = dataByKey || {};

    // Clear any active hover state — features are replaced so old Mapbox IDs are gone
    _clearNativeCircleHover();

    if (!map) return;
    var src = map.getSource(NC_SOURCE);
    if (!src) return;
    src.setData({ type: 'FeatureCollection', features: _ncLastFeatures });
  }

  /** Clear hover highlight, promotion timer, and promoted DOM card. */
  function _clearNativeCircleHover() {
    clearTimeout(_ncHoverTimer);
    _ncHoverTimer = null;

    if (_ncHoveredId !== null && map && map.getSource(NC_SOURCE)) {
      try { map.setFeatureState({ source: NC_SOURCE, id: _ncHoveredId }, { hovered: false }); } catch (_e) {}
      _ncHoveredId = null;
    }

    if (_ncPromoted) {
      var _clearedPostId = _ncPromoted.postId || '';
      clearTimeout(_ncPromoted.leaveTimer);
      try { _ncPromoted.marker.remove(); } catch (_e) {}
      _ncPromoted = null;
      if (_clearedPostId) {
        App.emit('map:cardHover', { postId: _clearedPostId, postIds: [_clearedPostId], isHovering: false });
      }
    }
  }

  /**
   * After NC_HOVER_DELAY_MS pause: create a temporary DOM hover card at the circle position.
   * Destroyed when the cursor leaves both the circle layer and the promoted card.
   */
  function _promoteNativeCircleHover(featureId, props, lng, lat) {
    // Guard: feature may have changed while timer was running
    if (_ncHoveredId !== featureId) return;

    var locationKey = props.locationKey;
    var md = _ncDataByKey[locationKey];
    if (!md) return;

    // Build hover card element (matches DOM marker 'hover' state)
    var el = document.createElement('div');
    el.className = 'map-card-container is-hovered';
    el.dataset.ncHoverCard = '1'; // prevents pointer manager treating this as a DOM marker
    var subcatColor = md.subcategory_color || '';
    if (subcatColor) el.style.setProperty('--subcat-color', subcatColor);
    if (subcatColor) {
      var _h = subcatColor.replace('#', '');
      var _r = parseInt(_h.substring(0, 2), 16);
      var _g = parseInt(_h.substring(2, 4), 16);
      var _b = parseInt(_h.substring(4, 6), 16);
      el.style.setProperty('--pill-fill', 'rgb(' + _r + ',' + _g + ',' + _b + ')');
    }
    el.innerHTML = buildMapCardHTML(md, 'hover');

    // Click on promoted card → open post (same as DOM card click).
    // Use click (not pointerup + threshold) because the pill extends far from the GL dot,
    // and comparing against the NC_LAYER pointerdown coordinates would always fail.
    el.addEventListener('click', function() {
      App.emit('map:cardClicked', {
        postId:           props.postId,
        post_map_card_id: props.postMapCardId,
        locationKey:      locationKey
      });
    });

    // Keep card alive while cursor is over it; destroy on leave
    el.addEventListener('pointerenter', function() {
      if (_ncPromoted) clearTimeout(_ncPromoted.leaveTimer);
    });
    el.addEventListener('pointerleave', function() {
      if (!_ncPromoted) return;
      _ncPromoted.leaveTimer = setTimeout(function() { _clearNativeCircleHover(); }, 80);
    });

    var marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);

    _ncPromoted = { marker: marker, leaveTimer: null, postId: String(props.postId || '') };

    // Glow the matching post card in the panel
    App.emit('map:cardHover', { postId: String(props.postId || ''), postIds: [String(props.postId || '')], isHovering: true });
  }

  // Pointer-down coords for click-threshold check on promoted card
  var _ncPointerDownX = 0;
  var _ncPointerDownY = 0;

  /** Attach mousemove/mouseleave/click events to the circle layer (called once per style load). */
  function _bindNativeCircleEvents() {
    if (!map) return;

    map.on('mousemove', NC_LAYER, function(e) {
      if (!e.features || !e.features.length) return;
      var f   = e.features[0];
      var fid = f.id;

      // Same feature — no change needed
      if (fid === _ncHoveredId) return;

      // New feature — clear previous state immediately, start fresh
      _clearNativeCircleHover();

      _ncHoveredId = fid;
      try { map.setFeatureState({ source: NC_SOURCE, id: _ncHoveredId }, { hovered: true }); } catch (_e) {}

      var props = f.properties;
      var coords = f.geometry.coordinates;
      _ncHoverTimer = setTimeout(function() {
        _promoteNativeCircleHover(fid, props, coords[0], coords[1]);
      }, NC_HOVER_DELAY_MS);
    });

    map.on('mouseleave', NC_LAYER, function() {
      // Delay before clearing — gives the pointer time to reach the promoted card
      if (_ncPromoted) return; // promoted card handles its own leave
      clearTimeout(_ncHoverTimer);
      _ncHoverTimer = null;
      if (_ncHoveredId !== null) {
        try { map.setFeatureState({ source: NC_SOURCE, id: _ncHoveredId }, { hovered: false }); } catch (_e) {}
        _ncHoveredId = null;
      }
    });

    map.on('pointerdown', NC_LAYER, function(e) {
      _ncPointerDownX = e.originalEvent ? e.originalEvent.clientX : 0;
      _ncPointerDownY = e.originalEvent ? e.originalEvent.clientY : 0;
    });

    map.on('click', NC_LAYER, function(e) {
      if (!e.features || !e.features.length) return;
      var props = e.features[0].properties;
      stopSpin();
      App.emit('map:cardClicked', {
        postId:           props.postId,
        post_map_card_id: props.postMapCardId,
        locationKey:      props.locationKey
      });
    });

    // Pointer cursor on hover
    map.on('mouseenter', NC_LAYER, function() {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', NC_LAYER, function() {
      map.getCanvas().style.cursor = '';
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
  function flyTo(lng, lat, zoom) {
    if (!map) return;
    if (zoom === undefined) {
      if (!window.App || typeof App.getConfig !== 'function') {
        throw new Error('[Map] App.getConfig is required for flyToZoom.');
      }
      zoom = App.getConfig('flyToZoom');
      if (typeof zoom !== 'number' || !isFinite(zoom)) {
        throw new Error('[Map] flyToZoom config is missing or invalid.');
      }
    }
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

    if (window.App && typeof App.whenStartupSettingsReady === 'function') {
      App.whenStartupSettingsReady().then(function() {
        initMap();
      }).catch(function(err) {
        console.error('[Map] Startup settings failed before map init:', err);
      });
      return;
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
    // If the requested style is already active, do nothing (prevents flicker).
    if (currentStyleUrl === styleUrl) {
      logDebug('[Map] setMapStyle: style already active, skipping reload');
      return;
    }
    
    // Store current lighting to re-apply after style loads
    var currentLighting = getResolvedThemeMapSettings().map_lighting;
    
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
        if (token !== styleChangeToken) {
          return;
        }
        applyLightingDirect(currentLighting);
        
        // Style change removes all images/sources/layers - must reload clusters
        // Also reset cluster cache keys so updateClusterData will fetch fresh data
        clusterIconsLoaded = false;
        lastClusterBucketKey = null;
        lastClusterRequestKey = null;
        loadClusterIcons().then(function() {
          if (token !== styleChangeToken) {
            return;
          }
          setupClusterLayers();
          // Re-add native circle layer after style reload (style wipes all sources/layers)
          initNativeCircleLayers();
        }).catch(function(err) {
          console.error('[Map] loadClusterIcons failed:', err);
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
    getActivePostMapCardId,
    setActiveMapCardByPostMapCardId,
    // Expose current marker keys so PostModule can remove stale markers without "drift".
    getMapCardMarkerLocationKeys: () => Array.from(mapCardMarkers.keys()),
    // MapCards-style hover API (compat layer for PostModule)
    setMapCardHover: (postId) => onMapCardHoverByPostId(postId, true),
    removeMapCardHover: (postId) => onMapCardHoverByPostId(postId, false),
    refreshMapCardStyles,

    
    // Map card utilities (for PostModule)
    getMarkerLabelLines,
    getPillUrl,
    getIconUrl,
    
    // Native circle layer (icon/dot overflow markers)
    updateNativeCircleLayer,

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
