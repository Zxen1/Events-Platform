# Rollback note — ButtonAnchorBottom (components-new.js)

This note exists so we can revert **only** the latest BottomAnchor change quickly if it causes any regression.

## What changed

File: `components-new.js`

Component: `ButtonAnchorBottom`

We added a small content-size tracker so BottomAnchor does **not** “lock” (`maxHeight`) during normal **growth** (dropdown open / content expand). It only allows locking briefly after a real **shrink**.

## Quick rollback (manual edit)

In `components-new.js`, inside `const ButtonAnchorBottom = (function() { ... attach(...) { ... } })();`

Revert these items:

1) Remove the whole block starting with:

- `// Track real content size (excluding slack) ...`

…through and including the functions:

- `getContentNoSlack()`
- `noteContentChange()`

2) In `applySlackPx(px)`, remove the line:

- `noteContentChange();`

3) In `startScrollBurst()`, restore to the original:

```js
function startScrollBurst() {
    lock();
    if (unlockTimer) clearTimeout(unlockTimer);
    unlockTimer = setTimeout(unlock, stopDelayMs);
}
```

4) In `onScroll()`, remove the line:

- `noteContentChange();`

5) In the `wheel` handler, restore this block to the original:

```js
if (deltaY > 0) collapseIfOffscreenBelow();
if (deltaY > 0 && isSlackOnScreen()) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    return;
}
```

6) In the `touchmove` handler, remove the recent-growth exception and restore:

```js
if (dy < 0) collapseIfOffscreenBelow();
if (dy < 0 && isSlackOnScreen()) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
}
```

7) In the `keydown` handler, remove the recent-growth exception:

- `if ((Date.now() - lastGrowAt) < 600) return;`

## Scope

This rollback note intentionally does **not** change:

- dropdown/menu components
- `index-new.js`
- TopAnchor (still disabled there)


