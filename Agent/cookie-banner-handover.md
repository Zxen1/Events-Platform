# Cookie Banner — Handover Document

## What Was Decided

The site needs a **cookie consent banner** before launch. EU law (GDPR/ePrivacy) requires informed consent before setting non-essential cookies.

## Cookie Audit (Verified in Incognito)

**On fresh page load (no login), funmap.com sets exactly 2 cookies:**

| Cookie | Purpose | Essential? |
|--------|---------|------------|
| `_ga` | Google Analytics tracking | No — needs consent |
| `_ga_K1FG6B44LF` | Google Analytics 4 property | No — needs consent |

**After login, 2 additional cookies appear:**

| Cookie | Purpose | Essential? |
|--------|---------|------------|
| `FUNMAP_TOKEN` | Authentication token | Yes — no consent needed |
| `session` | Session management | Yes — no consent needed |

Previously visible cookies (`_mkto_trk`, `ajs_anonymous_id`, `ajs_user_id`, `_gcl_au`) were confirmed as stale browser leftovers — they do not appear in a clean incognito session and are NOT set by funmap.com.

## What Needs Building

### 1. Cookie Banner (approved to build)
- Small fixed bar at the bottom of the viewport (not a modal, not blocking)
- Generic message like "This site uses cookies for analytics and site improvement"
- Two buttons: **Accept** and **Decline**
- Links to the privacy policy page
- User choice stored in **localStorage** (not a cookie)
- If accepted: GA loads immediately on this and future visits
- If declined: GA never loads
- If already chosen: banner never appears
- Site is fully usable behind the banner — no blocking, no backdrop

**Files to touch:**
- `index.php` — replace current GA script block (lines 222-229) with consent-aware version, add banner HTML
- `base.css` — banner styles (following welcome modal pattern)
- `themes.css` — light mode overrides for the banner

**Current GA code to replace (`index.php` lines 222-229):**
```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-K1FG6B44LF"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-K1FG6B44LF');
</script>
```

**Design principles:**
- Raw HTML + inline logic in `index.php` (same pattern as welcome modal)
- CSS in `base.css` (same pattern as welcome modal)
- No component file, no fetch, no JS module — zero additional requests
- No database changes needed
- Future-proof: any new non-essential scripts go behind the same consent check

### 2. Privacy Policy Page (not yet built)
- Required by law — the cookie banner must link to it
- Standalone HTML page
- Must explain: what data is collected, why, how long it's kept, who it's shared with, how users can request deletion
- Must list all cookies by name with purpose and duration
- Can be written from a template or by a lawyer
- **The banner is pointless without this page**

### 3. Cookie Policy (can be a section within the privacy policy)
- Lists each cookie: `_ga`, `_ga_K1FG6B44LF`, `FUNMAP_TOKEN`, `session`
- States which are essential vs optional
- States duration and purpose of each

### 4. Terms of Service (not cookie-related but required before launch)
- Governs platform usage, liability, content ownership
- Separate from privacy policy

## Cursor Rules Updated

Two references to the deleted `base-new.css` were corrected to `base.css`:
- Z-index registry rule (line 164)
- Button class naming rule (line 193)

The obsolete "THE NEW SITE" section and its `-new` file targeting rule were removed. Heading renamed to "THE SITE".

## Ticketmaster Import Status

A manual import run was active during this session. Key stats at time of handover:
- **Cursor position:** 168 of 949, pass 0 of 5 (SEEDING)
- **API calls used today:** 1,021 of 5,000
- **Import rounds completed:** 9 of 10 (round 10 was running)
- **Posts created this run:** ~1,970 (post #2327 through ~#4098)
- **Events still pending after round 10:** ~8,500
- **Total site listings:** ~11,836
- **Started at:** ~3,500 listings this morning

The 3am AEST daily cron is set with `nohup` to bypass VentraIP's 180-second limit:
```
nohup /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php > /dev/null 2>&1 &
```

Tomorrow's cron will import the remaining ~8,500 pending events and collect the next batch from position 168 onward. Full seeding is estimated at ~8 weeks.

## Email Cron

Checked `cron-emails.php` — it uses narrow date-window queries, not bulk loops. Even with 100,000 members it will finish in under a minute. No `nohup` needed.
