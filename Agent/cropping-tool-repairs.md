# Cropping Tool Repairs

## Date
2026-03-23

---

## System Overview

### How the crop tool works
- `PostCropperComponent` in `components.js` (line 8704) — non-destructive, outputs pixel coordinates only. Separate from `AvatarCropperComponent` which is destructive and must not be touched.
- The crop tool displays the image on a 530×530 canvas using a "cover" fit. The image always fills the square. Default state (zoom=1, no pan) centres the image.
- The admin sets minimum crop dimensions in `admin_settings`: `image_min_width` (ID 400) and `image_min_height` (ID 401), both currently **800px**.
- Maximum zoom = `Math.min(imageWidth, imageHeight) / 800`. For a 1232×928 image: max zoom = 928/800 = **1.16**.
- At max zoom the crop is 800×800. At default zoom (1) the crop equals the shorter dimension squared (e.g. 928×928 for a 1232×928 image).

### What gets stored
Two separate objects are returned by the crop tool on "Use Crop":
- **`cropRect`** — `{x1, y1, x2, y2}` in actual image pixels. This is what gets saved to `post_media.settings_json`.
- **`cropState`** — `{zoom, offsetX, offsetY}`. Used to restore the tool's internal state when re-opening. Currently only kept in memory (not persisted to database).

### settings_json format (with crop)
```json
{"id":null,"file_name":"MikeyCrane_0098.jpg","file_type":"image/jpeg","file_size":177070,"crop":{"x1":0,"y1":0,"x2":816,"y2":816}}
```

### settings_json format (no crop)
```json
{"file_name":"Sydney_Australia..jpg","file_type":"image/jpeg","file_size":4588171,"crop":null}
```

### How Bunny CDN uses the crop
In `get-posts.php` the crop is appended to the image URL as:
`?crop=width,height,x,y`
where `width`/`height` are the crop dimensions and `x`/`y` are the pixel offset of the top-left corner.

Bunny documentation confirmed: `crop=width,height,x,y` (Format 2 — positioned crop). The stored `{x1,y1,x2,y2}` values are converted: `width = x2-x1`, `height = y2-y1`, `x = x1`, `y = y1`.

---

## Database Reference

### Table: `post_media`
This is the table to check after every save. The `settings_json` column is what matters.

**Query to check recent crops:**
```sql
SELECT id, post_id, file_name, settings_json, updated_at FROM post_media ORDER BY updated_at DESC LIMIT 10;
```

**Query to check a specific media row:**
```sql
SELECT * FROM post_media WHERE id = 4451;
```

**Query to find all uncropped images:**
```sql
SELECT * FROM post_media WHERE settings_json LIKE '%"crop":null%' ORDER BY created_at DESC LIMIT 10;
```

### Table: `admins` (column: `recent_posts`)
The `thumb_url` values here show what URL is being sent to Bunny CDN. Check that `?crop=` is appended correctly after a save.

**Query:**
```sql
SELECT recent_posts FROM admins WHERE id = 1;
```

### admin_settings rows for crop limits
- ID 400: `image_min_width` = 800
- ID 401: `image_min_height` = 800

---

## Test Image
- **Post:** 1852 — "Map images test"
- **Media ID:** 4448
- **File:** `00001852-MikeyCrane_0042.jpg`
- **Dimensions:** 1232×928px (landscape)
- **Baseline:** `crop: null` (never cropped before testing)

---

## Test Results

All tests performed via post editor (edit existing post). JS confirmed the crop tool calculates and returns correct values every time. Database confirmed the values are never written.

### Test 1 — Default zoom, no movement, click "Use Crop"
- **[CROP 2]:** `cropRect: null` (page reloaded before console was read)
- **DB before (dump 86):** `crop: null`
- **DB after (dump 87):** `crop: null` — unchanged

### Test 2 — Maximum zoom (1.16), no pan, click "Use Crop"
- **[CROP 1]:** `cropState: null, cropRect: null` (correct — no previous crop)
- **[CROP 2]:** `cropRect: {"x1":216,"y1":64,"x2":1016,"y2":864}` — exactly 800×800 centred
- `cropState: {"zoom":1.16,"offsetX":0,"offsetY":0}`
- **DB after (dump 88):** `crop: null` — unchanged

### Test 3 — Default zoom, dragged fully left, click "Use Crop"
- **[CROP 2]:** `cropRect: {"x1":0,"y1":0,"x2":928,"y2":928}`
- `cropState: {"zoom":1,"offsetX":86.81,"offsetY":0}`
- **DB after (dump 89):** `crop: null` — unchanged

