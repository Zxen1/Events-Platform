// === Shared login verifier ===
async function verifyUserLogin(username, password) {
  try {
    const res = await fetch('/gateway.php?action=verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('verifyUserLogin failed: invalid JSON response', text);
      return false;
    }

    return data.success === true;
  } catch (e) {
    console.error('verifyUserLogin failed', e);
    return false;
  }
}

function normalizeCategorySortOrderValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function compareCategoriesForDisplay(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a || typeof a !== 'object') {
    return !b || typeof b !== 'object' ? 0 : 1;
  }
  if (!b || typeof b !== 'object') {
    return -1;
  }
  const orderA = normalizeCategorySortOrderValue(a.sort_order ?? a.sortOrder);
  const orderB = normalizeCategorySortOrderValue(b.sort_order ?? b.sortOrder);
  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB;
  }
  if (orderA !== null && orderB === null) {
    return -1;
  }
  if (orderA === null && orderB !== null) {
    return 1;
  }
  const nameA = typeof a.name === 'string' ? a.name : '';
  const nameB = typeof b.name === 'string' ? b.name : '';
  const nameCompare = nameA.localeCompare(nameB, undefined, { sensitivity: 'accent', numeric: true });
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return 0;
}

function getSortedCategoryEntries(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const cmp = compareCategoriesForDisplay(a.category, b.category);
      if (cmp !== 0) {
        return cmp;
      }
      return a.index - b.index;
    });
}

function getSortedCategories(list) {
  return getSortedCategoryEntries(list).map(entry => entry.category);
}

// Extracted from <script>
(function(){
      const LOADING_CLASS = 'is-loading';
      let pendingCount = 0;
      let logoImg = null;
      let updatePending = false;
      let stopRequested = false;
      let stopTimeoutId = null;

      function handleAnimationLoop(){
        if(stopRequested && pendingCount === 0){
          finalizeStop();
        }
      }

      function ensureLogo(){
        if(!logoImg){
          logoImg = document.querySelector('.logo img');
          if(logoImg && !logoImg.__logoAnimationBound){
            try{
              logoImg.addEventListener('animationiteration', handleAnimationLoop);
              logoImg.addEventListener('animationend', handleAnimationLoop);
            }catch(err){}
            logoImg.__logoAnimationBound = true;
          }
        }
        return logoImg;
      }

      function finalizeStop(){
        const img = ensureLogo();
        if(!img){
          return;
        }
        stopRequested = false;
        if(stopTimeoutId){
          clearTimeout(stopTimeoutId);
          stopTimeoutId = null;
        }
        if(img.classList && img.classList.contains(LOADING_CLASS)){
          img.classList.remove(LOADING_CLASS);
        } else if(!img.classList && img.style){
          img.style.animation = '';
        }
      }

      function requestStop(){
        const img = ensureLogo();
        if(!img){
          return;
        }
        if(pendingCount > 0){
          return;
        }
        let isAnimating = false;
        if(img.classList){
          isAnimating = img.classList.contains(LOADING_CLASS);
        } else if(img.style){
          isAnimating = typeof img.style.animation === 'string' && img.style.animation !== '';
        }
        if(!isAnimating){
          finalizeStop();
          return;
        }
        if(stopRequested){
          return;
        }
        stopRequested = true;
        if(stopTimeoutId){
          clearTimeout(stopTimeoutId);
        }
        stopTimeoutId = setTimeout(()=>{
          if(stopRequested && pendingCount === 0){
            finalizeStop();
          }
        }, 1200);
      }

      function applyState(){
        updatePending = false;
        const img = ensureLogo();
        if(!img){
          return;
        }
        if(pendingCount > 0){
          stopRequested = false;
          if(stopTimeoutId){
            clearTimeout(stopTimeoutId);
            stopTimeoutId = null;
          }
          if(img.classList && !img.classList.contains(LOADING_CLASS)){
            img.classList.add(LOADING_CLASS);
          } else if(!img.classList){
            img.style.animation = 'logo-rotate 1s linear infinite';
          }
        } else {
          requestStop();
        }
      }

      function scheduleUpdate(){
        if(updatePending){
          return;
        }
        updatePending = true;
        if(typeof requestAnimationFrame === 'function'){
          requestAnimationFrame(applyState);
        } else {
          setTimeout(applyState, 0);
        }
      }

      function begin(){
        pendingCount++;
        scheduleUpdate();
      }

      function end(){
        if(pendingCount > 0){
          pendingCount--;
        }
        scheduleUpdate();
      }

      if(document.readyState === 'complete' || document.readyState === 'interactive'){
        ensureLogo();
        scheduleUpdate();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          ensureLogo();
          scheduleUpdate();
        });
      }

      window.addEventListener('pageshow', () => {
        ensureLogo();
        scheduleUpdate();
      });

      const originalFetch = window.fetch;
      if(typeof originalFetch === 'function'){
        window.fetch = function(...args){
          begin();
          let finished = false;
          const finalize = () => {
            if(finished) return;
            finished = true;
            end();
          };
          try{
            const response = originalFetch.apply(this, args);
            Promise.resolve(response).then(finalize, finalize);
            return response;
          } catch(err){
            finalize();
            throw err;
          }
        };
      }

      if('XMLHttpRequest' in window && XMLHttpRequest.prototype){
        const originalSend = XMLHttpRequest.prototype.send;
        if(typeof originalSend === 'function'){
          XMLHttpRequest.prototype.send = function(...args){
            begin();
            let finalized = false;
            const finalize = () => {
              if(finalized) return;
              finalized = true;
              this.removeEventListener('loadend', finalize);
              end();
            };
            this.addEventListener('loadend', finalize);
            try{
              return originalSend.apply(this, args);
            } catch(err){
              finalize();
              throw err;
            }
          };
        }
      }

      const loaderApi = (()=>{
        const api = {
          begin(){ begin(); },
          end(){ end(); },
          track(promise){
            if(!promise || typeof promise.then !== 'function'){
              return promise;
            }
            let settled = false;
            begin();
            const finalize = () => {
              if(settled) return;
              settled = true;
              end();
            };
            Promise.resolve(promise).then(finalize, finalize);
            return promise;
          }
        };
        return api;
      })();

      const existingLoader = window.__logoLoading && typeof window.__logoLoading === 'object'
        ? window.__logoLoading
        : {};
      existingLoader.begin = loaderApi.begin;
      existingLoader.end = loaderApi.end;
      existingLoader.track = loaderApi.track;
      existingLoader.trackPromise = loaderApi.track;
      window.__logoLoading = existingLoader;
    })();


// Extracted from <script>
// --- tiny scheduler helpers ---
  function rafThrottle(fn){
    let scheduled = false, lastArgs, lastThis;
    return function throttled(...args){
      lastArgs = args; lastThis = this;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; fn.apply(lastThis, lastArgs); });
    };
  }

  // Prefer idle time, but don't stall forever.
  function scheduleIdle(fn, timeout=200){
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, Math.min(timeout, 50));
    }
  }

  function withPassiveDefault(options){
    if(options === undefined){
      return { passive: true };
    }
    if(typeof options === 'boolean'){
      return { capture: options, passive: true };
    }
    if(typeof options === 'object' && options !== null && options.passive === undefined){
      return Object.assign({}, options, { passive: true });
    }
    return options;
  }

  function addPassiveScrollListener(target, listener, options){
    if(!target || typeof target.addEventListener !== 'function') return null;
    const opts = withPassiveDefault(options);
    target.addEventListener('scroll', listener, opts);
    return opts;
  }

  function removeScrollListener(target, listener, options){
    if(!target || typeof target.removeEventListener !== 'function') return;
    let capture = false;
    if(typeof options === 'boolean'){
      capture = options;
    } else if(typeof options === 'object' && options !== null){
      capture = !!options.capture;
    }
    target.removeEventListener('scroll', listener, capture);
  }


// Extracted from <script>
(function(){
  const ASSET_VERSION = 'v=20240705';
  const assetPattern = /^(?:\.\/)?assets\//;

  function withVersion(url){
    if (!url || url.includes('?')) return url;
    if (!assetPattern.test(url)) return url;
    if (url.startsWith('./')) {
      return `./${url.slice(2)}?${ASSET_VERSION}`;
    }
    return `${url}?${ASSET_VERSION}`;
  }

  function toAbsoluteUrl(url){
    if (!url) return url;
    try {
      return new URL(url, window.location.href).href;
    } catch (err) {
      return url;
    }
  }

  function bustCacheAttributes(){
    const attrs = ['src', 'href'];
    attrs.forEach((attr) => {
      document.querySelectorAll(`[${attr}]`).forEach((node) => {
        const current = node.getAttribute(attr);
        const updated = withVersion(current);
        if (updated && updated !== current) {
          node.setAttribute(attr, updated);
        }
      });
    });

    document.querySelectorAll('[srcset]').forEach((node) => {
      const srcset = node.getAttribute('srcset');
      if (!srcset) return;
      const rewritten = srcset
        .split(',')
        .map((entry) => {
          const trimmed = entry.trim();
          if (!trimmed) return trimmed;
          const parts = trimmed.split(/\s+/, 2);
          const nextUrl = withVersion(parts[0]);
          if (!nextUrl || nextUrl === parts[0]) return trimmed;
          return parts[1] ? `${nextUrl} ${parts[1]}` : nextUrl;
        })
        .join(', ');
      if (rewritten !== srcset) {
        node.setAttribute('srcset', rewritten);
      }
    });
  }

  function updateManifest(){
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const manifest = {
      name: 'Events Platform',
      short_name: 'Events',
      icons: [
        {
          src: toAbsoluteUrl(withVersion('assets/favicons/android-chrome-192x192.png')),
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: toAbsoluteUrl(withVersion('assets/favicons/android-chrome-512x512.png')),
          sizes: '512x512',
          type: 'image/png'
        }
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone'
    };
    const serialized = encodeURIComponent(JSON.stringify(manifest));
    link.setAttribute('href', `data:application/manifest+json;charset=utf-8,${serialized}`);
  }

  function hideGeocoderIconFromAT(){
    let applied = false;
    document.querySelectorAll('.mapboxgl-ctrl-geocoder--icon').forEach((icon) => {
      if (icon.getAttribute('aria-hidden') === 'true') return;
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('role', 'presentation');
      applied = true;
    });
    return applied;
  }

  function setupGeocoderObserver(){
    const observer = new MutationObserver(() => {
      if (hideGeocoderIconFromAT()) {
        /* noop */
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bustCacheAttributes();
    updateManifest();
    hideGeocoderIconFromAT();
    setupGeocoderObserver();
  });
})();


// Extracted from <script>
if (typeof slugify !== 'function') {
  function slugify(text) {
    return String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}


// Extracted from <script>
// === 150x40 pill provider (sprite id: marker-label-bg) ===
(function(){
  const PILL_ID = 'marker-label-bg';
  const ACCENT_ID = `${PILL_ID}--accent`;
  const PILL_BASE_IMAGE_URL = 'assets/icons-30/150x40-pill-70.webp';
  const PILL_ACCENT_IMAGE_URL = 'assets/icons-30/150x40-pill-2f3b73.webp';
  let cachedImages = null;
  let loadingTask = null;
  const pendingMaps = new Set();

  function applyImageToMap(map){
    if(!map || typeof map.hasImage !== 'function' || !cachedImages){
      return;
    }
    try{
      if(map.hasImage(PILL_ID)){
        try{ map.removeImage(PILL_ID); }catch(e){}
      }
      if(map.hasImage(ACCENT_ID)){
        try{ map.removeImage(ACCENT_ID); }catch(e){}
      }
      const baseImage = cachedImages.base || cachedImages.accent;
      if(baseImage){
        map.addImage(PILL_ID, baseImage, { pixelRatio: 1 });
      }
      const accentImage = cachedImages.accent || cachedImages.base;
      if(accentImage){
        map.addImage(ACCENT_ID, accentImage, { pixelRatio: 1 });
      }
    }catch(e){ /* silent */ }
  }

  function tintImage(sourceImage, color, alpha = 1){
    if(!sourceImage){
      return null;
    }
    try{
      const width = sourceImage.naturalWidth || sourceImage.width || 150;
      const height = sourceImage.naturalHeight || sourceImage.height || 40;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d');
      if(!ctx){
        return null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImage, 0, 0, canvas.width / scale, canvas.height / scale);
      ctx.restore();
      if(color){
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      return canvas;
    }catch(err){
      return null;
    }
  }

  function prepareCachedImages(baseImage, accentImage){
    if(!baseImage){
      cachedImages = null;
      return;
    }
    const tintedBase = tintImage(baseImage, 'rgba(0,0,0,1)', 0.9) || baseImage;
    let highlight = null;
    if(accentImage){
      highlight = tintImage(accentImage, null, 1) || accentImage;
    }
    if(!highlight){
      highlight = tintImage(baseImage, '#2f3b73', 1) || tintedBase;
    }
    cachedImages = { base: tintedBase, accent: highlight };
  }

  function loadImage(url){
    if(!url){
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const img = new Image();
      try{ img.crossOrigin = 'anonymous'; }catch(e){}
      try{ img.decoding = 'async'; }catch(e){}
      img.onload = () => {
        if(img.naturalWidth > 0 && img.naturalHeight > 0){
          resolve(img);
        }else{
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
      if(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0){
        resolve(img);
      }
    });
  }

  function ensureImage(){
    if(cachedImages || loadingTask){
      return;
    }
    loadingTask = Promise.all([
      loadImage(PILL_BASE_IMAGE_URL),
      loadImage(PILL_ACCENT_IMAGE_URL)
    ]).then(([baseImage, accentImage]) => {
      if(baseImage){
        prepareCachedImages(baseImage, accentImage);
        if(cachedImages){
          pendingMaps.forEach((map) => applyImageToMap(map));
        }
      }
    }).catch(() => {
      cachedImages = null;
    }).finally(() => {
      pendingMaps.clear();
      loadingTask = null;
    });
  }

  function addOrReplacePill(map){
    try{
      if(!map || typeof map.hasImage !== 'function'){
        return;
      }
      if(cachedImages){
        applyImageToMap(map);
        return;
      }
      pendingMaps.add(map);
      ensureImage();
    }catch(e){ /* silent */ }
  }

  window.__addOrReplacePill150x40 = addOrReplacePill;
  ensureImage();
})();


// Extracted from <script>
let __userInteractionObserved = false;
let __notifyMapOnInteraction = null;

// Remember where the user actually clicked/tapped
    document.addEventListener('pointerdown', (e) => {
      window.__lastPointerDown = e;
      __userInteractionObserved = true;
      if(typeof __notifyMapOnInteraction === 'function'){
        const fn = __notifyMapOnInteraction;
        __notifyMapOnInteraction = null;
        try{ fn(); }catch(err){ console.error(err); }
      }
    }, { capture: true });

    document.addEventListener('touchstart', () => {
      __userInteractionObserved = true;
      if(typeof __notifyMapOnInteraction === 'function'){
        const fn = __notifyMapOnInteraction;
        __notifyMapOnInteraction = null;
        try{ fn(); }catch(err){ console.error(err); }
      }
    }, { capture: true, passive: true });

    document.addEventListener('keydown', () => {
      __userInteractionObserved = true;
      if(typeof __notifyMapOnInteraction === 'function'){
        const fn = __notifyMapOnInteraction;
        __notifyMapOnInteraction = null;
        try{ fn(); }catch(err){ console.error(err); }
      }
    }, { capture: true });


// Extracted from <script>
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
  const markerIconSize = 1;
  const markerIconBaseSizePx = 30;
  const markerLabelBackgroundWidthPx = 150;
  const markerLabelBackgroundHeightPx = 40;
  const markerLabelTextGapPx = 5;
  const markerLabelMarkerInsetPx = 5;
  const markerLabelTextRightPaddingPx = 5;
  const markerLabelTextPaddingPx = markerIconBaseSizePx * markerIconSize + markerLabelMarkerInsetPx + markerLabelTextGapPx;
  const markerLabelTextAreaWidthPx = Math.max(0, markerLabelBackgroundWidthPx - markerLabelTextPaddingPx - markerLabelTextRightPaddingPx);
  const markerLabelTextSize = 12;
  const markerLabelTextLineHeight = 1.2;
  const markerLabelBgTranslatePx = 0;
  const markerLabelEllipsisChar = '\u2026';
  const mapCardTitleWidthPx = 165;
  let markerLabelMeasureContext = null;
  const markerLabelCompositePlaceholderIds = new Set();

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
    while(remaining && lines.length < maxLines){
      if(lines.length === maxLines - 1){
        lines.push(shortenMarkerLabelText(remaining, widthPx));
        break;
      }
      let low = 1;
      let high = remaining.length;
      let bestIndex = 0;
      while(low <= high){
        const mid = Math.floor((low + high) / 2);
        const candidate = remaining.slice(0, mid).trimEnd();
        if(!candidate){
          low = mid + 1;
          continue;
        }
        if(ctx.measureText(candidate).width <= widthPx){
          bestIndex = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      let line = remaining.slice(0, bestIndex).trimEnd();
      const leftoverRaw = remaining.slice(bestIndex);
      const leftoverHadLeadingWhitespace = /^\s/.test(leftoverRaw);
      let leftover = leftoverRaw.trimStart();
      if(leftover){
        const lastSpace = line.lastIndexOf(' ');
        if(lastSpace > 0){
          const candidate = line.slice(0, lastSpace).trimEnd();
          const movedBase = line.slice(lastSpace + 1);
          const moved = (leftoverHadLeadingWhitespace ? `${movedBase} ${leftover}` : `${movedBase}${leftover}`).trim();
          if(candidate && ctx.measureText(candidate).width <= widthPx){
            line = candidate;
            leftover = moved;
          }
        }
      }
      if(!line){
        lines.push(shortenMarkerLabelText(remaining, widthPx));
        break;
      }
      lines.push(line);
      remaining = leftover;
      if(remaining && ctx.measureText(remaining).width <= widthPx && lines.length < maxLines){
        lines.push(remaining);
        break;
      }
    }
    return lines;
  }

  function getPrimaryVenueName(p){
    if(!p) return '';
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
    const markerTitleLines = splitTextAcrossLines(title, markerLabelTextAreaWidthPx, 2);
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

  const MARKER_LABEL_BG_ID = 'marker-label-bg';
  const MARKER_LABEL_BG_ACCENT_ID = `${MARKER_LABEL_BG_ID}--accent`;
  const MARKER_LABEL_COMPOSITE_PREFIX = 'marker-label-composite-';
  const MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX = '--accent';
  const VISIBLE_MARKER_LABEL_LAYERS = ['marker-label', 'marker-label-highlight'];
  const markerLabelCompositeStore = new Map();
  const markerLabelCompositePending = new Map();
  let lastInViewMarkerLabelSpriteIds = new Set();
  // Mapbox GL JS enforces a hard limit on the number of images that can be
  // registered with a style (currently ~1000). Generating a composite sprite
  // for every single marker label without a cap quickly exhausts that budget,
  // which in turn causes Mapbox to render the fallback pill without any icon
  // or text. Each composite registers both a base pill and its accent variant,
  // so cap the composites to keep the total image count comfortably below the
  // platform ceiling.
  const MARKER_LABEL_COMPOSITE_LIMIT = 900;
  const MARKER_SPRITE_RETAIN_ZOOM = 12;
  let markerLabelPillImagePromise = null;

  function nowTimestamp(){
    try{
      if(typeof performance !== 'undefined' && typeof performance.now === 'function'){
        return performance.now();
      }
    }catch(err){}
    return Date.now();
  }

  function collectActiveCompositeEntries(mapInstance){
    const entries = [];
    if(!mapInstance) return entries;
    markerLabelCompositeStore.forEach((meta, spriteId) => {
      if(!meta || !meta.image) return;
      const compositeId = markerLabelCompositeId(spriteId);
      let present = false;
      if(typeof mapInstance.hasImage === 'function'){
        try{ present = !!mapInstance.hasImage(compositeId); }
        catch(err){ present = false; }
      }
      if(!present) return;
      entries.push({
        spriteId,
        compositeId,
        priority: Boolean(meta.priority),
        inView: Boolean(meta.inView),
        lastUsed: Number.isFinite(meta.lastUsed) ? meta.lastUsed : 0
      });
    });
    return entries;
  }

  function touchMarkerLabelCompositeMeta(spriteId, options = {}){
    if(!spriteId) return null;
    const opts = options || {};
    const meta = markerLabelCompositeStore.get(spriteId) || {};
    const shouldUpdateTime = opts.updateTimestamp !== false;
    if(shouldUpdateTime){
      const ts = Number.isFinite(opts.timestamp) ? opts.timestamp : nowTimestamp();
      meta.lastUsed = ts;
    } else if(!Number.isFinite(meta.lastUsed)){
      meta.lastUsed = 0;
    }
    if(opts.inView !== undefined){
      meta.inView = Boolean(opts.inView);
    }
    if(opts.priority !== undefined){
      meta.priority = Boolean(opts.priority);
    }
    markerLabelCompositeStore.set(spriteId, meta);
    return meta;
  }

  function refreshInViewMarkerLabelComposites(mapInstance){
    if(!mapInstance || typeof mapInstance.queryRenderedFeatures !== 'function'){
      return;
    }
    let features = [];
    const layersToQuery = Array.isArray(VISIBLE_MARKER_LABEL_LAYERS)
      ? VISIBLE_MARKER_LABEL_LAYERS.filter(layerId => {
          if(!layerId){
            return false;
          }
          if(typeof mapInstance.getLayer !== 'function'){
            return true;
          }
          try{
            return Boolean(mapInstance.getLayer(layerId));
          }catch(err){
            return false;
          }
        })
      : [];
    try{
      if(layersToQuery.length){
        features = mapInstance.queryRenderedFeatures({ layers: layersToQuery });
      }
    }catch(err){
      features = [];
    }
    const nextIds = new Set();
    const timestamp = nowTimestamp();
    features.forEach(feature => {
      if(!feature || !feature.properties) return;
      const rawSpriteId = feature.properties.labelSpriteId ?? feature.properties.spriteId;
      if(rawSpriteId === undefined || rawSpriteId === null) return;
      const spriteId = String(rawSpriteId);
      if(!spriteId) return;
      if(nextIds.has(spriteId)){
        touchMarkerLabelCompositeMeta(spriteId, { inView: true, updateTimestamp: false });
        return;
      }
      nextIds.add(spriteId);
      touchMarkerLabelCompositeMeta(spriteId, { inView: true, timestamp });
    });
    lastInViewMarkerLabelSpriteIds.forEach(spriteId => {
      if(nextIds.has(spriteId)) return;
      const meta = markerLabelCompositeStore.get(spriteId);
      if(!meta) return;
      meta.inView = false;
      markerLabelCompositeStore.set(spriteId, meta);
    });
    lastInViewMarkerLabelSpriteIds = nextIds;
  }

  function enforceMarkerLabelCompositeBudget(mapInstance, options = {}){
    if(!mapInstance || !MARKER_LABEL_COMPOSITE_LIMIT || MARKER_LABEL_COMPOSITE_LIMIT <= 0){
      return;
    }
    let zoomForBudget = NaN;
    if(typeof mapInstance.getZoom === 'function'){
      try{ zoomForBudget = mapInstance.getZoom(); }
      catch(err){ zoomForBudget = NaN; }
    }
    if(Number.isFinite(zoomForBudget) && zoomForBudget >= MARKER_SPRITE_RETAIN_ZOOM){
      mapInstance.__retainAllMarkerSprites = true;
    }
    if(mapInstance.__retainAllMarkerSprites){
      return;
    }
    if(typeof mapInstance.removeImage !== 'function'){
      return;
    }
    const { keep = [], reserve = 0 } = options || {};
    const keepList = Array.isArray(keep) ? keep : [keep];
    const keepSet = new Set(keepList.filter(Boolean));
    const entries = collectActiveCompositeEntries(mapInstance);
    if(!entries.length){
      return;
    }
    const effectiveLimit = Math.max(0, MARKER_LABEL_COMPOSITE_LIMIT - Math.max(0, reserve));
    if(entries.length <= effectiveLimit){
      return;
    }
    entries.forEach(entry => {
      entry.keep = keepSet.has(entry.spriteId);
    });
    entries.sort((a, b) => {
      if(a.keep !== b.keep){
        return a.keep ? -1 : 1;
      }
      if(a.inView !== b.inView){
        return a.inView ? -1 : 1;
      }
      if(a.priority !== b.priority){
        return a.priority ? -1 : 1;
      }
      return (b.lastUsed || 0) - (a.lastUsed || 0);
    });
    entries.slice(effectiveLimit).forEach(entry => {
      if(keepSet.has(entry.spriteId)) return;
      const meta = markerLabelCompositeStore.get(entry.spriteId);
      if(meta){
        if(meta.image){
          try{ delete meta.image; }catch(err){ meta.image = null; }
        }
        if(meta.options){
          try{ delete meta.options; }catch(err){ meta.options = undefined; }
        }
        if(meta.highlightImage){
          try{ delete meta.highlightImage; }catch(err){ meta.highlightImage = null; }
        }
        if(meta.highlightOptions){
          try{ delete meta.highlightOptions; }catch(err){ meta.highlightOptions = undefined; }
        }
        meta.inView = false;
        markerLabelCompositeStore.set(entry.spriteId, meta);
      }
      markerLabelCompositePending.delete(entry.spriteId);
      try{
        if(typeof mapInstance.hasImage === 'function'){
          if(mapInstance.hasImage(entry.compositeId)){
            mapInstance.removeImage(entry.compositeId);
          }
          const highlightId = `${entry.compositeId}${MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX}`;
          if(mapInstance.hasImage(highlightId)){
            mapInstance.removeImage(highlightId);
          }
        }
      }catch(err){}
    });
  }

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

  async function ensureMarkerLabelPillImage(){
    if(markerLabelPillImagePromise){
      return markerLabelPillImagePromise;
    }
    const baseUrl = 'assets/icons-30/150x40-pill-70.webp';
    const accentUrl = 'assets/icons-30/150x40-pill-2f3b73.webp';
    const promise = Promise.all([
      loadMarkerLabelImage(baseUrl),
      loadMarkerLabelImage(accentUrl).catch(() => null)
    ]).then(([baseImg, accentImg]) => {
      if(!baseImg){
        return null;
      }
      return { base: baseImg, highlight: accentImg };
    }).catch(err => {
      console.error(err);
      return null;
    });
    markerLabelPillImagePromise = promise;
    promise.then(result => {
      if(!result){
        markerLabelPillImagePromise = null;
      }
    }).catch(() => {
      markerLabelPillImagePromise = null;
    });
    return markerLabelPillImagePromise;
  }

  function computeMarkerLabelCanvasDimensions(sourceImage){
    const rawWidth = sourceImage && (sourceImage.naturalWidth || sourceImage.width)
      ? (sourceImage.naturalWidth || sourceImage.width)
      : markerLabelBackgroundWidthPx;
    const rawHeight = sourceImage && (sourceImage.naturalHeight || sourceImage.height)
      ? (sourceImage.naturalHeight || sourceImage.height)
      : markerLabelBackgroundHeightPx;
    const canvasWidth = Math.max(1, Math.round(Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : markerLabelBackgroundWidthPx));
    const canvasHeight = Math.max(1, Math.round(Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : markerLabelBackgroundHeightPx));
    const pixelRatio = canvasWidth / markerLabelBackgroundWidthPx;
    return { canvasWidth, canvasHeight, pixelRatio };
  }

  function drawMarkerLabelComposite(ctx, image, x, y, width, height){
    if(!ctx || !image){
      return;
    }
    const scale = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(scale, scale);
    try{
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, x / scale, y / scale, width / scale, height / scale);
    }catch(err){
      console.error(err);
    }
    ctx.restore();
  }

  function buildMarkerLabelPillSprite(sourceImage, tintColor, tintAlpha = 1){
    if(!sourceImage){
      return null;
    }
    const { canvasWidth, canvasHeight, pixelRatio } = computeMarkerLabelCanvasDimensions(sourceImage);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if(!ctx){
      return null;
    }
    try{
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      const scale = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImage, 0, 0, canvasWidth / scale, canvasHeight / scale);
      ctx.restore();
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

  let markerLabelPillSpriteCache = null;

  async function ensureMarkerLabelPillSprites(){
    if(markerLabelPillSpriteCache){
      return markerLabelPillSpriteCache;
    }
    const assets = await ensureMarkerLabelPillImage();
    if(!assets || !assets.base){
      return null;
    }
    const baseSprite = buildMarkerLabelPillSprite(assets.base, 'rgba(0,0,0,1)', 0.9);
    let accentSprite = null;
    if(assets.highlight){
      accentSprite = buildMarkerLabelPillSprite(assets.highlight, null, 1);
    }
    if(!accentSprite){
      accentSprite = buildMarkerLabelPillSprite(assets.base, '#2f3b73', 1);
    }
    if(!baseSprite){
      return null;
    }
    markerLabelPillSpriteCache = {
      base: baseSprite,
      highlight: accentSprite || baseSprite
    };
    return markerLabelPillSpriteCache;
  }

  function markerLabelCompositeId(spriteId){
    return `${MARKER_LABEL_COMPOSITE_PREFIX}${spriteId}`;
  }

  async function createMarkerLabelCompositeTextures(mapInstance, labelSpriteId, meta){
    if(!labelSpriteId){
      return null;
    }
    const pillAssets = await ensureMarkerLabelPillImage();
    if(!pillAssets || !pillAssets.base){
      return null;
    }
    const pillImg = pillAssets.base;
    const pillAccentImg = pillAssets.highlight;
    const markerSources = window.subcategoryMarkers || {};
    const iconUrl = meta && meta.iconId ? markerSources[meta.iconId] : null;
    let iconImg = null;
    if(iconUrl){
      try{
        iconImg = await loadMarkerLabelImage(iconUrl);
      }catch(err){
        console.error(err);
        iconImg = null;
      }
    }
    const { canvasWidth, canvasHeight, pixelRatio } = computeMarkerLabelCanvasDimensions(pillImg);
    let deviceScale = 1;
    try{
      const ratio = window.devicePixelRatio;
      if(Number.isFinite(ratio) && ratio > 0){
        deviceScale = ratio;
      }
    }catch(err){
      deviceScale = 1;
    }
    if(!Number.isFinite(deviceScale) || deviceScale <= 0){
      deviceScale = 1;
    }
    const scaledCanvasWidth = Math.max(1, Math.round(canvasWidth * deviceScale));
    const scaledCanvasHeight = Math.max(1, Math.round(canvasHeight * deviceScale));
    const scaledPixelRatio = (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1) * deviceScale;
    const labelLines = [];
    const line1 = (meta && meta.labelLine1 ? meta.labelLine1 : '').trim();
    const line2 = (meta && meta.labelLine2 ? meta.labelLine2 : '').trim();
    if(line1){
      labelLines.push({ text: line1, color: '#ffffff' });
    }
    if(line2){
      labelLines.push({ text: line2, color: meta && meta.isMulti ? '#d0d0d0' : '#ffffff' });
    }
    const drawForeground = (ctx) => {
      if(!ctx){
        return;
      }
      try{
        ctx.imageSmoothingEnabled = true;
        if('imageSmoothingQuality' in ctx){
          ctx.imageSmoothingQuality = 'high';
        }
      }catch(err){}
      if(iconImg){
        const iconSizePx = markerIconBaseSizePx * markerIconSize * scaledPixelRatio;
        const destX = Math.round(markerLabelMarkerInsetPx * scaledPixelRatio);
        const destY = Math.round((scaledCanvasHeight - iconSizePx) / 2);
        drawMarkerLabelComposite(ctx, iconImg, destX, destY, iconSizePx, iconSizePx);
      }
      if(labelLines.length){
        const fontSizePx = markerLabelTextSize * scaledPixelRatio;
        const lineGapPx = Math.max(0, (markerLabelTextLineHeight - 1) * markerLabelTextSize * scaledPixelRatio);
        const totalHeight = labelLines.length * fontSizePx + Math.max(0, labelLines.length - 1) * lineGapPx;
        let textY = Math.round((scaledCanvasHeight - totalHeight) / 2);
        if(!Number.isFinite(textY) || textY < 0){
          textY = 0;
        }
        const textX = Math.round(markerLabelTextPaddingPx * scaledPixelRatio);
        ctx.font = `${fontSizePx}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 2 * scaledPixelRatio;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1 * scaledPixelRatio;
        labelLines.forEach(line => {
          ctx.fillStyle = line.color;
          try{
            ctx.fillText(line.text, textX, textY);
          }catch(err){
            console.error(err);
          }
          textY += fontSizePx + lineGapPx;
        });
        ctx.shadowColor = 'transparent';
      }
    };
    const buildComposite = (backgroundImage, tintColor, tintAlpha = 1) => {
      if(!backgroundImage){
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = scaledCanvasWidth;
      canvas.height = scaledCanvasHeight;
      const ctx = canvas.getContext('2d');
      if(!ctx){
        return null;
      }
      ctx.clearRect(0, 0, scaledCanvasWidth, scaledCanvasHeight);
      try{
        drawMarkerLabelComposite(ctx, backgroundImage, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
      }catch(err){
        console.error(err);
      }
      if(tintColor){
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = tintAlpha;
        ctx.fillStyle = tintColor;
        ctx.fillRect(0, 0, scaledCanvasWidth, scaledCanvasHeight);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      drawForeground(ctx);
      let imageData = null;
      try{
        imageData = ctx.getImageData(0, 0, scaledCanvasWidth, scaledCanvasHeight);
      }catch(err){
        console.error(err);
        imageData = null;
      }
      if(!imageData){
        return null;
      }
      return {
        image: imageData,
        options: { pixelRatio: Number.isFinite(scaledPixelRatio) && scaledPixelRatio > 0 ? scaledPixelRatio : 1 }
      };
    };
    const baseComposite = buildComposite(pillImg, 'rgba(0,0,0,1)', 0.9);
    let accentComposite = null;
    if(pillAccentImg){
      accentComposite = buildComposite(pillAccentImg, null, 1);
    }
    if(!accentComposite){
      accentComposite = buildComposite(pillImg, '#2f3b73', 1);
    }
    if(!baseComposite){
      return null;
    }
    const highlightComposite = accentComposite || baseComposite;
    const nextMeta = Object.assign({}, meta || {}, {
      image: baseComposite.image,
      options: baseComposite.options,
      highlightImage: highlightComposite ? highlightComposite.image : null,
      highlightOptions: (highlightComposite && highlightComposite.options) || baseComposite.options
    });
    markerLabelCompositeStore.set(labelSpriteId, nextMeta);
    return {
      base: baseComposite,
      highlight: highlightComposite,
      meta: nextMeta
    };
  }

  async function ensureMarkerLabelCompositeAssets(mapInstance, labelSpriteId, meta){
    if(!labelSpriteId){
      return null;
    }
    const existing = markerLabelCompositeStore.get(labelSpriteId);
    if(existing && existing.image){
      return {
        base: { image: existing.image, options: existing.options || {} },
        highlight: {
          image: existing.highlightImage || existing.image,
          options: existing.highlightOptions || existing.options || {}
        },
        meta: existing
      };
    }
    if(markerLabelCompositePending.has(labelSpriteId)){
      try{
        await markerLabelCompositePending.get(labelSpriteId);
      }catch(err){
        console.error(err);
      }
      const refreshed = markerLabelCompositeStore.get(labelSpriteId);
      if(refreshed && refreshed.image){
        return {
          base: { image: refreshed.image, options: refreshed.options || {} },
          highlight: {
            image: refreshed.highlightImage || refreshed.image,
            options: refreshed.highlightOptions || refreshed.options || {}
          },
          meta: refreshed
        };
      }
    }
    const task = (async () => {
      return createMarkerLabelCompositeTextures(mapInstance, labelSpriteId, meta);
    })();
    markerLabelCompositePending.set(labelSpriteId, task);
    try{
      const generated = await task;
      if(!generated || !generated.base){
        return null;
      }
      return generated;
    }finally{
      markerLabelCompositePending.delete(labelSpriteId);
    }
  }

  async function generateMarkerImageFromId(id, mapInstance, options = {}){
    if(!id){
      return null;
    }
    const targetMap = mapInstance || map;
    if(id === MARKER_LABEL_BG_ID || id === MARKER_LABEL_BG_ACCENT_ID){
      const sprites = await ensureMarkerLabelPillSprites();
      if(!sprites){
        return {
          image: createTransparentPlaceholder(markerLabelBackgroundWidthPx, markerLabelBackgroundHeightPx),
          options: { pixelRatio: 1 }
        };
      }
      return id === MARKER_LABEL_BG_ID ? sprites.base : (sprites.highlight || sprites.base);
    }
    if(id && id.startsWith(MARKER_LABEL_COMPOSITE_PREFIX)){
      const isAccent = id.endsWith(MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX);
      const baseId = isAccent ? id.slice(0, -MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX.length) : id;
      const spriteId = baseId.slice(MARKER_LABEL_COMPOSITE_PREFIX.length);
      if(!spriteId){
        return null;
      }
      const meta = markerLabelCompositeStore.get(spriteId);
      if(!meta){
        return null;
      }
      const assets = await ensureMarkerLabelCompositeAssets(targetMap, spriteId, meta);
      if(!assets || !assets.base){
        return null;
      }
      const updatedMeta = markerLabelCompositeStore.get(spriteId) || assets.meta || meta;
      if(isAccent){
        const image = updatedMeta && (updatedMeta.highlightImage || updatedMeta.image);
        if(!image){
          return null;
        }
        return {
          image,
          options: updatedMeta.highlightOptions || updatedMeta.options || {}
        };
      }
      if(updatedMeta && updatedMeta.image){
        return {
          image: updatedMeta.image,
          options: updatedMeta.options || {}
        };
      }
      return null;
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

  async function ensureMarkerLabelComposite(mapInstance, labelSpriteId, iconId, labelLine1, labelLine2, isMulti, options = {}){
    if(!mapInstance || !labelSpriteId){
      return null;
    }
    const { priority = false } = options || {};
    const compositeId = markerLabelCompositeId(labelSpriteId);
    const highlightId = `${compositeId}${MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX}`;
    const meta = markerLabelCompositeStore.get(labelSpriteId) || {};
    meta.iconId = iconId || meta.iconId || '';
    meta.labelLine1 = labelLine1 ?? meta.labelLine1 ?? '';
    meta.labelLine2 = labelLine2 ?? meta.labelLine2 ?? '';
    meta.isMulti = Boolean(isMulti ?? meta.isMulti);
    meta.priority = Boolean(priority);
    meta.lastUsed = nowTimestamp();
    markerLabelCompositeStore.set(labelSpriteId, meta);
    if(mapInstance.hasImage?.(compositeId)){
      if(markerLabelCompositePlaceholderIds.has(compositeId)){
        try{ mapInstance.removeImage(compositeId); }catch(err){}
        markerLabelCompositePlaceholderIds.delete(compositeId);
      } else {
        return compositeId;
      }
    }
    if(markerLabelCompositePlaceholderIds.has(highlightId) && mapInstance.hasImage?.(highlightId)){
      try{ mapInstance.removeImage(highlightId); }catch(err){}
      markerLabelCompositePlaceholderIds.delete(highlightId);
    }
    const assets = await ensureMarkerLabelCompositeAssets(mapInstance, labelSpriteId, meta);
    if(!assets || !assets.base){
      return null;
    }
    const baseComposite = assets.base;
    const highlightComposite = assets.highlight;
    try{
      if(mapInstance.hasImage?.(compositeId)){
        mapInstance.removeImage(compositeId);
      }
      markerLabelCompositePlaceholderIds.delete(compositeId);
      if(mapInstance.hasImage?.(highlightId)){
        mapInstance.removeImage(highlightId);
      }
      markerLabelCompositePlaceholderIds.delete(highlightId);
    }catch(err){
      console.error(err);
    }
    try{
      enforceMarkerLabelCompositeBudget(mapInstance, { keep: [labelSpriteId], reserve: 1 });
      mapInstance.addImage(compositeId, baseComposite.image, baseComposite.options || {});
      markerLabelCompositePlaceholderIds.delete(compositeId);
      if(highlightComposite && highlightComposite.image){
        mapInstance.addImage(highlightId, highlightComposite.image, highlightComposite.options || baseComposite.options || {});
        markerLabelCompositePlaceholderIds.delete(highlightId);
      }
      const updatedMeta = markerLabelCompositeStore.get(labelSpriteId) || meta;
      if(updatedMeta){
        markerLabelCompositeStore.set(labelSpriteId, Object.assign(updatedMeta, {
          image: baseComposite.image,
          options: baseComposite.options,
          highlightImage: highlightComposite ? highlightComposite.image : null,
          highlightOptions: (highlightComposite && highlightComposite.options) || baseComposite.options
        }));
      }
      enforceMarkerLabelCompositeBudget(mapInstance, { keep: [labelSpriteId] });
      return compositeId;
    }catch(err){
      console.error(err);
      return null;
    }
  }

  function reapplyMarkerLabelComposites(mapInstance){
    if(!mapInstance){
      return;
    }
    const entries = [];
    markerLabelCompositeStore.forEach((entry, spriteId) => {
      if(!entry || !entry.image){
        return;
      }
      entries.push({
        spriteId,
        compositeId: markerLabelCompositeId(spriteId),
        image: entry.image,
        options: entry.options || {},
        highlightImage: entry.highlightImage,
        highlightOptions: entry.highlightOptions || entry.options || {},
        priority: Boolean(entry.priority),
        lastUsed: Number.isFinite(entry.lastUsed) ? entry.lastUsed : 0
      });
    });
    entries.sort((a, b) => {
      if(a.priority !== b.priority){
        return a.priority ? -1 : 1;
      }
      if(a.lastUsed !== b.lastUsed){
        return (b.lastUsed || 0) - (a.lastUsed || 0);
      }
      return a.spriteId.localeCompare(b.spriteId);
    });
    entries.forEach(entry => {
      let already = false;
      if(typeof mapInstance.hasImage === 'function'){
        try{ already = !!mapInstance.hasImage(entry.compositeId); }
        catch(err){ already = false; }
      }
      if(already){
        if(markerLabelCompositePlaceholderIds.has(entry.compositeId)){
          try{ mapInstance.removeImage(entry.compositeId); }catch(err){}
          markerLabelCompositePlaceholderIds.delete(entry.compositeId);
          already = false;
        } else {
          return;
        }
      }
      try{
        enforceMarkerLabelCompositeBudget(mapInstance, { keep: [entry.spriteId], reserve: 1 });
        mapInstance.addImage(entry.compositeId, entry.image, entry.options || {});
        markerLabelCompositePlaceholderIds.delete(entry.compositeId);
        if(entry.highlightImage){
          const highlightId = `${entry.compositeId}${MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX}`;
          try{ if(mapInstance.hasImage?.(highlightId)) mapInstance.removeImage(highlightId); }catch(err){}
          try{ mapInstance.addImage(highlightId, entry.highlightImage, entry.highlightOptions || entry.options || {}); }
          catch(err){ console.error(err); }
          markerLabelCompositePlaceholderIds.delete(highlightId);
        }
        enforceMarkerLabelCompositeBudget(mapInstance, { keep: [entry.spriteId] });
      }catch(err){
        console.error(err);
      }
    });
  }

  function scheduleMarkerLabelBackgroundRetry(mapInstance){
    if(!mapInstance || typeof mapInstance === 'undefined') return;
    const mark = '__markerLabelBgRetryScheduled';
    if(mapInstance[mark]) return;
    mapInstance[mark] = true;
    const retry = () => {
      mapInstance[mark] = false;
      try{ ensureMarkerLabelBackground(mapInstance); }catch(err){}
    };
    if(typeof mapInstance.once === 'function'){
      mapInstance.once('style.load', retry);
    } else if(typeof mapInstance.on === 'function'){
      const handler = () => {
        try{ mapInstance.off?.('style.load', handler); }catch(err){}
        retry();
      };
      mapInstance.on('style.load', handler);
    } else {
      setTimeout(retry, 0);
    }
  }

  function ensureMarkerLabelBackground(mapInstance){
    if(!mapInstance || typeof mapInstance.addImage !== 'function') return;
    try{
      if(mapInstance.hasImage && mapInstance.hasImage(MARKER_LABEL_BG_ID)){
        mapInstance.__markerLabelBgRetryScheduled = false;
        return;
      }
    }catch(err){
      scheduleMarkerLabelBackgroundRetry(mapInstance);
      return;
    }
    if(typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()){
      scheduleMarkerLabelBackgroundRetry(mapInstance);
      return;
    }
    const placeholder = document.createElement('canvas');
    try{
      placeholder.width = Math.max(1, Math.round(markerLabelBackgroundWidthPx));
      placeholder.height = Math.max(1, Math.round(markerLabelBackgroundHeightPx));
      const phCtx = placeholder.getContext('2d');
      if(phCtx){
        phCtx.clearRect(0, 0, placeholder.width, placeholder.height);
      }
    }catch(err){
      placeholder.width = 1;
      placeholder.height = 1;
    }
    try{
      mapInstance.addImage(MARKER_LABEL_BG_ID, placeholder, { pixelRatio: 1 });
      mapInstance.__markerLabelBgRetryScheduled = false;
    }catch(err){
      scheduleMarkerLabelBackgroundRetry(mapInstance);
      return;
    }
    try{ window.__addOrReplacePill150x40?.(mapInstance); }catch(err){}
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
      'marker-label',
      'marker-label-highlight',
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
  const callWhenDefined = window.callWhenDefined || function(name, invoke, timeoutMs){
    const start = performance.now(), max = timeoutMs ?? 5000;
    (function wait(){
      const fn = window[name];
      if (typeof fn === 'function') {
        try { invoke(fn); } catch(e){}
        return;
      }
      if (performance.now() - start < max) requestAnimationFrame(wait);
    })();
  };
  window.callWhenDefined = window.callWhenDefined || callWhenDefined;

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

  function closeWelcomeModalIfOpen(){
    const welcome = document.getElementById('welcome-modal');
    if(welcome && welcome.classList.contains('show')){
      closePanel(welcome);
    }
  }

  (function(){
    const MAPBOX_TOKEN = "pk.eyJ1IjoienhlbiIsImEiOiJjbWViaDRibXEwM2NrMm1wcDhjODg4em5iIn0.2A9teACgwpiCy33uO4WZJQ";

    let mode = localStorage.getItem('mode') || 'map';
    const DEFAULT_SPIN_SPEED = 0.3;
    const DEFAULT_WELCOME = '<p>Welcome to Funmap! Choose an area on the map to search for events and listings. Click the <svg class="icon-search" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" role="img" aria-label="Filters"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> button to refine your search.</p>';

    const firstVisit = !localStorage.getItem('hasVisited');
    localStorage.setItem('hasVisited','1');
    if(firstVisit){
      mode = 'map';
      localStorage.setItem('mode','map');
      localStorage.setItem('historyActive','false');
      ['filterPanel','memberPanel','adminPanel'].forEach(id => {
        localStorage.setItem(`panel-open-${id}`,'false');
      });
    }
    const savedView = JSON.parse(localStorage.getItem('mapView') || 'null');
    if(savedView && typeof savedView === 'object'){
      savedView.bearing = 0;
      try{ localStorage.setItem('mapView', JSON.stringify(savedView)); }catch(err){}
    }
    const defaultCenter = [(Math.random()*360)-180,(Math.random()*140)-70];
    const startCenter = savedView?.center || defaultCenter;
    const startZoom = savedView?.zoom || 1.5;
    let lastKnownZoom = startZoom;
    const hasSavedPitch = typeof savedView?.pitch === 'number';
    const initialPitch = hasSavedPitch ? savedView.pitch : LEGACY_DEFAULT_PITCH;
    startPitch = window.startPitch = initialPitch;
    startBearing = window.startBearing = 0;

      let map, spinning = false, historyWasActive = localStorage.getItem('historyActive') === 'true', expiredWasOn = false, dateStart = null, dateEnd = null,
          spinLoadStart = JSON.parse(localStorage.getItem('spinLoadStart') ?? 'true'),
          spinLoadType = localStorage.getItem('spinLoadType') || 'all',
          spinLogoClick = localStorage.getItem('spinLogoClick') === 'false' ? false : true,
          spinSpeed = DEFAULT_SPIN_SPEED,
          spinEnabled = spinLoadStart && (spinLoadType === 'all' || (spinLoadType === 'new' && firstVisit)),
          mapStyle = window.mapStyle = 'mapbox://styles/mapbox/standard';
      let markersLoaded = false;
      window.__markersLoaded = false;
      const MARKER_ZOOM_THRESHOLD = 8;
      const MARKER_SPRITE_ZOOM = MARKER_SPRITE_RETAIN_ZOOM;
      const ZOOM_VISIBILITY_PRECISION = 1000;
      const MARKER_VISIBILITY_BUCKET = Math.round(MARKER_ZOOM_THRESHOLD * ZOOM_VISIBILITY_PRECISION);
      const MARKER_PRELOAD_OFFSET = 0.2;
      const MARKER_PRELOAD_ZOOM = Math.max(MARKER_ZOOM_THRESHOLD - MARKER_PRELOAD_OFFSET, 0);
      const MARKER_LAYER_IDS = [
        'hover-fill',
        'marker-label',
        'marker-label-highlight'
      ];
      const ALL_MARKER_LAYER_IDS = [...MARKER_LAYER_IDS];
      const MID_ZOOM_MARKER_CLASS = 'map--midzoom-markers';
      const SPRITE_MARKER_CLASS = 'map--sprite-markers';
        const BALLOON_SOURCE_ID = 'post-balloon-source';
        const BALLOON_LAYER_ID = 'post-balloons';
        const BALLOON_LAYER_IDS = [BALLOON_LAYER_ID];
        const BALLOON_IMAGE_ID = 'seed-balloon-icon';
        const BALLOON_IMAGE_URL = 'assets/balloons/balloons-icon-16181-60.png';
        const BALLOON_MIN_ZOOM = 0;
        const BALLOON_MAX_ZOOM = MARKER_ZOOM_THRESHOLD;
        let balloonLayersVisible = true;

        function ensureBalloonIconImage(mapInstance){
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
            const emptyData = (typeof EMPTY_FEATURE_COLLECTION !== 'undefined') ? EMPTY_FEATURE_COLLECTION : { type:'FeatureCollection', features: [] };
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
        localStorage.setItem('spinGlobe', JSON.stringify(spinEnabled));
        logoEls = [document.querySelector('.logo')].filter(Boolean);
        let ensureMapIcon = null;
      function updateLogoClickState(){
        logoEls.forEach(el=>{
          el.style.cursor = 'pointer';
          el.style.pointerEvents = 'auto';
        });
      }
      updateLogoClickState();

      function openWelcome(){
        const popup = document.getElementById('welcome-modal');
        const msgEl = document.getElementById('welcomeMessageBox');
        const saved = JSON.parse(localStorage.getItem('admin-settings-current') || '{}');
        msgEl.innerHTML = saved.welcomeMessage || DEFAULT_WELCOME;
        openPanel(popup);
        const body = document.getElementById('welcomeBody');
        body.style.padding = '20px';
      }
      window.openWelcome = openWelcome;

      function toggleWelcome(){
        const popup = document.getElementById('welcome-modal');
        if(popup.classList.contains('show')){
          closePanel(popup);
        } else {
          openWelcome();
        }
      }

      logoEls.forEach(el=>{
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if(spinning){
            toggleWelcome();
            return;
          }
          if(spinLogoClick && map && map.getZoom() <= 4){
            spinEnabled = true;
            localStorage.setItem('spinGlobe', 'true');
            startSpin(true);
          }
          toggleWelcome();
        });
      });
    // 'Post Panel' is defined as the current map bounds
    let postPanel = null;
    let posts = [], filtered = [], adPosts = [], adIndex = -1, adTimer = null, adPanel = null, adIdsKey = '', pendingPostLoad = false;
    let filtersInitialized = false;
    let favToTop = false, favSortDirty = true, currentSort = 'az';
    let selection = { cats: new Set(), subs: new Set() };
    let viewHistory = loadHistory();
    let hoverPopup = null;
    let postSourceEventsBound = false;
    let touchMarker = null;
    let activePostId = null;
    let markerFeatureIndex = new Map();
    let lastHighlightedPostIds = [];
    let highlightedFeatureKeys = [];
    const hoverHighlightedPostIds = new Set();
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
      lastHighlightedPostIds = normalized.map(item => ({ id: item.id, venueKey: item.venueKey }));
      if(!map || typeof map.setFeatureState !== 'function'){
        if(!normalized.length){
          highlightedFeatureKeys = [];
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
      highlightedFeatureKeys = nextEntries;
      if(highlightSpriteIds.size){
        highlightSpriteIds.forEach(spriteId => {
          touchMarkerLabelCompositeMeta(spriteId, { updateTimestamp: true });
        });
      }
    }
    let selectedVenueKey = null;
    const BASE_URL = (()=>{ let b = location.origin + location.pathname.split('/post/')[0]; if(!b.endsWith('/')) b+='/'; return b; })();

    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
    const clamp = (n, a, b)=> Math.max(a, Math.min(b, n));
    const toRad = d => d * Math.PI / 180;
    function distKm(a,b){ const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng); const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(Math.PI*(b.lng - a.lng)/360)**2; return 2 * 6371 * Math.asin(Math.sqrt(s)); }
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    const nextFrame = ()=> new Promise(r=> requestAnimationFrame(()=>r()));

    // Ensure result lists occupy available space between the header and footer
    function adjustListHeight(){
      const rootStyles = getComputedStyle(document.documentElement);
      const headerH = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
      const subH = parseFloat(rootStyles.getPropertyValue('--subheader-h')) || 0;
      const footerH = parseFloat(rootStyles.getPropertyValue('--footer-h')) || 0;
      const safeTop = parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0;
      let viewportHeight = getViewportHeight();
      if(!Number.isFinite(viewportHeight) || viewportHeight <= 0){
        viewportHeight = headerH + subH + footerH + safeTop;
      }
      let availableHeight = Math.max(0, viewportHeight - headerH - subH - footerH - safeTop);
      if(!Number.isFinite(availableHeight) || availableHeight < 0){
        availableHeight = 0;
      }
      const root = document.documentElement;
      if(root){
        const fullHeight = (Number.isFinite(viewportHeight) && viewportHeight > 0)
          ? viewportHeight
          : (availableHeight + headerH + subH + footerH + safeTop);
        if(Number.isFinite(fullHeight) && fullHeight > 0){
          root.style.setProperty('--vh', `${(fullHeight / 100)}px`);
        }
        if(availableHeight > 0){
          root.style.setProperty('--panel-area-height', `${availableHeight}px`);
          root.style.setProperty('--boards-area-height', `${availableHeight}px`);
        } else {
          root.style.removeProperty('--panel-area-height');
          root.style.removeProperty('--boards-area-height');
        }
      }
      document.querySelectorAll('.recents-board, .quick-list-board, .post-board, .ad-board').forEach(list=>{
        if(availableHeight > 0){
          const value = `${availableHeight}px`;
          list.style.height = value;
          list.style.maxHeight = value;
          list.style.minHeight = value;
        } else {
          list.style.removeProperty('height');
          list.style.removeProperty('max-height');
          list.style.removeProperty('min-height');
        }
      });
    }
    window.adjustListHeight = adjustListHeight;
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', adjustListHeight);
      addPassiveScrollListener(window.visualViewport, adjustListHeight);
    }
    window.addEventListener('resize', adjustListHeight);
    window.addEventListener('orientationchange', adjustListHeight);

    let stickyScrollHandler = null;
      function updateStickyImages(){
        const root = document.documentElement;
        const openPost = document.querySelector('.post-board .open-post');
        const body = openPost ? openPost.querySelector('.post-body') : null;
        const imgArea = body ? body.querySelector('.post-images') : null;
        const header = openPost ? openPost.querySelector('.post-header') : null;
        document.body.classList.remove('hide-map-calendar');
        if(!openPost || !body || !imgArea || !header){
          document.body.classList.remove('open-post-sticky-images');
          root.style.removeProperty('--open-post-header-h');
          return;
        }
        root.style.setProperty('--open-post-header-h', header.offsetHeight + 'px');
        document.body.classList.add('open-post-sticky-images');
      }

    window.updateStickyImages = updateStickyImages;

    function updateLayoutVars(){
      const root = document.documentElement;
      const header = document.querySelector('.header');
      if(header){
        const headerStyles = getComputedStyle(header);
        const safeTop = parseFloat(headerStyles.paddingTop) || 0;
        const rect = header.getBoundingClientRect();
        let measured = Number.isFinite(rect.height) ? rect.height : 0;
        if(!measured || measured <= safeTop){
          const fallbackOffset = Number.isFinite(header.offsetHeight) ? header.offsetHeight : 0;
          measured = fallbackOffset;
        }
        if(!measured || measured <= safeTop){
          const fallbackScroll = Number.isFinite(header.scrollHeight) ? header.scrollHeight : 0;
          measured = fallbackScroll;
        }
        measured = Math.max(0, measured - safeTop);
        if(!measured){
          const rootStyles = getComputedStyle(root);
          const current = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
          if(current > 0){
            measured = current;
          }
        }
        if(measured > 0){
          root.style.setProperty('--header-h', `${measured}px`);
        }
      }
      if(typeof window.adjustListHeight === 'function'){
        window.adjustListHeight();
      }
    }
    window.updateLayoutVars = updateLayoutVars;

    function updatePostPanel(){ if(map) postPanel = map.getBounds(); }

    // === 0528 helpers: cluster contextmenu list (robust positioning + locking) ===
    let listLocked = false;
    function lockMap(lock){
      listLocked = lock;
      const fn = lock ? 'disable' : 'enable';
      try{ map.dragPan[fn](); }catch(e){}
      try{ map.scrollZoom[fn](); }catch(e){}
      try{ map.boxZoom[fn](); }catch(e){}
      try{ map.keyboard[fn](); }catch(e){}
      try{ map.doubleClickZoom[fn](); }catch(e){}
      try{ map.touchZoomRotate[fn](); }catch(e){}
    }
    const MARKER_INTERACTIVE_LAYERS = VISIBLE_MARKER_LABEL_LAYERS.slice();
    window.__overCard = window.__overCard || false;

    function getPopupElement(popup){
      return popup && typeof popup.getElement === 'function' ? popup.getElement() : null;
    }

    function popupIsHovered(popup){
      if(window.__overCard){
        return true;
      }
      const el = getPopupElement(popup);
      if(!el) return false;
      if(el.matches(':hover')) return true;
      try {
        const hovered = el.querySelector(':hover');
        if(hovered) return true;
      } catch(err){}
      try {
        const hoveredList = document.querySelectorAll(':hover');
        for(let i = hoveredList.length - 1; i >= 0; i--){
          const node = hoveredList[i];
          if(node && (node === el || el.contains(node))){
            return true;
          }
        }
      } catch(err){}
      return false;
    }

    function schedulePopupRemoval(popup, delay=180){
      const target = popup || hoverPopup;
      if(!target) return;
      setTimeout(()=>{
        if(hoverPopup !== target) return;
        if(popupIsHovered(target)){
          window.__overCard = true;
          return;
        }
        window.__overCard = false;
        runOverlayCleanup(target);
        try{ target.remove(); }catch(e){}
        if(hoverPopup === target){
          hoverPopup = null;
          updateSelectedMarkerRing();
        }
      }, delay);
    }

    const SMALL_MAP_CARD_PILL_DEFAULT_SRC = 'assets/icons-30/150x40-pill-70.webp';
    const SMALL_MAP_CARD_PILL_HOVER_SRC = 'assets/icons-30/150x40-pill-2f3b73.webp';
    const MULTI_POST_MARKER_ICON_ID = 'multi-post-icon';
    const MULTI_POST_MARKER_ICON_SRC = 'assets/icons-30/multi-post-icon-30.webp';
    const SMALL_MULTI_MAP_CARD_ICON_SRC = 'assets/icons-30/multi-post-icon-30.webp';

      function resetBigMapCardTransforms(){
        document.querySelectorAll('.big-map-card').forEach(card => {
          card.style.transform = 'none';
        });
      }
      resetBigMapCardTransforms();
      document.addEventListener('DOMContentLoaded', resetBigMapCardTransforms);

    function registerOverlayCleanup(overlayEl, fn){
      if(!overlayEl || typeof fn !== 'function') return;
      const list = Array.isArray(overlayEl.__cleanupFns)
        ? overlayEl.__cleanupFns
        : (overlayEl.__cleanupFns = []);
      list.push(fn);
    }

    function runOverlayCleanup(target){
      if(!target) return;
      const el = typeof target.getElement === 'function' ? target.getElement() : target;
      if(!el) return;
      const fns = Array.isArray(el.__cleanupFns) ? el.__cleanupFns.slice() : [];
      if(!fns.length) return;
      el.__cleanupFns = [];
      fns.forEach(fn => {
        try{ fn(); }catch(err){}
      });
    }

    function setSmallMapCardPillImage(cardEl, highlighted){
      if(!cardEl) return;
      const pillImg = cardEl.querySelector('.mapmarker-pill, .map-card-pill')
        || cardEl.querySelector('img[src*="150x40-pill" i]');
      if(!pillImg) return;
      if(!pillImg.dataset.defaultSrc){
        const currentSrc = pillImg.getAttribute('src') || '';
        pillImg.dataset.defaultSrc = currentSrc || SMALL_MAP_CARD_PILL_DEFAULT_SRC;
      }
      if(!pillImg.dataset.highlightSrc){
        pillImg.dataset.highlightSrc = SMALL_MAP_CARD_PILL_HOVER_SRC;
      }
      const targetSrc = highlighted
        ? (pillImg.dataset.highlightSrc || SMALL_MAP_CARD_PILL_HOVER_SRC)
        : (pillImg.dataset.defaultSrc || SMALL_MAP_CARD_PILL_DEFAULT_SRC);
      if((pillImg.getAttribute('src') || '') !== targetSrc){
        pillImg.setAttribute('src', targetSrc);
      }
      if(pillImg.getAttribute('srcset')){
        pillImg.removeAttribute('srcset');
      }
    }

    function enforceSmallMultiMapCardIcon(img, overlayEl){
      if(!img) return;
      const targetSrc = SMALL_MULTI_MAP_CARD_ICON_SRC;
      const apply = ()=>{
        const currentSrc = img.getAttribute('src') || '';
        if(currentSrc !== targetSrc){
          img.setAttribute('src', targetSrc);
        }
      };
      apply();
      const onLoad = ()=> apply();
      const onError = ()=> apply();
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      if(overlayEl){
        registerOverlayCleanup(overlayEl, ()=>{
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        });
      }
      if(typeof MutationObserver === 'function'){
        const observer = new MutationObserver(()=>{
          if(!img.isConnected){
            observer.disconnect();
            return;
          }
          apply();
        });
        try{
          observer.observe(img, { attributes: true, attributeFilter: ['src'] });
        }catch(err){
          try{ observer.disconnect(); }catch(e){}
          return;
        }
        if(overlayEl){
          registerOverlayCleanup(overlayEl, ()=>{
            try{ observer.disconnect(); }catch(e){}
          });
        }
      }
    }

    function escapeAttrValue(value){
      const raw = String(value);
      if(typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function'){
        try{ return window.CSS.escape(raw); }catch(err){ /* fall through */ }
      }
      return raw.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    }

    function getOverlayMultiIds(overlay){
      if(!overlay || !overlay.dataset) return [];
      const raw = overlay.dataset.multiIds || '';
      if(!raw) return [];
      return raw.split(',').map(id => id.trim()).filter(Boolean);
    }

    function findMarkerOverlaysById(id){
      if(id === undefined || id === null) return [];
      const strId = String(id);
      const matches = new Set();
      const escaped = escapeAttrValue(strId);
      if(typeof document !== 'undefined' && document.querySelectorAll){
        try{
          document.querySelectorAll(`.mapmarker-overlay[data-id="${escaped}"]`).forEach(el => matches.add(el));
        }catch(err){ /* ignore selector issues */ }
        document.querySelectorAll('.mapmarker-overlay[data-multi-ids]').forEach(el => {
          if(matches.has(el)) return;
          const multiIds = getOverlayMultiIds(el);
          if(multiIds.includes(strId)){
            matches.add(el);
          }
        });
      }
      return Array.from(matches);
    }

    function toggleSmallMapCardHoverHighlight(postId, shouldHighlight){
      if(postId === undefined || postId === null) return;
      const idStr = String(postId);
      const highlightClass = 'is-pill-highlight';
      const mapHighlightClass = 'is-map-highlight';
      let highlightChanged = false;
      if(shouldHighlight){
        if(!hoverHighlightedPostIds.has(idStr)){
          hoverHighlightedPostIds.add(idStr);
          highlightChanged = true;
        }
      } else {
        if(hoverHighlightedPostIds.delete(idStr)){
          highlightChanged = true;
        }
      }
      const overlays = findMarkerOverlaysById(postId);
      overlays.forEach(overlay => {
        overlay.querySelectorAll('.small-map-card').forEach(cardEl => {
          if(shouldHighlight){
            if(!Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevHighlight')){
              cardEl.dataset.hoverPrevHighlight = cardEl.classList.contains(highlightClass) ? '1' : '0';
            }
            if(!cardEl.classList.contains(highlightClass)){
              cardEl.classList.add(highlightClass);
            }
            setSmallMapCardPillImage(cardEl, true);
          } else if(Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevHighlight')){
            const prev = cardEl.dataset.hoverPrevHighlight === '1';
            delete cardEl.dataset.hoverPrevHighlight;
            if(!prev){
              cardEl.classList.remove(highlightClass);
              setSmallMapCardPillImage(cardEl, false);
            } else {
              setSmallMapCardPillImage(cardEl, true);
            }
          }
        });
        overlay.querySelectorAll('.big-map-card').forEach(cardEl => {
          if(shouldHighlight){
            if(!Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevMapHighlight')){
              cardEl.dataset.hoverPrevMapHighlight = cardEl.classList.contains(mapHighlightClass) ? '1' : '0';
            }
            if(!cardEl.classList.contains(mapHighlightClass)){
              cardEl.classList.add(mapHighlightClass);
            }
          } else if(Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevMapHighlight')){
            const prev = cardEl.dataset.hoverPrevMapHighlight === '1';
            delete cardEl.dataset.hoverPrevMapHighlight;
            if(!prev){
              cardEl.classList.remove(mapHighlightClass);
            }
          }
        });
      });
      if(highlightChanged || shouldHighlight){
        updateSelectedMarkerRing();
      }
    }

    function updateSelectedMarkerRing(){
      const highlightClass = 'is-map-highlight';
      const markerHighlightClass = 'is-pill-highlight';
      const isSurfaceHighlightTarget = (el)=> !!(el && el.classList && (el.classList.contains('post-card') || el.classList.contains('post-header')));
      const restoreHighlightBackground = (el)=>{
        if(!isSurfaceHighlightTarget(el) || !el.dataset) return;
        if(Object.prototype.hasOwnProperty.call(el.dataset, 'prevHighlightBackground')){
          const prev = el.dataset.prevHighlightBackground;
          delete el.dataset.prevHighlightBackground;
          if(prev){
            el.style.background = prev;
            return;
          }
        }
        if(Object.prototype.hasOwnProperty.call(el.dataset, 'surfaceBg')){
          el.style.background = el.dataset.surfaceBg;
        } else {
          el.style.removeProperty('background');
        }
      };
      const applyHighlightBackground = (el)=>{
        if(!isSurfaceHighlightTarget(el) || !el.dataset) return;
        if(!Object.prototype.hasOwnProperty.call(el.dataset, 'prevHighlightBackground')){
          el.dataset.prevHighlightBackground = el.style.background || '';
        }
        el.style.background = CARD_HIGHLIGHT;
      };
      const restoreAttr = (el)=>{
        if(!el || !el.dataset) return;
        if(Object.prototype.hasOwnProperty.call(el.dataset, 'prevAriaSelected')){
          const prev = el.dataset.prevAriaSelected;
          if(prev){
            el.setAttribute('aria-selected', prev);
          } else {
            el.removeAttribute('aria-selected');
          }
          delete el.dataset.prevAriaSelected;
        }
      };
      document.querySelectorAll(`.post-card.${highlightClass}, .open-post .post-header.${highlightClass}, .big-map-card.${highlightClass}`).forEach(el => {
        el.classList.remove(highlightClass);
        restoreAttr(el);
        restoreHighlightBackground(el);
      });
      document.querySelectorAll(`.small-map-card.${markerHighlightClass}`).forEach(el => {
        setSmallMapCardPillImage(el, false);
        el.classList.remove(markerHighlightClass);
      });

      const overlayEl = hoverPopup && typeof hoverPopup.getElement === 'function'
        ? hoverPopup.getElement()
        : null;
      const overlayId = overlayEl && overlayEl.dataset ? String(overlayEl.dataset.id || '') : '';
      const overlayMultiIds = overlayEl ? getOverlayMultiIds(overlayEl) : [];
      let fallbackId = '';
      if(!overlayId){
        if(activePostId !== undefined && activePostId !== null){
          fallbackId = String(activePostId);
        } else {
          const openEl = document.querySelector('.post-board .open-post[data-id]');
          fallbackId = openEl && openEl.dataset ? String(openEl.dataset.id || '') : '';
        }
      }
      const hoverHighlightList = Array.from(hoverHighlightedPostIds);
      const idsToHighlight = Array.from(new Set([
        overlayId,
        fallbackId,
        ...(overlayMultiIds || []),
        ...hoverHighlightList
      ].filter(Boolean)));
      if(!idsToHighlight.length){
        updateMapFeatureHighlights([]);
        return;
      }
      const applyHighlight = (el)=>{
        if(!el) return;
        if(el.dataset && !Object.prototype.hasOwnProperty.call(el.dataset, 'prevAriaSelected')){
          el.dataset.prevAriaSelected = el.hasAttribute('aria-selected') ? el.getAttribute('aria-selected') : '';
        }
        el.classList.add(highlightClass);
        el.setAttribute('aria-selected', 'true');
        applyHighlightBackground(el);
      };
      const overlayVenueKey = overlayEl && overlayEl.dataset ? String(overlayEl.dataset.venueKey || '').trim() : '';
      const globalVenueKey = typeof selectedVenueKey === 'string' && selectedVenueKey ? String(selectedVenueKey).trim() : '';
      const highlightTargets = [];
      const targetSeen = new Set();
      idsToHighlight.forEach(id => {
        const strId = String(id);
        const selectorId = escapeAttrValue(strId);
        const listCard = postsWideEl ? postsWideEl.querySelector(`.post-card[data-id="${selectorId}"]`) : null;
        applyHighlight(listCard);
        const openHeader = document.querySelector(`.open-post[data-id="${selectorId}"] .post-header`);
        applyHighlight(openHeader);
        const preferredVenue = (overlayId && strId === overlayId && overlayVenueKey)
          ? overlayVenueKey
          : globalVenueKey;
        const normalizedVenue = preferredVenue ? String(preferredVenue).trim() : '';
        const overlays = findMarkerOverlaysById(strId);
        overlays.forEach(overlay => {
          const overlayKey = overlay && overlay.dataset ? String(overlay.dataset.venueKey || '').trim() : '';
          if(normalizedVenue && overlayKey && overlayKey !== normalizedVenue){
            return;
          }
          overlay.querySelectorAll('.small-map-card').forEach(el => {
            setSmallMapCardPillImage(el, true);
            el.classList.add(markerHighlightClass);
          });
          overlay.querySelectorAll('.big-map-card').forEach(el => {
            el.classList.add(highlightClass);
          });
        });
        const dedupeKey = normalizedVenue ? `${strId}::${normalizedVenue}` : strId;
        if(!targetSeen.has(dedupeKey)){
          targetSeen.add(dedupeKey);
          highlightTargets.push({ id: strId, venueKey: normalizedVenue || null });
        }
      });
      updateMapFeatureHighlights(highlightTargets);
    }

    function hashString(str){
      let hash = 0;
      for(let i=0;i<str.length;i++){
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString(36);
    }

function countMarkersForVenue(postsAtVenue, venueKey, bounds){
  if(!Array.isArray(postsAtVenue) || !postsAtVenue.length){
    return 0;
  }
  const key = typeof venueKey === 'string' && venueKey ? venueKey : null;
  const normalizedBounds = bounds ? normalizeBounds(bounds) : null;
  const markerInBounds = (lng, lat)=>{
    const lon = Number(lng);
    const la = Number(lat);
    if(!Number.isFinite(lon) || !Number.isFinite(la)) return false;
    if(!normalizedBounds) return true;
    return pointWithinBounds(lon, la, normalizedBounds);
  };
  if(key){
    return postsAtVenue.reduce((total, post) => {
      if(!post) return total;
      let count = 0;
      if(Array.isArray(post.locations) && post.locations.length){
        count = post.locations.reduce((sum, loc) => {
          if(!loc) return sum;
          const lng = Number(loc.lng);
          const lat = Number(loc.lat);
          if(!Number.isFinite(lng) || !Number.isFinite(lat)) return sum;
          if(toVenueCoordKey(lng, lat) !== key) return sum;
          return markerInBounds(lng, lat) ? sum + 1 : sum;
        }, 0);
      }
      if(!count && Number.isFinite(post.lng) && Number.isFinite(post.lat) && toVenueCoordKey(post.lng, post.lat) === key && markerInBounds(post.lng, post.lat)){
        count = 1;
      }
      return total + (count || 0);
    }, 0);
  }
  return postsAtVenue.reduce((total, post) => {
    if(!post) return total;
    let count = 0;
    if(Array.isArray(post.locations) && post.locations.length){
      count += post.locations.reduce((sum, loc) => {
        if(!loc) return sum;
        const lng = Number(loc.lng);
        const lat = Number(loc.lat);
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return sum;
        return markerInBounds(lng, lat) ? sum + 1 : sum;
      }, 0);
    }
    if((!Array.isArray(post.locations) || !post.locations.length) && Number.isFinite(post.lng) && Number.isFinite(post.lat) && markerInBounds(post.lng, post.lat)){
      count += 1;
    }
    return total + count;
  }, 0);
}


function mulberry32(a){ return function(){var t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15, t|1); t^=t+Math.imul(t^t>>>7, t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
    const rnd = mulberry32(42);

    const cities = [
      {n:"Melbourne, Australia", c:[144.9631,-37.8136]},
      {n:"Sydney, Australia", c:[151.2093,-33.8688]},
      {n:"London, UK", c:[-0.1276,51.5072]},
      {n:"New York, USA", c:[-74.0060,40.7128]},
      {n:"Tokyo, Japan", c:[139.6917,35.6895]},
      {n:"Paris, France", c:[2.3522,48.8566]},
      {n:"Rio de Janeiro, Brazil", c:[-43.1729,-22.9068]},
      {n:"Cape Town, South Africa", c:[18.4241,-33.9249]},
      {n:"Reykjavík, Iceland", c:[-21.8174,64.1265]},
      {n:"Mumbai, India", c:[72.8777,19.0760]}
    ];

    let persistedFormbuilderSnapshotFetchPromise = null;
    if(typeof window !== 'undefined'){
      window.persistedFormbuilderSnapshotPromise = persistedFormbuilderSnapshotFetchPromise;
    }

    function getSavedFormbuilderSnapshot(){
      if(window.formbuilderStateManager && typeof window.formbuilderStateManager.getSaved === 'function'){
        try{
          const snapshot = window.formbuilderStateManager.getSaved();
          if(snapshot && typeof snapshot === 'object'){
            return snapshot;
          }
        }catch(err){
          console.warn('Failed to read saved formbuilder snapshot', err);
        }
      }
      return null;
    }

    async function fetchSavedFormbuilderSnapshot(){
      if(persistedFormbuilderSnapshotFetchPromise){
        return persistedFormbuilderSnapshotFetchPromise;
      }

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => {
        try{ controller.abort(); }catch(err){}
      }, 15000) : 0;

      const fetchPromise = (async () => {
        try{
          const response = await fetch('/gateway.php?action=get-form', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller ? controller.signal : undefined
          });
          const text = await response.text();
          let data;
          try{
            data = JSON.parse(text);
          }catch(parseErr){
            throw new Error('The server returned an unexpected response.');
          }
          if(!response.ok || !data || data.success !== true || !data.snapshot){
            const message = data && typeof data.message === 'string' && data.message.trim()
              ? data.message.trim()
              : 'Unable to load form definitions.';
            throw new Error(message);
          }
          return data.snapshot;
        } finally {
          if(timeoutId){
            clearTimeout(timeoutId);
          }
        }
      })();

      persistedFormbuilderSnapshotFetchPromise = fetchPromise.finally(() => {
        persistedFormbuilderSnapshotFetchPromise = null;
        if(typeof window !== 'undefined'){
          window.persistedFormbuilderSnapshotPromise = null;
        }
      });

      if(typeof window !== 'undefined'){
        window.persistedFormbuilderSnapshotPromise = persistedFormbuilderSnapshotFetchPromise;
      }

      return persistedFormbuilderSnapshotFetchPromise;
    }

    if(typeof window !== 'undefined'){
      window.fetchSavedFormbuilderSnapshot = fetchSavedFormbuilderSnapshot;
    }

    function cloneFieldValue(value){
      if(Array.isArray(value)){
        return value.map(cloneFieldValue);
      }
      if(value && typeof value === 'object'){
        try{
          return JSON.parse(JSON.stringify(value));
        }catch(err){
          return { ...value };
        }
      }
      return value;
    }

    const DEFAULT_FORMBUILDER_SNAPSHOT = {
      categories: [],
      versionPriceCurrencies: ['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD'],
      categoryIconPaths: {},
      subcategoryIconPaths: {},
      iconLibrary: []
    };

    const ICON_LIBRARY_ALLOWED_EXTENSION_RE = /\.(?:png|jpe?g|gif|svg|webp)$/i;

    function normalizeCategoriesSnapshot(sourceCategories){
      const list = Array.isArray(sourceCategories) ? sourceCategories : [];
      const parseId = value => {
        if(typeof value === 'number' && Number.isInteger(value) && value >= 0){
          return value;
        }
        if(typeof value === 'string' && value.trim() && /^\d+$/.test(value.trim())){
          return parseInt(value.trim(), 10);
        }
        return null;
      };
      const normalized = list.map(item => {
        if(!item || typeof item !== 'object') return null;
        const name = typeof item.name === 'string' ? item.name : '';
        if(!name) return null;
        const subIdsSource = (item.subIds && typeof item.subIds === 'object' && !Array.isArray(item.subIds)) ? item.subIds : {};
        const rawSubs = Array.isArray(item.subs) ? item.subs : [];
        const subs = [];
        const subIdMap = {};
        rawSubs.forEach(entry => {
          if(typeof entry === 'string'){
            const subName = entry.trim();
            if(!subName) return;
            subs.push(subName);
            if(Object.prototype.hasOwnProperty.call(subIdsSource, entry)){
              const parsed = parseId(subIdsSource[entry]);
              if(parsed !== null){
                subIdMap[subName] = parsed;
              }
            }
            return;
          }
          if(entry && typeof entry === 'object'){
            const subName = typeof entry.name === 'string' ? entry.name.trim() : '';
            if(!subName) return;
            subs.push(subName);
            const parsed = parseId(entry.id);
            if(parsed !== null){
              subIdMap[subName] = parsed;
            } else if(Object.prototype.hasOwnProperty.call(subIdsSource, subName)){
              const fromMap = parseId(subIdsSource[subName]);
              if(fromMap !== null){
                subIdMap[subName] = fromMap;
              }
            }
          }
        });
        const rawSubFields = (item.subFields && typeof item.subFields === 'object' && !Array.isArray(item.subFields)) ? item.subFields : {};
        const subFields = {};
        subs.forEach(sub => {
          const fields = Array.isArray(rawSubFields[sub]) ? rawSubFields[sub].map(cloneFieldValue) : [];
          subFields[sub] = fields;
        });
        const sortOrder = normalizeCategorySortOrderValue(item.sort_order ?? item.sortOrder);
        return { id: parseId(item.id), name, subs, subFields, subIds: subIdMap, sort_order: sortOrder };
      }).filter(Boolean);
      const base = normalized.length ? normalized : DEFAULT_FORMBUILDER_SNAPSHOT.categories.map(cat => ({
        id: null,
        name: cat.name,
        subs: cat.subs.slice(),
        subIds: cat.subs.reduce((acc, sub) => {
          acc[sub] = null;
          return acc;
        }, {}),
        subFields: cat.subs.reduce((acc, sub) => {
          acc[sub] = [];
          return acc;
        }, {}),
        sort_order: normalizeCategorySortOrderValue(cat && (cat.sort_order ?? cat.sortOrder))
      }));
      base.forEach(cat => {
        if(!cat.subFields || typeof cat.subFields !== 'object' || Array.isArray(cat.subFields)){
          cat.subFields = {};
        }
        if(!cat.subIds || typeof cat.subIds !== 'object' || Array.isArray(cat.subIds)){
          cat.subIds = {};
        }
        cat.subs.forEach(sub => {
          if(!Array.isArray(cat.subFields[sub])){
            cat.subFields[sub] = [];
          }
          if(!Object.prototype.hasOwnProperty.call(cat.subIds, sub)){
            cat.subIds[sub] = null;
          }
        });
        cat.sort_order = normalizeCategorySortOrderValue(cat.sort_order ?? cat.sortOrder);
      });
      return base;
    }

    function normalizeFormbuilderSnapshot(snapshot){
      const normalizedCategories = normalizeCategoriesSnapshot(snapshot && snapshot.categories);
      const rawCurrencies = (snapshot && Array.isArray(snapshot.versionPriceCurrencies)) ? snapshot.versionPriceCurrencies : [];
      const normalizedCurrencies = Array.from(new Set(rawCurrencies
        .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
        .filter(Boolean)));
      if(!normalizedCurrencies.length){
        DEFAULT_FORMBUILDER_SNAPSHOT.versionPriceCurrencies.forEach(code => normalizedCurrencies.push(code));
      }
      const normalizedCategoryIconPaths = normalizeIconPathMap(snapshot && snapshot.categoryIconPaths);
      const normalizedSubcategoryIconPaths = normalizeIconPathMap(snapshot && snapshot.subcategoryIconPaths);
      const normalizedIconPathsFromMaps = [
        ...Object.values(normalizedCategoryIconPaths || {}),
        ...Object.values(normalizedSubcategoryIconPaths || {})
      ].map(path => (typeof path === 'string' ? normalizeIconAssetPath(path) : ''))
        .filter(path => path && ICON_LIBRARY_ALLOWED_EXTENSION_RE.test(path));
      const iconLibrarySource = Array.isArray(snapshot && snapshot.iconLibrary)
        ? snapshot.iconLibrary
        : [];
      const mergedIconSet = new Set();
      const mergedIconLibrary = [];
      const addIconToLibrary = (icon)=>{
        if(typeof icon !== 'string'){
          return;
        }
        const normalized = normalizeIconAssetPath(icon);
        if(!normalized || !ICON_LIBRARY_ALLOWED_EXTENSION_RE.test(normalized)){
          return;
        }
        const key = normalized.toLowerCase();
        if(mergedIconSet.has(key)){
          return;
        }
        mergedIconSet.add(key);
        mergedIconLibrary.push(normalized);
      };
      iconLibrarySource.forEach(addIconToLibrary);
      normalizedIconPathsFromMaps.forEach(addIconToLibrary);
      const iconLibrary = mergedIconLibrary;
      return {
        categories: normalizedCategories,
        versionPriceCurrencies: normalizedCurrencies,
        categoryIconPaths: normalizedCategoryIconPaths,
        subcategoryIconPaths: normalizedSubcategoryIconPaths,
        iconLibrary
      };
    }

    window.getSavedFormbuilderSnapshot = getSavedFormbuilderSnapshot;
    window.normalizeFormbuilderSnapshot = normalizeFormbuilderSnapshot;

    function getPersistedFormbuilderSnapshotFromGlobals(){
      if(typeof window === 'undefined'){
        return null;
      }
      const candidates = [
        window.__persistedFormbuilderSnapshot,
        window.__PERSISTED_FORMBUILDER_SNAPSHOT__,
        window.__FORMBUILDER_SNAPSHOT__,
        window.persistedFormbuilderSnapshot,
        window.formbuilderSnapshot,
        window.formBuilderSnapshot,
        window.initialFormbuilderSnapshot,
        window.__initialFormbuilderSnapshot
      ];
      for(const candidate of candidates){
        if(candidate && typeof candidate === 'object'){
          return candidate;
        }
      }
      return null;
    }

    const persistedFormbuilderSnapshotPromise = (()=>{
      if(typeof window !== 'undefined' && window.__persistedFormbuilderSnapshotPromise){
        return window.__persistedFormbuilderSnapshotPromise;
      }
      const promise = (async ()=>{
        const inlineSnapshot = getPersistedFormbuilderSnapshotFromGlobals();
        if(inlineSnapshot){
          return inlineSnapshot;
        }
        if(typeof fetchSavedFormbuilderSnapshot === 'function'){
          return await fetchSavedFormbuilderSnapshot();
        }
        return null;
      })();
      if(typeof window !== 'undefined'){
        window.__persistedFormbuilderSnapshotPromise = promise;
      }
      return promise;
    })();

    const ICON_LIBRARY = Array.isArray(window.iconLibrary)
      ? window.iconLibrary
      : (window.iconLibrary = []);

    const initialFormbuilderSnapshot = normalizeFormbuilderSnapshot(
      getPersistedFormbuilderSnapshotFromGlobals() || getSavedFormbuilderSnapshot()
    );
    const snapshotIconLibrary = Array.isArray(initialFormbuilderSnapshot.iconLibrary)
      ? initialFormbuilderSnapshot.iconLibrary
      : [];
    const existingWindowIcons = Array.isArray(window.iconLibrary)
      ? window.iconLibrary.slice()
      : [];
    const mapIconValues = [
      ...Object.values(initialFormbuilderSnapshot.categoryIconPaths || {}),
      ...Object.values(initialFormbuilderSnapshot.subcategoryIconPaths || {})
    ].map(value => (typeof value === 'string' ? normalizeIconAssetPath(value) : ''))
      .filter(value => value && ICON_LIBRARY_ALLOWED_EXTENSION_RE.test(value));
    const sanitizedSnapshotIcons = normalizeIconLibraryEntries(snapshotIconLibrary);
    const sanitizedWindowIcons = normalizeIconLibraryEntries(existingWindowIcons);
    const sanitizedMapIcons = normalizeIconLibraryEntries(mapIconValues);
    const mergedIconSet = new Set();
    const mergedIconLibrary = [];
    const mergeIcons = icons => {
      if(!Array.isArray(icons)){
        return;
      }
      icons.forEach(icon => {
        if(typeof icon !== 'string' || !icon){
          return;
        }
        const key = icon.toLowerCase();
        if(mergedIconSet.has(key)){
          return;
        }
        mergedIconSet.add(key);
        mergedIconLibrary.push(icon);
      });
    };
    mergeIcons(sanitizedSnapshotIcons);
    mergeIcons(sanitizedMapIcons);
    mergeIcons(sanitizedWindowIcons);
    ICON_LIBRARY.length = 0;
    if(mergedIconLibrary.length){
      ICON_LIBRARY.push(...mergedIconLibrary);
    }
    window.iconLibrary = ICON_LIBRARY;
    initialFormbuilderSnapshot.iconLibrary = ICON_LIBRARY.slice();
    const categories = window.categories = initialFormbuilderSnapshot.categories;
    const VERSION_PRICE_CURRENCIES = window.VERSION_PRICE_CURRENCIES = initialFormbuilderSnapshot.versionPriceCurrencies.slice();
    const categoryIcons = window.categoryIcons = window.categoryIcons || {};
    const subcategoryIcons = window.subcategoryIcons = window.subcategoryIcons || {};
    const categoryIconPaths = window.categoryIconPaths = window.categoryIconPaths || {};
    const subcategoryIconPaths = window.subcategoryIconPaths = window.subcategoryIconPaths || {};
    assignMapLike(categoryIconPaths, normalizeIconPathMap(initialFormbuilderSnapshot.categoryIconPaths));
    assignMapLike(subcategoryIconPaths, normalizeIconPathMap(initialFormbuilderSnapshot.subcategoryIconPaths));
    const FORM_FIELD_TYPES = window.FORM_FIELD_TYPES = [
      { value: 'title', label: 'Title' },
      { value: 'description', label: 'Description' },
      { value: 'text-box', label: 'Text Box' },
      { value: 'text-area', label: 'Text Area' },
      { value: 'dropdown', label: 'Dropdown' },
      { value: 'radio-toggle', label: 'Radio Toggle' },
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'website-url', label: 'Website (URL)' },
      { value: 'tickets-url', label: 'Tickets (URL)' },
      { value: 'images', label: 'Images' },
      { value: 'coupon', label: 'Coupon' },
      { value: 'version-price', label: 'Version/Price' },
      { value: 'checkout', label: 'Checkout' },
      { value: 'venue-session-version-tier-price', label: 'Venues, Sessions and Pricing' }
    ];
    const getFormFieldTypeLabel = (value)=>{
      const match = FORM_FIELD_TYPES.find(opt => opt.value === value);
      return match ? match.label : '';
    };
    const VENUE_TIME_AUTOFILL_STATE = new WeakMap();
    const VENUE_CURRENCY_STATE = new WeakMap();
    let LAST_SELECTED_VENUE_CURRENCY = '';

    function venueSessionCreateTier(){
      return { name: '', currency: '', price: '' };
    }
    function venueSessionCreateVersion(){
      return { name: '', tiers: [venueSessionCreateTier()] };
    }
    function venueSessionCreateTime(){
      return {
        time: '',
        versions: [venueSessionCreateVersion()],
        samePricingAsAbove: true,
        samePricingSourceIndex: 0,
        tierAutofillLocked: false
      };
    }
    function venueSessionCreateSession(){
      return { date: '', times: [venueSessionCreateTime()] };
    }
    function venueSessionCreateVenue(){
      return { name: '', address: '', location: null, feature: null, sessions: [venueSessionCreateSession()] };
    }
    function normalizeVenueSessionTier(tier){
      let obj = tier;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateTier();
      }
      if(typeof obj.name !== 'string') obj.name = '';
      if(typeof obj.currency !== 'string') obj.currency = '';
      if(typeof obj.price !== 'string') obj.price = '';
      return obj;
    }
    function normalizeVenueSessionVersion(version){
      let obj = version;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateVersion();
      }
      if(typeof obj.name !== 'string') obj.name = '';
      if(!Array.isArray(obj.tiers)){
        obj.tiers = [venueSessionCreateTier()];
      } else {
        for(let i = 0; i < obj.tiers.length; i++){
          obj.tiers[i] = normalizeVenueSessionTier(obj.tiers[i]);
        }
        if(obj.tiers.length === 0){
          obj.tiers.push(venueSessionCreateTier());
        }
      }
      return obj;
    }
    function normalizeVenueSessionTime(time){
      let obj = time;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateTime();
      }
      if(typeof obj.time !== 'string') obj.time = '';
      if(!Array.isArray(obj.versions)){
        obj.versions = [venueSessionCreateVersion()];
      } else {
        for(let i = 0; i < obj.versions.length; i++){
          obj.versions[i] = normalizeVenueSessionVersion(obj.versions[i]);
        }
        if(obj.versions.length === 0){
          obj.versions.push(venueSessionCreateVersion());
        }
      }
      obj.samePricingAsAbove = obj.samePricingAsAbove !== false;
      obj.tierAutofillLocked = obj && obj.tierAutofillLocked === true;
      const sourceIndex = Number(obj.samePricingSourceIndex);
      obj.samePricingSourceIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : 0;
      return obj;
    }
    function normalizeVenueSessionSession(session){
      let obj = session;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateSession();
      }
      if(typeof obj.date !== 'string') obj.date = '';
      if(!Array.isArray(obj.times)){
        obj.times = [venueSessionCreateTime()];
      } else {
        for(let i = 0; i < obj.times.length; i++){
          obj.times[i] = normalizeVenueSessionTime(obj.times[i]);
        }
        if(obj.times.length === 0){
          obj.times.push(venueSessionCreateTime());
        }
      }
      return obj;
    }
    function normalizeVenueSessionVenue(opt){
      let obj = opt;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateVenue();
      }
      if(typeof obj.name !== 'string') obj.name = '';
      if(typeof obj.address !== 'string') obj.address = '';
      if(obj.location && typeof obj.location === 'object'){
        const lng = Number(obj.location.lng);
        const lat = Number(obj.location.lat);
        obj.location = (Number.isFinite(lng) && Number.isFinite(lat)) ? { lng, lat } : null;
      } else {
        obj.location = null;
      }
      if(obj.feature && typeof obj.feature !== 'object'){
        obj.feature = null;
      }
      if(!Array.isArray(obj.sessions)){
        obj.sessions = [venueSessionCreateSession()];
      } else {
        for(let i = 0; i < obj.sessions.length; i++){
          obj.sessions[i] = normalizeVenueSessionSession(obj.sessions[i]);
        }
        if(obj.sessions.length === 0){
          obj.sessions.push(venueSessionCreateSession());
        }
      }
      return obj;
    }
    function normalizeVenueSessionOptions(options){
      let list = options;
      if(!Array.isArray(list)){
        list = [];
      }
      for(let i = 0; i < list.length; i++){
        list[i] = normalizeVenueSessionVenue(list[i]);
      }
      if(list.length === 0){
        list.push(venueSessionCreateVenue());
      }
      return list;
    }
    function cloneVenueSessionTier(tier){
      const base = venueSessionCreateTier();
      if(tier && typeof tier === 'object'){
        if(typeof tier.name === 'string') base.name = tier.name;
        if(typeof tier.currency === 'string') base.currency = tier.currency;
        if(typeof tier.price === 'string') base.price = tier.price;
      }
      return base;
    }
    function cloneVenueSessionVersion(version){
      const base = venueSessionCreateVersion();
      base.name = (version && typeof version.name === 'string') ? version.name : '';
      const tiers = version && Array.isArray(version.tiers) ? version.tiers : [];
      base.tiers = tiers.length ? tiers.map(cloneVenueSessionTier) : [venueSessionCreateTier()];
      return base;
    }
    function cloneVenueSessionTime(time){
      const base = venueSessionCreateTime();
      base.time = (time && typeof time.time === 'string') ? time.time : '';
      const versions = time && Array.isArray(time.versions) ? time.versions : [];
      base.versions = versions.length ? versions.map(cloneVenueSessionVersion) : [venueSessionCreateVersion()];
      base.samePricingAsAbove = !!(time && time.samePricingAsAbove);
      const sourceIndex = Number(time && time.samePricingSourceIndex);
      base.samePricingSourceIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : 0;
      base.tierAutofillLocked = !!(time && time.tierAutofillLocked);
      return base;
    }
    function cloneVenueSessionSession(session){
      const base = venueSessionCreateSession();
      base.date = (session && typeof session.date === 'string') ? session.date : '';
      const times = session && Array.isArray(session.times) ? session.times : [];
      base.times = times.length ? times.map(cloneVenueSessionTime) : [venueSessionCreateTime()];
      return base;
    }
    function cloneVenueSessionFeature(feature){
      if(!feature || typeof feature !== 'object') return null;
      try{
        return JSON.parse(JSON.stringify(feature));
      }catch(err){
        return { ...feature };
      }
    }
    function cloneVenueSessionVenue(venue){
      const base = venueSessionCreateVenue();
      base.name = (venue && typeof venue.name === 'string') ? venue.name : '';
      base.address = (venue && typeof venue.address === 'string') ? venue.address : '';
      if(venue && venue.location && typeof venue.location === 'object'){
        const lng = Number(venue.location.lng);
        const lat = Number(venue.location.lat);
        if(Number.isFinite(lng) && Number.isFinite(lat)){
          base.location = { lng, lat };
        }
      }
      if(venue && venue.feature && typeof venue.feature === 'object'){
        base.feature = cloneVenueSessionFeature(venue.feature);
      }
      const sessions = venue && Array.isArray(venue.sessions) ? venue.sessions : [];
      base.sessions = sessions.length ? sessions.map(cloneVenueSessionSession) : [venueSessionCreateSession()];
      return base;
    }
    window.normalizeVenueSessionOptions = normalizeVenueSessionOptions;
    window.cloneVenueSessionVenue = cloneVenueSessionVenue;
    function getVenueAutofillState(field, venue){
      let fieldState = VENUE_TIME_AUTOFILL_STATE.get(field);
      if(!fieldState){
        fieldState = new WeakMap();
        VENUE_TIME_AUTOFILL_STATE.set(field, fieldState);
      }
      let state = fieldState.get(venue);
      if(!state){
        state = { slots: [] };
        fieldState.set(venue, state);
      }
      return state;
    }
    function resetVenueAutofillState(field){
      VENUE_TIME_AUTOFILL_STATE.delete(field);
    }

    const DEFAULT_SUBCATEGORY_FIELDS = Array.isArray(window.DEFAULT_SUBCATEGORY_FIELDS)
      ? window.DEFAULT_SUBCATEGORY_FIELDS
      : [
          { name: 'Title', type: 'title', placeholder: 'ie. Elvis Presley - Live on Stage', required: true },
          { name: 'Description', type: 'description', placeholder: 'ie. Come and enjoy the music!', required: true },
          { name: 'Images', type: 'images', placeholder: '', required: true }
        ];
    window.DEFAULT_SUBCATEGORY_FIELDS = DEFAULT_SUBCATEGORY_FIELDS;
    const OPEN_ICON_PICKERS = window.__openIconPickers || new Set();
    window.__openIconPickers = OPEN_ICON_PICKERS;

    function toIconIdKey(id){
      return Number.isInteger(id) ? `id:${id}` : '';
    }
    function toIconNameKey(name){
      return typeof name === 'string' && name ? `name:${name.toLowerCase()}` : '';
    }

    function normalizeIconLibraryEntries(entries){
      const seen = new Set();
      const normalized = [];
      if(!Array.isArray(entries)){
        return normalized;
      }
      entries.forEach(item => {
        if(typeof item !== 'string'){
          return;
        }
        const normalizedPath = normalizeIconAssetPath(item);
        if(!normalizedPath){
          return;
        }
        if(!ICON_LIBRARY_ALLOWED_EXTENSION_RE.test(normalizedPath)){
          return;
        }
        const key = normalizedPath.toLowerCase();
        if(seen.has(key)){
          return;
        }
        seen.add(key);
        normalized.push(normalizedPath);
      });
      return normalized;
    }
    function normalizeIconAssetPath(path){
      const normalized = baseNormalizeIconPath(path);
      if(!normalized){
        return '';
      }
      if(/^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith('data:')){
        return normalized;
      }
      const dividerIndex = normalized.search(/[?#]/);
      const basePath = dividerIndex >= 0 ? normalized.slice(0, dividerIndex) : normalized;
      const suffix = dividerIndex >= 0 ? normalized.slice(dividerIndex) : '';
      let next = basePath.replace(/(^|\/)icons-20\//gi, '$1icons-30/');
      next = next.replace(/^icons-30\//i, 'assets/icons-30/');
      next = next.replace(/^assets\/icons-20\//i, 'assets/icons-30/');
      const sourcePath = next;
      next = sourcePath.replace(/-20(\.[^./]+)$/i, (match, ext, offset) => {
        const prevChar = sourcePath.charAt(Math.max(0, offset - 1));
        return /\d/.test(prevChar) ? match : `-30${ext}`;
      });
      return next + suffix;
    }

    const existingNormalizeIconPath = (typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function')
      ? window.normalizeIconPath
      : null;
    if(typeof window !== 'undefined'){
      window.normalizeIconPath = (path)=>{
        const initial = existingNormalizeIconPath ? existingNormalizeIconPath(path) : path;
        return normalizeIconAssetPath(initial);
      };
    }

    function normalizeIconPathMap(source){
      const normalized = {};
      if(!source || typeof source !== 'object'){
        return normalized;
      }
      Object.keys(source).forEach(key => {
        const rawValue = source[key];
        const value = typeof rawValue === 'string' ? normalizeIconAssetPath(rawValue) : '';
        if(typeof key !== 'string'){
          return;
        }
        const trimmed = key.trim();
        if(!trimmed){
          return;
        }
        if(/^id:\d+$/i.test(trimmed)){
          normalized[trimmed.toLowerCase()] = value;
          return;
        }
        if(/^[0-9]+$/.test(trimmed)){
          normalized[`id:${trimmed}`] = value;
          return;
        }
        if(/^name:/i.test(trimmed)){
          const rest = trimmed.slice(5).toLowerCase();
          if(rest){
            normalized[`name:${rest}`] = value;
          }
          return;
        }
        normalized[`name:${trimmed.toLowerCase()}`] = value;
      });
      return normalized;
    }
    function lookupIconPath(map, id, name){
      const idKey = toIconIdKey(id);
      if(idKey && Object.prototype.hasOwnProperty.call(map, idKey)){
        return { path: map[idKey], found: true };
      }
      const nameKey = toIconNameKey(name);
      if(nameKey && Object.prototype.hasOwnProperty.call(map, nameKey)){
        return { path: map[nameKey], found: true };
      }
      return { path: '', found: false };
    }
    function writeIconPath(map, id, name, path){
      const idKey = toIconIdKey(id);
      if(idKey){
        map[idKey] = path;
      }
      const nameKey = toIconNameKey(name);
      if(nameKey){
        map[nameKey] = path;
      }
    }
    function renameIconNameKey(map, oldName, newName){
      const oldKey = toIconNameKey(oldName);
      const newKey = toIconNameKey(newName);
      if(!oldKey || !newKey || oldKey === newKey){
        if(oldKey && !newKey){
          delete map[oldKey];
        }
        return;
      }
      if(Object.prototype.hasOwnProperty.call(map, oldKey) && !Object.prototype.hasOwnProperty.call(map, newKey)){
        map[newKey] = map[oldKey];
      }
      delete map[oldKey];
    }
    function deleteIconKeys(map, id, name){
      const idKey = toIconIdKey(id);
      if(idKey){
        delete map[idKey];
      }
      const nameKey = toIconNameKey(name);
      if(nameKey){
        delete map[nameKey];
      }
    }
    function closeAllIconPickers(){
      Array.from(OPEN_ICON_PICKERS).forEach(close => {
        try{ close(); }catch(err){}
      });
    }
    function baseNormalizeIconPath(path){
      if(typeof path !== 'string') return '';
      const trimmed = path.trim();
      if(!trimmed) return '';
      return trimmed.replace(/^\/+/, '');
    }
    function applyNormalizeIconPath(path){
      if(typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function'){
        try{
          const overridden = window.normalizeIconPath(path);
          if(typeof overridden !== 'undefined'){
            return baseNormalizeIconPath(overridden);
          }
        }catch(err){}
      }
      return baseNormalizeIconPath(path);
    }
    function getCategoryIconPath(category){
      if(!category) return '';
      const lookup = lookupIconPath(categoryIconPaths, category.id, category.name);
      if(lookup.found){
        return lookup.path || '';
      }
      return '';
    }
    function getSubcategoryIconPath(category, subName){
      const id = category && category.subIds && Object.prototype.hasOwnProperty.call(category.subIds, subName)
        ? category.subIds[subName]
        : null;
      const lookup = lookupIconPath(subcategoryIconPaths, id, subName);
      if(lookup.found){
        return lookup.path || '';
      }
      return '';
    }
    const subcategoryMarkers = window.subcategoryMarkers = window.subcategoryMarkers || {};
    if(!subcategoryMarkers[MULTI_POST_MARKER_ICON_ID]){
      subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] = MULTI_POST_MARKER_ICON_SRC;
    }
    const subcategoryMarkerIds = window.subcategoryMarkerIds = window.subcategoryMarkerIds || {};
    const categoryShapes = window.categoryShapes = window.categoryShapes || {};
    categories.forEach(cat => {
      if(!cat || typeof cat !== 'object') return;
      if(!cat.subFields || typeof cat.subFields !== 'object' || Array.isArray(cat.subFields)){
        cat.subFields = {};
      }
      (cat.subs || []).forEach(subName => {
        if(!Array.isArray(cat.subFields[subName])){
          cat.subFields[subName] = [];
        }
      });
    });

    function extractIconSrc(html){
      if(typeof html !== 'string'){ return ''; }
      const trimmed = html.trim();
      if(!trimmed){ return ''; }
      if(typeof document === 'undefined'){ return ''; }
      if(!extractIconSrc.__parser){
        extractIconSrc.__parser = document.createElement('div');
      }
      const parser = extractIconSrc.__parser;
      parser.innerHTML = trimmed;
      const img = parser.querySelector('img');
      const src = img ? (img.getAttribute('src') || '').trim() : '';
      parser.innerHTML = '';
      return src;
    }

    // --- Icon loader: ensures Mapbox images are available and quiets missing-image logs ---
    function attachIconLoader(mapInstance){
      if(!mapInstance) return () => Promise.resolve(false);
      const KNOWN = [
        'freebies','live-sport','volunteers','goods-and-services','clubs','artwork',
        'live-gigs','for-sale','education-centres','tutors'
      ];
      const pending = new Map();

      const urlsFor = (name) => {
        const urls = [];
        const seen = new Set();
        const pushUrl = (url) => {
          if(!url || seen.has(url)){
            return;
          }
          seen.add(url);
          urls.push(url);
        };
        const markers = window.subcategoryMarkers || {};
        const manual = markers[name] || null;
        const shouldLookupLocal = Boolean(manual);
        if(manual){
          pushUrl(manual);
        }
        return { urls, shouldLookupLocal };
      };

      function loadImageCompat(url){
        return new Promise((resolve, reject) => {
          if(typeof mapInstance.loadImage === 'function'){
            mapInstance.loadImage(url, (err, img) => err ? reject(err) : resolve(img));
          } else {
            fetch(url)
              .then(r => r.ok ? r.blob() : Promise.reject(url))
              .then(blob => createImageBitmap(blob))
              .then(resolve)
              .catch(reject);
          }
        });
      }

      function pickPixelRatio(url, img){
        if(typeof url === 'string' && /@2x\.[^./]+$/i.test(url)){
          return 2;
        }
        return 1;
      }

      function placeholder(name){
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(24, 24, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((name && name[0] ? name[0] : '?').toUpperCase(), 24, 24);
        return canvas;
      }

      async function addIcon(name){
        if(!name) return false;
        if(mapInstance.hasImage?.(name)) return true;
        if(pending.has(name)) return pending.get(name);
        const task = (async () => {
          const { urls, shouldLookupLocal } = urlsFor(name);
          if(!urls.length && !shouldLookupLocal){
            try{ mapInstance.addImage(name, placeholder(name)); }catch(err){}
            return false;
          }
          for(const url of urls){
            try{
              const img = await loadImageCompat(url);
              if(mapInstance.hasImage?.(name)) return true;
              const pixelRatio = pickPixelRatio(url, img);
              mapInstance.addImage(name, img, { sdf:false, pixelRatio });
              return true;
            }catch(err){}
          }
          try{ mapInstance.addImage(name, placeholder(name)); }catch(err){}
          return false;
        })().finally(() => pending.delete(name));
        pending.set(name, task);
        return task;
      }

      mapInstance.on('style.load', async () => {
        try{ ensureMarkerLabelBackground(mapInstance); }catch(err){}
        try{ reapplyMarkerLabelComposites(mapInstance); }catch(err){}
        const markers = window.subcategoryMarkers || {};
        const preloadList = Array.from(new Set([...KNOWN, ...Object.keys(markers)]));
        if(!preloadList.length) return;
        const BATCH_SIZE = 4;
        const BATCH_DELAY = 60;
        for(let i = 0; i < preloadList.length; i += BATCH_SIZE){
          const slice = preloadList.slice(i, i + BATCH_SIZE);
          const tasks = slice.map(iconName => (
            addIcon(iconName).catch(() => false)
          ));
          try{
            await Promise.allSettled(tasks);
          }catch(err){}
          if(BATCH_DELAY && i + BATCH_SIZE < preloadList.length){
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }
      });

      return addIcon;
    }

    const venueKey = (lng, lat) => toVenueCoordKey(lng, lat);

    function setSelectedVenueHighlight(lng, lat){
      if(Number.isFinite(lng) && Number.isFinite(lat)){
        const key = venueKey(lng, lat);
        if(selectedVenueKey !== key){
          selectedVenueKey = key;
          updateSelectedMarkerRing();
        }
      } else if(selectedVenueKey !== null){
        selectedVenueKey = null;
        updateSelectedMarkerRing();
      }
    }

    function ensureSvgDimensions(svg){
      try{
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const el = doc.documentElement;
        let w = parseFloat(el.getAttribute('width'));
        let h = parseFloat(el.getAttribute('height'));
        const viewBox = el.getAttribute('viewBox');
        if((!w || !h) && viewBox){
          const parts = viewBox.split(/[ ,]/).map(Number);
          if(parts.length === 4){
            w = w || parts[2];
            h = h || parts[3];
          }
        }
        if(!w) w = 40;
        if(!h) h = 40;
        el.setAttribute('width', w);
        el.setAttribute('height', h);
        return {svg: new XMLSerializer().serializeToString(el), width: w, height: h};
      }catch(e){
        return {svg, width:40, height:40};
      }
    }
// 0585: unique title generator (with location; no category prefix)
const __ADJ = ["Radiant","Indigo","Velvet","Silver","Crimson","Neon","Amber","Sapphire","Emerald","Electric","Roaring","Midnight","Sunlit","Ethereal","Urban","Astral","Analog","Digital","Windswept","Golden","Hidden","Avant","Cosmic","Garden","Quiet","Vivid","Obsidian","Scarlet","Cerulean","Lunar","Solar","Autumn","Verdant","Azure"];
const __NOUN = ["Symphony","Market","Carnival","Showcase","Assembly","Parade","Salon","Summit","Expo","Soirée","Revue","Collective","Fair","Gathering","Series","Retrospective","Circuit","Sessions","Weekender","Festival","Bazaar","Program","Tableau","Odyssey","Forum","Mosaic","Canvas","Relay","Drift","Workshop","Lab"];
const __HOOK = ["at Dusk","of Ideas","in Motion","for Everyone","Remix","Live","Reborn","MKII","Redux","Infinite","Prime","Pulse","Wave","Future","Now","Unlocked","Extended","Panorama","Unbound","Edition","Run","Sequence"];
function __rng(seed){ let s = seed|0; return ()=> (s = (s*1664525 + 1013904223)>>>0); }
const __USED_BIGRAMS = new Set();
function uniqueTitle(seed, cityName, idx){
  // Deterministic RNG with attempt salt for conflict resolution
  const base = (seed||0) ^ ((idx||0)*99991);

  const normalize = (s)=> s
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lower = (ws)=> ws.map(w=> w.toLowerCase());

  const bigrams = (words)=> {
    const out = [];
    for(let i=0;i<words.length-1;i++) out.push(words[i]+" "+words[i+1]);
    return out;
  };

  const violates = (title)=> {
    const ws = normalize(title);
    const lc = lower(ws);
    if(!ws.length) return true;

    // no duplicate adjacent words inside one title
    for(let i=0;i<lc.length-1;i++){
      if(lc[i]===lc[i+1]) return true;
    }
    // any bigram seen before globally?
    const b = bigrams(lc);
    for(const bg of b){ if(__USED_BIGRAMS.has(bg)) return true; }

    return false;
  };

  const pickFrom = (r, arr)=> arr[r()%arr.length];

  // Word banks
  const A = __ADJ, N = __NOUN, H = __HOOK;
  const ARTISTS = [
    "The Silver Comets","Neon Parade","Paper Lanterns","Velvet Echoes","Indigo Quartet",
    "The Jet Set","Crimson Tide","Midnight Radio","Electric Hearts","Golden Hour",
    "The Amber Rooms","Violet Skyline","Satellite City","The Night Owls","Ivory Street Band",
    "Bluebird Company","Marble Garden","Velvet Undergrounders","Echo Park Players","Lantern Light",
    "Harbor & Co.","The Carousel Club","Kite & Canvas","Saffron Society","The Prairie Dogs"
  ];
  const PLAY_FORMS = [
    "Picture Show","Live on Stage","In Concert","Experience","Cabaret","Showcase",
    "Festival","Gala","Residency","Matinee","After Dark","Revue","Workshop"
  ];
  const STORY_OPENERS = [
    "Once Upon a Time","Into the Unknown","A Night to Remember","Between Two Worlds",
    "The Last Carousel","Dreams of Summer","Echoes in the Hall","Velvet Midnight",
    "The Paper Moon","Lanterns at Dusk","The Long Goodbye","Morning After Dark","Before the Storm"
  ];
  const TOUR_TAGS = ["Greatest Hits","Unplugged","Anniversary Tour","Acoustic Sessions","Late Night Set"];
  const PROMOS = ["One Night Only!","Two Nights Only!","One Weekend Only!","2 weeks only!!","Limited Season","Encore Performance"];

  const makeTitle = (r)=>{
    const templates = [
      ()=> `${pickFrom(r, ARTISTS)} Live on Stage`,
      ()=> `${pickFrom(r, ARTISTS)} — ${pickFrom(r, TOUR_TAGS)}`,
      ()=> `An Evening with ${pickFrom(r, ARTISTS)}`,
      ()=> `The ${pickFrom(r, N)} ${pickFrom(r, PLAY_FORMS)}`,
      ()=> `The ${pickFrom(r, A)} ${pickFrom(r, N)}`,
      ()=> `${pickFrom(r, A)} ${pickFrom(r, N)} ${pickFrom(r, H)}`,
      ()=> `${pickFrom(r, STORY_OPENERS)}`,
      ()=> `${pickFrom(r, A)} ${pickFrom(r, N)}: ${pickFrom(r, H)}`,
      ()=> `${pickFrom(r, A)} ${pickFrom(r, N)} ${pickFrom(r, PLAY_FORMS)}`,
      ()=> `${pickFrom(r, N)} ${pickFrom(r, PLAY_FORMS)}`
    ];
    let t = templates[r()%templates.length]();
    if ((r()%4)===0) t += ` — ${pickFrom(r, PROMOS)}`;
    return t.replace(/\s+/g,' ').trim();
  };

  // Try multiple deterministic attempts with salted RNG until constraints satisfied
  let attempt = 0, title = "";
  for(; attempt < 96; attempt++){
    const r = __rng(base ^ (attempt * 1315423911));
    const candidate = makeTitle(r);
    if(!violates(candidate)){
      title = candidate;
      break;
    }
  }
  if(!title){ title = makeTitle(__rng(base ^ 0x9e3779b9)); } // fallback

  // Commit global constraints
  const ws = lower(normalize(title));
  for(let i=0;i<ws.length-1;i++){ __USED_BIGRAMS.add(ws[i]+" "+ws[i+1]); }

  return title;
}function pick(arr){ return arr[Math.floor(rnd()*arr.length)]; }
    function jitter([lng,lat]){ return [lng + (rnd()-0.5)*8, clamp(lat + (rnd()-0.5)*8,-80,80)]; }

  function toISODate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function parseISODate(s){
    const [yy, mm, dd] = s.split('-').map(Number);
    return new Date(yy, mm - 1, dd);
  }

  const DAY_MS = 86400000;

  function generateEventBlocks(options={}){
    const {
      minBlocks = 1,
      maxBlocks = 3,
      allowPast = false,
      maxFutureDays = 180,
      upcomingBiasDays = 60,
      pastWindowDays = 60,
      maxSpanDays = 14
    } = options;
    const now = new Date();
    now.setHours(0,0,0,0);
    const normalizedMin = Math.max(1, Math.floor(minBlocks));
    const normalizedMax = Math.max(normalizedMin, Math.floor(maxBlocks));
    const blockTotal = normalizedMin + Math.floor(rnd() * (normalizedMax - normalizedMin + 1));
    const futureRange = Math.max(1, Math.floor(maxFutureDays));
    const biasRange = Math.max(1, Math.min(futureRange, Math.floor(upcomingBiasDays) || futureRange));
    const pastRange = Math.max(0, Math.floor(pastWindowDays));
    const blocks = [];
    for(let i=0;i<blockTotal;i++){
      let offsetDays = 0;
      if(allowPast && pastRange > 0 && rnd() < 0.22){
        offsetDays = -Math.floor(rnd() * pastRange);
      } else {
        const roll = rnd();
        if(roll < 0.7){
          offsetDays = Math.floor(rnd() * biasRange);
        } else if(roll < 0.9){
          const midRange = Math.max(biasRange, Math.floor(futureRange * 0.65));
          offsetDays = Math.floor(rnd() * Math.min(futureRange, midRange));
        } else {
          offsetDays = Math.floor(rnd() * futureRange);
        }
      }
      if(!allowPast && offsetDays < 0){
        offsetDays = 0;
      }
      const span = 1 + Math.floor(rnd() * Math.max(1, Math.floor(maxSpanDays)));
      const start = new Date(now.getTime() + offsetDays * DAY_MS);
      start.setHours(0,0,0,0);
      blocks.push({ start, spanDays: span });
    }
    blocks.sort((a,b)=> a.start - b.start);
    return blocks;
  }

  function pickBlockOffsets(spanDays){
    const totalDays = Math.max(1, Math.floor(spanDays));
    const offsets = new Set();
    if(totalDays <= 1){
      offsets.add(0);
      return Array.from(offsets);
    }
    const densityRoll = rnd();
    let target;
    if(densityRoll < 0.25){
      target = 1 + Math.floor(rnd() * Math.min(2, totalDays));
    } else if(densityRoll < 0.6){
      target = Math.min(totalDays, 2 + Math.floor(rnd() * Math.min(3, totalDays - 1)));
    } else if(densityRoll < 0.85){
      target = Math.min(totalDays, Math.max(2, Math.round(totalDays * (0.5 + rnd() * 0.4))));
    } else {
      target = Math.min(totalDays, Math.max(3, Math.round(totalDays * (0.75 + rnd() * 0.6))));
    }
    target = Math.max(1, Math.min(totalDays, target));
    while(offsets.size < target){
      offsets.add(Math.floor(rnd() * totalDays));
      if(offsets.size >= totalDays){
        break;
      }
    }
    return Array.from(offsets).sort((a,b)=> a - b);
  }

  function randomSessionTime(){
    const slot = rnd();
    let hour;
    if(slot < 0.15){
      hour = 10 + Math.floor(rnd() * 3); // late morning
    } else if(slot < 0.8){
      hour = 18 + Math.floor(rnd() * 4); // evening shows
    } else if(slot < 0.9){
      hour = 14 + Math.floor(rnd() * 4); // matinees
    } else {
      hour = 12 + Math.floor(rnd() * 6); // afternoon variety
    }
    const minute = Math.floor(rnd() * 4) * 15;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }

  function generateSessionsFromBlocks(blocks, options={}){
    const allowEmptyBlocks = options.allowEmptyBlocks !== false;
    const emptyBlockChance = typeof options.emptyBlockChance === 'number'
      ? Math.min(Math.max(options.emptyBlockChance, 0), 1)
      : 0.2;
    const ensureAtLeastOne = options.ensureAtLeastOne === true;
    const allowDoubleSessions = options.allowDoubleSessions !== false;
    const generator = typeof options.timeGenerator === 'function' ? options.timeGenerator : randomSessionTime;
    const sessions = [];
    blocks.forEach((block, blockIndex) => {
      if(!block || !(block.start instanceof Date)){
        return;
      }
      if(allowEmptyBlocks && rnd() < emptyBlockChance && blockIndex !== 0){
        return;
      }
      const offsets = pickBlockOffsets(block.spanDays);
      offsets.forEach(offset => {
        const sessionDate = new Date(block.start.getTime() + offset * DAY_MS);
        sessionDate.setHours(0,0,0,0);
        const full = toISODate(sessionDate);
        const dateLabel = sessionDate
          .toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'})
          .replace(/,/g,'');
        const time = generator({ block, offset, date: sessionDate });
        sessions.push({ date: dateLabel, time, full });
        if(allowDoubleSessions && rnd() < 0.08){
          let extraTime = generator({ block, offset, date: sessionDate, variant: 'double' });
          if(extraTime === time){
            extraTime = randomSessionTime();
          }
          sessions.push({ date: dateLabel, time: extraTime, full });
        }
      });
    });
    if(ensureAtLeastOne && !sessions.length){
      const fallbackDate = new Date();
      fallbackDate.setHours(0,0,0,0);
      const full = toISODate(fallbackDate);
      const dateLabel = fallbackDate
        .toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'})
        .replace(/,/g,'');
      const time = generator({ fallback: true, date: fallbackDate });
      sessions.push({ date: dateLabel, time, full });
    }
    sessions.sort((a,b)=> a.full.localeCompare(b.full) || a.time.localeCompare(b.time));
    return sessions;
  }

  function randomDates(){
    const blocks = generateEventBlocks({
      minBlocks: 1,
      maxBlocks: 3,
      allowPast: false,
      maxFutureDays: 180,
      upcomingBiasDays: 120,
      maxSpanDays: 14
    });
    const sessions = generateSessionsFromBlocks(blocks, {
      allowEmptyBlocks: false,
      ensureAtLeastOne: true,
      allowDoubleSessions: false
    });
    const isoSet = new Set();
    sessions.forEach(entry => {
      if(entry && entry.full){
        isoSet.add(entry.full);
      }
    });
    if(!isoSet.size){
      isoSet.add(toISODate(new Date()));
    }
    return Array.from(isoSet).sort();
  }

  function randomSchedule(){
    const blocks = generateEventBlocks({
      minBlocks: 1,
      maxBlocks: 3,
      allowPast: true,
      pastWindowDays: 75,
      maxFutureDays: 180,
      upcomingBiasDays: 60,
      maxSpanDays: 14
    });
    return generateSessionsFromBlocks(blocks, {
      allowEmptyBlocks: true,
      emptyBlockChance: 0.25,
      ensureAtLeastOne: true,
      allowDoubleSessions: true,
      timeGenerator: randomSessionTime
    });
  }

  function derivePostDatesFromLocations(locations){
    if(!Array.isArray(locations) || !locations.length){
      return [];
    }
    const seen = new Set();
    locations.forEach(loc => {
      if(!loc) return;
      const schedule = Array.isArray(loc.dates) ? loc.dates : [];
      schedule.forEach(entry => {
        if(!entry) return;
        if(typeof entry === 'string'){
          const trimmed = entry.trim();
          if(trimmed) seen.add(trimmed);
          return;
        }
        if(entry.full){
          const normalized = String(entry.full).trim();
          if(normalized) seen.add(normalized);
        }
      });
    });
    return Array.from(seen).sort();
  }

  function normalizeLongitude(value){
    if(!Number.isFinite(value)) value = 0;
    const normalized = ((value + 180) % 360 + 360) % 360 - 180;
    return Number.isFinite(normalized) ? normalized : 0;
  }

  function clampLatitude(value){
    if(!Number.isFinite(value)) return 0;
    return Math.max(-85, Math.min(85, value));
  }

  function safeCoordinate(city, baseLng=0, baseLat=0, radius=0){
    const centerLng = Number.isFinite(baseLng) ? baseLng : 0;
    const centerLat = Number.isFinite(baseLat) ? baseLat : 0;
    const spread = Math.max(Number.isFinite(radius) ? radius : 0, 0);

    let lng = centerLng;
    let lat = centerLat;

    if(spread > 0){
      const distance = Math.sqrt(rnd()) * spread;
      const angle = rnd() * Math.PI * 2;
      lng += Math.cos(angle) * distance;
      lat += Math.sin(angle) * distance;
    }

    return {
      lng: normalizeLongitude(lng),
      lat: clampLatitude(lat)
    };
  }

  function createRandomLocation(city, baseLng=0, baseLat=0, options={}){
    const defaultRadius = 0.05;
    const radius = Number.isFinite(options.radius) ? Math.max(options.radius, 0) : defaultRadius;
    const coord = safeCoordinate(city, baseLng, baseLat, radius);
    const venueName = options.name || city || 'Event Venue';
    const address = options.address || city || '';
    return {
      venue: venueName,
      address,
      lng: coord.lng,
      lat: coord.lat,
      dates: randomSchedule(),
      price: randomPriceRange()
    };
  }

  const LOCAL_GEOCODER_MAX_RESULTS = 10;
  const localVenueIndex = [];
  const localVenueKeySet = new Set();
  const LOCAL_VENUE_PLACE_TYPES = Object.freeze(['poi', 'venue']);
  const MULTI_VENUE_COORD_PRECISION = 6;
  window.postsAtVenue = window.postsAtVenue && typeof window.postsAtVenue === 'object'
    ? window.postsAtVenue
    : Object.create(null);

  function getPostsAtVenueStore(){
    if(!window.postsAtVenue || typeof window.postsAtVenue !== 'object'){
      window.postsAtVenue = Object.create(null);
    }
    return window.postsAtVenue;
  }

  function toVenueCoordKey(lng, lat){
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return '';
    const normalizedLng = Number(lng).toFixed(MULTI_VENUE_COORD_PRECISION);
    const normalizedLat = Number(lat).toFixed(MULTI_VENUE_COORD_PRECISION);
    return `${normalizedLng},${normalizedLat}`;
  }

  function clearPostsAtVenueIndex(){
    const store = getPostsAtVenueStore();
    Object.keys(store).forEach(key => { delete store[key]; });
  }

  function registerPostAtVenue(post, key){
    if(!key) return;
    const store = getPostsAtVenueStore();
    const bucket = store[key] || (store[key] = []);
    if(!bucket.some(item => item && item.id === post.id)){
      bucket.push(post);
    }
  }

  function getPostsAtVenueByCoords(lng, lat){
    const key = toVenueCoordKey(lng, lat);
    if(!key) return [];
    const store = getPostsAtVenueStore();
    const bucket = store[key];
    return Array.isArray(bucket) ? bucket.slice() : [];
  }

  window.getPostsAtVenueByCoords = getPostsAtVenueByCoords;

  function localVenueKey(name='', address='', lng, lat){
    const normName = (name || '').toLowerCase();
    const normAddr = (address || '').toLowerCase();
    const normLng = Number.isFinite(lng) ? lng.toFixed(6) : '';
    const normLat = Number.isFinite(lat) ? lat.toFixed(6) : '';
    return `${normName}|${normAddr}|${normLng}|${normLat}`;
  }

  function cloneGeocoderFeature(feature){
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: Array.isArray(feature.geometry?.coordinates)
          ? feature.geometry.coordinates.slice()
          : []
      },
      center: Array.isArray(feature.center) ? feature.center.slice() : [],
      properties: {
        ...(feature.properties || {})
      }
    };
  }

  function addVenueToLocalIndex({ name, address, lng, lat, city }){
    if(!name || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = localVenueKey(name, address, lng, lat);
    if(localVenueKeySet.has(key)) return;
    localVenueKeySet.add(key);
    const contextParts = [address, city].filter(Boolean);
    const placeName = contextParts.length ? `${name} — ${contextParts.join(', ')}` : name;
    const searchText = [name, address, city].filter(Boolean).join(' ').toLowerCase();
    localVenueIndex.push({
      search: searchText,
      feature: {
        type:'Feature',
        geometry:{ type:'Point', coordinates:[lng, lat] },
        center:[lng, lat],
        place_name: placeName,
        text: name,
        place_type: LOCAL_VENUE_PLACE_TYPES.slice(),
        properties:{
          name,
          address: address || '',
          city: city || '',
          source:'local-venue'
        }
      }
    });
  }

  function rebuildVenueIndex(){
    localVenueIndex.length = 0;
    localVenueKeySet.clear();
    clearPostsAtVenueIndex();
    const postList = Array.isArray(posts) ? posts : [];
    const addFromPost = (post) => {
      if(!post) return;
      const city = post.city || '';
      const fallbackName = getPrimaryVenueName(post) || city;
      const fallbackAddress = city || post.city || '';
      const seenVenueKeys = new Set();
      const addVenue = (lng, lat, locName, locAddress) => {
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        const nameValue = locName || fallbackName;
        const addressValue = locAddress || fallbackAddress;
        addVenueToLocalIndex({ name: nameValue, address: addressValue, lng, lat, city });
        const key = toVenueCoordKey(lng, lat);
        if(!key || seenVenueKeys.has(key)) return;
        seenVenueKeys.add(key);
        registerPostAtVenue(post, key);
      };
      if(Array.isArray(post.locations) && post.locations.length){
        post.locations.forEach(loc => {
          if(!loc) return;
          addVenue(loc.lng, loc.lat, loc.venue, loc.address);
        });
        return;
      }
      addVenue(post.lng, post.lat, fallbackName, fallbackAddress);
    };
    postList.forEach(addFromPost);
  }

  function searchLocalVenues(query){
    const normalized = (query || '').toLowerCase().trim();
    if(!normalized) return [];
    const terms = normalized.split(/\s+/).filter(Boolean);
    if(!terms.length) return [];
    const matches = [];
    for(const entry of localVenueIndex){
      const haystack = entry.search;
      let score = 0;
      let valid = true;
      for(const term of terms){
        const idx = haystack.indexOf(term);
        if(idx === -1){
          valid = false;
          break;
        }
        score += 1 / (1 + idx);
      }
      if(valid){
        matches.push({ entry, score });
      }
    }
    matches.sort((a,b)=> b.score - a.score);
    return matches.slice(0, LOCAL_GEOCODER_MAX_RESULTS).map(item => {
      const feature = cloneGeocoderFeature(item.entry.feature);
      feature.relevance = Math.min(1, item.score);
      return feature;
    });
  }

  const localVenueGeocoder = (query) => searchLocalVenues(query);

  const MAPBOX_VENUE_ENDPOINT = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
  const MAPBOX_VENUE_CACHE_LIMIT = 40;
  const MAPBOX_VENUE_MIN_QUERY = 2;
  const mapboxVenueCache = new Map();

  function mapboxVenueCacheKey(query, options={}){
    const normalized = (query || '').trim().toLowerCase();
    const limit = Number.isFinite(options.limit) ? options.limit : 0;
    const types = typeof options.types === 'string' ? options.types : '';
    const prox = options.proximity && Number.isFinite(options.proximity.longitude) && Number.isFinite(options.proximity.latitude)
      ? `${options.proximity.longitude.toFixed(3)},${options.proximity.latitude.toFixed(3)}`
      : '';
    const language = typeof options.language === 'string' ? options.language : '';
    const country = typeof options.country === 'string' ? options.country : '';
    const bbox = Array.isArray(options.bbox) ? options.bbox.join(',') : '';
    return [normalized, limit, types, prox, language, country, bbox].join('|');
  }

  function rememberMapboxVenueResult(key, features){
    if(!key) return;
    try{
      mapboxVenueCache.set(key, features);
      if(mapboxVenueCache.size > MAPBOX_VENUE_CACHE_LIMIT){
        const firstKey = mapboxVenueCache.keys().next().value;
        if(firstKey) mapboxVenueCache.delete(firstKey);
      }
    }catch(err){}
  }

  function getMapboxVenueFeatureCenter(feature){
    if(feature && Array.isArray(feature.center) && feature.center.length === 2){
      const [lng, lat] = feature.center;
      if(Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    const coords = feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates
      : null;
    if(coords && coords.length >= 2){
      const [lng, lat] = coords;
      if(Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    return null;
  }

  function normalizeMapboxVenueFeature(feature){
    if(!feature || typeof feature !== 'object') return null;
    const clone = cloneGeocoderFeature(feature);
    const center = getMapboxVenueFeatureCenter(clone);
    if(center){
      clone.center = center.slice();
      clone.geometry = clone.geometry || { type:'Point', coordinates:center.slice() };
      if(Array.isArray(clone.geometry.coordinates)){
        clone.geometry.coordinates[0] = center[0];
        clone.geometry.coordinates[1] = center[1];
      }
    }
    if(!Array.isArray(clone.place_type) || !clone.place_type.length){
      clone.place_type = Array.isArray(feature.place_type) && feature.place_type.length
        ? feature.place_type.slice()
        : ['poi'];
    }
    clone.properties = clone.properties || {};
    if(!clone.properties.name && typeof clone.text === 'string'){
      clone.properties.name = clone.text;
    }
    if(typeof feature.properties === 'object'){
      if(!clone.properties.address && typeof feature.properties.address === 'string'){
        clone.properties.address = feature.properties.address;
      }
      if(!clone.properties.category && typeof feature.properties.category === 'string'){
        clone.properties.category = feature.properties.category;
      }
    }
    if(!clone.properties.source){
      clone.properties.source = 'mapbox-places';
    }
    if(typeof clone.text !== 'string' && typeof feature.text === 'string'){
      clone.text = feature.text;
    }
    if(typeof clone.place_name !== 'string' && typeof feature.place_name === 'string'){
      clone.place_name = feature.place_name;
    }
    return clone;
  }

  const MAPBOX_SUPPORTED_VENUE_TYPES = ['poi','place','address'];

  const MAJOR_VENUE_PRIORITY_TYPES = [
    'country',
    'region',
    'district',
    'place',
    'locality',
    'neighborhood',
    'address'
  ];

  const MAJOR_VENUE_POI_KEYWORDS = [
    'airport',
    'international airport',
    'airfield',
    'railway station',
    'train station',
    'subway station',
    'metro station',
    'bus station',
    'bus terminal',
    'transit station',
    'ferry terminal',
    'cruise terminal',
    'harbor',
    'port',
    'stadium',
    'arena',
    'ballpark',
    'coliseum',
    'amphitheater',
    'amphitheatre',
    'convention center',
    'conference center',
    'exhibition center',
    'expo center',
    'landmark',
    'monument',
    'memorial',
    'tower',
    'bridge',
    'palace',
    'castle',
    'temple',
    'shrine',
    'cathedral',
    'church',
    'mosque',
    'synagogue',
    'basilica',
    'pagoda',
    'museum',
    'gallery',
    'art museum',
    'science museum',
    'science center',
    'observatory',
    'planetarium',
    'library',
    'university',
    'college',
    'campus',
    'school',
    'academy',
    'zoo',
    'aquarium',
    'botanical garden',
    'garden',
    'park',
    'national park',
    'state park',
    'theme park',
    'amusement park',
    'water park',
    'heritage site',
    'historic site',
    'world heritage',
    'city hall',
    'parliament',
    'government',
    'embassy',
    'consulate',
    'consulate general',
    'court',
    'plaza',
    'square',
    'cultural center',
    'performing arts',
    'concert hall',
    'opera house',
    'theatre',
    'theater',
    'music hall'
  ].map(keyword => keyword.toLowerCase());

  const MAJOR_VENUE_POI_MAKI = [
    'airport',
    'harbor',
    'harbour',
    'monument',
    'landmark',
    'castle',
    'town-hall',
    'museum',
    'park',
    'stadium',
    'rail',
    'college',
    'library',
    'zoo',
    'campsite'
  ];

  function isMajorVenuePoi(feature, placeTypes){
    const properties = (feature && feature.properties) ? feature.properties : {};
    if(properties.landmark === true) return true;
    if(placeTypes.includes('poi.landmark')) return true;
    const makiRaw = typeof properties.maki === 'string' ? properties.maki : '';
    const maki = makiRaw.toLowerCase();
    if(maki){
      if(MAJOR_VENUE_POI_MAKI.includes(maki) || maki.startsWith('religious')){
        return true;
      }
    }
    const category = typeof properties.category === 'string' ? properties.category.toLowerCase() : '';
    const name = typeof properties.name === 'string' ? properties.name.toLowerCase() : '';
    const text = typeof feature.text === 'string' ? feature.text.toLowerCase() : '';
    const placeName = typeof feature.place_name === 'string' ? feature.place_name.toLowerCase() : '';
    const haystack = [category, name, text, placeName].filter(Boolean).join(' ');
    if(!haystack) return false;
    return MAJOR_VENUE_POI_KEYWORDS.some(keyword => haystack.includes(keyword));
  }

  function majorVenueFilter(feature){
    if(!feature || typeof feature !== 'object') return false;
    const rawTypes = Array.isArray(feature.place_type) ? feature.place_type : [];
    const placeTypes = rawTypes.map(type => String(type || '').toLowerCase());
    if(placeTypes.some(type => MAJOR_VENUE_PRIORITY_TYPES.includes(type))){
      return true;
    }
    if(placeTypes.includes('poi') || placeTypes.includes('poi.landmark')){
      return isMajorVenuePoi(feature, placeTypes);
    }
    return false;
  }

  function normalizeMapboxVenueTypes(value, fallback='poi'){
    const rawList = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? value.split(',') : []);
    const seen = new Set();
    const filtered = [];
    for(const entry of rawList){
      const trimmed = String(entry || '').trim();
      if(!trimmed) continue;
      if(MAPBOX_SUPPORTED_VENUE_TYPES.includes(trimmed) && !seen.has(trimmed)){
        seen.add(trimmed);
        filtered.push(trimmed);
      }
    }
    if(filtered.length > 0){
      return filtered.join(',');
    }
    if(typeof fallback === 'string' && fallback){
      return normalizeMapboxVenueTypes(fallback, '');
    }
    return '';
  }

  async function searchMapboxVenues(query, options={}){
    const normalized = (query || '').trim();
    if(!normalized || normalized.length < MAPBOX_VENUE_MIN_QUERY) return [];
    if(typeof MAPBOX_TOKEN !== 'string' || !MAPBOX_TOKEN){
      return [];
    }
    const limitRaw = Number.isFinite(options.limit) ? options.limit : 5;
    const limit = Math.max(1, Math.min(10, limitRaw));
    const types = normalizeMapboxVenueTypes(options.types, 'poi');
    const resolvedTypes = types || 'poi';
    const language = typeof options.language === 'string' && options.language ? options.language : '';
    const country = typeof options.country === 'string' && options.country ? options.country : '';
    const bbox = Array.isArray(options.bbox) ? options.bbox : null;
    const proximity = options.proximity && Number.isFinite(options.proximity.longitude) && Number.isFinite(options.proximity.latitude)
      ? { longitude: options.proximity.longitude, latitude: options.proximity.latitude }
      : null;
    const cacheKey = mapboxVenueCacheKey(normalized, { limit, types: resolvedTypes, proximity, language, country, bbox });
    if(mapboxVenueCache.has(cacheKey)){
      const cached = mapboxVenueCache.get(cacheKey);
      return Array.isArray(cached) ? cached.map(cloneGeocoderFeature) : [];
    }
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: 'true',
      types: resolvedTypes,
      limit: String(limit)
    });
    if(language) params.set('language', language);
    if(country) params.set('country', country);
    if(proximity){
      params.set('proximity', `${proximity.longitude},${proximity.latitude}`);
    }
    if(bbox && bbox.length === 4 && bbox.every(val => Number.isFinite(val))){
      params.set('bbox', bbox.join(','));
    }
    const url = `${MAPBOX_VENUE_ENDPOINT}${encodeURIComponent(normalized)}.json?${params.toString()}`;
    const fetchOptions = {};
    if(options.signal) fetchOptions.signal = options.signal;
    let data = null;
    try{
      const response = await fetch(url, fetchOptions);
      if(!response || !response.ok){
        return [];
      }
      data = await response.json();
    }catch(err){
      if(options.signal && options.signal.aborted){
        return [];
      }
      console.warn('Mapbox venue search failed', err);
      return [];
    }
    const features = Array.isArray(data && data.features) ? data.features : [];
    const normalizedResults = [];
    for(const feature of features){
      const normalizedFeature = normalizeMapboxVenueFeature(feature);
      const center = getMapboxVenueFeatureCenter(normalizedFeature);
      if(!normalizedFeature || !center) continue;
      normalizedResults.push(normalizedFeature);
    }
    rememberMapboxVenueResult(cacheKey, normalizedResults.map(cloneGeocoderFeature));
    return normalizedResults.map(cloneGeocoderFeature);
  }

  function externalMapboxVenueGeocoder(query){
    const contextOptions = (this && this.options) ? this.options : {};
    const limit = Number.isFinite(contextOptions.limit) ? contextOptions.limit : undefined;
    const proximity = contextOptions.proximity && typeof contextOptions.proximity === 'object'
      ? contextOptions.proximity
      : null;
    const language = contextOptions.language;
    const country = contextOptions.country;
    const bbox = contextOptions.bbox;
    const types = normalizeMapboxVenueTypes(contextOptions.types, 'poi');
    return searchMapboxVenues(query, { limit, proximity, language, country, bbox, types });
  }

  rebuildVenueIndex();


  function randomImages(id){
    const hero = heroUrl(id);
    const others = Array.from({length:9},(_,i)=>{
      const port = i % 2 === 0;
      return `https://picsum.photos/seed/${encodeURIComponent(id)}-${i}/${port?'800/1200':'1200/800'}`;
    });
    return [hero, ...others];
  }

  function randomText(min=50,max=200){
    const lorem = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(' ');
    const count = min + Math.floor(rnd()*(max-min+1));
    const words = [];
    for(let i=0;i<count;i++){ words.push(lorem[i%lorem.length]); }
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    return words.join(' ') + '.';
  }

  function randomPriceRange(){
    const low = 10 + Math.floor(rnd()*90);
    const high = low + 10 + Math.floor(rnd()*90);
    return `$${low} - $${high}`;
  }

  function randomUsername(seed){
    const names = ['Aria','Blake','Casey','Drew','Evan','Finn','Gray','Harper','Indie','Jules'];
    let h = 0; for(let i=0;i<seed.length;i++){ h = (h<<5)-h+seed.charCodeAt(i); }
    const name = names[Math.abs(h)%names.length];
    const num = Math.abs(Math.floor(h/7))%1000;
    return name + num;
  }

  function randomAvatar(seed){
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}-a/100/100`;
  }

  function slugify(str){
    return str.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }
  window.slugify = slugify;

  function postUrl(p){
    return `${BASE_URL}#/post/${p.slug}-${p.created}`;
  }

  function showCopyMsg(btn){
    const header = btn && btn.closest('.post-header');
    if(!header) return;
    const msg = document.createElement('div');
    msg.className='copy-msg';
    msg.textContent='Link Copied';
    header.appendChild(msg);
    const btnRect = btn.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const msgRect = msg.getBoundingClientRect();
    msg.style.top = (btnRect.top - headerRect.top + (btnRect.height - msgRect.height)/2) + 'px';
    msg.style.left = (btnRect.left - headerRect.left - msgRect.width - 10) + 'px';
    requestAnimationFrame(()=>msg.classList.add('show'));
    setTimeout(()=>msg.remove(),1500);
  }

  function showCopyStyleMessage(text, target){
    if(!target || typeof target.getBoundingClientRect !== 'function') return null;
    const msg = document.createElement('div');
    msg.className = 'copy-msg';
    msg.textContent = text;
    document.body.appendChild(msg);

    let removed = false;
    const remove = ()=>{
      if(removed) return;
      removed = true;
      if(msg && msg.parentNode){
        msg.remove();
      }
    };

    const reposition = ()=>{
      if(!target || typeof target.getBoundingClientRect !== 'function'){
        remove();
        return;
      }
      if(document.body && !document.body.contains(target)){
        remove();
        return;
      }
      const rect = target.getBoundingClientRect();
      const msgRect = msg.getBoundingClientRect();
      const top = rect.top + window.scrollY + (rect.height - msgRect.height) / 2;
      const left = rect.left + window.scrollX + (rect.width - msgRect.width) / 2;
      msg.style.top = `${top}px`;
      msg.style.left = `${left}px`;
    };

    reposition();
    requestAnimationFrame(()=>{
      reposition();
      msg.classList.add('show');
    });

    return { element: msg, remove, reposition };
  }

function makePosts(){
  const out = [];
  const cityCounts = Object.create(null);
  const MAX_POSTS_PER_CITY = 200;
  const neighborhoodCache = new Map();
  const eligibleCategories = Array.isArray(categories)
    ? categories.filter(cat => cat && Array.isArray(cat.subs) && cat.subs.length)
    : [];

  const pickCategory = ()=> eligibleCategories.length ? pick(eligibleCategories) : null;
  const pickSubcategory = (cat)=> (cat && Array.isArray(cat.subs) && cat.subs.length)
    ? pick(cat.subs)
    : null;

  function pushPost(post){
    if(post && post.city){
      const key = String(post.city);
      cityCounts[key] = (cityCounts[key] || 0) + 1;
    }
    out.push(post);
  }

  function canAddCity(city){
    if(!city) return true;
    const key = String(city);
    return (cityCounts[key] || 0) < MAX_POSTS_PER_CITY;
  }

  function inlandShiftFor(lng){
    if(!Number.isFinite(lng)) return 0;
    if(lng < -90) return 0.012;
    if(lng < -30) return -0.012;
    if(lng >= 120) return -0.012;
    if(lng >= 60) return -0.009;
    if(lng >= 20) return -0.008;
    if(lng >= -10) return -0.006;
    return -0.01;
  }

  function buildNeighborhoods(city, baseLng, baseLat){
    const key = city || `${baseLng},${baseLat}`;
    if(neighborhoodCache.has(key)){
      return neighborhoodCache.get(key);
    }
    const latSign = Number.isFinite(baseLat) && baseLat < 0 ? -1 : 1;
    const lngShift = inlandShiftFor(baseLng);
    const neighborhoods = [
      { lng: normalizeLongitude(baseLng), lat: clampLatitude(baseLat) },
      { lng: normalizeLongitude(baseLng + lngShift), lat: clampLatitude(baseLat + 0.008 * latSign) },
      { lng: normalizeLongitude(baseLng + lngShift * 0.6), lat: clampLatitude(baseLat - 0.007 * latSign) },
      { lng: normalizeLongitude(baseLng + lngShift * -0.4), lat: clampLatitude(baseLat + 0.004 * latSign) }
    ];
    neighborhoodCache.set(key, neighborhoods);
    return neighborhoods;
  }

  function jitterNeighborhoodPoint(point){
    if(!point) return { lng: 0, lat: 0 };
    const jitterRange = 0.004;
    const lng = normalizeLongitude(point.lng + (rnd() - 0.5) * jitterRange * 2);
    const lat = clampLatitude(point.lat + (rnd() - 0.5) * jitterRange * 2);
    return { lng, lat };
  }
  // ---- 100 posts at Federation Square (as before) ----
  const fsLng = 144.9695, fsLat = -37.8178;
  const fsCity = "Federation Square, Melbourne";
  for(let i=0;i<100;i++){
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = 'FS'+i;
    const title = `${id} ${uniqueTitle(i*7777+13, fsCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const location = createRandomLocation(fsCity, fsLng, fsLat, {
      name: 'Federation Square',
      address: 'Swanston St & Flinders St, Melbourne VIC 3000, Australia',
      radius: 0.05
    });
    const locations = [location];
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: fsCity,
      lng: location.lng, lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- 100 posts in Tasmania ----
  const tasLng = 147.3272, tasLat = -42.8821;
  const tasCity = "Hobart, Tasmania";
  const todayTas = new Date(); todayTas.setHours(0,0,0,0);
  for(let i=0;i<100;i++){
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = 'TAS'+i;
    const title = `${id} ${uniqueTitle(i*5311+23, tasCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const offset = 1 + i%30;
    const date = new Date(todayTas);
    date.setDate(date.getDate() + (i<50 ? -offset : offset));
    const location = createRandomLocation(tasCity, tasLng, tasLat, { radius: 0.05 });
    const isoDate = toISODate(date);
    location.dates = [{
      date: date.toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'}).replace(/,/g,''),
      time: '09:00',
      full: isoDate
    }];
    const locations = [location];
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: tasCity,
      lng: location.lng,
      lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- Restore world-wide posts ----
  // A light list of hub cities for better realism
  const hubs = [
    {c:"New York, USA",      lng:-73.9857, lat:40.7484},
    {c:"Los Angeles, USA",   lng:-118.2437, lat:34.0522},
    {c:"London, UK",         lng:-0.1276, lat:51.5074},
    {c:"Paris, France",      lng:2.3522, lat:48.8566},
    {c:"Berlin, Germany",    lng:13.4050, lat:52.5200},
    {c:"Madrid, Spain",      lng:-3.7038, lat:40.4168},
    {c:"Rome, Italy",        lng:12.4964, lat:41.9028},
    {c:"Amsterdam, NL",      lng:4.9041, lat:52.3676},
    {c:"Dublin, Ireland",    lng:-6.2603, lat:53.3498},
    {c:"Stockholm, Sweden",  lng:18.0686, lat:59.3293},
    {c:"Copenhagen, Denmark",lng:12.5683, lat:55.6761},
    {c:"Helsinki, Finland",  lng:24.9384, lat:60.1699},
    {c:"Oslo, Norway",       lng:10.7522, lat:59.9139},
    {c:"Reykjavík, Iceland", lng:-21.8277, lat:64.1265},
    {c:"Moscow, Russia",     lng:37.6173, lat:55.7558},
    {c:"Istanbul, Türkiye",  lng:28.9784, lat:41.0082},
    {c:"Athens, Greece",     lng:23.7275, lat:37.9838},
    {c:"Cairo, Egypt",       lng:31.2357, lat:30.0444},
    {c:"Nairobi, Kenya",     lng:36.8219, lat:-1.2921},
    {c:"Lagos, Nigeria",     lng:3.3792, lat:6.5244},
    {c:"Johannesburg, SA",   lng:28.0473, lat:-26.2041},
    {c:"Cape Town, SA",      lng:18.4241, lat:-33.9249},
    {c:"Dubai, UAE",         lng:55.2708, lat:25.2048},
    {c:"Mumbai, India",      lng:72.8777, lat:19.0760},
    {c:"Delhi, India",       lng:77.1025, lat:28.7041},
    {c:"Bangkok, Thailand",  lng:100.5018, lat:13.7563},
    {c:"Singapore",          lng:103.8198, lat:1.3521},
    {c:"Hong Kong, China",   lng:114.1694, lat:22.3193},
    {c:"Tokyo, Japan",       lng:139.6917, lat:35.6895},
    {c:"Seoul, South Korea", lng:126.9780, lat:37.5665},
    {c:"Sydney, Australia",  lng:151.2093, lat:-33.8688},
    {c:"Brisbane, Australia",lng:153.0251, lat:-27.4698},
    {c:"Auckland, New Zealand", lng:174.7633, lat:-36.8485},
    {c:"Toronto, Canada",    lng:-79.3832, lat:43.6532},
    {c:"Vancouver, Canada",  lng:-123.1207, lat:49.2827},
    {c:"Mexico City, Mexico",lng:-99.1332, lat:19.4326},
    {c:"São Paulo, Brazil",  lng:-46.6333, lat:-23.5505},
    {c:"Rio de Janeiro, Brazil", lng:-43.1729, lat:-22.9068},
    {c:"Buenos Aires, Argentina", lng:-58.3816, lat:-34.6037},
    {c:"Santiago, Chile",    lng:-70.6693, lat:-33.4489}
  ];

  // Generate ~900 posts across hubs with curated neighbourhood jitter
  const TOTAL_WORLD = 900;
  const worldCitySpecs = hubs.map(hub => ({
    city: hub.c,
    baseLng: hub.lng,
    baseLat: hub.lat,
    neighborhoods: buildNeighborhoods(hub.c, hub.lng, hub.lat),
    generated: 0
  }));
  const shufflePool = (pool)=>{
    if(!pool.length) return pool;
    const order = shuffledIndices(pool.length);
    return order.map(idx => pool[idx]);
  };
  let worldPool = shufflePool(worldCitySpecs.map((_, idx) => idx));
  let worldPoolIndex = 0;
  let worldProduced = 0;
  const WORLD_ATTEMPT_MAX = TOTAL_WORLD * 6;
  let worldAttempts = 0;
  while(worldProduced < TOTAL_WORLD && worldPool.length && worldAttempts < WORLD_ATTEMPT_MAX){
    if(worldPoolIndex >= worldPool.length){
      const available = worldPool.filter(idx => canAddCity(worldCitySpecs[idx].city));
      worldPool = shufflePool(available);
      worldPoolIndex = 0;
      if(!worldPool.length){
        break;
      }
    }
    const specIndex = worldPool[worldPoolIndex++];
    const spec = worldCitySpecs[specIndex];
    worldAttempts++;
    if(!spec || !canAddCity(spec.city)){
      continue;
    }
    const neighborhoods = spec.neighborhoods && spec.neighborhoods.length
      ? spec.neighborhoods
      : buildNeighborhoods(spec.city, spec.baseLng, spec.baseLat);
    const generation = spec.generated || 0;
    const basePoint = neighborhoods[generation % neighborhoods.length] || neighborhoods[0];
    spec.generated = generation + 1;
    const coords = jitterNeighborhoodPoint(basePoint);
    const cityLabel = typeof spec.city === 'string' ? spec.city.split(',')[0].trim() || spec.city : spec.city;
    const location = createRandomLocation(spec.city, coords.lng, coords.lat, {
      name: `${cityLabel} District ${((generation % neighborhoods.length) + 1)}`,
      address: spec.city,
      radius: 0
    });
    const locations = [location];
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = `WW${worldProduced}`;
    const title = `${id} ${uniqueTitle(worldProduced*9343+19, spec.city, worldProduced)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: spec.city,
      lng: location.lng,
      lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
    worldProduced++;
  }

  // ---- Fixed Sydney Opera House posts to show multi-marker clustering ----
  const operaCity = 'Sydney, Australia';
  const operaVenueName = 'Sydney Opera House';
  const operaAddress = 'Bennelong Point, Sydney NSW 2000, Australia';
  const operaLng = 151.2153;
  const operaLat = -33.8568;
  for(let i=0;i<10;i++){
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = 'SOH'+i;
    const title = `${id} ${uniqueTitle(i*12007+7, operaCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const location = {
      venue: operaVenueName,
      address: operaAddress,
      lng: operaLng,
      lat: operaLat,
      dates: randomSchedule(),
      price: randomPriceRange()
    };
    const locations = [location];
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: operaCity,
      lng: operaLng,
      lat: operaLat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- 400 single-venue posts across unique locations ----
  const coordKey = (lng, lat)=>{
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return '';
    return `${lng.toFixed(6)},${lat.toFixed(6)}`;
  };
  const existingCoordKeys = new Set(out.map(p => coordKey(p.lng, p.lat)).filter(Boolean));
  const singleVenueBases = [
    { city: "Anchorage, USA", lng: -149.9003, lat: 61.2181 },
    { city: "Honolulu, USA", lng: -157.8583, lat: 21.3069 },
    { city: "San Francisco, USA", lng: -122.4194, lat: 37.7749 },
    { city: "Seattle, USA", lng: -122.3321, lat: 47.6062 },
    { city: "Vancouver, Canada", lng: -123.1207, lat: 49.2827 },
    { city: "Calgary, Canada", lng: -114.0719, lat: 51.0447 },
    { city: "Toronto, Canada", lng: -79.3832, lat: 43.6532 },
    { city: "Montreal, Canada", lng: -73.5673, lat: 45.5017 },
    { city: "Boston, USA", lng: -71.0589, lat: 42.3601 },
    { city: "New Orleans, USA", lng: -90.0715, lat: 29.9511 },
    { city: "Chicago, USA", lng: -87.6298, lat: 41.8781 },
    { city: "Miami, USA", lng: -80.1918, lat: 25.7617 },
    { city: "Dallas, USA", lng: -96.7969, lat: 32.7767 },
    { city: "Denver, USA", lng: -104.9903, lat: 39.7392 },
    { city: "Phoenix, USA", lng: -112.0740, lat: 33.4484 },
    { city: "Los Angeles, USA", lng: -118.2437, lat: 34.0522 },
    { city: "Mexico City, Mexico", lng: -99.1332, lat: 19.4326 },
    { city: "Guadalajara, Mexico", lng: -103.3496, lat: 20.6597 },
    { city: "Bogotá, Colombia", lng: -74.0721, lat: 4.7110 },
    { city: "Lima, Peru", lng: -77.0428, lat: -12.0464 },
    { city: "Quito, Ecuador", lng: -78.4678, lat: -0.1807 },
    { city: "Santiago, Chile", lng: -70.6693, lat: -33.4489 },
    { city: "Buenos Aires, Argentina", lng: -58.3816, lat: -34.6037 },
    { city: "Montevideo, Uruguay", lng: -56.1645, lat: -34.9011 },
    { city: "São Paulo, Brazil", lng: -46.6333, lat: -23.5505 },
    { city: "Rio de Janeiro, Brazil", lng: -43.1729, lat: -22.9068 },
    { city: "Brasília, Brazil", lng: -47.8825, lat: -15.7942 },
    { city: "Recife, Brazil", lng: -34.8770, lat: -8.0476 },
    { city: "Fortaleza, Brazil", lng: -38.5434, lat: -3.7319 },
    { city: "Caracas, Venezuela", lng: -66.9036, lat: 10.4806 },
    { city: "San Juan, Puerto Rico", lng: -66.1057, lat: 18.4655 },
    { city: "Reykjavík, Iceland", lng: -21.8277, lat: 64.1265 },
    { city: "Oslo, Norway", lng: 10.7522, lat: 59.9139 },
    { city: "Stockholm, Sweden", lng: 18.0686, lat: 59.3293 },
    { city: "Helsinki, Finland", lng: 24.9384, lat: 60.1699 },
    { city: "Copenhagen, Denmark", lng: 12.5683, lat: 55.6761 },
    { city: "Edinburgh, UK", lng: -3.1883, lat: 55.9533 },
    { city: "Dublin, Ireland", lng: -6.2603, lat: 53.3498 },
    { city: "Glasgow, UK", lng: -4.2518, lat: 55.8642 },
    { city: "London, UK", lng: -0.1276, lat: 51.5074 },
    { city: "Manchester, UK", lng: -2.2426, lat: 53.4808 },
    { city: "Paris, France", lng: 2.3522, lat: 48.8566 },
    { city: "Lyon, France", lng: 4.8357, lat: 45.7640 },
    { city: "Marseille, France", lng: 5.3698, lat: 43.2965 },
    { city: "Madrid, Spain", lng: -3.7038, lat: 40.4168 },
    { city: "Barcelona, Spain", lng: 2.1734, lat: 41.3851 },
    { city: "Valencia, Spain", lng: -0.3763, lat: 39.4699 },
    { city: "Lisbon, Portugal", lng: -9.1393, lat: 38.7223 },
    { city: "Porto, Portugal", lng: -8.6291, lat: 41.1579 },
    { city: "Brussels, Belgium", lng: 4.3517, lat: 50.8503 },
    { city: "Amsterdam, Netherlands", lng: 4.9041, lat: 52.3676 },
    { city: "Rotterdam, Netherlands", lng: 4.4792, lat: 51.9244 },
    { city: "Berlin, Germany", lng: 13.4050, lat: 52.5200 },
    { city: "Hamburg, Germany", lng: 9.9937, lat: 53.5511 },
    { city: "Munich, Germany", lng: 11.5820, lat: 48.1351 },
    { city: "Frankfurt, Germany", lng: 8.6821, lat: 50.1109 },
    { city: "Prague, Czechia", lng: 14.4378, lat: 50.0755 },
    { city: "Vienna, Austria", lng: 16.3738, lat: 48.2082 },
    { city: "Zurich, Switzerland", lng: 8.5417, lat: 47.3769 },
    { city: "Warsaw, Poland", lng: 21.0122, lat: 52.2297 },
    { city: "Kraków, Poland", lng: 19.9440, lat: 50.0647 },
    { city: "Budapest, Hungary", lng: 19.0402, lat: 47.4979 },
    { city: "Bucharest, Romania", lng: 26.1025, lat: 44.4268 },
    { city: "Athens, Greece", lng: 23.7275, lat: 37.9838 },
    { city: "Istanbul, Türkiye", lng: 28.9784, lat: 41.0082 },
    { city: "Ankara, Türkiye", lng: 32.8597, lat: 39.9334 },
    { city: "Cairo, Egypt", lng: 31.2357, lat: 30.0444 },
    { city: "Casablanca, Morocco", lng: -7.5898, lat: 33.5731 },
    { city: "Marrakesh, Morocco", lng: -7.9811, lat: 31.6295 },
    { city: "Algiers, Algeria", lng: 3.0588, lat: 36.7538 },
    { city: "Tunis, Tunisia", lng: 10.1815, lat: 36.8065 },
    { city: "Tripoli, Libya", lng: 13.1913, lat: 32.8872 },
    { city: "Khartoum, Sudan", lng: 32.5599, lat: 15.5007 },
    { city: "Addis Ababa, Ethiopia", lng: 38.7578, lat: 8.9806 },
    { city: "Nairobi, Kenya", lng: 36.8219, lat: -1.2921 },
    { city: "Kampala, Uganda", lng: 32.5825, lat: 0.3476 },
    { city: "Dar es Salaam, Tanzania", lng: 39.2083, lat: -6.7924 },
    { city: "Kigali, Rwanda", lng: 30.0588, lat: -1.9499 },
    { city: "Lagos, Nigeria", lng: 3.3792, lat: 6.5244 },
    { city: "Accra, Ghana", lng: -0.1869, lat: 5.6037 },
    { city: "Abidjan, Côte d'Ivoire", lng: -4.0083, lat: 5.3599 },
    { city: "Dakar, Senegal", lng: -17.4731, lat: 14.7167 },
    { city: "Kinshasa, DR Congo", lng: 15.2663, lat: -4.4419 },
    { city: "Luanda, Angola", lng: 13.2344, lat: -8.8383 },
    { city: "Johannesburg, South Africa", lng: 28.0473, lat: -26.2041 },
    { city: "Cape Town, South Africa", lng: 18.4241, lat: -33.9249 },
    { city: "Windhoek, Namibia", lng: 17.0832, lat: -22.5609 },
    { city: "Gaborone, Botswana", lng: 25.9089, lat: -24.6282 },
    { city: "Harare, Zimbabwe", lng: 31.0530, lat: -17.8249 },
    { city: "Maputo, Mozambique", lng: 32.5732, lat: -25.9692 },
    { city: "Riyadh, Saudi Arabia", lng: 46.6753, lat: 24.7136 },
    { city: "Jeddah, Saudi Arabia", lng: 39.1979, lat: 21.4858 },
    { city: "Doha, Qatar", lng: 51.5310, lat: 25.2854 },
    { city: "Dubai, UAE", lng: 55.2708, lat: 25.2048 },
    { city: "Muscat, Oman", lng: 58.4059, lat: 23.5859 },
    { city: "Kuwait City, Kuwait", lng: 47.9783, lat: 29.3759 },
    { city: "Manama, Bahrain", lng: 50.5861, lat: 26.2285 },
    { city: "Tehran, Iran", lng: 51.3890, lat: 35.6892 },
    { city: "Baghdad, Iraq", lng: 44.3661, lat: 33.3152 },
    { city: "Amman, Jordan", lng: 35.9239, lat: 31.9522 },
    { city: "Beirut, Lebanon", lng: 35.5018, lat: 33.8938 },
    { city: "Jerusalem", lng: 35.2137, lat: 31.7683 },
    { city: "Mumbai, India", lng: 72.8777, lat: 19.0760 },
    { city: "Delhi, India", lng: 77.1025, lat: 28.7041 },
    { city: "Bengaluru, India", lng: 77.5946, lat: 12.9716 },
    { city: "Hyderabad, India", lng: 78.4867, lat: 17.3850 },
    { city: "Chennai, India", lng: 80.2707, lat: 13.0827 },
    { city: "Kolkata, India", lng: 88.3639, lat: 22.5726 },
    { city: "Kathmandu, Nepal", lng: 85.3240, lat: 27.7172 },
    { city: "Dhaka, Bangladesh", lng: 90.4125, lat: 23.8103 },
    { city: "Colombo, Sri Lanka", lng: 79.8612, lat: 6.9271 },
    { city: "Bangkok, Thailand", lng: 100.5018, lat: 13.7563 },
    { city: "Chiang Mai, Thailand", lng: 98.9931, lat: 18.7883 },
    { city: "Vientiane, Laos", lng: 102.6341, lat: 17.9757 },
    { city: "Phnom Penh, Cambodia", lng: 104.9282, lat: 11.5564 },
    { city: "Ho Chi Minh City, Vietnam", lng: 106.6297, lat: 10.8231 },
    { city: "Hanoi, Vietnam", lng: 105.8342, lat: 21.0278 },
    { city: "Yangon, Myanmar", lng: 96.1951, lat: 16.8409 },
    { city: "Singapore", lng: 103.8198, lat: 1.3521 },
    { city: "Kuala Lumpur, Malaysia", lng: 101.6869, lat: 3.1390 },
    { city: "Jakarta, Indonesia", lng: 106.8456, lat: -6.2088 },
    { city: "Surabaya, Indonesia", lng: 112.7521, lat: -7.2575 },
    { city: "Manila, Philippines", lng: 120.9842, lat: 14.5995 },
    { city: "Cebu, Philippines", lng: 123.8854, lat: 10.3157 },
    { city: "Hong Kong", lng: 114.1694, lat: 22.3193 },
    { city: "Macau", lng: 113.5439, lat: 22.1987 },
    { city: "Taipei, Taiwan", lng: 121.5654, lat: 25.0330 },
    { city: "Seoul, South Korea", lng: 126.9780, lat: 37.5665 },
    { city: "Busan, South Korea", lng: 129.0756, lat: 35.1796 },
    { city: "Tokyo, Japan", lng: 139.6917, lat: 35.6895 },
    { city: "Osaka, Japan", lng: 135.5023, lat: 34.6937 },
    { city: "Nagoya, Japan", lng: 136.9066, lat: 35.1815 },
    { city: "Sapporo, Japan", lng: 141.3544, lat: 43.0618 },
    { city: "Beijing, China", lng: 116.4074, lat: 39.9042 },
    { city: "Shanghai, China", lng: 121.4737, lat: 31.2304 },
    { city: "Guangzhou, China", lng: 113.2644, lat: 23.1291 },
    { city: "Shenzhen, China", lng: 114.0579, lat: 22.5431 },
    { city: "Chengdu, China", lng: 104.0665, lat: 30.5728 },
    { city: "Xi'an, China", lng: 108.9398, lat: 34.3416 },
    { city: "Ulaanbaatar, Mongolia", lng: 106.9057, lat: 47.8864 },
    { city: "Almaty, Kazakhstan", lng: 76.8860, lat: 43.2389 },
    { city: "Bishkek, Kyrgyzstan", lng: 74.5698, lat: 42.8746 },
    { city: "Tashkent, Uzbekistan", lng: 69.2401, lat: 41.2995 },
    { city: "Astana, Kazakhstan", lng: 71.4704, lat: 51.1605 },
    { city: "Moscow, Russia", lng: 37.6173, lat: 55.7558 },
    { city: "Saint Petersburg, Russia", lng: 30.3351, lat: 59.9343 },
    { city: "Novosibirsk, Russia", lng: 82.9346, lat: 55.0084 },
    { city: "Yekaterinburg, Russia", lng: 60.5975, lat: 56.8389 },
    { city: "Perth, Australia", lng: 115.8575, lat: -31.9505 },
    { city: "Adelaide, Australia", lng: 138.6007, lat: -34.9285 },
    { city: "Melbourne, Australia", lng: 144.9631, lat: -37.8136 },
    { city: "Sydney, Australia", lng: 151.2093, lat: -33.8688 },
    { city: "Brisbane, Australia", lng: 153.0251, lat: -27.4698 },
    { city: "Hobart, Australia", lng: 147.3272, lat: -42.8821 },
    { city: "Auckland, New Zealand", lng: 174.7633, lat: -36.8485 },
    { city: "Wellington, New Zealand", lng: 174.7762, lat: -41.2865 },
    { city: "Christchurch, New Zealand", lng: 172.6362, lat: -43.5321 },
    { city: "Suva, Fiji", lng: 178.4419, lat: -18.1248 }
  ];
  const SINGLE_VENUE_POSTS = 400;
  const singleVenueSpecs = singleVenueBases.map(base => ({
    city: base.city,
    baseLng: base.lng,
    baseLat: base.lat,
    neighborhoods: buildNeighborhoods(base.city, base.lng, base.lat),
    generated: 0
  }));
  let singlePool = shufflePool(singleVenueSpecs.map((_, idx) => idx));
  let singlePoolIndex = 0;
  let singleProduced = 0;
  const SINGLE_ATTEMPT_MAX = SINGLE_VENUE_POSTS * 8;
  let singleAttempts = 0;
  while(singleProduced < SINGLE_VENUE_POSTS && singlePool.length && singleAttempts < SINGLE_ATTEMPT_MAX){
    if(singlePoolIndex >= singlePool.length){
      const available = singlePool.filter(idx => canAddCity(singleVenueSpecs[idx].city));
      singlePool = shufflePool(available);
      singlePoolIndex = 0;
      if(!singlePool.length){
        break;
      }
    }
    const specIndex = singlePool[singlePoolIndex++];
    const spec = singleVenueSpecs[specIndex];
    singleAttempts++;
    if(!spec || !canAddCity(spec.city)){
      continue;
    }
    const neighborhoods = spec.neighborhoods && spec.neighborhoods.length
      ? spec.neighborhoods
      : buildNeighborhoods(spec.city, spec.baseLng, spec.baseLat);
    const generation = spec.generated || 0;
    const venueIndex = generation % neighborhoods.length;
    const cycle = Math.floor(generation / neighborhoods.length) + 1;
    spec.generated = generation + 1;
    const basePoint = neighborhoods[venueIndex] || neighborhoods[0];
    let coords = jitterNeighborhoodPoint(basePoint);
    let key = coordKey(coords.lng, coords.lat);
    let coordAttempts = 0;
    while((!key || existingCoordKeys.has(key)) && coordAttempts < 20){
      coords = jitterNeighborhoodPoint(basePoint);
      key = coordKey(coords.lng, coords.lat);
      coordAttempts++;
    }
    if(!key || existingCoordKeys.has(key)){
      continue;
    }
    const venueName = `${spec.city} Solo Venue ${cycle}-${venueIndex + 1}`;
    const locationDetail = createRandomLocation(spec.city, coords.lng, coords.lat, {
      name: venueName,
      address: spec.city,
      radius: 0
    });
    const locations = [locationDetail];
    const finalKey = coordKey(locationDetail.lng, locationDetail.lat);
    if(finalKey){
      existingCoordKeys.add(finalKey);
    }
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = `SV${singleProduced}`;
    const title = `${id} ${uniqueTitle(singleProduced*48271+131, spec.city, singleProduced)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: spec.city,
      lng: locationDetail.lng,
      lat: locationDetail.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
    singleProduced++;
  }

  const MIN_MULTI_VENUE_DISTANCE_KM = 50;
  const MAX_MULTI_VENUE_DISTANCE_KM = 4000;
  const EARTH_RADIUS_KM = 6371;

  function toRadians(degrees){
    return (Number.isFinite(degrees) ? degrees : 0) * Math.PI / 180;
  }

  function haversineDistanceKm(a, b){
    if(!a || !b) return Infinity;
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const chord = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const clampChord = Math.min(1, Math.max(0, chord));
    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(clampChord), Math.sqrt(1 - clampChord));
  }

  function buildMultiVenuePool(){
    const cityLookup = singleVenueBases.reduce((acc, base)=>{
      if(!base || !base.city) return acc;
      if(Number.isFinite(base.lng) && Number.isFinite(base.lat)){
        acc[base.city] = { lng: base.lng, lat: base.lat };
      }
      return acc;
    }, Object.create(null));

    const MULTI_REGION_CITY_LISTS = [
      {
        region: 'North America',
        cityNames: [
          'Anchorage, USA',
          'Honolulu, USA',
          'San Francisco, USA',
          'Seattle, USA',
          'Vancouver, Canada',
          'Calgary, Canada',
          'Toronto, Canada',
          'Montreal, Canada',
          'Boston, USA',
          'New Orleans, USA',
          'Chicago, USA',
          'Miami, USA',
          'Dallas, USA',
          'Denver, USA',
          'Phoenix, USA',
          'Los Angeles, USA'
        ]
      },
      {
        region: 'Central & South America',
        cityNames: [
          'Mexico City, Mexico',
          'Guadalajara, Mexico',
          'Bogotá, Colombia',
          'Lima, Peru',
          'Quito, Ecuador',
          'Santiago, Chile',
          'Buenos Aires, Argentina',
          'Montevideo, Uruguay',
          'São Paulo, Brazil',
          'Rio de Janeiro, Brazil',
          'Brasília, Brazil',
          'Recife, Brazil',
          'Fortaleza, Brazil',
          'Caracas, Venezuela',
          'San Juan, Puerto Rico'
        ]
      },
      {
        region: 'Europe',
        cityNames: [
          'Reykjavík, Iceland',
          'Oslo, Norway',
          'Stockholm, Sweden',
          'Helsinki, Finland',
          'Copenhagen, Denmark',
          'Edinburgh, UK',
          'Dublin, Ireland',
          'Glasgow, UK',
          'London, UK',
          'Manchester, UK',
          'Paris, France',
          'Lyon, France',
          'Marseille, France',
          'Madrid, Spain',
          'Barcelona, Spain',
          'Valencia, Spain',
          'Lisbon, Portugal',
          'Berlin, Germany',
          'Hamburg, Germany',
          'Munich, Germany',
          'Frankfurt, Germany',
          'Prague, Czechia',
          'Vienna, Austria',
          'Zurich, Switzerland',
          'Warsaw, Poland',
          'Kraków, Poland',
          'Budapest, Hungary',
          'Bucharest, Romania',
          'Athens, Greece'
        ]
      },
      {
        region: 'Africa',
        cityNames: [
          'Cairo, Egypt',
          'Casablanca, Morocco',
          'Marrakesh, Morocco',
          'Algiers, Algeria',
          'Tunis, Tunisia',
          'Tripoli, Libya',
          'Khartoum, Sudan',
          'Addis Ababa, Ethiopia',
          'Nairobi, Kenya',
          'Kampala, Uganda',
          'Dar es Salaam, Tanzania',
          'Kigali, Rwanda',
          'Lagos, Nigeria',
          'Accra, Ghana',
          "Abidjan, Côte d'Ivoire",
          'Dakar, Senegal',
          'Kinshasa, DR Congo',
          'Luanda, Angola',
          'Johannesburg, South Africa',
          'Cape Town, South Africa',
          'Windhoek, Namibia',
          'Gaborone, Botswana',
          'Harare, Zimbabwe',
          'Maputo, Mozambique'
        ]
      },
      {
        region: 'Middle East',
        cityNames: [
          'Riyadh, Saudi Arabia',
          'Jeddah, Saudi Arabia',
          'Doha, Qatar',
          'Dubai, UAE',
          'Muscat, Oman',
          'Kuwait City, Kuwait',
          'Manama, Bahrain',
          'Tehran, Iran',
          'Baghdad, Iraq',
          'Amman, Jordan',
          'Beirut, Lebanon',
          'Jerusalem'
        ]
      },
      {
        region: 'Asia',
        cityNames: [
          'Mumbai, India',
          'Delhi, India',
          'Bengaluru, India',
          'Hyderabad, India',
          'Chennai, India',
          'Kolkata, India',
          'Kathmandu, Nepal',
          'Dhaka, Bangladesh',
          'Colombo, Sri Lanka',
          'Bangkok, Thailand',
          'Chiang Mai, Thailand',
          'Vientiane, Laos',
          'Phnom Penh, Cambodia',
          'Ho Chi Minh City, Vietnam',
          'Hanoi, Vietnam',
          'Yangon, Myanmar',
          'Singapore',
          'Kuala Lumpur, Malaysia',
          'Jakarta, Indonesia',
          'Surabaya, Indonesia',
          'Manila, Philippines',
          'Cebu, Philippines',
          'Hong Kong',
          'Macau',
          'Taipei, Taiwan',
          'Seoul, South Korea',
          'Busan, South Korea',
          'Tokyo, Japan',
          'Osaka, Japan',
          'Nagoya, Japan',
          'Sapporo, Japan',
          'Beijing, China',
          'Shanghai, China',
          'Guangzhou, China',
          'Shenzhen, China',
          'Chengdu, China',
          "Xi'an, China",
          'Ulaanbaatar, Mongolia',
          'Almaty, Kazakhstan',
          'Bishkek, Kyrgyzstan',
          'Tashkent, Uzbekistan',
          'Astana, Kazakhstan',
          'Moscow, Russia',
          'Saint Petersburg, Russia',
          'Novosibirsk, Russia',
          'Yekaterinburg, Russia'
        ]
      },
      {
        region: 'Oceania',
        cityNames: [
          'Perth, Australia',
          'Adelaide, Australia',
          'Melbourne, Australia',
          'Sydney, Australia',
          'Brisbane, Australia',
          'Hobart, Australia',
          'Auckland, New Zealand',
          'Wellington, New Zealand',
          'Christchurch, New Zealand',
          'Suva, Fiji'
        ]
      }
    ];

    const deterministicOffset = (label, axis)=>{
      let hash = 0;
      for(let i = 0; i < label.length; i++){
        const charCode = label.charCodeAt(i);
        hash = (hash * 33 + charCode + (axis + 1) * 131) & 0xffffffff;
      }
      const normalized = ((hash % 2001) / 2000) - 0.5;
      return normalized * 0.002;
    };

    const pool = [];
    const seen = new Set();

    MULTI_REGION_CITY_LISTS.forEach(spec => {
      if(!spec || !spec.region || !Array.isArray(spec.cityNames)) return;
      spec.cityNames.forEach(cityName => {
        if(!cityName) return;
        const base = cityLookup[cityName];
        if(!base) return;
        const label = `${spec.region}:${cityName}`;
        let lng = normalizeLongitude(base.lng + deterministicOffset(label, 0));
        let lat = clampLatitude(base.lat + deterministicOffset(label, 1));
        let key = toVenueCoordKey(lng, lat);
        if(!key || seen.has(key)){
          let attempts = 0;
          let adjustment = 0.0003;
          while(attempts < 5 && key && seen.has(key)){
            const delta = adjustment * (attempts % 2 === 0 ? 1 : -1);
            lng = normalizeLongitude(base.lng + delta);
            lat = clampLatitude(base.lat + delta);
            key = toVenueCoordKey(lng, lat);
            attempts++;
            adjustment += 0.0001;
          }
          if((!key || seen.has(key)) && toVenueCoordKey(base.lng, base.lat) && !seen.has(toVenueCoordKey(base.lng, base.lat))){
            lng = normalizeLongitude(base.lng);
            lat = clampLatitude(base.lat);
            key = toVenueCoordKey(lng, lat);
          }
        }
        if(!key || seen.has(key)){
          return;
        }
        seen.add(key);
        pool.push({
          city: cityName,
          region: spec.region,
          lng,
          lat
        });
      });
    });
    return pool;
  }

  function shuffledIndices(length){
    const indices = Array.from({ length }, (_, idx) => idx);
    for(let i = indices.length - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    return indices;
  }

  function assignMultiVenues(postList, targetCount){
    if(!Array.isArray(postList) || !postList.length || targetCount <= 0){
      return 0;
    }
    const pool = buildMultiVenuePool();
    if(pool.length < 2){
      return 0;
    }
    const venuesByRegion = pool.reduce((acc, venue) => {
      if(!venue) return acc;
      const key = venue.region || 'Global';
      if(!acc[key]) acc[key] = [];
      acc[key].push(venue);
      return acc;
    }, Object.create(null));
    const regionKeys = Object.keys(venuesByRegion).filter(key => Array.isArray(venuesByRegion[key]) && venuesByRegion[key].length >= 2);
    if(!regionKeys.length){
      return 0;
    }
    const sampleVenueSet = (regionKey, desiredCount)=>{
      const candidates = venuesByRegion[regionKey];
      if(!Array.isArray(candidates) || candidates.length < desiredCount){
        return null;
      }
      const maxAttempts = Math.max(20, candidates.length);
      for(let attempt = 0; attempt < maxAttempts; attempt++){
        const order = shuffledIndices(candidates.length);
        const selection = [];
        const used = new Set();
        for(let i = 0; i < order.length && selection.length < desiredCount; i++){
          const candidate = candidates[order[i]];
          if(!candidate) continue;
          const key = toVenueCoordKey(candidate.lng, candidate.lat);
          if(!key || used.has(key)) continue;
          let ok = true;
          for(let s = 0; s < selection.length; s++){
            const existing = selection[s];
            const distance = haversineDistanceKm(existing, candidate);
            if(distance < MIN_MULTI_VENUE_DISTANCE_KM || distance > MAX_MULTI_VENUE_DISTANCE_KM){
              ok = false;
              break;
            }
          }
          if(ok){
            selection.push(candidate);
            used.add(key);
          }
        }
        if(selection.length === desiredCount){
          return selection;
        }
      }
      return null;
    };
    const indices = shuffledIndices(postList.length);
    let assigned = 0;
    for(let idx = 0; idx < indices.length && assigned < targetCount; idx++){
      const post = postList[indices[idx]];
      if(!post){
        continue;
      }
      const desiredBase = 2 + Math.floor(rnd() * 3);
      let desired = desiredBase;
      let venues = null;
      let attempts = 0;
      while(attempts < 60 && !venues){
        const regionKey = regionKeys[Math.floor(rnd() * regionKeys.length)];
        venues = sampleVenueSet(regionKey, desired);
        if(!venues){
          attempts++;
          if(attempts % 10 === 0 && desired > 2){
            desired--;
          }
        }
      }
      if(!venues || venues.length < 2){
        for(let r = 0; r < regionKeys.length && (!venues || venues.length < 2); r++){
          venues = sampleVenueSet(regionKeys[r], 2);
        }
      }
      if(!venues || venues.length < 2){
        continue;
      }
      const nextLocations = venues.map((venue, venueIdx) => {
        const cityLabel = venue.city;
        const venueLabel = `${cityLabel} · Spot ${venueIdx + 1}`;
        return {
          venue: venueLabel,
          address: cityLabel,
          lng: venue.lng,
          lat: venue.lat,
          dates: randomSchedule(),
          price: randomPriceRange()
        };
      });
      post.locations = nextLocations;
      post.dates = derivePostDatesFromLocations(nextLocations);
      const primary = nextLocations[0];
      if(primary){
        post.lng = primary.lng;
        post.lat = primary.lat;
        post.city = primary.address || primary.venue || post.city;
      }
      assigned++;
    }
    return assigned;
  }

  assignMultiVenues(out, 1000);

  out.forEach(post => {
    if(!post) return;
    if(Array.isArray(post.locations) && post.locations.length){
      post.dates = derivePostDatesFromLocations(post.locations);
    } else if(Array.isArray(post.dates)){
      post.dates = post.dates.slice().sort();
    } else {
      post.dates = [];
    }
  });

  return out;
}

    let ALL_POSTS_CACHE = null;
    let ALL_POSTS_BY_ID = null;
    function rebuildAllPostsIndex(cache){
      if(!Array.isArray(cache)){
        ALL_POSTS_BY_ID = null;
        return;
      }
      const map = new Map();
      cache.forEach(item => {
        if(!item || item.id === undefined || item.id === null) return;
        map.set(String(item.id), item);
      });
      ALL_POSTS_BY_ID = map;
    }
    function getAllPostsCache(options = {}){
      const { allowInitialize = true } = options;
      if(Array.isArray(ALL_POSTS_CACHE)){
        return ALL_POSTS_CACHE;
      }
      if(!allowInitialize){
        return null;
      }
      ALL_POSTS_CACHE = makePosts();
      rebuildAllPostsIndex(ALL_POSTS_CACHE);
      return ALL_POSTS_CACHE;
    }
    function getPostByIdAnywhere(id){
      if(id === undefined || id === null) return null;
      const normalizedId = String(id);
      const checkList = (list) => {
        if(!Array.isArray(list)) return null;
        return list.find(entry => entry && String(entry.id) === normalizedId) || null;
      };
      const loaded = checkList(posts);
      if(loaded) return loaded;
      if(!ALL_POSTS_BY_ID || !(ALL_POSTS_BY_ID instanceof Map)){
        const cache = getAllPostsCache({ allowInitialize: true });
        if(Array.isArray(cache)){
          rebuildAllPostsIndex(cache);
        }
      }
      return ALL_POSTS_BY_ID instanceof Map ? (ALL_POSTS_BY_ID.get(normalizedId) || null) : null;
    }
    const EMPTY_FEATURE_COLLECTION = { type:'FeatureCollection', features: [] };

    const markerDataCache = {
      signature: null,
      postsData: EMPTY_FEATURE_COLLECTION,
      featureIndex: new Map()
    };

    function invalidateMarkerDataCache(){
      markerDataCache.signature = null;
      markerDataCache.postsData = EMPTY_FEATURE_COLLECTION;
      markerDataCache.featureIndex = new Map();
    }

    function markerSignatureForList(list){
      if(!Array.isArray(list) || !list.length){
        return 'empty';
      }
      const parts = [];
      list.forEach(post => {
        if(!post) return;
        const baseId = post.id || '';
        let added = false;
        if(Array.isArray(post.locations) && post.locations.length){
          post.locations.forEach((loc, idx) => {
            if(!loc) return;
            const key = toVenueCoordKey(loc.lng, loc.lat);
            if(!key) return;
            parts.push(`${baseId}#${idx}:${key}`);
            added = true;
          });
        }
        if(!added){
          const key = toVenueCoordKey(post.lng, post.lat);
          if(key){
            parts.push(`${baseId}:${key}`);
          } else {
            parts.push(String(baseId));
          }
        }
      });
      parts.sort();
      return parts.join('|');
    }

    function buildMarkerFeatureIndex(postsData){
      const index = new Map();
      const features = Array.isArray(postsData?.features) ? postsData.features : [];
      features.forEach(feature => {
        if(!feature || !feature.properties) return;
        const props = feature.properties;
        const baseId = props.id;
        if(baseId === undefined || baseId === null) return;
        const fid = feature.id ?? props.featureId;
        if(fid === undefined || fid === null) return;
        let venueKey = '';
        if(props.venueKey !== undefined && props.venueKey !== null){
          const venueString = String(props.venueKey).trim();
          venueKey = venueString;
        } else if(typeof fid === 'string'){
          const parts = fid.split('::');
          if(parts.length >= 3){
            venueKey = String(parts[1] || '');
          }
        }
        const rawSpriteId = props.labelSpriteId ?? props.spriteId ?? '';
        const spriteId = rawSpriteId !== undefined && rawSpriteId !== null ? String(rawSpriteId) : '';
        const ids = new Set();
        ids.add(String(baseId));
        if(Array.isArray(props.multiPostIds)){
          props.multiPostIds.forEach(postId => {
            if(postId === undefined || postId === null) return;
            const strId = String(postId);
            if(strId) ids.add(strId);
          });
        }
        ids.forEach(idValue => {
          if(!index.has(idValue)){
            index.set(idValue, []);
          }
          index.get(idValue).push({ source: 'posts', id: fid, venueKey, spriteId });
        });
      });
      return index;
    }

    function getMarkerCollections(list){
      const signature = markerSignatureForList(list);
      if(markerDataCache.signature === signature && markerDataCache.postsData){
        return {
          postsData: markerDataCache.postsData,
          signature,
          changed: false,
          featureIndex: markerDataCache.featureIndex
        };
      }
      if(!Array.isArray(list) || !list.length){
        markerDataCache.signature = signature;
        markerDataCache.postsData = EMPTY_FEATURE_COLLECTION;
        markerDataCache.featureIndex = new Map();
        return {
          postsData: EMPTY_FEATURE_COLLECTION,
          signature,
          changed: true,
          featureIndex: markerDataCache.featureIndex
        };
      }
      const postsData = postsToGeoJSON(list);
      markerDataCache.signature = signature;
      markerDataCache.postsData = postsData;
      markerDataCache.featureIndex = buildMarkerFeatureIndex(postsData);
      return { postsData, signature, changed: true, featureIndex: markerDataCache.featureIndex };
    }

    function prepareMarkerLabelCompositesForPosts(postsData){
      const enforceBudget = () => {
        if(typeof enforceMarkerLabelCompositeBudget === 'function' && map){
          try{ enforceMarkerLabelCompositeBudget(map); }catch(err){}
        }
      };
      if(!map || typeof ensureMarkerLabelComposite !== 'function'){
        enforceBudget();
        return Promise.resolve();
      }
      const features = Array.isArray(postsData?.features) ? postsData.features : [];
      if(!features.length){
        enforceBudget();
        return Promise.resolve();
      }
      const spriteMeta = new Map();
      const zoomLevel = typeof map.getZoom === 'function' ? Number(map.getZoom()) : NaN;
      const zoomEligible = Number.isFinite(zoomLevel) && zoomLevel >= 8;
      const rawBounds = zoomEligible && typeof map.getBounds === 'function' ? normalizeBounds(map.getBounds()) : null;
      const priorityBounds = rawBounds ? expandBounds(rawBounds, { lat: 0.35, lng: 0.35 }) : null;
      const highlightedPostIdSet = new Set();
      (Array.isArray(lastHighlightedPostIds) ? lastHighlightedPostIds : []).forEach(entry => {
        if(!entry) return;
        const rawId = entry.id ?? entry.postId ?? entry.postID ?? entry.postid;
        if(rawId === undefined || rawId === null) return;
        const strId = String(rawId);
        if(strId){
          highlightedPostIdSet.add(strId);
        }
      });
      const usageTimestamp = nowTimestamp();
      features.forEach(feature => {
        if(!feature || !feature.properties) return;
        const props = feature.properties;
        const spriteId = props.labelSpriteId;
        if(!spriteId || spriteMeta.has(spriteId)) return;
        const coords = Array.isArray(feature.geometry && feature.geometry.coordinates)
          ? feature.geometry.coordinates
          : null;
        let inView = false;
        if(zoomEligible && coords && coords.length >= 2 && priorityBounds){
          const [lng, lat] = coords;
          if(Number.isFinite(lng) && Number.isFinite(lat)){
            inView = pointWithinBounds(lng, lat, priorityBounds);
          }
        }
        const existing = markerLabelCompositeStore.get(spriteId) || {};
        const iconId = props.sub || props.baseSub || '';
        const labelLine1 = props.labelLine1 || '';
        const labelLine2 = props.labelLine2 || '';
        const multiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
        const isMulti = Boolean(props.isMultiVenue || (props.multiCount && Number(props.multiCount) > 1) || multiIds.length > 1);
        const isHighlighted = (() => {
          const ownId = props.id !== undefined && props.id !== null ? String(props.id) : '';
          if(ownId && highlightedPostIdSet.has(ownId)){
            return true;
          }
          return multiIds.some(mid => {
            if(mid === undefined || mid === null) return false;
            return highlightedPostIdSet.has(String(mid));
          });
        })();
        const priority = Boolean(inView || isHighlighted);
        let lastUsed = Number.isFinite(existing.lastUsed) ? existing.lastUsed : 0;
        if(priority){
          lastUsed = usageTimestamp;
        }
        const updatedMeta = Object.assign({}, existing, {
          iconId,
          labelLine1,
          labelLine2,
          isMulti,
          priority,
          lastUsed,
          inView
        });
        markerLabelCompositeStore.set(spriteId, updatedMeta);
        spriteMeta.set(spriteId, {
          iconId,
          labelLine1,
          labelLine2,
          isMulti,
          priority,
          lastUsed,
          inView
        });
      });
      const spriteEntries = Array.from(spriteMeta.entries());
      const compareEntries = (a, b) => {
        const aMeta = a[1] || {};
        const bMeta = b[1] || {};
        const aPriority = aMeta.priority ? 1 : 0;
        const bPriority = bMeta.priority ? 1 : 0;
        if(aPriority !== bPriority){
          return bPriority - aPriority;
        }
        const aLast = Number.isFinite(aMeta.lastUsed) ? aMeta.lastUsed : 0;
        const bLast = Number.isFinite(bMeta.lastUsed) ? bMeta.lastUsed : 0;
        if(aLast !== bLast){
          return bLast - aLast;
        }
        return String(a[0]).localeCompare(String(b[0]));
      };
      spriteEntries.sort(compareEntries);
      const compositeSafetyBuffer = 25;
      let eagerSpriteEntries = [];
      if(zoomEligible){
        eagerSpriteEntries = spriteEntries.filter(([, meta]) => meta && (meta.inView || meta.priority));
        if(Number.isFinite(MARKER_LABEL_COMPOSITE_LIMIT) && MARKER_LABEL_COMPOSITE_LIMIT > 0){
          const maxEager = Math.max(0, MARKER_LABEL_COMPOSITE_LIMIT - Math.max(0, compositeSafetyBuffer));
          if(maxEager <= 0){
            eagerSpriteEntries = [];
          } else if(eagerSpriteEntries.length > maxEager){
            eagerSpriteEntries = eagerSpriteEntries.slice(0, maxEager);
          }
        }
      }
      const tasks = eagerSpriteEntries.map(([spriteId, meta]) =>
        ensureMarkerLabelComposite(
          map,
          spriteId,
          meta.iconId,
          meta.labelLine1,
          meta.labelLine2,
          meta.isMulti,
          { priority: meta.priority }
        ).catch(()=>{})
      );
      return Promise.all(tasks).then(() => {
        enforceBudget();
      });
    }

    async function syncMarkerSources(list, options = {}){
      const { force = false } = options;
      const collections = getMarkerCollections(list);
      const { postsData, signature, featureIndex } = collections;
      markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      let preparationPromise = null;
      let preparationErrorLogged = false;
      const ensurePreparationPromise = () => {
        if(!preparationPromise){
          preparationPromise = prepareMarkerLabelCompositesForPosts(postsData);
        }
        return preparationPromise;
      };
      const awaitPreparation = async () => {
        try{
          await ensurePreparationPromise();
          return true;
        }catch(err){
          if(!preparationErrorLogged){
            preparationErrorLogged = true;
            console.error(err);
          }
          return false;
        }
      };
      let preparationReady = false;
      let updated = false;
      if(map && typeof map.getSource === 'function'){
        const postsSource = map.getSource('posts');
        if(postsSource && (force || postsSource.__markerSignature !== signature)){
          preparationReady = await awaitPreparation();
          if(preparationReady){
            try{ postsSource.setData(postsData); }catch(err){ console.error(err); }
            postsSource.__markerSignature = signature;
            updated = true;
          }
        }
      }
      if(updated || force){
        if(!preparationReady){
          preparationReady = await awaitPreparation();
        }
        ensurePreparationPromise().catch(()=>{});
        updateMapFeatureHighlights(lastHighlightedPostIds);
      }
      return { updated, signature };
    }

    let postsLoaded = false;
    window.postsLoaded = postsLoaded;
    let waitForInitialZoom = window.waitForInitialZoom ?? (firstVisit ? true : false);
    let initialZoomStarted = false;
    let postLoadRequested = false;
    let lastLoadedBoundsKey = null;
    window.waitForInitialZoom = waitForInitialZoom;
    let updatePostsButtonState = () => {};

    function boundsToKey(bounds, precision = 2){
      if(!bounds) return '';
      const west = typeof bounds.getWest === 'function' ? bounds.getWest() : bounds.west;
      const east = typeof bounds.getEast === 'function' ? bounds.getEast() : bounds.east;
      const south = typeof bounds.getSouth === 'function' ? bounds.getSouth() : bounds.south;
      const north = typeof bounds.getNorth === 'function' ? bounds.getNorth() : bounds.north;
      const fmt = (val) => Number.isFinite(val) ? val.toFixed(precision) : 'nan';
      return [west, south, east, north].map(fmt).join('|');
    }

    function normalizeBounds(bounds){
      if(!bounds) return null;
      if(typeof bounds.getWest === 'function'){
        return {
          west: bounds.getWest(),
          east: bounds.getEast(),
          south: bounds.getSouth(),
          north: bounds.getNorth()
        };
      }
      const { west, east, south, north } = bounds;
      if(!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)){
        return null;
      }
      return { west, east, south, north };
    }

    function expandBounds(bounds, padding = {}){
      const normalized = normalizeBounds(bounds);
      if(!normalized) return null;
      let latPad;
      let lngPad;
      if(typeof padding === 'number'){
        latPad = lngPad = padding;
      } else {
        const latCandidate = padding.lat ?? padding.latitude ?? padding.y ?? padding.vertical;
        const lngCandidate = padding.lng ?? padding.longitude ?? padding.x ?? padding.horizontal;
        latPad = Number.isFinite(latCandidate) ? latCandidate : 0.25;
        lngPad = Number.isFinite(lngCandidate) ? lngCandidate : 0.25;
      }
      latPad = Math.max(0, latPad);
      lngPad = Math.max(0, lngPad);
      let { west, east, south, north } = normalized;
      west = Math.max(-180, west - lngPad);
      east = Math.min(180, east + lngPad);
      const clampLat = (value) => Math.max(-85, Math.min(85, value));
      south = clampLat(south - latPad);
      north = clampLat(north + latPad);
      return { west, east, south, north };
    }

    function pointWithinBounds(lng, lat, bounds){
      if(!Number.isFinite(lng) || !Number.isFinite(lat) || !bounds){
        return false;
      }
      const { west, east, south, north } = bounds;
      if(!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)){
        return false;
      }
      const withinLat = lat >= Math.min(south, north) && lat <= Math.max(south, north);
      if(!withinLat) return false;
      if(west <= east){
        return lng >= west && lng <= east;
      }
      return lng >= west || lng <= east;
    }

    function clearLoadedPosts(){
      invalidateMarkerDataCache();
      if(postsLoaded){
        postsLoaded = false;
        window.postsLoaded = postsLoaded;
      }
      lastLoadedBoundsKey = null;
      posts = [];
      filtered = [];
      if(typeof sortedPostList !== 'undefined'){ sortedPostList = []; }
      if(typeof renderedPostCount !== 'undefined'){ renderedPostCount = 0; }
      if(typeof postBatchObserver !== 'undefined' && postBatchObserver){
        try{ postBatchObserver.disconnect(); }catch(err){}
        postBatchObserver = null;
      }
      if(typeof postSentinel !== 'undefined' && postSentinel && postSentinel.remove){
        postSentinel.remove();
        postSentinel = null;
      }
      if(typeof adTimer !== 'undefined' && adTimer){
        clearInterval(adTimer);
        adTimer = null;
      }
      if(typeof adPosts !== 'undefined'){ adPosts = []; }
      if(typeof adIdsKey !== 'undefined'){ adIdsKey = ''; }
      const adPanelEl = typeof document !== 'undefined' ? document.querySelector('.ad-panel') : null;
      if(adPanelEl){ adPanelEl.innerHTML = ''; }
      const resultsElLocal = $('#results');
      if(resultsElLocal){ resultsElLocal.innerHTML = ''; }
      const postsBoardEl = $('.post-board');
      if(postsBoardEl){ postsBoardEl.innerHTML = ''; }
      hideResultIndicators();
      if(typeof updateResetBtn === 'function'){ updateResetBtn(); }
      if(map){
        const postsSource = map.getSource && map.getSource('posts');
        if(postsSource && typeof postsSource.setData === 'function'){
          postsSource.setData(EMPTY_FEATURE_COLLECTION);
          postsSource.__markerSignature = null;
        }
      }
      updateLayerVisibility(lastKnownZoom);
    }

    function loadPosts(bounds){
      if(spinning){
        pendingPostLoad = true;
        return;
      }
      const normalized = normalizeBounds(bounds);
      if(!normalized){
        postLoadRequested = true;
        hideResultIndicators();
        return;
      }
      const key = boundsToKey(normalized);
      if(postsLoaded && lastLoadedBoundsKey === key){
        applyFilters();
        return;
      }
      const cache = getAllPostsCache();
      const nextPosts = Array.isArray(cache)
        ? cache.filter(p => pointWithinBounds(p.lng, p.lat, normalized))
        : [];
      posts = nextPosts;
      postsLoaded = true;
      window.postsLoaded = postsLoaded;
      lastLoadedBoundsKey = key;
      rebuildVenueIndex();
      invalidateMarkerDataCache();
      resetBalloonSourceState();
      if(markersLoaded && map && Object.keys(subcategoryMarkers).length){ addPostSource(); }
      initAdBoard();
      applyFilters();
      updateLayerVisibility(lastKnownZoom);
    }

    let markerLayersVisible = false;
    let pendingZoomCheckToken = null;
    let pendingZoomEvent = null;

    function getZoomFromEvent(event){
      if(event){
        if(typeof event.zoom === 'number'){ return event.zoom; }
        const target = event.target && typeof event.target.getZoom === 'function' ? event.target : null;
        if(target){
          try{ return target.getZoom(); }catch(err){ return NaN; }
        }
      }
      if(map && typeof map.getZoom === 'function'){
        try{ return map.getZoom(); }catch(err){ return NaN; }
      }
      return NaN;
    }

    function setLayerVisibility(id, visible){
      if(!map || typeof map.getLayer !== 'function') return;
      let layer = null;
      try{ layer = map.getLayer(id); }catch(err){ layer = null; }
      if(!layer) return;
      const desired = visible ? 'visible' : 'none';
      try{
        const current = map.getLayoutProperty(id, 'visibility');
        if(current !== desired){
          map.setLayoutProperty(id, 'visibility', desired);
        }
      }catch(err){
        try{ map.setLayoutProperty(id, 'visibility', desired); }catch(e){}
      }
    }

    function updateMarkerZoomClasses(zoom){
      if(!map || typeof map.getContainer !== 'function') return;
      const container = map.getContainer();
      if(!container || !container.classList) return;
      const zoomValue = Number.isFinite(zoom) ? zoom : getZoomFromEvent();
      const isMidZoom = Number.isFinite(zoomValue) && zoomValue >= MARKER_ZOOM_THRESHOLD && zoomValue < MARKER_SPRITE_ZOOM;
      const isSpriteZoom = Number.isFinite(zoomValue) && zoomValue >= MARKER_SPRITE_ZOOM;
      container.classList.toggle(MID_ZOOM_MARKER_CLASS, isMidZoom);
      container.classList.toggle(SPRITE_MARKER_CLASS, isSpriteZoom);
    }

    function updateLayerVisibility(zoom){
      const zoomValue = Number.isFinite(zoom) ? zoom : getZoomFromEvent();
      const zoomBucket = Number.isFinite(zoomValue)
        ? Math.floor((zoomValue + 1e-6) * ZOOM_VISIBILITY_PRECISION)
        : NaN;
      const hasBucket = Number.isFinite(zoomBucket);
      const shouldShowMarkers = hasBucket ? zoomBucket >= MARKER_VISIBILITY_BUCKET : markerLayersVisible;
      const shouldShowBalloons = hasBucket ? zoomBucket < MARKER_VISIBILITY_BUCKET : balloonLayersVisible;
      if(markerLayersVisible !== shouldShowMarkers){
        MARKER_LAYER_IDS.forEach(id => setLayerVisibility(id, shouldShowMarkers));
        markerLayersVisible = shouldShowMarkers;
      }
      if(balloonLayersVisible !== shouldShowBalloons){
        BALLOON_LAYER_IDS.forEach(id => setLayerVisibility(id, shouldShowBalloons));
        balloonLayersVisible = shouldShowBalloons;
      }
      if(shouldShowBalloons && Number.isFinite(zoomValue)){
        updateBalloonSourceForZoom(zoomValue);
      }
    }

    function updateZoomState(zoom){
      if(Number.isFinite(zoom)){
        lastKnownZoom = zoom;
      } else {
        const current = getZoomFromEvent();
        if(Number.isFinite(current)){
          lastKnownZoom = current;
        }
      }
      updatePostsButtonState(lastKnownZoom);
      updateLayerVisibility(lastKnownZoom);
      updateMarkerZoomClasses(lastKnownZoom);
      updateBalloonSourceForZoom(lastKnownZoom);
      if(map && Number.isFinite(lastKnownZoom) && lastKnownZoom >= MARKER_SPRITE_ZOOM){
        map.__retainAllMarkerSprites = true;
      }
      if(!markersLoaded){
        const preloadCandidate = Number.isFinite(lastKnownZoom) ? lastKnownZoom : getZoomFromEvent();
        if(Number.isFinite(preloadCandidate) && preloadCandidate >= MARKER_PRELOAD_ZOOM){
          try{ loadPostMarkers(); }catch(err){ console.error(err); }
          markersLoaded = true;
          window.__markersLoaded = true;
        }
      }
    }

    function scheduleCheckLoadPosts(event){
      pendingZoomEvent = event || { zoom: lastKnownZoom, target: map };
      if(pendingZoomCheckToken !== null) return;
      const scheduler = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb)=> setTimeout(cb, 0);
      pendingZoomCheckToken = scheduler(()=>{
        pendingZoomCheckToken = null;
        const evt = pendingZoomEvent;
        pendingZoomEvent = null;
        checkLoadPosts(evt);
      });
    }

    function checkLoadPosts(event){
      if(!map) return;
      const zoomCandidate = getZoomFromEvent(event);
      updateZoomState(zoomCandidate);
      let zoomLevel = Number.isFinite(zoomCandidate) ? zoomCandidate : lastKnownZoom;
      if(!Number.isFinite(zoomLevel)){
        zoomLevel = getZoomFromEvent();
      }
      if(waitForInitialZoom){
        if(Number.isFinite(zoomLevel) && zoomLevel >= MARKER_PRELOAD_ZOOM){
          waitForInitialZoom = false;
          window.waitForInitialZoom = waitForInitialZoom;
          initialZoomStarted = false;
        } else {
          postLoadRequested = true;
          hideResultIndicators();
          return;
        }
      }
      if(!Number.isFinite(zoomLevel)){
        postLoadRequested = true;
        hideResultIndicators();
        return;
      }
      updatePostsButtonState(zoomLevel);
      if(Number.isFinite(zoomLevel) && zoomLevel < MARKER_PRELOAD_ZOOM){
        postLoadRequested = true;
        if(postsLoaded || (Array.isArray(posts) && posts.length)){ clearLoadedPosts(); }
        hideResultIndicators();
        return;
      }
      if(spinning){
        pendingPostLoad = true;
        hideResultIndicators();
        return;
      }
      postLoadRequested = false;
      const bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
      if(!bounds){
        postLoadRequested = true;
        hideResultIndicators();
        return;
      }
      loadPosts(bounds);
    }

    const resultsEl = $('#results');
    const postsWideEl = $('.post-board');
    const postsModeEl = $('.post-board');

    let sortedPostList = [];
    let renderedPostCount = 0;
    let postBatchObserver = null;
    let postSentinel = null;
    let postBoardScrollOptions = null;
    const INITIAL_RENDER_COUNT = 50;
    const POST_BATCH_SIZE = 25;

    function appendPostBatch(count = POST_BATCH_SIZE){
      const slice = sortedPostList.slice(renderedPostCount, renderedPostCount + count);
      slice.forEach(p => {
        if(resultsEl){
          const rCard = card(p);
          if(activePostId && p.id === activePostId) rCard.setAttribute('aria-selected','true');
          resultsEl.appendChild(rCard);
        }
        const wCard = card(p, true);
        postsWideEl.insertBefore(wCard, postSentinel);
      });
      renderedPostCount += slice.length;
      if(renderedPostCount >= sortedPostList.length){
        if(postBatchObserver) postBatchObserver.disconnect();
        removeScrollListener(postsWideEl, onPostBoardScroll, postBoardScrollOptions);
        postBoardScrollOptions = null;
      }
      prioritizeVisibleImages();
    }

    function onPostBoardScroll(){
      if(postsWideEl.scrollTop + postsWideEl.clientHeight >= postsWideEl.scrollHeight - 200){
        appendPostBatch();
      }
    }

    // Image helpers (reuse shared utilities)

    function memberAvatarUrl(p){
      if(p.member && p.member.avatar){
        return p.member.avatar;
      }
      return 'assets/balloons/birthday-party-png-45917-100.png';
    }

    function mapCardHTML(p, opts={}){
      const overrideKey = typeof opts.venueKey === 'string' && opts.venueKey ? opts.venueKey : null;
      const prevKey = selectedVenueKey;
      if(overrideKey){
        selectedVenueKey = overrideKey;
      }
      try{
        const venueName = getPrimaryVenueName(p) || p.city;
        const labelLines = getMarkerLabelLines(p);
        const cardTitleLines = Array.isArray(labelLines.cardTitleLines) && labelLines.cardTitleLines.length
          ? labelLines.cardTitleLines.slice(0, 2)
          : [labelLines.line1, labelLines.line2].filter(Boolean).slice(0, 2);
        const normalizedTitleLines = cardTitleLines.slice(0, 2);
        const firstTitleLine = normalizedTitleLines[0] || '';
        const hasSecondTitleLine = Boolean((normalizedTitleLines[1] || '').trim());
        const displayTitleLines = hasSecondTitleLine ? normalizedTitleLines : [firstTitleLine];
        const titleHtml = displayTitleLines
          .map(line => `<div class="map-card-title-line">${line}</div>`)
          .join('');
        const venueLine = labelLines.venueLine || shortenMarkerLabelText(venueName, mapCardTitleWidthPx);
        const venueHtml = venueLine ? `<div class="map-card-venue">${venueLine}</div>` : '';
        const labelClasses = ['map-card-label'];
        if(!hasSecondTitleLine){
          labelClasses.push('map-card-label--single-line');
        }
        const labelHtml = `<div class="${labelClasses.join(' ')}"><div class="map-card-title">${titleHtml}</div>${venueHtml}</div>`;
        const classes = ['big-map-card'];
        const extraClasses = Array.isArray(opts.extraClasses) ? opts.extraClasses : (opts.extraClass ? [opts.extraClass] : []);
        const variant = opts.variant || 'popup';
        if(variant === 'popup') classes.push('big-map-card--popup');
        if(variant === 'list') classes.push('big-map-card--list');
        extraClasses.filter(Boolean).forEach(cls => classes.push(cls));
        if(variant === 'list'){
          return `<div class="${classes.join(' ')}" data-id="${p.id}"><img class="map-card-thumb" src="${thumbUrl(p)}" alt="" referrerpolicy="no-referrer" />${labelHtml}</div>`;
        }
        return `<div class="${classes.join(' ')}" data-id="${p.id}"><img class="map-card-pill" src="assets/icons-30/225x60-pill-99.webp" alt="" /><img class="map-card-thumb" src="${thumbUrl(p)}" alt="" referrerpolicy="no-referrer" />${labelHtml}</div>`;
      } finally {
        if(overrideKey){
          selectedVenueKey = prevKey;
        }
      }
    }

    function hoverHTML(p){
      return mapCardHTML(p);
    }

    // Categories UI
    const categoryControllers = {};
    const allSubcategoryKeys = [];
    const resetCategoriesBtn = $('#resetCategoriesBtn');
    const catsEl = $('#cats');
    const formbuilderCats = document.getElementById('formbuilderCats');
    const formbuilderAddCategoryBtn = document.getElementById('formbuilderAddCategory');
    let formbuilderConfirmOverlay = null;
    let categoryDragContainerInitialized = false;
    let draggedCategoryMenu = null;
    let categoryDropIndicatorTarget = null;
    let categoryDropIndicatorClass = '';
    let categoryDropIndicatorBefore = null;
    let categoryDropCommitted = false;
    let draggedSubcategoryMenu = null;
    let draggedSubcategoryContainer = null;
    const subcategoryContainerState = new WeakMap();
    let draggedFieldRow = null;
    let draggedFieldContainer = null;
    const fieldContainerState = new WeakMap();
    const dropIndicatorMap = new WeakMap();

    function getDropIndicator(container){
      if(!container) return null;
      let indicator = dropIndicatorMap.get(container);
      if(indicator && indicator.parentElement !== container){
        dropIndicatorMap.delete(container);
        indicator = null;
      }
      if(!indicator){
        indicator = document.createElement('div');
        indicator.className = 'formbuilder-drop-indicator';
        container.appendChild(indicator);
        dropIndicatorMap.set(container, indicator);
      }
      return indicator;
    }

    function hideDropIndicator(container){
      if(!container) return;
      const indicator = dropIndicatorMap.get(container);
      if(indicator){
        indicator.classList.remove('visible');
      }
    }

    function positionDropIndicator(container, target, before, selector, draggedEl){
      if(!container) return;
      const indicator = getDropIndicator(container);
      if(!indicator) return;
      let top = 0;
      if(target && target !== draggedEl){
        top = before ? target.offsetTop : target.offsetTop + target.offsetHeight;
      } else {
        const items = Array.from(container.querySelectorAll(selector)).filter(el => el !== draggedEl);
        if(items.length > 0){
          const ref = before ? items[0] : items[items.length - 1];
          top = before ? ref.offsetTop : ref.offsetTop + ref.offsetHeight;
        } else {
          top = 0;
        }
      }
      indicator.style.top = `${top}px`;
      indicator.classList.add('visible');
    }

    function sanitizeInsertionReference(node){
      while(node && node.nodeType === 1 && node.classList.contains('formbuilder-drop-indicator')){
        node = node.nextSibling;
      }
      while(node && node.nodeType === 3){
        node = node.nextSibling;
      }
      return node;
    }

    function clearCategoryDropIndicator(){
      if(categoryDropIndicatorTarget){
        categoryDropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
        categoryDropIndicatorTarget = null;
        categoryDropIndicatorClass = '';
      }
      categoryDropIndicatorBefore = null;
      hideDropIndicator(formbuilderCats);
    }

    function updateCategoryDropIndicator(target, before){
      const cls = target ? (before ? 'drag-target-before' : 'drag-target-after') : '';
      if(categoryDropIndicatorTarget && categoryDropIndicatorTarget !== target){
        categoryDropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
      }
      if(target){
        if(categoryDropIndicatorTarget !== target || categoryDropIndicatorClass !== cls){
          target.classList.remove('drag-target-before','drag-target-after');
          target.classList.add(cls);
          categoryDropIndicatorTarget = target;
          categoryDropIndicatorClass = cls;
        }
      } else {
        categoryDropIndicatorTarget = null;
        categoryDropIndicatorClass = '';
      }
      categoryDropIndicatorBefore = before;
      positionDropIndicator(formbuilderCats, target, before, '.category-form-menu', draggedCategoryMenu);
    }

    function captureChildPositions(container, selector){
      const map = new Map();
      if(!container) return map;
      container.querySelectorAll(selector).forEach(el=>{
        map.set(el, el.getBoundingClientRect());
      });
      return map;
    }

    function animateListReorder(container, selector, previousRects, exclude){
      if(!container || !previousRects || previousRects.size === 0) return;
      requestAnimationFrame(()=>{
        container.querySelectorAll(selector).forEach(el=>{
          if(el === exclude) return;
          const prevRect = previousRects.get(el);
          if(!prevRect) return;
          const nextRect = el.getBoundingClientRect();
          const dx = prevRect.left - nextRect.left;
          const dy = prevRect.top - nextRect.top;
          if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          void el.offsetWidth;
          el.style.transition = 'transform 150ms ease';
          el.style.transform = '';
          const cleanup = ()=>{
            el.style.transition = '';
            el.style.transform = '';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
        });
      });
    }

    function notifyFormbuilderChange(){
      if(!formbuilderCats) return;
      try{
        formbuilderCats.dispatchEvent(new Event('change', { bubbles: true }));
      }catch(err){
        const evt = document.createEvent('Event');
        evt.initEvent('change', true, true);
        formbuilderCats.dispatchEvent(evt);
      }
    }

    function syncCategoriesFromDom(){
      if(!formbuilderCats) return;
      const menuEls = Array.from(formbuilderCats.querySelectorAll('.category-form-menu'));
      if(menuEls.length !== categories.length) return;
      const used = new Set();
      const newOrder = [];
      menuEls.forEach(menu=>{
        const idx = Number.parseInt(menu.dataset.categoryIndex, 10);
        if(Number.isInteger(idx) && idx >= 0 && idx < categories.length && !used.has(idx)){
          newOrder.push(categories[idx]);
          used.add(idx);
          return;
        }
        const name = menu.dataset.category || '';
        const fallback = categories.findIndex((cat, index)=> cat && !used.has(index) && cat.name === name);
        if(fallback !== -1){
          newOrder.push(categories[fallback]);
          used.add(fallback);
        }
      });
      let changed = false;
      if(newOrder.length === categories.length){
        for(let i = 0; i < newOrder.length; i++){
          if(newOrder[i] !== categories[i]){
            changed = true;
            break;
          }
        }
        if(changed){
          categories.splice(0, categories.length, ...newOrder);
        }
      }
      menuEls.forEach((menu, index)=>{
        menu.dataset.categoryIndex = String(index);
      });
      if(changed){
        notifyFormbuilderChange();
      }
    }

    function ensureCategoryDragContainer(){
      if(categoryDragContainerInitialized || !formbuilderCats) return;
      categoryDragContainerInitialized = true;
      formbuilderCats.addEventListener('dragover', event=>{
        if(!draggedCategoryMenu || draggedSubcategoryMenu || draggedFieldRow){
          return;
        }
        event.preventDefault();
        if(event.dataTransfer){
          event.dataTransfer.dropEffect = 'move';
        }
        const target = event.target.closest('.category-form-menu');
        const menus = Array.from(formbuilderCats.querySelectorAll('.category-form-menu')).filter(menu => menu !== draggedCategoryMenu);
        const containerRect = formbuilderCats.getBoundingClientRect();
        if(!target || target === draggedCategoryMenu){
          if(menus.length === 0){
            updateCategoryDropIndicator(null, true);
            return;
          }
          if(event.clientY <= containerRect.top + 8){
            updateCategoryDropIndicator(menus[0], true);
          } else {
            updateCategoryDropIndicator(menus[menus.length - 1], false);
          }
          return;
        }
        const rect = target.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        updateCategoryDropIndicator(target, before);
      });
      formbuilderCats.addEventListener('drop', event=>{
        if(!draggedCategoryMenu || draggedSubcategoryMenu || draggedFieldRow){
          return;
        }
        event.preventDefault();
        categoryDropCommitted = true;
        const target = categoryDropIndicatorTarget;
        const before = categoryDropIndicatorBefore;
        let reference = null;
        if(formbuilderCats){
          if(target && target !== draggedCategoryMenu){
            reference = before ? target : target.nextSibling;
          } else if(!target && before){
            reference = formbuilderCats.firstChild;
          }
        }
        reference = sanitizeInsertionReference(reference);
        const currentNext = draggedCategoryMenu.nextSibling;
        if(formbuilderCats){
          const beforeRects = captureChildPositions(formbuilderCats, '.category-form-menu');
          if(reference !== draggedCategoryMenu && reference !== currentNext){
            formbuilderCats.insertBefore(draggedCategoryMenu, reference || null);
            animateListReorder(formbuilderCats, '.category-form-menu', beforeRects, draggedCategoryMenu);
          }
        }
        clearCategoryDropIndicator();
        syncCategoriesFromDom();
      });
      formbuilderCats.addEventListener('dragleave', event=>{
        if(!draggedCategoryMenu || draggedSubcategoryMenu || draggedFieldRow) return;
        if(event.target === formbuilderCats){
          clearCategoryDropIndicator();
        }
      });
    }

    function clearSubDropIndicator(state){
      if(!state) return;
      if(state.dropIndicatorTarget){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = null;
      hideDropIndicator(state.container);
    }

    function updateSubDropIndicator(state, target, before){
      if(!state) return;
      const cls = target ? (before ? 'drag-target-before' : 'drag-target-after') : '';
      if(state.dropIndicatorTarget && state.dropIndicatorTarget !== target){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
      }
      if(target){
        if(state.dropIndicatorTarget !== target || state.dropIndicatorClass !== cls){
          target.classList.remove('drag-target-before','drag-target-after');
          target.classList.add(cls);
          state.dropIndicatorTarget = target;
          state.dropIndicatorClass = cls;
        }
      } else {
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = before;
      positionDropIndicator(state.container, target, before, '.subcategory-form-menu', draggedSubcategoryMenu);
    }

    function syncSubcategoryOrderFromDom(container, categoryObj){
      if(!container || !categoryObj) return;
      const subEls = Array.from(container.querySelectorAll('.subcategory-form-menu'));
      const original = Array.isArray(categoryObj.subs) ? categoryObj.subs.slice() : [];
      const used = new Set();
      const reordered = [];
      subEls.forEach(subMenu=>{
        const idx = Number.parseInt(subMenu.dataset.subIndex, 10);
        if(Number.isInteger(idx) && idx >= 0 && idx < original.length && !used.has(idx)){
          reordered.push(original[idx]);
          used.add(idx);
          return;
        }
        const name = subMenu.dataset.subcategory || '';
        const fallback = original.findIndex((subName, index)=> subName === name && !used.has(index));
        if(fallback !== -1){
          reordered.push(original[fallback]);
          used.add(fallback);
        }
      });
      let changed = false;
      if(reordered.length === original.length){
        for(let i = 0; i < reordered.length; i++){
          if(reordered[i] !== original[i]){
            changed = true;
            break;
          }
        }
        if(changed){
          categoryObj.subs = reordered;
        }
      }
      subEls.forEach((subMenu, index)=>{
        subMenu.dataset.subIndex = String(index);
      });
      if(changed){
        notifyFormbuilderChange();
      }
    }

    function setupSubcategoryContainer(container, categoryObj, addButton){
      if(!container) return null;
      let state = subcategoryContainerState.get(container);
      if(!state){
        state = {
          dropIndicatorTarget: null,
          dropIndicatorClass: '',
          dropIndicatorBefore: null,
          dropCommitted: false,
          addButton: addButton,
          category: categoryObj,
          container
        };
        subcategoryContainerState.set(container, state);
        container.addEventListener('dragover', event=>{
          if(!draggedSubcategoryMenu || draggedSubcategoryContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          if(event.dataTransfer){
            event.dataTransfer.dropEffect = 'move';
          }
          const target = event.target.closest('.subcategory-form-menu');
          const subMenus = Array.from(container.querySelectorAll('.subcategory-form-menu')).filter(menu => menu !== draggedSubcategoryMenu);
          const containerRect = container.getBoundingClientRect();
          if(!target || target === draggedSubcategoryMenu){
            if(subMenus.length === 0){
              updateSubDropIndicator(state, null, true);
            } else if(event.clientY <= containerRect.top + 8){
              updateSubDropIndicator(state, subMenus[0], true);
            } else {
              updateSubDropIndicator(state, subMenus[subMenus.length - 1], false);
            }
            return;
          }
          const rect = target.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          updateSubDropIndicator(state, target, before);
        });
        container.addEventListener('drop', event=>{
          if(!draggedSubcategoryMenu || draggedSubcategoryContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          state.dropCommitted = true;
          const target = state.dropIndicatorTarget;
          const before = state.dropIndicatorBefore;
          let reference = null;
          if(container){
            if(target && target !== draggedSubcategoryMenu){
              reference = before ? target : target.nextSibling;
            } else if(!target && before){
              reference = container.firstChild;
            } else if(state.addButton){
              reference = state.addButton;
            }
          }
          if(reference === state.addButton && state.addButton && state.addButton.previousSibling === draggedSubcategoryMenu){
            reference = draggedSubcategoryMenu.nextSibling;
          }
          reference = sanitizeInsertionReference(reference);
          if(reference === state.addButton && reference === draggedSubcategoryMenu.nextSibling){
            reference = reference.nextSibling;
          }
          const beforeRects = captureChildPositions(container, '.subcategory-form-menu');
          const currentNext = draggedSubcategoryMenu.nextSibling;
          if(reference !== draggedSubcategoryMenu && reference !== currentNext){
            container.insertBefore(draggedSubcategoryMenu, reference || state.addButton || null);
            animateListReorder(container, '.subcategory-form-menu', beforeRects, draggedSubcategoryMenu);
          }
          clearSubDropIndicator(state);
          syncSubcategoryOrderFromDom(container, state.category);
        });
        container.addEventListener('dragleave', event=>{
          if(!draggedSubcategoryMenu || draggedSubcategoryContainer !== container) return;
          if(event.target === container){
            clearSubDropIndicator(state);
          }
        });
      }
      state.addButton = addButton;
      state.category = categoryObj;
      state.container = container;
      return state;
    }

    function enableCategoryDrag(menu, header){
      if(!menu || !header) return;
      ensureCategoryDragContainer();
      menu.draggable = false;
      header.draggable = true;
      header.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(!origin || origin.closest('.formbuilder-category-header') !== header){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedCategoryMenu = menu;
        categoryDropCommitted = false;
        menu.classList.add('is-dragging');
        header.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', menu.dataset.category || ''); }catch(err){}
          try{
            const rect = menu.getBoundingClientRect();
            event.dataTransfer.setDragImage(menu, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      header.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedCategoryMenu === menu){
          menu.classList.remove('is-dragging');
          header.classList.remove('is-dragging');
          draggedCategoryMenu = null;
        }
        clearCategoryDropIndicator();
        if(!categoryDropCommitted){
          syncCategoriesFromDom();
        }
        categoryDropCommitted = false;
      });
    }

    function enableSubcategoryDrag(subMenu, container, categoryObj, header, addButton){
      if(!subMenu || !container || !header) return;
      const state = setupSubcategoryContainer(container, categoryObj, addButton);
      subMenu.draggable = false;
      header.draggable = true;
      header.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(!origin || origin.closest('.formbuilder-subcategory-header') !== header){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedSubcategoryMenu = subMenu;
        draggedSubcategoryContainer = container;
        if(state) state.dropCommitted = false;
        subMenu.classList.add('is-dragging');
        header.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', subMenu.dataset.subcategory || ''); }catch(err){}
          try{
            const rect = subMenu.getBoundingClientRect();
            event.dataTransfer.setDragImage(subMenu, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      header.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedSubcategoryMenu === subMenu){
          subMenu.classList.remove('is-dragging');
          header.classList.remove('is-dragging');
          draggedSubcategoryMenu = null;
          draggedSubcategoryContainer = null;
        }
        if(state){
          clearSubDropIndicator(state);
          if(!state.dropCommitted){
            syncSubcategoryOrderFromDom(container, state.category);
          }
          state.dropCommitted = false;
        }
      });
    }

    function clearFieldDropIndicator(state){
      if(!state) return;
      if(state.dropIndicatorTarget){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = null;
      hideDropIndicator(state.container);
    }

    function updateFieldDropIndicator(state, target, before){
      if(!state) return;
      const cls = target ? (before ? 'drag-target-before' : 'drag-target-after') : '';
      if(state.dropIndicatorTarget && state.dropIndicatorTarget !== target){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
      }
      if(target){
        if(state.dropIndicatorTarget !== target || state.dropIndicatorClass !== cls){
          target.classList.remove('drag-target-before','drag-target-after');
          target.classList.add(cls);
          state.dropIndicatorTarget = target;
          state.dropIndicatorClass = cls;
        }
      } else {
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = before;
      positionDropIndicator(state.container, target, before, '.subcategory-field-row', draggedFieldRow);
    }

    function syncFieldOrderFromDom(container, fields){
      if(!container || !Array.isArray(fields)) return;
      const rows = Array.from(container.querySelectorAll('.subcategory-field-row'));
      const original = fields.slice();
      const reordered = [];
      rows.forEach(row=>{
        const ref = row && row.__fieldRef;
        if(ref && original.includes(ref) && !reordered.includes(ref)){
          reordered.push(ref);
        }
      });
      let changed = false;
      if(reordered.length === original.length){
        for(let i = 0; i < reordered.length; i++){
          if(reordered[i] !== original[i]){
            changed = true;
            break;
          }
        }
        if(changed){
          fields.splice(0, fields.length, ...reordered);
          notifyFormbuilderChange();
          const state = fieldContainerState.get(container);
          if(state && typeof state.onFieldsReordered === 'function'){
            try{
              state.onFieldsReordered();
            }catch(err){}
          }
        }
      }
      rows.forEach((row, index)=>{
        row.dataset.fieldIndex = String(index);
      });
    }

    function setupFieldContainer(container, fields){
      if(!container) return null;
      let state = fieldContainerState.get(container);
      if(!state){
        state = {
          dropIndicatorTarget: null,
          dropIndicatorClass: '',
          dropIndicatorBefore: null,
          dropCommitted: false,
          fields,
          container
        };
        fieldContainerState.set(container, state);
        container.addEventListener('dragover', event=>{
          if(!draggedFieldRow || draggedFieldContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          if(event.dataTransfer){
            event.dataTransfer.dropEffect = 'move';
          }
          const target = event.target.closest('.subcategory-field-row');
          const rows = Array.from(container.querySelectorAll('.subcategory-field-row')).filter(row => row !== draggedFieldRow);
          const containerRect = container.getBoundingClientRect();
          if(!target || target === draggedFieldRow){
            if(rows.length === 0){
              updateFieldDropIndicator(state, null, true);
            } else if(event.clientY <= containerRect.top + 8){
              updateFieldDropIndicator(state, rows[0], true);
            } else {
              updateFieldDropIndicator(state, rows[rows.length - 1], false);
            }
            return;
          }
          const rect = target.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          updateFieldDropIndicator(state, target, before);
        });
        container.addEventListener('drop', event=>{
          if(!draggedFieldRow || draggedFieldContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          state.dropCommitted = true;
          const target = state.dropIndicatorTarget;
          const before = state.dropIndicatorBefore;
          let reference = null;
          if(container){
            if(target && target !== draggedFieldRow){
              reference = before ? target : target.nextSibling;
            } else if(!target && before){
              reference = container.firstChild;
            }
          }
          reference = sanitizeInsertionReference(reference);
          const beforeRects = captureChildPositions(container, '.subcategory-field-row');
          const currentNext = draggedFieldRow.nextSibling;
          if(reference !== draggedFieldRow && reference !== currentNext){
            container.insertBefore(draggedFieldRow, reference || null);
            animateListReorder(container, '.subcategory-field-row', beforeRects, draggedFieldRow);
          }
          clearFieldDropIndicator(state);
          syncFieldOrderFromDom(container, state.fields || fields);
        });
        container.addEventListener('dragleave', event=>{
          if(!draggedFieldRow || draggedFieldContainer !== container) return;
          if(event.target === container){
            clearFieldDropIndicator(state);
          }
        });
      }
      state.fields = fields;
      state.container = container;
      return state;
    }

    function enableFieldDrag(row, container, fields){
      if(!row || !container) return;
      const state = setupFieldContainer(container, fields);
      row.draggable = true;
      row.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(origin !== row){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedFieldRow = row;
        draggedFieldContainer = container;
        if(state) state.dropCommitted = false;
        row.classList.add('is-dragging');
        if(row._header){
          row._header.classList.add('is-dragging');
        }
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', (row.querySelector('.field-name-input')?.value || 'Field')); }catch(err){}
          try{
            const rect = row.getBoundingClientRect();
            event.dataTransfer.setDragImage(row, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      row.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedFieldRow === row){
          row.classList.remove('is-dragging');
          if(row._header){
            row._header.classList.remove('is-dragging');
          }
          draggedFieldRow = null;
          draggedFieldContainer = null;
        }
        if(state){
          clearFieldDropIndicator(state);
          if(!state.dropCommitted){
            syncFieldOrderFromDom(container, state.fields || fields);
          }
          state.dropCommitted = false;
        }
      });
    }

    function ensureFormbuilderConfirmOverlay(){
      if(formbuilderConfirmOverlay) return formbuilderConfirmOverlay;
      const overlay = document.createElement('div');
      overlay.id = 'formbuilderConfirmOverlay';
      overlay.className = 'formbuilder-confirm-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('tabindex', '-1');

      const dialog = document.createElement('div');
      dialog.className = 'formbuilder-confirm-dialog';
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'formbuilderConfirmTitle');
      dialog.setAttribute('aria-describedby', 'formbuilderConfirmMessage');

      const title = document.createElement('h2');
      title.id = 'formbuilderConfirmTitle';
      title.textContent = 'Delete item?';

      const message = document.createElement('p');
      message.id = 'formbuilderConfirmMessage';
      message.textContent = 'Are you sure you want to delete this item?';

      const actions = document.createElement('div');
      actions.className = 'formbuilder-confirm-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'formbuilder-confirm-cancel';
      cancelBtn.textContent = 'Cancel';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'formbuilder-confirm-delete';
      deleteBtn.textContent = 'Delete';

      actions.append(cancelBtn, deleteBtn);
      dialog.append(title, message, actions);
      overlay.append(dialog);
      document.body.appendChild(overlay);
      formbuilderConfirmOverlay = overlay;
      return overlay;
    }

    function confirmFormbuilderDeletion(messageText, titleText){
      const overlay = ensureFormbuilderConfirmOverlay();
      const dialog = overlay.querySelector('.formbuilder-confirm-dialog');
      const title = dialog.querySelector('#formbuilderConfirmTitle');
      const message = dialog.querySelector('#formbuilderConfirmMessage');
      const cancelBtn = overlay.querySelector('.formbuilder-confirm-cancel');
      const deleteBtn = overlay.querySelector('.formbuilder-confirm-delete');
      title.textContent = titleText || 'Delete item?';
      message.textContent = messageText || 'Are you sure you want to delete this item?';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('visible');
      const previouslyFocused = document.activeElement;

      return new Promise(resolve=>{
        const cleanup = (result)=>{
          overlay.classList.remove('visible');
          overlay.setAttribute('aria-hidden', 'true');
          cancelBtn.removeEventListener('click', onCancel);
          deleteBtn.removeEventListener('click', onConfirm);
          window.removeEventListener('keydown', onKeyDown, true);
          overlay.removeEventListener('click', onOverlayClick);
          if(previouslyFocused && typeof previouslyFocused.focus === 'function'){
            try{
              previouslyFocused.focus({ preventScroll: true });
            }catch(err){
              try{ previouslyFocused.focus(); }catch(e){}
            }
          }
          resolve(result);
        };
        const onCancel = ()=> cleanup(false);
        const onConfirm = ()=> cleanup(true);
        const onOverlayClick = (event)=>{
          if(event.target === overlay){
            cleanup(false);
          }
        };
        const onKeyDown = (event)=>{
          if(event.key === 'Escape'){
            event.preventDefault();
            cleanup(false);
          }
        };

        cancelBtn.addEventListener('click', onCancel, { once: true });
        deleteBtn.addEventListener('click', onConfirm, { once: true });
        overlay.addEventListener('click', onOverlayClick);
        window.addEventListener('keydown', onKeyDown, true);

        requestAnimationFrame(()=>{
          try{
            cancelBtn.focus({ preventScroll: true });
          }catch(err){
            cancelBtn.focus();
          }
        });
      });
    }
    let subcategoryFieldOverlayEl = null;
    let subcategoryFieldOverlayContent = null;
    let subcategoryFieldOverlayKeyHandler = null;
    let subcategoryFieldOverlayPointerDownHandler = null;
    let subcategoryFieldOverlayScrollHandler = null;
    let subcategoryFieldOverlayResizeHandler = null;
    let subcategoryFieldOverlayTrigger = null;
    function ensureSubcategoryFieldOverlay(){
      if(subcategoryFieldOverlayEl && subcategoryFieldOverlayContent) return subcategoryFieldOverlayEl;
      if(!document || !document.body) return null;
      const overlay = document.createElement('div');
      overlay.id = 'subcategoryFieldOverlay';
      overlay.className = 'subcategory-field-overlay';
      const content = document.createElement('div');
      content.className = 'subcategory-field-overlay-content';
      content.setAttribute('role', 'dialog');
      content.setAttribute('tabindex', '-1');
      overlay.appendChild(content);
      document.body.appendChild(overlay);
      subcategoryFieldOverlayEl = overlay;
      subcategoryFieldOverlayContent = content;
      if(!subcategoryFieldOverlayKeyHandler){
        subcategoryFieldOverlayKeyHandler = event=>{
          if(event.key === 'Escape' && overlay.classList.contains('visible')){
            event.preventDefault();
            closeSubcategoryFieldOverlay();
          }
        };
        document.addEventListener('keydown', subcategoryFieldOverlayKeyHandler);
      }
      return overlay;
    }
    function closeSubcategoryFieldOverlay(){
      const overlay = subcategoryFieldOverlayEl;
      const content = subcategoryFieldOverlayContent;
      if(!overlay || !content) return;
      const activeRow = content.querySelector('.subcategory-field-row');
      if(activeRow){
        const placeholder = activeRow.__overlayPlaceholder;
        if(placeholder && placeholder.parentNode){
          placeholder.replaceWith(activeRow);
        } else if(activeRow.__overlayParent && activeRow.__overlayParent.isConnected){
          activeRow.__overlayParent.appendChild(activeRow);
        }
        if(placeholder && placeholder.parentNode){
          // already replaced
        } else if(placeholder){
          placeholder.remove();
        }
        delete activeRow.__overlayPlaceholder;
        delete activeRow.__overlayParent;
        delete activeRow.__overlayOverlay;
      }
      content.innerHTML = '';
      content.style.top = '';
      content.style.left = '';
      content.style.width = '';
      overlay.classList.remove('visible');
      overlay.removeAttribute('data-active-label');
      content.removeAttribute('aria-label');
      if(subcategoryFieldOverlayPointerDownHandler){
        document.removeEventListener('pointerdown', subcategoryFieldOverlayPointerDownHandler, true);
        subcategoryFieldOverlayPointerDownHandler = null;
      }
      if(subcategoryFieldOverlayScrollHandler){
        window.removeEventListener('scroll', subcategoryFieldOverlayScrollHandler, true);
        subcategoryFieldOverlayScrollHandler = null;
      }
      if(subcategoryFieldOverlayResizeHandler){
        window.removeEventListener('resize', subcategoryFieldOverlayResizeHandler);
        subcategoryFieldOverlayResizeHandler = null;
      }
      subcategoryFieldOverlayTrigger = null;
    }
    function openSubcategoryFieldOverlay(row, labelText, triggerEl){
      if(!row) return;
      const overlay = ensureSubcategoryFieldOverlay();
      const content = subcategoryFieldOverlayContent;
      if(!overlay || !content) return;
      const currentRow = content.querySelector('.subcategory-field-row');
      if(currentRow === row){
        closeSubcategoryFieldOverlay();
        return;
      }
      closeSubcategoryFieldOverlay();
      if(!row.parentNode) return;
      const placeholder = document.createElement('div');
      placeholder.className = 'subcategory-field-placeholder';
      const rowRect = row.getBoundingClientRect();
      if(rowRect && rowRect.width){
        const storedWidth = Math.round(rowRect.width);
        if(storedWidth > 0){
          placeholder.__overlayWidth = storedWidth;
          placeholder.style.width = storedWidth + 'px';
        }
      }
      const parentContent = row.closest('.subcategory-form-content');
      if(parentContent && typeof parentContent.getBoundingClientRect === 'function'){
        const parentRect = parentContent.getBoundingClientRect();
        const containerWidth = Math.round(parentRect?.width || 0);
        if(containerWidth > 0){
          placeholder.__overlayContainerWidth = containerWidth;
        }
      }
      row.__overlayPlaceholder = placeholder;
      row.__overlayParent = row.parentNode;
      row.__overlayOverlay = overlay;
      row.parentNode.insertBefore(placeholder, row);
      content.innerHTML = '';
      content.appendChild(row);
      const overlayWidth = placeholder.__overlayContainerWidth || placeholder.__overlayWidth;
      if(overlayWidth){
        content.style.width = overlayWidth + 'px';
      } else {
        content.style.width = '';
      }
      if(labelText){
        content.setAttribute('aria-label', labelText);
        overlay.setAttribute('data-active-label', labelText);
      } else {
        content.removeAttribute('aria-label');
        overlay.removeAttribute('data-active-label');
      }
      const triggerButton = (triggerEl instanceof Element)
        ? triggerEl.closest('.subcategory-form-button')
        : null;
      subcategoryFieldOverlayTrigger = triggerButton || (triggerEl instanceof Element ? triggerEl : null);
      overlay.classList.add('visible');
      const alignOverlay = ()=>{
        const buffer = 10;
        const triggerNode = subcategoryFieldOverlayTrigger;
        const scrollY = (typeof window !== 'undefined' && typeof window.pageYOffset === 'number')
          ? window.pageYOffset
          : (document.documentElement?.scrollTop || document.body?.scrollTop || 0);
        const scrollX = (typeof window !== 'undefined' && typeof window.pageXOffset === 'number')
          ? window.pageXOffset
          : (document.documentElement?.scrollLeft || document.body?.scrollLeft || 0);
        const viewportHeight = (typeof window !== 'undefined' && typeof window.innerHeight === 'number')
          ? window.innerHeight
          : (document.documentElement?.clientHeight || 0);
        const viewportWidth = (typeof window !== 'undefined' && typeof window.innerWidth === 'number')
          ? window.innerWidth
          : (document.documentElement?.clientWidth || 0);
        const contentRect = content.getBoundingClientRect();
        const contentHeight = contentRect?.height || 0;
        const contentWidth = contentRect?.width || 0;
        let top = scrollY + buffer;
        let left = scrollX + buffer;
        if(triggerNode && typeof triggerNode.getBoundingClientRect === 'function'){
          const triggerRect = triggerNode.getBoundingClientRect();
          const minTop = scrollY + buffer;
          let maxTop = scrollY + viewportHeight - contentHeight - buffer;
          if(!Number.isFinite(maxTop) || maxTop < minTop){
            maxTop = minTop;
          }
          let preferredTop = scrollY + triggerRect.top - buffer - contentHeight;
          if(preferredTop < minTop){
            preferredTop = scrollY + triggerRect.bottom + buffer;
          }
          if(preferredTop > maxTop){
            preferredTop = Math.max(minTop, Math.min(preferredTop, maxTop));
          }
          top = preferredTop;
          const minLeft = scrollX + buffer;
          let maxLeft = scrollX + viewportWidth - contentWidth - buffer;
          if(!Number.isFinite(maxLeft) || maxLeft < minLeft){
            maxLeft = minLeft;
          }
          let preferredLeft = scrollX + triggerRect.left;
          if(preferredLeft > maxLeft){
            preferredLeft = maxLeft;
          }
          if(preferredLeft < minLeft){
            preferredLeft = minLeft;
          }
          left = preferredLeft;
        }
        content.style.top = Math.round(top) + 'px';
        content.style.left = Math.round(left) + 'px';
      };
      const scheduleAlign = ()=>{
        if(!overlay.classList.contains('visible')) return;
        const run = ()=>{
          if(!overlay.classList.contains('visible')) return;
          alignOverlay();
        };
        if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
          window.requestAnimationFrame(run);
        } else {
          setTimeout(run, 16);
        }
      };
      const pointerDownHandler = event=>{
        if(!overlay.classList.contains('visible')) return;
        const target = event.target;
        if(!target) return;
        if(content.contains(target)) return;
        const triggerNode = subcategoryFieldOverlayTrigger;
        if(triggerNode && typeof triggerNode.contains === 'function' && triggerNode.contains(target)) return;
        closeSubcategoryFieldOverlay();
      };
      document.addEventListener('pointerdown', pointerDownHandler, true);
      subcategoryFieldOverlayPointerDownHandler = pointerDownHandler;
      const onScroll = ()=> scheduleAlign();
      const onResize = ()=> scheduleAlign();
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onResize);
      subcategoryFieldOverlayScrollHandler = onScroll;
      subcategoryFieldOverlayResizeHandler = onResize;
      requestAnimationFrame(()=>{
        alignOverlay();
        const focusSelectors = [
          'input:not([disabled]):not([tabindex="-1"])',
          'select:not([disabled]):not([tabindex="-1"])',
          'textarea:not([disabled]):not([tabindex="-1"])',
          'button:not([disabled]):not([tabindex="-1"])',
          '[href]:not([tabindex="-1"])',
          '[tabindex]:not([tabindex="-1"])',
          '[contenteditable="true"]'
        ].join(', ');
        const focusTarget = row.querySelector(focusSelectors);
        if(focusTarget && typeof focusTarget.focus === 'function'){
          try{ focusTarget.focus({ preventScroll: true }); }
          catch(err){
            try{ focusTarget.focus(); }catch(e){}
          }
        } else if(typeof content.focus === 'function'){
          try{ content.focus({ preventScroll: true }); }
          catch(err){
            try{ content.focus(); }catch(e){}
          }
        }
      });
      scheduleAlign();
    }
    const refreshFormbuilderSubcategoryLogos = ()=>{
      if(!formbuilderCats) return;
      formbuilderCats.querySelectorAll('.subcategory-form-menu').forEach(menu=>{
        const logoSpan = menu.querySelector('.subcategory-logo');
        if(!logoSpan) return;
        const subName = menu.dataset.subcategory || '';
        const iconLookup = lookupIconPath(subcategoryIconPaths, null, subName);
        const path = iconLookup.found ? (iconLookup.path || '') : '';
        const iconHtml = subcategoryIcons[subName] || '';
        const normalizedPath = applyNormalizeIconPath(path);
        logoSpan.innerHTML = '';
        if(normalizedPath){
          const img = document.createElement('img');
          img.src = normalizedPath;
          img.width = 20;
          img.height = 20;
          img.alt = '';
          logoSpan.appendChild(img);
          logoSpan.classList.add('has-icon');
        } else if(iconHtml){
          logoSpan.innerHTML = iconHtml;
          logoSpan.classList.add('has-icon');
        } else {
          logoSpan.textContent = subName ? subName.charAt(0) : '';
          logoSpan.classList.remove('has-icon');
        }
      });
    };
    const renderFormbuilderCats = ()=>{
      if(!formbuilderCats) return;
      if(typeof closeSubcategoryFieldOverlay === 'function'){
        closeSubcategoryFieldOverlay();
      }
      closeAllIconPickers();
      const attachIconPicker = (trigger, container, options = {})=>{
        const opts = options || {};
        const getCurrentPath = typeof opts.getCurrentPath === 'function' ? opts.getCurrentPath : (()=> '');
        const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : (()=>{});
        const label = typeof opts.label === 'string' && opts.label.trim() ? opts.label.trim() : 'Choose Icon';
        const parentMenu = opts.parentMenu || null;
        const parentCategoryMenu = opts.parentCategoryMenu || null;
        let popup = null;
        let alignFrame = 0;
        let resizeObserver = null;

        const alignPopup = ()=>{
          if(!popup) return;
          let triggerRect;
          let containerRect;
          try {
            triggerRect = trigger.getBoundingClientRect();
            containerRect = container.getBoundingClientRect();
          } catch(err){
            return;
          }
          const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
          let left = triggerRect.left - containerRect.left;
          let top = triggerRect.bottom - containerRect.top + 8;
          popup.style.left = '0px';
          popup.style.top = '0px';
          const popupRect = popup.getBoundingClientRect();
          const overflowRight = triggerRect.left + popupRect.width - viewportWidth + 12;
          if(overflowRight > 0){
            left -= overflowRight;
          }
          const overflowLeft = containerRect.left + left;
          if(overflowLeft < 8){
            left += 8 - overflowLeft;
          }
          const desiredBottom = triggerRect.bottom + 8 + popupRect.height;
          if(desiredBottom > viewportHeight - 12){
            const altTop = triggerRect.top - containerRect.top - popupRect.height - 8;
            if(altTop + containerRect.top >= 12 || desiredBottom >= viewportHeight){
              top = Math.max(0, altTop);
            }
          }
          if(containerRect.left + left < 0){
            left = -containerRect.left;
          }
          popup.style.left = `${Math.round(left)}px`;
          popup.style.top = `${Math.round(Math.max(0, top))}px`;
        };

        const scheduleAlign = ()=>{
          if(!popup) return;
          if(alignFrame){
            cancelAnimationFrame(alignFrame);
          }
          alignFrame = requestAnimationFrame(()=>{
            alignFrame = 0;
            alignPopup();
          });
        };

        const closePicker = ()=>{
          if(!popup) return;
          popup.remove();
          popup = null;
          if(alignFrame){
            cancelAnimationFrame(alignFrame);
            alignFrame = 0;
          }
          container.classList.remove('iconpicker-open');
          if(parentMenu) parentMenu.classList.remove('has-floating-overlay');
          if(parentCategoryMenu) parentCategoryMenu.classList.remove('has-floating-overlay');
          document.removeEventListener('pointerdown', handlePointerDown, true);
          document.removeEventListener('keydown', handleKeyDown, true);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('resize', handleResize);
          if(resizeObserver){
            try{ resizeObserver.disconnect(); }catch(err){}
            resizeObserver = null;
          }
          OPEN_ICON_PICKERS.delete(closePicker);
        };

        const handlePointerDown = event => {
          if(!popup) return;
          const target = event.target;
          if(!target) return;
          if(target === trigger || (typeof trigger.contains === 'function' && trigger.contains(target))) return;
          if(popup.contains(target)) return;
          closePicker();
        };
        const handleKeyDown = event => {
          if(event.key === 'Escape'){
            closePicker();
          }
        };
        const handleScroll = ()=> scheduleAlign();
        const handleResize = ()=> scheduleAlign();

        const openPicker = ()=>{
          if(popup || !ICON_LIBRARY.length) return;
          closeAllIconPickers();
          popup = document.createElement('div');
          popup.className = 'icon-picker-popup';
          popup.setAttribute('role', 'dialog');
          popup.setAttribute('aria-label', label);
          popup.tabIndex = -1;
          popup.style.position = 'absolute';
          const grid = document.createElement('div');
          grid.className = 'icon-picker-grid';
          const currentPath = applyNormalizeIconPath(getCurrentPath());
          const optionsList = [{ value: '', label: 'No Icon' }];
          ICON_LIBRARY.forEach(path => {
            if(typeof path === 'string' && path.trim()){
              optionsList.push({ value: applyNormalizeIconPath(path) });
            }
          });
          optionsList.forEach(entry => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-picker-option';
            const value = entry.value || '';
            if(!value){
              btn.classList.add('icon-picker-option--clear');
              btn.textContent = entry.label || 'No Icon';
            } else {
              const img = document.createElement('img');
              img.src = value;
              img.alt = '';
              btn.appendChild(img);
            }
            if(value === currentPath){
              btn.classList.add('selected');
            }
            btn.addEventListener('click', ()=>{
              onSelect(value);
              closePicker();
            });
            grid.appendChild(btn);
          });
          popup.appendChild(grid);
          container.appendChild(popup);
          container.classList.add('iconpicker-open');
          if(parentMenu) parentMenu.classList.add('has-floating-overlay');
          if(parentCategoryMenu) parentCategoryMenu.classList.add('has-floating-overlay');
          scheduleAlign();
          document.addEventListener('pointerdown', handlePointerDown, true);
          document.addEventListener('keydown', handleKeyDown, true);
          window.addEventListener('scroll', handleScroll, true);
          window.addEventListener('resize', handleResize);
          if(typeof ResizeObserver === 'function'){
            resizeObserver = new ResizeObserver(()=> scheduleAlign());
            try{ resizeObserver.observe(container); }catch(err){ resizeObserver = null; }
          }
          OPEN_ICON_PICKERS.add(closePicker);
          requestAnimationFrame(()=>{
            try{ popup.focus({ preventScroll: true }); }
            catch(err){ try{ popup.focus(); }catch(e){} }
          });
        };
        trigger.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          openPicker();
        });
        trigger.addEventListener('keydown', event => {
          if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
            event.preventDefault();
            openPicker();
          }
        });
        if(!ICON_LIBRARY.length){
          trigger.disabled = true;
          trigger.setAttribute('aria-disabled','true');
        } else {
          trigger.disabled = false;
          trigger.removeAttribute('aria-disabled');
        }
        return { open: openPicker, close: closePicker };
      };
      const frag = document.createDocumentFragment();
      const sortedCategoryEntries = getSortedCategoryEntries(categories);
      sortedCategoryEntries.forEach(({ category: c, index: sourceIndex }, viewIndex)=>{
        const baseId = slugify(c.name) || `category-${viewIndex + 1}`;
        const contentId = `category-form-content-${baseId}-${viewIndex}`;
        const editPanelId = `category-edit-panel-${baseId}-${viewIndex}`;

        const menu = document.createElement('div');
        menu.className = 'category-form-menu filter-category-menu';
        menu.dataset.category = c.name;
        menu.dataset.categoryIndex = String(sourceIndex);
        menu.setAttribute('role','group');
        menu.setAttribute('aria-expanded','false');

        const header = document.createElement('div');
        header.className = 'formbuilder-category-header';

        const triggerWrap = document.createElement('div');
        triggerWrap.className = 'options-dropdown filter-category-trigger-wrap';

        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'filter-category-trigger';
        menuBtn.setAttribute('aria-haspopup','true');
        menuBtn.setAttribute('aria-expanded','false');
        menuBtn.setAttribute('aria-controls', contentId);

        const categoryLogo = document.createElement('span');
        categoryLogo.className = 'category-logo';
        const categoryIconHtml = categoryIcons[c.name] || '';
        const categoryIconLookup = lookupIconPath(categoryIconPaths, c.id, c.name);
        const initialCategoryIconSrc = categoryIconLookup.found
          ? (categoryIconLookup.path || '')
          : extractIconSrc(categoryIconHtml);
        if(initialCategoryIconSrc){
          const normalizedInitial = applyNormalizeIconPath(initialCategoryIconSrc);
          if(normalizedInitial){
            categoryIcons[c.name] = `<img src="${normalizedInitial}" width="20" height="20" alt="">`;
            if(!categoryIconLookup.found){
              writeIconPath(categoryIconPaths, c.id, c.name, normalizedInitial);
            }
          }
          const img = document.createElement('img');
          img.src = applyNormalizeIconPath(initialCategoryIconSrc);
          img.width = 20;
          img.height = 20;
          img.alt = '';
          categoryLogo.appendChild(img);
          categoryLogo.classList.add('has-icon');
        } else if(categoryIconHtml){
          categoryLogo.innerHTML = categoryIconHtml;
          categoryLogo.classList.add('has-icon');
        } else {
          categoryLogo.textContent = c.name.charAt(0) || '';
        }

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = c.name;

        const arrow = document.createElement('span');
        arrow.className = 'dropdown-arrow';
        arrow.setAttribute('aria-hidden','true');

        menuBtn.append(categoryLogo, label, arrow);
        triggerWrap.append(menuBtn);

        const toggle = document.createElement('label');
        toggle.className = 'switch cat-switch';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = true;
        toggleInput.setAttribute('aria-label', `Toggle ${c.name} category`);
        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'slider';
        toggle.append(toggleInput, toggleSlider);

        header.append(triggerWrap, toggle);
        menu.append(header);

        const content = document.createElement('div');
        content.className = 'category-form-content';
        content.id = contentId;
        content.hidden = true;

        const editMenu = document.createElement('div');
        editMenu.className = 'category-edit-menu';

        const editPanel = document.createElement('div');
        editPanel.className = 'category-edit-panel';
        editPanel.id = editPanelId;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'category-name-input';
        nameInput.placeholder = 'Category Name';
        nameInput.value = c.name || '';

        const iconPicker = document.createElement('div');
        iconPicker.className = 'iconpicker-container';

        const iconPickerButton = document.createElement('button');
        iconPickerButton.type = 'button';
        iconPickerButton.className = 'iconpicker-button';
        iconPickerButton.textContent = initialCategoryIconSrc ? 'Change Icon' : 'Choose Icon';

        const preview = document.createElement('div');
        preview.className = 'iconpicker-preview';
        const previewLabel = document.createElement('span');
        previewLabel.textContent = 'No Icon';
        const previewImg = document.createElement('img');
        previewImg.alt = `${c.name} icon preview`;
        preview.append(previewLabel, previewImg);
        const normalizedCategoryIconPath = applyNormalizeIconPath(initialCategoryIconSrc);
        if(normalizedCategoryIconPath){
          previewImg.src = normalizedCategoryIconPath;
          preview.classList.add('has-image');
          previewLabel.textContent = '';
          iconPickerButton.textContent = 'Change Icon';
          if(!categoryIconLookup.found){
            writeIconPath(categoryIconPaths, c.id, c.name, normalizedCategoryIconPath);
          }
        }
        iconPicker.append(iconPickerButton, preview);
        attachIconPicker(iconPickerButton, iconPicker, {
          getCurrentPath: ()=> applyNormalizeIconPath(getCategoryIconPath(c)),
          onSelect: value => {
            updateCategoryIconDisplay(value);
            notifyFormbuilderChange();
          },
          label: `Choose icon for ${c.name}`,
          parentMenu: content,
          parentCategoryMenu: menu
        });

        const addSubBtn = document.createElement('button');
        addSubBtn.type = 'button';
        addSubBtn.className = 'add-subcategory-btn';
        addSubBtn.textContent = 'Add Subcategory';
        addSubBtn.setAttribute('aria-label', `Add subcategory to ${c.name}`);

        const deleteCategoryBtn = document.createElement('button');
        deleteCategoryBtn.type = 'button';
        deleteCategoryBtn.className = 'delete-category-btn';
        deleteCategoryBtn.textContent = 'Delete Category';
        deleteCategoryBtn.setAttribute('aria-label', `Delete ${c.name} category`);

        editPanel.append(nameInput, iconPicker, addSubBtn);
        editMenu.append(editPanel);
        const categoryDeleteActions = document.createElement('div');
        categoryDeleteActions.className = 'category-delete-actions';
        categoryDeleteActions.appendChild(deleteCategoryBtn);

        const subMenusContainer = document.createElement('div');
        subMenusContainer.className = 'subcategory-form-menus';
        const addSubAnchor = document.createElement('div');
        addSubAnchor.className = 'subcategory-drop-anchor';
        subMenusContainer.append(addSubAnchor);

        const subNameUpdaters = [];
        const subFieldsMap = (c.subFields && typeof c.subFields === 'object' && !Array.isArray(c.subFields)) ? c.subFields : (c.subFields = {});
        const getCategoryNameValue = ()=> nameInput.value.trim();
        let lastCategoryName = c.name || 'Category';
        let currentCategoryName = c.name || 'Category';
        const getCategoryDisplayName = ()=> getCategoryNameValue() || lastCategoryName || 'Category';
        const updateCategoryIconDisplay = (src)=>{
          const displayName = getCategoryDisplayName();
          categoryLogo.innerHTML = '';
          const normalizedSrc = applyNormalizeIconPath(src);
          if(normalizedSrc){
            const img = document.createElement('img');
            img.src = normalizedSrc;
            img.width = 20;
            img.height = 20;
            img.alt = '';
            categoryLogo.appendChild(img);
            categoryLogo.classList.add('has-icon');
            categoryIcons[currentCategoryName] = `<img src="${normalizedSrc}" width="20" height="20" alt="">`;
            writeIconPath(categoryIconPaths, c.id, currentCategoryName, normalizedSrc);
          } else {
            categoryLogo.textContent = displayName.charAt(0) || '';
            categoryLogo.classList.remove('has-icon');
            delete categoryIcons[currentCategoryName];
            writeIconPath(categoryIconPaths, c.id, currentCategoryName, '');
          }
          if(normalizedSrc){
            previewImg.src = normalizedSrc;
            preview.classList.add('has-image');
            previewLabel.textContent = '';
            iconPickerButton.textContent = 'Change Icon';
          } else {
            previewImg.removeAttribute('src');
            preview.classList.remove('has-image');
            previewLabel.textContent = 'No Icon';
            iconPickerButton.textContent = 'Choose Icon';
          }
        };
        const applyCategoryNameChange = ()=>{
          const nameValue = getCategoryNameValue();
          if(nameValue){
            lastCategoryName = nameValue;
          }
          const displayName = getCategoryDisplayName();
          const datasetValue = displayName;
          const previousName = currentCategoryName;
          if(previousName !== datasetValue){
            if(categoryIcons[previousName] !== undefined){
              if(categoryIcons[datasetValue] === undefined){
                categoryIcons[datasetValue] = categoryIcons[previousName];
              }
              delete categoryIcons[previousName];
            }
            renameIconNameKey(categoryIconPaths, previousName, datasetValue);
          }
          currentCategoryName = datasetValue;
          c.name = datasetValue;
          if(Array.isArray(categories) && categories[sourceIndex] && typeof categories[sourceIndex] === 'object'){
            categories[sourceIndex].name = datasetValue;
          }
          menu.dataset.category = datasetValue;
          label.textContent = displayName;
          toggleInput.setAttribute('aria-label', `Toggle ${displayName} category`);
          iconPickerButton.setAttribute('aria-label', `Choose icon for ${displayName}`);
          previewImg.alt = `${displayName} icon preview`;
          deleteCategoryBtn.setAttribute('aria-label', `Delete ${displayName} category`);
          addSubBtn.setAttribute('aria-label', `Add subcategory to ${displayName}`);
          subMenusContainer.querySelectorAll('.subcategory-form-menu').forEach(subEl=>{
            subEl.dataset.category = datasetValue;
          });
          if(categoryLogo.querySelector('img')){
            categoryLogo.classList.add('has-icon');
          } else {
            updateCategoryIconDisplay('');
          }
          subNameUpdaters.forEach(fn=>{
            try{ fn(); }catch(err){}
          });
        };
        nameInput.addEventListener('input', applyCategoryNameChange);
        deleteCategoryBtn.addEventListener('click', async ()=>{
          const displayName = getCategoryDisplayName();
          const confirmed = await confirmFormbuilderDeletion(`Delete the "${displayName}" category?`, 'Delete Category');
          if(!confirmed) return;
          if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
            const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
            if(activeRow && menu.contains(activeRow)){
              closeSubcategoryFieldOverlay();
            }
          }
          delete categoryIcons[currentCategoryName];
          deleteIconKeys(categoryIconPaths, c.id, currentCategoryName);
          if(c.subs && Array.isArray(c.subs)){
            c.subs.forEach(subName => {
              const subId = c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, subName) ? c.subIds[subName] : null;
              deleteIconKeys(subcategoryIconPaths, subId, subName);
            });
          }
          menu.remove();
          notifyFormbuilderChange();
        });

        c.subs.forEach((sub, subIndex)=>{
          const subMenu = document.createElement('div');
          subMenu.className = 'subcategory-form-menu';
          subMenu.dataset.category = c.name;
          subMenu.dataset.subcategory = sub;
          subMenu.dataset.subIndex = String(subIndex);
          subMenu.setAttribute('aria-expanded','false');

          const subHeader = document.createElement('div');
          subHeader.className = 'formbuilder-subcategory-header';

          const subTriggerWrap = document.createElement('div');
          subTriggerWrap.className = 'options-dropdown subcategory-trigger-wrap';

          const subContentId = `subcategory-form-content-${baseId}-${subIndex}`;
          const subBtn = document.createElement('button');
          subBtn.type = 'button';
          subBtn.className = 'subcategory-form-trigger';
          subBtn.setAttribute('aria-expanded','false');
          subBtn.setAttribute('aria-controls', subContentId);

          const subLabelWrap = document.createElement('span');
          subLabelWrap.className = 'subcategory-label-wrap';

          const subLogo = document.createElement('span');
          subLogo.className = 'subcategory-logo';
          const subIconHtml = subcategoryIcons[sub] || '';
          const subIconLookup = lookupIconPath(subcategoryIconPaths, c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, sub) ? c.subIds[sub] : null, sub);
          const initialSubIconPath = subIconLookup.found ? (subIconLookup.path || '') : extractIconSrc(subIconHtml);
          if(initialSubIconPath){
            const normalizedInitialSub = applyNormalizeIconPath(initialSubIconPath);
            if(normalizedInitialSub){
              subcategoryIcons[sub] = `<img src="${normalizedInitialSub}" width="20" height="20" alt="">`;
            }
          }
          if(initialSubIconPath){
            const img = document.createElement('img');
            img.src = applyNormalizeIconPath(initialSubIconPath);
            img.width = 20;
            img.height = 20;
            img.alt = '';
            subLogo.appendChild(img);
            subLogo.classList.add('has-icon');
            if(!subIconLookup.found){
              writeIconPath(subcategoryIconPaths, c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, sub) ? c.subIds[sub] : null, sub, applyNormalizeIconPath(initialSubIconPath));
            }
          } else if(subIconHtml){
            subLogo.innerHTML = subIconHtml;
            subLogo.classList.add('has-icon');
          } else {
            subLogo.textContent = sub.charAt(0) || '';
          }

          const subLabel = document.createElement('span');
          subLabel.className = 'subcategory-label';
          subLabel.textContent = sub;

          subLabelWrap.append(subLogo, subLabel);

          const subArrow = document.createElement('span');
          subArrow.className = 'dropdown-arrow';
          subArrow.setAttribute('aria-hidden','true');

          subBtn.append(subLabelWrap, subArrow);
          subTriggerWrap.append(subBtn);

          const subToggle = document.createElement('label');
          subToggle.className = 'subcategory-form-toggle';
          const subInput = document.createElement('input');
          subInput.type = 'checkbox';
          subInput.checked = true;
          subInput.setAttribute('aria-label', `Toggle ${sub} subcategory`);
          const subSlider = document.createElement('span');
          subSlider.className = 'slider';
          subToggle.append(subInput, subSlider);

          subHeader.append(subTriggerWrap, subToggle);
          subMenu.append(subHeader);

          const subContent = document.createElement('div');
          subContent.className = 'subcategory-form-content';
          subContent.id = subContentId;
          subContent.hidden = true;

          const subNameInput = document.createElement('input');
          subNameInput.type = 'text';
          subNameInput.className = 'subcategory-name-input';
          subNameInput.placeholder = 'Subcategory Name';
          subNameInput.value = sub || '';

          const subIconPicker = document.createElement('div');
          subIconPicker.className = 'iconpicker-container';

          const subIconButton = document.createElement('button');
          subIconButton.type = 'button';
          subIconButton.className = 'iconpicker-button';
          subIconButton.textContent = initialSubIconPath ? 'Change Icon' : 'Choose Icon';

          const subPreview = document.createElement('div');
          subPreview.className = 'iconpicker-preview';
          const subPreviewLabel = document.createElement('span');
          subPreviewLabel.textContent = 'No Icon';
          const subPreviewImg = document.createElement('img');
          subPreviewImg.alt = `${sub} icon preview`;
          subPreview.append(subPreviewLabel, subPreviewImg);
    

          subIconPicker.append(subIconButton, subPreview);
          attachIconPicker(subIconButton, subIconPicker, {
            getCurrentPath: ()=> applyNormalizeIconPath(getSubcategoryIconPath(c, currentSubName)),
            onSelect: value => {
              updateSubIconDisplay(value);
              notifyFormbuilderChange();
            },
            label: `Choose icon for ${sub}`,
            parentMenu: subContent,
            parentCategoryMenu: menu
          });

          const deleteSubBtn = document.createElement('button');
          deleteSubBtn.type = 'button';
          deleteSubBtn.className = 'delete-subcategory-btn';
          deleteSubBtn.textContent = 'Delete Subcategory';
          deleteSubBtn.setAttribute('aria-label', `Delete ${sub} subcategory from ${c.name}`);

          const subPlaceholder = document.createElement('p');
          subPlaceholder.className = 'subcategory-form-placeholder';
          subPlaceholder.innerHTML = `Customize the <strong>${sub}</strong> subcategory.`;

          const fieldsSection = document.createElement('div');
          fieldsSection.className = 'subcategory-fields-section';

          const fieldsList = document.createElement('div');
          fieldsList.className = 'subcategory-fields-list';
          fieldsSection.appendChild(fieldsList);

          const addFieldBtn = document.createElement('button');
          addFieldBtn.type = 'button';
          addFieldBtn.className = 'add-field-btn';
          addFieldBtn.textContent = 'Add Field';
          addFieldBtn.setAttribute('aria-label', `Add field to ${sub}`);

          const ensureFieldDefaults = (field)=>{
            const safeField = field && typeof field === 'object' ? field : {};
            if(typeof safeField.name !== 'string'){
              safeField.name = '';
            } else if(!safeField.name.trim()){
              safeField.name = '';
            }
            if(safeField.type === 'venue-session-price'){
              safeField.type = 'venue-session-version-tier-price';
            }
            if(typeof safeField.type !== 'string' || !FORM_FIELD_TYPES.some(opt => opt.value === safeField.type)){
              safeField.type = 'text-box';
            }
            if(!safeField.name){
              const typeLabel = getFormFieldTypeLabel(safeField.type).trim();
              if(typeLabel){
                safeField.name = typeLabel;
              }
            }
            if(typeof safeField.placeholder !== 'string') safeField.placeholder = '';
            const requiresByDefault = safeField.type === 'title'
              || safeField.type === 'description'
              || safeField.type === 'images';
            const hasRequiredProp = Object.prototype.hasOwnProperty.call(safeField, 'required');
            safeField.required = hasRequiredProp ? !!safeField.required : requiresByDefault;
            if(!Array.isArray(safeField.options)){
              safeField.options = [];
            }
            if(safeField.type === 'venue-session-version-tier-price'){
              safeField.options = normalizeVenueSessionOptions(safeField.options);
            } else if(safeField.type === 'version-price'){
              safeField.options = safeField.options.map(opt => {
                if(opt && typeof opt === 'object'){
                  return {
                    version: typeof opt.version === 'string' ? opt.version : '',
                    currency: typeof opt.currency === 'string' ? opt.currency : '',
                    price: typeof opt.price === 'string' ? opt.price : ''
                  };
                }
                const str = typeof opt === 'string' ? opt : String(opt ?? '');
                return { version: str, currency: '', price: '' };
              });
              if(safeField.options.length === 0){
                safeField.options.push({ version: '', currency: '', price: '' });
              }
            } else {
              safeField.options = safeField.options.map(opt => {
                if(typeof opt === 'string') return opt;
                if(opt && typeof opt === 'object' && typeof opt.version === 'string'){
                  return opt.version;
                }
                return String(opt ?? '');
              });
              if((safeField.type === 'dropdown' || safeField.type === 'radio-toggle') && safeField.options.length === 0){
                safeField.options.push('', '', '');
              }
            }
            if(safeField.type !== 'venue-session-version-tier-price'){
              resetVenueAutofillState(safeField);
            }
            return safeField;
          };

          const buildVenueSessionPreview = (previewField, baseId)=>{
            const editor = document.createElement('div');
            editor.className = 'venue-session-editor';
            editor.setAttribute('aria-required', previewField.required ? 'true' : 'false');
            const venueList = document.createElement('div');
            venueList.className = 'venue-session-venues';
            editor.appendChild(venueList);

            const ensureOptions = ()=>{
              previewField.options = normalizeVenueSessionOptions(previewField.options);
              if(!Array.isArray(previewField.options) || previewField.options.length === 0){
                previewField.options = [venueSessionCreateVenue()];
              }
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentYear = today.getFullYear();
            const minPickerDate = new Date(today);
            minPickerDate.setMonth(minPickerDate.getMonth() - 12);
            const maxPickerDate = new Date(today);
            maxPickerDate.setFullYear(maxPickerDate.getFullYear() + 2);

            const openPickers = new Set();
            const openSessions = new Set();
            const closeAllPickers = ()=>{
              openPickers.forEach(close => {
                try{ close(); }catch(err){}
              });
              openPickers.clear();
            };

            const createTransientInputAlert = message => {
              let lastTimestamp = 0;
              let activeAlert = null;
              let activeAlertTimeout = 0;
              return target => {
                const candidate = (target && typeof target.getBoundingClientRect === 'function')
                  ? target
                  : ((document && document.activeElement && typeof document.activeElement.getBoundingClientRect === 'function')
                    ? document.activeElement
                    : null);
                const inputEl = candidate && document.body && document.body.contains(candidate) ? candidate : null;
                if(!inputEl) return;
                const now = Date.now();
                if(now - lastTimestamp < 400){
                  if(activeAlert && typeof activeAlert.reposition === 'function'){
                    activeAlert.reposition();
                  }
                  return;
                }
                lastTimestamp = now;
                if(activeAlertTimeout){
                  clearTimeout(activeAlertTimeout);
                  activeAlertTimeout = 0;
                }
                if(activeAlert && typeof activeAlert.remove === 'function'){
                  activeAlert.remove();
                  activeAlert = null;
                }
                const handle = showCopyStyleMessage(message, inputEl);
                if(!handle) return;
                activeAlert = handle;
                activeAlertTimeout = window.setTimeout(()=>{
                  handle.remove();
                  if(activeAlert === handle){
                    activeAlert = null;
                  }
                  activeAlertTimeout = 0;
                }, 1500);
              };
            };

            const currencyAlertMessage = 'Please select a currency before entering a price.';
            const showCurrencyAlert = createTransientInputAlert(currencyAlertMessage);
            const sessionTimeAlertMessage = 'There is already a session for that time.';
            const showSessionTimeAlert = createTransientInputAlert(sessionTimeAlertMessage);

            const sanitizeSessionPriceValue = value => {
              const raw = typeof value === 'string' ? value : String(value ?? '');
              const cleaned = raw.replace(/[^0-9.,]/g, '');
              if(cleaned === '') return '';
              let integerPart = '';
              let fractionPart = '';
              let separator = '';
              for(let i = 0; i < cleaned.length; i++){
                const ch = cleaned[i];
                if(ch >= '0' && ch <= '9'){
                  if(separator){
                    if(fractionPart.length < 2){
                      fractionPart += ch;
                    }
                  } else {
                    integerPart += ch;
                  }
                } else if((ch === '.' || ch === ',') && !separator){
                  separator = ch;
                }
              }
              if(separator){
                if(integerPart === '') integerPart = '0';
                return fractionPart.length > 0 ? `${integerPart}${separator}${fractionPart}` : `${integerPart}${separator}`;
              }
              return integerPart;
            };

            const formatSessionPriceValue = value => {
              const sanitized = sanitizeSessionPriceValue(value);
              if(sanitized === '') return '';
              let normalized = sanitized.replace(',', '.');
              if(normalized === '') return '';
              if(normalized.startsWith('.')){
                normalized = `0${normalized}`;
              }
              const parts = normalized.split('.');
              let integerPart = parts[0].replace(/\D/g, '');
              if(integerPart === ''){
                integerPart = '0';
              }
              let fractionPart = parts[1] || '';
              fractionPart = fractionPart.replace(/\D/g, '');
              if(fractionPart.length === 0){
                fractionPart = '00';
              } else if(fractionPart.length === 1){
                fractionPart = `${fractionPart}0`;
              } else if(fractionPart.length > 2){
                fractionPart = fractionPart.slice(0, 2);
              }
              return `${integerPart}.${fractionPart}`;
            };

            const ensureVenueCurrencyState = venue => {
              let state = VENUE_CURRENCY_STATE.get(venue);
              if(!state){
                state = { currency: '' };
                VENUE_CURRENCY_STATE.set(venue, state);
              }
              if(typeof state.currency !== 'string'){
                state.currency = '';
              }
              return state;
            };

            const findFirstVenueCurrency = venue => {
              if(!venue || !Array.isArray(venue.sessions)) return '';
              for(const session of venue.sessions){
                if(!session || !Array.isArray(session.times)) continue;
                for(const time of session.times){
                  if(!time || !Array.isArray(time.versions)) continue;
                  for(const version of time.versions){
                    if(!version || !Array.isArray(version.tiers)) continue;
                    for(const tier of version.tiers){
                      if(tier && typeof tier.currency === 'string'){
                        const trimmed = tier.currency.trim();
                        if(trimmed) return trimmed;
                      }
                    }
                  }
                }
              }
              return '';
            };

            const getVenueCurrencyValue = venue => {
              const state = ensureVenueCurrencyState(venue);
              if(state.currency){
                return state.currency;
              }
              const detected = findFirstVenueCurrency(venue);
              if(detected){
                state.currency = detected;
                LAST_SELECTED_VENUE_CURRENCY = detected;
                return detected;
              }
              return '';
            };

            const setVenueCurrencyState = (venue, currency)=>{
              const state = ensureVenueCurrencyState(venue);
              const normalized = typeof currency === 'string' ? currency.trim() : '';
              state.currency = normalized;
              if(normalized){
                LAST_SELECTED_VENUE_CURRENCY = normalized;
              }
            };

            const applyCurrencyToVenueData = (venue, currency, options = {})=>{
              const normalized = typeof currency === 'string' ? currency.trim() : '';
              const onlyUnset = options && options.onlyUnset === true;
              const sourceTier = options ? options.sourceTier : null;
              const clearPrices = options && options.clearPrices === true;
              let changed = false;
              if(!venue || !Array.isArray(venue.sessions)) return changed;
              venue.sessions.forEach(session => {
                if(!session || !Array.isArray(session.times)) return;
                session.times.forEach(time => {
                  if(!time || !Array.isArray(time.versions)) return;
                  time.versions.forEach(version => {
                    if(!version || !Array.isArray(version.tiers)) return;
                    version.tiers.forEach(tierItem => {
                      if(!tierItem || typeof tierItem !== 'object') return;
                      if(sourceTier && tierItem === sourceTier) return;
                      const current = typeof tierItem.currency === 'string' ? tierItem.currency : '';
                      if(normalized){
                        if((!onlyUnset || !current) && current !== normalized){
                          tierItem.currency = normalized;
                          changed = true;
                        }
                      } else if(!onlyUnset && current){
                        tierItem.currency = '';
                        changed = true;
                      }
                      if(clearPrices && (!normalized || !current)){
                        if(typeof tierItem.price === 'string' && tierItem.price !== ''){
                          tierItem.price = '';
                          changed = true;
                        }
                      }
                    });
                  });
                });
              });
              return changed;
            };

            const sanitizeTimeInput = value => {
              const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
              if(digits.length <= 2){
                return digits;
              }
              return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
            };

            const formatSessionDate = iso => {
              if(!iso) return '';
              try{
                const parsed = parseISODate(iso);
                const options = {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                };
                if(parsed.getFullYear() !== currentYear){
                  options.year = 'numeric';
                }
                return parsed.toLocaleDateString('en-GB', options).replace(/,/g, '');
              }catch(err){
                return '';
              }
            };

            const getSessionPrimaryTime = session => {
              if(!session || !Array.isArray(session.times)) return '';
              for(let i = 0; i < session.times.length; i++){
                const candidate = session.times[i];
                if(candidate && typeof candidate.time === 'string' && candidate.time.trim() !== ''){
                  return candidate.time.trim();
                }
              }
              const first = session.times[0];
              return first && typeof first.time === 'string' ? first.time.trim() : '';
            };

            const formatSessionDateWithTime = (session, overrideTime) => {
              const dateLabel = formatSessionDate(session && session.date);
              const override = typeof overrideTime === 'string' ? overrideTime.trim() : '';
              const timeLabel = override || getSessionPrimaryTime(session);
              if(dateLabel && timeLabel){
                return `${dateLabel} ${timeLabel}`;
              }
              return dateLabel || timeLabel;
            };

            const setSessionDateInputValue = (input, session, overrideTime) => {
              if(!input) return;
              input.value = formatSessionDateWithTime(session, overrideTime);
            };

            const updateSessionDateInputDisplay = (venueIndex, sessionIndex, overrideTime) => {
              if(!previewField || !Array.isArray(previewField.options)) return;
              const venue = previewField.options[venueIndex];
              if(!venue || !Array.isArray(venue.sessions)) return;
              const session = venue.sessions[sessionIndex];
              if(!session) return;
              const selector = `.session-date-input[data-venue-index="${venueIndex}"][data-session-index="${sessionIndex}"]`;
              const input = editor.querySelector(selector);
              if(!input) return;
              setSessionDateInputValue(input, session, overrideTime);
            };

            const ensureSlot = (venue, index)=>{
              const state = getVenueAutofillState(previewField, venue);
              if(!Array.isArray(state.slots)){
                state.slots = [];
              }
              while(state.slots.length <= index){
                state.slots.push({ value: '', locked: false, source: null });
              }
              const slot = state.slots[index];
              if(!slot || typeof slot !== 'object'){
                state.slots[index] = { value: '', locked: false, source: null };
                return state.slots[index];
              }
              if(typeof slot.value !== 'string') slot.value = '';
              if(typeof slot.locked !== 'boolean') slot.locked = false;
              if(!Object.prototype.hasOwnProperty.call(slot, 'source')) slot.source = null;
              return slot;
            };

            const resetSlotIfEmpty = (venue, index)=>{
              const state = getVenueAutofillState(previewField, venue);
              if(!state || !Array.isArray(state.slots) || !state.slots[index]) return;
              const allEmpty = venue.sessions.every(sess => {
                const t = sess.times[index];
                return !t || !t.time || !t.time.trim();
              });
              if(allEmpty){
                state.slots[index].value = '';
                state.slots[index].locked = false;
                state.slots[index].source = null;
              }
            };

            const isSessionMirrorLocked = venue => {
              const state = getVenueAutofillState(previewField, venue);
              if(typeof state.sessionMirrorLocked !== 'boolean'){
                state.sessionMirrorLocked = false;
              }
              return state.sessionMirrorLocked;
            };

            const lockSessionMirror = venue => {
              const state = getVenueAutofillState(previewField, venue);
              if(state.sessionMirrorLocked === true) return;
              state.sessionMirrorLocked = true;
              if(Array.isArray(state.slots)){
                state.slots.forEach(slot => {
                  if(slot && typeof slot === 'object'){
                    slot.locked = true;
                  }
                });
              }
            };

            const forEachOtherSession = (venue, callback)=>{
              if(!venue || !Array.isArray(venue.sessions)) return;
              venue.sessions.forEach((sess, idx)=>{
                if(idx === 0 || !sess) return;
                callback(sess, idx);
              });
            };

            const cloneVersionsFromTime = sourceTime => {
              const versions = sourceTime && Array.isArray(sourceTime.versions) ? sourceTime.versions : [];
              return versions.length ? versions.map(cloneVenueSessionVersion) : [venueSessionCreateVersion()];
            };

            const cloneSessionTimesFromFirst = (venue, targetSession)=>{
              if(!venue || !targetSession) return;
              if(isSessionMirrorLocked(venue)) return;
              const sessions = Array.isArray(venue.sessions) ? venue.sessions : [];
              if(sessions.length === 0) return;
              const template = sessions[0];
              if(!template || template === targetSession) return;
              const preservedDate = typeof targetSession.date === 'string' ? targetSession.date : '';
              const preservedTimes = Array.isArray(targetSession.times)
                ? targetSession.times.map(time => (time && typeof time.time === 'string') ? time.time : '')
                : [];
              const times = Array.isArray(template.times) ? template.times : [];
              targetSession.times = times.length ? times.map(cloneVenueSessionTime) : [venueSessionCreateTime()];
              targetSession.date = preservedDate;
              const referenceTimes = times;
              const referenceFirstTime = referenceTimes[0];
              if(targetSession.times.length === 0){
                targetSession.times.push(venueSessionCreateTime());
              }
              if(targetSession !== template){
                targetSession.times.forEach((time, index)=>{
                  time.samePricingSourceIndex = 0;
                  if(index === 0){
                    if(referenceFirstTime){
                      time.samePricingAsAbove = true;
                      time.versions = cloneVersionsFromTime(referenceFirstTime);
                      time.tierAutofillLocked = true;
                    } else {
                      time.samePricingAsAbove = false;
                      time.tierAutofillLocked = false;
                    }
                  }
                  if(preservedTimes[index]){
                    time.time = preservedTimes[index];
                  }
                });
                const targetFirstTime = targetSession.times[0];
                targetSession.times.forEach((time, index)=>{
                  if(index > 0){
                    time.samePricingAsAbove = true;
                    if(targetFirstTime && targetFirstTime !== time){
                      time.versions = cloneVersionsFromTime(targetFirstTime);
                    }
                    time.tierAutofillLocked = true;
                  }
                });
              }
            };

            const flattenSessionTimes = venue => {
              if(!venue || !Array.isArray(venue.sessions)) return;
              const pendingInsertions = [];
              let requiresLock = false;
              venue.sessions.forEach((session, index)=>{
                if(!session) return;
                if(!Array.isArray(session.times) || session.times.length === 0){
                  session.times = [venueSessionCreateTime()];
                }
                const sanitizedTimes = session.times.filter(Boolean);
                if(sanitizedTimes.length <= 1){
                  session.times = sanitizedTimes.length ? [sanitizedTimes[0]] : [venueSessionCreateTime()];
                  const firstTime = session.times[0];
                  if(firstTime){
                    if(typeof firstTime.samePricingAsAbove !== 'boolean'){
                      firstTime.samePricingAsAbove = false;
                    }
                    if(!Number.isInteger(firstTime.samePricingSourceIndex) || firstTime.samePricingSourceIndex < 0){
                      firstTime.samePricingSourceIndex = 0;
                    }
                  }
                  return;
                }
                requiresLock = true;
                const primaryTime = cloneVenueSessionTime(sanitizedTimes[0]);
                primaryTime.samePricingSourceIndex = 0;
                primaryTime.tierAutofillLocked = !!primaryTime.tierAutofillLocked;
                session.times = [primaryTime];
                const clones = [];
                for(let i = 1; i < sanitizedTimes.length; i++){
                  const cloneSession = cloneVenueSessionSession(session);
                  cloneSession.times = [cloneVenueSessionTime(sanitizedTimes[i])];
                  const firstCloneTime = cloneSession.times[0];
                  if(firstCloneTime){
                    firstCloneTime.samePricingSourceIndex = 0;
                    firstCloneTime.tierAutofillLocked = !!firstCloneTime.tierAutofillLocked;
                  }
                  clones.push(cloneSession);
                }
                if(clones.length){
                  pendingInsertions.push({ index, clones });
                }
              });
              if(requiresLock){
                lockSessionMirror(venue);
              }
              if(!pendingInsertions.length) return;
              let offset = 0;
              pendingInsertions.forEach(entry => {
                const insertIndex = entry.index + 1 + offset;
                venue.sessions.splice(insertIndex, 0, ...entry.clones);
                offset += entry.clones.length;
              });
            };

            const applyAutofillToSession = (venue, session)=>{
              if(!session) return;
              cloneSessionTimesFromFirst(venue, session);
              if(isSessionMirrorLocked(venue)) return;
              const state = getVenueAutofillState(previewField, venue);
              const slots = Array.isArray(state.slots) ? state.slots : [];
              for(let i = 0; i < slots.length; i++){
                const slot = slots[i];
                if(!slot || typeof slot !== 'object' || !slot.value || slot.locked) continue;
                const target = session.times[i] || (session.times[i] = venueSessionCreateTime());
                if(!target.time){
                  target.time = slot.value;
                }
              }
            };

            const ensureSessionStructure = (venue)=>{
              if(!Array.isArray(venue.sessions)){
                venue.sessions = [venueSessionCreateSession()];
              }
              if(venue.sessions.length === 0){
                venue.sessions.push(venueSessionCreateSession());
              }
              flattenSessionTimes(venue);
              if(!isSessionMirrorLocked(venue)){
                venue.sessions.forEach((session, index)=>{
                  if(index === 0) return;
                  cloneSessionTimesFromFirst(venue, session);
                });
              }
              let maxTimes = 0;
              venue.sessions.forEach(session => {
                if(!Array.isArray(session.times)){
                  session.times = [venueSessionCreateTime()];
                }
                if(session.times.length === 0){
                  session.times.push(venueSessionCreateTime());
                }
                session.times.forEach((time, timeIndex) => {
                  if(!Array.isArray(time.versions)){
                    time.versions = [venueSessionCreateVersion()];
                  }
                  if(time.versions.length === 0){
                    time.versions.push(venueSessionCreateVersion());
                  }
                  if(typeof time.samePricingAsAbove !== 'boolean'){
                    time.samePricingAsAbove = timeIndex > 0;
                  }
                  const sourceIndex = Number(time.samePricingSourceIndex);
                  if(!Number.isInteger(sourceIndex) || sourceIndex < 0){
                    time.samePricingSourceIndex = 0;
                  }
                  if(typeof time.tierAutofillLocked !== 'boolean'){
                    time.tierAutofillLocked = false;
                  }
                  time.versions.forEach(version => {
                    if(!Array.isArray(version.tiers)){
                      version.tiers = [venueSessionCreateTier()];
                    }
                    if(version.tiers.length === 0){
                      version.tiers.push(venueSessionCreateTier());
                    }
                  });
                });
                maxTimes = Math.max(maxTimes, session.times.length);
              });
              const state = getVenueAutofillState(previewField, venue);
              if(!Array.isArray(state.slots)) state.slots = [];
              while(state.slots.length < maxTimes){
                state.slots.push({ value: '', locked: false, source: null });
              }
              while(state.slots.length > maxTimes){
                state.slots.pop();
              }
              for(let i = 0; i < maxTimes; i++){
                ensureSlot(venue, i);
              }
              venue.sessions.forEach(session => {
                while(session.times.length < maxTimes){
                  session.times.push(venueSessionCreateTime());
                }
              });
              if(!isSessionMirrorLocked(venue)){
                const template = venue.sessions[0];
                if(template && Array.isArray(template.times)){
                  template.times.forEach((time, index)=>{
                    const slot = ensureSlot(venue, index);
                    slot.value = typeof time.time === 'string' ? time.time : '';
                    slot.source = time;
                    slot.locked = false;
                  });
                }
              }
            };

            const addVenue = (afterIndex)=>{
              ensureOptions();
              const venues = previewField.options;
              const newVenue = venueSessionCreateVenue();
              let defaultCurrency = '';
              if(Array.isArray(venues) && venues.length > 0){
                const referenceIndex = Math.min(Math.max(afterIndex, 0), venues.length - 1);
                const referenceVenue = venues[referenceIndex];
                if(referenceVenue){
                  defaultCurrency = getVenueCurrencyValue(referenceVenue) || defaultCurrency;
                }
              }
              if(!defaultCurrency && LAST_SELECTED_VENUE_CURRENCY){
                defaultCurrency = LAST_SELECTED_VENUE_CURRENCY;
              }
              if(defaultCurrency){
                applyCurrencyToVenueData(newVenue, defaultCurrency);
                setVenueCurrencyState(newVenue, defaultCurrency);
              }
              venues.splice(afterIndex + 1, 0, newVenue);
              openSessions.clear();
              notifyFormbuilderChange();
              renderVenues({ type: 'venue-name', venueIndex: afterIndex + 1 });
            };

            const removeVenue = (index)=>{
              ensureOptions();
              if(previewField.options.length <= 1) return;
              const removed = previewField.options.splice(index, 1)[0];
              const state = VENUE_TIME_AUTOFILL_STATE.get(previewField);
              if(state && removed){
                try{ state.delete(removed); }catch(err){}
              }
              openSessions.clear();
              notifyFormbuilderChange();
              const nextIndex = Math.max(0, index - 1);
              renderVenues({ type: 'venue-name', venueIndex: nextIndex });
            };

            const requestVenueRemoval = (index)=>{
              ensureOptions();
              if(previewField.options.length <= 1) return;
              if(window.confirm('Are you sure you want to remove this venue?')){
                removeVenue(index);
              }
            };

            const addSession = (venue, venueIndex, afterIndex)=>{
              const sessions = venue.sessions;
              const newSession = venueSessionCreateSession();
              const maxTimes = Math.max(...sessions.map(sess => Array.isArray(sess.times) ? sess.times.length : 1), 1);
              while(newSession.times.length < maxTimes){
                newSession.times.push(venueSessionCreateTime());
              }
              const primarySession = sessions[0];
              const primaryTimes = Array.isArray(primarySession?.times) ? primarySession.times : [];
              const primaryFirstTime = primaryTimes[0];
              newSession.times.forEach((time, index)=>{
                time.samePricingSourceIndex = 0;
                if(index === 0){
                  if(primaryFirstTime){
                    time.samePricingAsAbove = true;
                    time.versions = cloneVersionsFromTime(primaryFirstTime);
                    time.tierAutofillLocked = true;
                  } else {
                    time.samePricingAsAbove = false;
                    time.tierAutofillLocked = false;
                  }
                } else {
                  time.samePricingAsAbove = true;
                  const baseTime = newSession.times[0];
                  if(primaryTimes[index]){
                    const referenceTime = primaryTimes[index];
                    time.versions = cloneVersionsFromTime(referenceTime);
                  } else if(baseTime && baseTime !== time){
                    time.versions = cloneVersionsFromTime(baseTime);
                  }
                  time.tierAutofillLocked = true;
                }
              });
              const venueCurrency = getVenueCurrencyValue(venue);
              if(venueCurrency){
                newSession.times.forEach(time => {
                  if(!time || !Array.isArray(time.versions)) return;
                  time.versions.forEach(version => {
                    if(!version || !Array.isArray(version.tiers)) return;
                    version.tiers.forEach(tier => {
                      if(tier && !tier.currency){
                        tier.currency = venueCurrency;
                      }
                    });
                  });
                });
              }
              sessions.splice(afterIndex + 1, 0, newSession);
              applyAutofillToSession(venue, newSession);
              openSessions.clear();
              notifyFormbuilderChange();
              renderVenues();
            };

            const removeSession = (venue, venueIndex, sessionIndex)=>{
              if(venue.sessions.length <= 1) return;
              venue.sessions.splice(sessionIndex, 1);
              openSessions.clear();
              notifyFormbuilderChange();
              renderVenues();
            };

            const addTimeSlot = (venue, venueIndex, sessionIndex, timeIndex)=>{
              if(!venue || !Array.isArray(venue.sessions)) return;
              const previouslyOpenSessions = new Set(openSessions);
              flattenSessionTimes(venue);
              const sessions = venue.sessions;
              if(sessionIndex < 0 || sessionIndex >= sessions.length) return;
              const baseSession = sessions[sessionIndex];
              if(!baseSession) return;
              const existingTimes = Array.isArray(baseSession.times) ? baseSession.times : [];
              const baseTime = existingTimes[timeIndex] || existingTimes[0] || venueSessionCreateTime();
              baseSession.times = [existingTimes[0] || cloneVenueSessionTime(baseTime) || venueSessionCreateTime()];
              const primaryTime = baseSession.times[0];
              if(primaryTime){
                primaryTime.samePricingAsAbove = false;
                primaryTime.samePricingSourceIndex = 0;
                primaryTime.tierAutofillLocked = !!primaryTime.tierAutofillLocked;
                primaryTime.displayOrder = 1;
              }
              const newSession = cloneVenueSessionSession(baseSession);
              newSession.date = baseSession.date;
              newSession.times = [cloneVenueSessionTime(baseTime)];
              const newTime = newSession.times[0];
              newTime.time = '';
              newTime.samePricingAsAbove = true;
              newTime.samePricingSourceIndex = 0;
              newTime.tierAutofillLocked = true;
              newTime.displayOrder = Number.isFinite(Number(timeIndex)) ? Number(timeIndex) + 2 : 2;
              lockSessionMirror(venue);
              sessions.splice(sessionIndex + 1, 0, newSession);
              const state = getVenueAutofillState(previewField, venue);
              if(Array.isArray(state.slots) && state.slots.length > 1){
                state.slots.length = 1;
              }
              const sessionExistsInOptions = sessionObj => previewField.options.some(v => Array.isArray(v?.sessions) && v.sessions.includes(sessionObj));
              openSessions.clear();
              previouslyOpenSessions.forEach(sessionObj => {
                if(sessionExistsInOptions(sessionObj)){
                  openSessions.add(sessionObj);
                }
              });
              openSessions.add(newSession);
              notifyFormbuilderChange();
              renderVenues({ type: 'session-time', venueIndex, sessionIndex: sessionIndex + 1, timeIndex: 0 });
            };

            const removeTimeSlot = (venue, venueIndex, sessionIndex, timeIndex)=>{
              if(!venue || !Array.isArray(venue.sessions) || venue.sessions.length === 0) return;
              flattenSessionTimes(venue);
              const session = venue.sessions[sessionIndex];
              if(!session) return;
              const times = Array.isArray(session.times) ? session.times : [];
              if(times.length <= 1){
                const state = getVenueAutofillState(previewField, venue);
                if(Array.isArray(state.slots) && state.slots.length > 1){
                  state.slots.length = 1;
                }
                lockSessionMirror(venue);
                removeSession(venue, venueIndex, sessionIndex);
                return;
              }
              const mirrorLocked = isSessionMirrorLocked(venue);
              const referenceSession = mirrorLocked ? venue.sessions[sessionIndex] : venue.sessions[0];
              if(!referenceSession) return;
              const totalSlots = Array.isArray(referenceSession.times) ? referenceSession.times.length : 0;
              if(totalSlots <= 1) return;
              if(mirrorLocked){
                const sess = venue.sessions[sessionIndex];
                if(sess && sess.times.length > timeIndex){
                  sess.times.splice(timeIndex, 1);
                }
                if(sess && sess.times.length === 0){
                  sess.times.push(venueSessionCreateTime());
                }
                lockSessionMirror(venue);
              } else {
                venue.sessions.forEach(sess => {
                  if(sess.times.length > timeIndex){
                    sess.times.splice(timeIndex, 1);
                  }
                  if(sess.times.length === 0){
                    sess.times.push(venueSessionCreateTime());
                  }
                });
              }
              const state = getVenueAutofillState(previewField, venue);
              if(Array.isArray(state.slots) && state.slots.length > timeIndex){
                state.slots.splice(timeIndex, 1);
              }
              notifyFormbuilderChange();
              const nextTime = Math.max(0, Math.min(timeIndex, venue.sessions[sessionIndex]?.times.length - 1));
              renderVenues({ type: 'session-time', venueIndex, sessionIndex, timeIndex: nextTime });
            };

            const copyTemplateTiersToVersion = (time, targetVersion)=>{
              if(!time || !targetVersion) return;
              if(time.tierAutofillLocked) return;
              const template = Array.isArray(time.versions) ? time.versions[0] : null;
              if(!template || template === targetVersion) return;
              if(!Array.isArray(template.tiers) || template.tiers.length === 0) return;
              targetVersion.tiers = template.tiers.map(cloneVenueSessionTier);
            };

            const addVersion = (venue, venueIndex, sessionIndex, timeIndex, afterIndex)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              const timeVersionsRef = time.versions;
              const newVersion = venueSessionCreateVersion();
              const venueCurrency = getVenueCurrencyValue(venue);
              if(venueCurrency && Array.isArray(newVersion.tiers)){
                newVersion.tiers.forEach(tier => {
                  if(tier && !tier.currency){
                    tier.currency = venueCurrency;
                  }
                });
              }
              copyTemplateTiersToVersion(time, newVersion);
              time.versions.splice(afterIndex + 1, 0, newVersion);
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                  if(!Array.isArray(otherTime.versions)){
                    otherTime.versions = [venueSessionCreateVersion()];
                  }
                  if(otherTime.versions === timeVersionsRef){
                    return;
                  }
                  const clone = cloneVenueSessionVersion(newVersion);
                  otherTime.versions.splice(afterIndex + 1, 0, clone);
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              notifyFormbuilderChange();
              renderVenues({ type: 'version', venueIndex, sessionIndex, timeIndex, versionIndex: afterIndex + 1 });
            };

            const removeVersion = (venue, venueIndex, sessionIndex, timeIndex, versionIndex, expectedVersion = null)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              const versions = Array.isArray(time.versions) ? time.versions : [];
              if(versions.length <= 1) return;
              let targetVersion = expectedVersion ?? null;
              let targetIndex = targetVersion ? versions.indexOf(targetVersion) : -1;
              if(targetIndex === -1){
                targetIndex = typeof versionIndex === 'number' ? versionIndex : -1;
                if(targetIndex < 0 || targetIndex >= versions.length) return;
                targetVersion = versions[targetIndex];
              }
              if(!targetVersion) return;
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex];
                  if(!otherTime || !Array.isArray(otherTime.versions)) return;
                  if(otherTime.versions === versions){
                    otherTime.versions = otherTime.versions.map(cloneVenueSessionVersion);
                  }
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              versions.splice(targetIndex, 1);
              notifyFormbuilderChange();
              const focusVersion = Math.max(0, Math.min(targetIndex, versions.length - 1));
              renderVenues({ type: 'version', venueIndex, sessionIndex, timeIndex, versionIndex: focusVersion });
            };

            const addTier = (venue, venueIndex, sessionIndex, timeIndex, versionIndex, afterIndex)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              if(versionIndex > 0){
                lockTierAutofillIfNeeded(time, versionIndex);
              }
              const version = time.versions[versionIndex];
              const versionTiersRef = version.tiers;
              const newTier = venueSessionCreateTier();
              const venueCurrency = getVenueCurrencyValue(venue);
              if(venueCurrency){
                newTier.currency = venueCurrency;
              }
              version.tiers.splice(afterIndex + 1, 0, newTier);
              if(versionIndex === 0){
                syncTiersFromTemplate(time);
              }
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                  const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                  while(otherVersions.length <= versionIndex){
                    otherVersions.push(venueSessionCreateVersion());
                  }
                  const otherVersion = otherVersions[versionIndex];
                  if(!otherVersion) return;
                  if(otherVersion === version || otherVersion.tiers === versionTiersRef){
                    return;
                  }
                  const clone = cloneVenueSessionTier(newTier);
                  otherVersion.tiers.splice(afterIndex + 1, 0, clone);
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              notifyFormbuilderChange();
              renderVenues({ type: 'tier', venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex: afterIndex + 1 });
            };

            const removeTier = (venue, venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex, expectedVersion = null, expectedTier = null)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              const versions = Array.isArray(time.versions) ? time.versions : [];
              if(versions.length === 0) return;
              let targetVersion = expectedVersion ?? null;
              let targetVersionIndex = targetVersion ? versions.indexOf(targetVersion) : -1;
              if(targetVersionIndex === -1){
                targetVersionIndex = typeof versionIndex === 'number' ? versionIndex : -1;
                if(targetVersionIndex < 0 || targetVersionIndex >= versions.length) return;
                targetVersion = versions[targetVersionIndex];
              }
              if(!targetVersion) return;
              if(targetVersionIndex > 0){
                lockTierAutofillIfNeeded(time, targetVersionIndex);
              }
              const version = versions[targetVersionIndex];
              const tiers = version && Array.isArray(version.tiers) ? version.tiers : [];
              if(tiers.length <= 1) return;
              let targetTier = expectedTier ?? null;
              let targetTierIndex = targetTier ? tiers.indexOf(targetTier) : -1;
              if(targetTierIndex === -1){
                targetTierIndex = typeof tierIndex === 'number' ? tierIndex : -1;
                if(targetTierIndex < 0 || targetTierIndex >= tiers.length) return;
                targetTier = tiers[targetTierIndex];
              }
              if(!targetTier) return;
              const templateRemoval = targetVersionIndex === 0;
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex];
                  if(!otherTime || !Array.isArray(otherTime.versions)) return;
                  if(otherTime.versions === versions){
                    otherTime.versions = otherTime.versions.map(cloneVenueSessionVersion);
                    return;
                  }
                  const otherVersion = otherTime.versions[targetVersionIndex];
                  if(!otherVersion || !Array.isArray(otherVersion.tiers)) return;
                  if(otherVersion.tiers === tiers){
                    otherVersion.tiers = otherVersion.tiers.map(cloneVenueSessionTier);
                  }
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              tiers.splice(targetTierIndex, 1);
              if(templateRemoval){
                syncTiersFromTemplate(time);
              }
              notifyFormbuilderChange();
              const focusTier = Math.max(0, Math.min(targetTierIndex, tiers.length - 1));
              renderVenues({ type: 'tier', venueIndex, sessionIndex, timeIndex, versionIndex: targetVersionIndex, tierIndex: focusTier });
            };

            const focusRequest = { current: null };
            const setFocus = spec => { focusRequest.current = spec; };

            const applyFocus = ()=>{
              const spec = focusRequest.current;
              if(!spec) return;
              focusRequest.current = null;
              let selector = '';
              if(spec.type === 'venue-name'){
                selector = `.venue-name-input[data-venue-index="${spec.venueIndex}"]`;
              } else if(spec.type === 'session-date'){
                selector = `.session-date-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"]`;
              } else if(spec.type === 'session-time'){
                selector = `.session-time-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"]`;
              } else if(spec.type === 'version'){
                selector = `.seating_area-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"]`;
              } else if(spec.type === 'tier'){
                selector = `.pricing_tier-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"][data-tier-index="${spec.tierIndex}"]`;
              } else if(spec.type === 'price'){
                selector = `.session-price-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"][data-tier-index="${spec.tierIndex}"]`;
              }
              if(!selector) return;
              const target = editor.querySelector(selector);
              if(!target) return;
              requestAnimationFrame(()=>{
                try{
                  target.focus();
                  if(typeof target.select === 'function'){
                    target.select();
                  }
                }catch(err){}
              });
            };

            const createActionButton = (symbol, ariaLabel, onClick)=>{
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'tiny';
              btn.textContent = symbol;
              btn.setAttribute('aria-label', ariaLabel);
              btn.addEventListener('click', event => {
                event.preventDefault();
                onClick();
              });
              return btn;
            };

            const lockTierAutofillIfNeeded = (time, versionIndex)=>{
              if(!time || time.tierAutofillLocked) return false;
              if(typeof versionIndex !== 'number' || versionIndex <= 0) return false;
              const versionCount = Array.isArray(time.versions) ? time.versions.length : 0;
              if(versionCount <= 1) return false;
              time.tierAutofillLocked = true;
              return true;
            };

            const syncTiersFromTemplate = time => {
              if(!time || time.tierAutofillLocked) return false;
              const versions = Array.isArray(time.versions) ? time.versions : [];
              if(versions.length <= 1) return false;
              const template = versions[0];
              if(!template || !Array.isArray(template.tiers)) return false;
              const templateTiers = template.tiers;
              let changed = false;
              for(let index = 1; index < versions.length; index++){
                const version = versions[index];
                if(!version) continue;
                let tiers = Array.isArray(version.tiers) ? version.tiers : (version.tiers = []);
                if(tiers.length > templateTiers.length){
                  tiers.length = templateTiers.length;
                  changed = true;
                }
                for(let tierIndex = 0; tierIndex < templateTiers.length; tierIndex++){
                  const templateTier = templateTiers[tierIndex];
                  let targetTier = tiers[tierIndex];
                  if(!targetTier){
                    targetTier = venueSessionCreateTier();
                    tiers[tierIndex] = targetTier;
                    changed = true;
                  }
                  const templateName = typeof templateTier?.name === 'string' ? templateTier.name : '';
                  if(targetTier.name !== templateName){
                    targetTier.name = templateName;
                    changed = true;
                  }
                }
              }
              return changed;
            };

            const commitTimeValue = ({ venue, venueIndex, sessionIndex, timeIndex, timeObj, input })=>{
              const session = Array.isArray(venue.sessions) ? venue.sessions[sessionIndex] : null;
              const isMaster = sessionIndex === 0;
              if(!isMaster){
                lockSessionMirror(venue);
              }
              const mirrorLocked = isSessionMirrorLocked(venue);

              const clearTimeValue = ()=>{
                const previous = typeof timeObj.time === 'string' ? timeObj.time : '';
                if(input.value !== ''){
                  input.value = '';
                }
                if(previous){
                  timeObj.time = '';
                  notifyFormbuilderChange();
                }
                const slot = ensureSlot(venue, timeIndex);
                if(isMaster && !mirrorLocked){
                  slot.value = '';
                  slot.source = timeObj;
                  slot.locked = false;
                  forEachOtherSession(venue, (sess, idx)=>{
                    const targetTime = sess.times[timeIndex] || (sess.times[timeIndex] = venueSessionCreateTime());
                    if(targetTime.time){
                      targetTime.time = '';
                    }
                    const selector = `.session-time-input[data-venue-index="${venueIndex}"][data-session-index="${idx}"][data-time-index="${timeIndex}"]`;
                    const sibling = editor.querySelector(selector);
                    if(sibling){
                      sibling.value = '';
                      sibling.classList.remove('is-invalid');
                    }
                    updateSessionDateInputDisplay(venueIndex, idx);
                  });
                } else {
                  if(slot.source === timeObj){
                    slot.source = null;
                  }
                  slot.value = '';
                  slot.locked = true;
                }
                resetSlotIfEmpty(venue, timeIndex);
                input.classList.remove('is-invalid');
                updateSessionDateInputDisplay(venueIndex, sessionIndex);
                return previous;
              };

              const raw = input.value.trim();
              if(raw === ''){
                clearTimeValue();
                return;
              }
              if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)){
                input.classList.add('is-invalid');
                input.value = timeObj.time || '';
                return;
              }
              input.classList.remove('is-invalid');
              if(timeObj.time === raw){
                return;
              }

              let hasDuplicateTime = false;
              const currentDate = typeof session?.date === 'string' ? session.date : '';
              const sessionsToCheck = Array.isArray(venue.sessions) ? venue.sessions : [];
              for(let idx = 0; idx < sessionsToCheck.length && !hasDuplicateTime; idx++){
                const compareSession = sessionsToCheck[idx];
                if(!compareSession) continue;
                if(currentDate){
                  if(typeof compareSession.date !== 'string' || compareSession.date !== currentDate) continue;
                } else if(compareSession !== session){
                  continue;
                }
                const compareTimes = Array.isArray(compareSession.times) ? compareSession.times : [];
                for(let tIdx = 0; tIdx < compareTimes.length; tIdx++){
                  const compareTime = compareTimes[tIdx];
                  if(!compareTime || compareTime === timeObj) continue;
                  if(typeof compareTime.time !== 'string') continue;
                  if(compareTime.time === raw){
                    hasDuplicateTime = true;
                    break;
                  }
                }
              }
              if(hasDuplicateTime){
                clearTimeValue();
                showSessionTimeAlert(input);
                return;
              }

              const slot = ensureSlot(venue, timeIndex);
              timeObj.time = raw;
              updateSessionDateInputDisplay(venueIndex, sessionIndex);
              if(isMaster && !mirrorLocked){
                slot.value = raw;
                slot.source = timeObj;
                slot.locked = false;
                forEachOtherSession(venue, (sess, idx)=>{
                  const targetTime = sess.times[timeIndex] || (sess.times[timeIndex] = venueSessionCreateTime());
                  targetTime.time = raw;
                  const selector = `.session-time-input[data-venue-index="${venueIndex}"][data-session-index="${idx}"][data-time-index="${timeIndex}"]`;
                  const sibling = editor.querySelector(selector);
                  if(sibling){
                    sibling.value = raw;
                    sibling.classList.remove('is-invalid');
                  }
                  updateSessionDateInputDisplay(venueIndex, idx);
                });
              } else {
                slot.value = raw;
                slot.source = timeObj;
                slot.locked = true;
              }
              notifyFormbuilderChange();
            };

            const setupDatePicker = (input, venue, session, venueIndex, sessionIndex, options = {})=>{
              const trigger = options && options.trigger ? options.trigger : input;
              let picker = null;
              let todayMonthNode = null;
              let todayMarker = null;
              let markerScrollTarget = null;
              let markerScrollListener = null;
              let markerScrollOptions = null;

              const cleanupMarker = ()=>{
                if(todayMarker){
                  todayMarker.remove();
                  todayMarker = null;
                }
                if(markerScrollTarget && markerScrollListener){
                  removeScrollListener(markerScrollTarget, markerScrollListener, markerScrollOptions);
                }
                markerScrollTarget = null;
                markerScrollListener = null;
                markerScrollOptions = null;
                todayMonthNode = null;
              };

              const scrollToMonth = (scrollEl, monthEl, behavior = 'auto')=>{
                if(!scrollEl || !monthEl) return 0;
                const left = monthEl.offsetLeft;
                scrollEl.scrollTo({ left, behavior });
                return left;
              };

              const scrollToTodayMonth = (behavior = 'auto')=>{
                if(!picker || !todayMonthNode) return;
                const scrollEl = picker.querySelector('.calendar-scroll');
                if(!scrollEl) return;
                const left = scrollToMonth(scrollEl, todayMonthNode, behavior);
                if(todayMarker){
                  const base = parseFloat(todayMarker.dataset.pos || '0');
                  todayMarker.style.left = `${base + left}px`;
                }
              };

              const selectedDates = new Set(
                Array.isArray(venue.sessions)
                  ? venue.sessions
                      .map(sess => (sess && typeof sess.date === 'string') ? sess.date : '')
                      .filter(Boolean)
                  : []
              );
              if(session && typeof session.date === 'string' && session.date){
                selectedDates.add(session.date);
              }
              const isoCells = new Map();
              const pickerHostRow = input.closest('.session-date-row');
              const parentSubMenu = input.closest('.subcategory-form-menu');
              const parentCategoryMenu = input.closest('.category-form-menu');
              let activePickerHost = null;
              const closePicker = ()=>{
                if(activePickerHost){
                  activePickerHost.classList.remove('has-open-session-picker');
                  activePickerHost = null;
                }
                if(parentSubMenu){
                  parentSubMenu.classList.remove('has-floating-overlay');
                }
                if(parentCategoryMenu){
                  parentCategoryMenu.classList.remove('has-floating-overlay');
                }
                if(!picker) return;
                cleanupMarker();
                picker.remove();
                picker = null;
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('keydown', onKeydown, true);
                openPickers.delete(closePicker);
              };
              const isTriggerElement = element => {
                if(!trigger || !(trigger instanceof Element)) return false;
                return trigger === element || trigger.contains(element);
              };
              const onPointerDown = event => {
                if(!picker) return;
                const target = event.target;
                if(target === input || (input && typeof input.contains === 'function' && input.contains(target))) return;
                if(isTriggerElement(target)) return;
                if(picker.contains(target)) return;
                closePicker();
              };
              const onKeydown = event => {
                if(event.key === 'Escape'){
                  event.preventDefault();
                  closePicker();
                  const focusTarget = trigger || input;
                  if(focusTarget && typeof focusTarget.focus === 'function'){
                    try{ focusTarget.focus(); }catch(err){}
                  }
                }
              };
              const updateCellSelection = iso => {
                const cell = isoCells.get(iso);
                if(!cell) return;
                if(selectedDates.has(iso)){
                  cell.classList.add('selected');
                } else {
                  cell.classList.remove('selected');
                }
              };
              const toggleDate = iso => {
                if(!iso) return;
                if(selectedDates.has(iso)){
                  selectedDates.delete(iso);
                } else {
                  selectedDates.add(iso);
                }
                updateCellSelection(iso);
              };
              const applySelection = ()=>{
                if(selectedDates.size === 0){
                  closePicker();
                  return;
                }
                const sorted = Array.from(selectedDates).sort();
                const existingSessions = Array.isArray(venue.sessions) ? [...venue.sessions] : [];
                const maxTimes = Math.max(
                  ...existingSessions.map(sess => Array.isArray(sess?.times) ? sess.times.length : 1),
                  1
                );
                const sessionsByIso = new Map();
                existingSessions.forEach(sess => {
                  if(sess && typeof sess.date === 'string' && sess.date){
                    if(!sessionsByIso.has(sess.date)){
                      sessionsByIso.set(sess.date, []);
                    }
                    sessionsByIso.get(sess.date).push(sess);
                  }
                });
                const usedSessions = new Set();
                const takeUnused = ()=>{
                  for(const candidate of existingSessions){
                    if(!candidate || usedSessions.has(candidate)) continue;
                    if(typeof candidate.date === 'string' && candidate.date && sorted.includes(candidate.date)){
                      continue;
                    }
                    usedSessions.add(candidate);
                    return candidate;
                  }
                  return null;
                };
                const newSessions = [];
                sorted.forEach(iso => {
                  let active = null;
                  const pool = sessionsByIso.get(iso);
                  if(pool && pool.length){
                    active = pool.shift();
                  }
                  if(active && usedSessions.has(active)){
                    active = null;
                  }
                  if(active){
                    usedSessions.add(active);
                  } else {
                    active = takeUnused();
                  }
                  if(!active){
                    active = venueSessionCreateSession();
                    while(active.times.length < maxTimes){
                      active.times.push(venueSessionCreateTime());
                    }
                    applyAutofillToSession(venue, active);
                  }
                  active.date = iso;
                  newSessions.push(active);
                });
                if(newSessions.length === 0){
                  closePicker();
                  return;
                }
                venue.sessions.splice(0, venue.sessions.length, ...newSessions);
                openSessions.clear();
                notifyFormbuilderChange();
                closePicker();
                renderVenues();
              };
              const buildCalendar = ()=>{
                isoCells.clear();
                cleanupMarker();
                const container = document.createElement('div');
                container.className = 'session-date-picker';
                const instructions = document.createElement('p');
                instructions.className = 'session-date-picker-instructions';
                instructions.textContent = 'Select all the dates for this venue.';
                container.appendChild(instructions);
                const scroll = document.createElement('div');
                scroll.className = 'calendar-scroll';
                setupHorizontalWheel(scroll);
                const calendar = document.createElement('div');
                calendar.className = 'calendar';
                const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const todayIso = toISODate(today);
                let current = new Date(minPickerDate.getFullYear(), minPickerDate.getMonth(), 1);
                const end = new Date(maxPickerDate.getFullYear(), maxPickerDate.getMonth(), 1);
                while(current <= end){
                  const monthDate = new Date(current.getFullYear(), current.getMonth(), 1);
                  const monthEl = document.createElement('div');
                  monthEl.className = 'month';
                  const header = document.createElement('div');
                  header.className = 'calendar-header';
                  header.textContent = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                  monthEl.appendChild(header);
                  const grid = document.createElement('div');
                  grid.className = 'grid';
                  weekdays.forEach(day => {
                    const wd = document.createElement('div');
                    wd.className = 'weekday';
                    wd.textContent = day;
                    grid.appendChild(wd);
                  });
                  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                  const startDow = firstDay.getDay();
                  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                  const totalCells = 42;
                  for(let i = 0; i < totalCells; i++){
                    const cell = document.createElement('div');
                    cell.className = 'day';
                    const dayNum = i - startDow + 1;
                    if(i < startDow || dayNum > daysInMonth){
                      cell.classList.add('empty');
                    } else {
                      cell.textContent = dayNum;
                      const dateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum);
                      dateObj.setHours(0,0,0,0);
                      const iso = toISODate(dateObj);
                      cell.dataset.iso = iso;
                      isoCells.set(iso, cell);
                      if(dateObj < today){
                        cell.classList.add('past');
                      } else {
                        cell.classList.add('future');
                      }
                      if(iso === todayIso){
                        cell.classList.add('today');
                        if(!todayMonthNode){
                          todayMonthNode = monthEl;
                        }
                      }
                      if(selectedDates.has(iso)){
                        cell.classList.add('selected');
                      }
                      cell.addEventListener('click', ()=>{
                        toggleDate(iso);
                      });
                    }
                    grid.appendChild(cell);
                  }
                  monthEl.appendChild(grid);
                  calendar.appendChild(monthEl);
                  current.setMonth(current.getMonth() + 1);
                }
                scroll.appendChild(calendar);
                container.appendChild(scroll);
                const actions = document.createElement('div');
                actions.className = 'calendar-actions';
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'calendar-action cancel';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.addEventListener('click', ()=> closePicker());
                actions.appendChild(cancelBtn);
                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = 'calendar-action ok primary';
                okBtn.textContent = 'OK';
                okBtn.addEventListener('click', ()=> applySelection());
                actions.appendChild(okBtn);
                container.appendChild(actions);
                container.addEventListener('keydown', event => {
                  if(event.key !== 'Enter' || event.repeat){
                    return;
                  }
                  const target = event.target;
                  if(target instanceof HTMLButtonElement){
                    return;
                  }
                  event.preventDefault();
                  applySelection();
                });
                queueMicrotask(() => okBtn.focus());
                return container;
              };
              const initializePicker = pickerEl => {
                if(!pickerEl) return;