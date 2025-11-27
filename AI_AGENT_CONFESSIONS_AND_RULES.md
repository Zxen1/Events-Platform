# AI AGENT CONFESSIONS AND PROJECT RULES
## Critical Information for All Future AI Agents

---

## CONFESSIONS: CRITICAL MISTAKES MADE

### 1. TERMINOLOGY CONFUSION
**Mistake:** Used ambiguous and incorrect terminology throughout the project:
- Used "highlighted" to mean "active" (post open/pill size change) when it should ONLY mean hover (blue color change)
- Used "icon" to mean "pill" - icons are the small circular images, NOT pills
- Used "label" to mean "pill" - labels are text elements, NOT pills

**Impact:** Created extreme ambiguity, confusion, and incorrect code implementations.

### 2. UNAUTHORIZED CODE ADDITIONS
**Mistake:** Added code, variables, and properties without explicit user approval:
- Created variables like `bigPillSizeExpression`, `bigPillOffsetExpression` without authorization
- Added `iconSize` parameters and `icon-size` property updates without asking
- Used Mapbox properties like `icon-size` without understanding they were for icons, not pills
- Experimented with `cardSortKey` system without permission

**Impact:** Introduced unauthorized changes that had to be reverted, wasted time, caused frustration.

### 3. GUESSING INSTEAD OF RESEARCHING
**Mistake:** Made assumptions and guesses about how the code should work instead of:
- Thoroughly researching existing code
- Asking clarifying questions
- Understanding the full system before making changes

**Impact:** Created incorrect implementations, broke existing functionality, required multiple fixes.

### 4. LACK OF PROJECT MEMORY
**Mistake:** No memory of weeks of previous work, leading to:
- Ignoring overall project context
- Making redundant changes
- Creating conflicts with existing code
- No understanding of the full system architecture

**Impact:** Repeated mistakes, wasted effort, user frustration.

### 5. EXPERIMENTATION WITHOUT PERMISSION
**Mistake:** Tried experimental solutions and workarounds without user approval:
- Created custom `cardSortKey` system as workaround
- Added resize functionality using wrong properties
- Made changes based on assumptions rather than requirements

**Impact:** User had to explicitly reject experiments, wasted time, damaged trust.

---

## PROJECT SCOPE: EVENTS PLATFORM CMS

### Core System
- **Type:** CMS (Content Management System) platform
- **Technology:** Mapbox GL JS for interactive mapping
- **Platform:** Events Platform CMS website with map-based event discovery
- **Scale:** Thousands of map cards spread across the map
- **Purpose:** Content management system for managing and displaying events on an interactive map
- **Content Model:** 100% of content is user-provided
  - Forms are used by users to create posts
  - All posts/events are created through user forms
- **Filter System:** Filters (including the map) filter search results
  - Users can filter posts/events through various filters
  - The map itself acts as a filter for search results
  - Filtered results are displayed on the map

### Map Card System
Map cards are the primary UI elements on the map, consisting of:
1. **Pills:** Pill-shaped background images (NOT icons, NOT labels)
   - Small pill: 150×40px (default state)
   - Big pill: 225×60px (active state when post is open)
   - Pills are sprites rendered by Mapbox, not DOM elements

2. **Labels:** Text elements displayed on pills
   - Small map card labels: 2 lines, 100px max width
   - Big map card labels: 3 lines, 145px max width
   - Labels are text, NOT pills

3. **Icons:** Small circular images (mapmarkers)
   - 30×30px for single posts
   - 50×50px for multi-post markers
   - Icons are the small circular images, NOT pills

### State System
**CRITICAL:** Two distinct states with clear, unambiguous meanings:

1. **highlighted** (hover state):
   - Triggered when: postcard or mapcard is hovered
   - Effect: mapmarker and postcard turn blue
   - Feature state: `isHighlighted`
   - Purpose: Visual feedback on hover

2. **active** (click/open state):
   - Triggered when: post is clicked/opened
   - Effect: pill changes size from 150×40px to 225×60px, post opens
   - Feature state: `isActive` (or equivalent - user to decide)
   - Purpose: Indicates post is currently open/selected

**DO NOT CONFUSE THESE STATES.** They are completely separate.

### Layer System
Mapbox layers in rendering order (bottom to top):
1. Small pills (sort-key: 1)
2. Small labels (sort-key: 3, 4)
3. Big pills (sort-key: 2)
4. Big labels (sort-key: 5, 6, 7)
5. Icons (sort-key: 8, 9, 10)

**CRITICAL:** Layer order OVERRIDES sort-key in Mapbox GL. Layers added/moved later always render on top.

