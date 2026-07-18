import path from "node:path";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { AffectednessAssessment, RepositoryEvidenceBundle } from "@patchpilot/contracts";
import type { AffectednessContext } from "./affectednessContext.js";
import { assessAffectednessWithOpenAI, loadCachedAssessment } from "./assessAffectedness.js";

const assessment: AffectednessAssessment = {
  verdict: "likely_affected",
  confidence: "medium",
  rationale: "The supplied code calls the advisory-relevant method [evidence-01].",
  supportingEvidenceIds: ["evidence-01"],
  counterEvidenceIds: [],
  unknowns: ["Runtime reachability is unknown."],
  limitations: ["Static evidence only."],
  recommendedNextChecks: ["Trace the input boundary."],
};
const evidence: RepositoryEvidenceBundle = {
  repositoryPath: "/not-sent",
  findingId: "GHSA-9c47-m6qq-7p4h",
  searchedFiles: ["src/theme.js"],
  searchedBytes: 64,
  truncated: false,
  items: [{
    id: "evidence-01",
    type: "call-site",
    file: "src/theme.js",
    startLine: 9,
    endLine: 9,
    excerpt: "JSON5.parse(rawTheme)",
    explanation: "Relevant call.",
    deterministic: true,
  }],
};
const context: AffectednessContext = {
  normalizedAdvisory: {
    id: evidence.findingId,
    aliases: [],
    summary: "Prototype Pollution in JSON5 via Parse Method",
    details: "The parse method accepts an advisory-mentioned key.",
    affectedRanges: ["semver: >=0 <1.0.2"],
    fixedVersions: ["1.0.2"],
    affectedFunctions: [],
    references: ["https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h"],
    source: "cached-demo",
  },
  packageRelationship: {
    packageName: "json5",
    ecosystem: "npm",
    installedVersion: "1.0.1",
    manifestPath: "package.json",
    lockfilePath: "package-lock.json",
    direct: true,
    dependencyPath: ["json5"],
  },
  repositoryMetadata: {
    name: "patchpilot-golden-demo",
    packageManager: "npm",
    scripts: ["test"],
    searchedFiles: evidence.searchedFiles,
    searchedBytes: evidence.searchedBytes,
    evidenceTruncated: evidence.truncated,
  },
  boundedEvidence: evidence.items,
};

describe("affectedness assessment", () => {
  it("sends only the four approved context groups to GPT-5.6", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: assessment });
    const client = { responses: { parse } } as unknown as OpenAI;

    const result = await assessAffectednessWithOpenAI({ context, evidence, client });
    const request = parse.mock.calls[0]![0];
    const suppliedContext = JSON.parse(request.input as string);

    expect(Object.keys(suppliedContext)).toEqual([
      "normalizedAdvisory",
      "packageRelationship",
      "repositoryMetadata",
      "boundedEvidence",
    ]);
    expect(JSON.stringify(suppliedContext)).not.toContain("/not-sent");
    expect(request).toMatchObject({ model: "gpt-5.6", store: false, reasoning: { effort: "medium" } });
    expect(result).toMatchObject({ model: "gpt-5.6", source: "openai", assessment });
  });

  it("validates the checked-in fallback with explicit provenance", async () => {
    const demoEvidence: RepositoryEvidenceBundle = {
      ...evidence,
      items: [
        { ...evidence.items[0]!, id: "evidence-01", type: "import" },
        { ...evidence.items[0]!, id: "evidence-02", type: "call-site" },
        {
          id: "evidence-03",
          type: "absence",
          explanation: "Bounded absence is not proof of non-applicability.",
          deterministic: true,
        },
      ],
    };
    const fixturePath = path.resolve(import.meta.dirname, "../../../../demo/expected/affectedness-assessment.json");

    const result = await loadCachedAssessment(fixturePath, demoEvidence);

    expect(result).toMatchObject({ model: "gpt-5.6", source: "cached-demo" });
    expect(result.assessment.unknowns.length).toBeGreaterThan(0);
    expect(result.assessment.limitations.length).toBeGreaterThan(0);
  });
});
