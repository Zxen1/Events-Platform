// map.js - All map-related functionality extracted from index.js
// This file contains all map initialization, utilities, markers, and event handlers

(function() {
  'use strict';

  // ============================================================================
  // MAP INSTANCE & STATE
  // ============================================================================
  let map = null;
  
  // Map state variables (will be initialized or accessed from window)
  let markersLoaded = false;
  let postSourceEventsBound = false;
  let addingPostSource = false;
  let pendingAddPostSource = false;
  let touchMarker = null;
  let hoveredPostIds = [];
  let lastKnownZoom = 1.5;
  
  // Access external dependencies via window (set by index.js)
  const getDependency = (name, defaultValue) => {
    return (typeof window !== 'undefined' && window[name] !== undefined) ? window[name] : defaultValue;
  };
  
  // Helper to access external functions/variables
  const getPosts = () => getDependency('posts', []);
  const getFiltered = () => getDependency('filtered', []);
  const getFiltersInitialized = () => getDependency('filtersInitialized', false);
  const getActivePostId = () => getDependency('activePostId', null);
  const getLastHighlightedPostIds = () => getDependency('lastHighlightedPostIds', []);
  const getHighlightedFeatureKeys = () => getDependency('highlightedFeatureKeys', []);
  const getMarkerFeatureIndex = () => getDependency('markerFeatureIndex', new Map());
  const getSelectedVenueKey = () => getDependency('selectedVenueKey', null);
  const getSpinning = () => getDependency('spinning', false);
  const getMAPBOX_TOKEN = () => getDependency('MAPBOX_TOKEN', '');
  const getToVenueCoordKey = () => getDependency('toVenueCoordKey', (lng, lat) => `${lng},${lat}`);
  const getSlugify = () => getDependency('slugify', (str) => String(str || '').toLowerCase().replace(/\s+/g, '-'));
  const getThumbUrl = () => getDependency('thumbUrl', () => null);
  const getOpenPost = () => getDependency('openPost', () => {});
  const getStopSpin = () => getDependency('stopSpin', () => {});
  const getScheduleCheckLoadPosts = () => getDependency('scheduleCheckLoadPosts', () => {});
  const getUpdateLayerVisibility = () => getDependency('updateLayerVisibility', () => {});
  const getGetZoomFromEvent = () => getDependency('getZoomFromEvent', () => NaN);
  const getUpdateZoomState = () => getDependency('updateZoomState', () => {});
  const getRefreshMarkers = () => getDependency('refreshMarkers', () => {});
  const getUpdateFilterCounts = () => getDependency('updateFilterCounts', () => {});
  const getUpdatePostPanel = () => getDependency('updatePostPanel', () => {});
  const getApplyFilters = () => getDependency('applyFilters', () => {});
  const getHaltSpin = () => getDependency('haltSpin', () => {});
  const getAddControls = () => getDependency('addControls', () => {});
  const getUpdateSelectedMarkerRing = () => getDependency('updateSelectedMarkerRing', () => {});
  const getGetMarkerInteractiveLayers = () => getDependency('getMarkerInteractiveLayers', () => []);
  const getGetMarkerCollections = () => getDependency('getMarkerCollections', () => ({ postsData: { type: 'FeatureCollection', features: [] }, signature: '', featureIndex: new Map() }));
  const getGetAllPostsCache = () => getDependency('getAllPostsCache', () => []);
  const getEMPTY_FEATURE_COLLECTION = () => getDependency('EMPTY_FEATURE_COLLECTION', { type: 'FeatureCollection', features: [] });
  const getMULTI_POST_MARKER_ICON_ID = () => getDependency('MULTI_POST_MARKER_ICON_ID', 'multi-post-icon');
  const getMARKER_SPRITE_ZOOM = () => getDependency('MARKER_SPRITE_ZOOM', 12);
  const getMARKER_PRELOAD_ZOOM = () => getDependency('MARKER_PRELOAD_ZOOM', 7.8);
  const getMARKER_PRELOAD_OFFSET = () => getDependency('MARKER_PRELOAD_OFFSET', 0.2);
  const getZOOM_VISIBILITY_PRECISION = () => getDependency('ZOOM_VISIBILITY_PRECISION', 1000);
  const getMID_ZOOM_MARKER_CLASS = () => getDependency('MID_ZOOM_MARKER_CLASS', 'mid-zoom-marker');
  const getSPRITE_MARKER_CLASS = () => getDependency('SPRITE_MARKER_CLASS', 'sprite-marker');
// ============================================================================
// MAP MARKERS & MAP CARDS SYSTEM
// ============================================================================
// All code related to map markers (icons), marker clustering (balloons), and map cards (pills) is organized here.
// Note: Markers are icons centered over lat/lng coordinates. Pills are map card backgrounds.
// Balloons are clustering icons used at low zoom levels.
// Sections:
// 1. Constants & Configuration (lines ~1005-1202)
// 2. Text Measurement & Formatting Helpers (lines ~1022-1183)
// 3. Map Card System (lines ~1387-1547) - Map card background images (pills)
// 5. Marker Clustering (Balloons) (lines ~2546-2912) - Balloon icons that cluster nearby markers
// 6. Small Map Card DOM Functions (lines ~3219-3447)
// 7. Marker Data Building & Collections (lines ~3448-6663)
// 8. Map Source Integration (lines ~19001+)
// ============================================================================

  const markerIconSize = 1;
  const markerIconBaseSizePx = 30;
  const basePillWidthPx = 150;
  const basePillHeightPx = 40;
  let accentPillWidthPx = null;
  let accentPillHeightPx = null;
  const markerLabelTextGapPx = 5;
  const markerLabelMarkerInsetPx = 5;
  const markerLabelTextRightPaddingPx = 5;
  const markerLabelTextPaddingPx = 10; // Fixed padding for labels (no icon reference)
  const markerLabelTextAreaWidthPx = Math.max(0, basePillWidthPx - markerLabelTextPaddingPx - markerLabelTextRightPaddingPx);
  const markerLabelTextAreaWidthPxSmall = 100; // For small map cards (non-multi-post venue)
  const markerLabelTextSize = 12;
  const markerLabelTextLineHeight = 1.2;
  const markerLabelPillLeftOffsetPx = -20; // Left edge of pill is 20px left of lat/lng
  const markerLabelTextLeftOffsetPx = 20; // Left edge of label is 20px right of lat/lng
  const markerLabelEllipsisChar = '\u2026';
  const mapCardTitleWidthPx = 165;
  let markerLabelMeasureContext = null;

  // --- Section 2: Text Measurement & Formatting Helpers ---
  function ensureMarkerLabelMeasureContext(){
    if(markerLabelMeasureContext){
      return markerLabelMeasureContext;
    }
    const canvas = document.createElement('canvas');
    markerLabelMeasureContext = canvas.getContext('2d');
    return markerLabelMeasureContext;
  }

  function markerLabelMeasureFont(){
    return `${markerLabelTextSize}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
  }

  function shortenMarkerLabelText(text, widthPx = markerLabelTextAreaWidthPx){
    const raw = (text ?? '').toString().trim();
    if(!raw){
      return '';
    }
    const ctx = ensureMarkerLabelMeasureContext();
    if(!ctx){
      return raw;
    }
    ctx.font = markerLabelMeasureFont();
    const maxWidth = widthPx;
    if(maxWidth <= 0){
      return raw;
    }
    if(ctx.measureText(raw).width <= maxWidth){
      return raw;
    }
    const ellipsis = markerLabelEllipsisChar;
    let low = 0;
    let high = raw.length;
    let best = ellipsis;
    while(low <= high){
      const mid = Math.floor((low + high) / 2);
      if(mid <= 0){
        high = mid - 1;
        continue;
      }
      const candidate = raw.slice(0, mid).trimEnd() + ellipsis;
      if(ctx.measureText(candidate).width <= maxWidth){
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  function splitTextAcrossLines(text, widthPx, maxLines){
    const normalized = (text ?? '').toString().replace(/\s+/g, ' ').trim();
    if(!normalized){
      return [];
    }
    if(!Number.isFinite(widthPx) || widthPx <= 0 || maxLines <= 0){
      return [normalized];
    }
    const ctx = ensureMarkerLabelMeasureContext();
    if(!ctx){
      return [normalized];
    }
    ctx.font = markerLabelMeasureFont();
    if(ctx.measureText(normalized).width <= widthPx){
      return [normalized];
    }
    const lines = [];
    let remaining = normalized;
    const ellipsis = markerLabelEllipsisChar;
    
    // First line: don't break words
    if(lines.length < maxLines && remaining){
      const words = remaining.split(/\s+/);
      let firstLine = '';
      let firstLineWords = [];
      
      for(let i = 0; i < words.length; i++){
        const testLine = firstLineWords.length > 0 
          ? firstLineWords.join(' ') + ' ' + words[i]
          : words[i];
        if(ctx.measureText(testLine).width <= widthPx){
          firstLineWords.push(words[i]);
          firstLine = testLine;
        } else {
          break;
        }
      }
      
      if(firstLineWords.length > 0){
        lines.push(firstLine);
        remaining = words.slice(firstLineWords.length).join(' ');
      } else {
        // If even the first word is too long, put it on second line
        remaining = remaining;
      }
    }
    
    // Second line: can break words, add ellipses if incomplete
    if(lines.length < maxLines && remaining){
      if(ctx.measureText(remaining).width <= widthPx){
        lines.push(remaining);
      } else {
        // Need to truncate with ellipses
        let low = 0;
        let high = remaining.length;
        let best = ellipsis;
        while(low <= high){
          const mid = Math.floor((low + high) / 2);
          if(mid <= 0){
            high = mid - 1;
            continue;
          }
          const candidate = remaining.slice(0, mid) + ellipsis;
          if(ctx.measureText(candidate).width <= widthPx){
            best = candidate;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        lines.push(best);
      }
    }
    
    return lines;
  }

  function getPrimaryVenueName(p){
    if(!p) return '';
    const selectedVenueKey = getSelectedVenueKey();
    const toVenueCoordKey = getToVenueCoordKey();
    const activeKey = typeof selectedVenueKey === 'string' && selectedVenueKey ? selectedVenueKey : null;
    if(activeKey && Array.isArray(p.locations) && p.locations.length){
      const match = p.locations.find(loc => loc && toVenueCoordKey(loc.lng, loc.lat) === activeKey && loc.venue);
      if(match && match.venue){
        return match.venue;
      }
    }
    const loc = Array.isArray(p.locations) && p.locations.length ? p.locations[0] : null;
    if(loc && loc.venue){
      return loc.venue;
    }
    if(p.venue){
      return p.venue;
    }
    return p.city || '';
  }

  function getMarkerLabelLines(p){
    const title = p && p.title ? p.title : '';
    // Use 100px width for small map cards (non-multi-post venue cards only)
    const isMultiPost = Boolean(p && (p.isMultiPost || (p.multiCount && Number(p.multiCount) > 1) || (Array.isArray(p.multiPostIds) && p.multiPostIds.length > 1)));
    const widthForLines = isMultiPost ? markerLabelTextAreaWidthPx : markerLabelTextAreaWidthPxSmall;
    const markerTitleLines = splitTextAcrossLines(title, widthForLines, 2);
    while(markerTitleLines.length < 2){ markerTitleLines.push(''); }
    const cardTitleLines = splitTextAcrossLines(title, mapCardTitleWidthPx, 2);
    while(cardTitleLines.length < 2){ cardTitleLines.push(''); }
    const venueRaw = getPrimaryVenueName(p);
    return {
      line1: markerTitleLines[0] || '',
      line2: markerTitleLines[1] || '',
      cardTitleLines,
      venueLine: venueRaw ? shortenMarkerLabelText(venueRaw, mapCardTitleWidthPx) : ''
    };
  }

  function buildMarkerLabelText(p, overrideLines){
    const lines = overrideLines || getMarkerLabelLines(p);
    if(lines.line2){
      return `${lines.line1}\n${lines.line2}`;
    }
    return lines.line1;
  }
  let markerLabelPillImagePromise = null;

  function nowTimestamp(){
    try{
      if(typeof performance !== 'undefined' && typeof performance.now === 'function'){
        return performance.now();
      }
    }catch(err){}
    return Date.now();
  }


  async function ensureMapboxCssFor(container) {
    const ver = (window.MAPBOX_VERSION || "v3.15.0").replace(/^v/,'v');
    const cssHref = `https://api.mapbox.com/mapbox-gl-js/${ver}/mapbox-gl.css`;

    const doc = (container && container.ownerDocument) || document;
    const root = container && container.getRootNode && container.getRootNode();

    // For Shadow DOM maps, inject right into the shadow root
    if (root && root.host && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
      if (!root.querySelector('style[data-mapbox-gl]')) {
        const s = document.createElement('style');
        s.setAttribute('data-mapbox-gl','');
        s.textContent = `@import url('${cssHref}');`;
        root.prepend(s);
      }
      return;
    }

    // Normal document (or iframe document)
    let link = doc.getElementById('mapbox-gl-css');
    if (!link) {
      link = doc.createElement('link');
      link.id = 'mapbox-gl-css';
      link.rel = 'stylesheet';
      link.href = cssHref;
      doc.head.appendChild(link);
    }
    if (link.sheet) return;
    await new Promise(res => link.addEventListener('load', res, { once: true }));
  }

  (async () => {
    try {
      await ensureMapboxCssFor(document.body);
    } catch(e){}
  })();

  (function(){
    const q = [];
    let scheduled = false;
    function flush(){
      scheduled = false;
      const budget = 6;
      let start = performance.now();
      while(q.length){
        const fn = q.shift();
        try{ fn && fn(); }catch(err){ console.error(err); }
        if(performance.now() - start > budget){
          if(typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(flush);
          } else {
            setTimeout(flush, 16);
          }
          return;
        }
      }
    }
    window.deferToAnimationFrame = function(cb){
      q.push(cb);
      if(!scheduled){
        scheduled = true;
        if(typeof requestAnimationFrame === 'function'){
          requestAnimationFrame(flush);
        } else {
          setTimeout(flush, 16);
        }
      }
    };
  })();

  // Helper: do nothing until style is truly loaded
  function whenStyleReady(map, fn){
    if (map.isStyleLoaded && map.isStyleLoaded()) { fn(); return; }
    const onLoad = () => { map.off('load', onLoad); fn(); };
    map.on('load', onLoad);
  }

  function applyNightSky(mapInstance){
    if(!mapInstance) return;
    if(typeof mapInstance.setFog === 'function'){
      try {
        mapInstance.setFog({
          color: 'rgba(11,13,23,0.6)',
          'high-color': 'rgba(27,32,53,0.7)',
          'horizon-blend': 0.15,
          'space-color': '#010409',
          'star-intensity': 0.6
        });
      } catch(err){}
    }
    if(typeof mapInstance.getLayer !== 'function'){
      return;
    }
    let skyLayerId = null;
    const skyPaint = {
      'sky-type': 'gradient',
      'sky-gradient-center': [0, 0],
      'sky-gradient-radius': 80,
      'sky-gradient': [
        'interpolate',
        ['linear'],
        ['sky-radial-progress'],
        0.0, 'rgba(6,10,20,1)',
        0.6, '#0b1d51',
        1.0, '#1a2a6c'
      ],
      'sky-opacity': 1
    };
    try {
      if(mapInstance.getLayer('sky')){
        skyLayerId = 'sky';
      } else if(mapInstance.getLayer('night-sky')){
        skyLayerId = 'night-sky';
      } else if(typeof mapInstance.addLayer === 'function'){
        mapInstance.addLayer({
          id:'night-sky',
          type:'sky',
          paint: skyPaint
        });
        skyLayerId = 'night-sky';
      }
    } catch(err){
      if(!skyLayerId && typeof mapInstance.getLayer === 'function' && mapInstance.getLayer('sky')){
        skyLayerId = 'sky';
      }
    }
    if(!skyLayerId || typeof mapInstance.setPaintProperty !== 'function'){
      return;
    }
    Object.entries(skyPaint).forEach(([prop, value]) => {
      try { mapInstance.setPaintProperty(skyLayerId, prop, value); } catch(err){}
    });
  }

  function createTransparentPlaceholder(width, height){
    const canvas = document.createElement('canvas');
    const w = Math.max(1, Number.isFinite(width) ? width : (width || 2));
    const h = Math.max(1, Number.isFinite(height) ? height : (Number.isFinite(width) ? width : (width || 2)));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if(ctx){
      ctx.clearRect(0, 0, w, h);
    }
    return canvas;
  }

  function ensurePlaceholderSprites(mapInstance){
    if(!mapInstance || typeof mapInstance.addImage !== 'function') return;
    const required = ['mx-federal-5','background','background-stroke','icon','icon-stroke'];
    const install = () => {
      required.forEach(name => {
        try{
          if(mapInstance.hasImage?.(name)) return;
          const size = name === 'mx-federal-5' ? 2 : 4;
          const options = { pixelRatio: 1 };
          if(name !== 'mx-federal-5'){
            options.sdf = true;
          }
          mapInstance.addImage(name, createTransparentPlaceholder(size), options);
        }catch(err){}
      });
    };
    if(typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()){
      if(!mapInstance.__placeholderSpriteReady){
        const onStyleLoad = () => {
          try{ install(); }catch(err){}
          try{ mapInstance.off?.('style.load', onStyleLoad); }catch(err){}
          mapInstance.__placeholderSpriteReady = null;
        };
        mapInstance.__placeholderSpriteReady = onStyleLoad;
        try{ mapInstance.on('style.load', onStyleLoad); }catch(err){}
      }
      return;
    }
    install();
  }

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// ============================================================================
// MAP MARKERS & MAP CARDS SYSTEM
// ============================================================================
// All code related to map markers (icons), marker clustering (balloons), and map cards (pills) is organized here.
// Note: Markers are icons centered over lat/lng coordinates. Pills are map card backgrounds.
// Balloons are clustering icons used at low zoom levels.
// Sections:
// 1. Constants & Configuration (lines ~1005-1202)
// 2. Text Measurement & Formatting Helpers (lines ~1022-1183)
// 3. Map Card System (lines ~1387-1547) - Map card background images (pills)
// 5. Marker Clustering (Balloons) (lines ~2546-2912) - Balloon icons that cluster nearby markers
// 6. Small Map Card DOM Functions (lines ~3219-3447)
// 7. Marker Data Building & Collections (lines ~3448-6663)
// 8. Map Source Integration (lines ~19001+)
// ============================================================================
// Note: markerLabelMeasureContext is already declared above (line 98) - no duplicate needed

  // --- Section 2: Text Measurement & Formatting Helpers ---
  function ensureMarkerLabelMeasureContext(){
    if(markerLabelMeasureContext){
      return markerLabelMeasureContext;
    }
    const canvas = document.createElement('canvas');
    markerLabelMeasureContext = canvas.getContext('2d');
    return markerLabelMeasureContext;
  }

  function markerLabelMeasureFont(){
    return `${markerLabelTextSize}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
  }

  function shortenMarkerLabelText(text, widthPx = markerLabelTextAreaWidthPx){
    const raw = (text ?? '').toString().trim();
    if(!raw){
      return '';
    }
    const ctx = ensureMarkerLabelMeasureContext();
    if(!ctx){
      return raw;
    }
    ctx.font = markerLabelMeasureFont();
    const maxWidth = widthPx;
    if(maxWidth <= 0){
      return raw;
    }
    if(ctx.measureText(raw).width <= maxWidth){
      return raw;
    }
    const ellipsis = markerLabelEllipsisChar;
    let low = 0;
    let high = raw.length;
    let best = ellipsis;
    while(low <= high){
      const mid = Math.floor((low + high) / 2);
      if(mid <= 0){
        high = mid - 1;
        continue;
      }
      const candidate = raw.slice(0, mid).trimEnd() + ellipsis;
      if(ctx.measureText(candidate).width <= maxWidth){
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  function splitTextAcrossLines(text, widthPx, maxLines){
    const normalized = (text ?? '').toString().replace(/\s+/g, ' ').trim();
    if(!normalized){
      return [];
    }
    if(!Number.isFinite(widthPx) || widthPx <= 0 || maxLines <= 0){
      return [normalized];
    }
    const ctx = ensureMarkerLabelMeasureContext();
    if(!ctx){
      return [normalized];
    }
    ctx.font = markerLabelMeasureFont();
    if(ctx.measureText(normalized).width <= widthPx){
      return [normalized];
    }
    const lines = [];
    let remaining = normalized;
    const ellipsis = markerLabelEllipsisChar;
    
    // First line: don't break words
    if(lines.length < maxLines && remaining){
      const words = remaining.split(/\s+/);
      let firstLine = '';
      let firstLineWords = [];
      
      for(let i = 0; i < words.length; i++){
        const testLine = firstLineWords.length > 0 
          ? firstLineWords.join(' ') + ' ' + words[i]
          : words[i];
        if(ctx.measureText(testLine).width <= widthPx){
          firstLineWords.push(words[i]);
          firstLine = testLine;
        } else {
          break;
        }
      }
      
      if(firstLineWords.length > 0){
        lines.push(firstLine);
        remaining = words.slice(firstLineWords.length).join(' ');
      } else {
        // If even the first word is too long, put it on second line
        remaining = remaining;
      }
    }
    
    // Second line: can break words, add ellipses if incomplete
    if(lines.length < maxLines && remaining){
      if(ctx.measureText(remaining).width <= widthPx){
        lines.push(remaining);
      } else {
        // Need to truncate with ellipses
        let low = 0;
        let high = remaining.length;
        let best = ellipsis;
        while(low <= high){
          const mid = Math.floor((low + high) / 2);
          if(mid <= 0){
            high = mid - 1;
            continue;
          }
          const candidate = remaining.slice(0, mid) + ellipsis;
          if(ctx.measureText(candidate).width <= widthPx){
            best = candidate;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        lines.push(best);
      }
    }
    
    return lines;
  }

  function getPrimaryVenueName(p){
    if(!p) return '';
    const selectedVenueKey = getSelectedVenueKey();
    const toVenueCoordKey = getToVenueCoordKey();
    const activeKey = typeof selectedVenueKey === 'string' && selectedVenueKey ? selectedVenueKey : null;
    if(activeKey && Array.isArray(p.locations) && p.locations.length){
      const match = p.locations.find(loc => loc && toVenueCoordKey(loc.lng, loc.lat) === activeKey && loc.venue);
      if(match && match.venue){
        return match.venue;
      }
    }
    const loc = Array.isArray(p.locations) && p.locations.length ? p.locations[0] : null;
    if(loc && loc.venue){
      return loc.venue;
    }
    if(p.venue){
      return p.venue;
    }
    return p.city || '';
  }

  function getMarkerLabelLines(p){
    const title = p && p.title ? p.title : '';
    // Use 100px width for small map cards (non-multi-post venue cards only)
    const isMultiPost = Boolean(p && (p.isMultiPost || (p.multiCount && Number(p.multiCount) > 1) || (Array.isArray(p.multiPostIds) && p.multiPostIds.length > 1)));
    const widthForLines = isMultiPost ? markerLabelTextAreaWidthPx : markerLabelTextAreaWidthPxSmall;
    const markerTitleLines = splitTextAcrossLines(title, widthForLines, 2);
    while(markerTitleLines.length < 2){ markerTitleLines.push(''); }
    const cardTitleLines = splitTextAcrossLines(title, mapCardTitleWidthPx, 2);
    while(cardTitleLines.length < 2){ cardTitleLines.push(''); }
    const venueRaw = getPrimaryVenueName(p);
    return {
      line1: markerTitleLines[0] || '',
      line2: markerTitleLines[1] || '',
      cardTitleLines,
      venueLine: venueRaw ? shortenMarkerLabelText(venueRaw, mapCardTitleWidthPx) : ''
    };
  }

  function buildMarkerLabelText(p, overrideLines){
    const lines = overrideLines || getMarkerLabelLines(p);
    if(lines.line2){
      return `${lines.line1}\n${lines.line2}`;
    }
    return lines.line1;
  }

  function nowTimestamp(){
    try{
      if(typeof performance !== 'undefined' && typeof performance.now === 'function'){
        return performance.now();
      }
    }catch(err){}
    return Date.now();
  }


  // --- Section 3: Map Card System ---
  function loadMarkerLabelImage(url){
    return new Promise((resolve, reject) => {
      if(!url){
        reject(new Error('Missing URL'));
        return;
      }
      const img = new Image();
      try{ img.crossOrigin = 'anonymous'; }catch(err){}
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
      if(img.complete){
        setTimeout(() => {
          if(img.naturalWidth > 0 && img.naturalHeight > 0){
            resolve(img);
          }
        }, 0);
      }
    });
  }

  // MAP CARD BACKGROUND SYSTEM: Provides pill images (map card backgrounds)
  // Uses these images directly via ensureMarkerLabelPillSprites()
  async function ensureMarkerLabelPillImage(){
    // If we have a cached promise, try to use it, but clear cache if it was rejected
    if(markerLabelPillImagePromise){
      try {
        // Try to await the cached promise - if it's already resolved, this will return immediately
        // If it was rejected, this will throw and we'll clear the cache
        await Promise.resolve(markerLabelPillImagePromise);
      return markerLabelPillImagePromise;
      } catch(err) {
        // Cached promise was rejected - clear it and try again
        markerLabelPillImagePromise = null;
    }
    }
    
    // Load from admin settings - no hardcoded defaults
    let baseUrl = null;
    let accentUrl = null;
    let hoverUrl = null;
    
    try {
      const response = await fetch('/gateway.php?action=get-admin-settings');
      if(response.ok){
        const data = await response.json();
        if(data.success && data.settings){
          if(data.settings.small_map_card_pill){
            baseUrl = data.settings.small_map_card_pill;
          }
          if(data.settings.big_map_card_pill){
            accentUrl = data.settings.big_map_card_pill;
          }
          if(data.settings.hover_map_card_pill){
            hoverUrl = data.settings.hover_map_card_pill;
          }
        }
      }
    } catch(err) {
      console.error('Failed to load pill image settings:', err);
    }
    
    if(!baseUrl || !accentUrl){
      const error = new Error('Pill image URLs not found in database settings');
      // Don't cache rejected promises - allow retry on next call
      return Promise.reject(error);
    }
    
    // Load base and accent images (required)
    const loadPromises = [
      loadMarkerLabelImage(baseUrl),
      loadMarkerLabelImage(accentUrl)
    ];
    
    // Load hover image if available (optional)
    if(hoverUrl){
      loadPromises.push(loadMarkerLabelImage(hoverUrl));
    }
    
    const promise = Promise.all(loadPromises).then((images) => {
      const result = { 
        base: images[0], 
        highlight: images[1] 
      };
      // Use hover image if available, otherwise fall back to accent
      if(images[2]){
        result.hover = images[2];
      } else {
        result.hover = images[1]; // Fall back to accent
      }
      return result;
    }).catch((err) => {
      // Clear cache on error to allow retry
      markerLabelPillImagePromise = null;
      throw err;
    });
    
    // Cache the promise (will be cleared if it rejects)
    markerLabelPillImagePromise = promise;
    return markerLabelPillImagePromise;
  }

  function computeMarkerLabelCanvasDimensions(sourceImage, isAccent = false){
    if(isAccent){
      const width = accentPillWidthPx !== null ? accentPillWidthPx : (sourceImage && (sourceImage.naturalWidth || sourceImage.width) ? (sourceImage.naturalWidth || sourceImage.width) : basePillWidthPx);
      const height = accentPillHeightPx !== null ? accentPillHeightPx : (sourceImage && (sourceImage.naturalHeight || sourceImage.height) ? (sourceImage.naturalHeight || sourceImage.height) : basePillHeightPx);
      const canvasWidth = Math.max(1, Math.round(Number.isFinite(width) && width > 0 ? width : basePillWidthPx));
      const canvasHeight = Math.max(1, Math.round(Number.isFinite(height) && height > 0 ? height : basePillHeightPx));
      const pixelRatio = 1;
      return { canvasWidth, canvasHeight, pixelRatio };
    }
    const canvasWidth = basePillWidthPx;
    const canvasHeight = basePillHeightPx;
    const pixelRatio = 1;
    return { canvasWidth, canvasHeight, pixelRatio };
  }


  // Shared function to convert ImageData to Canvas (Mapbox requires Image/Canvas, not ImageData)
  function convertImageDataToCanvas(imageData){
    if(!imageData) return null;
    if(!(imageData instanceof ImageData)){
      return imageData; // Already a Canvas or Image
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if(ctx){
        ctx.putImageData(imageData, 0, 0);
      }
      return canvas;
    } catch(e){
      console.error('Error converting ImageData to Canvas:', e);
      return null;
    }
  }

  function buildMarkerLabelPillSprite(sourceImage, tintColor, tintAlpha = 1, isAccent = false){
    if(!sourceImage){
      return null;
    }
    const { canvasWidth, canvasHeight, pixelRatio } = computeMarkerLabelCanvasDimensions(sourceImage, isAccent);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if(!ctx){
      return null;
    }
    try{
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      // Draw image at full size (no devicePixelRatio scaling to avoid size mismatch)
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImage, 0, 0, canvasWidth, canvasHeight);
    }catch(err){
      console.error(err);
      return null;
    }
    if(tintColor){
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = tintAlpha;
      ctx.fillStyle = tintColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    let imageData = null;
    try{
      imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    }catch(err){
      console.error(err);
      imageData = null;
    }
    if(!imageData){
      return null;
    }
    return {
      image: imageData,
      options: { pixelRatio: Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1 }
    };
  }


  async function ensureMarkerLabelPillSprites(){
    if(markerLabelPillSpriteCache){
      return markerLabelPillSpriteCache;
    }
    const assets = await ensureMarkerLabelPillImage();
    if(!assets || !assets.base){
      return null;
    }
    // Base sprite: apply black tint with 0.9 alpha (matches reference file)
    const baseSprite = buildMarkerLabelPillSprite(assets.base, 'rgba(0,0,0,1)', 0.9, false);
    let accentSprite = null;
    // Accent sprite: use highlight image without tint, or fallback to tinted base
    if(assets.highlight){
      accentSprite = buildMarkerLabelPillSprite(assets.highlight, null, 1, true);
    }
    if(!accentSprite){
      // Fallback: tint base image with blue color (matches reference file)
      accentSprite = buildMarkerLabelPillSprite(assets.base, '#2f3b73', 1, true);
    }
    if(!baseSprite){
      return null;
    }
    // Hover sprite: use hover image if available, otherwise use accent
    const hoverSprite = assets.hover ? buildMarkerLabelPillSprite(assets.hover, null, 1, false) : accentSprite;
    markerLabelPillSpriteCache = {
      base: baseSprite,
      highlight: accentSprite || baseSprite,
      hover: hoverSprite || accentSprite || baseSprite
    };
    return markerLabelPillSpriteCache;
  }


  // --- Section 4: Composite Sprite System for Map Cards ---
  // Composites combine pill + label + icon/thumbnail into single sprites
  
  // Store for composite sprites: Map<spriteId, { image, options, meta }>
  const markerLabelCompositeStore = new Map();
  const markerLabelCompositePending = new Map(); // Track pending composite creation
  
  // Composite type constants
  const COMPOSITE_TYPE_SMALL = 'small';
  const COMPOSITE_TYPE_SMALL_MULTI = 'small-multi';
  const COMPOSITE_TYPE_HOVER = 'hover';
  const COMPOSITE_TYPE_HOVER_MULTI = 'hover-multi';
  const COMPOSITE_TYPE_BIG = 'big';
  const COMPOSITE_TYPE_BIG_MULTI = 'big-multi';
  
  /**
   * Generate a unique sprite ID for a composite
   * @param {string} type - Composite type (small, small-multi, hover, hover-multi, big, big-multi)
   * @param {string} labelText - Label text (used for uniqueness)
   * @param {string} iconId - Icon ID (subcategory or 'multi-post-icon')
   * @param {string} thumbnailUrl - Optional thumbnail URL for big cards
   * @returns {string} Unique sprite ID
   */
  function markerLabelCompositeId(type, labelText, iconId, thumbnailUrl = null){
    const parts = [type, labelText || '', iconId || '', thumbnailUrl || ''];
    const hash = parts.join('|');
    // Create a short hash from the string
    let hashNum = 0;
    for(let i = 0; i < hash.length; i++){
      const char = hash.charCodeAt(i);
      hashNum = ((hashNum << 5) - hashNum) + char;
      hashNum = hashNum & hashNum; // Convert to 32-bit integer
    }
    return `${MARKER_LABEL_COMPOSITE_PREFIX}${type}-${Math.abs(hashNum).toString(36)}`;
  }
  
  /**
   * Draw text on canvas with proper formatting
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to draw
   * @param {number} x - X position
   * @param {number} y - Y position (baseline)
   * @param {number} maxWidth - Maximum width for text
   * @param {string} color - Text color
   * @param {number} fontSize - Font size in pixels
   */
  function drawCompositeText(ctx, text, x, y, maxWidth, color = '#ffffff', fontSize = markerLabelTextSize){
    if(!text || !ctx) return;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    
    // Handle multi-line text (split by \n)
    const lines = text.split('\n');
    const lineHeight = fontSize * markerLabelTextLineHeight;
    let currentY = y;
    
    for(let i = 0; i < lines.length && i < 2; i++){ // Max 2 lines
      const line = lines[i].trim();
      if(!line) continue;
      
      // Measure and truncate if needed
      let displayText = line;
      const metrics = ctx.measureText(line);
      if(metrics.width > maxWidth){
        // Truncate with ellipsis
        let truncated = line;
        while(ctx.measureText(truncated + markerLabelEllipsisChar).width > maxWidth && truncated.length > 0){
          truncated = truncated.slice(0, -1);
        }
        displayText = truncated + markerLabelEllipsisChar;
      }
      
      ctx.fillText(displayText, x, currentY);
      currentY += lineHeight;
    }
  }
  
  /**
   * Draw a round icon/thumbnail on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {HTMLImageElement|HTMLCanvasElement} img - Image to draw
   * @param {number} x - X position (center)
   * @param {number} y - Y position (center)
   * @param {number} size - Size in pixels (diameter)
   */
  function drawCompositeRoundIcon(ctx, img, x, y, size){
    if(!img || !ctx) return;
    const radius = size / 2;
    
    // Create clipping path for circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    
    // Draw image centered
    const imgSize = Math.min(img.width || img.naturalWidth || size, img.height || img.naturalHeight || size, size);
    const drawX = x - imgSize / 2;
    const drawY = y - imgSize / 2;
    ctx.drawImage(img, drawX, drawY, imgSize, imgSize);
    ctx.restore();
  }
  
  /**
   * Create a composite sprite combining pill + label + icon/thumbnail
   * @param {Object} options - Composite creation options
   * @param {string} options.type - Composite type
   * @param {HTMLImageElement|ImageData} options.pillImage - Pill background image
   * @param {string} options.labelText - Label text (can be multi-line with \n)
   * @param {HTMLImageElement|HTMLCanvasElement} options.iconImage - Icon or thumbnail image
   * @param {boolean} options.isMultiPost - Whether this is a multi-post card
   * @param {string} options.thumbnailUrl - Optional thumbnail URL for big cards
   * @returns {Object|null} { image: ImageData, options: {...} } or null on error
   */
  async function createMapCardComposite(options){
    const { type, pillImage, labelText, iconImage, isMultiPost = false, thumbnailUrl = null } = options;
    
    if(!pillImage || !type){
      console.error('[Composite] Missing required options:', { type, hasPill: !!pillImage });
      return null;
    }
    
    // Determine dimensions based on type
    let canvasWidth, canvasHeight, iconSize, iconX, iconY, labelX, labelY, labelMaxWidth;
    
    if(type === COMPOSITE_TYPE_BIG || type === COMPOSITE_TYPE_BIG_MULTI){
      // Big cards: 225x60px
      canvasWidth = accentPillWidthPx || 225;
      canvasHeight = accentPillHeightPx || 60;
      iconSize = MARKER_COMPOSITE_BIG_ICON_SIZE; // 50px
      iconX = canvasWidth - iconSize - 5; // Right side, 5px from edge
      iconY = canvasHeight / 2; // Center vertically
      labelX = 10; // 10px from left
      labelY = 8; // 8px from top
      labelMaxWidth = canvasWidth - iconSize - 20; // Leave space for icon
    } else {
      // Small cards: 150x40px
      canvasWidth = basePillWidthPx; // 150px
      canvasHeight = basePillHeightPx; // 40px
      iconSize = MARKER_COMPOSITE_SMALL_ICON_SIZE; // 30px
      iconX = 5; // 5px from left
      iconY = canvasHeight / 2; // Center vertically
      labelX = iconX + iconSize + 5; // After icon, 5px gap
      labelY = 6; // 6px from top
      labelMaxWidth = canvasWidth - labelX - 5; // Leave 5px right padding
    }
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if(!ctx){
      console.error('[Composite] Failed to get canvas context');
      return null;
    }
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Step 1: Draw pill background
    try {
      if(pillImage instanceof ImageData){
        // Convert ImageData to canvas first
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pillImage.width;
        tempCanvas.height = pillImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        if(tempCtx){
          tempCtx.putImageData(pillImage, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);
        }
      } else {
        ctx.drawImage(pillImage, 0, 0, canvasWidth, canvasHeight);
      }
    } catch(err){
      console.error('[Composite] Error drawing pill:', err);
      return null;
    }
    
    // Step 2: Draw icon/thumbnail
    if(iconImage){
      try {
        if(type === COMPOSITE_TYPE_BIG || type === COMPOSITE_TYPE_BIG_MULTI){
          // Big cards: round 50px icon/thumbnail
          drawCompositeRoundIcon(ctx, iconImage, iconX + iconSize / 2, iconY, iconSize);
        } else {
          // Small cards: square 30px icon
          const iconDrawSize = Math.min(iconSize, iconImage.width || iconImage.naturalWidth || iconSize, iconImage.height || iconImage.naturalHeight || iconSize);
          const iconDrawX = iconX;
          const iconDrawY = iconY - iconDrawSize / 2;
          ctx.drawImage(iconImage, iconDrawX, iconDrawY, iconDrawSize, iconDrawSize);
        }
      } catch(err){
        console.error('[Composite] Error drawing icon:', err);
        // Continue without icon
      }
    }
    
    // Step 3: Draw label text
    if(labelText){
      try {
        drawCompositeText(ctx, labelText, labelX, labelY, labelMaxWidth, '#ffffff', markerLabelTextSize);
      } catch(err){
        console.error('[Composite] Error drawing text:', err);
        // Continue without text
      }
    }
    
    // Convert to ImageData
    let imageData = null;
    try {
      imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    } catch(err){
      console.error('[Composite] Error getting ImageData:', err);
      return null;
    }
    
    if(!imageData){
      return null;
    }
    
    return {
      image: imageData,
      options: { pixelRatio: 1 }
    };
  }
  
  /**
   * Enforce composite sprite budget by removing least recently used composites
   * @param {Object} mapInstance - Mapbox map instance
   * @param {Object} options - Options
   * @param {Array<string>} options.keep - Sprite IDs to keep (exempt from removal)
   * @param {number} options.reserve - Number of slots to reserve
   */
  function enforceMarkerLabelCompositeBudget(mapInstance, options = {}){
    if(!mapInstance || !MARKER_LABEL_COMPOSITE_LIMIT || MARKER_LABEL_COMPOSITE_LIMIT <= 0){
      return;
    }
    
    const { keep = [], reserve = 0 } = options;
    const keepSet = new Set(keep);
    const effectiveLimit = Math.max(0, MARKER_LABEL_COMPOSITE_LIMIT - Math.max(0, reserve));
    
    // Get all composites, sorted by last used timestamp (oldest first)
    const entries = Array.from(markerLabelCompositeStore.entries())
      .filter(([spriteId]) => !keepSet.has(spriteId))
      .map(([spriteId, meta]) => ({
        spriteId,
        timestamp: meta.timestamp || 0,
        compositeId: meta.compositeId || spriteId
      }))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Remove excess composites
    if(entries.length > effectiveLimit){
      const toRemove = entries.slice(0, entries.length - effectiveLimit);
      for(const entry of toRemove){
        try {
          if(mapInstance.hasImage(entry.compositeId)){
            mapInstance.removeImage(entry.compositeId);
          }
          markerLabelCompositeStore.delete(entry.spriteId);
        } catch(err){
          console.warn('[Composite Budget] Error removing composite:', err);
        }
      }
    }
  }
  
  /**
   * Ensure a composite sprite exists and is added to the map
   * @param {Object} mapInstance - Mapbox map instance
   * @param {Object} options - Composite creation options
   * @returns {Promise<Object>} { compositeId, spriteId, meta }
   */
  async function ensureMapCardComposite(mapInstance, options){
    const { type, labelText, iconId, isMultiPost = false, thumbnailUrl = null } = options;
    
    if(!mapInstance || !type || !labelText || !iconId){
      console.error('[Composite] Missing required parameters:', { type, labelText, iconId });
      return null;
    }
    
    // Generate sprite ID
    const spriteId = markerLabelCompositeId(type, labelText, iconId, thumbnailUrl);
    const compositeId = spriteId; // Use same ID for composite
    
    // Check if already exists
    const existing = markerLabelCompositeStore.get(spriteId);
    if(existing && mapInstance.hasImage(compositeId)){
      // Update timestamp
      existing.timestamp = nowTimestamp();
      markerLabelCompositeStore.set(spriteId, existing);
      return { compositeId, spriteId, meta: existing };
    }
    
    // Check if already pending
    if(markerLabelCompositePending.has(spriteId)){
      try {
        await markerLabelCompositePending.get(spriteId);
        const refreshed = markerLabelCompositeStore.get(spriteId);
        if(refreshed && mapInstance.hasImage(compositeId)){
          return { compositeId, spriteId, meta: refreshed };
        }
      } catch(err){
        // Pending creation failed, continue to create new
      }
    }
    
    // Create composite
    const createTask = (async () => {
      try {
        // Load required assets
        const [pillSprites, iconImage] = await Promise.all([
          ensureMarkerLabelPillSprites(),
          loadCompositeIcon(iconId, type, thumbnailUrl, isMultiPost)
        ]);
        
        if(!pillSprites){
          throw new Error('Failed to load pill sprites');
        }
        
        // Select appropriate pill based on type
        let pillImage = null;
        if(type === COMPOSITE_TYPE_BIG || type === COMPOSITE_TYPE_BIG_MULTI){
          pillImage = pillSprites.highlight?.image || pillSprites.base?.image;
        } else if(type === COMPOSITE_TYPE_HOVER || type === COMPOSITE_TYPE_HOVER_MULTI){
          pillImage = pillSprites.hover?.image || pillSprites.highlight?.image || pillSprites.base?.image;
        } else {
          pillImage = pillSprites.base?.image;
        }
        
        if(!pillImage){
          throw new Error('Failed to get pill image');
        }
        
        // Create composite
        const composite = await createMapCardComposite({
          type,
          pillImage,
          labelText,
          iconImage,
          isMultiPost,
          thumbnailUrl
        });
        
        if(!composite){
          throw new Error('Failed to create composite');
        }
        
        // Enforce budget before adding
        enforceMarkerLabelCompositeBudget(mapInstance, { keep: [spriteId], reserve: 1 });
        
        // Add to map
        const imageToAdd = convertImageDataToCanvas(composite.image);
        if(imageToAdd){
          mapInstance.addImage(compositeId, imageToAdd, composite.options || {});
        }
        
        // Store metadata
        const meta = {
          compositeId,
          timestamp: nowTimestamp(),
          type,
          labelText,
          iconId,
          isMultiPost
        };
        markerLabelCompositeStore.set(spriteId, meta);
        
        return { compositeId, spriteId, meta };
      } catch(err){
        console.error('[Composite] Error creating composite:', err);
        throw err;
      } finally {
        markerLabelCompositePending.delete(spriteId);
      }
    })();
    
    markerLabelCompositePending.set(spriteId, createTask);
    return await createTask;
  }
  
  /**
   * Load icon/thumbnail image for composite
   * @param {string} iconId - Icon ID (subcategory or 'multi-post-icon')
   * @param {string} type - Composite type
   * @param {string} thumbnailUrl - Optional thumbnail URL for big cards
   * @param {boolean} isMultiPost - Whether this is a multi-post card
   * @returns {Promise<HTMLImageElement>}
   */
  async function loadCompositeIcon(iconId, type, thumbnailUrl, isMultiPost){
    // For big cards with thumbnail URL, load thumbnail
    if((type === COMPOSITE_TYPE_BIG || type === COMPOSITE_TYPE_BIG_MULTI) && thumbnailUrl){
      try {
        return await loadMarkerLabelImage(thumbnailUrl);
      } catch(err){
        console.warn('[Composite] Failed to load thumbnail, falling back to icon:', err);
      }
    }
    
    // Load icon from subcategoryMarkers
    const iconUrl = window.subcategoryMarkers && window.subcategoryMarkers[iconId];
    if(iconUrl){
      try {
        return await loadMarkerLabelImage(iconUrl);
      } catch(err){
        console.warn('[Composite] Failed to load icon:', err);
      }
    }
    
    // Fallback: create placeholder
    const canvas = document.createElement('canvas');
    const size = (type === COMPOSITE_TYPE_BIG || type === COMPOSITE_TYPE_BIG_MULTI) 
      ? MARKER_COMPOSITE_BIG_ICON_SIZE 
      : MARKER_COMPOSITE_SMALL_ICON_SIZE;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if(ctx){
      ctx.fillStyle = '#666';
      ctx.fillRect(0, 0, size, size);
    }
    return canvas;
  }
  
  /**
   * Clear all composites when zoom < 8
   * @param {Object} mapInstance - Mapbox map instance
   */
  function clearMapCardComposites(mapInstance){
    if(!mapInstance) return;
    
    const toRemove = Array.from(markerLabelCompositeStore.keys());
    for(const spriteId of toRemove){
      try {
        const meta = markerLabelCompositeStore.get(spriteId);
        if(meta && meta.compositeId){
          if(mapInstance.hasImage(meta.compositeId)){
            mapInstance.removeImage(meta.compositeId);
          }
        }
        markerLabelCompositeStore.delete(spriteId);
      } catch(err){
        console.warn('[Composite Clear] Error removing composite:', err);
      }
    }
    
    markerLabelCompositePending.clear();
  }

  async function generateMarkerImageFromId(id, mapInstance, options = {}){
    if(!id){
      return null;
    }
    const targetMap = mapInstance || map;
    if(id === MARKER_LABEL_BG_ID || id === MARKER_LABEL_BG_ACCENT_ID){
      const sprites = await ensureMarkerLabelPillSprites();
      if(id === MARKER_LABEL_BG_ID){
        return sprites.base;
      }
      return sprites.highlight;
    }
    const placeholders = ['mx-federal-5','background','background-stroke','icon','icon-stroke'];
    if(placeholders.includes(id)){
      const size = id === 'mx-federal-5' ? 2 : 4;
      const placeholderOptions = { pixelRatio: 1 };
      if(id !== 'mx-federal-5'){
        placeholderOptions.sdf = true;
      }
      return {
        image: createTransparentPlaceholder(size),
        options: placeholderOptions
      };
    }
    const ensureIcon = options && typeof options.ensureIcon === 'function' ? options.ensureIcon : null;
    if(ensureIcon){
      try{
        await ensureIcon(id);
      }catch(err){
        console.error(err);
      }
      if(targetMap && typeof targetMap.hasImage === 'function'){
        try{
          if(targetMap.hasImage(id)){
            return null;
          }
        }catch(err){
          console.error(err);
        }
      }
    }
    return null;
  }




  function patchLayerFiltersForMissingLayer(mapInstance, style){
    if(!mapInstance || typeof mapInstance.setFilter !== 'function') return;
    const layers = style && Array.isArray(style.layers) ? style.layers : [];
    if(!layers.length) return;

    const shouldSkipLayer = (layer) => {
      if(!layer) return true;
      const meta = layer.metadata || {};
      const featureComponent = layer['mapbox:featureComponent'] || meta['mapbox:featureComponent'];
      const featureSet = layer['mapbox:featureset'] || meta['mapbox:featureset'];
      if(featureSet) return true;
      if(typeof featureComponent === 'string' && featureComponent.includes('place-label')) return true;
      if(typeof layer.id === 'string' && layer.id.includes('place-label')) return true;
      if(typeof layer.source === 'string' && layer.source.includes('place-label')) return true;
      return false;
    };

    function patchExpression(expr){
      if(!Array.isArray(expr)){
        return { expr, changed:false };
      }
      const op = expr[0];
      let changed = false;
      const result = expr.map((item, idx) => {
        if(idx === 0) return item;
        const patched = patchExpression(item);
        if(patched.changed) changed = true;
        return patched.expr;
      });

      if((op === 'number' || op === 'to-number') && result.length > 1){
        const target = result[1];
        if(Array.isArray(target)){
          const already = target[0] === 'coalesce'
            && Array.isArray(target[1])
            && target[1][0] === 'get'
            && target[1][1] === 'layer';
          if(!already && target[0] === 'get' && target[1] === 'layer'){
            result[1] = ['coalesce', target, 0];
            changed = true;
          }
        }
      }

      return { expr: result, changed };
    }

    layers.forEach(layer => {
      if(!layer || !layer.id || !layer.filter) return;
      if(shouldSkipLayer(layer)) return;
      try{
        const patched = patchExpression(layer.filter);
        if(!patched.changed) return;
        mapInstance.setFilter(layer.id, patched.expr);
      }catch(err){}
    });
  }

  function patchTerrainSource(mapInstance, style){
    if(!mapInstance || typeof mapInstance.setTerrain !== 'function') return;
    const terrain = style && style.terrain;
    if(!terrain || !terrain.source) return;
    const sources = style.sources || {};
    const originalSource = sources[terrain.source];
    if(!originalSource) return;

    const dedicatedId = 'terrain-dem-dedicated';
    const ensureDedicatedSource = () => {
      if(mapInstance.getSource?.(dedicatedId)) return true;
      try {
        const clone = JSON.parse(JSON.stringify(originalSource));
        mapInstance.addSource(dedicatedId, clone);
        return !!mapInstance.getSource?.(dedicatedId);
      } catch(err){}
      return false;
    };

    const currentTerrain = typeof mapInstance.getTerrain === 'function' ? mapInstance.getTerrain() : null;
    if(currentTerrain && currentTerrain.source === dedicatedId && typeof currentTerrain.cutoff === 'number' && currentTerrain.cutoff > 0){
      return;
    }

    const hasDedicated = ensureDedicatedSource();
    const targetSource = hasDedicated ? dedicatedId : terrain.source;
    const nextTerrain = Object.assign({}, terrain, { source: targetSource });
    if(typeof nextTerrain.cutoff !== 'number' || nextTerrain.cutoff <= 0){
      nextTerrain.cutoff = 0.01;
    }
    try { mapInstance.setTerrain(nextTerrain); } catch(err){}
  }

  function patchMapboxStyleArtifacts(mapInstance){
    if(!mapInstance || typeof mapInstance.getStyle !== 'function') return;
    if(mapInstance.isStyleLoaded && !mapInstance.isStyleLoaded()) return;
    let style;
    try{
      style = mapInstance.getStyle();
    }catch(err){
      return;
    }
    if(!style) return;
    try{ ensurePlaceholderSprites(mapInstance); }catch(err){}
    try{ patchLayerFiltersForMissingLayer(mapInstance, style); }catch(err){}
    try{ patchTerrainSource(mapInstance, style); }catch(err){}
  }

  // Attach pointer cursor only after style is ready, and re-attach if style changes later.
  function armPointerOnSymbolLayers(map){
    const POINTER_READY_IDS = new Set([
      'small-map-card-pill',
      'big-map-card-pill',
      'post-balloons'
    ]);

    function shouldAttachPointer(layer){
      if (!layer || layer.type !== 'symbol') return false;
      if (POINTER_READY_IDS.has(layer.id)) return true;
      if (typeof layer.source === 'string' && layer.source === 'posts') return true;
      if (layer.metadata && layer.metadata.cursor === 'pointer') return true;
      return false;
    }

    function attach(){
      if (!map.getStyle || !map.isStyleLoaded || !map.isStyleLoaded()) return;
      const st = map.getStyle();
      if (!st || !st.layers) return;

      map.__cursorArmed = map.__cursorArmed || new Set();
      st.layers.forEach(l => {
        if (!shouldAttachPointer(l) || map.__cursorArmed.has(l.id)) return;
        map.on('mouseenter', l.id, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', l.id, () => map.getCanvas().style.cursor = 'grab');
        map.__cursorArmed.add(l.id);
      });
    }

    // First time once the style is fully loaded
    whenStyleReady(map, attach);

    // If the style changes later, reattach *after* the new style finishes
    map.on('styledata', () => {
      if (map.isStyleLoaded && map.isStyleLoaded()) attach();
    });
  }
  // --- Section 3: Map Card System ---
  function loadMarkerLabelImage(url){
    return new Promise((resolve, reject) => {
      if(!url){
        reject(new Error('Missing URL'));
        return;
      }
      const img = new Image();
      try{ img.crossOrigin = 'anonymous'; }catch(err){}
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
      if(img.complete){
        setTimeout(() => {
          if(img.naturalWidth > 0 && img.naturalHeight > 0){
            resolve(img);
          }
        }, 0);
      }
    });
  }

  // MAP CARD BACKGROUND SYSTEM: Provides pill images (map card backgrounds)
  // Uses these images directly via ensureMarkerLabelPillSprites()
  async function ensureMarkerLabelPillImage(){
    // If we have a cached promise, try to use it, but clear cache if it was rejected
    if(markerLabelPillImagePromise){
      try {
        // Try to await the cached promise - if it's already resolved, this will return immediately
        // If it was rejected, this will throw and we'll clear the cache
        await Promise.resolve(markerLabelPillImagePromise);
      return markerLabelPillImagePromise;
      } catch(err) {
        // Cached promise was rejected - clear it and try again
        markerLabelPillImagePromise = null;
    }
    }
    
    // Load from admin settings - no hardcoded defaults
    let baseUrl = null;
    let accentUrl = null;
    let hoverUrl = null;
    
    try {
      const response = await fetch('/gateway.php?action=get-admin-settings');
      if(response.ok){
        const data = await response.json();
        if(data.success && data.settings){
          if(data.settings.small_map_card_pill){
            baseUrl = data.settings.small_map_card_pill;
          }
          if(data.settings.big_map_card_pill){
            accentUrl = data.settings.big_map_card_pill;
          }
          if(data.settings.hover_map_card_pill){
            hoverUrl = data.settings.hover_map_card_pill;
          }
        }
      }
    } catch(err) {
      console.error('Failed to load pill image settings:', err);
    }
    
    if(!baseUrl || !accentUrl){
      const error = new Error('Pill image URLs not found in database settings');
      // Don't cache rejected promises - allow retry on next call
      return Promise.reject(error);
    }
    
    // Load base and accent images (required)
    const loadPromises = [
      loadMarkerLabelImage(baseUrl),
      loadMarkerLabelImage(accentUrl)
    ];
    
    // Load hover image if available (optional)
    if(hoverUrl){
      loadPromises.push(loadMarkerLabelImage(hoverUrl));
    }
    
    const promise = Promise.all(loadPromises).then((images) => {
      const result = { 
        base: images[0], 
        highlight: images[1] 
      };
      // Use hover image if available, otherwise fall back to accent
      if(images[2]){
        result.hover = images[2];
      } else {
        result.hover = images[1]; // Fall back to accent
      }
      return result;
    }).catch((err) => {
      // Clear cache on error to allow retry
      markerLabelPillImagePromise = null;
      throw err;
    });
    
    // Cache the promise (will be cleared if it rejects)
    markerLabelPillImagePromise = promise;
    return markerLabelPillImagePromise;
  }

  function computeMarkerLabelCanvasDimensions(sourceImage, isAccent = false){
    if(isAccent){
      const width = accentPillWidthPx !== null ? accentPillWidthPx : (sourceImage && (sourceImage.naturalWidth || sourceImage.width) ? (sourceImage.naturalWidth || sourceImage.width) : basePillWidthPx);
      const height = accentPillHeightPx !== null ? accentPillHeightPx : (sourceImage && (sourceImage.naturalHeight || sourceImage.height) ? (sourceImage.naturalHeight || sourceImage.height) : basePillHeightPx);
      const canvasWidth = Math.max(1, Math.round(Number.isFinite(width) && width > 0 ? width : basePillWidthPx));
      const canvasHeight = Math.max(1, Math.round(Number.isFinite(height) && height > 0 ? height : basePillHeightPx));
      const pixelRatio = 1;
      return { canvasWidth, canvasHeight, pixelRatio };
    }
    const canvasWidth = basePillWidthPx;
    const canvasHeight = basePillHeightPx;
    const pixelRatio = 1;
    return { canvasWidth, canvasHeight, pixelRatio };
  }


  // Shared function to convert ImageData to Canvas (Mapbox requires Image/Canvas, not ImageData)
  function convertImageDataToCanvas(imageData){
    if(!imageData) return null;
    if(!(imageData instanceof ImageData)){
      return imageData; // Already a Canvas or Image
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if(ctx){
        ctx.putImageData(imageData, 0, 0);
      }
      return canvas;
    } catch(e){
      console.error('Error converting ImageData to Canvas:', e);
      return null;
    }
  }

  function buildMarkerLabelPillSprite(sourceImage, tintColor, tintAlpha = 1, isAccent = false){
    if(!sourceImage){
      return null;
    }
    const { canvasWidth, canvasHeight, pixelRatio } = computeMarkerLabelCanvasDimensions(sourceImage, isAccent);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if(!ctx){
      return null;
    }
    try{
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      // Draw image at full size (no devicePixelRatio scaling to avoid size mismatch)
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImage, 0, 0, canvasWidth, canvasHeight);
    }catch(err){
      console.error(err);
      return null;
    }
    if(tintColor){
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = tintAlpha;
      ctx.fillStyle = tintColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    let imageData = null;
    try{
      imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    }catch(err){
      console.error(err);
      imageData = null;
    }
    if(!imageData){
      return null;
    }
    return {
      image: imageData,
      options: { pixelRatio: Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1 }
    };
  }


  async function ensureMarkerLabelPillSprites(){
    if(markerLabelPillSpriteCache){
      return markerLabelPillSpriteCache;
    }
    const assets = await ensureMarkerLabelPillImage();
    if(!assets || !assets.base){
      return null;
    }
    // Base sprite: apply black tint with 0.9 alpha (matches reference file)
    const baseSprite = buildMarkerLabelPillSprite(assets.base, 'rgba(0,0,0,1)', 0.9, false);
    let accentSprite = null;
    // Accent sprite: use highlight image without tint, or fallback to tinted base
    if(assets.highlight){
      accentSprite = buildMarkerLabelPillSprite(assets.highlight, null, 1, true);
    }
    if(!accentSprite){
      // Fallback: tint base image with blue color (matches reference file)
      accentSprite = buildMarkerLabelPillSprite(assets.base, '#2f3b73', 1, true);
    }
    if(!baseSprite){
      return null;
    }
    // Hover sprite: use hover image if available, otherwise use accent
    const hoverSprite = assets.hover ? buildMarkerLabelPillSprite(assets.hover, null, 1, false) : accentSprite;
    markerLabelPillSpriteCache = {
      base: baseSprite,
      highlight: accentSprite || baseSprite,
      hover: hoverSprite || accentSprite || baseSprite
    };
    return markerLabelPillSpriteCache;
  }

      // --- Section 5: Marker Clustering (Balloons) ---
      // Balloon icons group nearby posts at low zoom levels. They are replaced by individual markers at higher zoom.
      const BALLOON_SOURCE_ID = 'post-balloon-source';
        const BALLOON_LAYER_ID = 'post-balloons';
        const BALLOON_LAYER_IDS = [BALLOON_LAYER_ID];
        const BALLOON_IMAGE_ID = 'seed-balloon-icon';
        let BALLOON_IMAGE_URL = null; // Loaded from admin_settings
        const BALLOON_MIN_ZOOM = 0;
        const BALLOON_MAX_ZOOM = MARKER_ZOOM_THRESHOLD;
        let balloonLayersVisible = true;

        async function ensureBalloonIconImage(mapInstance){
          // Load balloon icon URL from admin_settings - no fallbacks
            try {
              const response = await fetch('/gateway.php?action=get-admin-settings');
              if(response.ok){
                const data = await response.json();
              if(data.success && data.settings && data.settings.marker_cluster_icon && typeof data.settings.marker_cluster_icon === 'string' && data.settings.marker_cluster_icon.trim()){
                BALLOON_IMAGE_URL = data.settings.marker_cluster_icon.trim();
                }
              }
            } catch(err) {
              console.error('Failed to load marker cluster icon setting:', err);
          }
          
          return new Promise(resolve => {
            if(!mapInstance || typeof mapInstance.hasImage !== 'function'){
              resolve();
              return;
            }
            if(mapInstance.hasImage(BALLOON_IMAGE_ID)){
              resolve();
              return;
            }
            const handleImage = (image)=>{
              if(!image){
                resolve();
                return;
              }
              try{
                if(!mapInstance.hasImage(BALLOON_IMAGE_ID) && image.width > 0 && image.height > 0){
                  const pixelRatio = image.width >= 256 ? 2 : 1;
                  mapInstance.addImage(BALLOON_IMAGE_ID, image, { pixelRatio });
                }
              }catch(err){ console.error(err); }
              resolve();
            };
            try{
              if(typeof mapInstance.loadImage === 'function'){
                mapInstance.loadImage(BALLOON_IMAGE_URL, (err, image)=>{
                  if(err){ console.error(err); resolve(); return; }
                  handleImage(image);
                });
                return;
              }
            }catch(err){ console.error(err); resolve(); return; }
            if(typeof Image !== 'undefined'){
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = ()=>handleImage(img);
              img.onerror = ()=>resolve();
              img.src = BALLOON_IMAGE_URL;
              return;
            }
            resolve();
          });
        }

        function formatBalloonCount(count){
          if(!Number.isFinite(count) || count <= 0){
            return '0';
          }
          if(count >= 1000000){
            const value = count / 1000000;
            const formatted = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
            return `${formatted}m`;
          }
          if(count >= 1000){
            const value = count / 1000;
            const formatted = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
            return `${formatted}k`;
          }
          return String(count);
        }

        function getBalloonGridSize(zoom){
          const z = Number.isFinite(zoom) ? zoom : 0;
          if(z >= 7.5) return 0.5;
          if(z >= 6) return 1;
          if(z >= 4) return 2.5;
          if(z >= 2) return 5;
          return 10;
        }

        const clampBalloonLat = (lat)=> Math.max(-85, Math.min(85, lat));

        function groupPostsForBalloonZoom(postsSource, zoom){
          const gridSizeRaw = getBalloonGridSize(zoom);
          const gridSize = gridSizeRaw > 0 ? gridSizeRaw : 5;
          const groups = new Map();
          postsSource.forEach(post => {
            if(!post || !Number.isFinite(post.lng) || !Number.isFinite(post.lat)) return;
            const lng = Number(post.lng);
            const lat = clampBalloonLat(Number(post.lat));
            const col = Math.floor((lng + 180) / gridSize);
            const row = Math.floor((lat + 90) / gridSize);
            const key = `${col}|${row}`;
            let bucket = groups.get(key);
            if(!bucket){
              bucket = { count:0, sumLng:0, sumLat:0, posts: [] };
              groups.set(key, bucket);
            }
            bucket.count += 1;
            bucket.sumLng += lng;
            bucket.sumLat += lat;
            bucket.posts.push(post);
          });
          return { groups };
        }

        let lastBalloonGroupingDetails = { key: null, zoom: null, groups: new Map() };

        function buildBalloonFeatureCollection(zoom){
          const allowInitialize = true; // ensure balloons have data even before marker zoom threshold
          const getAllPostsCache = getGetAllPostsCache();
          const postsSource = getAllPostsCache({ allowInitialize });
          if(!Array.isArray(postsSource) || postsSource.length === 0){
            const emptyGroups = new Map();
            const groupingKey = getBalloonBucketKey(zoom);
            lastBalloonGroupingDetails = { key: groupingKey, zoom, groups: emptyGroups };
            return { type:'FeatureCollection', features: [] };
          }
          const { groups } = groupPostsForBalloonZoom(postsSource, zoom);
          const features = [];
          groups.forEach((bucket, key) => {
            if(!bucket || bucket.count <= 0) return;
            const avgLng = bucket.sumLng / bucket.count;
            const avgLat = bucket.sumLat / bucket.count;
            features.push({
              type:'Feature',
              properties:{
                count: bucket.count,
                label: formatBalloonCount(bucket.count),
                bucket: key
              },
              geometry:{ type:'Point', coordinates:[avgLng, avgLat] }
            });
          });
          const groupingKey = getBalloonBucketKey(zoom);
          lastBalloonGroupingDetails = { key: groupingKey, zoom, groups };
          return { type:'FeatureCollection', features };
        }

        function computeChildBalloonTarget(bucket, currentZoom, maxAllowedZoom){
          if(!bucket || !Array.isArray(bucket.posts) || bucket.posts.length <= 1){
            return null;
          }
          const safeCurrent = Number.isFinite(currentZoom) ? currentZoom : 0;
          const safeMax = Number.isFinite(maxAllowedZoom) ? maxAllowedZoom : safeCurrent;
          if(!(safeMax > safeCurrent)){
            return null;
          }
          const step = 0.25;
          const maxIterations = Math.max(1, Math.ceil((safeMax - safeCurrent) / step) + 1);
          for(let i=0;i<maxIterations;i++){
            const candidateZoom = Math.min(safeMax, safeCurrent + (i + 1) * step);
            if(!(candidateZoom > safeCurrent)){
              continue;
            }
            const { groups } = groupPostsForBalloonZoom(bucket.posts, candidateZoom);
            const childBuckets = Array.from(groups.values()).filter(child => child && child.count > 0);
            if(childBuckets.length <= 1){
              continue;
            }
            let totalCount = 0;
            let sumLng = 0;
            let sumLat = 0;
            childBuckets.forEach(child => {
              const childCenterLng = child.sumLng / child.count;
              const childCenterLat = child.sumLat / child.count;
              totalCount += child.count;
              sumLng += childCenterLng * child.count;
              sumLat += childCenterLat * child.count;
            });
            if(totalCount <= 0){
              continue;
            }
            return {
              center: [sumLng / totalCount, sumLat / totalCount],
              zoom: candidateZoom
            };
          }
          return null;
        }

        let lastBalloonBucketKey = null;

        function getBalloonBucketKey(zoom){
          const size = getBalloonGridSize(zoom);
          return Number.isFinite(size) ? size.toFixed(2) : 'default';
        }

        function updateBalloonSourceForZoom(zoom){
          if(!map) return;
          const source = map.getSource && map.getSource(BALLOON_SOURCE_ID);
          if(!source || typeof source.setData !== 'function') return;
          const zoomValue = Number.isFinite(zoom) ? zoom : (typeof map.getZoom === 'function' ? map.getZoom() : 0);
          const bucketKey = getBalloonBucketKey(zoomValue);
          if(lastBalloonBucketKey === bucketKey) return;
          try{
            const data = buildBalloonFeatureCollection(zoomValue);
            source.setData(data);
            lastBalloonBucketKey = bucketKey;
          }catch(err){ console.error(err); }
        }

        function resetBalloonSourceState(){
          lastBalloonBucketKey = null;
          lastBalloonGroupingDetails = { key: null, zoom: null, groups: new Map() };
        }

        function setupSeedLayers(mapInstance){
          if(!mapInstance) return;
          // Ensure balloon layers are ready even at low zoom on initial load
          const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
          if(!Number.isFinite(currentZoom)){
            if(!mapInstance.__seedLayerZoomGate){
              const handleZoomGate = ()=>{
                const readyZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
                if(Number.isFinite(readyZoom)){
                  mapInstance.off('zoomend', handleZoomGate);
                  mapInstance.__seedLayerZoomGate = null;
                  setupSeedLayers(mapInstance);
                }
              };
              mapInstance.__seedLayerZoomGate = handleZoomGate;
              mapInstance.on('zoomend', handleZoomGate);
            }
            return;
          }
          if(mapInstance.__seedLayerZoomGate){
            mapInstance.off('zoomend', mapInstance.__seedLayerZoomGate);
            mapInstance.__seedLayerZoomGate = null;
          }
          ensureBalloonIconImage(mapInstance).then(()=>{
            try{
              if(mapInstance.getLayer(BALLOON_LAYER_ID)) mapInstance.removeLayer(BALLOON_LAYER_ID);
            }catch(err){ console.error(err); }

            let balloonSource = null;
            try{
              balloonSource = mapInstance.getSource && mapInstance.getSource(BALLOON_SOURCE_ID);
            }catch(err){ balloonSource = null; }
            const EMPTY_FEATURE_COLLECTION = getEMPTY_FEATURE_COLLECTION();
            const emptyData = EMPTY_FEATURE_COLLECTION;
            try{
              if(balloonSource && typeof balloonSource.setData === 'function'){
                balloonSource.setData(emptyData);
              } else {
                if(balloonSource){
                  try{ mapInstance.removeSource(BALLOON_SOURCE_ID); }catch(removeErr){ console.error(removeErr); }
                }
                mapInstance.addSource(BALLOON_SOURCE_ID, { type:'geojson', data: emptyData });
              }
            }catch(err){ console.error(err); }

            try{
              mapInstance.addLayer({
                id: BALLOON_LAYER_ID,
                type: 'symbol',
                source: BALLOON_SOURCE_ID,
                minzoom: BALLOON_MIN_ZOOM,
                maxzoom: BALLOON_MAX_ZOOM,
                layout: {
                  'icon-image': BALLOON_IMAGE_ID,
                  'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 7.5, 1],
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'icon-anchor': 'bottom',
                  'text-field': ['to-string', ['coalesce', ['get','label'], ['get','count']]],
                  'text-size': 12,
                  'text-offset': [0, -1.35],
                  'text-font': ['Open Sans Bold','Arial Unicode MS Bold'],
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
                },
                metadata:{ cursor:'pointer' }
              });
            }catch(err){ console.error(err); }

            resetBalloonSourceState();
            const currentZoomValue = mapInstance.getZoom ? mapInstance.getZoom() : BALLOON_MIN_ZOOM;
            updateBalloonSourceForZoom(currentZoomValue);
            const shouldShow = Number.isFinite(currentZoomValue) ? currentZoomValue < BALLOON_MAX_ZOOM : true;
            try{
              mapInstance.setLayoutProperty(BALLOON_LAYER_ID, 'visibility', shouldShow ? 'visible' : 'none');
            }catch(err){}
            balloonLayersVisible = shouldShow;
          });

          if(!mapInstance.__seedBalloonEventsBound){
            const handleBalloonClick = (e)=>{
              if(e && typeof e.preventDefault === 'function') e.preventDefault();
              const feature = e && e.features && e.features[0];
              if(!feature) return;
              const coords = feature.geometry && feature.geometry.coordinates;
              if(!Array.isArray(coords) || coords.length < 2) return;
              const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
              const maxZoom = typeof mapInstance.getMaxZoom === 'function' ? mapInstance.getMaxZoom() : 22;
              const maxAllowedZoom = Number.isFinite(maxZoom)
                ? Math.min(maxZoom, BALLOON_MAX_ZOOM)
                : BALLOON_MAX_ZOOM;
              const safeCurrentZoom = Number.isFinite(currentZoom) ? currentZoom : 0;
              const bucketKey = feature.properties && feature.properties.bucket;
              const grouping = lastBalloonGroupingDetails && lastBalloonGroupingDetails.groups instanceof Map
                ? lastBalloonGroupingDetails.groups
                : null;
              const bucketData = grouping && bucketKey ? grouping.get(bucketKey) : null;
              const childZoomLimit = Number.isFinite(maxZoom)
                ? Math.min(maxZoom, Math.max(maxAllowedZoom, 12))
                : 12;
              const childTarget = computeChildBalloonTarget(bucketData, safeCurrentZoom, childZoomLimit);
              const hasChildTarget = childTarget && Array.isArray(childTarget.center) && childTarget.center.length >= 2;
              const targetCenter = hasChildTarget
                ? [childTarget.center[0], childTarget.center[1]]
                : [coords[0], coords[1]];
              const desiredLeafZoom = Number.isFinite(maxZoom) ? Math.min(12, maxZoom) : 12;
              let finalZoom;
              if(hasChildTarget){
                const childZoom = childTarget && Number.isFinite(childTarget.zoom)
                  ? Math.min(childTarget.zoom, childZoomLimit)
                  : NaN;
                finalZoom = Number.isFinite(childZoom) ? childZoom : safeCurrentZoom;
                if(finalZoom < safeCurrentZoom){
                  finalZoom = safeCurrentZoom;
                }
              } else {
                finalZoom = Number.isFinite(desiredLeafZoom) ? desiredLeafZoom : safeCurrentZoom;
                if(finalZoom < safeCurrentZoom){
                  finalZoom = safeCurrentZoom;
                }
              }
              if(!Number.isFinite(finalZoom)){
                finalZoom = safeCurrentZoom;
              }
              let currentPitch = null;
              try{
                currentPitch = typeof mapInstance.getPitch === 'function' ? mapInstance.getPitch() : null;
              }catch(err){
                currentPitch = null;
              }
              try{
                const flight = { center: targetCenter, zoom: finalZoom, essential: true };
                if(Number.isFinite(currentPitch)){
                  flight.pitch = currentPitch;
                }
                if(typeof mapInstance.flyTo === 'function'){
                  mapInstance.flyTo(Object.assign({}, flight, {
                    speed: 1.35,
                    curve: 1.5,
                    easing: t => 1 - Math.pow(1 - t, 3)
                  }));
                } else {
                  mapInstance.easeTo(Object.assign({}, flight, { duration: 650, easing: t => 1 - Math.pow(1 - t, 3) }));
                }
              }catch(err){ console.error(err); }
            };
            mapInstance.on('click', BALLOON_LAYER_ID, handleBalloonClick);
            mapInstance.on('mouseenter', BALLOON_LAYER_ID, ()=>{ mapInstance.getCanvas().style.cursor = 'pointer'; });
            mapInstance.on('mouseleave', BALLOON_LAYER_ID, ()=>{ mapInstance.getCanvas().style.cursor = 'grab'; });
            mapInstance.__seedBalloonEventsBound = true;
          }
          if(mapInstance === map){
            updateLayerVisibility(lastKnownZoom);
          }
        }
    function updateMarkerLabelHighlightIconSize(){
      if(!map || typeof map.setFeatureState !== 'function') return;
      
      const activePostId = getActivePostId();
      const highlightedFeatureKeys = getHighlightedFeatureKeys();
      const markerFeatureIndex = getMarkerFeatureIndex();
      
      const openPostEl = document.querySelector('.open-post[data-id]');
      const openPostId = openPostEl && openPostEl.dataset ? String(openPostEl.dataset.id || '') : '';
      const clickedPostId = activePostId !== undefined && activePostId !== null ? String(activePostId) : '';
      const expandedPostId = openPostId || clickedPostId;
      
      // Reset all features to not expanded/active
      highlightedFeatureKeys.forEach(entry => {
        try{ 
          map.setFeatureState({ source: entry.source, id: entry.id }, { isExpanded: false, isActive: false }); 
        }catch(err){}
      });
      
      // Also reset all features in markerFeatureIndex to ensure clean state
      if(markerFeatureIndex instanceof Map){
        markerFeatureIndex.forEach((entries, postId) => {
          if(entries && Array.isArray(entries)){
            entries.forEach(entry => {
              if(!entry) return;
              const source = entry.source || 'posts';
              const featureId = entry.id;
              if(featureId !== undefined && featureId !== null && String(postId) !== String(expandedPostId)){
                try{ 
                  map.setFeatureState({ source: source, id: featureId }, { isExpanded: false, isActive: false }); 
                }catch(err){}
              }
            });
          }
        });
      }
      
      // Set expanded and active state for clicked/open post
      if(expandedPostId){
        const entries = markerFeatureIndex instanceof Map ? markerFeatureIndex.get(expandedPostId) : null;
        if(entries && entries.length){
          entries.forEach(entry => {
            if(!entry) return;
            const source = entry.source || 'posts';
            const featureId = entry.id;
            if(featureId !== undefined && featureId !== null){
              try{ 
                map.setFeatureState({ source: source, id: featureId }, { isExpanded: true, isActive: true }); 
              }catch(err){}
            }
          });
        }
      }
    }
    
    function updateMapFeatureHighlights(targets){
      const input = Array.isArray(targets) ? targets : [targets];
      const seen = new Set();
      const normalized = [];
      const highlightSpriteIds = new Set();
      input.forEach(entry => {
        if(entry === undefined || entry === null) return;
        let idValue;
        let venueKeyValue = null;
        if(typeof entry === 'object' && !Array.isArray(entry)){
          const rawId = entry.id ?? entry.postId ?? entry.postID ?? entry.postid;
          if(rawId === undefined || rawId === null) return;
          idValue = String(rawId);
          const rawVenue = entry.venueKey ?? entry.venue_key ?? entry.venue;
          if(rawVenue !== undefined && rawVenue !== null){
            const venueString = String(rawVenue).trim();
            if(venueString){
              venueKeyValue = venueString;
            }
          }
        } else {
          idValue = String(entry);
        }
        if(!idValue) return;
        const dedupeKey = venueKeyValue ? `${idValue}::${venueKeyValue}` : idValue;
        if(seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        normalized.push({ id: idValue, venueKey: venueKeyValue });
      });
      
      // Update window state
      if(typeof window !== 'undefined'){
        window.lastHighlightedPostIds = normalized.map(item => ({ id: item.id, venueKey: item.venueKey }));
      }
      
      let highlightedFeatureKeys = getHighlightedFeatureKeys();
      const markerFeatureIndex = getMarkerFeatureIndex();
      
      if(!map || typeof map.setFeatureState !== 'function'){
        if(!normalized.length){
          if(typeof window !== 'undefined'){
            window.highlightedFeatureKeys = [];
          }
        }
        return;
      }
      if(!normalized.length){
        highlightedFeatureKeys.forEach(entry => {
          try{ map.setFeatureState({ source: entry.source, id: entry.id }, { isHighlighted: false }); }
          catch(err){}
        });
        highlightedFeatureKeys = [];
        return;
      }
      const nextEntries = [];
      const nextKeys = new Set();
      const extractVenueFromId = (featureId)=>{
        if(typeof featureId !== 'string') return '';
        const parts = featureId.split('::');
        return parts.length >= 3 ? String(parts[1] || '') : '';
      };
      normalized.forEach(target => {
        if(!target || !target.id) return;
        const entries = markerFeatureIndex instanceof Map ? markerFeatureIndex.get(target.id) : null;
        if(!entries || !entries.length) return;
        entries.forEach(entry => {
          if(!entry) return;
          const source = entry.source || 'posts';
          const featureId = entry.id;
          if(featureId === undefined || featureId === null) return;
          if(target.venueKey){
            const entryVenueKey = entry.venueKey ? String(entry.venueKey) : extractVenueFromId(featureId);
            if(!entryVenueKey || entryVenueKey !== target.venueKey){
              return;
            }
          }
          const compositeKey = `${source}::${featureId}`;
          if(nextKeys.has(compositeKey)) return;
          nextKeys.add(compositeKey);
          nextEntries.push({ source, id: featureId });
          if(entry.spriteId){
            const spriteValue = String(entry.spriteId);
            if(spriteValue){
              highlightSpriteIds.add(spriteValue);
            }
          }
        });
      });
      highlightedFeatureKeys.forEach(entry => {
        const compositeKey = `${entry.source}::${entry.id}`;
        if(nextKeys.has(compositeKey)) return;
        try{ map.setFeatureState({ source: entry.source, id: entry.id }, { isHighlighted: false }); }
        catch(err){}
      });
      nextEntries.forEach(entry => {
        try{ map.setFeatureState({ source: entry.source, id: entry.id }, { isHighlighted: true }); }
        catch(err){}
      });
      // Update window state
      if(typeof window !== 'undefined'){
        window.highlightedFeatureKeys = nextEntries;
      }
      
      // Update icon-size based on click/open state
      updateMarkerLabelHighlightIconSize();
      if(highlightSpriteIds.size){
        highlightSpriteIds.forEach(spriteId => {
        });
      }
    }
  let startPitch, startBearing, logoEls = [], geocoder;
  const LEGACY_DEFAULT_PITCH = 0;
  const geocoders = [];
  let lastGeocoderProximity = null;

  function setAllGeocoderProximity(lng, lat){
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    // Temporarily disable proximity biasing to broaden search results.
    lastGeocoderProximity = null;
  }

  function syncGeocoderProximityToMap(){
    if(!map || typeof map.getCenter !== 'function') return;
    try{
      const center = map.getCenter();
      if(center && Number.isFinite(center.lng) && Number.isFinite(center.lat)){
        setAllGeocoderProximity(center.lng, center.lat);
      }
    }catch(err){}
  }
  const CARD_SURFACE = 'linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.6))';
  const CARD_HIGHLIGHT = '#2e3a72';
  const MapRegistry = {
    list: [],
    limit: 4,
    register(map){
      if(!map) return;
      if(this.list.includes(map)) return;
      this.list.push(map);
      if(typeof map.once === 'function'){
        map.once('remove', () => {
          this.list = this.list.filter(m => m !== map);
        });
      }
      if(this.list.length > this.limit){
        const victim = this.list.shift();
        try{ victim && typeof victim.remove === 'function' && victim.remove(); }catch(err){}
      }
    }
  };

  function getGeocoderInput(gc){
    if(!gc) return null;
    if(gc._inputReference) return gc._inputReference;
    if(gc._inputEl) return gc._inputEl;
    if(gc._container) return gc._container.querySelector('input[type="text"]');
    return null;
  }

  function blurAllGeocoderInputs(){
    geocoders.forEach(gc => {
      const input = getGeocoderInput(gc);
      if(input && typeof input.blur === 'function'){
        input.blur();
      }
    });
  }

  function clearMapGeocoder(){
    if(!geocoder || typeof geocoder.clear !== 'function') return;
    const before = document.activeElement;
    geocoder.clear();
    const after = document.activeElement;
    requestAnimationFrame(() => {
      [after, before, getGeocoderInput(geocoder)].forEach(el => {
        if(el && el.classList && el.classList.contains('mapboxgl-ctrl-geocoder--input') && typeof el.blur === 'function'){
          el.blur();
        }
      });
      blurAllGeocoderInputs();
    });
  }
    async function initMap(){
      // Wait for formbuilder snapshot to load before initializing map
      if (typeof window !== 'undefined' && window.persistedFormbuilderSnapshotPromise) {
        try {
          await window.persistedFormbuilderSnapshotPromise;
        } catch (err) {
          console.error('Failed to wait for formbuilder snapshot:', err);
          throw err; // Don't continue if snapshot failed
        }
      }
      
      if(typeof mapboxgl === 'undefined'){
        console.error('Mapbox GL failed to load');
        return;
      }
      try{
        await ensureMapboxCssFor(document.body);
      }catch(err){}
      // Validate Mapbox token before initialization
      const MAPBOX_TOKEN = getMAPBOX_TOKEN();
      if(!MAPBOX_TOKEN || typeof MAPBOX_TOKEN !== 'string' || MAPBOX_TOKEN.trim() === ''){
        console.error('Mapbox token is missing or invalid');
        return;
      }
      mapboxgl.accessToken = MAPBOX_TOKEN;
      if(typeof mapboxgl.setLogLevel === 'function'){
        mapboxgl.setLogLevel('error');
      }
        map = new mapboxgl.Map({
          container:'map',
          style:'mapbox://styles/mapbox/standard',
          projection:'globe',
          center: startCenter,
          zoom: startZoom,
          pitch: startPitch,
          bearing: startBearing,
          attributionControl:true
        });
        // Add error handler for token/auth errors (only log once per error type)
        let lastErrorLogged = null;
        map.on('error', (e) => {
          if(e && e.error){
            const errorMsg = e.error.message || '';
            const isTokenError = errorMsg.includes('token') || errorMsg.includes('Unauthorized');
            if(isTokenError && lastErrorLogged !== errorMsg){
              console.error('Mapbox authentication error:', e.error);
              lastErrorLogged = errorMsg;
            }
          }
        });
        try{ ensurePlaceholderSprites(map); }catch(err){}
        const zoomIndicatorEl = document.getElementById('mapZoomIndicator');
        const updateZoomIndicator = () => {
          if(!map || !zoomIndicatorEl || typeof map.getZoom !== 'function') return;
          try{
            const zoomLevel = map.getZoom();
            const pitchLevel = typeof map.getPitch === 'function' ? map.getPitch() : NaN;
            if(Number.isFinite(zoomLevel)){
              const zoomText = `Zoom ${zoomLevel.toFixed(2)}`;
              if(Number.isFinite(pitchLevel)){
                zoomIndicatorEl.textContent = `${zoomText} â€¢ Pitch ${Math.round(pitchLevel)}Â°`;
              } else {
                zoomIndicatorEl.textContent = zoomText;
              }
            } else {
              zoomIndicatorEl.textContent = 'Zoom -- â€¢ Pitch --';
            }
          }catch(err){}
        };
        if(zoomIndicatorEl && map && typeof map.on === 'function'){
          ['zoom','zoomend','pitch','pitchend'].forEach(evt => {
            try{ map.on(evt, updateZoomIndicator); }catch(err){}
          });
          if(typeof map.once === 'function'){
            try{ map.once('load', updateZoomIndicator); }catch(err){}
          }
          updateZoomIndicator();
        }

        // Create map scale bar for checking map card scaling
        const createMapScaleBar = () => {
          const mapArea = document.querySelector('.map-area');
          const mapControls = document.querySelector('.map-controls-map');
          if(!mapArea || !mapControls) return;
          
          // Remove existing scale bar if present
          const existingScaleBar = document.getElementById('mapScaleBar');
          if(existingScaleBar){
            existingScaleBar.remove();
          }
          
          const scaleBar = document.createElement('div');
          scaleBar.id = 'mapScaleBar';
          scaleBar.className = 'map-scale-bar';
          
          // Position scale bar 10px below map control row
          const updateScaleBarPosition = () => {
            const controlsRect = mapControls.getBoundingClientRect();
            const mapAreaRect = mapArea.getBoundingClientRect();
            const topOffset = controlsRect.bottom - mapAreaRect.top + 10;
            scaleBar.style.top = topOffset + 'px';
          };
          
          // Create scale line
          const scaleLine = document.createElement('div');
          scaleLine.className = 'scale-line';
          
          // Create marks every 10px (30 marks total for 300px)
          for(let i = 0; i <= 30; i++){
            const mark = document.createElement('div');
            mark.className = 'scale-mark';
            const position = (i / 30) * 100;
            mark.style.left = position + '%';
            // Major marks every 50px (every 5th mark)
            if(i % 5 === 0){
              mark.classList.add('major');
            }
            scaleLine.appendChild(mark);
          }
          
          // Create labels every 50px
          for(let i = 0; i <= 6; i++){
            const label = document.createElement('div');
            label.className = 'scale-label';
            const position = (i * 50);
            label.textContent = position + 'px';
            label.style.left = ((position / 300) * 100) + '%';
            scaleBar.appendChild(label);
          }
          
          scaleBar.appendChild(scaleLine);
          mapArea.appendChild(scaleBar);
          
          // Update position on resize
          updateScaleBarPosition();
          window.addEventListener('resize', updateScaleBarPosition);
          if(typeof map.on === 'function'){
            map.on('resize', updateScaleBarPosition);
          }
        };
        
        // Create scale bar after a short delay to ensure controls are rendered
        setTimeout(createMapScaleBar, 100);
        if(typeof map.once === 'function'){
          map.once('load', () => {
            setTimeout(createMapScaleBar, 100);
          });
        }

        let recentMapInteraction = false;
        let recentInteractionTimeout = null;
        const markRecentInteraction = () => {
          recentMapInteraction = true;
          if(recentInteractionTimeout){
            clearTimeout(recentInteractionTimeout);
          }
          recentInteractionTimeout = setTimeout(() => {
            recentMapInteraction = false;
            recentInteractionTimeout = null;
          }, 1200);
        };

        const mapCanvasContainer = (typeof map.getCanvasContainer === 'function') ? map.getCanvasContainer() : null;
        if(mapCanvasContainer){
          ['mousedown','touchstart','wheel','pointerdown'].forEach(evtName => {
            try{
              mapCanvasContainer.addEventListener(evtName, markRecentInteraction, { passive: true });
            }catch(err){}
          });
          if(map && typeof map.on === 'function'){
            try{
              map.on('remove', () => {
                if(recentInteractionTimeout){
                  clearTimeout(recentInteractionTimeout);
                  recentInteractionTimeout = null;
                }
                ['mousedown','touchstart','wheel','pointerdown'].forEach(evtName => {
                  try{ mapCanvasContainer.removeEventListener(evtName, markRecentInteraction, false); }catch(err){}
                });
              });
            }catch(err){}
          }
        }

        const handleWelcomeOnMapMotion = (evt) => {
          if(evt && evt.originalEvent){
            closeWelcomeModalIfOpen();
            return;
          }
          if(recentMapInteraction){
            closeWelcomeModalIfOpen();
          }
        };

        if(map && typeof map.on === 'function'){
          ['movestart','dragstart','zoomstart','rotatestart','pitchstart','boxzoomstart'].forEach(evtName => {
            try{ map.on(evtName, handleWelcomeOnMapMotion); }catch(err){}
          });
        }
// === Pill hooks (safe) ===

        const applyStyleAdjustments = () => {
          try{ ensurePlaceholderSprites(map); }catch(err){}
          applyNightSky(map);
          patchMapboxStyleArtifacts(map);
        };
        whenStyleReady(map, applyStyleAdjustments);
        map.on('style.load', applyStyleAdjustments);
        
        map.on('styledata', () => {
          try{ ensurePlaceholderSprites(map); }catch(err){}
          if(map.isStyleLoaded && map.isStyleLoaded()){
            patchMapboxStyleArtifacts(map);
          }
        });
        ensureMapIcon = attachIconLoader(map);
        const pendingStyleImageRequests = new Map();
        const handleStyleImageMissing = (evt) => {
          const imageId = evt && evt.id;
          if(!imageId){
            return;
          }
          // Normal behavior: check cache first (fast performance)
          try{
            if(map.hasImage?.(imageId)){
              return;
            }
          }catch(err){
            // Silently handle - image check errors are expected during style loading
          }
          if(pendingStyleImageRequests.has(imageId)){
            return;
          }
          const result = generateMarkerImageFromId(imageId, map, { ensureIcon: ensureMapIcon });
          if(result && typeof result.then === 'function'){
            const task = result.then(output => {
              if(!output){
                return;
              }
              const { image, options } = output;
              if(!image){
                return;
              }
              try{
                if(!map.hasImage?.(imageId)){
                  map.addImage(imageId, image, options || {});
                }
              }catch(error){
                console.error(error);
              }
            }).catch(error => {
              console.error(error);
            }).finally(() => {
              pendingStyleImageRequests.delete(imageId);
            });
            pendingStyleImageRequests.set(imageId, task);
            return;
          }
          if(result && result.image){
            try{
              if(!map.hasImage?.(imageId)){
                map.addImage(imageId, result.image, result.options || {});
              }
            }catch(error){
              console.error(error);
            }
          }
        };
        try{ map.on('styleimagemissing', handleStyleImageMissing); }
        catch(err){ console.error(err); }

        // Map loading state management
        const mapLoading = (() => {
          const loader = window.__logoLoading;
          if(!loader || typeof loader.begin !== 'function' || typeof loader.end !== 'function'){
            return null;
          }
          const overlay = document.getElementById('headerLoadingOverlay');
          const motionTokens = new Set();
          let tilesPending = false;
          let active = false;

          const isMapMovingNow = () => {
            if(!map) return false;
            try{
              if(typeof map.isMoving === 'function' && map.isMoving()) return true;
              if(typeof map.isZooming === 'function' && map.isZooming()) return true;
              if(typeof map.isRotating === 'function' && map.isRotating()) return true;
              if(typeof map.isEasing === 'function' && map.isEasing()) return true;
            }catch(err){}
            return false;
          };

          const apply = (forceStop = false) => {
            const busy = !forceStop && (tilesPending || motionTokens.size > 0 || isMapMovingNow());
            if(busy){
              if(overlay){
                overlay.classList.remove('is-hidden');
                overlay.setAttribute('aria-hidden', 'false');
              }
              if(!active){
                active = true;
                try{ loader.begin('map'); }catch(err){}
              }
            } else {
              if(overlay){
                overlay.classList.add('is-hidden');
                overlay.setAttribute('aria-hidden', 'true');
              }
              if(active){
                active = false;
                try{ loader.end('map'); }catch(err){}
              }
            }
          };

          return {
            apply,
            setTiles(pending){
              if(tilesPending === pending) return;
              tilesPending = pending;
              apply();
            },
            addMotion(token){
              if(motionTokens.has(token)) return;
              motionTokens.add(token);
              apply();
            },
            removeMotion(token){
              if(!motionTokens.has(token)) return;
              motionTokens.delete(token);
              apply();
            },
            clearAll(){
              motionTokens.clear();
              tilesPending = false;
              if(overlay){
                overlay.classList.add('is-hidden');
                overlay.setAttribute('aria-hidden', 'true');
              }
              if(active){
                active = false;
                try{ loader.end('map'); }catch(err){}
              }
            }
          };
        })();

        if(mapLoading){
          const updateRenderState = () => {
            let tileBusy = false;
            if(map){
              try{
                if(typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()){
                  tileBusy = true;
                } else if(typeof map.areTilesLoaded === 'function'){
                  tileBusy = !map.areTilesLoaded();
                }
              }catch(err){
                tileBusy = true;
              }
            }
            mapLoading.setTiles(tileBusy);
            mapLoading.apply();
          };

          map.on('sourcedataloading', () => mapLoading.setTiles(true));
          map.on('render', updateRenderState);
          map.on('idle', () => {
            mapLoading.setTiles(false);
            mapLoading.apply();
          });

          ['move','zoom','rotate','pitch','drag'].forEach(evt => {
            const startEv = `${evt}start`;
            const endEv = `${evt}end`;
            map.on(startEv, () => mapLoading.addMotion(evt));
            map.on(endEv, () => mapLoading.removeMotion(evt));
          });
          ['moveend','zoomend','rotateend','pitchend','dragend'].forEach(evt => {
            map.on(evt, () => mapLoading.apply());
          });
          map.on('remove', () => mapLoading.clearAll());
        }
      map.on('zoomstart', ()=>{
        if(waitForInitialZoom){
          initialZoomStarted = true;
        }
      });
      map.on('zoom', (e)=>{
        const getZoomFromEvent = getGetZoomFromEvent();
        const updateZoomState = getUpdateZoomState();
        const zoomValue = getZoomFromEvent(e);
        const waitForInitialZoom = getDependency('waitForInitialZoom', false);
        const initialZoomStarted = getDependency('initialZoomStarted', false);
        if(waitForInitialZoom){
          if(!initialZoomStarted){
            updateZoomState(zoomValue);
            return;
          }
          if(typeof window !== 'undefined'){
            window.waitForInitialZoom = false;
          }
          if(typeof window !== 'undefined'){
            window.initialZoomStarted = false;
          }
        }
        updateZoomState(zoomValue);
        
        // Clear composites when zoom < 8 (MARKER_ZOOM_THRESHOLD is 8)
        if(typeof clearMapCardComposites === 'function' && Number.isFinite(zoomValue) && zoomValue < 8){
          try {
            clearMapCardComposites(map);
          } catch(err){
            console.warn('[Zoom Cleanup] Error clearing composites:', err);
          }
        }
        
        const spinning = getSpinning();
        if(!spinning){
          const scheduleCheckLoadPosts = getScheduleCheckLoadPosts();
          scheduleCheckLoadPosts({ zoom: zoomValue, target: map });
        }
      });
      map.on('zoomend', ()=>{
        if(markersLoaded) return;
        if(!map || typeof map.getZoom !== 'function') return;
        let currentZoom = NaN;
        try{ currentZoom = map.getZoom(); }catch(err){ currentZoom = NaN; }
        const MARKER_PRELOAD_ZOOM = getMARKER_PRELOAD_ZOOM();
        if(!Number.isFinite(currentZoom) || currentZoom < MARKER_PRELOAD_ZOOM){
          return;
        }
        try{ loadPostMarkers(); }catch(err){ console.error(err); }
        markersLoaded = true;
        window.__markersLoaded = true;
      });
      map.on('moveend', ()=>{
        syncGeocoderProximityToMap();
        const spinning = getSpinning();
        if(!spinning){
          const scheduleCheckLoadPosts = getScheduleCheckLoadPosts();
          scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
        }
      });
      const addControls = getAddControls();
      addControls();
      try{
        map.scrollZoom.setWheelZoomRate(1/240);
        map.scrollZoom.setZoomRate(1/240);
      }catch(e){}
      map.on('load', ()=>{
        setupSeedLayers(map);
        applyNightSky(map);
        $$('.map-overlay').forEach(el=>el.remove());
        if(spinEnabled){
          startSpin(true);
        }
        const updatePostPanel = getUpdatePostPanel();
        const applyFilters = getApplyFilters();
        const updateZoomState = getUpdateZoomState();
        const getZoomFromEvent = getGetZoomFromEvent();
        updatePostPanel();
        applyFilters();
        updateZoomState(getZoomFromEvent());
        if(!markersLoaded){
          const getZoomFromEvent = getGetZoomFromEvent();
          const zoomLevel = Number.isFinite(lastKnownZoom) ? lastKnownZoom : getZoomFromEvent();
          const MARKER_PRELOAD_ZOOM = getMARKER_PRELOAD_ZOOM();
          if(Number.isFinite(zoomLevel) && zoomLevel >= MARKER_PRELOAD_ZOOM){
            try{ loadPostMarkers(); }catch(err){ console.error(err); }
            markersLoaded = true;
            window.__markersLoaded = true;
          }
        }
        checkLoadPosts();
      });

      map.on('style.load', ()=>{
        setupSeedLayers(map);
        updateLayerVisibility(lastKnownZoom);
      });

        const haltSpin = getHaltSpin();
        ['mousedown','wheel','touchstart','dragstart','pitchstart','rotatestart','zoomstart'].forEach(ev=> map.on(ev, haltSpin));
        let suppressNextRefresh = false;
        const refreshMapView = () => {
          if(suppressNextRefresh) return;
          const scheduleCheckLoadPosts = getScheduleCheckLoadPosts();
          const updatePostPanel = getUpdatePostPanel();
          const updateFilterCounts = getUpdateFilterCounts();
          const refreshMarkers = getRefreshMarkers();
          scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
          updatePostPanel();
          updateFilterCounts();
          refreshMarkers();
          const center = map.getCenter().toArray();
          const zoom = map.getZoom();
          const pitch = map.getPitch();
          const bearing = map.getBearing();
          updateBalloonSourceForZoom(zoom);
          localStorage.setItem('mapView', JSON.stringify({center, zoom, pitch, bearing}));
        };
        ['moveend','zoomend','rotateend','pitchend'].forEach(ev => map.on(ev, refreshMapView));
        map.on('dragend', clearMapGeocoder);
        map.on('click', clearMapGeocoder);
        map.on('touchstart', () => requestAnimationFrame(blurAllGeocoderInputs));
      }
    // --- Section 7: Map Source Integration ---
    function loadPostMarkers(){
      try{
        addPostSource();
      }catch(err){
        console.error('loadPostMarkers failed', err);
      }
    }

    async function addPostSource(){
      if(!map){
        return;
      }
      if(addingPostSource){
        pendingAddPostSource = true;
        return;
      }
      addingPostSource = true;
      const MARKER_SPRITE_ZOOM = getMARKER_SPRITE_ZOOM();
      if(map && Number.isFinite(lastKnownZoom) && lastKnownZoom >= MARKER_SPRITE_ZOOM){
        map.__retainAllMarkerSprites = true;
      }
      try{
      const filtersInitialized = getFiltersInitialized();
      const filtered = getFiltered();
      const posts = getPosts();
      const markerList = filtersInitialized && Array.isArray(filtered) ? filtered : posts;
      const getMarkerCollections = getGetMarkerCollections();
      const collections = getMarkerCollections(markerList);
      const { postsData, signature, featureIndex } = collections;
      if(typeof window !== 'undefined'){
        window.markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      }
      const featureCount = Array.isArray(postsData.features) ? postsData.features.length : 0;
      if(featureCount > 1000){
        const scheduleIdle = getDependency('scheduleIdle', (fn, delay) => setTimeout(fn, delay));
        await new Promise(resolve => scheduleIdle(resolve, 120));
      }
      const MARKER_MIN_ZOOM = MARKER_ZOOM_THRESHOLD;
      
      // Create composite sprites for features BEFORE setting source data
      // This allows us to add compositeId to feature properties
      const zoomForComposites = typeof map.getZoom === 'function' ? map.getZoom() : 0;
      if(Number.isFinite(zoomForComposites) && zoomForComposites >= MARKER_ZOOM_THRESHOLD){
        const featuresToProcess = Array.isArray(postsData.features) ? postsData.features : [];
        const compositePromises = [];
        
        for(const feature of featuresToProcess){
          if(!feature || !feature.properties || feature.properties.point_count) continue;
          
          const props = feature.properties;
          const isMultiPost = props.isMultiPost === true;
          const labelText = props.label || '';
          const MULTI_POST_MARKER_ICON_ID = getMULTI_POST_MARKER_ICON_ID();
          const iconId = props.sub || MULTI_POST_MARKER_ICON_ID;
          const thumbnailUrl = props.thumbnailUrl || null;
          
          // Create multiple composite types for each feature:
          // 1. Small composite (default)
          // 2. Small hover composite (for hover state)
          // 3. Big composite (for active/open state)
          // 4. Big multi composite (if multi-post)
          
          const baseCompositeType = isMultiPost ? COMPOSITE_TYPE_SMALL_MULTI : COMPOSITE_TYPE_SMALL;
          const hoverCompositeType = isMultiPost ? COMPOSITE_TYPE_HOVER_MULTI : COMPOSITE_TYPE_HOVER;
          const bigCompositeType = isMultiPost ? COMPOSITE_TYPE_BIG_MULTI : COMPOSITE_TYPE_BIG;
          
          // Create base composite (small)
          const baseCompositePromise = ensureMapCardComposite(map, {
            type: baseCompositeType,
            labelText,
            iconId,
            isMultiPost,
            thumbnailUrl: null // Small composites don't use thumbnails
          }).then(result => {
            if(result && result.compositeId && props){
              props.compositeId = result.compositeId;
            }
            return result;
          }).catch(err => {
            console.warn('[addPostSource] Failed to create base composite:', err);
            return null;
          });
          
          // Create hover composite
          const hoverCompositePromise = ensureMapCardComposite(map, {
            type: hoverCompositeType,
            labelText,
            iconId,
            isMultiPost,
            thumbnailUrl: null
          }).then(result => {
            if(result && result.compositeId && props){
              props.hoverCompositeId = result.compositeId;
            }
            return result;
          }).catch(err => {
            console.warn('[addPostSource] Failed to create hover composite:', err);
            return null;
          });
          
          // Create big composite (for active/open state)
          const bigCompositePromise = ensureMapCardComposite(map, {
            type: bigCompositeType,
            labelText,
            iconId,
            isMultiPost,
            thumbnailUrl // Big composites use thumbnails
          }).then(result => {
            if(result && result.compositeId && props){
              props.bigCompositeId = result.compositeId;
            }
            return result;
          }).catch(err => {
            console.warn('[addPostSource] Failed to create big composite:', err);
            return null;
          });
          
          compositePromises.push(baseCompositePromise, hoverCompositePromise, bigCompositePromise);
        }
        
        // Wait for composites (limit to avoid blocking - 200 features = 600 composites max)
        try {
          await Promise.allSettled(compositePromises.slice(0, 600));
        } catch(err){
          console.warn('[addPostSource] Error creating composites:', err);
        }
      }
      
      const existing = map.getSource('posts');
      if(!existing){
        map.addSource('posts', { type:'geojson', data: postsData, promoteId: 'featureId' });
        const source = map.getSource('posts');
        if(source){ source.__markerSignature = signature; }
      } else {
        existing.setData(postsData);
        existing.__markerSignature = signature;
      }
      const subcategoryMarkers = window.subcategoryMarkers || {};
      const iconIds = Object.keys(subcategoryMarkers);
      if(typeof ensureMapIcon === 'function'){
        await Promise.all(iconIds.map(id => ensureMapIcon(id).catch(()=>{})));
      }
      // Pre-load marker-icon sprites and add them to map
      const markerIconIds = new Set();
      postsData.features.forEach(feature => {
        if(feature.properties && !feature.properties.point_count){
          const iconId = feature.properties.sub || MULTI_POST_MARKER_ICON_ID;
          markerIconIds.add(iconId);
        }
      });
      markerIconIds.add(MULTI_POST_MARKER_ICON_ID);
      for(const iconId of markerIconIds){
        if(typeof ensureMapIcon === 'function'){
          await ensureMapIcon(iconId).catch(()=>{});
        }
        const iconUrl = subcategoryMarkers[iconId];
        if(iconUrl && !map.hasImage(iconId)){
          try{
            const img = await loadMarkerLabelImage(iconUrl);
            if(img){
              let deviceScale = 2;
              try{
                const ratio = window.devicePixelRatio;
                if(Number.isFinite(ratio) && ratio > 0){
                  deviceScale = ratio;
                }
              }catch(err){
                deviceScale = 2;
              }
              if(!Number.isFinite(deviceScale) || deviceScale <= 0){
                deviceScale = 2;
              }
              const iconSize = Math.round(markerIconBaseSizePx * deviceScale);
              const canvas = document.createElement('canvas');
              canvas.width = iconSize;
              canvas.height = iconSize;
              const ctx = canvas.getContext('2d');
              if(ctx){
                ctx.drawImage(img, 0, 0, iconSize, iconSize);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                map.addImage(iconId, imageData, { pixelRatio: deviceScale });
              }
            }
          }catch(e){}
        }
      }
      
      // Ensure pill sprites are loaded before creating layers
      // Only reload if cache is empty (to avoid redundant reloads when already updated)
      let pillSprites = markerLabelPillSpriteCache;
      if(!pillSprites){
        try {
          pillSprites = await ensureMarkerLabelPillSprites();
        } catch(e) {
          console.error('[addPostSource] Error loading pill sprites:', e);
          pillSprites = null;
        }
      }
      
      // Always ensure sprites are added to map (only add if they don't exist to avoid redundant operations)
      // CRITICAL: Mapbox requires Image/Canvas objects, not ImageData
      if(!pillSprites){
        console.error('[addPostSource] CRITICAL: pillSprites is null/undefined - pills will not be visible!');
      } else if(!pillSprites.base){
        console.error('[addPostSource] CRITICAL: pillSprites.base is null/undefined - small pills will not be visible!');
      } else if(!pillSprites.highlight){
        console.error('[addPostSource] CRITICAL: pillSprites.highlight is null/undefined - big pills will not be visible!');
      }
      
      // Only add sprites if they don't already exist (prevents RangeError: mismatched image size)
      // CRITICAL: Never remove and re-add images - Mapbox throws dimension mismatch errors
      if(pillSprites && pillSprites.base && pillSprites.base.image){
        // Skip if image already exists - prevents dimension mismatch errors
        if(!map.hasImage(MARKER_LABEL_BG_ID)){
          try {
            // Convert ImageData to Canvas if needed
            const imageToAdd = convertImageDataToCanvas(pillSprites.base.image);
            if(imageToAdd){
              // Validate dimensions before adding
              const width = imageToAdd.width || (imageToAdd instanceof ImageData ? imageToAdd.width : 0);
              const height = imageToAdd.height || (imageToAdd instanceof ImageData ? imageToAdd.height : 0);
              if(width > 0 && height > 0){
                map.addImage(MARKER_LABEL_BG_ID, imageToAdd);
                console.log('[addPostSource] Added small-map-card-pill sprite', width, 'x', height);
              } else {
                console.error('[addPostSource] Invalid image dimensions for base sprite:', width, 'x', height);
              }
            } else {
              console.error('[addPostSource] Failed to convert base sprite ImageData to Canvas');
            }
          }catch(e){
            console.error('[addPostSource] Error adding small-map-card-pill sprite:', e);
          }
        } else {
          console.log('[addPostSource] small-map-card-pill sprite already exists, skipping');
        }
      } else {
        console.warn('[addPostSource] No base pill sprite available - small pills will not be visible');
      }
      
      if(pillSprites && pillSprites.highlight && pillSprites.highlight.image){
        // Skip if image already exists - prevents dimension mismatch errors
        if(!map.hasImage(MARKER_LABEL_BG_ACCENT_ID)){
          try {
            // Convert ImageData to Canvas if needed
            const imageToAdd = convertImageDataToCanvas(pillSprites.highlight.image);
            if(imageToAdd){
              // Validate dimensions before adding
              const width = imageToAdd.width || (imageToAdd instanceof ImageData ? imageToAdd.width : 0);
              const height = imageToAdd.height || (imageToAdd instanceof ImageData ? imageToAdd.height : 0);
              if(width > 0 && height > 0){
                map.addImage(MARKER_LABEL_BG_ACCENT_ID, imageToAdd);
                console.log('[addPostSource] Added big-map-card-pill sprite', width, 'x', height);
              } else {
                console.error('[addPostSource] Invalid image dimensions for highlight sprite:', width, 'x', height);
              }
            } else {
              console.error('[addPostSource] Failed to convert highlight sprite ImageData to Canvas');
            }
          }catch(e){
            console.error('[addPostSource] Error adding big-map-card-pill sprite:', e);
          }
        } else {
          console.log('[addPostSource] big-map-card-pill sprite already exists, skipping');
        }
      } else {
        console.warn('[addPostSource] No highlight pill sprite available - big pills will not be visible');
      }
      
      // Add hover pill sprite if available
      if(pillSprites && pillSprites.hover && pillSprites.hover.image){
        // Skip if image already exists - prevents dimension mismatch errors
        if(!map.hasImage('hover-map-card-pill')){
          try {
            const imageToAdd = convertImageDataToCanvas(pillSprites.hover.image);
            if(imageToAdd){
              // Validate dimensions before adding
              const width = imageToAdd.width || (imageToAdd instanceof ImageData ? imageToAdd.width : 0);
              const height = imageToAdd.height || (imageToAdd instanceof ImageData ? imageToAdd.height : 0);
              if(width > 0 && height > 0){
                map.addImage('hover-map-card-pill', imageToAdd);
                console.log('[addPostSource] Added hover-map-card-pill sprite', width, 'x', height);
              } else {
                console.error('[addPostSource] Invalid image dimensions for hover sprite:', width, 'x', height);
              }
            } else {
              console.error('[addPostSource] Failed to convert hover sprite ImageData to Canvas');
            }
          }catch(e){
            console.error('[addPostSource] Error adding hover-map-card-pill sprite:', e);
          }
        } else {
          console.log('[addPostSource] hover-map-card-pill sprite already exists, skipping');
        }
      }
      
      updateMapFeatureHighlights(lastHighlightedPostIds);
      
      const markerLabelBaseConditions = [
        ['!',['has','point_count']],
        ['has','title']
      ];
      const markerLabelFilter = ['all', ...markerLabelBaseConditions];

      const markerLabelIconImage = MARKER_LABEL_BG_ID;
      const markerLabelHighlightIconImage = MARKER_LABEL_BG_ACCENT_ID;

      const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
      const mapCardDisplay = document.body.getAttribute('data-map-card-display') || 'always';
      // Small pill: Uses 'small-map-card-pill' sprite by default, switches to 'hover-map-card-pill' on hover
      // In hover_only mode, only show when highlighted (opacity 0 when not highlighted, 1 when highlighted)
      // In always mode, always show (opacity 1)
      // Check if hover pill exists BEFORE creating expression (can't call map.hasImage inside expression)
      const hasHoverPill = map.hasImage('hover-map-card-pill');
      const smallPillIconImageExpression = hasHoverPill
        ? [
            'case',
            highlightedStateExpression,
            'hover-map-card-pill',
            'small-map-card-pill'
          ]
        : 'small-map-card-pill'; // Fallback to base pill if hover pill doesn't exist
      const smallPillOpacity = mapCardDisplay === 'hover_only' 
        ? ['case', highlightedStateExpression, 1, 0]
        : 1;
      // Big pill layer should be visible (opacity 1) when post is active (clicked/open), invisible (0) when not active
      // Use isActive feature state for active posts, not isHighlighted (hover)
      const activeStateExpression = ['boolean', ['feature-state', 'isActive'], false];
      const markerLabelHighlightOpacity = ['case', activeStateExpression, 1, 0];

      const markerLabelMinZoom = MARKER_MIN_ZOOM;
      
      // Composite sprite layers: Use composite sprites that combine pill + label + icon
      // Small composites: left edge at -20px from lat/lng (150Ã—40px)
      // Big composites: left edge at -35px from lat/lng (225Ã—60px)
      
      // Composite icon expressions that switch based on feature state
      // Small composite: use hover composite when highlighted, base composite otherwise
      const smallCompositeIconExpression = [
        'case',
        highlightedStateExpression,
        ['coalesce', ['get', 'hoverCompositeId'], ['get', 'compositeId'], smallPillIconImageExpression],
        ['coalesce', ['get', 'compositeId'], smallPillIconImageExpression]
      ];
      
      // Big composite: use big composite when active, nothing otherwise (handled by opacity)
      const bigCompositeIconExpression = [
        'coalesce',
        ['get', 'bigCompositeId'],
        'big-map-card-pill' // Fallback to old system
      ];
      
      const labelLayersConfig = [
        { 
          id:'small-map-card-composite', 
          source:'posts', 
          sortKey: 1, 
          filter: markerLabelFilter, 
          iconImage: smallCompositeIconExpression, 
          iconOpacity: smallPillOpacity, 
          minZoom: markerLabelMinZoom, 
          iconOffset: [-20, 0] 
        },
        { 
          id:'big-map-card-composite', 
          source:'posts', 
          sortKey: 2, 
          filter: markerLabelFilter, 
          iconImage: bigCompositeIconExpression, 
          iconOpacity: markerLabelHighlightOpacity, 
          minZoom: markerLabelMinZoom, 
          iconOffset: [-35, 0] 
        }
      ];
      
      labelLayersConfig.forEach(({ id, source, sortKey, filter, iconImage, iconOpacity, minZoom, iconSize, iconOffset }) => {
        const layerMinZoom = Number.isFinite(minZoom) ? minZoom : markerLabelMinZoom;
        const finalIconSize = iconSize !== undefined ? iconSize : 1;
        const finalIconOffset = iconOffset || [0, 0];
        let layerExists = !!map.getLayer(id);
        if(!layerExists){
          try{
            map.addLayer({
              id,
              type:'symbol',
              source,
              filter: filter || markerLabelFilter,
              minzoom: layerMinZoom,
              maxzoom: 24,
              layout:{
                'icon-image': iconImage || markerLabelIconImage,
                'icon-size': finalIconSize,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-anchor': 'left',
                'icon-pitch-alignment': 'viewport',
                'symbol-z-order': 'viewport-y',
                'symbol-sort-key': sortKey
              },
              paint:{
                'icon-translate': finalIconOffset,
                'icon-translate-anchor': 'viewport',
                'icon-opacity': iconOpacity || 1
              }
            });
            layerExists = !!map.getLayer(id);
          }catch(e){
            layerExists = !!map.getLayer(id);
          }
        }
        if(!layerExists){
          return;
        }
        // Update filter and icon-image
        try{ map.setFilter(id, filter || markerLabelFilter); }catch(e){}
        if(iconImage){
          try{ map.setLayoutProperty(id, 'icon-image', iconImage); }catch(e){}
        }
      });
      
      // Keep old layers for backward compatibility (hide them)
      const oldLayers = ['small-map-card-pill', 'big-map-card-pill'];
      oldLayers.forEach(layerId => {
        if(map.getLayer(layerId)){
          try{ map.setLayoutProperty(layerId, 'visibility', 'none'); }catch(e){}
        }
      });
      
      // Text labels are now part of composite sprites, so we hide the old text layers
      // Keep them for backward compatibility but hide them
      const oldTextLayers = ['small-map-card-label', 'big-map-card-label'];
      oldTextLayers.forEach(layerId => {
        if(map.getLayer(layerId)){
          try{ map.setLayoutProperty(layerId, 'visibility', 'none'); }catch(e){}
        }
      });
      // Create marker-icon layer (sprites are already loaded above)
      const markerIconFilter = ['all',
        ['!',['has','point_count']],
        ['has','title']
      ];
      const markerIconImageExpression = ['let', 'iconId', ['coalesce', ['get','sub'], ''],
        ['case',
          ['==', ['var','iconId'], ''],
          MULTI_POST_MARKER_ICON_ID,
          ['var','iconId']
        ]
      ];
      const markerIconLayerId = 'mapmarker-icon';
      if(!map.getLayer(markerIconLayerId)){
        try{
          map.addLayer({
            id: markerIconLayerId,
            type:'symbol',
            source:'posts',
            filter: markerIconFilter,
            minzoom: MARKER_MIN_ZOOM,
            layout:{
              'icon-image': markerIconImageExpression,
              'icon-size': 1,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'icon-offset': [0, 0],
              'icon-pitch-alignment': 'viewport',
              'symbol-z-order': 'auto',
              'symbol-sort-key': 8,
              'visibility': 'visible'
            },
            paint:{
              'icon-opacity': 1
            }
          });
        }catch(e){}
      }
      if(map.getLayer(markerIconLayerId)){
        try{
          // Only update properties that can change (filter and icon-image based on data)
          map.setFilter(markerIconLayerId, markerIconFilter);
          map.setLayoutProperty(markerIconLayerId, 'icon-image', markerIconImageExpression);
        }catch(e){}
      }
      
      // Layer ordering will be set at the end after all layers are created
      [
        ['small-map-card-composite','icon-opacity-transition'],
        ['big-map-card-composite','icon-opacity-transition']
      ].forEach(([layer, prop])=>{
        if(map.getLayer(layer)){
          try{ map.setPaintProperty(layer, prop, {duration:0}); }catch(e){}
        }
      });
      
      function updateMapCardLayerOpacity(displayMode){
        if(!map) return;
        const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
        // Small composite: in hover_only mode, only show when highlighted; in always mode, always show
        if(map.getLayer('small-map-card-composite')){
          const smallCompositeOpacity = displayMode === 'hover_only' 
            ? ['case', highlightedStateExpression, 1, 0]
            : 1;
          try{ map.setPaintProperty('small-map-card-composite', 'icon-opacity', smallCompositeOpacity); }catch(e){}
        }
        // Big composite: only show when post is active/open (not on hover)
        if(map.getLayer('big-map-card-composite')){
          const activeStateExpression = ['boolean', ['feature-state', 'isActive'], false];
          const bigCompositeOpacity = ['case', activeStateExpression, 1, 0];
          try{ map.setPaintProperty('big-map-card-composite', 'icon-opacity', bigCompositeOpacity); }catch(e){}
        }
        // Keep old layers hidden (backward compatibility)
        const oldLayers = ['small-map-card-pill', 'big-map-card-pill', 'small-map-card-label', 'big-map-card-label'];
        oldLayers.forEach(layerId => {
          if(map.getLayer(layerId)){
            try{ map.setLayoutProperty(layerId, 'visibility', 'none'); }catch(e){}
          }
        });
        // marker-icon visibility/opacity handled in final ordering section
      }
      window.updateMapCardLayerOpacity = updateMapCardLayerOpacity;
      window.getMapInstance = () => map; // Expose map instance getter
      
      updateMapCardLayerOpacity(mapCardDisplay);
      
      // Final layer ordering (bottom to top): composites -> icons
      // Ensure marker-icon layer is visible and on top
      if(map.getLayer('mapmarker-icon')){
        try{
          map.setLayoutProperty('mapmarker-icon', 'visibility', 'visible');
          map.setPaintProperty('mapmarker-icon', 'icon-opacity', 1);
          map.moveLayer('mapmarker-icon'); // Move icons to top
        }catch(e){}
      }
      // Move composite layers to be below icons
      if(map.getLayer('small-map-card-composite')){
        try{
          if(map.getLayer('mapmarker-icon')){
            map.moveLayer('small-map-card-composite', 'mapmarker-icon'); // Composites below icons
          } else {
            map.moveLayer('small-map-card-composite'); // Move to top if no icon layer
          }
        }catch(e){}
      }
      if(map.getLayer('big-map-card-composite')){
        try{
          if(map.getLayer('mapmarker-icon')){
            map.moveLayer('big-map-card-composite', 'mapmarker-icon'); // Composites below icons
          }
        }catch(e){}
      }
      
      if(!postSourceEventsBound){

        const handleMarkerClick = (e)=>{
          const stopSpin = getStopSpin();
          stopSpin();
          const f = e.features && e.features[0]; if(!f) return;
          const props = f.properties || {};
          const venueKey = props.venueKey || null;
          const id = props.id;
          const rawMultiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
          const normalizedMultiIds = rawMultiIds.map(item => String(item)).filter(Boolean);
          const multiCountFromProps = Number(props.multiCount);
          let normalizedMultiCount = Number.isFinite(multiCountFromProps) && multiCountFromProps > 0 ? multiCountFromProps : 0;
          if(!normalizedMultiCount){
            normalizedMultiCount = normalizedMultiIds.length;
          }
          const helperMultiCount = Math.max(normalizedMultiIds.length, normalizedMultiCount, props.isMultiPost ? 2 : 0);
          const isMultiPost = helperMultiCount > 1;
          const touchClick = isTouchDevice || (e.originalEvent && (e.originalEvent.pointerType === 'touch' || e.originalEvent.pointerType === 'pen'));
          
            // Add clicked state to mapcard and update icon-size
            if(id !== undefined && id !== null){
              const mapCard = document.querySelector(`.small-map-card[data-id="${id}"]`);
              if(mapCard){
                document.querySelectorAll('.small-map-card').forEach(card => {
                  card.classList.remove('is-clicked');
                });
                mapCard.classList.add('is-clicked');
              }
              // Update icon-size for expanded state
              if(typeof updateMarkerLabelHighlightIconSize === 'function'){
                updateMarkerLabelHighlightIconSize();
              }
            }
          
          if(touchClick){
            // Two-tap system: first tap shows accent pill, second tap opens post
            if(touchMarker === id){
              // Second tap on same marker - open the post
              touchMarker = null;
              hoveredPostIds = [];
              if(id !== undefined && id !== null){
                activePostId = id;
                selectedVenueKey = venueKey;
                const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
              }
              const p = posts.find(x=>x.id===id);
              if(p){
                callWhenDefined('openPost', (fn)=>{
                  requestAnimationFrame(() => {
                    try{
                      const stopSpin = getStopSpin();
          stopSpin();
                      if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                        try{ closePanel(filterPanel); }catch(err){}
                      }
                      fn(id, false, true, null);
                    }catch(err){ console.error(err); }
                  });
                });
              }
              if(isMultiPost){
                autoOpenPostBoardForMultiPost({
                  multiIds: normalizedMultiIds,
                  multiCount: helperMultiCount,
                  trigger: 'touch'
                });
              }
              return;
            } else {
              // First tap - show accent pill, don't open
              touchMarker = id;
              if(id !== undefined && id !== null){
                hoveredPostIds = [{ id: String(id), venueKey: venueKey }];
                const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
              }
              return;
            }
          }
          
          // Non-touch: open immediately
          if(id !== undefined && id !== null){
            activePostId = id;
            selectedVenueKey = venueKey;
            const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
          }
          const coords = f.geometry && f.geometry.coordinates;
          const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
          const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const targetLngLat = baseLngLat || (e ? e.lngLat : null);
          if(isMultiPost){
            autoOpenPostBoardForMultiPost({
              multiIds: normalizedMultiIds,
              multiCount: helperMultiCount,
              trigger: 'click'
            });
          } else {
            const p = posts.find(x=>x.id===id);
            if(p){
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    touchMarker = null;
                    const stopSpin = getStopSpin();
          stopSpin();
                    if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                      try{ closePanel(filterPanel); }catch(err){}
                    }
                    fn(id, false, true, null);
                  }catch(err){ console.error(err); }
                });
              });
            }
          }
        };
      // Attach click handlers to interactive layers (dynamic based on mapCardDisplay)
      const attachClickHandlers = () => {
        // Remove old handlers from all possible layers
        const allPossibleLayers = ['mapmarker-icon', 'small-map-card-pill', 'big-map-card-pill'];
        allPossibleLayers.forEach(layer => {
          try {
            map.off('click', layer, handleMarkerClick);
          } catch(e) {}
        });
        // Add handlers to current interactive layers
        const getMarkerInteractiveLayers = getGetMarkerInteractiveLayers();
        getMarkerInteractiveLayers().forEach(layer => {
          try {
            map.on('click', layer, handleMarkerClick);
          } catch(e) {}
        });
      };
      attachClickHandlers();
      // Expose globally so handlers can be updated when mapCardDisplay changes
      window.attachClickHandlers = attachClickHandlers;

      // Function to update mapcard click and post-open states
      function updateMapCardStates(){
        const openPostEl = document.querySelector('.open-post[data-id]');
        const openPostId = openPostEl && openPostEl.dataset ? String(openPostEl.dataset.id || '') : '';
        
        // Remove all click and post-open states
        document.querySelectorAll('.small-map-card').forEach(card => {
          card.classList.remove('is-clicked', 'is-post-open');
        });
        
        // Add post-open state to mapcard if post is open
        if(openPostId){
          const mapCard = document.querySelector(`.small-map-card[data-id="${openPostId}"]`);
          if(mapCard){
            mapCard.classList.add('is-post-open');
          }
        }
      }
      
      // Expose globally
      window.updateMapCardStates = updateMapCardStates;
      
      map.on('click', e=>{
        const originalTarget = e.originalEvent && e.originalEvent.target;
        const targetEl = originalTarget && typeof originalTarget.closest === 'function'
          ? originalTarget.closest('.mapmarker-overlay, .small-map-card')
          : null;
        if(targetEl){
          const smallMapCard = targetEl.classList.contains('small-map-card') 
            ? targetEl 
            : targetEl.querySelector('.small-map-card');
          if(smallMapCard && smallMapCard.dataset && smallMapCard.dataset.id){
            const pid = smallMapCard.dataset.id;
            
            // Add clicked state
            document.querySelectorAll('.small-map-card').forEach(card => {
              card.classList.remove('is-clicked');
            });
            smallMapCard.classList.add('is-clicked');
            
            callWhenDefined('openPost', (fn)=>{
              requestAnimationFrame(() => {
                try{
                  touchMarker = null;
                  const stopSpin = getStopSpin();
          stopSpin();
                  if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                    try{ closePanel(filterPanel); }catch(err){}
                  }
                  fn(pid, false, true, null);
                }catch(err){ console.error(err); }
              });
            });
          }
          return;
        }
        const feats = map.queryRenderedFeatures(e.point);
        if(!feats.length){
          // Clicked elsewhere - remove click states
          document.querySelectorAll('.small-map-card').forEach(card => {
            card.classList.remove('is-clicked');
          });
          updateSelectedMarkerRing();
          touchMarker = null;
          hoveredPostIds = [];
          updateSelectedMarkerRing();
          updateMapCardStates();
        } else {
          const getMarkerInteractiveLayers = getGetMarkerInteractiveLayers();
          const clickedMarkerLabel = feats.some(f => getMarkerInteractiveLayers().includes(f.layer && f.layer.id));
          if(!clickedMarkerLabel){
            // Clicked elsewhere - remove click states
            document.querySelectorAll('.small-map-card').forEach(card => {
              card.classList.remove('is-clicked');
            });
            touchMarker = null;
            hoveredPostIds = [];
            const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
            updateMapCardStates();
          }
        }
      });

      updateSelectedMarkerRing();

      // Set pointer cursor when hovering over markers (dynamic based on mapCardDisplay)
      // Store cursor handler functions so we can remove only these specific handlers
      const cursorEnterHandler = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      const cursorLeaveHandler = () => {
        map.getCanvas().style.cursor = 'grab';
      };
      const attachCursorHandlers = () => {
        // Remove only our cursor handlers from all possible layers
        const allPossibleLayers = ['mapmarker-icon', 'small-map-card-pill', 'big-map-card-pill'];
        allPossibleLayers.forEach(layer => {
          try {
            map.off('mouseenter', layer, cursorEnterHandler);
            map.off('mouseleave', layer, cursorLeaveHandler);
          } catch(e) {}
        });
        // Add cursor handlers to current interactive layers only
        const getMarkerInteractiveLayers = getGetMarkerInteractiveLayers();
        getMarkerInteractiveLayers().forEach(layer => {
          try {
            map.on('mouseenter', layer, cursorEnterHandler);
            map.on('mouseleave', layer, cursorLeaveHandler);
          } catch(e) {}
        });
      };
      attachCursorHandlers();
      // Expose globally so handlers can be updated when mapCardDisplay changes
      window.attachCursorHandlers = attachCursorHandlers;

      // Handle hover/tap to show accent pill
      // Uses Mapbox sprite layer system only - no DOM handlers to avoid conflicts
      // Only uses marker-icon layer for precise hover zone
      // Uses mousemove to track hover continuously for smooth transitions between markers
      let currentHoveredId = null;
      let hoverCheckTimeout = null;
      
      const updateHoverFromPoint = (point) => {
        if(!point) return;
        
        // Clear any pending hover check
        if(hoverCheckTimeout){
          clearTimeout(hoverCheckTimeout);
          hoverCheckTimeout = null;
        }
        
        // Query what's under the cursor
        const features = map.queryRenderedFeatures(point, {
          layers: ['mapmarker-icon']
        });
        
        if(features.length > 0){
          const f = features[0];
          const props = f.properties || {};
          const id = props.id;
          const venueKey = props.venueKey || null;
          
          if(id !== undefined && id !== null && String(id) !== currentHoveredId){
            currentHoveredId = String(id);
            hoveredPostIds = [{ id: String(id), venueKey: venueKey }];
            const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
          }
        } else {
          // Not over any marker - clear hover after a short delay
          hoverCheckTimeout = setTimeout(() => {
            // Double-check we're still not over a marker
            const recheckFeatures = map.queryRenderedFeatures(point, {
              layers: ['mapmarker-icon']
            });
            if(recheckFeatures.length === 0){
              currentHoveredId = null;
              hoveredPostIds = [];
              const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
            }
            hoverCheckTimeout = null;
          }, 50);
        }
      };
      
      const handleMarkerHover = (e) => {
        // Cancel any pending hover clear
        if(hoverCheckTimeout){
          clearTimeout(hoverCheckTimeout);
          hoverCheckTimeout = null;
        }
        
        const f = e.features && e.features[0];
        if(!f) return;
        const props = f.properties || {};
        const id = props.id;
        const venueKey = props.venueKey || null;
        
        if(id !== undefined && id !== null){
          currentHoveredId = String(id);
          hoveredPostIds = [{ id: String(id), venueKey: venueKey }];
          updateSelectedMarkerRing();
        }
      };

      const handleMarkerHoverEnd = (e) => {
        // Use mousemove to check what we're over now - this handles smooth transitions
        if(e.point){
          updateHoverFromPoint(e.point);
        } else {
          // No point info, clear after delay
          hoverCheckTimeout = setTimeout(() => {
            currentHoveredId = null;
            hoveredPostIds = [];
            const updateSelectedMarkerRing = getUpdateSelectedMarkerRing();
            updateSelectedMarkerRing();
            hoverCheckTimeout = null;
          }, 50);
        }
      };
      
      // Also track mousemove over the map to catch transitions between markers
      const handleMapMouseMove = (e) => {
        if(e.point){
          updateHoverFromPoint(e.point);
        }
      };
      
      // Expose hover handlers globally so they can be updated when mapCardDisplay changes
      window.handleMarkerHover = handleMarkerHover;
      window.handleMarkerHoverEnd = handleMarkerHoverEnd;

      // Add hover handlers - ONLY on marker-icon layer for precise hover zone
      // marker-icon is a small icon (30px), so hover zone is precise and matches visual
      // Using only marker-icon ensures hover works reliably and precisely
      map.on('mouseenter', 'mapmarker-icon', handleMarkerHover);
      map.on('mouseleave', 'mapmarker-icon', handleMarkerHoverEnd);
      // Track mousemove to catch smooth transitions between markers
      map.on('mousemove', 'mapmarker-icon', handleMapMouseMove);


      // Maintain pointer cursor for balloons and surface multi-post cards when applicable
        postSourceEventsBound = true;
      }
      } catch (err) {
        console.error('addPostSource failed', err);
      } finally {
        addingPostSource = false;
        const shouldReplay = pendingAddPostSource;
        pendingAddPostSource = false;
        if(shouldReplay){
          addPostSource();
        }
      }
    }

  // ============================================================================
  // EXPORTS
  // ============================================================================
  
  // Expose map instance getter
  window.getMapInstance = function() {
    return map;
  };

  // Expose map initialization function
  window.initMap = initMap;

  // Expose other map functions that may be called from index.js
  window.updateMapCardLayerOpacity = updateMapCardLayerOpacity;
  window.updateMarkerLabelHighlightIconSize = updateMarkerLabelHighlightIconSize;
  window.updateMapFeatureHighlights = updateMapFeatureHighlights;
  window.loadPostMarkers = loadPostMarkers;
  window.addPostSource = addPostSource;
  window.syncGeocoderProximityToMap = syncGeocoderProximityToMap;
  window.clearMapGeocoder = clearMapGeocoder;
  window.setupSeedLayers = setupSeedLayers;
  window.updateBalloonSourceForZoom = updateBalloonSourceForZoom;
  window.clearMapCardComposites = clearMapCardComposites;
  window.ensureMapCardComposite = ensureMapCardComposite;
  window.ensureMarkerLabelPillSprites = ensureMarkerLabelPillSprites;
  window.ensureMapboxCssFor = ensureMapboxCssFor;
  window.whenStyleReady = whenStyleReady;
  window.applyNightSky = applyNightSky;
  window.patchMapboxStyleArtifacts = patchMapboxStyleArtifacts;
  window.armPointerOnSymbolLayers = armPointerOnSymbolLayers;
  window.MapRegistry = MapRegistry;

})();
