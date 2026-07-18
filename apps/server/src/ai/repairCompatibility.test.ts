import path from "node:path";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { CompatibilityRepairProposal } from "@patchpilot/contracts";
import type { CompatibilityRepairContext } from "./compatibilityRepairContext.js";
import { loadCachedCompatibilityRepair, repairCompatibilityWithOpenAI } from "./repairCompatibility.js";
import { validateCompatibilityRepair } from "./validateCompatibilityRepair.js";

const functionText = `function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);

  return {
    ...DEFAULT_THEME,
    ...userTheme,
  };
}`;

const context: CompatibilityRepairContext = {
  attempt: 1,
  approvedPlan: {
    targetVersion: "1.0.2",
    strategy: "dependency_upgrade_and_code_change",
    explanation: "Copy only supported theme fields.",
    expectedSourceFile: "src/theme.js",
    compatibilityRisks: ["Unknown fields will be dropped."],
  },
  dependencyUpdate: {
    packageName: "json5",
    fromVersion: "1.0.1",
    targetVersion: "1.0.2",
    changedFiles: ["package-lock.json", "package.json"],
    unrelatedDependenciesChanged: false,
  },
  source: { file: "src/theme.js", functionName: "parseUserTheme", functionText },
  previousSyntaxFailure: null,
  constraints: {
    allowedFile: "src/theme.js",
    allowedOperation: "replace_exact_function",
    maxAttempts: 2,
    noTestChanges: true,
  },
};

const proposal: CompatibilityRepairProposal = {
  attempt: 1,
  action: "apply_replacement",
  classification: "planned_source_hardening",
  explanation: "Copy only supported fields.",
  file: "src/theme.js",
  oldText: functionText,
  newText: `function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);
  return {
    accent: typeof userTheme.accent === "string" ? userTheme.accent : DEFAULT_THEME.accent,
    density: typeof userTheme.density === "string" ? userTheme.density : DEFAULT_THEME.density,
  };
}`,
  compatibilityRisks: ["Unknown fields will be dropped."],
  remainingUnknowns: ["Runtime callers may expect unknown fields."],
};

describe("compatibility repair model boundary", () => {
  it("sends only the six bounded context groups to GPT-5.6", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: proposal });
    const client = { responses: { parse } } as unknown as OpenAI;

    const result = await repairCompatibilityWithOpenAI({ context, client });
    const request = parse.mock.calls[0]![0];
    const supplied = JSON.parse(request.input as string);

    expect(Object.keys(supplied)).toEqual([
      "attempt",
      "approvedPlan",
      "dependencyUpdate",
      "source",
      "previousSyntaxFailure",
      "constraints",
    ]);
    expect(JSON.stringify(supplied)).not.toContain("/Users/");
    expect(request).toMatchObject({ model: "gpt-5.6", store: false, reasoning: { effort: "medium" } });
    expect(result).toMatchObject({ model: "gpt-5.6", source: "openai", proposal });
  });

  it("validates the explicit cached golden repair", async () => {
    const fixturePath = path.resolve(import.meta.dirname, "../../../../demo/expected/compatibility-repair.json");

    const result = await loadCachedCompatibilityRepair(fixturePath, context);

    expect(result).toMatchObject({ model: "gpt-5.6", source: "cached-demo" });
    expect(result.proposal.file).toBe("src/theme.js");
    expect(result.proposal.newText).not.toContain("...userTheme");
  });

  it("rejects stale or broad source replacements", () => {
    expect(() => validateCompatibilityRepair({ ...proposal, oldText: "stale" }, context)).toThrow("exact supplied function");
    expect(() => validateCompatibilityRepair({ ...proposal, newText: proposal.newText!.replace("return {", "return { ...userTheme,") }, context)).toThrow("complete parsed object");
    expect(() => validateCompatibilityRepair({ ...proposal, newText: `${proposal.newText}\nprocess.exit(0);` }, context)).toThrow("only the exact function");
  });
});