### Test 4 — Maximum zoom, dragged to bottom-right corner, click "Use Crop"
- **[CROP 2]:** `cropRect: {"x1":432,"y1":128,"x2":1232,"y2":928}` — 800×800, bottom-right
- `cropState: {"zoom":1.16,"offsetX":-143.1,"offsetY":-42.4}`
- **DB after:** `crop: null` — unchanged (confirmed by reading, no dump needed)

---

## Confirmed Bug

The crop tool (`PostCropperComponent`) is working correctly. It calculates and returns accurate `cropRect` and `cropState` values on every use. The data is written into the fieldset's in-memory `imageEntries` array and into the hidden `images_meta` input via `updateImagesMeta()` in `fieldsets.js`.

**The failure point is `edit-post.php`.** It contains an INSERT loop for new file uploads that reads `$imgMeta[$i]` — but this loop only runs when new files are uploaded. There is no UPDATE query for existing `post_media` rows. When a user crops an already-uploaded image and saves the post, the crop data arrives at the server inside `images_meta` but is completely ignored.

**No existing media row is ever touched by `edit-post.php` when only a crop changes.**

---

## The Fix Required

In `edit-post.php`, after the INSERT loop for new files, add a loop over `$imgMeta` entries that have an `id` field. For each, run:

```sql
UPDATE post_media SET settings_json = ?, updated_at = NOW() WHERE id = ? AND post_id = ?
```

The `id` in the meta entry corresponds to `post_media.id`. The `post_id` check is a security constraint to prevent updating media belonging to other posts.

---

## New Post Creation Test (dump 90)

### Test 5 — New post, 816×1456 portrait image, max zoom (1.02), dragged to top-right
- **[CROP 1]:** `cropState: null, cropRect: null` — correct, brand new image
- **[CROP 2]:** `cropRect: {"x1":16,"y1":0,"x2":816,"y2":800}` — 800×800, top-right
- `cropState: {"zoom":1.02,"offsetX":-5.3,"offsetY":217.3}`
- **[TRACK] images_meta:** `[{"id":null,"file_name":"MikeyCrane_0033.jpg","file_type":"image/jpeg","file_size":398473,"crop":{"x1":16,"y1":0,"x2":816,"y2":800}}]`
- **Post created:** 1856, media ID 4451
- **DB (dump 90):** `crop: {"x1":16,"y1":0,"x2":816,"y2":800}` — **SAVED CORRECTLY**
- **thumb_url in recent_posts:** `...00001856-MikeyCrane_0033.jpg?crop=16,0,816,800` — crop parameter present

**Conclusion: `add-post.php` works correctly for new post creation.**

### Crop coordinate verification
For the 816×1456 image at max zoom (800×800 crop, 16px horizontal slack):
- `x1:16` — image pushed fully right, left edge of crop is 16px in (all slack consumed on the left)
- `y1:0` — image pushed fully to the top, no higher position possible
- `x2:816` — right edge is the full image width
- `y2:800` — 800px down from top (minimum crop height)

The numbers are geometrically perfect. The crop tool is calculating coordinates correctly.

### Visual display still wrong
Despite correct data in the database and correct `?crop=` URL being generated, the displayed images do not visually reflect the crop — they still appear centred/default. This is NOT a caching issue (each unique URL is independently cached by Bunny). 

**Suspected cause:** Bunny CDN may interpret `?crop=x1,y1,x2,y2` as `x, y, width, height` rather than left/top/right/bottom edges. If so, `get-posts.php` is sending the wrong format. Needs verification.

---

## Meta Index Misalignment Bug (edit-post.php)

Discovered from dump 90, media ID 4444 (post 1853):
```json
{"id":4443,"file_name":"","file_type":"","file_size":0,"crop":null}
```
The `id:4443` belongs to an existing image. This got written as `settings_json` for a newly uploaded image (4444). This happens because `updateImagesMeta()` in `fieldsets.js` maps ALL `imageEntries` (existing + new), but `$_FILES['images']` only contains new uploads. On the server, `$imgMeta[$i]` for the i-th new file incorrectly reads the meta for the i-th entry in the full array — which may be an existing image.

**This is a second bug in `edit-post.php` affecting new image uploads on posts that already have images.**

---

## Secondary Issue (not yet actioned)

**`cropState` is not persisted.** Only `cropRect` is saved to `settings_json`. This means when a user re-opens the crop tool on an existing image, the zoom and pan position cannot be restored from the database. The tool resets to default state. This is a separate problem to be addressed after the primary fixes are confirmed working.

---

