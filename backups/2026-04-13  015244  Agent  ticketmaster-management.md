# Ticketmaster Management

## Glossary

| Term | Meaning |
|---|---|
| **Collection** | Fetching events from the Ticketmaster API into `tm_staging`. Costs API calls. |
| **Seeding** | First-time collection — working through all 5 passes of the 949-item queue. Takes ~5-7 days. |
| **Maintenance** | Collection after seeding is done — page 0 only, catching newly listed events. |
| **Staging** | The `tm_staging` table — raw event data waiting to be processed. |
| **Import** | Turning staged rows into posts, map cards, sessions, pricing, images. No API calls. |
| **Refresh** | Re-fetching data for existing posts to update changed details. Costs API calls. |
| **Cleanup** | Deleting staging rows for posts that expired 6+ months ago. |
| **Clear JSON** | NULLing the `event_json` column on processed rows to save database space. |
| **Cursor** | Tracks position in the 949-item queue between runs so it resumes where it left off. |
| **Pass** | One full sweep through the queue. Seeding does 5 passes (pages 0–4). |

---

## Overview

Three connector scripts form the pipeline, all running daily via a single cron orchestrator:

| Script | Location | Purpose |
|---|---|---|
| `tm-collect.php` | `connectors/` | Fetches events from Ticketmaster API → stores raw JSON in `tm_staging` |
| `tm-collate.php` | `connectors/` | Reads `tm_staging` → creates FunMap posts, map cards, sessions, pricing |
| `tm-refresh.php` | `connectors/` | Re-fetches data for already-imported attractions → updates existing posts in place |

**Orchestrator:** `cron-ticketmaster-daily.php` runs all three phases daily: cleanup → collect → import → refresh.

The staging table acts as a safe buffer. Nothing appears on the site until `tm-collate.php` is run.

All three are registered in `gateway.php` and accessed via:
- `gateway.php?action=tm-collect`
- `gateway.php?action=tm-collate`
- `gateway.php?action=tm-refresh`

---

## Prerequisites

- `tm_staging` table exists in the database ✓
- `tm_staging` has `post_id` column (INT UNSIGNED, after `status`) ✓
- `$TICKETMASTER_CONSUMER_KEY` is set in `config-app.php` ✓
- Ticketmaster member account exists (ID 213, username: Ticketmaster) ✓
- Bunny CDN credentials are in `admin_settings` (`storage_api_key`, `storage_zone_name`, `folder_post_images`) ✓

---

## Phase 1 — Collecting Events

**URL:** `gateway.php?action=tm-collect`

### Parameters

| Parameter | Default | Max | Description |
|---|---|---|---|
| `country` | `GB` | — | ISO country code (GB, US, AU, CA, IE, etc.) |
| `limit` | `50` | `500` | Max attractions to fetch (only successfully staged ones count) |
| `pages` | `3` | `25` | Number of discovery pages to scan |
| `start_page` | `0` | — | Discovery page offset (for resuming) |
| `size` | `200` | `200` | Events per discovery page |
| `segment` | — | — | TM segment filter: Music, Sports, Arts & Theatre, Film (`segmentName`) |
| `genre` | — | — | TM genre filter: Rock, Pop, Football, Comedy, etc. (`classificationName`) |

### How it works

1. **Phase 1 — Discovery:** Scans `pages` × `size` events to find attraction IDs.
2. **Phase 2 — Targeted fetch:** For each new attraction, queries ALL its events across ALL venues (so multi-city tours are complete). Already-collected attractions are skipped automatically.

### API pagination limit (CRITICAL)

The Ticketmaster Discovery API caps deep pagination at approximately **page 5** (~1,200 events). Requesting page 6+ returns HTTP 400. This means a single unsegmented query for a country can never discover more than ~200-300 attractions.

