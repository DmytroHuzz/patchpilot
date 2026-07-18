const { parseUserTheme, renderThemePreview } = require("./theme");

const rawTheme = process.argv[2] ?? "{}";

try {
  console.log(renderThemePreview(parseUserTheme(rawTheme)));
} catch (error) {
  console.error(`Invalid theme: ${error.message}`);
  process.exitCode = 1;
}

