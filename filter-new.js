/* ============================================================================
   FILTER PANEL - Parts 1-4
   1. Panel Container
   2. Panel Content
   3. Panel Header
   4. Map Control Row (Geocoder, Geolocate, Compass)
   ============================================================================ */

const FilterModule = (function() {
    'use strict';

    /* --------------------------------------------------------------------------
       STATE
       -------------------------------------------------------------------------- */
    
    var panelEl = null;
    var contentEl = null;
    var bodyEl = null;
    var summaryEl = null;
    var geocoderInput = null;
    var geocoderAutocomplete = null;


    /* --------------------------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------------------------- */
    
    function init() {
        console.log('[Filter] Initializing filter module...');
        
        panelEl = document.querySelector('.filter-panel');
        if (!panelEl) {
            console.warn('[Filter] No filter panel found');
            return;
        }
        
        contentEl = panelEl.querySelector('.filter-panel-content');
        bodyEl = panelEl.querySelector('.filter-panel-body');
        summaryEl = panelEl.querySelector('.filter-panel-summary');
        
        initMapControls();
        bindPanelEvents();
        
        console.log('[Filter] Filter module initialized');
    }


    /* --------------------------------------------------------------------------
       PART 1-2: PANEL SHOW/HIDE
       -------------------------------------------------------------------------- */
    
    function openPanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.classList.add('show');
        panelEl.setAttribute('aria-hidden', 'false');
        panelEl.removeAttribute('inert');
        
        contentEl.classList.add('panel-visible');
    }
    
    function closePanel() {
        if (!panelEl || !contentEl) return;
        
        panelEl.setAttribute('inert', '');
        contentEl.classList.remove('panel-visible');
        
        contentEl.addEventListener('transitionend', function handler() {
            contentEl.removeEventListener('transitionend', handler);
            panelEl.classList.remove('show');
            panelEl.setAttribute('aria-hidden', 'true');
        }, { once: true });
    }
    
    function togglePanel(show) {
        if (show === undefined) {
            show = !panelEl.classList.contains('show');
        }
        
        if (show) {
            openPanel();
        } else {
            closePanel();
        }
    }


    /* --------------------------------------------------------------------------
       PART 3: PANEL HEADER / SUMMARY
       -------------------------------------------------------------------------- */
    
    function updateSummary(text) {
        if (summaryEl) {
            summaryEl.textContent = text || '';
        }
    }


    /* --------------------------------------------------------------------------
       PART 4: MAP CONTROL ROW (Geocoder, Geolocate, Compass)
       -------------------------------------------------------------------------- */
    
    function initMapControls() {
        initGeocoder();
        initGeolocate();
        initCompass();
    }
    
    function initGeocoder() {
        var container = panelEl.querySelector('.filter-geocoder');
        if (!container) return;
        
        // Create input
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search venues or places';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('data-lpignore', 'true');
        container.appendChild(input);
        
        geocoderInput = input;
        
        // Wait for Google Places API
        waitForGooglePlaces(function() {
            geocoderAutocomplete = new google.maps.places.Autocomplete(input, {
                fields: ['formatted_address', 'geometry', 'name', 'place_id']
            });
            
            geocoderAutocomplete.addListener('place_changed', function() {
                var place = geocoderAutocomplete.getPlace();
                if (!place || !place.geometry || !place.geometry.location) return;
                
                var lat = place.geometry.location.lat();
                var lng = place.geometry.location.lng();
                
                App.emit('filter:placeSelected', {
                    lat: lat,
                    lng: lng,
                    name: place.name,
                    address: place.formatted_address
                });
            });
        });
    }
    
    function waitForGooglePlaces(callback) {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
            callback();
        } else {
            setTimeout(function() { waitForGooglePlaces(callback); }, 100);
        }
    }
    
    function clearGeocoder() {
        if (geocoderInput) {
            geocoderInput.value = '';
        }
    }
    
    function initGeolocate() {
        var container = panelEl.querySelector('.filter-geolocate');
        if (!container) return;
        
        // Add icon
        container.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
        
        container.addEventListener('click', function() {
            if (!navigator.geolocation) return;
            
            navigator.geolocation.getCurrentPosition(function(pos) {
                App.emit('filter:geolocate', {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
            });
        });
    }
    
    function initCompass() {
        var container = panelEl.querySelector('.filter-compass');
        if (!container) return;
        
        // Add icon
        container.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3,12 12,3 21,12 12,21"/></svg>';
        
        container.addEventListener('click', function() {
            App.emit('filter:compass');
        });
    }


    /* --------------------------------------------------------------------------
       PANEL EVENTS
       -------------------------------------------------------------------------- */
    
    function bindPanelEvents() {
        App.on('panel:toggle', function(data) {
            if (data.panel === 'filter') {
                togglePanel(data.show);
            }
        });
    }


    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */
    
    return {
        init: init,
        openPanel: openPanel,
        closePanel: closePanel,
        togglePanel: togglePanel,
        updateSummary: updateSummary,
        clearGeocoder: clearGeocoder
    };

})();

// Register module with App
App.registerModule('filter', FilterModule);

