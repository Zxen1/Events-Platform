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
