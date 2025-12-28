# AI AGENT CONFESSIONS AND PROJECT RULES

## ⚠️ CRITICAL RULE - READ FIRST ⚠️

**Fallbacks, hardcode, and snapshots cause immense harm to the development of this software. Do not ever use them.**

## ⚠️ CRITICAL COMMUNICATION RULE ⚠️

**ALWAYS TRACK COMMITTED VS WORKSPACE CHANGES**

The user can only see committed/live code, not workspace changes. You can see both:
- **Committed files** (what's live on the website - what the user sees)
- **Workspace files** (uncommitted edits you've made)

**CRITICAL RULES:**
1. When the user asks what something is set to, refer ONLY to the committed/live version
2. When you read a file, remember what was in the committed version
3. When you edit a file, remember both: the original (committed) and your changes (workspace)
4. Never refer to workspace changes as if the user can see them
5. Only discuss your uncommitted changes if the user explicitly asks about them
6. Always compare: "In the committed code I see X, but I changed it to Y in the workspace"

This is inherent logic - you must track what you read vs what you changed. Every customer expects this.

## ⚠️ CRITICAL PERFORMANCE RULE ⚠️

**YOU ARE NOT ALLOWED TO DO ANYTHING THAT WILL JEOPARDIZE THE LOADING SPEED OF THE WEBSITE.**

**CRITICAL RULES:**
1. **Everything must load when required only** - Use lazy loading for all non-critical features
2. **Never initialize components, modules, or features on page load** unless they are absolutely essential for the page to function
3. **Never fetch data, load assets, or make API calls on startup** unless critical for initial page render
4. **Always defer non-essential operations** until the user actually needs them (e.g., when a panel opens, when a button is clicked)
5. **Do not create DOM elements on page load** unless they are required for the initial page structure
6. **Do not preload data** that might not be used
7. **Respect lazy loading patterns** - If a module only initializes when its panel opens, do not change that behavior

**Examples of what NOT to do:**
- ❌ Creating toast elements on DOM ready
- ❌ Loading avatar options on page load
- ❌ Fetching admin settings on startup (unless needed for initial render)
- ❌ Initializing modules that are only used when panels open

**Examples of what TO do:**
- ✅ Create toast elements only when first message is shown
- ✅ Load avatar options only when register tab is clicked
- ✅ Initialize modules only when their respective panels/tabs are opened
- ✅ Fetch data only when user action requires it

Website loading speed is critical. Any changes that slow down initial page load are strictly forbidden.

## Critical Information for All Future AI Agents

---

## ABOUT THE USER

**CRITICAL:** The user (Paul) is NOT a programmer/coder.
- Does NOT understand advanced programming terminology or jargon
- Communicate in plain, simple English
- Avoid technical terms like "race condition", "async IIFE", "await", etc. unless explaining what they mean
- When explaining what you're doing, use simple language: "wait for X to finish before doing Y" instead of "await the promise resolution"
- The user relies entirely on AI agents to write and fix code
- This makes your accuracy and reliability even MORE critical - there is no fallback if you make mistakes
- Respect the user's time - they are paying hundreds of dollars for AI services

---

## DATABASE ACCESS AND SQL

**CRITICAL:** AI agents CANNOT access the database directly. AI agents have NO way to run SQL queries or modify the database.

### ⚠️ CRITICAL: DB SPLIT SQL MUST BE THREE-SCHEMA SAFE ⚠️

This project uses split storage schemas:
- `funmapco_system` (platform/system tables like `admins`)
- `funmapco_content` (user data tables like `members`, `posts`)
- `funmapco_db` (compatibility layer made of **views** that the website queries)

**CRITICAL RULES:**
1. When providing SQL that edits tables, always use **schema-qualified names**, not bare table names.
   - ✅ Good: `ALTER TABLE \`funmapco_system\`.\`admins\` ...`
   - ✅ Good: `ALTER TABLE \`funmapco_content\`.\`members\` ...`
   - ❌ Bad: `ALTER TABLE \`admins\` ...` (phpMyAdmin may run it against the wrong selected database)
2. After changing columns in storage schemas, you MUST also update the matching **views** in `funmapco_db`,
   otherwise the site will break (views will reference missing columns).
   - Example: if `country_code` is renamed to `country` in storage tables, then update the `funmapco_db.admins`
     and `funmapco_db.members` views to select `country` instead of `country_code`.

**How Database Changes Work:**
1. AI agent provides SQL statements (SELECT, UPDATE, INSERT, etc.)
2. User copies the SQL and runs it themselves in their database tool (phpMyAdmin, MySQL client, etc.)
3. User modifies the database based on the SQL provided
4. AI agent NEVER runs database commands - only provides SQL code

**When User Asks for SQL:**
- Provide clear, complete, ready-to-execute SQL statements
- Include comments explaining what the SQL does
- Make sure SQL is correct and safe before providing it
- User will run it themselves - do NOT assume it will be executed automatically
- Do NOT claim "I modified the database" - you only provided SQL code

**NEVER:**
- Claim to have modified the database
- Assume SQL was executed
- Provide incomplete or untested SQL
- Use terminal commands to access database (agents cannot use terminal anyway)

---

## ⚠️ CRITICAL: cPanel IS THE SOURCE OF TRUTH ⚠️

**CRITICAL:** cPanel is where the actual live website files are stored and executed. The files you see in the workspace (GitHub/PC) are NOT necessarily what's running on the live site.

**How File Deployment Works:**
1. **cPanel is the source of truth** - Files on cPanel are what the internet actually reads and executes
2. **Files persist on cPanel** - Files on cPanel do NOT delete unless overwritten with the same filename
3. **Files can exist on cPanel but not in workspace** - If a file exists on cPanel but not in GitHub/workspace, it will still be read by the internet
4. **Workspace files are not automatically synced** - Changes in workspace must be committed and synced to cPanel to take effect

**CRITICAL RULES:**
1. **When debugging live site issues**, remember that cPanel files may differ from workspace files
2. **If a file exists on cPanel but not in workspace**, it will still run on the live site
3. **Deleting a file in workspace does NOT delete it on cPanel** - it must be explicitly deleted or overwritten
4. **Old/legacy files on cPanel can cause unexpected behavior** even if they don't exist in the workspace
5. **When investigating errors**, consider that cPanel may have files that aren't visible in the workspace

**When Troubleshooting:**
- If you see behavior on the live site that doesn't match the workspace code, cPanel may have different files
- If errors appear that don't make sense based on workspace code, check if cPanel has legacy files
- Always consider cPanel as the actual source of truth for what's running on the website

**NEVER:**
- Assume workspace files match cPanel files
- Ignore the possibility of legacy files on cPanel causing issues
- Assume deleting a file in workspace removes it from the live site

---

## ⚠️ CRITICAL: CONNECTOR FILES STRUCTURE (December 23, 2025) ⚠️

**CRITICAL:** Connector files have a dual-location structure that agents must understand.

**File Locations:**
1. **Development Location** (`home/funmapco/connectors/`): 
   - These are development copies placed in the website area for agent access during development
   - Agents can read and edit these files
   - These are NOT the production files

2. **Production Location** (one level above in cPanel):
   - The actual connector files that will be used in production
   - Located outside the website directory, one level above
   - These are the files that will actually run on the live site

**Gateway.php Routing:**
- `gateway.php` currently points to the development copies in `home/funmapco/connectors/`
- Later, `gateway.php` will be updated to point to the production files above
- All connector access goes through `gateway.php`

**CRITICAL RULES:**
1. When editing connector files, agents edit the development copies in `home/funmapco/connectors/`
2. The user must manually copy changes to the production files in cPanel (one level above)
3. Never assume changes to development files automatically affect production
4. Always be aware that the production files may differ from development files
5. When investigating issues, consider that production may have different connector files

**NEVER:**
- Assume development connector files are the same as production files
- Claim changes are live when only development files were modified
- Ignore the possibility of production files being different

---


