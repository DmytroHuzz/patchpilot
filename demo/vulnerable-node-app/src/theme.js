const JSON5 = require("json5");

const DEFAULT_THEME = Object.freeze({
  accent: "#75f2b3",
  density: "comfortable",
});

function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);

  return {
    ...DEFAULT_THEME,
    ...userTheme,
  };
}

function renderThemePreview(theme) {
  return `Theme preview: ${theme.accent} / ${theme.density}`;
}

module.exports = { parseUserTheme, renderThemePreview };

