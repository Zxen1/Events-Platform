// ============================================================================
// NEW MAPMARKER SYSTEM - Sprite-based using Mapbox symbol layers
// ============================================================================
(function() {
  'use strict';

  /**
   * Initialize map markers using Mapbox sprite system
   * @param {Object} map - Mapbox map instance
   * @param {Object} postsData - GeoJSON feature collection with post data
   * @param {Object} options - Configuration options
   */
  async function mapmarkerInit(map, postsData, options = {}) {
    if(!map || !postsData) return;

    const MARKER_MIN_ZOOM = options.minZoom || 8;
    const MULTI_POST_MARKER_ICON_ID = options.multiPostIconId || 'multi-post-icon';
    const subcategoryMarkers = options.subcategoryMarkers || window.subcategoryMarkers || {};
    const ICON_SIZE = 30;
    const THUMBNAIL_SIZE_HOVER = 30;
    const THUMBNAIL_SIZE_ACTIVE = 50;
    
    // Track preloaded state (use window to persist across multiple calls)
    if(!window._mapmarkerIconsPreloaded) {
      window._mapmarkerIconsPreloaded = false;
    }
    let iconsPreloaded = window._mapmarkerIconsPreloaded;
    // Thumbnails are cached in Mapbox via map.addImage() - no separate cache needed
    
    // Use existing functions from index.js (same as old working code)
    const loadMarkerLabelImage = window.loadMarkerLabelImage || function(url) {
      return new Promise((resolve, reject) => {
        if(!url) {
          reject(new Error('Missing URL'));
          return;
        }
        const img = new Image();
        try { img.crossOrigin = 'anonymous'; } catch(err) {}
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
        if(img.complete) {
          setTimeout(() => {
            if(img.naturalWidth > 0 && img.naturalHeight > 0) {
              resolve(img);
            }
          }, 0);
        }
      });
    };
    
    const ensureMapIcon = window.ensureMapIcon || null;

    /**
     * Preload marker icons when zoom >= 8 for first time
     */
    async function mapmarkerPreloadIcons() {
      if(iconsPreloaded) {
        console.log('[Mapmarker] Icons already preloaded');
        return;
      }
      
      // Don't check zoom - always preload icons when function is called
      // The minzoom on layers will handle visibility
      iconsPreloaded = true;
      window._mapmarkerIconsPreloaded = true;
      console.log('[Mapmarker] Starting icon preload...');
      
      // Collect all unique icon IDs needed
      const iconIds = new Set();
      if(Array.isArray(postsData.features)) {
        postsData.features.forEach(feature => {
          if(feature.properties && !feature.properties.point_count) {
            const iconId = feature.properties.sub || MULTI_POST_MARKER_ICON_ID;
            iconIds.add(iconId);
          }
        });
      }
      iconIds.add(MULTI_POST_MARKER_ICON_ID);
      
      console.log('[Mapmarker] Icon IDs needed:', Array.from(iconIds));
      console.log('[Mapmarker] subcategoryMarkers keys:', Object.keys(subcategoryMarkers));
      console.log('[Mapmarker] subcategoryMarkers object:', subcategoryMarkers);
      
      // Use ensureMapIcon first (same as old working code)
      if(typeof ensureMapIcon === 'function') {
        await Promise.all(iconIds.map(id => ensureMapIcon(id).catch(() => {})));
      }
      
      // Preload all icons (same approach as old working code)
      const preloadPromises = [];
      for(const iconId of iconIds) {
        const iconUrl = subcategoryMarkers[iconId];
        if(iconUrl && !map.hasImage(iconId)) {
          preloadPromises.push(
            loadMarkerLabelImage(iconUrl)
              .then(img => {
                if(img) {
                  // Use devicePixelRatio like old code
                  let deviceScale = 2;
                  try {
                    const ratio = window.devicePixelRatio;
                    if(Number.isFinite(ratio) && ratio > 0) {
                      deviceScale = ratio;
                    }
                  } catch(err) {
                    deviceScale = 2;
                  }
                  if(!Number.isFinite(deviceScale) || deviceScale <= 0) {
                    deviceScale = 2;
                  }
                  const iconSize = Math.round(ICON_SIZE * deviceScale);
                  const canvas = document.createElement('canvas');
                  canvas.width = iconSize;
                  canvas.height = iconSize;
                  const ctx = canvas.getContext('2d');
                  if(ctx) {
                    ctx.drawImage(img, 0, 0, iconSize, iconSize);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    map.addImage(iconId, imageData, { pixelRatio: deviceScale });
                    console.log('[Mapmarker] Icon loaded:', iconId, 'from URL:', iconUrl);
                  }
                }
              })
              .catch(e => {
                console.warn('[Mapmarker] Failed to preload icon:', iconId, 'URL:', iconUrl, e);
              })
          );
        } else if(!iconUrl) {
          console.warn('[Mapmarker] No URL found for icon:', iconId, 'Available icons:', Object.keys(subcategoryMarkers));
        } else {
          console.log('[Mapmarker] Icon already exists in map:', iconId);
        }
      }
      
      await Promise.all(preloadPromises);
      console.log('[Mapmarker] Icon preloading complete. Loaded', preloadPromises.length, 'icons');
    }

    /**
     * Load thumbnail for a post (lazy loading)
     * Uses map.addImage() caching - once loaded, instant for all subsequent uses
     */
    async function mapmarkerLoadThumbnail(postId, featureId) {
      if(!postId) return null;
      
      const imageId = `thumb-${postId}`;
      
      // Check if already cached in Mapbox (instant - no reload needed)
      if(map.hasImage(imageId)) {
        return imageId;
      }
      
      // Get thumbnail URL using picsum CDN (temporary)
      const thumbUrl = window.thumbUrl || (() => null);
      const thumbnailUrl = thumbUrl ? thumbUrl(postId) : null;
      if(!thumbnailUrl) return null;
      
      try {
        // Load image using same function as icons
        const img = await loadMarkerLabelImage(thumbnailUrl);
        if(img) {
          // Use devicePixelRatio for retina displays
          let deviceScale = 2;
          try {
            const ratio = window.devicePixelRatio;
            if(Number.isFinite(ratio) && ratio > 0) {
              deviceScale = ratio;
            }
          } catch(err) {
            deviceScale = 2;
          }
          if(!Number.isFinite(deviceScale) || deviceScale <= 0) {
            deviceScale = 2;
          }
          const thumbSize = 50; // Thumbnails are 50x50
          const canvasSize = Math.round(thumbSize * deviceScale);
          const canvas = document.createElement('canvas');
          canvas.width = canvasSize;
          canvas.height = canvasSize;
          const ctx = canvas.getContext('2d');
          if(ctx) {
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Cache in Mapbox - instant for all subsequent uses
            map.addImage(imageId, imageData, { pixelRatio: deviceScale });
            return imageId;
          }
        }
      } catch(e) {
        console.warn('[Mapmarker] Failed to load thumbnail for post:', postId, e);
      }
      return null;
    }

    /**
     * Check if a feature is a multi-post marker
     */
    function mapmarkerIsMultiPost(feature) {
      if(!feature || !feature.properties) return false;
      const props = feature.properties;
      const rawMultiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
      const multiCountFromProps = Number(props.multiCount);
      const normalizedMultiCount = Number.isFinite(multiCountFromProps) && multiCountFromProps > 0 
        ? multiCountFromProps 
        : 0;
      const helperMultiCount = Math.max(
        rawMultiIds.length, 
        normalizedMultiCount, 
        props.isMultiVenue ? 2 : 0
      );
      return helperMultiCount > 1;
    }

    /**
     * Get icon ID for a feature
     */
    function mapmarkerGetIconId(feature) {
      if(!feature || !feature.properties) return MULTI_POST_MARKER_ICON_ID;
      const iconId = feature.properties.sub || MULTI_POST_MARKER_ICON_ID;
      return iconId;
    }

    /**
     * Setup marker layers
     */
    function mapmarkerSetupLayers() {
      // Check if source exists
      if(!map.getSource('posts')) {
        console.warn('[Mapmarker] Source "posts" does not exist. Layers cannot be created.');
        return;
      }

      // Filter: just exclude cluster points (don't require 'title' property)
      const markerFilter = ['!', ['has', 'point_count']];

      // Icon layer - always shows subcategory icons (or multi-post icon)
      const iconLayerId = 'mapmarker-icon';
      if(!map.getLayer(iconLayerId)) {
        try {
          map.addLayer({
            id: iconLayerId,
            type: 'symbol',
            source: 'posts',
            filter: markerFilter,
            minzoom: MARKER_MIN_ZOOM,
            layout: {
              'icon-image': ['let', 'iconId', ['coalesce', ['get', 'sub'], ''],
                ['case',
                  ['==', ['var', 'iconId'], ''],
                  MULTI_POST_MARKER_ICON_ID,
                  ['var', 'iconId']
                ]
              ],
              'icon-size': [
                'case',
                ['boolean', ['feature-state', 'isActive'], false],
                50 / ICON_SIZE, // 50px when active (1.67x)
                30 / ICON_SIZE  // 30px default (1x)
              ],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'icon-pitch-alignment': 'viewport',
              'symbol-z-order': 'viewport-y',
              'symbol-sort-key': 25
            },
            paint: {
              'icon-opacity': [
                'case',
                ['boolean', ['feature-state', 'showThumbnail'], false],
                0, // Hide icon when thumbnail is shown
                1  // Show icon otherwise
              ]
            }
          });
          console.log('[Mapmarker] Icon layer created:', iconLayerId);
        } catch(e) {
          console.error('[Mapmarker] Failed to create icon layer:', e);
        }
      } else {
        // Update existing layer
        try {
          map.setFilter(iconLayerId, markerFilter);
          console.log('[Mapmarker] Icon layer updated:', iconLayerId);
        } catch(e) {
          console.warn('[Mapmarker] Failed to update icon layer:', e);
        }
      }

      // Thumbnail layer - shows thumbnails on hover/click (only for single posts)
      // Filter: only show features that have thumbnailImageId property
      const thumbnailLayerId = 'mapmarker-thumbnail';
      const thumbnailFilter = ['all',
        markerFilter,
        ['has', 'thumbnailImageId']
      ];
      
      if(!map.getLayer(thumbnailLayerId)) {
        try {
          map.addLayer({
            id: thumbnailLayerId,
            type: 'symbol',
            source: 'posts',
            filter: thumbnailFilter,
            minzoom: MARKER_MIN_ZOOM,
            layout: {
              'icon-image': ['coalesce', ['get', 'thumbnailImageId'], ''],
              'icon-size': [
                'case',
                ['boolean', ['feature-state', 'isActive'], false],
                THUMBNAIL_SIZE_ACTIVE / 50, // 50px when active (1x, since thumbnails are 50x50)
                THUMBNAIL_SIZE_HOVER / 50    // 30px when hovered (0.6x)
              ],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'icon-pitch-alignment': 'viewport',
              'symbol-z-order': 'viewport-y',
              'symbol-sort-key': 30
            },
            paint: {
              'icon-opacity': [
                'case',
                ['boolean', ['feature-state', 'showThumbnail'], false],
                1, // Show thumbnail when state says so
                0  // Hide otherwise
              ]
            }
          });
          console.log('[Mapmarker] Thumbnail layer created:', thumbnailLayerId);
        } catch(e) {
          console.error('[Mapmarker] Failed to create thumbnail layer:', e);
        }
      } else {
        // Update filter if layer exists
        try {
          map.setFilter(thumbnailLayerId, thumbnailFilter);
          console.log('[Mapmarker] Thumbnail layer updated:', thumbnailLayerId);
        } catch(e) {
          console.warn('[Mapmarker] Failed to update thumbnail layer:', e);
        }
      }
    }

    /**
     * Handle marker hover enter
     */
    async function mapmarkerHandleHover(featureId, feature) {
      if(!feature || !feature.properties) return;
      
      const isMultiPost = mapmarkerIsMultiPost(feature);
      const postId = feature.properties.id;
      
      // Multi-post markers don't show thumbnails
      if(isMultiPost) {
        // Just set hover state for potential future use
        try {
          map.setFeatureState(
            { source: 'posts', id: featureId },
            { isHovered: true }
          );
        } catch(e) {}
        return;
      }
      
      // Single post: load thumbnail and show it
      if(postId) {
        // Keep icon visible while loading thumbnail (prevent flicker)
        const thumbnailImageId = await mapmarkerLoadThumbnail(postId, featureId);
        if(thumbnailImageId) {
          // Update feature properties to include thumbnail image ID
          try {
            const source = map.getSource('posts');
            if(source && source._data) {
              const featureToUpdate = source._data.features.find(f => {
                const fid = f.id || f.properties.featureId || f.properties.id || '';
                return String(fid) === String(featureId);
              });
              if(featureToUpdate && !featureToUpdate.properties.thumbnailImageId) {
                featureToUpdate.properties.thumbnailImageId = thumbnailImageId;
                source.setData(source._data);
              }
            }
          } catch(e) {
            console.warn('[Mapmarker] Failed to update feature with thumbnail:', e);
          }
          
          // Show thumbnail (icon will hide via opacity expression)
          try {
            map.setFeatureState(
              { source: 'posts', id: featureId },
              { showThumbnail: true, isHovered: true }
            );
          } catch(e) {}
        }
      }
    }

    /**
     * Handle marker hover leave
     */
    function mapmarkerHandleUnhover(featureId) {
      try {
        const currentState = map.getFeatureState({ source: 'posts', id: featureId });
        // Only hide thumbnail if not active
        if(!currentState.isActive) {
          map.setFeatureState(
            { source: 'posts', id: featureId },
            { showThumbnail: false, isHovered: false }
          );
        } else {
          // Keep thumbnail visible but remove hover state
          map.setFeatureState(
            { source: 'posts', id: featureId },
            { isHovered: false }
          );
        }
      } catch(e) {}
    }

    /**
     * Handle marker click
     */
    async function mapmarkerHandleClick(featureId, feature) {
      if(!feature || !feature.properties) return;
      
      const isMultiPost = mapmarkerIsMultiPost(feature);
      const postId = feature.properties.id;
      
      // Set active state (grows to 50px)
      try {
        map.setFeatureState(
          { source: 'posts', id: featureId },
          { isActive: true, showThumbnail: !isMultiPost }
        );
      } catch(e) {}
      
      // For single posts, ensure thumbnail is loaded and shown
      if(!isMultiPost && postId) {
        const thumbnailImageId = await mapmarkerLoadThumbnail(postId, featureId);
        if(thumbnailImageId) {
          // Update feature properties if needed
          try {
            const source = map.getSource('posts');
            if(source && source._data) {
              const featureToUpdate = source._data.features.find(f => {
                const fid = f.id || f.properties.featureId || f.properties.id || '';
                return String(fid) === String(featureId);
              });
              if(featureToUpdate && !featureToUpdate.properties.thumbnailImageId) {
                featureToUpdate.properties.thumbnailImageId = thumbnailImageId;
                source.setData(source._data);
              }
            }
          } catch(e) {
            console.warn('[Mapmarker] Failed to update feature with thumbnail on click:', e);
          }
        }
      }
      
      // Open post after animation
      setTimeout(() => {
        if(postId && typeof window.openPost === 'function') {
          try {
            if(typeof window.stopSpin === 'function') {
              window.stopSpin();
            }
            if(typeof window.closePanel === 'function' && typeof window.filterPanel !== 'undefined' && window.filterPanel) {
              try {
                window.closePanel(window.filterPanel);
              } catch(err) {}
            }
            window.openPost(postId, false, true, null);
          } catch(err) {
            console.error('[Mapmarker] Error opening post:', err);
          }
        }
      }, 300);
    }

    /**
     * Setup click/hover interactions
     */
    function mapmarkerSetupInteractions() {
      // Click handler
      map.on('click', 'mapmarker-icon', (e) => {
        if(!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const featureId = feature.id || feature.properties.featureId || feature.properties.id;
        mapmarkerHandleClick(featureId, feature);
      });
      
      map.on('click', 'mapmarker-thumbnail', (e) => {
        if(!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const featureId = feature.id || feature.properties.featureId || feature.properties.id;
        mapmarkerHandleClick(featureId, feature);
      });

      // Hover handlers
      map.on('mouseenter', 'mapmarker-icon', async (e) => {
        if(!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const featureId = feature.id || feature.properties.featureId || feature.properties.id;
        await mapmarkerHandleHover(featureId, feature);
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', 'mapmarker-icon', (e) => {
        if(!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const featureId = feature.id || feature.properties.featureId || feature.properties.id;
        mapmarkerHandleUnhover(featureId);
        map.getCanvas().style.cursor = '';
      });
      
      map.on('mouseenter', 'mapmarker-thumbnail', async (e) => {
        if(!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const featureId = feature.id || feature.properties.featureId || feature.properties.id;
        await mapmarkerHandleHover(featureId, feature);
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', 'mapmarker-thumbnail', (e) => {
        if(!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const featureId = feature.id || feature.properties.featureId || feature.properties.id;
        mapmarkerHandleUnhover(featureId);
        map.getCanvas().style.cursor = '';
      });
    }

    // Wait for map to be ready before setting up layers
    function waitForMapReady() {
      return new Promise((resolve) => {
        if(map.loaded()) {
          resolve();
        } else {
          map.once('load', resolve);
        }
      });
    }

    // Preload icons when zoom reaches threshold
    const zoomHandler = () => {
      if(!iconsPreloaded) {
        mapmarkerPreloadIcons();
      }
    };
    map.on('zoom', zoomHandler);

    // Wait for map to be ready, then preload icons and setup layers
    await waitForMapReady();
    
    // Always preload icons first (regardless of zoom level)
    // Icons need to be loaded before layers can display them
    await mapmarkerPreloadIcons();

    // Setup layers (icons should be loaded now)
    mapmarkerSetupLayers();

    // Debug logging
    console.log('[Mapmarker] Debug info:', {
      sourceExists: !!map.getSource('posts'),
      iconLayerExists: !!map.getLayer('mapmarker-icon'),
      thumbnailLayerExists: !!map.getLayer('mapmarker-thumbnail'),
      zoom: map.getZoom(),
      iconsLoaded: iconsPreloaded,
      subcategoryMarkersCount: Object.keys(subcategoryMarkers).length,
      postsDataFeaturesCount: postsData && Array.isArray(postsData.features) ? postsData.features.length : 0
    });

    // Setup interactions
    mapmarkerSetupInteractions();

    /**
     * Monitor post open/close state and update marker active states
     */
    function mapmarkerMonitorPostState() {
      function updateActivePostMarkers() {
        const activePostId = window.activePostId || null;
        const openPostEl = document.querySelector('.open-post[data-id]');
        const openPostId = openPostEl && openPostEl.dataset ? String(openPostEl.dataset.id || '') : '';
        const currentOpenPostId = activePostId !== undefined && activePostId !== null ? String(activePostId) : openPostId;
        
        // Get all features from source
        try {
          const source = map.getSource('posts');
          if(source && source._data && Array.isArray(source._data.features)) {
            source._data.features.forEach(feature => {
              if(!feature || !feature.properties || feature.properties.point_count) return;
              
              const featureId = feature.id || feature.properties.featureId || feature.properties.id;
              const postId = feature.properties.id;
              if(!featureId || !postId) return;
              
              const isOpen = currentOpenPostId && String(postId) === String(currentOpenPostId);
              const currentState = map.getFeatureState({ source: 'posts', id: featureId });
              const wasActive = currentState && currentState.isActive;
              
              if(isOpen && !wasActive) {
                // Post just opened - set active state
                const isMultiPost = mapmarkerIsMultiPost(feature);
                map.setFeatureState(
                  { source: 'posts', id: featureId },
                  { isActive: true, showThumbnail: !isMultiPost }
                );
              } else if(!isOpen && wasActive) {
                // Post just closed - clear active state
                map.setFeatureState(
                  { source: 'posts', id: featureId },
                  { isActive: false, showThumbnail: false }
                );
              }
            });
          }
        } catch(e) {
          console.warn('[Mapmarker] Error updating post state:', e);
        }
      }
      
      // Check immediately
      updateActivePostMarkers();
      
      // Use MutationObserver to watch for .open-post changes
      if(typeof MutationObserver !== 'undefined') {
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
      const pollInterval = setInterval(() => {
        if(window.activePostId !== lastActivePostId) {
          lastActivePostId = window.activePostId;
          updateActivePostMarkers();
        }
      }, 100);
      
      // Store interval for cleanup if needed
      if(!window._mapmarkerIntervals) {
        window._mapmarkerIntervals = [];
      }
      window._mapmarkerIntervals.push(pollInterval);
    }

    // Start monitoring post state
    mapmarkerMonitorPostState();

    // Return API
    return {
      mapmarkerPreloadIcons,
      mapmarkerLoadThumbnail,
      mapmarkerHandleHover,
      mapmarkerHandleUnhover,
      mapmarkerHandleClick
    };
  }

  // Export to window
  window.mapmarkerInit = mapmarkerInit;

})();

/*
// ============================================================================
// OLD DOM MARKER CODE - Commented out, kept for reference
// ============================================================================
(function() {
  'use strict';

  // Initialize DOM markers for the map
  // COMMENTED OUT - Returning to sprite system
  // @param {Object} map - Mapbox map instance
  // @param {Object} postsData - GeoJSON feature collection with post data
  // @param {Object} options - Configuration options
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

})();

// ============================================================================
// OLD SPRITE MARKER CODE - Commented out, kept for reference
// ============================================================================
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
