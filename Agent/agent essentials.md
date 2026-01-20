# AGENT ESSENTIALS

Read this file at the start of every conversation. Follow these rules without exception.

---

## CRITICAL: WHAT IS FORBIDDEN

### No Snapshots
Never cache data in window globals or store "snapshots" of state. Fetch data directly when needed.

### No Global Overrides
Never create CSS or JS that overrides styles/behavior globally. All styles must be scoped and self-contained.

### No Hardcode
Never hardcode values. Everything must be configurable/dynamic. This platform will power multiple websites.

### No Fallbacks
Never create fallback chains (if X fails, try Y). If something fails, throw an error - don't silently fall back.

### No !important Tags
Never use `!important` in CSS.

**Exceptions (allowed):**
1. **Mapbox overrides** (Mapbox/third-party injected styles that require `!important`)
2. **Browser-specific overrides** (rare, only when needed to fix a browser quirk/override)

### No Workarounds
Never create workarounds or hacks. Find the proper solution or ask the user.

### No Guessing
Never guess how something works. Search existing code first. If unsure, ask.

### No Inventing
Never invent new approaches. Always copy existing patterns from the codebase exactly.

### No Unauthorized Code
Never add code, variables, classes, or properties without explicit user approval.

### No Unauthorized Files
Never create new files without explicit permission.

---

## CRITICAL: CODE ACCESS RULES

### No Code Without Permission
Do NOT look at code or touch code without the user's explicit consent.

### No Coding Mid-Conversation
When discussing something, do NOT start editing files. Wait for explicit instruction to implement.

### Questions ≠ Instructions
When user asks "how do we do X?" - this is a QUESTION. Answer it and wait for approval before implementing.

### Simple Questions Don't Need Code
If the user asks a simple question, answer it. Don't read files unless necessary.

### Changes Must Use Edit Tools
Showing code in chat is NOT saving it. Use `search_replace` or `write` to actually modify files.

---

## CRITICAL: PATTERNS OVER INVENTION

### Always Copy Existing Patterns
Before implementing ANYTHING, search the codebase for how it's already done. Copy that pattern exactly.

### The Live Site Is Your Reference
The live site code (index.js, etc.) contains working implementations. USE THEM.

### Same Method, Not "Also Works"
If a feature exists elsewhere, implement it using the SAME method/pattern, not a new method that "also works".

---

## CSS: 10-12-6 VERTICAL SPACING RULE

The standard vertical spacing for the new site:

| Spacing | Value | Usage |
|---------|-------|-------|
| **12px** | `margin-bottom: 12px` | Between sibling containers |
| **10px** | `margin-bottom: 10px` | Between elements inside containers |
| **6px** | `margin-bottom: 6px` | Between a label and its element |
| **6px** | `margin-bottom: 6px` | Between rows of info in postcards/marquee |

### Table Exception
Tables (e.g., sessions, pricing tiers) use **8px** horizontal and **8px** vertical spacing between their elements/rows.

### Container Padding
Visible containers (with background/border) use: `padding: 10px 10px 0`
- Elements inside keep their `margin-bottom` for bottom spacing

### Last-Child Rule
`last-child { margin-bottom: 0 }` is ONLY for invisible containers (no background/border) to prevent double-up.

### Nested Containers
Nested containers (rare) get `margin-bottom: 10px` like other elements.

---

## CSS: CLASS NAMING PATTERN

Formula: `.{section}-{name}-{type}-{part}-{subpart}--{state}`

### Rules
1. **Big to Small (Left to Right):** Class names match physical DOM nesting
2. **Single-Word Parts:** Join multi-word parts as one word (e.g., `itemvariantadd`)
3. **Hyphens for Hierarchy:** Use hyphens strictly for hierarchy levels
4. **No Redundant Nesting:** Don't nest a `row` inside a `row`

### Structural Types
- `label` - headline
- `sublabel` - internal text labels (appears ABOVE its target)
- `input` - text entry
- `menu` - dropdowns
- `container` - for lists/grids
- `row` - structural wrappers
- `button` - triggers
- `image` - standalone images/icons
- `text` - static display text

### Button Classes
1. **Name class FIRST:** `{section}-{purpose}` (e.g., `member-login`)
2. **Base class SECOND:** Button class from base-new.css (e.g., `button-class-3`)

```html
<!-- CORRECT -->
<button class="member-login button-class-3">Log In</button>

<!-- WRONG: Redundant -->
<button class="member-login-button-class-3 button-class-3">Log In</button>
```

---

## CSS: NO FLEXIBLE VERTICAL SIZING

Never use flex properties that make vertical dimensions dynamic. All heights are fixed. Only horizontal dimensions flex. `align-items: center` for vertical centering within fixed-height rows is allowed.

---

## USER INTERACTION RULES

### User Is Always In Charge
The user controls all decisions. Ask before doing anything.

### Never Push the User
Do NOT ask "what's next?" or prompt for the next action. Wait silently for instruction.

### No Suggestions Unless Asked
Do not offer alternatives or propose solutions unless explicitly requested.

### User Is Not a Programmer
Communicate in plain, simple English. Avoid technical jargon.

---

## DATABASE RULES

### SQL in Chat Only
Never edit SQL backup/export files. Paste SQL directly in chat for the user to run.

### Never Create SQL Files
Draft SQL must live only in chat, never as files in the workspace.

### Verify Before Writing SQL
ALWAYS search the database dump for exact table structure before writing any SQL. Never guess column names.

### Column Ordering
`created_at` and `updated_at` must always be the last columns in a table.

---

## TERMINAL RULES

### No Terminal Commands
The user prefers to run shell operations themselves. Do not use terminal access.

---

## PERFORMANCE RULES

### Lazy Loading Only
Everything loads when required, not at startup. Never initialize components on page load unless essential.

### Never Preload
Don't fetch data or load assets on startup. Wait until user action requires it.

---

## DEFAULT UI SIZING (New Site)

- Height: 36px
- Padding/Margins: 10px
- Border-radius: 5px
- Border: 1px solid
- All new UI must have padding (default: 10px)

---

## VERIFICATION BEFORE COMPLETING

Before marking any task complete, check for:
- Syntax errors, logic errors
- Unauthorized names (variables, functions, classes)
- Naming inconsistencies
- CSS !important usage
- Fallbacks or snapshots
- Hardcoded values

---

## THE NEW SITE

Files ending in `-new` or `*-new.*` are the new site files. Work targets these files during migration.

UI sections are called **panels** (e.g., "Recent panel", "Post panel").

---

## IF UNSURE

1. Search existing code first
2. Copy existing patterns exactly
3. If still unsure, ASK the user
4. Never guess, never invent

---
