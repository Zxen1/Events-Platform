// ============================================================================
// SPRITE MARKER SYSTEM - Fresh implementation with smooth animations
// ============================================================================
async function initSpriteMarkers(map, postsData, options = {}) {
  if(!map || !postsData) return;
  
  // Prevent multiple simultaneous initializations
  if(map._spriteMarkersInitializing){
    console.log('[Sprite Markers] Already initializing, skipping...');
    return;
  }
  map._spriteMarkersInitializing = true;
  
  const MARKER_MIN_ZOOM = options.minZoom || 8;
  const MULTI_POST_MARKER_ICON_ID = options.multiPostIconId || 'multi-post-icon';
  const subcategoryMarkers = options.subcategoryMarkers || window.subcategoryMarkers || {};
  const markerIconBaseSizePx = 30;
  const markerIconActiveSizePx = 50;
  const baseIconSize = 1; // Base size multiplier (30px)
  const activeIconSize = markerIconActiveSizePx / markerIconBaseSizePx; // ~1.67 for 50px
  
  // Helper functions
  const loadMarkerLabelImage = window.loadMarkerLabelImage || (async (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  });
  
  const thumbUrl = window.thumbUrl || (() => null);
  
  // Thumbnail sprite cache
  const thumbnailCache = new Map();
  
  // Function to load thumbnail as sprite
  const loadThumbnailSprite = async (postId, featureId) => {
    if(!postId || !thumbUrl) return null;
    
    const spriteId = `marker-thumb-${postId}`;
    
    // Already loaded
    if(map.hasImage(spriteId)){
      return spriteId;
    }
    
    // Already loading
    if(thumbnailCache.has(spriteId)){
      return await thumbnailCache.get(spriteId);
    }
    
    const thumbnailUrl = thumbUrl(postId);
    if(!thumbnailUrl) return null;
    
    const loadPromise = (async () => {
      try{
        const img = await loadMarkerLabelImage(thumbnailUrl);
        if(!img) return null;
        
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
        
        // Use active size for thumbnail to ensure quality
        const iconSize = Math.round(markerIconActiveSizePx * deviceScale);
        const canvas = document.createElement('canvas');
        canvas.width = iconSize;
        canvas.height = iconSize;
        const ctx = canvas.getContext('2d');
        if(ctx){
          // Draw thumbnail, cropping to square and centering
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;
          ctx.drawImage(img, x, y, size, size, 0, 0, iconSize, iconSize);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          map.addImage(spriteId, imageData, { pixelRatio: deviceScale });
          return spriteId;
        }
      }catch(e){
        console.warn('[Sprite Markers] Failed to load thumbnail for post:', postId, e);
      }
      return null;
    })();
    
    thumbnailCache.set(spriteId, loadPromise);
    const result = await loadPromise;
    if(result){
      thumbnailCache.set(spriteId, Promise.resolve(result));
    } else {
      thumbnailCache.delete(spriteId);
    }
    return result;
  };
  
  // Pre-load marker-icon sprites
  const markerIconIds = new Set();
  postsData.features.forEach(feature => {
    if(feature.properties && !feature.properties.point_count){
      const iconId = feature.properties.sub || MULTI_POST_MARKER_ICON_ID;
      markerIconIds.add(iconId);
    }
  });
  markerIconIds.add(MULTI_POST_MARKER_ICON_ID);
  
  // Load all icon sprites
  let loadedIconCount = 0;
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
            loadedIconCount++;
            console.log('[Sprite Markers] Loaded icon sprite:', iconId);
          }
        }
      }catch(e){
        console.warn('[Sprite Markers] Failed to load icon:', iconId, e);
      }
    } else if(map.hasImage(iconId)){
      loadedIconCount++;
    }
  }
  console.log('[Sprite Markers] Loaded', loadedIconCount, 'icon sprites');
  
  // Create marker-icon layer with dynamic size and image switching
  // Filter: exclude cluster points, but don't require title (some features might not have it)
  const markerIconFilter = ['!',['has','point_count']];
  
  // Icon image expression: use thumbnail if hovered/active, otherwise use icon
  // Note: If thumbnail sprite doesn't exist yet, Mapbox will fall back gracefully
  // Use string literal directly for fallback icon ID
  const markerIconImageExpression = [
    'let', 'postId', ['get', 'id'],
    'let', 'isHovered', ['boolean', ['feature-state', 'isHovered'], false],
    'let', 'isActive', ['boolean', ['feature-state', 'isActive'], false],
    'let', 'isPostOpen', ['boolean', ['feature-state', 'isPostOpen'], false],
    'let', 'showThumbnail', ['any', ['var', 'isHovered'], ['var', 'isActive'], ['var', 'isPostOpen']],
    'let', 'iconId', ['coalesce', ['get','sub'], MULTI_POST_MARKER_ICON_ID], // Variable will be evaluated to string
    'let', 'thumbSpriteId', ['concat', 'marker-thumb-', ['to-string', ['var', 'postId']]],
    ['case',
      ['var', 'showThumbnail'],
      ['var', 'thumbSpriteId'],
      ['var', 'iconId']
    ]
  ];
  
  console.log('[Sprite Markers] Icon image expression:', JSON.stringify(markerIconImageExpression));
  
  // Icon size expression: 1.67x (50px) when active/open, 1x (30px) otherwise
  const markerIconSizeExpression = [
    'let', 'isActive', ['boolean', ['feature-state', 'isActive'], false],
    'let', 'isPostOpen', ['boolean', ['feature-state', 'isPostOpen'], false],
    ['case',
      ['any', ['var', 'isActive'], ['var', 'isPostOpen']],
      activeIconSize,
      baseIconSize
    ]
  ];
  
  const markerIconLayerId = 'marker-icon';
  
  // Only create layer if it doesn't exist - don't remove/recreate on every call
  if(map.getLayer(markerIconLayerId)){
    console.log('[Sprite Markers] Layer already exists, updating filter and properties');
    try{
      // Update filter and properties without recreating
      map.setFilter(markerIconLayerId, markerIconFilter);
      map.setLayoutProperty(markerIconLayerId, 'icon-image', markerIconImageExpression);
      map.setLayoutProperty(markerIconLayerId, 'icon-size', markerIconSizeExpression);
      map._spriteMarkersInitializing = false;
      return; // Layer already exists, just update it
    }catch(e){
      console.warn('[Sprite Markers] Failed to update existing layer:', e);
      // If update fails, remove and recreate
      try{
        map.removeLayer(markerIconLayerId);
      }catch(e2){}
    }
  }
  
  // Create new marker-icon layer
  try{
    // Check if posts source exists
    const postsSource = map.getSource('posts');
    if(!postsSource){
      console.error('[Sprite Markers] Posts source not found');
      return;
    }
    
    const featureCount = postsData.features ? postsData.features.length : 0;
    console.log('[Sprite Markers] Creating marker-icon layer with', featureCount, 'features');
    
    map.addLayer({
      id: markerIconLayerId,
      type:'symbol',
      source:'posts',
      filter: markerIconFilter,
      minzoom: MARKER_MIN_ZOOM,
      maxzoom: 24,
      layout:{
        'icon-image': markerIconImageExpression,
        'icon-size': markerIconSizeExpression,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center',
        'icon-pitch-alignment': 'viewport',
        'symbol-z-order': 'viewport-y',
        'symbol-sort-key': 10,
        'visibility': 'visible'
      },
      paint:{
        'icon-opacity': 1
      }
    });
    
    // Add smooth transitions for icon-size changes (300ms like DOM version)
    map.setPaintProperty(markerIconLayerId, 'icon-size-transition', {
      duration: 300,
      delay: 0
    });
    
    console.log('[Sprite Markers] Marker-icon layer created successfully');
    
  }catch(e){
    console.error('[Sprite Markers] Failed to create marker-icon layer:', e);
    return;
  }
  
  // Function to update marker feature state
  const updateMarkerState = (featureId, state) => {
    if(!map || !featureId) return;
    try{
      const source = 'posts';
      map.setFeatureState({ source, id: featureId }, state);
    }catch(e){
      // Feature might not exist yet, that's okay
    }
  };
  
  // Function to handle marker hover
  const handleMarkerHover = (e) => {
    if(!e.features || !e.features.length) return;
    const feature = e.features[0];
    const featureId = feature.id;
    const props = feature.properties || {};
    const postId = props.id;
    
    if(!featureId || !postId) return;
    
    // Load thumbnail if not already loaded (async, don't wait)
    loadThumbnailSprite(postId, featureId).then(thumbSpriteId => {
      if(thumbSpriteId){
        // Update to show thumbnail
        updateMarkerState(featureId, { isHovered: true });
      }
    });
  };
  
  const handleMarkerHoverEnd = (e) => {
    if(!e.features || !e.features.length) return;
    const feature = e.features[0];
    const featureId = feature.id;
    
    if(!featureId) return;
    
    // Only clear hover if not active/open
    const source = map.getSource('posts');
    if(source){
      try{
        const currentState = map.getFeatureState({ source: 'posts', id: featureId });
        if(!currentState.isActive && !currentState.isPostOpen){
          updateMarkerState(featureId, { isHovered: false });
        }
      }catch(e){}
    }
  };
  
  // Function to handle marker click
  const handleMarkerClick = (e) => {
    if(!e.features || !e.features.length) return;
    e.preventDefault();
    
    const feature = e.features[0];
    const featureId = feature.id;
    const props = feature.properties || {};
    const postId = props.id;
    
    if(!featureId || !postId) return;
    
    // Load thumbnail and set active
    loadThumbnailSprite(postId, featureId).then(thumbSpriteId => {
      if(thumbSpriteId){
        updateMarkerState(featureId, { isActive: true, isHovered: false });
        
        // Open post after animation (300ms like DOM version)
        setTimeout(() => {
          const callWhenDefined = window.callWhenDefined || function(name, invoke) {
            if(typeof window[name] === 'function'){
              invoke(window[name]);
            } else {
              setTimeout(() => callWhenDefined(name, invoke), 50);
            }
          };
          
          callWhenDefined('openPost', (fn) => {
            requestAnimationFrame(() => {
              try{
                const stopSpin = window.stopSpin || (() => {});
                stopSpin();
                
                if(typeof window.closePanel === 'function' && typeof window.filterPanel !== 'undefined' && window.filterPanel){
                  try{ window.closePanel(window.filterPanel); }catch(err){}
                }
                fn(postId, false, true, null);
              }catch(err){ 
                console.error('Error opening post:', err); 
              }
            });
          });
        }, 300);
      }
    });
  };
  
  // Attach event handlers
  try{
    map.on('mouseenter', markerIconLayerId, handleMarkerHover);
    map.on('mouseleave', markerIconLayerId, handleMarkerHoverEnd);
    map.on('click', markerIconLayerId, handleMarkerClick);
  }catch(e){
    console.error('[Sprite Markers] Failed to attach event handlers:', e);
  }
  
  // Monitor for post open/close to update isPostOpen state
  const updateActivePostMarkers = () => {
    if(!map) return;
    
    const activePostId = window.activePostId || null;
    const openPostEl = document.querySelector('.open-post[data-id]');
    const openPostId = openPostEl && openPostEl.dataset ? String(openPostEl.dataset.id || '') : '';
    const currentOpenPostId = activePostId !== undefined && activePostId !== null ? String(activePostId) : openPostId;
    
    // Get all features and update their state
    const source = map.getSource('posts');
    if(!source || !source._data || !Array.isArray(source._data.features)) return;
    
    source._data.features.forEach(feature => {
      if(!feature || !feature.properties || feature.properties.point_count) return;
      const featureId = feature.id;
      const postId = feature.properties.id;
      
      if(!featureId || !postId) return;
      
      const isOpen = currentOpenPostId && String(postId) === String(currentOpenPostId);
      updateMarkerState(featureId, { isPostOpen: isOpen });
      
      // Clear active state if post closed
      if(!isOpen){
        updateMarkerState(featureId, { isActive: false });
      }
    });
  };
  
  // Monitor for post changes
  const observePostChanges = () => {
    updateActivePostMarkers();
    
    if(typeof MutationObserver !== 'undefined'){
      const observer = new MutationObserver(() => {
        updateActivePostMarkers();
      });
      observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['data-id', 'class']
      });
    }
    
    let lastActivePostId = window.activePostId;
    setInterval(() => {
      if(window.activePostId !== lastActivePostId){
        lastActivePostId = window.activePostId;
        updateActivePostMarkers();
      }
    }, 100);
  };
  
  observePostChanges();
  
  // Move marker-icon layer to top
  try{ 
    map.moveLayer(markerIconLayerId);
  }catch(e){}
  
  // Store functions globally for cleanup/access
  window.updateSpriteMarkerState = updateMarkerState;
  window.loadThumbnailSprite = loadThumbnailSprite;
  
  // Clear initialization flag
  map._spriteMarkersInitializing = false;
}

