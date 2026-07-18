import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AffectednessAssessment,
  EvidenceItem,
  VulnerabilityFinding,
} from "@patchpilot/contracts";

export interface RemediationContext {
  finding: {
    id: string;
    packageName: string;
    installedVersion: string;
    fixedVersions: string[];
    manifestPath: string;
    lockfilePath?: string;
    direct: boolean;
  };
  assessment: AffectednessAssessment;
  packageMetadata: {
    name: string;
    dependencies: Record<string, string>;
    scripts: string[];
  };
  relevantSourceExcerpts: Array<Pick<EvidenceItem, "id" | "type" | "file" | "startLine" | "endLine" | "excerpt" | "explanation">>;
  testStructure: {
    testFiles: string[];
    availableScripts: string[];
  };
  allowedFiles: string[];
  allowedCommands: string[];
}

export async function createRemediationContext(options: {
  repositoryPath: string;
  finding: VulnerabilityFinding;
  assessment: AffectednessAssessment;
  evidence: EvidenceItem[];
  searchedFiles: string[];
}): Promise<RemediationContext> {
  const rawManifest = JSON.parse(await readFile(path.join(options.repositoryPath, "package.json"), "utf8")) as {
    name?: unknown;
    dependencies?: unknown;
    scripts?: unknown;
  };
  const dependencies = rawManifest.dependencies && typeof rawManifest.dependencies === "object"
    ? Object.fromEntries(Object.entries(rawManifest.dependencies).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  const scripts = rawManifest.scripts && typeof rawManifest.scripts === "object"
    ? Object.keys(rawManifest.scripts).sort()
    : [];
  const evidenceFiles = options.evidence.flatMap((item) => item.file ? [item.file] : []);
  const testFiles = options.searchedFiles.filter((file) => /(^|\/)(?:test|tests|__tests__)(\/|\.)/.test(file));
  const allowedFiles = [...new Set([
    options.finding.manifestPath,
    ...(options.finding.lockfilePath ? [options.finding.lockfilePath] : []),
    ...evidenceFiles,
    ...testFiles,
  ])].sort();
  const allowedCommands = [
    `npm install ${options.finding.packageName}@${options.finding.fixedVersions[0]} --save-exact`,
    ...scripts.filter((script) => ["test", "build", "lint"].includes(script)).map((script) => `npm run ${script}`),
    "osv-scanner scan source .",
  ];

  return {
    finding: {
      id: options.finding.id,
      packageName: options.finding.packageName,
      installedVersion: options.finding.installedVersion,
      fixedVersions: options.finding.fixedVersions,
      manifestPath: options.finding.manifestPath,
      lockfilePath: options.finding.lockfilePath,
      direct: options.finding.direct,
    },
    assessment: options.assessment,
    packageMetadata: {
      name: typeof rawManifest.name === "string" ? rawManifest.name : path.basename(options.repositoryPath),
      dependencies,
      scripts,
    },
    relevantSourceExcerpts: options.evidence
      .filter((item) => item.file && item.excerpt)
      .map(({ id, type, file, startLine, endLine, excerpt, explanation }) => ({
        id,
        type,
        file,
        startLine,
        endLine,
        excerpt,
        explanation,
      })),
    testStructure: { testFiles, availableScripts: scripts },
    allowedFiles,
    allowedCommands,
  };
}
