# VENUE SEEDING PLAN

**Website:** FunMap.com  
**Purpose:** Seed the database with ~4000 famous venue posts from 200 cities worldwide

---

## PRE-FLIGHT CHECKLIST

Before running ANY seeding operation:

- [ ] **Database/tables are utf8mb4** - See Lesson 1 below for SQL
- [ ] **No duplicates in venue list** - See Lesson 2 below for script
- [ ] **Starting IDs verified** - `SELECT MAX(id)+1 FROM posts, post_media, post_map_cards;`
- [ ] **ZIM file accessible** - 111GB file at expected path
- [ ] **Disk space available** - Need ~15-20GB for images
- [ ] **Google API key valid** - Test with one Places API call

---

## WORKFLOW

1. **Phase 1: Images** (Free) - Download 2-3 images per venue from Wikimedia Commons
2. **Phase 2: Description + Google** - Check description (free), then Google Places API (paid)
3. **Phase 4: SQL Generation** - Create INSERT statements
4. **Phase 5: Manual Upload** - User uploads images to Bunny CDN, imports SQL

**Key rule:** Images first, then description check (free), then Google API (paid). Don't waste API calls on venues without images.

---

## FILES

| File | Purpose |
|------|---------|
| `curated-venues.json` | Master list - 200 cities × 20 venues |
| `curated-venues-run1.json` | Run 1 list with varied counts |
| `generate-run1-venues.py` | Creates run1 list from master |
| `wikipedia_en_all_maxi_2025-08.zim` | 111GB Wikipedia dump |

Output goes to `seeder-output/` folder.

---

## DATABASE TABLES

### posts
- `member_name` - Set via UPDATE JOIN after insert (see Lesson 5)

### post_map_cards
- `venue_name` - REQUIRED for map labels (from Google Places)
- `address_line` - REQUIRED (from Google Places)
- `latitude/longitude` - REQUIRED (from Google Places)

---

## LESSONS LEARNED (Run 1)

### 1. Unicode Corruption
**Problem:** International characters became `????????`  
**Fix:** Convert database BEFORE import:
```sql
ALTER DATABASE funmapco_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE post_media CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE post_map_cards CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Duplicate Venues
**Problem:** Same venue appeared twice  
**Fix:** Check before running:
```python
seen = set()
for city in data['cities']:
    for venue in city['venues']:
        if venue['title'] in seen:
            print(f"DUPLICATE: {venue['title']}")
        seen.add(venue['title'])
```

### 3. Python Encoding on Windows
**Problem:** Console errors, wrong characters  
**Fix:** Use `encoding='utf-8'` for file operations, `sys.stdout.reconfigure(encoding='utf-8')` for console

### 4. Member Names Showed "Anonymous"
**Problem:** `member_name` was NULL  
**Fix:** After INSERT:
```sql
UPDATE posts p JOIN members m ON p.member_id = m.id 
SET p.member_name = m.username WHERE p.id >= 21;
```

### 5. Map Labels Missing
**Problem:** Pins showed no venue label  
**Fix:** `venue_name` and `address_line` MUST come from Google Places API - no fallbacks

---

## CONTACT

If questions arise, refer to this document and conversation history.
