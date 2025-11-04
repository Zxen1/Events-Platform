(function(){
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

  window.loadMapbox = loadMapbox;
  window.startMainMapInit = startMainMapInit;
  window.queueMainMapInitAfterInteraction = queueMainMapInitAfterInteraction;
  window.addControls = addControls;
  window.initMap = initMap;
  window.startSpin = startSpin;
  window.stopSpin = stopSpin;
  window.haltSpin = haltSpin;
})();

