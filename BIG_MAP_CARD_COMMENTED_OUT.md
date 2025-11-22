# Big Map Card Code - Commented Out Documentation

This document lists all the code that was commented out related to the big map card functionality.

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
- `handleOverlayClick` function for opening posts when big card is clicked
- Event listeners on `cardRoot` for click, pointerdown, mousedown, touchstart

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

