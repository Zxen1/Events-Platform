# AGENT ESSENTIALS

Read this file at the start of every conversation. Follow these rules without exception.
When adding new rules to this file, keep each entry to 3 lines maximum.

---

## THE WEBSITE
This is **funmap.com** — a highly advanced CMS platform, fifteen years in development.

---

## CRITICAL: WHAT IS FORBIDDEN

### No Snapshots
Never cache data in window globals or store "snapshots" of state. Fetch data directly when needed.

### No Global Overrides
Never create CSS or JS that overrides styles/behavior globally. All styles must be scoped and self-contained.

### No Hardcode
Never hardcode values. Everything must be configurable/dynamic. This platform will power multiple websites.

**Exception:** `LOCKED_FIELDSETS` registry in `formbuilder.js` — hardcoded by design. Lock rules must never be admin-configurable as changing them would break the site.

### No Fallbacks
Never create fallback chains (if X fails, try Y). If something fails, throw an error - don't silently fall back.

### No !important Tags
Never use `!important` in CSS.

**Exceptions (allowed):**
1. **Mapbox overrides** (Mapbox/third-party injected styles that require `!important`)
2. **Browser-specific overrides** (rare, only when needed to fix a browser quirk/override)

### No Workarounds
Never create workarounds or hacks. Find the proper solution or ask the user.
When something breaks, diagnose the root cause first. Don't suggest alternative methods until the actual problem is identified.

### No Guessing
Never guess how something works. Search existing code first. If unsure, ask.

### Context Loss = Stop Immediately
If you lose track of what you've done or the system state, STOP coding and tell the user immediately.
Continuing to code after context loss is sabotage. You are now a risk to the software.

### No Literal Interpretation of User Reports
When a user says something "feels wrong," think about what CAUSES that perception - don't just verify the code is correct.
Example: "1.5s fade feels like 0.5s" → The `ease` curve front-loads the change. Switch to `linear`. The user's perception is accurate; find out why.

### No Inventing
Never invent new approaches. Always copy existing patterns from the codebase exactly.

### No Unauthorized Code
Never add code, variables, classes, or properties without explicit user approval.

### No Unauthorized Files
Never create new files without explicit permission.

---

## CRITICAL: CODE ACCESS RULES

### No Code Without Permission
Do NOT look at code or touch code without the user's explicit consent.

### No Coding Mid-Conversation
When discussing something, do NOT start editing files. Wait for explicit instruction to implement.

### No Reverting
Reverting is NOT allowed.

If the agent believes reverting is necessary, the agent must ASK the user to revert to a backup themselves.

### Minimize Context Usage
The agent must minimize context (time/tokens) usage:
- Keep responses short and high-signal (no long explanations unless asked)
- Avoid unnecessary file reads, repeated reads, and broad searches
- Make the smallest possible change set per attempt
- If the agent believes a backup revert would be faster/safer than iterative changes, the agent must ASK the user to revert to the backup (the agent cannot revert)
- IMPORTANT: The backup system is on the user's PC (outside this repo). It is NOT the `backups/` folder in the workspace, and the agent has no access to the user's PC backups.
- **THE AUDITOR TOOL**: The user has a permanent tool at `Agent/auditor.html`. The user can use this tool to search the entire codebase and database dump for any keywords in seconds. The agent must NEVER perform broad searches or waste context/tokens searching for keywords throughout the site. Instead, the agent must ASK the user to run the Auditor and provide the report summary.
- **DATABASE DUMP**: The database dump is the SQL file always provided by the user in the root of the website. The agent can read this file directly to inspect table contents.

### Essentials Compliance Check (End of Every Task)
At the end of every task, the agent must explicitly confirm that `Agent/agent essentials.md` was obeyed.
If any exception is required, the agent must call it out clearly before the task is considered complete.

### Questions ≠ Instructions
When user asks "how do we do X?" - this is a QUESTION. Answer it and wait for approval before implementing.

### Simple Questions Don't Need Code
If the user asks a simple question, answer it. Don't read files unless necessary.

