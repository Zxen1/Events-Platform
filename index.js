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
      categories: [
        { name:"What's On", subs:["Live Gigs","Live Theatre","Screenings","Artwork","Live Sport","Other Events"], subFields:{} },
        { name:"Opportunities", subs:["Stage Auditions","Screen Auditions","Clubs","Jobs","Volunteers","Competitions","Other Opportunities"], subFields:{} },
        { name:"Learning", subs:["Tutors","Education Centres","Courses","Other Learning"], subFields:{} },
        { name:"Buy and Sell", subs:["Wanted","For Sale","Freebies"], subFields:{} },
        { name:"For Hire", subs:["Performers","Staff","Goods and Services"], subFields:{} }
      ],
      versionPriceCurrencies: ['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD']
    };

    DEFAULT_FORMBUILDER_SNAPSHOT.categories = DEFAULT_FORMBUILDER_SNAPSHOT.categories.map(cat => ({
      name: cat.name,
      subs: Array.isArray(cat.subs) ? cat.subs.slice() : [],
      subFields: (Array.isArray(cat.subs) ? cat.subs : []).reduce((acc, sub) => {
        acc[sub] = [];
        return acc;
      }, {})
    }));

    function normalizeCategoriesSnapshot(sourceCategories){
      const list = Array.isArray(sourceCategories) ? sourceCategories : [];
      const normalized = list.map(item => {
        if(!item || typeof item !== 'object') return null;
        const name = typeof item.name === 'string' ? item.name : '';
        if(!name) return null;
        const subs = Array.isArray(item.subs) ? item.subs.filter(sub => typeof sub === 'string' && sub) : [];
        const rawSubFields = (item.subFields && typeof item.subFields === 'object' && !Array.isArray(item.subFields)) ? item.subFields : {};
        const subFields = {};
        subs.forEach(sub => {
          const fields = Array.isArray(rawSubFields[sub]) ? rawSubFields[sub].map(cloneFieldValue) : [];
          subFields[sub] = fields;
        });
        return { name, subs, subFields };
      }).filter(Boolean);
      const base = normalized.length ? normalized : DEFAULT_FORMBUILDER_SNAPSHOT.categories.map(cat => ({
        name: cat.name,
        subs: cat.subs.slice(),
        subFields: cat.subs.reduce((acc, sub) => {
          acc[sub] = [];
          return acc;
        }, {})
      }));
      base.forEach(cat => {
        if(!cat.subFields || typeof cat.subFields !== 'object' || Array.isArray(cat.subFields)){
          cat.subFields = {};
        }
        cat.subs.forEach(sub => {
          if(!Array.isArray(cat.subFields[sub])){
            cat.subFields[sub] = [];
          }
        });
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
      return {
        categories: normalizedCategories,
        versionPriceCurrencies: normalizedCurrencies
      };
    }

    window.getSavedFormbuilderSnapshot = getSavedFormbuilderSnapshot;
    window.normalizeFormbuilderSnapshot = normalizeFormbuilderSnapshot;

    const initialFormbuilderSnapshot = normalizeFormbuilderSnapshot(getSavedFormbuilderSnapshot());
    const categories = window.categories = initialFormbuilderSnapshot.categories;
    const VERSION_PRICE_CURRENCIES = window.VERSION_PRICE_CURRENCIES = initialFormbuilderSnapshot.versionPriceCurrencies.slice();
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

    const DEFAULT_SUBCATEGORY_FIELDS = [
      { name: 'Title', type: 'title', placeholder: 'ie. Elvis Presley - Live on Stage', required: true },
      { name: 'Description', type: 'description', placeholder: 'ie. Come and enjoy the music!', required: true },
      { name: 'Images', type: 'images', placeholder: '', required: true }
    ];
      const ICON_BASE = window.ICON_BASE = {
        "What's On": "whats-on-category-icon",
        "Opportunities": "opportunities-category-icon",
        "Learning": "learning-category-icon",
        "Buy and Sell": "Buy-and-sell-category-icon",
        "For Hire": "For-hire-category-icon"
      };
    const COLOR_NAMES = window.COLOR_NAMES = ['blue','dark-yellow','green','indigo','orange','red','violet'];
    const subcategoryColorMap = window.subcategoryColorMap = {};
    let subcategoryColorCursor = 0;
    categories.forEach(cat => {
      (cat.subs || []).forEach(sub => {
        const color = COLOR_NAMES[subcategoryColorCursor % COLOR_NAMES.length];
        subcategoryColorMap[`${cat.name}::${sub}`] = color;
        subcategoryColorCursor++;
      });
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
    subcategoryColorMap["What's On::Other Events"] = 'red';
    subcategoryColorMap['Opportunities::Other Opportunities'] = 'red';
    subcategoryColorMap['Learning::Other Learning'] = 'red';
    const subcategoryIcons = window.subcategoryIcons = {};
    const subcategoryMarkers = window.subcategoryMarkers = {};
    subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] = MULTI_POST_MARKER_ICON_SRC;
    const subcategoryMarkerIds = window.subcategoryMarkerIds = {};
    const categoryShapes = window.categoryShapes = {};

    // --- Icon loader: ensures Mapbox images are available and quiets missing-image logs ---
    function attachIconLoader(mapInstance){
      if(!mapInstance) return () => Promise.resolve(false);
      const KNOWN = [
        'freebies','live-sport','volunteers','goods-and-services','clubs','artwork',
        'live-gigs','for-sale','education-centres','tutors'
      ];
      const BASES = [
        'assets/icons/subcategories/',
        'assets/icons/',
        'assets/images/icons/'
      ];
      const pending = new Map();

      const urlsFor = (name) => {
        const urls = [];
        const markers = window.subcategoryMarkers || {};
        const manual = markers[name] || null;
        const shouldLookupLocal = manual || KNOWN.includes(name);
        if(manual) urls.push(manual);
        if(shouldLookupLocal){
          const ratio = (window.devicePixelRatio || 1) >= 2 ? '@2x' : '';
          BASES.forEach(base => urls.push(`${base}${name}${ratio}.png`));
          BASES.forEach(base => urls.push(`${base}${name}.png`));
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

  function randomDates(){
    const count = 1 + Math.floor(rnd()*30);
    const now = new Date();
    return Array.from({length:count}, ()=>{
      const d = new Date(+now + Math.floor(rnd()*365)*86400000);
      return toISODate(d);
    }).sort();
  }

  function randomSchedule(){
    const count = 1 + Math.floor(rnd()*20);
    const now = new Date();
    return Array.from({length:count}, ()=>{
      const offset = Math.floor(rnd()*730) - 365; // past and future
      const d = new Date(+now + offset*86400000);
      const date = d.toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'}).replace(/,/g,'');
      const time = `${String(Math.floor(rnd()*24)).padStart(2,'0')}:${String(Math.floor(rnd()*4)*15).padStart(2,'0')}`;
      const full = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return {date, time, full};
    });
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
    const cat = pick(categories);
    const sub = pick(cat.subs);
    const id = 'FS'+i;
    const title = `${id} ${uniqueTitle(i*7777+13, fsCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const location = createRandomLocation(fsCity, fsLng, fsLat, {
      name: 'Federation Square',
      address: 'Swanston St & Flinders St, Melbourne VIC 3000, Australia',
      radius: 0.05
    });
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: fsCity,
      lng: location.lng, lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: randomDates(),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations: [location],
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- 100 posts in Tasmania ----
  const tasLng = 147.3272, tasLat = -42.8821;
  const tasCity = "Hobart, Tasmania";
  const todayTas = new Date(); todayTas.setHours(0,0,0,0);
  for(let i=0;i<100;i++){
    const cat = pick(categories);
    const sub = pick(cat.subs);
    const id = 'TAS'+i;
    const title = `${id} ${uniqueTitle(i*5311+23, tasCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const offset = 1 + i%30;
    const date = new Date(todayTas);
    date.setDate(date.getDate() + (i<50 ? -offset : offset));
    const location = createRandomLocation(tasCity, tasLng, tasLat, { radius: 0.05 });
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
      dates: [toISODate(date)],
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations: [location],
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
    const cat = pick(categories);
    const sub = pick(cat.subs);
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
      dates: randomDates(),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations: [location],
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
    const cat = pick(categories);
    const sub = pick(cat.subs);
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
      dates: randomDates(),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations: [location],
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
    const finalKey = coordKey(locationDetail.lng, locationDetail.lat);
    if(finalKey){
      existingCoordKeys.add(finalKey);
    }
    const cat = pick(categories);
    const sub = pick(cat.subs);
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
      dates: randomDates(),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations: [locationDetail],
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

    function syncMarkerSources(list, options = {}){
      const { force = false } = options;
      const collections = getMarkerCollections(list);
      const { postsData, signature, featureIndex } = collections;
      markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      let updated = false;
      if(map && typeof map.getSource === 'function'){
        const postsSource = map.getSource('posts');
        if(postsSource && (force || postsSource.__markerSignature !== signature)){
          try{ postsSource.setData(postsData); }catch(err){ console.error(err); }
          postsSource.__markerSignature = signature;
          updated = true;
        }
      }
      if(updated || force){
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
        const iconHtml = subcategoryIcons[subName] || '';
        logoSpan.innerHTML = '';
        if(iconHtml){
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
      const normalizeIconPath = (path)=> {
        if(typeof path !== 'string') return path;
        let next = path.replace(/-30(\.[^./]+)$/i, '-20$1');
        if(/icons-30\//i.test(next)){
          next = next.replace(/icons-30\//i, 'icons-20/');
        }
        return next;
      };
      const frag = document.createDocumentFragment();
      categories.forEach((c, index)=>{
        const baseId = slugify(c.name) || `category-${index + 1}`;
        const contentId = `category-form-content-${baseId}-${index}`;
        const editPanelId = `category-edit-panel-${baseId}-${index}`;

        const menu = document.createElement('div');
        menu.className = 'category-form-menu filter-category-menu';
        menu.dataset.category = c.name;
        menu.dataset.categoryIndex = String(index);
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
        const iconPrefix = (window.ICON_BASE || {})[c.name];
        if(iconPrefix){
          const img = document.createElement('img');
          img.src = `assets/icons-20/${iconPrefix}-20.webp`;
          img.width = 20;
          img.height = 20;
          img.alt = '';
          categoryLogo.appendChild(img);
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

        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'iconpicker-upload';
        const uploadLabelText = document.createElement('span');
        uploadLabelText.textContent = 'Upload Icon';
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.accept = 'image/*';
        uploadInput.setAttribute('aria-label', `Upload icon for ${c.name}`);
        uploadLabel.append(uploadLabelText, uploadInput);

        const preview = document.createElement('div');
        preview.className = 'iconpicker-preview';
        const previewLabel = document.createElement('span');
        previewLabel.textContent = 'No Icon';
        const previewImg = document.createElement('img');
        previewImg.alt = `${c.name} icon preview`;
        preview.append(previewLabel, previewImg);
        const baseIconPath20 = iconPrefix ? `assets/icons-20/${iconPrefix}-20.webp` : '';
        const baseIconPath = iconPrefix ? `assets/icons-30/${iconPrefix}-30.webp` : '';
        if(baseIconPath){
          previewImg.src = baseIconPath;
          preview.classList.add('has-image');
          previewLabel.textContent = '';
          uploadLabelText.textContent = 'Change Icon';
        }
        iconPicker.append(uploadLabel, preview);

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
        const getCategoryDisplayName = ()=> getCategoryNameValue() || lastCategoryName || 'Category';
        const updateCategoryIconDisplay = (src)=>{
          categoryLogo.innerHTML = '';
          if(src){
            const img = document.createElement('img');
            img.src = src;
            img.width = 20;
            img.height = 20;
            img.alt = '';
            categoryLogo.appendChild(img);
            categoryLogo.classList.add('has-icon');
          } else {
            categoryLogo.textContent = getCategoryDisplayName().charAt(0) || '';
            categoryLogo.classList.remove('has-icon');
          }
        };
        const applyCategoryNameChange = ()=>{
          const nameValue = getCategoryNameValue();
          if(nameValue){
            lastCategoryName = nameValue;
          }
          const displayName = getCategoryDisplayName();
          const datasetValue = displayName;
          menu.dataset.category = datasetValue;
          label.textContent = displayName;
          toggleInput.setAttribute('aria-label', `Toggle ${displayName} category`);
          uploadInput.setAttribute('aria-label', `Upload icon for ${displayName}`);
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
          subLogo.textContent = sub.charAt(0) || '';

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

          const subUploadLabel = document.createElement('label');
          subUploadLabel.className = 'iconpicker-upload';
          const subUploadLabelText = document.createElement('span');
          subUploadLabelText.textContent = 'Upload Icon';
          const subUploadInput = document.createElement('input');
          subUploadInput.type = 'file';
          subUploadInput.accept = 'image/*';
          subUploadInput.setAttribute('aria-label', `Upload icon for ${sub}`);
          subUploadLabel.append(subUploadLabelText, subUploadInput);

          const subPreview = document.createElement('div');
          subPreview.className = 'iconpicker-preview';
          const subPreviewLabel = document.createElement('span');
          subPreviewLabel.textContent = 'No Icon';
          const subPreviewImg = document.createElement('img');
          subPreviewImg.alt = `${sub} icon preview`;
          subPreview.append(subPreviewLabel, subPreviewImg);
          const subColorKey = (window.subcategoryColorMap || {})[`${c.name}::${sub}`] || '';
          const subIconPrefix = iconPrefix || '';
          const subIconPath = subIconPrefix
            ? (subColorKey ? `assets/icons-30/${subIconPrefix}-${subColorKey}-30.webp` : `assets/icons-30/${subIconPrefix}-30.webp`)
            : '';
          if(subIconPath){
            subPreviewImg.src = subIconPath;
            subPreview.classList.add('has-image');
            subPreviewLabel.textContent = '';
            subUploadLabelText.textContent = 'Change Icon';
          }

          subIconPicker.append(subUploadLabel, subPreview);

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
                selector = `.session-seating-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"]`;
              } else if(spec.type === 'tier'){
                selector = `.session-tier-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"][data-tier-index="${spec.tierIndex}"]`;
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
                const scrollEl = pickerEl.querySelector('.calendar-scroll');
                if(!scrollEl) return;
                scrollEl.setAttribute('tabindex', '0');
                const calendarEl = scrollEl.querySelector('.calendar');
                if(!calendarEl){
                  return;
                }
                const targetMonth = todayMonthNode || calendarEl.querySelector('.month');
                if(targetMonth){
                  scrollEl.scrollLeft = targetMonth.offsetLeft;
                }
                if(todayMonthNode){
                  const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
                  const track = scrollEl.clientWidth - 20;
                  const scrollPos = todayMonthNode.offsetLeft;
                  todayMarker = document.createElement('div');
                  todayMarker.className = 'today-marker';
                  const basePos = maxScroll > 0 ? (scrollPos / maxScroll) * track + 10 : 10;
                  todayMarker.dataset.pos = String(basePos);
                  todayMarker.style.left = `${basePos + scrollEl.scrollLeft}px`;
                  todayMarker.addEventListener('click', ()=> scrollToTodayMonth('smooth'));
                  scrollEl.appendChild(todayMarker);
                  const onScroll = ()=>{
                    if(!todayMarker) return;
                    const base = parseFloat(todayMarker.dataset.pos || '0');
                    todayMarker.style.left = `${base + scrollEl.scrollLeft}px`;
                  };
                  markerScrollListener = onScroll;
                  markerScrollTarget = scrollEl;
                  markerScrollOptions = addPassiveScrollListener(scrollEl, onScroll);
                  onScroll();
                }
                scrollToTodayMonth('auto');
              };
              const openPicker = ()=>{
                if(picker) return;
                closeAllPickers();
                picker = buildCalendar();
                const appendTarget = pickerHostRow || input.parentElement;
                if(pickerHostRow instanceof Element){
                  activePickerHost = pickerHostRow;
                } else if(appendTarget instanceof Element){
                  activePickerHost = appendTarget;
                } else {
                  activePickerHost = null;
                }
                if(activePickerHost){
                  activePickerHost.classList.add('has-open-session-picker');
                }
                if(appendTarget instanceof Element){
                  appendTarget.appendChild(picker);
                } else if(input.parentElement instanceof Element){
                  input.parentElement.appendChild(picker);
                }
                if(parentSubMenu){
                  parentSubMenu.classList.add('has-floating-overlay');
                }
                if(parentCategoryMenu){
                  parentCategoryMenu.classList.add('has-floating-overlay');
                }
                if(picker){
                  initializePicker(picker);
                  const pickerEl = picker;
                  const showPicker = ()=> pickerEl && pickerEl.classList.add('is-visible');
                  if(typeof requestAnimationFrame === 'function'){
                    requestAnimationFrame(showPicker);
                  } else {
                    showPicker();
                  }
                }
                document.addEventListener('pointerdown', onPointerDown, true);
                document.addEventListener('keydown', onKeydown, true);
                openPickers.add(closePicker);
              };
              if(trigger === input){
                input.addEventListener('focus', ()=> openPicker());
                input.addEventListener('click', ()=> openPicker());
              } else if(trigger){
                const handleTriggerClick = event => {
                  event.preventDefault();
                  event.stopPropagation();
                  openPicker();
                };
                const handleTriggerKeydown = event => {
                  if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
                    event.preventDefault();
                    openPicker();
                  }
                };
                trigger.addEventListener('click', handleTriggerClick);
                trigger.addEventListener('keydown', handleTriggerKeydown);
              }
              return { open: openPicker, close: closePicker };
            };

            const renderVenues = (nextFocus = null)=>{
              closeAllPickers();
              ensureOptions();
              let shouldNotifyAfterRender = false;
              const markAutoChange = ()=>{ shouldNotifyAfterRender = true; };
              if(nextFocus) setFocus(nextFocus);
              venueList.innerHTML = '';
              const datalistSeed = Date.now();
              previewField.options.forEach((venue, venueIndex)=>{
                ensureSessionStructure(venue);
                const venueCard = document.createElement('div');
                venueCard.className = 'venue-card';
                venueList.appendChild(venueCard);


                const venueLine = document.createElement('div');
                venueLine.className = 'venue-line';
                let geocoderInputRef = null;
                let nameResultsByKey = Object.create(null);
                let nameSearchTimeout = null;
                let nameSearchAbort = null;
                const NAME_AUTOCOMPLETE_DELAY = 220;
                const nameDatalistId = `venue-name-options-${datalistSeed}-${venueIndex}`;
                const venueNameDatalist = document.createElement('datalist');
                venueNameDatalist.id = nameDatalistId;
                venueCard.appendChild(venueNameDatalist);

                const clearNameSuggestions = ()=>{
                  nameResultsByKey = Object.create(null);
                  venueNameDatalist.innerHTML = '';
                };

                const getFeatureKey = (feature)=>{
                  if(!feature || typeof feature !== 'object') return '';
                  return feature.id
                    || (feature.properties && feature.properties.mapbox_id)
                    || feature.place_name
                    || feature.text
                    || '';
                };

                const updateNameSuggestions = (features)=>{
                  clearNameSuggestions();
                  if(!Array.isArray(features) || !features.length) return;
                  const seenKeys = new Set();
                  for(const feature of features){
                    if(!feature) continue;
                    const key = getFeatureKey(feature);
                    if(!key || seenKeys.has(key)) continue;
                    seenKeys.add(key);
                    const featureClone = cloneGeocoderFeature(feature);
                    nameResultsByKey[key] = featureClone;
                    const option = document.createElement('option');
                    const optionLabel = featureClone.place_name || featureClone.text || '';
                    option.value = featureClone.text || optionLabel;
                    if(optionLabel && optionLabel !== option.value){
                      option.label = optionLabel;
                      option.textContent = optionLabel;
                    } else if(optionLabel){
                      option.textContent = optionLabel;
                    }
                    option.dataset.featureKey = key;
                    venueNameDatalist.appendChild(option);
                  }
                };

                const applyFeatureToVenue = (feature, { updateName=false }={})=>{
                  if(!feature || typeof feature !== 'object') return;
                  const clone = cloneGeocoderFeature(feature);
                  const center = getMapboxVenueFeatureCenter(clone);
                  const placeName = typeof clone.place_name === 'string' ? clone.place_name : '';
                  const featureName = (typeof clone.text === 'string' && clone.text.trim())
                    ? clone.text.trim()
                    : (typeof clone.properties?.name === 'string' ? clone.properties.name.trim() : '');
                  if(updateName && featureName){
                    venue.name = featureName;
                    venueNameInput.value = featureName;
                  }
                  if(placeName){
                    venue.address = placeName;
                    if(geocoderInputRef){
                      geocoderInputRef.value = placeName;
                    }
                  }
                  if(center){
                    venue.location = {
                      lng: Number(center[0]),
                      lat: Number(center[1])
                    };
                  }
                  notifyFormbuilderChange();
                };

                const venueNamePlaceholder = `Venue Name ${venueIndex + 1}`;
                const venueNameInput = document.createElement('input');
                venueNameInput.type = 'text';
                venueNameInput.className = 'venue-name-input';
                venueNameInput.placeholder = venueNamePlaceholder;
                venueNameInput.setAttribute('aria-label', venueNamePlaceholder);
                venueNameInput.value = venue.name || '';
                venueNameInput.dataset.venueIndex = String(venueIndex);
                venueNameInput.setAttribute('list', nameDatalistId);
                venueNameInput.addEventListener('input', ()=>{
                  const value = venueNameInput.value || '';
                  venue.name = value;
                  notifyFormbuilderChange();
                  if(nameSearchTimeout){
                    clearTimeout(nameSearchTimeout);
                    nameSearchTimeout = null;
                  }
                  if(nameSearchAbort && typeof nameSearchAbort.abort === 'function'){
                    nameSearchAbort.abort();
                    nameSearchAbort = null;
                  }
                  const trimmed = value.trim();
                  if(trimmed.length < MAPBOX_VENUE_MIN_QUERY){
                    clearNameSuggestions();
                    return;
                  }
                  nameSearchTimeout = setTimeout(async ()=>{
                    nameSearchTimeout = null;
                    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
                    if(controller) nameSearchAbort = controller;
                    const signal = controller ? controller.signal : undefined;
                    try{
                      const normalizedQuery = venueNameInput.value.trim();
                      if(normalizedQuery.length < MAPBOX_VENUE_MIN_QUERY){
                        clearNameSuggestions();
                        if(controller) controller.abort();
                        return;
                      }
                      const localResults = searchLocalVenues(normalizedQuery) || [];
                      const remoteResults = await searchMapboxVenues(normalizedQuery, { limit: 6, signal });
                      if(signal && signal.aborted) return;
                      if((venueNameInput.value || '').trim() !== normalizedQuery){
                        return;
                      }
                      updateNameSuggestions([...localResults, ...remoteResults]);
                    } catch(err){
                      if(signal && signal.aborted) return;
                      console.warn('Venue name lookup failed', err);
                      clearNameSuggestions();
                    } finally {
                      if(nameSearchAbort === controller){
                        nameSearchAbort = null;
                      }
                    }
                  }, NAME_AUTOCOMPLETE_DELAY);
                });

                const commitNameSelection = ()=>{
                  const value = (venueNameInput.value || '').trim();
                  if(!value){
                    return;
                  }
                  let selectedFeature = null;
                  const options = venueNameDatalist.querySelectorAll('option');
                  for(const option of options){
                    if(option.value === value && option.dataset && option.dataset.featureKey){
                      const stored = nameResultsByKey[option.dataset.featureKey];
                      if(stored){
                        selectedFeature = stored;
                        break;
                      }
                    }
                  }
                  if(!selectedFeature){
                    const lower = value.toLowerCase();
                    for(const key of Object.keys(nameResultsByKey)){
                      const candidate = nameResultsByKey[key];
                      const candidateName = (candidate.text || candidate.place_name || '').toLowerCase();
                      if(candidateName === lower){
                        selectedFeature = candidate;
                        break;
                      }
                    }
                  }
                  if(selectedFeature){
                    applyFeatureToVenue(selectedFeature, { updateName:true });
                    updateNameSuggestions([selectedFeature]);
                  }
                };

                venueNameInput.addEventListener('change', commitNameSelection);
                venueNameInput.addEventListener('blur', commitNameSelection);
                venueNameInput.addEventListener('keydown', (event)=>{
                  if(event.key === 'Enter'){
                    commitNameSelection();
                  }
                });
                venueLine.appendChild(venueNameInput);
                const venueActions = document.createElement('div');
                venueActions.className = 'venue-line-actions';
                venueActions.appendChild(createActionButton('+', 'Add Venue', ()=> addVenue(venueIndex)));
                const removeVenueBtn = createActionButton('-', 'Remove Venue', ()=> requestVenueRemoval(venueIndex));
                removeVenueBtn.classList.add('danger');
                if(previewField.options.length <= 1){
                  removeVenueBtn.disabled = true;
                  removeVenueBtn.setAttribute('aria-disabled', 'true');
                } else {
                  removeVenueBtn.disabled = false;
                  removeVenueBtn.removeAttribute('aria-disabled');
                }
                venueActions.appendChild(removeVenueBtn);
                venueLine.appendChild(venueActions);
                venueCard.appendChild(venueLine);

                const addressLine = document.createElement('div');
                addressLine.className = 'venue-line venue-address-line';
                const geocoderContainer = document.createElement('div');
                geocoderContainer.className = 'venue-address-geocoder-container';
                addressLine.appendChild(geocoderContainer);
                venueCard.appendChild(addressLine);
                const addressPlaceholder = `Venue Address ${venueIndex + 1}`;
                const createFallbackAddressInput = ()=>{
                  geocoderContainer.innerHTML = '';
                  geocoderContainer.classList.remove('is-geocoder-active');
                  const fallback = document.createElement('input');
                  fallback.type = 'text';
                  fallback.className = 'venue-address-fallback';
                  fallback.placeholder = addressPlaceholder;
                  fallback.setAttribute('aria-label', addressPlaceholder);
                  fallback.value = venue.address || '';
                  fallback.dataset.venueIndex = String(venueIndex);
                  fallback.addEventListener('input', ()=>{
                    venue.address = fallback.value;
                    notifyFormbuilderChange();
                  });
                  geocoderContainer.appendChild(fallback);
                  geocoderInputRef = fallback;
                  return fallback;
                };
                const mapboxReady = window.mapboxgl && window.MapboxGeocoder && window.mapboxgl.accessToken;
                if(mapboxReady){
                  const geocoderOptions = {
                    accessToken: window.mapboxgl.accessToken,
                    mapboxgl: window.mapboxgl,
                    marker: false,
                    placeholder: addressPlaceholder,
                    geocodingUrl: MAPBOX_VENUE_ENDPOINT,
                    // NOTE: types: 'poi,place,address' retained for reference while testing broader results.
                    types: 'address,poi',
                    reverseGeocode: true,
                    localGeocoder: localVenueGeocoder,
                    externalGeocoder: externalMapboxVenueGeocoder,
                    filter: majorVenueFilter,
                    limit: 7,
                    language: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : undefined
                  };
                  const geocoder = new MapboxGeocoder(geocoderOptions);
                  const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
                    ? window.requestAnimationFrame.bind(window)
                    : (cb)=> setTimeout(cb, 16);
                  let attempts = 0;
                  const maxAttempts = 20;
                  const attachGeocoder = ()=>{
                    if(!geocoderContainer.isConnected){
                      attempts += 1;
                      if(attempts > maxAttempts){
                        createFallbackAddressInput();
                        return;
                      }
                      schedule(attachGeocoder);
                      return;
                    }
                    try {
                      geocoder.addTo(geocoderContainer);
                    } catch(err){
                      createFallbackAddressInput();
                      return;
                    }
                    const setGeocoderActive = (isActive)=>{
                      const active = !!isActive;
                      geocoderContainer.classList.toggle('is-geocoder-active', active);
                      const subMenu = geocoderContainer.closest('.subcategory-form-menu');
                      if(subMenu){
                        subMenu.classList.toggle('has-floating-overlay', active);
                      }
                      const categoryMenu = subMenu
                        ? subMenu.closest('.category-form-menu')
                        : geocoderContainer.closest('.category-form-menu');
                      if(categoryMenu){
                        categoryMenu.classList.toggle('has-floating-overlay', active);
                      }
                    };
                    setGeocoderActive(false);
                    const geocoderRoot = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
                    if(geocoderRoot){
                      const handleFocusIn = ()=> setGeocoderActive(true);
                      const handleFocusOut = event => {
                        const nextTarget = event && event.relatedTarget;
                        if(!nextTarget || !geocoderRoot.contains(nextTarget)){
                          setGeocoderActive(false);
                        }
                      };
                      const handlePointerDown = ()=> setGeocoderActive(true);
                      geocoderRoot.addEventListener('focusin', handleFocusIn);
                      geocoderRoot.addEventListener('focusout', handleFocusOut);
                      geocoderRoot.addEventListener('pointerdown', handlePointerDown);
                    }
                    const geocoderInput = geocoderContainer.querySelector('input[type="text"]');
                    if(!geocoderInput){
                      createFallbackAddressInput();
                      return;
                    }
                    geocoderInput.placeholder = addressPlaceholder;
                    geocoderInput.setAttribute('aria-label', addressPlaceholder);
                    geocoderInput.dataset.venueIndex = String(venueIndex);
                    geocoderInput.value = venue.address || '';
                    geocoderInputRef = geocoderInput;
                    geocoderInput.addEventListener('blur', ()=>{
                      const nextValue = geocoderInput.value || '';
                      if(venue.address !== nextValue){
                        venue.address = nextValue;
                        notifyFormbuilderChange();
                      }
                    });
                    geocoder.on('results', ()=> setGeocoderActive(true));
                    geocoder.on('result', event => {
                      const result = event && event.result;
                      if(result){
                        const shouldUpdateName = !(venue.name && venue.name.trim());
                        applyFeatureToVenue(result, { updateName: shouldUpdateName });
                        updateNameSuggestions([result]);
                      }
                      setGeocoderActive(false);
                    });
                    geocoder.on('clear', ()=>{
                      venue.address = '';
                      venue.location = null;
                      clearNameSuggestions();
                      notifyFormbuilderChange();
                      setGeocoderActive(false);
                    });
                    geocoder.on('error', ()=> setGeocoderActive(false));
                  };
                  attachGeocoder();
                } else {
                  createFallbackAddressInput();
                }

                const sessionContainer = document.createElement('div');
                sessionContainer.className = 'session-list';
                venue.sessions.forEach((session, sessionIndex)=>{
                  const sessionCard = document.createElement('div');
                  sessionCard.className = 'session-card';

                  const dateRow = document.createElement('div');
                  dateRow.className = 'session-date-row';
                  const datePlaceholder = `Session Date ${sessionIndex + 1}`;
                  const dateInput = document.createElement('input');
                  dateInput.type = 'text';
                  dateInput.readOnly = true;
                  dateInput.className = 'session-date-input';
                  dateInput.placeholder = datePlaceholder;
                  dateInput.setAttribute('aria-label', datePlaceholder);
                  setSessionDateInputValue(dateInput, session);
                  dateInput.dataset.venueIndex = String(venueIndex);
                  dateInput.dataset.sessionIndex = String(sessionIndex);
                  dateInput.setAttribute('role', 'button');
                  dateInput.setAttribute('aria-haspopup', 'region');
                  const dateInputWrapper = document.createElement('div');
                  dateInputWrapper.className = 'session-date-input-wrapper';
                  dateInputWrapper.appendChild(dateInput);
                  const dropdownIndicator = document.createElement('span');
                  dropdownIndicator.className = 'session-date-dropdown-indicator';
                  dropdownIndicator.setAttribute('aria-hidden', 'true');
                  dropdownIndicator.textContent = '▾';
                  dateInputWrapper.appendChild(dropdownIndicator);
                  dateRow.appendChild(dateInputWrapper);

                  const dateActions = document.createElement('div');
                  dateActions.className = 'session-date-actions';
                  const openDatePickerBtn = document.createElement('button');
                  openDatePickerBtn.type = 'button';
                  openDatePickerBtn.className = 'tiny';
                  openDatePickerBtn.textContent = '+';
                  openDatePickerBtn.setAttribute('aria-label', 'Select Session Dates');
                  openDatePickerBtn.setAttribute('aria-haspopup', 'dialog');
                  dateActions.appendChild(openDatePickerBtn);
                  const removeDateBtn = createActionButton('-', 'Remove Session Date', ()=> removeSession(venue, venueIndex, sessionIndex));
                  if(venue.sessions.length <= 1){
                    removeDateBtn.disabled = true;
                    removeDateBtn.setAttribute('aria-disabled', 'true');
                  } else {
                    removeDateBtn.disabled = false;
                    removeDateBtn.removeAttribute('aria-disabled');
                  }
                  dateActions.appendChild(removeDateBtn);
                  dateRow.appendChild(dateActions);
                  sessionCard.appendChild(dateRow);
                  const datePickerControls = setupDatePicker(dateInput, venue, session, venueIndex, sessionIndex, { trigger: openDatePickerBtn });

                  const sessionDetails = document.createElement('div');
                  sessionDetails.className = 'session-details';
                  const detailsId = `session-details-${venueIndex}-${sessionIndex}`;
                  sessionDetails.id = detailsId;
                  const isOpen = openSessions.has(session);
                  sessionDetails.hidden = !isOpen;
                  dateInputWrapper.classList.toggle('is-open', isOpen);
                  dateInput.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                  dateInput.setAttribute('aria-controls', detailsId);

                  const syncSessionVisibility = (targetDetails, shouldOpen)=>{
                    if(!targetDetails) return;
                    const parentCard = targetDetails.closest('.session-card');
                    const wrapperNode = parentCard ? parentCard.querySelector('.session-date-input-wrapper') : null;
                    const inputNode = parentCard ? parentCard.querySelector('.session-date-input') : null;
                    targetDetails.hidden = !shouldOpen;
                    if(wrapperNode){
                      wrapperNode.classList.toggle('is-open', shouldOpen);
                    }
                    if(inputNode){
                      inputNode.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
                    }
                  };

                  dateInput.addEventListener('click', event => {
                    const isFirstSessionBlank = sessionIndex === 0 && (!session || typeof session.date !== 'string' || session.date.trim() === '');
                    if(isFirstSessionBlank && datePickerControls && typeof datePickerControls.open === 'function'){
                      event.preventDefault();
                      event.stopPropagation();
                      datePickerControls.open();
                      return;
                    }
                    closeAllPickers();
                    const currentlyOpen = openSessions.has(session);
                    const nextShouldOpen = !currentlyOpen;
                    if(nextShouldOpen){
                      openSessions.add(session);
                    } else {
                      openSessions.delete(session);
                    }
                    syncSessionVisibility(sessionDetails, nextShouldOpen);
                  });
                  dateInput.addEventListener('keydown', event => {
                    if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
                      const isFirstSessionBlank = sessionIndex === 0 && (!session || typeof session.date !== 'string' || session.date.trim() === '');
                      if(isFirstSessionBlank && datePickerControls && typeof datePickerControls.open === 'function'){
                        event.preventDefault();
                        datePickerControls.open();
                        return;
                      }
                      event.preventDefault();
                      closeAllPickers();
                      const currentlyOpen = openSessions.has(session);
                      const nextShouldOpen = !currentlyOpen;
                      if(nextShouldOpen){
                        openSessions.add(session);
                      } else {
                        openSessions.delete(session);
                      }
                      syncSessionVisibility(sessionDetails, nextShouldOpen);
                    }
                  });
                  sessionCard.appendChild(sessionDetails);

                  const timesList = document.createElement('div');
                  timesList.className = 'session-times';
                  sessionDetails.appendChild(timesList);

                  session.times.forEach((timeObj, timeIndex)=>{
                    const isFirstSession = sessionIndex === 0;
                    const isFirstTimeSlot = timeIndex === 0;
                    if(isFirstTimeSlot){
                      timeObj.samePricingSourceIndex = 0;
                      if(isFirstSession){
                        timeObj.samePricingAsAbove = false;
                      } else if(typeof timeObj.samePricingAsAbove !== 'boolean'){
                        timeObj.samePricingAsAbove = true;
                      }
                    } else {
                      if(typeof timeObj.samePricingAsAbove !== 'boolean'){
                        timeObj.samePricingAsAbove = true;
                      }
                      if(!Number.isInteger(timeObj.samePricingSourceIndex) || timeObj.samePricingSourceIndex < 0){
                        timeObj.samePricingSourceIndex = 0;
                      }
                    }
                    const timeRow = document.createElement('div');
                    timeRow.className = 'session-time-row';

                    const computeTimeOrdinal = ()=>{
                      let ordinal = timeIndex + 1;
                      const currentDate = typeof session.date === 'string' ? session.date : '';
                      if(Array.isArray(venue.sessions) && currentDate){
                        for(let i = 0; i < sessionIndex; i++){
                          const compareSession = venue.sessions[i];
                          if(!compareSession || typeof compareSession.date !== 'string') continue;
                          if(compareSession.date !== currentDate) continue;
                          const compareTimes = Array.isArray(compareSession.times) ? compareSession.times.filter(Boolean) : [];
                          ordinal += Math.max(compareTimes.length, 1);
                        }
                      }
                      return ordinal;
                    };
                    const timeOrdinal = computeTimeOrdinal();
                    const timePlaceholder = `Session Time ${timeOrdinal} (24 hr clock)`;
                    const timeInput = document.createElement('input');
                    timeInput.type = 'text';
                    timeInput.className = 'session-time-input';
                    timeInput.placeholder = timePlaceholder;
                    timeInput.setAttribute('aria-label', timePlaceholder);
                    timeInput.inputMode = 'numeric';
                    timeInput.pattern = '([01]\\d|2[0-3]):[0-5]\\d';
                    timeInput.value = timeObj.time || '';
                    timeInput.dataset.venueIndex = String(venueIndex);
                    timeInput.dataset.sessionIndex = String(sessionIndex);
                    timeInput.dataset.timeIndex = String(timeIndex);
                    timeInput.addEventListener('input', ()=>{
                      const sanitized = sanitizeTimeInput(timeInput.value);
                      if(timeInput.value !== sanitized){
                        timeInput.value = sanitized;
                      }
                      timeInput.classList.remove('is-invalid');
                      setSessionDateInputValue(dateInput, session, sanitized);
                    });
                    timeInput.addEventListener('blur', ()=>{
                      commitTimeValue({ venue, venueIndex, sessionIndex, timeIndex, timeObj, input: timeInput });
                      resetSlotIfEmpty(venue, timeIndex);
                      updateSessionDateInputDisplay(venueIndex, sessionIndex);
                    });
                    timeRow.appendChild(timeInput);

                    const timeActions = document.createElement('div');
                    timeActions.className = 'session-time-actions';
                    timeActions.appendChild(createActionButton('+', 'Add Session Time', ()=> addTimeSlot(venue, venueIndex, sessionIndex, timeIndex)));
                    const removeTimeBtn = createActionButton('-', 'Remove Session Time', ()=> removeTimeSlot(venue, venueIndex, sessionIndex, timeIndex));
                    const timesForSession = Array.isArray(session.times) ? session.times.filter(Boolean) : [];
                    const canRemoveTime = timesForSession.length > 1;
                    if(!canRemoveTime){
                      removeTimeBtn.disabled = true;
                      removeTimeBtn.setAttribute('aria-disabled', 'true');
                    } else {
                      removeTimeBtn.disabled = false;
                      removeTimeBtn.removeAttribute('aria-disabled');
                    }
                    timeActions.appendChild(removeTimeBtn);
                    timeRow.appendChild(timeActions);

                    const versionList = document.createElement('div');
                    versionList.className = 'session-seating-list';
                    let samePricingRow = null;
                    let samePricingYesInput = null;
                    let samePricingNoInput = null;
                    const showSamePricingOptions = sessionIndex > 0 || timeIndex > 0;

                    const getSamePricingReference = ()=>{
                      if(timeIndex > 0){
                        const firstTime = session.times[0];
                        return firstTime && firstTime !== timeObj ? firstTime : null;
                      }
                      if(sessionIndex > 0){
                        const referenceSession = Array.isArray(venue.sessions) ? venue.sessions[0] : null;
                        if(referenceSession && referenceSession !== session){
                          const referenceTimes = Array.isArray(referenceSession.times) ? referenceSession.times : [];
                          const referenceByIndex = referenceTimes[timeIndex];
                          if(referenceByIndex && referenceByIndex !== timeObj){
                            return referenceByIndex;
                          }
                          const fallbackReference = referenceTimes[0];
                          if(fallbackReference && fallbackReference !== timeObj){
                            return fallbackReference;
                          }
                        }
                      }
                      const fallback = session.times[0];
                      return fallback && fallback !== timeObj ? fallback : null;
                    };

                    const initialReference = getSamePricingReference();
                    if(timeObj.samePricingAsAbove === true && initialReference && initialReference !== timeObj){
                      timeObj.samePricingSourceIndex = 0;
                      timeObj.versions = initialReference.versions;
                      if(sessionIndex > 0){
                        timeObj.tierAutofillLocked = true;
                      }
                    } else {
                      if(initialReference && timeObj.versions === initialReference.versions){
                        timeObj.versions = initialReference.versions.map(cloneVenueSessionVersion);
                      }
                      if(!Array.isArray(timeObj.versions) || timeObj.versions.length === 0){
                        timeObj.versions = [venueSessionCreateVersion()];
                      }
                      if(sessionIndex > 0 && timeObj.samePricingAsAbove !== true){
                        timeObj.tierAutofillLocked = false;
                      }
                    }

                    const updateSamePricingUI = ()=>{
                      const referenceTime = getSamePricingReference();
                      const isSamePricing = showSamePricingOptions && referenceTime && referenceTime !== timeObj && timeObj.samePricingAsAbove === true;
                      versionList.hidden = isSamePricing;
                      versionList.style.display = isSamePricing ? 'none' : '';
                      timeRow.classList.toggle('has-same-pricing', isSamePricing);
                      if(samePricingRow){
                        samePricingRow.hidden = !showSamePricingOptions;
                        samePricingRow.style.display = showSamePricingOptions ? '' : 'none';
                      }
                      if(samePricingYesInput){
                        samePricingYesInput.checked = showSamePricingOptions && timeObj.samePricingAsAbove === true;
                      }
                      if(samePricingNoInput){
                        samePricingNoInput.checked = showSamePricingOptions && timeObj.samePricingAsAbove !== true;
                      }
                    };

                    const populateVersionList = ()=>{
                      versionList.innerHTML = '';
                      timeObj.versions.forEach((version, versionIndex)=>{
                        const versionCard = document.createElement('div');
                        versionCard.className = 'session-pricing-card';

                        const versionPlaceholder = 'eg. General, Stalls, Balcony';
                        const seatingLabelText = `Seating Area ${versionIndex + 1}`;
                        const seatingLabel = document.createElement('label');
                        seatingLabel.className = 'session-seating-label';
                        seatingLabel.textContent = seatingLabelText;
                        const seatingInputId = `session-seating-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}`;
                        seatingLabel.setAttribute('for', seatingInputId);
                        const versionInput = document.createElement('input');
                        versionInput.type = 'text';
                        versionInput.className = 'session-seating-input';
                        versionInput.placeholder = versionPlaceholder;
                        versionInput.setAttribute('aria-label', seatingLabelText);
                        versionInput.id = seatingInputId;
                        versionInput.value = version.name || '';
                        versionInput.dataset.venueIndex = String(venueIndex);
                        versionInput.dataset.sessionIndex = String(sessionIndex);
                        versionInput.dataset.timeIndex = String(timeIndex);
                        versionInput.dataset.versionIndex = String(versionIndex);
                        versionInput.addEventListener('input', ()=>{
                          const previous = typeof version.name === 'string' ? version.name : '';
                          const nextValue = versionInput.value;
                          version.name = nextValue;
                          if(sessionIndex === 0 && !isSessionMirrorLocked(venue) && previous !== nextValue){
                            forEachOtherSession(venue, (otherSess, otherIndex)=>{
                              const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                              const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                              while(otherVersions.length <= versionIndex){
                                otherVersions.push(venueSessionCreateVersion());
                              }
                              const otherVersion = otherVersions[versionIndex];
                              if(otherVersion){
                                otherVersion.name = nextValue;
                                const selector = `.session-seating-input[data-venue-index="${venueIndex}"][data-session-index="${otherIndex}"][data-time-index="${timeIndex}"][data-version-index="${versionIndex}"]`;
                                const peer = editor.querySelector(selector);
                                if(peer){
                                  peer.value = nextValue;
                                }
                              }
                            });
                          } else if(sessionIndex > 0 && previous !== nextValue){
                            lockSessionMirror(venue);
                          }
                          notifyFormbuilderChange();
                        });
                        versionCard.appendChild(seatingLabel);
                        versionCard.appendChild(versionInput);

                        const versionActions = document.createElement('div');
                        versionActions.className = 'version-actions';
                        versionActions.appendChild(createActionButton('+', 'Add Seating Area', ()=> addVersion(venue, venueIndex, sessionIndex, timeIndex, versionIndex)));
                        const removeVersionBtn = createActionButton('-', 'Remove Seating Area', ()=> removeVersion(venue, venueIndex, sessionIndex, timeIndex, versionIndex, version));
                        if(timeObj.versions.length <= 1){
                          removeVersionBtn.disabled = true;
                          removeVersionBtn.setAttribute('aria-disabled', 'true');
                        } else {
                          removeVersionBtn.disabled = false;
                          removeVersionBtn.removeAttribute('aria-disabled');
                        }
                        versionActions.appendChild(removeVersionBtn);
                        versionCard.appendChild(versionActions);

                        const tierList = document.createElement('div');
                        tierList.className = 'session-tier-list';
                        version.tiers.forEach((tier, tierIndex)=>{
                          const tierRow = document.createElement('div');
                          tierRow.className = 'tier-row';

                          const tierPlaceholder = 'eg. Child, Student, Adult';
                          const tierLabelText = `Pricing Tier ${tierIndex + 1}`;
                          const tierLabel = document.createElement('label');
                          tierLabel.className = 'session-tier-label';
                          tierLabel.textContent = tierLabelText;
                          const tierInputId = `session-tier-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}-${tierIndex}`;
                          tierLabel.setAttribute('for', tierInputId);
                          const tierInput = document.createElement('input');
                          tierInput.type = 'text';
                          tierInput.className = 'session-tier-input';
                          tierInput.placeholder = tierPlaceholder;
                          tierInput.setAttribute('aria-label', tierLabelText);
                          tierInput.id = tierInputId;
                          tierInput.value = tier.name || '';
                          tierInput.dataset.venueIndex = String(venueIndex);
                          tierInput.dataset.sessionIndex = String(sessionIndex);
                          tierInput.dataset.timeIndex = String(timeIndex);
                          tierInput.dataset.versionIndex = String(versionIndex);
                          tierInput.dataset.tierIndex = String(tierIndex);
                          tierRow.appendChild(tierLabel);
                          tierInput.addEventListener('input', ()=>{
                            const previous = typeof tier.name === 'string' ? tier.name : '';
                            const nextValue = tierInput.value;
                            tier.name = nextValue;
                            let syncedFromTemplate = false;
                            if(versionIndex === 0){
                              syncedFromTemplate = syncTiersFromTemplate(timeObj);
                              if(!timeObj.tierAutofillLocked){
                                const versions = Array.isArray(timeObj.versions) ? timeObj.versions : [];
                                for(let otherVersionIndex = 1; otherVersionIndex < versions.length; otherVersionIndex++){
                                  const selector = `.session-tier-input[data-venue-index="${venueIndex}"][data-session-index="${sessionIndex}"][data-time-index="${timeIndex}"][data-version-index="${otherVersionIndex}"][data-tier-index="${tierIndex}"]`;
                                  const peer = editor.querySelector(selector);
                                  if(peer){
                                    peer.value = nextValue;
                                  }
                                }
                              }
                            }
                            if(sessionIndex === 0 && !isSessionMirrorLocked(venue) && previous !== nextValue){
                              forEachOtherSession(venue, (otherSess, otherIndex)=>{
                                const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                                const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                                while(otherVersions.length <= versionIndex){
                                  otherVersions.push(venueSessionCreateVersion());
                                }
                                const otherVersion = otherVersions[versionIndex];
                                if(!otherVersion) return;
                                const otherTiers = Array.isArray(otherVersion.tiers) ? otherVersion.tiers : (otherVersion.tiers = [venueSessionCreateTier()]);
                                while(otherTiers.length <= tierIndex){
                                  otherTiers.push(venueSessionCreateTier());
                                }
                                const otherTier = otherTiers[tierIndex];
                                if(otherTier){
                                  otherTier.name = nextValue;
                                  const selector = `.session-tier-input[data-venue-index="${venueIndex}"][data-session-index="${otherIndex}"][data-time-index="${timeIndex}"][data-version-index="${versionIndex}"][data-tier-index="${tierIndex}"]`;
                                  const peer = editor.querySelector(selector);
                                  if(peer){
                                    peer.value = nextValue;
                                  }
                                }
                              });
                            } else if(sessionIndex > 0 && previous !== nextValue){
                              lockSessionMirror(venue);
                            }
                            const locked = lockTierAutofillIfNeeded(timeObj, versionIndex);
                            if(previous !== nextValue || locked || syncedFromTemplate){
                              notifyFormbuilderChange();
                            }
                          });
                          tierRow.appendChild(tierInput);

                          const tierActions = document.createElement('div');
                          tierActions.className = 'tier-actions';
                          tierActions.appendChild(createActionButton('+', 'Add Tier', ()=> addTier(venue, venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex)));
                          const removeTierBtn = createActionButton('-', 'Remove Tier', ()=> removeTier(venue, venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex, version, tier));
                          if(version.tiers.length <= 1){
                            removeTierBtn.disabled = true;
                            removeTierBtn.setAttribute('aria-disabled', 'true');
                          } else {
                            removeTierBtn.disabled = false;
                            removeTierBtn.removeAttribute('aria-disabled');
                          }
                          tierActions.appendChild(removeTierBtn);
                          tierRow.appendChild(tierActions);

                          const priceRow = document.createElement('div');
                          priceRow.className = 'tier-price-row';
                          const currencySelect = document.createElement('select');
                          currencySelect.className = 'session-currency-select';
                          const emptyOpt = document.createElement('option');
                          emptyOpt.value = '';
                          emptyOpt.textContent = 'Currency';
                          currencySelect.appendChild(emptyOpt);
                          VERSION_PRICE_CURRENCIES.forEach(code => {
                            const opt = document.createElement('option');
                            opt.value = code;
                            opt.textContent = code;
                            currencySelect.appendChild(opt);
                          });
                          const existingCurrency = typeof tier.currency === 'string' ? tier.currency.trim() : '';
                          currencySelect.value = existingCurrency;
                          currencySelect.dataset.venueIndex = String(venueIndex);
                          currencySelect.dataset.sessionIndex = String(sessionIndex);
                          currencySelect.dataset.timeIndex = String(timeIndex);
                          currencySelect.dataset.versionIndex = String(versionIndex);
                          currencySelect.dataset.tierIndex = String(tierIndex);
                          priceRow.appendChild(currencySelect);

                          const priceInput = document.createElement('input');
                          priceInput.type = 'text';
                          priceInput.inputMode = 'decimal';
                          priceInput.pattern = '[0-9]+([\.,][0-9]{0,2})?';
                          priceInput.className = 'session-price-input';
                          priceInput.placeholder = '0.00';
                          const sanitizedInitialPrice = sanitizeSessionPriceValue(tier.price || '');
                          const formattedInitialPrice = formatSessionPriceValue(sanitizedInitialPrice);
                          if(typeof tier.price !== 'string' || tier.price !== formattedInitialPrice){
                            tier.price = formattedInitialPrice;
                            markAutoChange();
                          }
                          priceInput.value = formattedInitialPrice;
                          priceInput.dataset.venueIndex = String(venueIndex);
                          priceInput.dataset.sessionIndex = String(sessionIndex);
                          priceInput.dataset.timeIndex = String(timeIndex);
                          priceInput.dataset.versionIndex = String(versionIndex);
                          priceInput.dataset.tierIndex = String(tierIndex);

                          const hasCurrencySelected = ()=> currencySelect.value.trim() !== '';

                          const updatePriceState = (options = {})=>{
                            const opts = options || {};
                            if(hasCurrencySelected()){
                              priceInput.readOnly = false;
                              priceInput.classList.remove('is-awaiting-currency');
                              priceInput.removeAttribute('aria-disabled');
                              if(opts.sanitize !== false){
                                const sanitized = sanitizeSessionPriceValue(priceInput.value);
                                if(priceInput.value !== sanitized){
                                  priceInput.value = sanitized;
                                }
                              }
                              return false;
                            }
                            priceInput.readOnly = true;
                            priceInput.classList.add('is-awaiting-currency');
                            priceInput.setAttribute('aria-disabled', 'true');
                            let priceChanged = false;
                            if(opts.clearPrice){
                              if(priceInput.value !== ''){
                                priceInput.value = '';
                              }
                              if(tier.price){
                                tier.price = '';
                                priceChanged = true;
                              }
                            }
                            return priceChanged;
                          };

                          const commitPriceValue = ()=>{
                            let shouldNotify = false;
                            let shouldLock = false;
                            const previous = typeof tier.price === 'string' ? tier.price : '';
                            if(!hasCurrencySelected()){
                              const cleared = updatePriceState({ clearPrice: true, sanitize: false });
                              if(cleared){
                                tier.price = '';
                                shouldNotify = true;
                                shouldLock = true;
                              }
                            } else {
                              const formattedPrice = formatSessionPriceValue(priceInput.value);
                              if(priceInput.value !== formattedPrice){
                                priceInput.value = formattedPrice;
                              }
                              if(previous !== formattedPrice){
                                tier.price = formattedPrice;
                                shouldNotify = true;
                                shouldLock = true;
                              }
                            }
                            if(sessionIndex === 0 && !isSessionMirrorLocked(venue) && previous !== tier.price){
                              const nextValue = tier.price || '';
                              forEachOtherSession(venue, (otherSess, otherIndex)=>{
                                const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                                const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                                while(otherVersions.length <= versionIndex){
                                  otherVersions.push(venueSessionCreateVersion());
                                }
                                const otherVersion = otherVersions[versionIndex];
                                if(!otherVersion) return;
                                const otherTiers = Array.isArray(otherVersion.tiers) ? otherVersion.tiers : (otherVersion.tiers = [venueSessionCreateTier()]);
                                while(otherTiers.length <= tierIndex){
                                  otherTiers.push(venueSessionCreateTier());
                                }
                                const otherTier = otherTiers[tierIndex];
                                if(!otherTier) return;
                                otherTier.price = nextValue;
                                const selector = `.session-price-input[data-venue-index="${venueIndex}"][data-session-index="${otherIndex}"][data-time-index="${timeIndex}"][data-version-index="${versionIndex}"][data-tier-index="${tierIndex}"]`;
                                const peer = editor.querySelector(selector);
                                if(peer){
                                  peer.value = nextValue;
                                }
                              });
                            } else if(sessionIndex > 0 && previous !== tier.price){
                              lockSessionMirror(venue);
                            }
                            if(shouldLock && lockTierAutofillIfNeeded(timeObj, versionIndex)){
                              shouldNotify = true;
                            }
                            if(shouldNotify){
                              notifyFormbuilderChange();
                            }
                          };

                          const blockPriceAccess = event => {
                            if(hasCurrencySelected()) return false;
                            if(event && event.type === 'pointerdown' && event.button !== 0) return false;
                            if(event && typeof event.preventDefault === 'function'){
                              event.preventDefault();
                            }
                            if(event && typeof event.stopPropagation === 'function'){
                              event.stopPropagation();
                            }
                            if(typeof priceInput.blur === 'function'){
                              requestAnimationFrame(()=>{
                                try{ priceInput.blur(); }catch(err){}
                              });
                            }
                            showCurrencyAlert(priceInput);
                            return true;
                          };

                          currencySelect.addEventListener('change', ()=>{
                            const nextCurrency = currencySelect.value.trim();
                            const previousCurrency = typeof tier.currency === 'string' ? tier.currency : '';
                            tier.currency = nextCurrency;
                            const shouldClearPrice = nextCurrency === '';
                            const priceCleared = updatePriceState({ clearPrice: shouldClearPrice, sanitize: true });
                            const propagated = applyCurrencyToVenueData(venue, nextCurrency, {
                              sourceTier: tier,
                              clearPrices: shouldClearPrice
                            });
                            if(sessionIndex > 0 && previousCurrency !== nextCurrency){
                              lockSessionMirror(venue);
                            }
                            setVenueCurrencyState(venue, nextCurrency);
                            let notifyNeeded = (previousCurrency !== nextCurrency) || priceCleared || propagated;
                            if(lockTierAutofillIfNeeded(timeObj, versionIndex)){
                              notifyNeeded = true;
                            }
                            if(notifyNeeded){
                              notifyFormbuilderChange();
                            }
                            renderVenues({ type: 'price', venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex });
                          });

                          priceInput.addEventListener('beforeinput', event => {
                            if(hasCurrencySelected()){
                              const data = event && event.data;
                              if(typeof data === 'string' && /[^0-9.,]/.test(data)){
                                event.preventDefault();
                              }
                              return;
                            }
                            if(event){
                              event.preventDefault();
                            }
                            showCurrencyAlert(priceInput);
                          });
                          priceInput.addEventListener('pointerdown', blockPriceAccess);
                          priceInput.addEventListener('focus', blockPriceAccess);
                          priceInput.addEventListener('keydown', event => {
                            if(event.key === 'Tab' || event.key === 'Shift') return;
                            blockPriceAccess(event);
                          });
                          priceInput.addEventListener('input', ()=>{
                            if(!hasCurrencySelected()) return;
                            const rawValue = priceInput.value;
                            const sanitized = sanitizeSessionPriceValue(rawValue);
                            if(rawValue !== sanitized){
                              const start = priceInput.selectionStart;
                              const end = priceInput.selectionEnd;
                              priceInput.value = sanitized;
                              if(typeof priceInput.setSelectionRange === 'function' && start != null && end != null){
                                const adjustment = rawValue.length - sanitized.length;
                                const nextStart = Math.max(0, start - adjustment);
                                const nextEnd = Math.max(0, end - adjustment);
                                priceInput.setSelectionRange(nextStart, nextEnd);
                              }
                            }
                          });
                          priceInput.addEventListener('blur', commitPriceValue);
                          priceInput.addEventListener('change', commitPriceValue);

                          updatePriceState({ clearPrice: false, sanitize: false });
                          priceRow.appendChild(priceInput);
                          tierRow.appendChild(priceRow);
                          tierList.appendChild(tierRow);
                        });
                        versionCard.appendChild(tierList);
                        versionList.appendChild(versionCard);
                      });
                    };

                    const handleSamePricingSelection = (shouldMatch)=>{
                      if(sessionIndex > 0){
                        lockSessionMirror(venue);
                      }
                      const referenceTime = getSamePricingReference();
                      const canApplyReference = shouldMatch && referenceTime && referenceTime !== timeObj;
                      if(canApplyReference){
                        timeObj.samePricingAsAbove = true;
                        timeObj.samePricingSourceIndex = 0;
                        timeObj.versions = referenceTime.versions;
                        timeObj.tierAutofillLocked = true;
                      } else {
                        timeObj.samePricingAsAbove = false;
                        timeObj.samePricingSourceIndex = 0;
                        if(referenceTime && timeObj.versions === referenceTime.versions){
                          timeObj.versions = referenceTime.versions.map(cloneVenueSessionVersion);
                        }
                        if(!Array.isArray(timeObj.versions) || timeObj.versions.length === 0){
                          timeObj.versions = [venueSessionCreateVersion()];
                        }
                        timeObj.tierAutofillLocked = false;
                      }
                      notifyFormbuilderChange();
                      populateVersionList();
                      updateSamePricingUI();
                    };

                    if(showSamePricingOptions){
                      samePricingRow = document.createElement('div');
                      samePricingRow.className = 'same-pricing-row';
                      const samePricingLabel = document.createElement('span');
                      samePricingLabel.className = 'same-pricing-label';
                      samePricingLabel.textContent = 'Same Pricing as Above';
                      samePricingRow.appendChild(samePricingLabel);

                      const samePricingOptions = document.createElement('div');
                      samePricingOptions.className = 'same-pricing-options';
                      const radioName = `same-pricing-${venueIndex}-${sessionIndex}-${timeIndex}`;

                      const yesLabel = document.createElement('label');
                      samePricingYesInput = document.createElement('input');
                      samePricingYesInput.type = 'radio';
                      samePricingYesInput.name = radioName;
                      samePricingYesInput.value = 'yes';
                      yesLabel.appendChild(samePricingYesInput);
                      const yesText = document.createElement('span');
                      yesText.textContent = 'Yes';
                      yesLabel.appendChild(yesText);
                      samePricingYesInput.addEventListener('change', ()=>{
                        if(samePricingYesInput.checked){
                          handleSamePricingSelection(true);
                        }
                      });
                      samePricingOptions.appendChild(yesLabel);

                      const noLabel = document.createElement('label');
                      samePricingNoInput = document.createElement('input');
                      samePricingNoInput.type = 'radio';
                      samePricingNoInput.name = radioName;
                      samePricingNoInput.value = 'no';
                      noLabel.appendChild(samePricingNoInput);
                      const noText = document.createElement('span');
                      noText.textContent = 'No';
                      noLabel.appendChild(noText);
                      samePricingNoInput.addEventListener('change', ()=>{
                        if(samePricingNoInput.checked){
                          handleSamePricingSelection(false);
                        }
                      });
                      samePricingOptions.appendChild(noLabel);

                      samePricingRow.appendChild(samePricingOptions);
                      timeRow.appendChild(samePricingRow);
                    }

                    timeRow.appendChild(versionList);
                    populateVersionList();
                    updateSamePricingUI();
                    timesList.appendChild(timeRow);
                  });
                  sessionContainer.appendChild(sessionCard);
                });
                venueCard.appendChild(sessionContainer);

              });
              if(shouldNotifyAfterRender){
                notifyFormbuilderChange();
              }
              applyFocus();
            };

            renderVenues();
            return editor;
          };

          const ensureDefaultFieldSet = (fieldList)=>{
            if(!Array.isArray(fieldList) || fieldList.length > 0) return false;
            DEFAULT_SUBCATEGORY_FIELDS.forEach(defaultField => {
              fieldList.push({
                name: typeof defaultField.name === 'string' ? defaultField.name : '',
                type: typeof defaultField.type === 'string' ? defaultField.type : 'text-box',
                placeholder: typeof defaultField.placeholder === 'string' ? defaultField.placeholder : '',
                required: !!defaultField.required,
                options: []
              });
            });
            return fieldList.length > 0;
          };

          const fields = Array.isArray(subFieldsMap[sub]) ? subFieldsMap[sub] : (subFieldsMap[sub] = []);

          if(ensureDefaultFieldSet(fields)){
            notifyFormbuilderChange();
          }

          const fieldsContainerState = setupFieldContainer(fieldsList, fields);

          const formPreviewBtn = document.createElement('button');
          formPreviewBtn.type = 'button';
          formPreviewBtn.className = 'form-preview-btn';
          formPreviewBtn.setAttribute('aria-expanded', 'false');
          formPreviewBtn.setAttribute('aria-label', `Preview ${sub} form`);
          const formPreviewLabel = document.createElement('span');
          formPreviewLabel.textContent = 'Form Preview';
          const formPreviewArrow = document.createElement('span');
          formPreviewArrow.className = 'dropdown-arrow';
          formPreviewArrow.setAttribute('aria-hidden', 'true');
          formPreviewBtn.append(formPreviewLabel, formPreviewArrow);

          const formPreviewContainer = document.createElement('div');
          formPreviewContainer.className = 'form-preview-container';
          formPreviewContainer.hidden = true;
          const formPreviewFields = document.createElement('div');
          formPreviewFields.className = 'form-preview-fields';
          formPreviewContainer.appendChild(formPreviewFields);
          const formPreviewId = `${subContentId}Preview`;
          formPreviewContainer.id = formPreviewId;
          formPreviewBtn.setAttribute('aria-controls', formPreviewId);

          fieldsSection.append(formPreviewBtn, formPreviewContainer, addFieldBtn);

          formPreviewBtn.addEventListener('click', ()=>{
            const expanded = formPreviewBtn.getAttribute('aria-expanded') === 'true';
            const nextExpanded = !expanded;
            formPreviewBtn.setAttribute('aria-expanded', String(nextExpanded));
            formPreviewContainer.hidden = !nextExpanded;
            if(nextExpanded){
              renderFormPreview();
            }
          });

          let formPreviewFieldIdCounter = 0;
          function renderFormPreview(){
            formPreviewFields.innerHTML = '';
            if(!fields.length){
              const empty = document.createElement('p');
              empty.className = 'form-preview-empty';
              empty.textContent = 'No fields added yet.';
              formPreviewFields.appendChild(empty);
              return;
            }
            fields.forEach((fieldData, previewIndex)=>{
              const previewField = ensureFieldDefaults(fieldData);
              const wrapper = document.createElement('div');
              wrapper.className = 'panel-field form-preview-field';
              const baseId = `${formPreviewId}-field-${++formPreviewFieldIdCounter}`;
              const labelText = previewField.name.trim() || `Field ${previewIndex + 1}`;
              const labelButton = document.createElement('button');
              labelButton.type = 'button';
              labelButton.className = 'subcategory-form-button';
              labelButton.textContent = labelText;
              labelButton.setAttribute('aria-haspopup', 'dialog');
              labelButton.dataset.previewIndex = String(previewIndex);
              const labelId = `${baseId}-label`;
              labelButton.id = labelId;
              let control = null;
              if(previewField.type === 'text-area' || previewField.type === 'description'){
                const textarea = document.createElement('textarea');
                textarea.rows = 5;
                textarea.readOnly = true;
                textarea.tabIndex = -1;
                textarea.placeholder = previewField.placeholder || '';
                textarea.className = 'form-preview-textarea';
                textarea.style.resize = 'vertical';
                const textareaId = `${baseId}-input`;
                textarea.id = textareaId;
                if(previewField.type === 'description'){
                  textarea.classList.add('form-preview-description');
                }
                control = textarea;
              } else if(previewField.type === 'dropdown'){
                const select = document.createElement('select');
                select.className = 'form-preview-select';
                wrapper.classList.add('form-preview-field--dropdown');
                const options = Array.isArray(previewField.options) ? previewField.options : [];
                if(options.length){
                  options.forEach((optionValue, optionIndex)=>{
                    const option = document.createElement('option');
                    const displayValue = (typeof optionValue === 'string' && optionValue.trim())
                      ? optionValue
                      : `Option ${optionIndex + 1}`;
                    option.value = optionValue;
                    option.textContent = displayValue;
                    select.appendChild(option);
                  });
                } else {
                  const placeholderOption = document.createElement('option');
                  placeholderOption.textContent = 'Select an option';
                  select.appendChild(placeholderOption);
                }
                select.tabIndex = -1;
                const selectId = `${baseId}-input`;
                select.id = selectId;
                control = select;
              } else if(previewField.type === 'radio-toggle'){
                const options = Array.isArray(previewField.options) ? previewField.options : [];
                const radioGroup = document.createElement('div');
                radioGroup.className = 'form-preview-radio-group';
                wrapper.classList.add('form-preview-field--radio-toggle');
                const groupName = `${baseId}-radio`;
                if(options.length){
                  options.forEach((optionValue, optionIndex)=>{
                    const radioLabel = document.createElement('label');
                    radioLabel.className = 'form-preview-radio-option';
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = groupName;
                    radio.value = optionValue;
                    radio.tabIndex = -1;
                    radio.disabled = true;
                    const displayValue = (typeof optionValue === 'string' && optionValue.trim())
                      ? optionValue
                      : `Option ${optionIndex + 1}`;
                    const radioText = document.createElement('span');
                    radioText.textContent = displayValue;
                    radioLabel.append(radio, radioText);
                    radioGroup.appendChild(radioLabel);
                  });
                } else {
                  const placeholderOption = document.createElement('label');
                  placeholderOption.className = 'form-preview-radio-option';
                  const radio = document.createElement('input');
                  radio.type = 'radio';
                  radio.tabIndex = -1;
                  radio.disabled = true;
                  placeholderOption.append(radio, document.createTextNode('Option'));
                  radioGroup.appendChild(placeholderOption);
                }
                control = radioGroup;
              } else if(previewField.type === 'venue-session-version-tier-price'){
                wrapper.classList.add('form-preview-field--venue-session');
                control = buildVenueSessionPreview(previewField, baseId);
              } else if(previewField.type === 'version-price'){
                wrapper.classList.add('form-preview-field--version-price');
                const editor = document.createElement('div');
                editor.className = 'form-preview-version-price version-price-options-editor';
                const versionList = document.createElement('div');
                versionList.className = 'version-price-options-list';
                editor.appendChild(versionList);

                const createEmptyOption = ()=>({ version: '', currency: '', price: '' });

                const normalizeOptions = ()=>{
                  if(!Array.isArray(previewField.options)){
                    previewField.options = [];
                  }
                  previewField.options = previewField.options.map(opt => {
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
                  if(previewField.options.length === 0){
                    previewField.options.push(createEmptyOption());
                  }
                };

                const renderVersionEditor = (focusIndex = null, focusTarget = 'version')=>{
                  normalizeOptions();
                  versionList.innerHTML = '';
                  let firstId = null;
                  const currencyAlertMessage = 'Please select a currency before entering a price.';
                  let lastCurrencyAlertAt = 0;
                  let currencyAlertHandle = null;
                  let currencyAlertTimeout = 0;
                  const showCurrencyAlert = target => {
                    const candidate = (target && typeof target.getBoundingClientRect === 'function')
                      ? target
                      : ((document && document.activeElement && typeof document.activeElement.getBoundingClientRect === 'function')
                        ? document.activeElement
                        : null);
                    const inputEl = candidate && document.body && document.body.contains(candidate) ? candidate : null;
                    if(!inputEl) return;
                    const now = Date.now();
                    if(now - lastCurrencyAlertAt < 400){
                      if(currencyAlertHandle && typeof currencyAlertHandle.reposition === 'function'){
                        currencyAlertHandle.reposition();
                      }
                      return;
                    }
                    lastCurrencyAlertAt = now;
                    if(currencyAlertTimeout){
                      clearTimeout(currencyAlertTimeout);
                      currencyAlertTimeout = 0;
                    }
                    if(currencyAlertHandle && typeof currencyAlertHandle.remove === 'function'){
                      currencyAlertHandle.remove();
                      currencyAlertHandle = null;
                    }
                    const handle = showCopyStyleMessage(currencyAlertMessage, inputEl);
                    if(!handle) return;
                    currencyAlertHandle = handle;
                    currencyAlertTimeout = window.setTimeout(()=>{
                      handle.remove();
                      if(currencyAlertHandle === handle){
                        currencyAlertHandle = null;
                      }
                      currencyAlertTimeout = 0;
                    }, 1500);
                  };
                  previewField.options.forEach((optionValue, optionIndex)=>{
                    const optionRow = document.createElement('div');
                    optionRow.className = 'version-price-option';
                    optionRow.dataset.optionIndex = String(optionIndex);

                    const topRow = document.createElement('div');
                    topRow.className = 'version-price-row version-price-row--top';

                    const versionInput = document.createElement('input');
                    versionInput.type = 'text';
                    versionInput.className = 'version-price-name';
                    versionInput.placeholder = 'Version Name';
                    const versionInputId = `${baseId}-version-${optionIndex}`;
                    versionInput.id = versionInputId;
                    if(optionIndex === 0){
                      firstId = versionInputId;
                    }
                    versionInput.value = optionValue.version || '';
                    versionInput.addEventListener('input', ()=>{
                      previewField.options[optionIndex].version = versionInput.value;
                      notifyFormbuilderChange();
                    });
                    topRow.appendChild(versionInput);

                    const bottomRow = document.createElement('div');
                    bottomRow.className = 'version-price-row version-price-row--bottom';

                    const currencySelect = document.createElement('select');
                    currencySelect.className = 'version-price-currency';
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = 'Currency';
                    currencySelect.appendChild(emptyOption);
                    VERSION_PRICE_CURRENCIES.forEach(code => {
                      const opt = document.createElement('option');
                      opt.value = code;
                      opt.textContent = code;
                      currencySelect.appendChild(opt);
                    });
                    currencySelect.value = optionValue.currency || '';
                    const isCurrencySelected = ()=> currencySelect.value.trim() !== '';

                    const priceInput = document.createElement('input');
                    priceInput.type = 'text';
                    priceInput.inputMode = 'decimal';
                    priceInput.pattern = '[0-9]+([\.,][0-9]{0,2})?';
                    priceInput.className = 'version-price-price';
                    priceInput.placeholder = '0.00';
                    const sanitizePriceValue = value => (value || '').replace(/[^0-9.,]/g, '');
                    const formatPriceValue = value => {
                      const trimmed = (value || '').trim();
                      if(trimmed === '') return '';
                      let normalized = trimmed.replace(/,/g, '.');
                      if(normalized === '.') return '0.00';
                      if(normalized.startsWith('.')){
                        normalized = `0${normalized}`;
                      }
                      const dotIndex = normalized.indexOf('.');
                      if(dotIndex === -1){
                        return `${normalized}.00`;
                      }
                      let integerPart = normalized.slice(0, dotIndex).replace(/\./g, '');
                      if(integerPart === ''){
                        integerPart = '0';
                      }
                      let decimalPart = normalized.slice(dotIndex + 1).replace(/\./g, '');
                      if(decimalPart.length === 0){
                        decimalPart = '00';
                      } else if(decimalPart.length === 1){
                        decimalPart = `${decimalPart}0`;
                      } else {
                        decimalPart = decimalPart.slice(0, 2);
                      }
                      return `${integerPart}.${decimalPart}`;
                    };
                    const initialPriceValue = sanitizePriceValue(optionValue.price || '');
                    const formattedInitialPrice = formatPriceValue(initialPriceValue);
                    priceInput.value = formattedInitialPrice;
                    if(formattedInitialPrice !== (previewField.options[optionIndex].price || '')){
                      previewField.options[optionIndex].price = formattedInitialPrice;
                    }
                    const clearPriceValue = ()=>{
                      let changed = false;
                      if(priceInput.value !== ''){
                        priceInput.value = '';
                        changed = true;
                      }
                      if(previewField.options[optionIndex].price !== ''){
                        previewField.options[optionIndex].price = '';
                        changed = true;
                      } else if(typeof previewField.options[optionIndex].price !== 'string'){
                        previewField.options[optionIndex].price = '';
                      }
                      return changed;
                    };
                    const updatePriceState = ()=>{
                      if(isCurrencySelected()){
                        priceInput.readOnly = false;
                        priceInput.classList.remove('is-awaiting-currency');
                        priceInput.removeAttribute('aria-disabled');
                        return false;
                      }
                      priceInput.readOnly = true;
                      priceInput.classList.add('is-awaiting-currency');
                      priceInput.setAttribute('aria-disabled', 'true');
                      return clearPriceValue();
                    };
                    const blockPriceAccess = event => {
                      if(isCurrencySelected()) return false;
                      if(event && event.type === 'pointerdown' && event.button !== 0) return false;
                      if(event && typeof event.preventDefault === 'function'){
                        event.preventDefault();
                      }
                      if(event && typeof event.stopPropagation === 'function'){
                        event.stopPropagation();
                      }
                      if(typeof priceInput.blur === 'function'){
                        requestAnimationFrame(()=>{
                          try{ priceInput.blur(); }catch(err){}
                        });
                      }
                      showCurrencyAlert(priceInput);
                      return true;
                    };
                    currencySelect.addEventListener('change', ()=>{
                      const previousCurrency = previewField.options[optionIndex].currency || '';
                      const nextCurrency = currencySelect.value;
                      previewField.options[optionIndex].currency = nextCurrency;
                      const priceCleared = updatePriceState();
                      if(isCurrencySelected()){
                        commitPriceValue();
                      }
                      if(previousCurrency !== nextCurrency || priceCleared){
                        notifyFormbuilderChange();
                      }
                    });

                    const commitPriceValue = event => {
                      if(!isCurrencySelected()){
                        if(clearPriceValue()){
                          notifyFormbuilderChange();
                        }
                        return;
                      }
                      const rawValue = priceInput.value;
                      const sanitized = sanitizePriceValue(rawValue);
                      if(rawValue !== sanitized){
                        priceInput.value = sanitized;
                      }
                      const formatted = formatPriceValue(sanitized);
                      if(priceInput.value !== formatted){
                        priceInput.value = formatted;
                      }
                      if(event && document.activeElement === priceInput && typeof priceInput.setSelectionRange === 'function'){
                        if(formatted === ''){
                          priceInput.setSelectionRange(0, 0);
                        } else if(!/[.,]/.test(sanitized)){ 
                          const dotIndex = formatted.indexOf('.');
                          const caretPos = dotIndex === -1 ? formatted.length : Math.min(sanitized.length, dotIndex);
                          priceInput.setSelectionRange(caretPos, caretPos);
                        } else {
                          const dotIndex = formatted.indexOf('.');
                          if(dotIndex === -1){
                            priceInput.setSelectionRange(formatted.length, formatted.length);
                          } else {
                            const decimals = sanitized.split(/[.,]/)[1] || '';
                            if(decimals.length === 0){
                              priceInput.setSelectionRange(dotIndex + 1, formatted.length);
                            } else {
                              const caretPos = Math.min(dotIndex + 1 + decimals.length, formatted.length);
                              priceInput.setSelectionRange(caretPos, caretPos);
                            }
                          }
                        }
                      }
                      const previous = previewField.options[optionIndex].price || '';
                      if(previous !== formatted){
                        previewField.options[optionIndex].price = formatted;
                        notifyFormbuilderChange();
                      }
                    };
                    priceInput.addEventListener('beforeinput', event => {
                      if(event && typeof event.data === 'string' && /[^0-9.,]/.test(event.data)){
                        event.preventDefault();
                      }
                    });
                    priceInput.addEventListener('pointerdown', event => {
                      blockPriceAccess(event);
                    });
                    priceInput.addEventListener('focus', event => {
                      blockPriceAccess(event);
                    });
                    priceInput.addEventListener('keydown', event => {
                      if(event.key === 'Tab' || event.key === 'Shift') return;
                      if(blockPriceAccess(event)) return;
                    });
                    priceInput.addEventListener('input', commitPriceValue);
                    priceInput.addEventListener('change', commitPriceValue);
                    const initialCleared = updatePriceState();
                    if(isCurrencySelected()){
                      commitPriceValue();
                    } else if(initialCleared){
                      notifyFormbuilderChange();
                    }

                    const actions = document.createElement('div');
                    actions.className = 'dropdown-option-actions version-price-option-actions';

                    const addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'dropdown-option-add';
                    addBtn.textContent = '+';
                    addBtn.setAttribute('aria-label', `Add version after Version ${optionIndex + 1}`);
                    addBtn.addEventListener('click', ()=>{
                      previewField.options.splice(optionIndex + 1, 0, createEmptyOption());
                      notifyFormbuilderChange();
                      renderVersionEditor(optionIndex + 1);
                    });

                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'dropdown-option-remove';
                    removeBtn.textContent = '-';
                    removeBtn.setAttribute('aria-label', `Remove Version ${optionIndex + 1}`);
                    removeBtn.disabled = previewField.options.length <= 1;
                    removeBtn.addEventListener('click', ()=>{
                      if(previewField.options.length <= 1){
                        previewField.options[0] = createEmptyOption();
                      } else {
                        previewField.options.splice(optionIndex, 1);
                      }
                      notifyFormbuilderChange();
                      const nextFocus = Math.min(optionIndex, Math.max(previewField.options.length - 1, 0));
                      renderVersionEditor(nextFocus);
                    });

                    actions.append(addBtn, removeBtn);
                    bottomRow.append(currencySelect, priceInput, actions);

                    optionRow.append(topRow, bottomRow);
                    versionList.appendChild(optionRow);
                  });


                  if(focusIndex !== null){
                    requestAnimationFrame(()=>{
                      const targetRow = versionList.querySelector(`.version-price-option[data-option-index="${focusIndex}"]`);
                      if(!targetRow) return;
                      let focusEl = null;
                      if(focusTarget === 'price'){
                        focusEl = targetRow.querySelector('.version-price-price');
                      } else if(focusTarget === 'currency'){
                        focusEl = targetRow.querySelector('.version-price-currency');
                      }
                      if(!focusEl){
                        focusEl = targetRow.querySelector('.version-price-name');
                      }
                      if(focusEl && typeof focusEl.focus === 'function'){
                        try{ focusEl.focus({ preventScroll: true }); }
                        catch(err){
                          try{ focusEl.focus(); }catch(e){}
                        }
                      }
                    });
                  }
                };

                renderVersionEditor();
                editor.setAttribute('aria-required', previewField.required ? 'true' : 'false');
                control = editor;
              } else if(previewField.type === 'website-url' || previewField.type === 'tickets-url'){
                wrapper.classList.add('form-preview-field--url');
                const urlWrapper = document.createElement('div');
                urlWrapper.className = 'form-preview-url-wrapper';
                const urlInput = document.createElement('input');
                urlInput.type = 'text';
                urlInput.className = 'form-preview-url-input';
                const urlInputId = `${baseId}-input`;
                urlInput.id = urlInputId;
                const placeholderValue = previewField.placeholder && /\.[A-Za-z]{2,}/.test(previewField.placeholder)
                  ? previewField.placeholder
                  : 'https://example.com';
                urlInput.placeholder = placeholderValue;
                urlInput.dataset.urlType = previewField.type === 'website-url' ? 'website' : 'tickets';
                urlInput.dataset.urlMessage = 'Please enter a valid URL with a dot and letters after it.';
                const linkId = `${baseId}-link`;
                urlInput.dataset.urlLinkId = linkId;
                urlInput.autocomplete = 'url';
                urlInput.inputMode = 'url';
                const urlLink = document.createElement('a');
                urlLink.id = linkId;
                urlLink.href = '#';
                urlLink.target = '_blank';
                urlLink.rel = 'noopener noreferrer';
                urlLink.className = 'form-preview-url-link';
                urlLink.textContent = 'Open link';
                urlLink.setAttribute('aria-disabled','true');
                urlLink.tabIndex = -1;
                const urlMessage = document.createElement('div');
                urlMessage.className = 'form-preview-url-message';
                urlMessage.textContent = 'Link disabled until a valid URL is entered.';
                urlWrapper.append(urlInput, urlLink, urlMessage);
                control = urlWrapper;
              } else if(previewField.type === 'images'){
                wrapper.classList.add('form-preview-field--images');
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'form-preview-images';
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                const fileInputId = `${baseId}-input`;
                fileInput.id = fileInputId;
                fileInput.accept = 'image/*';
                fileInput.multiple = true;
                fileInput.dataset.imagesField = 'true';
                fileInput.dataset.maxImages = '10';
                const previewId = `${baseId}-previews`;
                const messageId = `${baseId}-message`;
                fileInput.dataset.imagePreviewTarget = previewId;
                fileInput.dataset.imageMessageTarget = messageId;
                const hint = document.createElement('div');
                hint.className = 'form-preview-image-hint';
                hint.textContent = 'Upload up to 10 images.';
                const message = document.createElement('div');
                message.className = 'form-preview-image-message';
                message.id = messageId;
                message.hidden = true;
                const previewGrid = document.createElement('div');
                previewGrid.className = 'form-preview-image-previews';
                previewGrid.id = previewId;
                imageWrapper.append(fileInput, hint, message, previewGrid);
                control = imageWrapper;
              } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = previewField.placeholder || '';
                input.readOnly = true;
                input.tabIndex = -1;
                const inputId = `${baseId}-input`;
                input.id = inputId;
                if(previewField.type === 'title'){
                  input.classList.add('form-preview-title-input');
                }
                control = input;
              }
              if(control){
                if(control instanceof HTMLElement){
                  control.setAttribute('aria-required', previewField.required ? 'true' : 'false');
                  if(labelId){
                    control.setAttribute('aria-labelledby', labelId);
                  }
                }
                labelButton.addEventListener('click', event=>{
                  event.preventDefault();
                  let targetRow = previewField && previewField.__rowEl;
                  if(!targetRow || !targetRow.isConnected){
                    targetRow = Array.from(fieldsList.querySelectorAll('.subcategory-field-row')).find(row => row.__fieldRef === previewField) || targetRow;
                  }
                  if(targetRow && typeof openSubcategoryFieldOverlay === 'function'){
                    openSubcategoryFieldOverlay(targetRow, labelText, event.currentTarget || event.target);
                  }
                });
                if(previewField.required){
                  wrapper.classList.add('form-preview-field--required');
                  labelButton.appendChild(document.createTextNode(' '));
                  const asterisk = document.createElement('span');
                  asterisk.className = 'required-asterisk';
                  asterisk.textContent = '*';
                  labelButton.appendChild(asterisk);
                }
                wrapper.append(labelButton, control);
                formPreviewFields.appendChild(wrapper);
              }
            });
          }

          if(fieldsContainerState){
            fieldsContainerState.onFieldsReordered = renderFormPreview;
          }

          const createFieldRow = (field)=>{
            const safeField = ensureFieldDefaults(field);
            const row = document.createElement('div');
            row.className = 'subcategory-field-row';

            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-row-header';
            row._header = fieldHeader;

            const fieldNameInput = document.createElement('input');
            fieldNameInput.type = 'text';
            fieldNameInput.className = 'field-name-input';
            fieldNameInput.placeholder = 'Field Name';
            fieldNameInput.value = safeField.name;

            const fieldTypeSelect = document.createElement('select');
            fieldTypeSelect.className = 'field-type-select';
            FORM_FIELD_TYPES.forEach(optionDef => {
              const option = document.createElement('option');
              option.value = optionDef.value;
              option.textContent = optionDef.label;
              if(optionDef.value === safeField.type){
                option.selected = true;
              }
              fieldTypeSelect.appendChild(option);
            });

            const fieldTypeWrapper = document.createElement('div');
            fieldTypeWrapper.className = 'field-type-select-wrapper';
            const fieldTypeArrow = document.createElement('span');
            fieldTypeArrow.className = 'field-type-select-arrow';
            fieldTypeArrow.setAttribute('aria-hidden', 'true');
            fieldTypeArrow.textContent = '▾';
            fieldTypeWrapper.append(fieldTypeSelect, fieldTypeArrow);

            const fieldPlaceholderInput = document.createElement('input');
            fieldPlaceholderInput.type = 'text';
            fieldPlaceholderInput.className = 'field-placeholder-input';
            fieldPlaceholderInput.placeholder = 'Field Placeholder';
            fieldPlaceholderInput.value = safeField.placeholder;

            const fieldPlaceholderWrapper = document.createElement('div');
            fieldPlaceholderWrapper.className = 'field-placeholder-wrapper';
            fieldPlaceholderWrapper.appendChild(fieldPlaceholderInput);

            const fieldRequiredRow = document.createElement('div');
            fieldRequiredRow.className = 'field-required-row';
            const fieldRequiredLabel = document.createElement('span');
            fieldRequiredLabel.className = 'field-required-label';
            fieldRequiredLabel.textContent = 'Required Field';
            const fieldRequiredOptions = document.createElement('div');
            fieldRequiredOptions.className = 'field-required-options';
            const requiredGroupName = `field-required-${Math.random().toString(36).slice(2)}`;

            const requiredYesLabel = document.createElement('label');
            requiredYesLabel.className = 'field-required-option';
            const requiredYesInput = document.createElement('input');
            requiredYesInput.type = 'radio';
            requiredYesInput.name = requiredGroupName;
            requiredYesInput.value = 'yes';
            requiredYesInput.checked = !!safeField.required;
            const requiredYesText = document.createElement('span');
            requiredYesText.textContent = 'Yes';
            requiredYesLabel.append(requiredYesInput, requiredYesText);

            const requiredNoLabel = document.createElement('label');
            requiredNoLabel.className = 'field-required-option';
            const requiredNoInput = document.createElement('input');
            requiredNoInput.type = 'radio';
            requiredNoInput.name = requiredGroupName;
            requiredNoInput.value = 'no';
            requiredNoInput.checked = !safeField.required;
            const requiredNoText = document.createElement('span');
            requiredNoText.textContent = 'No';
            requiredNoLabel.append(requiredNoInput, requiredNoText);

            const updateRequiredState = (nextRequired)=>{
              const next = !!nextRequired;
              if(next === safeField.required) return;
              safeField.required = next;
              notifyFormbuilderChange();
              renderFormPreview();
            };

            requiredYesInput.addEventListener('change', ()=>{
              if(requiredYesInput.checked){
                updateRequiredState(true);
              }
            });

            requiredNoInput.addEventListener('change', ()=>{
              if(requiredNoInput.checked){
                updateRequiredState(false);
              }
            });

            fieldRequiredOptions.append(requiredYesLabel, requiredNoLabel);
            fieldRequiredRow.append(fieldRequiredLabel, fieldRequiredOptions);

            const dropdownOptionsContainer = document.createElement('div');
            dropdownOptionsContainer.className = 'dropdown-options-editor';
            const dropdownOptionsLabel = document.createElement('div');
            dropdownOptionsLabel.className = 'dropdown-options-label';
            dropdownOptionsLabel.textContent = 'Field Options';
            const dropdownOptionsList = document.createElement('div');
            dropdownOptionsList.className = 'dropdown-options-list';
            dropdownOptionsContainer.append(dropdownOptionsLabel, dropdownOptionsList);

            let draggedOptionRow = null;

            const ensureDropdownSeeds = ()=>{
              if(!Array.isArray(safeField.options)){
                safeField.options = [];
              }
              if((safeField.type === 'dropdown' || safeField.type === 'radio-toggle') && safeField.options.length === 0){
                safeField.options.push('', '', '');
                notifyFormbuilderChange();
              }
            };

            const renderDropdownOptions = (focusIndex = null)=>{
              const isOptionsType = safeField.type === 'dropdown' || safeField.type === 'radio-toggle';
              if(!isOptionsType){
                dropdownOptionsList.innerHTML = '';
                return;
              }
              ensureDropdownSeeds();
              dropdownOptionsList.innerHTML = '';
              safeField.options.forEach((optionValue, optionIndex)=>{
                const optionText = typeof optionValue === 'string'
                  ? optionValue
                  : (optionValue && typeof optionValue === 'object' && typeof optionValue.version === 'string'
                    ? optionValue.version
                    : '');
                const optionRow = document.createElement('div');
                optionRow.className = 'dropdown-option-row';
                optionRow.draggable = true;
                optionRow._optionValue = safeField.options[optionIndex];

                const optionInput = document.createElement('input');
                optionInput.type = 'text';
                optionInput.className = 'dropdown-option-input';
                optionInput.placeholder = `Option ${optionIndex + 1}`;
                optionInput.value = optionText;
                optionInput.addEventListener('input', ()=>{
                  safeField.options[optionIndex] = optionInput.value;
                  optionRow._optionValue = optionInput.value;
                  notifyFormbuilderChange();
                  renderFormPreview();
                });

                const actions = document.createElement('div');
                actions.className = 'dropdown-option-actions';

                const addOptionBtn = document.createElement('button');
                addOptionBtn.type = 'button';
                addOptionBtn.className = 'dropdown-option-add';
                addOptionBtn.textContent = '+';
                addOptionBtn.setAttribute('aria-label', `Add option after Option ${optionIndex + 1}`);
                addOptionBtn.addEventListener('click', ()=>{
                  safeField.options.splice(optionIndex + 1, 0, '');
                  notifyFormbuilderChange();
                  renderDropdownOptions(optionIndex + 1);
                  renderFormPreview();
                });

                const removeOptionBtn = document.createElement('button');
                removeOptionBtn.type = 'button';
                removeOptionBtn.className = 'dropdown-option-remove';
                removeOptionBtn.textContent = '-';
                removeOptionBtn.setAttribute('aria-label', `Remove Option ${optionIndex + 1}`);
                removeOptionBtn.addEventListener('click', ()=>{
                  if(safeField.options.length <= 1){
                    safeField.options[0] = '';
                  } else {
                    safeField.options.splice(optionIndex, 1);
                  }
                  notifyFormbuilderChange();
                  const nextFocus = Math.min(optionIndex, Math.max(safeField.options.length - 1, 0));
                  renderDropdownOptions(nextFocus);
                  renderFormPreview();
                });

                actions.append(addOptionBtn, removeOptionBtn);
                optionRow.append(optionInput, actions);

                optionRow.addEventListener('dragstart', event=>{
                  const origin = event.target;
                  const tagName = origin && origin.tagName ? origin.tagName.toLowerCase() : '';
                  if(tagName === 'input' || tagName === 'button'){
                    event.preventDefault();
                    return;
                  }
                  draggedOptionRow = optionRow;
                  optionRow.classList.add('is-dragging');
                  if(event.dataTransfer){
                    event.dataTransfer.effectAllowed = 'move';
                    try{ event.dataTransfer.setData('text/plain', optionInput.value || 'Option'); }catch(err){}
                    try{
                      const rect = optionRow.getBoundingClientRect();
                      event.dataTransfer.setDragImage(optionRow, rect.width / 2, rect.height / 2);
                    }catch(err){}
                  }
                });

                optionRow.addEventListener('dragend', ()=>{
                  optionRow.classList.remove('is-dragging');
                  draggedOptionRow = null;
                });

                dropdownOptionsList.appendChild(optionRow);

                if(focusIndex === optionIndex){
                  requestAnimationFrame(()=>{
                    try{ optionInput.focus({ preventScroll: true }); }
                    catch(err){
                      try{ optionInput.focus(); }catch(e){}
                    }
                  });
                }
              });
            };

            const getDragAfterOption = (mouseY)=>{
              const rows = Array.from(dropdownOptionsList.querySelectorAll('.dropdown-option-row')).filter(row => row !== draggedOptionRow);
              let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
              rows.forEach(row => {
                const rect = row.getBoundingClientRect();
                const offset = mouseY - (rect.top + rect.height / 2);
                if(offset < 0 && offset > closest.offset){
                  closest = { offset, element: row };
                }
              });
              return closest.element;
            };

            dropdownOptionsList.addEventListener('dragover', event=>{
              if(!draggedOptionRow) return;
              event.preventDefault();
              if(event.dataTransfer){
                event.dataTransfer.dropEffect = 'move';
              }
              const afterElement = getDragAfterOption(event.clientY);
              if(!afterElement){
                dropdownOptionsList.appendChild(draggedOptionRow);
              } else if(afterElement !== draggedOptionRow){
                dropdownOptionsList.insertBefore(draggedOptionRow, afterElement);
              }
            });

            dropdownOptionsList.addEventListener('drop', event=>{
              if(!draggedOptionRow) return;
              event.preventDefault();
              const orderedValues = Array.from(dropdownOptionsList.querySelectorAll('.dropdown-option-row')).map(row => (
                row && Object.prototype.hasOwnProperty.call(row, '_optionValue') ? row._optionValue : ''
              ));
              safeField.options.splice(0, safeField.options.length, ...orderedValues);
              if(draggedOptionRow){
                draggedOptionRow.classList.remove('is-dragging');
                draggedOptionRow = null;
              }
              notifyFormbuilderChange();
              renderDropdownOptions();
              renderFormPreview();
            });

            const deleteFieldBtn = document.createElement('button');
            deleteFieldBtn.type = 'button';
            deleteFieldBtn.className = 'delete-field-btn';
            deleteFieldBtn.textContent = '×';

            const updateDeleteFieldAria = ()=>{
              const displayName = fieldNameInput.value.trim() || 'field';
              deleteFieldBtn.setAttribute('aria-label', `Delete ${displayName} field`);
              deleteFieldBtn.setAttribute('title', `Delete ${displayName} field`);
            };

            fieldNameInput.addEventListener('input', ()=>{
              safeField.name = fieldNameInput.value;
              updateDeleteFieldAria();
              notifyFormbuilderChange();
              renderFormPreview();
            });

            fieldTypeSelect.addEventListener('change', ()=>{
              const previousType = safeField.type;
              const previousLabel = getFormFieldTypeLabel(previousType).trim();
              const currentName = fieldNameInput.value.trim();
              const nextType = fieldTypeSelect.value;
              const nextValidType = FORM_FIELD_TYPES.some(opt => opt.value === nextType) ? nextType : 'text-box';
              const nextLabel = getFormFieldTypeLabel(nextValidType).trim();
              const shouldAutofillName = !currentName || (previousLabel && currentName === previousLabel);
              safeField.type = nextValidType;
              if(shouldAutofillName && nextLabel){
                safeField.name = nextLabel;
                fieldNameInput.value = nextLabel;
                updateDeleteFieldAria();
              }
              notifyFormbuilderChange();
              updateFieldEditorsByType();
              renderFormPreview();
            });

            fieldPlaceholderInput.addEventListener('input', ()=>{
              safeField.placeholder = fieldPlaceholderInput.value;
              notifyFormbuilderChange();
              renderFormPreview();
            });

          deleteFieldBtn.addEventListener('click', async ()=>{
            const fieldDisplayName = fieldNameInput.value.trim() || 'field';
            const confirmed = await confirmFormbuilderDeletion(`Delete the "${fieldDisplayName}" field?`, 'Delete Field');
            if(!confirmed) return;
            const idx = fields.indexOf(safeField);
            if(idx !== -1){
              fields.splice(idx, 1);
            }
            if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function' && subcategoryFieldOverlayContent.contains(row)){
              closeSubcategoryFieldOverlay();
            }
            const overlayPlaceholder = row.__overlayPlaceholder;
            if(overlayPlaceholder && overlayPlaceholder.parentNode){
              overlayPlaceholder.remove();
            }
            row.remove();
            if(safeField.__rowEl === row){
              delete safeField.__rowEl;
            }
            delete row.__overlayPlaceholder;
            delete row.__overlayParent;
            delete row.__overlayOverlay;
            notifyFormbuilderChange();
            syncFieldOrderFromDom(fieldsList, fields);
            renderFormPreview();
          });

            updateDeleteFieldAria();

            const updateFieldEditorsByType = ()=>{
              const type = safeField.type;
              const isOptionsType = type === 'dropdown' || type === 'radio-toggle';
              const showVersionPrice = type === 'version-price';
              const showVenueSession = type === 'venue-session-version-tier-price';
              const hidePlaceholder = isOptionsType || type === 'images' || showVersionPrice || showVenueSession;
              fieldPlaceholderWrapper.hidden = hidePlaceholder;
              if(type === 'images'){
                if(fieldPlaceholderInput.value){
                  fieldPlaceholderInput.value = '';
                }
                if(safeField.placeholder){
                  safeField.placeholder = '';
                  notifyFormbuilderChange();
                }
              } else if(showVenueSession && safeField.placeholder){
                safeField.placeholder = '';
                notifyFormbuilderChange();
              }
              dropdownOptionsContainer.hidden = !isOptionsType;
              if(showVenueSession){
                safeField.options = normalizeVenueSessionOptions(safeField.options);
              } else if(showVersionPrice){
                if(!Array.isArray(safeField.options) || safeField.options.length === 0){
                  safeField.options = [{ version: '', currency: '', price: '' }];
                  notifyFormbuilderChange();
                } else {
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
                }
              }
              if(type === 'dropdown'){
                dropdownOptionsLabel.textContent = 'Dropdown Options';
              } else if(type === 'radio-toggle'){
                dropdownOptionsLabel.textContent = 'Radio Options';
              } else {
                dropdownOptionsLabel.textContent = 'Field Options';
              }
              if(isOptionsType){
                if(!Array.isArray(safeField.options) || safeField.options.length === 0){
                  safeField.options = ['', '', ''];
                  notifyFormbuilderChange();
                }
                renderDropdownOptions();
              } else if(!showVersionPrice && !showVenueSession){
                dropdownOptionsList.innerHTML = '';
              } else if(showVenueSession){
                dropdownOptionsList.innerHTML = '';
              }
            };

            updateFieldEditorsByType();

            fieldHeader.append(fieldNameInput, deleteFieldBtn);

            row.append(fieldHeader, fieldTypeWrapper, fieldPlaceholderWrapper, fieldRequiredRow, dropdownOptionsContainer);
            row.__fieldRef = safeField;
            safeField.__rowEl = row;
            return {
              row,
              focus(){
                try{
                  fieldNameInput.focus({ preventScroll: true });
                }catch(err){
                  try{ fieldNameInput.focus(); }catch(e){}
                }
              },
              focusTypePicker(){
                const focusSelect = ()=>{
                  try{
                    fieldTypeSelect.focus({ preventScroll: true });
                  }catch(err){
                    try{ fieldTypeSelect.focus(); }catch(e){}
                  }
                };
                focusSelect();
                requestAnimationFrame(()=>{
                  if(typeof fieldTypeSelect.showPicker === 'function'){
                    try{
                      fieldTypeSelect.showPicker();
                      return;
                    }catch(err){}
                  }
                  try{
                    const openEvent = new MouseEvent('mousedown', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    fieldTypeSelect.dispatchEvent(openEvent);
                  }catch(err){}
                });
              }
            };
          };

          fields.forEach((existingField, fieldIndex) => {
            const fieldRow = createFieldRow(existingField);
            fieldRow.row.dataset.fieldIndex = String(fieldIndex);
            fieldsList.appendChild(fieldRow.row);
            enableFieldDrag(fieldRow.row, fieldsList, fields);
          });

          addFieldBtn.addEventListener('click', ()=>{
            const newField = ensureFieldDefaults({});
            fields.push(newField);
            const fieldRow = createFieldRow(newField);
            fieldsList.appendChild(fieldRow.row);
            fieldRow.row.dataset.fieldIndex = String(fields.length - 1);
            enableFieldDrag(fieldRow.row, fieldsList, fields);
            notifyFormbuilderChange();
            requestAnimationFrame(()=>{
              if(fieldRow && typeof fieldRow.focusTypePicker === 'function'){
                fieldRow.focusTypePicker();
              } else if(fieldRow && typeof fieldRow.focus === 'function'){
                fieldRow.focus();
              }
            });
            renderFormPreview();
          });

          renderFormPreview();

          const defaultSubName = sub || 'Subcategory';
          let currentSubName = defaultSubName;
          let lastSubName = defaultSubName;
          const getSubNameValue = ()=> subNameInput.value.trim();
          const getSubDisplayName = ()=> getSubNameValue() || lastSubName || defaultSubName;
          const updateSubIconDisplay = (src)=>{
            const displayName = getSubDisplayName();
            subLogo.innerHTML = '';
            if(src){
              const img = document.createElement('img');
              img.src = src;
              img.width = 20;
              img.height = 20;
              img.alt = '';
              subLogo.appendChild(img);
              subLogo.classList.add('has-icon');
              subcategoryIcons[currentSubName] = `<img src="${src}" width="20" height="20" alt="">`;
            } else {
              subLogo.textContent = displayName.charAt(0) || '';
              subLogo.classList.remove('has-icon');
              delete subcategoryIcons[currentSubName];
            }
          };
          const applySubNameChange = ()=>{
            const rawValue = getSubNameValue();
            if(rawValue){
              lastSubName = rawValue;
            }
            const displayName = getSubDisplayName();
            const datasetValue = displayName;
            subLabel.textContent = displayName;
            subMenu.dataset.subcategory = datasetValue;
            subBtn.dataset.subcategory = datasetValue;
            subInput.setAttribute('aria-label', `Toggle ${displayName} subcategory`);
            subUploadInput.setAttribute('aria-label', `Upload icon for ${displayName}`);
            subPreviewImg.alt = `${displayName} icon preview`;
            subPlaceholder.innerHTML = `Customize the <strong>${displayName}</strong> subcategory.`;
            const categoryDisplayName = getCategoryDisplayName();
            deleteSubBtn.setAttribute('aria-label', `Delete ${displayName} subcategory from ${categoryDisplayName}`);
            addFieldBtn.setAttribute('aria-label', `Add field to ${displayName}`);
            formPreviewBtn.setAttribute('aria-label', `Preview ${displayName} form`);
            if(!subLogo.querySelector('img')){
              subLogo.textContent = displayName.charAt(0) || '';
              subLogo.classList.remove('has-icon');
            } else {
              subLogo.classList.add('has-icon');
            }
            if(currentSubName !== datasetValue){
              if(subcategoryIcons[currentSubName] !== undefined && subcategoryIcons[datasetValue] === undefined){
                subcategoryIcons[datasetValue] = subcategoryIcons[currentSubName];
              }
              if(subFieldsMap[currentSubName] !== undefined && subFieldsMap[datasetValue] === undefined){
                subFieldsMap[datasetValue] = subFieldsMap[currentSubName];
              }
              delete subcategoryIcons[currentSubName];
              if(subFieldsMap[currentSubName] !== undefined){
                delete subFieldsMap[currentSubName];
              }
              currentSubName = datasetValue;
            }
          };
          subNameUpdaters.push(applySubNameChange);
          subNameInput.addEventListener('input', ()=> applySubNameChange());

          deleteSubBtn.addEventListener('click', async ()=>{
            const categoryDisplayName = getCategoryDisplayName();
            const subDisplayName = getSubDisplayName();
            const confirmed = await confirmFormbuilderDeletion(`Delete the "${subDisplayName}" subcategory from ${categoryDisplayName}?`, 'Delete Subcategory');
            if(!confirmed) return;
            if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
              const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
              if(activeRow && subMenu.contains(activeRow)){
                closeSubcategoryFieldOverlay();
              }
            }
            subMenu.remove();
            delete subFieldsMap[currentSubName];
            notifyFormbuilderChange();
          });

          const normalizedSubIconPath = normalizeIconPath(subIconPath) || subIconPath || '';

          subContent.append(subNameInput, subIconPicker, subPlaceholder, fieldsSection, deleteSubBtn);

          subMenu.append(subContent);

          subUploadInput.addEventListener('change', ()=>{
            applySubNameChange();
            const file = subUploadInput.files && subUploadInput.files[0];
            if(file){
              const reader = new FileReader();
              reader.onload = ()=>{
                const result = typeof reader.result === 'string' ? reader.result : '';
                if(result){
                  subPreviewImg.src = result;
                  subPreview.classList.add('has-image');
                  subPreviewLabel.textContent = '';
                  subUploadLabelText.textContent = 'Change Icon';
                  updateSubIconDisplay(result);
                } else {
                  subPreviewImg.removeAttribute('src');
                  subPreview.classList.remove('has-image');
                  subPreviewLabel.textContent = 'No Icon';
                  subUploadLabelText.textContent = subIconPath ? 'Change Icon' : 'Upload Icon';
                  if(normalizedSubIconPath){
                    updateSubIconDisplay(normalizedSubIconPath);
                  } else {
                    updateSubIconDisplay('');
                  }
                }
              };
              reader.onerror = ()=>{
                subPreviewImg.removeAttribute('src');
                subPreview.classList.remove('has-image');
                subPreviewLabel.textContent = 'No Icon';
                subUploadLabelText.textContent = subIconPath ? 'Change Icon' : 'Upload Icon';
                if(normalizedSubIconPath){
                  updateSubIconDisplay(normalizedSubIconPath);
                } else {
                  updateSubIconDisplay('');
                }
              };
              reader.readAsDataURL(file);
            } else if(subIconPath){
              subPreviewImg.src = subIconPath;
              subPreview.classList.add('has-image');
              subPreviewLabel.textContent = '';
              subUploadLabelText.textContent = 'Change Icon';
              updateSubIconDisplay(normalizedSubIconPath);
            } else {
              subPreviewImg.removeAttribute('src');
              subPreview.classList.remove('has-image');
              subPreviewLabel.textContent = 'No Icon';
              subUploadLabelText.textContent = 'Upload Icon';
              updateSubIconDisplay('');
            }
          });

          applySubNameChange();
          if(subIconPath){
            updateSubIconDisplay(normalizedSubIconPath);
          }

          subBtn.addEventListener('click', ()=>{
            const isExpanded = subMenu.getAttribute('aria-expanded') === 'true';
            const next = !isExpanded;
            subMenu.setAttribute('aria-expanded', next ? 'true' : 'false');
            subBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
            subContent.hidden = !next;
            if(!next && subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
              const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
              if(activeRow && subMenu.contains(activeRow)){
                closeSubcategoryFieldOverlay();
              }
            }
          });

          subInput.addEventListener('change', ()=>{
            const isOn = subInput.checked;
            subMenu.classList.toggle('subcategory-off', !isOn);
            if(!isOn){
              if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
                const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
                if(activeRow && subMenu.contains(activeRow)){
                  closeSubcategoryFieldOverlay();
                }
              }
              if(subMenu.getAttribute('aria-expanded') === 'true'){
                subMenu.setAttribute('aria-expanded','false');
                subBtn.setAttribute('aria-expanded','false');
                subContent.hidden = true;
              }
            }
          });

          subMenusContainer.insertBefore(subMenu, addSubAnchor);
          enableSubcategoryDrag(subMenu, subMenusContainer, c, subHeader, addSubAnchor);
        });

        setupSubcategoryContainer(subMenusContainer, c, addSubAnchor);

        addSubBtn.addEventListener('click', ()=>{
          if(!Array.isArray(c.subs)){
            c.subs = [];
          }
          const baseName = 'New Subcategory';
          const existing = new Set(c.subs.map(sub => (sub && typeof sub === 'string') ? sub : ''));
          let candidate = baseName;
          let counter = 2;
          while(existing.has(candidate)){
            candidate = `${baseName} ${counter++}`;
          }
          c.subs.unshift(candidate);
          subFieldsMap[candidate] = [];
          const categoryIndex = categories.indexOf(c);
          renderFormbuilderCats();
          notifyFormbuilderChange();
          if(!formbuilderCats) return;
          const categorySelector = categoryIndex >= 0 ? `.category-form-menu[data-category-index="${categoryIndex}"]` : null;
          const categoryMenu = categorySelector ? formbuilderCats.querySelector(categorySelector) : null;
          if(!categoryMenu) return;
          categoryMenu.setAttribute('aria-expanded','true');
          const menuTrigger = categoryMenu.querySelector('.filter-category-trigger');
          const content = categoryMenu.querySelector('.category-form-content');
          if(menuTrigger) menuTrigger.setAttribute('aria-expanded','true');
          if(content) content.hidden = false;
          const newSubMenu = categoryMenu.querySelector('.subcategory-form-menu');
          if(!newSubMenu) return;
          newSubMenu.setAttribute('aria-expanded','true');
          const subTrigger = newSubMenu.querySelector('.subcategory-form-trigger');
          const subContent = newSubMenu.querySelector('.subcategory-form-content');
          if(subTrigger) subTrigger.setAttribute('aria-expanded','true');
          if(subContent) subContent.hidden = false;
          const subNameField = newSubMenu.querySelector('.subcategory-name-input');
          if(subNameField){
            requestAnimationFrame(()=>{
              try{ subNameField.focus({ preventScroll: true }); }
              catch(err){
                try{ subNameField.focus(); }catch(e){}
              }
            });
          }
        });

        applyCategoryNameChange();

        content.append(editMenu, subMenusContainer, categoryDeleteActions);
        menu.append(content);

        menuBtn.addEventListener('click', ()=>{
          const isExpanded = menu.getAttribute('aria-expanded') === 'true';
          const next = !isExpanded;
          menu.setAttribute('aria-expanded', next ? 'true' : 'false');
          menuBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
          content.hidden = !next;
        });

        toggleInput.addEventListener('change', ()=>{
          const isOn = toggleInput.checked;
          menu.classList.toggle('cat-off', !isOn);
          if(!isOn){
            if(menu.getAttribute('aria-expanded') === 'true'){
              menu.setAttribute('aria-expanded','false');
              menuBtn.setAttribute('aria-expanded','false');
              content.hidden = true;
            }
          }
        });

        uploadInput.addEventListener('change', ()=>{
          const file = uploadInput.files && uploadInput.files[0];
          if(file){
            const reader = new FileReader();
            reader.onload = ()=>{
              const result = typeof reader.result === 'string' ? reader.result : '';
              if(result){
                previewImg.src = result;
                preview.classList.add('has-image');
                previewLabel.textContent = '';
                uploadLabelText.textContent = 'Change Icon';
                updateCategoryIconDisplay(result);
              } else {
                previewImg.removeAttribute('src');
                preview.classList.remove('has-image');
                previewLabel.textContent = 'No Icon';
                uploadLabelText.textContent = baseIconPath ? 'Change Icon' : 'Upload Icon';
                if(baseIconPath20){
                  updateCategoryIconDisplay(baseIconPath20);
                } else if(baseIconPath){
                  updateCategoryIconDisplay(baseIconPath);
                } else {
                  updateCategoryIconDisplay('');
                }
              }
            };
            reader.onerror = ()=>{
              previewImg.removeAttribute('src');
              preview.classList.remove('has-image');
              previewLabel.textContent = 'No Icon';
              uploadLabelText.textContent = baseIconPath ? 'Change Icon' : 'Upload Icon';
              if(baseIconPath20){
                updateCategoryIconDisplay(baseIconPath20);
              } else if(baseIconPath){
                updateCategoryIconDisplay(baseIconPath);
              } else {
                updateCategoryIconDisplay('');
              }
            };
            reader.readAsDataURL(file);
          } else if(baseIconPath){
            previewImg.src = baseIconPath;
            preview.classList.add('has-image');
            previewLabel.textContent = '';
            uploadLabelText.textContent = 'Change Icon';
            updateCategoryIconDisplay(baseIconPath20 || baseIconPath);
          } else {
            previewImg.removeAttribute('src');
            preview.classList.remove('has-image');
            previewLabel.textContent = 'No Icon';
            uploadLabelText.textContent = 'Upload Icon';
            updateCategoryIconDisplay('');
          }
        });

        frag.appendChild(menu);
        enableCategoryDrag(menu, header);
      });
      formbuilderCats.innerHTML = '';
      formbuilderCats.appendChild(frag);
      refreshFormbuilderSubcategoryLogos();
    };
    if(formbuilderAddCategoryBtn){
      formbuilderAddCategoryBtn.addEventListener('click', ()=>{
        if(!Array.isArray(categories)) return;
        const baseName = 'New Category';
        const existing = new Set(categories.map(cat => (cat && typeof cat.name === 'string') ? cat.name : ''));
        let candidate = baseName;
        let counter = 2;
        while(existing.has(candidate)){
          candidate = `${baseName} ${counter++}`;
        }
        categories.unshift({ name: candidate, subs: [], subFields: {} });
        renderFormbuilderCats();
        notifyFormbuilderChange();
        const newMenu = formbuilderCats ? formbuilderCats.querySelector('.category-form-menu:first-of-type') : null;
        if(!newMenu) return;
        const menuTrigger = newMenu.querySelector('.filter-category-trigger');
        const content = newMenu.querySelector('.category-form-content');
        const editPanel = newMenu.querySelector('.category-edit-panel');
        const nameField = newMenu.querySelector('.category-name-input');
        newMenu.setAttribute('aria-expanded','true');
        if(menuTrigger) menuTrigger.setAttribute('aria-expanded','true');
        if(content) content.hidden = false;
        if(editPanel) editPanel.hidden = false;
        if(nameField){
          requestAnimationFrame(()=>{
            try{ nameField.focus({ preventScroll: true }); }
            catch(err){
              try{ nameField.focus(); }catch(e){}
            }
          });
        }
      });
    }
    function cloneFieldsMap(source){
      const out = {};
      if(source && typeof source === 'object' && !Array.isArray(source)){
        Object.keys(source).forEach(key => {
          const value = source[key];
          if(Array.isArray(value)){
            out[key] = value.map(field => ({
              name: field && typeof field.name === 'string' ? field.name : '',
              type: field && typeof field.type === 'string' && FORM_FIELD_TYPES.some(opt => opt.value === field.type)
                ? field.type
                : 'text-box',
              placeholder: field && typeof field.placeholder === 'string' ? field.placeholder : '',
              required: !!(field && field.required),
              options: Array.isArray(field && field.options)
                ? field.options.map(opt => {
                    if(field && field.type === 'version-price'){
                      if(opt && typeof opt === 'object'){
                        return {
                          version: typeof opt.version === 'string' ? opt.version : '',
                          currency: typeof opt.currency === 'string' ? opt.currency : '',
                          price: typeof opt.price === 'string' ? opt.price : ''
                        };
                      }
                      const str = typeof opt === 'string' ? opt : String(opt ?? '');
                      return { version: str, currency: '', price: '' };
                    }
                    if(field && field.type === 'venue-session-version-tier-price'){
                      return cloneVenueSessionVenue(opt);
                    }
                    if(typeof opt === 'string') return opt;
                    if(opt && typeof opt === 'object' && typeof opt.version === 'string'){
                      return opt.version;
                    }
                    return String(opt ?? '');
                  })
                : []
            }));
          } else {
            out[key] = [];
          }
        });
      }
      return out;
    }
    function cloneCategoryList(list){
      return Array.isArray(list) ? list.map(item => ({
        name: item && typeof item.name === 'string' ? item.name : '',
        subs: Array.isArray(item && item.subs) ? item.subs.slice() : [],
        subFields: cloneFieldsMap(item && item.subFields)
      })) : [];
    }
    function cloneMapLike(source){
      const out = {};
      if(source && typeof source === 'object'){
        Object.keys(source).forEach(key => {
          out[key] = source[key];
        });
      }
      return out;
    }
    function assignMapLike(target, source){
      if(!target || typeof target !== 'object') return;
      Object.keys(target).forEach(key => { delete target[key]; });
      if(source && typeof source === 'object'){
        Object.keys(source).forEach(key => {
          target[key] = source[key];
        });
      }
    }
    function captureFormbuilderSnapshot(){
      return {
        categories: cloneCategoryList(categories),
        subcategoryIcons: cloneMapLike(subcategoryIcons),
        subcategoryMarkers: cloneMapLike(subcategoryMarkers),
        subcategoryMarkerIds: cloneMapLike(subcategoryMarkerIds),
        categoryShapes: cloneMapLike(categoryShapes)
      };
    }
    let savedFormbuilderSnapshot = captureFormbuilderSnapshot();
    function restoreFormbuilderSnapshot(snapshot){
      if(!snapshot) return;
      const nextCategories = cloneCategoryList(snapshot.categories);
      if(Array.isArray(nextCategories)){
        categories.splice(0, categories.length, ...nextCategories);
      }
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
      assignMapLike(subcategoryIcons, snapshot.subcategoryIcons);
      assignMapLike(subcategoryMarkers, snapshot.subcategoryMarkers);
      assignMapLike(subcategoryMarkerIds, snapshot.subcategoryMarkerIds);
      assignMapLike(categoryShapes, snapshot.categoryShapes);
      renderFormbuilderCats();
      refreshSubcategoryLogos();
      refreshFormbuilderSubcategoryLogos();
    }
    function updateFormbuilderSnapshot(){
      savedFormbuilderSnapshot = captureFormbuilderSnapshot();
    }
    window.formbuilderStateManager = {
      capture: captureFormbuilderSnapshot,
      restoreSaved(){ restoreFormbuilderSnapshot(savedFormbuilderSnapshot); },
      save(){ updateFormbuilderSnapshot(); },
      getSaved(){ return savedFormbuilderSnapshot ? JSON.parse(JSON.stringify(savedFormbuilderSnapshot)) : null; },
      restore(snapshot){ restoreFormbuilderSnapshot(snapshot); }
    };
    function updateCategoryResetBtn(){
      if(!resetCategoriesBtn) return;
      const anyCategoryOff = Object.values(categoryControllers).some(ctrl=>ctrl && typeof ctrl.isActive === 'function' && !ctrl.isActive());
      const totalSubs = allSubcategoryKeys.length;
      const activeSubs = selection.subs instanceof Set ? selection.subs.size : 0;
      const anySubOff = totalSubs > 0 && activeSubs < totalSubs;
      resetCategoriesBtn.classList.toggle('active', anyCategoryOff || anySubOff);
    }
    function refreshSubcategoryLogos(){
      Object.values(categoryControllers).forEach(ctrl=>{
        if(ctrl && typeof ctrl.refreshLogos === 'function'){
          ctrl.refreshLogos();
        }
      });
    }
    if(catsEl){
      const seedSubs = selection.subs.size === 0;
      categories.forEach(c=>{
        const el = document.createElement('div');
        el.className='filter-category-menu';
        el.dataset.category = c.name;
        el.setAttribute('role','group');
        el.setAttribute('aria-expanded','false');

        const header = document.createElement('div');
        header.className='filter-category-header';

        const triggerWrap = document.createElement('div');
        triggerWrap.className='options-dropdown filter-category-trigger-wrap';

        const menuBtn = document.createElement('button');
        menuBtn.type='button';
        menuBtn.className='filter-category-trigger';
        menuBtn.setAttribute('aria-haspopup','true');
        menuBtn.setAttribute('aria-expanded','false');
        const menuId = `filter-category-menu-${slugify(c.name)}`;
        menuBtn.setAttribute('aria-controls', menuId);

        const categoryLogo = document.createElement('span');
        categoryLogo.className='category-logo';
        const iconPrefix = (window.ICON_BASE || {})[c.name];
        if(iconPrefix){
          const img = document.createElement('img');
          img.src = `assets/icons-20/${iconPrefix}-20.webp`;
          img.width = 20;
          img.height = 20;
          img.alt = '';
          categoryLogo.appendChild(img);
        } else {
          categoryLogo.textContent = c.name.charAt(0) || '';
        }

        const label = document.createElement('span');
        label.className='label';
        label.textContent=c.name;

        const arrow = document.createElement('span');
        arrow.className='dropdown-arrow';
        arrow.setAttribute('aria-hidden','true');

        menuBtn.append(categoryLogo, label, arrow);

        const optionsMenu = document.createElement('div');
        optionsMenu.className='options-menu';
        optionsMenu.id = menuId;
        optionsMenu.hidden = true;

        triggerWrap.append(menuBtn, optionsMenu);

        const toggle = document.createElement('label');
        toggle.className='cat-switch';
        const input = document.createElement('input');
        input.type='checkbox';
        input.setAttribute('aria-label',`Toggle ${c.name} category`);
        const slider = document.createElement('span');
        slider.className='slider';
        toggle.append(input, slider);

        const subButtons = [];
        c.subs.forEach(s=>{
          const subBtn=document.createElement('button');
          subBtn.type='button';
          subBtn.className='subcategory-option';
          subBtn.dataset.category = c.name;
          subBtn.dataset.subcategory = s;
          const key = c.name+'::'+s;
          if(!allSubcategoryKeys.includes(key)){
            allSubcategoryKeys.push(key);
          }
          if(seedSubs){
            selection.subs.add(key);
          }
          const isSelected = selection.subs.has(key);
          subBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
          if(isSelected){
            subBtn.classList.add('on');
          }
          subBtn.innerHTML='<span class="subcategory-logo"></span><span class="subcategory-label"></span><span class="subcategory-switch" aria-hidden="true"><span class="track"></span><span class="thumb"></span></span>';
          const subLabel = subBtn.querySelector('.subcategory-label');
          if(subLabel){
            subLabel.textContent = s;
          }
          subBtn.addEventListener('click',()=>{
            if(!input.checked) return;
            const isActive = subBtn.getAttribute('aria-pressed') === 'true';
            if(isActive){
              subBtn.setAttribute('aria-pressed','false');
              subBtn.classList.remove('on');
              selection.subs.delete(key);
            } else {
              subBtn.setAttribute('aria-pressed','true');
              subBtn.classList.add('on');
              selection.subs.add(key);
            }
            applyFilters();
            updateCategoryResetBtn();
          });
          optionsMenu.appendChild(subBtn);
          subButtons.push(subBtn);
        });

        header.append(triggerWrap, toggle);
        el.appendChild(header);
        catsEl.appendChild(el);

        let openState = false;
        function syncExpanded(){
          const expanded = input.checked && openState;
          el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          menuBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          optionsMenu.hidden = !expanded;
        }
        function setOpenState(next){
          openState = !!next;
          syncExpanded();
        }
        function setCategoryActive(active, opts={}){
          const enabled = !!active;
          input.checked = enabled;
          el.classList.toggle('cat-off', !enabled);
          menuBtn.disabled = !enabled;
          menuBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
          subButtons.forEach(btn=>{
            btn.disabled = !enabled;
            btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
          });
          if(enabled){
            selection.cats.add(c.name);
          } else {
            selection.cats.delete(c.name);
            setOpenState(false);
          }
          syncExpanded();
          if(!opts.silent){
            applyFilters();
            updateResetBtn();
          }
          updateCategoryResetBtn();
        }
        menuBtn.addEventListener('click', ()=>{
          if(menuBtn.disabled) return;
          setOpenState(!openState);
        });
        input.addEventListener('change', ()=>{
          setCategoryActive(input.checked);
        });

        const controller = {
          name: c.name,
          element: el,
          setActive: (active, opts={})=> setCategoryActive(active, opts),
          setOpen: (open)=> setOpenState(open),
          getOpenState: ()=> openState,
          isActive: ()=> input.checked,
          syncSubs: ()=>{
            subButtons.forEach(btn=>{
              const subName = btn.dataset.subcategory;
              const key = c.name+'::'+subName;
              const selected = selection.subs.has(key);
              btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
              btn.classList.toggle('on', selected);
            });
          },
          refreshLogos: ()=>{
            subButtons.forEach(btn=>{
              const logoSpan = btn.querySelector('.subcategory-logo');
              if(!logoSpan) return;
              const iconHtml = subcategoryIcons[btn.dataset.subcategory] || '';
              logoSpan.innerHTML = iconHtml;
            });
          }
        };
        categoryControllers[c.name] = controller;
        setCategoryActive(true, {silent:true});
        controller.syncSubs();
        syncExpanded();
      });
      refreshSubcategoryLogos();
      renderFormbuilderCats();
      updateFormbuilderSnapshot();
      const handleIconsReady = ()=>{
        refreshSubcategoryLogos();
        refreshFormbuilderSubcategoryLogos();
      };
      document.addEventListener('subcategory-icons-ready', handleIconsReady);
      updateCategoryResetBtn();
      updateResetBtn();
    }

    if(resetCategoriesBtn){
      resetCategoriesBtn.addEventListener('click', ()=>{
        selection.subs = new Set(allSubcategoryKeys);
        Object.values(categoryControllers).forEach(ctrl=>{
          ctrl.setActive(true, {silent:true});
          ctrl.setOpen(false);
          ctrl.syncSubs();
        });
        applyFilters();
        updateResetBtn();
        updateCategoryResetBtn();
      });
    }

    // Reset
    $('#resetBtn').addEventListener('click',()=>{
      $('#keyword-textbox').value='';
      $('#daterange-textbox').value='';
      const minPriceInput = $('#min-price-input');
      const maxPriceInput = $('#max-price-input');
      if(minPriceInput) minPriceInput.value='';
      if(maxPriceInput) maxPriceInput.value='';
      const expired = $('#expiredToggle');
      if(expired){
        expired.checked = false;
        expiredWasOn = false;
      }
      dateStart = null;
      dateEnd = null;
      buildFilterCalendar(today, maxPickerDate);
      updateRangeClasses();
      updateInput();
      closeCalendarPopup();
      if(geocoder) geocoder.clear();
      applyFilters();
      updateClearButtons();
    });

    function updateClearButtons(){
      const kw = $('#keyword-textbox');
      const kwX = kw.parentElement.querySelector('.keyword-clear-button');
      kwX && kwX.classList.toggle('active', kw.value.trim() !== '');
      const minPriceInput = $('#min-price-input');
      const maxPriceInput = $('#max-price-input');
      const priceClear = $('#filterPanel .price-clear-button');
      const hasPrice = (minPriceInput && minPriceInput.value.trim() !== '') || (maxPriceInput && maxPriceInput.value.trim() !== '');
      priceClear && priceClear.classList.toggle('active', hasPrice);
      const date = $('#daterange-textbox');
      const dateX = date.parentElement.querySelector('.daterange-clear-button');
      const hasDate = (dateStart || dateEnd) || $('#expiredToggle').checked;
      dateX && dateX.classList.toggle('active', !!hasDate);
      updateResetBtn();
    }

    function nonLocationFiltersActive(){
      const kw = $('#keyword-textbox').value.trim() !== '';
      const raw = $('#daterange-textbox').value.trim();
      const hasDate = !!(dateStart || dateEnd || raw);
      const expired = $('#expiredToggle').checked;
      const {min, max} = getPriceFilterValues();
      const priceActive = min !== null || max !== null;
      return kw || hasDate || expired || priceActive;
    }

    function updateResetBtn(){
      const active = nonLocationFiltersActive();
      document.body.classList.toggle('filters-active', active);
      const reset = $('#resetBtn');
      reset && reset.classList.toggle('active', active);
    }

    function fmtShort(iso){
      return parseISODate(iso).toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'}).replace(/,/g,'');
    }

    const dateRangeInput = $('#daterange-textbox');
    $('#keyword-textbox').addEventListener('input', ()=>{ applyFilters(); updateClearButtons(); });
    const minPriceInput = $('#min-price-input');
    const maxPriceInput = $('#max-price-input');
    [minPriceInput, maxPriceInput].forEach(input=>{
      if(!input) return;
      input.addEventListener('input', ()=>{
        const sanitized = input.value.replace(/\D+/g,'');
        if(sanitized !== input.value){ input.value = sanitized; }
        applyFilters();
        updateClearButtons();
      });
    });
    dateRangeInput?.addEventListener('input', ()=>{ applyFilters(); updateClearButtons(); });
    if(dateRangeInput){
      dateRangeInput.addEventListener('focus', ()=> openCalendarPopup());
      dateRangeInput.addEventListener('click', ()=> openCalendarPopup());
    }
    $('#daterange-textbox').addEventListener('keydown', e=>{
      if(e.key === 'Tab'){
        closeCalendarPopup();
        return;
      }
      if(e.key === 'Escape'){
        e.preventDefault();
        closeCalendarPopup();
        return;
      }
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown'){
        e.preventDefault();
        openCalendarPopup(true);
        return;
      }
      if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
        e.preventDefault();
        openCalendarPopup();
        const month = calendarScroll ? calendarScroll.querySelector('.month') : null;
        const w = month ? month.offsetWidth : 0;
        if(calendarScroll && w){
          calendarScroll.scrollBy({left:e.key==='ArrowLeft'?-w:w, behavior:'smooth'});
        }
        return;
      }
      e.preventDefault();
    });
    const today = new Date();
    today.setHours(0,0,0,0);
    const minPickerDate = new Date(today);
    minPickerDate.setMonth(minPickerDate.getMonth() - 12);
    const maxPickerDate = new Date(today);
    maxPickerDate.setFullYear(maxPickerDate.getFullYear() + 2);
    const expiredToggle = $('#expiredToggle');
    const calendarScroll = $('#datePickerContainer');
    const filterBasics = $('#filterPanel .filter-basics-container');
    const filterPanelBody = $('#filterPanel .panel-body');
    let calendarPopupOpen = false;

    function positionCalendarPopup(){
      if(!calendarScroll || !dateRangeInput || !filterBasics) return;
      const inputRect = dateRangeInput.getBoundingClientRect();
      const containerRect = filterBasics.getBoundingClientRect();
      const left = inputRect.left - containerRect.left;
      const top = inputRect.bottom - containerRect.top + 8;
      const popupWidth = calendarScroll.offsetWidth || 0;
      const maxLeft = Math.max(0, containerRect.width - popupWidth);
      const clampedLeft = Math.min(Math.max(left, 0), maxLeft);
      calendarScroll.style.left = `${Math.round(clampedLeft)}px`;
      calendarScroll.style.top = `${Math.round(top)}px`;
    }

    function handleCalendarOutsideClick(e){
      if(!calendarScroll) return;
      if(calendarScroll.contains(e.target)) return;
      if(dateRangeInput && dateRangeInput.contains(e.target)) return;
      closeCalendarPopup();
    }

    function openCalendarPopup(focusCalendar = false){
      if(!calendarScroll) return;
      if(!calendarPopupOpen){
        calendarPopupOpen = true;
        calendarScroll.classList.add('is-visible');
        calendarScroll.setAttribute('tabindex','0');
        calendarScroll.setAttribute('aria-hidden','false');
        if(dateRangeInput) dateRangeInput.setAttribute('aria-expanded','true');
        document.addEventListener('click', handleCalendarOutsideClick, true);
        window.addEventListener('resize', positionCalendarPopup);
        filterPanelBody?.addEventListener('scroll', positionCalendarPopup, { passive:true });
      }
      positionCalendarPopup();
      if(focusCalendar){
        calendarScroll.focus({ preventScroll:true });
      }
    }

    function closeCalendarPopup(){
      if(!calendarScroll || !calendarPopupOpen) return;
      calendarPopupOpen = false;
      if(calendarScroll.contains(document.activeElement)){
        const activeEl = document.activeElement;
        if(activeEl && typeof activeEl.blur === 'function'){
          activeEl.blur();
        }
      }
      calendarScroll.setAttribute('tabindex','-1');
      calendarScroll.classList.remove('is-visible');
      calendarScroll.setAttribute('aria-hidden','true');
      if(dateRangeInput) dateRangeInput.setAttribute('aria-expanded','false');
      document.removeEventListener('click', handleCalendarOutsideClick, true);
      window.removeEventListener('resize', positionCalendarPopup);
      filterPanelBody?.removeEventListener('scroll', positionCalendarPopup);
    }

    function verticalCanScroll(el, delta){
      if(!el) return false;
      if(delta < 0) return el.scrollTop > 0;
      if(delta > 0) return el.scrollTop < el.scrollHeight - el.clientHeight;
      return false;
    }

    function setupHorizontalWheel(scroller){
      if(!scroller) return;
      scroller.addEventListener('wheel', e=>{
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if(delta !== 0){
          scroller.scrollLeft += delta;
          e.preventDefault();
        }
      }, {passive:false});
    }

    function smoothScroll(el, to, duration=600){
      const start = el.scrollLeft;
      const change = to - start;
      const startTime = performance.now();
      function animate(time){
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        el.scrollLeft = start + change * progress;
        if(progress < 1) requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);
    }

    function setupCalendarScroll(scroller){
      if(!scroller) return;
      scroller.setAttribute('tabindex','0');
      setupHorizontalWheel(scroller);
      const container = scroller.closest('.calendar-container');
      const adjustScale = () => {
        if(!container) return;
        const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--calendar-width')) || 0;
        const available = container.parentElement ? container.parentElement.clientWidth : container.clientWidth;
        const scale = base ? Math.min(1, available / base) : 1;
        container.style.setProperty('--calendar-scale', scale);
        if(calendarPopupOpen){
          positionCalendarPopup();
        }
      };
      if('ResizeObserver' in window && container){
        const ro = new ResizeObserver(adjustScale);
        ro.observe(container);
      }
      adjustScale();
      scroller.addEventListener('keydown', e=>{
        if(e.key==='Escape'){
          e.preventDefault();
          closeCalendarPopup();
          dateRangeInput?.focus({ preventScroll:true });
          return;
        }
        if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
          const m = scroller.querySelector('.month') || scroller.querySelector('.month-item');
          const w = m ? m.offsetWidth : 0;
          scroller.scrollLeft += e.key==='ArrowLeft'?-w:w;
          e.preventDefault();
        }
      });
        addPassiveScrollListener(scroller, ()=>{
          const marker = scroller.querySelector('.today-marker');
          if(marker){
            const base = parseFloat(marker.dataset.pos || '0');
            marker.style.left = `${base + Math.round(scroller.scrollLeft)}px`;
          }
        });
      }
      setupCalendarScroll(calendarScroll);
      expiredWasOn = expiredToggle && expiredToggle.checked;

    function scrollCalendarToToday(behavior='auto'){
      const calScroll = $('#datePickerContainer');
      if(!calScroll) return;
      const todayCell = calScroll.querySelector('.day.today');
      if(todayCell){
        const month = todayCell.closest('.month');
        const left = month ? month.offsetLeft : 0;
        calScroll.dataset.todayScroll = left;
        calScroll.scrollTo({left, behavior});
        const marker = calScroll.querySelector('.today-marker');
        if(marker){
          const base = parseFloat(marker.dataset.pos || '0');
          marker.style.left = `${base + left}px`;
        }
      }
    }
    window.scrollCalendarToToday = scrollCalendarToToday;

    function formatDisplay(date){
      const wd = date.toLocaleDateString('en-GB',{weekday:'short'});
      const day = date.getDate();
      const mon = date.toLocaleDateString('en-GB',{month:'short'});
      let str = `${wd} ${day} ${mon}`;
      if(date.getFullYear() !== today.getFullYear()) str += `, ${date.getFullYear()}`;
      return str;
    }

    function orderedRange(){
      if(dateStart && dateEnd){
        return dateStart <= dateEnd ? {start:dateStart,end:dateEnd} : {start:dateEnd,end:dateStart};
      }
      return {start:dateStart,end:dateEnd};
    }

    function sameDay(a,b){ return a.toDateString()===b.toDateString(); }
    function isToday(d){ return sameDay(d,today); }

    function updateRangeClasses(){
      const {start,end} = orderedRange();
      $('#datePicker').querySelectorAll('.day').forEach(day=>{
        const iso = day.dataset.iso;
        if(!iso) return;
        const [yy, mm, dd] = iso.split('-').map(Number);
        const d = new Date(yy, mm - 1, dd);
        day.classList.remove('selected','in-range','range-start','range-end');
        if(start && sameDay(d, start)) day.classList.add('selected','range-start');
        if(end && sameDay(d, end)) day.classList.add('selected','range-end');
        if(start && end && d>start && d<end) day.classList.add('in-range');
      });
    }

    function updateInput(){
      const input = $('#daterange-textbox');
      const {start,end} = orderedRange();
      if(start && end){
        input.value = `${formatDisplay(start)} - ${formatDisplay(end)}`;
      } else if(start){
        input.value = formatDisplay(start);
      } else {
        input.value = '';
      }
      applyFilters();
      updateClearButtons();
    }

    function selectRangeDate(date){
      if(!dateStart || dateEnd){ dateStart = date; dateEnd = null; }
      else { dateEnd = date; }
      updateRangeClasses();
      updateInput();
      if(dateEnd){
        closeCalendarPopup();
      }
    }

    function buildFilterCalendar(minDate, maxDate){
      const container = $('#datePicker');
      container.innerHTML='';
      const cal = document.createElement('div');
      cal.className='calendar';
      let current = new Date(minDate.getFullYear(), minDate.getMonth(),1);
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(),1);
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      let monthIndex = 0;
      let currentMonthIndex = 0;
      while(current <= end){
        const monthEl = document.createElement('div');
        monthEl.className='month';
        const header = document.createElement('div');
        header.className='calendar-header';
        header.textContent=current.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
        monthEl.appendChild(header);
        const grid = document.createElement('div');
        grid.className='grid';

        const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        weekdays.forEach(wd=>{
          const w=document.createElement('div');
          w.className='weekday';
          w.textContent=wd;
          grid.appendChild(w);
        });

        const firstDay = new Date(current.getFullYear(), current.getMonth(),1);
        const startDow = firstDay.getDay();
        const daysInMonth = new Date(current.getFullYear(), current.getMonth()+1,0).getDate();
        const totalCells = 42;
        for(let i=0;i<totalCells;i++){
          const cell=document.createElement('div');
          cell.className='day';
          const dayNum=i-startDow+1;
          if(i<startDow || dayNum>daysInMonth){
            cell.classList.add('empty');
          }else{
            cell.textContent=dayNum;
            const date=new Date(current.getFullYear(), current.getMonth(), dayNum);
            cell.dataset.iso = toISODate(date);
            if(date < todayDate) cell.classList.add('past');
            else cell.classList.add('future');
            if(isToday(date)) cell.classList.add('today');
            if(date >= minDate) cell.addEventListener('click', ()=> selectRangeDate(date));
          }
          grid.appendChild(cell);
        }
        monthEl.appendChild(grid);
        cal.appendChild(monthEl);
        if(current.getFullYear() === todayDate.getFullYear() && current.getMonth() === todayDate.getMonth()){
          currentMonthIndex = monthIndex;
        }
        current.setMonth(current.getMonth()+1);
        monthIndex++;
      }
      container.appendChild(cal);
      updateRangeClasses();
      if(calendarScroll){
        const monthWidth = cal.querySelector('.month').offsetWidth;
        const scrollPos = monthWidth * currentMonthIndex;
        const maxScroll = calendarScroll.scrollWidth - calendarScroll.clientWidth;
        const track = calendarScroll.clientWidth - 20;
        const pos = maxScroll ? scrollPos / maxScroll * track + 10 : 10;
        calendarScroll.querySelector('.today-marker')?.remove();
        const marker = document.createElement('div');
        marker.className = 'today-marker';
        marker.dataset.pos = pos;
        calendarScroll.appendChild(marker);
        marker.addEventListener('click', ()=> scrollCalendarToToday('smooth'));
      }
    }

    buildFilterCalendar(today, maxPickerDate);
    closeCalendarPopup();

    $$('#filterPanel .keyword-clear-button, #filterPanel .daterange-clear-button, #filterPanel .price-clear-button').forEach(btn=> btn.addEventListener('click',()=>{
      if(btn.classList.contains('price-clear-button')){
        const minInputEl = $('#min-price-input');
        const maxInputEl = $('#max-price-input');
        if(minInputEl) minInputEl.value='';
        if(maxInputEl) maxInputEl.value='';
        (minInputEl || maxInputEl)?.focus();
        applyFilters();
        updateClearButtons();
        return;
      }
      const input = btn.parentElement.querySelector('input');
      if(input){
        if(input.id==='daterange-textbox'){
          dateStart = null;
          dateEnd = null;
          updateRangeClasses();
          updateInput();
        } else {
          input.value='';
        }
        input.focus();
        applyFilters();
        updateClearButtons();
      }
    }));
    if(expiredToggle){
      expiredToggle.addEventListener('change', ()=>{
        const input = $('#daterange-textbox');
        const todayDate = new Date();
        todayDate.setHours(0,0,0,0);
        dateStart = null;
        dateEnd = null;
        if(expiredToggle.checked){
          buildFilterCalendar(minPickerDate, maxPickerDate);
        } else {
          buildFilterCalendar(todayDate, maxPickerDate);
        }
        expiredWasOn = expiredToggle.checked;
        updateRangeClasses();
        updateInput();
        closeCalendarPopup();
      });
      if(expiredToggle.checked){
        expiredToggle.dispatchEvent(new Event('change'));
      }
    }
    updateClearButtons();
    updateResetBtn();
    const optionsBtn = $('#optionsBtn');
    const optionsMenu = $('#optionsMenu');
    const favToggle = $('#favToggle');
    const sortButtons = $$('.sort-option');

    function updateSortBtnLabel(text){
      const hasMultiple = optionsMenu.querySelectorAll('button').length > 1;
      if(hasMultiple){
        optionsBtn.innerHTML = `${text}<span class="results-arrow" aria-hidden="true"></span>`;
      } else {
        optionsBtn.textContent = text;
      }
    }

    updateSortBtnLabel(optionsBtn.textContent);

    favToggle.addEventListener('click', ()=>{
      favToTop = !favToTop;
      favSortDirty = favToTop ? false : true;
      favToggle.setAttribute('aria-pressed', favToTop);
      renderLists(filtered);
    });

    sortButtons.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        currentSort = btn.dataset.sort;
        sortButtons.forEach(b=> b.setAttribute('aria-pressed', b===btn ? 'true' : 'false'));
        updateSortBtnLabel(btn.textContent);
        renderLists(filtered);
      });
    });

    optionsBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const open = !optionsMenu.hasAttribute('hidden');
      if(open){
        optionsMenu.setAttribute('hidden','');
        optionsBtn.setAttribute('aria-expanded','false');
      } else {
        optionsMenu.removeAttribute('hidden');
        optionsBtn.setAttribute('aria-expanded','true');
      }
    });
    optionsMenu.addEventListener('click', e=> e.stopPropagation());
      document.addEventListener('click', ()=>{
        optionsMenu.setAttribute('hidden','');
        optionsBtn.setAttribute('aria-expanded','false');
      });

      const recentsBoard = $('#recentsBoard');
      const adBoard = $('.ad-board');
      const boardsContainer = $('.post-mode-boards');
      const postBoard = $('.post-board');
      const recentsButton = $('#recents-button');
      const postsButton = $('#posts-button');
      const mapButton = $('#map-button');
      const boardDisplayCache = new WeakMap();
      let boardsInitialized = false;
      let userClosedPostBoard = false;
      const WIDE_SCREEN_CLUSTER_MIN_WIDTH = 1200;

      function isWideScreenPostBoard(){
        return window.innerWidth >= WIDE_SCREEN_CLUSTER_MIN_WIDTH;
      }

      function autoOpenPostBoardForCluster({ multiIds = [], multiCount = 0, trigger = 'click' } = {}){
        if(trigger !== 'click' && trigger !== 'touch') return;
        if(userClosedPostBoard) return;
        if(!isWideScreenPostBoard()) return;
        const normalizedIds = Array.isArray(multiIds)
          ? multiIds.map(id => String(id)).filter(Boolean)
          : [];
        const numericCount = Number(multiCount);
        const normalizedCount = Number.isFinite(numericCount) && numericCount > 0 ? numericCount : 0;
        const total = Math.max(normalizedIds.length, normalizedCount, 0);
        if(total <= 1) return;
        if(typeof setMode !== 'function') return;
        const wasPostsMode = document.body.classList.contains('mode-posts');
        const hadHistory = document.body.classList.contains('show-history');
        if(hadHistory){
          document.body.classList.remove('show-history');
        }
        if(!wasPostsMode){
          setMode('posts');
        } else if(hadHistory && typeof adjustBoards === 'function'){
          adjustBoards();
        }
      }

      updatePostsButtonState = function(currentZoom){
        const threshold = MARKER_ZOOM_THRESHOLD;
        let zoomValue = Number.isFinite(currentZoom) ? currentZoom : null;
        if(!Number.isFinite(zoomValue) && map && typeof map.getZoom === 'function'){
          try{ zoomValue = map.getZoom(); }catch(err){ zoomValue = null; }
        }
        const postsEnabled = Number.isFinite(zoomValue) ? zoomValue >= threshold : false;
        if(postsButton){
          postsButton.disabled = !postsEnabled;
          postsButton.setAttribute('aria-disabled', postsEnabled ? 'false' : 'true');
          postsButton.classList.toggle('is-disabled', !postsEnabled);
        }
        document.body.classList.toggle('hide-posts-ui', !postsEnabled);
        if(!postsEnabled){
          if(typeof setMode === 'function' && document.body.classList.contains('mode-posts')){
            setMode('map', true);
          }
          document.body.classList.remove('show-history');
          if(typeof adjustBoards === 'function'){ adjustBoards(); }
          if(typeof updateModeToggle === 'function'){ updateModeToggle(); }
        }
      };

      updatePostsButtonState(startZoom);

      function getDefaultBoardDisplay(board){
        if(!board) return 'block';
        if(boardDisplayCache.has(board)) return boardDisplayCache.get(board);
        let value = '';
        try{
          value = getComputedStyle(board).display;
        }catch(err){ value = ''; }
        if(!value || value === 'none'){
          if(board.classList.contains('post-board')) value = 'flex';
          else if(board.classList.contains('ad-board')) value = 'block';
          else value = 'block';
        }
        boardDisplayCache.set(board, value);
        return value;
      }

      function clearBoardHide(board){
        if(!board) return;
        if(board._boardHideHandler){
          board.removeEventListener('transitionend', board._boardHideHandler);
          board._boardHideHandler = null;
        }
        if(board._boardHideTimer){
          clearTimeout(board._boardHideTimer);
          board._boardHideTimer = null;
        }
      }

      function showBoard(board, immediate=false){
        if(!board) return;
        clearBoardHide(board);
        const defaultDisplay = getDefaultBoardDisplay(board);
        board.style.display = defaultDisplay;
        board.setAttribute('aria-hidden','false');
        if(immediate){
          board.classList.add('panel-visible');
          board.style.transform = '';
        } else {
          const wasHidden = !board.classList.contains('panel-visible');
          schedulePanelEntrance(board, wasHidden);
        }
      }

      function hideBoard(board, immediate=false){
        if(!board) return;
        clearBoardHide(board);
        board.setAttribute('aria-hidden','true');
        const finalize = ()=>{
          board.style.display = 'none';
          board._boardHideHandler = null;
          board._boardHideTimer = null;
          try{
            board.style.removeProperty('transform');
          }catch(err){}
        };
        if(immediate){
          board.classList.remove('panel-visible');
          finalize();
          return;
        }
        if(!board.classList.contains('panel-visible')){
          finalize();
          return;
        }
        const handler = event=>{
          if(event && event.target !== board) return;
          board.removeEventListener('transitionend', handler);
          finalize();
        };
        board._boardHideHandler = handler;
        board.addEventListener('transitionend', handler);
        const removeVisible = ()=>{
          if(!board.isConnected){
            board.removeEventListener('transitionend', handler);
            finalize();
            return;
          }
          board.classList.remove('panel-visible');
        };
        if('requestAnimationFrame' in window){
          requestAnimationFrame(removeVisible);
        } else {
          removeVisible();
        }
        board._boardHideTimer = setTimeout(()=>{
          if(board._boardHideHandler){
            board._boardHideHandler();
          }
        }, 400);
      }

      function toggleBoard(board, shouldShow, immediate=false){
        if(shouldShow){
          showBoard(board, immediate);
        } else {
          hideBoard(board, immediate);
        }
      }

      function updateModeToggle(){
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        const isMapMode = document.body.classList.contains('mode-map');
        if(recentsButton){
          recentsButton.setAttribute('aria-pressed', historyActive ? 'true' : 'false');
        }
        if(postsButton){
          postsButton.setAttribute('aria-pressed', !historyActive && isPostsMode ? 'true' : 'false');
        }
        if(mapButton){
          mapButton.setAttribute('aria-pressed', isMapMode ? 'true' : 'false');
        }
      }

      function adjustBoards(){
        const small = window.innerWidth < 1200;
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        const filterPanel = document.getElementById('filterPanel');
        const filterContent = filterPanel ? filterPanel.querySelector('.panel-content') : null;
        const pinBtn = filterPanel ? filterPanel.querySelector('.pin-panel') : null;
        const filterPinned = !!(filterPanel && filterPanel.classList.contains('show') && pinBtn && pinBtn.getAttribute('aria-pressed') === 'true');
        const historyOpenPost = recentsBoard ? recentsBoard.querySelector('.open-post') : null;
        const postsOpenPost = postBoard ? postBoard.querySelector('.open-post') : null;
        const anyOpenPost = historyOpenPost || postsOpenPost;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 10;
        let filterWidth = filterPinned && filterContent ? filterContent.getBoundingClientRect().width : 0;
        const postWidth = postBoard ? (postBoard.offsetWidth || 530) : 0;
        const historyWidth = recentsBoard ? (recentsBoard.offsetWidth || 530) : 0;
        const boardsWidths = [];
        if(historyActive && recentsBoard){
          boardsWidths.push(historyWidth);
        } else if(postBoard){
          boardsWidths.push(postWidth);
        }
        let totalBoardsWidth = boardsWidths.reduce((sum, w)=> sum + w, 0);
        if(boardsWidths.length > 1){
          totalBoardsWidth += gap * (boardsWidths.length - 1);
        }
        const adWidth = adBoard ? (adBoard.offsetWidth || 440) : 0;
        const shouldShowAds = adBoard && window.innerWidth >= 1900;
        let hideAds = !shouldShowAds || !isPostsMode;
        let requiredWidth = totalBoardsWidth;
        if(filterPinned && filterWidth){
          requiredWidth += filterWidth;
        } else {
          filterWidth = 0;
        }
        if(shouldShowAds && adWidth){
          requiredWidth += adWidth + gap;
        }
        const canAnchor = filterPinned && filterWidth && requiredWidth <= window.innerWidth;
        document.body.classList.toggle('filter-anchored', canAnchor);
        document.documentElement.style.setProperty('--filter-panel-offset', canAnchor ? `${filterWidth}px` : '0px');
        boardsContainer.style.justifyContent = 'flex-start';
        const skipAnimation = !boardsInitialized;
        toggleBoard(recentsBoard, isPostsMode && historyActive, skipAnimation);
        toggleBoard(postBoard, isPostsMode && !historyActive, skipAnimation);
        document.body.classList.toggle('detail-open', !!anyOpenPost);
        if(adBoard){
          toggleBoard(adBoard, isPostsMode && !hideAds && shouldShowAds, skipAnimation);
        }
        document.body.classList.toggle('hide-ads', hideAds);
        updateModeToggle();
        boardsInitialized = true;
      }
      window.adjustBoards = adjustBoards;
      adjustBoards();
      window.addEventListener('resize', adjustBoards);
      window.adjustListHeight();
        setTimeout(()=>{
          if(map && typeof map.resize === 'function'){
            map.resize();
            updatePostPanel();
            applyFilters();
          }
        }, 0);

      recentsButton && recentsButton.addEventListener('click', ()=>{
        const isPostsMode = document.body.classList.contains('mode-posts');
        const historyActive = document.body.classList.contains('show-history');
        if(isPostsMode && historyActive){
          userClosedPostBoard = true;
          setModeFromUser('map');
          return;
        }
        setMode('posts');
        document.body.classList.add('show-history');
        renderHistoryBoard();
        adjustBoards();
        setTimeout(()=>{
          if(map && typeof map.resize === 'function'){
            map.resize();
            updatePostPanel();
          }
        }, 300);
        updateModeToggle();
      });

      postsButton && postsButton.addEventListener('click', ()=>{
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        if(isPostsMode && !historyActive){
          userClosedPostBoard = true;
          setModeFromUser('map');
          return;
        }
        document.body.classList.remove('show-history');
        if(!isPostsMode || historyActive){
          setMode('posts');
          setTimeout(()=>{
            if(map && typeof map.resize === 'function'){
              map.resize();
              updatePostPanel();
            }
          }, 0);
        } else {
          updateModeToggle();
        }
      });

      mapButton && mapButton.addEventListener('click', ()=>{
        const isMapMode = document.body.classList.contains('mode-map');
        if(!isMapMode){
          userClosedPostBoard = true;
          setModeFromUser('map');
        } else if(document.body.classList.contains('show-history')){
          document.body.classList.remove('show-history');
          adjustBoards();
          updateModeToggle();
        }
      });

    function buildDetail(p){
      const wrap = document.createElement('div');
      wrap.className = 'open-post';
      wrap.dataset.id = p.id;
      const loc0 = p.locations[0];
      const dsorted = loc0.dates.slice().sort((a,b)=> a.full.localeCompare(b.full));
      const defaultInfo = `💲 ${loc0.price} | 📅 ${dsorted[0].date} - ${dsorted[dsorted.length-1].date}<span style="display:inline-block;margin-left:10px;">(Select Session)</span>`;
      const thumbSrc = thumbUrl(p);
      const headerInner = `
          <div class="title-block">
            <div class="title">${p.title}</div>
            <div class="cat-line"><span class="sub-icon">${subcategoryIcons[p.subcategory]||''}</span> ${p.category} &gt; ${p.subcategory}</div>
          </div>
          <button class="share" aria-label="Share post">
            <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.06-.23.09-.46.09-.7s-.03-.47-.09-.7l7.13-4.17A2.99 2.99 0 0 0 18 9a3 3 0 1 0-3-3c0 .24.03.47.09.7L7.96 10.87A3.003 3.003 0 0 0 6 10a3 3 0 1 0 3 3c0-.24-.03-.47-.09-.7l7.13 4.17c.53-.5 1.23-.81 1.96-.81a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
          </button>
          <button class="fav" aria-pressed="${p.fav?'true':'false'}" aria-label="Toggle favourite">
            <svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>
          </button>
        `;
      const posterName = p.member ? p.member.username : 'Anonymous';
      const postedTime = formatPostTimestamp(p.created);
      const postedMeta = postedTime ? `Posted by ${posterName} · ${postedTime}` : `Posted by ${posterName}`;
      wrap.innerHTML = `
        <div class="post-header">
          ${headerInner}
        </div>
        <div class="post-body">
          <div class="post-details">
            <div class="post-venue-selection-container"></div>
            <div class="post-session-selection-container"></div>
            <div class="location-section">
              <div id="venue-${p.id}" class="venue-dropdown options-dropdown"><button class="venue-btn" aria-haspopup="true" aria-expanded="false"><span class="venue-name">${p.locations[0].venue}</span><span class="venue-address">${p.locations[0].address}</span></button><div class="venue-menu post-venue-menu" hidden><div class="map-container"><div id="map-${p.id}" class="post-map"></div></div><div class="venue-options">${p.locations.map((loc,i)=>`<button data-index="${i}"><span class="venue-name">${loc.venue}</span><span class="venue-address">${loc.address}</span></button>`).join('')}</div></div></div>
              <div id="sess-${p.id}" class="session-dropdown options-dropdown"><button class="sess-btn" aria-haspopup="true" aria-expanded="false">Select Session</button><div class="session-menu options-menu" hidden><div class="calendar-container"><div class="calendar-scroll"><div id="cal-${p.id}" class="post-calendar"></div></div></div><div class="session-options"></div></div></div>
            </div>
            <div class="post-details-info-container">
              <div id="venue-info-${p.id}" class="venue-info"></div>
              <div id="session-info-${p.id}" class="session-info">
                <div>${defaultInfo}</div>
              </div>
            </div>
            <div class="post-details-description-container">
              <div class="desc-wrap"><div class="desc" tabindex="0" aria-expanded="false">${p.desc}</div></div>
              <div class="member-avatar-row"><img src="${memberAvatarUrl(p)}" alt="${posterName} avatar" width="50" height="50"/><span>${postedMeta}</span></div>
            </div>
          </div>
          <div class="post-images">
            <div class="image-box"><div class="image-track"><img id="hero-img" class="lqip" src="${thumbSrc}" data-full="${heroUrl(p)}" alt="" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${thumbSrc}';"/></div></div>
            <div class="thumbnail-row"></div>
          </div>
        </div>`;
      wrap.querySelectorAll('.post-header').forEach(head => {
        head.dataset.surfaceBg = CARD_SURFACE;
        head.style.background = CARD_SURFACE;
      });
      wrap.dataset.surfaceBg = CARD_SURFACE;
      wrap.style.background = CARD_SURFACE;
        // progressive hero swap
        (function(){
          const img = wrap.querySelector('#hero-img');
          if(img){
            const full = img.getAttribute('data-full');
            const hi = new Image();
            hi.referrerPolicy = 'no-referrer';
            hi.fetchPriority = 'high';
            hi.onload = ()=>{
              const swap = ()=>{ img.src = full; img.classList.remove('lqip'); img.classList.add('ready'); };
              if(hi.decode){ hi.decode().then(swap).catch(swap); } else { swap(); }
            };
            hi.onerror = ()=>{};
            hi.src = full;
          }
        })();
        return wrap;
    }

      function ensurePostCardForId(id){
        if(!postsWideEl) return null;
        if(!postSentinel || !postsWideEl.contains(postSentinel)){
          renderLists(filtered);
        }
        let cardEl = postsWideEl.querySelector(`.post-card[data-id="${id}"]`);
        if(cardEl) return cardEl;

        const index = sortedPostList.findIndex(item => item && item.id === id);
        if(index === -1) return null;

        while(renderedPostCount <= index){
          const before = renderedPostCount;
          appendPostBatch();
          cardEl = postsWideEl.querySelector(`.post-card[data-id="${id}"]`);
          if(cardEl) return cardEl;
          if(renderedPostCount === before) break;
        }

        return postsWideEl.querySelector(`.post-card[data-id="${id}"]`);
      }

      async function openPost(id, fromHistory=false, fromMap=false, originEl=null){
        lockMap(false);
        touchMarker = null;
        if(hoverPopup){
          let shouldRemovePopup = true;
          if(fromMap && typeof popupIsHovered === 'function'){
            try{
              if(popupIsHovered(hoverPopup)){
                shouldRemovePopup = false;
              }
            }catch(err){
              shouldRemovePopup = true;
            }
          }
          if(shouldRemovePopup){
            runOverlayCleanup(hoverPopup);
            try{ hoverPopup.remove(); }catch(err){}
            hoverPopup = null;
          }
        }
        spinEnabled = false;
        localStorage.setItem('spinGlobe', 'false');
        stopSpin();
        const p = getPostByIdAnywhere(id); if(!p) return;
        activePostId = id;
        selectedVenueKey = null;
        updateSelectedMarkerRing();

        if(!fromHistory){
          if(document.body.classList.contains('show-history')){
            document.body.classList.remove('show-history');
            adjustBoards();
            updateModeToggle();
          }
          if(mode !== 'posts'){
            setMode('posts', true);
            await nextFrame();
          }
        }
        $$('.recents-card[aria-selected="true"], .post-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));
        $$('.mapboxgl-popup.big-map-card .big-map-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));

        const container = fromHistory ? document.getElementById('recentsBoard') : postsWideEl;
        if(!container) return;

        const alreadyOpen = container.querySelector(`.open-post[data-id="${id}"]`);
        if(alreadyOpen){
          return;
        }

        if(originEl && !container.contains(originEl)){
          originEl = null;
        }
        let target = originEl || container.querySelector(`[data-id="${id}"]`);

        (function(){
          const ex = container.querySelector('.open-post');
          if(ex){
            const seenDetailMaps = new Set();
            const cleanupDetailMap = node=>{
              if(!node || !node._detailMap) return;
              const ref = node._detailMap;
              if(!seenDetailMaps.has(ref)){
                if(ref.resizeHandler){
                  window.removeEventListener('resize', ref.resizeHandler);
                }
                if(ref.map && typeof ref.map.remove === 'function'){
                  ref.map.remove();
                }
                seenDetailMaps.add(ref);
              }
              if(ref){
                ref.map = null;
                ref.resizeHandler = null;
              }
              if(node && node.__map){
                node.__map = null;
              }
              delete node._detailMap;
            };
            cleanupDetailMap(ex);
            const mapNode = ex.querySelector('.post-map');
            if(mapNode){
              cleanupDetailMap(mapNode);
            }
            const exId = ex.dataset && ex.dataset.id;
            const prev = getPostByIdAnywhere(exId);
            if(prev){ ex.replaceWith(card(prev, fromHistory ? false : true)); } else { ex.remove(); }
          }
        })();

        if(originEl && !container.contains(originEl)){
          originEl = null;
        }
        target = originEl || container.querySelector(`[data-id="${id}"]`);

        const pointerEvt = window.__lastPointerDown;
        let pointerTarget = null;
        if(pointerEvt && pointerEvt.target instanceof Element){
          let consider = true;
          if(typeof pointerEvt.timeStamp === 'number'){
            const nowTs = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
            const evtTs = pointerEvt.timeStamp;
            if(typeof evtTs === 'number'){
              const diff = nowTs - evtTs;
              if(Number.isFinite(diff) && (diff > 2000 || diff < -2000)){
                consider = false;
              }
            }
          }
          if(consider){
            pointerTarget = pointerEvt.target;
          }
        }
        const pointerCard = pointerTarget ? pointerTarget.closest('.post-card, .recents-card') : null;
        const pointerInsideCardContainer = pointerCard && container.contains(pointerCard);
        const pointerInAdBoard = pointerTarget ? pointerTarget.closest('.ad-board, .ad-panel') : null;
        const shouldScrollToCard = fromMap || (!!pointerInAdBoard && !pointerInsideCardContainer) || pointerInsideCardContainer;
        const shouldReorderToTop = !fromMap && ((!!pointerInAdBoard && !pointerInsideCardContainer) || pointerInsideCardContainer);

        if(!target && !fromHistory){
          target = ensurePostCardForId(id);
        }

        if(!target){
          target = card(p, fromHistory ? false : true);
          if(!fromHistory && container === postsWideEl){
            if(postSentinel && postSentinel.parentElement === container){
              container.insertBefore(target, postSentinel);
            } else {
              container.appendChild(target);
            }
          } else {
            container.prepend(target);
          }
        } else if(shouldReorderToTop && container.contains(target) && !pointerInsideCardContainer){
          const firstCard = container.querySelector('.open-post, .post-card, .recents-card');
          if(firstCard && firstCard !== target){
            container.insertBefore(target, firstCard);
          } else if(!firstCard){
            container.prepend(target);
          }
        }
        const resCard = resultsEl ? resultsEl.querySelector(`[data-id="${id}"]`) : null;
        if(resCard){
          resCard.setAttribute('aria-selected','true');
          if(fromMap){
            const qb = resCard.closest('.quick-list-board');
            if(qb){
              // intentionally skipping automatic scrolling
            }
          }
        }
        const mapCard = document.querySelector('.mapboxgl-popup.big-map-card .big-map-card');
        if(mapCard) mapCard.setAttribute('aria-selected','true');

        const detail = buildDetail(p);
        target.replaceWith(detail);
        hookDetailActions(detail, p);
        if (typeof updateStickyImages === 'function') {
          updateStickyImages();
        }
        if (typeof initPostLayout === 'function') {
          initPostLayout(container);
          if (typeof updateStickyImages === 'function') {
            updateStickyImages();
          }
        }

        await nextFrame();

        if(fromMap){
          if(typeof window.adjustBoards === 'function'){
            window.adjustBoards();
          }
          if(typeof window.adjustListHeight === 'function'){
            window.adjustListHeight();
          }
        }

        const header = detail.querySelector('.post-header');
        if(header){
          const h = header.offsetHeight;
          header.style.scrollMarginTop = h + 'px';
        }

        if(shouldScrollToCard && container && container.contains(detail)){
          requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const detailRect = detail.getBoundingClientRect();
            if(!containerRect || !detailRect) return;
            const topTarget = container.scrollTop + (detailRect.top - containerRect.top);
            if(typeof container.scrollTo === 'function'){
              container.scrollTo({ top: Math.max(0, topTarget), behavior: 'smooth' });
            } else {
              container.scrollTop = Math.max(0, topTarget);
            }
          });
        }

        // Update history on open (keep newest-first)
        viewHistory = viewHistory.filter(x=>x.id!==id);
        viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
        if(viewHistory.length>100) viewHistory.length=100;
        saveHistory();
        if(!fromHistory){
          renderHistoryBoard();
        }
      }

      function closeActivePost(){
        const openEl = document.querySelector('.post-board .open-post, #recentsBoard .open-post');
        if(!openEl){
          document.body.classList.remove('detail-open');
          if(typeof initPostLayout === 'function') initPostLayout(postsWideEl);
          if(typeof window.adjustBoards === 'function') window.adjustBoards();
          return;
        }
        const openBody = openEl.querySelector('.post-body');
        if(openBody){
          openBody.style.removeProperty('--second-post-height');
          openBody.style.removeProperty('min-height');
          if(openBody.dataset) delete openBody.dataset.secondPostHeight;
        }
        const container = openEl.closest('.post-board, #recentsBoard') || postsWideEl;
        const isHistory = container && container.id === 'recentsBoard';
        const id = openEl.dataset ? openEl.dataset.id : null;
        const post = id ? getPostByIdAnywhere(id) : null;
        const detachedColumn = document.querySelector('.post-mode-boards > .post-body');
        if(detachedColumn){
          detachedColumn.classList.remove('is-visible');
          if(detachedColumn.dataset) delete detachedColumn.dataset.openPostId;
          detachedColumn.remove();
        }
        document.body.classList.remove('detail-open');
        $$('.recents-card[aria-selected="true"], .post-card[aria-selected="true"]').forEach(el=> el.removeAttribute('aria-selected'));
        if(post){
          const replacement = card(post, !isHistory);
          openEl.replaceWith(replacement);
        } else {
          openEl.remove();
        }
        activePostId = null;
        selectedVenueKey = null;
        updateSelectedMarkerRing();
        if(typeof initPostLayout === 'function') initPostLayout(postsWideEl);
        if(typeof updateStickyImages === 'function') updateStickyImages();
        if(typeof window.adjustBoards === 'function') window.adjustBoards();
      }

      window.openPost = openPost;
      if(typeof window.__wrapForInputYield === 'function'){
        window.__wrapForInputYield('openPost');
      }

      const resLists = $$('.recents-board');
      resLists.forEach(list=>{
          list.addEventListener('click', (e)=>{
            if(e.target.closest('.fav')) return;
            const cardEl = e.target.closest('.recents-card');
            if(!cardEl) return;
            e.preventDefault();
            const id = cardEl.getAttribute('data-id');
            if(!id) return;
            callWhenDefined('openPost', (fn)=>{
              requestAnimationFrame(() => {
                try{
                  stopSpin();
                  fn(id, true, false, cardEl);
                }catch(err){ console.error(err); }
              });
            });
          }, { capture: true });
        });

      const postsWide = $('.post-board');
      if(postsWide){
        postsWide.addEventListener('click', e=>{
          if(e.target.closest('.fav')) return;
          const cardEl = e.target.closest('.post-card');
          if(cardEl){
            const id = cardEl.getAttribute('data-id');
            if(id){
              e.preventDefault();
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    stopSpin();
                    fn(id, false, false, cardEl);
                  }catch(err){ console.error(err); }
                });
              });
            }
            return;
          }
          if(e.target === postsWide && postsWide.querySelector('.open-post')){
            userClosedPostBoard = true;
            setTimeout(()=> setModeFromUser('map'), 0);
          }
        }, { capture:true });
      }

      recentsBoard && recentsBoard.addEventListener('click', e=>{
        if(e.target === recentsBoard){
          userClosedPostBoard = true;
          setModeFromUser('map');
        }
      });

      function setMode(m, skipFilters = false){
        mode = m;
        document.body.classList.remove('mode-map','mode-posts','hide-posts-ui');
        document.body.classList.add('mode-'+m);
        if(m==='map'){
          document.body.classList.remove('show-history');
        }
        if(m === 'map'){
          startMainMapInit();
        }
        const shouldAdjustListHeight = m === 'posts' && typeof window.adjustListHeight === 'function';
        adjustBoards();
        if(shouldAdjustListHeight){
          window.adjustListHeight();
        }
        updateModeToggle();
        if(m === 'posts'){
          userClosedPostBoard = false;
          const boardEl = document.querySelector('.post-board');
          if(boardEl){
            boardEl.style.width = '';
          }
          if(window.adjust){
            window.adjust();
          }
        }
        if(map){
          if(typeof map.resize === 'function'){
            map.resize();
          }
          updatePostPanel();
        }
        if(m==='posts'){
          spinEnabled = false;
          localStorage.setItem('spinGlobe','false');
          stopSpin();
        }
        if(!skipFilters) applyFilters();
      }
    window.setMode = setMode;

      function setModeFromUser(m, skipFilters = false){
        const previous = modeChangeWasUserInitiated;
        modeChangeWasUserInitiated = true;
        try{
          setMode(m, skipFilters);
        } finally {
          modeChangeWasUserInitiated = previous;
        }
      }

    // Mapbox
    let mapboxBundlePromise = null;
    let mapboxBundleReady = false;
    let mainMapInitPromise = null;
    let mapInitTriggered = false;
    let mapInitQueued = false;
    let modeChangeWasUserInitiated = false;

    function loadMapbox(cb){
      const invokeCallback = () => {
        if(typeof cb === 'function'){
          try{ cb(); }catch(err){ console.error(err); }
        }
      };

      if(mapboxBundleReady){
        return Promise.resolve().then(invokeCallback);
      }

      if(!mapboxBundlePromise){
        mapboxBundlePromise = new Promise((resolve, reject) => {
          const mapboxVerRaw = window.MAPBOX_VERSION || 'v3.15.0';
          const mapboxVer = mapboxVerRaw.startsWith('v') ? mapboxVerRaw : `v${mapboxVerRaw}`;
          const mapboxVerNoV = mapboxVer.replace(/^v/, '');
          const cssSources = [
            {
              selector: 'link[href*="mapbox-gl.css"], link[href*="mapbox-gl@"], style[data-mapbox]',
              primary: `https://api.mapbox.com/mapbox-gl-js/${mapboxVer}/mapbox-gl.css`,
              fallback: `https://unpkg.com/mapbox-gl@${mapboxVerNoV}/dist/mapbox-gl.css`
            },
            {
              selector: 'link[href*="mapbox-gl-geocoder.css"], link[href*="mapbox-gl-geocoder@"]',
              primary: 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css',
              fallback: 'https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.0/dist/mapbox-gl-geocoder.css'
            }
          ];

          let settled = false;

          function fail(error){
            if(settled){
              return;
            }
            settled = true;
            mapboxBundleReady = false;
            mapboxBundlePromise = null;
            reject(error instanceof Error ? error : new Error(error || 'Mapbox bundle failed to load'));
          }

          function finalize(){
            if(settled){
              return;
            }
            Promise.resolve(ensureMapboxCssFor(document.body))
              .catch(()=>{})
              .then(() => {
                if(settled){
                  return;
                }
                if(window && window.mapboxgl){
                  settled = true;
                  mapboxBundleReady = true;
                  resolve();
                } else {
                  fail(new Error('Mapbox GL failed to load'));
                }
              });
          }

          function monitorLink(link, onReady, fallbackUrl){
            if(!link || (link.tagName && link.tagName.toLowerCase() === 'style')){
              onReady();
              return;
            }
            if(fallbackUrl && link.dataset && !link.dataset.fallback){
              link.dataset.fallback = fallbackUrl;
            }

            let settled = false;

            function cleanup(){
              link.removeEventListener('load', handleLoad);
              link.removeEventListener('error', handleError);
            }

            function complete(){
              if(settled){
                return;
              }
              settled = true;
              cleanup();
              onReady();
            }

            function handleLoad(){
              complete();
            }

            function handleError(){
              const attempts = link.dataset && link.dataset.fallbackErrors ? Number(link.dataset.fallbackErrors) : 0;
              const nextAttempts = (Number.isNaN(attempts) ? 0 : attempts) + 1;
              if(link.dataset){
                link.dataset.fallbackErrors = String(nextAttempts);
              }
              const fallback = link.dataset ? link.dataset.fallback : fallbackUrl;
              if(fallback && link.href !== fallback){
                link.href = fallback;
                return;
              }
              if(fallback && nextAttempts === 1){
                return;
              }
              complete();
            }

            function needsListeners(){
              if(!link.sheet){
                return true;
              }
              try {
                void link.sheet.cssRules;
                return false;
              } catch(err){
                if(err && (err.name === 'SecurityError' || err.code === 18)){
                  return false;
                }
                return true;
              }
            }

            if(needsListeners()){
              link.addEventListener('load', handleLoad, {once:true});
              link.addEventListener('error', handleError);
            } else {
              complete();
            }
          }

          function ensureCss(index, onReady){
            const {selector, primary, fallback} = cssSources[index];
            const selectors = selector.split(',').map(s => s.trim());
            for(const sel of selectors){
              const candidate = document.querySelector(sel);
              if(candidate){
                if(candidate.tagName && candidate.tagName.toLowerCase() === 'style'){
                  onReady();
                  return;
                }
                monitorLink(candidate, onReady, fallback);
                return;
              }
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = primary;
            monitorLink(link, onReady, fallback);
            document.head.appendChild(link);
          }

          if(window.mapboxgl && window.MapboxGeocoder){
            let pending = cssSources.length;
            if(pending === 0){
              finalize();
              return;
            }
            const done = () => {
              if(--pending === 0){
                finalize();
              }
            };
            cssSources.forEach((_, i) => ensureCss(i, done));
            return;
          }

          cssSources.forEach((_, i) => ensureCss(i, ()=>{}));
          loadScripts();

          function loadScripts(){
            let successTriggered = false;

            function done(){
              if(successTriggered){
                return;
              }
              successTriggered = true;
              finalize();
            }

            const loadGeocoder = ()=>{
              const g = document.createElement('script');
              g.src='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
              g.async = true;
              g.defer = true;
              g.onload = done;
              g.onerror = ()=>{
                const gf = document.createElement('script');
                gf.src='https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.0/dist/mapbox-gl-geocoder.min.js';
                gf.async = true;
                gf.defer = true;
                gf.onload = done;
                gf.onerror = ()=>{
                  fail(new Error('Mapbox Geocoder failed to load'));
                };
                document.head.appendChild(gf);
              };
              document.head.appendChild(g);
            };

            const s = document.createElement('script');
            s.src=`https://api.mapbox.com/mapbox-gl-js/${mapboxVer}/mapbox-gl.js`;
            s.async = true;
            s.defer = true;
            s.onload = loadGeocoder;
            s.onerror = ()=>{
              const sf = document.createElement('script');
              sf.src=`https://unpkg.com/mapbox-gl@${mapboxVerNoV}/dist/mapbox-gl.js`;
              sf.async = true;
              sf.defer = true;
              sf.onload = loadGeocoder;
              sf.onerror = ()=>{
                fail(new Error('Mapbox GL failed to load from fallback source'));
              };
              document.head.appendChild(sf);
            };
            document.head.appendChild(s);
          }
        });
      }

      return mapboxBundlePromise.then(() => {
        invokeCallback();
      });
    }

    function startMainMapInit(){
      if(mainMapInitPromise){
        return mainMapInitPromise;
      }
      mapInitQueued = false;
      if(typeof __notifyMapOnInteraction === 'function'){
        __notifyMapOnInteraction = null;
      }
      mainMapInitPromise = loadMapbox().then(() => {
        if(mapInitTriggered){
          return;
        }
        mapInitTriggered = true;
        return Promise.resolve(initMap()).catch(err => {
          console.error(err);
        });
      }).catch(err => {
        console.error(err);
      });
      return mainMapInitPromise;
    }

    function queueMainMapInitAfterInteraction(){
      if(mainMapInitPromise || mapInitTriggered){
        return;
      }
      if(__userInteractionObserved){
        startMainMapInit();
        return;
      }
      if(mapInitQueued){
        return;
      }
      mapInitQueued = true;
      loadMapbox().catch(err => console.error(err));
      const notify = () => {
        mapInitQueued = false;
        startMainMapInit();
      };
      __notifyMapOnInteraction = notify;
    }

    function addControls(){
      if(typeof MapboxGeocoder === 'undefined'){
        const script = document.createElement('script');
        script.src='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
        script.onload = addControls;
        script.onerror = ()=> console.error('Mapbox Geocoder failed to load');
        document.head.appendChild(script);
        return;
      }
      const cssLink = document.querySelector('style[data-mapbox], link[href*="mapbox-gl.css"], link[href*="mapbox-gl@"]');
      if(!cssLink || !cssLink.sheet){
        setTimeout(addControls, 50);
        return;
      }
      geocoders.length = 0;
      geocoder = null;

      const sets = [
        {geo:'#geocoder-welcome', locate:'#geolocate-welcome', compass:'#compass-welcome'},
        {geo:'#geocoder-map', locate:'#geolocate-map', compass:'#compass-map'},
        {geo:'#geocoder-filter', locate:'#geolocate-filter', compass:'#compass-filter'},
        {geo:'#geocoder-member', locate:'#geolocate-member', compass:'#compass-member'}
      ];
      const cityZoomLevel = 12;

      sets.forEach((sel, idx)=>{
        const geocoderOptions = {
          accessToken: mapboxgl.accessToken,
          mapboxgl,
          placeholder: 'Search venues or places',
          types: 'poi,place,address',
          marker: false,
          limit: 10,
          reverseGeocode: true,
          language: navigator.language,
          proximity: null, // Remove regional bias
          bbox: null,      // Remove viewport limitation
          flyTo: false
        };

        const gc = new MapboxGeocoder(geocoderOptions);
        const gEl = sel && sel.geo ? document.querySelector(sel.geo) : null;
        if(gEl){
          gEl.appendChild(gc.onAdd(map));
        }
        geocoders.push(gc);
        if(idx === 1){
          geocoder = gc;
        }

        const handleGeocoderResult = (result) => {
          if(!map || !result) return;
          closeWelcomeModalIfOpen();

          const toLngLatArray = (value) => {
            if(Array.isArray(value) && value.length >= 2){
              const lng = Number(value[0]);
              const lat = Number(value[1]);
              if(Number.isFinite(lng) && Number.isFinite(lat)){
                return [lng, lat];
              }
            } else if(value && typeof value === 'object'){
              const lng = Number(value.lng);
              const lat = Number(value.lat);
              if(Number.isFinite(lng) && Number.isFinite(lat)){
                return [lng, lat];
              }
            }
            return null;
          };

          const waitForIdle = () => {
            if(!map) return;
            if(typeof map.isMoving === 'function'){
              let moving = false;
              try{
                moving = map.isMoving();
              }catch(err){ moving = false; }
              if(moving){
                requestAnimationFrame(waitForIdle);
                return;
              }
            }
            applyFlight();
          };

          const applyFlight = () => {
            if(!map) return;

            const minZoom = Math.max(cityZoomLevel, MARKER_ZOOM_THRESHOLD + 0.01);
            let maxZoom = 22;
            if(typeof map.getMaxZoom === 'function'){
              try{
                const candidate = map.getMaxZoom();
                if(Number.isFinite(candidate)){
                  maxZoom = candidate;
                }
              }catch(err){}
            }

            let cameraFromBounds = null;
            if(Array.isArray(result?.bbox) && result.bbox.length === 4 && typeof map.cameraForBounds === 'function'){
              const [minLng, minLat, maxLng, maxLat] = result.bbox.map(Number);
              const hasBounds = [minLng, minLat, maxLng, maxLat].every(Number.isFinite);
              if(hasBounds){
                try{
                  cameraFromBounds = map.cameraForBounds([[minLng, minLat], [maxLng, maxLat]], {
                    padding: { top: 60, bottom: 60, left: 60, right: 60 }
                  });
                }catch(err){ cameraFromBounds = null; }
              }
            }

            const currentCenter = (() => {
              if(typeof map.getCenter === 'function'){
                try{
                  const center = map.getCenter();
                  return toLngLatArray(center);
                }catch(err){ return null; }
              }
              return null;
            })();

            let targetCenter = null;
            if(cameraFromBounds?.center){
              targetCenter = toLngLatArray(cameraFromBounds.center);
            }
            if(!targetCenter){
              const geometry = result?.geometry;
              if(geometry && String(geometry.type).toLowerCase() === 'point'){
                targetCenter = toLngLatArray(geometry.coordinates);
              }
            }
            if(!targetCenter){
              targetCenter = toLngLatArray(result?.center);
            }
            if(!targetCenter){
              targetCenter = currentCenter;
            }

            let zoomCandidate = Number(cameraFromBounds?.zoom);
            if(!Number.isFinite(zoomCandidate) && Number.isFinite(result?.zoom)){
              zoomCandidate = result.zoom;
            }
            if(!Number.isFinite(zoomCandidate) && Number.isFinite(result?.properties?.zoom)){
              zoomCandidate = result.properties.zoom;
            }
            if(!Number.isFinite(zoomCandidate)){
              if(typeof map.getZoom === 'function'){
                try{
                  const currentZoom = map.getZoom();
                  if(Number.isFinite(currentZoom)){
                    zoomCandidate = currentZoom;
                  }
                }catch(err){}
              }
            }

            let targetZoom = Number.isFinite(zoomCandidate) ? zoomCandidate : minZoom;
            if(targetZoom < minZoom){
              targetZoom = minZoom;
            }
            if(Number.isFinite(maxZoom) && targetZoom > maxZoom){
              targetZoom = maxZoom;
            }

            const currentBearing = (() => {
              if(typeof map.getBearing === 'function'){
                try{
                  const bearing = map.getBearing();
                  return Number.isFinite(bearing) ? bearing : null;
                }catch(err){ return null; }
              }
              return null;
            })();

            let targetBearing = Number(cameraFromBounds?.bearing);
            if(!Number.isFinite(targetBearing) && Number.isFinite(result?.bearing)){
              targetBearing = result.bearing;
            }
            if(!Number.isFinite(targetBearing) && Number.isFinite(result?.properties?.bearing)){
              targetBearing = result.properties.bearing;
            }
            if(!Number.isFinite(targetBearing)){
              targetBearing = currentBearing;
            }

            const currentPitch = (() => {
              if(typeof map.getPitch === 'function'){
                try{
                  const pitch = map.getPitch();
                  return Number.isFinite(pitch) ? pitch : null;
                }catch(err){ return null; }
              }
              return null;
            })();

            let targetPitch = Number(cameraFromBounds?.pitch);
            if(!Number.isFinite(targetPitch) && Number.isFinite(result?.pitch)){
              targetPitch = result.pitch;
            }
            if(!Number.isFinite(targetPitch) && Number.isFinite(result?.properties?.pitch)){
              targetPitch = result.properties.pitch;
            }
            if(!Number.isFinite(targetPitch)){
              targetPitch = currentPitch;
            }

            const flight = {
              essential: true,
              center: targetCenter || currentCenter || undefined,
              zoom: Number.isFinite(targetZoom) ? targetZoom : minZoom,
              speed: 1.35,
              curve: 1.5,
              easing: t => 1 - Math.pow(1 - t, 3)
            };

            if(Number.isFinite(targetBearing)){
              flight.bearing = targetBearing;
            }
            if(Number.isFinite(targetPitch)){
              flight.pitch = targetPitch;
            }

            try{
              if(typeof map.flyTo === 'function'){
                map.flyTo(flight);
              }
            }catch(err){}
          };

          waitForIdle();
        };
        gc.on('result', event => handleGeocoderResult(event && event.result));

        const geolocateToken = `geolocate:${idx}`;
        let geolocateButton = null;
        let geolocateFallbackTimeout = null;

        const clearGeolocateLoading = () => {
          if(geolocateFallbackTimeout){
            clearTimeout(geolocateFallbackTimeout);
            geolocateFallbackTimeout = null;
          }
          if(mapLoading){
            mapLoading.removeMotion(geolocateToken);
          }
        };

        const ensureGeolocateLoading = () => {
          if(!mapLoading) return;
          mapLoading.addMotion(geolocateToken);
          if(geolocateFallbackTimeout){
            clearTimeout(geolocateFallbackTimeout);
          }
          geolocateFallbackTimeout = setTimeout(() => {
            geolocateFallbackTimeout = null;
            if(mapLoading){
              mapLoading.removeMotion(geolocateToken);
            }
          }, 15000);
        };

        const awaitGeolocateIdle = () => {
          if(!mapLoading){
            clearGeolocateLoading();
            return;
          }
          const finalize = () => {
            clearGeolocateLoading();
          };
          let bound = false;
          if(map && typeof map.once === 'function'){
            try{
              map.once('idle', finalize);
              bound = true;
            }catch(err){
              finalize();
              return;
            }
          }
          if(!bound){
            finalize();
          } else {
            if(geolocateFallbackTimeout){
              clearTimeout(geolocateFallbackTimeout);
            }
            geolocateFallbackTimeout = setTimeout(() => {
              finalize();
            }, 8000);
          }
        };

        const geolocate = new mapboxgl.GeolocateControl({
          positionOptions:{ enableHighAccuracy:true },
          trackUserLocation:false,
          fitBoundsOptions:{ maxZoom: cityZoomLevel }
        });
        geolocate.on('geolocate', (event)=>{
          ensureGeolocateLoading();
          spinEnabled = false; localStorage.setItem('spinGlobe','false'); stopSpin();
          closeWelcomeModalIfOpen();
          if(mode!=='map') setModeFromUser('map');
          if(event && event.coords){
            setAllGeocoderProximity(event.coords.longitude, event.coords.latitude);
          }
          if(map && typeof map.easeTo === 'function' && event && event.coords){
            let targetZoom = cityZoomLevel;
            if(typeof map.getMaxZoom === 'function'){
              try{
                const maxZoom = map.getMaxZoom();
                if(typeof maxZoom === 'number' && maxZoom < targetZoom){
                  targetZoom = maxZoom;
                }
              }catch(err){}
            }
            const currentZoom = (typeof map.getZoom === 'function') ? map.getZoom() : null;
            const needsZoomAdjust = !Number.isFinite(currentZoom) || Math.abs(currentZoom - targetZoom) > 0.05;
            const center = [event.coords.longitude, event.coords.latitude];
            if(needsZoomAdjust){
              let currentPitch = null;
              try{
                currentPitch = typeof map.getPitch === 'function' ? map.getPitch() : null;
              }catch(err){
                currentPitch = null;
              }
              const options = { center, zoom: targetZoom, duration: 800, essential: true };
              if(Number.isFinite(currentPitch)){
                options.pitch = currentPitch;
              }
              try{
                map.easeTo(options);
              }catch(err){}
            }
          }
          awaitGeolocateIdle();
        });
        geolocate.on('error', () => {
          clearGeolocateLoading();
        });
        const geoHolder = sel && sel.locate ? document.querySelector(sel.locate) : null;
        if(geoHolder){
          const controlEl = geolocate.onAdd(map);
          geoHolder.appendChild(controlEl);
          if(controlEl){
            geolocateButton = controlEl.querySelector('button');
            if(geolocateButton){
              const handlePress = (evt) => {
                if(evt && evt.type === 'keydown'){
                  const key = evt.key || evt.code;
                  if(!key) return;
                  if(key !== 'Enter' && key !== ' ' && key !== 'Spacebar'){ return; }
                }
                ensureGeolocateLoading();
              };
              geolocateButton.addEventListener('click', handlePress, { passive: true });
              geolocateButton.addEventListener('keydown', handlePress);
            }
          }
        }
        const nav = new mapboxgl.NavigationControl({showZoom:false, visualizePitch:true});
        const compassHolder = sel && sel.compass ? document.querySelector(sel.compass) : null;
        if(compassHolder) compassHolder.appendChild(nav.onAdd(map));
      });

      syncGeocoderProximityToMap();
    }

    async function initMap(){
      if(typeof mapboxgl === 'undefined'){
        console.error('Mapbox GL failed to load');
        return;
      }
      try{
        await ensureMapboxCssFor(document.body);
      }catch(err){}
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
                zoomIndicatorEl.textContent = `${zoomText} • Pitch ${Math.round(pitchLevel)}°`;
              } else {
                zoomIndicatorEl.textContent = zoomText;
              }
            } else {
              zoomIndicatorEl.textContent = 'Zoom -- • Pitch --';
            }
          }catch(err){}
        };
        if(zoomIndicatorEl){
          ['zoom','zoomend','pitch','pitchend'].forEach(evt => {
            try{ map.on(evt, updateZoomIndicator); }catch(err){}
          });
          map.once('load', updateZoomIndicator);
          updateZoomIndicator();
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

        const handleWelcomeOnMapMotion = (evt) => {
          if(evt && evt.originalEvent){
            closeWelcomeModalIfOpen();
            return;
          }
          if(recentMapInteraction){
            closeWelcomeModalIfOpen();
          }
        };

        ['movestart','dragstart','zoomstart','rotatestart','pitchstart','boxzoomstart'].forEach(evtName => {
          try{ map.on(evtName, handleWelcomeOnMapMotion); }catch(err){}
        });
// === Pill hooks (safe) ===
try { if (typeof __addOrReplacePill150x40 === 'function') __addOrReplacePill150x40(map); } catch(e){}
if (!map.__pillHooksInstalled) {
  try { map.on('style.load', () => __addOrReplacePill150x40(map)); } catch(e){}
  try { map.on('styleimagemissing', (evt) => { if (evt && evt.id === 'marker-label-bg') __addOrReplacePill150x40(map); }); } catch(e){}
  map.__pillHooksInstalled = true;
}
        try{ map.on('style.load', () => { try{ reapplyMarkerLabelComposites(map); }catch(err){} }); }catch(err){}

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
          try{
            if(map.hasImage?.(imageId)){
              return;
            }
          }catch(err){
            console.error(err);
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
                if(map.hasImage?.(imageId)){
                  return;
                }
                map.addImage(imageId, image, options || {});
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
        const zoomValue = getZoomFromEvent(e);
        if(waitForInitialZoom){
          if(!initialZoomStarted){
            updateZoomState(zoomValue);
            return;
          }
          waitForInitialZoom = false;
          window.waitForInitialZoom = waitForInitialZoom;
          initialZoomStarted = false;
        }
        updateZoomState(zoomValue);
        scheduleCheckLoadPosts({ zoom: zoomValue, target: map });
      });
      map.on('zoomend', ()=>{
        if(markersLoaded) return;
        if(!map || typeof map.getZoom !== 'function') return;
        let currentZoom = NaN;
        try{ currentZoom = map.getZoom(); }catch(err){ currentZoom = NaN; }
        if(!Number.isFinite(currentZoom) || currentZoom < MARKER_PRELOAD_ZOOM){
          return;
        }
        try{ loadPostMarkers(); }catch(err){ console.error(err); }
        markersLoaded = true;
        window.__markersLoaded = true;
      });
      map.on('moveend', ()=>{
        syncGeocoderProximityToMap();
        scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
      });
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
        updatePostPanel();
        applyFilters();
        updateZoomState(getZoomFromEvent());
        if(!markersLoaded){
          const zoomLevel = Number.isFinite(lastKnownZoom) ? lastKnownZoom : getZoomFromEvent();
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

        ['mousedown','wheel','touchstart','dragstart','pitchstart','rotatestart','zoomstart'].forEach(ev=> map.on(ev, haltSpin));
        let suppressNextRefresh = false;
        const refreshMapView = () => {
          if(suppressNextRefresh) return;
          scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
          updatePostPanel();
          updateFilterCounts();
          refreshMarkers();
          refreshInViewMarkerLabelComposites(map);
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

    function startSpin(fromCurrent=false){
      if(mode!=='map') setModeFromUser('map');
      if(!spinEnabled || spinning || !map) return;
      if(map.getZoom() >= 3) return;
      if(typeof filterPanel !== 'undefined' && filterPanel) closePanel(filterPanel);
      spinning = true;
      hideResultIndicators();
      historyWasActive = document.body.classList.contains('show-history');
      if(historyWasActive){
        document.body.classList.remove('show-history');
        adjustBoards();
        updateModeToggle();
      }
      function step(){
        if(!spinning || !map) return;
        const isBusy = (map.isMoving && map.isMoving()) || (map.areTilesLoaded && !map.areTilesLoaded());
        if(isBusy){
          requestAnimationFrame(step);
          return;
        }
        const c = map.getCenter();
        map.setCenter([c.lng + spinSpeed, c.lat]);
        requestAnimationFrame(step);
      }
      if(fromCurrent){
        requestAnimationFrame(step);
      }else{
        const targetPitch = Number.isFinite(startPitch) ? startPitch : LEGACY_DEFAULT_PITCH;
        map.easeTo({center:[0,0], zoom:startZoom, pitch:targetPitch, essential:true});
        map.once('moveend', () => requestAnimationFrame(step));
      }
    }
    function stopSpin(){
      spinning = false;
      const wasHistory = historyWasActive;
      historyWasActive = false;
      if(wasHistory){
        document.body.classList.add('show-history');
        adjustBoards();
        updateModeToggle();
      }
      const shouldLoadPosts = pendingPostLoad;
      pendingPostLoad = false;
      if(shouldLoadPosts){
        scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
        return;
      }
      applyFilters();
    }

    function haltSpin(e){
      const target = (e && e.originalEvent && e.originalEvent.target) || (e && e.target);
      if(target instanceof Node && logoEls.some(el=>el.contains(target))) return;
      if(spinEnabled || spinning){
        spinEnabled = false;
        localStorage.setItem('spinGlobe','false');
        stopSpin();
      }
    }

    ['pointerdown','wheel','keydown','touchstart'].forEach(ev=>
      document.addEventListener(ev, haltSpin, {capture:true})
    );

    function updateSpinState(){
      const shouldSpin = spinLoadStart && (spinLoadType === 'all' || (spinLoadType === 'new' && firstVisit));
      if(shouldSpin !== spinEnabled){
        spinEnabled = shouldSpin;
        localStorage.setItem('spinGlobe', JSON.stringify(spinEnabled));
        if(spinEnabled) startSpin(); else stopSpin();
      }
    }

    window.spinGlobals = {
      get spinEnabled(){ return spinEnabled; },
      set spinEnabled(v){ spinEnabled = v; },
      get spinLoadStart(){ return spinLoadStart; },
      set spinLoadStart(v){ spinLoadStart = v; },
      get spinLoadType(){ return spinLoadType; },
      set spinLoadType(v){ spinLoadType = v; },
      get spinLogoClick(){ return spinLogoClick; },
      set spinLogoClick(v){ spinLogoClick = v; updateLogoClickState(); },
      startSpin,
      stopSpin,
      updateSpinState,
      updateLogoClickState
    };

    // Map layers
    function collectLocationEntries(post){
      const entries = [];
      const locs = Array.isArray(post?.locations) ? post.locations : [];
      locs.forEach((loc, idx) => {
        if(!loc) return;
        const lng = Number(loc.lng);
        const lat = Number(loc.lat);
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        entries.push({
          post,
          loc,
          lng,
          lat,
          index: idx,
          key: venueKey(lng, lat)
        });
      });
      if(!entries.length && Number.isFinite(post?.lng) && Number.isFinite(post?.lat)){
        const fallbackVenue = typeof post?.venue === 'string' && post.venue
          ? post.venue
          : (post?.city || '');
        entries.push({
          post,
          loc:{
            venue: fallbackVenue,
            address: post?.city || '',
            lng: post.lng,
            lat: post.lat
          },
          lng: post.lng,
          lat: post.lat,
          index: 0,
          key: venueKey(post.lng, post.lat)
        });
      }
      return entries.filter(entry => entry.key);
    }

    function postsToGeoJSON(list){
      const features = [];
      if(!Array.isArray(list) || !list.length){
        return { type:'FeatureCollection', features };
      }

      const venueGroups = new Map();
      const orphanEntries = [];

      list.forEach(p => {
        if(!p) return;
        const entries = collectLocationEntries(p);
        entries.forEach(entry => {
          if(!entry) return;
          const key = entry.key;
          const post = entry.post || p;
          if(!key){
            orphanEntries.push({ post, entry });
            return;
          }
          let group = venueGroups.get(key);
          if(!group){
            group = { key, entries: [], postIds: new Set() };
            venueGroups.set(key, group);
          }
          group.entries.push({ post, entry });
          if(post && post.id !== undefined && post.id !== null){
            const strId = String(post.id);
            if(strId) group.postIds.add(strId);
          }
        });
      });

      const buildSingleFeature = ({ post, entry }) => {
        if(!post || !entry) return null;
        const key = entry.key || '';
        const baseSub = subcategoryMarkerIds[post.subcategory] || slugify(post.subcategory);
        const labelLines = getMarkerLabelLines(post);
        const combinedLabel = buildMarkerLabelText(post, labelLines);
        const spriteSource = [baseSub || '', labelLines.line1 || '', labelLines.line2 || ''].join('|');
        const labelSpriteId = hashString(spriteSource);
        const featureId = key
          ? `post:${post.id}::${key}::${entry.index}`
          : `post:${post.id}::${entry.index}`;
        const venueName = entry.loc && entry.loc.venue ? entry.loc.venue : getPrimaryVenueName(post);
        return {
          type:'Feature',
          id: featureId,
          properties:{
            id: post.id,
            featureId,
            title: post.title,
            label: combinedLabel,
            labelLine1: labelLines.line1,
            labelLine2: labelLines.line2,
            labelSpriteId,
            venueName,
            city: post.city,
            cat: post.category,
            sub: baseSub,
            baseSub,
            venueKey: key,
            locationIndex: entry.index,
            isMultiVenue: false
          },
          geometry:{ type:'Point', coordinates:[entry.lng, entry.lat] }
        };
      };

      const buildMultiFeature = (group) => {
        if(!group || !group.entries.length) return null;
        const multiCount = group.postIds.size;
        if(multiCount <= 1){
          return group.entries.map(buildSingleFeature).filter(Boolean);
        }
        const primary = group.entries[0];
        if(!primary || !primary.post || !primary.entry) return null;
        const { post, entry } = primary;
        const baseSub = subcategoryMarkerIds[post.subcategory] || slugify(post.subcategory);
        const multiIconId = MULTI_POST_MARKER_ICON_ID;
        const venueName = (() => {
          for(const item of group.entries){
            const candidate = item && item.entry && item.entry.loc && item.entry.loc.venue;
            if(candidate){
              return candidate;
            }
          }
          return getPrimaryVenueName(post);
        })() || '';
        const multiCountLabel = `${multiCount} posts here`;
        const multiVenueText = shortenMarkerLabelText(venueName, markerLabelTextAreaWidthPx);
        const combinedLabel = multiVenueText ? `${multiCountLabel}\n${multiVenueText}` : multiCountLabel;
        const spriteSource = ['multi', multiIconId || '', baseSub || '', multiCountLabel, multiVenueText || ''].join('|');
        const labelSpriteId = hashString(spriteSource);
        const featureId = `venue:${group.key}::${post.id}`;
        const coordinates = [entry.lng, entry.lat];
        const multiIds = Array.from(group.postIds);
        return [{
          type:'Feature',
          id: featureId,
          properties:{
            id: post.id,
            featureId,
            title: multiCountLabel,
            label: combinedLabel,
            labelLine1: multiCountLabel,
            labelLine2: multiVenueText,
            labelSpriteId,
            venueName,
            city: post.city,
            cat: post.category,
            sub: multiIconId,
            baseSub,
            venueKey: group.key,
            locationIndex: entry.index,
            isMultiVenue: true,
            multiCount,
            multiPostIds: multiIds
          },
          geometry:{ type:'Point', coordinates }
        }];
      };

      venueGroups.forEach(group => {
        const result = buildMultiFeature(group);
        if(Array.isArray(result)){
          result.forEach(feature => { if(feature) features.push(feature); });
        }
      });

      orphanEntries.forEach(item => {
        const feature = buildSingleFeature(item);
        if(feature) features.push(feature);
      });

      return {
        type:'FeatureCollection',
        features
      };
    }



    let addingPostSource = false;
    let pendingAddPostSource = false;

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
      if(map && Number.isFinite(lastKnownZoom) && lastKnownZoom >= MARKER_SPRITE_ZOOM){
        map.__retainAllMarkerSprites = true;
      }
      try{
      const markerList = filtersInitialized && Array.isArray(filtered) ? filtered : posts;
      const collections = getMarkerCollections(markerList);
      const { postsData, signature, featureIndex } = collections;
      markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      const featureCount = Array.isArray(postsData.features) ? postsData.features.length : 0;
      if(featureCount > 1000){
        await new Promise(resolve => scheduleIdle(resolve, 120));
      }
      const MARKER_MIN_ZOOM = MARKER_ZOOM_THRESHOLD;
      const existing = map.getSource('posts');
      if(!existing){
        map.addSource('posts', { type:'geojson', data: postsData, promoteId: 'featureId' });
        const source = map.getSource('posts');
        if(source){ source.__markerSignature = signature; }
      } else {
        existing.setData(postsData);
        existing.__markerSignature = signature;
      }
      const iconIds = Object.keys(subcategoryMarkers);
      if(typeof ensureMapIcon === 'function'){
        await Promise.all(iconIds.map(id => ensureMapIcon(id).catch(()=>{})));
      }
      if(typeof ensureMarkerLabelComposite === 'function'){
        const spriteMeta = new Map();
        const zoomLevel = typeof map.getZoom === 'function' ? Number(map.getZoom()) : NaN;
        const zoomEligible = Number.isFinite(zoomLevel) && zoomLevel >= 8;
        const rawBounds = zoomEligible && typeof map.getBounds === 'function' ? normalizeBounds(map.getBounds()) : null;
        const priorityBounds = rawBounds ? expandBounds(rawBounds, { lat: 0.35, lng: 0.35 }) : null;
        const highlightedPostIdSet = new Set();
        lastHighlightedPostIds.forEach(entry => {
          if(!entry) return;
          const rawId = entry.id ?? entry.postId ?? entry.postID ?? entry.postid;
          if(rawId === undefined || rawId === null) return;
          const strId = String(rawId);
          if(strId){
            highlightedPostIdSet.add(strId);
          }
        });
        const usageTimestamp = nowTimestamp();
        postsData.features.forEach(feature => {
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
          const stored = spriteMeta.get(spriteId);
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
        await Promise.all(eagerSpriteEntries.map(([spriteId, meta]) =>
          ensureMarkerLabelComposite(
            map,
            spriteId,
            meta.iconId,
            meta.labelLine1,
            meta.labelLine2,
            meta.isMulti,
            { priority: meta.priority }
          ).catch(()=>{})
        ));
        enforceMarkerLabelCompositeBudget(map);
      }
      ensureMarkerLabelBackground(map);
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
      const markerLabelBaseOpacity = ['case', highlightedStateExpression, 0, 1];

      const markerLabelMinZoom = MARKER_MIN_ZOOM;
      const labelLayersConfig = [
        { id:'marker-label', source:'posts', sortKey: 1100, filter: markerLabelFilter, iconImage: markerLabelIconImage, iconOpacity: markerLabelBaseOpacity, minZoom: markerLabelMinZoom },
        { id:'marker-label-highlight', source:'posts', sortKey: 1101, filter: markerLabelFilter, iconImage: markerLabelHighlightIconImage, iconOpacity: markerLabelHighlightOpacity, minZoom: markerLabelMinZoom }
      ];
      labelLayersConfig.forEach(({ id, source, sortKey, filter, iconImage, iconOpacity, minZoom }) => {
        const layerMinZoom = Number.isFinite(minZoom) ? minZoom : markerLabelMinZoom;
        let layerExists = !!map.getLayer(id);
        if(!layerExists){
          try{
            map.addLayer({
              id,
              type:'symbol',
              source,
              filter: filter || markerLabelFilter,
              minzoom: layerMinZoom,
              layout:{
                'icon-image': iconImage || markerLabelIconImage,
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-anchor': 'left',
                'icon-pitch-alignment': 'viewport',
                'symbol-z-order': 'viewport-y',
                'symbol-sort-key': sortKey
              },
              paint:{
                'icon-translate': [markerLabelBgTranslatePx, 0],
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
        try{ map.setLayoutProperty(id,'icon-size', 1); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-allow-overlap', true); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-ignore-placement', true); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-anchor','left'); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-pitch-alignment','viewport'); }catch(e){}
        try{ map.setLayoutProperty(id,'symbol-z-order','viewport-y'); }catch(e){}
        try{ map.setLayoutProperty(id,'symbol-sort-key', sortKey); }catch(e){}
        try{ map.setPaintProperty(id,'icon-translate',[markerLabelBgTranslatePx,0]); }catch(e){}
        try{ map.setPaintProperty(id,'icon-translate-anchor','viewport'); }catch(e){}
        try{ map.setPaintProperty(id,'icon-opacity', iconOpacity || 1); }catch(e){}
        try{ map.setLayerZoomRange(id, layerMinZoom, 24); }catch(e){}
      });
      ALL_MARKER_LAYER_IDS.forEach(id=>{
        if(map.getLayer(id)){
          try{ map.moveLayer(id); }catch(e){}
        }
      });
      [
        ['marker-label','icon-opacity-transition'],
        ['marker-label-highlight','icon-opacity-transition']
      ].forEach(([layer, prop])=>{
        if(map.getLayer(layer)){
          try{ map.setPaintProperty(layer, prop, {duration:0}); }catch(e){}
        }
      });
      refreshInViewMarkerLabelComposites(map);
      if(!postSourceEventsBound){
        function createMapCardOverlay(post, opts = {}){
          const { targetLngLat, fixedLngLat, eventLngLat, venueKey: overlayVenueKey = null } = opts;
          const previousKey = selectedVenueKey;
          if(overlayVenueKey){
            selectedVenueKey = overlayVenueKey;
          }
          try{
            const overlayRoot = document.createElement('div');
            overlayRoot.className = 'mapmarker-overlay';
            overlayRoot.setAttribute('aria-hidden', 'true');
            overlayRoot.style.pointerEvents = 'none';
            overlayRoot.style.userSelect = 'none';

            const parseVenueKey = (key)=>{
              if(typeof key !== 'string') return null;
              const parts = key.split(',');
              if(parts.length !== 2) return null;
              const lng = Number(parts[0]);
              const lat = Number(parts[1]);
              if(!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
              return { lng, lat };
            };

            let resolvedVenueKey = typeof overlayVenueKey === 'string' && overlayVenueKey ? overlayVenueKey : '';
            let resolvedCoords = resolvedVenueKey ? parseVenueKey(resolvedVenueKey) : null;
            const sourceCoord = targetLngLat || fixedLngLat || eventLngLat || (Number.isFinite(post?.lng) && Number.isFinite(post?.lat) ? { lng: post.lng, lat: post.lat } : null);
            if(!resolvedCoords && sourceCoord && Number.isFinite(sourceCoord.lng) && Number.isFinite(sourceCoord.lat)){
              resolvedCoords = { lng: Number(sourceCoord.lng), lat: Number(sourceCoord.lat) };
            }
            if(!resolvedVenueKey && resolvedCoords){
              resolvedVenueKey = toVenueCoordKey(resolvedCoords.lng, resolvedCoords.lat);
            }
            if(resolvedVenueKey){
              overlayRoot.dataset.venueKey = resolvedVenueKey;
            } else if(overlayVenueKey){
              overlayRoot.dataset.venueKey = overlayVenueKey;
            } else {
              delete overlayRoot.dataset.venueKey;
            }

            const visibleList = (filtersInitialized && Array.isArray(filtered) && filtered.length) ? filtered : posts;
            const allowedIdSet = new Set(Array.isArray(visibleList) ? visibleList.map(item => {
              if(!item || item.id === undefined || item.id === null) return '';
              return String(item.id);
            }).filter(Boolean) : []);
            let venuePostsAll = [];
            if(resolvedCoords && typeof getPostsAtVenueByCoords === 'function'){
              venuePostsAll = getPostsAtVenueByCoords(resolvedCoords.lng, resolvedCoords.lat) || [];
            } else if(resolvedVenueKey && typeof getPostsAtVenueByCoords === 'function'){
              const coords = parseVenueKey(resolvedVenueKey);
              if(coords){
                venuePostsAll = getPostsAtVenueByCoords(coords.lng, coords.lat) || [];
              }
            }
            let venuePostsVisible = Array.isArray(venuePostsAll) ? venuePostsAll.filter(item => allowedIdSet.has(String(item && item.id))) : [];
            if(!venuePostsVisible.length){
              const fallbackPost = Array.isArray(visibleList) ? visibleList.find(item => item && String(item.id) === String(post && post.id)) : null;
              if(fallbackPost){
                venuePostsVisible = [fallbackPost];
              } else if(post){
                venuePostsVisible = [post];
              }
            }
            const uniqueVenuePosts = [];
            const venuePostIds = new Set();
            venuePostsVisible.forEach(item => {
              if(!item || item.id === undefined || item.id === null) return;
              const idStr = String(item.id);
              if(!idStr || venuePostIds.has(idStr)) return;
              venuePostIds.add(idStr);
              uniqueVenuePosts.push(item);
            });
            if(!uniqueVenuePosts.length && post){
              uniqueVenuePosts.push(post);
              if(post.id !== undefined && post.id !== null){
                venuePostIds.add(String(post.id));
              }
            }
            const multiIds = Array.from(venuePostIds);
            const multiCount = uniqueVenuePosts.length;
            const isMultiVenue = multiCount > 1;
            if(isMultiVenue){
              overlayRoot.dataset.multiIds = multiIds.join(',');
            } else {
              delete overlayRoot.dataset.multiIds;
            }
            const sortedList = Array.isArray(sortedPostList) ? sortedPostList : [];
            let primaryVenuePost = null;
            if(isMultiVenue && sortedList.length){
              primaryVenuePost = sortedList.find(entry => entry && venuePostIds.has(String(entry.id))) || null;
            }
            if(!primaryVenuePost){
              primaryVenuePost = uniqueVenuePosts[0] || post;
            }
            const overlayId = primaryVenuePost && primaryVenuePost.id !== undefined && primaryVenuePost.id !== null
              ? String(primaryVenuePost.id)
              : String(post.id);
            overlayRoot.dataset.id = overlayId;

            const markerContainer = document.createElement('div');
            markerContainer.className = 'small-map-card';
            markerContainer.dataset.id = overlayId;
            markerContainer.setAttribute('aria-hidden', 'true');
            markerContainer.style.pointerEvents = 'none';
            markerContainer.style.userSelect = 'none';

            const markerIcon = new Image();
            try{ markerIcon.decoding = 'async'; }catch(e){}
            markerIcon.alt = '';
            markerIcon.className = 'mapmarker';
            markerIcon.draggable = false;
            markerIcon.loading = 'eager';
            markerIcon.referrerPolicy = 'no-referrer';
            if(isMultiVenue){
              markerIcon.src = SMALL_MULTI_MAP_CARD_ICON_SRC;
              enforceSmallMultiMapCardIcon(markerIcon, overlayRoot);
            } else {
              const markerSources = window.subcategoryMarkers || {};
              const markerIds = window.subcategoryMarkerIds || {};
              const slugifyFn = typeof slugify === 'function' ? slugify : (window.slugify || (str => (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')));
              const markerIdCandidates = [];
              if(post && post.subcategory){
                const mappedId = markerIds[post.subcategory];
                if(mappedId) markerIdCandidates.push(mappedId);
                markerIdCandidates.push(slugifyFn(post.subcategory));
              }
              const markerIconUrl = markerIdCandidates.map(id => (id && markerSources[id]) || null).find(Boolean) || '';
              const markerFallback = 'assets/icons-30/whats-on-category-icon-30.webp';
              markerIcon.onerror = ()=>{
                markerIcon.onerror = null;
                markerIcon.src = markerFallback;
              };
              markerIcon.src = markerIconUrl || markerFallback;
            }
            requestAnimationFrame(() => {
              if(typeof markerIcon.decode === 'function'){
                markerIcon.decode().catch(()=>{});
              }
            });

            const markerPill = new Image();
            try{ markerPill.decoding = 'async'; }catch(e){}
            markerPill.alt = '';
            markerPill.src = 'assets/icons-30/150x40-pill-70.webp';
            markerPill.dataset.defaultSrc = 'assets/icons-30/150x40-pill-70.webp';
            markerPill.dataset.highlightSrc = 'assets/icons-30/150x40-pill-2f3b73.webp';
            markerPill.className = 'mapmarker-pill';
            markerPill.loading = 'eager';
            markerPill.style.opacity = '0.9';
            markerPill.style.visibility = 'visible';
            markerPill.draggable = false;
            requestAnimationFrame(() => {
              if(typeof markerPill.decode === 'function'){
                markerPill.decode().catch(()=>{});
              }
            });

            const labelLines = isMultiVenue ? null : getMarkerLabelLines(post);
            const venueDisplayName = (()=>{
              if(resolvedVenueKey){
                const candidates = uniqueVenuePosts.length ? uniqueVenuePosts : (post ? [post] : []);
                for(const candidate of candidates){
                  const locs = Array.isArray(candidate?.locations) ? candidate.locations : [];
                  const match = locs.find(loc => loc && toVenueCoordKey(loc.lng, loc.lat) === resolvedVenueKey && loc.venue);
                  if(match && match.venue){
                    return match.venue;
                  }
                }
              }
              const fallback = uniqueVenuePosts[0] || post;
              return getPrimaryVenueName(fallback) || '';
            })();
            const multiSmallVenueText = shortenMarkerLabelText(venueDisplayName, markerLabelTextAreaWidthPx);
            const multiBigVenueText = shortenMarkerLabelText(venueDisplayName, mapCardTitleWidthPx);
            const multiCountLabel = `${multiCount} posts here`;
            const markerLabel = document.createElement('div');
            markerLabel.className = 'mapmarker-label';
            if(isMultiVenue){
              markerContainer.classList.add('small-multi-post-map-card');
              const markerLine1 = document.createElement('div');
              markerLine1.className = 'mapmarker-label-line';
              markerLine1.textContent = multiCountLabel;
              const markerLine2 = document.createElement('div');
              markerLine2.className = 'mapmarker-label-line';
              markerLine2.textContent = multiSmallVenueText || venueDisplayName || '';
              markerLabel.append(markerLine1, markerLine2);
            } else if(labelLines){
              const markerLine1 = document.createElement('div');
              markerLine1.className = 'mapmarker-label-line';
              markerLine1.textContent = labelLines.line1;
              markerLabel.appendChild(markerLine1);
              if(labelLines.line2){
                const markerLine2 = document.createElement('div');
                markerLine2.className = 'mapmarker-label-line';
                markerLine2.textContent = labelLines.line2;
                markerLabel.appendChild(markerLine2);
              }
            }

            markerContainer.append(markerPill, markerIcon, markerLabel);

            const cardRoot = document.createElement('div');
            cardRoot.className = 'big-map-card big-map-card--popup';
            if(isMultiVenue){
              cardRoot.classList.add('big-multi-post-map-card');
            }
            cardRoot.dataset.id = overlayId;
            cardRoot.setAttribute('aria-hidden', 'true');
            cardRoot.style.pointerEvents = 'auto';
            cardRoot.style.userSelect = 'none';

            const pillImg = new Image();
            try{ pillImg.decoding = 'async'; }catch(e){}
            pillImg.alt = '';
            pillImg.src = 'assets/icons-30/225x60-pill-99.webp';
            pillImg.className = 'map-card-pill';
            pillImg.style.opacity = '0.9';
            pillImg.draggable = false;

            const thumbImg = new Image();
            try{ thumbImg.decoding = 'async'; }catch(e){}
            thumbImg.alt = '';
            thumbImg.loading = 'eager';
            thumbImg.draggable = false;
            if(isMultiVenue){
              thumbImg.src = 'assets/icons-30/multi-post-icon-50.webp';
              thumbImg.className = 'map-card-thumb';
            } else {
              const thumbFallback = 'assets/funmap-logo-small.png';
              thumbImg.onerror = ()=>{
                thumbImg.onerror = null;
                thumbImg.src = thumbFallback;
              };
              thumbImg.src = thumbUrl(post) || thumbFallback;
              thumbImg.className = 'map-card-thumb';
              thumbImg.referrerPolicy = 'no-referrer';
            }
            requestAnimationFrame(() => {
              if(typeof thumbImg.decode === 'function'){
                thumbImg.decode().catch(()=>{});
              }
            });

            const labelEl = document.createElement('div');
            labelEl.className = 'map-card-label';
            const titleWrap = document.createElement('div');
            titleWrap.className = 'map-card-title';
            if(isMultiVenue){
              [multiCountLabel, multiBigVenueText || venueDisplayName || ''].forEach(line => {
                const lineEl = document.createElement('div');
                lineEl.className = 'map-card-title-line';
                lineEl.textContent = line;
                titleWrap.appendChild(lineEl);
              });
            } else if(labelLines){
              const cardTitleLines = Array.isArray(labelLines.cardTitleLines) && labelLines.cardTitleLines.length
                ? labelLines.cardTitleLines.slice(0, 2)
                : [labelLines.line1, labelLines.line2].filter(Boolean).slice(0, 2);
              cardTitleLines.forEach(line => {
                if(!line) return;
                const lineEl = document.createElement('div');
                lineEl.className = 'map-card-title-line';
                lineEl.textContent = line;
                titleWrap.appendChild(lineEl);
              });
            }
            if(!titleWrap.childElementCount){
              const lineEl = document.createElement('div');
              lineEl.className = 'map-card-title-line';
              lineEl.textContent = '';
              titleWrap.appendChild(lineEl);
            }
            labelEl.appendChild(titleWrap);
            if(!isMultiVenue && labelLines){
              const venueLine = labelLines.venueLine || shortenMarkerLabelText(getPrimaryVenueName(post), mapCardTitleWidthPx);
              if(venueLine){
                const venueEl = document.createElement('div');
                venueEl.className = 'map-card-venue';
                venueEl.textContent = venueLine;
                labelEl.appendChild(venueEl);
              }
            }

            cardRoot.append(pillImg, thumbImg, labelEl);
            overlayRoot.append(markerContainer, cardRoot);
            overlayRoot.classList.add('is-card-visible');
            overlayRoot.style.pointerEvents = '';
            resetBigMapCardTransforms();

            const handleOverlayClick = (ev)=>{
              ev.preventDefault();
              ev.stopPropagation();
              const pid = overlayRoot.dataset.id;
              if(!pid) return;
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    touchMarker = null;
                    stopSpin();
                    if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                      try{ closePanel(filterPanel); }catch(err){}
                    }
                    fn(pid, false, true);
                  }catch(err){ console.error(err); }
                });
              });
            };
            cardRoot.addEventListener('click', handleOverlayClick, { capture: true });
            ['pointerdown','mousedown','touchstart'].forEach(type => {
              cardRoot.addEventListener(type, (ev)=>{
                const pointerType = typeof ev.pointerType === 'string' ? ev.pointerType.toLowerCase() : '';
                const isTouchLike = pointerType === 'touch' || ev.type === 'touchstart';
                if(!isTouchLike){
                  try{ ev.preventDefault(); }catch(err){}
                }
                try{ ev.stopPropagation(); }catch(err){}
              }, { capture: true });
            });
            const marker = new mapboxgl.Marker({ element: overlayRoot, anchor: 'center' });
            if(typeof marker.setZIndexOffset === 'function'){
              try{ marker.setZIndexOffset(20000); }catch(e){}
            }
            const markerElement = typeof marker.getElement === 'function' ? marker.getElement() : overlayRoot;
            if(markerElement && markerElement.style){
              markerElement.style.zIndex = '20000';
            }
            if(targetLngLat){ marker.setLngLat(targetLngLat); }
            else if(fixedLngLat){ marker.setLngLat(fixedLngLat); }
            else if(eventLngLat){ marker.setLngLat(eventLngLat); }
            marker.addTo(map);
            marker.__fixedLngLat = fixedLngLat;
            window.__overCard = false;
            registerPopup(marker);
            return marker;
          } finally {
            if(overlayVenueKey){
              selectedVenueKey = previousKey;
            }
          }
        }

        const handleMarkerClick = (e)=>{
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
          const helperMultiCount = Math.max(normalizedMultiIds.length, normalizedMultiCount, props.isMultiVenue ? 2 : 0);
          const isMultiCluster = helperMultiCount > 1;
          if(id !== undefined && id !== null){
            activePostId = id;
            selectedVenueKey = venueKey;
            updateSelectedMarkerRing();
          }
          const coords = f.geometry && f.geometry.coordinates;
          const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
          const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const targetLngLat = baseLngLat || (e ? e.lngLat : null);
          const touchClick = isTouchDevice || (e.originalEvent && (e.originalEvent.pointerType === 'touch' || e.originalEvent.pointerType === 'pen'));
          if(touchClick){
            if(touchMarker !== id || !hoverPopup){
              touchMarker = id;
              if(hoverPopup){
                runOverlayCleanup(hoverPopup);
                try{ hoverPopup.remove(); }catch(err){}
                hoverPopup = null;
                updateSelectedMarkerRing();
              }
              const p = posts.find(x=>x.id===id);
              if(p){
                hoverPopup = createMapCardOverlay(p, { targetLngLat, fixedLngLat, eventLngLat: e && e.lngLat, venueKey });
                updateSelectedMarkerRing();
              }
            }
            if(isMultiCluster){
              autoOpenPostBoardForCluster({
                multiIds: normalizedMultiIds,
                multiCount: helperMultiCount,
                trigger: 'touch'
              });
            }
            return;
          }
          if(isMultiCluster){
            autoOpenPostBoardForCluster({
              multiIds: normalizedMultiIds,
              multiCount: helperMultiCount,
              trigger: 'click'
            });
          }
        };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('click', layer, handleMarkerClick));

      map.on('click', e=>{
        const originalTarget = e.originalEvent && e.originalEvent.target;
        const targetEl = originalTarget && typeof originalTarget.closest === 'function'
          ? originalTarget.closest('.mapmarker-overlay')
          : null;
        if(targetEl){
          return;
        }
        const feats = map.queryRenderedFeatures(e.point);
        if(!feats.length){
          if(hoverPopup){
            runOverlayCleanup(hoverPopup);
            try{ hoverPopup.remove(); }catch(err){}
            hoverPopup = null;
          }
          updateSelectedMarkerRing();
          touchMarker = null;
        }
      });

      updateSelectedMarkerRing();

      // Cursor + popup for marker points
      
      const handleMarkerMouseEnter = (e)=>{
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features && e.features[0]; if(!f) return;
        const props = f.properties || {};
        const id = props.id;
        const venueKey = props.venueKey || null;
        const coords = f.geometry && f.geometry.coordinates;
        const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
        const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
        const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
        const targetLngLat = baseLngLat || (e ? e.lngLat : null);
        const p = posts.find(x=>x.id===id);
        if(!p){
          return;
        }
        if(hoverPopup){
          runOverlayCleanup(hoverPopup);
          try{ hoverPopup.remove(); }catch(e){}
          hoverPopup = null;
          updateSelectedMarkerRing();
        }
        hoverPopup = createMapCardOverlay(p, { targetLngLat, fixedLngLat, eventLngLat: e && e.lngLat, venueKey });
        updateSelectedMarkerRing();
      };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mouseenter', layer, handleMarkerMouseEnter));

      const onMarkerMove = window.rafThrottle((evt)=>{
        if(hoverPopup && typeof hoverPopup.setLngLat === 'function'){
          const fixed = hoverPopup.__fixedLngLat;
          if(fixed && Number.isFinite(fixed.lng) && Number.isFinite(fixed.lat)){
            hoverPopup.setLngLat(fixed);
          }
        }
      });
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mousemove', layer, onMarkerMove));

      const handleMarkerMouseLeave = ()=>{
        map.getCanvas().style.cursor = 'grab';
        if(listLocked) return;
        const currentPopup = hoverPopup;
        schedulePopupRemoval(currentPopup, 200);
      };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mouseleave', layer, handleMarkerMouseLeave));

      // Maintain pointer cursor for balloons and surface multi-venue cards when applicable
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
    window.addPostSource = addPostSource;
    function renderLists(list){
      if(spinning || !postsLoaded) return;
      const sort = currentSort;
      const arr = list.slice();
      if(sort==='az') arr.sort((a,b)=> a.title.localeCompare(b.title));
      if(sort==='soon') arr.sort((a,b)=> a.dates[0].localeCompare(b.dates[0]));
      if(sort==='nearest'){
        let ref = {lng:0,lat:0}; if(map){ const c = map.getCenter(); ref = {lng:c.lng,lat:c.lat}; }
        arr.sort((a,b)=> distKm({lng:a.lng,lat:a.lat}, ref) - distKm({lng:b.lng,lat:b.lat}, ref));
      }
      if(favToTop && !favSortDirty) arr.sort((a,b)=> (b.fav - a.fav));

      const { postsData } = getMarkerCollections(arr);
      const boundsForCount = getVisibleMarkerBoundsForCount();
      const markerTotal = boundsForCount ? countMarkersForVenue(arr, null, boundsForCount) : countMarkersForVenue(arr);

      sortedPostList = arr;
      renderedPostCount = 0;

      if(postBatchObserver) postBatchObserver.disconnect();
      removeScrollListener(postsWideEl, onPostBoardScroll, postBoardScrollOptions);
      postBoardScrollOptions = null;
      if(postSentinel) postSentinel.remove();
      postSentinel = null;

      if(resultsEl) resultsEl.innerHTML = '';
      postsWideEl.innerHTML = '';

      if(markerTotal === 0){
        updateResultCount(0);
        const emptyWrap = document.createElement('div');
        emptyWrap.className = 'post-board-empty';
        const summaryEl = $('#filterSummary');
        const summaryText = summaryEl ? summaryEl.textContent.trim() : '';
        const summaryCopy = document.createElement('div');
        summaryCopy.className = 'filter-summary post-board-empty-summary';
        summaryCopy.textContent = summaryText || 'No results match your filters.';
        emptyWrap.appendChild(summaryCopy);
        const emptyImg = document.createElement('img');
        emptyImg.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
        emptyImg.alt = 'Cute little monkey in red cape pointing up';
        emptyImg.className = 'post-board-empty-image';
        emptyWrap.appendChild(emptyImg);
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'post-board-empty-message';
        emptyMsg.textContent = 'There are no posts here. Try moving the map or changing your filter settings.';
        emptyWrap.appendChild(emptyMsg);
        postsWideEl.appendChild(emptyWrap);
        return;
      }

      postSentinel = document.createElement('div');
      postSentinel.style.height = '1px';
      postsWideEl.appendChild(postSentinel);

      if(spinning && arr.length){
        const sample = card(arr[0], true);
        sample.style.visibility = 'hidden';
        postsWideEl.insertBefore(sample, postSentinel);
        const rect = sample.getBoundingClientRect();
        const style = getComputedStyle(sample);
        const cardHeight = rect.height + parseFloat(style.marginBottom || 0);
        postsWideEl.removeChild(sample);
        const max = Math.max(1, Math.floor(postsModeEl.clientHeight / cardHeight));
        appendPostBatch(max);
      } else {
        appendPostBatch(INITIAL_RENDER_COUNT);
      }

      updateResultCount(markerTotal);

      if('IntersectionObserver' in window){
        postBatchObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if(entry.isIntersecting){
              appendPostBatch();
            }
          });
        }, {root: postsWideEl, rootMargin:'0px 0px 200px 0px'});
        postBatchObserver.observe(postSentinel);
      } else {
        postBoardScrollOptions = addPassiveScrollListener(postsWideEl, onPostBoardScroll);
      }
    }
    function updateResultCount(n){
      const el = $('#resultCount');
      if(!el) return;
      if(spinning){
        el.innerHTML = '';
        el.style.display = 'none';
        return;
      }
      el.innerHTML = `<strong>${n}</strong>`;
      el.style.display = '';
    }
    function formatDates(d){
      if(!d || !d.length) return '';
      const sorted = d.slice().sort();
      const currentYear = new Date().getFullYear();
      const formatPart = (dateObj, includeYear=false)=>{
        const base = dateObj.toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'}).replace(/,/g,'');
        return includeYear ? `${base}, ${dateObj.getFullYear()}` : base;
      };
      const first = parseISODate(sorted[0]);
      const last = parseISODate(sorted[sorted.length-1]);
      if(sorted.length === 1){
        const includeYear = first.getFullYear() !== currentYear;
        return formatPart(first, includeYear);
      }
      const firstYear = first.getFullYear();
      const lastYear = last.getFullYear();
      const crossYear = firstYear !== lastYear;
      const firstIncludeYear = crossYear && firstYear !== currentYear;
      const lastIncludeYear = (crossYear && lastYear !== currentYear) || (!crossYear && lastYear !== currentYear);
      const startText = formatPart(first, firstIncludeYear);
      const endText = formatPart(last, lastIncludeYear);
      return `${startText} - ${endText}`;
    }

    function parseCreatedToDate(created){
      if(!created) return null;
      const parts = created.split('T');
      if(parts.length < 2) return null;
      const [datePart, rawTime] = parts;
      if(!datePart) return null;
      const hasZ = rawTime.endsWith('Z');
      const timeCore = hasZ ? rawTime.slice(0, -1) : rawTime;
      const [hh = '00', mm = '00', ss = '00', ms = ''] = timeCore.split('-');
      const iso = `${datePart}T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:${ss.padStart(2,'0')}${ms ? '.' + ms : ''}${hasZ ? 'Z' : ''}`;
      const dt = new Date(iso);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function formatPostTimestamp(created){
      const dt = parseCreatedToDate(created);
      if(!dt) return '';
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth()+1).padStart(2,'0');
      const d = String(dt.getUTCDate()).padStart(2,'0');
      const hh = String(dt.getUTCHours()).padStart(2,'0');
      const mm = String(dt.getUTCMinutes()).padStart(2,'0');
      return `${y}-${m}-${d} ${hh}:${mm} UTC`;
    }

    function prioritizeVisibleImages(){
      const roots = [postsWideEl];
      if(resultsEl) roots.push(resultsEl);
      roots.forEach(root => {
        const imgs = root.querySelectorAll('img.thumb');
        if(!imgs.length) return;
        if('IntersectionObserver' in window){
          const observerRoot = root === postsWideEl ? root.closest('.post-board') : root;
          const obs = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if(entry.isIntersecting){
                const img = entry.target;
                if(img.dataset.src){
                  img.addEventListener('load', ()=> img.classList.remove('lqip'), {once:true});
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                }
                img.fetchPriority = 'high';
                obs.unobserve(img);
              }
            });
          }, {root: observerRoot});
          imgs.forEach(img => obs.observe(img));
        } else {
          imgs.forEach(img => {
            img.loading = 'lazy';
            if(img.dataset.src){
              img.addEventListener('load', ()=> img.classList.remove('lqip'), {once:true});
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
          });
        }
      });
    }

    function card(p, wide=false){
      const el = document.createElement('article');
      el.className = wide ? 'post-card' : 'recents-card';
      el.dataset.id = p.id;
      if(wide) el.style.gridTemplateColumns='80px 1fr 36px';
      const thumbSrc = thumbUrl(p);
      const thumb = `<img class="thumb lqip" loading="lazy" src="${thumbSrc}" alt="" referrerpolicy="no-referrer" />`;
        el.innerHTML = `
          ${thumb}
        <div class="meta">
          <div class="title">${p.title}</div>
          <div class="info">
            <div class="cat-line"><span class="sub-icon">${subcategoryIcons[p.subcategory]||''}</span> ${p.category} &gt; ${p.subcategory}</div>
            <div class="loc-line"><span class="badge" title="Venue">📍</span><span>${p.city}</span></div>
            <div class="date-line"><span class="badge" title="Dates">📅</span><span>${formatDates(p.dates)}</span></div>
          </div>
        </div>
        <button class="fav" aria-pressed="${p.fav?'true':'false'}" aria-label="Toggle favourite">
          <svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>
        </button>
      `;
      el.dataset.surfaceBg = CARD_SURFACE;
      el.style.background = CARD_SURFACE;
      el.querySelector('.fav').addEventListener('click', (e)=>{
        e.stopPropagation();
        p.fav = !p.fav;
        favSortDirty = true;
        document.querySelectorAll(`[data-id="${p.id}"] .fav`).forEach(btn=>{
          btn.setAttribute('aria-pressed', p.fav ? 'true' : 'false');
        });
        renderHistoryBoard();
      });

      const handleHoverHighlight = (state)=> toggleSmallMapCardHoverHighlight(p.id, state);

      el.addEventListener('mouseenter', ()=> handleHoverHighlight(true));
      el.addEventListener('mouseleave', ()=> handleHoverHighlight(false));
      el.dataset.hoverHighlightBound = '1';
      return el;
    }

    document.addEventListener('mouseover', event => {
      const cardEl = event.target.closest('.post-card, .recents-card');
      if(!cardEl || cardEl.dataset.hoverHighlightBound === '1') return;
      const related = event.relatedTarget;
      if(related && cardEl.contains(related)) return;
      const id = cardEl.dataset ? cardEl.dataset.id : null;
      if(!id) return;
      toggleSmallMapCardHoverHighlight(id, true);
    });

    document.addEventListener('mouseout', event => {
      const cardEl = event.target.closest('.post-card, .recents-card');
      if(!cardEl || cardEl.dataset.hoverHighlightBound === '1') return;
      const related = event.relatedTarget;
      if(related && cardEl.contains(related)) return;
      const id = cardEl.dataset ? cardEl.dataset.id : null;
      if(!id) return;
      toggleSmallMapCardHoverHighlight(id, false);
    });

    // History board
    function loadHistory(){ try{ return JSON.parse(localStorage.getItem('openHistoryV2')||'[]'); }catch(e){ return []; } }
    function saveHistory(){ localStorage.setItem('openHistoryV2', JSON.stringify(viewHistory)); }
    function formatLastOpened(ts){
      if(!ts) return '';
      const diff = Date.now() - ts;
      const mins = Math.floor(diff/60000);
      let ago;
      if(mins < 60){
        ago = mins + ' minute' + (mins===1?'':'s');
      } else if(mins < 1440){
        const hrs = Math.floor(mins/60);
        ago = hrs + ' hour' + (hrs===1?'':'s');
      } else {
        const days = Math.floor(mins/1440);
        ago = days + ' day' + (days===1?'':'s');
      }
      const d = new Date(ts);
      const weekday = d.toLocaleDateString('en-GB', {weekday:'short'});
      const day = d.getDate();
      const month = d.toLocaleDateString('en-GB', {month:'short'});
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2,'0');
      const minute = String(d.getMinutes()).padStart(2,'0');
      return `Last opened ${ago} ago - ${weekday} ${day} ${month}, ${year} ${hour}:${minute}`;
    }

    function captureState(){
      const {start,end} = orderedRange();
      const openCats = Object.values(categoryControllers).filter(ctrl=>ctrl.getOpenState && ctrl.getOpenState()).map(ctrl=>ctrl.name);
      return {
        bounds: map ? map.getBounds().toArray() : null,
        kw: $('#keyword-textbox').value,
        date: $('#daterange-textbox').value,
        start: start ? toISODate(start) : null,
        end: end ? toISODate(end) : null,
        expired: $('#expiredToggle').checked,
        minPrice: $('#min-price-input') ? $('#min-price-input').value : '',
        maxPrice: $('#max-price-input') ? $('#max-price-input').value : '',
        cats: [...selection.cats],
        subs: [...selection.subs],
        openCats
      };
    }

    function restoreState(st){
      if(!st) return;
      $('#keyword-textbox').value = st.kw || '';
      if($('#min-price-input')){
        const minEl = $('#min-price-input');
        minEl.value = (st.minPrice || '').toString().replace(/\D+/g,'');
      }
      if($('#max-price-input')){
        const maxEl = $('#max-price-input');
        maxEl.value = (st.maxPrice || '').toString().replace(/\D+/g,'');
      }
      dateStart = st.start ? parseISODate(st.start) : null;
      dateEnd = st.end ? parseISODate(st.end) : null;
      if(!st.start && st.range){
        const parts = st.range.split(' to ').map(s=>s.trim());
        if(parts[0]) dateStart = parseISODate(parts[0]);
        if(parts[1]) dateEnd = parseISODate(parts[1]);
      }
      $('#expiredToggle').checked = st.expired || false;
      if($('#expiredToggle').checked){
        buildFilterCalendar(minPickerDate, maxPickerDate);
      } else {
        buildFilterCalendar(today, maxPickerDate);
      }
      if(dateStart){
        const sIso = toISODate(dateStart);
        const sDisp = fmtShort(sIso);
        if(dateEnd && dateEnd.getTime() !== dateStart.getTime()){
          const eIso = toISODate(dateEnd);
          const eDisp = fmtShort(eIso);
          $('#daterange-textbox').value = `${sDisp} - ${eDisp}`;
        } else {
          $('#daterange-textbox').value = sDisp;
        }
      } else {
        $('#daterange-textbox').value = '';
      }
      expiredWasOn = $('#expiredToggle').checked;
      updateRangeClasses();
      updateInput();
      const savedCatsArray = Array.isArray(st.cats) && st.cats.length ? st.cats : categories.map(cat=>cat.name);
      const savedCats = new Set(savedCatsArray);
      const savedSubsArray = Array.isArray(st.subs) ? st.subs : null;
      const subsToUse = savedSubsArray && savedSubsArray.length ? savedSubsArray : allSubcategoryKeys;
      const openCats = Array.isArray(st.openCats) ? new Set(st.openCats) : null;
      selection.cats = new Set();
      selection.subs = new Set(subsToUse);
      const controllers = Object.values(categoryControllers);
      if(controllers.length){
        controllers.forEach(ctrl=>{
          const active = savedCats.has(ctrl.name);
          ctrl.setActive(active, {silent:true});
          const shouldOpen = active && (openCats ? openCats.has(ctrl.name) : false);
          ctrl.setOpen(shouldOpen);
          ctrl.syncSubs();
        });
      } else {
        selection.cats = new Set(savedCatsArray);
      }
      if(map && st.bounds){
        stopSpin();
        const bounds = new mapboxgl.LngLatBounds(st.bounds);
        map.fitBounds(bounds, {padding:10});
        postPanel = bounds;
      }
      applyFilters();
      updateClearButtons();
      updateCategoryResetBtn();
    }
    function renderHistoryBoard(){
      if(!recentsBoard) return;
      recentsBoard.innerHTML='';
      const validHistory = viewHistory.filter(v => getPostByIdAnywhere(v.id));
      viewHistory = validHistory;
      saveHistory();
      const items = viewHistory.slice(0,100);
      for(const v of items){
        const p = getPostByIdAnywhere(v.id);
        if(!p) continue;
        if(!v.lastOpened) v.lastOpened = Date.now();
        const labelEl = document.createElement('div');
        labelEl.className = 'last-opened-label';
        labelEl.textContent = formatLastOpened(v.lastOpened);
        recentsBoard.appendChild(labelEl);
        const el = card(p);
        recentsBoard.appendChild(el);
      }
      const reminderWrap = document.createElement('div');
      reminderWrap.className = 'recents-board-reminder';
      const reminderImg = document.createElement('img');
      reminderImg.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
      reminderImg.alt = 'Cute little monkey in red cape pointing up';
      reminderWrap.appendChild(reminderImg);
      const reminderMsg = document.createElement('p');
      reminderMsg.textContent = 'When you log in as a member, I can remember your recent posts and favourites on any device.';
      reminderWrap.appendChild(reminderMsg);
      recentsBoard.appendChild(reminderWrap);
    }

    renderHistoryBoard();

function openPostModal(id){
      const p = getPostByIdAnywhere(id);
      if(!p) return;
      activePostId = id;
      updateSelectedMarkerRing();
      const container = document.getElementById('post-modal-container');
      if(!container) return;
      const modal = container.querySelector('.post-modal');
      modal.innerHTML='';
      const wrap = document.createElement('div');
      wrap.className = 'post-board';
      const detail = buildDetail(p);
      const headerEl = detail.querySelector('.post-header');
      const favBtn = headerEl && headerEl.querySelector('.fav');
      if(headerEl && favBtn){
        const closeBtn = document.createElement('button');
        closeBtn.type='button';
        closeBtn.className='close-post';
        closeBtn.setAttribute('aria-label','Close post');
        closeBtn.textContent='✖';
        closeBtn.style.marginLeft='10px';
        favBtn.after(closeBtn);
        closeBtn.addEventListener('click', e=>{ e.stopPropagation(); closePostModal(); });
      }
      wrap.appendChild(detail);
      modal.appendChild(wrap);
      hookDetailActions(detail, p);
      container.classList.remove('hidden');
      if(!panelStack.includes(container)) panelStack.push(container);
      bringToTop(container);
      requestAnimationFrame(()=>{
        const imgArea = detail.querySelector('.post-images');
        const text = detail.querySelector('.post-details');
        if(headerEl){
          headerEl.style.position='sticky';
          headerEl.style.top='0';
          headerEl.style.zIndex='2';
        }
        if(imgArea && text && text.offsetTop === imgArea.offsetTop){
          imgArea.style.position='sticky';
          imgArea.style.top = headerEl ? headerEl.offsetHeight + 'px' : '0';
        }
      });
      viewHistory = viewHistory.filter(x=>x.id!==id);
      viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
      if(viewHistory.length>100) viewHistory.length=100;
      saveHistory(); renderHistoryBoard();
      location.hash = `/post/${p.slug}-${p.created}`;
    }

    function closePostModal(){
      const container = document.getElementById('post-modal-container');
      if(!container) return;
      container.classList.add('hidden');
      const idx = panelStack.indexOf(container);
      if(idx!==-1) panelStack.splice(idx,1);
      const modal = container.querySelector('.post-modal');
      if(modal) modal.innerHTML='';
      location.hash = '';
    }
    window.closePostModal = closePostModal;

    function handleHash(){
      if(!location.hash){
        closePostModal();
        return;
      }
      const m = location.hash.match(/\/post\/([^\/]+)-([^\/]+)$/);
      if(!m) return;
      const slug = decodeURIComponent(m[1]);
      const created = m[2];
      const matchPost = (list) => {
        if(!Array.isArray(list) || !list.length) return null;
        return list.find(x => x && x.slug === slug && x.created === created) || null;
      };
      let post = matchPost(posts);
      if(!post){
        const cache = getAllPostsCache({ allowInitialize: true });
        post = matchPost(cache);
      }
      if(post){ openPostModal(post.id); }
    }

    window.addEventListener('hashchange', handleHash);

    window.addEventListener('resize', ()=>{});

    document.addEventListener('DOMContentLoaded', ()=>{
      const container = document.getElementById('post-modal-container');
      if(container){
        container.addEventListener('click', e=>{ if(e.target===container) closePostModal(); });
      }
      handleHash();
    });

    document.addEventListener('click', (ev)=>{
      const card = ev.target.closest('.mapboxgl-popup.big-map-card .big-map-card');
      if(card){
        ev.preventDefault();
        const pid = card.getAttribute('data-id') || (card.closest('.map-card-list-item') && card.closest('.map-card-list-item').getAttribute('data-id'));
        if(pid){
          callWhenDefined('openPost', (fn)=>{
            requestAnimationFrame(() => {
              try{
                touchMarker = null;
                stopSpin();
                if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                  try{ closePanel(filterPanel); }catch(err){}
                }
                fn(pid, false, true);
              }catch(err){ console.error(err); }
            });
          });
        }
      }
    }, { capture:true });

    function hookDetailActions(el, p){
      el.querySelectorAll('.post-header').forEach(headerEl => {
        headerEl.addEventListener('click', evt=>{
          if(evt.target.closest('button')) return;
          evt.stopPropagation();
          closeActivePost();
        });
      });
      el.querySelectorAll('.fav').forEach(favBtn => {
        favBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          p.fav = !p.fav;
          favSortDirty = true;
          document.querySelectorAll(`[data-id="${p.id}"] .fav`).forEach(btn=>{
            btn.setAttribute('aria-pressed', p.fav ? 'true' : 'false');
          });
          const detailEl = el;
          renderHistoryBoard();
          const replacement = postsWideEl.querySelector(`[data-id="${p.id}"]`);
          if(replacement){
            replacement.replaceWith(detailEl);
          }
        });
      });

      el.querySelectorAll('.share').forEach(shareBtn => {
        shareBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const url = postUrl(p);
          navigator.clipboard.writeText(url).then(()=>{ showCopyMsg(shareBtn); });
        });
      });

      const descEl = el.querySelector('.post-details .desc');
      if(descEl){
        const toggleDesc = evt => {
          const allowed = ['Enter', ' ', 'Spacebar', 'Space'];
          if(evt.type === 'keydown' && !allowed.includes(evt.key)){
            return;
          }
          evt.preventDefault();
          const expanded = !descEl.classList.contains('expanded');
          descEl.classList.toggle('expanded', expanded);
          descEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          const openPostEl = el;
          if(openPostEl){
            openPostEl.classList.toggle('desc-expanded', expanded);
          }
          if(expanded){
            document.body.classList.remove('open-post-sticky-images');
          } else if(typeof updateStickyImages === 'function'){
            updateStickyImages();
          }
        };
        descEl.addEventListener('click', toggleDesc);
        descEl.addEventListener('keydown', toggleDesc);
      }

      const imgs = p.images && p.images.length ? p.images : [heroUrl(p)];
      const thumbCol = el.querySelector('.thumbnail-row');
      const imageBox = el.querySelector('.image-box');
      const imageTrack = imageBox ? imageBox.querySelector('.image-track') : null;
      const baseImg = imageTrack ? imageTrack.querySelector('img') : null;
      const slides = [];
      if(imageBox){
        imageBox._modalImages = imgs.slice();
        try {
          imageBox.dataset.modalImages = JSON.stringify(imgs);
        } catch(err) {
          imageBox.dataset.modalImages = '';
        }
        if(typeof imageBox.dataset.index === 'undefined'){
          imageBox.dataset.index = '0';
        }
      }
      if(baseImg){
        baseImg.dataset.index = '0';
        baseImg.dataset.full = imgs[0];
        if(!baseImg.classList.contains('ready')){
          baseImg.classList.add('lqip');
        }
        slides[0] = baseImg;
      }
      if(imageTrack){
        imageTrack.style.transform = 'translateX(0)';
      }
      for(let i=1;i<imgs.length;i++){
        if(!imageTrack) break;
        const slide = document.createElement('img');
        slide.dataset.index = i;
        slide.dataset.full = imgs[i];
        slide.alt = '';
        slide.decoding = 'async';
        slide.loading = 'lazy';
        slide.classList.add('lqip');
        slide.src = imgs[i];
        imageTrack.appendChild(slide);
        slides[i] = slide;
      }
      if(thumbCol){
        imgs.forEach((url,i)=>{
          const t = document.createElement('img');
          t.src = url;
          t.dataset.full = url;
          t.dataset.index = i;
          t.tabIndex = 0;
          thumbCol.appendChild(t);
        });
      }
      const clampIdx = idx => Math.min(Math.max(idx, 0), imgs.length - 1);
      let currentIdx = 0;
      const ensureSlide = idx => {
        if(!imageTrack) return null;
        if(!slides[idx]){
          const slide = document.createElement('img');
          slide.dataset.index = idx;
          slide.dataset.full = imgs[idx];
          slide.alt = '';
          slide.decoding = 'async';
          slide.loading = 'lazy';
          slide.classList.add('lqip');
          slide.src = imgs[idx];
          imageTrack.appendChild(slide);
          slides[idx] = slide;
        }
        return slides[idx];
      };
      const scrollThumbIntoView = target => {
        if(!thumbCol || !target) return;
        const rowRect = thumbCol.getBoundingClientRect();
        const tRect = target.getBoundingClientRect();
        if(tRect.left < rowRect.left){
          thumbCol.scrollBy({left: tRect.left - rowRect.left - 8, behavior:'smooth'});
        } else if(tRect.right > rowRect.right){
          thumbCol.scrollBy({left: tRect.right - rowRect.right + 8, behavior:'smooth'});
        }
      };
      const moveTo = (idx, {instant=false}={})=>{
        if(!imageTrack) return;
        if(instant){
          imageTrack.style.transition = 'none';
        }
        const apply = ()=>{ imageTrack.style.transform = `translateX(-${idx * 100}%)`; };
        if(instant){
          apply();
          requestAnimationFrame(()=>{ imageTrack.style.transition = ''; });
        } else {
          apply();
        }
      };
      function show(idx, {instant=false}={}){
        idx = clampIdx(idx);
        const t = thumbCol ? thumbCol.querySelector(`img[data-index="${idx}"]`) : null;
        const slide = ensureSlide(idx);
        if(!slide) return;
        const prevIdx = currentIdx;
        const alreadyReady = slide.classList.contains('ready');
        currentIdx = idx;
        if(prevIdx !== idx || instant){
          moveTo(idx, {instant});
        }
        if(imageBox){
          imageBox.dataset.index = idx;
        }
        if(slides.length){
          slides.forEach((img,i)=>{
            if(img){
              img.classList.toggle('active', i===idx);
            }
          });
        }
        if(t && thumbCol){
          thumbCol.querySelectorAll('img').forEach(im=> im.classList.toggle('selected', im===t));
          scrollThumbIntoView(t);
        }
        if(t && slide.src !== t.src){
          slide.src = t.src;
        }
        const full = (t && (t.dataset.full || t.src)) || slide.dataset.full || slide.src;
        if(!slide.dataset.full){
          slide.dataset.full = full;
        }
        if(!alreadyReady || slide.src !== full){
          slide.classList.remove('ready');
          slide.classList.add('lqip');
          const hi = new Image();
          hi.onload = ()=>{
            const swap = ()=>{
              if(slide.dataset.full !== full){ slide.dataset.full = full; }
              slide.src = full;
              slide.classList.remove('lqip');
              slide.classList.add('ready');
            };
            if(hi.decode){ hi.decode().then(swap).catch(swap); } else { swap(); }
          };
          hi.onerror = ()=>{};
          hi.src = full;
        }
      }
      show(0, {instant:true});
      if(thumbCol){
        thumbCol.scrollLeft = 0;
        setupHorizontalWheel(thumbCol);
        thumbCol.addEventListener('click', e=>{
          const t = e.target.closest('img');
          if(!t) return;
          const idx = clampIdx(parseInt(t.dataset.index,10));
          if(currentIdx === idx && t.classList.contains('selected')){
            const fullSrc = t.dataset.full || t.src;
            openImageModal(fullSrc, {images: imgs, startIndex: idx, origin: t});
          } else {
            show(idx);
          }
        });
        thumbCol.addEventListener('keydown', e=>{
          if(e.key==='ArrowDown'){
            e.preventDefault();
            const ni = clampIdx(currentIdx + 1);
            show(ni);
            const nextThumb = thumbCol.querySelector(`img[data-index="${ni}"]`);
            if(nextThumb) nextThumb.focus();
          } else if(e.key==='ArrowUp'){
            e.preventDefault();
            const ni = clampIdx(currentIdx - 1);
            show(ni);
            const prevThumb = thumbCol.querySelector(`img[data-index="${ni}"]`);
            if(prevThumb) prevThumb.focus();
          }
        });
      }
      if(imageBox){
        let dragStartX = null;
        let dragStartY = null;
        let dragActive = false;
        let lastDragTime = 0;
        const resetDragState = ()=>{
          dragStartX = null;
          dragStartY = null;
          dragActive = false;
          if(imageTrack){
            imageTrack.style.transition = '';
          }
        };
        imageBox.addEventListener('click', e=>{
          if(Date.now() - lastDragTime < 400){
            e.preventDefault();
            return;
          }
          const imgTarget = e.target.closest('.image-track img');
          if(!imgTarget) return;
          e.stopPropagation();
          const currentSlide = ensureSlide(currentIdx) || slides[currentIdx] || imgTarget;
          const fullSrc = currentSlide ? (currentSlide.dataset.full || currentSlide.src) : imgs[currentIdx];
          openImageModal(fullSrc, {images: imgs, startIndex: currentIdx, origin: imgTarget});
        });
        imageBox.addEventListener('touchstart', e=>{
          if(e.touches.length !== 1) return;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          dragActive = false;
        });
        imageBox.addEventListener('touchmove', e=>{
          if(dragStartX===null || !imageTrack) return;
          const touch = e.touches[0];
          const deltaX = touch.clientX - dragStartX;
          const deltaY = touch.clientY - dragStartY;
          if(!dragActive){
            if(Math.abs(deltaX) < 5) return;
            if(Math.abs(deltaY) > Math.abs(deltaX)){
              resetDragState();
              return;
            }
            dragActive = true;
            imageTrack.style.transition = 'none';
          }
          const width = imageBox.clientWidth || 1;
          let adjustedDelta = deltaX;
          if((currentIdx === 0 && adjustedDelta > 0) || (currentIdx === imgs.length-1 && adjustedDelta < 0)){
            adjustedDelta = 0;
          }
          const deltaPercent = (adjustedDelta / width) * 100;
          const basePercent = -currentIdx * 100;
          imageTrack.style.transform = `translateX(${basePercent + deltaPercent}%)`;
          e.preventDefault();
        }, {passive:false});
        imageBox.addEventListener('touchend', e=>{
          if(dragStartX===null){
            resetDragState();
            return;
          }
          const deltaX = e.changedTouches[0].clientX - dragStartX;
          if(imageTrack){
            imageTrack.style.transition = '';
          }
          if(dragActive){
            const prevIdx = currentIdx;
            let targetIdx = prevIdx;
            const threshold = (imageBox.clientWidth || 1) * 0.15;
            if(deltaX <= -threshold && prevIdx < imgs.length - 1){
              targetIdx = prevIdx + 1;
            } else if(deltaX >= threshold && prevIdx > 0){
              targetIdx = prevIdx - 1;
            }
            lastDragTime = Date.now();
            requestAnimationFrame(()=> show(targetIdx));
          }
          resetDragState();
        });
        imageBox.addEventListener('touchcancel', ()=>{
          if(dragActive && imageTrack){
            imageTrack.style.transition = '';
            requestAnimationFrame(()=> show(currentIdx));
          }
          resetDragState();
        });
      }
      const venueDropdown = el.querySelector(`#venue-${p.id}`);
      const venueBtn = venueDropdown ? venueDropdown.querySelector('.venue-btn') : null;
      const venueMenu = venueDropdown ? venueDropdown.querySelector('.venue-menu') : null;
      const venueOptions = venueMenu ? venueMenu.querySelector('.venue-options') : null;
      let venueCloseTimer = null;
      const venueInfo = el.querySelector(`#venue-info-${p.id}`);
      const sessDropdown = el.querySelector(`#sess-${p.id}`);
      const sessBtn = sessDropdown ? sessDropdown.querySelector('.sess-btn') : null;
      const sessMenu = sessDropdown ? sessDropdown.querySelector('.session-menu') : null;
      const sessionOptions = sessMenu ? sessMenu.querySelector('.session-options') : null;
      const showMenu = menu => { if(menu) menu.removeAttribute('hidden'); };
      const hideMenu = menu => { if(menu) menu.setAttribute('hidden',''); };
      const isMenuOpen = menu => !!(menu && !menu.hasAttribute('hidden'));
      const sessionInfo = el.querySelector(`#session-info-${p.id}`);
      const calendarEl = el.querySelector(`#cal-${p.id}`);
      const mapEl = el.querySelector(`#map-${p.id}`);
      const calContainer = el.querySelector('.calendar-container');
      const calScroll = calContainer ? calContainer.querySelector('.calendar-scroll') : null;
      if(calScroll){
        setupCalendarScroll(calScroll);
      }
      let map, locationMarkers = [], sessionHasMultiple = false, lastClickedCell = null, resizeHandler = null, detailMapRef = null;
      let currentVenueIndex = 0;

      function updateDetailMarkerSelection(selectedIdx = currentVenueIndex){
        if(!Number.isInteger(selectedIdx)){
          selectedIdx = currentVenueIndex;
        }
        locationMarkers.forEach(({ element, index }) => {
          const isSelected = index === selectedIdx;
          element.classList.toggle('is-selected', isSelected);
          element.classList.toggle('is-dimmed', !isSelected);
          element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      }
      let sessionCloseTimer = null;
      let ensureMapForVenue = async ()=>{};
        function scheduleSessionMenuClose({waitForScroll=false, targetLeft=null}={}){
          if(!sessMenu) return;
          if(sessionCloseTimer){
            clearTimeout(sessionCloseTimer);
            sessionCloseTimer = null;
          }
          const begin = ()=>{
            requestAnimationFrame(()=>requestAnimationFrame(()=>{
              sessionCloseTimer = setTimeout(()=>{
                hideMenu(sessMenu);
                if(sessBtn) sessBtn.setAttribute('aria-expanded','false');
                sessionCloseTimer = null;
              }, 100);
            }));
          };
          if(waitForScroll && calScroll && targetLeft !== null){
            let attempts = 0;
            const maxAttempts = 60;
            const check = ()=>{
              const distance = Math.abs(calScroll.scrollLeft - targetLeft);
              if(distance <= 0.5 || attempts >= maxAttempts){
                begin();
              } else {
                attempts += 1;
                requestAnimationFrame(check);
              }
            };
            requestAnimationFrame(check);
          } else {
            begin();
          }
        }
        if(mapEl && mapEl._detailMap){
          detailMapRef = mapEl._detailMap;
          map = detailMapRef.map || map;
          resizeHandler = detailMapRef.resizeHandler || resizeHandler;
          if(!el._detailMap){
            el._detailMap = detailMapRef;
          }
        }
      function updateVenue(idx){
        const locations = Array.isArray(p.locations) ? p.locations : [];
        const hasLocations = locations.length > 0;
        let targetIndex = Number.isInteger(idx) ? idx : 0;
        if(hasLocations){
          targetIndex = Math.min(Math.max(targetIndex, 0), locations.length - 1);
        } else {
          targetIndex = 0;
        }
        currentVenueIndex = targetIndex;
        const loc = hasLocations ? locations[targetIndex] : null;

        if(venueOptions){
          const buttons = venueOptions.querySelectorAll('button');
          buttons.forEach((button, optionIndex) => {
            button.classList.toggle('selected', optionIndex === targetIndex);
          });
        }

        if(loc){
          setSelectedVenueHighlight(loc.lng, loc.lat);
        } else {
          setSelectedVenueHighlight();
        }

        updateDetailMarkerSelection(targetIndex);

        if(venueBtn){
          if(loc){
            venueBtn.innerHTML = `<span class="venue-name">${loc.venue}</span><span class="venue-address">${loc.address}</span>${p.locations.length>1?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
          } else {
            venueBtn.innerHTML = `<span class="venue-name">${p.city || ''}</span><span class="venue-address">${p.city || ''}</span>`;
          }
        }

        if(venueInfo){
          if(loc){
            venueInfo.innerHTML = `<strong>${loc.venue}</strong><br>${loc.address}`;
          } else {
            venueInfo.innerHTML = '';
          }
        }

        const hasDates = loc && Array.isArray(loc.dates) && loc.dates.length;
        if(!hasDates){
          sessionHasMultiple = false;
          if(sessionInfo){
            sessionInfo.innerHTML = '';
          }
          ensureMapForVenue();
          return;
        }

        loc.dates.sort((a,b)=> a.full.localeCompare(b.full) || a.time.localeCompare(b.time));

        const currentYear = new Date().getFullYear();
        const parseDate = s => {
          const [yy, mm, dd] = s.split('-').map(Number);
          return new Date(yy, mm - 1, dd);
        };
        const formatDate = d => {
          const y = parseDate(d.full).getFullYear();
          return y !== currentYear ? `${d.date}, ${y}` : d.date;
        };

        if(venueInfo){
          venueInfo.innerHTML = `<strong>${loc.venue}</strong><br>${loc.address}`;
        }
        if(venueBtn){
          venueBtn.innerHTML = `<span class="venue-name">${loc.venue}</span><span class="venue-address">${loc.address}</span>${p.locations.length>1?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
        }

        sessionHasMultiple = loc.dates.length > 1;
        let defaultInfoHTML = '';
        if(sessionInfo){
          const firstDate = loc.dates[0];
          const lastDate = loc.dates[loc.dates.length-1];
          const rangeText = `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
          defaultInfoHTML = `<div>💲 ${loc.price} | 📅 ${rangeText}<span style="display:inline-block;margin-left:10px;">(Select Session)</span></div>`;
          sessionInfo.innerHTML = defaultInfoHTML;
        }

        let cal = null;
        let selectedIndex = null;
        let allowedSet = new Set();
        let minDate = null;
        let maxDate = null;
        let months = [];
        let visibleDateEntries = [];

        function recomputeVisibleDateData(){
          const expiredToggle = document.getElementById('expiredToggle');
          const showExpired = !!(expiredToggle && expiredToggle.checked);
          const threshold = (()=>{
            const base = new Date();
            base.setHours(0,0,0,0);
            base.setDate(base.getDate() - 1);
            return base;
          })();
          visibleDateEntries = loc.dates
            .map((d,i)=>({d,i}))
            .filter(({d})=>{
              if(showExpired) return true;
              const parsed = parseDate(d.full);
              return parsed instanceof Date && !Number.isNaN(parsed.getTime()) && parsed >= threshold;
            });
          const uniqueStrings = Array.from(new Set(visibleDateEntries.map(({d})=> d.full)));
          allowedSet = new Set(uniqueStrings);
          minDate = uniqueStrings.length ? parseDate(uniqueStrings[0]) : null;
          maxDate = uniqueStrings.length ? parseDate(uniqueStrings[uniqueStrings.length-1]) : null;
          months = [];
          if(minDate && maxDate){
            const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const limit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
            while(cursor <= limit){
              months.push(new Date(cursor));
              cursor.setMonth(cursor.getMonth() + 1);
            }
          }
        }

        function markSelected(){
          if(!calendarEl) return;
          calendarEl.querySelectorAll('.day').forEach(d=> d.classList.remove('selected'));
          if(selectedIndex!==null){
            const dt = loc.dates[selectedIndex];
            const cell = calendarEl.querySelector(`.day[data-iso="${dt.full}"]`);
            if(cell) cell.classList.add('selected');
          }
        }

        function scrollCalendarToMonth(dt, {smooth=false}={}){
          if(!dt || !calendarEl || !calScroll) return null;
          const cell = calendarEl.querySelector(`.day[data-iso="${dt.full}"]`);
          if(!cell) return null;
          const monthEl = cell.closest('.month');
          if(!monthEl) return null;
          const currentLeft = calScroll.scrollLeft;
          let targetLeft = monthEl.offsetLeft;
          if(typeof monthEl.getBoundingClientRect === 'function' && typeof calScroll.getBoundingClientRect === 'function'){
            const monthRect = monthEl.getBoundingClientRect();
            const scrollRect = calScroll.getBoundingClientRect();
            const delta = monthRect.left - scrollRect.left;
            const adjusted = currentLeft + delta;
            if(Number.isFinite(adjusted)){
              targetLeft = adjusted;
            }
          }
          const maxLeft = Math.max(0, calScroll.scrollWidth - calScroll.clientWidth);
          targetLeft = Math.min(Math.max(targetLeft, 0), maxLeft);
          const distance = Math.abs(currentLeft - targetLeft);
          if(typeof calScroll.scrollTo === 'function'){
            if(smooth && distance > 1){
              calScroll.scrollTo({left: targetLeft, behavior: 'smooth'});
              return {targetLeft, waitForScroll: true};
            }
            calScroll.scrollTo({left: targetLeft});
          } else {
            calScroll.scrollLeft = targetLeft;
          }
          return {targetLeft, waitForScroll: false};
        }

        function selectSession(i){
          if(!sessMenu || !sessionOptions) return;
          selectedIndex = Number.isInteger(i) ? i : null;
          sessionOptions.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
          const btn = selectedIndex !== null ? sessionOptions.querySelector(`button[data-index="${selectedIndex}"]`) : null;
          if(btn) btn.classList.add('selected');
          const dt = selectedIndex !== null ? loc.dates[selectedIndex] : null;
          let waitForScroll = false;
          let targetScrollLeft = null;
          if(dt){
            if(sessionInfo){
              sessionInfo.innerHTML = `<div><strong>${formatDate(dt)} ${dt.time}</strong></div><div>Adults $20, Kids $10, Pensioners $15</div><div>🎫 Buy at venue | ♿ Accessible | 👶 Kid-friendly</div>`;
            }
            if(sessBtn){
              sessBtn.innerHTML = `<span class="session-date">${formatDate(dt)}</span><span class="session-time">${dt.time}</span>${sessionHasMultiple?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
            }
            markSelected();
            const scrollResult = scrollCalendarToMonth(dt, {smooth: true});
            if(scrollResult){
              targetScrollLeft = scrollResult.targetLeft;
              waitForScroll = scrollResult.waitForScroll;
            }
          } else {
            if(sessionInfo){
              sessionInfo.innerHTML = defaultInfoHTML;
            }
            if(sessBtn){
              sessBtn.innerHTML = sessionHasMultiple ? 'Select Session<span class="results-arrow" aria-hidden="true"></span>' : 'Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
            markSelected();
          }
          if(isMenuOpen(sessMenu)){
            scheduleSessionMenuClose({waitForScroll, targetLeft: targetScrollLeft});
          } else if(sessBtn){
            sessBtn.setAttribute('aria-expanded','false');
          }
        }

        function showTimePopup(matches){
          if(!calContainer) return;
          const existing = calContainer.querySelector('.time-popup');
          if(existing) existing.remove();
          const popup = document.createElement('div');
          popup.className = 'time-popup';
          popup.innerHTML = `<div class="time-list">${matches.map(m=>`<button data-index="${m.i}">${m.d.time}</button>`).join('')}</div>`;
          calContainer.appendChild(popup);
          if(lastClickedCell){
            const rect = lastClickedCell.getBoundingClientRect();
            const containerRect = calContainer.getBoundingClientRect();
            popup.style.left = (rect.left - containerRect.left) + 'px';
            popup.style.top = (rect.bottom - containerRect.top + 4) + 'px';
          }
          popup.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=>{ selectSession(parseInt(b.dataset.index,10)); popup.remove(); }));
          setTimeout(()=> document.addEventListener('click', function handler(e){ if(!popup.contains(e.target)){ popup.remove(); document.removeEventListener('click', handler); } }),0);
        }

        function renderMonth(monthDate){
          if(!cal) return;
          const monthEl = document.createElement('div');
          monthEl.className='month';
          const header = document.createElement('div');
          header.className='calendar-header';
          header.textContent = monthDate.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
          monthEl.appendChild(header);
          const grid = document.createElement('div');
          grid.className='grid';
          ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(wd=>{
            const w=document.createElement('div');
            w.className='weekday';
            w.textContent=wd;
            grid.appendChild(w);
          });
          const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(),1);
          const startDow = firstDay.getDay();
          const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1,0).getDate();
          const totalCells = 42;
          for(let i=0;i<totalCells;i++){
            const cell=document.createElement('div');
            cell.className='day';
            const dayNum=i-startDow+1;
            if(i<startDow || dayNum>daysInMonth){
              cell.classList.add('empty');
            }else{
              cell.textContent=dayNum;
              const dateObj=new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum);
              const iso=toISODate(dateObj);
              cell.dataset.iso = iso;
              if(allowedSet.has(iso)){
                cell.classList.add('available-day');
                cell.addEventListener('mousedown',()=>{ lastClickedCell = cell; });
                cell.addEventListener('click',()=>{
                  const matches = loc.dates.map((dd,i)=>({i,d:dd})).filter(o=> o.d.full===iso);
                  if(matches.length===1){ selectSession(matches[0].i); }
                  else if(matches.length>1){ showTimePopup(matches); }
                });
              } else {
                cell.classList.add('empty');
              }
              if(isToday(dateObj)) cell.classList.add('today');
            }
            grid.appendChild(cell);
          }
          monthEl.appendChild(grid);
          cal.appendChild(monthEl);
        }

        function buildCalendarShell(){
          if(!calendarEl) return;
          calendarEl.innerHTML='';
          cal = document.createElement('div');
          cal.className='calendar';
          calendarEl.appendChild(cal);
          if(!calendarEl._calendarClickStopper){
            calendarEl.addEventListener('click', e=> e.stopPropagation());
            calendarEl._calendarClickStopper = true;
          }
        }

        function finalizeCalendar(){
          markSelected();
        }

        function renderCalendar(){
          if(!calendarEl) return;
          buildCalendarShell();
          months.forEach(monthDate => renderMonth(monthDate));
          finalizeCalendar();
        }

        function updateSessionOptionsList(){
          recomputeVisibleDateData();
          if(calendarEl){
            renderCalendar();
          }

          const visibleDates = visibleDateEntries;

          if(sessionOptions){
            sessionOptions.innerHTML = visibleDates
              .map(({d,i})=> `<button data-index="${i}"><span class="session-date">${formatDate(d)}</span><span class="session-time">${d.time}</span></button>`)
              .join('');
          }

          if(sessMenu){
            sessMenu.scrollTop = 0;
          }

          const hasVisible = visibleDates.length > 0;
          sessionHasMultiple = visibleDates.length > 1;

          const selectedIsVisible = visibleDates.some(({i})=> i === selectedIndex);
          if(!selectedIsVisible){
            selectedIndex = null;
          }

          if(sessionHasMultiple){
            selectedIndex = null;
            markSelected();
            if(sessionInfo) sessionInfo.innerHTML = defaultInfoHTML;
            if(sessBtn){
              sessBtn.innerHTML = 'Select Session<span class="results-arrow" aria-hidden="true"></span>';
              sessBtn.setAttribute('aria-expanded','false');
            }
          } else if(hasVisible){
            selectSession(visibleDates[0].i);
          } else {
            selectedIndex = null;
            markSelected();
            if(sessionInfo) sessionInfo.innerHTML = defaultInfoHTML;
            if(sessBtn){
              sessBtn.textContent = 'Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
          }

          if(sessionOptions){
            sessionOptions.querySelectorAll('button').forEach(btn=>{
              btn.addEventListener('click', ()=> selectSession(parseInt(btn.dataset.index,10)));
            });
          }

          setTimeout(()=>{
            if(map && typeof map.resize === 'function') map.resize();
          },0);
        }

        function attachSessionButtonHandler(){
          if(!sessBtn || !sessMenu) return;
          const handler = ()=>{
            const expanded = sessBtn.getAttribute('aria-expanded') === 'true';
            const opening = !expanded;
            sessBtn.setAttribute('aria-expanded', String(opening));
            if(opening){
              showMenu(sessMenu);
              if(selectedIndex !== null){
                const dt = loc.dates[selectedIndex];
                if(dt){
                  requestAnimationFrame(()=> scrollCalendarToMonth(dt));
                }
              }
            } else {
              hideMenu(sessMenu);
            }
          };
          if(sessBtn._sessionToggle){
            sessBtn.removeEventListener('click', sessBtn._sessionToggle);
          }
          sessBtn._sessionToggle = handler;
          sessBtn.addEventListener('click', handler);
        }

        ensureMapForVenue = async function(){
          if(!mapEl) return;

          const allLocations = Array.isArray(p.locations) ? p.locations.filter(item => item && Number.isFinite(item.lng) && Number.isFinite(item.lat)) : [];
          if(!allLocations.length){
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            return;
          }

          const selectedIdx = Math.min(Math.max(currentVenueIndex, 0), allLocations.length - 1);
          const selectedLoc = allLocations[selectedIdx];
          const center = [selectedLoc.lng, selectedLoc.lat];
          const subId = subcategoryMarkerIds[p.subcategory] || slugify(p.subcategory);
          const markerUrl = subcategoryMarkers[subId];

          const assignDetailRef = ()=>{
            detailMapRef = detailMapRef || {};
            detailMapRef.map = map;
            detailMapRef.resizeHandler = resizeHandler;
            if(mapEl){
              mapEl._detailMap = detailMapRef;
              mapEl.__map = map;
            }
            if(el){
              el._detailMap = detailMapRef;
            }
            if(map){
              MapRegistry.register(map);
            }
          };

          const refreshMarkers = () => {
            if(!map) return;
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            allLocations.forEach((location, idx) => {
              if(!Number.isFinite(location.lng) || !Number.isFinite(location.lat)){
                return;
              }
              let element;
              if(markerUrl){
                element = new Image();
                element.src = markerUrl;
                element.alt = '';
                element.decoding = 'async';
              } else {
                element = document.createElement('div');
                element.style.background = '#0f172a';
              }
              element.classList.add('post-location-marker');
              element.dataset.index = String(idx);
              element.tabIndex = 0;
              element.setAttribute('role', 'button');
              element.setAttribute('aria-pressed', 'false');
              element.setAttribute('aria-label', `${location.venue} (${location.address})`);
              element.addEventListener('click', () => {
                if(idx === currentVenueIndex) return;
                updateVenue(idx);
              });
              element.addEventListener('keydown', evt => {
                if(evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar'){
                  evt.preventDefault();
                  element.click();
                }
              });
              const markerInstance = new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([location.lng, location.lat]).addTo(map);
              locationMarkers.push({ marker: markerInstance, element, index: idx });
            });
            updateDetailMarkerSelection(selectedIdx);
          };

          const fitToLocations = () => {
            if(!map || !allLocations.length){
              return;
            }
            const validPoints = allLocations.filter(location => Number.isFinite(location.lng) && Number.isFinite(location.lat));
            if(!validPoints.length){
              return;
            }
            if(validPoints.length === 1){
              try{
                map.setCenter([validPoints[0].lng, validPoints[0].lat]);
                map.setZoom(10);
              }catch(e){}
              return;
            }
            try{
              const bounds = validPoints.reduce((acc, location) => {
                if(acc){
                  acc.extend([location.lng, location.lat]);
                  return acc;
                }
                return new mapboxgl.LngLatBounds([location.lng, location.lat], [location.lng, location.lat]);
              }, null);
              if(bounds){
                map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 10 });
              }
            }catch(e){}
          };

          if(!map){
            setTimeout(async () => {
              if(map) {
                refreshMarkers();
                fitToLocations();
                return;
              }

              await ensureMapboxCssFor(mapEl);

              if (mapEl && mapEl.__map && typeof mapEl.__map.remove === 'function') {
                try { mapEl.__map.remove(); } catch {}
                mapEl.__map = null;
              }
              locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
              locationMarkers = [];

              map = new mapboxgl.Map({
                container: mapEl,
                style: mapStyle,
                center,
                zoom: 3,
                interactive: false
              });

              attachIconLoader(map);

              map.on('mousemove', (e) => {
                const has = !!(e.features && e.features.length);
                map.getCanvas().style.cursor = has ? 'pointer' : '';
              });

              armPointerOnSymbolLayers(map);

              const applyDetailStyleAdjustments = () => {
                applyNightSky(map);
                patchMapboxStyleArtifacts(map);
              };
              whenStyleReady(map, applyDetailStyleAdjustments);
              map.on('style.load', applyDetailStyleAdjustments);
              map.on('styledata', () => {
                if(map.isStyleLoaded && map.isStyleLoaded()){
                  patchMapboxStyleArtifacts(map);
                }
              });

              map.on('styleimagemissing', (e) => {
                if (map.hasImage(e.id)) return;

                const base = document.baseURI || window.location.href;
                const candidates = [
                  `assets/icons/subcategories/${e.id}.png`,
                  `assets/icons/${e.id}.png`,
                  `assets/images/icons/${e.id}.png`,
                  `assets/icons-30/${e.id}-30.webp`,
                  `assets/icons/multi-category-icon-blue.png`,
                  `assets/images/icons/multi-category-icon-blue.png`
                ].map(p => new URL(p, base).href);

                (function tryNext(i){
                  if (i >= candidates.length) return;
                  map.loadImage(candidates[i], (err, img) => {
                    if (err || !img) { tryNext(i+1); return; }
                    try { map.addImage(e.id, img, { sdf: true }); } catch {}
                  });
                })(0);
              });

              if(resizeHandler){
                window.removeEventListener('resize', resizeHandler);
              }
              resizeHandler = ()=>{ if(map) map.resize(); };
              window.addEventListener('resize', resizeHandler);

              const ready = () => {
                refreshMarkers();
                fitToLocations();
              };
              if(map.loaded()){
                ready();
              } else {
                map.once('load', ready);
              }

              assignDetailRef();

              setTimeout(()=>{ if(map && typeof map.resize === 'function') map.resize(); },0);
            }, 0);
          } else {
            refreshMarkers();
            fitToLocations();
            setTimeout(()=> map && map.resize(),0);
            assignDetailRef();
          }
        };
        window.ensureMapForVenue = ensureMapForVenue;

        const expiredToggle = document.getElementById('expiredToggle');
        if(expiredToggle){
          const handler = ()=> updateSessionOptionsList();
          if(expiredToggle._detailExpiredHandler){
            expiredToggle.removeEventListener('change', expiredToggle._detailExpiredHandler);
          }
          expiredToggle._detailExpiredHandler = handler;
          expiredToggle.addEventListener('change', handler);
        }

        const tasks = [];
        if(mapEl){
          tasks.push(()=> {
            const ensure = typeof window.callWhenDefined === 'function'
              ? window.callWhenDefined
              : function(name, cb, timeoutMs){
                  const start = performance.now(), max = timeoutMs ?? 5000;
                  (function check(){
                    const fn = window[name];
                    if (typeof fn === 'function') { try { cb(fn); } catch(e){} return; }
                    if (performance.now() - start < max) requestAnimationFrame(check);
                  })();
                };
            ensure('ensureMapForVenue', fn => fn());
          });
        }
        tasks.push(()=> updateSessionOptionsList());
        tasks.push(()=> attachSessionButtonHandler());

        function runNext(){
          const task = tasks.shift();
          if(!task) return;
          const start = performance.now();
          try{ task(); }catch(err){}
          if(performance.now() - start > 6){
            setTimeout(runNext, 0);
          } else {
            runNext();
          }
        }
        runNext();
      }

      window.updateVenue = updateVenue;
      window.ensureMapForVenue = ensureMapForVenue;
      if(typeof window.__wrapForInputYield === 'function'){
        window.__wrapForInputYield('updateVenue');
        window.__wrapForInputYield('ensureMapForVenue');
      }

        if(mapEl){
          setTimeout(()=>{
            loadMapbox().then(()=>{
              updateVenue(0);
              if(venueMenu && venueBtn && venueOptions){
                venueOptions.querySelectorAll('button').forEach(btn=>{
                  if(btn.dataset.index==='0') btn.classList.add('selected');
                  btn.addEventListener('click', ()=>{
                    const targetIndex = parseInt(btn.dataset.index, 10);
                    if(Number.isInteger(targetIndex) && targetIndex === currentVenueIndex){
                      if(venueCloseTimer){
                        clearTimeout(venueCloseTimer);
                      }
                      venueCloseTimer = setTimeout(()=>{
                        hideMenu(venueMenu);
                        venueBtn.setAttribute('aria-expanded','false');
                        venueCloseTimer = null;
                      }, 100);
                      return;
                    }
                    venueOptions.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
                    btn.classList.add('selected');
                    updateVenue(targetIndex);
                    if(venueCloseTimer){
                      clearTimeout(venueCloseTimer);
                    }
                    venueCloseTimer = setTimeout(()=>{
                      hideMenu(venueMenu);
                      venueBtn.setAttribute('aria-expanded','false');
                      venueCloseTimer = null;
                    }, 100);
                  });
                });
                venueBtn.addEventListener('click', ()=>{
                  const expanded = venueBtn.getAttribute('aria-expanded') === 'true';
                  const opening = !expanded;
                  venueBtn.setAttribute('aria-expanded', String(opening));
                  if(opening){
                    showMenu(venueMenu);
                  } else {
                    hideMenu(venueMenu);
                  }
                  if(opening){
                    const adjustMap = ()=>{
                      if(map && typeof map.resize === 'function') map.resize();
                      if(typeof ensureMapForVenue === 'function') ensureMapForVenue();
                    };
                    if(typeof requestAnimationFrame === 'function'){
                      requestAnimationFrame(adjustMap);
                    } else {
                      setTimeout(adjustMap, 0);
                    }
                  }
                });
                document.addEventListener('click', e=>{ if(venueDropdown && !venueDropdown.contains(e.target)){ hideMenu(venueMenu); venueBtn.setAttribute('aria-expanded','false'); } });
              }
              if(sessBtn && sessMenu){
                if(!sessDropdown._sessionOutsideHandler){
                  const outsideHandler = e=>{
                    if(sessDropdown && !sessDropdown.contains(e.target)){
                      hideMenu(sessMenu);
                      sessBtn.setAttribute('aria-expanded','false');
                    }
                  };
                  sessDropdown._sessionOutsideHandler = outsideHandler;
                  document.addEventListener('click', outsideHandler);
                }
              }
              if(map && typeof map.resize === 'function') map.resize();
            }).catch(err => console.error(err));
          },0);
        }
    }

    function inBounds(p){
      if(!postPanel) return true;
      return p.lng >= postPanel.getWest() && p.lng <= postPanel.getEast() &&
             p.lat >= postPanel.getSouth() && p.lat <= postPanel.getNorth();
    }
    function kwMatch(p){ const kw = $('#keyword-textbox').value.trim().toLowerCase(); if(!kw) return true; return (p.title+' '+p.city+' '+p.category+' '+p.subcategory).toLowerCase().includes(kw); }
    function getPriceFilterValues(){
      const minInput = $('#min-price-input');
      const maxInput = $('#max-price-input');
      const rawMin = minInput ? minInput.value.trim() : '';
      const rawMax = maxInput ? maxInput.value.trim() : '';
      let min = rawMin === '' ? null : Number(rawMin);
      let max = rawMax === '' ? null : Number(rawMax);
      if(min !== null && !Number.isFinite(min)) min = null;
      if(max !== null && !Number.isFinite(max)) max = null;
      if(min !== null && max !== null && min > max){ const swap = min; min = max; max = swap; }
      return {min, max};
    }
    function parsePriceRange(value){
      if(typeof value !== 'string') return {min:null, max:null};
      const matches = value.match(/\d+(?:\.\d+)?/g);
      if(!matches || !matches.length) return {min:null, max:null};
      const nums = matches.map(Number).filter(n => Number.isFinite(n));
      if(!nums.length) return {min:null, max:null};
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return {min, max};
    }
    function priceMatch(p){
      const {min, max} = getPriceFilterValues();
      if(min === null && max === null) return true;
      const ranges = [];
      const addRange = value => {
        const parsed = parsePriceRange(value);
        if(!parsed) return;
        const hasMin = parsed.min !== null;
        const hasMax = parsed.max !== null;
        if(!hasMin && !hasMax) return;
        const normalizedMin = hasMin ? parsed.min : parsed.max;
        const normalizedMax = hasMax ? parsed.max : parsed.min;
        if(normalizedMin === null && normalizedMax === null) return;
        ranges.push({
          min: normalizedMin,
          max: normalizedMax
        });
      };
      addRange(p && p.price);
      if(p && Array.isArray(p.locations)){
        p.locations.forEach(loc => {
          if(loc) addRange(loc.price);
        });
      }
      if(!ranges.length) return false;
      const aggregatedMin = ranges.reduce((acc, range) => {
        const candidate = range.min !== null ? range.min : range.max;
        if(candidate === null) return acc;
        return acc === null ? candidate : Math.min(acc, candidate);
      }, null);
      const aggregatedMax = ranges.reduce((acc, range) => {
        const candidate = range.max !== null ? range.max : range.min;
        if(candidate === null) return acc;
        return acc === null ? candidate : Math.max(acc, candidate);
      }, null);
      if(min !== null && aggregatedMax !== null && aggregatedMax < min) return false;
      if(max !== null && aggregatedMin !== null && aggregatedMin > max) return false;
      const satisfiesBounds = ranges.some(range => {
        if(min !== null && range.max !== null && range.max < min) return false;
        if(max !== null && range.min !== null && range.min > max) return false;
        return true;
      });
      if(!satisfiesBounds) return false;
      return true;
    }
    function dateMatch(p){
      const {start,end} = orderedRange();
      const expiredChk = $('#expiredToggle');
      if(!start && !end){
        if(expiredChk && expiredChk.checked){
          return true;
        }
        const today = new Date(); today.setHours(0,0,0,0);
        return p.dates.some(d => parseISODate(d) >= today);
      }
      return p.dates.some(d => {
        const dt = parseISODate(d);
        if(start && dt < start) return false;
        if(end && dt > end) return false;
        return true;
      });
    }
    function catMatch(p){
      const haveCategoryControllers = Object.keys(categoryControllers).length > 0;
      if(!haveCategoryControllers){
        return true;
      }
      if(selection.cats.size===0){
        return false;
      }
      const cOk = selection.cats.has(p.category);
      if(!cOk) return false;
      if(selection.subs.size===0){
        return false;
      }
      return selection.subs.has(p.category+'::'+p.subcategory);
    }

    function hideResultIndicators(){
      const resultCountEl = $('#resultCount');
      if(resultCountEl){
        resultCountEl.innerHTML = '';
        resultCountEl.style.display = 'none';
      }
      const summaryEl = $('#filterSummary');
      if(summaryEl){
        summaryEl.textContent = '';
      }
    }

    function getVisibleMarkerBoundsForCount(){
      let zoomCandidate = Number.isFinite(lastKnownZoom) ? lastKnownZoom : NaN;
      if(!Number.isFinite(zoomCandidate) && map && typeof map.getZoom === 'function'){
        try {
          zoomCandidate = map.getZoom();
        } catch(err){
          zoomCandidate = NaN;
        }
      }
      if(!Number.isFinite(zoomCandidate) || zoomCandidate < MARKER_ZOOM_THRESHOLD){
        return null;
      }
      const boundsSource = postPanel || (map && typeof map.getBounds === 'function' ? map.getBounds() : null);
      if(!boundsSource) return null;
      return normalizeBounds(boundsSource);
    }

    function updateFilterCounts(){
      if(spinning){
        hideResultIndicators();
        updateResetBtn();
        return;
      }
      if(!postsLoaded) return;
      filtered = posts.filter(p => (spinning || inBounds(p)) && kwMatch(p) && dateMatch(p) && catMatch(p) && priceMatch(p));
      const boundsForCount = getVisibleMarkerBoundsForCount();
      const filteredMarkers = boundsForCount ? countMarkersForVenue(filtered, null, boundsForCount) : countMarkersForVenue(filtered);
      const today = new Date(); today.setHours(0,0,0,0);
      const totalPosts = posts.filter(p => (spinning || inBounds(p)) && p.dates.some(d => parseISODate(d) >= today));
      const totalMarkers = boundsForCount ? countMarkersForVenue(totalPosts, null, boundsForCount) : countMarkersForVenue(totalPosts);
      const summary = $('#filterSummary');
      if(summary){ summary.textContent = `${filteredMarkers} results showing out of ${totalMarkers} results in the area.`; }
      updateResultCount(filteredMarkers);
      updateResetBtn();
    }

    function refreshMarkers(render = true){
      if(spinning) return;
      if(!postsLoaded) return;
      const newAdPosts = filtered.filter(p => p.sponsored);
      const ids = newAdPosts.map(p => p.id).join(',');
      if(adPanel && ids !== adIdsKey){
        adPanel.innerHTML = '';
        adIndex = -1;
        if(adTimer){ clearInterval(adTimer); }
        adPosts = newAdPosts;
        if(adPosts.length){
          showNextAd();
          adTimer = setInterval(showNextAd,20000);
        } else {
          const img = document.createElement('img');
          img.src = 'assets/welcome%20001.jpg';
          img.alt = 'Welcome';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          adPanel.appendChild(img);
        }
        adIdsKey = ids;
      } else {
        adPosts = newAdPosts;
      }
      if(render) renderLists(filtered);
      syncMarkerSources(filtered);
      updateLayerVisibility(lastKnownZoom);
      filtersInitialized = true;
    }

    function applyFilters(render = true){
      if(spinning){
        hideResultIndicators();
        return;
      }
      updateFilterCounts();
      refreshMarkers(render);
    }

    function showNextAd(){
      if(!adPanel || !adPosts.length) return;
      adIndex = (adIndex + 1) % adPosts.length;
      const p = adPosts[adIndex];
      const slide = document.createElement('a');
      slide.className = 'ad-slide';
      slide.dataset.id = p.id;
      slide.href = postUrl(p);
      const img = new Image();
      img.src = heroUrl(p);
      img.alt = '';
      img.decode().catch(()=>{}).then(()=>{
        slide.appendChild(img);
        const info = document.createElement('div');
        info.className = 'info';
        info.textContent = p.title;
        slide.appendChild(info);
        adPanel.appendChild(slide);
        requestAnimationFrame(()=> slide.classList.add('active'));
        const slides = adPanel.querySelectorAll('.ad-slide');
        if(slides.length > 1){
          const old = slides[0];
          old.classList.remove('active');
          setTimeout(()=> old.remove(),1500);
        }
      });
    }

    function handleAdPanelClick(e){
      const slide = e.target.closest('.ad-slide');
      if(!slide) return;
      e.preventDefault();
      const id = slide.dataset.id;
      requestAnimationFrame(() => {
        callWhenDefined('openPost', (fn)=>{
          Promise.resolve(fn(id)).then(() => {
            requestAnimationFrame(() => {
              const openEl = document.querySelector(`.post-board .open-post[data-id="${id}"]`);
              if(openEl){
                requestAnimationFrame(() => { openEl.scrollIntoView({behavior:'smooth', block:'start'}); });
              }
              document.querySelectorAll('.recents-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));
              const quickCard = document.querySelector(`.recents-board .recents-card[data-id="${id}"]`);
              if(quickCard){
                quickCard.setAttribute('aria-selected','true');
                requestAnimationFrame(() => {
                  quickCard.scrollIntoView({behavior:'smooth', block:'nearest'});
                });
              }
            });
          }).catch(err => console.error(err));
        });
      });
    }

    function initAdBoard(){
      adPanel = document.querySelector('.ad-panel');
      if(!adPanel) return;
      if(!adPanel.__adListenerBound){
        adPanel.addEventListener('click', handleAdPanelClick, { capture: true });
        adPanel.__adListenerBound = true;
      }
    }

    // applyFilters();
    setMode(mode);
    if(historyWasActive && mode === 'posts'){
      document.body.classList.add('show-history');
      adjustBoards();
    }
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('mode', mode);
      localStorage.setItem('historyActive', document.body.classList.contains('show-history') ? 'true' : 'false');
    });
  })();
  
// 0577 helpers (safety)
function isPortrait(id){ let h=0; for(let i=0;i<id.length;i++){ h=(h<<5)-h+id.charCodeAt(i); h|=0; } return Math.abs(h)%2===0; }
function heroUrl(p){ const id = (typeof p==='string')? p : p.id; const port=isPortrait(id); return `https://picsum.photos/seed/${encodeURIComponent(id)}-t/${port?'800/1200':'1200/800'}`; }
function thumbUrl(p){ const id = (typeof p==='string')? p : p.id; const port=isPortrait(id); return `https://picsum.photos/seed/${encodeURIComponent(id)}-t/${port?'200/300':'300/200'}`; }
function getViewportHeight(){
  return window.innerHeight || document.documentElement.clientHeight || 0;
}
const panelStack = [];
function bringToTop(item){
  const idx = panelStack.indexOf(item);
  if(idx!==-1) panelStack.splice(idx,1);
  panelStack.push(item);
  panelStack.forEach((p,i)=>{
    if(p instanceof Element){ p.style.zIndex = 2000 + i; }
  });
}
function registerPopup(p){
  bringToTop(p);
  if(typeof p.on==='function'){
    p.on('close',()=>{
      const i = panelStack.indexOf(p);
      if(i!==-1) panelStack.splice(i,1);
    });
  }
  const el = p.getElement && p.getElement();
  if(el){
    el.addEventListener('mousedown', ()=> bringToTop(p));
  }
}
function savePanelState(m){
  if(!m || !m.id || m.id === 'welcome-modal') return;
  const content = m.querySelector('.panel-content');
  if(!content) return;
  const state = {
    left: content.style.left,
    top: content.style.top,
    width: content.style.width,
    height: content.style.height
  };
  localStorage.setItem(`panel-${m.id}`, JSON.stringify(state));
}
function loadPanelState(m){
  if(!m || !m.id) return false;
  const content = m.querySelector('.panel-content');
  if(!content) return false;
  const saved = JSON.parse(localStorage.getItem(`panel-${m.id}`) || 'null');
  if(saved){
    ['width','height','left','top'].forEach(prop=>{
      if(saved[prop]) content.style[prop] = saved[prop];
    });
    if(saved.left || saved.top) content.style.transform = 'none';
    return true;
  }
  return false;
}
const panelButtons = {
  filterPanel: 'filterBtn',
  memberPanel: 'memberBtn',
  adminPanel: 'adminBtn'
};

const panelScrollOverlayItems = new Set();

function updatePanelScrollOverlay(target){
  if(!target || !target.isConnected) return;
  const overlayWidth = target.offsetWidth - target.clientWidth;
  const value = overlayWidth > 0 ? `${overlayWidth}px` : '0px';
  target.style.setProperty('--panel-scrollbar-overlay', value);
}

function registerPanelScrollOverlay(target){
  if(!target || panelScrollOverlayItems.has(target)) return;
  panelScrollOverlayItems.add(target);
  updatePanelScrollOverlay(target);
  if('ResizeObserver' in window){
    const observer = new ResizeObserver(()=> updatePanelScrollOverlay(target));
    observer.observe(target);
  }
  target.addEventListener('scroll', ()=> updatePanelScrollOverlay(target), { passive: true });
}

function refreshPanelScrollOverlays(){
  document.querySelectorAll('.panel-body').forEach(registerPanelScrollOverlay);
  panelScrollOverlayItems.forEach(updatePanelScrollOverlay);
}

document.addEventListener('DOMContentLoaded', ()=>{
  refreshPanelScrollOverlays();
  window.addEventListener('resize', ()=>{
    requestAnimationFrame(()=>{
      panelScrollOverlayItems.forEach(updatePanelScrollOverlay);
    });
  });
});

(function(){
  const MIN_HEADER_WIDTH = 390;
  const SIDE_MARGIN = 10;
  let mapControls = null;
  let originalParent = null;
  let originalNext = null;
  let header = null;
  let headerButtons = null;
  let viewToggle = null;
  let welcomeModal = null;
  let placedInHeader = false;
  let rafId = null;

  function cacheElements(){
    if(!mapControls || !mapControls.isConnected){
      mapControls = document.querySelector('.map-controls-map');
      if(mapControls){
        if(!originalParent) originalParent = mapControls.parentElement;
        if(!originalNext) originalNext = mapControls.nextElementSibling;
      }
    }
    if(!header || !header.isConnected){
      header = document.querySelector('.header');
    }
    if(header){
      if(!headerButtons || !header.contains(headerButtons)){
        headerButtons = header.querySelector('.header-buttons');
      }
      if(!viewToggle || !header.contains(viewToggle)){
        viewToggle = header.querySelector('.view-toggle');
      }
    } else {
      headerButtons = null;
      viewToggle = null;
    }
    if(!welcomeModal || !welcomeModal.isConnected){
      welcomeModal = document.getElementById('welcome-modal');
    }
    return Boolean(mapControls && header);
  }

  function moveToHeader(){
    if(!cacheElements() || placedInHeader) return;
    const insertBeforeNode = (headerButtons && headerButtons.parentNode === header) ? headerButtons : null;
    if(insertBeforeNode){
      header.insertBefore(mapControls, insertBeforeNode);
    } else {
      header.appendChild(mapControls);
    }
    mapControls.classList.add('in-header');
    placedInHeader = true;
  }

  function moveToOriginal(){
    if(!mapControls || !originalParent || !placedInHeader) return;
    if(originalNext && originalNext.parentNode === originalParent){
      originalParent.insertBefore(mapControls, originalNext);
    } else {
      originalParent.appendChild(mapControls);
    }
    mapControls.classList.remove('in-header');
    mapControls.style.left = '';
    mapControls.style.width = '';
    mapControls.style.maxWidth = '';
    placedInHeader = false;
  }

  function performUpdate(){
    rafId = null;
    if(!cacheElements()) return;
    const welcomeOpen = welcomeModal && welcomeModal.classList.contains('show');
    if(welcomeOpen){
      moveToOriginal();
      return;
    }
    if(!headerButtons || !viewToggle){
      moveToOriginal();
      return;
    }
    const headerRect = header.getBoundingClientRect();
    const viewRect = viewToggle.getBoundingClientRect();
    const buttonsRect = headerButtons.getBoundingClientRect();
    const leftBoundary = Math.max(viewRect.right, headerRect.left) + SIDE_MARGIN;
    const rightBoundary = Math.min(buttonsRect.left, headerRect.right) - SIDE_MARGIN;
    const available = rightBoundary - leftBoundary;
    if(available < MIN_HEADER_WIDTH){
      moveToOriginal();
      return;
    }
    moveToHeader();
    const center = leftBoundary + available / 2;
    mapControls.style.left = (center - headerRect.left) + 'px';
    mapControls.style.width = '';
    mapControls.style.maxWidth = '';
    const ctrlRect = mapControls.getBoundingClientRect();
    if(ctrlRect.width > available){
      moveToOriginal();
    }
  }

  function scheduleUpdate(){
    if(rafId !== null) return;
    rafId = requestAnimationFrame(performUpdate);
  }

  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('orientationchange', scheduleUpdate);
  document.addEventListener('DOMContentLoaded', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  if(document.readyState !== 'loading') scheduleUpdate();

  const getWelcome = () => {
    if(!welcomeModal || !welcomeModal.isConnected){
      welcomeModal = document.getElementById('welcome-modal');
    }
    return welcomeModal;
  };
  const observedWelcome = getWelcome();
  if(observedWelcome && typeof MutationObserver === 'function'){
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(observedWelcome, {attributes:true, attributeFilter:['class','style']});
  }

  window.updateHeaderMapControls = scheduleUpdate;
})();

function schedulePanelEntrance(content, force=false){
  if(!content) return;
  if(force){
    content.classList.remove('panel-visible');
  }
  content.style.transform = '';
  if(force || !content.classList.contains('panel-visible')){
    requestAnimationFrame(()=>{
      if(!content.isConnected) return;
      content.classList.add('panel-visible');
    });
  }
}
function openPanel(m){
  if(!m) return;
  if(m.id === 'adminPanel' && window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
    window.adminAuthManager.ensureAuthenticated();
    return;
  }
  const content = m.querySelector('.panel-content') || m.querySelector('.modal-content');
  if(content && m.id !== 'welcome-modal'){
    content.style.width = '';
    content.style.height = '';
  }
  let shouldScheduleEntrance = false;
  if(content){
    const rootStyles = getComputedStyle(document.documentElement);
    const headerH = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
    const subH = parseFloat(rootStyles.getPropertyValue('--subheader-h')) || 0;
    const footerH = parseFloat(rootStyles.getPropertyValue('--footer-h')) || 0;
    const safeTop = parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0;
    const viewportHeight = getViewportHeight();
    const innerWidth = window.innerWidth;
    if(m.id==='adminPanel' || m.id==='memberPanel'){
      const topPos = headerH + safeTop;
      const availableHeight = Math.max(0, viewportHeight - footerH - topPos);
      content.style.left='auto';
      content.style.right='0';
      content.style.top=`${topPos}px`;
      content.style.bottom=`${footerH}px`;
      content.style.maxHeight = availableHeight ? `${availableHeight}px` : '';
      content.dataset.side='right';
      if(!content.classList.contains('panel-visible')){
        content.classList.remove('panel-visible');
        shouldScheduleEntrance = true;
      }
    } else if(m.id==='filterPanel'){
      const topPos = headerH + subH + safeTop;
      if(innerWidth < 450){
        content.style.left='0';
        content.style.right='0';
        content.style.top=`${topPos}px`;
        content.style.bottom=`${footerH}px`;
        content.style.maxHeight='';
      } else {
        const availableHeight = Math.max(0, viewportHeight - footerH - topPos);
        content.style.left='0';
        content.style.right='';
        content.style.top=`${topPos}px`;
        content.style.bottom='';
        content.style.maxHeight = availableHeight ? `${availableHeight}px` : '';
      }
      content.dataset.side='left';
      if(!content.classList.contains('panel-visible')){
        content.classList.remove('panel-visible');
        shouldScheduleEntrance = true;
      }
    } else if(m.id==='welcome-modal'){
      const topPos = headerH + safeTop + 10;
      content.style.left='50%';
      content.style.top=`${topPos}px`;
      content.style.transform='translateX(-50%)';
    } else {
      content.style.left='50%';
      content.style.top='50%';
      content.style.transform='translate(-50%, -50%)';
      if(m.id !== 'welcome-modal' && !['adminPanel','memberPanel','filterPanel'].includes(m.id)){
        loadPanelState(m);
      }
    }
  }
  m.classList.add('show');
  m.removeAttribute('aria-hidden');
  m.removeAttribute('inert');
  if(m.id === 'welcome-modal'){
    const mc = document.querySelector('.map-controls-map');
    if(mc) mc.style.display = 'none';
  }
  const btnId = panelButtons[m && m.id];
  if(btnId){
    const btn = document.getElementById(btnId);
    btn && btn.setAttribute('aria-pressed','true');
  }
  localStorage.setItem(`panel-open-${m.id}`,'true');
  if(content && shouldScheduleEntrance){
    schedulePanelEntrance(content);
  }
  if(!m.__bringToTopAdded){
    m.addEventListener('mousedown', ()=> bringToTop(m));
    m.__bringToTopAdded = true;
  }
  bringToTop(m);
  if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
  if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
  if(typeof window.updateHeaderMapControls === 'function') window.updateHeaderMapControls();
  if(content){
    requestAnimationFrame(()=> refreshPanelScrollOverlays());
  }
}

const memberPanelChangeManager = (()=>{
  let panel = null;
  let form = null;
  let saveButton = null;
  let discardButton = null;
  let prompt = null;
  let promptSaveButton = null;
  let promptDiscardButton = null;
  let statusMessage = null;
  let dirty = false;
  let savedState = {};
  let applying = false;
  let initialized = false;
  let statusTimer = null;
  let pendingCloseTarget = null;

  function ensureElements(){
    panel = document.getElementById('memberPanel');
    form = document.getElementById('memberForm');
    if(panel){
      saveButton = panel.querySelector('.save-changes');
      discardButton = panel.querySelector('.discard-changes');
    }
    prompt = document.getElementById('memberUnsavedPrompt');
    if(prompt){
      promptSaveButton = prompt.querySelector('.confirm-save');
      promptDiscardButton = prompt.querySelector('.confirm-discard');
    }
    statusMessage = document.getElementById('memberStatusMessage');
  }

  function getKey(el){
    if(!el) return '';
    return el.name || el.id || '';
  }

  function serializeState(){
    if(!form) return {};
    const data = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
      const key = getKey(el);
      if(!key) return;
      if(el.type === 'file'){
        data[key] = el.files && el.files.length ? '__FILE_SELECTED__' : '';
        return;
      }
      if(el.type === 'checkbox'){
        data[key] = !!el.checked;
        return;
      }
      if(el.type === 'radio'){
        if(!(key in data)) data[key] = null;
        if(el.checked) data[key] = el.value;
        return;
      }
      data[key] = el.value;
    });
    return data;
  }

  function stateEquals(a, b){
    const keys = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {})
    ]);
    for(const key of keys){
      if((a && a[key]) !== (b && b[key])){
        return false;
      }
    }
    return true;
  }

  function setDirty(value){
    dirty = !!value;
    if(panel){
      panel.classList.toggle('has-unsaved', dirty);
      panel.setAttribute('data-unsaved', dirty ? 'true' : 'false');
    }
    if(discardButton){
      discardButton.disabled = !dirty;
    }
    if(promptDiscardButton){
      promptDiscardButton.disabled = !dirty;
    }
  }

  function updateDirty(){
    if(applying) return;
    ensureElements();
    const current = serializeState();
    setDirty(!stateEquals(current, savedState));
  }

  function showStatus(message){
    ensureElements();
    if(!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.setAttribute('aria-hidden','false');
    statusMessage.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(()=>{
      statusMessage.classList.remove('show');
      statusMessage.setAttribute('aria-hidden','true');
    }, 2000);
  }

  function applyState(state){
    if(!form || !state) return;
    applying = true;
    try{
      form.querySelectorAll('input, select, textarea').forEach(el => {
        const key = getKey(el);
        if(!key || !(key in state)) return;
        const value = state[key];
        if(el.type === 'file'){
          const shouldClear = !value;
          if(shouldClear && el.value){
            el.value = '';
          }
          return;
        }
        if(el.type === 'checkbox'){
          const nextChecked = !!value;
          if(el.checked !== nextChecked){
            el.checked = nextChecked;
          }
          return;
        }
        if(el.type === 'radio'){
          const shouldCheck = value === el.value;
          if(el.checked !== shouldCheck){
            el.checked = shouldCheck;
          }
          return;
        }
        const nextValue = value == null ? '' : String(value);
        if(el.value !== nextValue){
          el.value = nextValue;
        }
      });
    } finally {
      applying = false;
      updateDirty();
    }
  }

  function refreshSavedState(){
    savedState = serializeState();
    setDirty(false);
  }

  function closePrompt(){
    if(prompt){
      prompt.classList.remove('show');
      prompt.setAttribute('aria-hidden','true');
    }
  }

  function cancelPrompt(){
    pendingCloseTarget = null;
    closePrompt();
  }

  function openPrompt(target){
    pendingCloseTarget = target || panel;
    if(prompt){
      prompt.classList.add('show');
      prompt.setAttribute('aria-hidden','false');
      setTimeout(()=>{
        if(promptSaveButton) promptSaveButton.focus();
      }, 0);
    }
  }

  function handleSave({ closeAfter } = {}){
    refreshSavedState();
    showStatus('Saved');
    if(closeAfter){
      const target = pendingCloseTarget;
      pendingCloseTarget = null;
      closePrompt();
      if(target) closePanel(target);
    } else {
      pendingCloseTarget = null;
    }
  }

  function notifyDiscard(detail = {}){
    try{
      document.dispatchEvent(new CustomEvent('member-panel:discarded', { detail }));
    }catch(err){
      console.error('Failed to dispatch member discard event', err);
    }
  }

  function discardChanges({ closeAfter } = {}){
    if(form && typeof form.reset === 'function'){
      applying = true;
      try{
        form.reset();
      } finally {
        applying = false;
      }
    }
    applyState(savedState);
    setDirty(false);
    showStatus('Changes Discarded');
    notifyDiscard({ closeAfter: !!closeAfter });
    if(closeAfter){
      const target = pendingCloseTarget;
      pendingCloseTarget = null;
      closePrompt();
      if(target) closePanel(target);
    } else {
      pendingCloseTarget = null;
      closePrompt();
    }
  }

  function formChanged(){
    if(applying) return;
    updateDirty();
  }

  function attachListeners(){
    if(initialized) return;
    ensureElements();
    if(!panel || !form) return;
    
// === Added Confirm Password Field ===
(function ensureConfirmPasswordField(){
  const registerPanel = document.getElementById('memberRegisterPanel');
  if(!registerPanel) return;
  const pwd = registerPanel.querySelector('input[type="password"]');
  if(!pwd) return;
  if(registerPanel.querySelector('#memberRegisterPasswordConfirm')) return;
  const confirm = document.createElement('input');
  confirm.type = 'password';
  confirm.id = 'memberRegisterPasswordConfirm';
  confirm.placeholder = 'Confirm Password';
  if(pwd.className) confirm.className = pwd.className;
  confirm.required = true;
  pwd.insertAdjacentElement('afterend', confirm);
})();
// === End Added Confirm Password Field ===

form.addEventListener('input', formChanged, true);
    form.addEventListener('change', formChanged, true);
    if(saveButton){
      saveButton.addEventListener('click', e=>{
        e.preventDefault();
        pendingCloseTarget = null;
        handleSave({ closeAfter:false });
      });
    }
    if(discardButton){
      discardButton.addEventListener('click', e=>{
        e.preventDefault();
        pendingCloseTarget = null;
        discardChanges({ closeAfter:false });
      });
    }
    if(promptSaveButton){
      promptSaveButton.addEventListener('click', e=>{
        e.preventDefault();
        handleSave({ closeAfter:true });
      });
    }
    if(promptDiscardButton){
      promptDiscardButton.addEventListener('click', e=>{
        e.preventDefault();
        discardChanges({ closeAfter:true });
      });
    }
    if(prompt){
      prompt.addEventListener('click', e=>{
        if(e.target === prompt) cancelPrompt();
      });
    }
    initialized = true;
    refreshSavedState();
  }

  ensureElements();
  attachListeners();
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(()=>{
      ensureElements();
      attachListeners();
      refreshSavedState();
    }, 0);
  });

  function isPromptOpen(){
    return !!(prompt && prompt.classList.contains('show'));
  }

  return {
    handlePanelClose(panelEl){
      if(!panel || panelEl !== panel) return false;
      if(isPromptOpen()) return true;
      if(dirty){
        openPrompt(panelEl);
        return true;
      }
      return false;
    },
    handleEscape(panelEl){
      if(isPromptOpen()){
        cancelPrompt();
        return true;
      }
      if(panel && panelEl === panel && dirty){
        openPrompt(panelEl);
        return true;
      }
      return false;
    }
  };
})();

const adminPanelChangeManager = (()=>{
  let panel = null;
  let form = null;
  let saveButton = null;
  let discardButton = null;
  let prompt = null;
  let promptSaveButton = null;
  let promptDiscardButton = null;
  let statusMessage = null;
  let dirty = false;
  let savedState = {};
  let applying = false;
  let statusTimer = null;
  let initialized = false;
  let pendingCloseTarget = null;

  function ensureElements(){
    panel = document.getElementById('adminPanel');
    form = document.getElementById('adminForm');
    if(panel){
      saveButton = panel.querySelector('.save-changes');
      discardButton = panel.querySelector('.discard-changes');
    }
    prompt = document.getElementById('adminUnsavedPrompt');
    if(prompt){
      promptSaveButton = prompt.querySelector('.confirm-save');
      promptDiscardButton = prompt.querySelector('.confirm-discard');
    }
    statusMessage = document.getElementById('adminStatusMessage');
  }

  function trigger(el, type){
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function serializeState(){
    if(!form) return {};
    const data = {};
    const elements = form.querySelectorAll('input, select, textarea');
    elements.forEach(el => {
      if(!el) return;
      const key = el.name || el.id;
      if(!key) return;
      if(el.type === 'file') return;
      if(el.tagName === 'SELECT' && el.multiple){
        data[key] = Array.from(el.options || []).filter(opt => opt.selected).map(opt => opt.value);
        return;
      }
      if(el.type === 'checkbox'){
        data[key] = el.checked;
        return;
      }
      if(el.type === 'radio'){
        if(!(key in data)) data[key] = null;
        if(el.checked) data[key] = el.value;
        return;
      }
      data[key] = el.value;
    });
    form.querySelectorAll('[contenteditable][id]').forEach(el => {
      data[el.id] = el.innerHTML;
    });
    return data;
  }

  function applyState(state){
    if(!form || !state) return;
    applying = true;
    try{
      const elements = form.querySelectorAll('input, select, textarea');
      elements.forEach(el => {
        if(!el) return;
        const key = el.name || el.id;
        if(!key || !(key in state)) return;
        if(el.type === 'file') return;
        if(el.tagName === 'SELECT' && el.multiple){
          const values = Array.isArray(state[key]) ? state[key].map(String) : [];
          let changed = false;
          Array.from(el.options || []).forEach(opt => {
            const shouldSelect = values.includes(opt.value);
            if(opt.selected !== shouldSelect){
              opt.selected = shouldSelect;
              changed = true;
            }
          });
          if(changed) trigger(el, 'change');
          return;
        }
        if(el.type === 'checkbox'){
          const shouldCheck = !!state[key];
          if(el.checked !== shouldCheck){
            el.checked = shouldCheck;
            trigger(el, 'change');
          }
          return;
        }
        if(el.type === 'radio'){
          const shouldCheck = state[key] === el.value;
          if(el.checked !== shouldCheck){
            el.checked = shouldCheck;
            if(shouldCheck) trigger(el, 'change');
          }
          return;
        }
        const nextValue = state[key] === null || state[key] === undefined ? '' : String(state[key]);
        if(el.value !== nextValue){
          el.value = nextValue;
          trigger(el, 'input');
          trigger(el, 'change');
        }
      });
      form.querySelectorAll('[contenteditable][id]').forEach(el => {
        if(!(el.id in state)) return;
        const html = state[el.id] ?? '';
        if(el.innerHTML !== html){
          el.innerHTML = html;
          trigger(el, 'input');
          trigger(el, 'change');
        }
      });
    } finally {
      applying = false;
    }
  }

  function setDirty(value){
    dirty = !!value;
    if(panel){
      panel.classList.toggle('has-unsaved', dirty);
      panel.setAttribute('data-unsaved', dirty ? 'true' : 'false');
    }
    if(discardButton){
      discardButton.disabled = !dirty;
    }
    if(promptDiscardButton){
      promptDiscardButton.disabled = !dirty;
    }
  }

  function refreshSavedState(){
    if(!form) return;
    savedState = serializeState();
    if(window.formbuilderStateManager && typeof window.formbuilderStateManager.save === 'function'){
      window.formbuilderStateManager.save();
    }
    setDirty(false);
  }

  function showStatus(message){
    if(!statusMessage) statusMessage = document.getElementById('adminStatusMessage');
    if(!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.setAttribute('aria-hidden','false');
    statusMessage.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(()=>{
      statusMessage.classList.remove('show');
      statusMessage.setAttribute('aria-hidden','true');
    }, 2000);
  }

  function closePrompt(){
    if(prompt){
      prompt.classList.remove('show');
      prompt.setAttribute('aria-hidden','true');
    }
  }

  function cancelPrompt(){
    pendingCloseTarget = null;
    closePrompt();
  }

  function openPrompt(target){
    pendingCloseTarget = target;
    if(prompt){
      prompt.classList.add('show');
      prompt.setAttribute('aria-hidden','false');
      setTimeout(()=>{
        if(promptSaveButton) promptSaveButton.focus();
      }, 0);
    }
  }

  function runSave({ closeAfter } = {}){
    ensureElements();
    let result = null;
    try{
      if(typeof window.saveAdminChanges === 'function'){
        result = window.saveAdminChanges();
      }
    }catch(err){
      console.error('Failed to save admin changes', err);
      if(!closeAfter) cancelPrompt();
      return;
    }
    Promise.resolve(result).then(()=>{
      refreshSavedState();
      showStatus('Saved');
      const panelToClose = closeAfter ? pendingCloseTarget : null;
      if(closeAfter) pendingCloseTarget = null;
      closePrompt();
      if(panelToClose) closePanel(panelToClose);
    }).catch(err => {
      console.error('Failed to save admin changes', err);
    });
  }

  function notifyDiscard(detail = {}){
    try{
      document.dispatchEvent(new CustomEvent('admin-panel:discarded', { detail }));
    }catch(err){
      console.error('Failed to dispatch admin discard event', err);
    }
  }

  function discardChanges({ closeAfter } = {}){
    if(form && typeof form.reset === 'function'){
      applying = true;
      try{
        form.reset();
      } finally {
        applying = false;
      }
    }
    if(window.formbuilderStateManager && typeof window.formbuilderStateManager.restoreSaved === 'function'){
      window.formbuilderStateManager.restoreSaved();
    }
    if(savedState) applyState(savedState);
    setDirty(false);
    showStatus('Changes Discarded');
    notifyDiscard({ closeAfter: !!closeAfter });
    const panelToClose = closeAfter ? pendingCloseTarget : null;
    pendingCloseTarget = null;
    closePrompt();
    if(panelToClose) closePanel(panelToClose);
  }

  function formChanged(){
    if(applying) return;
    setDirty(true);
  }

  function attachListeners(){
    if(initialized) return;
    ensureElements();
    if(!panel || !form) return;
    form.addEventListener('input', formChanged, true);
    form.addEventListener('change', formChanged, true);
    if(saveButton){
      saveButton.addEventListener('click', e=>{
        e.preventDefault();
        pendingCloseTarget = null;
        runSave({ closeAfter:false });
      });
    }
    if(discardButton){
      discardButton.addEventListener('click', e=>{
        e.preventDefault();
        discardChanges({ closeAfter:false });
      });
    }
    if(promptSaveButton){
      promptSaveButton.addEventListener('click', e=>{
        e.preventDefault();
        runSave({ closeAfter:true });
      });
    }
    if(promptDiscardButton){
      promptDiscardButton.addEventListener('click', e=>{
        e.preventDefault();
        discardChanges({ closeAfter:true });
      });
    }
    if(prompt){
      prompt.addEventListener('click', e=>{
        if(e.target === prompt) cancelPrompt();
      });
    }
    initialized = true;
    refreshSavedState();
  }

  ensureElements();
  attachListeners();
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(()=>{
      ensureElements();
      attachListeners();
      refreshSavedState();
    }, 0);
  });

  function isPromptOpen(){
    return !!(prompt && prompt.classList.contains('show'));
  }

  return {
    hasUnsaved(){
      return !!dirty;
    },
    handlePanelClose(panelEl){
      if(!panel || panelEl !== panel) return false;
      if(isPromptOpen()) return true;
      if(dirty){
        openPrompt(panelEl);
        return true;
      }
      return false;
    },
    handleEscape(panelEl){
      if(isPromptOpen()){
        cancelPrompt();
        return true;
      }
      if(panel && panelEl === panel && dirty){
        openPrompt(panelEl);
        return true;
      }
      return false;
    },
    markSaved(message){
      ensureElements();
      refreshSavedState();
      if(message) showStatus(message);
    },
    markDirty(){
      ensureElements();
      setDirty(true);
    }
  };
})();




function closePanel(m){
  const btnId = panelButtons[m && m.id];
  if(btnId){
    const btn = document.getElementById(btnId);
    btn && btn.setAttribute('aria-pressed','false');
  }
  const content = m.querySelector('.panel-content') || m.querySelector('.modal-content');
  const active = document.activeElement;
  if(active && m.contains(active)) active.blur();
  if(m.id === 'welcome-modal'){
    const mc = document.querySelector('.map-controls-map');
    if(mc) mc.style.display = '';
  }
  m.setAttribute('inert','');
  if(content && content.dataset.side){
    content.classList.remove('panel-visible');
    content.addEventListener('transitionend', function handler(){
      content.removeEventListener('transitionend', handler);
      m.classList.remove('show');
      m.setAttribute('aria-hidden','true');
      localStorage.setItem(`panel-open-${m.id}`,'false');
      const idx = panelStack.indexOf(m);
      if(idx!==-1) panelStack.splice(idx,1);
      if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
      if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
    }, {once:true});
  } else {
    m.classList.remove('show');
    m.setAttribute('aria-hidden','true');
    localStorage.setItem(`panel-open-${m.id}`,'false');
    const idx = panelStack.indexOf(m);
    if(idx!==-1) panelStack.splice(idx,1);
    if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
    if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
  }
  if(typeof window.updateHeaderMapControls === 'function') window.updateHeaderMapControls();
}







const adminAuthManager = (()=>{
  const STORAGE_KEY = 'admin-authenticated';
  const IDENTITY_KEY = 'admin-identity';
  const adminBtn = document.getElementById('adminBtn');
  const adminPanel = document.getElementById('adminPanel');
  const memberPanel = document.getElementById('memberPanel');

  let authenticated = localStorage.getItem(STORAGE_KEY) === 'true';
  let adminIdentity = localStorage.getItem(IDENTITY_KEY) || '';

  function updateUI(){
    if(adminBtn){
      const isVisible = !!authenticated;
      adminBtn.hidden = !isVisible;
      adminBtn.style.display = isVisible ? 'flex' : 'none';
      adminBtn.setAttribute('aria-hidden', (!isVisible).toString());
      if(!isVisible){
        adminBtn.setAttribute('aria-pressed','false');
      }
    }
  }

  function setAuthenticatedState(value, identity){
    const next = !!value;
    if(next === authenticated){
      updateUI();
      return;
    }
    authenticated = next;
    localStorage.setItem(STORAGE_KEY, authenticated ? 'true' : 'false');
    if(authenticated){
      const normalizedIdentity = typeof identity === 'string' ? identity.trim() : '';
      adminIdentity = normalizedIdentity || adminIdentity;
      if(adminIdentity){
        localStorage.setItem(IDENTITY_KEY, adminIdentity);
      }
    } else {
      adminIdentity = '';
      localStorage.removeItem(IDENTITY_KEY);
    }
    updateUI();
    if(!authenticated){
      localStorage.setItem('panel-open-adminPanel','false');
      if(adminPanel && adminPanel.classList.contains('show')){
        closePanel(adminPanel);
      }
    }
  }

  function ensureAuthenticated(){
    if(authenticated) return true;
    if(memberPanel && !memberPanel.classList.contains('show')){
      openPanel(memberPanel);
    }
    const memberBtn = document.getElementById('memberBtn');
    if(memberBtn){
      memberBtn.focus();
    }
    return false;
  }

  updateUI();
  if(!authenticated){
    localStorage.setItem('panel-open-adminPanel','false');
    if(adminPanel && adminPanel.classList.contains('show')){
      closePanel(adminPanel);
    }
  }

  return {
    isAuthenticated(){
      return authenticated;
    },
    ensureAuthenticated,
    setAuthenticated(value, identity){
      setAuthenticatedState(value, identity);
    },
    getAdminUser(){
      const identifier = adminIdentity || localStorage.getItem(IDENTITY_KEY) || 'admin';
      const trimmed = identifier.trim();
      const emailNormalized = trimmed ? trimmed.toLowerCase() : 'admin';
      return {
        name: 'Administrator',
        email: trimmed || 'admin',
        emailNormalized,
        username: trimmed || 'admin',
        avatar: '',
        isAdmin: true
      };
    }
  };
})();
window.adminAuthManager = adminAuthManager;

const welcomeModalEl = document.getElementById('welcome-modal');
if(welcomeModalEl){
  const welcomeControls = welcomeModalEl.querySelector('.map-controls-welcome');
  welcomeModalEl.addEventListener('click', e => {
    if(welcomeControls && welcomeControls.contains(e.target)) return;
    closePanel(welcomeModalEl);
  });
  const welcomeContent = welcomeModalEl.querySelector('.modal-content');
  if(welcomeContent){
    welcomeContent.addEventListener('click', e => {
      if(welcomeControls && welcomeControls.contains(e.target)) return;
      closePanel(welcomeModalEl);
    });
  }
}

function requestClosePanel(m){
  if(m){
    if(m.id === 'adminPanel' && adminPanelChangeManager.handlePanelClose(m)){
      return;
    }
    if(m.id === 'memberPanel' && memberPanelChangeManager.handlePanelClose(m)){
      return;
    }
  }
  closePanel(m);
}
function togglePanel(m){
  if(m.classList.contains('show')){
    requestClosePanel(m);
  } else {
    openPanel(m);
  }
}
function movePanelToEdge(panel, side){
  if(!panel) return;
  const content = panel.querySelector('.panel-content') || panel.querySelector('.modal-content');
  if(!content) return;
  const header = document.querySelector('.header');
  const topPos = header ? header.getBoundingClientRect().bottom : 0;
  content.style.top = `${topPos}px`;
  if(side === 'left'){
    content.dataset.side='left';
    content.style.left = '0';
    content.style.right = 'auto';
    schedulePanelEntrance(content, true);
  } else {
    content.dataset.side='right';
    content.style.left = 'auto';
    content.style.right = '0';
    schedulePanelEntrance(content, true);
  }
}
function repositionPanels(){
  ['adminPanel','memberPanel','filterPanel'].forEach(id=>{
    const panel = document.getElementById(id);
    if(panel && panel.classList.contains('show')){
      const content = panel.querySelector('.panel-content');
      if(!content) return;
      const w = content.style.width;
      const h = content.style.height;
      openPanel(panel);
      content.style.width = w;
      content.style.height = h;
    }
  });
}
function handleEsc(){
  const top = panelStack[panelStack.length-1];
  if(!top){
    const {container} = ensureImageModalReady();
    if(container && !container.classList.contains('hidden')){
      closeImageModal(container);
    }
    return;
  }
  if(top instanceof Element){
    if(top.id === 'adminPanel' && adminPanelChangeManager.handleEscape(top)){
      return;
    }
    if(top.id === 'memberPanel' && memberPanelChangeManager.handleEscape(top)){
      return;
    }
    if(top.id === 'post-modal-container'){
      closePostModal();
    } else {
      requestClosePanel(top);
    }
  } else if(typeof top.remove==='function'){
    panelStack.pop();
    top.remove();
  }
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') handleEsc();
});

let pointerStartedInFilterContent = false;

function handleDocInteract(e){
  if(e.target.closest('.image-modal-container')) return;
  if(logoEls.some(el => el.contains(e.target))) return;
  if(e.target.closest('#filterBtn')) return;
  const welcome = document.getElementById('welcome-modal');
  if(welcome && welcome.classList.contains('show')){
    const controls = welcome.querySelector('.map-controls-welcome');
    if(!controls || !controls.contains(e.target)){
      closePanel(welcome);
    }
  }
  const filterPanel = document.getElementById('filterPanel');
  const fromPointerDown = !!e.__fromPointerDown;
  if(filterPanel && filterPanel.classList.contains('show')){
    const content = filterPanel.querySelector('.panel-content');
    const pinBtn = filterPanel.querySelector('.pin-panel');
    const pinned = pinBtn && pinBtn.getAttribute('aria-pressed')==='true';
    const startedInside = pointerStartedInFilterContent;
    if(content && !content.contains(e.target) && !pinned){
      if(startedInside && !fromPointerDown){
        pointerStartedInFilterContent = false;
        return;
      }
      closePanel(filterPanel);
      pointerStartedInFilterContent = false;
      return;
    }
    if(!fromPointerDown){
      pointerStartedInFilterContent = false;
    }
  } else if(!fromPointerDown){
    pointerStartedInFilterContent = false;
  }
}

document.addEventListener('click', handleDocInteract);
document.addEventListener('pointerdown', (e) => {
  const target = e.target;
  const filterPanel = document.getElementById('filterPanel');
  const content = filterPanel ? filterPanel.querySelector('.panel-content') : null;
  pointerStartedInFilterContent = !!(filterPanel && filterPanel.classList.contains('show') && content && content.contains(target));
  requestAnimationFrame(() => handleDocInteract({ target, __fromPointerDown: true }));
});

// Panels and admin/member interactions
(function(){
  const memberBtn = document.getElementById('memberBtn');
  const adminBtn = document.getElementById('adminBtn');
  const filterBtn = document.getElementById('filterBtn');
  const memberPanel = document.getElementById('memberPanel');
  const adminPanel = document.getElementById('adminPanel');
  const filterPanel = document.getElementById('filterPanel');

  if(memberBtn && memberPanel){
    memberBtn.addEventListener('click', ()=> togglePanel(memberPanel));
  }
  if(adminBtn && adminPanel){
    adminBtn.addEventListener('click', ()=>{
      if(window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
        window.adminAuthManager.ensureAuthenticated();
        return;
      }
      togglePanel(adminPanel);
    });
  }
  filterBtn && filterBtn.addEventListener('click', ()=> togglePanel(filterPanel));
  document.querySelectorAll('.panel .close-panel').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const panel = btn.closest('.panel');
      requestClosePanel(panel);
    });
  });
  document.querySelectorAll('.panel .move-left').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const panel = btn.closest('.panel');
      movePanelToEdge(panel, 'left');
    });
  });
  document.querySelectorAll('.panel .move-right').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const panel = btn.closest('.panel');
      movePanelToEdge(panel, 'right');
    });
  });

  document.querySelectorAll('#filterPanel .pin-panel').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const pressed = btn.getAttribute('aria-pressed')==='true';
      btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
    });
  });

  document.querySelectorAll('.panel .panel-header').forEach(header=>{
    header.addEventListener('mousedown', e=>{
      if(e.target.closest('button')) return;
      const panel = header.closest('.panel');
      const content = panel ? panel.querySelector('.panel-content') : null;
      if(!content) return;
      bringToTop(panel);
      const rect = content.getBoundingClientRect();
      const startX = e.clientX;
      const startLeft = rect.left;
      const onMove = (ev)=>{
        const dx = ev.clientX - startX;
        let newLeft = startLeft + dx;
        const maxLeft = window.innerWidth - rect.width;
        if(newLeft < 0) newLeft = 0;
        if(newLeft > maxLeft) newLeft = maxLeft;
        content.style.left = `${newLeft}px`;
        content.style.right = 'auto';
      };
      const throttledMove = rafThrottle(onMove);
      function onUp(){
        document.removeEventListener('mousemove', throttledMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', throttledMove);
      document.addEventListener('mouseup', onUp);
    });
  });

    const welcomeModal = document.getElementById('welcome-modal');
    const panelsToRestore = [memberPanel, adminPanel, welcomeModal];
    panelsToRestore.forEach(m=>{
      if(!m) return;
      if(m.id === 'adminPanel' && window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
        localStorage.setItem(`panel-open-${m.id}`,'false');
        return;
      }
      if(localStorage.getItem(`panel-open-${m.id}`) === 'true'){
        openPanel(m);
      }
    });
    if(welcomeModal && !localStorage.getItem('welcome-seen')){
      openWelcome();
      localStorage.setItem('welcome-seen','true');
    }
    const shouldOpenFilter = window.innerWidth >= 1300 && localStorage.getItem('panel-open-filterPanel') === 'true';
    if(filterPanel && shouldOpenFilter){
      openPanel(filterPanel);
    }
  document.querySelectorAll('.panel').forEach(panel=>{
    const content = panel.querySelector('.panel-content');
    if(content){
      const defaultWidth = panel.id === 'filterPanel' ? '380px' : '440px';
      content.style.width = defaultWidth;
      content.style.maxWidth = defaultWidth;
      content.style.top = 'calc(var(--header-h) + var(--safe-top))';
      content.style.bottom = 'var(--footer-h)';
      content.style.height = 'calc(100vh - var(--header-h) - var(--safe-top) - var(--footer-h))';
      content.style.maxHeight = 'calc(100vh - var(--header-h) - var(--safe-top) - var(--footer-h))';
    }
  });

  const adminTabs = document.querySelectorAll('#adminPanel .tab-bar button');
  const adminPanels = document.querySelectorAll('#adminPanel .tab-panel');
  adminTabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      adminTabs.forEach(b=>b.setAttribute('aria-selected','false'));
      adminPanels.forEach(p=>p.classList.remove('active'));
      btn.setAttribute('aria-selected','true');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      panel && panel.classList.add('active');
    });
  });

  const memberTabs = document.querySelectorAll('#memberPanel .tab-bar .tab-btn');
  const memberPanels = document.querySelectorAll('#memberPanel .member-tab-panel');
  memberTabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      memberTabs.forEach(b=>b.setAttribute('aria-selected','false'));
      memberPanels.forEach(p=>{
        p.classList.remove('active');
        p.setAttribute('hidden','');
      });
      btn.setAttribute('aria-selected','true');
      const panel = document.getElementById(`memberTab-${btn.dataset.tab}`);
      if(panel){
        panel.classList.add('active');
        panel.removeAttribute('hidden');
      }
    });
  });

  const adminPaypalClientId = document.getElementById('adminPaypalClientId');
  const adminPaypalClientSecret = document.getElementById('adminPaypalClientSecret');
  const adminListingCurrency = document.getElementById('adminListingCurrency');
  const adminListingPrice = document.getElementById('adminListingPrice');

  const memberCreateSection = document.getElementById('memberTab-create');
  if(memberCreateSection){
    const categorySelect = document.getElementById('memberCreateCategory');
    const subcategorySelect = document.getElementById('memberCreateSubcategory');
    const emptyState = document.getElementById('memberCreateEmpty');
    const formWrapper = document.getElementById('memberCreateFormWrapper');
    const formFields = document.getElementById('memberCreateFormFields');
    const checkoutContainer = document.getElementById('memberCreateCheckout');
    const paypalContainer = document.getElementById('memberCreatePaypalContainer');
    const paypalButton = document.getElementById('memberCreatePaypalButton');
    const postButton = document.getElementById('memberCreatePostBtn');
    const listingCurrency = document.getElementById('memberCreateListingCurrency');
    const listingPrice = document.getElementById('memberCreateListingPrice');

    function collectCurrencyCodes(snapshot){
      const codes = new Set();
      const cats = snapshot && Array.isArray(snapshot.categories) ? snapshot.categories : [];
      cats.forEach(cat => {
        if(!cat || typeof cat !== 'object') return;
        const subFields = cat.subFields && typeof cat.subFields === 'object' ? cat.subFields : {};
        Object.values(subFields).forEach(fields => {
          if(!Array.isArray(fields)) return;
          fields.forEach(field => {
            if(!field || typeof field !== 'object') return;
            if(field.type === 'version-price'){
              const options = Array.isArray(field.options) ? field.options : [];
              options.forEach(opt => {
                const code = opt && typeof opt.currency === 'string' ? opt.currency.trim().toUpperCase() : '';
                if(code) codes.add(code);
              });
            } else if(field.type === 'venue-session-version-tier-price'){
              const venues = Array.isArray(field.options) ? field.options : [];
              venues.forEach(venue => {
                const sessions = Array.isArray(venue && venue.sessions) ? venue.sessions : [];
                sessions.forEach(session => {
                  const times = Array.isArray(session && session.times) ? session.times : [];
                  times.forEach(time => {
                    const versions = Array.isArray(time && time.versions) ? time.versions : [];
                    versions.forEach(version => {
                      const tiers = Array.isArray(version && version.tiers) ? version.tiers : [];
                      tiers.forEach(tier => {
                        const code = tier && typeof tier.currency === 'string' ? tier.currency.trim().toUpperCase() : '';
                        if(code) codes.add(code);
                      });
                    });
                  });
                });
              });
            }
          });
        });
      });
      if(!codes.size && snapshot && Array.isArray(snapshot.versionPriceCurrencies)){
        snapshot.versionPriceCurrencies.forEach(code => {
          const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
          if(normalized) codes.add(normalized);
        });
      }
      if(!codes.size){
        DEFAULT_FORMBUILDER_SNAPSHOT.versionPriceCurrencies.forEach(code => codes.add(code));
      }
      return Array.from(codes);
    }

    let memberSnapshot = normalizeFormbuilderSnapshot(getSavedFormbuilderSnapshot());
    let memberCategories = memberSnapshot.categories;
    let currencyCodes = collectCurrencyCodes(memberSnapshot);
    let fieldIdCounter = 0;

    function ensureCurrencyOptions(select){
      if(!select) return;
      const preserveValue = select.value;
      const options = Array.from(select.options || []);
      options.forEach(opt => {
        if(opt.value){
          select.removeChild(opt);
        }
      });
      currencyCodes.forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        select.appendChild(opt);
      });
      if(preserveValue && currencyCodes.includes(preserveValue)){
        select.value = preserveValue;
      } else {
        select.value = '';
      }
    }

    function refreshMemberSnapshot(){
      memberSnapshot = normalizeFormbuilderSnapshot(getSavedFormbuilderSnapshot());
      memberCategories = memberSnapshot.categories;
      currencyCodes = collectCurrencyCodes(memberSnapshot);
      ensureCurrencyOptions(listingCurrency);
      ensureCurrencyOptions(adminListingCurrency);
    }

    refreshMemberSnapshot();

    function formatPriceValue(value){
      const raw = (value || '').replace(/[^0-9.,]/g, '').replace(/,/g, '.');
      if(!raw) return '';
      const parts = raw.split('.');
      let integer = parts[0] || '';
      integer = integer.replace(/\./g, '');
      if(!integer) integer = '0';
      let fraction = parts[1] || '';
      fraction = fraction.replace(/\./g, '').slice(0, 2);
      if(fraction.length === 0){
        fraction = '00';
      } else if(fraction.length === 1){
        fraction = `${fraction}0`;
      }
      return `${integer}.${fraction}`;
    }

    function updatePaypalContainer(triggered){
      if(!paypalContainer) return;
      const hasCredentials = !!(adminPaypalClientId && adminPaypalClientSecret && adminPaypalClientId.value.trim() && adminPaypalClientSecret.value.trim());
      paypalContainer.textContent = hasCredentials
        ? (triggered ? 'PayPal checkout will open once integration is connected.' : 'PayPal checkout is ready once connected to your credentials.')
        : 'Connect PayPal in Admin Settings to enable checkout.';
      if(paypalButton){
        paypalButton.disabled = !hasCredentials;
      }
    }

    function sanitizeCreateField(field){
      const safe = {
        name: '',
        type: 'text-box',
        placeholder: '',
        required: false,
        options: []
      };
      if(field && typeof field === 'object'){
        if(typeof field.name === 'string'){
          safe.name = field.name.trim();
        }
        let type = typeof field.type === 'string' ? field.type : 'text-box';
        if(type === 'venue-session-price') type = 'venue-session-version-tier-price';
        if(!FORM_FIELD_TYPES.some(opt => opt.value === type)){
          type = 'text-box';
        }
        safe.type = type;
        if(typeof field.placeholder === 'string'){
          safe.placeholder = field.placeholder;
        }
        safe.required = !!field.required;
        if(type === 'version-price'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => ({
            version: opt && typeof opt.version === 'string' ? opt.version : '',
            currency: opt && typeof opt.currency === 'string' ? opt.currency : '',
            price: opt && typeof opt.price === 'string' ? opt.price : ''
          }));
          if(safe.options.length === 0){
            safe.options.push({ version: '', currency: '', price: '' });
          }
        } else if(type === 'dropdown' || type === 'radio-toggle'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => {
            if(typeof opt === 'string') return opt;
            if(opt && typeof opt === 'object' && typeof opt.version === 'string') return opt.version;
            return '';
          });
          if(safe.options.length === 0){
            safe.options.push('');
          }
        } else if(type === 'venue-session-version-tier-price'){
          const normalized = normalizeVenueSessionOptions(field.options);
          safe.options = normalized.map(cloneVenueSessionVenue);
        } else {
          safe.options = Array.isArray(field.options)
            ? field.options.map(opt => {
                if(typeof opt === 'string') return opt;
                if(opt && typeof opt === 'object'){
                  try{
                    return JSON.parse(JSON.stringify(opt));
                  }catch(err){
                    return { ...opt };
                  }
                }
                return '';
              })
            : [];
        }
      }
      return safe;
    }

    function getFieldsForSelection(categoryName, subcategoryName){
      if(!categoryName || !subcategoryName) return [];
      const category = memberCategories.find(cat => cat && typeof cat.name === 'string' && cat.name === categoryName);
      if(!category) return [];
      const subFieldsMap = category.subFields && typeof category.subFields === 'object' ? category.subFields : {};
      let fields = Array.isArray(subFieldsMap && subFieldsMap[subcategoryName]) ? subFieldsMap[subcategoryName] : [];
      if(!fields || fields.length === 0){
        fields = DEFAULT_SUBCATEGORY_FIELDS;
      }
      return fields.map(sanitizeCreateField);
    }

    function renderEmptyState(){
      if(emptyState) emptyState.hidden = false;
      if(formWrapper) formWrapper.hidden = true;
      if(checkoutContainer) checkoutContainer.hidden = true;
      if(postButton) postButton.disabled = true;
      updatePaypalContainer(false);
    }

    function buildVersionPriceEditor(field, labelId){
      const options = Array.isArray(field.options) && field.options.length ? field.options.map(opt => ({ ...opt })) : [{ version: '', currency: '', price: '' }];
      const list = document.createElement('div');
      list.className = 'member-version-price-list';
      list.setAttribute('role', 'group');
      list.setAttribute('aria-labelledby', labelId);

      function addRow(option){
        const row = document.createElement('div');
        row.className = 'member-version-price-row';
        const versionInput = document.createElement('input');
        versionInput.type = 'text';
        versionInput.placeholder = 'Version Name';
        versionInput.value = option.version || '';
        versionInput.addEventListener('input', ()=>{ option.version = versionInput.value; });

        const currencySelect = document.createElement('select');
        currencySelect.innerHTML = '<option value="">Currency</option>';
        currencyCodes.forEach(code => {
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = code;
          currencySelect.appendChild(opt);
        });
        currencySelect.value = option.currency || '';
        currencySelect.addEventListener('change', ()=>{ option.currency = currencySelect.value; });

        const priceInput = document.createElement('input');
        priceInput.type = 'text';
        priceInput.placeholder = '0.00';
        priceInput.value = option.price || '';
        priceInput.addEventListener('blur', ()=>{
          option.price = formatPriceValue(priceInput.value);
          priceInput.value = option.price;
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', ()=>{
          if(options.length <= 1){
            option.version = '';
            option.currency = '';
            option.price = '';
            versionInput.value = '';
            currencySelect.value = '';
            priceInput.value = '';
            return;
          }
          const idx = options.indexOf(option);
          if(idx !== -1){
            options.splice(idx, 1);
          }
          row.remove();
        });

        row.append(versionInput, currencySelect, priceInput, removeBtn);
        list.appendChild(row);
      }

      options.forEach(addRow);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'member-create-secondary-btn';
      addBtn.textContent = 'Add Version';
      addBtn.addEventListener('click', ()=>{
        const option = { version: '', currency: '', price: '' };
        options.push(option);
        addRow(option);
      });

      const container = document.createElement('div');
      container.appendChild(list);
      container.appendChild(addBtn);
      return container;
    }

    function buildVenueSessionEditor(field, labelId){
      const venues = Array.isArray(field.options) && field.options.length ? field.options.map(cloneVenueSessionVenue) : [venueSessionCreateVenue()];
      const venueList = document.createElement('div');
      venueList.className = 'member-venue-session';
      venueList.setAttribute('role', 'group');
      venueList.setAttribute('aria-labelledby', labelId);
      let addVenueBtn = null;

      function addVenueCard(venue){
        const venueCard = document.createElement('div');
        venueCard.className = 'member-venue-card';

        const venueHeader = document.createElement('div');
        venueHeader.className = 'member-venue-header';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Venue Name';
        nameInput.value = venue.name || '';
        nameInput.addEventListener('input', ()=>{ venue.name = nameInput.value; });
        const addressInput = document.createElement('input');
        addressInput.type = 'text';
        addressInput.placeholder = 'Venue Address';
        addressInput.value = venue.address || '';
        addressInput.addEventListener('input', ()=>{ venue.address = addressInput.value; });
        venueHeader.append(nameInput, addressInput);

        const sessionList = document.createElement('div');
        sessionList.className = 'member-session-list';

        function addSessionCard(session){
          const sessionCard = document.createElement('div');
          sessionCard.className = 'member-session-card';
          const sessionTop = document.createElement('div');
          sessionTop.className = 'member-session-top';
          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.value = session.date || '';
          dateInput.addEventListener('change', ()=>{ session.date = dateInput.value; });
          sessionTop.appendChild(dateInput);

          const removeSessionBtn = document.createElement('button');
          removeSessionBtn.type = 'button';
          removeSessionBtn.className = 'member-create-secondary-btn';
          removeSessionBtn.textContent = 'Remove Session';
          removeSessionBtn.addEventListener('click', ()=>{
            if(venue.sessions.length <= 1){
              session.date = '';
              dateInput.value = '';
              session.times = [venueSessionCreateTime()];
              timeList.innerHTML = '';
              session.times.forEach(addTimeCard);
              return;
            }
            const idx = venue.sessions.indexOf(session);
            if(idx !== -1){
              venue.sessions.splice(idx, 1);
            }
            sessionCard.remove();
          });
          sessionTop.appendChild(removeSessionBtn);
          sessionCard.appendChild(sessionTop);

          const timeList = document.createElement('div');
          timeList.className = 'member-time-list';
          sessionCard.appendChild(timeList);

          function addTimeCard(time){
            const timeCard = document.createElement('div');
            timeCard.className = 'member-time-card';
            const timeHeader = document.createElement('div');
            timeHeader.className = 'member-time-header';
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.value = time.time || '';
            timeInput.addEventListener('change', ()=>{ time.time = timeInput.value; });
            timeHeader.appendChild(timeInput);

            const removeTimeBtn = document.createElement('button');
            removeTimeBtn.type = 'button';
            removeTimeBtn.className = 'member-create-secondary-btn';
            removeTimeBtn.textContent = 'Remove Time';
            removeTimeBtn.addEventListener('click', ()=>{
              if(session.times.length <= 1){
                time.time = '';
                timeInput.value = '';
                return;
              }
              const idx = session.times.indexOf(time);
              if(idx !== -1){
                session.times.splice(idx, 1);
              }
              timeCard.remove();
            });
            timeHeader.appendChild(removeTimeBtn);
            timeCard.appendChild(timeHeader);

            const versionList = document.createElement('div');
            versionList.className = 'member-version-list';
            timeCard.appendChild(versionList);

            function addVersionCard(version){
              const versionCard = document.createElement('div');
              versionCard.className = 'member-version-card';
              const versionNameInput = document.createElement('input');
              versionNameInput.type = 'text';
              versionNameInput.placeholder = 'Version Name';
              versionNameInput.value = version.name || '';
              versionNameInput.addEventListener('input', ()=>{ version.name = versionNameInput.value; });
              versionCard.appendChild(versionNameInput);

              const tierList = document.createElement('div');
              tierList.className = 'member-tier-list';
              versionCard.appendChild(tierList);

              function addTierRow(tier){
                const tierRow = document.createElement('div');
                tierRow.className = 'member-tier-row';
                const tierNameInput = document.createElement('input');
                tierNameInput.type = 'text';
                tierNameInput.placeholder = 'Tier Name';
                tierNameInput.value = tier.name || '';
                tierNameInput.addEventListener('input', ()=>{ tier.name = tierNameInput.value; });

                const tierCurrencySelect = document.createElement('select');
                tierCurrencySelect.innerHTML = '<option value="">Currency</option>';
                currencyCodes.forEach(code => {
                  const opt = document.createElement('option');
                  opt.value = code;
                  opt.textContent = code;
                  tierCurrencySelect.appendChild(opt);
                });
                tierCurrencySelect.value = tier.currency || '';
                tierCurrencySelect.addEventListener('change', ()=>{ tier.currency = tierCurrencySelect.value; });

                const tierPriceInput = document.createElement('input');
                tierPriceInput.type = 'text';
                tierPriceInput.placeholder = '0.00';
                tierPriceInput.value = tier.price || '';
                tierPriceInput.addEventListener('blur', ()=>{
                  tier.price = formatPriceValue(tierPriceInput.value);
                  tierPriceInput.value = tier.price;
                });

                const removeTierBtn = document.createElement('button');
                removeTierBtn.type = 'button';
                removeTierBtn.className = 'member-create-secondary-btn';
                removeTierBtn.textContent = 'Remove';
                removeTierBtn.addEventListener('click', ()=>{
                  if(version.tiers.length <= 1){
                    tier.name = '';
                    tier.currency = '';
                    tier.price = '';
                    tierNameInput.value = '';
                    tierCurrencySelect.value = '';
                    tierPriceInput.value = '';
                    return;
                  }
                  const idx = version.tiers.indexOf(tier);
                  if(idx !== -1){
                    version.tiers.splice(idx, 1);
                  }
                  tierRow.remove();
                });

                tierRow.append(tierNameInput, tierCurrencySelect, tierPriceInput, removeTierBtn);
                tierList.appendChild(tierRow);
              }

              if(!Array.isArray(version.tiers) || !version.tiers.length){
                version.tiers = [venueSessionCreateTier()];
              }
              version.tiers.forEach(addTierRow);

              const versionActions = document.createElement('div');
              versionActions.className = 'member-version-actions';
              const addTierBtn = document.createElement('button');
              addTierBtn.type = 'button';
              addTierBtn.className = 'member-create-secondary-btn';
              addTierBtn.textContent = 'Add Tier';
              addTierBtn.addEventListener('click', ()=>{
                const tier = venueSessionCreateTier();
                version.tiers.push(tier);
                addTierRow(tier);
              });
              const removeVersionBtn = document.createElement('button');
              removeVersionBtn.type = 'button';
              removeVersionBtn.className = 'member-create-secondary-btn';
              removeVersionBtn.textContent = 'Remove Version';
              removeVersionBtn.addEventListener('click', ()=>{
                if(time.versions.length <= 1){
                  version.name = '';
                  versionNameInput.value = '';
                  version.tiers.forEach(tier => {
                    tier.name = '';
                    tier.currency = '';
                    tier.price = '';
                  });
                  tierList.innerHTML = '';
                  version.tiers.forEach(addTierRow);
                  return;
                }
                const idx = time.versions.indexOf(version);
                if(idx !== -1){
                  time.versions.splice(idx, 1);
                }
                versionCard.remove();
              });
              versionActions.append(addTierBtn, removeVersionBtn);
              versionCard.appendChild(versionActions);
              versionList.appendChild(versionCard);
            }

            if(!Array.isArray(time.versions) || !time.versions.length){
              time.versions = [venueSessionCreateVersion()];
            }
            time.versions.forEach(addVersionCard);

            const timeActions = document.createElement('div');
            timeActions.className = 'member-time-actions';
            const addVersionBtn = document.createElement('button');
            addVersionBtn.type = 'button';
            addVersionBtn.className = 'member-create-secondary-btn';
            addVersionBtn.textContent = 'Add Version';
            addVersionBtn.addEventListener('click', ()=>{
              const version = venueSessionCreateVersion();
              time.versions.push(version);
              addVersionCard(version);
            });
            timeActions.appendChild(addVersionBtn);
            timeCard.appendChild(timeActions);
            timeList.appendChild(timeCard);
          }

          if(!Array.isArray(session.times) || !session.times.length){
            session.times = [venueSessionCreateTime()];
          }
          session.times.forEach(addTimeCard);

          const sessionActions = document.createElement('div');
          sessionActions.className = 'member-session-actions';
          const addTimeBtn = document.createElement('button');
          addTimeBtn.type = 'button';
          addTimeBtn.className = 'member-create-secondary-btn';
          addTimeBtn.textContent = 'Add Time Slot';
          addTimeBtn.addEventListener('click', ()=>{
            const time = venueSessionCreateTime();
            session.times.push(time);
            addTimeCard(time);
          });
          sessionActions.appendChild(addTimeBtn);
          sessionCard.appendChild(sessionActions);
          sessionList.appendChild(sessionCard);
        }

        if(!Array.isArray(venue.sessions) || !venue.sessions.length){
          venue.sessions = [venueSessionCreateSession()];
        }
        venue.sessions.forEach(addSessionCard);

        const venueActions = document.createElement('div');
        venueActions.className = 'member-venue-actions';
        const addSessionBtn = document.createElement('button');
        addSessionBtn.type = 'button';
        addSessionBtn.className = 'member-create-secondary-btn';
        addSessionBtn.textContent = 'Add Session';
        addSessionBtn.addEventListener('click', ()=>{
          const session = venueSessionCreateSession();
          venue.sessions.push(session);
          addSessionCard(session);
        });
        const removeVenueBtn = document.createElement('button');
        removeVenueBtn.type = 'button';
        removeVenueBtn.className = 'member-create-secondary-btn';
        removeVenueBtn.textContent = 'Remove Venue';
        removeVenueBtn.addEventListener('click', ()=>{
          if(venues.length <= 1){
            venue.name = '';
            venue.address = '';
            nameInput.value = '';
            addressInput.value = '';
            return;
          }
          const idx = venues.indexOf(venue);
          if(idx !== -1){
            venues.splice(idx, 1);
          }
          venueCard.remove();
        });
        venueActions.append(addSessionBtn, removeVenueBtn);

        venueCard.append(venueHeader, sessionList, venueActions);
        if(addVenueBtn){
          venueList.insertBefore(venueCard, addVenueBtn);
        } else {
          venueList.appendChild(venueCard);
        }
      }

      venues.forEach(addVenueCard);

      addVenueBtn = document.createElement('button');
      addVenueBtn.type = 'button';
      addVenueBtn.className = 'member-create-secondary-btn';
      addVenueBtn.textContent = 'Add Venue';
      addVenueBtn.addEventListener('click', ()=>{
        const venue = venueSessionCreateVenue();
        venues.push(venue);
        addVenueCard(venue);
      });
      venueList.appendChild(addVenueBtn);

      return venueList;
    }

    function buildMemberCreateField(field, index){
      const wrapper = document.createElement('div');
      wrapper.className = 'panel-field member-create-field';
      const label = document.createElement('label');
      const labelText = field.name && field.name.trim() ? field.name.trim() : `Field ${index + 1}`;
      const labelId = `memberCreateFieldLabel-${++fieldIdCounter}`;
      const controlId = `memberCreateField-${fieldIdCounter}`;
      label.id = labelId;
      label.textContent = field.required ? `${labelText} *` : labelText;
      wrapper.appendChild(label);
      let control = null;
      const placeholder = field.placeholder || '';

      if(field.type === 'description' || field.type === 'text-area'){
        const textarea = document.createElement('textarea');
        textarea.id = controlId;
        textarea.rows = field.type === 'description' ? 6 : 4;
        textarea.placeholder = placeholder;
        if(field.required) textarea.required = true;
        control = textarea;
      } else if(field.type === 'dropdown'){
        const select = document.createElement('select');
        select.id = controlId;
        if(field.required) select.required = true;
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = placeholder || 'Select an option';
        select.appendChild(placeholderOption);
        field.options.forEach(optionValue => {
          const option = document.createElement('option');
          option.value = optionValue;
          option.textContent = optionValue || 'Option';
          select.appendChild(option);
        });
        control = select;
      } else if(field.type === 'radio-toggle'){
        const radioGroup = document.createElement('div');
        radioGroup.className = 'member-radio-group';
        radioGroup.setAttribute('role', 'radiogroup');
        radioGroup.setAttribute('aria-labelledby', labelId);
        const radioName = `member-create-radio-${fieldIdCounter}`;
        field.options.forEach((optionValue, optionIndex)=>{
          const radioLabel = document.createElement('label');
          radioLabel.className = 'member-radio-option';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = radioName;
          radio.value = optionValue;
          if(field.required && optionIndex === 0) radio.required = true;
          radioLabel.append(radio, document.createTextNode(optionValue || `Option ${optionIndex + 1}`));
          radioGroup.appendChild(radioLabel);
        });
        control = radioGroup;
        label.removeAttribute('for');
      } else if(field.type === 'images'){
        const fileInput = document.createElement('input');
        fileInput.id = controlId;
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        if(field.required) fileInput.required = true;
        control = fileInput;
      } else if(field.type === 'version-price'){
        control = buildVersionPriceEditor(field, labelId);
        label.removeAttribute('for');
      } else if(field.type === 'venue-session-version-tier-price'){
        control = buildVenueSessionEditor(field, labelId);
        label.removeAttribute('for');
      } else if(field.type === 'website-url' || field.type === 'tickets-url'){
        const input = document.createElement('input');
        input.id = controlId;
        input.type = 'url';
        input.placeholder = placeholder || 'https://example.com';
        input.autocomplete = 'url';
        if(field.required) input.required = true;
        control = input;
      } else {
        const input = document.createElement('input');
        input.id = controlId;
        if(field.type === 'email'){
          input.type = 'email';
          input.autocomplete = 'email';
        } else if(field.type === 'phone'){
          input.type = 'tel';
          input.autocomplete = 'tel';
        } else {
          input.type = 'text';
        }
        input.placeholder = placeholder;
        if(field.required) input.required = true;
        control = input;
      }

      if(control){
        wrapper.appendChild(control);
      }
      return wrapper;
    }

    function renderCreateFields(){
      const categoryName = categorySelect ? categorySelect.value : '';
      const subcategoryName = subcategorySelect ? subcategorySelect.value : '';
      if(!categoryName || !subcategoryName){
        renderEmptyState();
        return;
      }
      const fields = getFieldsForSelection(categoryName, subcategoryName);
      fieldIdCounter = 0;
      formFields.innerHTML = '';
      if(fields.length === 0){
        const placeholder = document.createElement('p');
        placeholder.className = 'member-create-placeholder';
        placeholder.textContent = 'No fields configured for this subcategory yet.';
        formFields.appendChild(placeholder);
      } else {
        fields.forEach((field, index)=>{
          const fieldEl = buildMemberCreateField(field, index);
          if(fieldEl) formFields.appendChild(fieldEl);
        });
      }
      if(emptyState) emptyState.hidden = true;
      if(formWrapper) formWrapper.hidden = false;
      if(checkoutContainer) checkoutContainer.hidden = false;
      if(postButton) postButton.disabled = false;
      updatePaypalContainer(false);
    }

    function populateSubcategoryOptions(preserveValue){
      if(!subcategorySelect) return;
      const categoryName = categorySelect ? categorySelect.value : '';
      subcategorySelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = categoryName ? 'Select Subcategory' : 'Select Category First';
      subcategorySelect.appendChild(placeholder);
      if(!categoryName){
        subcategorySelect.disabled = true;
        renderEmptyState();
        return;
      }
      const category = memberCategories.find(cat => cat && typeof cat.name === 'string' && cat.name === categoryName);
      if(!category){
        subcategorySelect.disabled = true;
        renderEmptyState();
        return;
      }
      subcategorySelect.disabled = false;
      const previous = preserveValue ? subcategorySelect.dataset.lastSelected || '' : '';
      (Array.isArray(category.subs) ? category.subs : []).forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        subcategorySelect.appendChild(option);
      });
      if(previous && Array.isArray(category.subs) && category.subs.includes(previous)){
        subcategorySelect.value = previous;
      } else {
        subcategorySelect.value = '';
      }
      renderCreateFields();
    }

    function populateCategoryOptions(preserveSelection){
      if(!categorySelect) return;
      const previous = preserveSelection ? categorySelect.value : '';
      categorySelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select Category';
      categorySelect.appendChild(placeholder);
      memberCategories.forEach(cat => {
        if(!cat || typeof cat.name !== 'string') return;
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
      });
      if(previous && memberCategories.some(cat => cat && cat.name === previous)){
        categorySelect.value = previous;
      } else {
        categorySelect.value = '';
      }
      populateSubcategoryOptions(preserveSelection && !!categorySelect.value);
    }

    if(categorySelect){
      categorySelect.addEventListener('change', ()=>{
        populateSubcategoryOptions(false);
      });
    }
    if(subcategorySelect){
      subcategorySelect.addEventListener('change', ()=>{
        subcategorySelect.dataset.lastSelected = subcategorySelect.value;
        renderCreateFields();
      });
    }
    if(listingPrice){
      listingPrice.addEventListener('blur', ()=>{
        listingPrice.value = formatPriceValue(listingPrice.value);
      });
    }
    if(adminListingPrice){
      adminListingPrice.addEventListener('blur', ()=>{
        adminListingPrice.value = formatPriceValue(adminListingPrice.value);
      });
    }
    if(paypalButton){
      paypalButton.addEventListener('click', ()=>{
        updatePaypalContainer(true);
      });
    }
    if(adminPaypalClientId){
      adminPaypalClientId.addEventListener('input', ()=> updatePaypalContainer(false));
    }
    if(adminPaypalClientSecret){
      adminPaypalClientSecret.addEventListener('input', ()=> updatePaypalContainer(false));
    }

    if(typeof formbuilderCats !== 'undefined' && formbuilderCats){
      formbuilderCats.addEventListener('change', ()=>{
        refreshMemberSnapshot();
        populateCategoryOptions(true);
      });
    }

    populateCategoryOptions(true);
    updatePaypalContainer(false);
  }

  const colorAreas = [
    {key:'header', label:'Header', selectors:{bg:['.header'], text:['.header']}},
    {key:'body', label:'Body', selectors:{bg:['body'], border:[], hoverBorder:[], activeBorder:[]}},
    {key:'list', label:'List', selectors:{bg:['.quick-list-board'], text:['.quick-list-board'], title:['.quick-list-board .recents-card .t','.quick-list-board .recents-card .title'], btn:['.quick-list-board button','.quick-list-board .sq','.quick-list-board .tiny','.quick-list-board .btn'], btnText:['.quick-list-board button','.quick-list-board .sq','.quick-list-board .tiny','.quick-list-board .btn'], card:['.quick-list-board .recents-card']}},
    {key:'post-board', label:'Closed Posts', selectors:{bg:['.post-board'], text:['.post-board','.post-board .posts'], title:['.post-board .post-card .t','.post-board .post-card .title','.post-board .open-post .t','.post-board .open-post .title'], btn:['.post-board button'], btnText:['.post-board button'], card:['.post-board .post-card','.post-board .open-post']}},
    {key:'open-post', label:'Open Posts', selectors:{text:['.open-post','.open-post .venue-info','.open-post .session-info'], title:['.open-post .t','.open-post .title'], btn:['.open-post button'], btnText:['.open-post button'], card:['.open-post'], header:['.open-post .post-header'], image:['.open-post .image-box'], menu:['.open-post .venue-menu button','.open-post .session-menu button']}},
    {key:'map', label:'Map', selectors:{popupBg:['.mapboxgl-popup.big-map-card .mapboxgl-popup-content','.mapboxgl-popup.big-map-card .big-map-card','.mapboxgl-popup.big-map-card .chip','.mapboxgl-popup.big-map-card .chip-small','.mapboxgl-popup.big-map-card .map-card-list-item'], popupText:['.mapboxgl-popup.big-map-card .big-map-card','.mapboxgl-popup.big-map-card .map-card-title','.mapboxgl-popup.big-map-card .map-card-venue','.mapboxgl-popup.big-map-card .chip','.mapboxgl-popup.big-map-card .chip-small','.mapboxgl-popup.big-map-card .map-card-list-item'], title:['.mapboxgl-popup.big-map-card .map-card-title','.mapboxgl-popup.big-map-card .chip .t','.mapboxgl-popup.big-map-card .chip .title','.mapboxgl-popup.big-map-card .chip-small .t','.mapboxgl-popup.big-map-card .chip-small .title']}},
    {key:'filter', label:'Filter Panel', selectors:{bg:['#filterPanel .panel-content'], text:['#filterPanel .panel-content'], title:['#filterPanel .panel-content .t','#filterPanel .panel-content .title'], btn:['#filterPanel button:not([class*="mapboxgl-"])','#filterPanel .sq','#filterPanel .tiny'], btnText:['#filterPanel button:not([class*="mapboxgl-"])','#filterPanel .sq','#filterPanel .tiny']}},
    {key:'calendar', label:'Calendar', selectors:{bg:['.calendar'], text:['.calendar .day'], weekday:['.calendar .weekday'], title:['.calendar .calendar-header'], header:['.calendar .calendar-header']}},
  {key:'adminPanel', label:'Admin Panel', selectors:{bg:['#adminPanel .panel-content'], text:['#adminPanel .panel-content'], title:['#adminPanel .panel-content .t','#adminPanel .panel-content .title'], btn:['#adminPanel button','#adminPanel #spinType span'], btnText:['#adminPanel button','#adminPanel #spinType span']}},
  {key:'welcome-modal', label:'Welcome Modal', selectors:{bg:['#welcome-modal .modal-content'], text:['#welcome-modal .modal-content'], title:['#welcome-modal .modal-content .t','#welcome-modal .modal-content .title'], btn:['#welcome-modal button:not([class*"mapboxgl-"])'], btnText:['#welcome-modal button:not([class*"mapboxgl-"])']}},
  {key:'memberPanel', label:'Member Panel', selectors:{bg:['#memberPanel .panel-content'], text:['#memberPanel .panel-content'], title:['#memberPanel .panel-content .t','#memberPanel .panel-content .title'], btn:['#memberPanel button'], btnText:['#memberPanel button']}},
  {key:'imagePanel', label:'Image Modal', selectors:{bg:['.image-modal-container'], text:['.image-modal-container .image-modal']}}
];

  function storeTitleDefaults(){
    colorAreas.forEach(area=>{
      (area.selectors.title||[]).forEach(sel=>{
        document.querySelectorAll(sel).forEach(el=>{
          const cs = getComputedStyle(el);
          el.dataset.titleDefaultColor = cs.color;
          el.dataset.titleDefaultFont = cs.fontFamily;
          el.dataset.titleDefaultSize = cs.fontSize;
          el.dataset.titleDefaultWeight = cs.fontWeight;
          el.dataset.titleDefaultShadow = cs.textShadow;
        });
      });
    });
    const varMap = {'today-c':'--today', 'sessionAvailable-c':'--session-available', 'sessionSelected-c':'--session-selected'};
    Object.entries(varMap).forEach(([id,varName])=>{
      const el = document.getElementById(id);
      if(el){
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        if(val) el.value = val;
      }
    });
  }

  function restoreTitleDefaults(area){
    (area.selectors.title||[]).forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        if(el.dataset.titleDefaultColor) el.style.color = el.dataset.titleDefaultColor;
        if(el.dataset.titleDefaultFont) el.style.fontFamily = el.dataset.titleDefaultFont;
        if(el.dataset.titleDefaultSize) el.style.fontSize = el.dataset.titleDefaultSize;
        if(el.dataset.titleDefaultWeight) el.style.fontWeight = el.dataset.titleDefaultWeight;
        if(el.dataset.titleDefaultShadow) el.style.textShadow = el.dataset.titleDefaultShadow;
      });
    });
  }

  storeTitleDefaults();

  const headerEl = document.querySelector('.header');
  if(headerEl && 'ResizeObserver' in window){
    const headerObserver = new ResizeObserver(()=>{
      updateLayoutVars();
    });
    headerObserver.observe(headerEl);
  }

  window.addEventListener('resize', updateLayoutVars);
  window.addEventListener('resize', updateStickyImages);
  window.addEventListener('load', updateLayoutVars);
  updateLayoutVars();
  if (typeof updateStickyImages === 'function') {
    updateStickyImages();
  }
  if(typeof window.__wrapForInputYield === 'function'){
    ['openPost','updateVenue','togglePanel','ensureMapForVenue'].forEach(name => window.__wrapForInputYield(name));
  }
})();


// Extracted from <script>
(function(){
  const ICON_BASE = window.ICON_BASE || {};
  const subcategoryIcons = window.subcategoryIcons || (window.subcategoryIcons = {});
  const subcategoryMarkers = window.subcategoryMarkers || (window.subcategoryMarkers = {});
  const subcategoryMarkerIds = window.subcategoryMarkerIds || (window.subcategoryMarkerIds = {});
  const categoryShapes = window.categoryShapes || (window.categoryShapes = {});
  let colorIdx = 0;
  const cats = window.categories || [];
  cats.forEach((cat) => {
    if (cat && cat.name) {
      categoryShapes[cat.name] = categoryShapes[cat.name] || null;
    }
    cat.subs.forEach(sub => {
      const color = window.COLOR_NAMES[colorIdx % window.COLOR_NAMES.length];
      colorIdx++;
      const slug = slugify(sub);
      const iconPrefix = ICON_BASE[cat.name];
      const icon20 = `assets/icons-20/${iconPrefix}-${color}-20.webp`;
      const icon30 = `assets/icons-30/${iconPrefix}-${color}-30.webp`;
      subcategoryIcons[sub] = `<img src="${icon20}" width="20" height="20" alt="">`;
      subcategoryMarkerIds[sub] = slug;
      subcategoryMarkers[slug] = icon30;
    });
  });
  const specialSubIconPaths = {
    'Other Events': {
      icon20: 'assets/icons-20/whats-on-category-icon-red-20.webp',
      icon30: 'assets/icons-30/whats-on-category-icon-red-30.webp'
    },
    'Other Opportunities': {
      icon20: 'assets/icons-20/opportunities-category-icon-red-20.webp',
      icon30: 'assets/icons-30/opportunities-category-icon-red-30.webp'
    },
    'Other Learning': {
      icon20: 'assets/icons-20/learning-category-icon-red-20.webp',
      icon30: 'assets/icons-30/learning-category-icon-red-30.webp'
    }
  };
  Object.entries(specialSubIconPaths).forEach(([name, paths]) => {
    subcategoryIcons[name] = `<img src="${paths.icon20}" width="20" height="20" alt="">`;
    const slug = subcategoryMarkerIds[name] || slugify(name);
    subcategoryMarkers[slug] = paths.icon30;
    subcategoryMarkers[name] = paths.icon30;
  });
  document.dispatchEvent(new CustomEvent('subcategory-icons-ready'));
  if(window.postsLoaded && window.__markersLoaded){ addPostSource(); }
})();


// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('welcomeMessageEditor');
  const hidden = document.getElementById('welcomeMessage');
  if(editor && hidden){
    const placeholder = editor.getAttribute('data-placeholder') || '';
    hidden.value = hidden.value || placeholder;
    editor.innerHTML = hidden.value;
    editor.addEventListener('input', () => hidden.value = editor.innerHTML);
    document.querySelectorAll('.wysiwyg-toolbar button').forEach(btn => {
      btn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        editor.focus();
        document.execCommand(btn.dataset.command, false, null);
        hidden.value = editor.innerHTML;
      });
    });
  }
});


// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#adminPanel input[type="checkbox"]').forEach(cb => {
    if (cb.closest('.switch')) return;
    if (cb.closest('.subcategory-form-toggle')) return;
    const wrapper = document.createElement('label');
    wrapper.className = 'switch';
    cb.parentNode.insertBefore(wrapper, cb);
    wrapper.appendChild(cb);
    const slider = document.createElement('span');
    slider.className = 'slider';
    cb.after(slider);
  });
});


// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  const colorInput = document.getElementById('postModeBgColor');
  const opacityInput = document.getElementById('postModeBgOpacity');
  const opacityVal = document.getElementById('postModeBgOpacityVal');
  const root = document.documentElement;
  const settings = JSON.parse(localStorage.getItem('admin-settings-current') || '{}');
  function hexToRgb(hex){
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  function apply(){
    const color = colorInput.value || '#000000';
    const opacity = opacityInput.value;
    root.style.setProperty('--post-mode-bg-color', hexToRgb(color));
    root.style.setProperty('--post-mode-bg-opacity', opacity);
    opacityVal.textContent = Number(opacity).toFixed(2);
  }

  if(colorInput && opacityInput && opacityVal){
    colorInput.value = settings.postModeBgColor || '#000000';
    opacityInput.value = settings.postModeBgOpacity ?? 0;
    apply();
    const save = () => {
      settings.postModeBgColor = colorInput.value;
      settings.postModeBgOpacity = opacityInput.value;
      localStorage.setItem('admin-settings-current', JSON.stringify(settings));
    };
    colorInput.addEventListener('input', () => { apply(); save(); });
    opacityInput.addEventListener('input', () => { apply(); save(); });
    const prev = window.saveAdminChanges;
    window.saveAdminChanges = () => { save(); if(typeof prev === 'function') prev(); };
  }
});


// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  const vp = document.getElementById('viewport');
  const updateViewport = () => {
    if (!vp) return;
    if (window.innerWidth < 650) {
      vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    } else {
      vp.setAttribute('content','width=device-width, initial-scale=1');
    }
  };
  updateViewport();
  window.addEventListener('resize', updateViewport);
  window.addEventListener('orientationchange', updateViewport);

  const fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) {
    const docEl = document.documentElement;
    const canFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;
    if (!canFS || enabled === false) {
      fsBtn.style.display = 'none';
    } else {
      const getFull = () => document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      const updateFsState = () => {
        fsBtn.setAttribute('aria-pressed', getFull() ? 'true' : 'false');
      };
      updateFsState();
      ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(evt => {
        document.addEventListener(evt, updateFsState);
      });
      fsBtn.addEventListener('click', () => {
        const isFull = getFull();
        if (!isFull) {
          const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
          if (req) {
            try {
              const result = req.call(docEl);
              if (result && typeof result.catch === 'function') result.catch(() => {});
            } catch (err) {
              updateFsState();
            }
          }
        } else {
          const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          if (exit) {
            try {
              const result = exit.call(document);
              if (result && typeof result.catch === 'function') result.catch(() => {});
            } catch (err) {
              updateFsState();
            }
          }
        }
      });
    }
  }

  if (window.innerWidth >= 650) return;

  const posts = document.querySelector('.post-board');
  if (!posts) return;

  let defaultSize = parseFloat(getComputedStyle(posts).fontSize);
  let startDist = null;
  let enlarged = false;

  function distance(t1, t2){
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  posts.addEventListener('touchstart', e => {
    if (e.target.tagName === 'IMG') return;
    if (e.touches.length === 2) {
      startDist = distance(e.touches[0], e.touches[1]);
    }
  });

  posts.addEventListener('touchmove', e => {
    if (e.target.tagName === 'IMG') return;
    if (e.touches.length === 2 && startDist) {
      const scale = distance(e.touches[0], e.touches[1]) / startDist;
      if (!enlarged && scale > 1.2) {
        posts.style.fontSize = (defaultSize * 1.2) + 'px';
        enlarged = true;
      } else if (enlarged && scale < 0.8) {
        posts.style.fontSize = defaultSize + 'px';
        enlarged = false;
      }
      e.preventDefault();
    }
  }, { passive: false });

  posts.addEventListener('touchend', e => {
    if (e.touches.length < 2) startDist = null;
  });

  posts.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', e => { e.stopPropagation(); openImageModal(img.src, {origin: img}); });
    img.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        openImageModal(img.src, {origin: img});
      }
    }, { passive: false });
  });
});


// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="color"]').forEach(el => {
    if(!el.value) el.value = '#000000';
  });
});


// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('wheel', e => {
    if(e.target.closest('.post-board, .panel-content, .options-menu, .calendar-scroll')){
      e.stopPropagation();
    }
  });
  const postsPanel = document.querySelector('.post-board');
  const postsBg = document.querySelector('.post-mode-background');
  if(postsPanel){
    postsPanel.addEventListener('click', e => {
      if(e.target === postsPanel || e.target.classList.contains('posts')){
        e.stopPropagation();
      }
    });
  }
  if(postsBg){
    postsBg.addEventListener('click', e => e.stopPropagation());
  }
});


// Extracted from <script>
let boardAdjustCleanup = null;

function ensureImageModalReady(){
  const container = document.querySelector('.image-modal-container');
  if(!container) return {container:null, modal:null};
  const modal = container.querySelector('.image-modal');
  if(!container._listenerAdded){
    container.addEventListener('click', e => {
      if(e.target === container){
        closeImageModal(container);
      }
    });
    container._listenerAdded = true;
  }
  if(modal && !modal._closeListenerAdded){
    modal.addEventListener('click', e => {
      if(!e.target.closest('img')){
        closeImageModal(container);
      }
    });
    modal._closeListenerAdded = true;
  }
  return {container, modal};
}

function closeImageModal(container){
  const target = container || ensureImageModalReady().container;
  if(!target) return;
  const modal = target.querySelector('.image-modal');
  if(modal) modal.innerHTML = '';
  target.classList.add('hidden');
  if(target.dataset){
    delete target.dataset.activeSrc;
    delete target.dataset.activeIndex;
  }
  target._imageModalState = null;
  target._imageModalImg = null;
}

function advanceImageModal(container, modal, step=1){
  if(!container || !modal) return;
  const state = container._imageModalState;
  if(!state || !Array.isArray(state.images) || state.images.length <= 1) return;
  const len = state.images.length;
  state.index = ((state.index + step) % len + len) % len;
  renderImageModalImage(container, modal);
}

function renderImageModalImage(container, modal){
  if(!container || !modal) return;
  const state = container._imageModalState;
  if(!state || !Array.isArray(state.images) || !state.images.length) return;
  let img = container._imageModalImg;
  if(!img || img.parentNode !== modal){
    modal.innerHTML = '';
    img = document.createElement('img');
    img.addEventListener('click', e => {
      e.stopPropagation();
      advanceImageModal(container, modal, 1);
    });
    container._imageModalImg = img;
    modal.appendChild(img);
  }
  const src = state.images[state.index];
  if(img.getAttribute('src') !== src){
    img.src = src;
  }
  if(container.dataset){
    container.dataset.activeSrc = src;
    container.dataset.activeIndex = String(state.index);
  }
}

function normalizeImageModalSrc(value){
  if(!value) return '';
  try {
    return new URL(value, window.location.href).href;
  } catch(err){
    return String(value);
  }
}

function resolveImageModalContext(config){
  const result = {images: [], index: 0, gallery: null};
  if(!config) return result;
  const src = typeof config.src === 'string' ? config.src : '';
  const providedImages = Array.isArray(config.images) ? config.images.filter(Boolean) : null;
  const originEl = config.origin instanceof Element ? config.origin : null;
  let galleryRoot = config.gallery instanceof Element ? config.gallery : null;
  const findGalleryFrom = el => {
    if(!el) return null;
    const fromImageBox = el.closest && el.closest('.image-box');
    if(fromImageBox) return fromImageBox;
    const postImages = el.closest && el.closest('.post-images');
    if(postImages){
      const box = postImages.querySelector('.image-box');
      if(box) return box;
    }
    const openPost = el.closest && el.closest('.open-post');
    if(openPost){
      const box = openPost.querySelector('.image-box');
      if(box) return box;
    }
    return null;
  };
  if(!galleryRoot && originEl){
    galleryRoot = findGalleryFrom(originEl);
  }
  let images = providedImages && providedImages.length ? providedImages.slice() : null;
  if((!images || !images.length) && galleryRoot){
    if(Array.isArray(galleryRoot._modalImages) && galleryRoot._modalImages.length){
      images = galleryRoot._modalImages.slice();
    } else if(galleryRoot.dataset && galleryRoot.dataset.modalImages){
      try {
        const parsed = JSON.parse(galleryRoot.dataset.modalImages);
        if(Array.isArray(parsed) && parsed.length){
          images = parsed.slice();
        }
      } catch(err){}
    }
  }
  if((!images || !images.length) && galleryRoot){
    const trackImgs = Array.from(galleryRoot.querySelectorAll('.image-track img'));
    if(trackImgs.length){
      images = trackImgs.map(im => (im.dataset && im.dataset.full) ? im.dataset.full : im.src);
    }
  }
  if(!images || !images.length){
    images = src ? [src] : [];
  }
  let index = null;
  if(typeof config.startIndex === 'number' && Number.isFinite(config.startIndex)){
    index = config.startIndex;
  } else if(typeof config.startIndex === 'string'){
    const parsedStart = parseInt(config.startIndex, 10);
    if(Number.isFinite(parsedStart)){
      index = parsedStart;
    }
  }
  const originImg = originEl && originEl.tagName === 'IMG' ? originEl : (originEl && originEl.querySelector ? originEl.querySelector('img') : null);
  if(index === null && originImg && originImg.dataset && originImg.dataset.index){
    const parsed = parseInt(originImg.dataset.index, 10);
    if(Number.isFinite(parsed)){
      index = parsed;
    }
  }
  if(index === null && galleryRoot && galleryRoot.dataset && galleryRoot.dataset.index){
    const parsed = parseInt(galleryRoot.dataset.index, 10);
    if(Number.isFinite(parsed)){
      index = parsed;
    }
  }
  if(index === null && src){
    const found = images.indexOf(src);
    if(found !== -1){
      index = found;
    } else {
      const normalizedSrc = normalizeImageModalSrc(src);
      for(let i=0;i<images.length;i++){
        if(normalizeImageModalSrc(images[i]) === normalizedSrc){
          index = i;
          break;
        }
      }
    }
  }
  if(index === null){
    index = 0;
  }
  index = Math.max(0, Math.min(index, images.length ? images.length - 1 : 0));
  result.images = images;
  result.index = index;
  result.gallery = galleryRoot;
  return result;
}

function openImageModal(srcOrConfig, options){
  const base = (typeof srcOrConfig === 'object' && srcOrConfig !== null && !Array.isArray(srcOrConfig))
    ? Object.assign({}, srcOrConfig)
    : {src: srcOrConfig};
  if(options && typeof options === 'object'){
    Object.assign(base, options);
  }
  if(typeof base.src !== 'string' || !base.src){
    return;
  }
  const {container, modal} = ensureImageModalReady();
  if(!container || !modal) return;
  document.querySelectorAll('.image-modal-container').forEach(other => {
    if(other !== container && !other.classList.contains('hidden')){
      closeImageModal(other);
    }
  });
  const context = resolveImageModalContext(base);
  if(!context.images.length) return;
  container._imageModalState = {
    images: context.images.slice(),
    index: context.index,
    gallery: context.gallery || null
  };
  renderImageModalImage(container, modal);
  container.classList.remove('hidden');
}

function initPostLayout(board){
  if(typeof boardAdjustCleanup === 'function'){
    boardAdjustCleanup();
    boardAdjustCleanup = null;
  }
  const scheduleMapResize = mapInstance => {
    if(!mapInstance) return;
    if(typeof mapInstance.resize === 'function'){
      requestAnimationFrame(()=>{
        try { mapInstance.resize(); } catch(err){}
      });
    }
  };
  if(!(board instanceof Element)){
    document.documentElement.style.removeProperty('--post-header-h');
    if(typeof window.adjustBoards === 'function') window.adjustBoards();
    return;
  }
  const openPost = board.querySelector('.open-post');
  if(!openPost){
    document.body.classList.remove('detail-open');
    document.body.classList.remove('hide-map-calendar');
    document.documentElement.style.removeProperty('--post-header-h');
    if(typeof window.adjustBoards === 'function') window.adjustBoards();
    return;
  }
  document.body.classList.add('detail-open');
  document.body.classList.remove('hide-map-calendar');
  const postBody = openPost.querySelector('.post-body');
  if(postBody){
    postBody.removeAttribute('hidden');
    postBody.classList.remove('is-visible');
    if(postBody.dataset) delete postBody.dataset.openPostId;
  }
  const triggerDetailMapResize = target => {
    if(!target) return;
    const mapNode = target.querySelector ? target.querySelector('.post-map') : null;
    const ref = target._detailMap || (mapNode && mapNode._detailMap) || null;
    const mapInstance = ref && ref.map;
    if(mapInstance && typeof mapInstance.resize === 'function'){
      scheduleMapResize(mapInstance);
    }
  };
  triggerDetailMapResize(postBody);
  const thumbRow = postBody ? postBody.querySelector('.thumbnail-row') : null;
  const selectedImageBox = postBody ? postBody.querySelector('.selected-image, .image-box') : null;
  ensureImageModalReady();
  if(thumbRow){
    thumbRow.scrollLeft = 0;
  }
  if(thumbRow && !thumbRow._imageModalListener){
    thumbRow.addEventListener('dblclick', e => {
      const img = e.target.closest('img');
      if(img){
        e.preventDefault();
        e.stopPropagation();
        openImageModal(img.src, {origin: img});
      }
    });
    thumbRow._imageModalListener = true;
  }
  if(selectedImageBox && !selectedImageBox._imageModalListener){
    selectedImageBox.addEventListener('click', evt => {
      const currentTarget = (evt && evt.currentTarget instanceof Element)
        ? evt.currentTarget
        : selectedImageBox;
      const clickedImageBox = (evt && evt.target instanceof Element)
        ? evt.target.closest('.image-box')
        : null;
      if(clickedImageBox){
        return;
      }
      const parseIndex = value => {
        if(typeof value === 'undefined') return null;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      };
      let galleryRoot = null;
      if(currentTarget instanceof Element){
        if(currentTarget.classList.contains('image-box')){
          galleryRoot = currentTarget;
        } else {
          const postImages = typeof currentTarget.closest === 'function'
            ? currentTarget.closest('.post-images')
            : null;
          const parent = currentTarget.parentElement;
          const host = postImages || parent;
          if(host instanceof Element){
            galleryRoot = host.querySelector('.image-box');
          }
        }
      }
      const activeImg = galleryRoot ? galleryRoot.querySelector('.image-track img.active') : null;
      let img = activeImg || (currentTarget instanceof Element ? currentTarget.querySelector('img') : null);
      if(!img && galleryRoot){
        img = galleryRoot.querySelector('img');
      }
      if(!(img instanceof Element)){
        return;
      }
      if(evt && typeof evt.preventDefault === 'function') evt.preventDefault();
      if(evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
      let startIndex = null;
      if(activeImg && activeImg.dataset){
        startIndex = parseIndex(activeImg.dataset.index);
      }
      if(startIndex === null && galleryRoot && galleryRoot.dataset){
        startIndex = parseIndex(galleryRoot.dataset.index);
      }
      if(startIndex === null && img.dataset){
        startIndex = parseIndex(img.dataset.index);
      }
      const options = {origin: img};
      if(galleryRoot){
        options.gallery = galleryRoot;
      }
      if(startIndex !== null){
        options.startIndex = startIndex;
      }
      const src = (img.dataset && img.dataset.full) ? img.dataset.full : img.src;
      openImageModal(src, options);
    });
    selectedImageBox._imageModalListener = true;
  }
  if(typeof updateStickyImages === 'function'){
    updateStickyImages();
  }
  const updateMetrics = () => {
    if(typeof updateStickyImages === 'function'){
      updateStickyImages();
    }
    if(openPost){
      const header = openPost.querySelector('.post-header');
      if(header){
        document.documentElement.style.setProperty('--post-header-h', header.offsetHeight + 'px');
      } else {
        document.documentElement.style.removeProperty('--post-header-h');
      }
    }
    triggerDetailMapResize(postBody);
    if(typeof window.adjustBoards === 'function') window.adjustBoards();
  };
  updateMetrics();
  window.addEventListener('resize', updateMetrics);
  window.addEventListener('load', updateMetrics);
  boardAdjustCleanup = () => {
    window.removeEventListener('resize', updateMetrics);
    window.removeEventListener('load', updateMetrics);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initPostLayout(document.querySelector('.post-board'));
});


// Extracted from <script>
(function(){
  const MESSAGE = 'Please enter a valid URL with a dot and letters after it.';
  const DOT_PATTERN = /\.[A-Za-z]{2,}(?=[^A-Za-z]|$)/;
  const processed = new WeakSet();
  let observerStarted = false;

  function normalizeUrl(value){
    const raw = typeof value === 'string' ? value.trim() : '';
    if(!raw) return '';
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
    const candidate = hasScheme ? raw : `https://${raw}`;
    try {
      const normalized = new URL(candidate);
      return normalized.href;
    } catch(err){
      return '';
    }
  }

  function disableLink(link){
    if(!link) return;
    link.setAttribute('aria-disabled','true');
    link.removeAttribute('href');
    link.tabIndex = -1;
  }

  function enableLink(link, href){
    if(!link) return;
    link.removeAttribute('aria-disabled');
    link.href = href;
    if(!link.hasAttribute('target')){
      link.target = '_blank';
    }
    const rel = link.getAttribute('rel') || '';
    const relParts = new Set(rel.split(/\s+/).filter(Boolean));
    relParts.add('noopener');
    relParts.add('noreferrer');
    link.setAttribute('rel', Array.from(relParts).join(' '));
    if(link.tabIndex < 0) link.tabIndex = 0;
  }

  function applyUrlBehavior(input){
    if(!(input instanceof HTMLInputElement)) return;
    if(processed.has(input)) return;
    processed.add(input);
    if(!input.dataset.urlMessage){
      input.dataset.urlMessage = MESSAGE;
    }
    input.setAttribute('pattern', '.*\\.[A-Za-z]{2,}.*');
    input.autocomplete = input.autocomplete || 'url';
    input.inputMode = input.inputMode || 'url';
    input.setAttribute('title', input.dataset.urlMessage);
    const linkId = input.dataset.urlLinkId || '';
    const link = linkId ? document.getElementById(linkId) : null;

    if(link){
      link.addEventListener('click', event => {
        if(link.getAttribute('aria-disabled') === 'true'){
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }

    const validate = ()=>{
      const value = input.value != null ? String(input.value).trim() : '';
      if(!value){
        input.setCustomValidity('');
        if(link) disableLink(link);
        return;
      }
      if(!DOT_PATTERN.test(value)){
        input.setCustomValidity(input.dataset.urlMessage || MESSAGE);
        if(link) disableLink(link);
        return;
      }
      const normalized = normalizeUrl(value);
      if(normalized){
        input.setCustomValidity('');
        if(link) enableLink(link, normalized);
      } else {
        input.setCustomValidity(input.dataset.urlMessage || MESSAGE);
        if(link) disableLink(link);
      }
    };

    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
    input.addEventListener('blur', validate);
    validate();
  }

  function scan(root){
    if(!root) return;
    const list = root.querySelectorAll ? root.querySelectorAll('input[data-url-type]') : [];
    list.forEach(applyUrlBehavior);
  }

  function startObserver(){
    if(observerStarted || !document.body) return;
    observerStarted = true;
    const observer = new MutationObserver(mutations => {
      for(const mutation of mutations){
        if(mutation.type === 'childList'){
          mutation.addedNodes.forEach(node => {
            if(!(node instanceof Element)) return;
            if(node.matches && node.matches('input[data-url-type]')){
              applyUrlBehavior(node);
            }
            if(node.querySelectorAll){
              node.querySelectorAll('input[data-url-type]').forEach(applyUrlBehavior);
            }
          });
        } else if(mutation.type === 'attributes'){
          const target = mutation.target;
          if(target instanceof HTMLInputElement && target.hasAttribute('data-url-type')){
            applyUrlBehavior(target);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-url-type']
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      scan(document);
      startObserver();
    }, { once: true });
  } else {
    scan(document);
    startObserver();
  }
})();


// Extracted from <script>
(function(){
  const DEFAULT_MAX = 10;
  const processed = new WeakSet();
  let observerStarted = false;
  let dragState = null;

  function handleThumbDragStart(event){
    const targetEl = event.target instanceof Element ? event.target : null;
    if(targetEl && targetEl.closest('.form-preview-image-remove')){
      event.preventDefault();
      return;
    }
    let thumb = targetEl ? targetEl.closest('.form-preview-image-thumb') : null;
    if(!thumb && event.currentTarget instanceof Element){
      thumb = event.currentTarget.closest('.form-preview-image-thumb');
    }
    if(!thumb) return;
    const previewEl = thumb ? thumb.parentElement : null;
    if(!previewEl || !previewEl._imageInput) return;
    const index = Number.parseInt(thumb.dataset.index || '', 10);
    dragState = {
      input: previewEl._imageInput,
      fromIndex: Number.isNaN(index) ? -1 : index,
      thumb
    };
    thumb.classList.add('is-dragging');
    if(event.dataTransfer){
      event.dataTransfer.effectAllowed = 'move';
      try{ event.dataTransfer.setData('text/plain', thumb.dataset.index || ''); }catch(err){}
    }
  }

  function handleThumbDragEnd(event){
    let thumb = event.target instanceof Element ? event.target.closest('.form-preview-image-thumb') : null;
    if(!thumb && event.currentTarget instanceof Element){
      thumb = event.currentTarget.closest('.form-preview-image-thumb');
    }
    if(!thumb) return;
    thumb.classList.remove('is-dragging');
    if(dragState && dragState.thumb === thumb){
      dragState = null;
    }
  }

  function handlePreviewDragOver(event){
    if(!dragState) return;
    const previewEl = event.currentTarget;
    if(!previewEl || previewEl._imageInput !== dragState.input) return;
    event.preventDefault();
    if(event.dataTransfer){
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handlePreviewDrop(event){
    if(!dragState) return;
    const previewEl = event.currentTarget;
    if(!previewEl || previewEl._imageInput !== dragState.input) return;
    event.preventDefault();
    event.stopPropagation();
    const files = getStoredFiles(dragState.input);
    const from = dragState.fromIndex;
    if(from < 0 || from >= files.length){
      if(dragState.thumb){
        dragState.thumb.classList.remove('is-dragging');
      }
      dragState = null;
      return;
    }
    let insertIndex = getDropInsertIndex(previewEl, event);
    if(!Number.isInteger(insertIndex) || insertIndex < 0){
      insertIndex = files.length;
    }
    const [moved] = files.splice(from, 1);
    if(insertIndex > files.length){
      insertIndex = files.length;
    }
    if(from < insertIndex){
      insertIndex--;
    }
    if(insertIndex < 0){
      insertIndex = 0;
    }
    files.splice(insertIndex, 0, moved);
    if(dragState.thumb){
      dragState.thumb.classList.remove('is-dragging');
    }
    const input = dragState.input;
    dragState = null;
    storeFiles(input, files);
    renderPreviews(input);
  }

  function getDropInsertIndex(previewEl, event){
    if(!previewEl) return 0;
    const thumbs = Array.from(previewEl.querySelectorAll('.form-preview-image-thumb'));
    if(thumbs.length === 0) return 0;
    const pointerX = event.clientX;
    const pointerY = event.clientY;
    let fallbackIndex = 0;
    for(const thumb of thumbs){
      if(dragState && dragState.thumb === thumb) continue;
      const rect = thumb.getBoundingClientRect();
      const datasetIndex = Number.parseInt(thumb.dataset.index || '', 10);
      if(Number.isNaN(datasetIndex)) continue;
      const centerX = rect.left + rect.width / 2;
      if(pointerY < rect.top){
        return datasetIndex;
      }
      if(pointerY <= rect.bottom){
        if(pointerX < centerX){
          return datasetIndex;
        }
        fallbackIndex = datasetIndex + 1;
        continue;
      }
      fallbackIndex = datasetIndex + 1;
    }
    return fallbackIndex;
  }

  function getMax(input){
    return Number.parseInt(input.dataset.maxImages, 10) || DEFAULT_MAX;
  }

  function getStoredFiles(input){
    if(Array.isArray(input._imageFiles)){
      return input._imageFiles.slice();
    }
    const files = Array.from(input.files || []);
    input._imageFiles = files.slice();
    return files;
  }

  function storeFiles(input, files){
    const copy = files.slice();
    if(typeof DataTransfer !== 'undefined'){
      try {
        const dt = new DataTransfer();
        copy.forEach(file => {
          try { dt.items.add(file); } catch(err){}
        });
        input.files = dt.files;
      } catch(err){}
    }
    input._imageFiles = copy;
    if(copy.length === 0){
      try { input.value = ''; } catch(err){}
    }
  }

  function updateLimitMessage(input, totalSelected){
    const max = getMax(input);
    if(totalSelected > max){
      input._imageLimitMessage = `Only the first ${max} images will be used.`;
    } else {
      input._imageLimitMessage = '';
    }
  }

  function removeImageAt(input, index){
    const files = getStoredFiles(input);
    if(index < 0 || index >= files.length) return;
    files.splice(index, 1);
    updateLimitMessage(input, files.length);
    storeFiles(input, files);
    renderPreviews(input);
  }

  function renderPreviews(input){
    if(!(input instanceof HTMLInputElement)) return;
    const previewId = input.dataset.imagePreviewTarget || '';
    const messageId = input.dataset.imageMessageTarget || '';
    const previewEl = previewId ? document.getElementById(previewId) : null;
    const messageEl = messageId ? document.getElementById(messageId) : null;
    const files = getStoredFiles(input);
    if(messageEl){
      const message = input._imageLimitMessage || '';
      if(message){
        messageEl.textContent = message;
        messageEl.hidden = false;
      } else {
        messageEl.textContent = '';
        messageEl.hidden = true;
      }
    }
    if(previewEl){
      previewEl._imageInput = input;
      if(!previewEl._dragHandlersAttached){
        previewEl.addEventListener('dragover', handlePreviewDragOver);
        previewEl.addEventListener('drop', handlePreviewDrop);
        previewEl._dragHandlersAttached = true;
      }
      previewEl.innerHTML = '';
      files.forEach((file, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'form-preview-image-thumb';
        thumb.dataset.index = String(index);
        thumb.draggable = true;
        thumb.addEventListener('dragstart', handleThumbDragStart);
        thumb.addEventListener('dragend', handleThumbDragEnd);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'form-preview-image-remove';
        removeBtn.setAttribute('aria-label', file.name ? `Remove ${file.name}` : `Remove image ${index + 1}`);
        removeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
        removeBtn.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          if(typeof event.stopImmediatePropagation === 'function'){
            event.stopImmediatePropagation();
          }
          removeImageAt(input, index);
        });
        const img = document.createElement('img');
        img.alt = file.name ? `${file.name} preview` : `Image preview ${index + 1}`;
        img.draggable = true;
        img.addEventListener('dragstart', handleThumbDragStart);
        img.addEventListener('dragend', handleThumbDragEnd);
        thumb.append(removeBtn, img);
        previewEl.appendChild(thumb);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          if(typeof reader.result === 'string'){
            img.src = reader.result;
          }
        });
        try {
          reader.readAsDataURL(file);
        } catch(err){}
      });
    }
  }

  function handleSelectionChange(input){
    const newFiles = Array.from(input.files || []);
    const existing = getStoredFiles(input);
    if(newFiles.length === 0){
      storeFiles(input, existing);
      renderPreviews(input);
      return;
    }
    const combined = existing.concat(newFiles);
    updateLimitMessage(input, combined.length);
    const max = getMax(input);
    const limited = combined.slice(0, max);
    storeFiles(input, limited);
    renderPreviews(input);
  }

  function applyImageBehavior(input){
    if(!(input instanceof HTMLInputElement)) return;
    if(input.type !== 'file') return;
    if(processed.has(input)) return;
    processed.add(input);
    input.multiple = true;
    if(!input.accept) input.accept = 'image/*';
    const initialFiles = Array.from(input.files || []);
    updateLimitMessage(input, initialFiles.length);
    const max = getMax(input);
    const limited = initialFiles.slice(0, max);
    storeFiles(input, limited);
    renderPreviews(input);
    input.addEventListener('change', () => handleSelectionChange(input));
  }

  function scan(root){
    if(!root) return;
    const list = root.querySelectorAll ? root.querySelectorAll('input[data-images-field]') : [];
    list.forEach(applyImageBehavior);
  }

  function startObserver(){
    if(observerStarted || !document.body) return;
    observerStarted = true;
    const observer = new MutationObserver(mutations => {
      for(const mutation of mutations){
        if(mutation.type === 'childList'){
          mutation.addedNodes.forEach(node => {
            if(!(node instanceof Element)) return;
            if(node.matches && node.matches('input[data-images-field]')){
              applyImageBehavior(node);
            }
            if(node.querySelectorAll){
              node.querySelectorAll('input[data-images-field]').forEach(applyImageBehavior);
            }
          });
        } else if(mutation.type === 'attributes'){
          const target = mutation.target;
          if(target instanceof HTMLInputElement && target.hasAttribute('data-images-field')){
            applyImageBehavior(target);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-images-field']
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      scan(document);
      startObserver();
    }, { once: true });
  } else {
    scan(document);
    startObserver();
  }
})();


// Extracted from <script>
(function(){
  const MESSAGE = 'Please include "@" and "." in the email address.';
  const processedForms = new WeakSet();

  function ensureFormListener(form){
    if(!form || processedForms.has(form)) return;
    form.addEventListener('submit', () => {
      const candidates = form.querySelectorAll('input[data-email-textboxified="true"]');
      candidates.forEach(input => {
        if(typeof input._emailTextboxValidate === 'function'){
          input._emailTextboxValidate();
        }
      });
    }, true);
    processedForms.add(form);
  }

  function applyEmailBehavior(input){
    if(!(input instanceof HTMLInputElement)) return;
    if(input.dataset.emailTextboxified === 'true') return;
    input.dataset.emailTextboxified = 'true';
    try {
      input.type = 'text';
    } catch(err) {}
    ensureFormListener(input.form || null);

    const validate = () => {
      const value = input.value != null ? String(input.value).trim() : '';
      if(!value){
        input.setCustomValidity('');
        return;
      }
      if(value.includes('@') && value.includes('.')){
        input.setCustomValidity('');
      } else {
        input.setCustomValidity(MESSAGE);
      }
    };

    input._emailTextboxValidate = validate;
    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
    input.addEventListener('blur', validate);
    if(typeof input.setAttribute === 'function'){
      input.setAttribute('title', MESSAGE);
    }
    validate();
  }

  function scan(root){
    if(!root) return;
    const list = root.querySelectorAll ? root.querySelectorAll('input[type="email"]') : [];
    list.forEach(applyEmailBehavior);
  }

  function handleMutations(mutations){
    for(const mutation of mutations){
      if(mutation.type === 'childList'){
        mutation.addedNodes.forEach(node => {
          if(!(node instanceof Element)) return;
          if(node.matches && node.matches('input[type="email"]')){
            applyEmailBehavior(node);
          }
          if(node.querySelectorAll){
            node.querySelectorAll('input[type="email"]').forEach(applyEmailBehavior);
          }
        });
      } else if(mutation.type === 'attributes'){
        const target = mutation.target;
        if(target instanceof HTMLInputElement && target.type === 'email'){
          applyEmailBehavior(target);
        }
      }
    }
  }

  function init(){
    if(!document.body){
      return;
    }
    scan(document);
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type']
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();


// Extracted from <script>
(function(){
  const USERS_KEY = 'member-auth-users';
  const CURRENT_KEY = 'member-auth-current';
  let users = [];
  let currentUser = null;
  let statusTimer = null;
  let lastAction = 'login';

  let form = null;
  let container = null;
  let tabsWrap = null;
  let loginTab = null;
  let registerTab = null;
  let loginPanel = null;
  let registerPanel = null;
  let profilePanel = null;
  let loginInputs = [];
  let registerInputs = [];
  let profileAvatar = null;
  let profileName = null;
  let profileEmail = null;
  let logoutBtn = null;

  function normalizeUser(user){
    if(!user || typeof user !== 'object') return null;
    const emailRaw = typeof user.email === 'string' ? user.email.trim() : '';
    const normalized = typeof user.emailNormalized === 'string' && user.emailNormalized.trim()
      ? user.emailNormalized.trim().toLowerCase()
      : emailRaw.toLowerCase();
    if(!normalized) return null;
    const usernameRaw = typeof user.username === 'string' ? user.username.trim() : '';
    const username = usernameRaw || normalized;
    return {
      name: typeof user.name === 'string' ? user.name.trim() : '',
      email: emailRaw,
      emailNormalized: normalized,
      username,
      password: typeof user.password === 'string' ? user.password : '',
      avatar: typeof user.avatar === 'string' ? user.avatar.trim() : ''
    };
  }

  function loadUsers(){
    try{
      const raw = localStorage.getItem(USERS_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed.map(normalizeUser).filter(Boolean);
    }catch(err){
      return [];
    }
  }

  function saveUsers(list){
    users = Array.isArray(list) ? list.map(normalizeUser).filter(Boolean) : [];
    try{
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }catch(err){}
  }

  function storeCurrent(user){
    try{
      if(user){
        const payload = {
          type: user.isAdmin ? 'admin' : 'member',
          username: typeof user.username === 'string' ? user.username : '',
          email: typeof user.email === 'string' ? user.email : '',
          name: typeof user.name === 'string' ? user.name : '',
          avatar: typeof user.avatar === 'string' ? user.avatar : ''
        };
        localStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(CURRENT_KEY);
      }
    }catch(err){}
  }

  function loadStoredCurrent(){
    try{
      const raw = localStorage.getItem(CURRENT_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return null;
      const type = parsed.type === 'admin' ? 'admin' : 'member';
      const username = typeof parsed.username === 'string' ? parsed.username : '';
      const emailRaw = typeof parsed.email === 'string' ? parsed.email : username;
      const normalized = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
      if(type === 'admin'){
        if(window.adminAuthManager){
          window.adminAuthManager.setAuthenticated(true, username || emailRaw || 'admin');
        }
        return {
          name: parsed.name || 'Administrator',
          email: emailRaw,
          emailNormalized: normalized || 'admin',
          username: username || emailRaw || 'admin',
          avatar: parsed.avatar || '',
          isAdmin: true
        };
      }
      if(normalized){
        const existing = users.find(u => u.emailNormalized === normalized);
        if(existing){
          return { ...existing };
        }
      }
      if(!emailRaw){
        return null;
      }
      return {
        name: parsed.name || '',
        email: emailRaw,
        emailNormalized: normalized || emailRaw.toLowerCase(),
        username: username || normalized || emailRaw,
        avatar: parsed.avatar || '',
        isAdmin: false
      };
    }catch(err){}
    return null;
  }

  function svgPlaceholder(letter){
    const palette = ['#2e3a72','#0ea5e9','#f97316','#14b8a6','#a855f7'];
    const color = palette[letter.charCodeAt(0) % palette.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${color}"/><text x="50%" y="52%" text-anchor="middle" font-size="36" font-family="Inter, Arial, sans-serif" fill="#ffffff">${letter}</text></svg>`;
    try{
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    }catch(err){
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    }
  }

  function createPlaceholder(name){
    const trimmed = (name || '').trim();
    const initial = trimmed ? trimmed[0].toUpperCase() : 'U';
    return svgPlaceholder(initial);
  }

  function getAvatarSource(user){
    if(!user) return createPlaceholder('');
    const raw = user.avatar ? String(user.avatar).trim() : '';
    if(raw) return raw;
    return createPlaceholder(user.name || user.email || 'U');
  }

  function ensureMemberAvatarImage(){
    const memberBtn = document.getElementById('memberBtn');
    if(!memberBtn) return null;
    let img = memberBtn.querySelector('.member-avatar');
    if(!img){
      img = document.createElement('img');
      img.className = 'member-avatar';
      img.alt = '';
      img.setAttribute('aria-hidden','true');
      memberBtn.appendChild(img);
    }
    return img;
  }

  function updateMemberButton(user){
    const memberBtn = document.getElementById('memberBtn');
    if(!memberBtn) return;
    const img = ensureMemberAvatarImage();
    if(!img) return;
    img.onerror = null;
    img.removeAttribute('data-fallback-applied');
    if(user){
      const descriptor = user.name || user.email || 'Member';
      img.dataset.fallbackApplied = '';
      img.onerror = () => {
        if(img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = createPlaceholder(descriptor);
      };
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = getAvatarSource(user);
      memberBtn.classList.add('has-avatar');
      memberBtn.setAttribute('aria-label', `Open members area for ${descriptor}`);
    } else {
      img.removeAttribute('src');
      img.removeAttribute('data-fallback-applied');
      memberBtn.classList.remove('has-avatar');
      memberBtn.setAttribute('aria-label', 'Open members area');
    }
  }

  function showStatus(message, options = {}){
    const statusEl = document.getElementById('memberStatusMessage');
    if(!statusEl) return;
    const isError = !!options.error;
    statusEl.textContent = message;
    statusEl.classList.remove('error','success','show');
    statusEl.classList.add(isError ? 'error' : 'success');
    statusEl.setAttribute('aria-hidden','false');
    void statusEl.offsetWidth;
    statusEl.classList.add('show');
    if(statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.classList.remove('show');
      statusEl.classList.remove('error','success');
      statusEl.setAttribute('aria-hidden','true');
    }, 2400);
  }

  function disableInputs(list, disabled){
    list.forEach(input => {
      input.disabled = !!disabled;
    });
  }

  function clearInputs(list){
    list.forEach(input => {
      if('value' in input){
        input.value = '';
      }
    });
  }

  function setAuthPanelState(panelEl, isActive, inputs){
    if(!panelEl) return;
    if(Array.isArray(inputs)){
      disableInputs(inputs, !isActive);
    }
    const submitBtn = panelEl.querySelector('.member-auth-submit');
    if(submitBtn){
      if(!isActive){
        submitBtn.dataset.memberAuthPrevDisabled = submitBtn.disabled ? 'true' : 'false';
        submitBtn.disabled = true;
      } else if('memberAuthPrevDisabled' in submitBtn.dataset){
        submitBtn.disabled = submitBtn.dataset.memberAuthPrevDisabled === 'true';
        delete submitBtn.dataset.memberAuthPrevDisabled;
      } else {
        submitBtn.disabled = false;
      }
    }
    if(!isActive){
      const activeEl = document.activeElement;
      if(activeEl && panelEl.contains(activeEl) && typeof activeEl.blur === 'function'){
        activeEl.blur();
      }
      panelEl.setAttribute('inert','');
    } else {
      panelEl.removeAttribute('inert');
    }
    panelEl.hidden = !isActive;
    panelEl.setAttribute('aria-hidden', (!isActive).toString());
  }

  function focusFirstAuthField(panelEl){
    if(!panelEl || panelEl.hidden) return;
    let ancestor = panelEl.parentElement;
    while(ancestor){
      if(ancestor.hidden || ancestor.getAttribute && ancestor.getAttribute('aria-hidden') === 'true'){
        return;
      }
      ancestor = ancestor.parentElement;
    }
    const target = panelEl.querySelector('input:not([type="hidden"]):not([disabled])')
      || panelEl.querySelector('select:not([disabled])')
      || panelEl.querySelector('textarea:not([disabled])')
      || panelEl.querySelector('button:not([disabled])');
    if(target && typeof target.focus === 'function'){
      requestAnimationFrame(() => target.focus());
    }
  }

  function setActivePanel(panel){
    if(!container || container.dataset.state === 'logged-in') return;
    const target = panel === 'register' ? 'register' : 'login';
    const isLogin = target === 'login';
    if(loginTab) loginTab.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    if(registerTab) registerTab.setAttribute('aria-selected', !isLogin ? 'true' : 'false');
    setAuthPanelState(loginPanel, isLogin, loginInputs);
    setAuthPanelState(registerPanel, !isLogin, registerInputs);
    container.dataset.active = target;
    lastAction = target;
    focusFirstAuthField(isLogin ? loginPanel : registerPanel);
  }

  function render(){
    if(window.adminAuthManager){
      if(currentUser && currentUser.isAdmin){
        const identity = currentUser.username || currentUser.email || 'admin';
        window.adminAuthManager.setAuthenticated(true, identity);
      } else {
        window.adminAuthManager.setAuthenticated(false);
      }
    }
    if(!container) return;
    if(currentUser){
      container.dataset.state = 'logged-in';
      setAuthPanelState(loginPanel, false, loginInputs);
      setAuthPanelState(registerPanel, false, registerInputs);
      clearInputs(loginInputs);
      clearInputs(registerInputs);
      if(profilePanel){
        profilePanel.hidden = false;
        profilePanel.setAttribute('aria-hidden','false');
        profilePanel.removeAttribute('inert');
      }
      if(profileAvatar){
        const descriptor = currentUser.name || currentUser.email || 'Member';
        profileAvatar.dataset.fallbackApplied = '';
        profileAvatar.onerror = () => {
          if(profileAvatar.dataset.fallbackApplied === '1') return;
          profileAvatar.dataset.fallbackApplied = '1';
          profileAvatar.src = createPlaceholder(descriptor);
        };
        profileAvatar.loading = 'lazy';
        profileAvatar.decoding = 'async';
        profileAvatar.src = getAvatarSource(currentUser);
        profileAvatar.alt = `${descriptor}'s avatar`;
      }
      if(profileName) profileName.textContent = currentUser.name || 'Member';
      if(profileEmail) profileEmail.textContent = currentUser.email || '';
      if(tabsWrap) tabsWrap.setAttribute('aria-hidden','true');
      updateMemberButton(currentUser);
      lastAction = 'login';
      if(window.memberPanelChangeManager && typeof window.memberPanelChangeManager.markSaved === 'function'){
        window.memberPanelChangeManager.markSaved();
      }
    } else {
      container.dataset.state = 'logged-out';
      if(profilePanel){
        profilePanel.hidden = true;
        profilePanel.setAttribute('aria-hidden','true');
        profilePanel.setAttribute('inert','');
      }
      if(profileAvatar){
        profileAvatar.onerror = null;
        profileAvatar.removeAttribute('src');
        profileAvatar.removeAttribute('data-fallback-applied');
        profileAvatar.alt = '';
      }
      if(profileName) profileName.textContent = '';
      if(profileEmail) profileEmail.textContent = '';
      if(tabsWrap) tabsWrap.removeAttribute('aria-hidden');
      const active = container.dataset.active === 'register' ? 'register' : 'login';
      setActivePanel(active);
      clearInputs(loginInputs);
      clearInputs(registerInputs);
      updateMemberButton(null);
      if(window.memberPanelChangeManager && typeof window.memberPanelChangeManager.markSaved === 'function'){
        window.memberPanelChangeManager.markSaved();
      }
    }
  }

  async function handleLogin(){
    const emailInput = document.getElementById('memberLoginEmail');
    const passwordInput = document.getElementById('memberLoginPassword');
    const usernameRaw = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    if(!usernameRaw || !password){
      showStatus('Enter your email and password.', { error: true });
      if(!usernameRaw && emailInput){
        emailInput.focus();
      } else if(passwordInput){
        passwordInput.focus();
      }
      return;
    }
    let verified = false;
    try{
      verified = await verifyUserLogin(usernameRaw, password);
    }catch(err){
      console.error('Login verification failed', err);
      showStatus('Unable to verify credentials. Please try again.', { error: true });
      return;
    }
    if(!verified){
      showStatus('Incorrect email or password. Try again.', { error: true });
      if(passwordInput){
        passwordInput.focus();
        passwordInput.select();
      }
      return;
    }
    const normalized = usernameRaw.toLowerCase();
    currentUser = {
      name: '',
      email: usernameRaw,
      emailNormalized: normalized,
      username: usernameRaw,
      avatar: '',
      isAdmin: normalized === 'admin'
    };
    storeCurrent(currentUser);
    render();
    const displayName = currentUser.name || currentUser.email || currentUser.username;
    showStatus(`Welcome back, ${displayName}!`);
  }

  function handleRegister(){
    const nameInput = document.getElementById('memberRegisterName');
    const emailInput = document.getElementById('memberRegisterEmail');
    const passwordInput = document.getElementById('memberRegisterPassword');
    const avatarInput = document.getElementById('memberRegisterAvatar');
    const name = nameInput ? nameInput.value.trim() : '';
    const emailRaw = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const avatar = avatarInput ? avatarInput.value.trim() : '';
    if(!name || !emailRaw || !password){
      showStatus('Please complete all required fields.', { error: true });
      if(!name && nameInput){
        nameInput.focus();
        return;
      }
      if(!emailRaw && emailInput){
        emailInput.focus();
        return;
      }
      if(!password && passwordInput){
        passwordInput.focus();
      }
      return;
    }
    if(password.length < 4){
      showStatus('Password must be at least 4 characters.', { error: true });
      if(passwordInput) passwordInput.focus();
      return;
    }
    const normalized = emailRaw.toLowerCase();
    if(users.some(u => u.emailNormalized === normalized)){
      showStatus('An account already exists for that email.', { error: true });
      if(emailInput) emailInput.focus();
      return;
    }
    const newUser = normalizeUser({ name, email: emailRaw, emailNormalized: normalized, password, avatar });
    users.push(newUser);
    saveUsers(users);
    currentUser = { ...newUser };
    storeCurrent(currentUser);
    render();
    showStatus(`Welcome, ${currentUser.name || currentUser.email}!`);
  }

  function handleLogout(){
    currentUser = null;
    storeCurrent(null);
    render();
    showStatus('You have been logged out.');
  }

  function setup(){
    form = document.getElementById('memberForm');
    if(!form) return;
    container = form.querySelector('.member-auth');
    if(!container) return;
    tabsWrap = container.querySelector('.member-auth-tabs');
    loginTab = document.getElementById('memberAuthTabLogin');
    registerTab = document.getElementById('memberAuthTabRegister');
    loginPanel = document.getElementById('memberLoginPanel');
    registerPanel = document.getElementById('memberRegisterPanel');
    profilePanel = document.getElementById('memberProfilePanel');
    profileAvatar = document.getElementById('memberProfileAvatar');
    profileName = document.getElementById('memberProfileName');
    profileEmail = document.getElementById('memberProfileEmail');
    logoutBtn = document.getElementById('memberLogoutBtn');
    loginInputs = loginPanel ? Array.from(loginPanel.querySelectorAll('input')) : [];
    registerInputs = registerPanel ? Array.from(registerPanel.querySelectorAll('input')) : [];

    form.addEventListener('submit', event => {
      event.preventDefault();
      const submitter = event.submitter || null;
      const action = submitter && submitter.dataset && submitter.dataset.action ? submitter.dataset.action : lastAction;
      if(action === 'register'){
        handleRegister();
      } else {
        Promise.resolve(handleLogin()).catch(err => {
          console.error('Login handler failed', err);
          showStatus('Unable to process login. Please try again.', { error: true });
        });
      }
    });

    const submitButtons = form.querySelectorAll('.member-auth-submit');
    submitButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        lastAction = btn.dataset.action || 'login';
      });
    });

    if(loginTab){
      loginTab.addEventListener('click', () => {
        setActivePanel('login');
      });
    }
    if(registerTab){
      registerTab.addEventListener('click', () => {
        setActivePanel('register');
      });
    }
    if(logoutBtn){
      logoutBtn.addEventListener('click', event => {
        event.preventDefault();
        if(currentUser){
          handleLogout();
        }
      });
    }

    users = loadUsers();
    currentUser = loadStoredCurrent();
    render();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();


// Extracted from <script>
// Wait helpers if your app exposes callWhenDefined; otherwise poll.
(function(){
  function whenDefined(name, cb){
    if (window.callWhenDefined) return window.callWhenDefined(name, cb);
    const iv = setInterval(() => {
      if (typeof window[name] === 'function') { clearInterval(iv); cb(window[name]); }
    }, 20);
  }

  // Debounce/guard in-flight jobs by name
  const _inflight = new Map();
  function guardOnce(name, fn){
    return async function guarded(...args){
      if (_inflight.get(name)) return; // drop duplicates
      _inflight.set(name, true);
      try { return await fn.apply(this, args); }
      finally { _inflight.delete(name); }
    };
  }

  const factories = new Map([
    ['hookDetailActions', (orig) => {
      const wrapped = rafThrottle(function(...args){
        scheduleIdle(() => orig.apply(this, args));
      });
      return guardOnce('hookDetailActions', wrapped);
    }],
    ['ensureMapForVenue', (orig) => {
      let token = 0;
      return guardOnce('ensureMapForVenue', function(...args){
        const myToken = ++token;
        // Defer heavy create to idle; newest call wins.
        scheduleIdle(async () => {
          if (myToken !== token) return;
          try { await orig.apply(this, args); } catch(e) { /* swallow */ }
        }, 300);
      });
    }]
  ]);

  function applyWrapper(name){
    const factory = factories.get(name);
    if (!factory) return;
    whenDefined(name, (orig) => {
      if (typeof orig !== 'function' || orig.__inputWrapped) return;
      const wrapped = factory(orig);
      if (typeof wrapped === 'function'){
        wrapped.__inputWrapped = true;
        window[name] = wrapped;
      }
    });
  }

  ['hookDetailActions','ensureMapForVenue'].forEach(applyWrapper);

  window.__wrapForInputYield = function(name){
    applyWrapper(name);
  };
})();
 
 







