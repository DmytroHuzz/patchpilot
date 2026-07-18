import { describe, expect, it } from "vitest";
import {
  AffectednessAssessmentSchema,
  NormalizedScanResultSchema,
  RemediationPlanSchema,
  productName,
} from "./index.js";

describe("contracts package", () => {
  it("exports the product identity", () => {
    expect(productName).toBe("PatchPilot");
  });

  it("rejects incomplete normalized scan results", () => {
    expect(() => NormalizedScanResultSchema.parse({ scanner: "osv-scanner" })).toThrow();
  });

  it("rejects non-enumerated verdicts and incomplete uncertainty", () => {
    const assessment = {
      verdict: "not_affected",
      confidence: "high",
      rationale: "Unsupported conclusion",
      supportingEvidenceIds: [],
      counterEvidenceIds: [],
      unknowns: [],
      limitations: [],
      recommendedNextChecks: ["Review input handling"],
    };

    expect(() => AffectednessAssessmentSchema.parse(assessment)).toThrow();
  });

  it("requires human approval in every remediation plan", () => {
    expect(() => RemediationPlanSchema.parse({
      targetVersion: "1.0.2",
      strategy: "dependency_upgrade",
      explanation: "Upgrade to the fixed release.",
      expectedFiles: ["package.json"],
      expectedCompatibilityRisks: ["Dependency behavior may change."],
      proposedCommands: ["npm install json5@1.0.2 --save-exact"],
      proposedTests: ["npm test"],
      requiresHumanApproval: false,
    })).toThrow();
  });
});
