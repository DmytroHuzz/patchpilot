import path from "node:path";
import type { VulnerabilityFinding } from "@patchpilot/contracts";
import { VulnerabilityFindingSchema } from "@patchpilot/contracts";
import { OsvScannerOutputSchema, type OsvScannerOutput } from "./osvSchemas.js";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function versionOrder(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function formatRanges(vulnerability: OsvScannerOutput["results"][number]["packages"][number]["vulnerabilities"][number]): string[] {
  return vulnerability.affected.flatMap((affected) => affected.ranges.map((range) => {
    const parts = range.events.flatMap((event) => {
      if (event.introduced !== undefined) return event.introduced === "0" ? ">=0" : `>=${event.introduced}`;
      if (event.fixed !== undefined) return `<${event.fixed}`;
      if (event.last_affected !== undefined) return `<=${event.last_affected}`;
      if (event.limit !== undefined) return `<${event.limit}`;
      return [];
    });
    return `${range.type.toLowerCase()}: ${parts.join(" ")}`;
  })).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

export function normalizeOsvOutput(raw: unknown, repositoryPath: string): VulnerabilityFinding[] {
  const parsed = OsvScannerOutputSchema.parse(raw);

  return parsed.results.flatMap((result) => result.packages.flatMap((packageResult) => {
    if (packageResult.package.ecosystem.toLowerCase() !== "npm") return [];

    const sourcePath = path.resolve(result.source.path);
    const lockfilePath = path.relative(repositoryPath, sourcePath);
    const manifestPath = path.join(path.dirname(lockfilePath), "package.json");

    return packageResult.vulnerabilities.map((vulnerability) => {
      const group = packageResult.groups.find((candidate) => candidate.ids.includes(vulnerability.id));
      const fixedVersions = unique(vulnerability.affected.flatMap((affected) =>
        affected.ranges.flatMap((range) => range.events.flatMap((event) => event.fixed ?? [])),
      )).sort(versionOrder);

      return VulnerabilityFindingSchema.parse({
        id: vulnerability.id,
        aliases: unique(vulnerability.aliases.filter((alias) => alias !== vulnerability.id)),
        packageName: packageResult.package.name,
        ecosystem: "npm",
        installedVersion: packageResult.package.version,
        manifestPath,
        lockfilePath,
        direct: true,
        dependencyPath: [packageResult.package.name],
        severity: vulnerability.database_specific?.severity ?? group?.max_severity,
        summary: vulnerability.summary,
        details: vulnerability.details,
        affectedRanges: formatRanges(vulnerability),
        fixedVersions,
        affectedFunctions: [],
        references: unique(vulnerability.references.map(({ url }) => url)),
        source: "osv",
      });
    });
  }));
}
