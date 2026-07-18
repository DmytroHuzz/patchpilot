import path from "node:path";
import type { VulnerabilityFinding } from "@patchpilot/contracts";
import { VulnerabilityFindingSchema } from "@patchpilot/contracts";
import { normalizeOsvAdvisory } from "../advisory/normalizeAdvisory.js";
import { OsvScannerOutputSchema, type OsvScannerOutput } from "./osvSchemas.js";

export function normalizeOsvOutput(raw: unknown, repositoryPath: string): VulnerabilityFinding[] {
  const parsed = OsvScannerOutputSchema.parse(raw);

  return parsed.results.flatMap((result) => result.packages.flatMap((packageResult) => {
    if (packageResult.package.ecosystem.toLowerCase() !== "npm") return [];

    const sourcePath = path.resolve(repositoryPath, result.source.path);
    const lockfilePath = path.relative(repositoryPath, sourcePath);
    const manifestPath = path.join(path.dirname(lockfilePath), "package.json");

    return packageResult.vulnerabilities.map((vulnerability) => {
      const advisory = normalizeOsvAdvisory(vulnerability);
      const group = packageResult.groups.find((candidate) => candidate.ids.includes(vulnerability.id));

      return VulnerabilityFindingSchema.parse({
        id: advisory.id,
        aliases: advisory.aliases,
        packageName: packageResult.package.name,
        ecosystem: "npm",
        installedVersion: packageResult.package.version,
        manifestPath,
        lockfilePath,
        direct: true,
        dependencyPath: [packageResult.package.name],
        severity: advisory.severity ?? group?.max_severity,
        summary: advisory.summary,
        details: advisory.details,
        affectedRanges: advisory.affectedRanges,
        fixedVersions: advisory.fixedVersions,
        affectedFunctions: advisory.affectedFunctions,
        references: advisory.references,
        source: "osv",
      });
    });
  }));
}
