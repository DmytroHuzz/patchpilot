import path from "node:path";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { RemediationPlan } from "@patchpilot/contracts";
import type { RemediationContext } from "./remediationContext.js";
import { loadCachedRemediationPlan, planRemediationWithOpenAI } from "./planRemediation.js";
import { validateRemediationPlan } from "./validateRemediationPlan.js";

const context: RemediationContext = {
  finding: {
    id: "GHSA-9c47-m6qq-7p4h",
    packageName: "json5",
    installedVersion: "1.0.1",
    fixedVersions: ["1.0.2", "2.2.2"],
    manifestPath: "package.json",
    lockfilePath: "package-lock.json",
    direct: true,
  },
  assessment: {
    verdict: "likely_affected",
    confidence: "medium",
    rationale: "The relevant parse call is present [evidence-02].",
    supportingEvidenceIds: ["evidence-02"],
    counterEvidenceIds: [],
    unknowns: ["Runtime input provenance is unknown."],
    limitations: ["Static evidence only."],
    recommendedNextChecks: ["Trace the input boundary."],
  },
  packageMetadata: {
    name: "patchpilot-golden-demo",
    dependencies: { json5: "1.0.1" },
    scripts: ["build", "test"],
  },
  relevantSourceExcerpts: [{
    id: "evidence-02",
    type: "call-site",
    file: "src/theme.js",
    startLine: 8,
    endLine: 10,
    excerpt: "const userTheme = JSON5.parse(rawTheme);",
    explanation: "Calls JSON5.parse.",
  }],
  testStructure: {
    testFiles: ["test/theme.test.js"],
    availableScripts: ["build", "test"],
  },
  allowedFiles: ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"],
  allowedCommands: [
    "npm install json5@1.0.2 --save-exact",
    "npm run build",
    "npm run test",
    "osv-scanner scan source .",
  ],
};
const plan: RemediationPlan = {
  targetVersion: "1.0.2",
  strategy: "dependency_upgrade_and_code_change",
  explanation: "Upgrade and copy only supported theme fields.",
  expectedFiles: ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"],
  expectedCompatibilityRisks: ["Unknown theme keys will be dropped."],
  proposedCommands: ["npm install json5@1.0.2 --save-exact", "npm run test"],
  proposedTests: ["Run existing and targeted tests."],
  requiresHumanApproval: true,
};

describe("remediation planning", () => {
  it("uses GPT-5.6 Structured Outputs without adding context groups", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: plan });
    const client = { responses: { parse } } as unknown as OpenAI;

    const result = await planRemediationWithOpenAI({ context, client });
    const request = parse.mock.calls[0]![0];

    expect(JSON.parse(request.input as string)).toEqual(context);
    expect(request).toMatchObject({ model: "gpt-5.6", store: false, reasoning: { effort: "medium" } });
    expect(result).toMatchObject({ model: "gpt-5.6", source: "openai", plan });
  });

  it("validates the explicitly labeled cached plan", async () => {
    const fixturePath = path.resolve(import.meta.dirname, "../../../../demo/expected/remediation-plan.json");

    const result = await loadCachedRemediationPlan(fixturePath, context);

    expect(result).toMatchObject({ model: "gpt-5.6", source: "cached-demo" });
    expect(result.plan.requiresHumanApproval).toBe(true);
    expect(result.plan.expectedFiles).toContain("src/theme.js");
  });

  it("rejects targets, files, and commands outside supplied bounds", () => {
    expect(() => validateRemediationPlan({ ...plan, targetVersion: "9.9.9" }, context)).toThrow("not a supplied fixed version");
    expect(() => validateRemediationPlan({ ...plan, expectedFiles: ["package.json", "../secret"] }, context)).toThrow("disallowed file");
    expect(() => validateRemediationPlan({ ...plan, proposedCommands: ["rm -rf ."] }, context)).toThrow("disallowed command");
  });
});
