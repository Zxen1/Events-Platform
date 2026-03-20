# Map Images — Full Plan

## The Problem In Plain English

The site has two paths that create `map_images` rows:

1. **`wallpaper-generator.html`** — a manual admin tool. This has always worked correctly. It uses a `slugify()` function on a human-supplied venue name to produce canonical filenames like `royal-botanic-gardens-victoria-melbourne-gardens__-37.8302443_144.9801496__Z18-P75-N.webp`. All 11,085 good rows in the DB came from this tool.

2. **`add-post.php`** — the website post creation flow. This was added by agents and has never worked correctly. It produced 428 broken rows across 107 test posts (4 bearings each), with empty `file_name`, empty `location_type`, and URLs using either `map_{lat}_{lng}_{bearing}_{hash}.jpg` or `location__{lat}_{lng}__Z18-P75-{dir}.webp` formats. The Bunny files for these 107 locations do exist — they are correctly captured images, just wrongly named.

---

## Canonical Filename Rule

```
{slug}__{lat}_{lng}__Z18-P75-{N|E|S|W}.webp
```

- `slug` = `slugify(venue_name)`, falling back to `address_line`, then `city`
- `lat`/`lng` = the **exact** Google Places coordinates from `post_map_cards` — no rounding, no reformatting
- The `slugify()` function from `wallpaper-generator.html` is the reference implementation

---

## Coordinate Rule (Critical)

Coordinates come from the **Google Places API** via the form system. These are paid-for, exact coordinates stored in `post_map_cards.latitude` and `post_map_cards.longitude`. The map image capture, filename, and DB row must all use these exact coordinates. If Mapbox coordinates are used instead, posts at the same venue will be off by metres and will not share map images correctly.

---

## Source Priority For Venue Name (slug)

When building the slug, use the first non-empty value from:
1. `post_map_cards.venue_name`
2. `post_map_cards.address_line`
3. `post_map_cards.city`
4. `post_map_cards.suburb`
5. `post_map_cards.state`
6. `post_map_cards.country_name`

If none of the above yield a usable name, the tool must flag that row for manual review. It must never silently generate a coordinate-based fallback name.

---

## Task 1 — Fix Going Forward (add-post.php)

The map image upload block in `add-post.php` must be rewritten so that:

1. The slug is built server-side from `venue_name` (falling through the priority list above), using the same `slugify()` logic as `wallpaper-generator.html`
2. The canonical filename is built as `slug__lat_lng__Z18-P75-{dir}.webp`
3. The lat/lng used in the filename come from the submitted `post_map_cards` data — exact, no reformatting
4. Both `file_name` and `file_url` are always written to the DB row
5. `location_type` is always written (use `venue_name` → `'venue'`, city → `'city'`)
6. The fallback that generates `location__...` names is removed entirely. If no name is available, log an error and skip — do not insert a broken row.

The same fix applies to `get-map-wallpapers.php` (the POST self-healing path).

---

## Task 2 — Fix Existing 428 Broken Rows

### What We Have
- 428 broken `map_images` rows (IDs 11077–11513), covering 107 coordinate sets
- The Bunny files for these 107 locations **exist** — they are good captured images under wrong names
- The exact Google Places coordinates are in `post_map_cards` (matched by lat/lng)
- The venue names are in `post_map_cards.venue_name`
- The 107 posts are test posts and their post data can be deleted — but the coordinates and venue names must be extracted first

### Repair Strategy (Rename, Not Regenerate)

For each of the 107 broken coordinate sets:

1. Find the matching `post_map_cards` row by lat/lng
2. Build the correct slug from the venue name priority list
3. Build the 4 canonical filenames (N, E, S, W)
4. For each bearing:
   - Download the existing wrongly-named Bunny file
   - Upload it to Bunny under the correct canonical filename
   - Delete the old wrongly-named Bunny file
   - Update the `map_images` row: set `file_name`, `file_url`, `location_type`

This avoids regenerating images from Mapbox (which costs time, not Google Places API money, but takes hours) and avoids any coordinate drift.

### The Repair Tool

Build as a standalone PHP file in `Agent/`. It must be:
- **Resumable** — if interrupted, re-running it skips already-fixed rows
- **Idempotent** — running it twice produces the same result
- **Reporting** — at the end, output counts of: fixed, skipped (already good), failed, needs-manual-review

The tool reads from the live DB, matches coordinates between `map_images` and `post_map_cards`, builds correct names, renames on Bunny, and updates the DB.

---

## Task 3 — Delete The 107 Test Posts (After Repair)

Once all 428 rows are renamed and updated correctly, the 107 test posts can be deleted. The cascade will clean up `post_map_cards` and related tables. The `map_images` rows will remain (they are not cascaded) and will now have correct names.

---

## What The Previous Handover Got Right

- Coordinates are the source of truth — correct
- Source priority for venue name — correct
- Both `file_name` and `file_url` must always be written — correct
- Never use `location__` or `map_` patterns — correct

## What The Previous Handover Got Wrong

- Suggested rebuilding/recapturing images — unnecessary, the files exist on Bunny
- Suggested deleting bad Bunny files first — wrong order, rename instead
- Treated the repair as needing Mapbox recapture — it does not
- Mentioned OpenStreetMap/Nominatim fallback — not needed, venue names are in `post_map_cards`

---

## Key Files

- `wallpaper-generator.html` — reference implementation for slugify and filename format
- `home/funmapco/connectors/add-post.php` — Task 1 target (map image upload block, ~lines 1403–1536)
- `home/funmapco/connectors/get-map-wallpapers.php` — Task 1 target (POST self-healing path, ~lines 45–207)
- `funmapco_db (82).sql` — database dump, `post_map_cards` starts line 12372
- `Agent/wallpaper-settings.txt` — Bunny storage settings reference

---

## Database State (Dump: funmapco_db (82).sql)

- Total `map_images` rows: 11,513
- Good rows: 11,085
- Broken rows: 428 (IDs 11077–11513)
- Broken rows cover: 107 coordinate sets × 4 bearings
- All 107 test posts were created through the website post creation flow after Feb 3 2026
- All 107 have corresponding `post_map_cards` rows with correct Google Places coordinates and venue names
