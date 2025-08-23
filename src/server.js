const { getUserTheme, setUserTheme } = require('./db/theme');
const { generateTheme } = require('./themeBuilder');
const { updateFields } = require('./themeOrganiser');
const { saveTab } = require('./db/admin');
const http = require('http');
const url = require('url');

function applyTheme(theme) {
  if (!theme) return null;
  const base = theme.data && theme.data.primary ? theme.data.primary : '#336699';
  const generated = generateTheme(base);
  // Update theme organiser fields before applying to website
  updateFields(generated);
  console.log(`Applying theme: ${theme.name}`, generated);
  return generated;
}

function onLogin(userId) {
  const theme = getUserTheme(userId);
  applyTheme(theme);
  return theme;
}

function onThemeChange(userId, themeId, customJson) {
  const theme = setUserTheme(userId, themeId, customJson);
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
        try {
          const { tab, data } = JSON.parse(body || '{}');
          if (!tab || typeof data !== 'object') {
            res.writeHead(400); res.end('Invalid'); return;
          }
          const record = saveTab(tab, data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, record }));
        } catch (e) {
          res.writeHead(500); res.end('Error');
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