**Solution — Segment-based slicing:** The cron makes separate queries per segment (Music, Sports, Arts & Theatre, Film) for each country. Each segment gets its own full page window, multiplying discovery reach by 4×. The `segment` parameter on `tm-collect.php` passes `segmentName` to the TM Discovery API.

### Exclusions

- **Segment "Miscellaneous"** is excluded (venue admissions: Sea Life, London Eye, Madame Tussauds, etc.). These are daily entry tickets, not events.
- **Events with no attraction ID** are ignored (cannot be grouped into posts).

### Examples

```
# Small test — Music only, 3 pages, up to 10 attractions
gateway.php?action=tm-collect&country=GB&limit=10&segment=Music

# Standard run — Sports in AU, 5 pages
gateway.php?action=tm-collect&country=AU&limit=100&pages=5&segment=Sports

# Arts & Theatre (URL-encoded space/ampersand)
gateway.php?action=tm-collect&country=GB&limit=50&pages=5&segment=Arts+%26+Theatre

# All segments (no filter) — limited by 5-page pagination cap
gateway.php?action=tm-collect&country=GB&limit=100&pages=5
```

### API limits

Free tier: **5,000 calls/day**. The script pauses 250ms between calls (~4/sec). Each run uses approximately `pages + (new attractions found)` API calls. HTTP errors skip the bad attraction and continue — only rate limits (429) stop the run.

---

## Phase 2 — Collating to Posts

**URL:** `gateway.php?action=tm-collate`

### Parameters

| Parameter | Default | Max | Description |
|---|---|---|---|
| `limit` | `50` | `200` | Max **attractions** to process per run (each attraction loads ALL its staging rows — no partial posts) |

### How it works

- Groups staged events by **attraction** (one FunMap post per touring act)
- Sub-groups by **venue** (one map card per venue/city)
- Each map card gets its own sessions and pricing
- Downloads the best image (≥1000px wide) and uploads it to Bunny CDN
- Writes `post_id` back to all staging rows for the attraction
- Marks all processed rows as `imported` or `skipped`

### Description enrichment

For **single-venue posts**, the description includes all available venue data from the JSON:
- Event info (`info` field) and please note (`pleaseNote`)
- Age/Children rules (`generalInfo.childRule`)
- General rules (`generalInfo.generalRule`)
- Accessibility info (`accessibleSeatingDetail`)
- Box office: hours, phone, payment, collection (`boxOfficeInfo.*`)
- Parking (`parkingDetail`)
- Attribution sign-off

For **multi-venue posts** (touring shows), only event-level info is included (venue-specific details would be misleading for a post with 30+ venues).

### Session keys

Each session at a venue gets a ticket group key: A, B, C … Z, AA, AB … ZZ. Supports up to 702 sessions per venue — sufficient for long-running shows.

### Pricing tiers

Each TM event's `priceRanges` array produces pricing rows per seating area:
- `ticket_area` = TM's `type` field, title-cased (e.g. "Standard", "Vip"). NULL if no type (general admission).
- `allocated_areas` = `1` if named area, `0` if general admission. Frontend shows "General Admission" when `0`.
- `pricing_tier` = `"From"` (minimum price) and `"To"` (maximum price, only if different from min).
- Member-created posts use their own descriptive tier names (e.g. "Adult", "Child"). "From"/"To" is TM-import only.

### Quality gates — events are skipped if:

| Reason | Skip label |
|---|---|
| No venue coordinates | `no venues with coordinates` |
| No image ≥ 1000px wide | `no qualifying image` |
| Already imported | `already imported` |

**Note:** There is no price gate. Events without pricing are imported normally — the pricing section is simply empty.

### Examples

```
# Test run — 3 attractions
gateway.php?action=tm-collate&limit=3

# Standard run
gateway.php?action=tm-collate&limit=50

# Run again to continue if attractions remain
gateway.php?action=tm-collate&limit=200
```

---

## Phase 3 — Refreshing Existing Posts

**URL:** `gateway.php?action=tm-refresh`

### Parameters

