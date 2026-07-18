import { describe, expect, it } from "vitest";
import type { AffectednessAssessment, RepositoryEvidenceBundle } from "@patchpilot/contracts";
import { validateAffectednessAssessment } from "./validateAssessment.js";

const evidence: RepositoryEvidenceBundle = {
  repositoryPath: "/bounded/repository",
  findingId: "GHSA-9c47-m6qq-7p4h",
  searchedFiles: ["src/theme.js"],
  searchedBytes: 120,
  truncated: false,
  items: [
    {
      id: "evidence-01",
      type: "call-site",
      file: "src/theme.js",
      startLine: 9,
      endLine: 9,
      excerpt: "JSON5.parse(rawTheme)",
      explanation: "Calls the advisory-relevant method.",
      deterministic: true,
    },
    {
      id: "evidence-02",
      type: "absence",
      explanation: "A bounded search found no __proto__ literal; absence is not proof of non-applicability.",
      deterministic: true,
    },
  ],
};

const valid: AffectednessAssessment = {
  verdict: "likely_affected",
  confidence: "medium",
  rationale: "A relevant call is present [evidence-01], but runtime reachability is unknown.",
  supportingEvidenceIds: ["evidence-01"],
  counterEvidenceIds: ["evidence-02"],
  unknowns: ["Runtime input provenance is unknown."],
  limitations: ["Static bounded search only."],
  recommendedNextChecks: ["Trace input provenance."],
};

describe("validateAffectednessAssessment", () => {
  it("accepts a bounded assessment whose citations all exist", () => {
    expect(validateAffectednessAssessment(valid, evidence)).toEqual(valid);
  });

  it("rejects invented evidence IDs", () => {
    expect(() => validateAffectednessAssessment({
      ...valid,
      supportingEvidenceIds: ["evidence-99"],
    }, evidence)).toThrow("unknown evidence ID");
  });

  it("never permits absence evidence to support affectedness", () => {
    expect(() => validateAffectednessAssessment({
      ...valid,
      supportingEvidenceIds: ["evidence-02"],
      counterEvidenceIds: [],
    }, evidence)).toThrow("Absence evidence cannot support");
  });

  it("rejects a no-usage verdict that contradicts a deterministic call site", () => {
    expect(() => validateAffectednessAssessment({
      ...valid,
      verdict: "no_relevant_usage_found",
    }, evidence)).toThrow("contradicts deterministic call-site evidence");
  });

  it("rejects unsupported not-affected prose", () => {
    expect(() => validateAffectednessAssessment({
      ...valid,
      rationale: "The repository is not affected.",
    }, evidence)).toThrow("unsupported not-affected claim");
  });
});
