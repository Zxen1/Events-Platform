/**
 * DOM-Based Map Markers
 * Handles creation, positioning, and interaction of DOM markers on the map
 */

(function() {
  'use strict';

  /**
   * Initialize DOM markers for the map
   * @param {Object} map - Mapbox map instance
   * @param {Object} postsData - GeoJSON feature collection with post data
   * @param {Object} options - Configuration options
   */
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
    
    // Clear existing markers
    domMarkersContainer.innerHTML = '';
    
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
        
        // Get post data for thumbnail
        const getPostByIdAnywhere = window.getPostByIdAnywhere || (() => null);
        const post = getPostByIdAnywhere(postId);
        
        // Create marker element
        const markerEl = document.createElement('div');
        markerEl.className = 'dom-map-marker';
        markerEl.dataset.featureId = featureId;
        markerEl.dataset.postId = postId || '';
        
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
        
        // Get thumbnail URL
        const thumbUrl = window.thumbUrl || (() => null);
        const thumbnailUrl = post && thumbUrl ? thumbUrl(post) : null;
        
        // Store marker data
        const markerData = {
          element: markerEl,
          lng,
          lat,
          props,
          postId,
          post,
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
      if(!markerData.thumbnailUrl) return;
      
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
          resolve();
        };
        img.onerror = () => {
          // If thumbnail fails to load, keep icon
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
    
    // Function to update marker positions
    const updateDomMarkerPositions = () => {
      if(!map || !domMarkersContainer) return;
      
      const currentZoom = isZoomLevelValid();
      
      domMarkers.forEach((marker, featureId) => {
        try{
          const point = map.project([marker.lng, marker.lat]);
          if(point && Number.isFinite(point.x) && Number.isFinite(point.y)){
            marker.element.style.left = point.x + 'px';
            marker.element.style.top = point.y + 'px';
          }
          // Update visibility based on zoom
          marker.element.style.display = currentZoom ? 'block' : 'none';
        }catch(e){}
      });
    };
    
    // Update positions on map events
    map.on('move', updateDomMarkerPositions);
    map.on('zoom', () => {
      updateDomMarkerPositions();
      updateMarkerVisibility();
    });
    map.on('pitch', updateDomMarkerPositions);
    map.on('rotate', updateDomMarkerPositions);
    
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
    
    // Store markers globally for cleanup
    window.domMarkers = domMarkers;
    window.updateDomMarkerPositions = updateDomMarkerPositions;
    window.syncMarkerWithPostcard = syncMarkerWithPostcard;
    
    // Return API for external access
    return {
      domMarkers,
      updateDomMarkerPositions,
      syncMarkerWithPostcard,
      updateMarkerVisibility
    };
  }

  // Export to window
  window.initDomMarkers = initDomMarkers;

})();