// Export to window
window.initSpriteMarkers = initSpriteMarkers;

// ============================================================================
// OLD DOM MARKER CODE - Commented out, kept for reference
// ============================================================================
/**
 * DOM-Based Map Markers
 * Handles creation, positioning, and interaction of DOM markers on the map
 * COMMENTED OUT - Returning to sprite system
 */

(function() {
  'use strict';

  /**
   * Initialize DOM markers for the map
   * COMMENTED OUT - Returning to sprite system
   * @param {Object} map - Mapbox map instance
   * @param {Object} postsData - GeoJSON feature collection with post data
   * @param {Object} options - Configuration options
   */
  /*
  function initDomMarkers(map, postsData, options = {}) {
    if(!map || !postsData) return;

    const DOM_MARKER_MIN_ZOOM = options.minZoom || 8;
    const MULTI_POST_MARKER_ICON_ID = options.multiPostIconId || 'multi-post-icon';
    const subcategoryMarkers = options.subcategoryMarkers || window.subcategoryMarkers || {};
    
    // Create container for DOM markers
    const mapContainer = document.getElementById('map');
    if(!mapContainer) return;
    
    let domMarkersContainer = document.getElementById('dom-markers-container');
    if(!domMarkersContainer){
      domMarkersContainer = document.createElement('div');
      domMarkersContainer.id = 'dom-markers-container';
      mapContainer.appendChild(domMarkersContainer);
    }
    
    // Clear existing markers and remove old event listeners
    domMarkersContainer.innerHTML = '';
    if(window._domMarkerMapListeners){
      window._domMarkerMapListeners.forEach(({ event, handler }) => {
        try{ map.off(event, handler); }catch(e){}
      });
      window._domMarkerMapListeners = [];
    }
    
    // Clear old intervals
    if(window._domMarkerIntervals){
      window._domMarkerIntervals.forEach(interval => {
        try{ clearInterval(interval); }catch(e){}
      });
      window._domMarkerIntervals = [];
    }
    
    // Store markers for position updates
    const domMarkers = new Map();
    
    // Function to check if zoom level allows markers
    const isZoomLevelValid = () => {
      if(!map || typeof map.getZoom !== 'function') return false;
      try{
        const zoom = map.getZoom();
        return Number.isFinite(zoom) && zoom >= DOM_MARKER_MIN_ZOOM;
      }catch(e){
        return false;
      }
    };
    
    // Function to update marker visibility based on zoom
    const updateMarkerVisibility = () => {
      const shouldShow = isZoomLevelValid();
      domMarkers.forEach((marker) => {
        marker.element.style.display = shouldShow ? 'block' : 'none';
      });
    };
    
    // Create DOM marker for each feature
    if(Array.isArray(postsData.features)){
      postsData.features.forEach(feature => {
        if(!feature || !feature.geometry || !feature.geometry.coordinates || !feature.properties) return;
        if(feature.properties.point_count) return; // Skip cluster points
        
        const [lng, lat] = feature.geometry.coordinates;
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        
        const props = feature.properties;
        const featureId = props.featureId || props.id || '';
        const postId = props.id;
        
        // Create marker element
        const markerEl = document.createElement('div');
        markerEl.className = 'dom-map-marker';
        markerEl.dataset.featureId = featureId;
        markerEl.dataset.postId = postId || '';
        markerEl.dataset.filtered = 'true'; // Initially visible, will be updated by filter monitoring
        
        // Get icon URL - use subcategory icon or fallback to multi-post icon
        const iconId = props.sub || MULTI_POST_MARKER_ICON_ID;
        const iconUrl = subcategoryMarkers[iconId] || subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] || '';
        const originalIconUrl = iconUrl;
        
        if(iconUrl){
          markerEl.style.backgroundImage = `url(${iconUrl})`;
        } else {
          // Fallback: add class for no-icon styling
          markerEl.classList.add('no-icon');
        }
        
        // Check if this is a multi-post venue marker
        const rawMultiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
        const multiCountFromProps = Number(props.multiCount);
        let normalizedMultiCount = Number.isFinite(multiCountFromProps) && multiCountFromProps > 0 ? multiCountFromProps : 0;
        if(!normalizedMultiCount){
          normalizedMultiCount = rawMultiIds.length;
        }
        const helperMultiCount = Math.max(rawMultiIds.length, normalizedMultiCount, props.isMultiVenue ? 2 : 0);
        const isMultiPost = helperMultiCount > 1;
        
        // Get thumbnail URL - only for single-post markers (not multi-post venues)
        const thumbUrl = window.thumbUrl || (() => null);
        const thumbnailUrl = !isMultiPost && postId && thumbUrl ? thumbUrl(postId) : null;
        
        // Store marker data
        const markerData = {
          element: markerEl,
          lng,
          lat,
          props,
          postId,
          originalIconUrl,
          thumbnailUrl,
          thumbnailLoaded: false,
          thumbnailImg: null,
          isHovered: false,
          isActive: false,
          isPostOpen: false
        };
        
        domMarkers.set(featureId, markerData);
        domMarkersContainer.appendChild(markerEl);
      });
    }
    
    // Function to load thumbnail and replace icon (only after load completes)
    const loadThumbnailForMarker = async (markerData) => {
      if(!markerData.thumbnailUrl) {
        console.log('[Map Markers] No thumbnail URL for marker:', markerData.postId);
        return;
      }
      
      if(markerData.thumbnailLoaded){
        // Already loaded, just show it
        markerData.element.style.backgroundImage = `url(${markerData.thumbnailUrl})`;
        return;
      }
      
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          markerData.thumbnailLoaded = true;
          markerData.thumbnailImg = img;
          // Only replace background after image is fully loaded
          markerData.element.style.backgroundImage = `url(${markerData.thumbnailUrl})`;
          console.log('[Map Markers] Thumbnail loaded for post:', markerData.postId);
          resolve();
        };
        img.onerror = (err) => {
          // If thumbnail fails to load, keep icon
          console.warn('[Map Markers] Failed to load thumbnail for post:', markerData.postId, 'URL:', markerData.thumbnailUrl, err);
          resolve();
        };
        img.src = markerData.thumbnailUrl;
      });
    };
    
    // Function to animate marker size
    const animateMarkerSize = (markerData, targetSize) => {
      if(!markerData || !markerData.element) return;
      markerData.element.style.width = targetSize + 'px';
      markerData.element.style.height = targetSize + 'px';
    };
    
    // Function to update marker appearance based on state
    const updateMarkerAppearance = (markerData) => {
      if(!markerData || !markerData.element) return;
      
      // If post is open or marker is active, show thumbnail and keep at 50px
      if(markerData.isPostOpen || markerData.isActive){
        if(markerData.thumbnailUrl){
          loadThumbnailForMarker(markerData);
        }
        animateMarkerSize(markerData, 50);
      } 
      // If hovered, show thumbnail but keep at 30px
      else if(markerData.isHovered){
        if(markerData.thumbnailUrl){
          loadThumbnailForMarker(markerData);
        }
        animateMarkerSize(markerData, 30);
      }
      // Otherwise, show icon at 30px
      else {
        if(markerData.originalIconUrl){
          markerData.element.style.backgroundImage = `url(${markerData.originalIconUrl})`;
        }
        animateMarkerSize(markerData, 30);
      }
    };
    
    // Function to check and update which post is open
    const updateActivePostMarkers = () => {
      const activePostId = window.activePostId || null;
      const openPostEl = document.querySelector('.open-post[data-id]');
      const openPostId = openPostEl && openPostEl.dataset ? String(openPostEl.dataset.id || '') : '';
      const currentOpenPostId = activePostId !== undefined && activePostId !== null ? String(activePostId) : openPostId;
      
      domMarkers.forEach((markerData) => {
        const isOpen = currentOpenPostId && String(markerData.postId) === String(currentOpenPostId);
        const wasOpen = markerData.isPostOpen;
        markerData.isPostOpen = isOpen;
        
        // If post just closed, clear active state
        if(wasOpen && !isOpen){
          markerData.isActive = false;
        }
        
        updateMarkerAppearance(markerData);
      });
    };
    
    // Monitor for post open/close changes
    const observePostChanges = () => {
      // Check immediately
      updateActivePostMarkers();
      
      // Use MutationObserver to watch for .open-post changes
      if(typeof MutationObserver !== 'undefined'){
        const observer = new MutationObserver(() => {
          updateActivePostMarkers();
        });
        observer.observe(document.body, { 
          childList: true, 
          subtree: true,
          attributes: true,
          attributeFilter: ['data-id', 'class']
        });
      }
      
      // Also poll activePostId changes
      let lastActivePostId = window.activePostId;
      setInterval(() => {
        if(window.activePostId !== lastActivePostId){
          lastActivePostId = window.activePostId;
          updateActivePostMarkers();
        }
      }, 100);
    };
    
    // Start observing post changes
    observePostChanges();
    
    // Function to open post
    const openPostFromMarker = (postId) => {
      if(!postId) return;
      const callWhenDefined = window.callWhenDefined || function(name, invoke) {
        if(typeof window[name] === 'function'){
          invoke(window[name]);
        } else {
          setTimeout(() => callWhenDefined(name, invoke), 50);
        }
      };
      
      callWhenDefined('openPost', (fn) => {
        requestAnimationFrame(() => {
          try{
            const stopSpin = window.stopSpin || (() => {});
            stopSpin();
            
            if(typeof window.closePanel === 'function' && typeof window.filterPanel !== 'undefined' && window.filterPanel){
              try{ window.closePanel(window.filterPanel); }catch(err){}
            }
            fn(postId, false, true, null);
          }catch(err){ 
            console.error('Error opening post:', err); 
          }
        });
      });
    };
    
    // Batch position updates to prevent flicker during zoom/move
    let positionUpdateScheduled = false;
    let positionUpdateTimeout = null;
    const updateDomMarkerPositions = () => {
      if(!map || !domMarkersContainer) return;
      
      // Clear any pending timeout
      if(positionUpdateTimeout){
        clearTimeout(positionUpdateTimeout);
        positionUpdateTimeout = null;
      }
      
      if(positionUpdateScheduled) return;
      positionUpdateScheduled = true;
      
      // Use double RAF for smoother updates, similar to old sprite system
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          positionUpdateScheduled = false;
          if(!map || !domMarkersContainer) return;
          
          const currentZoom = isZoomLevelValid();
          
          domMarkers.forEach((marker, featureId) => {
            try{
              const point = map.project([marker.lng, marker.lat]);
              if(point && Number.isFinite(point.x) && Number.isFinite(point.y)){
                // Use left/top positioning (CSS already has transform for centering)
                const x = Math.round(point.x);
                const y = Math.round(point.y);
                // Only update if position actually changed to reduce flickering
                const currentLeft = marker.element.style.left;
                const currentTop = marker.element.style.top;
                const newLeft = x + 'px';
                const newTop = y + 'px';
                if(currentLeft !== newLeft || currentTop !== newTop){
                  marker.element.style.left = newLeft;
                  marker.element.style.top = newTop;
                }
              }
              // Update visibility based on zoom and filter state
              const isFiltered = marker.element.dataset.filtered !== 'false';
              marker.element.style.display = (currentZoom && isFiltered) ? 'block' : 'none';
            }catch(e){}
          });
        });
      });
    };
    
    // Store event listeners for cleanup
    if(!window._domMarkerMapListeners){
      window._domMarkerMapListeners = [];
    }
    const addMapListener = (event, handler) => {
      map.on(event, handler);
      window._domMarkerMapListeners.push({ event, handler });
    };
    
    // Throttled position updates to prevent flickering
    let lastUpdateTime = 0;
    const THROTTLE_MS = 16; // ~60fps
    const throttledUpdatePositions = () => {
      const now = performance.now();
      if(now - lastUpdateTime < THROTTLE_MS){
        if(!positionUpdateTimeout){
          positionUpdateTimeout = setTimeout(() => {
            positionUpdateTimeout = null;
            lastUpdateTime = performance.now();
            updateDomMarkerPositions();
          }, THROTTLE_MS - (now - lastUpdateTime));
        }
        return;
      }
      lastUpdateTime = now;
      updateDomMarkerPositions();
    };
    
    // Update positions on map events
    addMapListener('move', throttledUpdatePositions);
    addMapListener('zoom', () => {
      throttledUpdatePositions();
      updateMarkerVisibility();
    });
    addMapListener('pitch', throttledUpdatePositions);
    addMapListener('rotate', throttledUpdatePositions);
    
    // Initial position and visibility update
    updateDomMarkerPositions();
    updateMarkerVisibility();
    
    // Click/tap handlers
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    let touchMarkerId = null;
    let touchMarkerTimeout = null;
    
    domMarkers.forEach((markerData, featureId) => {
      const postId = markerData.postId;
      
        // Hover enter - load thumbnail and show it
        markerData.element.addEventListener('mouseenter', async (e) => {
          e.stopPropagation();
          if(markerData.isHovered) return;
          markerData.isHovered = true;
          updateMarkerAppearance(markerData);
        });
        
        // Hover leave - revert to icon if not active
        markerData.element.addEventListener('mouseleave', (e) => {
          e.stopPropagation();
          markerData.isHovered = false;
          updateMarkerAppearance(markerData);
        });
      
        // Single click/tap
        markerData.element.addEventListener('click', async (e) => {
          e.stopPropagation();
          
          if(isTouchDevice){
            // Touch device - two-tap system
            if(touchMarkerId === featureId){
              // Second tap - set active and open post
              clearTimeout(touchMarkerTimeout);
              touchMarkerId = null;
              markerData.isActive = true;
              
              // Ensure thumbnail is loaded
              await loadThumbnailForMarker(markerData);
              updateMarkerAppearance(markerData);
              
              // Open post after animation
              setTimeout(() => {
                openPostFromMarker(postId);
              }, 300);
            } else {
              // First tap - show thumbnail (hover effect)
              touchMarkerId = featureId;
              clearTimeout(touchMarkerTimeout);
              touchMarkerTimeout = setTimeout(() => {
                touchMarkerId = null;
              }, 1000);
              
              // Load and show thumbnail
              await loadThumbnailForMarker(markerData);
              updateMarkerAppearance(markerData);
            }
          } else {
            // Mouse - single click sets active and opens post
            markerData.isActive = true;
            
            // Ensure thumbnail is loaded
            await loadThumbnailForMarker(markerData);
            updateMarkerAppearance(markerData);
            
            // Open post after animation
            setTimeout(() => {
              openPostFromMarker(postId);
            }, 300);
          }
        });
        
        // Double click - open post (desktop)
        markerData.element.addEventListener('dblclick', async (e) => {
          e.stopPropagation();
          markerData.isActive = true;
          
          // Ensure thumbnail is loaded
          await loadThumbnailForMarker(markerData);
          updateMarkerAppearance(markerData);
          
          // Open post after animation
          setTimeout(() => {
            openPostFromMarker(postId);
          }, 300);
        });
    });
    
    // Helper function to sync marker hover/click with postcards
    const syncMarkerWithPostcard = (postId, action) => {
      if(!postId) return;
      const markerData = Array.from(domMarkers.values()).find(m => m.postId === postId);
      if(!markerData) return;
      
      if(action === 'hover'){
        markerData.element.dispatchEvent(new Event('mouseenter', { bubbles: true }));
      } else if(action === 'unhover'){
        markerData.element.dispatchEvent(new Event('mouseleave', { bubbles: true }));
      } else if(action === 'click'){
        markerData.element.dispatchEvent(new Event('click', { bubbles: true }));
      }
    };
    
    // Add event listeners to postcards if they exist (for syncing behavior)
    const setupPostcardSync = () => {
      document.querySelectorAll('.small-map-card').forEach(card => {
        const postId = card.dataset.id;
        if(!postId) return;
        
        // Remove existing listeners to avoid duplicates
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        newCard.addEventListener('mouseenter', () => {
          syncMarkerWithPostcard(postId, 'hover');
        });
        
        newCard.addEventListener('mouseleave', () => {
          syncMarkerWithPostcard(postId, 'unhover');
        });
        
        newCard.addEventListener('click', (e) => {
          e.stopPropagation();
          syncMarkerWithPostcard(postId, 'click');
        });
      });
    };
    
    // Setup postcard sync initially and on DOM changes
    setupPostcardSync();
    if(typeof MutationObserver !== 'undefined'){
      const observer = new MutationObserver(() => {
        setupPostcardSync();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    
    // Function to update markers when filters change
    // This listens to the posts source data changes and updates DOM markers accordingly
    const updateMarkersFromSource = () => {
      if(!map) return;
      
      try{
        const postsSource = map.getSource('posts');
        if(!postsSource) return;
        
        // Get current data from source
        const sourceData = postsSource._data;
        if(!sourceData || !Array.isArray(sourceData.features)) return;
        
        // Create a Set of feature IDs that should be visible
        const visibleFeatureIds = new Set();
        sourceData.features.forEach(feature => {
          if(feature && feature.properties && !feature.properties.point_count){
            const featureId = feature.properties.featureId || feature.properties.id || '';
            if(featureId){
              visibleFeatureIds.add(String(featureId));
            }
          }
        });
        
        // Update marker visibility based on filtered data
        domMarkers.forEach((marker, featureId) => {
          const shouldBeVisible = visibleFeatureIds.has(String(featureId));
          if(marker.element){
            // Use a data attribute to track filtered state
            marker.element.dataset.filtered = shouldBeVisible ? 'true' : 'false';
            // Visibility is handled in updateDomMarkerPositions based on zoom and filter
          }
        });
        
        // Trigger position update to apply visibility changes
        updateDomMarkerPositions();
      }catch(e){
        console.warn('[Map Markers] Error updating markers from source:', e);
      }
    };
    
    // Listen for source data changes (when syncMarkerSources updates the data)
    // Use a more reliable method: check source data periodically and on map events
    let lastSourceSignature = null;
    const checkSourceUpdate = () => {
      if(!map) return;
      try{
        const postsSource = map.getSource('posts');
        if(postsSource && postsSource.__markerSignature){
          const currentSignature = postsSource.__markerSignature;
          if(currentSignature !== lastSourceSignature){
            lastSourceSignature = currentSignature;
            updateMarkersFromSource();
          }
        }
      }catch(e){}
    };
    
    // Check for source updates periodically
    const sourceCheckInterval = setInterval(checkSourceUpdate, 200);
    
    // Also check on map data events
    try{
      map.on('data', (e) => {
        if(e.sourceId === 'posts'){
          setTimeout(checkSourceUpdate, 50);
        }
      });
    }catch(e){}
    
    // Store interval for cleanup
    if(!window._domMarkerIntervals){
      window._domMarkerIntervals = [];
    }
    window._domMarkerIntervals.push(sourceCheckInterval);
    
    // Initial update from source
    setTimeout(checkSourceUpdate, 100);
    
    // Store markers globally for cleanup
    window.domMarkers = domMarkers;
    window.updateDomMarkerPositions = updateDomMarkerPositions;
    window.syncMarkerWithPostcard = syncMarkerWithPostcard;
    window.updateMarkersFromSource = updateMarkersFromSource;
    
    // Return API for external access
    return {
      domMarkers,
      updateDomMarkerPositions,
      syncMarkerWithPostcard,
      updateMarkerVisibility,
      updateMarkersFromSource
    };
  }

  // Export to window
  window.initDomMarkers = initDomMarkers;
  */

})();

