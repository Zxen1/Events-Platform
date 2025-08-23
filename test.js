const assert = require('assert');
const { generateTheme, DEFAULT_BASE_COLOR } = require('./src/themeBuilder');
const { applyTheme, getFields } = require('./src/server');

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

console.log('All tests passed!');
