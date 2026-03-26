# Post Animation Plan

## Master Switch
`_POST_ANIMATE = true` in post.js — set false to disable all animation instantly.

---

## Current State (restore point)
Animation runs at 1 second for testing. Final speed: 0.3s.

---

## OPENING

| # | Status | Issue |
|---|--------|-------|
| 1 | ✅ Done | Postcard retracts upward via fixed clip |
| 2 | ✅ Done | Post slides down from above |
| 3 | ❌ Fix | Content below not locked to post bottom — different speeds, crops post bottom, jolts to final position at end |
| 4 | ❌ Fix | Map card clicks must not animate — instant open + scroll to top as before |
| 5 | ❌ Fix | Recent panel: animation starts above the status bar, overlapping it — status bar must sit outside animation zone |
| 6 | ❌ Fix | When scrollbar appears mid-animation, content overlaps scrollbar — animation must respect scrollbar boundary |

---

## CLOSING

| # | Status | Issue |
|---|--------|-------|
| 1 | ❌ Fix | Content below not locked to post bottom — different speeds, flicker |
| 2 | ❌ Fix | Content below overshoots upward past postcard landing position, then snaps back down abruptly |
| 3 | ❌ Fix | Post animates from its top edge — must animate from bottom edge. Bottom of post travels from post-bottom to postcard-bottom. That is the full range. |

---

## Key Rules
- Animation duration must be identical for all moving parts (post, content below, postcard clone)
- Content below must be physically locked to the bottom edge of the post at all times
- Scrollbar boundary must always be respected by fixed-position clones
- Status bar in recent panel is outside the animation zone
- Map card / marker / external link opens = no animation, instant as before
- All animation is interruptible via `_cancelSlotAnimation(slot)`
