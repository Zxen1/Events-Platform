const { generateTheme, DEFAULT_BASE_COLOR } = require('./themeBuilder');
const http = require('http');
const url = require('url');

// Theme organiser helpers migrated from themeOrganiser.js
let fields = {};

// Update the tracked fields. By default new values are merged with any
// existing ones, but passing `true` for `replace` will overwrite the entire
// set. DOM inputs are updated to reflect the provided values.
function updateFields(newFields, replace = false) {
  if (replace) fields = {};
  fields = { ...fields, ...newFields };
  if (typeof document !== 'undefined') {
    const entries = replace ? fields : newFields;
    Object.entries(entries).forEach(([key, val]) => {
      const input = document.getElementById(key);
      if (input) input.value = val;
    });
  }
  console.log('Theme organiser updated', fields);
}

// Clear all stored fields and any associated DOM input values so that stale
// data does not linger when a new theme is applied.
function resetFields() {
  if (typeof document !== 'undefined') {
    Object.keys(fields).forEach(key => {
      const input = document.getElementById(key);
      if (input) input.value = '';
    });
  }
  fields = {};
}

function getFields() {
  return fields;
}

// Bind color input elements to CSS variables for instant theme updates
// bindings: { inputId: cssVariable }
function bindColorInputs(bindings) {
  if (typeof document === 'undefined') return;
  Object.entries(bindings).forEach(([id, varName]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      document.documentElement.style.setProperty(varName, e.target.value);
      updateFields({ [id]: e.target.value });
    });
  });
}

function applyTheme(theme) {
  if (!theme) return null;
  // Clear any previous theme values before applying the new one
  resetFields();
  const base = theme.data && theme.data.primary ? theme.data.primary : DEFAULT_BASE_COLOR;
  const generated = generateTheme(base);
  // Update theme organiser fields before applying to website
  updateFields(generated);
  console.log(`Applying theme: ${theme.name}`, generated);
  return generated;
}

function onLogin() {
  const theme = { name: 'default', data: { primary: DEFAULT_BASE_COLOR } };
  applyTheme(theme);
  return theme;
}

function onThemeChange(_userId, _themeId, customJson) {
  let custom = {};
  try {
    custom = JSON.parse(customJson || '{}');
  } catch (e) {}
  const theme = { name: 'custom', data: custom };
  applyTheme(theme);
  return theme;
}

function startServer(port = 3000) {
  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    if (req.method === 'POST' && parsed.pathname === '/admin/save') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        try {
          res.end(JSON.stringify({ success: true, received: JSON.parse(body || '{}') }));
        } catch (e) {
          res.end(JSON.stringify({ success: true, received: {} }));
        }
      });
    } else {
      res.writeHead(404); res.end('Not found');
    }
  });
  server.listen(port, () => console.log(`Server listening on ${port}`));
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  onLogin,
  onThemeChange,
  applyTheme,
  startServer,
  updateFields,
  resetFields,
  getFields,
  bindColorInputs,
};