| Parameter | Default | Max | Description |
|---|---|---|---|
| `max_api` | `2000` | `5000` | Hard API call ceiling for this run |

### How it works

1. Loads all posts with `tm_attraction_id IS NOT NULL` and `expires_at > NOW()`, ordered by `id ASC`
2. Uses a **cursor** (`refresh_position` in `tm_staging._cursor` row) to resume from the last processed post
3. Batches attraction IDs (up to 200 per API call) into comma-separated `attractionId` parameter
4. Re-fetches all events from the Ticketmaster API for each batch
5. Groups results by venue, updates `event_json` in staging, and **detects which venues actually changed** via `affected_rows`
6. **Skips unchanged venues entirely** — their `post_map_card_id` is preserved
7. For changed venues: saves past sessions/pricing, deletes children, **UPDATEs the map card in place** (preserving ID), reinserts children
8. For new venues: INSERTs a new map card
9. For removed venues: preserves past sessions if any exist, otherwise deletes the card
10. Updates `processed_at = NOW()` for the attraction's staging rows
11. Stops when `max_api` API calls reached — tomorrow picks up where today stopped

### Cycling behavior

The cursor-based ordering ensures every active post gets refreshed over time. The script loads all active TM posts and works through them in post ID order until the API budget is exhausted. The `refresh_position` cursor saves the last processed post ID; tomorrow it resumes from there.

- Expired posts are never refreshed (zero wasted API calls)
- When the end of the list is reached, the cursor resets to 0 and starts over

### What gets updated

| Level | Method |
|---|---|
| **Post** | `subcategory_key`, `loc_qty`, `loc_paid`, `expires_at` compared and updated if changed |
| **Unchanged venues** | Skipped entirely — `post_map_card_id` and all children preserved |
| **Changed venues** | Map card UPDATEd in place (ID preserved). Children deleted and reinserted from TM + saved past data |
| **New venues** | New map card INSERTed |
| **Removed venues (with past)** | Future sessions/pricing deleted, past preserved. Card expires naturally via `end_date` |
| **Removed venues (no past)** | Card and all children deleted |
| **Map card dates** | `start_date` and `end_date` recalculated from MIN/MAX of all `post_sessions` (past + future) |

### What is never changed

- Post IDs (URLs and external links preserved)
- Post images (no re-upload on refresh)
- `post_key` (URL slug stays the same)
- Past sessions and pricing (preserved across refreshes)
- **Map card IDs for unchanged venues** (preserved — no destroy/rebuild)

### Examples

```
# Test with small budget
gateway.php?action=tm-refresh&max_api=50

# Standard daily run
gateway.php?action=tm-refresh&max_api=3000
```

---

## Daily Cron — `cron-ticketmaster-daily.php`

**cPanel cron (daily, 3am):**
```
/usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php
```

### What it does (in order)

1. **Cleanup** — Purges staging rows for posts that expired 6+ months ago
2. **Collect** — 949-item genre rotation queue. Each item = 1 discovery page. Stops when collection budget is hit.
3. **Refresh** — Runs `tm-refresh.php` with dynamic budget (whatever remains after collection, up to ceiling). All API calls land in a tight window to avoid rolling-limit oscillation.
4. **Collate** — Runs `tm-collate.php` in a loop (up to 10 rounds) until no pending rows remain. No API calls.
5. **Clear JSON** — NULLs `event_json` on imported/skipped rows to reclaim storage

### API budget (5,000 calls/day)

Budget split is **dynamic** based on seeding status:

| Phase | Seeding | Maintenance | Notes |
|---|---|---|---|
| Collect | **3,000** | 1,000 | Discovery + detail fetches |
| Refresh | 1,000 | **3,000** | All active attractions, oldest first |
| Import | 0 | 0 | No API calls — reads from staging only |
| **Reserve** | **1,000** | **1,000** | Spare for manual searches |

