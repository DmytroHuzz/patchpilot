import path from "node:path";
import { describe, expect, it } from "vitest";
import type { NormalizedAdvisory, VulnerabilityFinding } from "@patchpilot/contracts";
import { collectRepositoryEvidence } from "./collectEvidence.js";

const repositoryPath = path.resolve(import.meta.dirname, "../../../../demo/vulnerable-node-app");
const finding: VulnerabilityFinding = {
  id: "GHSA-9c47-m6qq-7p4h",
  aliases: ["CVE-2022-46175"],
  packageName: "json5",
  ecosystem: "npm",
  installedVersion: "1.0.1",
  manifestPath: "package.json",
  lockfilePath: "package-lock.json",
  direct: true,
  dependencyPath: ["json5"],
  severity: "HIGH",
  summary: "Prototype Pollution in JSON5 via Parse Method",
  details: "The `parse` method accepts an advisory-mentioned `__proto__` key.",
  affectedRanges: ["semver: >=0 <1.0.2"],
  fixedVersions: ["1.0.2"],
  affectedFunctions: [],
  references: ["https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h"],
  source: "osv",
};
const advisory: NormalizedAdvisory = {
  id: finding.id,
  aliases: finding.aliases,
  summary: finding.summary,
  details: finding.details,
  severity: finding.severity,
  affectedRanges: finding.affectedRanges,
  fixedVersions: finding.fixedVersions,
  affectedFunctions: [],
  references: finding.references,
  source: "cached-demo",
};

describe("collectRepositoryEvidence", () => {
  it("finds the golden import and exact parse call", async () => {
    const bundle = await collectRepositoryEvidence({ repositoryPath, finding, advisory });
    const importEvidence = bundle.items.find((item) => item.type === "import");
    const callEvidence = bundle.items.find((item) => item.type === "call-site");

    expect(importEvidence).toMatchObject({ file: "src/theme.js", startLine: 1, endLine: 1 });
    expect(importEvidence?.excerpt).toContain('require("json5")');
    expect(callEvidence).toMatchObject({ file: "src/theme.js", startLine: 8, endLine: 10 });
    expect(callEvidence?.excerpt).toContain("JSON5.parse(rawTheme)");
  });

  it("records bounded absence without claiming non-applicability", async () => {
    const bundle = await collectRepositoryEvidence({ repositoryPath, finding, advisory });
    const absence = bundle.items.find((item) => item.type === "absence");

    expect(absence?.explanation).toContain("__proto__");
    expect(absence?.explanation).toContain("not proof of non-applicability");
    expect(absence?.file).toBeUndefined();
  });

  it("returns only repository-relative evidence locations", async () => {
    const bundle = await collectRepositoryEvidence({ repositoryPath, finding, advisory });

    for (const item of bundle.items.filter((candidate) => candidate.file)) {
      expect(path.isAbsolute(item.file!)).toBe(false);
      expect(item.file).not.toContain("..");
      expect(item.startLine).toBeGreaterThan(0);
      expect(item.endLine).toBeGreaterThanOrEqual(item.startLine!);
    }
  });

  it("reports truncation when collection limits are reached", async () => {
    const bundle = await collectRepositoryEvidence({
      repositoryPath,
      finding,
      advisory,
      limits: { maxFiles: 1 },
    });

    expect(bundle.truncated).toBe(true);
    expect(bundle.searchedFiles).toHaveLength(1);
  });
});
