# Post Animation Plan

## Master Controls (post.js, line 50)
```js
var _POST_ANIMATE  = true; // set false to disable all animation instantly
var _POST_ANIM_DUR = 1.0;  // duration in seconds — all sub-timings scale proportionally
```
Sub-timings are percentages of `_POST_ANIM_DUR`:
- Description fade-out/in: 20% (`* 0.2`)
- No-delta edge case fade: 30% (`* 0.3`)
- Cleanup timeouts: `Math.round(_POST_ANIM_DUR * 1000) + 20` ms

Covers five animation paths: post open, post close, storefront open (deferred variant), See More, See Less.

---

## Current State (restore point)
Animation runs at 1 second for testing. Final speed: 0.3s.

---

## OPENING

1. DONE - Postcard retracts upward via fixed clip
2. DONE - Post slides down from above
3. FIX  - Content below not locked to post bottom -- different speeds, crops post bottom, jolts to final position at end
4. FIX  - Map card clicks must not animate -- instant open and scroll to top as before
5. FIX  - Recent panel: animation starts above the status bar, overlapping it -- status bar must sit outside animation zone
6. FIX  - When scrollbar appears mid-animation, content overlaps scrollbar -- animation must respect scrollbar boundary

---

## CLOSING

1. FIX  - Content below not locked to post bottom -- different speeds, flicker
2. FIX  - Content below overshoots upward past postcard landing position, then snaps back down abruptly
3. FIX  - Post animates from its top edge -- must animate from bottom edge. Bottom of post travels from post-bottom to postcard-bottom. That is the full range.

---

## THE CORRECT ARCHITECTURE (agreed and locked)

### The geometry (opening)

