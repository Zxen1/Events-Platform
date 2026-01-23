# VENUE SEEDING PLAN

**Website:** FunMap.com  
**Created:** 2026-01-23  
**Purpose:** Seed the database with ~4000 famous venue posts from 200 cities worldwide

---

## GOAL

Migrate/seed the new FunMap.com website with approximately 4000 venue posts (20 venues per 200 cities). Each post includes:
- Title (venue name)
- Description (from Wikipedia, 3+ paragraphs)
- 2-3 high-quality images (from Wikimedia Commons)
- Coordinates (from Google Places API - must match what users get from site autocomplete)
- Venue name and address (from Google Places API)
- Photo credits with licenses

---

## DATA SOURCES

| Data | Source | Cost |
|------|--------|------|
| Article content & images | Local ZIM file (Wikipedia dump) | Free |
| Full-resolution images | Wikimedia Commons API | Free |
| Coordinates, venue_name, address | Google Places API | ~$0.017/request (~$68 total) |

---

## FILES

### Venue Lists
- `Agent/curated-venues.json` - **MASTER LIST** - 200 cities with 20 venues each (4000 total). DO NOT MODIFY.
- `Agent/curated-venues-run1.json` - **RUN 1 LIST** - Reduced list with varied venue counts (~2800-3200 venues)
- `Agent/generate-run1-venues.py` - Script to generate run1 list from master

### Venue Distribution (Run 1)
| Tier | Cities | Venues per City |
|------|--------|-----------------|
| Tier 1 | Sydney, London, NYC, Tokyo, etc. | 18-20 |
| Tier 2 | Brisbane, Auckland, Barcelona, etc. | 14-17 |
| Tier 3 | Perth, Wellington, Nice, etc. | 11-14 |
| Tier 4 | Smaller cities | 8-11 |

**Why varied?** Having 20 everywhere looks artificial/seeded. Varied counts look organic.

**Future additions:** More venues can be added later from the master list to increase counts in specific cities.

### Other Input Files
- `Agent/wikipedia_en_all_maxi_2025-08.zim` - 111GB Wikipedia dump (local)

### Output Files
- `Agent/seeder-output/images/` - Downloaded images (named: `{8-digit-post-id}-{filename}.{ext}`)
- `Agent/seeder-output/phase1-results.json` - Venues with images
- `Agent/seeder-output/phase2-results.json` - Venues with Google Places data
- `Agent/seeder-output/phase3-results.json` - Venues with verified descriptions
- `Agent/seeder-output/venue-inserts.sql` - Final SQL for import

### Checkpoint Files (saved every 100 venues)
- `Agent/seeder-output/phase1-checkpoint-{N}.json`
- `Agent/seeder-output/phase2-checkpoint-{N}.json`
- `Agent/seeder-output/phase3-checkpoint-{N}.json`

---

## PRE-FLIGHT CHECKLIST

Before running ANY seeding operation:

- [ ] **Database charset is utf8mb4** - Run: `SHOW CREATE DATABASE funmapco_db;`
- [ ] **Tables are utf8mb4** - Run: `SHOW CREATE TABLE post_map_cards;`
- [ ] **config-db.php has charset line** - Must contain: `$mysqli->set_charset('utf8mb4');`
- [ ] **No duplicates in venue list** - Run duplicate check script
- [ ] **Starting IDs verified** - Check posts, post_media, post_map_cards for MAX(id)+1
- [ ] **ZIM file accessible** - Verify 111GB file exists at expected path
- [ ] **Disk space available** - Need ~15-20GB for images
- [ ] **Google API key valid** - Test with one Places API call

## BEFORE RUNNING: Generate Run 1 List

```
cd Agent
python generate-run1-venues.py
```

This creates `curated-venues-run1.json` with varied venue counts from the master list.

---

## PHASED APPROACH

### PHASE 1: Image Collection (Free)
**For each venue:**
1. Find article in ZIM file
2. Extract image filenames from HTML
3. Check each image on Wikimedia Commons API (min 1000x1000px, max 10MB)
4. Download 2-3 qualifying images
5. Name as: `{8-digit-post-id}-{original-filename}.{ext}`
6. If NO images downloaded → venue FAILS (skip to next)

**Rate limits:**
- 0.8 seconds between Wikimedia API calls
- 5 seconds between image downloads

**Checkpoint:** Save progress every 100 venues

### PHASE 2: Description Check + Google Places
**Only for venues that PASSED Phase 1:**
1. **FIRST:** Check description in ZIM (FREE)
   - Extract lead section from Wikipedia HTML
   - Clean text: remove HTML, citations, pronunciation guides
   - Verify minimum 300 characters
   - If description too short → venue FAILS (no Google call)
2. **THEN:** Query Google Places API (PAID - only if description valid)
   - Get: venue_name, address_line, latitude, longitude
   - If Google returns no results → venue FAILS
3. Add photo credits to description

**Cost:** Only pay for venues with valid descriptions

**Checkpoint:** Save progress every 100 venues

### PHASE 3: Skipped
Phase 2 now includes description verification. Phase 3 just copies results.

### PHASE 4: SQL Generation
**Only for venues that PASSED all phases:**
- Generate INSERT statements for: posts, post_media, post_map_cards
- Include UPDATE to set member_name from members table
- Output single SQL file for import

### PHASE 5: Manual User Actions
1. Review results JSON - see successes and failures
2. Upload ONLY successful venue images to Bunny CDN (`post-images/2026-01/`)
3. Import SQL via phpMyAdmin

