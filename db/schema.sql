CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE themes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  data TEXT DEFAULT '{}'
);

CREATE TABLE user_theme_preferences (
  user_id INTEGER PRIMARY KEY,
  theme_id INTEGER NOT NULL,
  custom_json TEXT DEFAULT '{}',
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(theme_id) REFERENCES themes(id)
);

-- Admin tables for each settings tab
CREATE TABLE admin_theme (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  primary TEXT,
  secondary TEXT,
  accent TEXT,
  background TEXT,
  text TEXT,
  button_text TEXT,
  button_hover_text TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_mapbox (
  id INTEGER PRIMARY KEY,
  map_theme TEXT,
  sky_theme TEXT,
  spin_speed REAL,
  map_pitch INTEGER,
  map_bearing INTEGER,
  spin_load_start INTEGER,
  spin_type TEXT,
  spin_logo_click INTEGER,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_settings (
  id INTEGER PRIMARY KEY,
  categories TEXT,
  subcategories TEXT,
  color TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup tables for version control
CREATE TABLE admin_theme_backups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  primary TEXT,
  secondary TEXT,
  accent TEXT,
  background TEXT,
  text TEXT,
  button_text TEXT,
  button_hover_text TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_mapbox_backups (
  id INTEGER PRIMARY KEY,
  map_theme TEXT,
  sky_theme TEXT,
  spin_speed REAL,
  map_pitch INTEGER,
  map_bearing INTEGER,
  spin_load_start INTEGER,
  spin_type TEXT,
  spin_logo_click INTEGER,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_settings_backups (
  id INTEGER PRIMARY KEY,
  categories TEXT,
  subcategories TEXT,
  color TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
