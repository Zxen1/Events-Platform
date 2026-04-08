# Ticketmaster Management

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

### How it works

1. **Phase 1 — Discovery:** Scans `pages` × `size` events to find attraction IDs.
2. **Phase 2 — Targeted fetch:** For each new attraction, queries ALL its events across ALL venues (so multi-city tours are complete). Already-collected attractions are skipped automatically.

### API pagination limit (CRITICAL)

The Ticketmaster Discovery API caps deep pagination at approximately **page 5** (~1,200 events). Requesting page 6+ returns HTTP 400. This means a single query for a country can never discover more than ~200-300 attractions.

**Current workaround:** The cron scans page 0 plus a rotating window of deeper pages. This provides some variety but cannot reach beyond page 5.

**TODO — Segment-based slicing:** To reach more attractions, the collector needs to make separate queries per segment (Music, Sports, Arts & Theatre). Each segment gets its own 5-page window, tripling discovery reach. This has NOT been implemented yet.

### Exclusions

- **Segment "Miscellaneous"** is excluded (venue admissions: Sea Life, London Eye, Madame Tussauds, etc.). These are daily entry tickets, not events.
- **Events with no attraction ID** are ignored (cannot be grouped into posts).

### Examples

```
# Small test — 3 pages, up to 10 attractions
gateway.php?action=tm-collect&country=GB&limit=10

# Standard run — 100 attractions
gateway.php?action=tm-collect&country=GB&limit=100

# Large run — 500 attractions, 5 pages (max useful depth)
gateway.php?action=tm-collect&country=GB&limit=500&pages=5

# US events
gateway.php?action=tm-collect&country=US&limit=100
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
| **Map card** | `subcategory_key`, `title`, `description`, `venue_name`, `address_line`, `city`, `state`, `postcode`, `country_name`, `country_code`, `timezone`, `ticket_url`, `session_summary`, `price_summary` |
| **Sessions** | Fully replaced per map card (delete + re-insert) |
| **Pricing** | Fully replaced per map card (delete + re-insert) |

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

1. **Cleanup** — Purges staging rows for posts that expired 6+ months ago (prevents infinite table growth)
2. **Collect** — Runs `tm-collect.php` for all countries (page 0 + rotating deep pages per country)
3. **Import** — Runs `tm-import.php` in a loop (up to 10 rounds) until no pending rows remain
4. **Refresh** — Runs `tm-refresh.php` with `limit=200&max_api=2000`

### API budget (5,000 calls/day)

| Phase | Estimated daily calls | Notes |
|---|---|---|
| Collect (all countries) | ~2,000-2,800 | Drops after initial seeding as most attractions are already staged |
| Import | 0 | No API calls — reads from staging only |
| Refresh | up to 2,000 | Hard ceiling via `max_api` parameter |
| **Total** | **~4,800 max** | 200-call buffer for safety |

### Countries collected (58 total)

| Tier | Countries | Limit per country | Pages |
|---|---|---|---|
| Large | GB, US | 200 | 5 |
| Medium | CA, AU, DE, FR, ES, IT, MX, NL | 100 | 3 |
| Small | IE, NZ, SE, DK, NO, FI, PL, AT, CH, CZ, TR, BE, BR, ZA, AE, JP, KR, IN | 50 | 2 |
| Tiny | HK, MY, IL, AR, CL, PE, GR, HU, BG, IS, EE, LV, LT, LU, MT, AD, GI, FO, BH, GE, AZ, GH, DO, EC, JM, BB, BM, BS, AI, LB | 20 | 1 |

### Page rotation (partially broken)

The cron scans page 0 every day (catches imminent events) plus a window of deeper pages that advances daily. **However**, the TM API returns HTTP 400 for pages beyond ~5, so the rotation only provides variety within those first 5 pages. Segment-based slicing is needed to reach deeper into the catalogue (see TODO below).

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
The Discovery API returns HTTP 400 for pages beyond ~5. A single country query can only discover ~200-300 attractions. Segment-based slicing (separate queries for Music, Sports, Arts & Theatre) would triple this but has not been implemented yet.

### Description quality
The TM Discovery API has no dedicated "description" field. The importer uses `info` and `pleaseNote` fields plus venue-level data (box office, accessibility, parking, child rules). For single-venue posts this produces rich descriptions. For multi-venue or events without venue data, descriptions are thin.

### Pricing data is sparse
Most events in the TM Discovery API have no `priceRanges` data. Major shows (Phantom, Wicked, Lion King) often return no pricing. Events without pricing are imported normally — the pricing section is empty on the frontend.

---

## TODO — Outstanding Work

### Segment-based slicing (HIGH PRIORITY)
Replace the page rotation system in `cron-ticketmaster-daily.php` with segment-based slicing. Instead of scanning pages 0-4 of "all events", scan pages 0-4 for each segment separately (Music, Sports, Arts & Theatre). This triples discovery reach from ~300 to ~900 attractions per country.

### Remove weekly cron from cPanel
`cron-ticketmaster-weekly.php` is no longer needed. Refresh runs daily as part of the daily cron. Remove the Sunday midnight cron entry.

---

## Affiliate Program

The site owner has applied for the Ticketmaster affiliate program via **Impact** (their tracking/payment partner). Status: under review (applied 8 Apr 2026, estimated 10-day review).

Once approved, the Impact Publisher ID should be embedded into ticket URLs in `tm-import.php` for commission tracking on outbound ticket links. The site owner decides whether to wait for approval or proceed with imports beforehand.

The verification meta tag is already in `index.php`:
```html
<meta name="impact-site-verification" value="8b1854e8-4501-4440-8c23-bb7fda5cdeba">
```

---

## Files Modified This Session

| File | Changes |
|---|---|
| `tm-import.php` | `groupDescription()` rewritten to extract venue details (box office, accessibility, parking, child rules) for single-venue posts |
| `tm-refresh.php` | Same `groupDescription()` rewrite. Query fixed: filters expired posts, orders by staleness (`processed_at ASC`), updates `processed_at` after each attraction. Added `max_api` budget ceiling. |
| `cron-ticketmaster-daily.php` | Added all 58 TM countries. Added page rotation (page 0 + rotating deeper pages). Split limits between invocations to stay within API budget. Added import loop (up to 10 rounds). Added refresh as Phase 3. Added cleanup step for expired staging rows. |
| `post.css` | `margin-bottom: 20px` added to `.post-description-text`; `margin-top` removed from `.post-description-member` |
