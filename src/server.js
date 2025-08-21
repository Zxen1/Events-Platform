const { getUserTheme, setUserTheme } = require('./db/theme');

function applyTheme(theme) {
  // Placeholder for actual theme application logic
  if (theme) {
    console.log(`Applying theme: ${theme.name}`);
  }
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

module.exports = { onLogin, onThemeChange, applyTheme };
