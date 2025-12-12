# REBUILD STATUS

**Last Updated:** December 13, 2025
**Current Phase:** Setup - Creating placeholder structure

---

## FILE STRUCTURE

### JavaScript Files (9 total)
| File | Section | Status | Description |
|------|---------|--------|-------------|
| index.js | backbone | placeholder | Shared utilities, initialization, globals |
| header.js | header | placeholder | Header bar, logo, filter button, mode switch, access buttons |
| filter.js | filter | placeholder | Filter panel, all filter controls |
| map.js | map | placeholder | Mapbox integration, markers, cards, clusters |
| post.js | post | placeholder | Posts panel, recents panel, open post view |
| admin.js | admin | placeholder | Admin panel (settings, forms, map, messages tabs) |
| member.js | member | placeholder | Member panel (profile, create post, my posts) |
| forms.js | forms | placeholder | Formbuilder, form fields, shared between admin+member |
| advert.js | advert | placeholder | Sidebar advert, featured post cycling |

### CSS Files (9 total)
| File | Section | Status | Description |
|------|---------|--------|-------------|
| base.css | backbone | placeholder | CSS variables, resets, shared styles |
| header.css | header | placeholder | Header styling |
| filter.css | filter | placeholder | Filter panel styling |
| map.css | map | placeholder | Map, markers, cards styling |
| post.css | post | placeholder | Posts and recents styling |
| admin.css | admin | placeholder | Admin panel styling |
| member.css | member | placeholder | Member panel styling |
| forms.css | forms | placeholder | Form fields, formbuilder styling |
| advert.css | advert | placeholder | Advert sidebar styling |

---

## 7 VISIBLE SECTIONS

1. **Header** - Logo, filter button, mode switch (Recents/Posts/Map), access buttons (member/admin/fullscreen)
2. **Filter** - Search, filters, categories, calendar
3. **Map** - Mapbox map, markers, clusters, cards, shadow
4. **Post** - Post cards, recents, open post view with sticky header
5. **Admin** - Settings, Forms, Map, Messages tabs
6. **Member** - Profile, Create Post, My Posts tabs
7. **Advert** - Sidebar with featured posts (1920px+ screens)

---

## 2 INVISIBLE/SHARED

- **index.js** (backbone) - Core utilities used by all sections
- **forms.js** - Shared between admin and member

---

## BUILD ORDER

1. [ ] index.html (skeleton)
2. [ ] base.css + index.js (shared foundation)
3. [ ] header.css + header.js
4. [ ] map.css + map.js (Mapbox integration)
5. [ ] filter.css + filter.js
6. [ ] post.css + post.js
7. [ ] admin.css + admin.js
8. [ ] member.css + member.js
9. [ ] forms.css + forms.js
10. [ ] advert.css + advert.js

---

## CONTAINER NAMES (to be finalized)

### Header
- bar, logo, filter, modeswitch, access

### Filter
- (TBD)

### Map
- (TBD)

### Post
- (TBD)

### Admin
- (TBD)

### Member
- (TBD)

### Forms
- (TBD)

### Advert
- (TBD)

---

## CLASS NAMING CONVENTION

```
.{section}-{container}-{type}-{part}-{subpart}--{state}
```

See `AI_AGENT_CONFESSIONS_AND_RULES.md` for full documentation.

---

## CURRENT TASK

Creating placeholder file structure.

---

## NOTES FOR NEW AGENTS

1. Read this file first
2. Read `AI_AGENT_CONFESSIONS_AND_RULES.md` second
3. Check which files are "placeholder" vs "complete" in the tables above
4. Continue from the current task
5. Update this file after completing work

