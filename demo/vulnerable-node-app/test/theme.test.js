const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseUserTheme, renderThemePreview } = require("../src/theme");

describe("theme preview", () => {
  it("accepts friendly JSON5 syntax from the CLI boundary", () => {
    const theme = parseUserTheme("{accent: '#ffb86c', density: 'compact'}");

    assert.deepEqual(theme, { accent: "#ffb86c", density: "compact" });
    assert.equal(renderThemePreview(theme), "Theme preview: #ffb86c / compact");
  });

  it("supplies defaults for omitted values", () => {
    assert.deepEqual(parseUserTheme("{}"), {
      accent: "#75f2b3",
      density: "comfortable",
    });
  });
});