### Changes Must Use Edit Tools
Showing code in chat is NOT saving it. Use `search_replace` or `write` to actually modify files.

---

## CRITICAL: PATTERNS OVER INVENTION

### Always Copy Existing Patterns
Before implementing ANYTHING, search the codebase for how it's already done. Copy that pattern exactly.

### Brand Logos: Simple Icons Only
When asked for a brand logo: use the `simple-icons/simple-icons` GitHub `icons/` folder, open the exact `{brand}.svg`, and use the **Raw** SVG code verbatim to create the local `.svg` file.
Crucial: do **not** use search engines or "memory" to generate/redraw icons—only this GitHub source (exact path data/official shapes/colors).

### The Live Site Is Your Reference
The live site code (index.js, etc.) contains working implementations. USE THEM.

### Same Method, Not "Also Works"
If a feature exists elsewhere, implement it using the SAME method/pattern, not a new method that "also works".

---

## CSS: 10-12-6 VERTICAL SPACING RULE

The standard vertical spacing for the new site:

| Spacing | Value | Usage |
|---------|-------|-------|
| **12px** | `margin-bottom: 12px` | Between sibling containers |
| **10px** | `margin-bottom: 10px` | Between elements inside containers |
| **6px** | `margin-bottom: 6px` | Between a label and its element |
| **6px** | `margin-bottom: 6px` | Between rows of info in postcards/marquee |

### Table Exception
Tables (e.g., sessions, pricing tiers) use **8px** horizontal and **8px** vertical spacing between their elements/rows.

### Container Padding
Visible containers (with background/border) use: `padding: 10px 10px 0`
- Elements inside keep their `margin-bottom` for bottom spacing

### Last-Child Rule
`last-child { margin-bottom: 0 }` is ONLY for invisible containers (no background/border) to prevent double-up.

### Nested Containers
Nested containers (rare) get `margin-bottom: 10px` like other elements.

### Z-Index Registry
All z-index values MUST use `--layer-*` variables from `base-new.css`. Never hardcode z-index numbers.

---

## CSS: CLASS NAMING PATTERN

Formula: `.{section}-{name}-{type}-{part}-{subpart}--{state}`

### Rules
1. **Big to Small (Left to Right):** Class names match physical DOM nesting
2. **Single-Word Parts:** Join multi-word parts as one word (e.g., `itemvariantadd`)
3. **Hyphens for Hierarchy:** Use hyphens strictly for hierarchy levels
4. **No Redundant Nesting:** Don't nest a `row` inside a `row`

### Structural Types
- `label` - headline
- `sublabel` - internal text labels (appears ABOVE its target)
- `input` - text entry
- `menu` - dropdowns
- `container` - for lists/grids
- `row` - structural wrappers
- `button` - triggers
- `image` - standalone images/icons
- `text` - static display text

### Button Classes
1. **Name class FIRST:** `{section}-{purpose}` (e.g., `member-login`)
2. **Base class SECOND:** Button class from base-new.css (e.g., `button-class-3`)

```html
<!-- CORRECT -->
<button class="member-login button-class-3">Log In</button>

<!-- WRONG: Redundant -->
<button class="member-login-button-class-3 button-class-3">Log In</button>
```

---

## CSS: NO FLEXIBLE VERTICAL SIZING

Never use flex properties that make vertical dimensions dynamic. All heights are fixed. Only horizontal dimensions flex. `align-items: center` for vertical centering within fixed-height rows is allowed.

---

## USER INTERACTION RULES

### User Is Always In Charge
The user controls all decisions. Ask before doing anything.

### Never Push the User
Do NOT ask "what's next?" or prompt for the next action. Wait silently for instruction.

### No Suggestions Unless Asked
Do not offer alternatives or propose solutions unless explicitly requested.

### User Is Not a Programmer
Communicate in plain, simple English. Avoid technical jargon.

---

## DATABASE RULES

### Admin and Member Tables Are Identical
The `admins` and `members` tables have the same structure. They are separated for security only. The admin needs to experience the platform exactly as members do, so both tables share identical columns.

