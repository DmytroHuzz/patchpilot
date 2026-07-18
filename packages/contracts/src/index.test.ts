import { describe, expect, it } from "vitest";
import { AffectednessAssessmentSchema, NormalizedScanResultSchema, productName } from "./index.js";

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
});
