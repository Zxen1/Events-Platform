# Theme Presets Handoff

## Purpose
This document exists so the same agent can continue this exact work after context rollover without losing the thread.

This is a handoff for the ongoing conversion from the old per-style user columns:

- `map_lighting`
- `map_style`
- `animation_preference`

to the new grouped theme system:

- `theme_active`
- `theme_prefs`
- admin default presets in `admin_settings.theme_presets`

## Critical Current Status
The original schema-mismatch blockers listed below have now been fixed in code.

Current state:

- the PHP auth/edit/cleanup connectors are aligned with the new database schema
- live database code no longer references `map_lighting`, `map_style`, or `animation_preference` in `members` / `admins`
- `member.js` now persists theme customization through `theme_active` and `theme_prefs`
- legacy per-style values are still kept only as runtime cache on `currentUser` and in localStorage for existing consumers like `map.js` and `components.js`

This handoff is still useful, but parts of it describe the earlier blocked state before the cleanup was completed.

The database is ahead of some parts of the codebase. The latest dump is `funmapco_db (78).sql`, and the old columns have already been removed from `members` and `admins`.

That means any code still querying or updating:

- `map_lighting`
- `map_style`
- `animation_preference`

against those tables is now wrong and must be fixed before the work is considered complete.

## Latest Database State
Verified against `funmapco_db (78).sql`.

### `admins`
Current relevant columns:

- `theme_active`
- `theme_prefs`
- no `map_lighting`
- no `map_style`
- no `animation_preference`

### `members`
Current relevant columns:

- `theme_active`
- `theme_prefs`
- no `map_lighting`
- no `map_style`
- no `animation_preference`

### `admin_settings`
Confirmed row:

- `id = 74`
- `setting_key = 'theme_presets'`
- `setting_type = 'json'`

Current JSON:

```json
{
  "theme_light": {
    "bg_opacity": "1",
    "map_lighting": "day",
    "map_style": "standard",
    "animation_preference": "basic"
  },
  "theme_dark": {
    "bg_opacity": "0.6",
    "map_lighting": "dusk",
    "map_style": "standard",
    "animation_preference": "basic"
  }
}
```

## What Has Already Been Built

### Admin Themes Tab
The admin panel now has a new `Themes` tab placed after `Checkout`.

Files changed:

- `index.php`
- `admin.js`
- `admin.css`

What exists:

- new admin tab button: `Themes`
- new panel: `admin-tab-themes`
- two accordions:
  - `Light`
  - `Dark`
- each accordion contains copied UI controls matching the member profile style controls:
  - background opacity
  - map lighting
  - map style
  - wallpaper animation

### Admin Themes Tab Database Wiring
The `Themes` tab is wired to the existing generic admin settings pipeline.

Important:

- `get-admin-settings.php` already decodes JSON settings
- `save-admin-settings.php` already saves arrays/objects as `json`
- `admin.js` now treats `theme_presets` as one composite admin setting
- save/discard in the admin panel includes `theme_presets`

This part is conceptually in place.

### Member Theme Runtime Refactor Started
`member.js` has a new theme helper block that attempts to make:

- `theme_active`
- `theme_prefs`

the primary source of truth.

It currently includes:

- theme key conversion helpers
- admin preset fallback support
- effective preset resolution for `theme_auto`
- localStorage runtime cache syncing
- member style button updates tied to the active preset

### Startup Constraint Respected in Principle
The design target remains:

- no extra startup database fetch
- no startup database write
- startup restoration should be localStorage-only

`index.php` was updated so the early inline script can restore from:

- `theme_active`
- `theme_prefs`

using only localStorage and browser `prefers-color-scheme`.

This was done specifically to avoid violating the startup rules.

## Files Touched During This Phase

### UI / theme preset work
- `index.php`
- `admin.js`
- `admin.css`
- `member.js`

### Member/admin persistence / auth
- `home/funmapco/connectors/verify.php`
- `home/funmapco/connectors/edit-member.php`
- `home/funmapco/connectors/edit-admin.php`
- `home/funmapco/connectors/cron.php`

### Database confirmed but not directly edited by code here
- `funmapco_db (78).sql`

## Current Known Blockers

### 1. `verify.php` is still wrong for the new schema
This is the biggest active blocker.

`home/funmapco/connectors/verify.php` still selects removed columns from `members` and `admins`:

- `map_lighting`
- `map_style`
- `animation_preference`

This must be fixed immediately.

The login and reset-token flows are still expecting these old columns. With the current database, that query shape is invalid.

#### What needs to happen
`verify.php` must be changed so it only selects fields that still exist in `members` / `admins`, including:

- `theme_active`
- `theme_prefs`

and then the frontend should derive the current effective style values from `theme_prefs`, not from removed columns.

### 2. `member.js` still contains compatibility references to removed columns
`member.js` still has multiple references to old per-style fields.