Collect and refresh are ordered back-to-back so all API calls land in a tight ~30-minute window. This prevents the rolling 24-hour limit from causing oscillation (4k/1k/4k/1k pattern).

The cron logs `Rate-Limit-Available` from TM response headers at the end of each API-consuming phase, and the final summary line shows the combined total of all API calls (collect + refresh).

### Seeding vs maintenance

**Seeding (automatic):** Runs 5 passes over the 949-item queue — pass 0 scans page 0 of each item, pass 1 scans page 1, etc. Takes ~5-7 days depending on how many new attractions are found. The cursor tracks position and pass between runs.

**Maintenance (automatic):** After all 5 passes complete, the cron auto-switches. Every item gets page 0 only (949 discovery calls per cycle). Most attractions already in staging — detail fetches are minimal. Frees up most of the budget for refresh.

### Cursor tracking

State is stored as a JSON string in the `skip_reason` column of a marker row in `tm_staging` (where `tm_event_id = '_cursor'`):
- `position` — current item in the 949-item queue (0-948)
- `pass` — current page pass (0-4 during seeding)
- `seeded` — flips to 1 after pass 4 finishes

### The 949-item queue

**Segmented countries (11):** GB, US, CA, AU, DE, MX, FR, ES, IT, NL, JP — queried per genre (82 genres × 11 = 902 items)

**Unsegmented countries (47):** Everything else — single unsegmented query each (47 items)

Unsegmented countries are interleaved evenly through the segmented queue for variety.

Genre order is round-robin: Music → Sports → Arts & Theatre → Film, cycling through all genres in each segment. See `cron-ticketmaster-daily.php` for the full ordered list.

---

## Monitoring Queries

### Staging status overview
```sql
SELECT status, COUNT(*) AS events,
       ROUND(SUM(LENGTH(event_json)) / 1024 / 1024, 2) AS mb
FROM tm_staging
GROUP BY status;
```

### Country breakdown
```sql
SELECT 
    JSON_UNQUOTE(JSON_EXTRACT(event_json, '$._embedded.venues[0].country.countryCode')) AS country,
    COUNT(*) AS events
FROM tm_staging
GROUP BY country
ORDER BY events DESC;
```

### Skip reasons
```sql
SELECT skip_reason, COUNT(*) AS count
FROM tm_staging
WHERE status = 'skipped'
GROUP BY skip_reason
ORDER BY count DESC;
```

### Posts created by Ticketmaster importer
```sql
SELECT COUNT(*) AS posts, MIN(created_at) AS first, MAX(created_at) AS last
FROM posts
WHERE member_id = 213;
```

### Map cards created
```sql
SELECT COUNT(*) FROM post_map_cards
WHERE post_id IN (SELECT id FROM posts WHERE member_id = 213);
```

---

## Deduplication — Critical

Every Ticketmaster event has a permanent unique ID (`tm_event_id`, e.g. `1ku8vN-eGA19Ti5`). This ID never changes and is never reused by Ticketmaster.

The system uses this at two levels to guarantee no event is ever collected or imported twice:

**Collection level:** `tm_staging.tm_event_id` has a `UNIQUE KEY`. The collector uses `INSERT IGNORE`, so if an event ID already exists in staging it is silently skipped — no matter how many times you run the collector, for any country, on any day.

**Import level:** Before importing an attraction, the importer checks `tm_staging` for any row with that `attraction_id` and `status = 'imported'`. If found, the entire attraction is skipped and no duplicate post is created.

### ⚠️ The staging table must NEVER be truncated between runs

`tm_staging` is a **permanent deduplication log**, not a temporary buffer. Imported rows must remain in the table with `status = 'imported'` indefinitely. They are the only record the system has of what has already been collected and imported. The `post_id` column links each attraction back to the post it became.

If you truncate `tm_staging` without also deleting all imported posts:
- The collector will re-collect everything from scratch
- The importer will find no `imported` rows and will create duplicate posts for everything