- The post is 1000px tall (example).
- It is inserted at full height instantly, in its final position.
- Its bottom pixel is aligned exactly with the bottom pixel of the postcard.
- Content below the post is already in its final resting position. It never needs to move.
- 880px of the post are hidden inside the clip (above the postcard's top edge).
- 120px of the post sit behind the postcard (hidden by the postcard, not the clip).
- The entire post is invisible at the start -- 880px by the clip, 120px by the postcard.

### The invisibility shield (clip)

- The invisibility shield (clip) is a stationary, invisible container anchored inside the panel.
- It lives in the panel's world -- if the panel scrolls or moves, the shield moves with it.
- Its bottom edge sits at the TOP of the postcard.
- It extends from there upward to the top of the panel (or viewport).
- The invisibility shield NEVER moves. Ever.

### The animation

- The postcard slides upward and disappears inside the invisibility shield (clip).
- The post slides downward through the shield and becomes visible below the shield's bottom edge.
- Both move simultaneously. Both finish at exactly the same moment.
- The bottom pixel of the post and the bottom pixel of the postcard are on the same point at the START and at the END.
- Content below is locked to the post bottom at all times — post and all siblings below share the same translateY, same timing. They are one unit.
- There is no slot height animation. No race condition. No dual-thread sync problem.
- The post and siblings use a single CSS transform translateY. The shield (slot overflow) is stationary. That is all.

### Closing (reverse)

- Exact reverse of opening.
- The post slides upward back into the invisibility shield (clip).
- The postcard clone slides downward from the shield into its resting position, background fully intact.
- All siblings below travel upward with the post as one unit.
- Same geometry, same certainty, same bottom-pixel anchor point.

### Why this works

- CSS height animation (layout, main thread) is eliminated entirely.
- Only CSS transform translateY is used (GPU-accelerated, compositor thread).
- No two objects need to be timed independently.
- The post and all content below it move as one unit.

---

## PENDING — NOT YET FIXED

1. Recent panel: status bar sits above each postcard. The open animation starts above the status bar and overlaps it. The status bar must sit outside the animation zone. Deferred by user — address in a future session.

---

## STATUS BAR KNOWN BUGS (fix when status container work is complete)

- The status bar above the postcard never receives the hovered appearance — it sits outside the card's hover zone so CSS hover selectors never reach it. It always looks unhovered. This needs to be fixed so the bar responds to hover correctly when the mouse is over the postcard.

---

## STATUS BAR INVESTIGATION (in progress — do not code yet)

- Two current status bar types: (1) last-opened timestamp (recent panel only), (2) countdown timer (admin-controlled, event posts only)
- Countdown timer has four admin-controlled modes: soonest sort order only for postcards / soonest sort order only for posts / all sort orders for postcards / all sort orders for posts
- Countdown timer never shows on recent panel postcards — but DOES show on posts inside the recent panel
- Multiple status bars must be supported above a single postcard or post (e.g. timestamp + countdown stacked)
- Each status bar must be named/identifiable so the system can handle any number of them
- Status bars must be moved outside the slot so they are never clipped by the animation system

## STATUS BAR RESTRUCTURE PLAN (do not code until instructed)

### Agreed names (locked)

| # | Panel  | Element                  | Current Name           | New Name                    |
|---|--------|--------------------------|------------------------|-----------------------------|
| 1 | Post   | Outer container          | (doesn't exist)        | `post-outer-container`      |
| 2 | Post   | Status bars container    | (doesn't exist)        | `post-status-container`     |
| 3 | Post   | Main container (slot)    | `post-slot`            | `post-main-container`       |
| 4 | Recent | Outer container          | (doesn't exist)        | `recent-outer-container`    |
| 5 | Recent | Status bars container    | (doesn't exist)        | `recent-status-container`   |
| 6 | Recent | Main container (slot)    | `recent-card-wrapper`  | `recent-main-container`     |

### Order of work
- Step 1: Rename #3 (`post-slot` → `post-main-container`) and #6 (`recent-card-wrapper` → `recent-main-container`) first — confirm stable
- Step 2: Introduce #1 and #4 (outer containers) wrapping the renamed main containers
- Step 3: Introduce #2 and #5 (status containers) inside the outer containers, above the main containers
- Step 4: Move all status bars out of the main container into their status container

---

## PENDING — STICKY HEADER CLOSE (not yet coded)

### The problem
When a user has scrolled partway into a long post, the post header becomes sticky (pinned to panel top).
If they close the post from the sticky header, the close animation uses the full post height as `_closeOffset`,
sending all siblings flying 2000px+ off screen. Looks terrible.

### Agreed solution
Two parts, both must happen at frame zero when close is triggered:

**Part A — Instant gap collapse above:**
- Detect sticky: `_slotOuter.getBoundingClientRect().top < _panelEl.getBoundingClientRect().top`
- Capture `_closeStartH` = visible height BEFORE snap: `openPostEl.getBoundingClientRect().bottom - _panelEl.getBoundingClientRect().top`
- Snap: `_panelEl.scrollTop += _slotOuter.getBoundingClientRect().top - _panelEl.getBoundingClientRect().top`
- Clip slot: `slot.style.height = _closeStartH + 'px'` (clear in cleanup)
- The hidden portion above collapses instantly. Posts above land at the top of the panel. User never sees it happen.

**Part B — Animate only visible portion:**
- `_closeOffset = _closeStartH - _cardH` (reduced distance, same 1-second duration)
- If `_closeStartH <= _cardH`: skip animation entirely (`_closeAnimate = false`)
- `_closeAnimate = _POST_ANIMATE && !(slot.__openedFromExternal) && (_closeStartH > _cardH)`

**Important:**
- DO NOT change animation duration — 1 second regardless of visible height
- DO NOT impede scrolling in any way
- Both `post-outer-container` and `recent-outer-container` must be supported (same pattern as sibling traversal)
- `slot.style.height = ''` must be cleared in close animation `setTimeout` cleanup AND in `_cancelSlotAnimation`

### Why it was deferred
Context ran out before the fix could be verified working. The code was written and then reverted to avoid leaving broken state in the commit queue.

---

## BOTTOM SLACK FIX — March 27, 2026 (SOLVED)

### The problem
When a post closes with animation, the bottom slack collapses mid-animation and causes everything to jump to the footer. With animation off, no jump. With animation on, the jump was consistent and unfixable across 10+ agent sessions.

### Root cause
`trimSlack()` fires in a `requestAnimationFrame` after every click — including the close button. It recalculates whether slack is needed based on the current DOM (post still in DOM, full height). Depending on scroll position, it calculates `needed = 0` and immediately collapses the slack to 0 via `applySlackPx(0)`. This fires BEFORE the animation has moved anything. The slack is gone before the animation even starts. `trimSlack` did not check `clickHoldUntil`, so every hold/expand attempt was silently overridden.

### The fix (3 targeted changes)

**1. `components.js` — `trimSlack()` — add hold check**
```js
if (Date.now() < clickHoldUntil) return;
```
Prevents trimSlack from collapsing slack during an active hold window.

**2. `components.js` — BottomSlack controller — add `hold(ms)` method**
```js
hold: function(ms) {
    var holdDur = (typeof ms === 'number' && ms > 0) ? ms : clickHoldMs;
    clickHoldUntil = Date.now() + holdDur;
    applySlackPx(expandedSlackPx);
}
```
Expands slack immediately and locks it for the specified duration.

**3. `post.js` — `closePost()` — call `hold(1020)` at the start of the close animation**
```js
var _bsHoldEl = slot.closest('.post-list') || slot.closest('.recent-panel-content');
if (_bsHoldEl && window.BottomSlack && typeof BottomSlack.get === 'function') {
    var _bsHoldCtrl = BottomSlack.get(_bsHoldEl);
    if (_bsHoldCtrl && typeof _bsHoldCtrl.hold === 'function') _bsHoldCtrl.hold(1020);
}
```
Fires the instant close is triggered. Holds for the full 1020ms animation duration. No release call needed — hold expires naturally and normal BottomSlack scroll/interaction logic handles collapse from there.

### Why previous attempts failed
- Attempts to call `trim()` or `release()` at the end of the animation were too late — slack was already 0
- Attempts to expand slack at close start were immediately overridden by `trimSlack` in the click RAF
- Freezing the controller, adding ghost cards to DOM, and layout rewrites were all wrong approaches
- The correct fix was entirely inside BottomSlack's own `trimSlack` function — one guard line

### Selector note
Post panel scroll container registered in `initSlack`: `.post-list` (NOT `.post-panel-content`)
Recent panel scroll container: `.recent-panel-content`

---

## SEE MORE / SEE LESS ANIMATION — March 27, 2026 (SOLVED)

### What was built
Clicking "See more" or "See less" on a post description animates the expand/collapse over `_POST_ANIM_DUR` seconds.

### See More (expand)
1. Two-line description fades out (20% of duration)
2. DOM swaps to expanded state (`post--expanded` added, `showExpanded()`)
3. Image container FLIP'd to collapsed visual position (`translateY(_imgOffset)`)
4. Thumbnail row FLIP'd to its collapsed overlay position within the container (`translateY(-_thumbsOffset)`)
   — `_thumbsOffset = _delta + _imgOffset` (the internal distance thumbs travel within the container)
5. Info container, member info set to `opacity:0`
6. Siblings held at collapsed positions (`translateY(-_delta)`)
7. All animate to natural positions over `_POST_ANIM_DUR` — image, thumbs, siblings locked in sync
8. Info, member, full description fade in over full duration
9. Cleanup removes inline styles at duration + 20ms

### See Less (collapse — exact reverse)
1. Description fades out (full duration — content visible throughout)
2. Info, member fade out (full duration)
3. Silent measurement pass: temporarily removes `post--expanded` AND calls `showCollapsed()` to get the correct collapsed height with truncated description. Without this, the measured delta is too small (full description is still in DOM) causing a partial animation then a snap.
4. Restores expanded state (`post--expanded` re-added, description HTML restored)
5. `overflow:hidden` applied to body (clips empty space below rising image)
6. Image container animates UP by `_imgOffset`
7. Thumbnail row animates UP by `_thumbsOffset = _delta - _imgOffset` within container
   — Total screen travel for thumbs = `_imgOffset + _thumbsOffset = _delta` = same as siblings ✓
8. Siblings animate UP by `_delta` — all locked in sync
9. At cleanup: `post--expanded` removed (seamless — everything already visually in position)
10. `showCollapsed()` puts truncated description, which fades in (20% of duration)

### Key geometry
- `_imgOffset` = how far the image container moved (expanded vs collapsed position, measured via `getBoundingClientRect`)
- `_delta` = how much the body grew/shrank (via `offsetHeight`)
- `_thumbsOffset` = `|_delta - _imgOffset|` = internal thumb travel within container = `thumbsH + gap`
- Container + thumbs together travel exactly `_delta` on screen = identical to sibling travel

### Post editor
Expand/collapse animation is fully enabled for `.posteditor-main-container` slots (same as post panel and recent panel).

---

---

## POST EDITOR ANIMATION — March 2026 (SOLVED)

### What was built
All four animations (open, close, See More, See Less) now run inside the Post Editor panel, matching the Post and Recent panels exactly.

### Problems found and fixed

**1. Open animation blocked by `options.source`**
The post editor calls `openPostById` with `source: 'posteditor'`. The `_shouldAnimate` guard used `!options.source` — a blanket block that caught all sources including `'posteditor'`. Fixed by explicitly naming blocking sources: `options.source !== 'marquee' && options.source !== 'deeplink'`.

**2. Exit clone clipped by outer container overflow**
`.posteditor-outer-container` has `overflow:hidden` in CSS (for border-radius). As the exit clone slid upward through the status container area, it was clipped early. Fixed by temporarily setting `overflow:visible` on the outer container for the exit clone's duration, then restoring it on cleanup.

**3. Actions container ignored by all four animations**
`.posteditor-actions-container` is a sibling of `.posteditor-main-container` (the slot) inside `.posteditor-outer-container`. It was not included in any sibling translation list, so it sat frozen or teleported during every animation. Fixed by adding it as the first entry in the siblings list for all four animation paths (open, close, See More, See Less).

**4. See More / See Less: slot lookup missing post editor**
`_animateCollapse` and `_animateExpand` looked for the slot via `.post-main-container || .recent-main-container` — missing `.posteditor-main-container`. Fixed in both functions.

### DOM structure (Post Editor)
```
.posteditor-outer-container  ← overflow:hidden (border-radius); temp visible during exit clone
├── .posteditor-status-container
│   ├── .posteditor-statusbar        ← always present
│   └── .post-statusbar--slot-card   ← countdown bar (event posts, if admin setting on)
├── .posteditor-main-container       ← slot; position:relative; overflow:hidden
│   └── div[data-slack-anchor]
│       └── .post-card
└── .posteditor-actions-container    ← included in all four animation sibling lists
```

### Countdown status bar in Post Editor
Pattern copied from Recent panel: checks `countdown_postcards` admin setting, calls `PostModule.buildCountdownStatusBar()` (now exposed), adds `post-statusbar--slot-card` for deduplication, adds `post-statusbar--modesoonest` if `soonest_only` mode. Uses `post.map_cards[0]` as the representative map card (no map bounds context in editor). `buildCountdownStatusBar` added to `PostModule` return object.

### Subcategory background colour
`.post-card:hover` inside `.posteditor-outer-container` now shows `var(--subcat-hover-bg)`. Previously suppressed by `background-color: transparent` on the base card rule — fixed by adding an explicit hover rule. Pre-close background capture (`_preCloseSlot` lookup) updated to include `.posteditor-main-container`, and hover state is now forced before `getComputedStyle` (adding/removing `post-card--map-highlight`) so `--subcat-hover-bg` is active at capture time.

---

## Key Rules

- Animation duration must be identical for postcard and post transforms
- The invisibility shield (clip) lives inside the panel, anchored to the panel's coordinate system
- Status bar in recent panel is outside the animation zone
- Map card / marker / external link opens = no animation, instant as before
- All animation is interruptible via _cancelSlotAnimation(slot)
- `_POST_ANIMATE = false` disables everything instantly
- `_POST_ANIM_DUR` controls speed — change one value, all five paths scale together
