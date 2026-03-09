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

### StorefrontComponent (components.js)

IIFE after `PostPriceComponent`. Model on `PostSessionComponent`. Keep lean.

`render(options)` — returns HTML with:
- `.post-storefront-menu` — row of 50px circular thumbnails (one per post)
- `.post-storefront-prompt` with `data-message-key="msg_storefront_select_prompt"`
- `.post-storefront-subheader` (hidden until post selected)
- `.post-storefront-content` (empty until post selected)

`init(wrap, posts, callbacks)`:
- Load prompt message via `window.getMessage`
- Tooltip directions: same pattern as `setTooltipDirs()` in post.js (60% width threshold)
- On click: highlight selected, show title as subheader, hide prompt, call `onPostSelected`, call `onAddToRecent`

Export as `window.StorefrontComponent`.

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

## Test

Two general posts by admin at Coober Pedy, Australia. When both are visible in the post panel with storefront ON, they must merge into one storefront postcard. When the storefront is opened, the storefront menu shows two circular thumbnails. Selecting one shows that post's content below.
