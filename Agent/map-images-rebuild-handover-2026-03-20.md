# Map Images Rebuild Handover

## Purpose
Build a standalone repair tool for `map_images` and Bunny map-image files.

The goal is to:
- preserve exact coordinates
- preserve/recover the best human-readable place names
- discard broken wallpaper derivatives
- rebuild missing map images cleanly

## Current Live Code Status
- Live bug fixed: new `map_images` rows now write both `file_name` and `file_url`
- Fixed in:
  - `home/funmapco/connectors/add-post.php`
  - `home/funmapco/connectors/get-map-wallpapers.php`
- GET/read path no longer deletes DB rows during normal lookup
- Missing Bunny files are filtered out of GET response so self-repair can still happen

## Known Database State
- Dump used: `funmapco_db (82).sql`
- Total `map_images` rows: `6456`
- Rows with missing `file_name`: `428`
- Broken ID range: `11077` to `11504`
- This is one continuous block

## Important Findings
- Missing `file_name` bug was caused by newer server insert paths writing `file_url` but not `file_name`
- Existing good rows are not damaged by:
  - normal viewing
  - refresh
  - cache clear
  - lighting/theme/wallpaper mode changes
- Therefore the broken rows came from row creation paths, not ordinary reads

## Core Rules For The Repair Tool
1. Coordinates are the source of truth. Never overwrite `latitude`, `longitude`, `bearing`, `pitch`, or `zoom` unless proven wrong.
2. Bunny filenames are not the source of truth.
3. Prefer existing database place names over any external lookup.
4. Prefer these recovery sources, in this order:
   - `post_map_cards.venue_name`
   - `post_map_cards.address_line`
   - `post_map_cards.city`
   - `post_map_cards.suburb`
   - `post_map_cards.state`
   - `post_map_cards.country_name`
   - existing good `map_images.file_name`
   - existing good `map_images.file_url`
5. Treat generic names as low quality:
   - `location__...`
   - `map_...`
6. Never invent a place name silently.
7. If no trustworthy name survives, mark for manual review.
8. Rebuilt rows must always write both `file_name` and `file_url`.
9. Tool must be resumable and idempotent.
10. Tool must produce a report of:
   - kept
   - rebuilt
   - skipped
   - needs manual review

## What The Tool Must Do
1. Read current `map_images` rows.
2. Group rows by coordinate set.
3. Decide whether each set is:
   - good
   - recoverable
   - broken
4. Recover the best human-readable slug from trusted DB sources.
5. Detect whether Bunny files exist for each expected bearing.
6. If files are missing, rebuild them from the exact coordinates.
7. Upload rebuilt files to Bunny using the canonical filename.
8. Insert or update `map_images` rows so metadata matches Bunny reality.

## Canonical Filename Rule
Use:

`{slug}__{lat}_{lng}__Z18-P75-{N|E|S|W}.webp`

Where:
- `slug` comes from the best trusted place-name source
- lat/lng must match the exact stored coordinates used by the system

## What Not To Do
- Do not restore old files blindly from backups
- Do not trust stale `map_images` metadata if Bunny file is gone
- Do not use Google Places again unless absolutely necessary
- Do not fetch external names first if the DB already contains a trustworthy name

## Free External Fallback
If a name is truly lost everywhere in the DB, the free fallback is OpenStreetMap/Nominatim.

Use only as last resort because:
- naming may differ from Google
- venue quality is inconsistent
- rate limits apply

## Recommended Repair Strategy
1. Keep coordinates.
2. Recover best names from DB.
3. Optionally delete bad Bunny map-image files first.
4. Rebuild only what is missing or broken.
5. Update `map_images` to match the rebuilt files.

## Separate Tasks
- This handover is for the rebuild tool only.
- Healing the existing `428` blank `file_name` rows can be done separately if needed.
- Renaming already-bad Bunny files is a separate operation from fixing DB metadata.

## Key Files To Inspect
- `home/funmapco/connectors/get-map-wallpapers.php`
- `home/funmapco/connectors/add-post.php`
- `components.js`
- `Agent/wallpaper-settings.txt`
- `funmapco_db (82).sql`
