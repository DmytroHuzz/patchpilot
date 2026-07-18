import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  EvidenceItem,
  NormalizedAdvisory,
  RepositoryEvidenceBundle,
  VulnerabilityFinding,
} from "@patchpilot/contracts";

export interface AffectednessContext {
  normalizedAdvisory: NormalizedAdvisory;
  packageRelationship: {
    packageName: string;
    ecosystem: "npm";
    installedVersion: string;
    manifestPath: string;
    lockfilePath?: string;
    direct: boolean;
    dependencyPath: string[];
  };
  repositoryMetadata: {
    name: string;
    packageManager: "npm";
    scripts: string[];
    searchedFiles: string[];
    searchedBytes: number;
    evidenceTruncated: boolean;
  };
  boundedEvidence: EvidenceItem[];
}

export async function createAffectednessContext(options: {
  repositoryPath: string;
  finding: VulnerabilityFinding;
  advisory: NormalizedAdvisory;
  evidence: RepositoryEvidenceBundle;
}): Promise<AffectednessContext> {
  const manifest = JSON.parse(await readFile(path.join(options.repositoryPath, "package.json"), "utf8")) as {
    name?: unknown;
    scripts?: unknown;
  };
  const scripts = manifest.scripts && typeof manifest.scripts === "object"
    ? Object.keys(manifest.scripts).sort()
    : [];

  return {
    normalizedAdvisory: options.advisory,
    packageRelationship: {
      packageName: options.finding.packageName,
      ecosystem: options.finding.ecosystem,
      installedVersion: options.finding.installedVersion,
      manifestPath: options.finding.manifestPath,
      lockfilePath: options.finding.lockfilePath,
      direct: options.finding.direct,
      dependencyPath: options.finding.dependencyPath,
    },
    repositoryMetadata: {
      name: typeof manifest.name === "string" ? manifest.name : path.basename(options.repositoryPath),
      packageManager: "npm",
      scripts,
      searchedFiles: options.evidence.searchedFiles,
      searchedBytes: options.evidence.searchedBytes,
      evidenceTruncated: options.evidence.truncated,
    },
    boundedEvidence: options.evidence.items,
  };
}