**The only safe time to truncate is a full reset** — where you also run `DELETE FROM posts WHERE member_id = 213` at the same time to wipe all imported posts.

### Re-queue skipped events for another import attempt
```sql
UPDATE tm_staging SET status = 'pending', skip_reason = NULL, processed_at = NULL
WHERE status = 'skipped';
```

### Full reset — wipe everything and start from scratch
```sql
-- Run BOTH of these together, never one without the other
DELETE FROM posts WHERE member_id = 213;
TRUNCATE TABLE tm_staging;
```

---

## Subcategory Mapping

| Ticketmaster Segment | FunMap Subcategory |
|---|---|
| Music | `live-music` |
| Sports | `live-sport` |
| Arts & Theatre | `performing-arts` |
| Film | `cinema` |
| Miscellaneous | excluded at collection (venue admissions) |
| Genre = Festival / Festivals | `festivals` (overrides segment) |

---

## Attribution

All imported posts are assigned to member ID **213** (Ticketmaster). The description of every post ends with:

> Powered by Ticketmaster
>
> Click the Get Tickets button for full event details, pricing, and availability.

---

## Known Limitations

### API pagination cap
The Discovery API returns HTTP 400 for pages beyond ~5. A single query can only discover ~200-300 attractions. This is mitigated by segment-based slicing — each segment (Music, Sports, Arts & Theatre, Film) gets its own 5-page window, multiplying discovery reach by 4×.

### Description quality
The TM Discovery API has no dedicated "description" field. The importer uses `info` and `pleaseNote` fields plus venue-level data (box office, accessibility, parking, child rules). For single-venue posts this produces rich descriptions. For multi-venue or events without venue data, descriptions are thin.

### Pricing data is sparse
Most events in the TM Discovery API have no `priceRanges` data. Major shows (Phantom, Wicked, Lion King) often return no pricing. Events without pricing are imported normally — the pricing section is empty on the frontend.

---

## Collection Strategy — Genre-Based Rotation

### Two-tier country system

**Segmented countries (11):** US, GB, CA, AU, DE, MX, FR, ES, IT, NL, JP
These countries have too many events for a single unsegmented query (exceed the 5-page API cap). They are collected using genre-level rotation — one genre at a time, cycling through all genres over ~30 days.

**Unsegmented countries (47):** Everything else.
These fit within 5 pages total. During **seeding**, they get a full 5-page scan. After seeding, they drop to **page 1 once a week** for maintenance (47 API calls per week).

### Genre rotation (segmented countries)

The TM API supports `classificationName` as a query parameter for genre-level filtering. Each genre gets up to 5 pages (1,000 events). Zero crossover between genres — each event belongs to exactly one genre.

**Music** (24 genres): Alternative, Ballads/Romantic, Blues, Chanson Francaise, Children's Music, Classical, Country, Dance/Electronic, Folk, Hip-Hop/Rap, Holiday, Jazz, Latin, Medieval/Renaissance, Metal, New Age, Other, Pop, R&B, Reggae, Religious, Rock, Soul, World

**Sports** (~30 genres): Aquatics, Baseball, Basketball, Boxing, Cricket, Cycling, Equestrian, eSports, Extreme Sports, Football, Golf, Gymnastics, Hockey, Ice Skating, Lacrosse, Martial Arts, Motorsports/Racing, Netball, Rodeo, Rugby, Skiing, Soccer, Softball, Surfing, Swimming, Tennis, Track & Field, Volleyball, Wrestling, and others

**Arts & Theatre** (~20 genres): Children's Theatre, Circus & Specialty Acts, Classical, Comedy, Community/Civic, Cultural, Dance, Fashion, Fine Art, Magic & Illusion, Music, Opera, Performance Art, Puppetry, Spectacular, Theatre, Variety

**Film** (~12 genres): Action/Adventure, Animation, Comedy, Documentary, Drama, Family, Foreign, Horror, Music, Sci-Fi/Fantasy, Thriller, Urban

