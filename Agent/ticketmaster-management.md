# Ticketmaster Management

## Overview

Two connector scripts form a two-phase pipeline:

| Script | Location | Purpose |
|---|---|---|
| `tm-collect.php` | `connectors/` | Fetches events from Ticketmaster API → stores raw JSON in `tm_staging` |
| `tm-import.php` | `connectors/` | Reads `tm_staging` → creates FunMap posts, map cards, sessions, pricing |

The staging table acts as a safe buffer. Nothing appears on the site until `tm-import.php` is run.

---

## Prerequisites

- `tm_staging` table exists in the database ✓
- `$TICKETMASTER_CONSUMER_KEY` is set in `config-app.php` ✓
- Ticketmaster member account exists (ID 213, username: Ticketmaster) ✓
- Bunny CDN credentials are in `admin_settings` (`storage_api_key`, `storage_zone_name`, `folder_post_images`) ✓

---

## Phase 1 — Collecting Events

**URL:** `connectors/tm-collect.php`

### Parameters

| Parameter | Default | Max | Description |
|---|---|---|---|
| `country` | `GB` | — | ISO country code (GB, US, AU, CA, IE, etc.) |
| `pages` | `3` | `25` | Number of discovery pages to scan |
| `start_page` | `0` | — | Discovery page offset (for resuming) |
| `size` | `200` | `200` | Events per discovery page |

### How it works

1. **Phase 1 — Discovery:** Scans `pages` × `size` events to find attraction IDs.
2. **Phase 2 — Targeted fetch:** For each new attraction, queries ALL its events across ALL venues (so multi-city tours are complete). Already-collected attractions are skipped automatically.
3. Events with no attraction ID are stored directly from the discovery page.

### Examples

```
# Small test — 1 page of GB events
tm-collect.php?country=GB&pages=1

# Full GB collection — 5 pages
tm-collect.php?country=GB&pages=5

# US events
tm-collect.php?country=US&pages=3

# Resume from page 10
tm-collect.php?country=GB&pages=5&start_page=10
```

### API limits

Free tier: **5,000 calls/day**. The script pauses 250ms between calls (~4/sec). Each run uses approximately `pages + (new attractions found)` API calls. Monitor usage via the Ticketmaster developer portal.

---

## Phase 2 — Importing to Posts

**URL:** `connectors/tm-import.php`

### Parameters

| Parameter | Default | Max | Description |
|---|---|---|---|
| `limit` | `2000` | `5000` | Max staging rows to process per run |

### How it works

- Groups staged events by **attraction** (one FunMap post per touring act)
- Sub-groups by **venue** (one map card per venue/city)
- Each map card gets its own sessions and pricing
- Downloads the best image (≥1000px wide) and uploads it to Bunny CDN
- Marks all processed rows as `imported` or `skipped`
- Phase 2 of `tm-collect.php` paginates per-attraction fetches (200 events per page, loops until all pages fetched)

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
| No price data at all | `no price data` |
| Already imported | `already imported` |

### Examples

```
# Test run — 100 events (2–10 posts depending on session count)
tm-import.php?limit=100

# Full run
tm-import.php?limit=2000

# Run again to continue if events remain
tm-import.php?limit=2000
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

`tm_staging` is a **permanent deduplication log**, not a temporary buffer. Imported rows must remain in the table with `status = 'imported'` indefinitely. They are the only record the system has of what has already been collected and imported.

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

Run both scripts daily to keep events fresh. Suggested sequence:

1. Collect new events for each target country
2. Import pending events

Ask your host to set up PHP CLI cron jobs pointing to the connector files. Suggested schedule: **3am daily** (low traffic, API quota resets at midnight UTC).

Target countries to rotate through daily: GB, US, AU, CA, IE, NZ

---

## Subcategory Mapping

| Ticketmaster Segment | FunMap Subcategory |
|---|---|
| Music | `live-music` |
| Sports | `live-sport` |
| Arts & Theatre | `performing-arts` |
| Film | `cinema` |
| Miscellaneous | `other-events` |
| Genre = Festival / Festivals | `festivals` |

---

## Attribution

All imported posts are assigned to member ID **213** (Ticketmaster). The description of every post ends with "Powered by Ticketmaster" as required by Ticketmaster's API terms.

---

## Affiliate Program

The site owner has applied for the Ticketmaster affiliate program via **Impact** (their tracking/payment partner). Status: under review (applied 8 Apr 2026, estimated 10-day review).

Once approved, the Impact Publisher ID must be embedded into ticket URLs in `tm-import.php` before running the cron. This ensures commission tracking on all outbound ticket links from day one. Do NOT run bulk imports until the affiliate ID is integrated.

The verification meta tag is already in `index.php`:
```html
<meta name="impact-site-verification" value="8b1854e8-4501-4440-8c23-bb7fda5cdeba">
```
