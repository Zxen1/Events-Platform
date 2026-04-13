# Virtualised Scrolling — Implementation Plan

Created: 13 April 2026

---

## The Problem

At ~1000 posts in map bounds (e.g. London), every bounds change triggers:
1. A full fetch of all posts in bounds from the server — **this is fast**
2. Client-side creation of a DOM postcard element for every single post — **this is slow**
3. Iterating through all posts to group them by location for map markers — **adds to it**

The slowness is number 2. Building 1000 HTML elements with text, classes, event listeners, and inserting them into the page. The browser has to lay out, paint, and hold all 1000 in memory even though only ~7 are visible.

**Test result (2026-04-13):** Disabled all map markers and ground bubbles — lag persisted in London. Confirmed: the lag is the post panel DOM creation, not the map markers. Filtering and sorting are lightning fast (in-memory array operations). The bottleneck is turning the sorted array into 1000 DOM elements.

~50 results (Dorchester) feels like a feather. ~1000 (London) feels sticky with a backlog effect — rapid map movements queue up DOM render cycles that must all drain before the UI recovers.

---

## The Solution

Only render ~50 postcard DOM elements at any time, regardless of how many results exist. The rest are ghost postcard placeholders. As the user scrolls, postcard elements are recycled — filled with new data for whatever slice of the sorted list is now visible.

---

## What Changes

**One thing:** `renderPostList()` creates ~50 DOM postcard elements instead of one per post. Ghost postcards fill the remaining space.

---

## What Does NOT Change

- **Server fetch** — same `get-posts` endpoint, same data, all posts in bounds returned and held in memory
- **Filtering** — still instant, operates on in-memory array
- **Sorting** — still instant, operates on in-memory array (Recommended, Soonest, Nearest, A-Z)
- **Map markers** — still built from the full in-memory array via `renderMapMarkers`, completely separate from post panel DOM
- **Storefront grouping** — still happens in memory, storefront cards appear in the window same as regular postcards
- **TopSlack / BottomSlack** — still attached to the scroll container, absorbs height differences during recycling
- **Open/close/expand/collapse posts** — all animations, speed settings, compact/expanded modes work as-is
- **Favourites** — state lives in localStorage (guests) / database (members/admins), not in the DOM. Recycled elements check favourite status on render, same as they do now
- **Favourites on top** — toggling a favourite does NOT re-sort. Re-sort only happens when the user explicitly triggers it. Virtualisation respects this.
- **Ghost postcards (backdrop)** — already exist, repurposed as placeholder content outside the window
- **Admin settings** — none affected (map card limits, sort orders, storefront toggle, theme speeds, filter options all untouched)
- **Multipost modal** — the venue popup over the post panel. Also gets virtualised scrolling for venues with 50+ events. Reads from in-memory array, not DOM queries.
- **Map marker clicking / marquee** — scrolls to the post's position in the list. Ghost cards visible during scroll, real postcards render on arrival.

---

## How It Works

### Data Flow (unchanged)
- Server returns all posts in bounds (lightweight postcard data)
- Posts stored in memory in sorted/filtered order
- Map markers continue to read from this full in-memory array
- Filters and sorts continue to operate on this array

### DOM Rendering (changed)
- `renderPostList()` creates ~50 real postcard elements positioned around the user's scroll position
- Above and below: ghost postcards maintain correct scroll height
- All posts remain in a JS array — only the DOM is virtualised

### Scroll Behaviour
- On scroll, determine which slice of the sorted array should be visible
- Recycle existing postcard elements with new data (swap text, thumbnail src, data attributes, favourite state)
- `loading="lazy"` on thumbnails — browser only requests images for the ~50 elements in DOM
- When user flings from position 1 to 1000: ghost cards visible during fling, real postcards appear when scrolling settles
- User can interrupt scroll at any time — no queue, no backlog, just render 50 around wherever they stop

### Window Sizing
- ~7 postcards visible on screen at any time
- Buffer of ~20 above and ~20 below = ~50 total DOM elements
- Window shifts to fit edges: at position 10, it's 10 above + 40 below. At position 500/1000, it's 25+25. At position 990, it's 40 above + 10 below.

### Storefronts
- A storefront counts as one slot in the 50
- Storefront menu data (item titles, thumbnails, subcategories) is preloaded — no ghost cards inside storefront menus
- Storefront menu thumbnails use `loading="lazy"` for Bunny CDN efficiency
- If massive storefronts become a problem in the future, virtualised scrolling can be applied inside the storefront menu container — not needed now

### Multipost Modal
- The venue popup contains postcards for a single venue, sometimes 50+
- Gets its own virtualised scrolling using the same technique
- Reads from in-memory array directly (not DOM queries)
- Solves the problem of the modal needing to find postcards that don't exist in the DOM

---

## All Identified Problems — Resolved

| # | Problem | Resolution |
|---|---------|------------|
| 1 | Postcards need fixed height for position math | Not a problem — real postcards are whatever height they are. Ghost cards fill remaining space. Slack absorbs differences. |
| 2 | Open posts break the window | Not a problem — open post stays in DOM (never recycled), slack adjusts around it as it always has. All animation/expand/collapse works unchanged. |
| 3 | Storefronts are different height | Not a problem — same as #1. Real element in the window, slack handles it. |
| 4 | Multipost modal reads from DOM | Reads from in-memory array instead. Modal also gets virtualised scrolling for large venues. |
| 5 | Favourites lost on recycled elements | Not a problem — favourite state lives in localStorage/database, not DOM. Recycled elements check status on render. |
| 6 | Slack anchoring during recycling | Not a problem — TopSlack/BottomSlack already designed to absorb height changes. |
| 7 | Preserved open post across bounds changes | Not a problem — existing detach/reattach logic stays. Open post is pinned, never recycled. |
| 8 | Sort changes rebuild list | Not a problem — re-sort the in-memory array, re-render 50 elements. Fast. |
| 9 | Filter changes alter list length | Not a problem — update array, adjust ghost card count, re-render 50 elements. If scroll position exceeds new length, snap to end. |

---

## Performance Expectations

- **DOM elements:** drops from N (up to 1000+) to ~50, constant regardless of result count
- **Memory:** post data array stays in memory (lightweight), DOM footprint drops dramatically
- **Scroll:** smooth at any result count — London feels like Dorchester
- **Map panning:** re-render on bounds change only creates/recycles ~50 elements instead of 1000
- **Thumbnails:** browser lazy-loads only the ~50 in DOM, Bunny CDN caches after first view
- **Filters/sort:** operate on in-memory array (instant), then window re-renders ~50 elements (instant)
- **Result:** constant-speed website regardless of whether there are 50 or 1,000,000 results in bounds

---

## Future Considerations (Not Part of This Work)

### Server-Side Windowing
If the in-memory array itself becomes too large (millions of posts in bounds), the server could hold the sorted list and only send the window slice. Not needed now — bounds-limited fetch + ground bubbles keep the array manageable.

### Map Entity Grouping
Multi-post locations could be treated as single entities for map marker processing (same as storefronts). Reduces iteration overhead in `renderMapMarkers`. Independent of virtualised scrolling — can be done separately.

### Scroll-to Animation
Currently clicking a map marker scrolls past ghost cards to the destination. Could be replaced with a quick animation/fade or instant jump in the future. Cosmetic decision.

---

## Status

Planning complete. All problems resolved. Ready for implementation.
