# Post Animation Plan

## Master Switch
_POST_ANIMATE = true in post.js -- set false to disable all animation instantly.

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

## Key Rules

- Animation duration must be identical for postcard and post transforms
- The invisibility shield (clip) lives inside the panel, anchored to the panel's coordinate system
- Status bar in recent panel is outside the animation zone
- Map card / marker / external link opens = no animation, instant as before
- All animation is interruptible via _cancelSlotAnimation(slot)
- _POST_ANIMATE = false disables everything instantly
