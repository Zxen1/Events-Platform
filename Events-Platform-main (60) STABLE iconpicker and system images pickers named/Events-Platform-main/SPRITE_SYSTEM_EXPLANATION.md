# Mapbox Sprite System - Visual Explanation

## CONCEPT HIERARCHY

```
MAPBOX MAP
│
├── SPRITES (Images stored in map style)
│   ├── Simple Sprite: Single image (e.g., "marker-label-bg" = pill image)
│   └── Composite Sprite: Combined image (e.g., "marker-label-composite-123" = pill + text combined)
│
├── LAYERS (Rendering instructions that USE sprites)
│   ├── Layer: "marker-label" (uses sprite as icon-image)
│   ├── Layer: "marker-label-highlight" (uses sprite as icon-image)
│   └── Layer: "marker-icon" (uses sprite as icon-image)
│
└── FEATURES (Individual map markers - each has properties)
    └── Each feature has: sprite ID, sort-key value, position
```

## RENDERING ORDER (What appears on top)

### PRIMARY: Layer Order (Most Important)
```
Layer Added First  →  Renders at BOTTOM
Layer Added Second →  Renders on TOP of first
Layer Added Third  →  Renders on TOP of second
```

**Example:**
```
1. Add layer "marker-label"        → Bottom
2. Add layer "marker-label-highlight" → Middle  
3. Add layer "marker-icon"          → Top (visible on top)
```

### SECONDARY: Sort-Key (Only matters WITHIN same layer)
```
Feature with sort-key: 1  →  Renders below
Feature with sort-key: 5  →  Renders above sort-key 1
Feature with sort-key: 10 →  Renders above sort-key 5
```

**Example (all in same layer):**
```
marker-label layer:
  - Feature A (sort-key: 1)  → Bottom
  - Feature B (sort-key: 5)  → Middle
  - Feature C (sort-key: 10) → Top
```

## SPRITE TYPES

| Type | Name Example | What It Is | How Created |
|------|-------------|------------|-------------|
| **Simple Sprite** | `marker-label-bg` | Single image file (pill image) | `map.addImage('marker-label-bg', imageData)` |
| **Composite Sprite** | `marker-label-composite-abc123` | Combined image (pill + text drawn together) | Canvas drawing: pill image + text labels = one image |

## COMPOSITE SPRITE BREAKDOWN

```
Composite Sprite: "marker-label-composite-abc123"
│
├── Base Image: Pill background (150×40px)
├── Text Layer 1: Post title line 1
├── Text Layer 2: Post title line 2
└── Result: One combined image (pill with text on it)
```

**Why use composites?**
- Single sprite = faster rendering
- Text and pill always aligned perfectly
- One sprite ID instead of managing multiple pieces

## YOUR SYSTEM'S 10 SPRITE ELEMENTS

| # | Element | Type | Layer | Sort-Key | Purpose |
|---|---------|------|-------|----------|---------|
| 1 | Small base pill | Simple | marker-label | 1 | Default pill background |
| 2 | Small accent pill | Simple | marker-label-highlight | 2 | Hover/clicked pill |
| 3 | Small label | Composite | marker-label | 3 | Post title (2 lines) |
| 4 | Small multi-post label | Composite | marker-label | 4 | Number + venue name |
| 5 | Big pill | Simple | marker-label | 5 | Large pill background |
| 6 | Big label | Composite | marker-label | 6 | Post title + venue |
| 7 | Big multi-post label | Composite | marker-label | 7 | Number + venue + city |
| 8 | Mapmarker icon | Simple | marker-icon | 8 | Single post icon (30×30) |
| 9 | Multi-post icon | Simple | marker-icon | 9 | Multi-post icon (30×30) |
| 10 | Thumbnail | Simple | marker-icon | 10 | Post thumbnail (50×50) |

## RENDERING STACK (Visual)

```
┌─────────────────────────────────────┐
│  marker-icon layer (sort-key 8-10)  │ ← TOP (icons visible)
│  └── Icon sprites                   │
├─────────────────────────────────────┤
│  marker-label-highlight (sort-key 2)│ ← Middle (hover pills)
│  └── Accent pill sprites            │
├─────────────────────────────────────┤
│  marker-label layer (sort-key 1-7)  │ ← BOTTOM (base pills + labels)
│  └── Base pill + composite sprites │
└─────────────────────────────────────┘
```

## KEY RULES

1. **Layer order wins**: marker-icon layer MUST be added/moved AFTER marker-label layers to appear on top
2. **Sort-key is secondary**: Only matters when features are in the SAME layer
3. **Sprites are resources**: They're images stored in the map, not layers themselves
4. **Layers use sprites**: Each layer references sprites via `icon-image` property
5. **Composites = efficiency**: One sprite instead of managing multiple pieces separately

