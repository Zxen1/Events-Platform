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
`?crop=x1,y1,x2,y2`
where `x1`=left edge, `y1`=top edge, `x2`=right edge, `y2`=bottom edge (all in original image pixels).

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

## Secondary Issue (not yet actioned)

**`cropState` is not persisted.** Only `cropRect` is saved to `settings_json`. This means when a user re-opens the crop tool on an existing image, the zoom and pan position cannot be restored from the database. The tool resets to default state. This is a separate problem to be addressed after the primary fix is confirmed working.

---

## Files Involved
- `components.js` — `PostCropperComponent` (line 8704)
- `fieldsets.js` — Images fieldset, `openCropperForEntry()` (line 2150), `updateImagesMeta()` (line 2072)
- `member.js` — `submitPostData()` (line 5667)
- `posteditor.js` — `submitPostData()` delegate (line 246), edit save (line 3376)
- `home/funmapco/connectors/edit-post.php` — **fix required here**
- `home/funmapco/connectors/add-post.php` — may also need review
- `home/funmapco/connectors/get-posts.php` — reads crop and appends to Bunny URL (line 740)