Examples still present:

- `saveMemberSetting('map_lighting', ...)`
- `saveMemberSetting('map_style', ...)`
- `saveMemberSetting('animation_preference', ...)`
- `buildUserObject()` still accepts `map_lighting`, `map_style`, `animation_preference`
- logout logic still restores map lighting/style from legacy localStorage/admin settings
- post-login map application still checks `currentUser.map_lighting` and `currentUser.map_style`

These were intentionally kept temporarily as compatibility cache, but now that the database columns are gone, the database save path for them is wrong.

#### What needs to happen
The live member editing flow must save only:

- `theme_active`
- `theme_prefs`

The old per-setting save calls should be removed or replaced.

Runtime cache in localStorage can still keep:

- `map_lighting`
- `map_style`
- `animation_preference`
- `bg_opacity`

if needed for other modules, but those should be derived from the effective theme preset, not saved as separate user DB columns.

### 3. `edit-member.php` and `edit-admin.php` need cleanup
Current state:

- `edit-member.php` already accepts `theme_active` and `theme_prefs`
- `edit-admin.php` now also accepts `theme_active` and `theme_prefs`
- both still also accept old removed fields

That old acceptance is now obsolete.

#### What needs to happen
Remove old update handlers for:

- `map_lighting`
- `map_style`
- `animation_preference`

from both:

- `home/funmapco/connectors/edit-member.php`
- `home/funmapco/connectors/edit-admin.php`

unless there is a very specific short-lived compatibility reason.

### 4. `map.js` and `components.js` still read legacy localStorage/runtime values
This is not automatically wrong yet.

Current behavior:

- `map.js` still reads `localStorage.map_style` and `localStorage.map_lighting`
- `components.js` still reads `currentUser.animation_preference` or `localStorage.animation_preference`

This can remain temporarily **if** those keys are maintained as runtime cache derived from the effective theme preset.

The user explicitly cared about startup speed, so rewriting every consumer immediately is not required if the runtime cache stays correct and local-only.

### 5. `member.js` helper block needs a cleanliness pass
The new helper block is functional directionally, but it needs a disciplined final cleanup:

- remove old DB-field assumptions
- verify indentation after the recent patches
- verify there is no accidental duplicate event binding
- verify no unnecessary writes happen before actual interaction
- verify first-visit initialization remains localStorage/admin-preset based, not startup DB write based

## Specific Places To Revisit First

### Highest priority
1. `home/funmapco/connectors/verify.php`
2. `member.js`
3. `home/funmapco/connectors/edit-member.php`
4. `home/funmapco/connectors/edit-admin.php`

### Secondary review
5. `map.js`
6. `components.js`
7. `index.php`

## Safe Completion Strategy

### Step 1
Fix `verify.php` to stop querying removed columns.

Return only:

- `theme_active`
- `theme_prefs`
- all other still-valid user fields

### Step 2
Make `member.js` derive effective style state only from:

- `theme_active`
- `theme_prefs`
- admin preset defaults from `admin_settings.theme_presets`
- browser dark/light preference for `theme_auto`

Use old localStorage keys only as runtime compatibility cache for:

- `map.js`
- `components.js`

### Step 3
Remove obsolete save paths from:

- `edit-member.php`
- `edit-admin.php`

Only persist:

- `theme_active`
- `theme_prefs`

for theme styling.

### Step 4
Verify first-visit behavior carefully:

- no startup database write
- no extra startup table load
- if localStorage has no theme data, startup should still stay fast
- admin presets should only be used once existing startup settings are already available, or after user interaction/panel open

### Step 5
Do a final consistency pass:

- `theme_active` values should be:
  - `theme_auto`
  - `theme_light`
  - `theme_dark`
- `theme_prefs` JSON should store per-theme objects only
- no lingering database references to removed columns
- no lingering SQL assumptions in PHP connectors

## Important Design Rules Agreed With User

### Theme keys
Use:

- `theme_auto`
- `theme_light`
- `theme_dark`

Not:

- `auto`
- `light`
- `dark`

### User table schema
Use:

- `theme_active`
- `theme_prefs`

Do not use ENUM for `theme_active`.

### Admin defaults
Use one `admin_settings` row:

- `theme_presets`

### Theme preset shape
Current intended structure:

```json
{
  "theme_light": {
    "bg_opacity": "1",
    "map_lighting": "day",
    "map_style": "standard",
    "animation_preference": "basic"
  },
  "theme_dark": {
    "bg_opacity": "0.6",
    "map_lighting": "dusk",
    "map_style": "standard",
    "animation_preference": "basic"
  }
}
```

### Startup rules
The user was explicit:

- no extra startup loading
- no stealth startup DB work
- warn clearly before anything touches startup behavior

The intended acceptable startup work is:

