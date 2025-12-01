# Map Code Analysis & Migration Plan

## Overview
This document identifies all map-related code in `index.js` and prepares for migration to `map.js` for easier debugging.

## Map-Related Code Sections in index.js

### 1. Map Initialization & Setup (lines ~19192-19650)
- `initMap()` function - Main map initialization
- Mapbox token validation
- Map instance creation (`new mapboxgl.Map`)
- Error handlers
- Zoom indicator setup
- Map scale bar creation
- Welcome modal interaction handlers
- Style adjustments and patches

### 2. Map Utility Functions (lines ~827-2071)
- `ensureMapboxCssFor()` - CSS loading
- `whenStyleReady()` - Style ready handler
- `applyNightSky()` - Night sky layer
- `ensurePlaceholderSprites()` - Placeholder sprites
- `patchLayerFiltersForMissingLayer()` - Layer filter patches
- `patchTerrainSource()` - Terrain source patches
- `patchMapboxStyleArtifacts()` - Style artifact patches
- `armPointerOnSymbolLayers()` - Pointer cursor on symbols
- `syncGeocoderProximityToMap()` - Geocoder proximity sync
- `clearMapGeocoder()` - Geocoder cleanup
- `MapRegistry` - Map registry object

### 3. Composite Sprite System (lines ~1457-1916)
- Constants: `MARKER_LABEL_COMPOSITE_PREFIX`, `MARKER_LABEL_COMPOSITE_LIMIT`, etc.
- `markerLabelCompositeStore` - Composite sprite store
- `markerLabelCompositePending` - Pending composites
- `markerLabelCompositeId()` - Generate composite ID
- `drawCompositeText()` - Draw text on canvas
- `drawCompositeRoundIcon()` - Draw round icon
- `createMapCardComposite()` - Create composite sprite
- `enforceMarkerLabelCompositeBudget()` - Budget management
- `ensureMapCardComposite()` - Ensure composite exists
- `loadCompositeIcon()` - Load icon/thumbnail
- `clearMapCardComposites()` - Clear all composites

### 4. Map Card System (lines ~1235-1456)
- Pill sprite generation (`ensureMarkerLabelPillSprites()`)
- Pill sprite cache (`markerLabelPillSpriteCache`)
- Text measurement helpers
- Image loading utilities

### 5. Marker Clustering (Balloons) (lines ~3176-3942)
- `ensureBalloonIconImage()` - Balloon icon loading
- `setupSeedLayers()` - Seed layer setup
- Balloon layer management

### 6. Map Source Integration (lines ~19962-20850)
- `loadPostMarkers()` - Load post markers
- `addPostSource()` - Add posts source to map
- `buildSingleFeature()` - Build single post feature
- `buildMultiFeature()` - Build multi-post feature
- `getMarkerCollections()` - Get marker collections
- Layer creation and configuration
- `updateMapCardLayerOpacity()` - Update layer opacity
- Marker click handlers
- Marker hover handlers

### 7. Map Event Handlers (lines ~19569-19667)
- Zoom event handlers
- Move event handlers
- Click handlers
- Hover handlers
- Composite cleanup on zoom < 8

### 8. Map State Management (lines ~3625-3888)
- `updateMarkerLabelHighlightIconSize()` - Update marker highlight size
- `updateMapFeatureHighlights()` - Update feature highlights
- Feature state management (`isHighlighted`, `isActive`, `isExpanded`)

### 9. Map Variables & Constants (lines ~2262-2270, ~1007-1041)
- `map` - Main map instance variable
- `spinning` - Spin state
- `mapStyle` - Map style
- `mapCardDisplay` - Map card display mode
- Marker constants (sizes, dimensions, etc.)

## Redundancies & Overrides Found

### 1. Multiple Map Instance Access Patterns
- `map` variable (local scope)
- `window.map` (sometimes used)
- `window.getMapInstance()` (exposed function)
- `mapInstance` (parameter in functions)

**Issue**: Inconsistent access patterns make debugging difficult.

### 2. Duplicate Zoom Threshold Constants
- `MARKER_ZOOM_THRESHOLD = 8` (line 3160)
- `MARKER_MIN_ZOOM = MARKER_ZOOM_THRESHOLD` (line 19992)
- Hardcoded `8` in zoom cleanup (line 19587)

**Issue**: Should use single constant everywhere.

### 3. Multiple Feature State Update Functions
- `updateMarkerLabelHighlightIconSize()` - Sets `isExpanded` and `isActive`
- `updateMapFeatureHighlights()` - Sets `isHighlighted`
- Both called from multiple places

**Issue**: Feature state management is scattered.

### 4. Layer Visibility Management
- Old layers hidden in `updateMapCardLayerOpacity()` (lines 20463-20468)
- Old layers also hidden in `addPostSource()` (lines 20374-20388)

**Issue**: Redundant hiding of old layers.

### 5. Composite Creation Logic
- Composite creation in `addPostSource()` (lines 19994-20080)
- Composite cleanup in zoom handler (lines 19587-19594)
- Budget enforcement in `ensureMapCardComposite()` (line 1817)

**Issue**: Composite lifecycle management is split across multiple functions.

## Dependencies

### External Dependencies (from index.js)
- `posts` - Post data array
- `filtered` - Filtered posts array
- `filtersInitialized` - Filter initialization state
- `activePostId` - Active post ID
- `lastHighlightedPostIds` - Last highlighted post IDs
- `highlightedFeatureKeys` - Highlighted feature keys
- `markerFeatureIndex` - Marker feature index Map
- `subcategoryMarkers` - Subcategory marker icons
- `thumbUrl()` - Thumbnail URL function
- `getMarkerLabelLines()` - Get marker label lines
- `buildMarkerLabelText()` - Build marker label text
- `getPrimaryVenueName()` - Get primary venue name
- `slugify()` - Slugify function
- `openPost()` - Open post function
- `stopSpin()` - Stop spin function
- `scheduleCheckLoadPosts()` - Schedule post loading
- `MAPBOX_TOKEN` - Mapbox token

### Global Functions Exposed
- `window.getMapInstance()` - Get map instance
- `window.updateMapCardLayerOpacity()` - Update layer opacity
- `window.updateMarkerLabelHighlightIconSize()` - Update highlight size
- `window.updateMapFeatureHighlights()` - Update highlights

## Migration Strategy

### Phase 1: Create map.js Structure
1. Create `map.js` with IIFE wrapper
2. Export map instance getter
3. Move all map-related constants
4. Move all map utility functions
5. Move composite sprite system
6. Move map initialization
7. Move event handlers
8. Move layer management
9. Move state management

### Phase 2: Update index.js
1. Import map.js
2. Replace map variable access with `getMapInstance()`
3. Remove moved code sections
4. Update function calls to use map.js exports
5. Ensure all dependencies are passed correctly

### Phase 3: Cleanup
1. Remove redundant code
2. Consolidate constants
3. Unify map instance access
4. Test all functionality

## Files to Modify
- `index.js` - Remove map code, add imports
- `map.js` - Add all map functionality
- `index.html` - Ensure map.js is loaded before index.js

