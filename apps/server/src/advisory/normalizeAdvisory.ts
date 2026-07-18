import { NormalizedAdvisorySchema, type NormalizedAdvisory } from "@patchpilot/contracts";
import { OsvVulnerabilitySchema } from "../scanning/osvSchemas.js";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function versionOrder(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function safeAdvisoryDetails(details: string): string {
  const withoutExamples = details.split("\n## Details", 1)[0]?.trim();
  return withoutExamples || "No advisory details supplied.";
}

export function formatAffectedRanges(raw: unknown): string[] {
  const vulnerability = OsvVulnerabilitySchema.parse(raw);

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

export function normalizeOsvAdvisory(raw: unknown): NormalizedAdvisory {
  const vulnerability = OsvVulnerabilitySchema.parse(raw);
  const fixedVersions = unique(vulnerability.affected.flatMap((affected) =>
    affected.ranges.flatMap((range) => range.events.flatMap((event) => event.fixed ?? [])),
  )).sort(versionOrder);
  const affectedFunctions = unique(vulnerability.affected.flatMap((affected) =>
    affected.ecosystem_specific?.affected_functions ?? [],
  ));

  return NormalizedAdvisorySchema.parse({
    id: vulnerability.id,
    aliases: unique(vulnerability.aliases.filter((alias) => alias !== vulnerability.id)),
    summary: vulnerability.summary,
    details: safeAdvisoryDetails(vulnerability.details),
    severity: vulnerability.database_specific?.severity,
    affectedRanges: formatAffectedRanges(vulnerability),
    fixedVersions,
    affectedFunctions,
    references: unique(vulnerability.references.map(({ url }) => url)),
    source: "osv",
  });
}
