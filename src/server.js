const { getUserTheme, setUserTheme } = require('./db/theme');
const { generateTheme } = require('./themeBuilder');
const { updateFields } = require('./themeOrganiser');

function applyTheme(theme) {
  // Build a full theme palette from the stored base color
  if (theme) {
    const base = theme.data && theme.data.primary ? theme.data.primary : '#336699';
    const generated = generateTheme(base);
    // Update theme organiser fields before applying to website
    updateFields(generated);
    console.log(`Applying theme: ${theme.name}`, generated);
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