// ============================================================================
// OLD SPRITE MARKER CODE - Commented out, kept for reference
// ============================================================================
/*
async function initSpriteMarkers(map, postsData, options = {}) {
  if(!map || !postsData) return;
  
  const MARKER_MIN_ZOOM = options.minZoom || 8;
  const MULTI_POST_MARKER_ICON_ID = options.multiPostIconId || 'multi-post-icon';
  const subcategoryMarkers = options.subcategoryMarkers || window.subcategoryMarkers || {};
  const markerIconBaseSizePx = 30;
  
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
  await prepareMarkerLabelCompositesForPosts(postsData);
  updateMapFeatureHighlights(lastHighlightedPostIds);
  
  const markerLabelBaseConditions = [
    ['!',['has','point_count']],
    ['has','title']
  ];
  const markerLabelFilter = ['all', ...markerLabelBaseConditions];

  const markerLabelIconImage = ['let', 'spriteId', ['coalesce', ['get','labelSpriteId'], ''],
    ['case',
      ['==', ['var','spriteId'], ''],
      MARKER_LABEL_BG_ID,
      ['concat', MARKER_LABEL_COMPOSITE_PREFIX, ['var','spriteId']]
    ]
  ];

  const markerLabelHighlightIconImage = ['let', 'spriteId', ['coalesce', ['get','labelSpriteId'], ''],
    ['case',
      ['==', ['var','spriteId'], ''],
      MARKER_LABEL_BG_ACCENT_ID,
      ['concat', MARKER_LABEL_COMPOSITE_PREFIX, ['var','spriteId'], MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX]
    ]
  ];

  const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
  const markerLabelHighlightOpacity = ['case', highlightedStateExpression, 1, 0];
  const mapCardDisplay = document.body.getAttribute('data-map-card-display') || 'always';
  const baseOpacityWhenNotHighlighted = mapCardDisplay === 'hover_only' ? 0 : 1;
  const markerLabelBaseOpacity = ['case', highlightedStateExpression, 0, baseOpacityWhenNotHighlighted];

  const markerLabelMinZoom = MARKER_MIN_ZOOM;
  const labelLayersConfig = [
    { id:'marker-label', source:'posts', sortKey: 5, filter: markerLabelFilter, iconImage: markerLabelIconImage, iconOpacity: markerLabelBaseOpacity, minZoom: markerLabelMinZoom },
    { id:'marker-label-highlight', source:'posts', sortKey: 5, filter: markerLabelFilter, iconImage: markerLabelHighlightIconImage, iconOpacity: markerLabelHighlightOpacity, minZoom: markerLabelMinZoom }
  ];
  labelLayersConfig.forEach(({ id, source, sortKey, filter, iconImage, iconOpacity, minZoom, iconSize }) => {
    const layerMinZoom = Number.isFinite(minZoom) ? minZoom : markerLabelMinZoom;
    const finalIconSize = iconSize !== undefined ? iconSize : 1;
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
            'icon-anchor': 'center',
            'icon-offset': [-82.5, 0],
            'icon-pitch-alignment': 'viewport',
            'symbol-z-order': 'viewport-y',
            'symbol-sort-key': sortKey
          },
          paint:{
            'icon-translate': [0, 0],
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
    try{ map.setFilter(id, filter || markerLabelFilter); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-image', iconImage || markerLabelIconImage); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-size', finalIconSize); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-allow-overlap', true); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-ignore-placement', true); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-anchor','center'); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-offset',[-82.5, 0]); }catch(e){}
    try{ map.setLayoutProperty(id,'icon-pitch-alignment','viewport'); }catch(e){}
    try{ map.setLayoutProperty(id,'symbol-z-order','viewport-y'); }catch(e){}
    try{ map.setLayoutProperty(id,'symbol-sort-key', sortKey); }catch(e){}
    try{ map.setPaintProperty(id,'icon-translate',[0,0]); }catch(e){}
    try{ map.setPaintProperty(id,'icon-translate-anchor','viewport'); }catch(e){}
    try{ map.setPaintProperty(id,'icon-opacity', iconOpacity || 1); }catch(e){}
    try{ map.setLayerZoomRange(id, layerMinZoom, 24); }catch(e){}
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
  const markerIconLayerId = 'marker-icon';
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
          'icon-pitch-alignment': 'viewport',
          'symbol-z-order': 'viewport-y',
          'symbol-sort-key': 10,
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
      map.setLayoutProperty(markerIconLayerId, 'visibility', 'visible');
      map.setPaintProperty(markerIconLayerId, 'icon-opacity', 1);
      map.setFilter(markerIconLayerId, markerIconFilter);
      map.setLayoutProperty(markerIconLayerId, 'icon-image', markerIconImageExpression);
    }catch(e){}
  }
  
  ALL_MARKER_LAYER_IDS.forEach(id=>{
    if(id !== 'marker-icon' && map.getLayer(id)){
      try{ map.moveLayer(id); }catch(e){}
    }
  });
  // Move marker-icon layer to top (above map cards)
  if(map.getLayer('marker-icon')){
    try{ 
      map.moveLayer('marker-icon');
    }catch(e){}
  }
  [
    ['marker-label','icon-opacity-transition'],
    ['marker-label-highlight','icon-opacity-transition']
  ].forEach(([layer, prop])=>{
    if(map.getLayer(layer)){
      try{ map.setPaintProperty(layer, prop, {duration:0}); }catch(e){}
    }
  });
  
  function updateMapCardLayerOpacity(displayMode){
    if(!map) return;
    const baseOpacityWhenNotHighlighted = displayMode === 'hover_only' ? 0 : 1;
    const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
    const markerLabelBaseOpacity = ['case', highlightedStateExpression, 0, baseOpacityWhenNotHighlighted];
    if(map.getLayer('marker-label')){
      try{ map.setPaintProperty('marker-label', 'icon-opacity', markerLabelBaseOpacity); }catch(e){}
    }
    // Ensure marker-icon is always visible at 100% opacity
    if(map.getLayer('marker-icon')){
      try{ 
        map.setLayoutProperty('marker-icon', 'visibility', 'visible');
        map.setPaintProperty('marker-icon', 'icon-opacity', 1);
      }catch(e){}
    }
  }
  window.updateMapCardLayerOpacity = updateMapCardLayerOpacity;
  window.getMapInstance = () => map;
  
  updateMapCardLayerOpacity(mapCardDisplay);
  
  // Ensure marker-icon layer is visible and on top after map card setup
  if(map.getLayer('marker-icon')){
    try{
      map.setLayoutProperty('marker-icon', 'visibility', 'visible');
      map.setPaintProperty('marker-icon', 'icon-opacity', 1);
      map.setLayoutProperty('marker-icon', 'symbol-sort-key', 10);
      map.moveLayer('marker-icon'); // Move to top
    }catch(e){}
  }
  
  refreshInViewMarkerLabelComposites(map);
}

// Export to window
window.initSpriteMarkers = initSpriteMarkers;
*/