The rotation order will be interleaved across genres so the site gets variety from day one (not 30 days of hip-hop before anything else appears). Each day the cron picks up where it left off — advancing through the genre list per country. When a genre runs dry before 5 pages, it immediately moves to the next genre. Full cycle completes in ~30 days, then starts again (catching newly listed events on the second pass).

### Seeding vs maintenance

**Seeding (first pass):** All countries scanned deep. Segmented countries cycle through all genres over ~30 days. Unsegmented countries get full 5-page scans.

**Maintenance (ongoing):** Segmented countries continue the genre rotation (same cycle). Unsegmented countries drop to page 1 once a week (47 calls/week). Most attractions already in staging — discovery calls mostly find duplicates, detail fetches are skipped.

### Cursor position

The genre rotation cursor (which country, which genre, which page) is tracked in the `tm_staging` table so the cron can resume where it left off each day.

---

## TODO — Outstanding Work

### ~~Genre rotation system~~ ✓ DONE
Implemented. 949-item queue with cursor tracking, seeding/maintenance auto-switch, global API counter.

### Remove weekly cron from cPanel
`cron-ticketmaster-weekly.php` is no longer needed. Refresh runs daily as part of the daily cron. Remove the Sunday midnight cron entry.

### Insert cursor marker row
Run this SQL to create the cursor tracking row in tm_staging:
```sql
INSERT IGNORE INTO tm_staging (tm_event_id, event_json, status, skip_reason)
VALUES ('_cursor', '', 'imported', '{"position":0,"pass":0,"seeded":0}');
```

---

## Affiliate Program

The site owner has applied for the Ticketmaster affiliate program via **Impact** (their tracking/payment partner). Status: under review (applied 8 Apr 2026, estimated 10-day review).

Once approved, the Impact Publisher ID should be embedded into ticket URLs in `tm-collate.php` for commission tracking on outbound ticket links. The site owner decides whether to wait for approval or proceed with imports beforehand.

The verification meta tag is already in `index.php`:
```html
<meta name="impact-site-verification" value="8b1854e8-4501-4440-8c23-bb7fda5cdeba">
```

---

## Files Modified — Session 3 (8 Apr 2026)

| File | Changes |
|---|---|
| `tm-collate.php` | `groupDescription()` rewritten to extract venue details (box office, accessibility, parking, child rules) for single-venue posts |
| `tm-refresh.php` | Same `groupDescription()` rewrite. Query fixed: filters expired posts, orders by staleness (`processed_at ASC`), updates `processed_at` after each attraction. Added `max_api` budget ceiling. |
| `cron-ticketmaster-daily.php` | Added all 58 TM countries. Added page rotation (page 0 + rotating deeper pages). Split limits between invocations to stay within API budget. Added import loop (up to 10 rounds). Added refresh as Phase 3. Added cleanup step for expired staging rows. |
| `post.css` | `margin-bottom: 20px` added to `.post-description-text`; `margin-top` removed from `.post-description-member` |

## Files Modified — Session 4 (9 Apr 2026)

| File | Changes |
|---|---|
| `tm-collect.php` | Added `segment` and `genre` parameters (`segmentName` + `classificationName` on API). Fixed variable collision in discovery loop. Added `[API_CALLS:N]` output for cron parsing. |
| `cron-ticketmaster-daily.php` | Complete rewrite. 949-item genre rotation queue (82 genres × 11 segmented countries + 47 unsegmented, interleaved). Cursor tracking via `tm_collect_cursor` table. Auto seeding→maintenance switch after 5 passes. Global API counter across phases. JSON cleanup after import. Dynamic refresh budget. |

## Files Modified — Session 5 (10 Apr 2026)

