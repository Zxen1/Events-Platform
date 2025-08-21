const { read, write } = require('./index');

function getUserTheme(userId) {
  const db = read();
  const pref = db.user_theme_preferences.find(p => p.user_id === userId);
  if (!pref) return null;
  const theme = db.themes.find(t => t.id === pref.theme_id);
  if (!theme) return null;
  let data = {};
  try {
    data = JSON.parse(theme.data || '{}');
  } catch (e) {}
  let custom = {};
  try {
    custom = JSON.parse(pref.custom_json || '{}');
  } catch (e) {}
  return { ...theme, data: { ...data, ...custom }, custom };
}

function setUserTheme(userId, themeId, customJson = '{}') {
  const db = read();
  const theme = db.themes.find(t => t.id === themeId);
  if (!theme) {
    throw new Error('Theme not found');
  }
  const idx = db.user_theme_preferences.findIndex(p => p.user_id === userId);
  if (idx >= 0) {
    db.user_theme_preferences[idx] = { user_id: userId, theme_id: themeId, custom_json: customJson };
  } else {
    db.user_theme_preferences.push({ user_id: userId, theme_id: themeId, custom_json: customJson });
  }
  write(db);
  return getUserTheme(userId);
}

module.exports = { getUserTheme, setUserTheme };
