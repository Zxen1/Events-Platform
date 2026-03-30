# Storefront System — Handoff Notes
Date: 2026-03-09

## Starting Point After Backup Restore

Three things already exist. Do not rebuild them:

1. **Admin switch** — in `index.php`, a toggle switch with `data-setting-key="storefront_enabled"` and `id="adminStorefrontEnabled"` exists in the admin settings tab after "Devtools Console Filter"
2. **Database rows** — `admin_settings` ID 29 (`storefront_enabled = true`), `admin_messages` ID 309 (`msg_storefront_select_prompt`), `admin_instructions` ID 52 (full spec)
3. **Map marker detection** — in `renderMapMarkers` in `post.js`, search for `isStorefront`. It correctly detects storefront groups (2+ general posts, same member, same coordinates, gated on `storefront_enabled`). Mutually exclusive with `isMultiPostVenue`. Do not rewrite it.

Everything else needs to be built.

---

## What This Is

A storefront is an extension of the multipost location system. It is lightweight. It is display-layer only. No database records. No flags. No registry.

The multipost system groups posts at the same location and shows a special marker. The storefront does the same thing — but only when all posts are general (not events) and all belong to the same member. Instead of a multipost marker, it shows the member avatar. Instead of individual postcards, it shows one storefront postcard.

Think of it as: multipost + same member + all general = storefront.

---

## What Needs to Be Built

### Post Panel (post.js)

Before the `posts.forEach` loop in `renderPostList`:
- If `storefront_enabled` is false, do nothing
- Otherwise: group posts by `member_id + lat + lng` using `pickMapCardInCurrentBounds(p).mapCard` for coordinates (never `map_cards[0]` — posts have multiple locations)
- Keep only groups with 2+ posts
- Build a postId lookup map

Inside the forEach, before `renderPostCard`:
- If post is in a group but not the first: skip it (`return`)
- If post is first in a group: render a storefront card instead

`renderStorefrontCard(sfPosts)` — model it directly on `renderPostCard`, same structure, same weight:
- Avatar as thumbnail (not circular) — `resolveAvatarSrcForUser(post.member_avatar, post.member_id)`
- Title: `"Storefront: " + memberName`
- Rows 1–2: 42px circular post thumbnails (42px = 18+18+6px gap = two standard rows). Overflow clips, show "+N" count
- Row 3: location
- Row 4: price range across all posts, promo badge if any post has one
- No date row
- Sort metadata from lead post (first in already-sorted array)
- Click: `openPost(leadPost, { storefrontPosts: sfPosts })`

### Post View (post.js)

When `openPost` is called with `storefrontPosts` in options:
- Do not add to recent history (storefronts have no record — individual post selections inside the storefront are added instead)
- Pass `storefrontPosts` through to `buildPostDetail` and `setupPostDetailEvents`

`buildPostDetail` with storefront:
- Header: override title to `"Storefront: " + memberName`, override thumbnail to member avatar
- Body: replace normal content with `StorefrontComponent.render()` output