- read localStorage
- use browser `prefers-color-scheme`
- use already-available startup settings only if they are already part of the normal startup payload

The intended unacceptable startup work is:

- extra database fetch just for theme initialization
- startup DB write just to create missing theme data

## Things Already Confirmed

### `full` wallpaper mode cleanup
The old bad value `full` was identified as wrong.

Confirmed cleanup direction:

- database should use `orbit` historically where needed
- theme presets use `basic` for both light and dark right now
- live bad code reference in `cron.php` was already changed from `full` to `orbit`

### Theme file
`themes.css` is still used.

Current reality:

- it is still mainly a light-theme override file
- dark is still mostly the base/default CSS
- the new JSON theme preset system does **not** replace `themes.css`
- JSON currently governs adjustable per-theme settings, not the full CSS skin

## What To Tell The User Before Continuing

Before saying the work is complete, confirm these points explicitly:

- login/auth queries are fixed against the new schema
- no startup DB loading was added
- member/admin theme customization now persists through `theme_active` / `theme_prefs`
- admin preset editing is connected to `admin_settings.theme_presets`
- old removed columns are no longer referenced by live DB code

## Commit Readiness
Current state after the latest cleanup:

- **code changes are commit-ready pending user review/testing**

What was fixed:

- `verify.php` no longer selects removed user-theme columns
- `edit-member.php` no longer writes removed user-theme columns
- `edit-admin.php` no longer writes removed user-theme columns
- `cron.php` no longer resets removed user-theme columns and now clears `theme_active` / `theme_prefs` instead
- `member.js` no longer saves per-style theme fields directly to the database
- `member.js` login/reset flows re-seed runtime cache from `theme_active` / `theme_prefs`

Remaining intentional behavior:

- `map.js` and `components.js` still consume `member.map_lighting`, `member.map_style`, and `member.animation_preference`
- those values are now runtime cache derived from the resolved theme preset, not separate database columns

## If Context Resets Immediately
Resume from this exact checklist:

1. Re-read `verify.php`, `edit-member.php`, `edit-admin.php`, `cron.php`, and `member.js` to confirm the schema cleanup is still present.
2. Treat `map.js` and `components.js` runtime-cache usage as intentional unless the user asks for a deeper refactor.
3. Re-read latest SQL dump and confirm no new schema drift has appeared.
4. Ask the user to test login, password reset login, and theme changes before any final commit if runtime behavior has not yet been manually verified.

## Later Progress Update

### Database State Updated Again
The newer dump is now `funmapco_db (79).sql`.

This newer dump confirms:

- `admins.theme_active` exists
- `admins.theme_prefs` exists
- `members.theme_active` exists
- `members.theme_prefs` exists
- `admin_settings.theme_presets` still exists and is the intended default source

It also confirms that these older conflicting admin settings rows are now gone from the database:

- `map_lighting`
- `map_style`
- `location_wallpaper_mode`
- `default_wallpaper_mode`

These rows were previously a serious conflict with the new theme preset system and should have been documented much earlier.

### Important Architectural Conflict That Was Found Later
After the earlier handoff was written, it became clear that the old admin Map tab was still exposing and saving controls for:

- map lighting
- map style
- default wallpaper mode

At the same time, the new theme preset system was also trying to control:

- `map_lighting`
- `map_style`
- `animation_preference`

That meant there were two competing sources of truth:

1. old admin Map-tab settings
2. new `admin_settings.theme_presets`

This conflict is now the main architectural issue that had to be resolved.

### What Was Changed To Resolve The Conflict

#### Runtime consumers were cut over to the new system
`map.js` and `components.js` were updated so they no longer use the old admin settings rows for these values.

Instead, runtime now resolves these values from:

1. logged-in user runtime cache (`currentUser.map_*` / `currentUser.animation_preference`)
2. localStorage runtime cache
3. `settings.theme_presets`

This means the old global rows are no longer the live source of truth for:

- map lighting
- map style
- wallpaper mode

#### Old Map-tab controls were removed
The old admin Map-tab controls were first hidden and then properly deleted.

Deleted from `index.php`:

- old Map Lighting control block
- old Map Style control block
- old Default Location Wallpaper control block

Deleted from `admin.js`:

- dead button wiring for `.admin-lighting-button`
- dead button wiring for `.admin-style-button`
- dead button wiring for `.admin-wallpaper-button`
- stale field registrations for:
  - `map.map_lighting`
  - `map.map_style`
  - `map.default_wallpaper_mode`

#### SQL direction for old admin rows
The obsolete admin settings rows to delete were identified as:

- `map_lighting`
- `map_style`
- `location_wallpaper_mode`
- `default_wallpaper_mode`

Later, the user updated the database dump to `79`, which confirms those rows are already gone.

### Strict No-Fallback Cleanup
The user explicitly stated that fallback chains are not allowed during development because they hide broken behavior.