| File | Changes |
|---|---|
| `cron-ticketmaster-daily.php` | Complete rewrite: replaced `shell_exec`/`passthru` subprocess calls with direct `include` via `runPhase()` function wrapper. Fixes cron failing silently on shared hosting where process-spawning functions are disabled (PHP 8.x throws Fatal Error). Added comprehensive logging to `../logs/tm-cron-YYYY-MM-DD.log` with timestamps, phase timing, and staging status summary. Auto-rotates logs after 30 days. Now loads `config-app.php` in addition to `config-db.php`. |
| `tm-collect.php` | Added `TM_CRON_ORCHESTRATOR` support: skips config loading and uses `global $mysqli` when included from cron. Wrapped `tmFetch()` and `stageEvents()` in `function_exists()` guards. Conditional HTML output. |
| `tm-collate.php` | Same cron orchestrator support. Changed `const` to `define()` with guards. Wrapped all 7 functions in `function_exists()` guards. Changed `die()` to `return` in cron mode. |
| `tm-refresh.php` | Same cron orchestrator support. Same constant and function guarding. Changed `die()` to `return` in cron mode. |
| `../logs/.htaccess` | New file: blocks all web access to log directory. |

### Logging

Cron output is now written to `home/funmapco/logs/tm-cron-YYYY-MM-DD.log`. Each run is timestamped and includes:
- Phase start/end with elapsed time
- Collection: items processed, API calls used, new events found
- Import: rounds run, pending counts
- Refresh: attractions processed
- Final staging status summary (pending/imported/skipped counts)

Logs auto-delete after 30 days. The `logs/` directory is protected by `.htaccess`.

## Files Modified — Session 7 (12 Apr 2026)

| File | Changes |
|---|---|
| `tm-refresh.php` | Rewrote API loop: batches comma-separated attraction IDs per API call. Queries `posts.tm_attraction_id`. Tracks position via `refresh_position` cursor. **Granular venue updates:** detects changed venues via `affected_rows` on staging updates; unchanged venues are skipped entirely (ID preserved). Changed venues are UPDATEd in place (ID preserved), children deleted and reinserted. New venues INSERTed. Removed venues: past preserved or card deleted. Transaction-wrapped. |
| `tm-collate.php` | Added `tm_attraction_id` to post INSERT during collation. |
| `edit-post.php` | Wrapped in database transaction. Replaced blanket delete-and-reinsert with per-location UPDATE-in-place: existing cards at same coordinates are UPDATEd (preserving `post_map_card_id`), children are deleted and reinserted, new cards are INSERTed, removed cards are DELETEd. |
| `tm-budget.php` | Fixed `Rate-Limit-Reset` parsing (milliseconds, not seconds). Added minutes display. |
| `posts` table | Added `tm_attraction_id` varchar(50) column after `payment_status`, indexed. Populated from `tm_staging` for all existing TM posts. |
| `_cursor` row | Added `refresh_position` field to JSON. |

## Files Modified — Session 6 (11 Apr 2026)

| File | Changes |
|---|---|
| `cron-ticketmaster-daily.php` | Reordered phases: collect → refresh → import → clear (API calls grouped tight). Dynamic budget based on `seeded` flag (3k/1k seeding, 1k/3k maintenance). Parses `[API_CALLS:N]` from refresh output. Logs `Rate-Limit-Available` from TM headers after each API phase. Final total now sums collect + refresh. |
| `tm-refresh.php` | Complete rewrite. Delete-and-reinsert approach (same as Post Editor): saves past sessions/pricing, deletes all map cards + children, reinserts map cards from TM with past data reattached. Handles zero events: deletes post if no past sessions, otherwise removes future sessions and lets cards expire naturally. Removed `limit` parameter and `LIMIT` clause — loads ALL active attractions, staleness-ordered, processes until budget runs out. Added `[API_CALLS:N]` and `[RATE_LIMIT_AVAILABLE:N]` output tags. |
| `tm-budget.php` | New file. Minimal API call (costs 1 call) to check `Rate-Limit-Available` and `Rate-Limit-Reset` headers. Accessible via `gateway.php?action=tm-budget`. |
| `gateway.php` | Added `tm-budget` route. |
| `tm-collect.php` | `tmFetch()` now captures response headers via `CURLOPT_HEADERFUNCTION` and returns them as `_headers` key. Tracks `Rate-Limit-Available` across calls. Added `[RATE_LIMIT_AVAILABLE:N]` output tag. |