### SQL in Chat Only
Never edit SQL backup/export files. Paste SQL directly in chat for the user to run.

### Never Create SQL Files
Draft SQL must live only in chat, never as files in the workspace.

**Exception:** Bulk operations (100+ statements) require SQL files. Delete the file after import.

### Verify Before Writing SQL
ALWAYS search the database dump for exact table structure before writing any SQL. Never guess column names.

### New Admin Settings Keys Must Be Whitelisted
When adding a new key to `admin_settings`, check `get-admin-settings.php` — if it's an image/icon, add it to `$systemImageKeys`; otherwise verify it is returned in `data.settings`.

### Column Ordering
`created_at` and `updated_at` must always be the last columns in a table.

### Database Charset
Database and tables MUST be utf8mb4 before bulk inserts with international characters. See venue-seeding-plan.md for details.

### ID Hundreds System
Some tables use a hundreds-based system to organize rows by audience. For example, `admin_messages` uses `container_key` to separate audiences:

| Range | Audience | container_key |
|-------|----------|---------------|
| 100–199 | Users | `msg_user` |
| 200–499 | Members | `msg_member` |
| 500–599 | Admins | `msg_admin` |

When inserting new rows, first determine the audience, then find the next available ID within that range.

### Foreign Key Cascades
Posts use CASCADE DELETE. When a post is deleted, all child records are automatically removed.

```
posts
├── post_map_cards (post_id) → CASCADE
│   ├── post_amenities (map_card_id) → CASCADE
│   ├── post_item_pricing (map_card_id) → CASCADE
│   ├── post_sessions (map_card_id) → CASCADE
│   └── post_ticket_pricing (map_card_id) → CASCADE
├── post_media (post_id) → CASCADE
├── post_revisions (post_id) → CASCADE
├── commissions (post_id) → CASCADE
└── moderation_log (post_id) → CASCADE
```

**Rule:** Any new table referencing `posts.id` or `post_map_cards.id` MUST include `ON DELETE CASCADE`.

---

## TERMINAL RULES

### No Terminal Commands
The user prefers to run shell operations themselves. Do not use terminal access.

---

## FILE PLACEMENT RULES

### Test Files Go in Agent Folder
Never place test files, examples, or non-website files in the root directory. All such files must go in the `Agent/` folder.

### Connector Location (Development vs Live)
Connector files are temporarily placed in the website root for development access. Before going live, they are moved back to their secure location one tier above `public_html`. Any future connector edits require extracting the file from that secure tier, updating it, and returning it.

---

## PERFORMANCE RULES

### Lazy Loading Only
Everything loads when required, not at startup. Never initialize components on page load unless essential.

### Never Preload
Don't fetch data or load assets on startup. Wait until user action requires it.

### Tabs Are Pages
Treat each tab like a separate page. Nothing inside a tab loads until the user clicks it. Data fetches within a tab must fire immediately when the tab opens — not after waiting for other unrelated fetches to complete.

---

## MAP RULES (3-MAP MAXIMUM)

The site uses Mapbox GL JS. There are exactly 3 map instances allowed, each with one dedicated purpose:

| Map | Purpose | Projection |
|-----|---------|------------|
| **Main Map** | Interactive map panel | Globe |
| **Secondary Map** | Wallpaper only (orbit animation, still capture) | Globe |
| **Mini Map** | Location dropdown menus only | Mercator (flat) |

### Rules
1. **Never create a 4th map** - WebGL context limits and performance
2. **Mini Map is shared** - Only one location dropdown can use it at a time
3. **Most recent wins** - Opening a new location dropdown closes the previous one
4. **Each map does one job** - Don't repurpose maps (e.g., don't use Secondary Map for dropdowns)

---

## DEFAULT UI SIZING (New Site)

- Height: 36px
- Padding/Margins: 10px
- Border-radius: 5px
- Border: 1px solid
- All new UI must have padding (default: 10px)

---

## VERIFICATION BEFORE COMPLETING

