import path from "node:path";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { TargetedTestProposal } from "@patchpilot/contracts";
import type { TargetedTestContext } from "./targetedTestContext.js";
import { generateTargetedTestWithOpenAI, loadCachedTargetedTest } from "./generateTargetedTest.js";
import { validateTargetedTest } from "./validateTargetedTest.js";

const context: TargetedTestContext = {
  approvedPlan: {
    strategy: "dependency_upgrade_and_code_change",
    expectedTestFile: "test/theme.test.js",
    verificationIntent: "Add a targeted test showing unsupported input keys are not copied.",
  },
  dependencyUpdate: { packageName: "json5", fromVersion: "1.0.1", targetVersion: "1.0.2" },
  compatibilityRepair: { status: "repaired", file: "src/theme.js", syntaxPassed: true },
  source: {
    file: "src/theme.js",
    functionName: "parseUserTheme",
    functionText: `function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);
  return {
    accent: typeof userTheme.accent === "string" ? userTheme.accent : DEFAULT_THEME.accent,
    density: typeof userTheme.density === "string" ? userTheme.density : DEFAULT_THEME.density,
  };
}`,
  },
  existingTests: {
    file: "test/theme.test.js",
    text: `const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseUserTheme } = require("../src/theme");

describe("theme preview", () => {
  it("keeps supported fields", () => {
    assert.equal(parseUserTheme("{}").accent, "#75f2b3");
  });
});
`,
  },
  constraints: {
    allowedFile: "test/theme.test.js",
    allowedInsertion: "before_final_suite_close",
    unsupportedField: "previewLabel",
    unsupportedValue: "ignored",
    supportedFields: ["accent", "density"],
    noPrototypeKeys: true,
    noNewImportsDependenciesOrCommands: true,
    exactlyOneTest: true,
  },
};

const proposal: TargetedTestProposal = {
  action: "add_test",
  classification: "mitigation_regression",
  explanation: "Verify the allowlist with a benign unsupported field.",
  file: "test/theme.test.js",
  insertion: "before_final_suite_close",
  testName: "does not copy unsupported theme fields",
  testText: `  it("does not copy unsupported theme fields", () => {
    const theme = parseUserTheme("{accent: '#ffb86c', density: 'compact', previewLabel: 'ignored'}");
    assert.deepEqual(theme, { accent: "#ffb86c", density: "compact" });
    assert.equal(Object.hasOwn(theme, "previewLabel"), false);
  });`,
  safetyRationale: ["The input uses only a benign application field."],
  remainingUnknowns: ["Other callers are outside this test boundary."],
};

describe("targeted regression-test model boundary", () => {
  it("sends only the six bounded context groups to GPT-5.6", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: proposal });
    const client = { responses: { parse } } as unknown as OpenAI;

    const result = await generateTargetedTestWithOpenAI({ context, client });
    const request = parse.mock.calls[0]![0];
    const supplied = JSON.parse(request.input as string);

    expect(Object.keys(supplied)).toEqual([
      "approvedPlan",
      "dependencyUpdate",
      "compatibilityRepair",
      "source",
      "existingTests",
      "constraints",
    ]);
    expect(JSON.stringify(supplied)).not.toContain("/Users/");
    expect(request).toMatchObject({ model: "gpt-5.6", store: false, reasoning: { effort: "medium" } });
    expect(result).toMatchObject({ model: "gpt-5.6", source: "openai", proposal });
  });

  it("validates the explicit cached safe regression test", async () => {
    const fixturePath = path.resolve(import.meta.dirname, "../../../../demo/expected/targeted-regression-test.json");
    const result = await loadCachedTargetedTest(fixturePath, context);

    expect(result).toMatchObject({ model: "gpt-5.6", source: "cached-demo" });
    expect(result.proposal.testText).toContain("previewLabel");
    expect(result.proposal.testText).not.toContain("__proto__");
  });

  it("rejects weaponized, imported, or multi-test proposals", () => {
    expect(() => validateTargetedTest({
      ...proposal,
      testText: proposal.testText!.replace("assert.deepEqual", "require('fs');\n    assert.deepEqual"),
    }, context)).toThrow("weaponized or disallowed");
    expect(() => validateTargetedTest({
      ...proposal,
      testText: proposal.testText!.replace("assert.deepEqual", "Object.prototype.previewLabel = 'changed';\n    assert.deepEqual"),
    }, context)).toThrow("weaponized or disallowed");
    expect(() => validateTargetedTest({
      ...proposal,
      testText: `${proposal.testText}\n${proposal.testText}`,
    }, context)).toThrow("exactly one test");
  });
});
