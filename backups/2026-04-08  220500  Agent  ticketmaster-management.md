# Ticketmaster Management

## Overview

Three connector scripts form the pipeline:

| Script | Location | Purpose | Frequency |
|---|---|---|---|
| `tm-collect.php` | `connectors/` | Fetches events from Ticketmaster API → stores raw JSON in `tm_staging` | Daily |
| `tm-import.php` | `connectors/` | Reads `tm_staging` → creates FunMap posts, map cards, sessions, pricing | Daily |
| `tm-refresh.php` | `connectors/` | Re-fetches data for already-imported attractions → updates existing posts in place | Weekly |

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

### Exclusions

- **Segment "Miscellaneous"** is excluded (venue admissions: Sea Life, London Eye, Madame Tussauds, etc.). These are daily entry tickets, not events.
- **Events with no attraction ID** are ignored (cannot be grouped into posts).

### Examples

```
# Small test — 3 pages, up to 10 attractions
gateway.php?action=tm-collect&country=GB&limit=10

# Standard run — 100 attractions
gateway.php?action=tm-collect&country=GB&limit=100

# Large run — 500 attractions, 10 pages
gateway.php?action=tm-collect&country=GB&limit=500&pages=10

# US events
gateway.php?action=tm-collect&country=US&limit=100

# Resume from page 10
gateway.php?action=tm-collect&country=GB&pages=5&start_page=10
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
| `limit` | `50` | `200` | Max attractions to refresh per run |

### How it works

1. Finds imported attractions (those with a `post_id` in `tm_staging`)
2. Re-fetches all events from the Ticketmaster API for each attraction
3. Updates `event_json` in staging with fresh data; inserts new events
4. Compares fresh values against existing post, map card, session, and pricing data
5. Updates any columns that differ

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
# Refresh all imported attractions (up to 50)
gateway.php?action=tm-refresh&limit=50

# Large refresh
gateway.php?action=tm-refresh&limit=200
```

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

## Daily Cron Job (Recommended Setup)

Run collect and import daily. Run refresh weekly. Suggested sequence:

**Daily (3am):**
1. Collect new events for each target country
2. Import pending events

**Weekly (Sunday 3am):**
3. Refresh existing posts

Ask your host to set up PHP CLI cron jobs pointing to the gateway URLs. Suggested schedule: **3am** (low traffic, API quota resets at midnight UTC).

Target countries to rotate through daily: GB, US, AU, CA, IE, NZ

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

All imported posts are assigned to member ID **213** (Ticketmaster). The description of every post ends with "Powered by Ticketmaster" as required by Ticketmaster's API terms.

---

## Known Limitations

### Description quality
The TM Discovery API has no dedicated "description" field. The importer uses `info` and `pleaseNote` fields, which venues fill with whatever they want — sometimes show details, sometimes bag policies or age restrictions. There is no reliable way to filter these automatically.

### Pricing data is sparse
Most events in the TM Discovery API have no `priceRanges` data. Major shows (Phantom, Wicked, Lion King) often return no pricing. Events without pricing are imported normally — the pricing section is empty on the frontend.

---

## Affiliate Program

The site owner has applied for the Ticketmaster affiliate program via **Impact** (their tracking/payment partner). Status: under review (applied 8 Apr 2026, estimated 10-day review).

Once approved, the Impact Publisher ID should be embedded into ticket URLs in `tm-import.php` for commission tracking on outbound ticket links. The site owner decides whether to wait for approval or proceed with imports beforehand.

The verification meta tag is already in `index.php`:
```html
<meta name="impact-site-verification" value="8b1854e8-4501-4440-8c23-bb7fda5cdeba">
```