`setupPostDetailEvents` with storefront:
- Init `StorefrontComponent.init()` with `onPostSelected` (fills content slot with selected post's location, description, images — lean, no interactive dropdowns) and `onAddToRecent` callbacks

### Storefront in post.js (no component)

All storefront logic lives in post.js as conditional branches, same as multipost. No separate component file.

- **Post header:** when `storefrontPosts` is present, override thumbnail to avatar, title to "Storefront: [Member Name]", subcategory row to 18px mini thumb row, grey out share/fav buttons
- **Storefront menu:** built inline in `buildPostDetail` when storefront is detected. Row of 50px circular thumbnails with hover/tap tooltips (modelled on amenities/links pattern)
- **Prompt message:** loaded via `window.getMessage` on `data-message-key="msg_storefront_select_prompt"`
- **Post selection:** click handler on menu thumbnails shows selected post content below

### Map Card Marker (post.js)

When `isStorefront = true` in `renderMapMarkers`: use member avatar as thumbnail, do not show multipost icon.

### CSS (post.css)

Postcard row (near `.post-card-row-loc`):
- `.post-card-row-storefront` — flex, height 42px, overflow hidden, gap 6px, margin-bottom 6px
- `.post-card-row-storefront-thumb` — 42px circle, object-fit cover
- `.post-card-row-storefront-overflow` — "+N" text, font-size 12px

Storefront menu (near amenities tooltip CSS):
- `.post-storefront-menu-item` — 50px square, position relative, overflow visible
- `.post-storefront-menu-thumb` — 50px circle, shrinks to 40px on hover, 2px border transparent, highlighted when selected
- Pill tooltip `::after` — copy amenities pattern exactly, adjust padding-left 55px, top 7px
- `.post-storefront-prompt`, `.post-storefront-subheader` — show/hide via modifier classes

---

## Pattern References

### Storefront Menu Hover Behaviour
Copy the amenities and links tooltip pill pattern exactly. In `post.css`, find `.post-amenities-item::after` and `.post-links-item::after` — the storefront menu thumbnails use the same `::after` pill pattern. Icons start at 50px, shrink to 40px on hover, post title appears beside them in a 36px pill. Direction (left/right) is set by JS using the same `setTooltipDirs()` pattern already in `post.js`.

### StorefrontComponent Structure
Model the entire IIFE structure on `PostSessionComponent` in `components.js`. That component has a `render()` function that returns HTML and an `init()` function that wires behaviour. The storefront prompt message is loaded the same way the session component loads its `msg_session_select_prompt` — via `window.getMessage` on the `data-message-key` attribute.

### Postcard Row
The storefront postcard row of circular thumbnails (rows 1–2) sits where the category row normally sits. It uses the same row height and spacing as `.post-card-row-loc` and `.post-card-row-price`.

---

## Naming

CSS formula: `.{section}-{name}-{type}-{part}--{state}`
- Postcard: `.post-card-row-storefront` (matches `.post-card-row-loc`, `.post-card-row-price`)
- Post view: `.post-storefront-menu`, `.post-storefront-menu-item`, `.post-storefront-menu-thumb`
- No `!important`. No hardcoding. No fallbacks.

---

## Terminology

- The grouped display is called a **storefront**
- The individual posts inside it are just called **posts**
- The row of 42px circular thumbnails on the postcard is called the **storefront row**
- The interactive 50px thumbnail menu inside the post view is called the **storefront menu**
- The storefront has no record of its own — it does not exist in the database

---

## Sort Order

### Post Panel (storefront's position in the postcard list)
The storefront inherits the active sort order exactly like any other post. No special cases. Whatever the sort does to a regular post, it does to the storefront. Sort metadata is taken from the lead post (first post in the already-sorted array, which is the highest-tier post).

### Inside the Storefront Menu
Posts inside the storefront menu appear in the same order they would appear in the post panel if the storefront switch were off — i.e. the order they arrive in the already-sorted `posts` array. Do not re-sort them inside the component. The panel sort has already done it.

### Soonest Sort
Storefronts are always general posts, never events. Under "Soonest" sort, events appear first by date, then general posts underneath in their previous sort order. The storefront sits in the general section in whatever order it already had. No special handling needed.

---

## Critical Details That Will Cause Bugs If Missed

1. **`subcategory_type` value is `'Events'` with a capital E** — the check must be `!== 'Events'`, not `!== 'event'`. Wrong case = storefront never forms or events wrongly included.

2. **Posts have multiple locations** — always use `pickMapCardInCurrentBounds(p).mapCard` for the coordinates used in grouping. Never `map_cards[0]`. A post can exist in Melbourne AND Coober Pedy simultaneously. Using `map_cards[0]` will group posts by their first location, not the one currently visible on the map.

3. **`member_avatar` and `member_name` are on the post object** — both fields are returned by the API and available directly on each post in the `posts` array. No extra fetch needed.

4. **Post result counter** — the counter shows total posts returned by the server, not storefront count. A storefront of 9 posts still shows 9 in the counter. Do not change the counter.

5. **Reversion** — if active filters reduce a storefront group to 1 visible post, that post reverts to a normal postcard. This is automatic if groups with fewer than 2 posts are simply not treated as storefronts.

6. **Recent history** — the storefront itself is never added to recent history. Individual post selections made inside the storefront menu ARE added. The storefront has no record so it cannot appear in recent.

7. **Memory** — the last selected post in the storefront menu is remembered in memory while the storefront is open. Closing and reopening resets to the unselected default state (prompt showing, no post selected).

8. **Promo badge** — show one badge if any visible post has a promo. If the promo post is filtered out, no badge. Never show more than one badge regardless of how many posts have promos.

9. **No date row on storefront postcard** — storefronts are always general posts. The four rows are: storefront row (rows 1–2), location (row 3), price range (row 4). That's it.

---

## Map Cards (map.js)

Map cards come in two sizes: **small** and **big**.

### Normal posts
- **Small map card:** subcategory icon + title
- **Big map card:** post thumbnail + title

### Multipost locations
- Both sizes swap the normal icon/thumbnail for a rainbow-colored multipost icon
- Both sizes show the post count below the title

### Storefront map cards
- **Small map card:** multipost icon (same rainbow icon as multipost) + title + post count
- **Big map card:** member avatar + title + post count
- **Title** is always `"Storefront: [Member Name]"` with the same truncation as all other map cards
- **Post count** displays the number of posts inside, same format as multipost map cards

Map cards are created in `map.js`.

### Filter behaviour
Storefront map cards must react to filter changes instantaneously, exactly like multipost map cards already do. When filters reduce a storefront to a single post, it reverts to a normal standalone map card. When filters allow multiple posts at the same location, it instantly becomes a storefront map card. No delay, no animation — immediate.

### Storefront appearance phases
The storefront has four visual phases that need building, matching the site's standard post display flow:
1. **Map card** — the marker on the map (small and big variants)
2. **Postcard** — the card in the post panel list
3. **Compressed post** — the postcard expanded to a compact post view
4. **Expanded post** — the full-sized post view

### Phase details

**Postcard (post panel list)**
- Thumbnail: member avatar, square with 5px border-radius (same shape as all other post thumbnails)
- Title: `"Storefront: [Member Name]"`
- Row 1–2: **Storefront row** — a single 42px-tall flex row of circular post thumbnails (the same thumbnails these posts would have on their own). As many whole circles as fit, then `"+N"` for overflow. This row replaces the subcategory and location rows
- Row 3: location
- Row 4: price range
- No date row (storefronts are always general posts)

**Compressed post (postcard expanded)**
- Instead of two lines of text description, shows the first row of the storefront menu (circular post thumbnails)
- Has the "see more" button just like regular compressed posts
- Clicking anywhere along that row opens the full expanded storefront — it does not select an individual post from the gap

**Expanded post (full view)**
- Header: `"Storefront: [Member Name]"` with member avatar. **The storefront header is sticky** (unlike regular post headers which are not sticky)
- Below the header: the interactive storefront menu (modelled on amenities/links hover/tap behaviour)
- Default state: no post selected, prompt message shown
- When a post is selected from the menu: post title and subcategory appear below the menu, then the full post content underneath — identical to any regular post from that point down
- Switching posts: click a different thumbnail in the menu at any time

### Where storefronts DO NOT appear
- Post editor — never shown, posts are edited individually as normal
- Recent panel — never shown (individual post selections inside the storefront are added to recent, but the storefront itself is not)
- Marquee — never shown
- Database — never mentioned in any way

### No component — conditional branches only
The storefront does NOT use a standalone component. It follows the multipost pattern: conditional `if (isStorefront)` branches in post.js wherever `if (isMultiPost)` already exists. No IIFE, no render/init, no window export. The storefront menu interaction is modelled on the amenities and links fieldsets — hovering/tapping each circular thumbnail shows a label beside it, same pattern.

### Counters
Counters throughout the system count individual post map cards as per the `post_map_cards` table. A storefront of 50 posts shows 50 in the counter, not 1. Counters are never adjusted for storefronts.

### Multiple locations per post
Each post can have (and usually does have) multiple locations. Storefront grouping uses the coordinates of the map card currently visible in the map bounds, not a fixed first location.

### No database involvement
Nothing in the database exists or needs to exist for storefronts. The grouping is purely display-layer logic: if a member has 2+ general (non-event) posts at exactly the same coordinates, they form a storefront. The only override is the `storefront_enabled` admin setting — when off, the site behaves as if storefronts don't exist.

### Saturation system (do not touch)
There is an existing system that downgrades map cards when an area has 50+ posts — featured become icons, standard become dots, premium stay visible. This code exists, has never been tested at scale, and must not be modified. The storefront work is limited to making storefront map cards look right and behave properly.

---

## Scope and Purpose

**Line budget:** The entire storefront system should take no more than 150 lines of code. If you find yourself approaching that limit, stop immediately.

**Why storefronts exist:** The site works perfectly without them. The concern is that without storefronts, members will pollute the website with posts from the same company scattered everywhere. The storefront system keeps single members confined to their own space. The incentive for members is that a single premium listing within a storefront causes all posts in that storefront to receive top-tier treatment while combined. This happens by default through the existing tier/sort system — do not build anything special for it. Just don't break it.

---

## Test

Two general posts by admin at Coober Pedy, Australia. When both are visible in the post panel with storefront ON, they must merge into one storefront postcard. When the storefront is opened, the storefront menu shows two circular thumbnails. Selecting one shows that post's content below.

---

## Known Issues

- **18+ filter breaks storefront**: When the 18+ filter is toggled, the storefront does not correctly revert to a single post or update its contents. The storefront must respect all filters — including the 18+ toggle — the same way multipost locations do. Needs investigation and fix.
