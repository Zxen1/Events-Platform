const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../db/database.json');

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: [],
      themes: [],
      user_theme_preferences: [],
      admin_theme: [],
      admin_mapbox: [],
      admin_settings: [],
      admin_theme_backups: [],
      admin_mapbox_backups: [],
      admin_settings_backups: []
    };
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  read,
  write,
  DB_PATH
};
