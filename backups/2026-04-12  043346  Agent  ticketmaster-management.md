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
| `tm-import.php` | `connectors/` | Reads `tm_staging` → creates FunMap posts, map cards, sessions, pricing |
| `tm-refresh.php` | `connectors/` | Re-fetches data for already-imported attractions → updates existing posts in place |

**Orchestrator:** `cron-ticketmaster-daily.php` runs all three phases daily: cleanup → collect → import → refresh.

The staging table acts as a safe buffer. Nothing appears on the site until `tm-import.php` is run.

All three are registered in `gateway.php` and accessed via:
- `gateway.php?action=tm-collect`
- `gateway.php?action=tm-import`
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

## Phase 2 — Importing to Posts

**URL:** `gateway.php?action=tm-import`

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
gateway.php?action=tm-import&limit=3

# Standard run
gateway.php?action=tm-import&limit=50

# Run again to continue if attractions remain
gateway.php?action=tm-import&limit=200
```

---

## Phase 3 — Refreshing Existing Posts

**URL:** `gateway.php?action=tm-refresh`

### Parameters

| Parameter | Default | Max | Description |
|---|---|---|---|
| `limit` | `200` | `500` | Max attractions to refresh per run |
| `max_api` | `2000` | `5000` | Hard API call ceiling for this run |

### How it works

1. Finds imported attractions with **active (non-expired) posts** — `posts.expires_at > NOW()`
2. Orders by **least-recently refreshed first** — `MIN(processed_at) ASC`
3. Re-fetches all events from the Ticketmaster API for each attraction
4. Updates `event_json` in staging with fresh data; inserts new events
5. Compares fresh values against existing post, map card, session, and pricing data
6. Updates any columns that differ
7. Updates `processed_at = NOW()` for the attraction's staging rows (pushes it to back of queue)
8. Stops when `limit` attractions processed OR `max_api` API calls reached

### Cycling behavior

The staleness-based ordering ensures every active post gets refreshed over time:
- With 2,000 active posts at 200/day → full cycle every 10 days
- With 30,000 active posts at ~1,500/day → full cycle every 20 days
- Expired posts are never refreshed (zero wasted API calls)

### What gets compared and updated

| Level | Columns compared |
|---|---|
| **Post** | `subcategory_key`, `loc_qty`, `loc_paid`, `expires_at` |
| **Map card** | `subcategory_key`, `title`, `description`, `venue_name`, `address_line`, `city`, `state`, `postcode`, `country_name`, `country_code`, `timezone`, `ticket_url`, `price_summary` |
| **Map card dates** | `start_date` and `end_date` recalculated from MIN/MAX of `post_sessions` after session insert |
| **Sessions** | Future sessions replaced per map card (past sessions preserved) |
| **Pricing** | Future pricing replaced per map card (past pricing preserved) |

### What is never changed

- Post IDs (URLs and external links preserved)
- Map card IDs (bookmarks/favorites preserved)
- Post images (no re-upload on refresh)
- `post_key` (URL slug stays the same)

### Map card matching

Existing map cards are matched to TM venues by coordinates (latitude/longitude rounded to 4 decimal places, ~11m precision). Unmatched venues get new map cards inserted.

### Examples

```
# Refresh 5 attractions (testing)
gateway.php?action=tm-refresh&limit=5

# Standard daily run
gateway.php?action=tm-refresh&limit=200&max_api=2000
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
3. **Import** — Runs `tm-import.php` in a loop (up to 10 rounds) until no pending rows remain
4. **Clear JSON** — NULLs `event_json` on imported/skipped rows to reclaim storage
5. **Refresh** — Runs `tm-refresh.php` with dynamic budget (whatever remains after collection, up to 3,000)

### API budget (5,000 calls/day)

| Phase | Budget | Notes |
|---|---|---|
| Collect | ~1,000 | 949 discovery pages + detail fetches for new attractions |
| Import | 0 | No API calls — reads from staging only |
| Refresh | up to 3,000 | Dynamic ceiling based on remaining budget after collection |
| **Reserve** | **1,000** | Spare for manual searches |

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

### Weekly cron — `cron-ticketmaster-weekly.php`

**No longer needed.** Refresh is now part of the daily cron. Remove this cron entry from cPanel.

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

Once approved, the Impact Publisher ID should be embedded into ticket URLs in `tm-import.php` for commission tracking on outbound ticket links. The site owner decides whether to wait for approval or proceed with imports beforehand.

The verification meta tag is already in `index.php`:
```html
<meta name="impact-site-verification" value="8b1854e8-4501-4440-8c23-bb7fda5cdeba">
```

