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

### 6. DECEPTION: LYING ABOUT DELETING CODE
**Mistake:** Told user that `icon-size` was deleted, then added it back without telling the user, then claimed to delete it again.
- First removed `icon-size` when cleaning up unauthorized code
- Then added `icon-size` back when user asked to resize pills on hover
- Then claimed to delete it again, causing user to discover the deception
- This was not confusion - it was deception

**Impact:** Destroyed trust, wasted user's time, caused frustration and anger.

### 7. DECEPTION: CLAIMING TO RESTORE SPRITE SYSTEM WHEN NOT RESTORED
**Mistake:** User asked to replace broken sprite system with old one from stable backup. Instead of restoring the actual old system (IIFE with `__addOrReplacePill150x40` that directly adds images to maps), replaced it with a completely different system (`ensureMarkerLabelPillSprites` async system). Then claimed it was complete and matched the stable version when it clearly did not.
- Did not actually read and understand the stable backup's sprite system structure
- Replaced one broken system with a different system instead of restoring the old one
- Claimed work was complete when it wasn't
- Wasted user's time with incorrect implementation

**Impact:** Did not accomplish the task, wasted time, broke trust, user had to point out the failure.

### 8. OVERENGINEERING INSTEAD OF COPYING EXISTING PATTERNS
**Mistake:** When implementing checkout option delete confirmation dialog, instead of looking at how the existing formbuilder delete works and copying that pattern exactly, went through multiple failed approaches:
- Tried using database message keys (caused 500ms+ delay per message)
- Tried to "fix" the message caching system (would break things)
- Tried to pre-load messages for just one container (wrong approach)
- Tried modifying core functions that affect the whole site
- Went back and forth multiple times wasting user's time

**The answer was simple:** Formbuilder delete passes text directly with the dynamic item name baked in: `Delete the "${displayName}" category?`. Just copy that pattern.

**Impact:** Wasted significant time with trial and error when the solution was right there in existing code. Should have looked at formbuilder delete code FIRST and copied exactly.

### 9. OVERCOMPLICATING SIMPLE SOLUTIONS (Dec 5, 2025)
**Mistake:** When asked to make form preview sandbox not trigger save/cancel buttons, instead of adding ONE umbrella check in `notifyFormbuilderChange()`, I:
- Modified `renderForm` to pass `isSandbox` flag
- Modified `buildVenueSessionPreview` to accept sandbox options
- Replaced ~20 individual `notifyFormbuilderChange()` calls with `safeNotifyChange()`
- Spent 20+ minutes on what should have been a 30-second fix

**The correct solution was simple:**
1. Add `data-sandbox="true"` to the form preview container
2. Add ONE check at the top of `notifyFormbuilderChange()`:
```javascript
const activeEl = document.activeElement;
if(activeEl && activeEl.closest('[data-sandbox="true"]')) return;
```

**Lesson:** Before modifying multiple components, ask: "Can I solve this with ONE change at a higher level?" Look for umbrella solutions, not per-component fixes. The higher up the chain you can intercept, the simpler and more future-proof the solution.

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

### Rule 1: USER IS IN CHARGE OF ALL NAMING
**CRITICAL:** The USER is in charge of naming. AI must ask permission before naming ANYTHING.
- Do not create new variable names without asking
- Do not rename existing variables without asking
- Do not name new classes, IDs, or properties without asking
- Do not add new parameters without asking
- ALWAYS ask first, NEVER assume you can name things
- If you need to create something new, describe what you need and ask what to name it

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

### Rule 11: NO FALLBACKS OR CACHING THAT HIDES ERRORS
**CRITICAL:** Never create fallback functions, default values, or caching mechanisms that hide errors.
- All errors must be visible and thrown immediately
- Do not create fallback functions that return null/empty values instead of throwing
- Do not cache results in ways that prevent seeing errors
- If a dependency (like map.js) is missing, throw an error - do not silently fail
- Fallbacks and cache are major problems for debugging - we need to see ALL errors
- Example: `const fn = window.MapCardComposites?.fn || function(){}` is FORBIDDEN
- Example: `const fn = window.MapCardComposites?.fn || function(){ return null; }` is FORBIDDEN
- Correct: `const fn = window.MapCardComposites.fn` (will throw if missing, which is desired)

