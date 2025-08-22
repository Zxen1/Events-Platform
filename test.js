const assert = require('assert');
const fs = require('fs');
const seed = require('./db/seed');
const { getUserTheme, setUserTheme } = require('./src/db/theme');
const { DB_PATH } = require('./src/db');
const { saveTab, listBackups, restoreBackup } = require('./src/db/admin');
const { generateTheme, DEFAULT_BASE_COLOR } = require('./src/themeBuilder');
const { applyTheme } = require('./src/server');
const { getFields } = require('./src/themeOrganiser');

// Theme builder tests
const built = generateTheme('#336699');
assert.strictEqual(built.primary, '#336699');
assert.ok(typeof built.background === 'string');
assert.ok(typeof built.buttonText === 'string');
assert.ok(typeof built.buttonHoverText === 'string');

// Invalid color falls back to default
const fallbackTheme = generateTheme('blue');
assert.strictEqual(fallbackTheme.primary, DEFAULT_BASE_COLOR);

// Applying a theme updates organiser before appearance
const logs = [];
const originalLog = console.log;
console.log = (...args) => {
  logs.push(args.join(' '));
};
applyTheme({ name: 'preview', data: { primary: '#123456' } });
console.log = originalLog;
assert.ok(logs[0].startsWith('Theme organiser updated'));
assert.ok(logs[1].startsWith('Applying theme'));
assert.strictEqual(getFields().primary, '#123456');

// Theme preference tests
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
seed();

// Initially user has no preference
assert.strictEqual(getUserTheme(1), null);

// Set dark theme with custom background
const updated = setUserTheme(1, 2, JSON.stringify({ background: '#111' }));
assert.strictEqual(updated.name, 'dark');
assert.strictEqual(updated.data.background, '#111');
assert.strictEqual(updated.data.color, '#fff');

// Switch back to light theme
const changed = setUserTheme(1, 1);
assert.strictEqual(changed.name, 'light');

// Admin tab backup tests
const themeSave = saveTab('theme', { name: 'test', primary: '#000000' });
assert.strictEqual(themeSave.id, 1);
assert.ok(listBackups('theme').length === 1);
const restored = restoreBackup('theme', themeSave.id);
assert.strictEqual(restored.id, 2);

console.log('All tests passed!');
