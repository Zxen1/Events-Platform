# Sprite System Analysis - Redundancies, Conflicts, and Overrides

## Why Code Existed Twice

The duplicate layer positioning code existed because:
1. **Initial positioning** (line 18778): Label layer was moved after pill layer when first created
2. **Later override** (line 18841, now removed): All marker layers were moved to top, undoing the first positioning
3. **Final fix** (line 18876): Label layer moved again to correct position

This happened because the code evolved over time - someone added the initial positioning, then someone else added a "move all to top" that broke it, requiring a third fix.

## REDUNDANCIES FOUND

### 1. Layer Properties Set Twice (CRITICAL)

**Pill Layers (lines 18675-18716):**
- Properties set in `addLayer()` config (lines 18682-18695)
- Then ALL properties set again with `setLayoutProperty()`/`setPaintProperty()` (lines 18705-18716)
- **Impact**: Unnecessary work, properties set twice even for new layers

**Label Layer (lines 18728-18777):**
- Properties set in `addLayer()` config (lines 18735-18753)
- Then ALL properties set again with `setLayoutProperty()` (lines 18761-18773)
- **Impact**: Unnecessary work, properties set twice even for new layers

**Icon Layer (lines 18793-18827):**
- Properties set in `addLayer()` config (lines 18799-18813)
- Then ALL properties set again with `setLayoutProperty()`/`setPaintProperty()` (lines 18819-18826)
- **Impact**: Unnecessary work, properties set twice even for new layers

### 2. Marker-Icon Properties Set THREE Times

**Location 1** (lines 18819-18820):
```javascript
map.setLayoutProperty(markerIconLayerId, 'visibility', 'visible');
map.setPaintProperty(markerIconLayerId, 'icon-opacity', 1);
```

**Location 2** (lines 18851-18852) - Inside `updateMapCardLayerOpacity()`:
```javascript
map.setLayoutProperty('mapmarker-icon', 'visibility', 'visible');
map.setPaintProperty('mapmarker-icon', 'icon-opacity', 1);
```

**Location 3** (lines 18865-18866) - Final ordering section:
```javascript
map.setLayoutProperty('mapmarker-icon', 'visibility', 'visible');
map.setPaintProperty('mapmarker-icon', 'icon-opacity', 1);
```

**Impact**: marker-icon visibility/opacity set 3 times in same execution

### 3. Symbol-Sort-Key Set Multiple Times

**marker-icon layer:**
- Set in `addLayer()` config (line 18808): `'symbol-sort-key': 8`
- Set again after layer exists (line 18826): `map.setLayoutProperty(markerIconLayerId, 'symbol-sort-key', 8)`
- Set again in final ordering (line 18867): `map.setLayoutProperty('mapmarker-icon', 'symbol-sort-key', 8)`

**Impact**: Same value set 3 times

### 4. Symbol-Z-Order Set Multiple Times

**marker-icon layer:**
- Set in `addLayer()` config (line 18807): `'symbol-z-order': 'auto'`
- Set again after layer exists (line 18825): `map.setLayoutProperty(markerIconLayerId, 'symbol-z-order', 'auto')`
- Set again in final ordering (line 18868): `map.setLayoutProperty('mapmarker-icon', 'symbol-z-order', 'auto')`

**Impact**: Same value set 3 times

**Pill layers:**
- Set in `addLayer()` config (line 18690): `'symbol-z-order': 'auto'`
- Set again after layer exists (line 18713): `map.setLayoutProperty(id,'symbol-z-order','auto')`

**Label layer:**
- Set in `addLayer()` config (line 18745): `'symbol-z-order': 'auto'`
- Set again after layer exists (line 18771): `map.setLayoutProperty(labelTextLayerId, 'symbol-z-order', 'auto')`

## CONFLICTS FOUND

### 1. Layer Property Overrides

**Issue**: When a layer already exists, ALL properties are reset even if they haven't changed.

**Example** (lines 18705-18716):
```javascript
// Even if layer exists and properties are correct, we reset everything:
try{ map.setFilter(id, filter || markerLabelFilter); }catch(e){}
try{ map.setLayoutProperty(id,'icon-image', iconImage || markerLabelIconImage); }catch(e){}
// ... 10 more property sets
```

**Impact**: Unnecessary property updates, potential flicker/performance issues

### 2. Opacity Logic Conflict

**Issue**: `updateMapCardLayerOpacity()` is called immediately after layer creation (line 18859), which sets pill opacity. But pill opacity is already set in the layer config (line 18694).

**Impact**: Opacity set twice, second call may override first

## OVERRIDES FOUND

### 1. Final Ordering Overrides Previous Settings

**Issue**: Final ordering section (lines 18861-18881) sets properties that were already set:
- marker-icon visibility/opacity (already set at lines 18819-18820, 18851-18852)
- marker-icon symbol-sort-key (already set at lines 18808, 18826)
- marker-icon symbol-z-order (already set at lines 18807, 18825)

**Impact**: Redundant property sets, but at least ensures correct final state

## RECOMMENDATIONS

### High Priority Fixes:

1. **Remove duplicate property sets**: Only set properties in `addLayer()` config for new layers, only update changed properties for existing layers
2. **Consolidate marker-icon property sets**: Remove duplicates at lines 18819-18820 and 18851-18852, keep only final ordering section
3. **Remove redundant symbol-sort-key/symbol-z-order sets**: These don't change, set once in config only

### Medium Priority:

4. **Optimize existing layer updates**: Only update properties that actually changed
5. **Move final ordering earlier**: Set layer order immediately after creation, not at end

### Low Priority:

6. **Add property change detection**: Only call `setLayoutProperty`/`setPaintProperty` if value actually changed

