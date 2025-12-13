# REBUILD STATUS - FULL HANDOVER

**Last Updated:** December 13, 2025
**Current Phase:** Building reusable dropdown menu component

---

## CRITICAL: READ THESE FIRST

1. **`AI_AGENT_CONFESSIONS_AND_RULES.md`** - Contains 16 confessions of past AI failures, all project rules, and the CSS class naming system
2. **This file** - Current status and next steps

---

## WHAT IS THIS PROJECT?

**funmap.com** - A CMS platform for map-based event discovery.

- 7 visible sections: Header, Filter, Map, Post, Admin, Member, Advert
- Current codebase: 29,636 lines of spaghetti `index.js` + 9 CSS files
- Goal: Clean rewrite with modular 9 JS files + 9 CSS files
- Reference site: **old.funmap.com** (frozen backup for comparison)

---

## DO NOT REBUILD LIST

These complex components work perfectly. Extract and preserve them:
- Calendars (3 different ones, months of work)
- Currency menu
- Phone prefix menu  
- Icon picker
- System image picker
- Category filter
- Checkout options interface
- Fieldsets (admin, form, user views)
- Formpicker
- Messages system

**Exception:** Formbuilder WILL be rebuilt.

---

## CURRENT TASK: Reusable Dropdown Menu

### 9 Classes (same for all dropdown menus, only data differs)

| Class | Purpose |
|-------|---------|
| `.menu` | Wrapper |
| `.menu-button` | Trigger button |
| `.menu-button-image` | Image inside button |
| `.menu-button-text` | Text inside button |
| `.menu-button-arrow` | Dropdown arrow |
| `.menu-options` | Dropdown container |
| `.menu-option` | Each selectable item |
| `.menu-option-image` | Image inside option |
| `.menu-option-text` | Text inside option |

---

## FILE STRUCTURE

### Current Files (spaghetti - to be replaced)
- `index.js` - 29,636 lines, contains everything
- 9 CSS files - already separated but with messy global styles

### New Files (placeholders created)
- `*-new.js` and `*-new.css` for all 9 sections
- `index-new.html` - new skeleton

### Backup
- `Events-Platform-main (20) STABLE LAST BACKUP BEFORE REBUILD/` - Complete working backup

---

## REFERENCE SITE

✅ **old.funmap.com** - Frozen backup for comparison
- Same database as main site
- Contains working spaghetti code
- Do NOT modify

---

## CLASS NAMING CONVENTION

```
.{section}-{container}-{type}-{part}-{subpart}--{state}
```

**Key rules:**
- Section matches CSS filename (admin-, filter-, header-, etc.)
- Container names are single words (systemimagepicker, categoryfilter)
- Only parts can have subparts
- States use double-dash prefix (--active, --disabled)
- `image` and `text` are universal part names (not icon/avatar/label/title)

See `AI_AGENT_CONFESSIONS_AND_RULES.md` for full documentation.

---

## CONTAINER NAMES (Finalized)

### Header ✅
bar, logo, filter, modeswitch, access

### Filter ✅
panel, mapcontrol, resetfilters, resetcategories, sortby, keywords, pricerange, daterange, expiredevents, categoryfilter

### Map ✅
area, mapcontrol, shadow, zoomindicator, smallcard, bigcard, hovercard, cluster, multipost

### Post, Admin, Member, Forms, Advert
- TBD

---

## BUILD ORDER

0. [x] Reference site (old.funmap.com)
1. [x] Container names (Header, Filter, Map done)
2. [ ] **CURRENT: Reusable dropdown menu component**
3. [ ] Extract remaining "do not rebuild" components
4. [ ] index.html skeleton
5. [ ] base.css + index.js (shared foundation)
6. [ ] Build each section

---

## ASSET FOLDERS

- `assets/flags/` - 271 SVG country flags
- `assets/system-images/` - 35 files (icons, logos, pills)
- `assets/icons-30/` - 46 category icons (webp)

---

## DATABASE ACCESS

- Endpoint: `/gateway.php?action=get-admin-settings`
- Returns: categories, currencies, phone prefixes, checkout options, etc.
- User-created forms/posts via separate endpoints

---

## RULES FOR NEW AGENTS

1. **Read `AI_AGENT_CONFESSIONS_AND_RULES.md` FIRST** - Contains 16 documented failures
2. **User is NOT a programmer** - Use plain English, no jargon
3. **NEVER guess** - Ask if unclear
4. **NEVER create files without permission**
5. **NEVER use !important without permission**
6. **Copy existing patterns exactly** - Don't reinvent
7. **Data from DB, not hardcoded**
8. **400px panel width** - Standard for all panels

