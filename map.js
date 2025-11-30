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
   * Get small icon URL (subcategory icon)
   * @param {Object} post - Post object with sub property
   * @returns {string} URL to icon image
   */
  function getSmallIconUrl(post) {
    const subcategoryMarkers = window.subcategoryMarkers || {};
    const adminSettings = window.adminSettings || {};
    
    // Multi-post markers use the multi-post icon
    if (post.isMultiPost) {
      return subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] || 
             adminSettings.multi_post_icon || 
             'assets/system-images/multi-post-icon-30.webp';
    }
    
    // Single post markers use subcategory icon
    const iconId = post.sub || MULTI_POST_MARKER_ICON_ID;
    return subcategoryMarkers[iconId] || 
           subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] || 
           adminSettings.multi_post_icon ||
           'assets/system-images/multi-post-icon-30.webp';
  }
  
  /**
   * Get big icon URL (thumbnail for single posts, multi-post icon for multi)
   * @param {Object} post - Post object with thumbnailUrl
   * @returns {string} URL to thumbnail or icon
   */
  function getBigIconUrl(post) {
    // Multi-post markers keep the multi-post icon
    if (post.isMultiPost) {
      return getSmallIconUrl(post);
    }
    // Single posts show thumbnail
    return post.thumbnailUrl || getSmallIconUrl(post);
  }
  
  /**
   * Get icon URL based on state
   * @param {Object} post - Post object
   * @param {string} state - 'small', 'hover', or 'big'
   * @returns {string} URL to icon/thumbnail
   */
  function getIconUrl(post, state = 'small') {
    return state === 'big' ? getBigIconUrl(post) : getSmallIconUrl(post);
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
    const iconUrl = getIconUrl(post, state);
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
    
    // Icon is at center (0,0 = lat/lng), pill extends to the right
    return `
      <img class="map-card-icon" src="${iconUrl}" alt="" width="${iconSize}" height="${iconSize}">
      <div class="map-card-pill map-card-${state}" data-id="${post.id}" data-state="${state}">
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
    
    // Create Mapbox Marker - icon centered at lat/lng, pill extends right
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
      offset: [0, 0]
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
        // Trigger global hover update - include ALL posts for multi-post cards
        if (window.hoveredPostIds !== undefined) {
          const allPostIds = [{ id: String(post.id), venueKey: null }];
          // Add all multiPostIds if this is a multi-post marker
          if (post.isMultiPost && Array.isArray(post.multiPostIds)) {
            post.multiPostIds.forEach(pid => {
              if (pid && String(pid) !== String(post.id)) {
                allPostIds.push({ id: String(pid), venueKey: null });
              }
            });
          }
          window.hoveredPostIds = allPostIds;
        }
        if (typeof window.syncPostCardHighlights === 'function') {
          window.syncPostCardHighlights();
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
        if (typeof window.syncPostCardHighlights === 'function') {
          window.syncPostCardHighlights();
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
    
    // Update pill element
    const pillEl = entry.element.querySelector('.map-card-pill');
    if (pillEl) {
      pillEl.classList.remove('map-card-small', 'map-card-hover', 'map-card-big');
      pillEl.classList.add(`map-card-${newState}`);
      pillEl.setAttribute('data-state', newState);
      
      // Update inline background-image to match new state
      const pillUrl = getPillUrl(newState);
      pillEl.style.backgroundImage = `url('${pillUrl}')`;
    }
    
    // Update icon (size and image - thumbnail for big, category icon for small)
    const iconEl = entry.element.querySelector('.map-card-icon');
    if (iconEl) {
      const iconSize = newState === 'big' ? BIG_ICON_SIZE : SMALL_ICON_SIZE;
      iconEl.width = iconSize;
      iconEl.height = iconSize;
      iconEl.src = getIconUrl(entry.post, newState);
    }
    
    // Update labels for big state
    const labelsEl = entry.element.querySelector('.map-card-labels');
    if (labelsEl) {
      const labels = getMarkerLabelLines(entry.post, newState === 'big');
      if (newState === 'big') {
        labelsEl.innerHTML = `
          <div class="map-card-title">${labels.line1}</div>
          ${labels.line2 ? `<div class="map-card-title">${labels.line2}</div>` : ''}
          ${labels.venueLine ? `<div class="map-card-venue">${labels.venueLine}</div>` : ''}
        `;
      } else {
        labelsEl.innerHTML = `
          <div class="map-card-title">${labels.line1}</div>
          ${labels.line2 ? `<div class="map-card-title">${labels.line2}</div>` : ''}
        `;
      }
    }
  }
  
  /**
   * Set map card to hover state
   * @param {string|number} postId - Post ID
   */
  function setMapCardHover(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state === 'big') return; // Don't change if already active
    entry.element.classList.add('is-hovered');
    updateMapCardState(postId, 'hover');
  }
  
  /**
   * Remove hover state (return to small)
   * @param {string|number} postId - Post ID
   */
  function removeMapCardHover(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state === 'big') return; // Don't change if active
    entry.element.classList.remove('is-hovered');
    updateMapCardState(postId, 'small');
  }
  
  /**
   * Set map card to active (big) state
   * @param {string|number} postId - Post ID
   */
  function setMapCardActive(postId) {
    // First, deactivate all other cards and clear all hover states
    mapCardMarkers.forEach((entry, id) => {
      entry.element.classList.remove('is-hovered');
      if (id !== postId && entry.state === 'big') {
        updateMapCardState(id, 'small');
        entry.element.classList.remove('is-active');
      } else if (entry.state === 'hover') {
        updateMapCardState(id, 'small');
      }
    });
    // Then activate this one
    const entry = mapCardMarkers.get(postId);
    if (entry) {
      updateMapCardState(postId, 'big');
      entry.element.classList.add('is-active');
      entry.element.classList.remove('is-hovered');
    }
  }
  
  /**
   * Remove active state from a card
   * @param {string|number} postId - Post ID
   */
  function removeMapCardActive(postId) {
    const entry = mapCardMarkers.get(postId);
    if (!entry || entry.state !== 'big') return;
    updateMapCardState(postId, 'small');
    entry.element.classList.remove('is-active');
  }
  
  /**
   * Clear all hover states from all map cards
   */
  function clearAllMapCardHoverStates() {
    mapCardMarkers.forEach((entry, id) => {
      if (entry.element.classList.contains('is-hovered') || entry.state === 'hover') {
        entry.element.classList.remove('is-hovered');
        if (entry.state === 'hover') {
          updateMapCardState(id, 'small');
        }
      }
    });
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
  
  /**
   * Find marker by any post ID (checks multiPostIds for multi-post markers)
   * @param {string|number} postId - Post ID to find
   * @returns {object|null} - { markerId, entry } or null if not found
   */
  function findMarkerByPostId(postId) {
    const targetId = String(postId);
    for (const [markerId, entry] of mapCardMarkers) {
      const post = entry.post;
      // Check primary ID
      if (String(markerId) === targetId) {
        return { markerId, entry };
      }
      // Check multiPostIds
      if (post && Array.isArray(post.multiPostIds)) {
        const found = post.multiPostIds.some(id => String(id) === targetId);
        if (found) {
          return { markerId, entry };
        }
      }
    }
    return null;
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
      /* Container = lat/lng point (0,0) - zero size anchor */
      .map-card-container {
        position: relative;
        width: 0;
        height: 0;
        cursor: pointer;
        z-index: 1;
      }
      .map-card-container:hover { z-index: 10; }
      .map-card-container.is-active { z-index: 100; }
      
      /* Icon - center at lat/lng (0,0) */
      .map-card-icon {
        position: absolute;
        left: -${SMALL_ICON_SIZE / 2}px;
        top: -${SMALL_ICON_SIZE / 2}px;
        border-radius: 50%;
        z-index: 2;
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
      
      /* Hover pill: same as small */
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
      body[data-map-card-display="hover_only"] .map-card-container:hover .map-card-pill,
      body[data-map-card-display="hover_only"] .map-card-container.is-active .map-card-pill,
      body[data-map-card-display="hover_only"] .map-card-container.is-hovered .map-card-pill {
        display: flex;
      }
      
      /* Text styling */
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

  // ==================== EXPOSE API ====================
  
  window.MapCards = {
    // Marker management
    createMapCardMarker,
    removeMapCardMarker,
    clearAllMapCardMarkers,
    getMapCardMarker,
    getAllMapCardMarkers,
    findMarkerByPostId,
    
    // State management
    updateMapCardState,
    setMapCardHover,
    removeMapCardHover,
    setMapCardActive,
    removeMapCardActive,
    clearAllMapCardHoverStates,
    
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
    loadMarkerLabelImage: loadMarkerLabelImageCompat,
    convertImageDataToCanvas: function() { return null; },
    buildMarkerLabelPillSprite: function() { return { image: null, options: {} }; },
    ensureMarkerLabelPillSprites: function() { return Promise.resolve({ base: {}, highlight: {}, hover: {} }); },
    generateMarkerImageFromId: function() { return null; },
    clearMarkerLabelPillSpriteCache: function() {
      // When pills change, reload admin settings and refresh CSS
      adminSettingsPromise = null; // Clear cache
      loadAdminSettings().then(() => {
        refreshMapCardStyles();
      });
    },
    addPillSpritesToMap: function() {
      // In Marker system, pills are CSS - just refresh styles
      refreshMapCardStyles();
    },
    updateMapCardLayerOpacity: function() {},
    createMapCardCompositeLayers: function() {},
    createMarkerIconLayer: function() {},
    orderMapLayers: function() {},
    clearMapCardComposites: function() {},
    createMapCardCompositesForFeatures: function() { return []; },
    getMarkerInteractiveLayers: function() { return []; }
  };
  
  // Compatibility helper - load image for admin preview
  function loadMarkerLabelImageCompat(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('Missing URL'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load ' + url));
      img.src = url;
    });
  }
  
  /**
   * Refresh all marker icons (after admin changes multi-post icon)
   */
  function refreshAllMarkerIcons() {
    mapCardMarkers.forEach((entry) => {
      const iconEl = entry.element.querySelector('.map-card-icon');
      if (iconEl) {
        iconEl.src = getIconUrl(entry.post, entry.state);
      }
    });
  }
  
  // Expose refresh function
  window.MapCards.refreshAllMarkerIcons = refreshAllMarkerIcons;

  // ==================== MARKER CLUSTERING ====================
  // Clusters group nearby markers at zoom levels below 8
  
  const CLUSTER_SOURCE_ID = 'post-clusters';
  const CLUSTER_LAYER_ID = 'post-clusters';
  const CLUSTER_MAX_ZOOM = 8; // Clusters show at zoom < 8, not at 8
  const CLUSTER_GRID_SIZE = 50; // Grid size for clustering (pixels)
  const CLUSTER_MIN_POINTS = 2; // Minimum points to form a cluster
  
  let clusterSource = null;
  let clusterLayer = null;
  let clusterIconImageId = 'cluster-icon';
  let clusterIconUrl = null;
  let lastClusterZoom = null;
  let lastClusterFilterKey = null;
  
  /**
   * Get filtered posts from index.js
   * @returns {Array} Array of filtered posts
   */
  function getFilteredPosts() {
    // Try to access filtered array from index.js
    if (typeof window.getFilteredPosts === 'function') {
      return window.getFilteredPosts();
    }
    // Fallback: try to access global filtered variable
    if (typeof window.filtered !== 'undefined' && Array.isArray(window.filtered)) {
      return window.filtered;
    }
    // Last resort: try to get from postsLoaded
    if (window.postsLoaded && typeof window.getAllPostsCache === 'function') {
      const cache = window.getAllPostsCache({ allowInitialize: true });
      return Array.isArray(cache) ? cache : [];
    }
    return [];
  }
  
  /**
   * Get cluster icon URL from admin settings
   * @returns {string} URL to cluster icon
   */
  function getClusterIconUrl() {
    const adminSettings = window.adminSettings || {};
    return adminSettings.marker_cluster_icon || 'assets/system-images/cluster-icon-50.webp';
  }
  
  /**
   * Load cluster icon image into map
   * @param {Object} map - Mapbox map instance
   * @returns {Promise} Resolves when image is loaded
   */
  function ensureClusterIconImage(map) {
    if (!map || typeof map.hasImage !== 'function') {
      return Promise.resolve();
    }
    
    if (map.hasImage(clusterIconImageId)) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const url = getClusterIconUrl();
      if (!url) {
        reject(new Error('No cluster icon URL'));
        return;
      }
      
      map.loadImage(url, (error, image) => {
        if (error) {
          console.warn('[MarkerClusters] Failed to load cluster icon:', error);
          reject(error);
          return;
        }
        if (image && typeof map.addImage === 'function') {
          map.addImage(clusterIconImageId, image);
          clusterIconUrl = url;
          resolve();
        } else {
          reject(new Error('Failed to add cluster icon image'));
        }
      });
    });
  }
  
  /**
   * Format cluster count for display
   * @param {number} count - Number of points in cluster
   * @returns {string} Formatted count
   */
  function formatClusterCount(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return String(count);
  }
  
  /**
   * Group posts into clusters based on zoom level
   * @param {Array} posts - Array of post objects with lng, lat
   * @param {number} zoom - Current zoom level
   * @returns {Array} Array of cluster objects { lng, lat, count, pointIds }
   */
  function groupPostsForClusterZoom(posts, zoom) {
    if (!Array.isArray(posts) || posts.length === 0) {
      return [];
    }
    
    // Calculate grid cell size based on zoom
    // At zoom 0, grid is very large; at zoom 7.9, grid is smaller
    const baseGridSize = CLUSTER_GRID_SIZE;
    const zoomFactor = Math.pow(2, 8 - zoom); // Larger factor at lower zoom
    const cellSize = baseGridSize * zoomFactor;
    
    // Group posts into grid cells
    const grid = new Map();
    
    posts.forEach((post, index) => {
      if (!post || !Number.isFinite(post.lng) || !Number.isFinite(post.lat)) {
        return;
      }
      
      // Calculate grid cell coordinates
      const cellX = Math.floor(post.lng / cellSize);
      const cellY = Math.floor(post.lat / cellSize);
      const cellKey = `${cellX},${cellY}`;
      
      if (!grid.has(cellKey)) {
        grid.set(cellKey, {
          lng: 0,
          lat: 0,
          count: 0,
          pointIds: []
        });
      }
      
      const cell = grid.get(cellKey);
      cell.lng += post.lng;
      cell.lat += post.lat;
      cell.count++;
      cell.pointIds.push(post.id || index);
    });
    
    // Convert grid cells to clusters
    const clusters = [];
    grid.forEach((cell, cellKey) => {
      if (cell.count >= CLUSTER_MIN_POINTS) {
        // Calculate centroid
        clusters.push({
          lng: cell.lng / cell.count,
          lat: cell.lat / cell.count,
          count: cell.count,
          pointIds: cell.pointIds
        });
      } else {
        // Single points - add as individual markers (not clustered)
        // We'll handle these separately if needed
      }
    });
    
    return clusters;
  }
  
  /**
   * Build GeoJSON feature collection for clusters
   * @param {number} zoom - Current zoom level
   * @returns {Object} GeoJSON feature collection
   */
  function buildClusterFeatureCollection(zoom) {
    const posts = getFilteredPosts();
    if (!Array.isArray(posts) || posts.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    const clusters = groupPostsForClusterZoom(posts, zoom);
    
    const features = clusters.map((cluster, index) => ({
      type: 'Feature',
      id: `cluster-${index}`,
      geometry: {
        type: 'Point',
        coordinates: [cluster.lng, cluster.lat]
      },
      properties: {
        cluster: true,
        count: cluster.count,
        pointIds: cluster.pointIds
      }
    }));
    
    return {
      type: 'FeatureCollection',
      features
    };
  }
  
  /**
   * Update cluster source for current zoom level
   * @param {Object} map - Mapbox map instance
   * @param {number} zoom - Current zoom level
   */
  function updateClusterSourceForZoom(map, zoom) {
    if (!map || !Number.isFinite(zoom)) {
      return;
    }
    
    // Only show clusters at zoom < 8
    if (zoom >= CLUSTER_MAX_ZOOM) {
      // Hide clusters
      if (clusterLayer && typeof map.getLayer === 'function' && map.getLayer(CLUSTER_LAYER_ID)) {
        map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', 'none');
      }
      return;
    }
    
    // Get filtered posts and create a key for caching
    const posts = getFilteredPosts();
    const filterKey = Array.isArray(posts) ? posts.length + '-' + (posts[0]?.id || '') : 'empty';
    const zoomKey = Math.floor(zoom * 10) / 10; // Round to 0.1 precision
    
    // Check if we need to update
    if (lastClusterZoom === zoomKey && lastClusterFilterKey === filterKey) {
      return; // No change needed
    }
    
    lastClusterZoom = zoomKey;
    lastClusterFilterKey = filterKey;
    
    // Build cluster data
    const data = buildClusterFeatureCollection(zoom);
    
    // Update or create source
    if (!clusterSource) {
      if (typeof map.getSource === 'function' && map.getSource(CLUSTER_SOURCE_ID)) {
        clusterSource = map.getSource(CLUSTER_SOURCE_ID);
      } else {
        map.addSource(CLUSTER_SOURCE_ID, {
          type: 'geojson',
          data: data
        });
        clusterSource = map.getSource(CLUSTER_SOURCE_ID);
      }
    } else {
      if (typeof clusterSource.setData === 'function') {
        clusterSource.setData(data);
      }
    }
    
    // Show clusters
    if (clusterLayer && typeof map.getLayer === 'function' && map.getLayer(CLUSTER_LAYER_ID)) {
      map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', 'visible');
    }
  }
  
  /**
   * Setup cluster layers and event handlers
   * @param {Object} map - Mapbox map instance
   */
  function setupClusterLayers(map) {
    if (!map || typeof map.addLayer !== 'function') {
      return;
    }
    
    // Ensure cluster icon is loaded
    ensureClusterIconImage(map).then(() => {
      // Create cluster layer if it doesn't exist
      if (!clusterLayer && typeof map.getLayer === 'function' && !map.getLayer(CLUSTER_LAYER_ID)) {
        map.addLayer({
          id: CLUSTER_LAYER_ID,
          type: 'symbol',
          source: CLUSTER_SOURCE_ID,
          layout: {
            'icon-image': clusterIconImageId,
            'icon-size': 1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'text-field': '{count}',
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 14,
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
        
        clusterLayer = CLUSTER_LAYER_ID;
        
        // Add click handler
        map.on('click', CLUSTER_LAYER_ID, handleClusterClick);
        map.on('mouseenter', CLUSTER_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', CLUSTER_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      }
      
      // Initial update
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 0;
      updateClusterSourceForZoom(map, currentZoom);
    }).catch(err => {
      console.warn('[MarkerClusters] Failed to setup cluster layers:', err);
    });
  }
  
  /**
   * Handle cluster click - zoom to level 8
   * @param {Object} e - Mapbox click event
   */
  function handleClusterClick(e) {
    if (!e || !e.lngLat) {
      return;
    }
    
    const mapInstance = typeof window.getMapInstance === 'function' 
      ? window.getMapInstance() 
      : (typeof window.map !== 'undefined' ? window.map : null);
    
    if (!mapInstance || typeof mapInstance.easeTo !== 'function') {
      return;
    }
    
    // Zoom to level 8 (where clusters disappear and individual markers show)
    mapInstance.easeTo({
      center: [e.lngLat.lng, e.lngLat.lat],
      zoom: CLUSTER_MAX_ZOOM,
      duration: 800,
      essential: true
    });
  }
  
  /**
   * Refresh cluster icon when admin settings change
   */
  function refreshClusterIcon() {
    const mapInstance = typeof window.getMapInstance === 'function' 
      ? window.getMapInstance() 
      : (typeof window.map !== 'undefined' ? window.map : null);
    
    if (!mapInstance) {
      return;
    }
    
    const newUrl = getClusterIconUrl();
    if (newUrl === clusterIconUrl) {
      return; // No change
    }
    
    // Remove old image
    if (typeof mapInstance.hasImage === 'function' && mapInstance.hasImage(clusterIconImageId)) {
      if (typeof mapInstance.removeImage === 'function') {
        mapInstance.removeImage(clusterIconImageId);
      }
    }
    
    // Load new image
    ensureClusterIconImage(mapInstance).then(() => {
      // Icon will be updated on next cluster update
      const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
      if (currentZoom < CLUSTER_MAX_ZOOM) {
        lastClusterZoom = null; // Force update
        updateClusterSourceForZoom(mapInstance, currentZoom);
      }
    }).catch(err => {
      console.warn('[MarkerClusters] Failed to refresh cluster icon:', err);
    });
  }
  
  /**
   * Initialize marker clusters
   * @param {Object} map - Mapbox map instance
   */
  function initMarkerClusters(map) {
    if (!map) {
      return;
    }
    
    // Wait for map to be ready
    if (map.loaded()) {
      setupClusterLayers(map);
    } else {
      map.once('load', () => {
        setupClusterLayers(map);
      });
    }
    
    // Update clusters on zoom
    map.on('zoom', () => {
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 0;
      updateClusterSourceForZoom(map, zoom);
    });
    
    // Update clusters when filters change (listen for custom event or poll)
    // We'll update on zoom events which should catch filter changes
    // Alternatively, we can expose a refresh function
  }
  
  /**
   * Refresh clusters (call when filters change)
   */
  function refreshClusters() {
    const mapInstance = typeof window.getMapInstance === 'function' 
      ? window.getMapInstance() 
      : (typeof window.map !== 'undefined' ? window.map : null);
    
    if (!mapInstance) {
      return;
    }
    
    lastClusterZoom = null; // Force update
    lastClusterFilterKey = null;
    const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
    updateClusterSourceForZoom(mapInstance, currentZoom);
  }
  
  // ==================== EXPOSE CLUSTER API ====================
  
  window.MarkerClusters = {
    init: initMarkerClusters,
    refresh: refreshClusters,
    refreshClusterIcon: refreshClusterIcon,
    updateClusterSourceForZoom: updateClusterSourceForZoom
  };

})();
