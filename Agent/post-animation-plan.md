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

### The clip

- The clip is a stationary, invisible container anchored inside the panel.
- It lives in the panel's world -- if the panel scrolls or moves, the clip moves with it.
- Its bottom edge sits at the TOP of the postcard.
- It extends from there upward to the top of the panel (or viewport).
- The clip NEVER moves. Ever.

### The animation

- The postcard slides upward and disappears inside the clip.
- The post slides downward through the clip and becomes visible below the clip's bottom edge.
- Both move simultaneously. Both finish at exactly the same moment.
- The bottom pixel of the post and the bottom pixel of the postcard are on the same point at the START and at the END.
- Content below never moves independently -- it is part of the same group as the post.
- There is no slot height animation. No race condition. No dual-thread sync problem.
- One element moves (the post). One clip is stationary. That is all.

### Closing (reverse)

- Exact reverse of opening.
- The post slides upward back into the clip.
- The postcard clone slides downward from the clip into its resting position.
- Same geometry, same certainty, same bottom-pixel anchor point.

### Why this works

- CSS height animation (layout, main thread) is eliminated entirely.
- Only CSS transform translateY is used (GPU-accelerated, compositor thread).
- No two objects need to be timed independently.
- The post and all content below it move as one unit.

---

## Key Rules

- Animation duration must be identical for postcard and post transforms
- The clip lives inside the panel, anchored to the panel's coordinate system
- Status bar in recent panel is outside the animation zone
- Map card / marker / external link opens = no animation, instant as before
- All animation is interruptible via _cancelSlotAnimation(slot)
- _POST_ANIMATE = false disables everything instantly
