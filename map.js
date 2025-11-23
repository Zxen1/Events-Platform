// Map module - All map-related functionality
(function() {
  'use strict';

  // Map variables - will be initialized
  let map, spinning = false, historyWasActive = localStorage.getItem('historyActive') === 'true',
      spinLoadStart = false,
      spinLoadType = 'everyone',
      spinLogoClick = true,
      spinZoomMax = 4,
      spinSpeed = 0.3,
      spinEnabled = false,
      mapCardDisplay = 'hover_only',
      mapStyle = window.mapStyle = 'mapbox://styles/mapbox/standard';

  let startPitch, startBearing, logoEls = [], geocoder;
  const LEGACY_DEFAULT_PITCH = 0;
  const geocoders = [];
  let lastGeocoderProximity = null;
  let postPanel = null;
  let markerFeatureIndex = new Map();
  let addingPostSource = false;
  let pendingAddPostSource = false;
  let ensureMapIcon = null;

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

  // Helper functions
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
    });
  }

  function setAllGeocoderProximity(lng, lat){
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
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

  function updatePostPanel(){ 
    if(map) postPanel = map.getBounds(); 
  }

  function lockMap(lock){
    const listLocked = lock;
    const fn = lock ? 'disable' : 'enable';
    try{ map.dragPan[fn](); }catch(e){}
    try{ map.scrollZoom[fn](); }catch(e){}
    try{ map.boxZoom[fn](); }catch(e){}
    try{ map.keyboard[fn](); }catch(e){}
    try{ map.doubleClickZoom[fn](); }catch(e){}
    try{ map.touchZoomRotate[fn](); }catch(e){}
  }

  // Helper functions for Mapbox CSS and style
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

  // Map initialization and controls
  // Note: This code depends on many global variables from index.js
  // The actual implementation will be moved from index.js
  
  // Export map module to window
  window.MapModule = {
    // Variables
    get map() { return map; },
    set map(v) { map = v; },
    get spinning() { return spinning; },
    set spinning(v) { spinning = v; },
    get spinEnabled() { return spinEnabled; },
    set spinEnabled(v) { spinEnabled = v; },
    get geocoder() { return geocoder; },
    set geocoder(v) { geocoder = v; },
    get geocoders() { return geocoders; },
    get postPanel() { return postPanel; },
    get markerFeatureIndex() { return markerFeatureIndex; },
    
    // Functions
    updatePostPanel,
    lockMap,
    clearMapGeocoder,
    syncGeocoderProximityToMap,
    setAllGeocoderProximity,
    blurAllGeocoderInputs,
    ensureMapboxCssFor,
    MapRegistry
  };

})();

