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
- Calendars (3 different ones, months of work) **(MADE IT SUPERIOR)**
- Currency menu **(MADE IT SUPERIOR)**
- Phone prefix menu **(MADE IT SUPERIOR)**
- Icon picker **(MADE IT SUPERIOR)**
- System image picker **(MADE IT SUPERIOR)**
- Category filter **(MADE IT SUPERIOR)**
- Checkout options interface
- Fieldsets (admin, form, user views)
- Formpicker
- Messages system

**Exception:** Formbuilder WILL be rebuilt.

### MADE IT SUPERIOR: Dropdown Menus (Dec 13, 2025)

Old code: 400+ lines spread across multiple functions, 20+ class names, global state, special boolean checks everywhere ("is this system image picker or icon picker?"), same problem solved 5 different ways.

New code: 94 lines total. Two templates (database dropdown, folder dropdown). 9 class names. No global state. Copy-paste ready - change 3 attributes, done.

File: `menu-test.html`

### MADE IT SUPERIOR: Calendar (Dec 13, 2025)

Old code: 400+ lines scattered across multiple functions, CSS variable calculations that stretched rows, complex height calculations, 3 separate calendar implementations for filter/session menu/session creator.

New code: 189 lines total. Fixed 34px row heights. Simple structure (container → scroll → calendar). Red dot in scrollbar. Mouse wheel scrolls horizontally. Click to select days. Self-contained.

File: `calendar-test.html`

### MADE IT SUPERIOR: Category Filter (Dec 13, 2025)

Old code: 150+ lines JS render function. Checkbox input + label + slider hack for toggles. 8+ ARIA setAttribute calls per category. Complex state functions (syncExpanded, setOpenState, setCategoryActive). innerHTML string parsing for subcategories. Mixed class names (cat-switch, slider, options-dropdown, filter-category-trigger-wrap).

New code: 100 lines JS, 140 lines CSS. Pure CSS toggle switches (no inputs). State via class toggle (--open, --disabled). Clean createElement. Consistent naming convention. Larger click targets extending to edge. Self-contained.

File: `categoryfilter-test.html`

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