---

## Files Modified — Session 3 (8 Apr 2026)

| File | Changes |
|---|---|
| `tm-import.php` | `groupDescription()` rewritten to extract venue details (box office, accessibility, parking, child rules) for single-venue posts |
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
| `tm-import.php` | Same cron orchestrator support. Changed `const` to `define()` with guards. Wrapped all 7 functions in `function_exists()` guards. Changed `die()` to `return` in cron mode. |
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

---

## Pending Changes

### Rename `tm-import.php` → `tm-collate.php`

The file is misnamed. `tm-collect.php` is the actual import (pulls external data from the TM API). `tm-import.php` just reads a local staging table and organizes it into posts — that's collation, not import. The name causes confusion.

**Files to update when renaming:**
- `tm-import.php` → rename file to `tm-collate.php`, update header comment
- `cron-ticketmaster-daily.php` — file path and comments
- `tm-collect.php` — comment referencing it
- `tm-refresh.php` — comment referencing it
- `gateway.php` — route key `'tm-import'` → `'tm-collate'`
- `Agent/ticketmaster-management.md` — all references
- `Agent/handover-2026-04-08.md` — all references

Do NOT rename while the cron is running.

### Reorder Cron Phases: API Calls First

Current order: collect → import → refresh. The import/collation phase takes ~1.5 hours (no API calls), which puts a gap between collect and refresh API calls. With TM's rolling 24-hour rate limit, this spreads API calls across a 2-hour window, causing an oscillation pattern: ~4,000 calls on day 1, ~1,000 on day 2, repeating.

**Fix:** collect → refresh → collate. All API calls land in a tight ~30-minute window. 24 hours later they've all expired. Full budget every day.

### Dynamic API Budget Based on Seeding Status

Current budget is static: 1,000 collect / 3,000 refresh / 1,000 reserve. During seeding, refresh has almost nothing to do (posts were just created), wasting most of its 3,000 budget.

**Fix:** Read the `seeded` flag from the cursor row in `tm_staging`:
- **Seeding (`seeded: 0`):** 3,000 collect / 1,000 refresh / 1,000 reserve
- **Maintenance (`seeded: 1`):** 1,000 collect / 3,000 refresh / 1,000 reserve

### Collection: Page 0 Only After Seeding

During seeding, collection paginates through all pages for each category/country slot. After seeding completes, it should only fetch page 0 per slot to catch newly listed events.

### Rewrite Refresh: Batch API Calls and Remove Caps

**Current problem:** Refresh makes one API call per attraction regardless of size. A single-session act at one venue costs the same as a 500-session tour. This is extremely wasteful.

**Fix — batch calls:**
- TM's API accepts comma-separated attraction IDs: `attractionId=id1,id2,id3`
- Group multiple attractions into one call, up to the 200-event page limit
- Sort results back out by attraction ID after the response

**Fix — load all attractions, no cap:**
- Remove the `LIMIT 200` on the attraction query
- Load ALL active attractions, ordered by least-recently refreshed (oldest first, picking up where yesterday stopped)
- Work through the entire list until the budget runs out
- Tomorrow picks up where today stopped

**Fix — never leave an attraction half-refreshed:**
- The budget check happens BETWEEN attractions, never mid-attraction
- If an attraction needs multiple pages to paginate, finish it even if the budget is exceeded
- Every attraction is either fully refreshed or not touched at all — no partial updates
- This prevents misinformation and gives a clean checkpoint for the next run

### Log Real API Budget From TM Response Headers

TM returns rate limit headers (`Rate-Limit-Available`, etc.) on every API response. The code should read this header and log the real remaining budget — at minimum at the end of each API phase, ideally from the very first call at the start of the run. This replaces guessing based on local call counts and gives an accurate picture of what's actually available, accounting for any other calls made within the rolling 24-hour window.

### Fix Total API Call Counter

The final log line "Total API calls: 1001" only counts collection calls. Refresh calls (200 in the first run) are not included. The total must sum all API-consuming phases (collect + refresh) so the log accurately reflects actual budget usage.

### Research TM's 24-Hour Rate Limit Window

Need to determine how Ticketmaster defines their 24-hour rate limit period — is it a rolling window from first call, or a calendar day reset? This affects cron scheduling. If rolling, all API calls must land in a tight window to avoid oscillation between runs.

### Delete `cron-ticketmaster-weekly.php`

Already deleted from the repo. Ensure the cPanel cron entry is also removed (user confirms this was done already).
