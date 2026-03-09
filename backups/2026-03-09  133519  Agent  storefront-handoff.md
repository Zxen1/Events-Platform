# Storefront System — Handoff Notes
Date: 2026-03-09

## What Is Built (All Committed to Codebase)

### Database (already in DB)
- `admin_settings` ID 29: `storefront_enabled = true` (boolean, currently ON)
- `admin_messages` ID 309: `msg_storefront_select_prompt` = "Select a listing from the menu above to view details."
- `admin_instructions` ID 52: Full storefront spec written for admins

### Admin Panel (`index.php`)
- Switch row added after "Devtools Console Filter": `id="adminStorefrontEnabled"`, `data-setting-key="storefront_enabled"`

### Detection (`post.js` ~line 1959)
- Inside `renderMapMarkers` forEach loop, after `uniquePostCount`
- Detects storefronts: 2+ posts, same member, all general (not Events)
- Mutually exclusive with `isMultiPostVenue`
- Gated on `storefront_enabled` admin setting
- **Currently**: storefront detection works but map card rendering for storefronts is NOT done yet (no avatar pin, no special marker)

### Postcard (`post.js`)
- `renderStorefrontCard(sfPosts)` function added after `renderPostCard` (~line 1564)
- Renders: member avatar as thumbnail, "Storefront: [Member Name]" title, `.post-card-row-storefront` thumbnail strip (42px circles), location row, price range row, promo badge
- Click handler calls `openPost(leadPost, { storefrontPosts: sfPosts })`

### Post Panel Grouping (`post.js` ~line 1868 in `renderPostList`)
- Builds `_sfGroups` and `_sfByPostId` using `pickMapCardInCurrentBounds(p).mapCard` for coordinates
- Skips non-lead storefront posts, renders storefront card for lead post

### Post View (`post.js`)
- `buildPostDetail` accepts 5th param `storefrontPosts`
- Header override: "Storefront: [Member Name]" + member avatar thumbnail
- Body override: renders `StorefrontComponent.render()` instead of normal post body
- `setupPostDetailEvents` accepts 4th param `storefrontPosts`, calls `StorefrontComponent.init()`

### StorefrontComponent (`components.js` ~line 13809)
- IIFE with `render(options)` and `init(wrap, posts, callbacks)`
- `render()`: outputs storefront menu HTML (50px circular thumbnails + prompt + subheader + content slot)
- `init()`: handles thumbnail clicks, tooltip directions, `onPostSelected` callback, `onAddToRecent` callback
- Exported as `window.StorefrontComponent`

### CSS (`post.css`)
- `.post-card-row-storefront`, `.post-card-row-storefront-thumb`, `.post-card-row-storefront-overflow` (~line 621)
- `.post-storefront-container`, `.post-storefront-menu`, `.post-storefront-menu-item`, `.post-storefront-menu-thumb`, pill tooltips, prompt, subheader (~line 1686)

---

## Current Bug

**Symptom**: With storefront ON and 18+ filter enabled at Coober Pedy, count shows 2 but only 1 postcard appears. No storefront card. No console errors.

**Root cause (suspected)**: `renderStorefrontCard` is either returning null or throwing silently. The grouping IS working (second post is suppressed). The storefront card for the lead post is failing to render.

**Debug needed**: Add `console.error` inside the storefront forEach block:
```javascript
// In renderPostList forEach, inside the if (_sfEnabled) block:
var _sfCard = renderStorefrontCard(_sfG);
console.error('[SF card]', _sfCard, 'group:', _sfG.length);
if (!_sfCard) return;
```

**Most likely causes**:
1. `pickMapCardInCurrentBounds` returns null for the lead post inside `renderStorefrontCard`, causing `mapCard` to be null and some downstream function throwing silently
2. `escapeHtml` not in scope inside `renderStorefrontCard` (verify it's accessible)
3. `isFavorite`, `extractPrice`, `parsePriceSummary`, `getPostThumbnailUrl`, `getCardThumbSrc`, `mapCardHasPromo`, `resolveAvatarSrcForUser`, `App.getState`, `App.getImageUrl` — all must be in scope

---

## What Still Needs Building

1. **Fix the storefront card render bug** (see above)
2. **Map card marker for storefronts**: When `isStorefront = true` in `renderMapMarkers`, the marker should use the member avatar as thumbnail and NOT show the multipost icon. Currently the map card just shows nothing different.
3. **`onPostSelected` refactor**: The callback in `setupPostDetailEvents` duplicates location/description/image rendering logic. Should be simplified — possibly by calling `buildPostDetail(selectedPost)` and extracting `.post-body`, or extracting a shared helper.
4. **Reversion**: If filters reduce storefront to 1 visible post, it should revert to a normal postcard. This is partially handled (1-post groups are deleted from `_sfGroups`) but needs verification.
5. **Overflow count** on postcard row: The `+N` span is rendered but never populated. Needs a post-render JS calculation.

---

## Key Rules
- Storefront is display-layer only. No database records. No flags. Exactly like multipost.
- All CSS naming: `.{section}-{name}-{type}-{part}--{state}` strictly
- `pickMapCardInCurrentBounds(p).mapCard` is the correct way to get in-bounds coordinates
- Never use `map_cards[0]` for coordinate grouping — posts have multiple locations
- The storefront switch in admin settings must be ON for any storefront code to activate
- Test posts: two general posts by admin (member_id=1) both located at Coober Pedy. One is 18+ so you need the "show 18+" filter enabled to see both.

---

## Files Modified
- `post.js`
- `components.js`  
- `post.css`
- `index.php`
- `.cursor/rules/agent essentials.mdc`
- `Agent/agent confessions.md` (confession added)