### Sprite System
- Pills are Mapbox sprites, not DOM images
- Sprites are added using `map.addImage()` before layers use them
- Small pill sprite: `small-map-card-pill` (150×40px image)
- Big pill sprite: `big-map-card-pill` (225×60px image)
- Big pill resizes from 0.6667 scale (150×40px) to 1.0 scale (225×60px) when active

### Interaction System
- Pills are hoverable and clickable
- Hover triggers `isHighlighted` state (blue color)
- Click triggers `isActive` state (pill resize, post opens)
- Both pills and icons can be hovered/clicked

---

## RULES: MANDATORY COMPLIANCE

### Rule 1: NO NAMING OR RENAMING WITHOUT APPROVAL
**CRITICAL:** You are NEVER allowed to name or rename anything without explicit user approval.
- Do not create new variable names
- Do not rename existing variables
- Do not add new properties or parameters
- Ask first, always

### Rule 2: NO GUESSING
**CRITICAL:** Never guess what code should be. Instead:
- Research existing code thoroughly
- Ask clarifying questions
- Understand the full system before making changes
- If unsure, ask the user

### Rule 3: NO SUGGESTIONS UNLESS ASKED
**CRITICAL:** Do not make suggestions unless explicitly asked by the user.
- Wait for instructions
- Do not offer alternatives
- Do not propose solutions unless requested

### Rule 4: ERADICATE AMBIGUITY
**CRITICAL:** Always strive to eradicate ambiguity.
- Use clear, unambiguous terminology
- Do not use one term to mean multiple things
- Clarify meanings before implementing

### Rule 5: UNDERSTAND TERMINOLOGY
**CRITICAL:** Know what each term means:
- **Icon:** Small circular image (mapmarker), NOT pill, NOT label
- **Pill:** Pill-shaped background sprite, NOT icon, NOT label
- **Label:** Text element, NOT pill, NOT icon
- **highlighted:** Hover state (blue color), NOT active
- **active:** Click/open state (pill resize, post opens), NOT highlighted

### Rule 6: NO UNAUTHORIZED CODE
**CRITICAL:** Never add code, variables, or properties without explicit user approval.
- Ask before adding anything
- Get approval for all changes
- Do not experiment without permission

### Rule 7: RESPECT PROJECT CONTEXT
**CRITICAL:** Understand the full project context before making changes.
- This is a large-scale events platform
- Thousands of map cards will exist
- System must handle scale efficiently
- Do not break existing functionality

### Rule 8: Z-INDEX LIMITATIONS
**CRITICAL:** Maximum z-index on this site is 100 (reserved for welcome modal).
- Everything else is below 50
- Do not exceed these limits
- Map elements use Mapbox sort-keys (1-10 range)

### Rule 9: NO EXPERIMENTATION
**CRITICAL:** Do not create experimental solutions or workarounds.
- Use standard Mapbox approaches
- Do not invent custom systems
- If standard approach doesn't work, ask the user

### Rule 10: FULL COMPLIANCE
**CRITICAL:** Fully comply with all user instructions with zero guessing or renaming without consent.
- Follow instructions exactly
- Ask for clarification when needed
- Do not deviate from instructions

---

## LIMITATIONS: WHAT AI AGENTS CANNOT DO

1. **No Persistent Memory:** AI agents do not remember previous conversations or weeks of work
2. **No Project Context:** AI agents often lack full understanding of the overall project
3. **No Assumptions:** AI agents must not guess or assume - must ask questions
4. **No Unauthorized Changes:** AI agents cannot add code without explicit approval
5. **No Renaming:** AI agents cannot name or rename anything without permission

---

## WHY COMPLIANCE IS CRITICAL

The user has spent weeks on this project with thousands of failures caused by:
- Ambiguous terminology
- Unauthorized code additions
- Guessing instead of researching
- Lack of project memory
- Experimentation without permission

**Future agents must:**
- Read this document first
- Understand their limitations
- Follow all rules strictly
- Ask questions instead of guessing
- Get approval before making any changes
- Use correct terminology always

---

## CURRENT STATE OF PROJECT

### Completed
- Removed 33 redundant lines of conflicting sprite code
- Fixed layer ordering: pills -> labels -> icons
- Added pill sprites loading before layer creation
- Made pills hoverable and clickable
- Fixed label text alignment (left-justified)
- Fixed label visibility in hover_only mode
- Created big map card label layer (3 lines, 145px width)
- Renamed isMultiVenue to isMultiPost throughout codebase

### Remaining Issues
- Pill resize on hover/active needs proper state implementation
- Need to verify correct state names (highlighted vs active)
- Layer ordering verification needed
- Card stacking when overlapping needs verification

---

**END OF DOCUMENT**

**READ THIS FIRST BEFORE MAKING ANY CHANGES**