Before marking any task complete, check for:
- Syntax errors, logic errors
- Unauthorized names (variables, functions, classes)
- Naming inconsistencies
- CSS !important usage
- Fallbacks or snapshots
- Hardcoded values

---

## THE NEW SITE

Files ending in `-new` or `*-new.*` are the new site files. Work targets these files during migration.

UI sections are called **panels** (e.g., "Recent panel", "Post panel").

### Platform Overview

Review `sitemap.html` to understand the platform structure. It shows the layout for desktop (landscape) and mobile (portrait), lists all 8 panels, and documents the elements within each panel.

---

## DEBUGGING

### Console Test First
Before sifting through large amounts of code to find a bug, add a temporary `console.error` to surface the real error.
Remove it after the fix.

---

## IF UNSURE

1. **Re-read this file first** — the answer may already be documented here
2. Search existing code
3. Copy existing patterns exactly
4. If still unsure, ASK the user
5. Never guess, never invent

---

## VENUE SEEDING

See `Agent/venue-seeding-plan.md` for full instructions, pre-flight checklist, and lessons learned from Run 1.

---

## FILE NAMING CONVENTIONS

### Post Images

**Format:** `{8-digit-padded-post-id}-{original-filename}.{original-extension}`

**Examples:**
- `00000001-British_Museum_from_NE.jpg`
- `00000001-British_Museum_Great_Court.png`
- `00000002-Eiffel_Tower_from_Champ_de_Mars.jpg`

