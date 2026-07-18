import { describe, expect, it } from "vitest";
import { normalizeOsvOutput } from "./normalizeOsv.js";

const rawFinding = {
  results: [{
    source: { path: "/repo/package-lock.json", type: "lockfile" },
    packages: [{
      package: { name: "json5", version: "1.0.1", ecosystem: "npm" },
      groups: [{ ids: ["GHSA-9c47-m6qq-7p4h"], max_severity: "7.1" }],
      vulnerabilities: [{
        id: "GHSA-9c47-m6qq-7p4h",
        aliases: ["CVE-2022-46175"],
        summary: "Prototype Pollution in JSON5 via Parse Method",
        details: "The parse method accepts a special prototype key.",
        database_specific: { severity: "HIGH" },
        affected: [{
          package: { name: "json5", ecosystem: "npm" },
          ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "1.0.2" }] }],
        }, {
          package: { name: "json5", ecosystem: "npm" },
          ranges: [{ type: "SEMVER", events: [{ introduced: "2.0.0" }, { fixed: "2.2.2" }] }],
        }],
        references: [{ url: "https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h" }],
      }],
    }],
  }],
};

describe("normalizeOsvOutput", () => {
  it("normalizes the golden finding", () => {
    expect(normalizeOsvOutput(rawFinding, "/repo")).toEqual([expect.objectContaining({
      id: "GHSA-9c47-m6qq-7p4h",
      packageName: "json5",
      installedVersion: "1.0.1",
      manifestPath: "package.json",
      lockfilePath: "package-lock.json",
      direct: true,
      severity: "HIGH",
      affectedRanges: ["semver: >=0 <1.0.2", "semver: >=2.0.0 <2.2.2"],
      fixedVersions: ["1.0.2", "2.2.2"],
      source: "osv",
    })]);
  });

  it("rejects malformed scanner output", () => {
    expect(() => normalizeOsvOutput({ results: [{ packages: "invalid" }] }, "/repo")).toThrow();
  });

  it("resolves a lockfile-scoped scanner path from the verified repository", () => {
    const relativeSource = structuredClone(rawFinding);
    relativeSource.results[0]!.source.path = "package-lock.json";

    expect(normalizeOsvOutput(relativeSource, "/verified-worktree")[0]).toMatchObject({
      manifestPath: "package.json",
      lockfilePath: "package-lock.json",
    });
  });
});
