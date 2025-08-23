const { generateTheme, DEFAULT_BASE_COLOR } = require('./themeBuilder');
const { updateFields, resetFields } = require('./themeOrganiser');
const http = require('http');
const url = require('url');

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

module.exports = { onLogin, onThemeChange, applyTheme, startServer };