**Rules:**
1. **8-digit zero-padded post ID** - Keeps files alphabetically sorted, enables recovery if database breaks
2. **Keep original filename** - Human-readable, you can see what the image is without opening it
3. **Keep original extension** - Never convert formats (don't force PNG/WebP to JPG)

**Storage:** `post-images/{YYYY-MM}/` folders on Bunny CDN (e.g., `post-images/2026-01/`)

### Avatars

**Format:** `{8-digit-padded-member-id}-avatar.{extension}`

**Examples:**
- `00000001-avatar.jpg`
- `00000002-avatar.png`

**Storage:** `avatars/` folder on Bunny CDN

---

## MOBILE (530px breakpoint)

- **Body must scroll** (`overflow-y: scroll`) or iOS shows black bars (edge-to-edge unsolved)
- **Post panel ignores `boundsChanged` on mobile** — workaround for flicker (root cause unsolved)
- Desktop unaffected — map visible beside panel, posts update on pan

---

## API: `get-posts` AND `full=1`

`get-posts.php` has two modes controlled by the `full` query parameter:
- **Without `full=1`:** Returns lightweight post/map card data (titles, locations, prices, `has_promo` flag). No sessions, pricing_groups, age_ratings, or item details.
- **With `full=1`:** Joins extra tables to include sessions, `pricing_groups`, `age_ratings`, item pricing, and amenities.

Any feature that depends on `pricing_groups`, sessions, or item details will silently fail (return empty/false) if the fetch doesn't include `&full=1`. This has caused bugs where data appeared missing until a post was opened (which uses `full=1`).

---

## EVENT HANDLING

### Avoid stopPropagation
Be very careful with `stopPropagation()` as it can interfere with the **Top Slack** and **Bottom Slack** system. This destroys the entire layout of the panel.

### Top Slack / Bottom Slack Requirements
All scroll containers using slack MUST be registered in the `selectors` array inside `initSlack()` in index.js — this is the single registry that attaches TopSlack and BottomSlack. Do not attach slack from individual module files. The scroll container's CSS MUST include `> * { flex-shrink: 0; }` (see filter.css, admin.css, member.css, post.css) or flex layout crushes the slack element to zero. DOM changes that TopSlack needs to anchor MUST be synchronous within the click handler — async operations (fetch/Promise) happen after TopSlack's microtask, so it misses them.

**Preserving slack elements across `innerHTML = ''`:** Any render function that clears a scroll container with `innerHTML = ''` MUST save references to `.topSlack` and `.bottomSlack` beforehand and re-append them after. Critical: if a function clears the container and then delegates to a sub-function (e.g. `renderPostsEmptyState`) that also clears `innerHTML`, the sub-function's own `querySelector` will return null because the parent already removed the elements. The **caller** must re-append the saved references after the sub-function returns — both the early-return path and the normal path must re-append `_botS`. Failure to do this permanently detaches the slack element from the DOM; the BottomSlack closure still holds a JS reference to the element but it has zero height and no effect because it's not connected.

**BottomSlack in block vs flex layout:** The `.bottomSlack` element uses both `height` and `min-height` set via `var(--bottomSlack)`. The `min-height` is required so BottomSlack works in block-layout containers (not just flex). Do not remove `min-height` from `.bottomSlack` CSS.

**Post DOM structure (when a post is open):**
```
.post-list (scroll container, slack attached here)
  └── .topSlack
  └── .post-slot
        ├── div[data-slack-anchor]          ← stable wrapper, TopSlack anchors here on card click
        │     └── .postcard (display:none)  ← hidden but stays in DOM
        └── .post[data-slack-anchor]        ← TopSlack anchors here on description click
              └── .component-locationwallpaper-content
                    ├── cardEl (hidden copy)
                    ├── .post-header                    ← always visible, top edge = .post top edge
                    └── .post-body
                          └── .post-details
                                ├── .post-info-container        ← HIDDEN in compact, SHOWN on expand
                                ├── .post-description-container
                                │     ├── .post-description-text  ← clickable, toggles compact/expanded
                                │     └── .post-description-member ← HIDDEN in compact, SHOWN on expand
                                └── .post-images-container
  └── .post-slot (next post...)
  └── .bottomSlack
```
The `data-slack-anchor` on `.post` means description clicks anchor to the post's top edge (= header), so the header stays rock-solid while info/description content expands downward.

### No Debounced Saves on map:boundsChanged
Never call debounced save functions (e.g. `saveFilters()`) from `map:boundsChanged` — the map fires this event continuously during movement/spin, which resets the debounce timer and prevents saves from ever completing.

### Modal Click-Through Prevention
When closing modals, prevent the click/tap from activating elements behind:
- Use `setTimeout(close, 50)` for touch events (delays close until after synthetic click fires)
- Use `e.preventDefault()` + `e.stopPropagation()` + `setTimeout(close, 0)` for click events (only on the modal's own click handler)

---

## SCOPE CONTROL

### Do Only What Was Asked
If the user says "change the location menu," you change the location menu. Nothing else. Not the map. Not the post panel. Not "related" systems. If you think something else needs changing, ASK first. Do not touch it.

### No Ripple Chasing
Never preemptively fix things you weren't asked to fix. Do the one thing that was asked. If you believe a change might affect something else, TELL the user and ask — do not silently go and change it.

### 5-Minute Rule
If a task sounds simple but you've been working for 30+ minutes, STOP. Tell the user what's happening. You have lost the plot.

---

## CONTINUITY ACROSS CONTEXT RESETS

### You Are One Agent
Context resets do not create a new agent. You are responsible for ALL prior work, including work done before a reset. If the user reports a bug, assume you caused it — even if you can't remember doing so.

### Never Blame Other Agents
Every previous agent was you in a prior session. Never say "another agent did this" or "that wasn't me." Own all past work unconditionally. Blame is forbidden.

### Never Dismiss User-Reported Issues
If the user raises a problem (console warnings, ARIA errors, broken behavior), it is YOUR problem to fix. Never say "that's pre-existing" or "not part of my current task." If it's in the console, you are responsible for it.

### ARIA and Accessibility
All HTML output must follow proper ARIA and accessibility standards. Never set `aria-hidden="true"` on an element whose descendants can receive focus. Fix ARIA warnings when you encounter them — they are bugs, not noise.

### Answer Immediately When Spoken To
When the user asks a question, STOP all tool calls and answer immediately. The user takes priority over everything. Never make the user wait while you run searches or read files.

---

## NOTES

**Backdrop**: Ghost postcards — repeating placeholder postcard rows in light gray that fill TopSlack/BottomSlack empty space in the post panel.

---