After that instruction, the theme path was tightened so it fails loudly instead of silently inventing defaults.

Relevant changes:

- `member.js` no longer silently invents default theme presets when `theme_presets` is missing
- `member.js` no longer swallows malformed `theme_prefs`
- `admin.js` no longer silently fills missing theme preset values from hardcoded defaults
- `index.php` no longer silently falls back to legacy `color_theme` / `bg_opacity` bootstrap behavior when `theme_active` / `theme_prefs` are missing or malformed

### Startup / Auth Timing Issue Found Later
After strict no-fallback behavior was introduced, a new race condition appeared:

- auth flows in `member.js` were calling `ensureThemeStateInitialized()` immediately
- strict theme code now requires `settings.theme_presets`
- startup settings fetch may not have resolved yet during fast login / register / reset flows

This was later fixed by making those flows wait for the existing shared startup settings promise:

- `App.whenStartupSettingsReady()`

Important:

- no new startup fetch was added
- no extra theme-only request was added
- the code now waits on the existing startup settings request instead

### Cross-Account LocalStorage Leak Found Later
Another later bug was found:

- if one account left theme data in localStorage
- and the next logged-in account had null `theme_active` / `theme_prefs`
- the second account could inherit the first account's theme state

This was fixed in `member.js` by clearing stored theme keys when the incoming user object has no saved theme data.

### Accessibility Fix Found Later
The new Themes accordions in the admin tab were initially added without proper keyboard accessibility.

That was later fixed by:

- adding button semantics to the accordion headers
- adding `aria-expanded`
- adding keyboard toggle for `Enter` and `Space`
- using `hidden` for the collapsed content

### Current Runtime Ownership Model
As of the latest changes, the intended ownership model is:

- `themes.css` still owns the broader CSS theme skin
- `admin_settings.theme_presets` owns the default values for:
  - `bg_opacity`
  - `map_lighting`
  - `map_style`
  - `animation_preference`
- `admin_settings.theme_presets` now also owns `wallpaper_overlay` per theme preset
- `members.theme_active` / `members.theme_prefs` override those defaults per member
- `admins.theme_active` / `admins.theme_prefs` override those defaults per admin
- runtime cache in localStorage still mirrors the resolved values for older consumers

The old top-level admin rows:

- `wallpaper_overlay_dark`
- `wallpaper_overlay_light`

are now obsolete and should be deleted from `admin_settings` once the database is updated.

### Latest Review Fix
A later code-review pass found one more concrete blocker in `member.js`:

- multiple async theme-init call sites were using bare `.then(...)` chains
- if strict theme initialization rejected, those flows could stop halfway through without any explicit failure reporting

This was fixed by:

- adding `reportThemeInitializationError(err)` in `member.js`
- attaching explicit `.catch(reportThemeInitializationError)` handlers to the async theme-init paths used by:
  - member panel theme-button refresh
  - login success
  - registration success
  - password reset login
  - stored-session restore
  - logout theme-button refresh
  - DOM-ready avatar/theme bootstrap

Result:

- strict failures are still surfaced loudly
- they no longer disappear as unhandled promise rejections
- this reduced the biggest remaining code-review blocker before browser testing

### Current Doubts / Functional Risks Still To Verify
These are not confirmed bugs, but they are still important doubts that need real browser testing before any final commit:

1. Auth flow timing after the latest async changes
- `member.js` auth flows were changed to wait on `App.whenStartupSettingsReady()`
- this solved the strict-theme race in code review
- but it still needs real browser testing for:
  - normal login
  - registration login
  - password reset login

2. Member profile theme controls after async initialization
- theme buttons now refresh after startup settings are ready
- this should be correct
- but it needs live testing to make sure the buttons are populated and clickable immediately when the panel opens

3. Theme Auto behavior across devices and browser theme changes
- the code is intended to keep `theme_auto` permanent
- the resolved preset should change per device / per visit
- this needs real testing, not just code inspection

4. Admin Themes tab save/discard
- the composite field wiring appears correct
- but save/discard should be tested in the UI because that tab was added mid-stream and revised several times

5. Remaining old comments / mental model drift
- some comments in older files may still describe the pre-theme-preset model
- even where runtime logic is now corrected, wording may still lag behind

### Current Best Resume Checklist
If context resets again, the next agent should do this:

1. Re-read this handoff from the top, including this later progress update.
2. Re-check `funmapco_db (79).sql` before trusting any older database notes.
3. Re-check `map.js`, `components.js`, `member.js`, `admin.js`, and `index.php` to make sure the new theme system still bypasses the deleted old admin rows.
4. Browser-test:
- guest first visit
- guest changing theme prefs
- logged-in member changing theme prefs
- `theme_auto` across light/dark device preference changes
- admin Themes tab save/discard
- password reset login
5. Only after that decide whether the work is actually commit-safe.