## Files Involved
- `components.js` — `PostCropperComponent` (line 8704)
- `fieldsets.js` — Images fieldset, `openCropperForEntry()` (line 2150), `updateImagesMeta()` (line 2072)
- `member.js` — `submitPostData()` (line 5667)
- `posteditor.js` — `submitPostData()` delegate (line 246), edit save (line 3376)
- `home/funmapco/connectors/edit-post.php` — **two fixes required** (missing UPDATE + meta index misalignment)
- `home/funmapco/connectors/add-post.php` — working correctly for new posts
- `home/funmapco/connectors/get-posts.php` — reads crop and appends to Bunny URL (line 740) — **Bunny format may be wrong**

---

## STATUS SUMMARY

### Completed
- **Edit post crop save** — FIXED. `edit-post.php` now has an UPDATE loop outside the `$_FILES` block that runs on every save. Writes complete `settings_json` (id, file_name, file_type, file_size, crop) for existing media rows.
- **JS meta chain** — FIXED. `get-posts.php`, `posteditor.js`, `fieldsets.js` updated so existing images pass complete metadata (file_name, file_type, file_size) in the `images_meta` payload. Both add and edit now use identical meta format.

### Still Broken
- **Visual display** — FIXED. Bunny CDN expects `crop=width,height,x,y`. We were sending `x1,y1,x2,y2`. `get-posts.php` line ~741 now computes `$cropW` and `$cropH` from the stored coordinates and sends the correct format.
- **cropState not persisted** — zoom/pan state lost on page reload. Secondary issue, address after display is fixed.
- **Meta index misalignment** — when adding NEW images to an existing post that already has images, `$imgMeta[$i]` in the INSERT loop indexes incorrectly. Confirmed by media 4444 having wrong settings_json. Needs separate fix.
- **[CROP 1] format mismatch** — when re-opening the crop tool on an existing image, `entry.cropRect` is in `{x,y,width,height}` format (from get-posts.php) but the tool and updateImagesMeta() expect `{x1,y1,x2,y2}`. This means the initial cropRect shown in [CROP 1] is wrong format. Does not affect saving (since [CROP 2] always overwrites with correct format) but affects re-opening with correct initial position.

---

## CRITICAL: Bunny CDN class + crop URL conflict (Agent 11 finding)

**You CANNOT combine `?crop=` with `?class=` in the same URL.** The class's own crop settings override the URL crop parameter. This was confirmed by:
1. `?crop=816,816,0,0` alone → correct crop ✅
2. `?crop=816,816,0,0&class=thumbnail` → class crop overrides, wrong result ❌
3. Google/Bunny docs confirm: class parameters and URL parameters conflict when both define crop

**Solution:** For cropped images, use explicit `?crop=W,H,X,Y&width=SIZE&height=SIZE` (no class). For uncropped images, use `?class=NAME` as before.

**Implementation needed:**
1. Add three `admin_settings` rows: `bunny_thumbnail_size` (200), `bunny_minithumb_size` (100), `bunny_imagebox_size` (530)
2. Whitelist them in `get-admin-settings.php` so they reach the frontend in startup settings
3. Modify `addImageClass()` in `post.js` (~line 1075): when URL contains `crop=`, append `&width=SIZE&height=SIZE` from settings instead of `&class=NAME`
4. Restore "Crop Gravity: Center" to all three Bunny classes (needed for uncropped images)
5. The posteditor.js `addImageClassToUrl` helper (~line 695) also needs the same logic

**The five image states:**
1. Raw (crop tool + image viewer): no crop, no class, no width/height
2. Imagebox (530×530 hero): `?crop=W,H,X,Y&width=530&height=530` OR `?class=imagebox`
3. Thumbnail (200×200 postcard): `?crop=W,H,X,Y&width=200&height=200` OR `?class=thumbnail`
4. Minithumb (100×100 markers/headers): `?crop=W,H,X,Y&width=100&height=100` OR `?class=minithumb`
5. Uncropped images use `?class=NAME` (class crop gravity handles square centering)

---

## Debug Tracking Logs (still active — remove after all fixes confirmed)

Three console logs are active and available for the next agent to use during testing:

- `[CROP 1]` in `fieldsets.js` (~line 2162) — fires when the crop tool opens. Shows `entry.cropState` and `entry.cropRect` for the image being cropped.
- `[CROP 2]` in `fieldsets.js` (~line 2169) — fires when "Use Crop" is clicked. Shows `result.cropRect` and `result.cropState` returned by the tool.
- `[TRACK] images_meta:` in `member.js` (line 5721) — fires when the form save button is clicked. Shows the full JSON payload being sent to the server including all crop data.

**NOTE:** The page reloads after saving, wiping the console. To capture [TRACK], either preserve log on navigation in DevTools settings, or read it before the page reloads.