---

## Pending Changes

### ~~Rename `tm-import.php` → `tm-collate.php`~~ ✓ DONE

Renamed. File, gateway route, cron references, comments, and documentation all updated.

### ~~Reorder Cron Phases: API Calls First~~ ✓ DONE

Implemented. Cron now runs collect → refresh → import → clear. All API calls land in a tight window.

### ~~Dynamic API Budget Based on Seeding Status~~ ✓ DONE

Implemented. Seeding: 3k collect / 1k refresh. Maintenance: 1k collect / 3k refresh. 1k reserve always.

### ~~Collection: Page 0 Only After Seeding~~ ✓ DONE

Already implemented. `$page = $seedingComplete ? 0 : $pass;`

### ~~Rewrite Refresh: Granular Venue Updates~~ ✓ DONE

Complete rewrite with per-venue change detection:
1. Update staging JSON and track `affected_rows` per venue to detect changes
2. **Skip unchanged venues entirely** — `post_map_card_id` preserved
3. For changed venues: save past sessions/pricing, delete children, UPDATE card in place (ID preserved), reinsert children
4. For new venues: INSERT new card
5. Removed venues with past data: delete future sessions, preserve card (expires via `end_date`)
6. Removed venues without past data: delete card and all children

Zero events handling:
- No past sessions → delete the entire post (CASCADE cleans everything)
- Has past sessions → remove future sessions, recalculate dates, post stays and expires naturally

`LIMIT` removed from attraction query. Loads ALL active attractions, staleness-ordered. Processes until budget runs out. Budget check between attractions — multi-page attractions always complete.

### ~~Batch Multiple Attraction IDs Per API Call~~ ✓ DONE

Implemented. TM Discovery API confirmed to accept comma-separated `attractionId` values.

**Schema change:** Added `tm_attraction_id` column (varchar 50, indexed) to `posts` table. Populated during collation (`tm-collate.php`). NULL for non-TM posts.

**Refresh rewrite:** `tm-refresh.php` now:
1. Queries `posts` table directly (fast indexed read) instead of GROUP BY on `tm_staging`
2. Batches attraction IDs into comma-separated API calls (up to 200 results per page across many attractions)
3. Paginates each batch to completion, then groups results by attraction
4. Attractions absent from results = zero future events (delete or expire)
5. Tracks position via `refresh_position` in the `_cursor` row JSON
6. Continues from previous position each day; cycles back to start when complete
7. Budget check between batches — current batch's pagination always completes

**Efficiency:** ~100-200 API calls to refresh all 4,000+ attractions vs 4,000+ calls with the old one-per-attraction approach.

### ~~Log Real API Budget From TM Response Headers~~ ✓ DONE

Implemented. `tmFetch()` now captures all response headers. `Rate-Limit-Available` is logged by the cron at the end of each API phase via `[RATE_LIMIT_AVAILABLE:N]` output tags.

### ~~Fix Total API Call Counter~~ ✓ DONE

Implemented. Cron parses `[API_CALLS:N]` from both collect and refresh output. Final log line shows combined total.

### ~~Research TM's 24-Hour Rate Limit Window~~ ✓ ANSWERED

Rolling 24-hour window. Each API call expires exactly 24 hours after it was made. The `Rate-Limit-Reset` header returns a millisecond timestamp. The 1,000 reserve budget ensures the cron always has calls available when it starts, even before yesterday's calls roll off. `tm-budget.php` provides real-time budget checks (costs 1 API call).

### ~~Delete `cron-ticketmaster-weekly.php`~~ ✓ DONE

Deleted from the repo. cPanel cron entry also removed.
