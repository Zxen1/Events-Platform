// === Map Card Marker System ===
// Clean implementation using Mapbox Markers (DOM elements locked to map)
// Replaces the old composite sprite system

(function() {
  'use strict';

  // ==================== CONSTANTS ====================
  
  const MULTI_POST_MARKER_ICON_ID = 'multi-post-icon';
  
  // Pill dimensions
  const SMALL_PILL_WIDTH = 150;
  const SMALL_PILL_HEIGHT = 40;
  const BIG_PILL_WIDTH = 225;
  const BIG_PILL_HEIGHT = 60;
  
  // Icon sizes
  const SMALL_ICON_SIZE = 30;
  const BIG_ICON_SIZE = 50;
  
  // Text settings
  const MARKER_LABEL_TEXT_SIZE = 11;
  const MARKER_LABEL_MAX_WIDTH_SMALL = 95;
  const MARKER_LABEL_MAX_WIDTH_BIG = 145;
  const ELLIPSIS_CHAR = '\u2026';

  // ==================== TEXT UTILITIES ====================
  
  let measureContext = null;
  
  function ensureMeasureContext() {
    if (measureContext) return measureContext;
    const canvas = document.createElement('canvas');
    measureContext = canvas.getContext('2d');
    return measureContext;
  }
  
  function measureFont() {
    return `${MARKER_LABEL_TEXT_SIZE}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
  }
  
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
  
  function getPrimaryVenueName(post) {
    if (!post) return '';
    
    const selectedVenueKey = window.selectedVenueKey || null;
    const toVenueCoordKey = window.toVenueCoordKey || null;
    
    if (selectedVenueKey && Array.isArray(post.locations) && post.locations.length && toVenueCoordKey) {
      const match = post.locations.find(loc => 
        loc && toVenueCoordKey(loc.lng, loc.lat) === selectedVenueKey && loc.venue
      );
      if (match && match.venue) return match.venue;
    }
    
    const loc = Array.isArray(post.locations) && post.locations.length ? post.locations[0] : null;
    if (loc && loc.venue) return loc.venue;
    if (post.venue) return post.venue;
    return post.city || '';
  }
  
  function getMarkerLabelLines(post, isActive = false) {
    const title = post && post.title ? post.title : '';
    const maxWidth = isActive ? MARKER_LABEL_MAX_WIDTH_BIG : MARKER_LABEL_MAX_WIDTH_SMALL;
    const titleLines = splitTextLines(title, maxWidth, 2);
    
    while (titleLines.length < 2) titleLines.push('');
    
    const venueName = getPrimaryVenueName(post);
    const venueLine = venueName ? shortenText(venueName, maxWidth) : '';
    
    return {
      line1: titleLines[0] || '',
      line2: titleLines[1] || '',
      venueLine
    };
  }

  // ==================== MARKER STORE ====================
  
  // Store all map card markers: Map<postId, { marker, element, state }>
  const mapCardMarkers = new Map();
  
  // ==================== MAP CARD CREATION ====================
  
  // Admin settings cache
  let adminSettingsLoaded = false;
  let adminSettingsPromise = null;
  
  /**
   * Load admin settings from server
   * @returns {Promise<Object>} Admin settings object
   */
  function loadAdminSettings() {
    if (adminSettingsPromise) return adminSettingsPromise;
    
    adminSettingsPromise = fetch('/gateway.php?action=get-admin-settings')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load admin settings');
        return response.json();
      })
      .then(data => {
        if (data.success && data.settings) {
          window.adminSettings = data.settings;
          adminSettingsLoaded = true;
          return data.settings;
        }
        throw new Error('Invalid admin settings response');
      })
      .catch(err => {
        console.warn('[MapCards] Failed to load admin settings:', err);
        window.adminSettings = {};
        adminSettingsLoaded = true;
        return {};
      });
    
    return adminSettingsPromise;
  }
  
  /**
   * Get pill image URL based on state
   * @param {string} state - 'small', 'hover', or 'big'
   * @returns {string} URL to pill image
   */
  function getPillUrl(state) {
    const settings = window.adminSettings || {};
    switch (state) {
      case 'big':
        return settings.big_map_card_pill || 'assets/system-images/225x60-pill-2f3b73.webp';
      case 'hover':
        return settings.hover_map_card_pill || settings.small_map_card_pill || 'assets/system-images/150x40-pill-70.webp';
      default:
        return settings.small_map_card_pill || 'assets/system-images/150x40-pill-2f3b73.webp';
    }
  }
  
  /**
   * Get icon URL for a post
   * @param {Object} post - Post object with sub property
   * @returns {string} URL to icon image
   */
  function getIconUrl(post) {
    const subcategoryMarkers = window.subcategoryMarkers || {};
    const iconId = post.sub || MULTI_POST_MARKER_ICON_ID;
    return subcategoryMarkers[iconId] || subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] || 'assets/system-images/multi-post-icon-30.webp';
  }
  
  /**
   * Create map card HTML
   * @param {Object} post - Post data
   * @param {string} state - 'small', 'hover', or 'big'
   * @returns {string} HTML string
   */
  function createMapCardHTML(post, state = 'small') {
    const isActive = state === 'big';
    const labels = getMarkerLabelLines(post, isActive);
    const iconUrl = getIconUrl(post);
    const iconSize = isActive ? BIG_ICON_SIZE : SMALL_ICON_SIZE;
    
    let labelHTML = '';
    if (isActive) {
      // Big card: show title (2 lines) + venue
      labelHTML = `
        <div class="map-card-title">${labels.line1}</div>
        ${labels.line2 ? `<div class="map-card-title">${labels.line2}</div>` : ''}
        ${labels.venueLine ? `<div class="map-card-venue">${labels.venueLine}</div>` : ''}
      `;
    } else {
      // Small card: show title only (2 lines)
      labelHTML = `
        <div class="map-card-title">${labels.line1}</div>
        ${labels.line2 ? `<div class="map-card-title">${labels.line2}</div>` : ''}
      `;
    }
    
    return `
      <div class="map-card map-card-${state}" data-id="${post.id}" data-state="${state}">
        <img class="map-card-icon" src="${iconUrl}" alt="" width="${iconSize}" height="${iconSize}">
        <div class="map-card-labels">
          ${labelHTML}
        </div>
      </div>
    `;
  }
  
  /**
   * Create a map card marker
   * @param {Object} map - Mapbox map instance
   * @param {Object} post - Post data with id, title, sub, locations, etc.
   * @param {Object} options - Options (lng, lat required)
   * @returns {Object} { marker, element, postId }
   */
  function createMapCardMarker(map, post, options = {}) {
    const { lng, lat } = options;
    
    if (!map || !post || !post.id || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      console.error('[MapCards] Invalid parameters for createMapCardMarker');
      return null;
    }
    
    // Remove existing marker for this post if any
    removeMapCardMarker(post.id);
    
    // Create container element
    const el = document.createElement('div');
    el.className = 'map-card-container';
    el.innerHTML = createMapCardHTML(post, 'small');
    
    // Create Mapbox Marker
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'left',
      offset: [15, 0]
    })
      .setLngLat([lng, lat])
      .addTo(map);
    
    // Store reference
    const entry = {
      marker,
      element: el,
      post,
      state: 'small',
      lng,
      lat
    };
    mapCardMarkers.set(post.id, entry);
    
    // Attach hover handlers
    el.addEventListener('mouseenter', () => {
      if (entry.state !== 'big') {
        setMapCardHover(post.id);
        // Trigger global hover update
        if (window.hoveredPostIds !== undefined) {
          window.hoveredPostIds = [{ id: String(post.id), venueKey: null }];
        }
        if (typeof window.updateSelectedMarkerRing === 'function') {
          window.updateSelectedMarkerRing();
        }
      }
    });
    
    el.addEventListener('mouseleave', () => {
      if (entry.state !== 'big') {
        removeMapCardHover(post.id);
        // Clear global hover
        if (window.hoveredPostIds !== undefined) {
          window.hoveredPostIds = [];
        }
        if (typeof window.updateSelectedMarkerRing === 'function') {
          window.updateSelectedMarkerRing();
        }
      }
    });
    
    // Attach click handler
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Set active state
      setMapCardActive(post.id);
      
      // Update global state
      if (window.activePostId !== undefined) {
        window.activePostId = post.id;
      }
      
      // Open the post
      if (typeof window.openPost === 'function') {
        window.openPost(post.id, false, true, null);
      } else if (window.callWhenDefined && typeof window.callWhenDefined === 'function') {
        window.callWhenDefined('openPost', (fn) => {
          fn(post.id, false, true, null);
        });
      }
    });
    
    return entry;
  }
  
  /**
   * Update map card state (small, hover, big)
   * @param {string|number} postId - Post ID
   * @param {string} newState - 'small', 'hover', or 'big'
   */
  function updateMapCardState(postId, newState) {
    const entry = mapCardMarkers.get(postId);
    if (!entry) return;
    
    if (entry.state === newState) return;
    
    entry.state = newState;
    entry.element.innerHTML = createMapCardHTML(entry.post, newState);
  }
  
  /**
   * Set map card to hover state
   * @param {string|number} postId - Post ID
   */
  function setMapCardHover(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state === 'big') return; // Don't change if already active
    updateMapCardState(postId, 'hover');
  }
  
  /**
   * Remove hover state (return to small)
   * @param {string|number} postId - Post ID
   */
  function removeMapCardHover(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state === 'big') return; // Don't change if active
    updateMapCardState(postId, 'small');
  }
  
  /**
   * Set map card to active (big) state
   * @param {string|number} postId - Post ID
   */
  function setMapCardActive(postId) {
    // First, deactivate all other cards
    mapCardMarkers.forEach((entry, id) => {
      if (id !== postId && entry.state === 'big') {
        updateMapCardState(id, 'small');
      }
    });
    // Then activate this one
    updateMapCardState(postId, 'big');
  }
  
  /**
   * Remove active state from a card
   * @param {string|number} postId - Post ID
   */
  function removeMapCardActive(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state !== 'big') return;
    updateMapCardState(postId, 'small');
  }
  
  /**
   * Remove a map card marker
   * @param {string|number} postId - Post ID
   */
  function removeMapCardMarker(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry) return;
    
    entry.marker.remove();
    mapCardMarkers.delete(postId);
  }
  
  /**
   * Remove all map card markers
   */
  function clearAllMapCardMarkers() {
    mapCardMarkers.forEach((entry) => {
      entry.marker.remove();
    });
    mapCardMarkers.clear();
  }
  
  /**
   * Get a map card marker entry
   * @param {string|number} postId - Post ID
   * @returns {Object|null} Marker entry or null
   */
  function getMapCardMarker(postId) {
    return mapCardMarkers.get(postId) || null;
  }
  
  /**
   * Get all map card markers
   * @returns {Map} Map of all markers
   */
  function getAllMapCardMarkers() {
    return mapCardMarkers;
  }

  // ==================== CSS INJECTION ====================
  
  /**
   * Inject map card CSS styles
   */
  function injectMapCardStyles() {
    if (document.getElementById('map-card-styles')) return;
    
    const smallPillUrl = getPillUrl('small');
    const hoverPillUrl = getPillUrl('hover');
    const bigPillUrl = getPillUrl('big');
    
    const css = `
      /* Map Card Container */
      .map-card-container {
        cursor: pointer;
      }
      
      /* Base Map Card */
      .map-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 8px;
        background-repeat: no-repeat;
        transition: all 0.15s ease;
      }
      
      /* Small State */
      .map-card-small {
        width: ${SMALL_PILL_WIDTH}px;
        height: ${SMALL_PILL_HEIGHT}px;
        background-image: url('${smallPillUrl}');
        background-size: ${SMALL_PILL_WIDTH}px ${SMALL_PILL_HEIGHT}px;
      }
      
      /* Hover State */
      .map-card-hover {
        width: ${SMALL_PILL_WIDTH}px;
        height: ${SMALL_PILL_HEIGHT}px;
        background-image: url('${hoverPillUrl}');
        background-size: ${SMALL_PILL_WIDTH}px ${SMALL_PILL_HEIGHT}px;
      }
      
      /* Big/Active State */
      .map-card-big {
        width: ${BIG_PILL_WIDTH}px;
        height: ${BIG_PILL_HEIGHT}px;
        background-image: url('${bigPillUrl}');
        background-size: ${BIG_PILL_WIDTH}px ${BIG_PILL_HEIGHT}px;
      }
      
      /* Icon */
      .map-card-icon {
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      /* Labels Container */
      .map-card-labels {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      /* Title Text */
      .map-card-title {
        color: #fff;
        font-family: "Open Sans", sans-serif;
        font-size: ${MARKER_LABEL_TEXT_SIZE}px;
        line-height: 1.3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* Venue Text (big cards only) */
      .map-card-venue {
        color: rgba(255,255,255,0.7);
        font-family: "Open Sans", sans-serif;
        font-size: ${MARKER_LABEL_TEXT_SIZE - 1}px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    
    const style = document.createElement('style');
    style.id = 'map-card-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  /**
   * Refresh CSS with updated pill URLs (after admin settings change)
   */
  function refreshMapCardStyles() {
    const existing = document.getElementById('map-card-styles');
    if (existing) existing.remove();
    injectMapCardStyles();
  }

  // ==================== EXPOSE API ====================
  
  window.MapCards = {
    // Marker management
    createMapCardMarker,
    removeMapCardMarker,
    clearAllMapCardMarkers,
    getMapCardMarker,
    getAllMapCardMarkers,
    
    // State management
    updateMapCardState,
    setMapCardHover,
    removeMapCardHover,
    setMapCardActive,
    removeMapCardActive,
    
    // Text utilities (for compatibility)
    shortenText,
    splitTextLines,
    getPrimaryVenueName,
    getMarkerLabelLines,
    
    // Styling
    injectMapCardStyles,
    refreshMapCardStyles,
    getPillUrl,
    getIconUrl,
    loadAdminSettings,
    
    // Constants
    MULTI_POST_MARKER_ICON_ID,
    SMALL_PILL_WIDTH,
    SMALL_PILL_HEIGHT,
    BIG_PILL_WIDTH,
    BIG_PILL_HEIGHT
  };
  
  // Load admin settings and inject styles when DOM is ready
  async function initMapCards() {
    await loadAdminSettings();
    injectMapCardStyles();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapCards);
  } else {
    initMapCards();
  }

  // ==================== COMPATIBILITY LAYER ====================
  // Provide old window.MapCardComposites interface for index.js until it's updated
  
  window.MapCardComposites = {
    // Text utilities (mapped to new functions)
    ensureMarkerLabelMeasureContext: ensureMeasureContext,
    markerLabelMeasureFont: measureFont,
    shortenMarkerLabelText: shortenText,
    splitTextAcrossLines: splitTextLines,
    getPrimaryVenueName: getPrimaryVenueName,
    getMarkerLabelLines: getMarkerLabelLines,
    buildMarkerLabelText: function(p) {
      const lines = getMarkerLabelLines(p);
      return lines.line2 ? `${lines.line1}\n${lines.line2}` : lines.line1;
    },
    
    // Constants
    MARKER_LABEL_BG_ID: 'small-map-card-pill',
    MARKER_LABEL_BG_ACCENT_ID: 'big-map-card-pill',
    VISIBLE_MARKER_LABEL_LAYERS: [],
    MULTI_POST_MARKER_ICON_ID: MULTI_POST_MARKER_ICON_ID,
    
    // Stub functions - old composite system replaced by Markers
    loadMarkerLabelImage: function() { return Promise.resolve(null); },
    convertImageDataToCanvas: function() { return null; },
    buildMarkerLabelPillSprite: function() { return null; },
    ensureMarkerLabelPillSprites: function() { return Promise.resolve(null); },
    generateMarkerImageFromId: function() { return null; },
    clearMarkerLabelPillSpriteCache: function() {
      // When pills change, refresh the CSS
      refreshMapCardStyles();
    },
    addPillSpritesToMap: function() {},
    updateMapCardLayerOpacity: function() {},
    createMapCardCompositeLayers: function() {},
    createMarkerIconLayer: function() {},
    orderMapLayers: function() {},
    clearMapCardComposites: function() {},
    createMapCardCompositesForFeatures: function() { return []; },
    getMarkerInteractiveLayers: function() { return []; }
  };

})();