---

## DATABASE STRUCTURE

### posts table
| Column | Value |
|--------|-------|
| id | Starting from 21 |
| post_key | `{id}-{slugified-title}` |
| member_id | Cycles through 2-100 (99 members) |
| member_name | Set via UPDATE JOIN with members table |
| subcategory_key | From curated-venues.json |
| visibility | 'active' |
| moderation_status | 'clean' |
| checkout_key | 'premium-listing' |
| payment_status | 'paid' |
| expires_at | '2046-01-01' (20 years) |

### post_media table
| Column | Value |
|--------|-------|
| id | Starting from 56 |
| member_id | Same as post |
| post_id | Reference to post |
| file_name | `{8-digit-post-id}-{filename}.{ext}` |
| file_url | `https://cdn.funmap.com/post-images/2026-01/{file_name}` |
| settings_json | `{"file_name": "display name", "file_type": "image/jpeg", ...}` |

### post_map_cards table
| Column | Value |
|--------|-------|
| id | Starting from 24 |
| post_id | Reference to post |
| title | Venue title |
| description | Wikipedia content + photo credits |
| media_ids | Comma-separated post_media IDs (e.g., "56,57,58") |
| venue_name | From Google Places (REQUIRED for map labels) |
| address_line | From Google Places (REQUIRED) |
| latitude | From Google Places (REQUIRED - must match site autocomplete) |
| longitude | From Google Places (REQUIRED) |
| country_code | 2-letter code (AU, US, GB, etc.) |
| city | City name |
| website_url | From Wikipedia (optional) |

---

## CRITICAL RULES

1. **Images FIRST** - Don't call Google Places until images confirmed (saves $68 if Wikimedia fails)
2. **No fallbacks** - If Google fails, venue fails. No Wikipedia coordinate backup.
3. **No automated Bunny uploads** - User uploads manually
4. **No automated deletions** - Never delete from Bunny
5. **Checkpoints every 100 venues** - Resume from last checkpoint if interrupted
6. **venue_name and address_line are REQUIRED** - Without these, map labels don't show

---

## STARTING IDs (verify before running)

```sql
SELECT MAX(id)+1 FROM posts;          -- Expected: 21
SELECT MAX(id)+1 FROM post_map_cards; -- Expected: 24  
SELECT MAX(id)+1 FROM post_media;     -- Expected: 56
```

---

## TEST POSTS ALREADY CREATED

Posts 16-20 (Sydney venues) were created during testing:
- 16: Sydney Opera House
- 17: Sydney Harbour Bridge
- 18: Bondi Beach
- 19: Taronga Zoo
- 20: Royal Botanic Garden, Sydney

These used manual SQL fixes to add venue_name, address_line, media_ids, and correct coordinates.

---

## ESTIMATED RUNTIME (Run 1: ~3000 venues)

- ~9,000 images at 5s delay = ~12.5 hours for Phase 1
- ~3,000 Google calls (~$51) = ~45 min for Phase 2
- Description processing = ~45 min for Phase 3
- **Total: ~14-15 hours (run overnight)**

Note: Actual venue count depends on random selection in generate-run1-venues.py

---

## IF INTERRUPTED

1. Check latest checkpoint file in `Agent/seeder-output/`
2. Note which phase and which venue number
3. Resume script from that checkpoint
4. All previously downloaded images remain in the images folder

---

## LESSONS LEARNED (Run 1 - January 2026)

### Problem 1: Unicode Corruption (Question Marks)
**Symptom:** Chinese, Japanese, Korean, Arabic, Hebrew characters became `????????`  
**Cause:** Database/tables were not set to utf8mb4 charset  
**Fix:** BEFORE any import, run:
```sql
ALTER DATABASE funmapco_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE post_media CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE post_map_cards CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Problem 2: Duplicate Venues
**Symptom:** Same venue appeared twice with different post IDs  
**Cause:** Curated venue list had duplicates (same venue in multiple cities or listed twice)  
**Fix:** Before running, check for duplicates:
```python
seen = set()
for city in data['cities']:
    for venue in city['venues']:
        if venue['title'] in seen:
            print(f"DUPLICATE: {venue['title']}")
        seen.add(venue['title'])
```

### Problem 3: Python Encoding on Windows
**Symptom:** Console showed errors, files had wrong characters  
**Cause:** Windows console uses cp1252, not UTF-8  
**Fix:** In Python scripts:
```python
# For file writes
with open(file, 'w', encoding='utf-8') as f:
# For stdout
import sys
sys.stdout.reconfigure(encoding='utf-8')
```

### Problem 4: Images Downloaded But Descriptions Failed
**Symptom:** Wasted disk space on images for venues that later failed  
**Cause:** Original order was: Images → Google API → Description check  
**Fix:** New order: Images → Description check (FREE) → Google API (PAID)

### Problem 5: Member Names Showed "Anonymous"
**Symptom:** Posts showed "Posted by anonymous" instead of member names  
**Cause:** `member_name` column in posts table was NULL  
**Fix:** After INSERT, run:
```sql
UPDATE posts p JOIN members m ON p.member_id = m.id 
SET p.member_name = m.username WHERE p.id >= 21;
```

### Problem 6: Map Labels Missing
**Symptom:** Clustered pins showed "X posts here" but no venue label underneath  
**Cause:** `venue_name` and `address_line` were NULL in post_map_cards  
**Fix:** These fields MUST come from Google Places API - no fallbacks

---

## CONTACT

If questions arise about this process, refer to this document and the conversation history.
