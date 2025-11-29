// === Map Card Composite System ===
// All code related to map card composites, layers, and management

(function() {
  'use strict';

  // Constants
  const MARKER_LABEL_COMPOSITE_PREFIX = 'marker-label-composite-';
  const MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX = '-accent';
  const MARKER_LABEL_COMPOSITE_LIMIT = 900; // Mapbox limit is ~1000, reserve 100 for other images
  const MARKER_COMPOSITE_BIG_ICON_SIZE = 50; // 50x50px for big cards
  const MARKER_COMPOSITE_SMALL_ICON_SIZE = 30; // 30x30px for small cards
  
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
  function drawCompositeText(ctx, text, x, y, maxWidth, color = '#ffffff', fontSize){
    // Access markerLabelTextSize from global scope (defined in index.js)
    const textSize = fontSize || (typeof markerLabelTextSize !== 'undefined' ? markerLabelTextSize : 12);
    const lineHeight = textSize * (typeof markerLabelTextLineHeight !== 'undefined' ? markerLabelTextLineHeight : 1.2);
    const ellipsisChar = typeof markerLabelEllipsisChar !== 'undefined' ? markerLabelEllipsisChar : '\u2026';
    
    if(!text || !ctx) return;
    ctx.fillStyle = color;
    ctx.font = `${textSize}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    
    // Handle multi-line text (split by \n)
    const lines = text.split('\n');
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
        while(ctx.measureText(truncated + ellipsisChar).width > maxWidth && truncated.length > 0){
          truncated = truncated.slice(0, -1);
        }
        displayText = truncated + ellipsisChar;
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
    
    // Access dimensions from global scope (defined in index.js)
    const basePillWidth = typeof basePillWidthPx !== 'undefined' ? basePillWidthPx : 150;
    const basePillHeight = typeof basePillHeightPx !== 'undefined' ? basePillHeightPx : 40;
    const accentPillWidth = typeof accentPillWidthPx !== 'undefined' ? accentPillWidthPx : null;
    const accentPillHeight = typeof accentPillHeightPx !== 'undefined' ? accentPillHeightPx : null;
    const textSize = typeof markerLabelTextSize !== 'undefined' ? markerLabelTextSize : 12;
    
    // Determine dimensions based on type
    let canvasWidth, canvasHeight, iconSize, iconX, iconY, labelX, labelY, labelMaxWidth;
    
    if(type === COMPOSITE_TYPE_BIG || type === COMPOSITE_TYPE_BIG_MULTI){
      // Big cards: 225x60px
      canvasWidth = accentPillWidth || 225;
      canvasHeight = accentPillHeight || 60;
      iconSize = MARKER_COMPOSITE_BIG_ICON_SIZE; // 50px
      iconX = canvasWidth - iconSize - 5; // Right side, 5px from edge
      iconY = canvasHeight / 2; // Center vertically
      labelX = 10; // 10px from left
      labelY = 8; // 8px from top
      labelMaxWidth = canvasWidth - iconSize - 20; // Leave space for icon
    } else {
      // Small cards: 150x40px
      canvasWidth = basePillWidth; // 150px
      canvasHeight = basePillHeight; // 40px
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
        drawCompositeText(ctx, labelText, labelX, labelY, labelMaxWidth, '#ffffff', textSize);
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
   * Load icon/thumbnail image for composite
   * @param {string} iconId - Icon ID (subcategory or 'multi-post-icon')
   * @param {string} type - Composite type
   * @param {string} thumbnailUrl - Optional thumbnail URL for big cards
   * @param {boolean} isMultiPost - Whether this is a multi-post card
   * @returns {Promise<HTMLImageElement>}
   */
  async function loadCompositeIcon(iconId, type, thumbnailUrl, isMultiPost){
    // Access loadMarkerLabelImage from global scope (defined in index.js)
    if(typeof loadMarkerLabelImage !== 'function'){
      console.error('[Composite] loadMarkerLabelImage not available');
      return null;
    }
    
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
   * Ensure a composite sprite exists and is added to the map
   * @param {Object} mapInstance - Mapbox map instance
   * @param {Object} options - Composite creation options
   * @returns {Promise<Object>} { compositeId, spriteId, meta }
   */
  async function ensureMapCardComposite(mapInstance, options){
    const { type, labelText, iconId, isMultiPost = false, thumbnailUrl = null, keepRelated = [] } = options;
    
    if(!mapInstance || !type || !labelText || !iconId){
      console.error('[Composite] Missing required parameters:', { type, labelText, iconId });
      return null;
    }
    
    // Access dependencies from global scope
    if(typeof ensureMarkerLabelPillSprites !== 'function'){
      console.error('[Composite] ensureMarkerLabelPillSprites not available');
      return null;
    }
    if(typeof convertImageDataToCanvas !== 'function'){
      console.error('[Composite] convertImageDataToCanvas not available');
      return null;
    }
    if(typeof nowTimestamp !== 'function'){
      console.error('[Composite] nowTimestamp not available');
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
        
        // Enforce budget before adding - keep this spriteId and all related ones
        const keepIds = [spriteId, ...keepRelated].filter(id => id && typeof id === 'string');
        enforceMarkerLabelCompositeBudget(mapInstance, { keep: keepIds, reserve: 1 });
        
        // Add to map - ALWAYS remove existing image first to prevent dimension mismatch errors
        const imageToAdd = convertImageDataToCanvas(composite.image);
        if(imageToAdd){
          // CRITICAL: Always remove existing image first to prevent RangeError: mismatched image size
          // Even if hasImage returns false, there might be a stale entry or race condition
          try {
            if(mapInstance.hasImage(compositeId)){
              mapInstance.removeImage(compositeId);
            }
          } catch(err){
            // Ignore errors when removing (image might not exist)
          }
          
          // Validate dimensions before adding
          const width = imageToAdd.width || 0;
          const height = imageToAdd.height || 0;
          if(width > 0 && height > 0){
            try {
              mapInstance.addImage(compositeId, imageToAdd, composite.options || {});
            } catch(err){
              // If addImage fails, try removing and adding again (handles race conditions)
              try {
                if(mapInstance.hasImage(compositeId)){
                  mapInstance.removeImage(compositeId);
                }
                mapInstance.addImage(compositeId, imageToAdd, composite.options || {});
              } catch(retryErr){
                console.error('[Composite] Error adding composite image after retry:', retryErr);
                throw retryErr;
              }
            }
          } else {
            throw new Error(`Invalid composite dimensions: ${width}x${height}`);
          }
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
  
  /**
   * Create map card composite sprites for features
   * @param {Object} mapInstance - Mapbox map instance
   * @param {Array} features - Array of GeoJSON features
   * @param {string} MULTI_POST_MARKER_ICON_ID - Multi-post marker icon ID
   * @param {number} MARKER_ZOOM_THRESHOLD - Minimum zoom for composites
   * @returns {Promise<Array>} Array of composite creation promises
   */
  function createMapCardCompositesForFeatures(mapInstance, features, MULTI_POST_MARKER_ICON_ID, MARKER_ZOOM_THRESHOLD){
    if(!mapInstance || !features || !Array.isArray(features)){
      return [];
    }
    
    const compositePromises = [];
    
    for(const feature of features){
      if(!feature || !feature.properties || feature.properties.point_count) continue;
      
      const props = feature.properties;
      const isMultiPost = props.isMultiPost === true;
      const labelText = props.label || '';
      const iconId = props.sub || MULTI_POST_MARKER_ICON_ID;
      const thumbnailUrl = props.thumbnailUrl || null;
      
      // Create multiple composite types for each feature:
      // 1. Small composite (default)
      // 2. Small hover composite (for hover state)
      // 3. Big composite (for active/open state)
      
      const baseCompositeType = isMultiPost ? COMPOSITE_TYPE_SMALL_MULTI : COMPOSITE_TYPE_SMALL;
      const hoverCompositeType = isMultiPost ? COMPOSITE_TYPE_HOVER_MULTI : COMPOSITE_TYPE_HOVER;
      const bigCompositeType = isMultiPost ? COMPOSITE_TYPE_BIG_MULTI : COMPOSITE_TYPE_BIG;
      
      // Generate all three spriteIds upfront so we can keep them all during budget enforcement
      const baseSpriteId = markerLabelCompositeId(baseCompositeType, labelText, iconId, null);
      const hoverSpriteId = markerLabelCompositeId(hoverCompositeType, labelText, iconId, null);
      const bigSpriteId = markerLabelCompositeId(bigCompositeType, labelText, iconId, thumbnailUrl);
      
      // Create base composite (small)
      const baseCompositePromise = ensureMapCardComposite(mapInstance, {
        type: baseCompositeType,
        labelText,
        iconId,
        isMultiPost,
        thumbnailUrl: null, // Small composites don't use thumbnails
        keepRelated: [hoverSpriteId, bigSpriteId] // Protect related composites
      }).then(result => {
        if(result && result.compositeId && props){
          props.compositeId = result.compositeId;
        }
        return result;
      }).catch(err => {
        console.warn('[MapCards] Failed to create base composite:', err);
        return null;
      });
      
      // Create hover composite
      const hoverCompositePromise = ensureMapCardComposite(mapInstance, {
        type: hoverCompositeType,
        labelText,
        iconId,
        isMultiPost,
        thumbnailUrl: null,
        keepRelated: [baseSpriteId, bigSpriteId] // Protect related composites
      }).then(result => {
        if(result && result.compositeId && props){
          props.hoverCompositeId = result.compositeId;
        }
        return result;
      }).catch(err => {
        console.warn('[MapCards] Failed to create hover composite:', err);
        return null;
      });
      
      // Create big composite (for active/open state)
      const bigCompositePromise = ensureMapCardComposite(mapInstance, {
        type: bigCompositeType,
        labelText,
        iconId,
        isMultiPost,
        thumbnailUrl, // Big composites use thumbnails
        keepRelated: [baseSpriteId, hoverSpriteId] // Protect related composites
      }).then(result => {
        if(result && result.compositeId && props){
          props.bigCompositeId = result.compositeId;
        }
        return result;
      }).catch(err => {
        console.warn('[MapCards] Failed to create big composite:', err);
        return null;
      });
      
      compositePromises.push(baseCompositePromise, hoverCompositePromise, bigCompositePromise);
    }
    
    return compositePromises;
  }
  
  /**
   * Add pill sprites to map
   * @param {Object} mapInstance - Mapbox map instance
   * @param {Object} pillSprites - Pill sprite objects
   * @param {string} MARKER_LABEL_BG_ID - Base pill sprite ID
   * @param {string} MARKER_LABEL_BG_ACCENT_ID - Accent pill sprite ID
   */
  function addPillSpritesToMap(mapInstance, pillSprites, MARKER_LABEL_BG_ID, MARKER_LABEL_BG_ACCENT_ID){
    if(!mapInstance || !pillSprites){
      return;
    }
    
    // Access convertImageDataToCanvas from global scope
    if(typeof convertImageDataToCanvas !== 'function'){
      console.error('[MapCards] convertImageDataToCanvas not available');
      return;
    }
    
    // Add base pill sprite - ALWAYS remove existing first to prevent dimension mismatch
    if(pillSprites.base && pillSprites.base.image){
      try {
        // CRITICAL: Always remove existing image first to prevent RangeError: mismatched image size
        if(mapInstance.hasImage(MARKER_LABEL_BG_ID)){
          try {
            mapInstance.removeImage(MARKER_LABEL_BG_ID);
          } catch(err){
            // Ignore removal errors
          }
        }
        
        // Convert ImageData to Canvas if needed
        const imageToAdd = convertImageDataToCanvas(pillSprites.base.image);
        if(imageToAdd){
          // Validate dimensions before adding
          const width = imageToAdd.width || 0;
          const height = imageToAdd.height || 0;
          if(width > 0 && height > 0){
            mapInstance.addImage(MARKER_LABEL_BG_ID, imageToAdd);
          } else {
            console.error('[MapCards] Invalid image dimensions for base sprite:', width, 'x', height);
          }
        } else {
          console.error('[MapCards] Failed to convert base sprite ImageData to Canvas');
        }
      }catch(e){
        console.error('[MapCards] Error adding small-map-card-pill sprite:', e);
      }
    }
    
    // Add highlight pill sprite - ALWAYS remove existing first to prevent dimension mismatch
    if(pillSprites.highlight && pillSprites.highlight.image){
      try {
        // CRITICAL: Always remove existing image first to prevent RangeError: mismatched image size
        if(mapInstance.hasImage(MARKER_LABEL_BG_ACCENT_ID)){
          try {
            mapInstance.removeImage(MARKER_LABEL_BG_ACCENT_ID);
          } catch(err){
            // Ignore removal errors
          }
        }
        
        // Convert ImageData to Canvas if needed
        const imageToAdd = convertImageDataToCanvas(pillSprites.highlight.image);
        if(imageToAdd){
          // Validate dimensions before adding
          const width = imageToAdd.width || 0;
          const height = imageToAdd.height || 0;
          if(width > 0 && height > 0){
            mapInstance.addImage(MARKER_LABEL_BG_ACCENT_ID, imageToAdd);
          } else {
            console.error('[MapCards] Invalid image dimensions for highlight sprite:', width, 'x', height);
          }
        } else {
          console.error('[MapCards] Failed to convert highlight sprite ImageData to Canvas');
        }
      }catch(e){
        console.error('[MapCards] Error adding big-map-card-pill sprite:', e);
      }
    }
    
    // Add hover pill sprite - ALWAYS remove existing first to prevent dimension mismatch
    if(pillSprites.hover && pillSprites.hover.image){
      try {
        // CRITICAL: Always remove existing image first to prevent RangeError: mismatched image size
        if(mapInstance.hasImage('hover-map-card-pill')){
          try {
            mapInstance.removeImage('hover-map-card-pill');
          } catch(err){
            // Ignore removal errors
          }
        }
        
        const imageToAdd = convertImageDataToCanvas(pillSprites.hover.image);
        if(imageToAdd){
          // Validate dimensions before adding
          const width = imageToAdd.width || 0;
          const height = imageToAdd.height || 0;
          if(width > 0 && height > 0){
            mapInstance.addImage('hover-map-card-pill', imageToAdd);
          } else {
            console.error('[MapCards] Invalid image dimensions for hover sprite:', width, 'x', height);
          }
        } else {
          console.error('[MapCards] Failed to convert hover sprite ImageData to Canvas');
        }
      }catch(e){
        console.error('[MapCards] Error adding hover-map-card-pill sprite:', e);
      }
    }
  }
  
  /**
   * Create map card composite layers
   * @param {Object} mapInstance - Mapbox map instance
   * @param {string} MARKER_LABEL_BG_ID - Base pill sprite ID
   * @param {string} MARKER_LABEL_BG_ACCENT_ID - Accent pill sprite ID
   * @param {number} MARKER_MIN_ZOOM - Minimum zoom level
   */
  function createMapCardCompositeLayers(mapInstance, MARKER_LABEL_BG_ID, MARKER_LABEL_BG_ACCENT_ID, MARKER_MIN_ZOOM){
    if(!mapInstance) return;
    
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
    const hasHoverPill = mapInstance.hasImage('hover-map-card-pill');
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
    // Small composites: left edge at -20px from lat/lng (150×40px)
    // Big composites: left edge at -35px from lat/lng (225×60px)
    
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
      let layerExists = !!mapInstance.getLayer(id);
      if(!layerExists){
        try{
          mapInstance.addLayer({
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
          layerExists = !!mapInstance.getLayer(id);
        }catch(e){
          layerExists = !!mapInstance.getLayer(id);
        }
      }
      if(!layerExists){
        return;
      }
      // Update filter and icon-image
      try{ mapInstance.setFilter(id, filter || markerLabelFilter); }catch(e){}
      if(iconImage){
        try{ mapInstance.setLayoutProperty(id, 'icon-image', iconImage); }catch(e){}
      }
    });
    
    // Keep old layers for backward compatibility (hide them)
    const oldLayers = ['small-map-card-pill', 'big-map-card-pill'];
    oldLayers.forEach(layerId => {
      if(mapInstance.getLayer(layerId)){
        try{ mapInstance.setLayoutProperty(layerId, 'visibility', 'none'); }catch(e){}
      }
    });
    
    // Text labels are now part of composite sprites, so we hide the old text layers
    // Keep them for backward compatibility but hide them
    const oldTextLayers = ['small-map-card-label', 'big-map-card-label'];
    oldTextLayers.forEach(layerId => {
      if(mapInstance.getLayer(layerId)){
        try{ mapInstance.setLayoutProperty(layerId, 'visibility', 'none'); }catch(e){}
      }
    });
    
    // Layer ordering will be set at the end after all layers are created
    [
      ['small-map-card-composite','icon-opacity-transition'],
      ['big-map-card-composite','icon-opacity-transition']
    ].forEach(([layer, prop])=>{
      if(mapInstance.getLayer(layer)){
        try{ mapInstance.setPaintProperty(layer, prop, {duration:0}); }catch(e){}
      }
    });
  }
  
  /**
   * Update map card layer opacity based on display mode
   * @param {Object} mapInstance - Mapbox map instance
   * @param {string} displayMode - Display mode ('always' or 'hover_only')
   */
  function updateMapCardLayerOpacity(mapInstance, displayMode){
    if(!mapInstance) return;
    const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
    // Small composite: in hover_only mode, only show when highlighted; in always mode, always show
    if(mapInstance.getLayer('small-map-card-composite')){
      const smallCompositeOpacity = displayMode === 'hover_only' 
        ? ['case', highlightedStateExpression, 1, 0]
        : 1;
      try{ mapInstance.setPaintProperty('small-map-card-composite', 'icon-opacity', smallCompositeOpacity); }catch(e){}
    }
    // Big composite: only show when post is active/open (not on hover)
    if(mapInstance.getLayer('big-map-card-composite')){
      const activeStateExpression = ['boolean', ['feature-state', 'isActive'], false];
      const bigCompositeOpacity = ['case', activeStateExpression, 1, 0];
      try{ mapInstance.setPaintProperty('big-map-card-composite', 'icon-opacity', bigCompositeOpacity); }catch(e){}
    }
    // Keep old layers hidden (backward compatibility)
    const oldLayers = ['small-map-card-pill', 'big-map-card-pill', 'small-map-card-label', 'big-map-card-label'];
    oldLayers.forEach(layerId => {
      if(mapInstance.getLayer(layerId)){
        try{ mapInstance.setLayoutProperty(layerId, 'visibility', 'none'); }catch(e){}
      }
    });
  }
  
  // Expose functions globally
  window.MapCardComposites = {
    ensureMapCardComposite,
    clearMapCardComposites,
    createMapCardCompositesForFeatures,
    addPillSpritesToMap,
    createMapCardCompositeLayers,
    updateMapCardLayerOpacity,
    // Expose constants for use in index.js
    COMPOSITE_TYPE_SMALL,
    COMPOSITE_TYPE_SMALL_MULTI,
    COMPOSITE_TYPE_HOVER,
    COMPOSITE_TYPE_HOVER_MULTI,
    COMPOSITE_TYPE_BIG,
    COMPOSITE_TYPE_BIG_MULTI,
    markerLabelCompositeId
  };
  
})();