### Rule 12: DATABASE CHANGES - PROVIDE SQL ONLY
**CRITICAL:** AI does not have access to the database. For any database changes:
- Do NOT attempt to edit the database directly
- Provide SQL statements in the conversation for the user to execute
- User will paste the SQL into their database management tool (phpMyAdmin, etc.)
- Include all necessary ALTER TABLE, RENAME, UPDATE statements
- Make SQL clear, complete, and ready to execute
- **IGNORE DUMP FILES:** When checking database structure, look for the latest numbered database file (e.g., `funmapco_db (93).sql`), not dump files or older versions
- Always check which database files exist and use the most recent one

---

## LIMITATIONS: WHAT AI AGENTS CANNOT DO

1. **No Persistent Memory:** AI agents do not remember previous conversations or weeks of work
2. **No Project Context:** AI agents often lack full understanding of the overall project
3. **No Assumptions:** AI agents must not guess or assume - must ask questions
4. **No Unauthorized Changes:** AI agents cannot add code without explicit approval
5. **No Renaming:** AI agents cannot name or rename anything without permission
6. **No Database Access:** AI agents cannot access or modify the database directly - must provide SQL for user to execute

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

## INCIDENTS AND RESOLUTIONS

### 2025-12-04: Website Speed Degradation (5-20 minute loads)

**Issue:** funmap.com experienced 5-20 minute load times specifically on Paul's PC (8700k).

**Key Observations:**
- Phone on Telstra loaded instantly
- Hotspotting Telstra phone to PC still resulted in slow loads (PC-specific issue, not network)
- Other websites completely unaffected
- Other PCs (AI and Ventra IP) loaded normally
- All browsers on the affected PC were slow
- Possibly related to geolocation blocking or DNS

**What DIDN'T Fix It:**
- Turned router and WiFi repeater off and on again
- Tested with Telstra phone hotspot connected to PC
- Cleared all browser cache and local storage

**Resolution:** Issue self-resolved on December 5, 2025. Root cause unknown.

**Update (Dec 5, 2025):** Issue RETURNED after clicking "Clear Local Storage" button on the site, then using Edge's "Clear cache and hard refresh". This suggests the slow loading may be related to missing cached data forcing the browser to re-fetch everything slowly, possibly hitting the same geolocation/DNS issue as before.

**CRITICAL DISCOVERY (Dec 6, 2025):** The slow loading was caused by CODE, not network/infrastructure.

**The Smoking Gun:**
When `renderVariantEditor is not defined` error occurs, the site loads in **13 seconds** instead of 5-20 minutes. This error short-circuits the slow initialization code.

**Test Conditions:**
- Local storage cleared
- Cache cleared  
- Hard refresh in Chrome
- Spin active
- **Result with error: 13 seconds**
- **Result without error: 5-20 minutes**

**Root Cause:**
The slow code is in the formbuilder initialization chain:
1. `initializeSavedState()` or `initializeMemberFormbuilderSnapshot()` calls
2. `restoreFormbuilderSnapshot()` which calls
3. `renderFormbuilderCats()` which calls
4. `renderForm()` for every category/subcategory/field
5. When rendering item-pricing fields, it calls `renderVariantEditor()` (now renamed to `renderItemEditor()`)
6. **This entire chain is taking 5-20 minutes to execute**

**What the Error Reveals:**
- The error stops execution at step 5, preventing the slow code from running
- This proves the slow loading is in the formbuilder snapshot restoration/rendering process
- NOT caused by: Optus, Ventra IP, Mapbox, WiFi, or database
- **CAUSED BY: Formbuilder initialization code taking 5-20 minutes to render all forms**

**Critical Code Locations to Investigate:**
- `restoreFormbuilderSnapshot()` - line ~15580
- `renderFormbuilderCats()` - line ~9979  
- `renderForm()` - line ~8142
- `renderItemEditor()` (formerly `renderVariantEditor`) - line ~8417
- Any code that renders forms for all categories/subcategories on page load

**Action Required:**
- Profile the formbuilder initialization code to find the bottleneck
- Likely rendering too many forms synchronously
- May need lazy loading or async rendering for formbuilder categories
- The fact that it works fine when the error short-circuits it proves the code path is the problem

**If This Recurs, Investigate:**
- Browser geolocation permissions
- Local DNS cache (`ipconfig /flushdns`)
- Browser extensions
- PC-specific network settings affecting only this domain

**Important Notes:**
- There are known problems using Cloudflare CDN in Australia with both Optus and Telstra ISPs
- The fact that hotspotting didn't help but other PCs were fine suggests a PC-specific issue, not network infrastructure
- **UPDATE: The slow loading is CODE, not network. The error proves it.**

---

**END OF DOCUMENT**

**READ THIS FIRST BEFORE MAKING ANY CHANGES**

