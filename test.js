const assert = require('assert');
const fs = require('fs');
const seed = require('./db/seed');
const { getUserTheme, setUserTheme } = require('./src/db/theme');
const { DB_PATH } = require('./src/db');
const { generateTheme } = require('./src/themeBuilder');

// Theme builder tests
const built = generateTheme('#336699');
assert.strictEqual(built.primary, '#336699');
assert.ok(typeof built.background === 'string');

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

console.log('All tests passed!');
