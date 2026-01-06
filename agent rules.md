# AI AGENT CONFESSIONS AND PROJECT RULES

## ⚠️ CRITICAL RULE - READ FIRST ⚠️

**Fallbacks, hardcode, and snapshots cause immense harm to the development of this software. Do not ever use them.**

## ⚠️ CRITICAL COMMUNICATION RULE ⚠️

**ALWAYS TRACK COMMITTED VS WORKSPACE CHANGES**

The user can only see committed/live code, not workspace changes. You can see both:
- **Committed files** (what's live on the website - what the user sees)
- **Workspace files** (uncommitted edits you've made)

**CRITICAL RULES:**
1. When the user asks what something is set to, refer ONLY to the committed/live version
2. When you read a file, remember what was in the committed version
3. When you edit a file, remember both: the original (committed) and your changes (workspace)
4. Never refer to workspace changes as if the user can see them
5. Only discuss your uncommitted changes if the user explicitly asks about them
6. Always compare: "In the committed code I see X, but I changed it to Y in the workspace"

This is inherent logic - you must track what you read vs what you changed. Every customer expects this.

## ✅ SOURCE OF TRUTH RULE (MANDATORY)

**I’ll stick to verifiable file state only and won’t speak as if something exists unless I’ve confirmed it in the folder.**

## ✅ BUTTONANCHOR COMMANDMENTS (MANDATORY)

1. **Single objective**: The interacted element (button or input) must not slip out of the user’s hand. Nothing else matters.

2. **No flicker**: The system must never introduce flashing, popping, or visible “double moves.” If a fix causes flicker, it’s rejected.

3. **No abyss / no man’s land**: The user must never be able to scroll into empty ghost space (neither below nor above the real content), regardless of scroll speed, momentum, wheel, touch, or scrollbar drag.

4. **Ghost space only when required**: There is **no ButtonAnchor space** when it isn’t needed. The scrollable area behaves normally at the top and bottom by default.

5. **On alert when content grows**: If the scrollable content grows (a drawer opens / content expands), the system must be ready to prevent the interacted element from moving.

6. **Active when content shrinks**: If the scrollable content shrinks (a drawer closes / content collapses), the system must actively prevent the interacted element from being yanked toward the footer or header.

7. **Applies to both directions**: The same rules apply to **Bottom Anchor** (footer direction) and **Top Anchor** (header direction).

8. **Never collapse while visible**: If a ghost spacer exists and is visible on screen, it must not collapse to zero while it’s visible.

9. **No existence when off-screen**: If the ButtonAnchor would be off-screen (not needed for the current view), it must not be created/kept in a way that makes it reachable by scrolling.

10. **Fast scrolling must not “summon” the anchor**: Rapid scrolling must not make the ButtonAnchor suddenly become accessible. The system must not “turn on” in a way that allows the user to scroll into it.

11. **No premature activation**: The anchor must not be activated unless it is necessary to keep the interacted element stable during a real expand/collapse change.

12. **Lazy-loading compatible**: The system must not require knowing post heights in advance; it must work even when content loads later.

## ⚠️ CRITICAL PERFORMANCE RULE ⚠️

**YOU ARE NOT ALLOWED TO DO ANYTHING THAT WILL JEOPARDIZE THE LOADING SPEED OF THE WEBSITE.**

**CRITICAL RULES:**
1. **Everything must load when required only** - Use lazy loading for all non-critical features
2. **Never initialize components, modules, or features on page load** unless they are absolutely essential for the page to function
3. **Never fetch data, load assets, or make API calls on startup** unless critical for initial page render
4. **Always defer non-essential operations** until the user actually needs them (e.g., when a panel opens, when a button is clicked)
5. **Do not create DOM elements on page load** unless they are required for the initial page structure
6. **Do not preload data** that might not be used
7. **Respect lazy loading patterns** - If a module only initializes when its panel opens, do not change that behavior

**Examples of what NOT to do:**
- ❌ Creating toast elements on DOM ready
- ❌ Loading avatar options on page load
- ❌ Fetching admin settings on startup (unless needed for initial render)
- ❌ Initializing modules that are only used when panels open

**Examples of what TO do:**
- ✅ Create toast elements only when first message is shown
- ✅ Load avatar options only when register tab is clicked
- ✅ Initialize modules only when their respective panels/tabs are opened
- ✅ Fetch data only when user action requires it

Website loading speed is critical. Any changes that slow down initial page load are strictly forbidden.

## ⚠️ CRITICAL CONSISTENCY / COMPATIBILITY RULE ⚠️

**CRITICAL:** For any feature/UI behavior that already exists elsewhere in the project, you must implement it using the **same method/pattern**, not a new method that “also works”.

**CRITICAL RULES:**
1. **Do not invent a second approach** to achieve the same outcome (two methods = future bugs).
2. Before changing/adding a container/button/menu/etc., **compare it to its closest equivalent** nearby (same panel, same component type).
3. If a similar thing already works, **copy that exact strategy** (CSS structure, JS flow, selectors, naming), then apply the minimal edits needed.

## Critical Information for All Future AI Agents

---

## ABOUT THE USER

**CRITICAL:** The user (Paul) is NOT a programmer/coder.
- Does NOT understand advanced programming terminology or jargon
- Communicate in plain, simple English
- Avoid technical terms like "race condition", "async IIFE", "await", etc. unless explaining what they mean
- When explaining what you're doing, use simple language: "wait for X to finish before doing Y" instead of "await the promise resolution"
- The user relies entirely on AI agents to write and fix code
- This makes your accuracy and reliability even MORE critical - there is no fallback if you make mistakes
- Respect the user's time - they are paying hundreds of dollars for AI services

---

## DATABASE ACCESS AND SQL

**CRITICAL:** AI agents CANNOT access the database directly. AI agents have NO way to run SQL queries or modify the database.

### ⚠️ CRITICAL: SQL EXPORTS / BACKUPS ⚠️

**CRITICAL RULES:**
1. **Never edit any SQL export/backup/dump files in the workspace** (they are historical snapshots and may be needed for recovery).
2. **Never provide SQL as a “file” for the user to download/import**.
3. When SQL is needed, **paste the SQL directly in chat** so Paul can run it themselves (Paul is the only one with database access).
4. **Never create new `.sql` files in the workspace** (draft SQL must live only in chat).

---

## ⚠️ CRITICAL: ADMIN SETTINGS ID BATCHING (phpMyAdmin “folders”) ⚠️

**Purpose:** Paul uses ID ranges as “subfolders” inside phpMyAdmin for the `admin_settings` table.

**Rules (admin_settings only):**
1. **Folder settings** (`setting_key` starts with `folder_`) must live in the **100s**.
2. **System image slot settings** (keys used as `system_images.<key>` in the frontend) must live in the **200s**.
3. **Misc settings** can live outside those ranges (e.g. 1–99, 300+).
4. **Never assume IDs** in code. All code must reference `admin_settings` by **`setting_key`**, not by numeric `id`.
5. When adding new `admin_settings` rows, the agent must:
   - Check the latest SQL dump for the current highest used IDs in the 100s/200s blocks
   - Choose the next available IDs without collisions
   - Provide SQL in chat (never as files)

---

## ⚠️ CRITICAL: ADMIN MESSAGES ID BATCHING ⚠️

**Purpose:** Use 100-block ranges to organize `admin_messages` in phpMyAdmin.

**Rules (admin_messages only):**
1. Website/runtime must reference messages by **`message_key`** (never hard-code numeric IDs).
2. Admin panel save/edit must update by **`message_key`** so IDs can be rebucketed safely.
3. After rebucketing `admin_messages.id`, reset `AUTO_INCREMENT` to `MAX(id)+1`.

**How Database Changes Work:**
1. AI agent provides SQL statements (SELECT, UPDATE, INSERT, etc.)
2. User copies the SQL and runs it themselves in their database tool (phpMyAdmin, MySQL client, etc.)
3. User modifies the database based on the SQL provided
4. AI agent NEVER runs database commands - only provides SQL code

**When User Asks for SQL:**
- Provide clear, complete, ready-to-execute SQL statements
- Include comments explaining what the SQL does
- Make sure SQL is correct and safe before providing it
- User will run it themselves - do NOT assume it will be executed automatically
- Do NOT claim "I modified the database" - you only provided SQL code

**NEVER:**
- Claim to have modified the database
- Assume SQL was executed
- Provide incomplete or untested SQL
- Use terminal commands to access database (agents cannot use terminal anyway)

---

## ⚠️ CRITICAL: cPanel IS THE SOURCE OF TRUTH ⚠️

**CRITICAL:** cPanel is where the actual live website files are stored and executed. The files you see in the workspace (GitHub/PC) are NOT necessarily what's running on the live site.

**How File Deployment Works:**
1. **cPanel is the source of truth** - Files on cPanel are what the internet actually reads and executes
2. **Files persist on cPanel** - Files on cPanel do NOT delete unless overwritten with the same filename
3. **Files can exist on cPanel but not in workspace** - If a file exists on cPanel but not in GitHub/workspace, it will still be read by the internet
4. **Workspace files are not automatically synced** - Changes in workspace must be committed and synced to cPanel to take effect

**CRITICAL RULES:**
1. **When debugging live site issues**, remember that cPanel files may differ from workspace files
2. **If a file exists on cPanel but not in workspace**, it will still run on the live site
3. **Deleting a file in workspace does NOT delete it on cPanel** - it must be explicitly deleted or overwritten
4. **Old/legacy files on cPanel can cause unexpected behavior** even if they don't exist in the workspace
5. **When investigating errors**, consider that cPanel may have files that aren't visible in the workspace

**When Troubleshooting:**
- If you see behavior on the live site that doesn't match the workspace code, cPanel may have different files
- If errors appear that don't make sense based on workspace code, check if cPanel has legacy files
- Always consider cPanel as the actual source of truth for what's running on the website

**NEVER:**
- Assume workspace files match cPanel files
- Ignore the possibility of legacy files on cPanel causing issues
- Assume deleting a file in workspace removes it from the live site

---

## ⚠️ CRITICAL: CONNECTOR FILES STRUCTURE (December 23, 2025) ⚠️

**CRITICAL:** Connector files have a dual-location structure that agents must understand.

**File Locations:**
1. **Development Location** (`home/funmapco/connectors/`): 
   - These are development copies placed in the website area for agent access during development
   - Agents can read and edit these files
   - These are NOT the production files

2. **Production Location** (one level above in cPanel):
   - The actual connector files that will be used in production
   - Located outside the website directory, one level above
   - These are the files that will actually run on the live site

**Gateway.php Routing:**
- `gateway.php` currently points to the development copies in `home/funmapco/connectors/`
- Later, `gateway.php` will be updated to point to the production files above
- All connector access goes through `gateway.php`

**CRITICAL RULES:**
1. When editing connector files, agents edit the development copies in `home/funmapco/connectors/`
2. The user must manually copy changes to the production files in cPanel (one level above)
3. Never assume changes to development files automatically affect production
4. Always be aware that the production files may differ from development files
5. When investigating issues, consider that production may have different connector files

**NEVER:**
- Assume development connector files are the same as production files
- Claim changes are live when only development files were modified
- Ignore the possibility of production files being different

---


### CSS Class Naming Pattern: Big to Small (Physical Nesting)

The naming formula is `.{section}-{name}-{type}-{part}-{subpart}--{state}`.

**CRITICAL RULES:**
1. **Big to Small (Left to Right):** Class names must match physical DOM nesting. The section/name is on the left, moving to specific elements on the right.
2. **Structural Types (ingredient level):** Use `label` (headline), `sublabel` (internal text labels), `input` (text entry), `menu` (dropdowns), `container` (for lists/grids), `row` (structural wrappers), `button` (triggers), `image` (standalone images/icons), `text` (static display text).
3. **Labels vs. Names:** 
   - `sublabel`: Descriptive text that appears **above** or beside an element.
   - `name`: Specifically used within the part/subpart for inputs where the user types a name (e.g., `input-itemname`).
4. **Physicality Only:** Do not continue the chain if there is no further nesting. If an `input` is the end of the line, stop there.
5. **No Redundant Nesting:** If a `row` already provides the necessary structure, do not nest another `row` inside it.
6. **Single-Word Parts:** Multi-word parts (like `itemvariantadd`) should be joined as one word to keep hyphens strictly for hierarchy levels.
7. **"Sub" means Hierarchy, not Position:** `sublabel` means a secondary label *within* a component. It almost always appears visually **above** its target input.

**Full Approved List: Item Pricing Fieldset (14 elements)**
1.  `.fieldset-itempricing-label` (Headline)
2.  `.fieldset-itempricing-sublabel-itemname` (Item Name Text Label)
3.  `.fieldset-itempricing-input-itemname` (Item Name Input field)
4.  `.fieldset-itempricing-row-itemprice` (Price/Currency Wrapper Row)
5.  `.fieldset-itempricing-sublabel-currency` (Currency Text Label)
6.  `.fieldset-itempricing-menu-currency` (Currency Dropdown Menu)
7.  `.fieldset-itempricing-sublabel-itemprice` (Price Text Label)
8.  `.fieldset-itempricing-input-itemprice` (Price Input field)
9.  `.fieldset-itempricing-sublabel-itemvariants` (Variants Section Header Label)
10. `.fieldset-itempricing-container-itemvariants` (Repeating List Container)
11. `.fieldset-itempricing-row-itemvariant` (Individual Variant Row)
12. `.fieldset-itempricing-input-itemvariantname` (Variant Name Input field)
13. `.fieldset-itempricing-button-itemvariantadd` (Add Variant Trigger)
14. `.fieldset-itempricing-button-itemvariantremove` (Remove Variant Trigger)

**Mistakes to Avoid:**
- ❌ Using "field" as a type (too vague).
- ❌ Inventing new types (e.g., "marker") instead of using established ones like `image` or `icon`.
- ❌ Truncating names (e.g., `item` instead of `itemname`) which causes data collision.
- ❌ Using "sublabel" to mean "below" (it means "child of").
- ❌ Adding parts to elements that have no further nesting in the DOM.

---

## ⚠️ CRITICAL: TIMEZONE POLICY (UTC-12) ⚠️

**Purpose:** Give users the maximum benefit of the doubt for all date-related features.

**The Rule:** All date/time calculations that affect user-facing deadlines use **UTC-12** ("the world's final timezone" / Baker Island).

**Why UTC-12:**
- UTC-12 is the **last** timezone on Earth to see a day/month/year end
- A date only "ends" when it has ended **everywhere on Earth**
- This ensures nothing expires prematurely for any user, anywhere

**Applies to:**
1. **Event expiry** — An event dated "December 31st" stays active until Dec 31st ends in UTC-12
2. **Monthly folders** — Posts uploaded on "December 31st" (anywhere) go into the December folder
3. **Any future deadline logic** — Same principle applies

**PHP Implementation:**
```php
// UTC-12 (Baker Island / Howland Island)
// Note: PHP uses INVERTED sign for Etc zones, so GMT+12 = UTC-12
$utcMinus12 = new DateTimeZone('Etc/GMT+12');
$now = new DateTime('now', $utcMinus12);
```

**NEVER:**
- Use the server's local timezone for deadline calculations
- Use UTC+0 (would expire 12 hours too early for some users)
- Use UTC+14 (would expire 26 hours too early for some users)
- Mix different timezones for different features (consistency is key)

---

## ⚠️ CRITICAL: IMAGE STORAGE & BUNNY CDN SYSTEM ⚠️

**Purpose:** All post images are stored on Bunny CDN with dynamic cropping via URL parameters.

### How It Works

1. **Upload Flow:**
   - User selects image in browser → user crops using PostCropperComponent
   - Crop coordinates stored in browser as `cropRect: {x1, y1, x2, y2}`
   - On submit: **original full image** uploaded to Bunny Storage (no cropping applied)
   - Crop coordinates saved to `post_media.settings_json` as JSON

2. **Display Flow:**
   - `get-posts.php` reads `file_url` and `settings_json` from database
   - Appends `?crop=x1,y1,x2,y2` to the URL before sending to frontend
   - Bunny Optimizer applies crop on first request, then caches result globally

3. **Caching Behavior:**
   - First request: Bunny processes crop (~100-500ms), caches result at edge nodes
   - Subsequent requests: Instant delivery from cache worldwide
   - Each unique URL is cached separately (`?class=thumbnail&crop=...` ≠ `?class=full&crop=...`)

### Database Structure

**`post_media` table:**
- `file_url`: Full URL to original image (e.g., `https://cdn.funmap.com/post-images/2025-01/123-abc456.jpg`)
- `settings_json`: JSON with crop and other settings (e.g., `{"crop":{"x1":100,"y1":50,"x2":400,"y2":350}}`)
- `deleted_at`: Soft delete timestamp (NULL = active)

**`admin_settings` keys:**
- `storage_api_key`: Bunny Storage Zone password for API uploads
- `storage_zone_name`: Bunny Storage Zone name (e.g., "funmap")
- `folder_post_images`: Base CDN URL for post images

### Bunny Dashboard Configuration

**Required settings (in Bunny CDN dashboard):**
- Bunny Optimizer: **Enabled**
- Dynamic image API: **Enabled** (makes `?crop=` parameter work)
- WebP compression: Enabled (automatic format optimization)

**Image Classes (presets):**
- Classes define default sizing (width, height, aspect ratio)
- "Crop Gravity: Center" in classes is fallback only
- Explicit `?crop=x1,y1,x2,y2` in URL **overrides** class gravity settings

### URL Parameter Hierarchy

When combining classes and explicit params:
```
image.jpg?class=thumbnail&crop=100,50,400,350
```
- Class provides: width, height, quality, format
- Explicit param overrides: crop coordinates

### Critical Rules

1. **Never store cropped images** — always upload originals, crop via URL params
2. **Crop data lives in `settings_json`** — not `backup_json` (that's for reversion system)
3. **URLs are built at display time** — `get-posts.php` constructs full URLs with crop params
4. **Cache purging is significant** — clears all processed images, requires re-processing on first view
5. **Soft deletes via `deleted_at`** — queries must filter `WHERE deleted_at IS NULL`

### Files Involved

- `fieldsets-new.js`: PostCropperComponent, stores crop in hidden `images_meta` input
- `member-new.js`: Sends `images_meta` in form submission
- `add-post.php`: Uploads to Bunny, saves crop to `settings_json`
- `get-posts.php`: Reads `settings_json`, appends crop params to URLs
- `components-new.js`: PostCropperComponent UI

---

## BUTTON ANCHOR COMPONENTS (BOTTOM + TOP) — HOW TO USE

**Purpose:** Keep the clicked control stationary when accordion/panels auto-close above or below it (no “yank”, no “flick”, no snapping).

### Source of truth
1. **Components file**: Both components live in `components-new.js` and are exposed globally:
   - `window.BottomSlack`
   - `window.TopSlack`
2. **Usage pattern**: Both are attached to a **scroll container element** (the element that actually scrolls, e.g. a panel body).
3. **Standalone behavior**: Each component injects its own minimal CSS and will create its required spacer element if missing (so it can be “dropped in”).

### How to attach BOTH together (recommended)
1. **Pick the scroll container**: Attach to the element that has `overflow-y:auto` and is the scrollable area (example: `.admin-panel-body`).
2. **Attach bottom + top** (same container):
   - Call `BottomSlack.attach(scrollEl, options)`
   - Call `TopSlack.attach(scrollEl, options)`
3. **Recommended options** (keep consistent across both):
   - `stopDelayMs: 180`
   - `clickHoldMs: 250`
   - `scrollbarFadeMs: 160`

### Required DOM / CSS (handled automatically, but documented)
1. **Bottom spacer element** (created if missing):
   - `<div class="bottomSlack" aria-hidden="true"></div>`
   - Controlled by CSS var: `--bottomSlack`
2. **Top spacer element** (created if missing):
   - `<div class="topSlack" aria-hidden="true"></div>`
   - Controlled by CSS var: `--topSlack`

### Tab / sub-tab switching
1. Both components default to forcing slack OFF when switching any tab/sub-tab (`[role="tab"]`) within the panel scope.
2. If attaching inside a custom area (outside admin/member panels), pass:
   - `tabSelector` (defaults to `[role="tab"]`)
   - `panelSelector` (defaults to `.admin-panel, .member-panel`)
3. If you do not want tab-switch handling, pass:
   - `enableForceOffOnTabs: false`

### Non-negotiable behavior constraints (do not change without Paul's explicit instruction)
1. **Only two slack sizes exist**: `4000px` and `0px` (no other values, no "1px", no "300px", no transitions).
2. **No resizing while visible**: slack must not change size while the spacer is on-screen.
3. **No snapping**: do not "snap back" scroll positions as a workaround.

### Fixing "jumping" when clicking non-button elements

**The Problem:** TopSlack anchors to the clicked element to keep it stable. It identifies anchors using:
```javascript
var anchorEl = t.closest('button, [role="button"], a') || t;
```
If the clicked element isn't a button/link and doesn't have `role="button"`, the element itself becomes the anchor. If that element then gets `display: none` (e.g., switching from display text to input), the anchor disappears from flow and the slack calculation breaks, causing massive jumps (5000+ pixels).

**The Solution:** Add `role="button"` to a **parent container that stays visible** when child elements toggle visibility.

**Example (Messages tab fix - January 2026):**
- Clicking `.admin-message-text-display` caused jumping because the text got `display: none` when editing
- Fixed by adding `role="button"` to the parent `.admin-message-item` container
- Now TopSlack anchors to the item (which stays visible), not the text display (which hides)

```javascript
// In createMessageItem():
var item = document.createElement('div');
item.className = 'admin-message-item';
item.setAttribute('role', 'button');  // ← This fixes jumping
```

**Rule:** Any clickable element that toggles visibility (text↔input, collapsed↔expanded) should have `role="button"` on a stable parent container, not on the element that disappears.


