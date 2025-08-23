// Database utilities backed by browser localStorage.
// Falls back to an in-memory store when localStorage is unavailable
// (e.g. in Node.js tests).

const storage = typeof localStorage !== 'undefined' ? localStorage : (() => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

const DB_KEY = 'eventsPlatformDb';

function ensureDb() {
  if (!storage.getItem(DB_KEY)) {
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
    storage.setItem(DB_KEY, JSON.stringify(initial));
  }
}

function read() {
  ensureDb();
  return JSON.parse(storage.getItem(DB_KEY));
}

function write(data) {
  storage.setItem(DB_KEY, JSON.stringify(data));
}

function clear() {
  storage.removeItem(DB_KEY);
}

module.exports = {
  read,
  write,
  clear,
  DB_KEY
};

