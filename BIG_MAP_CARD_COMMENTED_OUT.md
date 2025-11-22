# Big Map Card and Small Map Card Hover Code - Commented Out Documentation

This document lists all the code that was commented out related to the big map card functionality and small map card hover effects.

## JavaScript (index.js)

### Lines 19663-19779: Big Map Card Element Creation
**Location:** Inside the map marker creation function

**Commented out:**
- `cardRoot` element creation with class `big-map-card big-map-card--popup`
- `pillImg` image element creation and configuration
- `thumbImg` image element creation and configuration (with error handling)
- `labelEl` and `titleWrap` elements for the card label
- Logic for multi-venue vs single venue card content
- `cardRoot.append(pillImg, thumbImg, labelEl)`
- `overlayRoot.append(markerContainer, cardRoot)` - changed to just `overlayRoot.append(markerContainer)`
- `overlayRoot.classList.add('is-card-visible')`
- `handleOverlayClick` function for opening posts when big card is clicked (lines 19784-19803)
- Event listeners on `cardRoot` for click, pointerdown, mousedown, touchstart (lines 19804-19814)

**Active code after commenting:**
- Line 19781: `overlayRoot.append(markerContainer);` (only small card is appended now)

## CSS (style.css)

### Lines 106-122: Big Map Card Base Styles
**Selector:** `.mapmarker-overlay > .big-map-card`

**Commented out properties:**
- `position: absolute`
- `left: 0; top: 0`
- `width: 225px; height: 60px`
- `transform: translate3d(-30px, -30px, 0)`
- `pointer-events: auto`
- `border-radius: 999px`
- `background: #2e3a72`
- `display: flex`
- `align-items: center`
- `gap: 6px`
- `padding: 5px 10px 5px 5px`
- `box-sizing: border-box`
- `z-index: var(--layer-card)`

### Lines 125-129: Card Visibility States
**Selector:** `.mapmarker-overlay.is-card-visible`

**Commented out:**
- `.mapmarker-overlay.is-card-visible > .small-map-card` (opacity/visibility rules)
- `.mapmarker-overlay.is-card-visible > .big-map-card` (opacity/visibility rules)
- `.mapmarker-overlay.is-card-visible` (pointer-events and z-index rules)

### Line 129: Image Display Rule
**Changed from:**
```css
.big-map-card img,
.small-map-card img{ display:block; }
```

**Changed to:**
```css
/* .big-map-card img, */
.small-map-card img{ display:block; }
```

### Lines 222-228: Big Map Card Popup Styles
**Selector:** `.big-map-card--popup`

**Commented out:**
- `.big-map-card--popup` background color rule
- `.big-map-card--popup.is-map-highlight` background color and transition rules

### Lines 233-238: Small Map Card Hover Effect
**Selector:** `.mapmarker-overlay:hover .small-map-card`

**Commented out:**
- Background color change on hover (was causing issues with small card behavior)

### Lines 368-404: Big Map Card List Variant
**Selector:** `.big-map-card--list` and related child selectors

**Commented out:**
- `.big-map-card--list` base styles (position, width, height, display, transform, background, border-radius, box-shadow)
- `.big-map-card--list .map-card-thumb` styles
- `.big-map-card--list .map-card-label` styles
- `.big-map-card--list .map-card-title` styles
- `.big-map-card--list .map-card-title-line` styles
- `.big-map-card--list .map-card-venue` styles

## Summary

**Total lines affected:**
- **JavaScript:** ~117 lines commented out (lines 19663-19779)
- **CSS:** ~100+ lines commented out across multiple rule blocks

**Key changes:**
1. Big map card element is no longer created in JavaScript
2. Only small map card is appended to overlay
3. All big map card CSS rules are commented out
4. Small map card hover effect removed (was causing issues)
5. Card visibility state CSS removed

**Result:**
- Only the small map card is now functional
- No big map card appears on hover or click
- Small map card has no hover effects

## Additional Changes - Small Map Card Hover Highlight

### Lines 3518-3577: toggleSmallMapCardHoverHighlight Function
**Location:** Function that adds/removes highlight class on hover

**Commented out:**
- Entire `toggleSmallMapCardHoverHighlight` function
- Logic for adding/removing `is-pill-highlight` class
- Logic for calling `setSmallMapCardPillImage` to change pill image on hover
- Logic for managing `hoverHighlightedPostIds` Set
- Logic for updating big map card highlight (also commented)

### Lines 20194-20197: Hover Event Listeners on Post Cards
**Location:** Inside post card rendering function

**Commented out:**
- `handleHoverHighlight` function that calls `toggleSmallMapCardHoverHighlight`
- `mouseenter` event listener that triggers highlight
- `mouseleave` event listener that removes highlight

### Lines 20209 and 20219: Document-Level Hover Handlers
**Location:** Global document event listeners

**Commented out:**
- `document.addEventListener('mouseover')` that calls `toggleSmallMapCardHoverHighlight(id, true)`
- `document.addEventListener('mouseout')` that calls `toggleSmallMapCardHoverHighlight(id, false)`

### Line 19612-19613: Marker Pill Visibility
**Location:** Inside marker creation function

**Changed from:**
```javascript
markerPill.style.opacity = '0.9';
markerPill.style.visibility = 'visible';
```

**Changed to:**
```javascript
markerPill.style.opacity = '0';
markerPill.style.visibility = 'hidden';
```

**Reason:** The markerPill image was appearing as a second card on top of the small map card

### Line 19747: Duplicate Append (Fixed)
**Location:** Inside commented big map card code block

**Issue:** Line was inside comment block but comment syntax was broken, causing it to potentially execute

**Fixed:** Properly commented out with `/* overlayRoot.append(markerContainer, cardRoot); */`

## Summary of All Changes

**Total lines affected:**
- **JavaScript:** ~200+ lines commented out across multiple locations
- **CSS:** ~100+ lines commented out across multiple rule blocks

**Key changes:**
1. Big map card element is no longer created in JavaScript
2. Only small map card is appended to overlay
3. All big map card CSS rules are commented out
4. Small map card hover highlight function completely disabled
5. All hover event listeners for small map card highlight disabled
6. Marker pill image hidden (was appearing as duplicate card)
7. Fixed comment syntax error that could have caused duplicate appends

**Result:**
- Only the small map card is now functional
- No big map card appears on hover or click
- Small map card has no hover effects (no color change, no size change, no duplicate cards)
- No duplicate markerContainer elements

